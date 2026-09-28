import { Line, Node, NodeProps, Rect } from "@motion-canvas/2d";
import {
  all,
  BBox,
  Color,
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
   * box：包围盒高亮
   * hud：科技感四角锁定框（半透底 + 虚线外框 + 角标描边）
   */
  style?: "underline" | "box" | "hud";
  /** 底线相对包围盒底边的额外下移，默认 10 */
  underlineGap?: number;
  /**
   * 仅 style='box' | 'hud'：多段行间高亮
   * - enter：淡入后停留（首行）
   * - move：移到新目标后停留（后续行）
   * - leave：淡出并移除（末行完成后）
   * 不传则单次：淡入 → 稍顿 → 淡出
   */
  phase?: "enter" | "move" | "leave";
  /** 仅 hud：角标臂长，默认随尺寸自适应 */
  cornerArm?: number;
  /** 仅 hud：半透底填充透明度，默认 0.12 */
  fillOpacity?: number;
}

export interface AnnotationProps extends NodeProps {}

/**
 * 标注类动画：默认以淡朱砂运笔底线圈点目标（水墨批注），
 * 亦可回退为完整包围盒，或使用科技感 HUD 锁定框。
 */
export class Annotation extends Node {
  /** style=box 且 phase 为 enter/move 时保持的包围盒 */
  private activeBox: Rect | null = null;
  /** style=hud 且 phase 为 enter/move 时保持的 HUD 根节点 */
  private activeHud: Node | null = null;

  public constructor(props: AnnotationProps = {}) {
    super(props);
  }

