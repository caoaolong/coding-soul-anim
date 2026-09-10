import { Shape, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  easeInOutCubic,
} from "@motion-canvas/core";
import { Highlight } from "./highlight";

export interface HighlightShapeOptions {
  /** 高亮填充色，默认 Highlight.fill */
  fill?: string;
  /** 高亮描边色，默认 Highlight.stroke */
  stroke?: string;
  /**
   * 峰值描边宽；默认不改描边宽度。
   * 仅在显式传入时才会加粗。
   */
  lineWidthPeak?: number;
  /** 峰值缩放，默认 Highlight.scalePeak；传 1 关闭缩放 */
  scalePeak?: number;
  /** 过渡时长（秒），默认 Highlight.duration */
  duration?: number;
  /** 高亮后是否复原，默认 false */
  recovery?: boolean;
}

export interface PulseTxtOptions {
  /** 脉冲色，默认 Highlight.accent */
  color?: string;
  /** 复原色，默认 #FFFFFF */
  restore?: string;
  /** 总时长（秒） */
  duration?: number;
  /** 峰值缩放，默认 1.2 */
  scalePeak?: number;
}

/**
 * 对一个或多个 Shape（Circle / Rect 等）做统一自身高亮：
 * fill + stroke + 轻微缩放（默认不加粗描边）。
 */
export function* highlightShapes(
  nodes: Shape | Shape[],
  options: HighlightShapeOptions = {},
): ThreadGenerator {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const {
    fill = Highlight.fill,
    stroke = Highlight.stroke,
    lineWidthPeak,
    scalePeak = Highlight.scalePeak,
    duration = Highlight.duration,
    recovery = false,
  } = options;

  const prev = list.map((node) => ({
    fill: node.fill(),
    stroke: node.stroke(),
    lineWidth: node.lineWidth(),
    scale: node.scale(),
  }));

  const scaleTasks =
    scalePeak === 1
      ? []
      : list.map((node) =>
          node.scale(scalePeak, duration * 0.5).to(1, duration * 0.5),
        );

  yield* all(
    ...list.flatMap((node) => {
      const tasks: ThreadGenerator[] = [
        node.fill(fill, duration),
        node.stroke(stroke, duration),
      ];
      if (lineWidthPeak != null) {
        tasks.push(node.lineWidth(lineWidthPeak, duration));
      }
      return tasks;
    }),
    ...scaleTasks,
  );

  if (recovery) {
    yield* all(
      ...list.flatMap((node, i) => {
        const tasks: ThreadGenerator[] = [
          node.fill(prev[i].fill, duration),
          node.stroke(prev[i].stroke, duration),
          node.scale(prev[i].scale, duration),
        ];
        if (lineWidthPeak != null) {
          tasks.push(node.lineWidth(prev[i].lineWidth, duration));
        }
        return tasks;
      }),
    );
  }
}

/**
 * 自身高亮脉冲：变色/缩放后自动回到原样（默认不加粗描边）。
 */
export function* pulseShapes(
  nodes: Shape | Shape[],
  options: HighlightShapeOptions = {},
): ThreadGenerator {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const {
    fill = Highlight.fill,
    stroke = Highlight.stroke,
    lineWidthPeak,
    scalePeak = Highlight.scalePeak,
    duration = Highlight.duration,
  } = options;

  const prev = list.map((node) => ({
    fill: node.fill(),
    stroke: node.stroke(),
    lineWidth: node.lineWidth(),
  }));

  const up = duration * 0.35;
  const down = duration * 0.65;

  yield* all(
    ...list.flatMap((node, i) => {
      const tasks: ThreadGenerator[] = [
        node.fill(fill, up, easeInOutCubic).to(prev[i].fill, down, easeInOutCubic),
        node
          .stroke(stroke, up, easeInOutCubic)
          .to(prev[i].stroke, down, easeInOutCubic),
      ];
      if (lineWidthPeak != null) {
        tasks.push(
          node
            .lineWidth(lineWidthPeak, up, easeInOutCubic)
            .to(prev[i].lineWidth, down, easeInOutCubic),
        );
      }
      if (scalePeak !== 1) {
        tasks.push(
          node.scale(scalePeak, up, easeInOutCubic).to(1, down, easeInOutCubic),
        );
      }
      return tasks;
    }),
  );
}

/**
 * 文字强调脉冲（变色 + 缩放后复原），用于标签/bit 数字等。
 */
export function* pulseTxt(
  texts: Txt | Txt[],
  options: PulseTxtOptions = {},
): ThreadGenerator {
  const list = (Array.isArray(texts) ? texts : [texts]).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  const {
    color = Highlight.accent,
    restore = "#E8E0D0",
    duration = Highlight.duration,
    scalePeak = 1.06,
  } = options;

  const up = duration * 0.35;
  const down = duration * 0.65;

  yield* all(
    ...list.map((txt) =>
      all(
        txt.fill(color, up, easeInOutCubic).to(restore, down, easeInOutCubic),
        txt.scale(scalePeak, up, easeInOutCubic).to(1, down, easeInOutCubic),
      ),
    ),
  );
}
