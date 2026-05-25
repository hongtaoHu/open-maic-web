// SPDX-License-Identifier: AGPL-3.0
import { generateSceneContent } from '@/api';
import { useStageStore } from '@/stores/stage';
import type { ClassroomStreamStartInput, SceneOutline } from '@/types/classroom-stream';
import type {
  GenerateSceneAgent,
  GenerateSceneContentParams,
  GenerateSceneContentRawResult,
  GenerateSceneOutline,
  GeneratedScene,
  GenerateLlmHeadersOptions,
} from '@/types/generate';
import type { Scene, SceneType, Stage } from '@/types/stage';
import type { ClassroomOutlineCache } from '@/utils/classroomGenerationCache';
import { normalizeGenerationCache } from '@/utils/classroomGenerationCache';
import {
  loadClassroomOutlineCache,
  saveClassroomOutlineCache,
  scenesFromStreamOutlines,
} from '@/utils/classroomStream';
import { normalizeSlidePayload, hasSlideElements, hasRenderableSlideContent } from '@/utils/slidePreview';

export function normalizeGeneratedScene(generated: GeneratedScene): GeneratedScene {
  return {
    ...generated,
    content: normalizeSlidePayload(generated.content),
  };
}

function parseApiContentField(content: unknown): Record<string, unknown> {
  if (typeof content === 'string') {
    return normalizeSlidePayload(content);
  }
  if (content && typeof content === 'object') {
    return normalizeSlidePayload(content);
  }
  return {};
}

const SCENE_TYPES: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

function normalizeSceneType(type: string | undefined, fallback: SceneType = 'slide'): SceneType {
  const normalized = (type ?? '').trim().toLowerCase() as SceneType;
  return SCENE_TYPES.includes(normalized) ? normalized : fallback;
}

function mergeGeneratedIntoScene(base: Scene, generated: GeneratedScene): Scene {
  const normalized = normalizeGeneratedScene(generated);
  const slidePayload = normalized.content;
  const outlineMeta: Record<string, unknown> = {};
  for (const key of [
    'description',
    'keyPoints',
    'estimatedMinutes',
    'languageNote',
    'widgetType',
    'widgetOutline',
  ] as const) {
    if (base.content[key] !== undefined) {
      outlineMeta[key] = base.content[key];
    }
  }

  return {
    ...base,
    id: generated.id || base.id,
    type: normalizeSceneType(generated.type, base.type),
    title: generated.title || base.title,
    content: hasSlideElements(slidePayload)
      ? { ...outlineMeta, ...slidePayload }
      : { ...outlineMeta, ...normalized.content },
  };
}

export function mapClassroomOutlineList(raw: unknown): SceneOutline[] {
  if (!Array.isArray(raw)) return [];
  const outlines: SceneOutline[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? '').trim();
    if (!title) continue;
    const keyPoints = Array.isArray(o.keyPoints)
      ? o.keyPoints.map((point) => String(point))
      : undefined;
    const outline: SceneOutline = {
      title,
      type: typeof o.type === 'string' ? o.type : 'slide',
      order: typeof o.order === 'number' ? o.order : index,
    };
    if (typeof o.id === 'string') outline.id = o.id;
    if (typeof o.description === 'string') outline.description = o.description;
    if (keyPoints?.length) outline.keyPoints = keyPoints;
    if (typeof o.estimatedMinutes === 'number') {
      outline.estimatedMinutes = o.estimatedMinutes;
    }
    if (typeof o.languageNote === 'string') outline.languageNote = o.languageNote;
    if (typeof o.widgetType === 'string') outline.widgetType = o.widgetType;
    if (o.widgetOutline && typeof o.widgetOutline === 'object') {
      outline.widgetOutline = o.widgetOutline as Record<string, unknown>;
    }
    outlines.push(outline);
  }
  return outlines;
}

export function getSortedStreamOutlines(outlines: SceneOutline[]): SceneOutline[] {
  return [...outlines]
    .filter((outline) => outline?.title?.trim())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function toGenerateSceneOutline(
  outline: SceneOutline,
  index: number,
  _classroomId?: string,
): GenerateSceneOutline {
  return {
    id: outline.id ?? `scene_${index + 1}`,
    type: outline.type,
    title: outline.title,
    description: outline.description,
    keyPoints: outline.keyPoints,
    order: outline.order ?? index,
    estimatedMinutes: outline.estimatedMinutes,
    languageNote: outline.languageNote,
    widgetType: outline.widgetType,
    widgetOutline: outline.widgetOutline as GenerateSceneOutline['widgetOutline'],
  };
}

function toGenerateAgents(input: ClassroomStreamStartInput): GenerateSceneAgent[] {
  return input.agentConfigs.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    persona: agent.persona,
    avatar: agent.avatar,
    color: agent.color,
    allowedActions: agent.allowedActions,
    priority: agent.priority,
  }));
}

