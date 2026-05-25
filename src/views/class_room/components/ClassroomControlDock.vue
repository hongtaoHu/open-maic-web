<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import userAvatar from '@/assets/avatars/user.svg';
import {
  fetchTtsVoices,
  getApiErrorMessage,
  reportBusinessError,
} from '@/api';
import { OmButton, OmIconButton } from '@/components/ui';
import type { AgentRoleConfig } from '@/types/classroom-stream';
import type { TtsVoiceItem } from '@/types/tts';
import { resolveAgentAvatarUrl } from '@/utils/agentAvatar';
import {
  countSceneTtsSegments,
  isSceneTtsPrefetching,
  loadSceneTtsPlaybackBlobs,
} from '@/utils/sceneTtsCache';
import {
  isTtsPlaying,
  playTtsBlobSequence,
  stopTtsPlayback,
} from '@/utils/ttsPlayback';
import {
  formatTtsVoiceLabel,
  loadTtsVoicePreference,
  saveTtsVoicePreference,
} from '@/utils/ttsVoiceStorage';

/** 当前可顺序播放的讲解要点（与侧边栏选中场景的 keyPoints 同步） */
const playableKeyPoints = defineModel<string[]>('playableKeyPoints', {
  default: () => [],
});

const props = defineProps<{
  classroomId?: string;
  sceneId?: string;
  sceneIndex: number;
  sceneTotal: number;
  canPrevScene: boolean;
  canNextScene: boolean;
  streaming?: boolean;
  assistantText?: string;
  speechFallback?: string;
  teacher?: AgentRoleConfig | null;
  participants?: AgentRoleConfig[];
}>();

const chatInput = defineModel<string>('chatInput', { default: '' });
/** 当前选中的 TTS 音色 shortName（与 localStorage 同步） */
const ttsVoice = defineModel<string>('ttsVoice', { default: '' });

const emit = defineEmits<{
  submit: [];
  prevScene: [];
  nextScene: [];
}>();

const chatOpen = ref(false);
const playbackSpeed = ref('1x');

const voicePanelRef = ref<HTMLElement | null>(null);
const voicePanelEl = ref<HTMLElement | null>(null);
const voicePanelOpen = ref(false);
const voicePanelStyle = ref<Record<string, string>>({});
const voicesLoading = ref(false);
const voicesError = ref<string | null>(null);
const voices = ref<TtsVoiceItem[]>([]);
const voiceQuery = ref('zh-CN');
const selectedVoice = ref<TtsVoiceItem | null>(null);
const draftVoiceShortName = ref('');

const ttsLoading = ref(false);
const ttsPlaying = ref(false);
const ttsSegmentIndex = ref<number | null>(null);
const cachedSegmentCount = ref(0);
const ttsPrefetching = ref(false);

const keyPointSegments = computed(() =>
  playableKeyPoints.value.map((point) => point.trim()).filter(Boolean),
);

const speechText = computed(() => {
  if (ttsSegmentIndex.value != null) {
    const point = keyPointSegments.value[ttsSegmentIndex.value];
    if (point) return point;
  }
  const first = keyPointSegments.value[0];
  if (first) return first;
  return (
    props.assistantText?.trim() ||
    props.speechFallback?.trim() ||
    '准备好一起学习了吗？'
  );
});

const speechPlayPending = computed(
  () =>
    Boolean(props.classroomId && props.sceneId) &&
    keyPointSegments.value.length > 0 &&
    (ttsPrefetching.value || cachedSegmentCount.value < keyPointSegments.value.length),
);

const teacherName = computed(() => props.teacher?.name ?? '老师');
const teacherAvatar = computed(() =>
  props.teacher
    ? resolveAgentAvatarUrl(props.teacher.id, props.teacher.avatar)
    : resolveAgentAvatarUrl('default-1'),
);

const participantList = computed(() => (props.participants ?? []).slice(0, 3));

const selectedVoiceLabel = computed(() =>
  formatTtsVoiceLabel(selectedVoice.value ?? loadTtsVoicePreference(), '音色'),
);

