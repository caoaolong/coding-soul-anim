import {
  Circle,
  Img,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const TRACK = '#2a3a4c';
const MUTED = '#8a9bb0';
const CARD_STROKE = '#3dd6c6';
const IMG_SIZE = 200;

/** 进度条上的事件节点 */
export interface ProgressMilestone {
  /** 年份（或映射到 start~end 的数值） */
  year: number;
  /** 卡片正文 */
  title: string;
  /** 卡片顶部图片（路径 / import 结果）；暂未提供时可省略 */
  image?: string;
  /** 卡片年份行的展示文案（默认 String(year)），可用于“1.0 · 1991-10” */
  label?: string;
}

export interface ProgressBarProps extends NodeProps {
  /** 轴起点（如 1800） */
  start: number;
  /** 轴终点（如 2000） */
  end: number;
  /** 节点列表 */
  nodes: ProgressMilestone[];
  /** 条带宽度，默认铺满视口约 100%（1760 @1920） */
  barWidth?: number;
  /** 进度条垂直位置，默认 80 */
  barY?: number;
  /** 左侧/右侧刻度文案，默认用 start/end */
  leftLabel?: string;
  rightLabel?: string;
  /** 卡片图片宽度，默认 200（只定宽、高度按原图比例自适应，避免拉伸） */
  imageSize?: number;
  /** 无图卡片的文本宽度，默认 300；有图时默认 imageSize + 120 */
  cardWidth?: number;
}

/**
 * 全宽进度时间轴：进度从左增长到右；
 * 到达节点时圆点亮起，卡片从圆点向上弹出。
 */
export class ProgressBar extends Node {
  private readonly track = createRef<Line>();
  private readonly fill = createRef<Line>();
  private readonly dots = createRefArray<Circle>();
  private readonly cards = createRefArray<Rect>();
  private readonly cardTxts = createRefArray<Txt>();

  private readonly startVal: number;
  private readonly endVal: number;
  private readonly milestones: ProgressMilestone[];
  private readonly trackY: number;
  private readonly barWidthVal: number;
  /** 每个节点卡片在轴上方或下方（近距交错） */
  private readonly cardSides: Array<'up' | 'down'>;

  public constructor(props: ProgressBarProps) {
    const {
      start,
      end,
      nodes,
      barWidth = 1760,
      barY = 80,
      leftLabel,
      rightLabel,
      imageSize = IMG_SIZE,
      cardWidth = 300,
      ...rest
    } = props;

    super({...rest});

    this.startVal = start;
    this.endVal = end;
    this.milestones = [...nodes].sort((a, b) => a.year - b.year);
    this.trackY = barY;
    this.barWidthVal = barWidth;
    this.cardSides = this.planCardSides(this.milestones);

    const left = -barWidth / 2;
    const right = barWidth / 2;

    // 底轨
    this.add(
      <Line
        ref={this.track}
        points={[
          [left, barY],
          [right, barY],
        ]}
        stroke={TRACK}
        lineWidth={10}
        lineCap={'round'}
        opacity={0}
      />,
    );

    // 进度填充（用 end 动画）
    this.add(
      <Line
        ref={this.fill}
        points={[
          [left, barY],
          [right, barY],
        ]}
        stroke={ACCENT}
        lineWidth={10}
        lineCap={'round'}
        end={0}
        opacity={0}
      />,
    );

    // 两端年份
    this.add(
      <Txt
        text={leftLabel ?? String(start)}
        fontFamily={FONT}
        fontSize={28}
        fill={MUTED}
        x={left}
        y={barY + 48}
        opacity={0}
      />,
    );
    this.add(
      <Txt
        text={rightLabel ?? String(end)}
        fontFamily={FONT}
        fontSize={28}
        fill={MUTED}
        x={right}
        y={barY + 48}
        opacity={0}
      />,
    );

    for (let i = 0; i < this.milestones.length; i++) {
      const m = this.milestones[i];
      const t = this.ratio(m.year);
      const x = left + t * barWidth;
      const side = this.cardSides[i];
      const above = side === 'up';

      this.add(
        <Circle
          ref={this.dots}
          x={x}
          y={barY}
          size={22}
          fill={DEEP}
          stroke={ACCENT}
          lineWidth={3}
          opacity={0}
          scale={0.4}
        />,
      );

      this.add(
        <Rect
          ref={this.cards}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={14}
          x={x}
          y={above ? barY - 28 : barY + 28}
          offset={above ? [0, 1] : [0, -1]}
          padding={[22, 26]}
          fill={DEEP}
          stroke={CARD_STROKE}
          lineWidth={2}
          radius={16}
          opacity={0}
          scale={0.5}
        >
          {/* 上图：只定宽、高度按原图比例自适应（Img 无 fit 属性，定宽高会拉伸）；无图时省略图片区 */}
          {m.image ? (
            <Img src={m.image} width={imageSize} radius={8} />
          ) : null}
          {/* 下文：年份 + 说明 */}
          <Txt
            text={m.label ?? String(m.year)}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={ACCENT}
          />
          <Txt
            ref={this.cardTxts}
            text={m.title}
            fontFamily={FONT}
            fontSize={26}
            fill={PAPER}
            textWrap={true}
            width={m.image ? imageSize + 120 : cardWidth}
            textAlign={'center'}
          />
        </Rect>,
      );
    }
  }

  /** 近距节点上下交错；够远则都默认在上方 */
  private planCardSides(
    milestones: ProgressMilestone[],
  ): Array<'up' | 'down'> {
    const CLOSE = 0.12; // 轴上相对距离阈值，视为「较近」
    const sides: Array<'up' | 'down'> = [];
    let lastRatio = -Infinity;
    let lastSide: 'up' | 'down' = 'up';

    for (const m of milestones) {
      const r = this.ratio(m.year);
      let side: 'up' | 'down' = 'up';
      if (r - lastRatio < CLOSE) {
        side = lastSide === 'up' ? 'down' : 'up';
      }
      sides.push(side);
      lastSide = side;
      lastRatio = r;
    }
    return sides;
  }

  private ratio(year: number): number {
    const span = this.endVal - this.startVal;
    return Math.min(1, Math.max(0, (year - this.startVal) / span));
  }

  /** 节点数量 */
  public nodeCount(): number {
    return this.milestones.length;
  }

  /** 节点在轴上的相对比例 0~1 */
  public nodeRatio(index: number): number {
    return this.ratio(this.milestones[index].year);
  }

  /** 节点本地 x 坐标（ProgressBar 自身坐标系，未计 this.x 位移） */
  public nodeX(index: number): number {
    const left = -this.barWidthVal / 2;
    return left + this.nodeRatio(index) * this.barWidthVal;
  }

  /** 底轨与刻度淡入 */
  public *revealTrack(duration = 0.4): ThreadGenerator {
    const labels = this.children().filter(
      c => c instanceof Txt,
    ) as Txt[];
    yield* all(
      this.track().opacity(1, duration, easeOutCubic),
      this.fill().opacity(1, duration, easeOutCubic),
      ...labels.map(l => l.opacity(1, duration, easeOutCubic)),
    );
  }

  /**
   * 进度从 0→1 增长；经过节点时圆点亮起、卡片从圆点向上弹出。
   */
  public *play(options?: {
    duration?: number;
    holdPerNode?: number;
  }): ThreadGenerator {
    const duration = options?.duration ?? 4.5;
    const holdPerNode = options?.holdPerNode ?? 0.85;

    yield* this.revealTrack(0.4);
    yield* waitFor(0.15);

    const ratios = this.milestones.map(m => this.ratio(m.year));
    let prev = 0;

    for (let i = 0; i < this.milestones.length; i++) {
      const target = ratios[i];
      const seg = Math.max(0.05, target - prev);
      const segDur = duration * seg;

      yield* this.fill().end(target, segDur, easeInOutCubic);
      yield* this.spawnNode(i);
      yield* waitFor(holdPerNode);
      prev = target;
    }

    // 走到终点
    if (prev < 1) {
      yield* this.fill().end(1, duration * (1 - prev), easeInOutCubic);
    }
  }

  /**
   * 超宽时间轴跟随播放：进度条整体平移，使当前聚焦节点尽量保持在屏幕中央。
   * 要求 barWidth 超出屏幕宽度（如 6000+ @1920），首节点播放前先居中。
   */
  public *playCentered(options?: {
    duration?: number;
    holdPerNode?: number;
  }): ThreadGenerator {
    const duration = options?.duration ?? 4.5;
    const holdPerNode = options?.holdPerNode ?? 0.85;

    yield* this.revealTrack(0.4);
    // 先把首节点搬到屏幕中央（this.x 为整体位移，nodeX 为本地坐标）
    if (this.milestones.length > 0) {
      this.x(-this.nodeX(0));
    }
    yield* waitFor(0.15);

    const ratios = this.milestones.map(m => this.ratio(m.year));
    let prev = 0;

    for (let i = 0; i < this.milestones.length; i++) {
      const target = ratios[i];
      const targetX = -this.nodeX(i);
      const seg = Math.max(0.05, target - prev);
      const segDur = Math.max(0.3, duration * seg);

      // 进度填充与整体平移同步：焦点节点滑向屏幕中央
      yield* all(
        this.fill().end(target, segDur, easeInOutCubic),
        this.x(targetX, segDur, easeInOutCubic),
      );
      yield* this.spawnNode(i);
      yield* waitFor(holdPerNode);
      prev = target;
    }

    // 走到终点（保持末节点居中，不再平移）
    if (prev < 1) {
      yield* this.fill().end(1, duration * (1 - prev), easeInOutCubic);
    }
  }

  /** 单个节点：圆点出现 → 卡片从圆点向上或向下弹出 */
  public *spawnNode(index: number): ThreadGenerator {
    const dot = this.dots[index];
    const card = this.cards[index];
    const barY = this.trackY;
    const above = this.cardSides[index] === 'up';
    const gap = 56;
    const cardRestY = above ? barY - gap : barY + gap;

    // 卡片先贴在圆点上，再弹向目标侧
    card.y(barY);
    card.scale(0.35);
    card.opacity(0);

    yield* all(
      dot.opacity(1, 0.25, easeOutCubic),
      dot.scale(1.25, 0.3, easeOutBack),
    );
    yield* dot.scale(1, 0.15, easeOutCubic);

    yield* all(
      card.opacity(1, 0.3, easeOutCubic),
      card.y(cardRestY, 0.45, easeOutBack),
      card.scale(1, 0.45, easeOutBack),
    );
  }

  /** 仅播放进度、不弹节点（备用） */
  public *growOnly(duration = 3): ThreadGenerator {
    yield* this.revealTrack();
    yield* this.fill().end(1, duration, easeInOutCubic);
  }
}
