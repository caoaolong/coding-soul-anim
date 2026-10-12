import {
  Circle,
  Img,
  Latex,
  Layout,
  LayoutProps,
  Rect,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeOutBack,
  easeOutCubic,
} from '@motion-canvas/core';

import dieFace from '../../assets/dice/die_face.svg';

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

const PIP_DARK = '#1a2332';
const PIP_RED = '#e23131';
const BADGE_TEXT = '#e8eef7';
const BADGE_BG = '#152238';
const BADGE_STROKE = '#3dd6c6';

/** 点数相对中心的网格坐标（-1..1），y 向下为正 */
const PIP_LAYOUT: Record<DiceValue, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

export interface DiceProps extends Omit<LayoutProps, 'size'> {
  /** 当前点数 1–6，默认 1 */
  value?: DiceValue;
  /** 显示边长，默认 120 */
  size?: number;
  /**
   * 强制指定点数色；不传则：1、4 红，其余深色。
   */
  pipColor?: string;
  /** 右上角标注（KaTeX，如 `\\frac{1}{6}`） */
  badge?: string;
  badgeSize?: number;
  /** 标注文字颜色 */
  badgeFill?: string;
  /** 标注底色 */
  badgeBackground?: string;
  /** 标注边框色 */
  badgeStroke?: string;
}

function clampValue(n: number): DiceValue {
  const v = Math.round(n);
  if (v < 1 || v > 6) {
    throw new Error(`Dice: value 必须是 1–6，收到 ${n}`);
  }
  return v as DiceValue;
}

function pipColorFor(value: DiceValue): string {
  return value === 1 || value === 4 ? PIP_RED : PIP_DARK;
}

/**
 * 骰子：仅用 die_face 白底 + 手绘圆点（1/4 红，其余黑）。
 * 外层参与父级 flex 占位；内部 content 关闭 layout，把图/点/标注叠在格子中央。
 */
export class Dice extends Layout {
  @initial(1)
  @signal()
  public declare readonly value: SimpleSignal<DiceValue, this>;

  private readonly content = createRef<Layout>();
  private readonly face = createRef<Img>();
  private readonly pipsRoot = createRef<Layout>();
  private readonly badgeBox = createRef<Rect>();
  private readonly badgeTex = createRef<Latex>();

  private pipColorOverride: string | null;
  private hasBadge: boolean;
  private readonly pipRadius: number;
  private readonly pipOffset: number;

  public constructor(props: DiceProps = {}) {
    const {
      value = 1,
      size = 120,
      pipColor,
      badge,
      badgeSize,
      badgeFill = BADGE_TEXT,
      badgeBackground = BADGE_BG,
      badgeStroke = BADGE_STROKE,
      opacity = 0,
      ...rest
    } = props;

    // 外层占 size×size，供父级 gap 排布；不要 layout:false（否则会挤在一起）
    super({
      opacity,
      width: size,
      height: size,
      ...rest,
    });

    this.pipColorOverride = pipColor ?? null;
    this.hasBadge = Boolean(badge);
    this.pipRadius = size * 0.085;
    this.pipOffset = size * 0.175;
    const faceValue = clampValue(value);
    this.value(faceValue);
    const labelSize = badgeSize ?? Math.round(size * 0.28);

    this.add(
      <Layout ref={this.content} layout={false} width={size} height={size}>
        <Img
          ref={this.face}
          src={dieFace}
          width={size}
          height={size}
          zIndex={0}
        />
        <Layout ref={this.pipsRoot} layout={false} zIndex={1} />
        <Rect
          ref={this.badgeBox}
          layout
          direction={'row'}
          alignItems={'center'}
          justifyContent={'center'}
          padding={[6, 10]}
          radius={8}
          fill={badgeBackground}
          stroke={badgeStroke}
          lineWidth={2}
          x={size * 0.36}
          y={-size * 0.36}
          opacity={0}
          zIndex={2}
        >
          <Latex
            ref={this.badgeTex}
            tex={[badge ?? '']}
            fontSize={labelSize}
            fill={badgeFill}
          />
        </Rect>
      </Layout>,
    );
    this.rebuildPips(faceValue);
  }

  private pipFill(value: DiceValue): string {
    return this.pipColorOverride ?? pipColorFor(value);
  }

  private pipPosition(gx: number, gy: number): Vector2 {
    return new Vector2(gx * this.pipOffset, gy * this.pipOffset);
  }

  private rebuildPips(value: DiceValue) {
    this.pipsRoot().removeChildren();
    const fill = this.pipFill(value);
    const d = this.pipRadius * 2;
    for (const [gx, gy] of PIP_LAYOUT[value]) {
      const pos = this.pipPosition(gx, gy);
      this.pipsRoot().add(
        <Circle width={d} height={d} x={pos.x} y={pos.y} fill={fill} />,
      );
    }
  }

  public getValue(): DiceValue {
    return this.value();
  }

  public *setValue(
    next: number,
    options?: {animate?: boolean; duration?: number},
  ): ThreadGenerator {
    const v = clampValue(next);
    const animate = options?.animate ?? true;
    const duration = options?.duration ?? 0.22;
    if (v === this.value()) return;

    if (animate) {
      yield* this.scale(0.9, duration * 0.4, easeOutCubic);
    }
    this.value(v);
    this.rebuildPips(v);
    if (animate) {
      yield* this.scale(1, duration * 0.6, easeOutBack);
    }
  }

  public *setPipColor(color: string, duration = 0.3): ThreadGenerator {
    this.pipColorOverride = color;
    const circles = this.pipsRoot().childrenAs<Circle>();
    if (circles.length === 0) return;
    yield* all(
      ...circles.map((c: Circle) => c.fill(color, duration, easeOutCubic)),
    );
  }

  public setBadge(tex: string) {
    this.hasBadge = true;
    this.badgeTex().tex([tex]);
  }

  public *showBadge(duration = 0.35): ThreadGenerator {
    if (!this.hasBadge) return;
    this.badgeBox().scale(0.85);
    yield* all(
      this.badgeBox().opacity(1, duration, easeOutCubic),
      this.badgeBox().scale(1, duration, easeOutBack),
    );
  }

  public *hideBadge(duration = 0.25): ThreadGenerator {
    yield* this.badgeBox().opacity(0, duration, easeOutCubic);
  }

  public *show(duration = 0.4): ThreadGenerator {
    this.scale(0.88);
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration, easeOutBack),
    );
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* this.opacity(0, duration, easeOutCubic);
  }
}
