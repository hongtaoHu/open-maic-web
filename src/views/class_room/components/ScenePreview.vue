<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import type { SceneType } from '@/types/stage';
import {
  SLIDE_CANVAS_HEIGHT,
  SLIDE_CANVAS_WIDTH,
  computeSlideScale,
  getSlidePreviewModel,
  slideElementBoxStyle,
  type SlidePreviewElement,
} from '@/utils/slidePreview';

import { parseSceneQuizQuestions } from '@/utils/slidePreviewQuiz';

import SceneQuizMainPreview from './SceneQuizMainPreview.vue';
import SlidePreviewChart from './SlidePreviewChart.vue';
import SlidePreviewQuiz from './SlidePreviewQuiz.vue';

const props = withDefaults(
  defineProps<{
    type: SceneType;
    title: string;
    content?: Record<string, unknown>;
    layout?: 'sidebar' | 'main';
    loading?: boolean;
    loadingLabel?: string;
  }>(),
  {
    layout: 'sidebar',
    loading: false,
    loadingLabel: '正在生成课件内容…',
  },
);

const viewportRef = ref<HTMLElement | null>(null);
const scale = ref(0.25);

const slideModel = computed(() => getSlidePreviewModel(props.content));
const isMain = computed(() => props.layout === 'main');
const sceneQuizQuestions = computed(() => parseSceneQuizQuestions(props.content));
const showQuizMain = computed(
  () => props.type === 'quiz' && isMain.value && sceneQuizQuestions.value.length > 0,
);
const quizSidebarRaw = computed(() => {
  const first = sceneQuizQuestions.value[0];
  if (!first) return props.content ?? {};
  return {
    question: first.question,
    options: first.options.map((option) => ({
      label: option.label,
      value: option.value ?? option.id,
    })),
    answer: first.answers,
  };
});
const scaledDimensions = computed(() => ({
  width: SLIDE_CANVAS_WIDTH * scale.value,
  height: SLIDE_CANVAS_HEIGHT * scale.value,
}));

function updateScale() {
  const viewport = viewportRef.value;
  if (!viewport) return;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const next =
    isMain.value && height > 0
      ? computeSlideScale(width, height)
      : computeSlideScale(width);
  if (next > 0) scale.value = next;
}

function elementStyle(el: SlidePreviewElement) {
  return slideElementBoxStyle(el);
}

function shapeFill(el: SlidePreviewElement): string {
  const fill = el.raw.fill;
  return typeof fill === 'string' && fill ? fill : '#e2e8f0';
}

function lineStyle(el: SlidePreviewElement) {
  const start = Array.isArray(el.raw.start) ? el.raw.start : [0, 0];
  const end = Array.isArray(el.raw.end) ? el.raw.end : [el.width, 0];
  const color = typeof el.raw.color === 'string' ? el.raw.color : '#64748b';
  const strokeWidth = Math.min(Math.max(Number(el.raw.width ?? 2), 1), 6);
  return {
    x1: Number(start[0] ?? 0),
    y1: Number(start[1] ?? 0),
    x2: Number(end[0] ?? el.width),
    y2: Number(end[1] ?? 0),
    stroke: color,
    strokeWidth,
  };
}

function imageSrc(el: SlidePreviewElement): string | null {
  const src = el.raw.src ?? el.raw.url;
  return typeof src === 'string' && src ? src : null;
}

let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

function bindResizeObserver() {
  resizeObserver?.disconnect();
  cancelAnimationFrame(rafId);

  const tryBind = () => {
    const viewport = viewportRef.value;
    if (!viewport) return;
    updateScale();
    const needsSize =
      viewport.clientWidth <= 0 ||
      (isMain.value && viewport.clientHeight <= 0);
    if (needsSize) {
      rafId = requestAnimationFrame(tryBind);
      return;
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateScale);
      resizeObserver.observe(viewport);
    }
  };

  tryBind();
}

