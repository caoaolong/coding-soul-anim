import {Img, Latex, Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE = '#2a3a4c';
/** 标注高亮色（金色，醒目） */
const BADGE = '#FFDC51';
const BADGE_BG = '#2a2208';

/** 标注相对子节点卡片中心的偏移 */
const BADGE_OFFSET = new Vector2(108, -92);

export interface NodeTreeItem {
  label: string;
  icon: string;
}

export interface NodeTreeProps extends NodeProps {
  /** 根节点（上图下文） */
  root: NodeTreeItem;
  /** 子节点列表（上图下文，横向排布） */
  children: NodeTreeItem[];
  /** 子节点右上角 LaTeX 标注（与 children 一一对应；省略则无标注） */
  badges?: string[];
  /** 根节点 y，默认 -220 */
  rootY?: number;
  /** 子节点 y，默认 180 */
  childY?: number;
  /** 子节点间距，默认 280 */
  childGap?: number;
}

/**
 * 自上而下的图标树：根在上、子在下，直角连线；节点为上图下文。
 * 由 node_tree 场景通用化而来。
 */
export class NodeTree extends Node {
  private readonly rootBox = createRef<Rect>();
  private readonly childBoxes = createRefArray<Rect>();
  private readonly wires = createRefArray<Line>();
  private readonly badgeBoxes = createRefArray<Rect>();

  private readonly badgeCount: number;

  public constructor(props: NodeTreeProps) {
    const {
      root,
      children,
      badges = [],
      rootY = -220,
      childY = 180,
      childGap = 280,
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});

    this.badgeCount = Math.min(badges.length, children.length);

    const rootPos = new Vector2(0, rootY);
    const childPos = children.map(
      (_, i) => new Vector2((i - (children.length - 1) / 2) * childGap, childY),
    );

    // 直角连线：根底 → 竖干 → 横梁 → 落子
    const busY = (rootY + childY) / 2;
    for (const pos of childPos) {
      this.add(
        <Line
          ref={this.wires}
          points={[
            [rootPos.x, rootPos.y + 70],
            [rootPos.x, busY],
            [pos.x, busY],
            [pos.x, pos.y - 70],
          ]}
          stroke={ACCENT}
          lineWidth={3}
          lineCap={'round'}
          lineJoin={'miter'}
          end={0}
          opacity={0.75}
        />,
      );
    }

    this.add(makeNode(this.rootBox, root, rootPos));

    children.forEach((child, i) => {
      this.add(makeNode(this.childBoxes, child, childPos[i]));
    });

    // 子节点右上角标注（展开后再显现）
    for (let i = 0; i < this.badgeCount; i++) {
      this.add(
        <Rect
          ref={this.badgeBoxes}
          layout
          position={childPos[i].add(BADGE_OFFSET)}
          padding={[8, 14]}
          fill={BADGE_BG}
          stroke={BADGE}
          lineWidth={2.5}
          radius={10}
          opacity={0}
          scale={0.75}
        >
          <Latex tex={[badges[i]]} fill={BADGE} fontSize={30} />
        </Rect>,
      );
    }
  }

  /** 展开：根入场 → 连线 + 子节点 → 标注依次弹出 */
  public *reveal(): ThreadGenerator {
    yield* all(
      this.rootBox().opacity(1, 0.4, easeOutCubic),
      this.rootBox().scale(1, 0.5, easeOutCubic),
    );
    yield* waitFor(0.2);

    yield* all(
      ...this.wires.map((w, i) =>
        all(
          w.end(1, 0.55, easeInOutCubic),
          delay(
            0.25,
            all(
              this.childBoxes[i].opacity(1, 0.4, easeOutCubic),
              this.childBoxes[i].scale(1, 0.45, easeOutCubic),
            ),
          ),
        ),
      ),
    );
    yield* waitFor(0.35);

    for (let i = 0; i < this.badgeCount; i++) {
      yield* all(
        this.badgeBoxes[i].opacity(1, 0.35, easeOutCubic),
        this.badgeBoxes[i].scale(1.08, 0.35, easeOutCubic),
      );
      yield* this.badgeBoxes[i].scale(1, 0.2, easeInOutCubic);
      yield* waitFor(0.15);
    }
  }
}

function makeNode(
  ref: ReturnType<typeof createRef<Rect>> | ReturnType<typeof createRefArray<Rect>>,
  item: NodeTreeItem,
  position: Vector2,
) {
  return (
    <Rect
      ref={ref}
      layout
      direction={'column'}
      alignItems={'center'}
      gap={10}
      padding={[18, 22]}
      position={position}
      fill={DEEP}
      stroke={LINE}
      lineWidth={2}
      radius={14}
      opacity={0}
      scale={0.88}
    >
      <Img src={item.icon} width={88} height={88} />
      <Txt
        text={item.label}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={28}
        fontWeight={700}
        fill={PAPER}
      />
    </Rect>
  );
}
