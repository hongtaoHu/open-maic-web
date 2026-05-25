// SPDX-License-Identifier: AGPL-3.0
/** 课堂编排 SSE — /api/classroom/stream */

import { http } from '@/api/instance';
import { readSseJsonStream } from '@/api/core/sse';
import { CLASSROOM_STREAM_PATH } from '@/constants/classroom-stream';
import type {
  ClassroomStreamEvent,
  ClassroomStreamQuery,
  ClassroomStreamRequest,
  ClassroomStreamStartInput,
} from '@/types/classroom-stream';

/** 将应用内 camelCase 入参转为接口要求的 JSON 字段名 */
export function toClassroomStreamRequest(
  input: ClassroomStreamStartInput,
): ClassroomStreamRequest {
  return {
    classroom_id: input.classroomId,
    systemPrompt: input.systemPrompt ?? undefined,
    userQuestion: input.userQuestion ?? undefined,
    agentTeacherId: input.agentTeacherId,
    selectAgentIds: input.selectAgentIds,
    webSearch: input.webSearch ?? false,
    agent_configs: input.agentConfigs,
    language: input.language ?? 'Chinese',
    grade: input.grade ?? '初中',
    max_turns: input.maxTurns ?? 20,
  };
}

function streamQuery(params?: ClassroomStreamQuery): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.language) q.set('language', params.language);
  if (params.grade) q.set('grade', params.grade);
  if (params.maxTurns != null) q.set('max_turns', String(params.maxTurns));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function streamClassroom(
  body: ClassroomStreamStartInput | ClassroomStreamRequest,
  onEvent: (event: ClassroomStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const payload =
    'classroom_id' in body ? body : toClassroomStreamRequest(body);
  const res = await http.fetchUntilResponse({
    url: CLASSROOM_STREAM_PATH,
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
  });
  await readSseJsonStream<ClassroomStreamEvent>(res, onEvent, { signal });
}

export async function streamClassroomById(
  classroomId: string,
  onEvent: (event: ClassroomStreamEvent) => void,
  options?: { query?: ClassroomStreamQuery; signal?: AbortSignal },
): Promise<void> {
  const res = await http.fetchUntilResponse({
    url: `/api/classroom/${encodeURIComponent(classroomId)}/stream${streamQuery(options?.query)}`,
    method: 'GET',
    signal: options?.signal,
  });
  await readSseJsonStream<ClassroomStreamEvent>(res, onEvent, {
    signal: options?.signal,
  });
}
