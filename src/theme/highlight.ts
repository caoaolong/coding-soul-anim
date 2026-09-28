import { Ink } from "./ink";

/**
 * 全项目统一的高亮视觉 token（Manim 调）。
 * 自身变色高亮、焦点框、强调色都从这里取，避免组件硬编码散落。
 */
export const Highlight = {
  /** 自身高亮填充（黄） */
  fill: Ink.gold,
  /** 自身高亮描边 */
  stroke: Ink.goldSoft,
  /** 强调色（文字脉冲） */
  accent: Ink.goldBright,
  /** 非选中/弱化 */
  muted: Ink.muted,
  /** 常规描边宽 */
  lineWidth: Ink.lineWidth,
  /**
   * 可选的峰值描边宽；高亮动画默认不使用。
   * 仅当调用方显式传入 lineWidthPeak 时才会加粗。
   */
  lineWidthPeak: 4,
  /** 高亮峰值缩放 */
  scalePeak: 1.04,
  /** 自身高亮默认时长（秒） */
  duration: Ink.duration,
  /** Annotation.focusBox */
  focusBox: {
    color: Ink.blue,
    lineWidth: 3,
    padding: 12,
    radius: 2,
    duration: 1.0,
  },
  /** Annotation.focusBox style='hud'（科技锁定框） */
  hud: {
    color: Ink.teal,
    lineWidth: 2.25,
    padding: 10,
    fillOpacity: 0.12,
    /** 写成 number，避免 as const 字面量把默认参数锁死成 0.9 */
    duration: 0.9 as number,
  },
} as const;

export type HighlightTokens = typeof Highlight;
