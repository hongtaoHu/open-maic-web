<script setup lang="ts">
import { hello, runClickMe } from './gotoTestHelpers';

function onClickMe() {
  runClickMe();
}
</script>

<template>
  <div class="goto-test">
    <!-- 测试 A：点 hello → 应跳到上方 import，再点 import 路径 → gotoTestHelpers.ts -->
    <p>{{ hello() }}</p>
    <!-- 测试 B：点 onClickMe → 应跳到 script 第 4 行 -->
    <button type="button" @click="onClickMe">点我验证跳转</button>
    <!-- 测试 C：点 runClickMe（若在 script 被调用）→ import → gotoTestHelpers.ts -->
  </div>
</template>

<style scoped>
.goto-test {
  padding: 1rem;
}
</style>
