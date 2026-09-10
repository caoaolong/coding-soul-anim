import { Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  BBox,
  PossibleVector2,
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";

export type BraceSide = "top" | "bottom" | "left" | "right";

export interface BraceProps extends NodeProps {
  /**
   * 括号两端（贴近被标注物体的一侧）。
   * top/bottom：从左到右；left/right：从上到下。
   */
  from: PossibleVector2;
  to: PossibleVector2;
  /** 括号相对内容的方位，默认 top（在上方、尖朝下） */
  side?: BraceSide;
  /** 括号尖端/臂深，默认 18 */
  depth?: number;
  /** 中部尖角额外下探/外探，默认 depth * 0.55 */
  tip?: number;
  /** 可选文字标注 */
  label?: string;
  /** 标注相对括号外侧间距，默认 10 */
  labelGap?: number;
  stroke?: string;
  lineWidth?: number;
  labelFill?: string;
  fontSize?: number;
}

/**
 * 花括号标注：跨 from→to，尖端指向内容一侧，可选外侧文字。
 * 可用 end 动画绘出；show() 同时淡入文字。
 */
export class Brace extends Node {
  private readonly curve = createRef<Line>();
  private readonly labelTxt = createRef<Txt>();
  private readonly hasLabel: boolean;

  public constructor(props: BraceProps) {
    const {
      from,
      to,
      side = "top",
      depth = 18,
      tip,
      label,
      labelGap = 10,
      stroke = Highlight.muted,
      lineWidth = 3,
      labelFill = Ink.paperSoft,
      fontSize = 24,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.hasLabel = label != null && label.length > 0;
    const tipLen = tip ?? depth * 0.55;
    const a = new Vector2(from);
    const b = new Vector2(to);
    const { points, labelPos, labelOffset } = buildBraceGeometry(
      a,
      b,
      side,
      depth,
      tipLen,
      labelGap,
    );

    this.add(
      <Line
        ref={this.curve}
        points={points}
        stroke={stroke}
        lineWidth={lineWidth}
        lineCap={"round"}
        lineJoin={"round"}
        radius={Math.min(10, depth * 0.45)}
        end={0}
      />,
    );

    if (this.hasLabel) {
      this.add(
        <Txt
          ref={this.labelTxt}
          text={label!}
          x={labelPos.x}
          y={labelPos.y}
          offset={labelOffset}
          fill={labelFill}
          fontSize={fontSize}
          fontWeight={700}
          fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
          opacity={0}
        />,
      );
    }
  }

  /**
   * 绘出括号（并可淡入文字）。
   */
  public *show(duration = 0.45): ThreadGenerator {
    const tasks: ThreadGenerator[] = [
      this.curve().end(1, duration, easeInOutCubic),
    ];
    if (this.hasLabel) {
      tasks.push(this.labelTxt().opacity(1, duration, easeOutCubic));
    }
    yield* all(...tasks);
  }

  /** 收起括号与文字 */
  public *hide(duration = 0.35): ThreadGenerator {
    const tasks: ThreadGenerator[] = [
      this.curve().end(0, duration, easeInOutCubic),
    ];
    if (this.hasLabel) {
      tasks.push(this.labelTxt().opacity(0, duration * 0.6, easeInOutCubic));
    }
    yield* all(...tasks);
  }
}

/**
 * 在 parent 本地坐标系下，根据若干目标节点包围盒生成 from/to。
 */
export function braceEdgeFromNodes(
  parent: Node,
  targets: Node | Node[],
  side: BraceSide,
  padding = 6,
): { from: Vector2; to: Vector2 } {
  const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  if (list.length === 0) {
    return { from: Vector2.zero, to: Vector2.zero };
  }

  let world: BBox | null = null;
  for (const node of list) {
    const box = BBox.fromPoints(
      ...node.cacheBBox().transformCorners(node.localToWorld()),
    );
    world = world ? world.union(box) : box;
  }
  const expanded = (world ?? new BBox(0, 0, 0, 0)).expand(padding);
  const local = BBox.fromPoints(
    ...expanded.transformCorners(parent.worldToLocal()),
  );

  switch (side) {
    case "top":
      return {
        from: new Vector2(local.left, local.top),
        to: new Vector2(local.right, local.top),
      };
    case "bottom":
      return {
        from: new Vector2(local.left, local.bottom),
        to: new Vector2(local.right, local.bottom),
      };
    case "left":
      return {
        from: new Vector2(local.left, local.top),
        to: new Vector2(local.left, local.bottom),
      };
    case "right":
      return {
        from: new Vector2(local.right, local.top),
        to: new Vector2(local.right, local.bottom),
      };
  }
}

function buildBraceGeometry(
  from: Vector2,
  to: Vector2,
  side: BraceSide,
  depth: number,
  tip: number,
  labelGap: number,
): {
  points: PossibleVector2[];
  labelPos: Vector2;
  labelOffset: PossibleVector2;
} {
  const mid = from.add(to).scale(0.5);

  // outward：离开内容、朝向标注文字的方向
  let outward: Vector2;
  switch (side) {
    case "top":
      outward = new Vector2(0, -1);
      break;
    case "bottom":
      outward = new Vector2(0, 1);
      break;
    case "left":
      outward = new Vector2(-1, 0);
      break;
    case "right":
      outward = new Vector2(1, 0);
      break;
  }

  const barFrom = from.add(outward.scale(depth));
  const barTo = to.add(outward.scale(depth));
  const barMid = mid.add(outward.scale(depth));
  // 中尖朝向标注（外侧），两端臂朝向内容
  const tipPoint = mid.add(outward.scale(depth + tip));

  // 折线：端点臂 → 横杆 → 中尖（朝外）→ 横杆 → 端点臂
  const points: PossibleVector2[] = [
    from,
    barFrom,
    barMid,
    tipPoint,
    barMid,
    barTo,
    to,
  ];

  const labelPos = mid.add(outward.scale(depth + tip + labelGap));
  const labelOffset: PossibleVector2 =
    side === "top"
      ? [0, 1]
      : side === "bottom"
        ? [0, -1]
        : side === "left"
          ? [1, 0]
          : [-1, 0];

  return { points, labelPos, labelOffset };
}
