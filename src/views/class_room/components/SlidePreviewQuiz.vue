<script setup lang="ts">
import { computed } from 'vue';

import {
  parseSlideQuiz,
  sidebarQuizOptions,
} from '@/utils/slidePreviewQuiz';

const props = defineProps<{
  raw: Record<string, unknown>;
  layout?: 'sidebar' | 'main';
}>();

const model = computed(() => parseSlideQuiz(props.raw));
const isSidebar = computed(() => props.layout === 'sidebar');
const gridOptions = computed(() => sidebarQuizOptions(model.value));

function optionDisplay(option: { label: string; value?: string }): string {
  const label = option.label.trim();
  const value = option.value?.trim();
  if (!label) return value ?? '';
  if (value && !label.startsWith(`${value}.`) && label !== value) {
    return `${value}. ${label}`;
  }
  return label;
}
</script>

<template>
  <div
    v-if="isSidebar"
    class="slide-preview-quiz slide-preview-quiz--sidebar"
    role="img"
    aria-label="测验选项预览"
  >
    <div class="slide-preview-quiz__header" aria-hidden="true" />
    <div class="slide-preview-quiz__grid">
      <div
        v-for="(option, index) in gridOptions"
        :key="option.id"
        class="slide-preview-quiz__card"
        :class="{
          'slide-preview-quiz__card--selected': index === model.selectedIndex,
        }"
      >
        <span class="slide-preview-quiz__bullet" aria-hidden="true" />
        <span
          class="slide-preview-quiz__line"
          :title="option.label || undefined"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>

  <div v-else class="slide-preview-quiz slide-preview-quiz--main">
    <p v-if="model.question" class="slide-preview-quiz__question">
      {{ model.question }}
    </p>
    <div class="slide-preview-quiz__main-grid">
      <div
        v-for="(option, index) in gridOptions"
        :key="option.id"
        class="slide-preview-quiz__main-card"
        :class="{
          'slide-preview-quiz__main-card--selected': index === model.selectedIndex,
        }"
      >
        <span class="slide-preview-quiz__main-index">
          {{ option.value || String.fromCharCode(65 + index) }}
        </span>
        <span class="slide-preview-quiz__main-label">
          {{ optionDisplay(option) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-preview-quiz {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

/* —— 侧边栏：与设计图一致的 2×2 骨架 —— */
.slide-preview-quiz--sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.4rem;
  border-radius: 0.5rem;
  border: 1px solid color-mix(in oklab, #b6a2de 45%, var(--om-border-subtle));
  background: #f7f2ea;
}

.slide-preview-quiz__header {
  flex-shrink: 0;
  height: 0.45rem;
  border-radius: 9999px;
  background: #ebe3d6;
}

.slide-preview-quiz__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.3rem;
}

.slide-preview-quiz__card {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 0;
  padding: 0.28rem 0.32rem;
  border-radius: 0.35rem;
  border: 1px solid transparent;
  background: #fff;
}

.slide-preview-quiz__card--selected {
  border-color: #f0a04b;
  background: #fff6e8;
}

.slide-preview-quiz__bullet {
  flex-shrink: 0;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 9999px;
  background: #f0d4c4;
}

.slide-preview-quiz__card--selected .slide-preview-quiz__bullet {
  background: #f59e0b;
}

.slide-preview-quiz__line {
  flex: 1;
  min-width: 0;
  height: 0.3rem;
  border-radius: 9999px;
  background: #f0d4c4;
}

.slide-preview-quiz__card--selected .slide-preview-quiz__line {
  background: #f59e0b;
}

/* —— 主画布：展示题干与选项文案 —— */
.slide-preview-quiz--main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: #f7f2ea;
  border-radius: 0.375rem;
  overflow: hidden;
}

.slide-preview-quiz__question {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.35;
  color: #334155;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slide-preview-quiz__main-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.375rem;
}

.slide-preview-quiz__main-card {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid #e8dfd6;
  background: #fff;
  min-width: 0;
}

.slide-preview-quiz__main-card--selected {
  border-color: #f0a04b;
  background: #fff6e8;
  box-shadow: 0 0 0 1px color-mix(in oklab, #f59e0b 25%, transparent);
}

.slide-preview-quiz__main-index {
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 9999px;
  background: #f0d4c4;
  color: #9a3412;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1.125rem;
  text-align: center;
}

.slide-preview-quiz__main-card--selected .slide-preview-quiz__main-index {
  background: #f59e0b;
  color: #fff;
}

.slide-preview-quiz__main-label {
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  line-height: 1.3;
  color: #475569;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slide-preview-quiz__main-card--selected .slide-preview-quiz__main-label {
  color: #9a3412;
  font-weight: 600;
}
</style>
