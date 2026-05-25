<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@/utils/cn';

export type OmInputVariant = 'default' | 'inline';

const model = defineModel<string>({ default: '' });

const props = withDefaults(
  defineProps<{
    variant?: OmInputVariant;
    disabled?: boolean;
    placeholder?: string;
    type?: string;
    class?: string;
  }>(),
  {
    variant: 'default',
    disabled: false,
    type: 'text',
  },
);

const classes = computed(() => {
  const base =
    'w-full text-om-fg text-sm placeholder:text-om-fg-muted/60 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<OmInputVariant, string> = {
    default:
      'rounded-lg border border-om-border bg-om-card px-3 py-2 focus:ring-2 focus:ring-[color-mix(in_oklab,var(--om-bg-primary)_40%,transparent)]',
    inline: 'border-0 bg-om-input px-0 py-0 focus:ring-0',
  };

  return cn(base, variants[props.variant], props.class);
});
</script>

<template>
  <input v-model="model" :type="type" :class="classes" :disabled="disabled" :placeholder="placeholder" />
</template>
