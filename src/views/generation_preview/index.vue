<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  getApiErrorMessage,
  getClassroom,
} from '@/api';
import { OmButton, OmCard } from '@/components/ui';
import {
  useClassroomStream,
  type ClassroomOutlinesReadyContext,
} from '@/composables/useClassroomStream';
import {
  loadClassroomOutlineCache,
  loadClassroomStreamInput,
} from '@/utils/classroomStream';
import {
  getSortedStreamOutlines,
  mapClassroomOutlineList,
  saveOutlineCacheOnReady,
} from '@/utils/sceneContentGenerate';
import type { ClassroomStreamStartInput } from '@/types/classroom-stream';
import type { ClassroomRecord, OutlineStatus } from '@/types/classroom';

const props = defineProps<{
  classroomId?: string;
}>();

const router = useRouter();
const {
  streaming,
  error,
  statusLabel,
  outlineText,
  start,
  stop,
} = useClassroomStream();

const pollingOutline = ref(false);

const OUTLINE_POLL_MS = 2000;
const OUTLINE_POLL_MAX = 150;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeOutlineStatus(status: unknown): OutlineStatus {
  if (
    status === 'none' ||
    status === 'generating' ||
    status === 'done' ||
    status === 'failed'
  ) {
    return status;
  }
  return 'none';
}

function resolveOutlineStatus(record: ClassroomRecord): OutlineStatus {
  const status = normalizeOutlineStatus(record.outlineStatus);
  if (status === 'none' && Array.isArray(record.outlineList) && record.outlineList.length > 0) {
    return 'done';
  }
  return status;
}

async function fetchClassroomRecord(classroomId: string): Promise<ClassroomRecord | null> {
  try {
    const res = await getClassroom(classroomId);
    if (res.success && res.id) {
      return res;
    }
    error.value = res.success === false ? res.error : '获取课堂信息失败';
    return null;
  } catch (e) {
    error.value = getApiErrorMessage(e);
    return null;
  }
}

async function pollUntilOutlineSettled(classroomId: string): Promise<ClassroomRecord | null> {
  pollingOutline.value = true;
  statusLabel.value = '大纲生成中，请稍候…';
  try {
    for (let i = 0; i < OUTLINE_POLL_MAX; i += 1) {
      const record = await fetchClassroomRecord(classroomId);
      if (!record) return null;
      const status = resolveOutlineStatus(record);
      if (status === 'done' || status === 'failed') {
        return record;
      }
      await sleep(OUTLINE_POLL_MS);
    }
    error.value = '大纲生成超时，请返回首页重试';
    return null;
  } finally {
    pollingOutline.value = false;
  }
}

async function continueWithSavedOutlines(
  classroomId: string,
  input: ClassroomStreamStartInput,
  record: ClassroomRecord,
) {
  const outlines = getSortedStreamOutlines(mapClassroomOutlineList(record.outlineList));
  if (!outlines.length) {
    error.value = '未获取到课程大纲，请重试';
    return;
  }

  const cache = loadClassroomOutlineCache(classroomId);
  if (cache?.outlineText) {
    outlineText.value = cache.outlineText;
  }

  saveOutlineCacheOnReady(classroomId, outlines, {
    outlineText: cache?.outlineText ?? outlineText.value,
    languageDirective: cache?.languageDirective,
    preserveProgress: true,
  });
  enterClassroom(classroomId);
}

async function handleOutlineStatus(
  classroomId: string,
  input: ClassroomStreamStartInput,
  record: ClassroomRecord,
) {
  const status = resolveOutlineStatus(record);

  switch (status) {
    case 'none':
      start(input, { onOutlinesReady });
      return;
    case 'generating': {
      const settled = await pollUntilOutlineSettled(classroomId);
      if (!settled) return;
      const settledStatus = resolveOutlineStatus(settled);
      if (settledStatus === 'failed') {
        error.value = '大纲生成失败，请返回首页重试';
        return;
      }
      if (settledStatus === 'done') {
        await continueWithSavedOutlines(classroomId, input, settled);
      }
      return;
    }
    case 'done':
      await continueWithSavedOutlines(classroomId, input, record);
      return;
    case 'failed':
      error.value = '大纲生成失败，请返回首页重试';
      return;
  }
}

