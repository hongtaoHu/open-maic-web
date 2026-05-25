// SPDX-License-Identifier: AGPL-3.0
/** POST /api/classroom/stream — 固定路径，classroom_id 在请求体中 */

export const CLASSROOM_STREAM_PATH = '/api/classroom/stream';

export const CLASSROOM_STREAM_STORAGE_KEY = 'openmaic.classroomStream';

/** 课堂大纲流式结果，供 class_room 侧边栏读取 */
export const CLASSROOM_OUTLINE_STORAGE_KEY = 'openmaic.classroomOutline';
