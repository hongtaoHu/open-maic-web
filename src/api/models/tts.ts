// SPDX-License-Identifier: AGPL-3.0
/** TTS — /api/tts */

import { http } from '@/api/instance';
import type {
  TtsSynthesizeParams,
  TtsVoicesResponse,
} from '@/types/tts';
import {
  TTS_DEFAULT_PITCH,
  TTS_DEFAULT_RATE,
  TTS_DEFAULT_VOICE,
} from '@/types/tts';

const PREFIX = '/api/tts';

/** 获取可用 TTS 音色列表 */
export function fetchTtsVoices(): Promise<TtsVoicesResponse> {
  return http.get(`${PREFIX}/voices`) as Promise<TtsVoicesResponse>;
}

/** 文字转语音，返回 MP3 音频 Blob */
export async function synthesizeTtsSpeech(
  params: TtsSynthesizeParams,
): Promise<Blob> {
  const text = params.text.trim();
  if (!text) {
    throw new Error('讲解内容为空');
  }

  const response = await http.fetch({
    url: `${PREFIX}/synthesize`,
    method: 'POST',
    body: JSON.stringify({
      text,
      voice: params.voice?.trim() || TTS_DEFAULT_VOICE,
      rate: params.rate ?? TTS_DEFAULT_RATE,
      pitch: params.pitch ?? TTS_DEFAULT_PITCH,
    }),
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('audio')) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? '语音合成失败');
  }

  return response.blob();
}

export type { TtsVoiceItem, TtsVoicePreference } from '@/types/tts';
export type { TtsSynthesizeParams } from '@/types/tts';
