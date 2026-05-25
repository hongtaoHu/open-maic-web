// SPDX-License-Identifier: AGPL-3.0
/**
 * Stateless chat API types (ported from lib/types/chat.ts).
 */

import type { Scene, Stage, StageMode } from './stage';

export interface ChatMessageMetadata {
  senderName?: string;
  senderAvatar?: string;
  originalRole?: 'teacher' | 'agent' | 'user';
  agentId?: string;
  agentColor?: string;
  createdAt?: number;
}

export interface UIMessage {
  id: string;
  role: string;
  parts: Array<{ type: string; text?: string }>;
  metadata?: ChatMessageMetadata;
}

export interface AgentTurnSummary {
  agentId: string;
  agentName: string;
  messageId: string;
  content?: string;
}

export interface WhiteboardActionRecord {
  actionId: string;
  actionName: string;
  params: Record<string, unknown>;
}

export interface DirectorState {
  turnCount: number;
  agentResponses: AgentTurnSummary[];
  whiteboardLedger: WhiteboardActionRecord[];
}

export interface AgentConfigEntry {
  id: string;
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  allowedActions: string[];
  priority: number;
  isGenerated?: boolean;
  boundStageId?: string;
}

export interface ThinkingConfig {
  enabled: boolean;
}

export interface StatelessChatRequest {
  messages: UIMessage[];
  storeState: {
    stage: Stage | null;
    scenes: Scene[];
    currentSceneId: string | null;
    mode: StageMode;
    whiteboardOpen: boolean;
  };
  config: {
    agentIds: string[];
    sessionType?: 'qa' | 'discussion';
    discussionTopic?: string;
    discussionPrompt?: string;
    triggerAgentId?: string;
    agentConfigs?: AgentConfigEntry[];
  };
  directorState?: DirectorState;
  userProfile?: { nickname?: string; bio?: string };
  apiKey: string;
  baseUrl?: string;
  model?: string;
  providerType?: string;
  thinking?: ThinkingConfig;
  thinkingConfig?: ThinkingConfig;
}

export type StatelessEvent =
  | {
      type: 'agent_start';
      data: {
        messageId: string;
        agentId: string;
        agentName: string;
        agentAvatar?: string;
        agentColor?: string;
      };
    }
  | { type: 'agent_end'; data: { messageId: string; agentId: string } }
  | { type: 'text_delta'; data: { content: string; messageId?: string } }
  | {
      type: 'action';
      data: {
        actionId: string;
        actionName: string;
        params: Record<string, unknown>;
        agentId: string;
        messageId?: string;
      };
    }
  | { type: 'thinking'; data: { stage: 'director' | 'agent_loading'; agentId?: string } }
  | { type: 'cue_user'; data: { fromAgentId?: string; prompt?: string } }
  | {
      type: 'done';
      data: {
        totalActions: number;
        totalAgents: number;
        agentHadContent?: boolean;
        directorState?: DirectorState;
      };
    }
  | { type: 'error'; data: { message: string } };

export type ApiResponse<T> =
  | ({ success: true } & T)
  | { success: false; errorCode: string; error: string; details?: string };
