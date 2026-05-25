// SPDX-License-Identifier: AGPL-3.0
import { fetchAgentRoles } from '@/api';
import {
  CLASSROOM_OUTLINE_STORAGE_KEY,
  CLASSROOM_STREAM_STORAGE_KEY,
} from '@/constants/classroom-stream';
import type {
  AgentRoleConfig,
  ClassroomStreamStartInput,
  SceneOutline as StreamSceneOutline,
} from '@/types/classroom-stream';
import type { Scene, SceneType } from '@/types/stage';
import type { ClassroomOutlineCache } from '@/utils/classroomGenerationCache';
import { normalizeGenerationCache } from '@/utils/classroomGenerationCache';

export type { ClassroomOutlineCache };

const SCENE_TYPES: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

function normalizeSceneType(type: string): SceneType {
  const normalized = type.trim().toLowerCase() as SceneType;
  return SCENE_TYPES.includes(normalized) ? normalized : 'slide';
}

export function scenesFromStreamOutlines(
  stageId: string,
  outlines: StreamSceneOutline[],
): Scene[] {
  return outlines
    .filter((outline) => outline?.title?.trim())
    .map((outline, index) => ({
      id: outline.id ?? `scene-${stageId}-${index}`,
      stageId,
      type: normalizeSceneType(outline.type),
      title: outline.title.trim(),
      order: outline.order ?? index,
      content: {
        description: outline.description,
        keyPoints: outline.keyPoints,
        estimatedMinutes: outline.estimatedMinutes,
        languageNote: outline.languageNote,
        widgetType: outline.widgetType,
        widgetOutline: outline.widgetOutline,
      },
    }));
}

export function saveClassroomOutlineCache(cache: ClassroomOutlineCache): void {
  sessionStorage.setItem(CLASSROOM_OUTLINE_STORAGE_KEY, JSON.stringify(cache));
}

export function loadClassroomOutlineCache(
  classroomId?: string,
): ClassroomOutlineCache | null {
  const raw = sessionStorage.getItem(CLASSROOM_OUTLINE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ClassroomOutlineCache;
    if (classroomId && parsed.classroomId !== classroomId) return null;
    return normalizeGenerationCache(parsed);
  } catch {
    return null;
  }
}

export function clearClassroomOutlineCache(): void {
  sessionStorage.removeItem(CLASSROOM_OUTLINE_STORAGE_KEY);
}

export function saveClassroomStreamInput(input: ClassroomStreamStartInput): void {
  sessionStorage.setItem(CLASSROOM_STREAM_STORAGE_KEY, JSON.stringify(input));
}

export function loadClassroomStreamInput(): ClassroomStreamStartInput | null {
  const raw = sessionStorage.getItem(CLASSROOM_STREAM_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClassroomStreamStartInput;
  } catch {
    return null;
  }
}

export async function buildAgentConfigs(
  agentTeacherId: string,
  selectAgentIds: string[],
): Promise<AgentRoleConfig[]> {
  const res = await fetchAgentRoles();
  if (!res.success) throw new Error(res.error);

  const ids = new Set([agentTeacherId, ...selectAgentIds]);
  return res.agents
    .filter((a) => ids.has(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      persona: a.persona,
      avatar: a.avatar,
      color: a.color ?? '#888888',
      allowedActions: a.allowedActions ?? [],
      priority: a.priority,
    }));
}
