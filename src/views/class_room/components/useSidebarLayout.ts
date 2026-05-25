// SPDX-License-Identifier: AGPL-3.0
import { onMounted, onUnmounted, ref, watch } from 'vue';

const STORAGE_KEY = 'openmaic.classroom.sidebar';

export const SIDEBAR_WIDTH_MIN = 220;
export const SIDEBAR_WIDTH_MAX = 520;
export const SIDEBAR_WIDTH_DEFAULT = 300;
export const SIDEBAR_WIDTH_COLLAPSED = 52;

type SidebarLayoutState = {
  width: number;
  collapsed: boolean;
};

function clampWidth(value: number) {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, value));
}

function readStoredLayout(): SidebarLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { width: SIDEBAR_WIDTH_DEFAULT, collapsed: false };
    }
    const parsed = JSON.parse(raw) as Partial<SidebarLayoutState>;
    return {
      width: clampWidth(parsed.width ?? SIDEBAR_WIDTH_DEFAULT),
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return { width: SIDEBAR_WIDTH_DEFAULT, collapsed: false };
  }
}

function writeStoredLayout(state: SidebarLayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private browsing */
  }
}

export function useSidebarLayout() {
  const stored = readStoredLayout();
  const width = ref(stored.width);
  const collapsed = ref(stored.collapsed);
  const isResizing = ref(false);

  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function persist() {
    writeStoredLayout({
      width: width.value,
      collapsed: collapsed.value,
    });
  }

  function toggleCollapsed() {
    collapsed.value = !collapsed.value;
  }

  function onResizePointerMove(event: PointerEvent) {
    const next = clampWidth(resizeStartWidth + (event.clientX - resizeStartX));
    width.value = next;
  }

  function stopResize() {
    if (!isResizing.value) return;
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onResizePointerMove);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointercancel', stopResize);
    persist();
  }

  function startResize(event: PointerEvent) {
    if (collapsed.value) return;
    event.preventDefault();
    isResizing.value = true;
    resizeStartX = event.clientX;
    resizeStartWidth = width.value;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }

  watch([width, collapsed], persist);

  onMounted(() => {
    if (!stored.collapsed) {
      width.value = clampWidth(stored.width);
    }
  });

  onUnmounted(stopResize);

  return {
    width,
    collapsed,
    isResizing,
    toggleCollapsed,
    startResize,
  };
}
