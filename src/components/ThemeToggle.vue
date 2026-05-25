<script setup lang="ts">
import { useThemeStore } from '@/stores/theme';
import type { ThemePreference } from '@/theme';

const theme = useThemeStore();

const options: { value: ThemePreference; label: string; title: string }[] = [
  { value: 'light', label: '浅色', title: '浅色模式' },
  { value: 'dark', label: '深色', title: '深色模式' },
  { value: 'system', label: '系统', title: '跟随系统' },
];
</script>

<template>
  <div
    class="inline-flex items-center rounded-full border p-0.5 text-xs font-medium shadow-sm"
    style="
      border-color: var(--om-border);
      background: var(--om-bg-chip);
      color: var(--om-fg-secondary);
    "
    role="radiogroup"
    aria-label="主题模式"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="theme.preference === opt.value"
      :title="opt.title"
      class="rounded-full px-2.5 py-1 transition-colors"
      :class="theme.preference === opt.value ? 'shadow-sm' : 'hover:opacity-80'"
      :style="
        theme.preference === opt.value
          ? {
              background: 'var(--om-bg-primary)',
              color: 'var(--om-fg-on-primary)',
            }
          : undefined
      "
      @click="theme.setPreference(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
