import {Node, NodeProps, Path, Txt, initial, signal} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

export type BraceSide = 'up' | 'down';

export interface BraceProps extends NodeProps {
  /** 括号跨度（水平宽度） */
  length?: number;
  /** 括号开口方向：down=下方标注（常见），up=上方标注 */
  side?: BraceSide;
  /** 括号总深度（端点到尖端） */
  depth?: number;
  /** 描边颜色 */
  stroke?: string;
  /** 线宽 */
  lineWidth?: number;
  /** 括号旁/尖端处的标签 */
  label?: string;
  /** 标签字号 */
  labelSize?: number;
  /** 标签相对尖端的额外间距（不含字高） */
  labelGap?: number;
}

/**
 * 手写花括号：水平跨度 length，可朝上/朝下，可选中部标签。
 * 用于给一段内容做分组标注（如 IEEE754 的 S/E/M）。
 */
export class Brace extends Node {
  @initial(200)
  @signal()
  public declare readonly length: SimpleSignal<number, this>;

  @initial('down')
  @signal()
  public declare readonly side: SimpleSignal<BraceSide, this>;

  @initial(22)
  @signal()
  public declare readonly depth: SimpleSignal<number, this>;

  private readonly path = createRef<Path>();
  private readonly labelTxt = createRef<Txt>();
  private readonly labelText: string;

  public constructor(props?: BraceProps) {
    const {
      length = 200,
      side = 'down',
      depth = 22,
      stroke = '#e8eef7',
      lineWidth = 2.5,
      label = '',
      labelSize = 28,
      labelGap = 8,
      opacity = 0,
      ...rest
    } = props ?? {};

    super({opacity, ...rest});

    this.labelText = label;

    this.add(
      <Path
        ref={this.path}
        data={bracePath(length, depth, side)}
        stroke={stroke}
        lineWidth={lineWidth}
        lineCap={'round'}
        lineJoin={'round'}
        fill={null}
        end={0}
      />,
    );

    // 标签贴在尖端外侧：用 offset 让文字边沿对齐，避免与尖端重叠
    const tipY = braceTipY(depth, side);
    const labelY =
      side === 'down' ? tipY + labelGap : tipY - labelGap;

    this.add(
      <Txt
        ref={this.labelTxt}
        text={label}
        fontFamily={FONT}
        fontSize={labelSize}
        fontWeight={700}
        fill={stroke}
        y={labelY}
        // down：文字顶边贴 tip+gap；up：文字底边贴 tip-gap
        offset={side === 'down' ? [0, -1] : [0, 1]}
        opacity={0}
      />,
    );
  }

  /** 括号描线展开 + 标签淡入 */
  public *show(duration = 0.45): ThreadGenerator {
    yield* all(
      this.opacity(1, duration * 0.5, easeOutCubic),
      this.path().end(1, duration, easeInOutCubic),
      this.labelTxt().opacity(this.labelText ? 1 : 0, duration * 0.7, easeOutCubic),
    );
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* all(
      this.path().end(0, duration, easeInOutCubic),
      this.labelTxt().opacity(0, duration * 0.6, easeOutCubic),
      this.opacity(0, duration, easeOutCubic),
    );
  }
}

/** 尖端相对原点的 Y（与 bracePath 一致） */
function braceTipY(depth: number, side: BraceSide): number {
  return side === 'down' ? depth : -depth;
}

/**
 * 经典水平花括号（平滑三次贝塞尔）：
 * 两端外卷 + 中部尖角，整体深度 = depth。
 * 原点在跨度中心、贴齐被标注边。
 */
function bracePath(length: number, depth: number, side: BraceSide): string {
  const half = Math.max(length / 2, 12);
  const sign = side === 'down' ? 1 : -1;

  // 主体高度约占深度 58%，尖端再探出剩余部分；短跨度时略压深度观感
  const short = half < 28;
  const body = depth * (short ? 0.52 : 0.58);
  const tip = depth - body;

  // 端头卷曲 / 尖角随半宽缩放，避免单 bit 时被最小常量撑得过宽
  const curl = Math.min(half * (short ? 0.32 : 0.22), half * 0.4);
  const tipHalf = Math.min(tip * 0.85, half * (short ? 0.28 : 0.22));

  const y0 = 0;
  const yB = sign * body;
  const yT = sign * depth;

  // 左端 → 左肩 → 近尖 → 尖端 → 近尖 → 右肩 → 右端
  return [
    `M ${-half} ${y0}`,
    // 左端外卷落入主体
    `C ${-half} ${sign * body * 0.55} ${-half + curl * 0.15} ${yB} ${-half + curl} ${yB}`,
    // 左臂水平贴近尖角
    `L ${-tipHalf} ${yB}`,
    // 左半尖角
    `C ${-tipHalf * 0.35} ${yB} ${-tipHalf * 0.2} ${yT} 0 ${yT}`,
    // 右半尖角
    `C ${tipHalf * 0.2} ${yT} ${tipHalf * 0.35} ${yB} ${tipHalf} ${yB}`,
    // 右臂
    `L ${half - curl} ${yB}`,
    // 右端外卷回到端点
    `C ${half - curl * 0.15} ${yB} ${half} ${sign * body * 0.55} ${half} ${y0}`,
  ].join(' ');
}
