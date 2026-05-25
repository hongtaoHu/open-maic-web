// SPDX-License-Identifier: AGPL-3.0

import { applyUiThemeTokens } from './app-ui-theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'openmaic.theme';

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    /* private browsing */
  }
  return 'system';
}

export function applyTheme(preference: ThemePreference, resolved?: ResolvedTheme) {
  const theme = resolved ?? resolveTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  applyUiThemeTokens(theme);
  return theme;
}

/** Run before Vue mounts — also inlined in index.html to avoid flash. */
export function initThemeFromStorage(): ResolvedTheme {
  const preference = readStoredPreference();
  return applyTheme(preference);
}
