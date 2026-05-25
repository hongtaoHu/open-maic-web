// SPDX-License-Identifier: AGPL-3.0
import { API_TIMEOUT_MESSAGE } from '@/constants/api';
import {
  API_NETWORK_ERROR_MESSAGE,
  getHttpErrorMessage,
} from '@/constants/http-errors';

const REPORTED = Symbol('apiErrorReported');

export class ApiTimeoutError extends Error {
  constructor(message = API_TIMEOUT_MESSAGE) {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export class ApiNetworkError extends Error {
  constructor(message = API_NETWORK_ERROR_MESSAGE) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.body = body;
  }

  static async fromResponse(res: Response): Promise<ApiHttpError> {
    const body = await res.json().catch(() => ({}));
    const serverMessage =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : undefined;
    return new ApiHttpError(
      res.status,
      getHttpErrorMessage(res.status, serverMessage),
      body,
    );
  }
}

export function isApiTimeoutError(error: unknown): boolean {
  if (error instanceof ApiTimeoutError) return true;
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  return error instanceof Error && error.name === 'TimeoutError';
}

export function isApiHttpError(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError;
}

export function isUserAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function wasApiErrorReported(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as Record<symbol, boolean>)[REPORTED] === true
  );
}

export function markApiErrorReported(error: unknown): void {
  if (typeof error === 'object' && error !== null) {
    Object.defineProperty(error, REPORTED, { value: true, enumerable: false });
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (isApiTimeoutError(error)) return API_TIMEOUT_MESSAGE;
  if (error instanceof ApiNetworkError) return error.message;
  if (error instanceof ApiHttpError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export async function assertOkResponse(res: Response): Promise<void> {
  if (res.ok) return;
  throw await ApiHttpError.fromResponse(res);
}
