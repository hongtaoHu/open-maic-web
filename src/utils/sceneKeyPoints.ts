// SPDX-License-Identifier: AGPL-3.0

import type { SceneOutline } from '@/types/classroom-stream';
import type { ClassroomOutlineCache } from '@/utils/classroomGenerationCache';
import type {
  GenerateSceneContentRawResult,
  GeneratedScene,
} from '@/types/generate';
import type { Scene } from '@/types/stage';
import { loadClassroomOutlineCache } from '@/utils/classroomStream';

function outlineForScene(
  cache: ClassroomOutlineCache,
  scene: Scene,
): SceneOutline | undefined {
  const sorted = [...cache.outlines]
    .filter((outline) => outline?.title?.trim())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((outline, index) => ({ ...outline, order: index }));
  return sorted[scene.order] ?? sorted.find((outline) => outline.id === scene.id);
}

function normalizeKeyPoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((point) => String(point).trim()).filter(Boolean);
}

export function resolveKeyPointsFromGeneration(
  outline: SceneOutline,
  res?: GenerateSceneContentRawResult | null,
  generated?: GeneratedScene | null,
): string[] {
  const fromEffective = normalizeKeyPoints(res?.effectiveOutline?.keyPoints);
  if (fromEffective.length) return fromEffective;

  const fromOutline = normalizeKeyPoints(outline.keyPoints);
  if (fromOutline.length) return fromOutline;

  if (generated?.content && typeof generated.content === 'object') {
    const fromGenerated = normalizeKeyPoints(
      (generated.content as Record<string, unknown>).keyPoints,
    );
    if (fromGenerated.length) return fromGenerated;
  }

  const description =
    outline.description?.trim() ||
    (typeof generated?.content === 'object' &&
    generated.content &&
    typeof (generated.content as Record<string, unknown>).description === 'string'
      ? String((generated.content as Record<string, unknown>).description).trim()
      : '');

  if (description) return [description];

  const title = generated?.title?.trim() || outline.title?.trim();
  return title ? [title] : [];
}

export function resolveKeyPointsFromScene(
  scene: Scene | null | undefined,
  classroomId?: string,
): string[] {
  if (!scene) return [];

  if (scene.content && typeof scene.content === 'object') {
    const fromContent = normalizeKeyPoints(
      (scene.content as Record<string, unknown>).keyPoints,
    );
    if (fromContent.length) return fromContent;
  }

  if (classroomId) {
    const cache = loadClassroomOutlineCache(classroomId);
    if (cache?.outlines?.length) {
      const outline = outlineForScene(cache, scene);
      const fromOutline = normalizeKeyPoints(outline?.keyPoints);
      if (fromOutline.length) return fromOutline;
    }
  }

  const description =
    typeof scene.content?.description === 'string'
      ? scene.content.description.trim()
      : '';
  if (description) return [description];

  const title = scene.title?.trim();
  return title ? [title] : [];
}