function goHome() {
  stop();
  router.push({ name: 'home' });
}

function enterClassroom(classroomId?: string) {
  const id = classroomId
  if (!id) return;
  router.replace({ name: 'classroom', params: { id } });
}

async function onOutlinesReady(ctx: ClassroomOutlinesReadyContext) {
  const sorted = getSortedStreamOutlines(ctx.outlines);
  if (!sorted.length) {
    error.value = '未获取到课程大纲，请重试';
    return;
  }

  saveOutlineCacheOnReady(ctx.classroomId, sorted, {
    outlineText: outlineText.value,
    languageDirective: ctx.languageDirective,
  });
  enterClassroom(ctx.classroomId);
}

const isBusy = () => streaming.value || pollingOutline.value;

async function bootstrap() {
  const input = loadClassroomStreamInput();
  if (!input?.classroomId) {
    error.value = '缺少流式编排参数，请从首页重新进入';
    return;
  }

  if (props.classroomId && input.classroomId !== props.classroomId) {
    input.classroomId = props.classroomId;
  }

  const classroomId = props.classroomId ?? input.classroomId;
  statusLabel.value = '正在检查生成状态…';
  const record = await fetchClassroomRecord(classroomId);
  if (!record) return;

  await handleOutlineStatus(classroomId, input, record);
}

onMounted(() => {
  void bootstrap();
});

onUnmounted(() => {
  stop();
});
</script>

<template>
  <div class="gen-preview om-page-bg relative flex min-h-screen flex-col">
    <header class="absolute left-0 top-0 z-10 px-4 py-5 sm:px-6 sm:py-6">
      <OmButton
        variant="ghost"
        size="sm"
        :pill="false"
        class="gap-1.5 px-2 text-om-fg-secondary hover:text-om-fg"
        :disabled="isBusy()"
        @click="goHome"
      >
        <span class="text-base leading-none" aria-hidden="true">←</span>
        返回首页
      </OmButton>
    </header>

    <main class="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-16">
      <OmCard class="w-full max-w-md" :shadow="true">
        <div class="flex flex-col items-center px-6 py-10 sm:px-10 sm:py-12">
          <span class="gen-preview__accent" aria-hidden="true" />

          <div
            class="gen-preview__doc"
            :class="{ 'gen-preview__doc--streaming': isBusy() }"
            aria-hidden="true"
          >
            <div class="gen-preview__doc-sheet">
              <span class="gen-preview__doc-line" />
              <span class="gen-preview__doc-line gen-preview__doc-line--short" />
              <span class="gen-preview__doc-line" />
              <span class="gen-preview__doc-dot" />
            </div>
          </div>

          <h1 class="mt-8 text-center text-xl font-bold tracking-tight text-om-fg sm:text-2xl">
            生成课程大纲
          </h1>
          <p
            class="mt-2 text-center text-sm text-om-fg-secondary sm:text-base"
            :class="{ 'gen-preview__status--streaming': isBusy() }"
          >
            {{ statusLabel }}
          </p>

          <span
            v-if="pollingOutline"
            class="gen-preview__spinner mt-4"
            aria-hidden="true"
          />

          <p
            v-if="error"
            class="mt-4 w-full text-center text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {{ error }}
          </p>

          <pre
            v-if="outlineText"
            class="gen-preview__stream om-scrollbar-hidden mt-8 w-full min-h-30 whitespace-pre-wrap text-left text-sm leading-relaxed text-om-fg-secondary"
          >{{ outlineText }}</pre>
        </div>
      </OmCard>
    </main>

    <footer
      class="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-4 pb-8 text-sm text-om-fg-muted"
    >
      <SvgIcon name="sparkles" :size="16" class="opacity-70" />
      <span>{{
        isBusy()
          ? 'AI智能体工作中…'
          : error
            ? '生成未完成'
            : '即将进入课堂…'
      }}</span>
    </footer>
  </div>
