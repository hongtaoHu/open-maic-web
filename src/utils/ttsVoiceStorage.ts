// SPDX-License-Identifier: AGPL-3.0
import { TTS_VOICE_STORAGE_KEY } from '@/constants/tts';
import type { TtsVoiceItem, TtsVoicePreference } from '@/types/tts';

export function loadTtsVoicePreference(): TtsVoicePreference | null {
  const raw = localStorage.getItem(TTS_VOICE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TtsVoicePreference;
    if (!parsed?.shortName?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTtsVoicePreference(voice: TtsVoiceItem | TtsVoicePreference): void {
  const payload: TtsVoicePreference = {
    shortName: voice.shortName,
    name: voice.name,
    locale: voice.locale,
    gender: voice.gender,
  };
  localStorage.setItem(TTS_VOICE_STORAGE_KEY, JSON.stringify(payload));
}

export function formatTtsVoiceLabel(
  voice: TtsVoicePreference | TtsVoiceItem | null | undefined,
  fallback = '音色',
): string {
  if (!voice?.shortName) return fallback;
  const locale = voice.locale?.replace('_', '-') ?? '';
  const gender =
    voice.gender === 'Female' ? '女' : voice.gender === 'Male' ? '男' : '';
  if (locale && gender) return `${locale} · ${gender}`;
  return voice.shortName;
}
