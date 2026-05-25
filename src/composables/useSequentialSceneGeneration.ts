// SPDX-License-Identifier: AGPL-3.0
import { onUnmounted, ref, watch, type Ref } from 'vue';

import { getApiErrorMessage, reportBusinessError } from '@/api';
import { useSettingsStore } from '@/stores/settings';
import { useStageStore } from '@/stores/stage';
import { isSceneGenerationComplete } from '@/utils/classroomGenerationCache';
import { normalizeGenerationCache } from '@/utils/classroomGenerationCache';
import {
  loadClassroomOutlineCache,
  loadClassroomStreamInput,
  saveClassroomOutlineCache,
} from '@/utils/classroomStream';
import {
  appendGeneratedSceneToStore,
  generateSceneAtIndex,
  hydrateStageFromGenerationCache,
  shouldHydrateStageFromCache,
} from '@/utils/sceneContentGenerate';

export function useSequentialSceneGeneration(classroomId: Ref<string | undefined>) {
  const settings = useSettingsStore();
  const stageStore = useStageStore();

  const generating = ref(false);
  const generatingIndex = ref<number | null>(null);
  const statusLabel = ref('');
  const error = ref<string | null>(null);
  const totalOutlines = ref(0);
  const completedCount = ref(0);

  let aborted = false;

  async function runQueue() {
    const id = classroomId.value;
    if (!id || generating.value) return;

    const rawCache = loadClassroomOutlineCache(id);
    const input = loadClassroomStreamInput();
    if (!rawCache?.outlines?.length || !input) return;

    const cache = normalizeGenerationCache(rawCache);
    totalOutlines.value = cache.outlines.length;
    completedCount.value = cache.generatedScenes.length;

    if (isSceneGenerationComplete(cache)) {
      statusLabel.value = '';
      return;
    }

    generating.value = true;
    error.value = null;

    try {
      let nextIndex = cache.nextSceneIndex;
      let generatedScenes = [...cache.generatedScenes];

      while (nextIndex < cache.outlines.length && !aborted) {
        generatingIndex.value = nextIndex;
        statusLabel.value = `正在生成第 ${nextIndex + 1}/${cache.outlines.length} 个场景…`;

        const scene = await generateSceneAtIndex({
          classroomId: id,
          outlines: cache.outlines,
          index: nextIndex,
          input,
          stage: stageStore.stage,
          languageDirective: cache.languageDirective,
          llm: {
            apiKey: settings.apiKey || undefined,
            baseUrl: settings.baseUrl || undefined,
            model: settings.model || undefined,
          },
        });

        if (!scene) {
          const message = `第 ${nextIndex + 1} 个场景内容生成失败`;
          error.value = message;
          reportBusinessError(message);
          break;
        }

        appendGeneratedSceneToStore(id, cache.outlines, nextIndex, scene, {
          input,
          languageDirective: cache.languageDirective,
          outlineText: cache.outlineText,
        });

        generatedScenes = [...generatedScenes, scene];
        nextIndex += 1;
        completedCount.value = generatedScenes.length;

        saveClassroomOutlineCache({
          ...cache,
          generatedScenes,
          nextSceneIndex: nextIndex,
        });
      }

      if (!aborted && nextIndex >= cache.outlines.length) {
        statusLabel.value = '';
      }
    } catch (e) {
      error.value = getApiErrorMessage(e);
    } finally {
      generating.value = false;
      generatingIndex.value = null;
    }
  }

  function stop() {
    aborted = true;
  }

  watch(
    classroomId,
    (id) => {
      if (!id) return;
      const rawCache = loadClassroomOutlineCache(id);
      const input = loadClassroomStreamInput();
      if (!rawCache?.outlines?.length || !input) return;

      const cache = normalizeGenerationCache(rawCache);
      totalOutlines.value = cache.outlines.length;
      completedCount.value = cache.generatedScenes.length;

      if (shouldHydrateStageFromCache(id, cache)) {
        hydrateStageFromGenerationCache(id, cache, input);
      }

      void runQueue();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stop();
  });

  return {
    generating,
    generatingIndex,
    statusLabel,
    error,
    totalOutlines,
    completedCount,
    runQueue,
    stop,
  };
}
