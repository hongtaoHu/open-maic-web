<script setup lang="ts">
import { computed } from 'vue';

import {
  parseSlideChart,
  pickChartLabelIndices,
  seriesValueRange,
  type SlideChartModel,
} from '@/utils/slidePreviewChart';

const props = defineProps<{
  raw: Record<string, unknown>;
  width: number;
  height: number;
}>();

const model = computed(() => parseSlideChart(props.raw));

const viewW = computed(() => Math.max(props.width, 1));
const viewH = computed(() => Math.max(props.height, 1));

const layout = computed(() => {
  const w = viewW.value;
  const h = viewH.value;
  return {
    w,
    h,
    margin: { top: 36, right: 16, bottom: 40, left: 44 },
    plotW: w - 44 - 16,
    plotH: h - 36 - 40,
  };
});

function colorAt(chart: SlideChartModel, index: number): string {
  return chart.colors[index % chart.colors.length] ?? '#64748b';
}

const lineModel = computed(() => {
  const chart = model.value;
  if (!chart || !['line', 'area'].includes(chart.chartType)) return null;

  const { min, max } = seriesValueRange(chart.series);
  const { plotW, plotH, margin } = layout.value;
  const count = chart.labels.length;
  const xStep = count > 1 ? plotW / (count - 1) : 0;

  const yScale = (value: number) =>
    margin.top +
    plotH -
    ((value - min) / (max - min)) * plotH;

  const xAt = (index: number) => margin.left + index * xStep;

  const paths = chart.series.map((values, seriesIndex) => {
    const points = values
      .slice(0, count)
      .map((value, index) => `${xAt(index)},${yScale(value)}`)
      .join(' ');
    const areaPoints =
      chart.chartType === 'area' && points
        ? `${points} L ${xAt(Math.min(values.length, count) - 1)},${margin.top + plotH} L ${xAt(0)},${margin.top + plotH} Z`
        : null;
    return {
      color: colorAt(chart, seriesIndex),
      points,
      areaPoints,
      legend: chart.legends[seriesIndex] ?? `系列 ${seriesIndex + 1}`,
    };
  });

  const labelIndices = pickChartLabelIndices(count);
  const xLabels = labelIndices.map((index) => ({
    index,
    x: xAt(index),
    text: chart.labels[index] ?? '',
  }));

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, tick) => {
    const ratio = tick / gridLines;
    const value = min + (max - min) * (1 - ratio);
    return {
      y: margin.top + plotH * ratio,
      label: formatTick(value),
    };
  });

  return { paths, xLabels, yTicks, margin, plotW, plotH };
});

const barModel = computed(() => {
  const chart = model.value;
  if (!chart || !['bar', 'column'].includes(chart.chartType)) return null;

  const { min, max } = seriesValueRange(chart.series);
  const { plotW, plotH, margin } = layout.value;
  const labelCount = chart.labels.length;
  const seriesCount = chart.series.length;
  const groupWidth = plotW / Math.max(labelCount, 1);
  const barGap = 4;
  const barWidth = Math.max(
    2,
    (groupWidth - barGap * (seriesCount + 1)) / Math.max(seriesCount, 1),
  );

  const groups = chart.labels.map((label, labelIndex) => {
    const groupX = margin.left + labelIndex * groupWidth;
    const bars = chart.series.map((values, seriesIndex) => {
      const value = values[labelIndex] ?? 0;
      const barH = ((value - min) / (max - min)) * plotH;
      const x = groupX + barGap + seriesIndex * (barWidth + barGap);
      const y = margin.top + plotH - barH;
      return {
        x,
        y,
        width: barWidth,
        height: Math.max(barH, 0),
        color: colorAt(chart, seriesIndex),
      };
    });
    return { label, x: groupX + groupWidth / 2, bars };
  });

  const legends = chart.series.map((_, seriesIndex) => ({
    color: colorAt(chart, seriesIndex),
    text: chart.legends[seriesIndex] ?? `系列 ${seriesIndex + 1}`,
  }));

  return { groups, legends, margin };
});

