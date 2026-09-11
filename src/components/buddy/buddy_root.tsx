import { Node, NodeProps, Txt, Latex, Layout } from "@motion-canvas/2d";
import {
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  waitFor,
} from "@motion-canvas/core";
import { Annotation } from "../annotation/annotation";
import { BuddySystem, BuddySystemProps } from "./buddy_system";
import { BuddyFreeList } from "./free_list";
import { Ink } from "../../theme/ink";

export interface BuddyRootProps extends NodeProps {
  /**
   * 根块的伙伴阶（order），最大为 3。
   * 内存大小 = pageSize × 2^order；从根分裂到最小块共可分裂 order 次。
   */
  order?: number;
  /** 最小块（order=0）大小，固定默认 4KB（0x1000） */
  pageSize?: number;
  /** 整段内存起始地址 */
  start?: number;
  /**
   * 根内存条宽度。若偏小会按 order 自动加宽，但不会超过
   * 画布左右留白后的可用宽度。
   */
  barWidth?: number;
  /** 画布宽度，用于计算左右留白，默认 1920 */
  canvasWidth?: number;
  /** 画布高度，用于顶栏空闲链表定位，默认 1080 */
  canvasHeight?: number;
  /** 相对屏幕左右边距，默认 72 */
  sideMargin?: number;
  /** 内存条高度 */
  barHeight?: number;
  /** 层与层之间的垂直间距 */
  levelGap?: number;
  /** 兄弟块水平间距 */
  siblingGap?: number;
  /** 各层统一的地址文字字号 */
  fontSize?: number;
}

type LayoutSlot = { x: number; y: number; width: number };

/** 伙伴阶上限 */
export const BUDDY_MAX_ORDER = 3;

/**
 * 伙伴系统根节点：持有根块、创建子块、统一布局整棵树。
 * 布局策略：父块在上保留，左右 buddy 在正下方并列；整树水平垂直居中。
 */
export class BuddyRoot extends Node {
  private readonly rootBlock: BuddySystem;
  private readonly blocks: BuddySystem[] = [];
  private readonly orderLabels: Array<{
    root: Layout;
    title: Txt;
    formula: Latex;
  }> = [];
  private readonly annotation: Annotation;
  private readonly freeList: BuddyFreeList;
  /** 为顶部空闲链表预留，整树下移 */
  private readonly treeYPad: number;

  /** 根块 order；亦可分裂次数（降到 order=0） */
  public readonly order: number;
  private readonly barWidth: number;
  private readonly levelGap: number;
  private readonly siblingGap: number;
  private readonly pageSize: number;
  private readonly blockFontSize: number;
  private readonly orderFontSize: number;
  private orderVisible = false;

  public constructor(props: BuddyRootProps) {
    const {
      order = 3,
      pageSize = 0x1000,
      start = 0,
      barWidth = 720,
      canvasWidth = 1920,
      canvasHeight = 1080,
      sideMargin = 72,
      barHeight = 48,
      levelGap = 72,
      siblingGap = 16,
      fontSize = 20,
      ...nodeProps
    } = props;

    super(nodeProps);

    const rootOrder = Math.min(
      BUDDY_MAX_ORDER,
      Math.max(0, Math.floor(order)),
    );
    const page = Math.max(1, Math.floor(pageSize));
    const size = page << rootOrder;
    const gap = Math.max(4, siblingGap);
    const margin = Math.max(0, sideMargin);

    // 最底层最多 2^order 块；加宽但左右留白（order 文案不占宽度）
    // 叶宽需容纳两侧十六进制地址（如 0x0000 / 0x1000），过窄会重叠
    const leafCount = 1 << rootOrder;
    const minLeafWidth = 168;
    const autoBarWidth =
      leafCount * minLeafWidth + Math.max(0, leafCount - 1) * gap;
    const maxBarWidth = Math.max(320, canvasWidth - margin * 2);
    const resolvedBarWidth = Math.min(
      Math.max(barWidth, autoBarWidth),
      maxBarWidth,
    );

    // 各层统一字号（按叶宽略作适配，但仍全局一致）
    const leafWidth =
      (resolvedBarWidth - Math.max(0, leafCount - 1) * gap) / leafCount;
    const unifiedFont = Math.min(
      fontSize,
      Math.max(14, Math.floor(leafWidth * 0.12)),
    );

    this.order = rootOrder;
    this.barWidth = resolvedBarWidth;
    this.levelGap = levelGap;
    this.siblingGap = gap;
    this.pageSize = page;
    this.blockFontSize = unifiedFont;
    this.orderFontSize = unifiedFont;

    this.annotation = new Annotation();
    this.add(this.annotation);

    this.treeYPad = 100;
    this.freeList = new BuddyFreeList({
      y: -canvasHeight / 2 + 70,
      opacity: 0,
    });
    this.add(this.freeList);

    this.rootBlock = new BuddySystem({
      start,
      size,
      barHeight,
      fontSize: unifiedFont,
    });
    this.add(this.rootBlock);
    this.rootBlock.attachRoot(this, 0);
    this.blocks.push(this.rootBlock);
    // 使用与 relayout 相同的居中规则（仅图形居中）
    const initial = this.computeSlots();
    const slot = initial.get(this.rootBlock)!;
    this.rootBlock.applyLayout(slot.x, slot.y, slot.width);
  }

