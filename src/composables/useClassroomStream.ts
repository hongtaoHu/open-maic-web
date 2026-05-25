// SPDX-License-Identifier: AGPL-3.0
import { ref, shallowRef } from 'vue';

import {
  getApiErrorMessage,
  streamClassroom,
  streamClassroomById,
} from '@/api';
import { useStageStore } from '@/stores/stage';
import type {
  ClassroomStreamEvent,
  ClassroomStreamQuery,
  ClassroomStreamStartInput,
  SceneOutline,
} from '@/types/classroom-stream';
import type { Stage } from '@/types/stage';
import {
  clearClassroomOutlineCache,
  saveClassroomOutlineCache,
} from '@/utils/classroomStream';
import { parseClassroomStreamEvent } from '@/utils/classroomStreamEvents';

const OUTLINE_NODE_LABEL = '大纲生成';

function formatOutlines(outlines: SceneOutline[]): string {
  return outlines
    .map((o, i) => {
      const points =
        o.keyPoints?.length ? `\n   ${o.keyPoints.map((p) => `· ${p}`).join('\n   ')}` : '';
      return `${i + 1}. ${o.title}${o.description ? `\n   ${o.description}` : ''}${points}`;
    })
    .join('\n\n');
}

export interface ClassroomOutlinesReadyContext {
  classroomId: string;
  outlines: SceneOutline[];
  input: ClassroomStreamStartInput;
  languageDirective: string;
}

export interface ClassroomStreamHooks {
  /** 大纲阶段结束（收到首个 content_generated 或流结束） */
  onOutlinesReady?: (ctx: ClassroomOutlinesReadyContext) => void | Promise<void>;
  onDone?: () => void;
}

