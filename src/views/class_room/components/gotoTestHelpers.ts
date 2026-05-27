// SPDX-License-Identifier: AGPL-3.0
/** 供 GotoTest.vue 验证：模板 → import → 本文件 的跳转链路 */

export function hello(): string {
  return 'hi';
}

export function runClickMe(): void {
  hello();
}
