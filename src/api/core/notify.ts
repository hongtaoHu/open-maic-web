// SPDX-License-Identifier: AGPL-3.0
import { getApiErrorMessage, markApiErrorReported, wasApiErrorReported } from '@/api/core/errors';
import { useNotifyStore } from '@/stores/notify';

/** 全局弹出 API / 网络异常提示（同一错误只提示一次） */
export function reportApiError(error: unknown): void {
  if (wasApiErrorReported(error)) return;
  markApiErrorReported(error);
  useNotifyStore().show(getApiErrorMessage(error));
}

/** 业务层返回 success: false 等可预期失败 */
export function reportBusinessError(message: string): void {
  useNotifyStore().show(message);
}