const filteredVoices = computed(() => {
  const q = voiceQuery.value.trim().toLowerCase();
  if (!q) return voices.value;
  return voices.value.filter(
    (voice) =>
      voice.shortName.toLowerCase().includes(q) ||
      voice.locale.toLowerCase().includes(q) ||
      voice.name.toLowerCase().includes(q) ||
      voice.gender.toLowerCase().includes(q),
  );
});

function participantAvatar(agent: AgentRoleConfig) {
  return resolveAgentAvatarUrl(agent.id, agent.avatar);
}

function participantRingStyle(agent: AgentRoleConfig) {
  if (!agent.color) return undefined;
  return {
    boxShadow: `0 0 0 2px var(--om-ring-avatar), 0 0 0 3px color-mix(in oklab, ${agent.color} 55%, transparent)`,
  };
}

function applyVoice(voice: TtsVoiceItem, closePanel = true) {
  selectedVoice.value = voice;
  draftVoiceShortName.value = voice.shortName;
  ttsVoice.value = voice.shortName;
  saveTtsVoicePreference(voice);
  if (closePanel) voicePanelOpen.value = false;
}

function resolveVoiceByShortName(shortName: string): TtsVoiceItem | undefined {
  return voices.value.find((voice) => voice.shortName === shortName);
}

async function loadVoices() {
  if (voicesLoading.value) return;
  voicesLoading.value = true;
  voicesError.value = null;
  try {
    const res = await fetchTtsVoices();
    if (!res.success) {
      voicesError.value = res.error || '获取音色列表失败';
      return;
    }
    voices.value = res.items ?? [];

    const saved = loadTtsVoicePreference();
    const savedShortName = saved?.shortName ?? ttsVoice.value;
    const matched = savedShortName ? resolveVoiceByShortName(savedShortName) : undefined;
    const fallback =
      matched ??
      voices.value.find((voice) => voice.locale.startsWith('zh-CN')) ??
      voices.value[0];

    if (fallback) {
      applyVoice(fallback, false);
    }
  } catch (error) {
    voicesError.value = getApiErrorMessage(error);
  } finally {
    voicesLoading.value = false;
  }
}

function updateVoicePanelPosition() {
  const anchor = voicePanelRef.value;
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const panelWidth = Math.min(window.innerWidth - 32, 288);
  const left = Math.min(
    Math.max(16, rect.left),
    window.innerWidth - panelWidth - 16,
  );
  voicePanelStyle.value = {
    top: `${Math.max(16, rect.top - 8)}px`,
    left: `${left}px`,
    width: `${panelWidth}px`,
    transform: 'translateY(-100%)',
  };
}

async function toggleVoicePanel() {
  voicePanelOpen.value = !voicePanelOpen.value;
  if (voicePanelOpen.value) {
    draftVoiceShortName.value =
      ttsVoice.value || selectedVoice.value?.shortName || draftVoiceShortName.value;
    if (!voices.value.length && !voicesLoading.value) {
      void loadVoices();
    }
    await nextTick();
    updateVoicePanelPosition();
  }
}

function onVoicePanelViewportChange() {
  if (voicePanelOpen.value) updateVoicePanelPosition();
}

function onVoicePanelSelect(shortName: string) {
  draftVoiceShortName.value = shortName;
}

function confirmVoiceSelection() {
  const voice = resolveVoiceByShortName(draftVoiceShortName.value);
  if (voice) {
    applyVoice(voice, true);
    return;
  }
  voicePanelOpen.value = false;
}

function onDocumentPointerDown(event: MouseEvent) {
  if (!voicePanelOpen.value) return;
  const target = event.target as Node;
  if (voicePanelRef.value?.contains(target)) return;
  if (voicePanelEl.value?.contains(target)) return;
  voicePanelOpen.value = false;
}

function onSubmit() {
  if (!chatInput.value.trim() || props.streaming) return;
  emit('submit');
  chatOpen.value = false;
}

function toggleChat() {
  chatOpen.value = !chatOpen.value;
}

