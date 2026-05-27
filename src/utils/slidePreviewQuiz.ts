// SPDX-License-Identifier: AGPL-3.0

export interface SlideQuizOption {
  id: string;
  label: string;
  value?: string;
}

export interface SlideQuizModel {
  question: string;
  options: SlideQuizOption[];
  selectedIndex: number;
}

export interface SceneQuizQuestion {
  id: string;
  type: string;
  question: string;
  options: SlideQuizOption[];
  answers: string[];
  analysis: string;
  points: number;
}

const PLACEHOLDER_OPTIONS: SlideQuizOption[] = [
  { id: '0', label: '' },
  { id: '1', label: '' },
  { id: '2', label: '' },
  { id: '3', label: '' },
];

function normalizeOption(item: unknown, index: number): SlideQuizOption {
  if (typeof item === 'string') {
    return { id: String(index), label: item.trim() };
  }
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    const text = String(
      record.label ?? record.text ?? record.title ?? record.content ?? '',
    ).trim();
    const value =
      record.value != null ? String(record.value).trim() : undefined;
    const label = text || `选项 ${index + 1}`;
    return {
      id: value ?? String(record.id ?? index),
      label,
      value,
    };
  }
  return { id: String(index), label: `选项 ${index + 1}` };
}

function extractOptions(raw: Record<string, unknown>): unknown[] | null {
  const nested =
    raw.quizConfig && typeof raw.quizConfig === 'object'
      ? (raw.quizConfig as Record<string, unknown>)
      : null;

  const candidates = [
    raw.options,
    raw.choices,
    raw.items,
    raw.answers,
    nested?.options,
    nested?.choices,
    nested?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return null;
}

function resolveSelectedIndex(
  options: SlideQuizOption[],
  raw: Record<string, unknown>,
  nested: Record<string, unknown> | null,
): number {
  const answerList = [raw.answer, raw.answers, nested?.answer, nested?.answers]
    .filter((item) => Array.isArray(item))
    .flatMap((item) => (item as unknown[]).map((value) => String(value).trim()))
    .filter(Boolean);

  if (answerList.length) {
    const byValue = options.findIndex(
      (option) =>
        answerList.includes(option.id) ||
        (option.value != null && answerList.includes(option.value)),
    );
    if (byValue >= 0) return byValue;
  }

  const selectedRaw =
    raw.selectedIndex ??
    raw.selectedOptionIndex ??
    raw.correctIndex ??
    nested?.selectedIndex ??
    nested?.selectedOptionIndex;

  let selectedIndex = Number(selectedRaw);
  if (!Number.isNaN(selectedIndex)) {
    return Math.min(Math.max(selectedIndex, 0), Math.max(options.length - 1, 0));
  }

  const selectedId = raw.selectedOptionId ?? nested?.selectedOptionId;
  if (selectedId != null) {
    const found = options.findIndex((option) => option.id === String(selectedId));
    if (found >= 0) return found;
  }

  return 1;
}

export function parseSlideQuiz(raw: Record<string, unknown>): SlideQuizModel {
  const nested =
    raw.quizConfig && typeof raw.quizConfig === 'object'
      ? (raw.quizConfig as Record<string, unknown>)
      : null;

  const question = String(
    raw.question ??
      raw.title ??
      raw.prompt ??
      nested?.question ??
      nested?.title ??
      '',
  ).trim();

  const list = extractOptions(raw);
  let options = list?.map(normalizeOption) ?? [...PLACEHOLDER_OPTIONS];

  if (options.length < 4) {
    options = [
      ...options,
      ...Array.from({ length: 4 - options.length }, (_, index) => ({
        id: `pad-${options.length + index}`,
        label: '',
      })),
    ];
  }

  const selectedIndex = resolveSelectedIndex(options, raw, nested);

  return { question, options, selectedIndex };
}

function normalizeSceneQuestion(item: unknown, index: number): SceneQuizQuestion | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const question = String(record.question ?? record.title ?? '').trim();
  if (!question) return null;

  const optionsRaw = record.options;
  const options = Array.isArray(optionsRaw)
    ? optionsRaw.map(normalizeOption)
    : [];

  const answers = Array.isArray(record.answer)
    ? record.answer.map((value) => String(value).trim()).filter(Boolean)
    : Array.isArray(record.answers)
      ? record.answers.map((value) => String(value).trim()).filter(Boolean)
      : [];

  return {
    id: String(record.id ?? `q${index + 1}`),
    type: String(record.type ?? 'single'),
    question,
    options,
    answers,
    analysis: String(record.analysis ?? '').trim(),
    points: typeof record.points === 'number' ? record.points : Number(record.points) || 0,
  };
}

/** 解析场景级 content.questions */
export function parseSceneQuizQuestions(
  content: Record<string, unknown> | undefined,
): SceneQuizQuestion[] {
  if (!content || typeof content !== 'object') return [];

  const direct = content.questions;
  if (Array.isArray(direct) && direct.length) {
    return direct
      .map(normalizeSceneQuestion)
      .filter((item): item is SceneQuizQuestion => item != null);
  }

  const nested =
    content.content && typeof content.content === 'object'
      ? (content.content as Record<string, unknown>)
      : null;
  if (nested && Array.isArray(nested.questions)) {
    return nested.questions
      .map(normalizeSceneQuestion)
      .filter((item): item is SceneQuizQuestion => item != null);
  }

  return [];
}

export function sceneQuestionToSlideModel(
  question: SceneQuizQuestion,
): SlideQuizModel {
  let options =
    question.options.length >= 4
      ? question.options.slice(0, 4)
      : [
          ...question.options,
          ...Array.from(
            { length: 4 - question.options.length },
            (_, index): SlideQuizOption => ({
              id: `pad-${question.options.length + index}`,
              label: '',
            }),
          ),
        ];

  let selectedIndex = 1;
  if (question.answers.length) {
    const found = options.findIndex(
      (option) =>
        question.answers.includes(option.id) ||
        (option.value != null && question.answers.includes(option.value)),
    );
    if (found >= 0) selectedIndex = found;
  }

  return {
    question: question.question,
    options,
    selectedIndex,
  };
}

/** 侧边栏 2×2 固定展示前 4 项 */
export function sidebarQuizOptions(model: SlideQuizModel): SlideQuizOption[] {
  return model.options.slice(0, 4);
}

export function isOptionCorrect(
  option: SlideQuizOption,
  answers: string[],
): boolean {
  if (!answers.length) return false;
  return (
    answers.includes(option.id) ||
    (option.value != null && answers.includes(option.value))
  );
}
