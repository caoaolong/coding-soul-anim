import {
  CubicBezier,
  Img,
  Layout,
  Node,
  NodeProps,
  Txt,
} from "@motion-canvas/2d";
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  sequence,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';

export interface MindMapNodeData {
  /** 节点文案 */
  label: string;
  /** 可选图标；省略则仅文字 */
  icon?: string;
}

/** 更新内容：可只改图标或只改文案；`icon: null` 隐藏图标 */
export interface MindMapNodeUpdate {
  icon?: string | null;
  label?: string;
}

/** `"root"` / `"result"` / 中间子节点下标 */
export type MindMapNodeTarget = "root" | "result" | number;

export interface MindMapProps extends NodeProps {
  /** 根节点 */
  root: MindMapNodeData;
  /** 根/子节点图标边长，默认 72 */
  iconSize?: number;
  /** 文案字号，默认 32 */
  fontSize?: number;
  /**
   * 三列间距（根←→子、子←→结论），默认 360。
   * 布局：根在左、子在中、结论在右。
   */
  branchGap?: number;
  /** 子节点垂直间距，默认 88 */
  childGap?: number;
  /** 连线线宽，默认 Ink.lineWidth */
  lineWidth?: number;
  /** 箭头大小，默认 14 */
  arrowSize?: number;
  /** 连线端点相对节点内容的留白，默认 36 */
  edgePadding?: number;
}

/**
 * 思维导图：左根 → 中子节点 → 右结论；支持图标+文字或纯文字。
 * 连线为三次贝塞尔曲线箭头，与节点保持间距。
 */
export class MindMap extends Node {
  private readonly rootBlock = createRef<Layout>();
  private readonly rootImg = createRef<Img>();
  private readonly rootLabel = createRef<Txt>();

  private readonly childBlocks = createRefArray<Layout>();
  private readonly childImgs = createRefArray<Img>();
  private readonly childLabels = createRefArray<Txt>();
  private readonly edges = createRefArray<CubicBezier>();

  private readonly resultEdges = createRefArray<CubicBezier>();
  private resultBlock: Layout | null = null;
  private readonly resultImg = createRef<Img>();
  private readonly resultLabel = createRef<Txt>();

  private readonly iconSize: number;
  private readonly fontSize: number;
  private readonly branchGap: number;
  private readonly childGap: number;
  private readonly lineWidth: number;
  private readonly arrowSize: number;
  private readonly edgePadding: number;
  private readonly rootX: number;
  private readonly childX: number;
  private readonly resultX: number;