export function buildSceneContentRequest(params: {
  classroomId: string;
  outline: SceneOutline;
  allOutlines: SceneOutline[];
  input: ClassroomStreamStartInput;
  stage: Stage | null;
  languageDirective?: string;
}): GenerateSceneContentParams {
  const sorted = getSortedStreamOutlines(params.allOutlines);
  const outlineIndex = sorted.findIndex(
    (item) => item === params.outline || item.title === params.outline.title,
  );
  const index = outlineIndex >= 0 ? outlineIndex : 0;
  const directive =
    params.languageDirective?.trim() ||
    params.stage?.languageDirective?.trim() ||
    '';

  return {
    outline: toGenerateSceneOutline(params.outline, index, params.classroomId),
    allOutlines: sorted.map((item, i) =>
      toGenerateSceneOutline(item, i, params.classroomId),
    ),
    pdfImages: [],
    imageMapping: {},
    stageInfo: {
      name: params.stage?.name ?? params.input.userQuestion?.trim() ?? '课堂',
      description: params.stage?.description ?? params.input.systemPrompt?.trim() ?? '',
      languageDirective: directive || undefined,
      style: 'professional',
    },
    stageId: params.classroomId,
    agents: toGenerateAgents(params.input),
    languageDirective: directive || undefined,
  };
}

export function toGeneratedSceneFromContentResponse(
  res: GenerateSceneContentRawResult,
  outline: SceneOutline,
  index = 0,
): GeneratedScene | null {
  if (!res.success) return null;

  if (res.scene && typeof res.scene === 'object') {
    return normalizeGeneratedScene({
      ...res.scene,
      content: normalizeSlidePayload(res.scene.content),
    });
  }

  const effective = res.effectiveOutline;
  const parsed = parseApiContentField(res.content);
  const slidePayload = hasSlideElements(parsed)
    ? parsed
    : normalizeSlidePayload(res as unknown as Record<string, unknown>);

  return normalizeGeneratedScene({
    id: String(
      (parsed as Record<string, unknown>).id ??
        effective?.id ??
        outline.id ??
        `scene-${index}`,
    ),
    type: String(
      (parsed as Record<string, unknown>).type ??
        effective?.type ??
        outline.type ??
        'slide',
    ),
    title: String(
      (parsed as Record<string, unknown>).title ??
        effective?.title ??
        outline.title ??
        '',
    ),
    order:
      typeof (parsed as Record<string, unknown>).order === 'number'
        ? ((parsed as Record<string, unknown>).order as number)
        : (effective?.order ?? outline.order ?? index),
    content: slidePayload,
  });
}

export function buildSceneFromGenerated(
  classroomId: string,
  outline: SceneOutline,
  index: number,
  generated: GeneratedScene,
): Scene {
  const base = scenesFromStreamOutlines(classroomId, [outline])[0];
  if (!base) {
    return {
      id: generated.id || `scene-${classroomId}-${index}`,
      stageId: classroomId,
      type: normalizeSceneType(generated.type),
      title: generated.title,
      order: generated.order ?? index,
      content: generated.content ?? {},
    };
  }
  return mergeGeneratedIntoScene(base, generated);
}

export function buildScenesFromGeneratedList(
  classroomId: string,
  outlines: SceneOutline[],
  generatedScenes: GeneratedScene[],
): Scene[] {
  const sorted = getSortedStreamOutlines(outlines);
  const baseScenes = scenesFromStreamOutlines(classroomId, sorted);
  return baseScenes.map((base, index) => {
    const generated = generatedScenes[index];
    if (!generated) return base;
    return mergeGeneratedIntoScene(base, normalizeGeneratedScene(generated));
  });
}

export function shouldHydrateStageFromCache(
  classroomId: string,
  cache: ClassroomOutlineCache,
): boolean {
  const stageStore = useStageStore();
  const normalized = normalizeGenerationCache(cache);
  if (stageStore.stage?.id !== classroomId) return true;
  if (stageStore.scenes.length < normalized.outlines.length) return true;
  if (stageStore.scenes.length < normalized.generatedScenes.length) return true;

  for (let index = 0; index < normalized.generatedScenes.length; index += 1) {
    const generated = normalizeGeneratedScene(normalized.generatedScenes[index]);
    const scene =
      stageStore.scenes.find((item) => item.order === index) ?? stageStore.scenes[index];
    if (!scene) return true;
    if (
      !hasRenderableSlideContent(scene.content) &&
      hasRenderableSlideContent(generated.content)
    ) {
      return true;
    }
  }

  return false;
}

