// SPDX-License-Identifier: AGPL-3.0
import { API_TIMEOUT_MS } from '@/constants/api';
import {
  ApiNetworkError,
  ApiTimeoutError,
  isApiTimeoutError,
  isUserAbortError,
  wasApiErrorReported,
} from '@/api/core/errors';
import type {
  ErrorInterceptor,
  HttpRequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from '@/api/core/types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function resolveApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (base.endsWith('/api') && normalized.startsWith('/api/')) {
    normalized = normalized.slice(4);
  }
  return `${base}${normalized}`;
}

function mergeAbortSignals(
  userSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      userSignal.addEventListener('abort', onUserAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      userSignal?.removeEventListener('abort', onUserAbort);
    },
    didTimeout: () => timedOut,
  };
}

function normalizeFetchError(
  error: unknown,
  didTimeout: () => boolean,
  userSignal?: AbortSignal,
): unknown {
  if (userSignal?.aborted || isUserAbortError(error)) {
    return error;
  }
  if (didTimeout() || isApiTimeoutError(error)) {
    return error instanceof ApiTimeoutError ? error : new ApiTimeoutError();
  }
  if (error instanceof TypeError) {
    return new ApiNetworkError();
  }
  return error;
}

/**
 * 企业级 HTTP 客户端：请求 / 响应 / 错误拦截器链。
 * 业务接口请放在 `api/models/*`，通过本实例发起请求。
 */
export class HttpClient {
  private readonly requestInterceptors: RequestInterceptor[] = [];
  private readonly responseInterceptors: ResponseInterceptor[] = [];
  private readonly errorInterceptors: ErrorInterceptor[] = [];

  useRequest(interceptor: RequestInterceptor): this {
    this.requestInterceptors.push(interceptor);
    return this;
  }

  useResponse(interceptor: ResponseInterceptor): this {
    this.responseInterceptors.push(interceptor);
    return this;
  }

  useError(interceptor: ErrorInterceptor): this {
    this.errorInterceptors.push(interceptor);
    return this;
  }

  private async runRequestInterceptors(
    config: HttpRequestConfig,
  ): Promise<HttpRequestConfig> {
    let current = config;
    for (const interceptor of this.requestInterceptors) {
      current = await interceptor(current);
    }
    return current;
  }

  private async runResponseInterceptors(
    response: Response,
    config: HttpRequestConfig,
  ): Promise<Response> {
    let current = response;
    for (const interceptor of this.responseInterceptors) {
      current = await interceptor(current, config);
    }
    return current;
  }

  private async runErrorInterceptors(
    error: unknown,
    config: HttpRequestConfig,
  ): Promise<void> {
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error, config);
    }
  }

  /** 底层 fetch：应用请求拦截器与超时，不解析 JSON */
  async fetch(config: HttpRequestConfig): Promise<Response> {
    const merged: HttpRequestConfig = {
      method: 'GET',
      timeout: API_TIMEOUT_MS,
      ...config,
    };
    const finalConfig = await this.runRequestInterceptors(merged);
    const timeout = finalConfig.timeout ?? API_TIMEOUT_MS;
    const { signal, cleanup, didTimeout } = mergeAbortSignals(
      finalConfig.signal,
      timeout,
    );

    try {
      const response = await fetch(resolveApiUrl(finalConfig.url), {
        method: finalConfig.method,
        headers: finalConfig.headers,
        body: finalConfig.body,
        signal,
      });
      return await this.runResponseInterceptors(response, finalConfig);
    } catch (error) {
      const thrown = normalizeFetchError(error, didTimeout, finalConfig.signal);
      if (!wasApiErrorReported(thrown)) {
        await this.runErrorInterceptors(thrown, finalConfig);
      }
      throw thrown;
    } finally {
      cleanup();
    }
  }

  /** JSON API：解析响应体（OpenMAIC 信封） */
  async request<T extends object>(
    config: HttpRequestConfig,
  ): Promise<T> {
    const response = await this.fetch(config);
    return (await response.json()) as T;
  }

  get<T extends object>(path: string, config?: Omit<HttpRequestConfig, 'url' | 'method'>) {
    return this.request<T>({ ...config, url: path, method: 'GET' });
  }

  post<T extends object>(
    path: string,
    body: unknown,
    config?: Omit<HttpRequestConfig, 'url' | 'method' | 'body'>,
  ) {
    return this.request<T>({
      ...config,
      url: path,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** 仅等待响应头（SSE 等长连接后续自行读 body） */
  fetchUntilResponse(config: HttpRequestConfig): Promise<Response> {
    return this.fetch(config);
  }
}
