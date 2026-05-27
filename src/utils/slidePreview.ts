// SPDX-License-Identifier: AGPL-3.0
/** Slide canvas preview helpers (matches slide-content prompt: 1000×600). */

export const SLIDE_CANVAS_WIDTH = 1000;
export const SLIDE_CANVAS_HEIGHT = 600;

export interface SlidePreviewElement {
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  raw: Record<string, unknown>;
}

export interface SlidePreviewModel {
  backgroundColor: string;
  elements: SlidePreviewElement[];
}

export function hasSlideElements(content: Record<string, unknown> | undefined): boolean {
  return Array.isArray(content?.elements) && content.elements.length > 0;
}

export function parseJsonLoose(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  }
  try {
    const data = JSON.parse(text) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return null;
}

/** 将 API / LLM 各种返回格式统一为 slide 画布 payload */
export function normalizeSlidePayload(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    const parsed = parseJsonLoose(input);
    return parsed ? normalizeSlidePayload(parsed) : { raw: input };
  }
  if (!input || typeof input !== 'object') return {};
  const obj = input as Record<string, unknown>;

  if (hasSlideElements(obj)) return { ...obj };

  if (obj.content && typeof obj.content === 'object') {
    const nested = normalizeSlidePayload(obj.content);
    if (hasSlideElements(nested)) return nested;
  }

  if (obj.slide && typeof obj.slide === 'object') {
    const nested = normalizeSlidePayload(obj.slide);
    if (hasSlideElements(nested)) return nested;
  }

  if (typeof obj.raw === 'string') {
    const fromRaw = parseJsonLoose(obj.raw);
    if (fromRaw) {
      const nested = normalizeSlidePayload(fromRaw);
      if (hasSlideElements(nested)) return nested;
    }
  }

  return obj;
}

const OUTLINE_CONTENT_KEYS = [
  'description',
  'keyPoints',
  'estimatedMinutes',
  'languageNote',
  'widgetType',
  'widgetOutline',
] as const;

/** 供 ScenePreview 使用的 scene.content（保证 slide elements 在顶层） */
export function resolveScenePreviewContent(
  content: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!content || typeof content !== 'object') return {};

  const slidePayload = normalizeSlidePayload(content);
  if (!hasSlideElements(slidePayload)) return content;

  const meta: Record<string, unknown> = {};
  for (const key of OUTLINE_CONTENT_KEYS) {
    if (content[key] !== undefined) meta[key] = content[key];
  }
  return { ...meta, ...slidePayload };
}

/** 从 scene.content 中解析 slide 画布（兼容 outline 字段与嵌套 content） */
export function resolveSlideContent(
  content: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const payload = normalizeSlidePayload(content);
  return hasSlideElements(payload) ? payload : undefined;
}

export function getSlidePreviewModel(
  content: Record<string, unknown> | undefined,
): SlidePreviewModel | null {
  const payload = resolveSlideContent(resolveScenePreviewContent(content));
  if (!payload) return null;

  const background = payload.background;
  let backgroundColor = '#ffffff';
  if (background && typeof background === 'object') {
    const bg = background as Record<string, unknown>;
    if (typeof bg.color === 'string') backgroundColor = bg.color;
  }

  const elements = (payload.elements as unknown[])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `el-${index}`,
      type: typeof item.type === 'string' ? item.type : 'shape',
      left: Number(item.left ?? 0),
      top: Number(item.top ?? 0),
      width: Math.max(Number(item.width ?? 0), 1),
      height: Math.max(Number(item.height ?? 0), 1),
      raw: item,
    }));

  return { backgroundColor, elements };
}

export function hasRenderableSlideContent(
  content: Record<string, unknown> | undefined,
): boolean {
  return getSlidePreviewModel(content) !== null;
}

export function slideElementBoxStyle(el: SlidePreviewElement): Record<string, string> {
  return {
    left: `${(el.left / SLIDE_CANVAS_WIDTH) * 100}%`,
    top: `${(el.top / SLIDE_CANVAS_HEIGHT) * 100}%`,
    width: `${(el.width / SLIDE_CANVAS_WIDTH) * 100}%`,
    height: `${(el.height / SLIDE_CANVAS_HEIGHT) * 100}%`,
  };
}

/** 按宽度适配；传入高度时取 min(宽比, 高比)，保证整页幻灯片可见 */
export function computeSlideScale(
  viewportWidth: number,
  viewportHeight?: number,
): number {
  if (viewportWidth <= 0) return 0.25;
  const scaleX = viewportWidth / SLIDE_CANVAS_WIDTH;
  if (viewportHeight == null || viewportHeight <= 0) return scaleX;
  const scaleY = viewportHeight / SLIDE_CANVAS_HEIGHT;
  return Math.min(scaleX, scaleY);
}