  /** 显示 / 隐藏顶部空闲链表 */
  public *setFreeListVisible(
    visible: boolean,
    duration = 0.35,
  ): ThreadGenerator {
    yield* this.freeList.opacity(visible ? 1 : 0, duration, easeOutCubic);
  }

  /** 将根块高亮后挂入顶部空闲链表（场景开场时调用） */
  public *initFreeList(): ThreadGenerator {
    yield* this.freeList.admit(this.rootBlock, this.order, 0.55);
  }

  /**
   * 概念演示：根块只分裂一次。
   * - syncFreeList=false（预演）：框选左右两个伙伴后返回
   * - syncFreeList=true：高亮并同步空闲链表
   */
  public *demoSplitOnce(
    duration = 2.2,
    syncFreeList = true,
  ): ThreadGenerator {
    const parent = this.rootBlock;
    if (parent.isSplit) {
      return;
    }
    yield* parent.split(duration);
    const left = parent.left;
    const right = parent.right;
    if (!left || !right) {
      return;
    }

    if (!syncFreeList) {
      // 预演：框选两个伙伴块
      yield* this.annotation.focusBox([left, right], {
        padding: 16,
        color: Ink.seal,
        duration: 1.1,
      });
      return;
    }

    yield* all(
      left.pulseHighlight(0.55),
      right.pulseHighlight(0.55),
    );
    yield* this.freeList.unlink(parent, 0.25);
    yield* left.setFreeListStyle(0.3);
    yield* right.setFreeListStyle(0.3);
    yield* this.freeList.mount(left, this.orderOf(left.size), 0.3);
    yield* this.freeList.mount(right, this.orderOf(right.size), 0.3);
  }

  /**
   * 概念演示后合并回单一根块。
   * @param syncFreeList 是否同步空闲链表（预演时应为 false）
   */
  public *demoRestore(
    duration = 2.0,
    syncFreeList = true,
  ): ThreadGenerator {
    if (!this.rootBlock.isSplit) {
      return;
    }
    yield* this.merge(this.rootBlock, duration, syncFreeList);
  }

  /**
   * 父块分裂完成后：父块出链；仅将伙伴加入空闲链表。
   * 顺序：高亮伙伴 → 切空闲配色 → 链表淡入节点（互不重叠）。
   */
  public *afterSplit(
    parent: BuddySystem,
    kept: BuddySystem,
    buddy: BuddySystem,
  ): ThreadGenerator {
    yield* this.freeList.unlink(parent, 0.25);
    yield* buddy.pulseHighlight(0.45);
    yield* buddy.setFreeListStyle(0.3);
    yield* this.freeList.mount(
      buddy,
      this.orderOf(buddy.size),
      0.3,
    );
  }

  /** 占用 / 释放时同步空闲链表 */
  public *syncFreeListOnAlloc(
    block: BuddySystem,
    allocated: boolean,
  ): ThreadGenerator {
    if (allocated) {
      yield* this.freeList.unlink(block, 0.28);
    } else if (!block.isSplit) {
      yield* this.freeList.admit(
        block,
        this.orderOf(block.size),
        0.5,
      );
    }
  }

