// SPDX-License-Identifier: AGPL-3.0
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { Scene, Stage, StageMode } from '@/types/stage';

function now() {
  return Date.now();
}

export const useStageStore = defineStore('stage', () => {
  const stage = ref<Stage | null>(null);
  const scenes = ref<Scene[]>([]);
  const currentSceneId = ref<string | null>(null);
  const mode = ref<StageMode>('autonomous');
  const whiteboardOpen = ref(false);

  const currentScene = computed(() =>
    scenes.value.find((s) => s.id === currentSceneId.value) ?? null,
  );

  function createDemoStage(name: string) {
    const id = `stage-${now()}`;
    const ts = now();
    stage.value = {
      id,
      name,
      createdAt: ts,
      updatedAt: ts,
      agentIds: ['default-1'],
    };
    const demoScenes: Omit<Scene, 'stageId'>[] = [
      { id: `scene-${ts}-0`, type: 'slide', title: '从前端到后端：Python 开发全景', order: 0, content: {} },
      { id: `scene-${ts}-1`, type: 'interactive', title: 'Python 内存模型模拟器', order: 1, content: {} },
      { id: `scene-${ts}-2`, type: 'quiz', title: 'Pythonic 语法实验室', order: 2, content: {} },
      { id: `scene-${ts}-3`, type: 'slide', title: 'Python 异步编程', order: 3, content: {} },
      { id: `scene-${ts}-4`, type: 'pbl', title: 'Python 项目实战', order: 4, content: {} },
    ];
    scenes.value = demoScenes.map((scene) => ({
      ...scene,
      stageId: id,
      content: scene.content ?? {},
    }));
    currentSceneId.value = scenes.value[0]?.id ?? null;
  }

  function setCurrentScene(sceneId: string) {
    currentSceneId.value = sceneId;
  }

  function ensureStageForClassroom(
    classroomId: string,
    params?: { name?: string; description?: string; agentIds?: string[] },
  ) {
    const ts = now();
    if (!stage.value || stage.value.id !== classroomId) {
      stage.value = {
        id: classroomId,
        name: params?.name ?? stage.value?.name ?? '课堂',
        description: params?.description ?? stage.value?.description,
        languageDirective: stage.value?.languageDirective,
        createdAt: stage.value?.createdAt ?? ts,
        updatedAt: ts,
        agentIds: params?.agentIds?.length
          ? params.agentIds
          : stage.value?.agentIds ?? ['default-1'],
      };
      return;
    }

    stage.value = {
      ...stage.value,
      name: params?.name ?? stage.value.name,
      description: params?.description ?? stage.value.description,
      agentIds: params?.agentIds?.length ? params.agentIds : stage.value.agentIds,
      updatedAt: ts,
    };
  }

  function setLanguageDirective(directive: string, classroomId?: string) {
    const trimmed = directive.trim();
    if (!trimmed) return;

    const ts = now();
    if (classroomId) {
      ensureStageForClassroom(classroomId);
    }

    if (!stage.value) {
      stage.value = {
        id: classroomId ?? `stage-${ts}`,
        name: '课堂',
        createdAt: ts,
        updatedAt: ts,
        languageDirective: trimmed,
      };
      return;
    }

    stage.value = {
      ...stage.value,
      languageDirective: trimmed,
      updatedAt: ts,
    };
  }

  /** 仅初始化 Stage，不预创建 scene 占位 */
  function initStageFromOutlines(
    classroomId: string,
    params: {
      name: string;
      description?: string;
      agentIds?: string[];
      languageDirective?: string;
    },
  ) {
    const ts = now();
    const languageDirective =
      params.languageDirective ?? stage.value?.languageDirective;
    stage.value = {
      id: classroomId,
      name: params.name,
      description: params.description,
      languageDirective,
      createdAt: stage.value?.id === classroomId ? (stage.value.createdAt ?? ts) : ts,
      updatedAt: ts,
      agentIds: params.agentIds?.length ? params.agentIds : ['default-1'],
    };
    scenes.value = [];
    currentSceneId.value = null;
  }

  function appendScene(scene: Scene, options?: { activate?: boolean }) {
    const byOrder = scenes.value.findIndex((item) => item.order === scene.order);
    let resolvedId = scene.id;

    if (byOrder >= 0) {
      resolvedId = scenes.value[byOrder].id;
      scenes.value = scenes.value.map((item, itemIndex) =>
        itemIndex === byOrder ? { ...scene, id: resolvedId, order: scene.order } : item,
      );
    } else {
      scenes.value = [...scenes.value, { ...scene, id: resolvedId }].sort(
        (a, b) => a.order - b.order,
      );
    }

    if (options?.activate) {
      currentSceneId.value = resolvedId;
    } else if (!currentSceneId.value) {
      currentSceneId.value =
        scenes.value.find((item) => item.order === 0)?.id ?? scenes.value[0]?.id ?? null;
    }
  }

  function resetScenes() {
    scenes.value = [];
    currentSceneId.value = null;
  }

  return {
    stage,
    scenes,
    currentSceneId,
    mode,
    whiteboardOpen,
    currentScene,
    createDemoStage,
    ensureStageForClassroom,
    initStageFromOutlines,
    appendScene,
    resetScenes,
    setLanguageDirective,
    setCurrentScene,
  };
});
