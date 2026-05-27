// SPDX-License-Identifier: AGPL-3.0

const DEFAULT_CHART_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#f39c12',
  '#1abc9c',
];

export interface SlideChartModel {
  chartType: string;
  labels: string[];
  legends: string[];
  series: number[][];
  colors: string[];
}

export function parseSlideChart(raw: Record<string, unknown>): SlideChartModel | null {
  const dataRaw = raw.data;
  if (!dataRaw || typeof dataRaw !== 'object') return null;

  const data = dataRaw as Record<string, unknown>;
  const labels = Array.isArray(data.labels)
    ? data.labels.map((label) => String(label))
    : [];
  const legends = Array.isArray(data.legends)
    ? data.legends.map((legend) => String(legend))
    : [];
  const series = Array.isArray(data.series)
    ? data.series
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => row.map((value) => Number(value)).filter((n) => !Number.isNaN(n)))
    : [];

  if (!labels.length || !series.length) return null;

  const colors = Array.isArray(raw.themeColors)
    ? raw.themeColors.map((color) => String(color)).filter(Boolean)
    : [...DEFAULT_CHART_COLORS];

  const chartType =
    typeof raw.chartType === 'string' && raw.chartType.trim()
      ? raw.chartType.trim().toLowerCase()
      : 'line';

  return { chartType, labels, legends, series, colors };
}

export function seriesValueRange(series: number[][]): { min: number; max: number } {
  const values = series.flat();
  if (!values.length) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

/** 标签过多时抽样，避免预览区拥挤 */
export function pickChartLabelIndices(count: number, maxLabels = 9): number[] {
  if (count <= maxLabels) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const step = Math.ceil(count / maxLabels);
  const indices: number[] = [];
  for (let index = 0; index < count; index += step) {
    indices.push(index);
  }
  if (indices[indices.length - 1] !== count - 1) {
    indices.push(count - 1);
  }
  return indices;
}
