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
import { resolveKeyPointsFromGeneration } from '@/utils/sceneKeyPoints';
import { ensureSceneTtsCached } from '@/utils/sceneTtsCache';
import { normalizeSlidePayload, hasSlideElements } from '@/utils/slidePreview';

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
    id: base.id,
    type: normalizeSceneType(generated.type, base.type),
    title: generated.title || base.title,
    order: base.order,
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
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((outline, index) => ({ ...outline, order: index }));
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
  const outlineWithOrder = { ...outline, order: index };
  const sceneId = outline.id ?? `scene-${classroomId}-${index}`;
  const base = scenesFromStreamOutlines(classroomId, [outlineWithOrder])[0];
  if (!base) {
    return {
      id: sceneId,
      stageId: classroomId,
      type: normalizeSceneType(generated.type),
      title: generated.title || outline.title,
      order: index,
      content: normalizeGeneratedScene(generated).content ?? {},
    };
  }
  return {
    ...mergeGeneratedIntoScene({ ...base, id: sceneId, order: index }, generated),
    id: sceneId,
    order: index,
  };
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

/** 大纲就绪后写入 sessionStorage（不含 scene 内容，由 classroom 顺序生成） */
export function saveOutlineCacheOnReady(
  classroomId: string,
  outlines: SceneOutline[],
  options: {
    outlineText?: string;
    languageDirective?: string;
    preserveProgress?: boolean;
  } = {},
) {
  const sorted = getSortedStreamOutlines(outlines);
  const existing = loadClassroomOutlineCache(classroomId);
  const normalized = existing ? normalizeGenerationCache(existing) : null;

  const preserve = options.preserveProgress && normalized?.classroomId === classroomId;

  saveClassroomOutlineCache({
    classroomId,
    outlineText: options.outlineText ?? normalized?.outlineText ?? '',
    outlines: sorted,
    languageDirective: options.languageDirective ?? normalized?.languageDirective,
    generatedScenes: preserve ? normalized!.generatedScenes : [],
    nextSceneIndex: preserve ? normalized!.nextSceneIndex : 0,
  });
}

export function ensureStageFromStreamInput(
  classroomId: string,
  input: ClassroomStreamStartInput,
  cache: ClassroomOutlineCache,
) {
  const stageStore = useStageStore();
  const normalized = normalizeGenerationCache(cache);
  const directive =
    normalized.languageDirective?.trim() ||
    stageStore.stage?.languageDirective?.trim() ||
    '';

  if (stageStore.stage?.id !== classroomId) {
    stageStore.initStageFromOutlines(classroomId, {
      name: input.userQuestion?.trim() || '课堂',
      description: input.systemPrompt?.trim() || undefined,
      agentIds: input.agentConfigs.map((agent) => agent.id),
      languageDirective: directive || undefined,
    });
    return;
  }

  stageStore.ensureStageForClassroom(classroomId, {
    name: input.userQuestion?.trim() || stageStore.stage?.name,
    description: input.systemPrompt?.trim() || stageStore.stage?.description,
    agentIds: input.agentConfigs.map((agent) => agent.id),
  });
}

/** 将缓存中已生成的场景逐个追加到 store（不占位未生成的 outline） */
export function restoreCachedScenesToStore(
  classroomId: string,
  cache: ClassroomOutlineCache,
  input: ClassroomStreamStartInput,
) {
  const stageStore = useStageStore();
  ensureStageFromStreamInput(classroomId, input, cache);
  const normalized = normalizeGenerationCache(cache);
  const sorted = getSortedStreamOutlines(normalized.outlines);

  const lastCachedIndex = normalized.generatedScenes.length - 1;
  for (let index = 0; index <= lastCachedIndex; index += 1) {
    const generated = normalized.generatedScenes[index];
    if (!generated) continue;
    const alreadyInStore = stageStore.scenes.some((scene) => scene.order === index);
    if (alreadyInStore) continue;
    appendGeneratedSceneToStore(classroomId, sorted, index, generated, {
      activate: index === lastCachedIndex,
    });
  }
}

/** 顺序生成队列中追加一个已完成的场景 */
function scheduleSceneTtsPrefetch(
  classroomId: string,
  outline: SceneOutline,
  index: number,
  generated: GeneratedScene,
  contentResponse?: GenerateSceneContentRawResult | null,
) {
  const sceneId = outline.id ?? `scene-${classroomId}-${index}`;
  const keyPoints = resolveKeyPointsFromGeneration(
    outline,
    contentResponse,
    generated,
  );
  void ensureSceneTtsCached({
    classroomId,
    sceneId,
    sceneOrder: index,
    keyPoints,
  }).catch(() => {
    /* 预合成失败不阻塞场景展示 */
  });
}

export function appendGeneratedSceneToStore(
  classroomId: string,
  outlines: SceneOutline[],
  index: number,
  generated: GeneratedScene,
  options?: { activate?: boolean; contentResponse?: GenerateSceneContentRawResult | null },
) {
  const stageStore = useStageStore();
  const sorted = getSortedStreamOutlines(outlines);
  const outline = sorted[index];
  if (!outline) return;

  const normalized = normalizeGeneratedScene(generated);
  const scene = buildSceneFromGenerated(classroomId, outline, index, normalized);
  stageStore.appendScene(scene, { activate: options?.activate ?? true });
  scheduleSceneTtsPrefetch(
    classroomId,
    outline,
    index,
    normalized,
    options?.contentResponse,
  );
}

export async function generateSceneAtIndex(params: {
  classroomId: string;
  outlines: SceneOutline[];
  index: number;
  input: ClassroomStreamStartInput;
  stage: Stage | null;
  languageDirective?: string;
  llm?: GenerateLlmHeadersOptions;
}): Promise<{
  generated: GeneratedScene;
  contentResponse: GenerateSceneContentRawResult;
} | null> {
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

  const res = (await generateSceneContent(body, params.llm)) as GenerateSceneContentRawResult;
  if (!res.success) return null;

  const generated = toGeneratedSceneFromContentResponse(res, outline, params.index);
  if (!generated) return null;
  return { generated, contentResponse: res };
}

export function persistSceneGenerationProgress(
  classroomId: string,
  cache: ClassroomOutlineCache,
  generatedScenes: GeneratedScene[],
  nextSceneIndex: number,
) {
  const normalized = normalizeGenerationCache(cache);
  persistGenerationCache(classroomId, {
    outlineText: normalized.outlineText,
    outlines: normalized.outlines,
    languageDirective: normalized.languageDirective,
    generatedScenes,
    nextSceneIndex,
  });
}