// SPDX-License-Identifier: AGPL-3.0

/** Icon modules under `src/assets/icons/` (excludes avatars and other asset SVGs). */
const iconModules = import.meta.glob<string>('@/assets/icons/**/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function pathToIconName(path: string): string {
  const match = path.match(/\/assets\/icons\/(.+)\.svg$/);
  if (!match?.[1]) {
    throw new Error(`Invalid icon path: ${path}`);
  }
  return match[1].replace(/\//g, '-');
}

export const svgIconMap = Object.fromEntries(
  Object.entries(iconModules).map(([path, raw]) => [pathToIconName(path), raw]),
) as Record<string, string>;

export type SvgIconName = keyof typeof svgIconMap;

export function resolveSvgIconName(name: string): SvgIconName | null {
  const normalized = name.replace(/\.svg$/i, '').replace(/\//g, '-');
  if (normalized in svgIconMap) return normalized as SvgIconName;
  return null;
}

export function getSvgIconRaw(name: string): string {
  const key = resolveSvgIconName(name);
  if (!key) {
    if (import.meta.env.DEV) {
      console.warn(`[SvgIcon] Unknown icon "${name}". Available:`, Object.keys(svgIconMap));
    }
    return '';
  }
  return svgIconMap[key];
}

/** Inject sizing class into root `<svg>` for currentColor inheritance. */
export function prepareSvgMarkup(raw: string, extraClass?: string): string {
  const cls = ['svg-icon__graphic', extraClass].filter(Boolean).join(' ');
  if (!/<svg[\s>]/i.test(raw)) return '';

  return raw.replace(/<svg([^>]*)>/i, (_match, attrs: string) => {
    if (/class\s*=/.test(attrs)) {
      return `<svg${attrs.replace(/class\s*=\s*["']([^"']*)["']/, `class="$1 ${cls}"`)}>`;
    }
    return `<svg${attrs} class="${cls}">`;
  });
}

export const svgIconNames = Object.keys(svgIconMap) as SvgIconName[];