  /** 根内存块 */
  public get root(): BuddySystem {
    return this.rootBlock;
  }

  public getSiblingGap(): number {
    return this.siblingGap;
  }

  public getPageSize(): number {
    return this.pageSize;
  }

  /** 各层统一字号 */
  public getBlockFontSize(): number {
    return this.blockFontSize;
  }

  /** 从根降到 order=0 的最大分裂次数 */
  public get maxSplits(): number {
    return this.order;
  }

  /** size = pageSize × 2^order */
  public orderOf(blockSize: number): number {
    return Math.round(Math.log2(blockSize / this.pageSize));
  }

  /** 由 BuddySystem.split 调用：创建并挂到 Root 下（字号与根块统一） */
  public createBlock(
    props: Pick<BuddySystemProps, "start" | "size" | "barHeight">,
  ): BuddySystem {
    const block = new BuddySystem({
      start: props.start,
      size: props.size,
      barHeight: props.barHeight,
      fontSize: this.blockFontSize,
    });
    this.add(block);
    this.blocks.push(block);
    return block;
  }

  /**
   * 分裂指定块（默认根块）：先播树分裂，再将伙伴加入空闲链表。
   */
  public *split(target?: BuddySystem, duration = 2.6): ThreadGenerator {
    const block = target ?? this.rootBlock;
    yield* block.split(duration);
    if (block.left && block.right) {
      yield* this.afterSplit(block, block.left, block.right);
    }
  }

  /** 最近一次 alloc 得到的块 */
  public lastAllocated: BuddySystem | null = null;

  /**
   * 按申请大小（KB）分配内存。
   * 会先在候选块上显示比较（如 `7KB < 32KB`），再 split，直到块刚好够用后标记占用。
   * 结果写入 `lastAllocated`。
   * @param sizeKB 申请大小，单位 KB
   */
  public *alloc(sizeKB: number, duration = 2.2): ThreadGenerator {
    const reqKB = Math.max(0.001, sizeKB);
    const needBytes = reqKB * 1024;
    const pages = Math.max(1, Math.ceil(needBytes / this.pageSize));
    const want = Math.min(
      this.order,
      Math.max(0, Math.ceil(Math.log2(pages))),
    );

    const candidate = this.findBestFree(this.rootBlock, want);
    if (!candidate) {
      this.lastAllocated = null;
      return;
    }

    let block = candidate;
    // 首次分裂前先亮出各层 order，便于对照伙伴阶
    if (this.orderOf(block.size) > want && !this.orderVisible) {
      yield* this.showOrder(duration * 0.7);
    }
    while (this.orderOf(block.size) > want) {
      // 例如：7KB < 32KB → 先比较，再分裂，再改空闲链表（每步互不重叠）
      yield* block.showCompare(reqKB, duration * 0.5);
      yield* block.restoreMidLabel(duration * 0.25);
      yield* block.split(duration);
      if (!block.left || !block.right) {
        this.lastAllocated = null;
        return;
      }
      // 继续走 left；仅伙伴 right 入空闲链表
      yield* this.afterSplit(block, block.left, block.right);
      block = block.left;
    }

    // 到达目标阶：7KB ≤ 8KB，先标记占用，再出空闲链表
    yield* block.showCompare(reqKB, duration * 0.45);
    yield* block.setAllocated(true, duration * 0.35);
    yield* this.syncFreeListOnAlloc(block, true);
    this.lastAllocated = block;
  }

  /**
   * 释放已分配块；若 buddy 同为空闲叶，则向上合并（coalesce）。
   */
  public *free(block: BuddySystem, duration = 2.2): ThreadGenerator {
    if (!block.allocated) {
      return;
    }

    yield* block.setAllocated(false, duration * 0.3);
    yield* this.syncFreeListOnAlloc(block, false);

    let current = block;
    while (current.parentBlock) {
      const parent = current.parentBlock;
      const buddy =
        parent.left === current ? parent.right : parent.left;
      if (
        !buddy ||
        buddy.allocated ||
        buddy.isSplit ||
        current.isSplit
      ) {
        break;
      }
      yield* this.merge(parent, duration);
      current = parent;
    }

    if (this.lastAllocated === block) {
      this.lastAllocated = null;
    }
  }

