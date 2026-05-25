<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import userAvatar from '@/assets/avatars/user.png';
import {
  createClassroom,
  fetchAgentRolesDropdown,
  reportBusinessError,
} from '@/api';
import { buildAgentConfigs, saveClassroomStreamInput } from '@/utils/classroomStream';
import { OmButton, OmCard, OmIconButton, OmTextarea } from '@/components/ui';
import { useSettingsStore } from '@/stores/settings';
import { useStageStore } from '@/stores/stage';
import type { AgentRoleDropdownItem } from '@/types/agent';
import { systemPromptTransitionClasses } from '@/theme/animate-css';
import { resolveAgentAvatarUrl } from '@/utils/agentAvatar';

const systemPromptTransition = systemPromptTransitionClasses();

const router = useRouter();
const settings = useSettingsStore();
const stageStore = useStageStore();

const SYSTEM_PROMPT_STORAGE_KEY = 'openmaic.systemPrompt';

const systemPromptPlaceholder =
  '介绍一下自己，AI 老师会根据你的背景个性化教学...';

const topic = ref('用白板给我讲解傅里叶变换');
const systemPrompt = ref('我是一个初中生，我的成绩很差，我想学习数学');
const systemPromptOpen = ref(false);
const systemPromptPanelRef = ref<HTMLElement | null>(null);
const deepInteraction = ref(true);
const quotaUsed = ref(0);
const quotaMax = 10;
const agentRoles = ref<AgentRoleDropdownItem[]>([]);
const agentRolesError = ref<string | null>(null);
const starting = ref(false);

const headerAgents = computed(() => agentRoles.value.slice(0, 2));

function agentAvatarSrc(agent: AgentRoleDropdownItem) {
  return resolveAgentAvatarUrl(agent.id);
}

function agentAvatarStyle(agent: AgentRoleDropdownItem) {
  if (!agent.color) return undefined;
  return { boxShadow: `0 0 0 2px var(--om-card), 0 0 0 4px ${agent.color}` };
}

function toggleSystemPrompt(event: MouseEvent) {
  event.stopPropagation();
  systemPromptOpen.value = !systemPromptOpen.value;
}

function persistSystemPrompt() {
  const bio = systemPrompt.value.trim();
  if (bio) localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, bio);
  else localStorage.removeItem(SYSTEM_PROMPT_STORAGE_KEY);
}

function onDocumentClick(event: MouseEvent) {
  if (!systemPromptOpen.value || !systemPromptPanelRef.value) return;
  if (!systemPromptPanelRef.value.contains(event.target as Node)) {
    systemPromptOpen.value = false;
  }
}

const examplePrompts = 
` 输入你想学的任何内容，例如：
  1. 从零学 Python，30 分钟写出第一个程序
  2. 用白板给我讲解傅里叶变换
  3. 阿瓦隆桌游怎么玩
`;

async function loadAgentRoles() {
  agentRolesError.value = null;
  const res = await fetchAgentRolesDropdown();
  if (res.success) {
    agentRoles.value = res.agents;
    return;
  }
  agentRolesError.value = res.error;
}

onMounted(async () => {
  const saved = localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY);
  if (saved) systemPrompt.value = saved;
  document.addEventListener('click', onDocumentClick);
  await Promise.all([settings.loadServerMeta(), loadAgentRoles()]);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
});