async function refreshSceneTtsCache() {
  const classroomId = props.classroomId;
  const sceneId = props.sceneId;
  if (!classroomId || !sceneId) {
    cachedSegmentCount.value = 0;
    ttsPrefetching.value = false;
    return;
  }

  ttsPrefetching.value = isSceneTtsPrefetching(classroomId, sceneId);
  cachedSegmentCount.value = await countSceneTtsSegments(classroomId, sceneId);
  ttsPrefetching.value = isSceneTtsPrefetching(classroomId, sceneId);
}

async function playSpeech() {
  if (isTtsPlaying() || ttsPlaying.value) {
    stopTtsPlayback();
    ttsPlaying.value = false;
    ttsSegmentIndex.value = null;
    return;
  }

  if (ttsLoading.value) return;

  const classroomId = props.classroomId;
  const sceneId = props.sceneId;
  if (!classroomId || !sceneId) {
    reportBusinessError('无法定位当前场景');
    return;
  }

  if (!keyPointSegments.value.length) {
    reportBusinessError('当前场景暂无讲解要点');
    return;
  }

  ttsLoading.value = true;
  try {
    await refreshSceneTtsCache();

    if (speechPlayPending.value) {
      reportBusinessError('讲解语音正在写入本地缓存，请稍候');
      return;
    }

    const orderedBlobs = await loadSceneTtsPlaybackBlobs(
      classroomId,
      sceneId,
      keyPointSegments.value.length,
    );
    if (!orderedBlobs?.length) {
      reportBusinessError('本地暂无讲解语音，请等待场景生成完成');
      return;
    }

    ttsPlaying.value = true;
    await playTtsBlobSequence(orderedBlobs, {
      onSegmentStart: (index) => {
        ttsSegmentIndex.value = index;
      },
    });
  } catch (error) {
    reportBusinessError(getApiErrorMessage(error));
  } finally {
    ttsLoading.value = false;
    ttsPlaying.value = isTtsPlaying();
    if (!ttsPlaying.value) {
      ttsSegmentIndex.value = null;
    }
    void refreshSceneTtsCache();
  }
}

watch(
  () => [props.classroomId, props.sceneId, playableKeyPoints.value] as const,
  () => {
    stopTtsPlayback();
    ttsPlaying.value = false;
    ttsSegmentIndex.value = null;
    void refreshSceneTtsCache();
  },
  { immediate: true, deep: true },
);

let ttsCachePollTimer: ReturnType<typeof setInterval> | null = null;

function startTtsCachePoll() {
  if (ttsCachePollTimer) return;
  ttsCachePollTimer = setInterval(() => {
    if (speechPlayPending.value) {
      void refreshSceneTtsCache();
    } else if (ttsCachePollTimer) {
      clearInterval(ttsCachePollTimer);
      ttsCachePollTimer = null;
    }
  }, 1200);
}

watch(speechPlayPending, (pending) => {
  if (pending) startTtsCachePoll();
});

function onPlayClick() {
  if (chatOpen.value) {
    onSubmit();
    return;
  }
  void playSpeech();
}

onMounted(() => {
  const saved = loadTtsVoicePreference();
  if (saved?.shortName) {
    ttsVoice.value = saved.shortName;
    draftVoiceShortName.value = saved.shortName;
    selectedVoice.value = {
      shortName: saved.shortName,
      name: saved.name ?? saved.shortName,
      locale: saved.locale ?? '',
      gender: saved.gender ?? '',
    };
  }
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', onVoicePanelViewportChange);
  window.addEventListener('scroll', onVoicePanelViewportChange, true);
  void loadVoices();
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  window.removeEventListener('resize', onVoicePanelViewportChange);
  window.removeEventListener('scroll', onVoicePanelViewportChange, true);
  if (ttsCachePollTimer) {
    clearInterval(ttsCachePollTimer);
    ttsCachePollTimer = null;
  }
  stopTtsPlayback();
});
</script>

