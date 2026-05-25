// SPDX-License-Identifier: AGPL-3.0
import { createRouter, createWebHistory } from 'vue-router';

import ClassroomView from '@/views/class_room/index.vue';
import GenerationPreviewView from '@/views/generation_preview/index.vue';
import HomeView from '@/views/home/index.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/generation-preview',
      name: 'generation-preview',
      component: GenerationPreviewView,
      props: (route) => ({ classroomId: route.query.id as string | undefined }),
    },
    { path: '/classroom/:id?', name: 'classroom', component: ClassroomView, props: true },
  ],
});

export default router;