</template>

<style scoped>
.gen-preview__accent {
  display: block;
  width: 2.75rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: linear-gradient(90deg, var(--om-accent-from) 0%, var(--om-accent-to) 100%);
}

.gen-preview__spinner {
  display: block;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border: 2px solid color-mix(in oklab, var(--om-fg-accent) 20%, transparent);
  border-top-color: var(--om-fg-accent);
  animation: gen-preview-spin 0.8s linear infinite;
}

@keyframes gen-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.gen-preview__doc {
  margin-top: 1.75rem;
  perspective: 480px;
}

.gen-preview__doc--streaming .gen-preview__doc-sheet {
  animation: doc-float 2.4s ease-in-out infinite;
}

.gen-preview__doc--streaming .gen-preview__doc-line {
  animation: doc-shimmer 1.8s ease-in-out infinite;
  animation-fill-mode: both;
}

.gen-preview__doc--streaming .gen-preview__doc-line:nth-child(1) {
  animation-delay: 0s;
}

.gen-preview__doc--streaming .gen-preview__doc-line:nth-child(2) {
  animation-delay: 0.25s;
}

.gen-preview__doc--streaming .gen-preview__doc-line:nth-child(3) {
  animation-delay: 0.5s;
}

.gen-preview__doc--streaming .gen-preview__doc-dot {
  animation: doc-dot-pulse 1.5s ease-in-out infinite;
}

.gen-preview__status--streaming::after {
  content: '';
  display: inline-block;
  vertical-align: bottom;
  animation: ellipsis 1.2s steps(1, end) infinite;
}

@keyframes doc-float {
  0%,
  100% {
    transform: rotateX(8deg) rotateY(-6deg) translateY(0);
  }
  25% {
    transform: rotateX(8deg) rotateY(-6deg) translateY(-6px);
  }
  75% {
    transform: rotateX(8deg) rotateY(-6deg) translateY(4px);
  }
}

@keyframes doc-shimmer {
  0% {
    background: var(--om-border);
    opacity: 0.85;
  }
  50% {
    background: var(--om-accent-to);
    opacity: 0.55;
  }
  100% {
    background: var(--om-border);
    opacity: 0.85;
  }
}

@keyframes doc-dot-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
}

@keyframes ellipsis {
  0% {
    content: '';
  }
  25% {
    content: '.';
  }
  50% {
    content: '..';
  }
  75% {
    content: '...';
  }
  100% {
    content: '';
  }
}

.gen-preview__doc-sheet {
  position: relative;
  width: 5.5rem;
  height: 6.75rem;
  border-radius: 0.75rem;
  background: var(--om-bg-card);
  border: 1px solid var(--om-border);
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.06),
    0 12px 24px -4px rgb(59 130 246 / 0.12);
  transform: rotateX(8deg) rotateY(-6deg);
  padding: 1.125rem 1rem 1rem;
}

.gen-preview__doc-sheet::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0.5rem;
  border-radius: 0.75rem 0.75rem 0 0;
  background: linear-gradient(90deg, var(--om-accent-from) 0%, var(--om-accent-to) 100%);
}

.gen-preview__doc-line {
  display: block;
  height: 0.25rem;
  margin-top: 0.5rem;
  border-radius: 9999px;
  background: var(--om-border);
  opacity: 0.85;
}

.gen-preview__doc-line:first-of-type {
  margin-top: 0.75rem;
}

.gen-preview__doc-line--short {
  width: 65%;
}

.gen-preview__doc-dot {
  position: absolute;
  right: 0.625rem;
  bottom: 0.625rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, var(--om-accent-from) 0%, var(--om-accent-to) 100%);
}

.gen-preview__stream:empty {
  display: none;
}

.gen-preview__stream:not(:empty) {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--om-border);
  background: var(--om-bg-muted);
}
</style>
