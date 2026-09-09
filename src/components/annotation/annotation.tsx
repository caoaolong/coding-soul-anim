import { Node, NodeProps, Rect } from "@motion-canvas/2d";
import {
  all,
  BBox,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";

export interface FocusBoxOptions {
  /** 包围盒相对物体外扩的边距，默认 Highlight.focusBox.padding */
  padding?: number;
  /** 高亮描边色，默认 Highlight.focusBox.color */
  color?: string;
  /** 描边宽度，默认 Highlight.focusBox.lineWidth */
  lineWidth?: number;
  /** 圆角，默认 Highlight.focusBox.radius */
  radius?: number;
  /** 闪烁总时长，默认 Highlight.focusBox.duration */
  duration?: number;
}

export interface AnnotationProps extends NodeProps {}

/**
 * 标注类动画组件。
 * 当前提供：对 N 个物体绘制外扩圆角矩形包围盒并闪烁一次以聚焦。
 */
export class Annotation extends Node {
  public constructor(props: AnnotationProps = {}) {
    super(props);
  }

  /**
   * 在给定物体之外画高亮圆角矩形包围盒，并闪烁一次。
   * @param targets 一个或多个 Motion Canvas 节点
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
    } = options;

    const worldBox = this.unionWorldBBox(list).expand(padding);
    const localBox = BBox.fromPoints(
      ...worldBox.transformCorners(this.worldToLocal()),
    );

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
        shadowColor={color}
        shadowBlur={0}
      />,
    );

    const up = duration * 0.35;
    const hold = duration * 0.25;
    const down = duration * 0.4;

    yield* all(
      box().opacity(1, up, easeOutCubic),
      box().lineWidth(lineWidth * 1.6, up, easeOutCubic),
      box().shadowBlur(18, up, easeOutCubic),
    );
    yield* all(
      box().lineWidth(lineWidth, hold, easeInOutCubic),
      box().shadowBlur(8, hold, easeInOutCubic),
    );
    yield* all(
      box().opacity(0, down, easeInOutCubic),
      box().shadowBlur(0, down, easeInOutCubic),
    );

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