  /**
   * 聚焦给定物体：默认在并集包围盒底部落一笔朱砂底线。
   * phase='leave' 时可传空 targets，仅淡出当前框。
   */
  public *focusBox(
    targets: Node | Node[],
    options: FocusBoxOptions = {},
  ): ThreadGenerator {
    const {
      padding = Highlight.focusBox.padding,
      color = Highlight.focusBox.color,
      lineWidth = Highlight.focusBox.lineWidth,
      radius = Highlight.focusBox.radius,
      duration = Highlight.focusBox.duration,
      style = "underline",
      underlineGap = 10,
      phase,
      cornerArm,
      fillOpacity = Highlight.hud.fillOpacity,
    } = options;

    if ((style === "box" || style === "hud") && phase === "leave") {
      if (style === "hud") {
        yield* this.dismissHud(duration * 0.35);
      } else {
        yield* this.dismissRectBox(duration * 0.35);
      }
      return;
    }

    const list = (Array.isArray(targets) ? targets : [targets]).filter(
      Boolean,
    );
    if (list.length === 0) {
      return;
    }

    const worldBox = this.unionWorldBBox(list).expand(padding);
    const localBox = BBox.fromPoints(
      ...worldBox.transformCorners(this.worldToLocal()),
    );

    if (style === "hud") {
      yield* this.focusHudBox(localBox, {
        color,
        lineWidth,
        duration,
        phase,
        cornerArm,
        fillOpacity,
      });
      return;
    }

    if (style === "box") {
      yield* this.focusRectBox(localBox, {
        color,
        lineWidth,
        radius,
        duration,
        phase,
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

  /** 淡出并移除当前包围盒 / HUD（若无则立刻返回） */
  public *dismissBox(duration = 0.35): ThreadGenerator {
    yield* all(this.dismissRectBox(duration), this.dismissHud(duration));
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

  /**
   * 包围盒：
   * - enter：淡入停留
   * - move：移到新位置停留
   * - 默认：淡入 → 稍顿 → 淡出
   */
  private *focusRectBox(
    localBox: BBox,
    options: {
      color: string;
      lineWidth: number;
      radius: number;
      duration: number;
      phase?: "enter" | "move" | "leave";
    },
  ): ThreadGenerator {
    const { color, lineWidth, radius, duration, phase } = options;
    const cx = localBox.center.x;
    const cy = localBox.center.y;
    const w = Math.max(1, localBox.width);
    const h = Math.max(1, localBox.height);

    if (phase === "move" && this.activeBox) {
      const box = this.activeBox;
      yield* all(
        box.x(cx, duration, easeInOutCubic),
        box.y(cy, duration, easeInOutCubic),
        box.width(w, duration, easeInOutCubic),
        box.height(h, duration, easeInOutCubic),
      );
      return;
    }

    // enter / 默认 / move 但尚无框：新建
    this.clearActiveBox();
    const box = createRef<Rect>();
    this.add(
      <Rect
        ref={box}
        x={cx}
        y={cy}
        width={w}
        height={h}
        radius={radius}
        fill={null}
        stroke={color}
        lineWidth={lineWidth}
        opacity={0}
      />,
    );
    this.activeBox = box();

    if (phase === "enter" || phase === "move") {
      const fadeIn = Math.min(0.35, duration * 0.55);
      yield* box().opacity(1, fadeIn, easeOutCubic);
      return;
    }

    // 单次：淡入 → 稍顿 → 淡出
    const fadeIn = duration * 0.25;
    const hold = duration * 0.45;
    const fadeOut = duration * 0.3;
    yield* box().opacity(1, fadeIn, easeOutCubic);
    yield* waitFor(hold);
    yield* box().opacity(0, fadeOut, easeInOutCubic);
    this.clearActiveBox();
  }

  /**
   * 科技感 HUD：半透底 + 弱虚线外框 + 四角锁定描边 + 轻微辉光。
   */
  private *focusHudBox(
    localBox: BBox,
    options: {
      color: string;
      lineWidth: number;
      duration: number;
      phase?: "enter" | "move" | "leave";
      cornerArm?: number;
      fillOpacity: number;
    },
  ): ThreadGenerator {
    const { color, lineWidth, duration, phase, fillOpacity } = options;
    const cx = localBox.center.x;
    const cy = localBox.center.y;
    const w = Math.max(1, localBox.width);
    const h = Math.max(1, localBox.height);
    const arm =
      options.cornerArm ??
      Math.max(10, Math.min(22, Math.min(w, h) * 0.38));

    if (phase === "move" && this.activeHud) {
      yield* this.rebuildHud(this.activeHud, {
        cx,
        cy,
        w,
        h,
        arm,
        color,
        lineWidth,
        fillOpacity,
        animate: true,
        duration,
      });
      return;
    }

    this.clearActiveHud();
    const root = createRef<Node>();
    this.add(<Node ref={root} x={cx} y={cy} opacity={0} zIndex={20} />);
    this.activeHud = root();
    this.buildHudChildren(root(), {
      w,
      h,
      arm,
      color,
      lineWidth,
      fillOpacity,
      cornersEnd: 0,
    });

    const corners = root()
      .children()
      .filter((c): c is Line => c instanceof Line);

    if (phase === "enter" || phase === "move") {
      const fadeIn = Math.min(0.35, duration * 0.55);
      yield* all(
        root().opacity(1, fadeIn, easeOutCubic),
        ...corners.map((c) => c.end(1, fadeIn * 1.15, easeOutCubic)),
      );
      return;
    }

    const fadeIn = duration * 0.28;
    const hold = duration * 0.42;
    const fadeOut = duration * 0.3;
    yield* all(
      root().opacity(1, fadeIn, easeOutCubic),
      ...corners.map((c) => c.end(1, fadeIn * 1.2, easeOutCubic)),
    );
    yield* waitFor(hold);
    yield* root().opacity(0, fadeOut, easeInOutCubic);
    this.clearActiveHud();
  }

  private buildHudChildren(
    root: Node,
    opts: {
      w: number;
      h: number;
      arm: number;
      color: string;
      lineWidth: number;
      fillOpacity: number;
      cornersEnd: number;
    },
  ): void {
    const { w, h, arm, color, lineWidth, fillOpacity, cornersEnd } = opts;
    const hw = w / 2;
    const hh = h / 2;
    const fill = new Color(color).alpha(fillOpacity);

    root.add(
      <Rect
        width={w}
        height={h}
        fill={fill}
        stroke={null}
        shadowColor={color}
        shadowBlur={18}
        shadowOffset={[0, 0]}
      />,
    );
    root.add(
      <Rect
        width={w}
        height={h}
        fill={null}
        stroke={color}
        lineWidth={Math.max(1, lineWidth * 0.55)}
        opacity={0.35}
        lineDash={[5, 5]}
      />,
    );

    const corners: Array<Array<[number, number]>> = [
      [
        [-hw, -hh + arm],
        [-hw, -hh],
        [-hw + arm, -hh],
      ],
      [
        [hw, -hh + arm],
        [hw, -hh],
        [hw - arm, -hh],
      ],
      [
        [-hw, hh - arm],
        [-hw, hh],
        [-hw + arm, hh],
      ],
      [
        [hw, hh - arm],
        [hw, hh],
        [hw - arm, hh],
      ],
    ];

    for (const points of corners) {
      root.add(
        <Line
          points={points}
          stroke={color}
          lineWidth={lineWidth}
          lineCap={"square"}
          lineJoin={"miter"}
          end={cornersEnd}
          shadowColor={color}
          shadowBlur={10}
        />,
      );
    }
  }

  /** move 时重建 HUD 几何（保持可见），并补间根节点位移 */
  private *rebuildHud(
    root: Node,
    opts: {
      cx: number;
      cy: number;
      w: number;
      h: number;
      arm: number;
      color: string;
      lineWidth: number;
      fillOpacity: number;
      animate: boolean;
      duration: number;
    },
  ): ThreadGenerator {
    const { cx, cy, w, h, arm, color, lineWidth, fillOpacity, duration } =
      opts;
    // 清掉旧子节点，按新尺寸重建（保持 end=1）
    for (const child of [...root.children()]) {
      child.remove();
    }
    this.buildHudChildren(root, {
      w,
      h,
      arm,
      color,
      lineWidth,
      fillOpacity,
      cornersEnd: 1,
    });
    yield* all(
      root.x(cx, duration, easeInOutCubic),
      root.y(cy, duration, easeInOutCubic),
    );
  }

  private *dismissRectBox(duration: number): ThreadGenerator {
    const box = this.activeBox;
    if (!box) return;
    yield* box.opacity(0, duration, easeInOutCubic);
    this.clearActiveBox();
  }

  private *dismissHud(duration: number): ThreadGenerator {
    const hud = this.activeHud;
    if (!hud) return;
    yield* hud.opacity(0, duration, easeInOutCubic);
    this.clearActiveHud();
  }

  private clearActiveBox(): void {
    if (this.activeBox) {
      this.activeBox.remove();
      this.activeBox = null;
    }
  }

  private clearActiveHud(): void {
    if (this.activeHud) {
      this.activeHud.remove();
      this.activeHud = null;
    }
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
