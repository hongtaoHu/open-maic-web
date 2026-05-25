// SPDX-License-Identifier: AGPL-3.0
/** 无状态聊天 SSE — POST /api/chat */

import { http } from '@/api/instance';
import { readSseJsonStream } from '@/api/core/sse';
import type { StatelessChatRequest, StatelessEvent } from '@/types/chat';

const CHAT_PATH = '/api/chat';

export async function streamChat(
  body: StatelessChatRequest,
  onEvent: (event: StatelessEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await http.fetchUntilResponse({
    url: CHAT_PATH,
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
  await readSseJsonStream<StatelessEvent>(res, onEvent, { signal });
}
