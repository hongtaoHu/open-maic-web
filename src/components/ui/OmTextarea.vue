<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@/utils/cn';

export type OmTextareaVariant = 'default' | 'inline' | 'panel';

const model = defineModel<string>({ default: '' });

const props = withDefaults(
  defineProps<{
    variant?: OmTextareaVariant;
    rows?: number;
    disabled?: boolean;
    placeholder?: string;
    class?: string;
  }>(),
  {
    variant: 'default',
    rows: 4,
    disabled: false,
  },
);

const classes = computed(() => {
  const base =
    'w-full resize-none text-sm leading-relaxed focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<OmTextareaVariant, string> = {
    default:
      'rounded-lg border border-om-border bg-om-card text-om-fg px-3 py-2.5 placeholder:text-om-fg-muted/70 focus:ring-1 focus:ring-[var(--om-border-focus)] focus:border-[var(--om-border-focus)]',
    inline:
      'border-0 bg-om-input text-om-fg text-[13px] placeholder:text-om-fg-muted/70 focus:ring-0 px-2 sm:px-0',
    panel: 'om-textarea-panel rounded-lg border px-3 py-2.5 placeholder:text-om-fg-muted/70',
  };

  return cn(base, variants[props.variant], props.class);
});
</script>

<template>
  <textarea
    v-model="model"
    :rows="rows"
    :class="classes"
    :disabled="disabled"
    :placeholder="placeholder"
  />
</template>

<style scoped>
.om-textarea-panel {
  color: var(--om-fg-on-panel);
  background: var(--om-bg-prompt-input);
  border-color: var(--om-border-input);
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.om-textarea-panel::placeholder {
  color: var(--om-placeholder-prompt);
}

.om-textarea-panel:focus {
  border-color: var(--om-border-focus);
  --tw-ring-color: var(--om-border-focus);
  box-shadow: 0 0 0 1px var(--om-border-focus);
}
</style>
