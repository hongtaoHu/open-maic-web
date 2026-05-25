<script setup lang="ts">
import OmButton from './OmButton.vue';

const props = withDefaults(
  defineProps<{
    label: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
  }>(),
  {
    type: 'button',
    disabled: false,
  },
);
</script>

<template>
  <OmButton
    variant="ghost"
    size="icon"
    :type="props.type"
    :disabled="props.disabled"
    :class="props.class"
    :aria-label="props.label"
  >
    <slot />
  </OmButton>
</template>