watch(
  () => [props.content, slideModel.value, props.loading, props.layout] as const,
  async ([, model, loading]) => {
    if (loading || !model) return;
    await nextTick();
    bindResizeObserver();
  },
);

onMounted(async () => {
  await nextTick();
  bindResizeObserver();
  if (!resizeObserver) {
    window.addEventListener('resize', updateScale);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', updateScale);
});
</script>

<template>
  <div
    class="scene-preview"
    :class="[
      `scene-preview--${type}`,
      {
        'scene-preview--main': isMain,
        'scene-preview--has-slide': !!slideModel,
        'scene-preview--has-quiz': showQuizMain,
        'scene-preview--loading': loading,
      },
    ]"
    :aria-hidden="isMain && !loading ? undefined : 'true'"
    :aria-busy="loading ? 'true' : undefined"
  >
    <div
      v-if="loading"
      class="scene-preview__loading"
      :class="{ 'scene-preview__loading--main': isMain }"
    >
      <span class="scene-preview__spinner" aria-hidden="true" />
      <span class="scene-preview__loading-text">{{ loadingLabel }}</span>
    </div>

    <SceneQuizMainPreview
      v-else-if="showQuizMain"
      class="scene-preview__quiz-main"
      :questions="sceneQuizQuestions"
    />

    <div
      v-else-if="slideModel"
      ref="viewportRef"
      class="scene-preview__viewport"
      :class="{ 'scene-preview__viewport--main': isMain }"
    >
      <div
        class="scene-preview__canvas-wrap"
        :style="{
          width: `${scaledDimensions.width}px`,
          height: `${scaledDimensions.height}px`,
        }"
      >
        <div
          class="scene-preview__canvas"
          :style="{
            width: `${SLIDE_CANVAS_WIDTH}px`,
            height: `${SLIDE_CANVAS_HEIGHT}px`,
            transform: `scale(${scale})`,
            backgroundColor: slideModel.backgroundColor,
          }"
        >
          <div
            v-for="el in slideModel.elements"
            :key="el.id"
            class="scene-preview__element"
            :class="`scene-preview__element--${el.type}`"
            :style="elementStyle(el)"
          >
            <div
              v-if="el.type === 'text' && typeof el.raw.content === 'string'"
              class="scene-preview__text"
              v-html="el.raw.content"
            />
            <img
              v-else-if="el.type === 'image' && imageSrc(el)"
              class="scene-preview__image"
              :src="imageSrc(el)!"
              alt=""
            />
            <svg
              v-else-if="el.type === 'shape'"
              class="scene-preview__shape"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              <path
                :d="
                  typeof el.raw.path === 'string'
                    ? el.raw.path
                    : 'M 0 0 L 1 0 L 1 1 L 0 1 Z'
                "
                :fill="shapeFill(el)"
              />
            </svg>
            <svg
              v-else-if="el.type === 'line'"
              class="scene-preview__line"
              :viewBox="`0 0 ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`"
              preserveAspectRatio="none"
            >
              <line v-bind="lineStyle(el)" />
            </svg>
            <SlidePreviewChart
              v-else-if="el.type === 'chart'"
              class="scene-preview__chart"
              :raw="el.raw"
              :width="el.width"
              :height="el.height"
            />
            <SlidePreviewQuiz
              v-else-if="el.type === 'quiz'"
              class="scene-preview__quiz-el"
              :raw="el.raw"
              :layout="layout"
            />

            <div v-else class="scene-preview__fallback" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="type === 'slide'" class="scene-preview__slide">
      <div class="scene-preview__slide-title" />
      <div class="scene-preview__slide-cols">
        <div v-for="i in 3" :key="i" class="scene-preview__slide-col" />
      </div>
    </div>
    <SlidePreviewQuiz
      v-else-if="type === 'quiz'"
      class="scene-preview__quiz-scene"
      :raw="quizSidebarRaw"
      :layout="layout"
    />
    <div v-else-if="type === 'interactive'" class="scene-preview__interactive">
      <div class="scene-preview__interactive-pane scene-preview__interactive-pane--main" />
      <div class="scene-preview__interactive-pane" />
    </div>
    <div v-else class="scene-preview__generic">
      <p class="scene-preview__generic-label">{{ title }}</p>
    </div>
  </div>
