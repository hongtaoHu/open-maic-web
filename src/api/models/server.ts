// SPDX-License-Identifier: AGPL-3.0
/** 服务元信息 — health、providers */

import { http } from '@/api/instance';
import type { ApiResponse } from '@/types/chat';

export interface ServerProvidersPayload {
  providers: Record<string, { models?: string[]; baseUrl?: string }>;
  tts: Record<string, unknown>;
  asr: Record<string, unknown>;
  pdf: Record<string, unknown>;
  image: Record<string, unknown>;
  video: Record<string, unknown>;
  webSearch: Record<string, unknown>;
}

export function fetchHealth(): Promise<
  ApiResponse<{ status: string; version: string }>
> {
  return http.get('/api/health');
}

export function fetchServerProviders(): Promise<ApiResponse<ServerProvidersPayload>> {
  return http.get('/api/server-providers');
}