<template>
  <div class="classroom-dock">
    <div class="classroom-dock__toolbar">
      <div class="classroom-dock__toolbar-left">
        <span class="classroom-dock__scene-badge" aria-hidden="true">
          <SvgIcon name="list-lines" :size="18" class="classroom-dock__icon" />
        </span>
        <span class="classroom-dock__scene-count">
          {{ sceneIndex }} / {{ sceneTotal }}
        </span>
      </div>
      <div
        ref="voicePanelRef"
        class="classroom-dock__toolbar-voice"
        @click.stop
      >
        <button
          type="button"
          class="classroom-dock__voice-trigger"
          :class="{ 'classroom-dock__voice-trigger--active': voicePanelOpen }"
          aria-haspopup="dialog"
          :aria-expanded="voicePanelOpen"
          aria-controls="classroom-dock-voice-panel"
          @click="toggleVoicePanel"
        >
          <SvgIcon name="volume" :size="16" class="classroom-dock__icon" />
          <span class="classroom-dock__voice-label">{{ selectedVoiceLabel }}</span>
          <SvgIcon
            name="chevron-down"
            :size="12"
            class="classroom-dock__voice-chevron"
            :class="{ 'classroom-dock__voice-chevron--open': voicePanelOpen }"
          />
        </button>
      </div>

      <Teleport to="body">
        <Transition name="classroom-dock-voice">
          <div
            v-if="voicePanelOpen"
            id="classroom-dock-voice-panel"
            ref="voicePanelEl"
            class="classroom-dock__voice-panel classroom-dock__voice-panel--teleport"
            :style="voicePanelStyle"
            role="dialog"
            aria-label="配置 TTS 音色"
            @click.stop
          >
            <header class="classroom-dock__voice-panel-head">
              <h3 class="classroom-dock__voice-panel-title">讲解音色</h3>
              <p class="classroom-dock__voice-panel-hint">选择后将保存到本浏览器</p>
            </header>

            <label class="classroom-dock__voice-search">
              <span class="sr-only">搜索音色</span>
              <input
                v-model="voiceQuery"
                type="search"
                class="classroom-dock__voice-search-input"
                placeholder="搜索语言或音色名称…"
              />
            </label>

            <p v-if="voicesLoading" class="classroom-dock__voice-status">正在加载音色…</p>
            <p
              v-else-if="voicesError"
              class="classroom-dock__voice-status classroom-dock__voice-status--error"
              role="alert"
            >
              {{ voicesError }}
            </p>
            <p
              v-else-if="!filteredVoices.length"
              class="classroom-dock__voice-status"
            >
              无匹配音色
            </p>

            <ul
              v-else
              class="classroom-dock__voice-list om-scrollbar-hidden"
              role="listbox"
              aria-label="音色列表"
            >
              <li
                v-for="voice in filteredVoices"
                :key="voice.shortName"
                role="option"
                :aria-selected="draftVoiceShortName === voice.shortName"
              >
                <button
                  type="button"
                  class="classroom-dock__voice-option"
                  :class="{
                    'classroom-dock__voice-option--selected':
                      draftVoiceShortName === voice.shortName,
                  }"
                  @click="onVoicePanelSelect(voice.shortName)"
                >
                  <span class="classroom-dock__voice-option-main">
                    {{ formatTtsVoiceLabel(voice, voice.shortName) }}
                  </span>
                  <span class="classroom-dock__voice-option-sub">{{ voice.shortName }}</span>
                </button>
              </li>
            </ul>

            <footer class="classroom-dock__voice-panel-foot">
              <OmButton
                variant="ghost"
                size="sm"
                :pill="false"
                type="button"
                @click="voicePanelOpen = false"
              >
                取消
              </OmButton>
              <OmButton
                variant="primary"
                size="sm"
                :pill="false"
                type="button"
                :disabled="!draftVoiceShortName || voicesLoading"
                @click="confirmVoiceSelection"
              >
                保存
              </OmButton>
            </footer>
          </div>
        </Transition>
      </Teleport>

      <div class="classroom-dock__toolbar-center" role="group" aria-label="播放控制">
        <button type="button" class="classroom-dock__tool-btn" aria-label="音量">
          <SvgIcon name="volume" :size="18" class="classroom-dock__icon" />
        </button>
        <span class="classroom-dock__speed">{{ playbackSpeed }}</span>
        <button
          type="button"
          class="classroom-dock__tool-btn"
          aria-label="上一场景"
          :disabled="!canPrevScene"
          @click="emit('prevScene')"
        >
          <SvgIcon name="skip-back" :size="18" class="classroom-dock__icon" />
        </button>
        <button type="button" class="classroom-dock__tool-btn" aria-label="播放">
          <SvgIcon name="play-fill" :size="20" class="classroom-dock__icon classroom-dock__icon--play" />
        </button>
        <button
          type="button"
          class="classroom-dock__tool-btn"
          aria-label="下一场景"
          :disabled="!canNextScene"
          @click="emit('nextScene')"
        >
          <SvgIcon name="skip-forward" :size="18" class="classroom-dock__icon" />
        </button>
        <button type="button" class="classroom-dock__tool-btn" aria-label="循环">
          <SvgIcon name="loop" :size="18" class="classroom-dock__icon" />
        </button>
        <button type="button" class="classroom-dock__tool-btn" aria-label="标注">
          <SvgIcon name="edit" :size="18" class="classroom-dock__icon" />
        </button>
      </div>

      <div class="classroom-dock__toolbar-right">
        <button type="button" class="classroom-dock__tool-btn" aria-label="全屏">
          <SvgIcon name="fullscreen" :size="18" class="classroom-dock__icon" />
        </button>
        <button
          type="button"
          class="classroom-dock__tool-btn"
          :class="{ 'classroom-dock__tool-btn--active': chatOpen }"
          aria-label="消息"
          :aria-pressed="chatOpen"
          @click="toggleChat"
        >
          <SvgIcon name="message" :size="18" class="classroom-dock__icon" />
        </button>
      </div>
    </div>

    <div class="classroom-dock__main">
      <aside class="classroom-dock__teacher" aria-label="授课教师">
        <div class="classroom-dock__teacher-figure">
          <div class="classroom-dock__teacher-ring">
            <img
              v-if="teacherAvatar"
              :src="teacherAvatar"
              :alt="teacherName"
              class="classroom-dock__teacher-avatar"
            />
          </div>
          <span class="classroom-dock__teacher-name">{{ teacherName }}</span>
        </div>
      </aside>

      <div class="classroom-dock__speech">
        <form
          class="classroom-dock__speech-card"
          @submit.prevent="onSubmit"
        >
          <img
            v-if="teacherAvatar"
            :src="teacherAvatar"
            :alt="''"
            class="classroom-dock__speech-avatar"
            aria-hidden="true"
          />
          <div class="classroom-dock__speech-body">
            <p v-if="!chatOpen" class="classroom-dock__speech-text">
              {{ speechText }}
            </p>
            <label v-else class="classroom-dock__speech-input-wrap">
              <span class="sr-only">向 AI 助教发送消息</span>
              <input
                v-model="chatInput"
                type="text"
                class="classroom-dock__speech-input"
                placeholder="输入消息…"
                :disabled="streaming"
                autofocus
              />
            </label>
          </div>
          <button
            type="button"
            class="classroom-dock__play-btn"
            :class="{
              'classroom-dock__play-btn--loading':
                ttsLoading || (!chatOpen && speechPlayPending),
              'classroom-dock__play-btn--playing': ttsPlaying && !ttsLoading,
            }"
            :aria-label="
              chatOpen
                ? '发送消息'
                : ttsLoading || speechPlayPending
                  ? '正在加载本地讲解语音'
                  : ttsPlaying
                    ? '停止播放'
                    : '播放讲解'
            "
            :aria-busy="ttsLoading || speechPlayPending || undefined"
            :disabled="
              chatOpen
                ? false
                : ttsLoading ||
                  speechPlayPending ||
                  !keyPointSegments.length
            "
            @click="onPlayClick"
          >
            <SvgIcon
              v-if="chatOpen"
              name="plus"
              :size="18"
              class="classroom-dock__play-icon"
            />
            <span
              v-else-if="ttsLoading || speechPlayPending"
              class="classroom-dock__play-spinner"
              aria-hidden="true"
            />
            <span
              v-else-if="ttsPlaying"
              class="classroom-dock__audio-bars"
              aria-hidden="true"
            >
              <span
                v-for="bar in 5"
                :key="bar"
                class="classroom-dock__audio-bar"
                :style="{ '--bar-delay': `${(bar - 1) * 0.11}s` }"
              />
            </span>
            <SvgIcon
              v-else
              name="play-fill"
              :size="18"
              class="classroom-dock__play-icon"
            />
          </button>
        </form>
      </div>

      <aside class="classroom-dock__audience" aria-label="课堂参与者">
        <div class="classroom-dock__participants">
          <img
            v-for="agent in participantList"
            :key="agent.id"
            :src="participantAvatar(agent)"
            :alt="agent.name"
            class="classroom-dock__participant"
            :style="participantRingStyle(agent)"
          />
        </div>

        <div class="classroom-dock__user-row">
          <OmIconButton label="语音输入" class="classroom-dock__user-action">
            <SvgIcon name="microphone" :size="18" />
          </OmIconButton>
          <OmIconButton
            label="打开消息"
            class="classroom-dock__user-action"
            @click="toggleChat"
          >
            <SvgIcon name="message" :size="18" />
          </OmIconButton>
          <div class="classroom-dock__user-avatar-wrap">
            <img :src="userAvatar" alt="我" class="classroom-dock__user-avatar" />
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.classroom-dock {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem 1rem 1rem;
  border-radius: 1rem;
  border: 1px solid var(--om-border-panel);
  background: color-mix(in oklab, var(--om-bg-panel) 92%, var(--om-bg-page));
  box-shadow: var(--om-shadow-panel);
}

