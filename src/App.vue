<script setup lang="ts">
import { RouterView } from 'vue-router';

import GlobalNotify from '@/components/GlobalNotify.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
</script>

<template>
  <div class="relative min-h-screen bg-om-page text-om-fg">
    <GlobalNotify />
    <ThemeToggle class="fixed top-4 right-4 z-50" />
    <RouterView />
  </div>
</template>
