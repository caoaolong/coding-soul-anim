import {Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  easeOutCubic,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const LINE = '#5a6a7c';
const BOX_BG = '#121820';
const BOX_BORDER = '#3dd6c6';

export interface Lz77FlowBadgeProps extends NodeProps {
  /** 中间框内文字，如「压缩」「解压」 */
  label?: string;
  /** 箭头总高度（含框） */
  height?: number;
  boxWidth?: number;
  boxHeight?: number;
}

/**
 * 竖直向下箭头，中段矩形标注（压缩 / 解压）。
 *
 * ```
 *   |
 * [压缩]
 *   |
 *   v
 * ```
 */
export class Lz77FlowBadge extends Node {
  private readonly topLine = createRef<Line>();
  private readonly botLine = createRef<Line>();
  private readonly box = createRef<Rect>();
  private readonly label = createRef<Txt>();

  public constructor(props: Lz77FlowBadgeProps = {}) {
    const {
      label = '压缩',
      height = 140,
      boxWidth = 100,
      boxHeight = 44,
      ...rest
    } = props;

    super({opacity: 0, ...rest});

    const half = height / 2;
    const gap = 8;
    const boxTop = -boxHeight / 2;
    const boxBot = boxHeight / 2;

    this.add(
      <Node>
        <Line
          ref={this.topLine}
          points={[
            [0, -half],
            [0, boxTop - gap],
          ]}
          stroke={LINE}
          lineWidth={3}
          lineCap={'round'}
          end={0}
        />
        <Rect
          ref={this.box}
          width={boxWidth}
          height={boxHeight}
          radius={8}
          fill={BOX_BG}
          stroke={BOX_BORDER}
          lineWidth={2}
          scale={0.85}
          opacity={0}
        />
        <Txt
          ref={this.label}
          text={label}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={PAPER}
          opacity={0}
          scale={0.85}
        />
        <Line
          ref={this.botLine}
          points={[
            [0, boxBot + gap],
            [0, half],
          ]}
          stroke={LINE}
          lineWidth={3}
          lineCap={'round'}
          endArrow
          arrowSize={14}
          end={0}
        />
      </Node>,
    );
  }

  public *show(duration = 0.45): ThreadGenerator {
    yield* all(
      this.opacity(1, duration * 0.5, easeOutCubic),
      this.topLine().end(1, duration, easeOutCubic),
      this.botLine().end(1, duration, easeOutCubic),
      this.box().opacity(1, duration * 0.7, easeOutCubic),
      this.box().scale(1, duration, easeOutCubic),
      this.label().opacity(1, duration * 0.7, easeOutCubic),
      this.label().scale(1, duration, easeOutCubic),
    );
  }

  public *hide(duration = 0.35): ThreadGenerator {
    yield* all(
      this.opacity(0, duration, easeOutCubic),
      this.box().scale(0.85, duration, easeOutCubic),
      this.label().scale(0.85, duration, easeOutCubic),
    );
  }
}
