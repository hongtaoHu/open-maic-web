<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';

import { useStageStore } from '@/stores/stage';
import type { Scene } from '@/types/stage';
import { resolveScenePreviewContent } from '@/utils/slidePreview';

import ScenePreview from './ScenePreview.vue';
import { SIDEBAR_WIDTH_COLLAPSED, useSidebarLayout } from './useSidebarLayout';

const props = defineProps<{
  generating?: boolean;
  generatingIndex?: number | null;
  generatingLabel?: string;
  totalOutlines?: number;
}>();

const stageStore = useStageStore();
const { scenes, currentSceneId } = storeToRefs(stageStore);
const { width, collapsed, isResizing, toggleCollapsed, startResize } = useSidebarLayout();

const sortedScenes = computed(() =>
  [...scenes.value].sort((a, b) => a.order - b.order),
);

const sidebarStyle = computed(() => ({
  width: collapsed.value ? `${SIDEBAR_WIDTH_COLLAPSED}px` : `${width.value}px`,
}));

const showPendingLoading = computed(
  () =>
    props.generating &&
    props.generatingIndex != null &&
    (props.totalOutlines ?? 0) > sortedScenes.value.length,
);

const pendingTitle = computed(() => {
  const index = props.generatingIndex ?? sortedScenes.value.length;
  return `场景 ${index + 1}`;
});

function isActive(scene: Scene) {
  return scene.id === currentSceneId.value;
}

function previewContent(scene: Scene) {
  return resolveScenePreviewContent(scene.content);
}

function selectScene(sceneId: string) {
  stageStore.setCurrentScene(sceneId);
}

function onCollapsedSceneClick(sceneId: string) {
  selectScene(sceneId);
  if (collapsed.value) {
    collapsed.value = false;
  }
}

