// SPDX-License-Identifier: AGPL-3.0
/** Classroom orchestration SSE — POST /api/classroom/stream */

/** POST /api/classroom/stream 请求体（与 OpenAPI 一致） */
export interface ClassroomStreamRequest {
  classroom_id: string;
  systemPrompt?: string | null;
  userQuestion?: string | null;
  agentTeacherId: string;
  selectAgentIds?: string[];
  webSearch?: boolean;
  agent_configs: AgentRoleConfig[];
  language?: string;
  grade?: string;
  max_turns?: number;
}

/** Agent 运行时配置（agent_configs 数组元素） */
export interface AgentRoleConfig {
  id: string;
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  allowedActions: string[];
  priority: number;
}

/** 应用内入参，经 toClassroomStreamRequest 序列化为 ClassroomStreamRequest */
export interface ClassroomStreamStartInput {
  classroomId: string;
  systemPrompt?: string | null;
  userQuestion?: string | null;
  agentTeacherId: string;
  selectAgentIds?: string[];
  webSearch?: boolean;
  agentConfigs: AgentRoleConfig[];
  language?: string;
  grade?: string;
  maxTurns?: number;
}

export interface ClassroomStreamQuery {
  language?: string;
  grade?: string;
  maxTurns?: number;
}

export interface SceneOutline {
  id?: string;
  title: string;
  description?: string;
  type: string;
  keyPoints?: string[];
  order?: number;
  estimatedMinutes?: number;
  languageNote?: string | null;
  widgetType?: string;
  widgetOutline?: Record<string, unknown>;
}

export type ClassroomStreamEvent =
  | { type: 'language_directive'; data: string }
  | { type: 'stage_change'; stage: string; label: string }
  | { type: 'token'; agentId: string; content: string; node: string }
  | {
      type: 'outlines_generated';
      data: SceneOutline;
      index: number;
    }
  | {
      type: 'content_generated';
      data?: unknown;
      scenes?: unknown[];
      scenesCount?: number;
    }
  | { type: 'director_decision'; nextSpeaker: string; reasoning: string }
  | {
      type: 'agent_end';
      agentId: string;
      agentName: string;
      content: string;
      actions: unknown[];
    }
  | { type: 'done' }
  | { type: 'error'; message: string; code?: string };
