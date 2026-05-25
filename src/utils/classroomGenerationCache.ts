// SPDX-License-Identifier: AGPL-3.0
import type { GeneratedScene } from '@/types/generate';
import type { SceneOutline as StreamSceneOutline } from '@/types/classroom-stream';

export interface ClassroomOutlineCache {
  classroomId: string;
  outlineText: string;
  outlines: StreamSceneOutline[];
  languageDirective?: string;
  /** @deprecated 使用 generatedScenes */
  firstScene?: GeneratedScene;
  /** 已生成完成的场景（按 order 顺序） */
  generatedScenes?: GeneratedScene[];
  /** 下一个待生成的 outline 索引 */
  nextSceneIndex?: number;
}

export function normalizeGenerationCache(
  cache: ClassroomOutlineCache,
): Required<Pick<ClassroomOutlineCache, 'generatedScenes' | 'nextSceneIndex'>> &
  ClassroomOutlineCache {
  const generatedScenes =
    cache.generatedScenes?.length
      ? [...cache.generatedScenes]
      : cache.firstScene
        ? [cache.firstScene]
        : [];

  const nextSceneIndex =
    cache.nextSceneIndex ??
    (generatedScenes.length > 0 ? generatedScenes.length : 0);

  return {
    ...cache,
    generatedScenes,
    nextSceneIndex,
  };
}

export function isSceneGenerationComplete(
  cache: ReturnType<typeof normalizeGenerationCache>,
): boolean {
  return cache.nextSceneIndex >= cache.outlines.length;
}
