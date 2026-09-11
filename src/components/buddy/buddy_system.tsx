import { Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  waitFor,
} from "@motion-canvas/core";
import type { BuddyRoot } from "./buddy_root";
import { Ink } from "../../theme/ink";

export interface BuddySystemProps extends NodeProps {
  /** 起始地址（字节） */
  start: number;
  /** 块大小（字节，建议为 2 的幂） */
  size: number;
  /** 内存条高度 */
  barHeight?: number;
  /** 地址文字字号 */
  fontSize?: number;
}

function formatHex(addr: number, digits = 4): string {
  return `0x${addr.toString(16).toUpperCase().padStart(digits, "0")}`;
}

function sizeLabel(size: number): string {
  if (size >= 1024 && size % 1024 === 0) {
    return `${size / 1024}K`;
  }
  return formatHex(size);
}

function formatKB(kb: number): string {
  if (Number.isInteger(kb)) {
    return `${kb}KB`;
  }
  const t = Math.round(kb * 10) / 10;
  return `${t}KB`;
}

/** 地址：等宽；块大小：仿书签字 */
const ADDR_FONT = "SF Mono, Consolas, monospace";
const SIZE_FONT = '"SimFang", FangSong, STFangsong, serif';

/**
 * 水墨层次（仅用暖墨 / 宣纸 / 淡金 / 赭石，避免青绿数码感）：
 * - 默认叶：浓淡墨笺
 * - 空闲链表：淡金描边笺条
 * - 占用：赭石印记
 * - 已分裂父块：淡墨残影
 */
const DEPTH_FILL = [
  Ink.deep,
  Ink.deepAlt,
  "#181715",
  "#1F1D1A",
  "#22201C",
];
const DEPTH_STROKE = [
  Ink.line,
  Ink.muted,
  "#6A6358",
  "#756E62",
  Ink.paperSoft,
];
const FREE_FILL = "#2A261C";
const FREE_STROKE = Ink.gold;
const FREE_TEXT = Ink.paper;
const ALLOC_FILL = Ink.warnDeep;
const ALLOC_STROKE = Ink.warn;
const ALLOC_TEXT = Ink.goldSoft;
const INTERNAL_FILL = Ink.veil;
const INTERNAL_STROKE = "#3A3630";
const INTERNAL_TEXT = Ink.muted;
const ADDR_COLOR = Ink.paperSoft;

/**
 * 伙伴系统中的一块连续内存：横向内存条 + 起止十六进制地址
 * （结束地址为块内最后一字节，闭区间，如 0x0FFF）。
 */
export class BuddySystem extends Node {
  public readonly start: number;
  public readonly size: number;
  /** 块内最后一字节地址（闭区间） */
  public readonly end: number;

  public left: BuddySystem | null = null;
  public right: BuddySystem | null = null;
  public parentBlock: BuddySystem | null = null;
  /** 是否已被分配 */
  public allocated = false;
  /** 是否已挂在顶部空闲链表 */
  public inFreeList = false;

  private readonly bar = createRef<Rect>();
  private readonly startTxt = createRef<Txt>();
  private readonly endTxt = createRef<Txt>();
  private readonly midTxt = createRef<Txt>();

  private readonly barHeight: number;
  private readonly fontSize: number;
  private buddyRoot: BuddyRoot | null = null;
  private depth = 0;
  /** 下移布局时再淡入起止地址 */
  public revealAddressesOnLayout = false;