  public constructor(props: MindMapProps) {
    const {
      root,
      iconSize = 72,
      fontSize = 32,
      branchGap = 360,
      childGap = 88,
      lineWidth = Ink.lineWidth,
      arrowSize = 14,
      edgePadding = 36,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.iconSize = iconSize;
    this.fontSize = fontSize;
    this.branchGap = branchGap;
    this.childGap = childGap;
    this.lineWidth = lineWidth;
    this.arrowSize = arrowSize;
    this.edgePadding = edgePadding;
    // 三列：根 | 子 | 结论
    this.rootX = -branchGap;
    this.childX = 0;
    this.resultX = branchGap;

    this.add(
      this.buildNodeBlock(
        this.rootBlock,
        this.rootImg,
        this.rootLabel,
        root,
        this.rootX,
        0,
        "column",
      ),
    );
  }

  /** 显现根节点 */
  public *showRoot(duration: number = Ink.duration): ThreadGenerator {
    yield* inkReveal(this.rootBlock(), { duration, fromY: 12 });
  }

  /**
   * 追加一个中间子节点：重排已有子节点 → 运笔曲线箭头 → 墨晕显现。
   */
  public *addChild(
    data: MindMapNodeData,
    duration: number = 0.5,
  ): ThreadGenerator {
    const nextCount = this.childBlocks.length + 1;
    const targets = this.childYs(nextCount);

    const move: ThreadGenerator[] = [];
    for (let i = 0; i < this.childBlocks.length; i++) {
      move.push(
        this.childBlocks[i].position(
          new Vector2(this.childX, targets[i]),
          duration * 0.55,
          easeInOutCubic,
        ),
      );
      move.push(this.retargetRootEdge(i, targets[i], duration * 0.55));
    }
    if (move.length > 0) {
      yield* all(...move);
    }

    const y = targets[nextCount - 1];
    const block = createRef<Layout>();
    const img = createRef<Img>();
    const label = createRef<Txt>();
    const edge = createRef<CubicBezier>();
    const { p0, p1, p2, p3 } = this.rootToChildHandles(y);

    this.add(
      <CubicBezier
        ref={edge}
        p0={p0}
        p1={p1}
        p2={p2}
        p3={p3}
        stroke={Ink.goldSoft}
        lineWidth={this.lineWidth}
        lineCap={"round"}
        endArrow
        arrowSize={this.arrowSize}
        end={0}
        opacity={1}
      />,
    );
    this.add(
      this.buildNodeBlock(block, img, label, data, this.childX, y, "row"),
    );

    this.edges.push(edge());
    this.childBlocks.push(block());
    this.childImgs.push(img());
    this.childLabels.push(label());

    const draw = Math.min(Ink.brushDuration, duration * 0.55);
    edge().end(0);
    yield* edge().end(1, draw, easeOutCubic);
    yield* inkReveal(block(), { duration: duration * 0.65, fromY: 10 });
  }

  /** 连续添加多个中间子节点 */
  public *addChildren(
    items: MindMapNodeData[],
    stepDuration: number = 0.5,
    pause: number = 0.2,
  ): ThreadGenerator {
    for (let i = 0; i < items.length; i++) {
      yield* this.addChild(items[i], stepDuration);
      if (i < items.length - 1 && pause > 0) {
        yield* waitFor(pause);
      }
    }
  }

  /**
   * 在最右侧添加结论节点：各子节点汇聚曲线箭头 → 显现结论。
   */
  public *addResult(
    data: MindMapNodeData,
    duration: number = 0.55,
  ): ThreadGenerator {
    if (this.resultBlock) {
      throw new Error("MindMap.addResult: 结论节点已存在");
    }
    if (this.childBlocks.length === 0) {
      throw new Error("MindMap.addResult: 请先添加子节点");
    }

    const block = createRef<Layout>();
    this.add(
      this.buildNodeBlock(
        block,
        this.resultImg,
        this.resultLabel,
        data,
        this.resultX,
        0,
        "column",
      ),
    );
    this.resultBlock = block();

    const drawTasks: ThreadGenerator[] = [];
    for (let i = 0; i < this.childBlocks.length; i++) {
      const y = this.childBlocks[i].y();
      const edge = createRef<CubicBezier>();
      const { p0, p1, p2, p3 } = this.childToResultHandles(y);
      this.add(
        <CubicBezier
          ref={edge}
          p0={p0}
          p1={p1}
          p2={p2}
          p3={p3}
          stroke={Ink.goldSoft}
          lineWidth={this.lineWidth}
          lineCap={"round"}
          endArrow
          arrowSize={this.arrowSize}
          end={0}
          opacity={1}
        />,
      );
      this.resultEdges.push(edge());
      const draw = Math.min(Ink.brushDuration, duration * 0.45);
      drawTasks.push(
        (function* () {
          edge().end(0);
          yield* edge().end(1, draw, easeOutCubic);
        })(),
      );
    }

    yield* sequence(0.06, ...drawTasks);
    yield* inkReveal(block(), { duration: duration * 0.7, fromY: 12 });
  }

  /**
   * 更新节点图标/文案：淡出变更项 → 换内容 → 淡入。
   * @param target `"root"` | `"result"` | 中间子节点下标
   */
  public *updateNode(
    target: MindMapNodeTarget,
    next: MindMapNodeUpdate,
    duration: number = 0.45,
  ): ThreadGenerator {
    if (next.icon === undefined && next.label === undefined) {
      return;
    }

    const parts = this.resolveNodeParts(target);
    const half = duration * 0.5;
    const fadeOut: ThreadGenerator[] = [];
    const fadeIn: ThreadGenerator[] = [];

    const changeIcon = next.icon !== undefined;
    const changeLabel = next.label !== undefined;

    if (changeIcon) {
      fadeOut.push(parts.img.opacity(0, half, easeInOutCubic));
    }
    if (changeLabel) {
      fadeOut.push(parts.label.opacity(0, half, easeInOutCubic));
      fadeIn.push(parts.label.opacity(1, half, easeInOutCubic));
    }

    yield* all(...fadeOut);

    if (changeIcon) {
      if (next.icon === null || next.icon === "") {
        parts.img.src(null);
        parts.img.width(0);
        // 保持透明，不再淡入
      } else {
        parts.img.src(next.icon);
        parts.img.width(parts.iconWidth);
        fadeIn.push(parts.img.opacity(1, half, easeInOutCubic));
      }
    }
    if (changeLabel) {
      parts.label.text(next.label!);
    }

    if (fadeIn.length > 0) {
      yield* all(...fadeIn);
    }
  }

  private resolveNodeParts(target: MindMapNodeTarget): {
    img: Img;
    label: Txt;
    iconWidth: number;
  } {
    if (target === "root") {
      return {
        img: this.rootImg(),
        label: this.rootLabel(),
        iconWidth: this.iconSize,
      };
    }
    if (target === "result") {
      if (!this.resultBlock) {
        throw new Error("MindMap.updateNode: 结论节点尚不存在");
      }
      return {
        img: this.resultImg(),
        label: this.resultLabel(),
        iconWidth: this.iconSize,
      };
    }
    if (typeof target !== "number" || target < 0 || target >= this.childBlocks.length) {
      throw new Error(
        `MindMap.updateNode: 子节点下标 ${String(target)} 越界（共 ${this.childBlocks.length} 个）`,
      );
    }
    return {
      img: this.childImgs[target],
      label: this.childLabels[target],
      iconWidth: this.iconSize * 0.7,
    };
  }

  private buildNodeBlock(
    blockRef: ReturnType<typeof createRef<Layout>>,
    imgRef: ReturnType<typeof createRef<Img>>,
    labelRef: ReturnType<typeof createRef<Txt>>,
    data: MindMapNodeData,
    x: number,
    y: number,
    direction: "row" | "column",
  ) {
    const iconW = direction === "column" ? this.iconSize : this.iconSize * 0.7;
    const hasIcon = Boolean(data.icon);
    return (
      <Layout
        ref={blockRef}
        layout
        direction={direction}
        alignItems={"center"}
        gap={14}
        x={x}
        y={y}
        opacity={0}
      >
        <Img
          ref={imgRef}
          src={data.icon ?? null}
          width={hasIcon ? iconW : 0}
          opacity={hasIcon ? 1 : 0}
        />
        <Txt
          ref={labelRef}
          text={data.label}
          fontFamily={LABEL_FONT}
          fontSize={this.fontSize}
          fill={Ink.paper}
          textAlign={"center"}
        />
      </Layout>
    );
  }

  private childYs(count: number): number[] {
    if (count <= 0) return [];
    const ys: number[] = [];
    for (let i = 0; i < count; i++) {
      ys.push((i - (count - 1) / 2) * this.childGap);
    }
    return ys;
  }

  private rootExitX(): number {
    const half = Math.max(this.iconSize, this.fontSize * 2.4) / 2;
    return this.rootX + half + this.edgePadding;
  }

  private childEnterX(): number {
    const half = Math.max(this.iconSize * 0.35, this.fontSize * 2.8);
    return this.childX - half - this.edgePadding;
  }

  private childExitX(): number {
    const half = Math.max(this.iconSize * 0.35, this.fontSize * 2.8);
    return this.childX + half + this.edgePadding;
  }

  private resultEnterX(): number {
    const half = Math.max(this.iconSize, this.fontSize * 2.4) / 2;
    return this.resultX - half - this.edgePadding;
  }

  private curveHandles(
    from: Vector2,
    to: Vector2,
  ): { p0: Vector2; p1: Vector2; p2: Vector2; p3: Vector2 } {
    const dx = to.x - from.x;
    return {
      p0: from,
      p1: new Vector2(from.x + dx * 0.55, from.y),
      p2: new Vector2(to.x - dx * 0.55, to.y),
      p3: to,
    };
  }

  private rootToChildHandles(childY: number) {
    return this.curveHandles(
      new Vector2(this.rootExitX(), 0),
      new Vector2(this.childEnterX(), childY),
    );
  }

  private childToResultHandles(childY: number) {
    return this.curveHandles(
      new Vector2(this.childExitX(), childY),
      new Vector2(this.resultEnterX(), 0),
    );
  }

  private *retargetRootEdge(
    index: number,
    childY: number,
    duration: number,
  ): ThreadGenerator {
    const edge = this.edges[index];
    const { p0, p1, p2, p3 } = this.rootToChildHandles(childY);
    yield* all(
      edge.p0(p0, duration, easeInOutCubic),
      edge.p1(p1, duration, easeInOutCubic),
      edge.p2(p2, duration, easeInOutCubic),
      edge.p3(p3, duration, easeInOutCubic),
    );
  }
}
