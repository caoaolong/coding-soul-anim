/**
 * 全项目统一的高亮视觉 token。
 * 自身变色高亮、焦点框、强调色都从这里取，避免组件硬编码散落。
 */
export const Highlight = {
  /** 自身高亮填充（琥珀） */
  fill: "#F59E0B",
  /** 自身高亮描边（亮琥珀） */
  stroke: "#FCD34D",
  /** 强调色（描边/文字脉冲，略亮） */
  accent: "#FBBF24",
  /** 非选中/弱化 */
  muted: "#94A3B8",
  /** 常规描边宽（焦点框等） */
  lineWidth: 4,
  /**
   * 可选的峰值描边宽；高亮动画默认不使用。
   * 仅当调用方显式传入 lineWidthPeak 时才会加粗。
   */
  lineWidthPeak: 8,
  /** 高亮峰值缩放 */
  scalePeak: 1.12,
  /** 自身高亮默认时长（秒） */
  duration: 0.4,
  /** Annotation.focusBox 默认参数 */
  focusBox: {
    color: "#FBBF24",
    lineWidth: 4,
    padding: 16,
    radius: 12,
    duration: 0.85,
  },
} as const;

export type HighlightTokens = typeof Highlight;
