<script setup lang="ts">
import { computed } from 'vue';

import { getSvgIconRaw, prepareSvgMarkup, type SvgIconName } from '@/utils/svg-icons';

const props = withDefaults(
  defineProps<{
    /** Icon path under assets, e.g. `attach` or `icons/attach` */
    name: SvgIconName | string;
    /** CSS length, number treated as px */
    size?: number | string;
    label?: string;
    class?: string;
  }>(),
  {
    size: 20,
  },
);

const sizeStyle = computed(() => {
  const v = props.size;
  const px = typeof v === 'number' ? `${v}px` : v;
  return { width: px, height: px };
});

const markup = computed(() => {
  const raw = getSvgIconRaw(props.name);
  if (!raw) return '';
  return prepareSvgMarkup(raw);
});
</script>

<template>
  <span
    class="svg-icon inline-flex shrink-0 items-center justify-center"
    :class="props.class"
    :style="sizeStyle"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    role="img"
    v-html="markup"
  />
</template>

<style scoped>
.svg-icon :deep(.svg-icon__graphic) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
