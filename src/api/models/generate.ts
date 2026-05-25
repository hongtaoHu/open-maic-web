// SPDX-License-Identifier: AGPL-3.0
/** 内容生成 — /api/generate */

import { http } from '@/api/instance';
import type { ApiResponse } from '@/types/chat';
import type {
  GenerateLlmHeadersOptions,
  GenerateSceneContentParams,
  GenerateSceneContentResult,
} from '@/types/generate';

const PREFIX = '/api/generate';

function buildLlmHeaders(options?: GenerateLlmHeadersOptions): HeadersInit | undefined {
  if (!options?.apiKey && !options?.baseUrl && !options?.model) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  if (options.apiKey) headers['x-api-key'] = options.apiKey;
  if (options.baseUrl) headers['x-base-url'] = options.baseUrl;
  if (options.model) headers['x-model'] = options.model;
  return headers;
}

/**
 * 生成单个场景的课件内容
 * POST /api/generate/scene-content
 */
export function generateSceneContent(
  body: GenerateSceneContentParams,
  llm?: GenerateLlmHeadersOptions,
): Promise<ApiResponse<GenerateSceneContentResult>> {
  return http.post(`${PREFIX}/scene-content`, body, {
    headers: buildLlmHeaders(llm),
  }) as Promise<ApiResponse<GenerateSceneContentResult>>;
}

export type {
  GenerateLlmHeadersOptions,
  GenerateSceneContentParams,
  GenerateSceneContentResult,
  GeneratedScene,
  GenerateSceneAgent,
  GenerateSceneOutline,
  GenerateStageInfo,
  WidgetOutline,
} from '@/types/generate';
