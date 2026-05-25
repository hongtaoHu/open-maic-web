// SPDX-License-Identifier: AGPL-3.0
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/theme';

export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readStoredPreference());
  const resolved = ref<ResolvedTheme>(resolveTheme(preference.value));

  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

  const isDark = computed(() => resolved.value === 'dark');
  const isLight = computed(() => resolved.value === 'light');
  const followsSystem = computed(() => preference.value === 'system');

  function syncResolved() {
    resolved.value = applyTheme(preference.value);
  }

  function bindSystemListener() {
    unbindSystemListener();
    if (preference.value !== 'system') return;

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = () => syncResolved();
    mediaQuery.addEventListener('change', mediaListener);
  }

  function unbindSystemListener() {
    if (mediaQuery && mediaListener) {
      mediaQuery.removeEventListener('change', mediaListener);
    }
    mediaQuery = null;
    mediaListener = null;
  }

  function setPreference(next: ThemePreference) {
    preference.value = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    syncResolved();
    bindSystemListener();
  }

  function init() {
    preference.value = readStoredPreference();
    syncResolved();
    bindSystemListener();
  }

  function cyclePreference() {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const index = order.indexOf(preference.value);
    setPreference(order[(index + 1) % order.length]!);
  }

  return {
    preference,
    resolved,
    isDark,
    isLight,
    followsSystem,
    setPreference,
    cyclePreference,
    init,
  };
});
