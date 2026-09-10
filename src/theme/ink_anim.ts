import { Line, Node, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  easeInOutCubic,
  easeOutCubic,
} from "@motion-canvas/core";
import { Ink } from "./ink";

export interface InkRevealOptions {
  /** 目标透明度，默认 1 */
  opacity?: number;
  /** 上移距离（px），默认 12；传 0 关闭位移 */
  fromY?: number;
  /** 时长（秒），默认 Ink.duration */
  duration?: number;
}

export interface BrushWidthOptions {
  /** 展开时长，默认 Ink.brushDuration */
  duration?: number;
}

export interface InkPulseTxtOptions {
  /** 脉冲色，默认 Ink.goldSoft */
  color?: string;
  /** 复原色，默认 Ink.paper */
  restore?: string;
  /** 总时长（秒） */
  duration?: number;
  /** 峰值缩放，默认 1.03（几乎不弹） */
  scalePeak?: number;
}

/**
 * 墨晕显现：淡入 + 轻上移，无缩放弹跳。
 * 适合系列名、批注、节点整组入场。
 */
export function* inkReveal(
  nodes: Node | Node[],
  options: InkRevealOptions = {},
): ThreadGenerator {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const {
    opacity = 1,
    fromY = 12,
    duration = Ink.duration,
  } = options;

  if (fromY !== 0) {
    for (const node of list) {
      node.y(node.y() - fromY);
    }
  }

  yield* all(
    ...list.map((node) => {
      const targetY = node.y() + fromY;
      const tasks: ThreadGenerator[] = [
        node.opacity(opacity, duration, easeOutCubic),
      ];
      if (fromY !== 0) {
        tasks.push(node.y(targetY, duration, easeOutCubic));
      }
      return all(...tasks);
    }),
  );
}

/**
 * 墨色隐去：仅透明度，无位移。
 */
export function* inkFade(
  nodes: Node | Node[],
  options: { opacity?: number; duration?: number } = {},
): ThreadGenerator {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const { opacity = 0, duration = Ink.duration } = options;

  yield* all(
    ...list.map((node) => node.opacity(opacity, duration, easeOutCubic)),
  );
}

/**
 * 运笔：Rect 宽度从当前值写到 target（底线、进度条）。
 * 调用前请设好起始 width（多为 0）。
 */
export function* brushWidth(
  rect: Rect,
  targetWidth: number,
  options: BrushWidthOptions = {},
): ThreadGenerator {
  const { duration = Ink.brushDuration } = options;
  yield* rect.width(targetWidth, duration, easeOutCubic);
}

/**
 * 运笔：Line 的 end 从 0 写到 1（轴线、连接线、括号线段）。
 */
export function* brushLine(
  line: Line,
  options: BrushWidthOptions = {},
): ThreadGenerator {
  const { duration = Ink.brushDuration } = options;
  line.end(0);
  yield* line.end(1, duration, easeOutCubic);
}

/**
 * 文字墨金脉冲：淡金一闪后回到纸色，默认几乎不缩放。
 */
export function* inkPulseTxt(
  texts: Txt | Txt[],
  options: InkPulseTxtOptions = {},
): ThreadGenerator {
  const list = (Array.isArray(texts) ? texts : [texts]).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const {
    color = Ink.goldSoft,
    restore = Ink.paper,
    duration = Ink.duration,
    scalePeak = 1.03,
  } = options;

  const up = duration * 0.35;
  const down = duration * 0.65;

  yield* all(
    ...list.map((txt) => {
      const tasks: ThreadGenerator[] = [
        txt.fill(color, up, easeInOutCubic).to(restore, down, easeInOutCubic),
      ];
      if (scalePeak !== 1) {
        tasks.push(
          txt.scale(scalePeak, up, easeInOutCubic).to(1, down, easeInOutCubic),
        );
      }
      return all(...tasks);
    }),
  );
}