const pieModel = computed(() => {
  const chart = model.value;
  if (!chart || !['pie', 'ring'].includes(chart.chartType)) return null;

  const values = chart.series[0] ?? [];
  const total = values.reduce((sum, value) => sum + Math.abs(value), 0) || 1;
  const cx = viewW.value / 2;
  const cy = viewH.value / 2 + 8;
  const outerR = Math.min(viewW.value, viewH.value) * 0.32;
  const innerR = chart.chartType === 'ring' ? outerR * 0.55 : 0;

  let angle = -Math.PI / 2;
  const slices = values.map((value, index) => {
    const sliceAngle = (Math.abs(value) / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sliceAngle;
    angle = end;
    return {
      color: colorAt(chart, index),
      label: chart.labels[index] ?? '',
      d: describeArc(cx, cy, outerR, innerR, start, end),
    };
  });

  const legends = values.map((_, index) => ({
    color: colorAt(chart, index),
    text: chart.labels[index] ?? chart.legends[index] ?? `项 ${index + 1}`,
  }));

  return { slices, legends, cx, cy };
});

function formatTick(value: number): string {
  if (Math.abs(value) >= 100 || Math.abs(value) < 0.01) {
    return value.toExponential(1);
  }
  return value.toFixed(Math.abs(value) < 10 ? 1 : 0);
}

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  start: number,
  end: number,
): string {
  const x1 = cx + outerR * Math.cos(start);
  const y1 = cy + outerR * Math.sin(start);
  const x2 = cx + outerR * Math.cos(end);
  const y2 = cy + outerR * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;

  if (innerR <= 0) {
    return `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const x3 = cx + innerR * Math.cos(end);
  const y3 = cy + innerR * Math.sin(end);
  const x4 = cx + innerR * Math.cos(start);
  const y4 = cy + innerR * Math.sin(start);
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
}

const legendItems = computed(() => {
  const chart = model.value;
  if (!chart) return [];
  return chart.series.map((_, index) => ({
    color: colorAt(chart, index),
    text: chart.legends[index] ?? `系列 ${index + 1}`,
  }));
});
</script>

<template>
  <svg
    v-if="model && lineModel"
    class="slide-preview-chart"
    :viewBox="`0 0 ${viewW} ${viewH}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="`${model.chartType} chart`"
  >
    <g class="slide-preview-chart__grid">
      <line
        v-for="(tick, tickIndex) in lineModel.yTicks"
        :key="`grid-${tickIndex}`"
        :x1="lineModel.margin.left"
        :y1="tick.y"
        :x2="lineModel.margin.left + lineModel.plotW"
        :y2="tick.y"
        class="slide-preview-chart__grid-line"
      />
    </g>
    <g class="slide-preview-chart__y-labels">
      <text
        v-for="(tick, tickIndex) in lineModel.yTicks"
        :key="`ylabel-${tickIndex}`"
        :x="lineModel.margin.left - 6"
        :y="tick.y"
        text-anchor="end"
        dominant-baseline="middle"
        class="slide-preview-chart__axis-text"
      >
        {{ tick.label }}
      </text>
    </g>
    <g class="slide-preview-chart__series">
      <path
        v-for="(path, pathIndex) in lineModel.paths"
        :key="`area-${pathIndex}`"
        v-show="path.areaPoints"
        :d="path.areaPoints!"
        :fill="path.color"
        fill-opacity="0.12"
      />
      <polyline
        v-for="(path, pathIndex) in lineModel.paths"
        :key="`line-${pathIndex}`"
        :points="path.points"
        fill="none"
        :stroke="path.color"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </g>
    <g class="slide-preview-chart__x-labels">
      <text
        v-for="item in lineModel.xLabels"
        :key="`xlabel-${item.index}`"
        :x="item.x"
        :y="viewH - 10"
        text-anchor="middle"
        class="slide-preview-chart__axis-text slide-preview-chart__axis-text--x"
      >
        {{ item.text }}
      </text>
    </g>
    <g class="slide-preview-chart__legend">
      <g
        v-for="(item, index) in legendItems"
        :key="`legend-${index}`"
        :transform="`translate(${12 + index * 130}, 12)`"
      >
        <line x1="0" y1="0" x2="14" y2="0" :stroke="item.color" stroke-width="2.5" />
        <text x="18" y="0" dominant-baseline="middle" class="slide-preview-chart__legend-text">
          {{ item.text }}
        </text>
      </g>
    </g>
  </svg>

  <svg
    v-else-if="model && barModel"
    class="slide-preview-chart"
    :viewBox="`0 0 ${viewW} ${viewH}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="`${model.chartType} chart`"
  >
    <g class="slide-preview-chart__legend">
      <g
        v-for="(item, index) in barModel.legends"
        :key="`legend-${index}`"
        :transform="`translate(${12 + index * 100}, 10)`"
      >
        <rect x="0" y="-5" width="10" height="10" :fill="item.color" rx="1" />
        <text x="14" y="0" dominant-baseline="middle" class="slide-preview-chart__legend-text">
          {{ item.text }}
        </text>
      </g>
    </g>
    <g class="slide-preview-chart__bars">
      <g v-for="(group, groupIndex) in barModel.groups" :key="`group-${groupIndex}`">
        <rect
          v-for="(bar, barIndex) in group.bars"
          :key="`bar-${groupIndex}-${barIndex}`"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :fill="bar.color"
          rx="1"
        />
        <text
          :x="group.x"
          :y="viewH - 8"
          text-anchor="middle"
          class="slide-preview-chart__axis-text slide-preview-chart__axis-text--x"
        >
          {{ group.label }}
        </text>
      </g>
    </g>
  </svg>

  <svg
    v-else-if="model && pieModel"
    class="slide-preview-chart"
    :viewBox="`0 0 ${viewW} ${viewH}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="`${model.chartType} chart`"
  >
    <path
      v-for="(slice, index) in pieModel.slices"
      :key="`slice-${index}`"
      :d="slice.d"
      :fill="slice.color"
      stroke="#fff"
      stroke-width="1"
    />
    <g class="slide-preview-chart__legend">
      <g
        v-for="(item, index) in pieModel.legends"
        :key="`legend-${index}`"
        :transform="`translate(12, ${12 + index * 16})`"
      >
        <rect x="0" y="-5" width="10" height="10" :fill="item.color" rx="1" />
        <text x="14" y="0" dominant-baseline="middle" class="slide-preview-chart__legend-text">
          {{ item.text }}
        </text>
      </g>
    </g>
  </svg>

  <div v-else class="slide-preview-chart__placeholder">
    <span class="slide-preview-chart__placeholder-icon" aria-hidden="true" />
    <span class="slide-preview-chart__placeholder-label">图表</span>
  </div>
</template>

<style scoped>
.slide-preview-chart {
  width: 100%;
  height: 100%;
  display: block;
  background: #fff;
}

.slide-preview-chart__grid-line {
  stroke: #e2e8f0;
  stroke-width: 1;
}

.slide-preview-chart__axis-text {
  font-size: 11px;
  fill: #64748b;
}

.slide-preview-chart__axis-text--x {
  font-size: 10px;
}

.slide-preview-chart__legend-text {
  font-size: 11px;
  fill: #334155;
}

.slide-preview-chart__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  height: 100%;
  background: color-mix(in oklab, var(--om-fg-accent) 6%, #f8fafc);
}

.slide-preview-chart__placeholder-icon {
  width: 2rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  background: linear-gradient(
    135deg,
    color-mix(in oklab, var(--om-fg-accent) 35%, transparent),
    color-mix(in oklab, var(--om-fg-accent) 12%, transparent)
  );
}

.slide-preview-chart__placeholder-label {
  font-size: 0.625rem;
  color: var(--om-fg-muted);
}
</style>
