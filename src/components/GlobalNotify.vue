<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useNotifyStore } from '@/stores/notify';

const notify = useNotifyStore();
const { message, type } = storeToRefs(notify);

const typeClass: Record<string, string> = {
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100',
  info: 'border-om-border bg-om-card text-om-fg',
};
</script>

<template>
  <Teleport to="body">
    <Transition name="global-notify">
      <div
        v-if="message"
        class="global-notify pointer-events-none fixed inset-x-0 top-4 z-200 flex justify-center px-4"
        role="presentation"
      >
        <div
          class="global-notify__panel pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
          :class="typeClass[type] ?? typeClass.error"
          role="alert"
          aria-live="assertive"
        >
          <p class="min-w-0 flex-1 leading-relaxed">{{ message }}</p>
          <button
            type="button"
            class="global-notify__close shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none opacity-70 transition-opacity hover:opacity-100"
            aria-label="关闭提示"
            @click="notify.dismiss()"
          >
            ×
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.global-notify-enter-active,
.global-notify-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.global-notify-enter-from,
.global-notify-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
</style>