</template>

<style scoped>
.scene-preview {
  position: relative;
  min-height: 7.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--om-border-subtle);
  background: var(--om-bg-card);
  overflow: hidden;
}

.scene-preview--main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  height: 100%;
  border: 0;
  background: transparent;
}

.scene-preview--main.scene-preview--has-slide,
.scene-preview--main.scene-preview--has-quiz,
.scene-preview--main.scene-preview--loading {
  min-height: 0;
}

.scene-preview__quiz-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.scene-preview__quiz-scene {
  width: 100%;
  min-height: 5.5rem;
  height: 100%;
}

.scene-preview__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 7.5rem;
  padding: 1rem;
  background: var(--om-bg-muted);
}

.scene-preview__loading--main {
  flex: 1;
  min-height: 18rem;
}

.scene-preview__spinner {
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border: 2px solid color-mix(in oklab, var(--om-fg-accent) 20%, transparent);
  border-top-color: var(--om-fg-accent);
  animation: scene-preview-spin 0.8s linear infinite;
}

.scene-preview__loading-text {
  font-size: 0.8125rem;
  color: var(--om-fg-secondary);
  text-align: center;
}

@keyframes scene-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.scene-preview__viewport {
  width: 100%;
  overflow: hidden;
  position: relative;
  background: #fff;
}

.scene-preview__viewport--main {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid var(--om-border-subtle);
}

.scene-preview__canvas-wrap {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.scene-preview__viewport:not(.scene-preview__viewport--main) .scene-preview__canvas-wrap {
  width: 100%;
  max-width: 100%;
}

.scene-preview__canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  overflow: hidden;
}

.scene-preview__element {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}

.scene-preview__text {
  width: 100%;
  height: 100%;
  padding: 2px 4px;
  line-height: 1.25;
  color: #334155;
  overflow: hidden;
}

.scene-preview__text :deep(p) {
  margin: 0;
}

.scene-preview__text :deep(h1),
.scene-preview__text :deep(h2),
.scene-preview__text :deep(h3) {
  margin: 0;
  font-weight: 700;
}

.scene-preview__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.scene-preview__shape,
.scene-preview__line,
.scene-preview__chart,
.scene-preview__quiz-el {
  width: 100%;
  height: 100%;
  display: block;
}

.scene-preview__fallback {
  width: 100%;
  height: 100%;
  background: color-mix(in oklab, var(--om-fg-accent) 10%, var(--om-bg-muted));
  border-radius: 0.25rem;
}

.scene-preview__slide {
  padding: 0.625rem;
}

.scene-preview__slide-title {
  height: 0.5rem;
  width: 55%;
  border-radius: 9999px;
  background: var(--om-bg-muted);
  margin-bottom: 0.5rem;
}

.scene-preview__slide-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
}

.scene-preview__slide-col {
  height: 4.5rem;
  border-radius: 0.375rem;
  background: var(--om-bg-muted);
}

.scene-preview__quiz {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem;
}

.scene-preview__quiz-row {
  height: 0.875rem;
  border-radius: 0.25rem;
  background: var(--om-bg-muted);
}

.scene-preview__quiz-row:nth-child(1) {
  width: 70%;
}

.scene-preview__interactive {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 0.375rem;
  min-height: 5.5rem;
  padding: 0.625rem;
}

.scene-preview__interactive-pane {
  border-radius: 0.375rem;
  background: var(--om-bg-muted);
}

.scene-preview__interactive-pane--main {
  background: color-mix(in oklab, var(--om-fg-accent) 12%, var(--om-bg-muted));
}

.scene-preview__generic {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 5.5rem;
  padding: 0.625rem;
}

.scene-preview__generic-label {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.3;
  text-align: center;
  color: var(--om-fg-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
