// SPDX-License-Identifier: AGPL-3.0

export interface HttpRequestConfig {
  /** 路径（如 `/api/health`）或完整 URL */
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
  /** 整次请求超时（毫秒），默认见 API_TIMEOUT_MS */
  timeout?: number;
  /** 为 true 时不弹出全局错误 Toast */
  silent?: boolean;
}

export type RequestInterceptor = (
  config: HttpRequestConfig,
) => HttpRequestConfig | Promise<HttpRequestConfig>;

export type ResponseInterceptor = (
  response: Response,
  config: HttpRequestConfig,
) => Response | Promise<Response>;

export type ErrorInterceptor = (
  error: unknown,
  config: HttpRequestConfig,
) => void | Promise<void>;
