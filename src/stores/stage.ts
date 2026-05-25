// SPDX-License-Identifier: AGPL-3.0
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { GeneratedScene } from '@/types/generate';
import type { SceneOutline as StreamSceneOutline } from '@/types/classroom-stream';
import type { Scene, SceneType, Stage, StageMode } from '@/types/stage';
import { scenesFromStreamOutlines } from '@/utils/classroomStream';
import { hasSlideElements, normalizeSlidePayload } from '@/utils/slidePreview';

const SCENE_TYPES: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

function normalizeSceneType(type: string | undefined, fallback: SceneType = 'slide'): SceneType {
  const normalized = (type ?? '').trim().toLowerCase() as SceneType;
  return SCENE_TYPES.includes(normalized) ? normalized : fallback;
}

function mergeFirstScene(
  base: Scene,
  firstScene: GeneratedScene,
): Scene {
  const slidePayload = normalizeSlidePayload(firstScene.content);
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
    id: firstScene.id || base.id,
    type: normalizeSceneType(firstScene.type, base.type),
    title: firstScene.title || base.title,
    content: hasSlideElements(slidePayload)
      ? { ...outlineMeta, ...slidePayload }
      : { ...base.content, ...firstScene.content },
  };
}

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

  function initStageWithGeneratedScenes(
    classroomId: string,
    params: {
      name: string;
      description?: string;
      agentIds?: string[];
      languageDirective?: string;
    },
    generatedScenes: Scene[],
  ) {
    const ts = now();
    const languageDirective =
      params.languageDirective ?? stage.value?.languageDirective;
    stage.value = {
      id: classroomId,
      name: params.name,
      description: params.description,
      languageDirective,
      createdAt: ts,
      updatedAt: ts,
      agentIds: params.agentIds?.length ? params.agentIds : ['default-1'],
    };
    scenes.value = [...generatedScenes].sort((a, b) => a.order - b.order);
    currentSceneId.value =
      scenes.value.find((scene) => scene.order === 0)?.id ??
      scenes.value[0]?.id ??
      null;
  }

  function appendScene(scene: Scene) {
    const byId = scenes.value.findIndex((item) => item.id === scene.id);
    const byOrder = scenes.value.findIndex((item) => item.order === scene.order);
    const index = byId >= 0 ? byId : byOrder;
    if (index >= 0) {
      scenes.value = scenes.value.map((item, itemIndex) =>
        itemIndex === index ? { ...scene, id: item.id } : item,
      );
      return;
    }
    scenes.value = [...scenes.value, scene].sort((a, b) => a.order - b.order);
  }

  function loadFromOutlineCache(
    classroomId: string,
    params: {
      name: string;
      outlines: StreamSceneOutline[];
      description?: string;
      agentIds?: string[];
      languageDirective?: string;
      firstScene?: GeneratedScene;
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
      createdAt: ts,
      updatedAt: ts,
      agentIds: params.agentIds?.length ? params.agentIds : ['default-1'],
    };
    scenes.value = scenesFromStreamOutlines(classroomId, params.outlines);
    if (params.firstScene && scenes.value.length) {
      const firstIndex = scenes.value.findIndex((scene) => scene.order === 0);
      const index = firstIndex >= 0 ? firstIndex : 0;
      scenes.value[index] = mergeFirstScene(scenes.value[index], params.firstScene);
    }
    currentSceneId.value =
      scenes.value.find((scene) => scene.order === 0)?.id ??
      scenes.value[0]?.id ??
      null;
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
    initStageWithGeneratedScenes,
    appendScene,
    loadFromOutlineCache,
    setLanguageDirective,
    setCurrentScene,
  };
});