.classroom-dock__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2rem;
  padding: 0 0.25rem;
  color: var(--om-fg-secondary);
  position: relative;
  z-index: 1;
}

.classroom-dock__toolbar-left,
.classroom-dock__toolbar-center,
.classroom-dock__toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.classroom-dock__toolbar-voice {
  position: relative;
  flex-shrink: 0;
}

.classroom-dock__voice-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 9.5rem;
  height: 2rem;
  padding: 0 0.5rem 0 0.4rem;
  border: 1px solid var(--om-border-subtle);
  border-radius: 9999px;
  background: var(--om-bg-chip);
  color: var(--om-fg-secondary);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.classroom-dock__voice-trigger:hover,
.classroom-dock__voice-trigger--active {
  color: var(--om-fg);
  border-color: color-mix(in oklab, var(--om-fg-accent) 35%, var(--om-border-subtle));
  background: var(--om-bg-accent-soft);
}

.classroom-dock__voice-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 600;
}

.classroom-dock__voice-chevron {
  flex-shrink: 0;
  color: var(--om-fg-muted);
  transition: transform 0.15s ease;
}

.classroom-dock__voice-chevron--open {
  transform: rotate(180deg);
}

.classroom-dock__voice-panel {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem;
  border-radius: 0.875rem;
  border: 1px solid var(--om-border-panel);
  background: var(--om-bg-panel);
  color: var(--om-fg-on-panel);
  box-shadow: var(--om-shadow-panel);
}

