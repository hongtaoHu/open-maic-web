// SPDX-License-Identifier: AGPL-3.0
import { ANIMATION_CLASS_PREFIX } from '@/theme/configs/animation';

export type AnimateSpeed = 'slower' | 'slow' | 'fast' | 'faster';

/** Build Animate.css class list (e.g. `animate__animated animate__faster animate__fadeIn`). */
export function buildAnimateClasses(effect: string, speed?: AnimateSpeed): string {
  const p = ANIMATION_CLASS_PREFIX;
  return [p + 'animated', speed ? p + speed : '', p + effect].filter(Boolean).join(' ');
}

/** System prompt panel — aligned with ENTER_ANIMATIONS / EXIT_ANIMATIONS presets. */
export const SYSTEM_PROMPT_ANIMATION = {
  enter: 'fadeInDown',
  leave: 'fadeOutUp',
  speed: 'faster' as const satisfies AnimateSpeed,
};

export function systemPromptTransitionClasses() {
  const { enter, leave, speed } = SYSTEM_PROMPT_ANIMATION;
  return {
    enterActiveClass: buildAnimateClasses(enter, speed),
    leaveActiveClass: buildAnimateClasses(leave, speed),
  };
}
