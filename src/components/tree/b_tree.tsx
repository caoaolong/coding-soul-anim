import { Latex, Line, Node, NodeProps, Ray } from "@motion-canvas/2d";
import {
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  sequence,
  ThreadGenerator,
  waitFor,
} from "@motion-canvas/core";
import { Brace } from "../annotation/brace";
import { Ink } from "../../theme/ink";
import { Highlight } from "../../theme/highlight";
import { highlightShapes } from "../../theme/highlight_anim";
import { brushLine } from "../../theme/ink_anim";
import { TreeNode } from "./tree_node";

export interface BTreeProps extends NodeProps {
  /** 二叉树层数 */
  L?: number;
  /** 节点间距 */
  spacing?: number;
  /** 节点尺寸 */
  nodeSize?: number;
  /**
   * 节点文案样式：
   * - node：`Node x`（默认）
   * - number：仅数字
   */
  labelStyle?: "node" | "number";
  /** 起始编号，默认 1；配合 number 常用 0 */
  startIndex?: 0 | 1;
  /**
   * 左侧行标注：
   * - i：`i=0,1,…`（默认）
   * - i/order：`i/order=0,1,…`
   */
  rowLabel?: "i" | "i/order";
}

export class BTree extends Node {
  public readonly nodes = createRefArray<TreeNode>();
  public readonly edges = createRefArray<Ray>();
  public readonly rowNumbers = createRefArray<Latex>();
  private readonly heightBrace = createRef<Brace>();
  private readonly levels: number;
  private readonly nodeSize: number;
  private readonly rowYs: number[];
  /** 逐行扫描时的运笔横线 */
  private rowLine: Line | null = null;

