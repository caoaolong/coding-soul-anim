/**
 * 水墨画风色板与尺寸约定。
 * 封面、正文、高亮统一从这里取，避免琥珀科技风与太极背景割裂。
 */
export const Ink = {
  /** 宣纸墨底（场景 view.fill） */
  bg: "#0E0E10",
  /** 更深的底纱 / 遮罩 */
  veil: "#0A0A0C",
  /** 正文浅墨（奶油墨色） */
  paper: "#E8E0D0",
  /** 次级文字 */
  paperSoft: "#C4B8A8",
  /** 弱化 / 未选中 */
  muted: "#7A7368",
  /** 深墨块（节点底、格底） */
  deep: "#1C1B19",
  /** 深墨块变体（层次递进、隔行） */
  deepAlt: "#242220",
  /** 结构墨线 */
  line: "#5C564C",
  /** 强调淡金（与太极光晕同系） */
  gold: "#C9A227",
  /** 描边金 */
  goldSoft: "#D4AF37",
  /** 脉冲亮金（少用） */
  goldBright: "#E8D48B",
  /** 警示淡赭（占用、警告描边） */
  warn: "#9A7A5C",
  /** 警示深赭（占用块底） */
  warnDeep: "#5C4030",
  /** 默认细线宽 */
  lineWidth: 2,
  /** 默认小圆角 */
  radius: 4,
  /** 墨意显现默认时长（秒） */
  duration: 0.45,
  /** 书写/底线展开默认时长 */
  brushDuration: 0.55,
} as const;

export type InkTokens = typeof Ink;
