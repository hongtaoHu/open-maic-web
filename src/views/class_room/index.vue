<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink, useRoute } from 'vue-router';

import { OmButton } from '@/components/ui';
import { useSequentialSceneGeneration } from '@/composables/useSequentialSceneGeneration';
import { useChatStream } from '@/composables/useChatStream';
import ClassroomControlDock from '@/views/class_room/components/ClassroomControlDock.vue';
import RoomHeader from '@/views/class_room/components/RoomHeader.vue';
import ScenePreview from '@/views/class_room/components/ScenePreview.vue';
import SceneSidebar from '@/views/class_room/components/SceneSidebar.vue';
import { db } from '@/db';
import { useSettingsStore } from '@/stores/settings';
import { useStageStore } from '@/stores/stage';
import type { StatelessChatRequest, UIMessage } from '@/types/chat';
import { loadClassroomStreamInput } from '@/utils/classroomStream';
import { resolveKeyPointsFromScene } from '@/utils/sceneKeyPoints';
import { hasRenderableSlideContent, resolveScenePreviewContent } from '@/utils/slidePreview';

const route = useRoute();
const settings = useSettingsStore();
const stageStore = useStageStore();
const { scenes, currentSceneId } = storeToRefs(stageStore);
const { streaming, error: chatError, assistantText, events, sendChat } = useChatStream();

const chatInput = ref('Hello, can you introduce this lesson?');
const ttsVoice = ref('');

const classroomId = computed(() => (route.params.id as string) || stageStore.stage?.id);

const {
  generating: generatingScenes,
  generatingIndex,
  generatingSceneTitle,
  statusLabel: sceneGenerationLabel,
  error: sceneGenerationError,
  initError: sceneInitError,
  completedCount,
  totalOutlines,
} = useSequentialSceneGeneration(classroomId);

const currentScene = computed(() => stageStore.currentScene);

const sortedScenes = computed(() => [...scenes.value].sort((a, b) => a.order - b.order));

const sceneDisplayIndex = computed(() => {
  const total = Math.max(totalOutlines.value, 1);
  if (!currentScene.value) {
    return Math.min(completedCount.value + (generatingScenes.value ? 1 : 0), total) || 1;
  }
  return currentScene.value.order + 1;
});

const sceneTotalDisplay = computed(() =>
  Math.max(totalOutlines.value, sortedScenes.value.length, 1),
);

const currentSceneListIndex = computed(() =>
  sortedScenes.value.findIndex((scene) => scene.id === currentSceneId.value),
);

const canPrevScene = computed(() => currentSceneListIndex.value > 0);
const canNextScene = computed(
  () =>
    currentSceneListIndex.value >= 0 &&
    currentSceneListIndex.value < sortedScenes.value.length - 1,
);

const streamAgents = computed(() => loadClassroomStreamInput()?.agentConfigs ?? []);

const teacherAgent = computed(() => {
  const input = loadClassroomStreamInput();
  if (!input?.agentConfigs.length) return null;
  return (
    input.agentConfigs.find((agent) => agent.id === input.agentTeacherId) ??
    input.agentConfigs.find((agent) => /teacher|教师/i.test(agent.role)) ??
    input.agentConfigs[0]
  );
});

const participantAgents = computed(() => {
  const teacherId = teacherAgent.value?.id;
  return streamAgents.value.filter((agent) => agent.id !== teacherId);
});

const speechFallback = computed(() => {
  const scene = currentScene.value;
  if (!scene) return '';
  const content = scene.content?.description;
  return typeof content === 'string' ? content : scene.title;
});

/** 底部 Dock 可播放列表，与侧边栏选中场景的 keyPoints 同步 */
const dockPlayableKeyPoints = ref<string[]>([]);

function syncDockPlayableKeyPoints(scene = currentScene.value) {
  dockPlayableKeyPoints.value = scene
    ? [...resolveKeyPointsFromScene(scene, classroomId.value)]
    : [];
}

function onSidebarSelectScene(payload: { sceneId: string; keyPoints: string[] }) {
  dockPlayableKeyPoints.value = [...payload.keyPoints];
}

watch(
  [currentScene, classroomId],
  () => syncDockPlayableKeyPoints(),
  { immediate: true },
);

function selectRelativeScene(offset: number) {
  const list = sortedScenes.value;
  const index = list.findIndex((scene) => scene.id === currentSceneId.value);
  if (index < 0) return;
  const next = list[index + offset];
  if (next) stageStore.setCurrentScene(next.id);
}

const mainPreviewContent = computed(() =>
  currentScene.value
    ? resolveScenePreviewContent(currentScene.value.content)
    : undefined,
);

