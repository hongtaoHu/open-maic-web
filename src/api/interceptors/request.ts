// SPDX-License-Identifier: AGPL-3.0
import type { HttpRequestConfig, RequestInterceptor } from '@/api/core/types';

/** POST/PUT/PATCH 默认 JSON Content-Type */
export const jsonContentTypeInterceptor: RequestInterceptor = (config) => {
  if (!config.body) return config;

  const headers = new Headers(config.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return { ...config, headers };
};

/** 可在此扩展鉴权头等，例如 Authorization */
export const authRequestInterceptor: RequestInterceptor = (config) => {
  // const token = ...
  // if (token) headers.set('Authorization', `Bearer ${token}`);
  return config;
};
