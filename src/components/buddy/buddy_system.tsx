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

const DEPTH_FILL = ["#1D293B", "#1E3A5F", "#0F766E", "#1E3A2F", "#3B4F6B"];
const DEPTH_STROKE = ["#5C79A3", "#38BDF8", "#2DD4BF", "#86EFAC", "#94A3B8"];
const ALLOC_FILL = "#9A3412";
const ALLOC_STROKE = "#FBBF24";
/** 已分裂的父块：非空闲内部节点 */
const INTERNAL_FILL = "#0B1220";
const INTERNAL_STROKE = "#334155";
const INTERNAL_TEXT = "#64748B";
const ADDR_COLOR = "#CBD5E1";

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
        radius={8}
        fill={DEPTH_FILL[0]}
        stroke={DEPTH_STROKE[0]}
        lineWidth={3}
      />,
    );
    this.add(
      <Txt
        ref={this.startTxt}
        text={formatHex(start, digits)}
        fill={"#CBD5E1"}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={"SF Mono, Consolas, monospace"}
        offset={[-1, 0]}
        y={-barHeight / 2 - fontSize * 0.75}
      />,
    );
    this.add(
      <Txt
        ref={this.endTxt}
        text={formatHex(this.end, digits)}
        fill={"#CBD5E1"}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={"SF Mono, Consolas, monospace"}
        offset={[1, 0]}
        y={-barHeight / 2 - fontSize * 0.75}
      />,
    );
    this.add(
      <Txt
        ref={this.midTxt}
        text={sizeLabel(size)}
        fill={"#FFFFFF"}
        fontSize={fontSize * 0.95}
        fontWeight={700}
        fontFamily={"SF Mono, Consolas, monospace"}
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
    yield* this.buddyRoot.relayout(move);
  }

  /** 控制起止地址文字是否可见 */
  public setAddressesVisible(visible: boolean): void {
    const op = visible ? 1 : 0;
    this.startTxt().opacity(op);
    this.endTxt().opacity(op);
  }

  /**
   * 已分裂父块：自身不再空闲，使用暗色内部节点样式。
   */
  public *setInternal(duration = 0.45): ThreadGenerator {
    yield* all(
      this.bar().fill(INTERNAL_FILL, duration, easeInOutCubic),
      this.bar().stroke(INTERNAL_STROKE, duration, easeInOutCubic),
      this.bar().lineWidth(2, duration * 0.5, easeOutCubic),
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
      this.midTxt().fill("#FBBF24", duration * 0.2, easeOutCubic),
      this.midTxt().scale(1.12, duration * 0.25, easeOutCubic).to(
        1,
        duration * 0.35,
        easeInOutCubic,
      ),
      this.bar()
        .stroke("#FBBF24", duration * 0.25, easeOutCubic)
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
      yield* all(
        this.bar().fill(ALLOC_FILL, duration, easeInOutCubic),
        this.bar().stroke(ALLOC_STROKE, duration, easeInOutCubic),
        this.bar().lineWidth(4, duration * 0.5, easeOutCubic),
        this.midTxt().fill(ALLOC_STROKE, duration, easeInOutCubic),
      );
    } else {
      const i = this.depth % DEPTH_FILL.length;
      yield* all(
        this.bar().fill(DEPTH_FILL[i], duration, easeInOutCubic),
        this.bar().stroke(DEPTH_STROKE[i], duration, easeInOutCubic),
        this.bar().lineWidth(3, duration * 0.5, easeOutCubic),
        this.midTxt().fill("#FFFFFF", duration, easeInOutCubic),
      );
    }
  }

  /** 合并时短高亮 */
  public *pulseHighlight(duration = 1.6): ThreadGenerator {
    const i = this.depth % DEPTH_STROKE.length;
    yield* this.bar()
      .stroke("#FBBF24", duration * 0.4, easeOutCubic)
      .to(DEPTH_STROKE[i], duration * 0.6, easeInOutCubic);
  }

  /** 恢复深度配色（合并后父块重新变为空闲叶） */
  public restoreDepthStyle(): void {
    this.allocated = false;
    this.applyDepthStyle(this.depth);
    this.bar().lineWidth(3);
    this.midTxt().fill("#FFFFFF");
    this.startTxt().fill(ADDR_COLOR);
    this.endTxt().fill(ADDR_COLOR);
  }

  private applyDepthStyle(depth: number): void {
    const i = depth % DEPTH_FILL.length;
    this.bar().fill(DEPTH_FILL[i]);
    this.bar().stroke(DEPTH_STROKE[i]);
  }
}
