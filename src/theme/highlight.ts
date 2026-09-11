import { Ink } from "./ink";

/**
 * 全项目统一的高亮视觉 token（水墨调）。
 * 自身变色高亮、焦点框、强调色都从这里取，避免组件硬编码散落。
 */
export const Highlight = {
  /** 自身高亮填充（淡金） */
  fill: Ink.gold,
  /** 自身高亮描边 */
  stroke: Ink.goldSoft,
  /** 强调色（文字脉冲，略亮） */
  accent: Ink.goldBright,
  /** 非选中/弱化 */
  muted: Ink.muted,
  /** 常规描边宽（焦点框等）— 细墨线 */
  lineWidth: Ink.lineWidth,
  /**
   * 可选的峰值描边宽；高亮动画默认不使用。
   * 仅当调用方显式传入 lineWidthPeak 时才会加粗。
   */
  lineWidthPeak: 4,
  /** 高亮峰值缩放（轻提，不弹跳） */
  scalePeak: 1.04,
  /** 自身高亮默认时长（秒） */
  duration: Ink.duration,
  /** Annotation.focusBox：水墨运笔底线 */
  focusBox: {
    color: Ink.seal,
    lineWidth: 3,
    padding: 12,
    radius: 0,
    duration: 1.0,
  },
} as const;

export type HighlightTokens = typeof Highlight;
