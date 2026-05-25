// SPDX-License-Identifier: AGPL-3.0
import { defineStore } from 'pinia';
import { ref } from 'vue';

import {
  fetchHealth,
  fetchServerProviders,
  reportBusinessError,
} from '@/api';

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref('');
  const baseUrl = ref('');
  const model = ref('');
  const healthStatus = ref<string | null>(null);
  const providerIds = ref<string[]>([]);
  const loading = ref(false);

  async function loadServerMeta() {
    loading.value = true;

    try {
      const [healthResult, providersResult] = await Promise.allSettled([
        fetchHealth(),
        fetchServerProviders(),
      ]);

      if (healthResult.status === 'fulfilled') {
        if (healthResult.value.success) {
          healthStatus.value = healthResult.value.status;
        } else {
          reportBusinessError(healthResult.value.error || '服务健康检查失败');
        }
      }

      if (providersResult.status === 'fulfilled') {
        if (providersResult.value.success) {
          providerIds.value = Object.keys(providersResult.value.providers);
        } else {
          reportBusinessError(providersResult.value.error || '获取模型提供商失败');
        }
      }
    } finally {
      loading.value = false;
    }
  }

  return {
    apiKey,
    baseUrl,
    model,
    healthStatus,
    providerIds,
    loading,
    loadServerMeta,
  };
});