  public constructor(props?: BTreeProps) {
    const {
      L = 4,
      spacing = 36,
      nodeSize = 72,
      labelStyle = "node",
      startIndex = 1,
      rowLabel = "i",
      ...nodeProps
    } = props ?? {};

    super(nodeProps);
    this.levels = L;
    this.nodeSize = nodeSize;

    // 以最底层叶子总宽为基准，上层按槽位均分，父节点落在子节点中点正上方
    const leafCount = Math.pow(2, L - 1);
    const treeWidth = leafCount * nodeSize + (leafCount - 1) * spacing;
    const treeHeight = L * nodeSize + (L - 1) * spacing;
    const startY = -treeHeight / 2 + nodeSize / 2;
    const radius = nodeSize / 2;
    const labelGap =
      rowLabel === "i/order"
        ? Math.max(110, Math.round(nodeSize * 1.25))
        : Math.max(40, Math.round(nodeSize * 0.7));
    const labelFontSize =
      rowLabel === "i/order"
        ? Math.max(18, Math.round(nodeSize * 0.3))
        : Math.max(22, Math.round(nodeSize * 0.38));
    const bracePad = Math.max(16, Math.round(nodeSize * 0.22));

    const positions: { x: number; y: number }[] = [];
    const rowYs: number[] = [];
    for (let level = 0; level < L; level++) {
      // N代表当前行有多少个节点
      const N = Math.pow(2, level);
      const slotWidth = treeWidth / N;
      const y = startY + level * (nodeSize + spacing);
      rowYs.push(y);

      for (let j = 0; j < N; j++) {
        positions.push({
          x: -treeWidth / 2 + (j + 0.5) * slotWidth,
          y,
        });
      }
    }
    this.rowYs = rowYs;

    // 先画箭头（在节点下方），从父节点底边指向子节点顶边
    for (let i = 1; i < positions.length; i++) {
      const parentIndex = Math.floor((i + 1) / 2) - 1;
      const parent = positions[parentIndex];
      const child = positions[i];

      this.add(
        <Ray
          ref={this.edges}
          from={[parent.x, parent.y + radius]}
          to={[child.x, child.y - radius]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
          endArrow
          arrowSize={12}
        />,
      );
    }

    // 构建组件 UI 结构：节点叠在箭头之上
    for (let i = 0; i < positions.length; i++) {
      const { x, y } = positions[i];
      const num = startIndex + i;
      const title =
        labelStyle === "number" ? String(num) : `Node ${num}`;

      this.add(
        <TreeNode
          ref={this.nodes}
          title={title}
          size={nodeSize}
          x={x}
          y={y}
        />,
      );
    }

    // 左侧行号（初始隐藏）
    for (let level = 0; level < L; level++) {
      const y = rowYs[level];
      const tex =
        rowLabel === "i/order"
          ? `{\\mathrm{i/order}=${level}}`
          : `{i=${level}}`;

      this.add(
        <Latex
          ref={this.rowNumbers}
          tex={tex}
          fill={Ink.paper}
          fontSize={labelFontSize}
          x={-treeWidth / 2 - labelGap}
          y={y}
          opacity={0}
          offset={[1, 0]}
        />,
      );
    }

    // 右侧整树大括号：总深度 h=L
    const braceX = treeWidth / 2 + bracePad;
    this.add(
      <Brace
        ref={this.heightBrace}
        from={[braceX, rowYs[0] - nodeSize / 2]}
        to={[braceX, rowYs[L - 1] + nodeSize / 2]}
        side={"right"}
        depth={20}
        label={`h=${L}`}
        labelGap={14}
        stroke={Ink.goldSoft}
        lineWidth={Ink.lineWidth}
        labelFill={Ink.paper}
        fontSize={labelFontSize}
      />,
    );
  }

  public get levelCount(): number {
    return this.levels;
  }

  /** 层 level（从 0）上全部节点下标 */
  public levelIndices(level: number): number[] {
    const start = Math.pow(2, level) - 1;
    const n = Math.pow(2, level);
    return Array.from({ length: n }, (_, j) => start + j);
  }

  /** 当前行横线几何：贴该层节点底边，宽度随该层节点跨度 */
  private rowLineGeom(level: number): {
    left: number;
    right: number;
    y: number;
  } {
    const indices = this.levelIndices(level);
    const radius = this.nodeSize / 2;
    const pad = Math.max(10, Math.round(this.nodeSize * 0.12));
    const xs = indices.map((i) => this.nodes[i].x());
    const left = Math.min(...xs) - radius - pad;
    const right = Math.max(...xs) + radius + pad;
    const y =
      this.rowYs[level] + radius + Math.max(8, Math.round(this.nodeSize * 0.1));
    return { left, right, y };
  }

  /**
   * 从根节点开始，逐层分裂展开直到显示全部节点。
   * @param duration 每一层展开的时长（秒）
   */
  public *create(duration = 0.5): ThreadGenerator {
    const count = this.nodes.length;
    if (count === 0) {
      return;
    }

    // 记录最终布局位置
    const finals = this.nodes.map((node) => ({
      x: node.x(),
      y: node.y(),
    }));

    // 初始：箭头收起；根节点缩为 0；其余节点叠在父节点位置并隐藏
    for (const edge of this.edges) {
      edge.end(0);
    }
    this.nodes[0].scale(0);
    for (let i = 1; i < count; i++) {
      const parentIndex = Math.floor((i + 1) / 2) - 1;
      this.nodes[i].position([finals[parentIndex].x, finals[parentIndex].y]);
      this.nodes[i].scale(0);
    }

    // 根节点出现
    yield* this.nodes[0].scale(1, duration);

    // 逐层从父节点位置分裂到最终位置，同时展开对应箭头
    for (let level = 1; level < this.levels; level++) {
      const start = Math.pow(2, level) - 1;
      const n = Math.pow(2, level);
      const tasks: ThreadGenerator[] = [];

      for (let j = 0; j < n; j++) {
        const i = start + j;
        const node = this.nodes[i];
        tasks.push(
          all(
            node.position([finals[i].x, finals[i].y], duration),
            node.scale(1, duration),
            this.edges[i - 1].end(1, duration),
          ),
        );
      }

      yield* all(...tasks);
    }
  }

  /**
   * 在每行左侧依次显示行号 i=0,1,…。
   * @param duration 每一行出现的时长（秒）
   */
  public *rowNumber(duration = 0.4): ThreadGenerator {
    yield* sequence(
      duration * 0.35,
      ...this.rowNumbers.map((label) => label.opacity(1, duration)),
    );
  }

  /**
   * 在树右侧绘出总深度大括号 h=L。
   */
  public *showHeight(duration = 0.55): ThreadGenerator {
    yield* this.heightBrace().show(duration);
  }

  /** 额外高亮右侧 h=L 括号与标注 */
  public *highlightHeight(duration = 0.55): ThreadGenerator {
    yield* this.heightBrace().pulse(duration, Ink.seal);
  }

  /**
   * 额外依次高亮左侧行号 i=0,1,…（已显示后调用）。
   */
  public *highlightRowNumbers(duration = 0.45): ThreadGenerator {
    for (const label of this.rowNumbers) {
      yield* pulseLatex(label, duration, Ink.seal, Ink.paper);
      yield* waitFor(0.12);
    }
  }

  /**
   * 横线标注某一行：
   * - enter：运笔画出
   * - move：下移并适配该行宽度
   * - leave：淡出移除
   */
  public *annotateRow(
    level: number,
    phase: "enter" | "move" | "leave",
    duration = 0.5,
  ): ThreadGenerator {
    if (phase === "leave") {
      if (!this.rowLine) return;
      yield* this.rowLine.opacity(0, duration, easeInOutCubic);
      this.rowLine.remove();
      this.rowLine = null;
      return;
    }

    const { left, right, y } = this.rowLineGeom(level);

    if (phase === "move" && this.rowLine) {
      yield* this.rowLine.points(
        [
          [left, y],
          [right, y],
        ],
        duration,
        easeInOutCubic,
      );
      return;
    }

    // enter：新建并运笔
    if (this.rowLine) {
      this.rowLine.remove();
      this.rowLine = null;
    }
    const line = createRef<Line>();
    this.add(
      <Line
        ref={line}
        points={[
          [left, y],
          [right, y],
        ]}
        stroke={Ink.seal}
        lineWidth={3}
        lineCap={"round"}
        opacity={1}
        end={0}
      />,
    );
    this.rowLine = line();
    yield* brushLine(line(), { duration });
  }

  /**
   * 高亮某一层全部节点（可复原）。
   */
  public *highlightLevel(
    level: number,
    recovery = true,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    yield* this.highlightMany(this.levelIndices(level), recovery, duration);
  }

  /**
   * 高亮某非叶节点及其左右孩子（数组下标，0 起）。
   * 孩子：左 2p+1，右 2p+2。
   */
  public *highlightFamily(
    parentIndex: number,
    recovery = true,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    const left = 2 * parentIndex + 1;
    const right = 2 * parentIndex + 2;
    yield* this.highlightMany([parentIndex, left, right], recovery, duration);
  }

  /** 非叶子节点个数（层序下标 0 .. 2^{L-1}-2） */
  public get nonLeafCount(): number {
    return Math.pow(2, this.levels - 1) - 1;
  }

  /** 脉冲指定行的 i= 标注 */
  public *pulseRowNumber(level: number, duration = 0.4): ThreadGenerator {
    const label = this.rowNumbers[level];
    if (!label) return;
    yield* pulseLatex(label, duration, Ink.seal, Ink.paper);
  }

  /**
   * 一次性将全部节点文案改为 Index=0,1,2,…（层序，从 0 起）。
   * @param duration 淡入改写时长（秒）
   */
  public *index(duration = 0.35): ThreadGenerator {
    yield* all(
      ...Array.from({ length: this.nodes.length }, (_, i) =>
        this.nodes[i].setTitle(`Index=${i}`, duration),
      ),
    );
  }

  /**
   * 按地址步长改写节点编号（如 0、4K、8K…），整树一次性更新。
   * @param strideKb 步长（单位 K），默认 4
   */
  public *relabelByStride(
    strideKb = 4,
    duration = 0.45,
  ): ThreadGenerator {
    yield* all(
      ...Array.from({ length: this.nodes.length }, (_, i) => {
        const text = i === 0 ? "0" : `${i * strideKb}K`;
        return this.nodes[i].setTitle(text, duration);
      }),
    );
  }

  /**
   * 高亮指定节点（nodes 数组下标，从 0 开始）。
   * @param index 节点下标
   * @param recovery 高亮完成后是否自动复原
   * @param duration 高亮过渡时长（秒）
   */
  public *highlight(
    index: number,
    recovery = false,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    yield* this.highlightMany([index], recovery, duration);
  }

  /**
   * 同时高亮多个节点。
   * @param indices 节点下标列表
   * @param recovery 高亮完成后是否自动复原
   * @param duration 高亮过渡时长（秒）
   */
  public *highlightMany(
    indices: number[],
    recovery = false,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    const targets = indices
      .map((i) => this.nodes[i])
      .filter((n): n is TreeNode => n != null);
    if (targets.length === 0) {
      return;
    }
    yield* highlightShapes(targets, { duration, recovery });
  }

  /** 同时高亮全部叶子节点（最底层） */
  public *highlightLeaves(
    recovery = false,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    const start = Math.pow(2, this.levels - 1) - 1;
    const end = Math.pow(2, this.levels) - 1;
    const indices = Array.from({ length: end - start }, (_, j) => start + j);
    yield* this.highlightMany(indices, recovery, duration);
  }

  /** 同时高亮全部非叶子节点（有子节点的内部节点） */
  public *highlightNonLeaves(
    recovery = false,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    const count = Math.pow(2, this.levels - 1) - 1;
    const indices = Array.from({ length: count }, (_, i) => i);
    yield* this.highlightMany(indices, recovery, duration);
  }
}

/** Latex 标注脉冲：变色 + 轻缩放后复原 */
function* pulseLatex(
  label: Latex,
  duration: number,
  color: string,
  restore: string,
): ThreadGenerator {
  const up = duration * 0.35;
  const down = duration * 0.65;
  yield* all(
    label.fill(color, up, easeInOutCubic).to(restore, down, easeInOutCubic),
    label.scale(1.1, up, easeInOutCubic).to(1, down, easeInOutCubic),
  );
}