export function useClassroomStream() {
  const stageStore = useStageStore();
  const streaming = ref(false);
  const error = ref<string | null>(null);
  const stage = ref<string | null>(null);
  const statusLabel = ref('正在构建学习路径…');
  const outlineText = ref('');
  const outlines = shallowRef<SceneOutline[]>([]);
  const scenesCount = ref(0);

  let abortController: AbortController | null = null;
  let activeClassroomId: string | null = null;
  let streamInput: ClassroomStreamStartInput | null = null;
  let languageDirective = '';
  let outlinesReadyEmitted = false;

  function persistOutline() {
    if (!activeClassroomId) return;
    saveClassroomOutlineCache({
      classroomId: activeClassroomId,
      outlineText: outlineText.value,
      outlines: [...outlines.value],
      languageDirective: languageDirective || stageStore.stage?.languageDirective,
    });
  }

  function patchStage(next: Stage) {
    stageStore.$patch({ stage: next });
  }

  function applyLanguageDirective(directive: string) {
    const trimmed = directive.trim();
    if (!trimmed || !activeClassroomId) return;

    languageDirective = trimmed;
    const ts = Date.now();
    const prev = stageStore.stage;

    if (prev?.id === activeClassroomId) {
      patchStage({ ...prev, languageDirective: trimmed, updatedAt: ts });
    } else {
      patchStage({
        id: activeClassroomId,
        name: prev?.name ?? '课堂',
        description: prev?.description,
        languageDirective: trimmed,
        createdAt: prev?.createdAt ?? ts,
        updatedAt: ts,
        agentIds: prev?.agentIds ?? ['default-1'],
      });
    }
    persistOutline();
  }

  function stop() {
    abortController?.abort();
    abortController = null;
    streaming.value = false;
  }

  function bindStageForStream(input: ClassroomStreamStartInput) {
    const ts = Date.now();
    const prev = stageStore.stage;
    const classroomId = input.classroomId;
    const agentIds = input.agentConfigs.map((agent) => agent.id);

    if (!prev || prev.id !== classroomId) {
      patchStage({
        id: classroomId,
        name: input.userQuestion?.trim() || prev?.name || '课堂',
        description: input.systemPrompt?.trim() || prev?.description,
        languageDirective: prev?.languageDirective ?? (languageDirective || undefined),
        createdAt: prev?.createdAt ?? ts,
        updatedAt: ts,
        agentIds: agentIds.length ? agentIds : prev?.agentIds ?? ['default-1'],
      });
      return;
    }

    patchStage({
      ...prev,
      name: input.userQuestion?.trim() || prev.name,
      description: input.systemPrompt?.trim() || prev.description,
      agentIds: agentIds.length ? agentIds : prev.agentIds,
      updatedAt: ts,
    });
  }

  function bindClassroomId(classroomId: string) {
    const ts = Date.now();
    const prev = stageStore.stage;
    if (prev?.id === classroomId) return;

    patchStage({
      id: classroomId,
      name: prev?.name ?? '课堂',
      description: prev?.description,
      languageDirective: prev?.languageDirective ?? (languageDirective || undefined),
      createdAt: prev?.createdAt ?? ts,
      updatedAt: ts,
      agentIds: prev?.agentIds ?? ['default-1'],
    });
  }

  function getSortedOutlines(): SceneOutline[] {
    return [...outlines.value]
      .filter((outline): outline is SceneOutline => Boolean(outline?.title?.trim()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async function emitOutlinesReady(hooks?: ClassroomStreamHooks) {
    if (outlinesReadyEmitted || !hooks?.onOutlinesReady) return;
    if (!activeClassroomId || !streamInput) return;

    const readyOutlines = getSortedOutlines();
    if (!readyOutlines.length) return;

    outlinesReadyEmitted = true;
    stop();

    try {
      await hooks.onOutlinesReady({
        classroomId: activeClassroomId,
        outlines: readyOutlines,
        input: streamInput,
        languageDirective:
          languageDirective || stageStore.stage?.languageDirective || '',
      });
    } catch (e) {
      error.value = getApiErrorMessage(e);
    }
  }

  function onStreamEvent(raw: unknown, hooks?: ClassroomStreamHooks) {
    const event = parseClassroomStreamEvent(raw);
    if (!event) return;
    handleEvent(event, hooks);
  }

  function handleEvent(event: ClassroomStreamEvent, hooks?: ClassroomStreamHooks) {
    switch (event.type) {
      case 'language_directive':
        applyLanguageDirective(event.data);
        break;
      case 'stage_change':
        stage.value = event.stage;
        statusLabel.value = event.label;
        break;
      case 'token':
        if (event.node === OUTLINE_NODE_LABEL) {
          outlineText.value += event.content;
          persistOutline();
        }
        break;
      case 'outlines_generated': {
        const accumulated = [...outlines.value];
        accumulated[event.index] = event.data;
        outlines.value = accumulated;
        outlineText.value = formatOutlines(accumulated);
        persistOutline();
        break;
      }
      case 'content_generated':
        scenesCount.value = event.scenesCount ?? scenesCount.value + 1;
        void emitOutlinesReady(hooks);
        break;
      case 'error':
        error.value = event.message;
        break;
      case 'done':
        persistOutline();
        if (hooks?.onOutlinesReady) {
          void emitOutlinesReady(hooks);
        } else {
          hooks?.onDone?.();
        }
        break;
    }
  }

  async function start(body: ClassroomStreamStartInput, hooks?: ClassroomStreamHooks) {
    stop();
    activeClassroomId = body.classroomId;
    streamInput = body;
    languageDirective = '';
    outlinesReadyEmitted = false;
    clearClassroomOutlineCache();
    bindStageForStream(body);
    abortController = new AbortController();
    streaming.value = true;
    error.value = null;
    stage.value = null;
    statusLabel.value = '正在构建学习路径…';
    outlineText.value = '';
    outlines.value = [];
    scenesCount.value = 0;

    try {
      await streamClassroom(
        body,
        (e) => onStreamEvent(e, hooks),
        abortController.signal,
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      error.value = getApiErrorMessage(e);
    } finally {
      streaming.value = false;
      abortController = null;
    }
  }

  async function startByClassroomId(
    classroomId: string,
    options?: { query?: ClassroomStreamQuery } & ClassroomStreamHooks,
  ) {
    stop();
    activeClassroomId = classroomId;
    streamInput = null;
    languageDirective = '';
    outlinesReadyEmitted = false;
    clearClassroomOutlineCache();
    bindClassroomId(classroomId);
    abortController = new AbortController();
    streaming.value = true;
    error.value = null;
    stage.value = null;
    statusLabel.value = '正在构建学习路径…';
    outlineText.value = '';
    outlines.value = [];
    scenesCount.value = 0;

    try {
      await streamClassroomById(
        classroomId,
        (e) => onStreamEvent(e, options),
        { query: options?.query, signal: abortController.signal },
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      error.value = getApiErrorMessage(e);
    } finally {
      streaming.value = false;
      abortController = null;
    }
  }

  return {
    streaming,
    error,
    stage,
    statusLabel,
    outlineText,
    outlines,
    scenesCount,
    start,
    startByClassroomId,
    stop,
  };
}
