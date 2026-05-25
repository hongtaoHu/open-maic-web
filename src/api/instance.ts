// SPDX-License-Identifier: AGPL-3.0
/** 全局 HTTP 单例（供 models 引用，避免与 index 循环依赖） */

import { HttpClient } from '@/api/core/http';
import { globalErrorInterceptor } from '@/api/interceptors/error';
import { authRequestInterceptor, jsonContentTypeInterceptor } from '@/api/interceptors/request';
import { httpStatusResponseInterceptor } from '@/api/interceptors/response';

export const http = new HttpClient()
  .useRequest(authRequestInterceptor)
  .useRequest(jsonContentTypeInterceptor)
  .useResponse(httpStatusResponseInterceptor)
  .useError(globalErrorInterceptor);
