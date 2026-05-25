// SPDX-License-Identifier: AGPL-3.0

import { synthesizeTtsSpeech } from '@/api/models/tts';
import { db } from '@/db';
import type { SceneTtsSegmentRecord } from '@/types/sceneTts';
import { sceneTtsSegmentId } from '@/types/sceneTts';
import { TTS_DEFAULT_PITCH, TTS_DEFAULT_RATE, TTS_DEFAULT_VOICE } from '@/types/tts';
import { loadTtsVoicePreference } from '@/utils/ttsVoiceStorage';

export interface PrefetchSceneTtsParams {
  classroomId: string;
  sceneId: string;
  sceneOrder: number;
  keyPoints: string[];
  voice?: string;
  rate?: string;
  pitch?: string;
}

const prefetchInFlight = new Map<string, Promise<void>>();

function prefetchKey(classroomId: string, sceneId: string): string {
  return `${classroomId}::${sceneId}`;
}

export function resolveDefaultTtsVoice(): string {
  return loadTtsVoicePreference()?.shortName?.trim() || TTS_DEFAULT_VOICE;
}

export async function loadSceneTtsSegments(
  classroomId: string,
  sceneId: string,
): Promise<SceneTtsSegmentRecord[]> {
  const rows = await db.sceneTtsSegments
    .where({ classroomId, sceneId })
    .toArray();
  return rows.sort((a, b) => a.segmentIndex - b.segmentIndex);
}

export async function clearSceneTtsSegments(
  classroomId: string,
  sceneId: string,
): Promise<void> {
  await db.sceneTtsSegments.where({ classroomId, sceneId }).delete();
}

export async function prefetchSceneTtsSegments(
  params: PrefetchSceneTtsParams,
): Promise<void> {
  const keyPoints = params.keyPoints.map((point) => point.trim()).filter(Boolean);
  if (!keyPoints.length) return;

  const voice = params.voice?.trim() || resolveDefaultTtsVoice();
  const rate = params.rate ?? TTS_DEFAULT_RATE;
  const pitch = params.pitch ?? TTS_DEFAULT_PITCH;
  const flightKey = prefetchKey(params.classroomId, params.sceneId);

  const existing = prefetchInFlight.get(flightKey);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    await clearSceneTtsSegments(params.classroomId, params.sceneId);
    const updatedAt = Date.now();

    for (let segmentIndex = 0; segmentIndex < keyPoints.length; segmentIndex += 1) {
      const text = keyPoints[segmentIndex];
      const audio = await synthesizeTtsSpeech({ text, voice, rate, pitch });
      const record: SceneTtsSegmentRecord = {
        id: sceneTtsSegmentId(params.classroomId, params.sceneId, segmentIndex),
        classroomId: params.classroomId,
        sceneId: params.sceneId,
        sceneOrder: params.sceneOrder,
        segmentIndex,
        text,
        voice,
        audio,
        updatedAt,
      };
      await db.sceneTtsSegments.put(record);
    }
  })();

  prefetchInFlight.set(flightKey, task);
  try {
    await task;
  } finally {
    prefetchInFlight.delete(flightKey);
  }
}

/** 若缓存段数或文案与 keyPoints 不一致则重新预合成 */
export async function ensureSceneTtsCached(
  params: PrefetchSceneTtsParams,
): Promise<void> {
  const keyPoints = params.keyPoints.map((point) => point.trim()).filter(Boolean);
  if (!keyPoints.length) return;

  const voice = params.voice?.trim() || resolveDefaultTtsVoice();
  const existing = await loadSceneTtsSegments(params.classroomId, params.sceneId);
  const matches =
    existing.length === keyPoints.length &&
    existing.every(
      (segment, index) =>
        segment.segmentIndex === index &&
        segment.text === keyPoints[index] &&
        segment.voice === voice &&
        segment.audio instanceof Blob &&
        segment.audio.size > 0,
    );

  if (matches) return;

  await prefetchSceneTtsSegments({ ...params, keyPoints, voice });
}

export function isSceneTtsPrefetching(
  classroomId: string,
  sceneId: string,
): boolean {
  return prefetchInFlight.has(prefetchKey(classroomId, sceneId));
}

/** 仅从 IndexedDB 读取，按 segmentIndex 顺序返回可播放的音频 Blob */
export async function loadSceneTtsPlaybackBlobs(
  classroomId: string,
  sceneId: string,
  segmentCount: number,
): Promise<Blob[] | null> {
  if (segmentCount <= 0) return null;

  const segments = await loadSceneTtsSegments(classroomId, sceneId);
  const segmentByIndex = new Map(
    segments.map((segment) => [segment.segmentIndex, segment]),
  );

  const blobs: Blob[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const audio = segmentByIndex.get(index)?.audio;
    if (!(audio instanceof Blob) || audio.size === 0) {
      return null;
    }
    blobs.push(audio);
  }
  return blobs;
}

export async function countSceneTtsSegments(
  classroomId: string,
  sceneId: string,
): Promise<number> {
  return db.sceneTtsSegments.where({ classroomId, sceneId }).count();
}