async function startClassroom() {
  if (starting.value || !topic.value.trim() || quotaUsed.value >= quotaMax) return;

  starting.value = true;
  try {
    stageStore.createDemoStage(topic.value.trim());
    if (stageStore.stage) {
      const bio = systemPrompt.value.trim();
      if (bio) {
        stageStore.stage.description = bio;
        localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, bio);
      }
      // await db.classrooms.put({
      //   id: stageStore.stage.id,
      //   stage: stageStore.stage,
      //   scenes: stageStore.scenes,
      //   updatedAt: Date.now(),
      // });
      // quotaUsed.value = Math.min(quotaUsed.value + 1, quotaMax);
      if (agentRoles.value.length) {
        stageStore.stage.agentIds = agentRoles.value.map((a) => a.id);
      } else {
        await loadAgentRoles();
        if (agentRoles.value.length) {
          stageStore.stage.agentIds = agentRoles.value.map((a) => a.id);
        }
      }
    }
    const agentTeacherId = 'default-1';
    const selectAgentIds = [
      'default-2',
      'default-3',
      'default-4',
      'default-5',
      'default-6',
    ];

    const agentConfigs = await buildAgentConfigs(agentTeacherId, selectAgentIds);

    const res = await createClassroom({
      agentTeacherId,
      selectAgentIds,
      webSearch: false,
      askAgentId: '1',
      systemPrompt: systemPrompt.value.trim(),
      userQuestion: topic.value.trim(),
    });
    if (res.success && res.id) {
      saveClassroomStreamInput({
        classroomId: res.id,
        systemPrompt: systemPrompt.value.trim(),
        userQuestion: topic.value.trim(),
        agentTeacherId,
        selectAgentIds,
        webSearch: false,
        agentConfigs,
      });
      router.push({
        name: 'generation-preview',
        query: { id: res.id },
      });
      return;
    }
    reportBusinessError(res.error || '创建课堂失败，请稍后重试');
  } catch {
    // HTTP / 网络 / 超时已由全局 notify 处理
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <div class="om-page-bg min-h-screen flex flex-col items-center px-4 py-10 sm:py-14">
    <header class="w-full max-w-3xl text-center mb-8 sm:mb-10">
      <div class="om-logo-gradient inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4">
        <SvgIcon name="logo-hexagon" :size="32" class="text-white" />
      </div>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-om-fg-accent">互动课堂</h1>
      <p class="mt-2 text-sm sm:text-base text-om-fg-secondary max-w-md mx-auto">
        多智能体交互课堂中的生成式学习
      </p>
    </header>

    <OmCard class="w-full max-w-3xl">
      <template #header>
        <div
          class="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-2"
        >
          <div ref="systemPromptPanelRef" class="shrink-0 relative" @click.stop>
            <OmButton
              v-if="!systemPromptOpen"
              variant="subtle"
              size="sm"
              :pill="false"
              class="h-8 px-1 gap-2.5 rounded-xl"
              aria-expanded="false"
              aria-controls="system-prompt-panel"
              @click="toggleSystemPrompt"
            >
              <img
                :src="userAvatar"
                alt=""
                class="w-7 h-7 rounded-full object-cover"
                :style="{ boxShadow: '0 0 0 2px var(--om-ring-avatar)' }"
              />
              <span class="font-medium">嗨，同学</span>
              <SvgIcon name="chevron-down" :size="12" class="text-om-fg-muted" />
            </OmButton>

            <Transition
              :enter-active-class="systemPromptTransition.enterActiveClass"
              :leave-active-class="systemPromptTransition.leaveActiveClass"
            >
              <div
                v-if="systemPromptOpen"
                id="system-prompt-panel"
                class="w-[min(calc(100vw-3rem),20rem)] absolute top-0 left-0 z-10 rounded-2xl border border-om-border-panel bg-om-panel p-3 text-om-fg-on-panel sm:w-80"
                :style="{ boxShadow: 'var(--om-shadow-panel)' }"
                role="region"
                aria-label="系统提示词"
              >
                <OmButton
                  variant="subtle"
                  :pill="false"
                  class="mb-3 w-full justify-start gap-2.5 rounded-lg px-0 hover:bg-transparent"
                  aria-expanded="true"
                  @click="toggleSystemPrompt"
                >
                  <img
                    :src="userAvatar"
                    alt=""
                    class="w-9 h-9 rounded-full object-cover shrink-0"
                    :style="{ boxShadow: '0 0 0 2px var(--om-ring-panel)' }"
                  />
                  <span class="flex-1 text-sm font-medium text-left">同学</span>
                  <SvgIcon name="chevron-up" :size="12" class="text-om-fg-panel-muted" />
                </OmButton>
                <OmTextarea
                  v-model="systemPrompt"
                  variant="panel"
                  :rows="4"
                  :placeholder="systemPromptPlaceholder"
                  @click.stop
                  @keydown.stop
                  @blur="persistSystemPrompt"
                />
              </div>
            </Transition>
          </div>

          <div class="flex items-center gap-2 sm:gap-3 flex-1 justify-end min-w-0 pt-0.5">
            <p
              class="hidden sm:block text-xs text-om-fg-secondary bg-om-chip border border-om-border rounded-full px-3 py-1.5 shadow-sm truncate max-w-[200px]"
            >
              准备好一起学习了吗？
            </p>
            <div class="flex -space-x-2" :title="agentRolesError ?? undefined">
              <template v-if="headerAgents.length">
                <img
                  v-for="agent in headerAgents"
                  :key="agent.id"
                  :src="agentAvatarSrc(agent)"
                  :alt="agent.name"
                  class="w-7 h-7 rounded-full object-cover border-2 border-om-card bg-om-chip"
                  :style="agentAvatarStyle(agent)"
                />
              </template>
              <template v-else>
                <span
                  class="w-7 h-7 rounded-full bg-sky-200 border-2 border-om-card flex items-center justify-center text-[10px]"
                  >👨</span
                >
                <span
                  class="w-7 h-7 rounded-full bg-pink-200 border-2 border-om-card flex items-center justify-center text-[10px]"
                  >👩</span
                >
              </template>
            </div>
          </div>
        </div>
      </template>

      <div class="px-2 sm:px-6 pt-1 min-h-[200px] sm:min-h-[260px]">
        <OmTextarea
          v-model="topic"
          variant="inline"
          :placeholder="examplePrompts"
          :disabled="starting"
        />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-5 py-2">
        <div class="flex items-center gap-2 text-om-fg-muted">
          <OmIconButton label="添加附件">
            <SvgIcon name="attach" :size="20" />
          </OmIconButton>
          <OmIconButton label="联网搜索">
            <SvgIcon name="globe" :size="20" />
          </OmIconButton>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <OmButton
            variant="chip"
            size="sm"
            :active="deepInteraction"
            @click="deepInteraction = !deepInteraction"
          >
            <SvgIcon name="sparkles" :size="16" />
            深度交互
          </OmButton>
          <OmIconButton label="语音输入">
            <SvgIcon name="microphone" :size="18" />
          </OmIconButton>
          <OmButton
            variant="primary"
            size="sm"
            :disabled="starting || quotaUsed >= quotaMax || !topic.trim()"
            class="pl-4 pr-3"
            @click="startClassroom"
          >
            {{ starting ? '创建中…' : '进入课堂' }}
            <span
              class="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs group-disabled:bg-black/5 group-disabled:text-om-fg-inactive"
            >
              <SvgIcon name="arrow-up" :size="12" />
              {{ quotaMax - quotaUsed }}/{{ quotaMax }}
            </span>
          </OmButton>
        </div>
      </div>
    </OmCard>
  </div>
</template>

<style scoped>
#system-prompt-panel {
  transform-origin: top left;
}
</style>