const mainPreviewLoading = computed(() => {
  if (!generatingScenes.value) return false;
  if (!currentScene.value) return true;
  return !hasRenderableSlideContent(currentScene.value.content);
});

const showMainGeneratingPlaceholder = computed(
  () => generatingScenes.value && !currentScene.value && totalOutlines.value > 0,
);

onMounted(async () => {
  const id = classroomId.value;
  if (!id) return;

  const record = await db.classrooms.get(id);
  if (record?.scenes?.length) {
    stageStore.stage = record.stage;
    stageStore.scenes = record.scenes;
    stageStore.currentSceneId = record.scenes[0]?.id ?? null;
  }
});

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !stageStore.stage) return;

  const userMessage: UIMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  };

  const request: StatelessChatRequest = {
    messages: [userMessage],
    storeState: {
      stage: stageStore.stage,
      scenes: stageStore.scenes,
      currentSceneId: stageStore.currentSceneId,
      mode: stageStore.mode,
      whiteboardOpen: stageStore.whiteboardOpen,
    },
    config: { agentIds: stageStore.stage.agentIds ?? ['default-1'] },
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl || undefined,
    model: settings.model || undefined,
  };

  await sendChat(request);
}
</script>

<template>
  <div class="flex h-dvh overflow-hidden">
    <SceneSidebar
      :classroom-id="classroomId"
      :generating="generatingScenes"
      :generating-index="generatingIndex"
      :generating-scene-title="generatingSceneTitle"
      :generating-label="sceneGenerationLabel"
      :total-outlines="totalOutlines"
      @select-scene="onSidebarSelectScene"
    />

    <section class="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden bg-om-page">
      <RoomHeader
        :title="stageStore.stage?.name ?? 'Classroom'"
        :subtitle="classroomId"
      />

      <p
        v-if="generatingScenes && sceneGenerationLabel"
        class="shrink-0 px-6 pt-2 text-sm text-om-fg-secondary"
      >
        {{ sceneGenerationLabel }}
        <span v-if="totalOutlines > 0" class="text-om-fg-muted">
          （{{ completedCount }}/{{ totalOutlines }}）
        </span>
      </p>
      <p
        v-if="sceneGenerationError || sceneInitError"
        class="shrink-0 px-6 pt-2 text-sm text-red-500"
        role="alert"
      >
        {{ sceneGenerationError || sceneInitError }}
        <RouterLink
          v-if="sceneInitError"
          to="/"
          class="ml-2 underline text-red-600 dark:text-red-400"
        >
          返回首页
        </RouterLink>
      </p>

      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6 pt-2">
        <div
          class="min-h-0 flex-1 overflow-hidden rounded-lg border border-om-border bg-om-card flex flex-col"
        >
          <ScenePreview
            v-if="currentScene"
            class="flex-1 min-h-0"
            layout="main"
            :type="currentScene.type"
            :title="currentScene.title"
            :content="mainPreviewContent"
            :loading="mainPreviewLoading"
            :loading-label="sceneGenerationLabel || '正在生成课件内容…'"
          />

          <ScenePreview
            v-else-if="showMainGeneratingPlaceholder"
            class="flex-1 min-h-0"
            layout="main"
            type="slide"
            title="场景 1"
            loading
            :loading-label="sceneGenerationLabel || '正在生成课件内容…'"
          />

          <div
            v-else-if="sceneInitError"
            class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <p class="text-sm text-om-fg-secondary">{{ sceneInitError }}</p>
            <RouterLink to="/">
              <OmButton variant="primary" :pill="false">返回首页</OmButton>
            </RouterLink>
          </div>

          <div v-else class="flex flex-1 flex-col gap-3 p-4">
            <p class="text-om-fg-secondary text-sm">
              Send a message to stream from <code class="text-xs">POST /api/chat</code> (SSE stub).
            </p>
          </div>

        </div>

        <ClassroomControlDock
          v-model:chat-input="chatInput"
          v-model:tts-voice="ttsVoice"
          v-model:playable-key-points="dockPlayableKeyPoints"
          :classroom-id="classroomId"
          :scene-id="currentScene?.id"
          :scene-index="sceneDisplayIndex"
          :scene-total="sceneTotalDisplay"
          :can-prev-scene="canPrevScene"
          :can-next-scene="canNextScene"
          :streaming="streaming"
          :assistant-text="assistantText"
          :speech-fallback="speechFallback"
          :teacher="teacherAgent"
          :participants="participantAgents"
          @submit="sendMessage"
          @prev-scene="selectRelativeScene(-1)"
          @next-scene="selectRelativeScene(1)"
        />
      </div>
    </section>
  </div>
</template>
