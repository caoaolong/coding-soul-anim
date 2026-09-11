import { Line, Node, NodeProps, Rect } from "@motion-canvas/2d";
import {
  all,
  BBox,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  waitFor,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";
import { brushLine } from "../../theme/ink_anim";

export interface FocusBoxOptions {
  /** 相对物体外扩边距，默认 Highlight.focusBox.padding */
  padding?: number;
  /** 底线/描边色，默认淡朱砂 Ink.seal */
  color?: string;
  /** 线宽，默认 Highlight.focusBox.lineWidth */
  lineWidth?: number;
  /** 仅 style='box' 时使用 */
  radius?: number;
  /** 总时长，默认 Highlight.focusBox.duration */
  duration?: number;
  /**
   * underline：底部运笔底线（默认，水墨批注感）
   * box：旧式完整包围盒（兼容）
   */
  style?: "underline" | "box";
  /** 底线相对包围盒底边的额外下移，默认 10 */
  underlineGap?: number;
}

export interface AnnotationProps extends NodeProps {}

/**
 * 标注类动画：默认以淡朱砂运笔底线圈点目标（水墨批注），
 * 亦可回退为完整包围盒。
 */
export class Annotation extends Node {
  public constructor(props: AnnotationProps = {}) {
    super(props);
  }

  /**
   * 聚焦给定物体：默认在并集包围盒底部落一笔朱砂底线。
   */
  public *focusBox(
    targets: Node | Node[],
    options: FocusBoxOptions = {},
  ): ThreadGenerator {
    const list = (Array.isArray(targets) ? targets : [targets]).filter(
      Boolean,
    );
    if (list.length === 0) {
      return;
    }

    const {
      padding = Highlight.focusBox.padding,
      color = Highlight.focusBox.color,
      lineWidth = Highlight.focusBox.lineWidth,
      radius = Highlight.focusBox.radius,
      duration = Highlight.focusBox.duration,
      style = "underline",
      underlineGap = 10,
    } = options;

    const worldBox = this.unionWorldBBox(list).expand(padding);
    const localBox = BBox.fromPoints(
      ...worldBox.transformCorners(this.worldToLocal()),
    );

    if (style === "box") {
      yield* this.focusRectBox(localBox, {
        color,
        lineWidth,
        radius,
        duration,
      });
      return;
    }

    yield* this.focusUnderline(localBox, {
      color,
      lineWidth,
      duration,
      underlineGap,
    });
  }

  /** 底部运笔底线：自左向右书写，稍顿后淡出 */
  private *focusUnderline(
    localBox: BBox,
    options: {
      color: string;
      lineWidth: number;
      duration: number;
      underlineGap: number;
    },
  ): ThreadGenerator {
    const { color, lineWidth, duration, underlineGap } = options;
    const y = localBox.bottom + underlineGap;
    const left = localBox.left;
    const right = localBox.right;

    const line = createRef<Line>();
    this.add(
      <Line
        ref={line}
        points={[
          [left, y],
          [right, y],
        ]}
        stroke={color}
        lineWidth={lineWidth}
        lineCap={"round"}
        opacity={1}
        end={0}
      />,
    );

    const write = Math.min(Ink.brushDuration, duration * 0.45);
    const hold = duration * 0.3;
    const fade = duration * 0.25;

    yield* brushLine(line(), { duration: write });
    yield* waitFor(hold);
    yield* line().opacity(0, fade, easeInOutCubic);
    line().remove();
  }

  /** 兼容：完整包围盒闪烁 */
  private *focusRectBox(
    localBox: BBox,
    options: {
      color: string;
      lineWidth: number;
      radius: number;
      duration: number;
    },
  ): ThreadGenerator {
    const { color, lineWidth, radius, duration } = options;
    const box = createRef<Rect>();
    this.add(
      <Rect
        ref={box}
        x={localBox.center.x}
        y={localBox.center.y}
        width={Math.max(1, localBox.width)}
        height={Math.max(1, localBox.height)}
        radius={radius}
        fill={null}
        stroke={color}
        lineWidth={lineWidth}
        opacity={0}
      />,
    );

    const up = duration * 0.35;
    const hold = duration * 0.25;
    const down = duration * 0.4;

    yield* all(
      box().opacity(1, up, easeOutCubic),
      box().lineWidth(lineWidth * 1.35, up, easeOutCubic),
    );
    yield* box().lineWidth(lineWidth, hold, easeInOutCubic);
    yield* box().opacity(0, down, easeInOutCubic);
    box().remove();
  }

  /** 计算节点在世界坐标下的包围盒并取并集 */
  private unionWorldBBox(nodes: Node[]): BBox {
    let result: BBox | null = null;
    for (const node of nodes) {
      const box = BBox.fromPoints(
        ...node.cacheBBox().transformCorners(node.localToWorld()),
      );
      result = result ? result.union(box) : box;
    }
    return result ?? new BBox(0, 0, 0, 0);
  }
}
