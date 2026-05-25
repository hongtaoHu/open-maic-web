// SPDX-License-Identifier: AGPL-3.0
/** HTTP 状态码 → 用户可读提示 */

export const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数有误，请检查后重试',
  401: '未登录或登录已过期，请重新登录',
  403: '没有权限访问该资源',
  404: '请求的资源不存在',
  405: '请求方法不允许',
  408: '请求超时，请稍后重试',
  409: '资源冲突，请刷新后重试',
  413: '请求内容过大',
  422: '提交的数据无法处理',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '网关错误，服务暂时不可用',
  503: '服务暂时不可用，请稍后重试',
  504: '网关超时，请稍后重试',
};

export const HTTP_ERROR_FALLBACK = '请求失败，请稍后重试';

export const API_NETWORK_ERROR_MESSAGE = '网络连接失败，请检查网络或确认服务已启动';

export function getHttpErrorMessage(status: number, serverMessage?: string): string {
  const mapped = HTTP_ERROR_MESSAGES[status];
  if (mapped) return mapped;
  if (serverMessage?.trim()) return serverMessage.trim();
  if (status >= 500) return HTTP_ERROR_MESSAGES[500] ?? HTTP_ERROR_FALLBACK;
  if (status >= 400) return HTTP_ERROR_FALLBACK;
  return HTTP_ERROR_FALLBACK;
}
