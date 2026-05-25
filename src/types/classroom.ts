// SPDX-License-Identifier: AGPL-3.0
/** Classroom API types (matches backend PersistedClassroom). */

export type OutlineStatus = 'none' | 'generating' | 'done' | 'failed';

export interface ClassroomRecord {
  id: string;
  agentTeacherId: string;
  selectAgentIds: string[];
  web_search: boolean;
  outlineId: string;
  outlineStatus?: OutlineStatus;
  outlineList?: unknown[];
  outlineIndex: number;
  askAgentId: string;
  createdAt: string;
  updatedAt: string;
  systemPrompt: string;
  userQuestion: string;
}

export interface CreateClassroomParams {
  agentTeacherId: string;
  selectAgentIds: string[];
  web_search: boolean;
  outlineId: string | null;
  askAgentId: string;
  systemPrompt: string;
  userQuestion: string;
}