  /** 合并一对空闲 buddy：先 Annotation 标注，再合并 */
  private *merge(
    parent: BuddySystem,
    duration: number,
    syncFreeList = true,
  ): ThreadGenerator {
    const left = parent.left;
    const right = parent.right;
    if (!left || !right) {
      return;
    }

    // 正式合并（带空闲链表）时再框选；预演恢复直接收拢，避免二次 focusBox
    if (syncFreeList) {
      yield* this.annotation.focusBox([left, right], {
        padding: 14,
        color: Ink.seal,
        duration: Math.max(0.9, duration * 0.55),
      });
    }

    const fadeOut: ThreadGenerator[] = [
      left.opacity(0, duration * 0.45, easeInOutCubic),
      right.opacity(0, duration * 0.45, easeInOutCubic),
      parent.pulseHighlight(duration * 0.5),
    ];
    if (syncFreeList) {
      fadeOut.push(
        this.freeList.unlink(left, duration * 0.35),
        this.freeList.unlink(right, duration * 0.35),
      );
    }
    yield* all(...fadeOut);

    parent.left = null;
    parent.right = null;
    this.detachBlock(left);
    this.detachBlock(right);
    parent.restoreDepthStyle();

    yield* this.relayout(duration * 0.55);
    if (syncFreeList) {
      yield* this.freeList.admit(
        parent,
        this.orderOf(parent.size),
        duration * 0.4,
      );
    }
  }

  private detachBlock(block: BuddySystem): void {
    const idx = this.blocks.indexOf(block);
    if (idx >= 0) {
      this.blocks.splice(idx, 1);
    }
    block.remove();
  }

  /**
   * 在空闲叶中找能满足 reqOrder 的最佳块：优先精确阶，否则选刚好够用的最小块。
   */
  private findBestFree(
    node: BuddySystem,
    reqOrder: number,
  ): BuddySystem | null {
    if (node.allocated) {
      return null;
    }
    if (node.isSplit) {
      const left = node.left
        ? this.findBestFree(node.left, reqOrder)
        : null;
      const right = node.right
        ? this.findBestFree(node.right, reqOrder)
        : null;
      return this.preferFree(left, right, reqOrder);
    }

    const ord = this.orderOf(node.size);
    if (ord < reqOrder) {
      return null;
    }
    return node;
  }

  private preferFree(
    a: BuddySystem | null,
    b: BuddySystem | null,
    reqOrder: number,
  ): BuddySystem | null {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    const oa = this.orderOf(a.size);
    const ob = this.orderOf(b.size);
    const da = oa - reqOrder;
    const db = ob - reqOrder;
    if (da !== db) {
      return da < db ? a : b;
    }
    return a.start <= b.start ? a : b;
  }

  /**
   * 在每一行左侧显示 order（Linux 伙伴阶：size = pageSize × 2^order）。
   * 之后若再 split/relayout，会自动跟着更新位置。
   */
  public *showOrder(duration = 1.6): ThreadGenerator {
    this.orderVisible = true;
    yield* this.syncOrderLabels(duration, true);
  }