.classroom-dock__voice-panel--teleport {
  position: fixed;
  z-index: 2000;
  margin: 0;
}

.classroom-dock__voice-panel-head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.classroom-dock__voice-panel-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--om-fg-on-panel);
}

.classroom-dock__voice-panel-hint {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--om-fg-panel-muted);
}

.classroom-dock__voice-search-input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid var(--om-border-input);
  background: var(--om-bg-prompt-input);
  font-size: 0.8125rem;
  color: var(--om-fg-on-panel);
  outline: none;
}

.classroom-dock__voice-search-input::placeholder {
  color: var(--om-placeholder-prompt);
}

.classroom-dock__voice-search-input:focus {
  border-color: var(--om-border-focus);
}

.classroom-dock__voice-status {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--om-fg-panel-muted);
}

.classroom-dock__voice-status--error {
  color: var(--om-fg-accent);
}

.classroom-dock__voice-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 11rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.classroom-dock__voice-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--om-fg-on-panel);
  transition: background-color 0.15s ease;
}

.classroom-dock__voice-option:hover {
  background: var(--om-bg-panel-muted);
}

.classroom-dock__voice-option--selected {
  background: var(--om-bg-accent-soft);
  color: var(--om-fg-accent);
}

.classroom-dock__voice-option-main {
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.3;
}

