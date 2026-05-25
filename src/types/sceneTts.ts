// SPDX-License-Identifier: AGPL-3.0

/** IndexedDB 中单段讲解语音（对应场景 keyPoints 的一项） */
export interface SceneTtsSegmentRecord {
  /** `${classroomId}::${sceneId}::${segmentIndex}` */
  id: string;
  classroomId: string;
  sceneId: string;
  sceneOrder: number;
  /** 与 keyPoints 数组下标一致 */
  segmentIndex: number;
  text: string;
  voice: string;
  audio: Blob;
  updatedAt: number;
}

export function sceneTtsSegmentId(
  classroomId: string,
  sceneId: string,
  segmentIndex: number,
): string {
  return `${classroomId}::${sceneId}::${segmentIndex}`;
}
