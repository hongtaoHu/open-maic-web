<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@/utils/cn';

export type OmButtonVariant = 'primary' | 'secondary' | 'ghost' | 'chip' | 'subtle';
export type OmButtonSize = 'sm' | 'md' | 'icon';

const props = withDefaults(
  defineProps<{
    variant?: OmButtonVariant;
    size?: OmButtonSize;
    /** Pill shape (rounded-full). Default follows variant. */
    pill?: boolean;
    /** For `chip` variant — selected / toggled on state. */
    active?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    active: false,
    disabled: false,
  },
);

const pillShape = computed(() => {
  if (props.pill !== undefined) return props.pill;
  return props.variant === 'primary' || props.variant === 'chip';
});

const classes = computed(() => {
  const base = cn(
    'group inline-flex items-center justify-center gap-1.5 font-medium transition-colors',
    'cursor-pointer disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--om-border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--om-bg-card)]',
    'disabled:select-none',
  );

  const sizes: Record<OmButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    icon: 'p-2',
  };

  const variants: Record<OmButtonVariant, string> = {
    primary: cn(
      'bg-om-primary text-om-fg-on-primary shadow-sm enabled:hover:opacity-90',
      'disabled:bg-om-inactive disabled:text-om-fg-inactive disabled:opacity-100 disabled:shadow-none',
    ),
    secondary: cn(
      'border border-om-border bg-om-card text-om-fg enabled:hover:bg-om-subtle',
      'disabled:border-om-border disabled:bg-om-subtle disabled:text-om-fg-inactive disabled:opacity-100',
    ),
    ghost: cn(
      'text-om-fg-muted enabled:hover:text-om-fg-secondary',
      'disabled:text-om-fg-inactive disabled:opacity-100',
    ),
    subtle: cn(
      'text-om-fg text-sm enabled:hover:bg-om-subtle',
      'disabled:text-om-fg-inactive disabled:opacity-100',
    ),
    chip: cn(
      props.active
        ? 'bg-om-accent-soft text-om-fg-accent-soft enabled:hover:opacity-95'
        : 'bg-om-subtle text-om-fg-muted enabled:hover:opacity-90',
      'disabled:bg-om-inactive disabled:text-om-fg-inactive disabled:opacity-100',
    ),
  };

  return cn(
    base,
    sizes[props.size],
    variants[props.variant],
    pillShape.value ? 'rounded-full' : 'rounded-lg',
    props.class,
  );
});
</script>

<template>
  <button :type="props.type" :class="classes" :disabled="props.disabled">
    <slot />
  </button>
</template>
