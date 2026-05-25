// SPDX-License-Identifier: AGPL-3.0
/**
 * API 统一入口
 *
 * - `http`：带请求 / 响应 / 错误拦截器的 HTTP 客户端
 * - `models/*`：按业务模块划分的接口定义
 * - 错误提示：`reportApiError` / `reportBusinessError`
 */

export { http } from '@/api/instance';

// —— 核心能力 ——

export { HttpClient, resolveApiUrl } from '@/api/core/http';
export {
  ApiHttpError,
  ApiNetworkError,
  ApiTimeoutError,
  assertOkResponse,
  getApiErrorMessage,
  isApiHttpError,
  isApiTimeoutError,
  isUserAbortError,
  wasApiErrorReported,
} from '@/api/core/errors';
export { reportApiError, reportBusinessError } from '@/api/core/notify';
export { readSseJsonStream } from '@/api/core/sse';
export type { HttpRequestConfig } from '@/api/core/types';
export type {
  ErrorInterceptor,
  RequestInterceptor,
  ResponseInterceptor,
} from '@/api/core/types';

// —— 业务模块 ——

export * from '@/api/models/agent';
export * from '@/api/models/chat';
export * from '@/api/models/classroom';
export * from '@/api/models/classroom-stream';
export * from '@/api/models/generate';
export * from '@/api/models/server';
