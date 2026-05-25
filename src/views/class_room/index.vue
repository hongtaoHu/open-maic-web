<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { OmButton, OmInput } from '@/components/ui';
import { useSequentialSceneGeneration } from '@/composables/useSequentialSceneGeneration';
import { useChatStream } from '@/composables/useChatStream';
import RoomHeader from '@/views/class_room/components/RoomHeader.vue';
import ScenePreview from '@/views/class_room/components/ScenePreview.vue';
import SceneSidebar from '@/views/class_room/components/SceneSidebar.vue';
import { db } from '@/db';
import { useSettingsStore } from '@/stores/settings';
import { useStageStore } from '@/stores/stage';
import type { StatelessChatRequest, UIMessage } from '@/types/chat';
import {
  loadClassroomOutlineCache,
  loadClassroomStreamInput,
} from '@/utils/classroomStream';
import { hasRenderableSlideContent, resolveScenePreviewContent } from '@/utils/slidePreview';
import {
  hydrateStageFromGenerationCache,
  shouldHydrateStageFromCache,
} from '@/utils/sceneContentGenerate';

const route = useRoute();
const settings = useSettingsStore();
const stageStore = useStageStore();
const { streaming, error: chatError, assistantText, events, sendChat } = useChatStream();

const chatInput = ref('Hello, can you introduce this lesson?');

const classroomId = computed(() => (route.params.id as string) || stageStore.stage?.id);
const currentScene = computed(() => stageStore.currentScene);

const {
  generating: generatingScenes,
  generatingIndex,
  statusLabel: sceneGenerationLabel,
  error: sceneGenerationError,
  completedCount,
  totalOutlines,
} = useSequentialSceneGeneration(classroomId);

const mainPreviewContent = computed(() =>
  currentScene.value
    ? resolveScenePreviewContent(currentScene.value.content)
    : undefined,
);

const mainPreviewLoading = computed(
  () =>
    generatingScenes.value &&
    currentScene.value != null &&
    !hasRenderableSlideContent(currentScene.value.content),
);

function syncStageFromCacheIfNeeded(classroomId: string) {
  const outlineCache = loadClassroomOutlineCache(classroomId);
  const streamInput = loadClassroomStreamInput();
  if (!outlineCache?.outlines?.length || !streamInput) return;

  if (shouldHydrateStageFromCache(classroomId, outlineCache)) {
    hydrateStageFromGenerationCache(classroomId, outlineCache, streamInput);
  }
}

onMounted(async () => {
  const id = classroomId.value;
  if (!id) return;

  if (stageStore.stage?.id === id && stageStore.scenes.length > 0) {
    syncStageFromCacheIfNeeded(id);
    if (!stageStore.currentSceneId) {
      stageStore.currentSceneId =
        stageStore.scenes.find((scene) => scene.order === 0)?.id ??
        stageStore.scenes[0]?.id ??
        null;
    }
    return;
  }

  const record = await db.classrooms.get(id);
  if (record) {
    stageStore.stage = record.stage;
    stageStore.scenes = record.scenes;
    stageStore.currentSceneId = record.scenes[0]?.id ?? null;
    return;
  }

  const outlineCache = loadClassroomOutlineCache(id);
  const streamInput = loadClassroomStreamInput();
  if (outlineCache?.outlines?.length && streamInput) {
    hydrateStageFromGenerationCache(id, outlineCache, streamInput);
    return;
  }

  if (!stageStore.stage) {
    stageStore.createDemoStage('Demo classroom');
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
      :generating="generatingScenes"
      :generating-index="generatingIndex"
      :generating-label="sceneGenerationLabel"
      :total-outlines="totalOutlines"
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
        v-if="sceneGenerationError"
        class="shrink-0 px-6 pt-2 text-sm text-red-500"
        role="alert"
      >
        {{ sceneGenerationError }}
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

          <div v-if="!currentScene" class="flex flex-1 flex-col gap-3 p-4">
            <p class="text-om-fg-secondary text-sm">
              Send a message to stream from <code class="text-xs">POST /api/chat</code> (SSE stub).
            </p>
          </div>

          <div
            v-else
            class="shrink-0 border-t border-om-border p-4 space-y-3"
          >
            <p v-if="!assistantText && !streaming" class="text-om-fg-secondary text-sm">
              与 AI 助教对话…
            </p>
            <article v-if="assistantText" class="prose prose-sm max-w-none text-om-fg">
              <p class="whitespace-pre-wrap">{{ assistantText }}</p>
            </article>
            <p v-if="chatError" class="text-red-500 text-sm">{{ chatError }}</p>
            <details v-if="events.length" class="text-xs text-om-fg-muted">
              <summary>{{ events.length }} SSE events</summary>
              <pre class="mt-2 max-h-40 overflow-hidden">{{ JSON.stringify(events, null, 2) }}</pre>
            </details>
          </div>
        </div>

        <form class="flex shrink-0 gap-2" @submit.prevent="sendMessage">
          <OmInput
            v-model="chatInput"
            class="flex-1"
            placeholder="Message the agents…"
            :disabled="streaming"
          />
          <OmButton type="submit" variant="primary" :pill="false" :disabled="streaming">
            {{ streaming ? 'Streaming…' : 'Send' }}
          </OmButton>
        </form>
      </div>
    </section>
  </div>
</template>
