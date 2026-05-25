// SPDX-License-Identifier: AGPL-3.0
/** 课堂 — /api/classroom */

import { http } from '@/api/instance';
import type { ApiResponse } from '@/types/chat';
import type { ClassroomRecord, CreateClassroomParams } from '@/types/classroom';

const PREFIX = '/api/classroom';

export function createClassroom(
  body: CreateClassroomParams,
): Promise<ApiResponse<ClassroomRecord>> {
  return http.post<ClassroomRecord>(PREFIX, body);
}

export function getClassroom(
  classroomId: string,
): Promise<ApiResponse<ClassroomRecord>> {
  return http.get<ClassroomRecord>(`${PREFIX}/${classroomId}`);
}
