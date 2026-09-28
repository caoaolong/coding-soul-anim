/**
 * Manim 风格色板与尺寸约定（3Blue1Brown / ManimCE 观感）。
 * 全项目 UI 从此取色，避免组件硬编码。
 */
export const Ink = {
  /** 场景底色（Manim 深灰黑） */
  bg: "#1C1C1C",
  /** 更深遮罩 */
  veil: "#0A0A0A",
  /** 主文字 / 主图形（白） */
  paper: "#FFFFFF",
  /** 次级文字 */
  paperSoft: "#BBBBBB",
  /** 弱化 / 未选中 */
  muted: "#888888",
  /** 面板 / 节点底 */
  deep: "#2A2A2A",
  /** 面板变体（隔行、层次） */
  deepAlt: "#333333",
  /** 结构线 */
  line: "#888888",
  /** 主强调（Manim YELLOW） */
  gold: "#FFFF00",
  /** 描边强调（略暖黄） */
  goldSoft: "#F4D345",
  /** 脉冲亮黄 */
  goldBright: "#FFFFAA",
  /** 警示 / 占用（Manim RED） */
  warn: "#FC6255",
  /** 警示深底 */
  warnDeep: "#8B3A3A",
  /** 批注 / 焦点（Manim RED） */
  seal: "#FC6255",

  /** Manim BLUE */
  blue: "#58C4DD",
  /** Manim BLUE_E */
  blueDeep: "#1C758A",
  /** Manim TEAL */
  teal: "#5CD0B3",
  /** Manim GREEN */
  green: "#83C167",
  /** Manim PURPLE */
  purple: "#9A72AC",
  /** Manim ORANGE */
  orange: "#FF862F",

  /** UI 无衬线字体（中英） */
  font: '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',

  /** 默认细线宽 */
  lineWidth: 2,
  /** 默认小圆角（Manim 偏直角，略留一点） */
  radius: 2,
  /** 显现默认时长（秒） */
  duration: 0.45,
  /** 书写/底线展开默认时长 */
  brushDuration: 0.55,
} as const;

export type InkTokens = typeof Ink;
