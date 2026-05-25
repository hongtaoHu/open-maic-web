// SPDX-License-Identifier: AGPL-3.0
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type NotifyType = 'error' | 'warning' | 'success' | 'info';

const DEFAULT_DURATION_MS = 5000;

export const useNotifyStore = defineStore('notify', () => {
  const message = ref<string | null>(null);
  const type = ref<NotifyType>('error');
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function dismiss() {
    message.value = null;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  }

  function show(text: string, options?: { type?: NotifyType; durationMs?: number }) {
    message.value = text;
    type.value = options?.type ?? 'error';
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(dismiss, options?.durationMs ?? DEFAULT_DURATION_MS);
  }

  return {
    message,
    type,
    show,
    dismiss,
  };
});