function persistGenerationCache(
  classroomId: string,
  patch: Partial<ClassroomOutlineCache> & Pick<ClassroomOutlineCache, 'outlines'>,
) {
  const existing = normalizeGenerationCache(
    loadClassroomOutlineCache(classroomId) ?? {
      classroomId,
      outlineText: patch.outlineText ?? '',
      outlines: patch.outlines,
    },
  );

  saveClassroomOutlineCache({
    ...existing,
    ...patch,
    classroomId,
    outlines: patch.outlines,
    generatedScenes: patch.generatedScenes ?? existing.generatedScenes,
    nextSceneIndex: patch.nextSceneIndex ?? existing.nextSceneIndex,
  });
}

export function hydrateStageFromGenerationCache(
  classroomId: string,
  cache: ClassroomOutlineCache,
  input: ClassroomStreamStartInput,
) {
  const normalized = normalizeGenerationCache(cache);
  const stageStore = useStageStore();
  const sorted = getSortedStreamOutlines(normalized.outlines);
  const directive =
    normalized.languageDirective?.trim() ||
    stageStore.stage?.languageDirective?.trim() ||
    '';

  const scenes = buildScenesFromGeneratedList(
    classroomId,
    sorted,
    normalized.generatedScenes,
  );

  stageStore.initStageWithGeneratedScenes(classroomId, {
    name: input.userQuestion?.trim() || '课堂',
    description: input.systemPrompt?.trim() || undefined,
    agentIds: input.agentConfigs.map((agent) => agent.id),
    languageDirective: directive || undefined,
  }, scenes);
}

/** 首个场景生成完成后：仅写入第一个场景并跳转 */
export function applyInitialGeneratedScene(
  classroomId: string,
  outlines: SceneOutline[],
  generated: GeneratedScene | null | undefined,
  options: {
    input: ClassroomStreamStartInput;
    languageDirective?: string;
    outlineText?: string;
  },
) {
  if (!generated) return;

  const normalized = normalizeGeneratedScene(generated);
  const stageStore = useStageStore();
  const sorted = getSortedStreamOutlines(outlines);
  const directive =
    options.languageDirective?.trim() ||
    stageStore.stage?.languageDirective?.trim() ||
    '';

  const scenes = buildScenesFromGeneratedList(classroomId, sorted, [normalized]);

  stageStore.initStageWithGeneratedScenes(
    classroomId,
    {
      name: options.input.userQuestion?.trim() || '课堂',
      description: options.input.systemPrompt?.trim() || undefined,
      agentIds: options.input.agentConfigs.map((agent) => agent.id),
      languageDirective: directive || undefined,
    },
    scenes,
  );

  persistGenerationCache(classroomId, {
    outlineText: options.outlineText ?? '',
    outlines: sorted,
    languageDirective: directive || undefined,
    generatedScenes: [normalized],
    nextSceneIndex: 1,
  });
}

/** 顺序生成队列中追加一个已完成的场景 */
export function appendGeneratedSceneToStore(
  classroomId: string,
  outlines: SceneOutline[],
  index: number,
  generated: GeneratedScene,
  _options?: {
    input: ClassroomStreamStartInput;
    languageDirective?: string;
    outlineText?: string;
  },
) {
  const stageStore = useStageStore();
  const sorted = getSortedStreamOutlines(outlines);
  const outline = sorted[index];
  if (!outline) return;

  const scene = buildSceneFromGenerated(
    classroomId,
    outline,
    index,
    normalizeGeneratedScene(generated),
  );
  stageStore.appendScene(scene);
}

export async function generateSceneAtIndex(params: {
  classroomId: string;
  outlines: SceneOutline[];
  index: number;
  input: ClassroomStreamStartInput;
  stage: Stage | null;
  languageDirective?: string;
  llm?: GenerateLlmHeadersOptions;
}): Promise<GeneratedScene | null> {
  const sorted = getSortedStreamOutlines(params.outlines);
  const outline = sorted[params.index];
  if (!outline) return null;

  const body = buildSceneContentRequest({
    classroomId: params.classroomId,
    outline,
    allOutlines: sorted,
    input: params.input,
    stage: params.stage,
    languageDirective: params.languageDirective,
  });

  const res = await generateSceneContent(body, params.llm);
  if (!res.success) return null;

  return toGeneratedSceneFromContentResponse(res, outline, params.index);
}

/** @deprecated 使用 applyInitialGeneratedScene */
export function applyFirstSceneToStore(
  classroomId: string,
  outlines: SceneOutline[],
  generated: GeneratedScene | null | undefined,
  options: {
    input: ClassroomStreamStartInput;
    languageDirective?: string;
    outlineText?: string;
  },
) {
  applyInitialGeneratedScene(classroomId, outlines, generated, options);
}
