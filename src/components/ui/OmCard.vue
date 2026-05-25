<script setup lang="ts">
import { cn } from '@/utils/cn';

const props = withDefaults(
  defineProps<{
    /** Apply default card drop shadow from theme tokens. */
    shadow?: boolean;
    class?: string;
    bodyClass?: string;
  }>(),
  {
    shadow: true,
  },
);
</script>

<template>
  <div
    class="rounded-2xl sm:rounded-3xl bg-om-card border border-om-border overflow-visible"
    :class="cn(props.class)"
    :style="props.shadow ? { boxShadow: 'var(--om-shadow-card)' } : undefined"
  >
    <div
      v-if="$slots.header"
      class="border-b border-om-border bg-om-muted rounded-t-2xl sm:rounded-t-3xl"
    >
      <slot name="header" />
    </div>
    <div :class="props.bodyClass">
      <slot />
    </div>
  </div>
</template>
