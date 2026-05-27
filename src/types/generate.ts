// SPDX-License-Identifier: AGPL-3.0
/** POST /api/generate/* 请求与响应类型 */

/** 交互组件大纲（interactive 场景） */
export interface WidgetOutline {
  diagramType?: string;
  nodeCount?: number;
  description?: string;
  concept?: string;
  keyVariables?: string[];
  language?: string;
  challengeType?: string;
  challenge?: string;
  gameType?: string;
  playerControls?: string[];
  [key: string]: unknown;
}

/** 场景大纲（生成类接口） */
export interface GenerateSceneOutline {
  id: string;
  type: string;
  title: string;
  description?: string;
  keyPoints?: string[];
  order: number;
  widgetType?: string;
  widgetOutline?: WidgetOutline;
  estimatedMinutes?: number;
  languageNote?: string | null;
  quizConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 课程元信息 */
export interface GenerateStageInfo {
  name: string;
  description?: string;
  languageDirective?: string;
  style?: string;
  [key: string]: unknown;
}

/** 生成接口中的 Agent 配置 */
export interface GenerateSceneAgent {
  id: string;
  name: string;
  role: string;
  persona: string;
  avatar?: string;
  color?: string;
  allowedActions?: string[];
  priority?: number;
  [key: string]: unknown;
}

/** POST /api/generate/scene-content 请求体 */
export interface GenerateSceneContentParams {
  outline: GenerateSceneOutline;
  allOutlines: GenerateSceneOutline[];
  pdfImages?: unknown[];
  imageMapping?: Record<string, unknown>;
  stageInfo: GenerateStageInfo;
  stageId: string;
  agents?: GenerateSceneAgent[];
  languageDirective?: string;
}

/** 生成完成的场景（content 结构由 LLM 决定） */
export interface GeneratedScene {
  id: string;
  stageId?: string;
  type: string;
  title: string;
  order: number;
  content: Record<string, unknown>;
  actions?: unknown[];
  description?: string;
  index?: number;
  raw?: string;
  [key: string]: unknown;
}

/** POST /api/generate/scene-content 成功响应 data */
export interface GenerateSceneContentResult {
  scene: GeneratedScene;
  previousSpeeches?: unknown[];
}

/** 后端当前实际返回（与 GenerateSceneContentResult 尚未完全对齐） */
export interface GenerateSceneContentRawResult {
  success: true;
  content?: Record<string, unknown>;
  effectiveOutline?: GenerateSceneOutline;
  scene?: GeneratedScene;
  previousSpeeches?: unknown[];
}

/** LLM 相关请求头（与后端 generate 路由约定一致） */
export interface GenerateLlmHeadersOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}
