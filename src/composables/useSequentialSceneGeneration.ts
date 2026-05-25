// SPDX-License-Identifier: AGPL-3.0
import { computed, nextTick, onUnmounted, ref, watch, type Ref } from 'vue';

import { getApiErrorMessage, reportBusinessError } from '@/api';
import { useSettingsStore } from '@/stores/settings';
import { useStageStore } from '@/stores/stage';
import { isSceneGenerationComplete } from '@/utils/classroomGenerationCache';
import { normalizeGenerationCache } from '@/utils/classroomGenerationCache';
import {
  loadClassroomOutlineCache,
  loadClassroomStreamInput,
} from '@/utils/classroomStream';
import {
  appendGeneratedSceneToStore,
  ensureStageFromStreamInput,
  generateSceneAtIndex,
  getSortedStreamOutlines,
  persistSceneGenerationProgress,
  restoreCachedScenesToStore,
} from '@/utils/sceneContentGenerate';

export function useSequentialSceneGeneration(classroomId: Ref<string | undefined>) {
  const settings = useSettingsStore();
  const stageStore = useStageStore();

  const generating = ref(false);
  /** 当前正在请求 API 的 outline 索引（与 store.scenes.length 对齐时才展示侧边栏 loading） */
  const generatingIndex = ref<number | null>(null);
  const statusLabel = ref('');
  const error = ref<string | null>(null);
  const initError = ref<string | null>(null);
  const totalOutlines = ref(0);
  const completedCount = ref(0);
  const outlineTitles = ref<string[]>([]);

  let aborted = false;

  const generatingSceneTitle = computed(() => {
    const index = generatingIndex.value;
    if (index == null) return '';
    return outlineTitles.value[index] ?? `场景 ${index + 1}`;
  });

  async function runQueue() {
    const id = classroomId.value;
    if (!id || generating.value) return;

    const rawCache = loadClassroomOutlineCache(id);
    const input = loadClassroomStreamInput();
    if (!rawCache?.outlines?.length || !input) {
      initError.value = '缺少课堂大纲或编排参数，请从首页重新进入';
      return;
    }

    initError.value = null;
    const cache = normalizeGenerationCache(rawCache);
    const sortedOutlines = getSortedStreamOutlines(cache.outlines);
    totalOutlines.value = sortedOutlines.length;
    outlineTitles.value = sortedOutlines.map((outline) => outline.title);
    completedCount.value = cache.generatedScenes.length;

    ensureStageFromStreamInput(id, input, cache);
    if (cache.generatedScenes.length === 0 && cache.nextSceneIndex === 0) {
      stageStore.resetScenes();
    }
    restoreCachedScenesToStore(id, cache, input);
    completedCount.value = stageStore.scenes.length;

    if (isSceneGenerationComplete(cache)) {
      statusLabel.value = '';
      generatingIndex.value = null;
      return;
    }

    generating.value = true;
    error.value = null;
    generatingIndex.value = null;

    try {
      let nextIndex = cache.nextSceneIndex;
      let generatedScenes = [...cache.generatedScenes];

      while (nextIndex < sortedOutlines.length && !aborted) {
        const alreadyInStore = stageStore.scenes.some((scene) => scene.order === nextIndex);
        const cachedScene = generatedScenes[nextIndex];

        if (alreadyInStore && cachedScene) {
          nextIndex += 1;
          completedCount.value = stageStore.scenes.length;
          persistSceneGenerationProgress(id, cache, generatedScenes, nextIndex);
          continue;
        }

        if (cachedScene && !alreadyInStore) {
          appendGeneratedSceneToStore(id, sortedOutlines, nextIndex, cachedScene, {
            activate: true,
          });
          nextIndex += 1;
          completedCount.value = stageStore.scenes.length;
          persistSceneGenerationProgress(id, cache, generatedScenes, nextIndex);
          await nextTick();
          continue;
        }

        generatingIndex.value = nextIndex;
        statusLabel.value = `正在生成第 ${nextIndex + 1}/${sortedOutlines.length} 个场景…`;
        await nextTick();

        const generationResult = await generateSceneAtIndex({
          classroomId: id,
          outlines: sortedOutlines,
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

        generatingIndex.value = null;

        if (!generationResult) {
          const message = `第 ${nextIndex + 1} 个场景内容生成失败`;
          error.value = message;
          reportBusinessError(message);
          break;
        }

        const { generated, contentResponse } = generationResult;

        if (!generatedScenes[nextIndex]) {
          generatedScenes = [...generatedScenes];
          generatedScenes[nextIndex] = generated;
        }

        appendGeneratedSceneToStore(id, sortedOutlines, nextIndex, generated, {
          activate: true,
          contentResponse,
        });
        nextIndex += 1;
        completedCount.value = stageStore.scenes.length;

        persistSceneGenerationProgress(id, cache, generatedScenes, nextIndex);
        await nextTick();
      }

      if (!aborted && nextIndex >= sortedOutlines.length) {
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
    generatingSceneTitle,
    statusLabel,
    error,
    initError,
    totalOutlines,
    completedCount,
    runQueue,
    stop,
  };
}
