// SPDX-License-Identifier: AGPL-3.0
import type { ClassroomStreamEvent } from '@/types/classroom-stream';

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

/** 解析 SSE 原始 JSON，兼容 snake_case / camelCase 字段 */
export function parseClassroomStreamEvent(raw: unknown): ClassroomStreamEvent | null {
  if (!raw || typeof raw !== 'object') return null;

  const event = raw as Record<string, unknown>;
  const type = event.type;
  if (typeof type !== 'string') return null;

  if (type === 'language_directive' || type === 'languageDirective') {
    const data =
      readString(event.data) ??
      readString(event.language_directive) ??
      readString(event.languageDirective);
    if (!data) return null;
    return { type: 'language_directive', data };
  }

  return raw as ClassroomStreamEvent;
}
