// SPDX-License-Identifier: AGPL-3.0
import { assertOkResponse } from '@/api/core/errors';
import type { ResponseInterceptor } from '@/api/core/types';

/** HTTP 状态码非 2xx 时抛出 ApiHttpError */
export const httpStatusResponseInterceptor: ResponseInterceptor = async (response) => {
  await assertOkResponse(response);
  return response;
};
