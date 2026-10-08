import {
  Img,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const TRACK = '#2a3a4c';
const MUTED = '#8a9bb0';

/** 流程图节点 */
export interface FlowNodeData {
  /** 下方文字 */
  label: string;
  /** 上方图片；暂无则显示占位 */
  image?: string;
}

export interface FlowChartProps extends NodeProps {
  /** 节点列表（按蛇形显示顺序） */
  nodes: FlowNodeData[];
  /** 每行节点数（蛇形折返列数），默认 3 */
  columns?: number;
  /** 列间距，默认 320 */
  colGap?: number;
  /** 行间距，默认 260 */
  rowGap?: number;
  /** 图片宽度，默认 96（只定宽、高度按原图比例，避免拉伸） */
  imageSize?: number;
  /** 是否绘制节点间直角连线，默认 true */
  showWires?: boolean;
}

/**
 * 蛇形流程图：上图下文节点，按「→ 下一行 ← 再下一行 → …」顺序布局与入场。
 */
export class FlowChart extends Node {
  private readonly cards = createRefArray<Rect>();
  private readonly wires = createRefArray<Line>();
  private readonly positions: Vector2[] = [];
  private readonly count: number;

  public constructor(props: FlowChartProps) {
    const {
      nodes,
      columns = 3,
      colGap = 320,
      rowGap = 260,
      imageSize = 96,
      showWires = true,
      ...rest
    } = props;

    super({opacity: 1, ...rest});

    this.count = nodes.length;
    const cols = Math.max(1, columns);
    const rows = Math.ceil(nodes.length / cols);

    // 网格居中：列 x、行 y
    const gridW = (cols - 1) * colGap;
    const gridH = (rows - 1) * rowGap;
    const originX = -gridW / 2;
    const originY = -gridH / 2;

    // 蛇形：偶数行左→右，奇数行右→左
    for (let i = 0; i < nodes.length; i++) {
      const row = Math.floor(i / cols);
      const indexInRow = i % cols;
      const col = row % 2 === 0 ? indexInRow : cols - 1 - indexInRow;
      this.positions.push(
        new Vector2(originX + col * colGap, originY + row * rowGap),
      );
    }

    // 连线（蛇形相邻）
    if (showWires) {
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = this.positions[i];
        const b = this.positions[i + 1];
        const pts = elbow(a, b);
        this.add(
          <Line
            ref={this.wires}
            points={pts}
            stroke={ACCENT}
            lineWidth={3}
            lineCap={'round'}
            lineJoin={'miter'}
            end={0}
            opacity={0.7}
          />,
        );
      }
    }

    // 节点卡片
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const pos = this.positions[i];
      this.add(
        <Rect
          ref={this.cards}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={10}
          padding={[16, 18]}
          position={pos}
          fill={DEEP}
          stroke={TRACK}
          lineWidth={2}
          radius={14}
          opacity={0}
          scale={0.85}
        >
          {n.image ? (
            <Img
              src={n.image}
              width={imageSize}
              radius={8}
            />
          ) : (
            <Rect
              width={imageSize}
              height={imageSize}
              radius={8}
              fill={'#1a2430'}
              stroke={TRACK}
              lineWidth={1.5}
              layout
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt
                text={String(i + 1)}
                fontFamily={FONT}
                fontSize={28}
                fill={MUTED}
              />
            </Rect>
          )}
          <Txt
            text={n.label}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={PAPER}
            textAlign={'center'}
          />
        </Rect>,
      );
    }
  }

  /** 按蛇形顺序依次：连线伸展 → 节点弹出 */
  public *play(options?: {gap?: number}): ThreadGenerator {
    const gap = options?.gap ?? 0.18;

    for (let i = 0; i < this.count; i++) {
      if (i > 0 && this.wires.length >= i) {
        yield* this.wires[i - 1].end(1, 0.4, easeInOutCubic);
      }
      yield* all(
        this.cards[i].opacity(1, 0.35, easeOutCubic),
        this.cards[i].scale(1, 0.4, easeOutCubic),
        this.cards[i].stroke(ACCENT, 0.35, easeOutCubic),
      );
      yield* waitFor(gap);
    }
  }

  /** 全部同时显现（备用） */
  public *revealAll(duration = 0.45): ThreadGenerator {
    yield* all(
      ...this.wires.map(w => w.end(1, duration, easeInOutCubic)),
      ...this.cards.map(c =>
        all(
          c.opacity(1, duration, easeOutCubic),
          c.scale(1, duration * 1.1, easeOutCubic),
          c.stroke(ACCENT, duration, easeOutCubic),
        ),
      ),
    );
  }
}

/** 直角折线：优先水平再垂直（同行）或垂直再水平（换行） */
function elbow(a: Vector2, b: Vector2): Vector2[] {
  if (Math.abs(a.y - b.y) < 1) {
    return [a, b];
  }
  if (Math.abs(a.x - b.x) < 1) {
    return [a, b];
  }
  // 换行：先走到行间中线再横移
  const midY = (a.y + b.y) / 2;
  return [a, new Vector2(a.x, midY), new Vector2(b.x, midY), b];
}
