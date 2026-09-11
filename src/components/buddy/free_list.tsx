import { Layout, Line, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeOutCubic,
} from "@motion-canvas/core";
import type { BuddySystem } from "./buddy_system";
import { Ink } from "../../theme/ink";

const CHIP_FONT = "SF Mono, Consolas, monospace";
const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';

function formatHex(addr: number, digits = 4): string {
  return `0x${addr.toString(16).toUpperCase().padStart(digits, "0")}`;
}

export interface BuddyFreeListProps extends NodeProps {}

type FreeEntry = {
  block: BuddySystem;
  chip: Layout;
  /** 指向本节点的箭头（首节点为 null） */
  arrow: Layout | null;
};

/**
 * 伙伴系统顶部空闲链表：节点显示起始地址与 order，节点间以箭头相连。
 * 入链前由调用方高亮对应内存块，再在此淡入节点（无飞入）。
 */
export class BuddyFreeList extends Node {
  private readonly row = createRef<Layout>();
  private readonly entries: FreeEntry[] = [];

  public constructor(props: BuddyFreeListProps = {}) {
    super(props);

    this.add(
      <Layout
        layout
        direction={"column"}
        gap={10}
        alignItems={"center"}
      >
        <Txt
          text={"空闲链表"}
          fontFamily={LABEL_FONT}
          fontSize={24}
          fill={Ink.paperSoft}
        />
        <Layout
          ref={this.row}
          layout
          direction={"row"}
          gap={8}
          alignItems={"center"}
        />
      </Layout>,
    );
  }

  public has(block: BuddySystem): boolean {
    return this.entries.some((e) => e.block === block);
  }

  private spawnChip(block: BuddySystem, order: number): Layout {
    const digits = Math.max(4, block.start.toString(16).length);
    const chipRef = createRef<Layout>();
    this.add(
      <Layout ref={chipRef} layout={false} opacity={0}>
        <Rect
          layout
          direction={"column"}
          gap={2}
          padding={[8, 14]}
          radius={0}
          fill={"#2A261C"}
          stroke={Ink.gold}
          lineWidth={Ink.lineWidth}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Txt
            text={formatHex(block.start, digits)}
            fontFamily={CHIP_FONT}
            fontSize={18}
            fontWeight={500}
            fill={Ink.paper}
          />
          <Txt
            text={`order ${order}`}
            fontFamily={LABEL_FONT}
            fontSize={15}
            fill={Ink.goldSoft}
          />
        </Rect>
      </Layout>,
    );
    return chipRef();
  }

  /** 节点之间的水平箭头连线 */
  private spawnArrow(): Layout {
    const arrowRef = createRef<Layout>();
    this.add(
      <Layout ref={arrowRef} layout={false} opacity={0}>
        <Layout
          layout
          width={36}
          height={28}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Line
            points={[
              [-14, 0],
              [14, 0],
            ]}
            stroke={Ink.goldSoft}
            lineWidth={Ink.lineWidth}
            lineCap={"round"}
            endArrow
            arrowSize={10}
          />
        </Layout>
      </Layout>,
    );
    return arrowRef();
  }

  private placeInRow(node: Layout): void {
    node.reparent(this.row());
    node.layout(true);
    node.position(0, 0);
  }

  /** 在链表末尾淡入节点（及与前驱的箭头）；不含块高亮/配色 */
  public *mount(
    block: BuddySystem,
    order: number,
    duration = 0.35,
  ): ThreadGenerator {
    if (this.has(block)) {
      return;
    }

    const chip = this.spawnChip(block, order);
    let arrow: Layout | null = null;
    if (this.entries.length > 0) {
      arrow = this.spawnArrow();
      this.placeInRow(arrow);
    }
    this.placeInRow(chip);
    this.entries.push({ block, chip, arrow });

    if (arrow) {
      yield* all(
        chip.opacity(1, duration, easeOutCubic),
        arrow.opacity(1, duration, easeOutCubic),
      );
    } else {
      yield* chip.opacity(1, duration, easeOutCubic);
    }
  }

  /**
   * 先高亮内存块并切到空闲配色，再在顶部链表添加节点。
   */
  public *admit(
    block: BuddySystem,
    order: number,
    duration = 0.55,
  ): ThreadGenerator {
    if (this.has(block)) {
      return;
    }
    yield* block.pulseHighlight(duration * 0.55);
    yield* block.setFreeListStyle(duration * 0.35);
    yield* this.mount(block, order, duration * 0.4);
  }

  /** 从空闲链表移除（占用或父块分裂）；勿命名 remove，会与 Node.remove 冲突 */
  public *unlink(block: BuddySystem, duration = 0.28): ThreadGenerator {
    const idx = this.entries.findIndex((e) => e.block === block);
    if (idx < 0) {
      return;
    }

    const [removed] = this.entries.splice(idx, 1);
    block.inFreeList = false;

    const fades: ThreadGenerator[] = [
      removed.chip.opacity(0, duration, easeOutCubic),
    ];
    if (removed.arrow) {
      fades.push(removed.arrow.opacity(0, duration, easeOutCubic));
    }

    // 删掉头节点时，原第二节点的入边箭头一并去掉
    const newHead = idx === 0 ? this.entries[0] : null;
    if (newHead?.arrow) {
      fades.push(newHead.arrow.opacity(0, duration, easeOutCubic));
    }

    yield* all(...fades);

    removed.chip.remove();
    removed.arrow?.remove();
    if (newHead?.arrow) {
      newHead.arrow.remove();
      newHead.arrow = null;
    }
  }
}
