// SPDX-License-Identifier: AGPL-3.0
import { ref, shallowRef } from 'vue';

import { getApiErrorMessage, streamChat } from '@/api';
import type { StatelessChatRequest, StatelessEvent } from '@/types/chat';

export function useChatStream() {
  const streaming = ref(false);
  const error = ref<string | null>(null);
  const events = shallowRef<StatelessEvent[]>([]);
  const assistantText = ref('');

  async function sendChat(request: StatelessChatRequest) {
    streaming.value = true;
    error.value = null;
    events.value = [];
    assistantText.value = '';

    try {
      await streamChat(request, (event) => {
        events.value = [...events.value, event];

        if (event.type === 'text_delta') {
          assistantText.value += event.data.content;
        }
        if (event.type === 'error') {
          error.value = event.data.message;
        }
      });
    } catch (e) {
      error.value = getApiErrorMessage(e);
    } finally {
      streaming.value = false;
    }
  }

  return { streaming, error, events, assistantText, sendChat };
}
