<script setup lang="ts">
defineProps<{
  title: string;
  /** Secondary line, e.g. classroom id */
  subtitle?: string;
}>();
</script>

<template>
  <header class="room-header">
    <h1 class="room-header__title">{{ title }}</h1>
  </header>
</template>

<style scoped>
.room-header {
  /* border-bottom: 1px solid var(--om-border); */
  /* background: var(--om-bg-card); */
  padding: 0.75rem 1.5rem;
}

.room-header__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--om-fg);
}

/* .room-header__subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--om-fg-muted);
} */
</style>
