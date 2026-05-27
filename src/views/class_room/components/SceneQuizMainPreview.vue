<script setup lang="ts">
import { computed, ref } from 'vue';

import type { SceneQuizQuestion } from '@/utils/slidePreviewQuiz';
import { isOptionCorrect } from '@/utils/slidePreviewQuiz';

const props = defineProps<{
  questions: SceneQuizQuestion[];
}>();

const activeIndex = ref(0);

const activeQuestion = computed(() => props.questions[activeIndex.value] ?? null);

const total = computed(() => props.questions.length);

function selectQuestion(index: number) {
  if (index < 0 || index >= total.value) return;
  activeIndex.value = index;
}

function optionDisplay(option: { label: string; value?: string }): string {
  const label = option.label.trim();
  const value = option.value?.trim();
  if (value && !label.startsWith(`${value}.`) && !label.startsWith(value)) {
    return `${value}. ${label}`;
  }
  return label || value || '';
}
</script>

<template>
  <div class="scene-quiz-main">
    <header v-if="total > 1" class="scene-quiz-main__tabs" role="tablist">
      <button
        v-for="(item, index) in questions"
        :key="item.id"
        type="button"
        class="scene-quiz-main__tab"
        :class="{ 'scene-quiz-main__tab--active': index === activeIndex }"
        role="tab"
        :aria-selected="index === activeIndex"
        @click="selectQuestion(index)"
      >
        第 {{ index + 1 }} 题
      </button>
    </header>

    <article v-if="activeQuestion" class="scene-quiz-main__card">
      <div class="scene-quiz-main__head">
        <span class="scene-quiz-main__badge">
          {{ activeQuestion.type === 'single' ? '单选' : activeQuestion.type }}
        </span>
        <span v-if="activeQuestion.points > 0" class="scene-quiz-main__points">
          {{ activeQuestion.points }} 分
        </span>
      </div>

      <h3 class="scene-quiz-main__question">{{ activeQuestion.question }}</h3>

      <ul class="scene-quiz-main__options">
        <li
          v-for="option in activeQuestion.options"
          :key="option.id"
          class="scene-quiz-main__option"
          :class="{
            'scene-quiz-main__option--correct': isOptionCorrect(
              option,
              activeQuestion.answers,
            ),
          }"
        >
          <span class="scene-quiz-main__option-value">
            {{ option.value || option.id }}
          </span>
          <span class="scene-quiz-main__option-label">
            {{ optionDisplay(option) }}
          </span>
        </li>
      </ul>

      <p v-if="activeQuestion.analysis" class="scene-quiz-main__analysis">
        <span class="scene-quiz-main__analysis-label">解析</span>
        {{ activeQuestion.analysis }}
      </p>
    </article>
  </div>
</template>

<style scoped>
.scene-quiz-main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 1rem 1.25rem;
  box-sizing: border-box;
  overflow: hidden;
  background: #f7f2ea;
}

.scene-quiz-main__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex-shrink: 0;
}

.scene-quiz-main__tab {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid #e8dfd6;
  background: #fff;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.scene-quiz-main__tab:hover {
  border-color: color-mix(in oklab, var(--om-fg-accent) 35%, #e8dfd6);
  color: var(--om-fg);
}

.scene-quiz-main__tab--active {
  border-color: var(--om-fg-accent);
  background: color-mix(in oklab, var(--om-fg-accent) 12%, #fff);
  color: var(--om-fg-accent);
  font-weight: 600;
}

.scene-quiz-main__card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1rem 1.125rem;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in oklab, #b6a2de 35%, var(--om-border-subtle));
  background: #fff;
  overflow-y: auto;
}

.scene-quiz-main__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.scene-quiz-main__badge {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background: color-mix(in oklab, var(--om-fg-accent) 12%, #f1f5f9);
  color: var(--om-fg-accent);
  font-size: 0.75rem;
  font-weight: 600;
}

.scene-quiz-main__points {
  font-size: 0.75rem;
  color: var(--om-fg-muted);
}

.scene-quiz-main__question {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.45;
  color: #1e293b;
}

.scene-quiz-main__options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.scene-quiz-main__option {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e8dfd6;
  background: #faf8f5;
}

.scene-quiz-main__option--correct {
  border-color: #22c55e;
  background: color-mix(in oklab, #22c55e 8%, #fff);
}

.scene-quiz-main__option-value {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.25rem;
  border-radius: 0.375rem;
  background: #ebe3d6;
  color: #78350f;
  font-size: 0.8125rem;
  font-weight: 700;
}

.scene-quiz-main__option--correct .scene-quiz-main__option-value {
  background: #22c55e;
  color: #fff;
}

.scene-quiz-main__option-label {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  line-height: 1.4;
  color: #334155;
}

.scene-quiz-main__option--correct .scene-quiz-main__option-label {
  color: #166534;
  font-weight: 500;
}

.scene-quiz-main__analysis {
  margin: 0;
  padding: 0.75rem 0.875rem;
  border-radius: 0.5rem;
  background: #f8fafc;
  border-left: 3px solid color-mix(in oklab, var(--om-fg-accent) 50%, transparent);
  font-size: 0.875rem;
  line-height: 1.5;
  color: #475569;
}

.scene-quiz-main__analysis-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--om-fg-accent);
}
</style>