function onResizePointerDown(event: PointerEvent) {
  (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
  startResize(event);
}
</script>

<template>
  <div
    class="classroom-sidebar-shell"
    :class="{
      'classroom-sidebar-shell--collapsed': collapsed,
      'classroom-sidebar-shell--resizing': isResizing,
    }"
    :style="sidebarStyle"
  >
    <aside class="classroom-sidebar">
      <header class="classroom-sidebar__header">
        <RouterLink
          v-if="!collapsed"
          to="/"
          class="classroom-sidebar__brand"
          title="返回首页"
        >
          <span class="om-logo-gradient classroom-sidebar__logo">
            <SvgIcon name="logo-hexagon" :size="22" class="text-white" />
          </span>
          <span class="classroom-sidebar__brand-text">OpenMAIC</span>
        </RouterLink>
        <RouterLink
          v-else
          to="/"
          class="classroom-sidebar__brand classroom-sidebar__brand--icon-only"
          title="返回首页"
        >
          <span class="om-logo-gradient classroom-sidebar__logo">
            <SvgIcon name="logo-hexagon" :size="20" class="text-white" />
          </span>
        </RouterLink>
        <button
          type="button"
          class="classroom-sidebar__collapse"
          :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
          :aria-expanded="!collapsed"
          @click="toggleCollapsed"
        >
          <svg
            class="classroom-sidebar__collapse-icon"
            :class="{ 'classroom-sidebar__collapse-icon--flipped': collapsed }"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="3.5"
              y="4.5"
              width="13"
              height="11"
              rx="2"
              stroke="currentColor"
              stroke-width="1.25"
            />
            <path
              d="M8 7.5v5M8 10H5.5"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </header>

      <nav
        v-show="!collapsed"
        class="classroom-sidebar__nav"
        aria-label="课堂场景"
      >
        <ul class="classroom-sidebar__list">
          <li
            v-for="scene in sortedScenes"
            :key="scene.id"
            class="classroom-sidebar__item"
            :class="{
              'classroom-sidebar__item--active': isActive(scene),
            }"
          >
            <button
              type="button"
              class="classroom-sidebar__scene"
              :aria-current="isActive(scene) ? 'true' : undefined"
              @click="selectScene(scene.id)"
            >
              <span class="classroom-sidebar__scene-head">
                <span class="classroom-sidebar__index">{{ scene.order + 1 }}</span>
                <span class="classroom-sidebar__title">{{ scene.title }}</span>
              </span>
              <ScenePreview
                class="classroom-sidebar__preview"
                layout="sidebar"
                :type="scene.type"
                :title="scene.title"
                :content="previewContent(scene)"
              />
            </button>
          </li>

          <li
            v-if="showPendingLoading"
            class="classroom-sidebar__item classroom-sidebar__item--pending"
          >
            <div class="classroom-sidebar__scene classroom-sidebar__scene--pending">
              <span class="classroom-sidebar__scene-head">
                <span class="classroom-sidebar__index">{{ (generatingIndex ?? 0) + 1 }}</span>
                <span class="classroom-sidebar__title">{{ pendingTitle }}</span>
              </span>
              <ScenePreview
                class="classroom-sidebar__preview"
                layout="sidebar"
                type="slide"
                :title="pendingTitle"
                loading
                :loading-label="generatingLabel || '正在生成课件…'"
              />
            </div>
          </li>
        </ul>
      </nav>

      <nav
        v-show="collapsed"
        class="classroom-sidebar__nav-collapsed"
        aria-label="课堂场景（收起）"
      >
        <button
          v-for="scene in sortedScenes"
          :key="scene.id"
          type="button"
          class="classroom-sidebar__nav-dot"
          :class="{ 'classroom-sidebar__nav-dot--active': isActive(scene) }"
          :title="`${scene.order + 1}. ${scene.title}`"
          :aria-label="`${scene.order + 1}. ${scene.title}`"
          :aria-current="isActive(scene) ? 'true' : undefined"
          @click="onCollapsedSceneClick(scene.id)"
        >
          {{ scene.order + 1 }}
        </button>
        <span
          v-if="generating"
          class="classroom-sidebar__nav-dot classroom-sidebar__nav-dot--loading"
          :title="generatingLabel"
          aria-hidden="true"
        />
      </nav>
    </aside>

    <button
      v-show="!collapsed"
      type="button"
      class="classroom-sidebar__resize"
      aria-label="拖动调整侧边栏宽度"
      @pointerdown="onResizePointerDown"
    />
  </div>
</template>

<style scoped>
.classroom-sidebar-shell {
  position: relative;
  flex-shrink: 0;
  height: 100dvh;
  max-height: 100dvh;
  transition: width 0.22s ease;
}

.classroom-sidebar-shell--resizing {
  transition: none;
}

.classroom-sidebar-shell--collapsed {
  transition: width 0.2s ease;
}

.classroom-sidebar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--om-border);
  background: var(--om-bg-page);
}

.classroom-sidebar__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  padding: 0.875rem 0.5rem 0.75rem;
  background: var(--om-bg-page);
}

.classroom-sidebar-shell--collapsed .classroom-sidebar__header {
  flex-direction: column;
  padding: 0.75rem 0.375rem;
}

.classroom-sidebar__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.classroom-sidebar__brand--icon-only {
  justify-content: center;
}

.classroom-sidebar__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.classroom-sidebar__brand-text {
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--om-fg-accent);
  white-space: nowrap;
}

.classroom-sidebar__collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.5rem;
  border: 1px solid var(--om-border-subtle);
  background: var(--om-bg-card);
  color: var(--om-fg-muted);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}

.classroom-sidebar__collapse:hover {
  color: var(--om-fg-secondary);
  background: var(--om-bg-subtle);
}

.classroom-sidebar__collapse-icon {
  width: 1.125rem;
  height: 1.125rem;
  transition: transform 0.2s ease;
}

.classroom-sidebar__collapse-icon--flipped {
  transform: scaleX(-1);
}

