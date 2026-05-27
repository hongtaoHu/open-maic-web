// SPDX-License-Identifier: AGPL-3.0
/**
 * App shell UI tokens — derived from src/theme/configs (PRESET_THEMES + chart palettes).
 * Backgrounds are always tinted; never pure #000 or #fff.
 */
import { CHART_PRESET_THEMES } from '@/theme/configs/chart';
import { PRESET_THEMES } from '@/theme/configs/theme';

export type UiThemeTokens = Record<string, string>;

/** Light: sage slide (#e9efd6) + lavender chart accents (#b6a2de, #93b7e3) */
const LIGHT_PRESET = PRESET_THEMES[6]!;
const LIGHT_CHART = CHART_PRESET_THEMES[3]!;

/** Dark: purple (#36234d), indigo (#242367), cool slate (#171b1e) */
const DARK_PURPLE = PRESET_THEMES[8]!;
const DARK_INDIGO = PRESET_THEMES[11]!;
const DARK_SLATE = PRESET_THEMES[14]!;
const DARK_TEAL = PRESET_THEMES[9]!;
const DARK_CHART = CHART_PRESET_THEMES[10]!;

export const APP_UI_LIGHT: UiThemeTokens = {
  '--om-bg-page': '#ffffff',
  '--om-bg-card': '#f4f5fa',
  '--om-bg-muted': '#e8ebf4',
  '--om-bg-subtle': '#e2e6f0',
  '--om-bg-panel': '#ffffff',
  '--om-bg-panel-muted': '#cdd5e5',
  '--om-bg-prompt-input': '#eceff6',
  '--om-bg-chip': '#eceff6',
  '--om-bg-input': 'transparent',
  '--om-bg-primary': '#4472c4',
  '--om-bg-primary-hover': '#365a9e',
  '--om-bg-accent-soft': '#e8e4f8',
  '--om-bg-inactive': '#d8dce8',

  '--om-orb-1': LIGHT_CHART[5]!,
  '--om-orb-2': LIGHT_CHART[3]!,
  '--om-orb-3': '#ede9fe',

  '--om-fg': '#2b2f3a',
  '--om-fg-secondary': '#4a5568',
  '--om-fg-muted': '#7c8a9e',
  '--om-fg-accent': '#5b4d96',
  '--om-fg-on-primary': '#f4f5fa',
  '--om-fg-on-panel': '#2b2f3a',
  '--om-fg-panel-muted': '#5c6680',
  '--om-placeholder-prompt': 'rgb(74 85 104 / 0.55)',
  '--om-fg-link-hover': LIGHT_CHART[4]!,
  '--om-fg-accent-soft': '#3d6b9e',
  '--om-fg-inactive': '#9aa5b5',

  '--om-border': 'rgb(124 136 160 / 0.28)',
  '--om-border-subtle': 'rgb(189 200 223 / 0.45)',
  '--om-border-panel': 'rgb(124 136 160 / 0.32)',
  '--om-border-input': 'rgb(124 136 160 / 0.38)',
  '--om-border-focus': 'rgb(91 107 242 / 0.45)',

  '--om-ring-avatar': '#f4f5fa',
  '--om-ring-panel': '#dce2ef',
  '--om-badge': '#4a5568',

  '--om-shadow-card': '0 8px 40px -12px rgb(81 107 145 / 0.2)',
  '--om-shadow-panel': '0 12px 40px -8px rgb(81 107 145 / 0.22)',

  '--om-accent-from': LIGHT_CHART[4]!,
  '--om-accent-to': LIGHT_PRESET.colors[3]!,
};

export const APP_UI_DARK: UiThemeTokens = {
  '--om-bg-page': '#1e2236',
  '--om-bg-card': '#282d44',
  '--om-bg-muted': '#2f354c',
  '--om-bg-subtle': '#252a3f',
  '--om-bg-panel': '#2f354c',
  '--om-bg-panel-muted': '#3d4659',
  '--om-bg-prompt-input': '#282f42',
  '--om-bg-chip': '#303650',
  '--om-bg-input': 'transparent',
  '--om-bg-primary': DARK_INDIGO.colors[1]!,
  '--om-bg-primary-hover': '#6b8fd4',
  '--om-bg-accent-soft': 'rgb(155 107 242 / 0.18)',
  '--om-bg-inactive': '#3a4058',

  '--om-orb-1': 'rgb(155 107 242 / 0.2)',
  '--om-orb-2': 'rgb(71 123 209 / 0.16)',
  '--om-orb-3': 'rgb(64 174 189 / 0.12)',

  '--om-fg': '#e8eaf2',
  '--om-fg-secondary': '#a8b0c4',
  '--om-fg-muted': '#7a849c',
  '--om-fg-accent': DARK_CHART[1]!,
  '--om-fg-on-primary': DARK_SLATE.background,
  '--om-fg-on-panel': '#e8eaf2',
  '--om-fg-panel-muted': '#a8b0c4',
  '--om-placeholder-prompt': 'rgb(168 176 196 / 0.5)',
  '--om-fg-link-hover': DARK_PURPLE.colors[4]!,
  '--om-fg-accent-soft': DARK_TEAL.colors[0]!,
  '--om-fg-inactive': '#6a748c',

  '--om-border': 'rgb(100 112 140 / 0.45)',
  '--om-border-subtle': 'rgb(60 68 92 / 0.65)',
  '--om-border-panel': 'rgb(255 255 255 / 0.1)',
  '--om-border-input': 'rgb(255 255 255 / 0.16)',
  '--om-border-focus': 'rgb(255 255 255 / 0.28)',

  '--om-ring-avatar': '#282d44',
  '--om-ring-panel': '#2f354c',
  '--om-badge': '#5c6680',

  '--om-shadow-card': '0 8px 40px -12px rgb(0 0 0 / 0.5)',
  '--om-shadow-panel': '0 12px 40px -8px rgb(0 0 0 / 0.55)',

  '--om-accent-from': DARK_PURPLE.colors[4]!,
  '--om-accent-to': DARK_INDIGO.colors[1]!,
};

const TOKEN_MAP = {
  light: APP_UI_LIGHT,
  dark: APP_UI_DARK,
} as const;

export function getUiThemeTokens(resolved: 'light' | 'dark'): UiThemeTokens {
  return TOKEN_MAP[resolved];
}

export function applyUiThemeTokens(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  const tokens = getUiThemeTokens(resolved);
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

/** Minimal tokens for index.html inline boot script (FOUC). */
export const FOUC_PAGE_BG = {
  light: APP_UI_LIGHT['--om-bg-page']!,
  dark: APP_UI_DARK['--om-bg-page']!,
} as const;
