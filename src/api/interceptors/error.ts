// SPDX-License-Identifier: AGPL-3.0
import { isUserAbortError, wasApiErrorReported } from '@/api/core/errors';
import { reportApiError } from '@/api/core/notify';
import type { ErrorInterceptor } from '@/api/core/types';

/** 全局错误 Toast（用户主动取消、已提示过的错误除外） */
export const globalErrorInterceptor: ErrorInterceptor = (error, config) => {
  if (config.silent || isUserAbortError(error) || wasApiErrorReported(error)) {
    return;
  }
  reportApiError(error);
};