  public constructor(props: BuddySystemProps) {
    const {
      start,
      size,
      barHeight = 48,
      fontSize = 22,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.start = start;
    this.size = size;
    this.end = start + size - 1;
    this.barHeight = barHeight;
    this.fontSize = fontSize;

    const digits = Math.max(
      4,
      start.toString(16).length,
      this.end.toString(16).length,
    );

    this.add(
      <Rect
        ref={this.bar}
        width={200}
        height={barHeight}
        radius={0}
        fill={DEPTH_FILL[0]}
        stroke={DEPTH_STROKE[0]}
        lineWidth={Ink.lineWidth}
      />,
    );
    this.add(
      <Txt
        ref={this.startTxt}
        text={formatHex(start, digits)}
        fill={ADDR_COLOR}
        fontSize={fontSize}
        fontWeight={500}
        fontFamily={ADDR_FONT}
        offset={[-1, 0]}
        y={-barHeight / 2 - fontSize * 0.75}
      />,
    );
    this.add(
      <Txt
        ref={this.endTxt}
        text={formatHex(this.end, digits)}
        fill={ADDR_COLOR}
        fontSize={fontSize}
        fontWeight={500}
        fontFamily={ADDR_FONT}
        offset={[1, 0]}
        y={-barHeight / 2 - fontSize * 0.75}
      />,
    );
    this.add(
      <Txt
        ref={this.midTxt}
        text={sizeLabel(size)}
        fill={Ink.paper}
        fontSize={fontSize * 0.95}
        fontWeight={600}
        fontFamily={SIZE_FONT}
      />,
    );
  }

  public attachRoot(root: BuddyRoot, depth = 0): void {
    this.buddyRoot = root;
    this.depth = depth;
    this.applyDepthStyle(depth);
  }

  public getBarHeight(): number {
    return this.barHeight;
  }

  public getLabelSpace(): number {
    return this.fontSize * 1.5;
  }

  public getBarWidth(): number {
    return this.bar().width();
  }

  /** 是否已分裂 */
  public get isSplit(): boolean {
    return this.left != null && this.right != null;
  }

  /**
   * 分裂为大小相等的两个 buddy（需已 attach 到 BuddyRoot）。
   * 子块先叠在父块左右半区，再动画下移到下方最终位置。
   */
  public *split(duration = 2.6): ThreadGenerator {
    if (this.isSplit) {
      return;
    }
    if (this.allocated) {
      return;
    }
    if (!this.buddyRoot) {
      throw new Error("BuddySystem.split: 尚未挂到 BuddyRoot");
    }
    if (this.size < 2 || this.size % 2 !== 0) {
      throw new Error("BuddySystem.split: size 必须为 >=2 的偶数");
    }
    if (this.size <= this.buddyRoot.getPageSize()) {
      return;
    }

    const half = this.size / 2;
    const left = this.buddyRoot.createBlock({
      start: this.start,
      size: half,
      barHeight: this.barHeight,
    });
    const right = this.buddyRoot.createBlock({
      start: this.start + half,
      size: half,
      barHeight: this.barHeight,
    });

    left.parentBlock = this;
    right.parentBlock = this;
    left.attachRoot(this.buddyRoot, this.depth + 1);
    right.attachRoot(this.buddyRoot, this.depth + 1);

    this.left = left;
    this.right = right;

    // 先叠在父块左右半区（同一高度），再随 relayout 下移
    const gap = this.buddyRoot.getSiblingGap();
    const parentW = this.getBarWidth();
    const childW = (parentW - gap) / 2;
    const parentX = this.x();
    const parentY = this.y();
    const leftX = parentX - (childW + gap) / 2;
    const rightX = parentX + (childW + gap) / 2;

    left.applyLayout(leftX, parentY, childW);
    right.applyLayout(rightX, parentY, childW);
    left.setAddressesVisible(false);
    right.setAddressesVisible(false);
    left.revealAddressesOnLayout = true;
    right.revealAddressesOnLayout = true;
    left.opacity(0);
    right.opacity(0);

    const appear = duration * 0.28;
    const move = duration * 0.72;

    yield* all(
      left.opacity(1, appear, easeOutCubic),
      right.opacity(1, appear, easeOutCubic),
      // 父块已分裂，转为非空闲内部节点样式
      this.setInternal(appear + move * 0.35),
    );

    // 整树重新居中布局：子块从父位置滑到下方，地址逐渐显现
    // 空闲链表更新由 BuddyRoot.alloc 在分裂完成后单独编排，避免与分裂同播
    yield* this.buddyRoot.relayout(move);
  }

  /** 控制起止地址文字是否可见 */
  public setAddressesVisible(visible: boolean): void {
    const op = visible ? 1 : 0;
    this.startTxt().opacity(op);
    this.endTxt().opacity(op);
  }

  /**
   * 已分裂父块：淡墨残影，弱化自身存在感。
   */
  public *setInternal(duration = 0.45): ThreadGenerator {
    this.inFreeList = false;
    yield* all(
      this.bar().fill(INTERNAL_FILL, duration, easeInOutCubic),
      this.bar().stroke(INTERNAL_STROKE, duration, easeInOutCubic),
      this.bar().lineWidth(Ink.lineWidth * 0.75, duration * 0.5, easeOutCubic),
      this.bar().opacity(0.72, duration, easeInOutCubic),
      this.midTxt().fill(INTERNAL_TEXT, duration, easeInOutCubic),
      this.startTxt().fill(INTERNAL_TEXT, duration, easeInOutCubic),
      this.endTxt().fill(INTERNAL_TEXT, duration, easeInOutCubic),
    );
  }

  /** 由 Root 调用：动画到目标几何 */
  public *animateLayout(
    x: number,
    y: number,
    width: number,
    duration: number,
  ): ThreadGenerator {
    const halfW = width / 2;
    const labelY = -this.barHeight / 2 - this.fontSize * 0.75;
    const reveal = this.revealAddressesOnLayout;
    this.revealAddressesOnLayout = false;

    const tasks: ThreadGenerator[] = [
      this.position([x, y], duration, easeInOutCubic),
      this.bar().width(width, duration, easeInOutCubic),
      this.startTxt().position([-halfW, labelY], duration, easeInOutCubic),
      this.endTxt().position([halfW, labelY], duration, easeInOutCubic),
    ];
    if (reveal) {
      tasks.push(
        this.startTxt().opacity(1, duration, easeOutCubic),
        this.endTxt().opacity(1, duration, easeOutCubic),
      );
    }

    yield* all(...tasks);
  }

  /** 立即设置布局（首帧） */
  public applyLayout(x: number, y: number, width: number): void {
    const halfW = width / 2;
    const labelY = -this.barHeight / 2 - this.fontSize * 0.75;
    this.position([x, y]);
    this.bar().width(width);
    this.startTxt().position([-halfW, labelY]);
    this.endTxt().position([halfW, labelY]);
  }

  /**
   * 在块中央显示申请大小与当前块的比较，例如 `7KB < 32KB`。
   */
  public *showCompare(
    reqKB: number,
    duration = 1.2,
  ): ThreadGenerator {
    const blockKB = this.size / 1024;
    const cmp = reqKB < blockKB ? "<" : "≤";
    const text = `${formatKB(reqKB)} ${cmp} ${formatKB(blockKB)}`;
    const stroke = this.bar().stroke();

    this.midTxt().text(text);
    yield* all(
      this.midTxt().fill(Ink.goldSoft, duration * 0.2, easeOutCubic),
      this.midTxt().scale(1.04, duration * 0.25, easeOutCubic).to(
        1,
        duration * 0.35,
        easeInOutCubic,
      ),
      this.bar()
        .stroke(Ink.goldSoft, duration * 0.25, easeOutCubic)
        .to(stroke, duration * 0.5, easeInOutCubic),
      waitFor(duration * 0.55),
    );
  }

  /** 恢复中央为块大小标签（颜色由空闲 / 内部节点样式自行处理） */
  public *restoreMidLabel(duration = 0.25): ThreadGenerator {
    this.midTxt().text(sizeLabel(this.size));
    yield* waitFor(duration);
  }

  /** 播放占用 / 释放的视觉状态 */
  public *setAllocated(
    value: boolean,
    duration = 1.6,
  ): ThreadGenerator {
    this.allocated = value;
    this.midTxt().text(sizeLabel(this.size));
    if (value) {
      this.inFreeList = false;
      yield* all(
        this.bar().fill(ALLOC_FILL, duration, easeInOutCubic),
        this.bar().stroke(ALLOC_STROKE, duration, easeInOutCubic),
        this.bar().lineWidth(Ink.lineWidth + 0.5, duration * 0.5, easeOutCubic),
        this.bar().opacity(1, duration * 0.4, easeOutCubic),
        this.midTxt().fill(ALLOC_TEXT, duration, easeInOutCubic),
      );
    } else {
      const i = this.depth % DEPTH_FILL.length;
      yield* all(
        this.bar().fill(DEPTH_FILL[i], duration, easeInOutCubic),
        this.bar().stroke(DEPTH_STROKE[i], duration, easeInOutCubic),
        this.bar().lineWidth(Ink.lineWidth, duration * 0.5, easeOutCubic),
        this.bar().opacity(1, duration * 0.4, easeOutCubic),
        this.midTxt().fill(Ink.paper, duration, easeInOutCubic),
      );
    }
  }

  /** 挂入空闲链表：淡金描边笺条 */
  public *setFreeListStyle(duration = 0.35): ThreadGenerator {
    this.inFreeList = true;
    yield* all(
      this.bar().fill(FREE_FILL, duration, easeInOutCubic),
      this.bar().stroke(FREE_STROKE, duration, easeInOutCubic),
      this.bar().lineWidth(Ink.lineWidth, duration * 0.5, easeOutCubic),
      this.bar().opacity(1, duration * 0.35, easeOutCubic),
      this.midTxt().fill(FREE_TEXT, duration, easeInOutCubic),
      this.startTxt().fill(ADDR_COLOR, duration, easeInOutCubic),
      this.endTxt().fill(ADDR_COLOR, duration, easeInOutCubic),
    );
  }

  /** 合并时短高亮：淡金墨晕，轻提不弹 */
  public *pulseHighlight(duration = 1.6): ThreadGenerator {
    const i = this.depth % DEPTH_STROKE.length;
    const restore = this.inFreeList ? FREE_STROKE : DEPTH_STROKE[i];
    yield* all(
      this.bar()
        .stroke(Ink.goldSoft, duration * 0.4, easeOutCubic)
        .to(restore, duration * 0.6, easeInOutCubic),
      this.bar().scale(1.02, duration * 0.35, easeOutCubic).to(
        1,
        duration * 0.45,
        easeInOutCubic,
      ),
    );
  }

  /** 恢复深度配色（合并后父块重新变为空闲叶） */
  public restoreDepthStyle(): void {
    this.allocated = false;
    this.inFreeList = false;
    this.applyDepthStyle(this.depth);
    this.bar().lineWidth(Ink.lineWidth);
    this.bar().opacity(1);
    this.midTxt().fill(Ink.paper);
    this.startTxt().fill(ADDR_COLOR);
    this.endTxt().fill(ADDR_COLOR);
  }

  private applyDepthStyle(depth: number): void {
    const i = depth % DEPTH_FILL.length;
    this.bar().fill(DEPTH_FILL[i]);
    this.bar().stroke(DEPTH_STROKE[i]);
  }
}
