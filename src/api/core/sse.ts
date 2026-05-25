// SPDX-License-Identifier: AGPL-3.0
/** Shared SSE reader for fetch + ReadableStream responses. */

import {
  ApiTimeoutError,
  assertOkResponse,
  wasApiErrorReported,
} from '@/api/core/errors';
import { reportApiError } from '@/api/core/notify';
import { API_TIMEOUT_MS } from '@/constants/api';

export interface ReadSseJsonStreamOptions {
  signal?: AbortSignal;
  /** 连续无数据超过该时间则视为超时 */
  idleTimeoutMs?: number;
  /** 为 true 时不弹出全局错误 Toast */
  silent?: boolean;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
  silent?: boolean,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new ApiTimeoutError();
      if (!silent) reportApiError(err);
      reject(err);
    }, idleTimeoutMs);
  });

  try {
    return await Promise.race([reader.read(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function readSseJsonStream<T>(
  res: Response,
  onEvent: (event: T) => void,
  signalOrOptions?: AbortSignal | ReadSseJsonStreamOptions,
): Promise<void> {
  const options =
    signalOrOptions instanceof AbortSignal
      ? { signal: signalOrOptions }
      : (signalOrOptions ?? {});
  const { signal, idleTimeoutMs = API_TIMEOUT_MS, silent } = options;

  try {
    await assertOkResponse(res);
  } catch (error) {
    if (!silent && !wasApiErrorReported(error)) {
      reportApiError(error);
    }
    throw error;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    throwIfAborted(signal);
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      return;
    }

    const { done, value } = await readWithIdleTimeout(reader, idleTimeoutMs, silent);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const json = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      if (!json) continue;

      try {
        onEvent(JSON.parse(json) as T);
      } catch {
        // skip malformed lines
      }
    }
  }

  if (buffer.trim()) {
    const json = buffer.trim().startsWith('data:')
      ? buffer.trim().slice(5).trim()
      : buffer.trim();
    if (json) {
      try {
        onEvent(JSON.parse(json) as T);
      } catch {
        // skip malformed lines
      }
    }
  }
}