.classroom-dock__voice-option-sub {
  font-size: 0.6875rem;
  color: var(--om-fg-panel-muted);
  word-break: break-all;
}

.classroom-dock__voice-option--selected .classroom-dock__voice-option-sub {
  color: color-mix(in oklab, var(--om-fg-accent) 70%, var(--om-fg-panel-muted));
}

.classroom-dock__voice-panel-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--om-border-panel);
}

.classroom-dock-voice-enter-active,
.classroom-dock-voice-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.classroom-dock-voice-enter-from,
.classroom-dock-voice-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.classroom-dock__toolbar-center {
  flex: 1;
  justify-content: center;
  flex-wrap: wrap;
}

.classroom-dock__scene-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--om-fg-muted);
}

.classroom-dock__scene-count {
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--om-fg);
}

.classroom-dock__speed {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--om-fg-muted);
  min-width: 1.5rem;
  text-align: center;
}

.classroom-dock__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--om-fg-secondary);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.classroom-dock__tool-btn:hover:not(:disabled) {
  color: var(--om-fg);
  background: var(--om-bg-subtle);
}

.classroom-dock__tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.classroom-dock__tool-btn--active {
  color: var(--om-fg-accent);
  background: var(--om-bg-accent-soft);
}

.classroom-dock__icon {
  color: inherit;
}

.classroom-dock__icon :deep(.svg-icon__graphic) {
  display: block;
}

.classroom-dock__icon--play {
  width: 1.25rem;
  height: 1.25rem;
}

.classroom-dock__main {
  display: grid;
  grid-template-columns: minmax(5.5rem, 7rem) minmax(0, 1fr) minmax(6.5rem, 8.5rem);
  gap: 0.75rem 1rem;
  align-items: end;
}

.classroom-dock__teacher {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.classroom-dock__book {
  display: inline-flex;
  color: var(--om-fg-muted);
}

.classroom-dock__teacher-figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.classroom-dock__teacher-ring {
  position: relative;
  padding: 0.2rem;
  border-radius: 9999px;
  background: linear-gradient(
    145deg,
    var(--om-accent-from) 0%,
    var(--om-accent-to) 100%
  );
  box-shadow: 0 0 24px -6px color-mix(in oklab, var(--om-accent-to) 45%, transparent);
}

.classroom-dock__teacher-avatar,
.classroom-dock__teacher-fallback {
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 9999px;
  border: 2px solid var(--om-ring-avatar);
  object-fit: cover;
  background: var(--om-bg-muted);
}

.classroom-dock__teacher-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--om-fg-accent);
}

.classroom-dock__teacher-status {
  position: absolute;
  top: 0.15rem;
  right: 0.2rem;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 9999px;
  border: 2px solid var(--om-ring-avatar);
  background: var(--om-accent-to);
}

.classroom-dock__teacher-name {
  padding: 0.2rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--om-fg-on-primary);
  background: linear-gradient(
    135deg,
    var(--om-accent-from) 0%,
    var(--om-accent-to) 100%
  );
}

.classroom-dock__speech {
  min-width: 0;
}

.classroom-dock__speech-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4.5rem;
  padding: 0.75rem 0.875rem 0.75rem 1rem;
  border-radius: 1rem;
  border: 1px solid var(--om-border-subtle);
  background: var(--om-bg-card);
  box-shadow: var(--om-shadow-card);
}

.classroom-dock__speech-avatar {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  border: 1px solid var(--om-border-subtle);
  object-fit: cover;
  background: var(--om-bg-muted);
}

