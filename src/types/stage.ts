// SPDX-License-Identifier: AGPL-3.0
/**
 * Stage and scene types (ported from lib/types/stage.ts — MVP subset).
 */

export type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl';
export type StageMode = 'autonomous' | 'playback';

export interface Stage {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  languageDirective?: string;
  style?: string;
  agentIds?: string[];
  interactiveMode?: boolean;
}

export interface Scene {
  id: string;
  stageId: string;
  type: SceneType;
  title: string;
  order: number;
  content: Record<string, unknown>;
  actions?: Record<string, unknown>[];
}

export interface UserRequirements {
  requirement: string;
  userNickname?: string;
  userBio?: string;
  webSearch?: boolean;
  interactiveMode?: boolean;
}

export interface SceneOutline {
  id?: string;
  title: string;
  type: SceneType;
  summary?: string;
  order: number;
}
