// SPDX-License-Identifier: AGPL-3.0

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let playbackGeneration = 0;

export interface PlayTtsSequenceOptions {
  onSegmentStart?: (index: number) => void;
}

function releaseCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export function stopTtsPlayback() {
  playbackGeneration += 1;
  releaseCurrentAudio();
}

export function isTtsPlaying(): boolean {
  return currentAudio != null && !currentAudio.paused;
}

function playSingleTtsBlob(blob: Blob): Promise<void> {
  releaseCurrentAudio();

  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };

    const onEnded = () => {
      cleanup();
      releaseCurrentAudio();
      resolve();
    };

    const onError = () => {
      cleanup();
      releaseCurrentAudio();
      reject(new Error('音频播放失败'));
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    void audio.play().catch((error) => {
      cleanup();
      releaseCurrentAudio();
      reject(error);
    });
  });
}

/** 播放单段 MP3 Blob */
export function playTtsBlob(blob: Blob): Promise<void> {
  stopTtsPlayback();
  return playSingleTtsBlob(blob);
}

/** 按顺序播放多段 MP3，中途 stopTtsPlayback 会终止队列 */
export async function playTtsBlobSequence(
  blobs: Blob[],
  options?: PlayTtsSequenceOptions,
): Promise<void> {
  if (!blobs.length) return;

  stopTtsPlayback();
  const generation = playbackGeneration;

  for (let index = 0; index < blobs.length; index += 1) {
    if (generation !== playbackGeneration) return;
    options?.onSegmentStart?.(index);
    await playSingleTtsBlob(blobs[index]);
    if (generation !== playbackGeneration) return;
  }
}