.classroom-dock__speech-body {
  flex: 1;
  min-width: 0;
}

.classroom-dock__speech-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--om-fg);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.classroom-dock__speech-input-wrap {
  display: block;
  width: 100%;
}

.classroom-dock__speech-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--om-fg);
}

.classroom-dock__speech-input::placeholder {
  color: var(--om-placeholder-prompt);
}

.classroom-dock__speech-input:disabled {
  opacity: 0.6;
}

.classroom-dock__play-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-radius: 9999px;
  border: 2px solid color-mix(in oklab, var(--om-fg-accent) 55%, transparent);
  background: color-mix(in oklab, var(--om-fg-accent) 8%, var(--om-bg-card));
  color: var(--om-fg-accent);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.classroom-dock__play-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--om-fg-accent) 14%, var(--om-bg-card));
  border-color: var(--om-fg-accent);
}

.classroom-dock__play-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.classroom-dock__play-btn--loading {
  pointer-events: none;
}

.classroom-dock__play-btn--playing {
  background: color-mix(in oklab, var(--om-fg-accent) 18%, var(--om-bg-card));
  border-color: var(--om-fg-accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--om-fg-accent) 12%, transparent);
}

.classroom-dock__play-icon {
  color: var(--om-fg-accent);
}

.classroom-dock__play-spinner {
  display: block;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 9999px;
  border: 2px solid color-mix(in oklab, var(--om-fg-accent) 22%, transparent);
  border-top-color: var(--om-fg-accent);
  animation: classroom-dock-spin 0.75s linear infinite;
}

.classroom-dock__audio-bars {
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  width: 1.25rem;
  height: 1.125rem;
  color: var(--om-fg-accent);
}

.classroom-dock__audio-bar {
  display: block;
  width: 3px;
  height: 0.3rem;
  border-radius: 9999px;
  background: currentColor;
  transform-origin: center bottom;
  animation: classroom-dock-audio-bar 0.85s ease-in-out infinite;
  animation-delay: var(--bar-delay, 0s);
}

@keyframes classroom-dock-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes classroom-dock-audio-bar {
  0%,
  100% {
    height: 0.3rem;
    opacity: 0.45;
    transform: scaleY(0.35);
  }
  35% {
    height: 0.55rem;
    opacity: 0.75;
    transform: scaleY(0.65);
  }
  65% {
    height: 1.05rem;
    opacity: 1;
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .classroom-dock__audio-bar {
    animation: classroom-dock-audio-bar-static 1.2s ease-in-out infinite;
  }

  .classroom-dock__play-spinner {
    animation-duration: 1.2s;
  }
}

@keyframes classroom-dock-audio-bar-static {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.classroom-dock__audience {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.625rem;
}

.classroom-dock__participants {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.25rem;
}

.classroom-dock__participant {
  width: 2rem;
  height: 2rem;
  margin-left: -0.5rem;
  border-radius: 9999px;
  border: 2px solid var(--om-ring-avatar);
  object-fit: cover;
  background: var(--om-bg-chip);
}

.classroom-dock__participant:first-child {
  margin-left: 0;
}

.classroom-dock__user-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.classroom-dock__user-action {
  color: var(--om-fg-muted);
}

.classroom-dock__user-avatar-wrap {
  padding: 0.125rem;
  border-radius: 9999px;
  border: 2px solid color-mix(in oklab, var(--om-fg-accent) 40%, transparent);
}

.classroom-dock__user-avatar {
  display: block;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  border: 2px solid var(--om-ring-avatar);
  object-fit: cover;
  background: var(--om-bg-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .classroom-dock__main {
    grid-template-columns: 4.5rem minmax(0, 1fr) 5.5rem;
    gap: 0.5rem;
  }

  .classroom-dock__teacher-avatar,
  .classroom-dock__teacher-fallback {
    width: 3.5rem;
    height: 3.5rem;
  }

  .classroom-dock__toolbar-center .classroom-dock__tool-btn:nth-child(n + 5) {
    display: none;
  }
}
</style>
