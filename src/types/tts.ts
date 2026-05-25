// SPDX-License-Identifier: AGPL-3.0

export interface TtsVoiceItem {
  name: string;
  shortName: string;
  locale: string;
  gender: string;
}

export interface TtsVoicePreference {
  shortName: string;
  name?: string;
  locale?: string;
  gender?: string;
}

export interface TtsSynthesizeParams {
  text: string;
  voice?: string;
  rate?: string;
  pitch?: string;
}

export const TTS_DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
export const TTS_DEFAULT_RATE = '+0%';
export const TTS_DEFAULT_PITCH = '+0Hz';

export type TtsVoicesResponse =
  | ({ success: true } & { items: TtsVoiceItem[] })
  | { success: false; errorCode: string; error: string; details?: string };