.classroom-sidebar__resize {
  position: absolute;
  top: 0;
  right: -3px;
  z-index: 2;
  width: 6px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.classroom-sidebar__resize::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 9999px;
  background: transparent;
  transition: background 0.15s;
}

.classroom-sidebar__resize:hover::after,
.classroom-sidebar-shell--resizing .classroom-sidebar__resize::after {
  background: color-mix(in oklab, var(--om-fg-accent) 55%, transparent);
}

.classroom-sidebar__nav,
.classroom-sidebar__nav-collapsed {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.classroom-sidebar__nav::-webkit-scrollbar,
.classroom-sidebar__nav-collapsed::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.classroom-sidebar__nav {
  padding: 0 0.625rem 1rem;
}

.classroom-sidebar__nav-collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0 1rem;
}

.classroom-sidebar__nav-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 9999px;
  background: var(--om-bg-muted);
  color: var(--om-fg-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.classroom-sidebar__nav-dot:hover {
  background: var(--om-bg-subtle);
  color: var(--om-fg);
}

.classroom-sidebar__nav-dot--active {
  background: var(--om-fg-accent);
  color: #fff;
}

.classroom-sidebar__nav-dot--loading {
  background: transparent;
  border: 2px solid color-mix(in oklab, var(--om-fg-accent) 25%, transparent);
  border-top-color: var(--om-fg-accent);
  animation: sidebar-dot-spin 0.8s linear infinite;
  cursor: default;
}

@keyframes sidebar-dot-spin {
  to {
    transform: rotate(360deg);
  }
}

.classroom-sidebar__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.classroom-sidebar__item {
  border-radius: 1rem;
  transition: box-shadow 0.15s;
}

.classroom-sidebar__item--active {
  padding: 0.375rem;
  border: 1.5px solid color-mix(in oklab, var(--om-fg-accent) 45%, transparent);
  background: color-mix(in oklab, var(--om-fg-accent) 6%, var(--om-bg-card));
  box-shadow: 0 4px 20px -8px color-mix(in oklab, var(--om-fg-accent) 25%, transparent);
}

.classroom-sidebar__item--pending,
.classroom-sidebar__item--generating {
  padding: 0.375rem;
  border: 1px dashed var(--om-border);
  background: var(--om-bg-muted);
}

.classroom-sidebar__scene {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.classroom-sidebar__scene--pending {
  cursor: default;
}

.classroom-sidebar__item:not(.classroom-sidebar__item--active) .classroom-sidebar__scene {
  padding: 0 0.125rem;
}

.classroom-sidebar__scene-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.375rem 0.5rem;
  border-radius: 0.75rem;
  transition:
    background 0.15s,
    color 0.15s;
}

.classroom-sidebar__item--active .classroom-sidebar__scene-head {
  padding: 0.5rem 0.625rem;
  background: var(--om-fg-accent);
  color: #fff;
}

.classroom-sidebar__item:not(.classroom-sidebar__item--active) .classroom-sidebar__scene:hover .classroom-sidebar__scene-head {
  background: var(--om-bg-subtle);
}

.classroom-sidebar__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  flex-shrink: 0;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
}

.classroom-sidebar__item--active .classroom-sidebar__index {
  background: rgb(255 255 255 / 0.22);
  color: #fff;
}

.classroom-sidebar__item:not(.classroom-sidebar__item--active) .classroom-sidebar__index {
  background: var(--om-bg-muted);
  color: var(--om-fg-secondary);
}

.classroom-sidebar__title {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.classroom-sidebar__item:not(.classroom-sidebar__item--active) .classroom-sidebar__title {
  color: var(--om-fg);
}

.classroom-sidebar__preview {
  width: 100%;
  margin-top: 0.125rem;
}

.classroom-sidebar__item--active .classroom-sidebar__preview {
  margin-top: 0.125rem;
}
</style>