  /**
   * 计算整树布局（相对原点），再平移使包围盒水平垂直居中。
   */
  public computeSlots(): Map<BuddySystem, LayoutSlot> {
    const raw = new Map<BuddySystem, LayoutSlot>();

    const walk = (
      node: BuddySystem,
      x: number,
      y: number,
      width: number,
    ) => {
      raw.set(node, { x, y, width });
      if (node.left && node.right) {
        const childW = (width - this.siblingGap) / 2;
        const childY =
          y +
          node.getBarHeight() / 2 +
          node.getLabelSpace() +
          this.levelGap +
          node.left.getBarHeight() / 2;
        const leftX = x - (childW + this.siblingGap) / 2;
        const rightX = x + (childW + this.siblingGap) / 2;
        walk(node.left, leftX, childY, childW);
        walk(node.right, rightX, childY, childW);
      }
    };

    walk(this.rootBlock, 0, 0, this.barWidth);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const [node, slot] of raw) {
      const halfW = slot.width / 2;
      const top = slot.y - node.getBarHeight() / 2 - node.getLabelSpace();
      const bot = slot.y + node.getBarHeight() / 2;
      minX = Math.min(minX, slot.x - halfW);
      maxX = Math.max(maxX, slot.x + halfW);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bot);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // 仅按内存条图形居中，左侧 order 文案不参与宽度/居中计算；
    // treeYPad 整树下移，给顶部空闲链表留空
    const centered = new Map<BuddySystem, LayoutSlot>();
    for (const [node, slot] of raw) {
      centered.set(node, {
        x: slot.x - cx,
        y: slot.y - cy + this.treeYPad,
        width: slot.width,
      });
    }
    return centered;
  }

  /**
   * 按树重新计算所有块的位置与宽度，并做位移动画（保持整树居中）。
   */
  public *relayout(duration = 2.0): ThreadGenerator {
    const slots = this.computeSlots();

    const tasks: ThreadGenerator[] = [];
    if (duration <= 0) {
      for (const [node, slot] of slots) {
        node.applyLayout(slot.x, slot.y, slot.width);
      }
    } else {
      for (const [node, slot] of slots) {
        tasks.push(node.animateLayout(slot.x, slot.y, slot.width, duration));
      }
    }

    if (this.orderVisible) {
      tasks.push(this.syncOrderLabels(duration, false));
    }

    if (tasks.length > 0) {
      yield* all(...tasks);
    }
  }

  /** 等待一拍，方便场景编排 */
  public *hold(seconds = 0.6): ThreadGenerator {
    yield* waitFor(seconds);
  }

  /**
   * 按当前布局同步左侧 order 标签（每行一个）。
   */
  private *syncOrderLabels(
    duration: number,
    fadeIn: boolean,
  ): ThreadGenerator {
    const slots = this.computeSlots();

    // 每一行（同一 order / 同一 size）取一个代表 y，以及整树最左边界
    const rowByOrder = new Map<number, number>();
    let minX = Infinity;
    for (const [node, slot] of slots) {
      const ord = this.orderOf(node.size);
      if (!rowByOrder.has(ord)) {
        rowByOrder.set(ord, slot.y);
      }
      minX = Math.min(minX, slot.x - slot.width / 2);
    }

    const labelX = minX - 28;
    const orders = [...rowByOrder.keys()].sort((a, b) => b - a);

    // 去掉多余旧标签
    while (this.orderLabels.length > orders.length) {
      const extra = this.orderLabels.pop();
      extra?.root.remove();
    }

    const anims: ThreadGenerator[] = [];
    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      const y = rowByOrder.get(ord)!;
      let entry = this.orderLabels[i];
      const isNew = !entry;
      if (!entry) {
        const rootRef = createRef<Layout>();
        const titleRef = createRef<Txt>();
        const formulaRef = createRef<Latex>();
        this.add(
          <Layout
            ref={rootRef}
            layout
            direction={"row"}
            gap={6}
            alignItems={"center"}
            offset={[1, 0]}
            x={labelX}
            y={y}
            opacity={0}
          >
            <Txt
              ref={titleRef}
              text={`order=${ord}`}
              fill={Ink.goldSoft}
              fontSize={this.orderFontSize}
              fontWeight={600}
              fontFamily={'"SimFang", FangSong, STFangsong, serif'}
            />
            <Latex
              ref={formulaRef}
              tex={`(2^{${ord}}\\ \\mathrm{Pages})`}
              fill={Ink.paperSoft}
              fontSize={this.orderFontSize}
            />
          </Layout>,
        );
        entry = {
          root: rootRef(),
          title: titleRef(),
          formula: formulaRef(),
        };
        this.orderLabels.push(entry);
      } else {
        entry.title.text(`order=${ord}`);
        entry.formula.tex(`(2^{${ord}}\\ \\mathrm{Pages})`);
      }

      const label = entry.root;
      if (duration <= 0) {
        label.position([labelX, y]);
        label.opacity(1);
      } else if (fadeIn || isNew) {
        label.position([labelX, y]);
        anims.push(label.opacity(1, duration, easeOutCubic));
      } else {
        anims.push(
          label.position([labelX, y], duration, easeInOutCubic),
          label.opacity(1, duration * 0.3, easeOutCubic),
        );
      }
    }

    if (anims.length > 0) {
      yield* all(...anims);
    }
  }
}
