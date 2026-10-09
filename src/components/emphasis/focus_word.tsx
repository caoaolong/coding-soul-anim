import {Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  easeInCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const VEIL = 'rgba(10,14,20,0.62)';

/** 1920×1080：屏外顶部 / 右侧 */
const DROP_FROM_Y = -720;
const SLIDE_TO_X = 1480;

export interface FocusWordProps extends NodeProps {
  /** 要强调的词语 */
  text?: string;
  /** 字号，默认 96 */
  fontSize?: number;
  /** 文字颜色，默认纸色 */
  fill?: string;
  /** 是否铺一层压暗遮罩，默认 true */
  veil?: boolean;
}

/**
 * 词语强调：自屏幕顶部落入正中，停留后向右滑出。
 *
 * @example
 * ```tsx
 * const word = createRef<FocusWord>();
 * view.add(<FocusWord ref={word} text="精度丢失" />);
 * yield* word().play();
 * ```
 */
export class FocusWord extends Node {
  private readonly veilRect = createRef<Rect>();
  private readonly label = createRef<Txt>();
  private readonly useVeil: boolean;

  public constructor(props: FocusWordProps = {}) {
    const {
      text = '',
      fontSize = 96,
      fill = PAPER,
      veil = true,
      ...rest
    } = props;

    super({zIndex: 80, ...rest});
    this.useVeil = veil;

    if (veil) {
      this.add(
        <Rect
          ref={this.veilRect}
          width={1920}
          height={1080}
          fill={VEIL}
          opacity={0}
        />,
      );
    }

    this.add(
      <Txt
        ref={this.label}
        text={text}
        fontFamily={'"Microsoft YaHei", "PingFang SC", "CMU Roman", sans-serif'}
        fontSize={fontSize}
        fontWeight={700}
        fill={fill}
        shadowColor={ACCENT}
        shadowBlur={0}
        y={DROP_FROM_Y}
        opacity={0}
      />,
    );
  }

  /** 从顶部落入屏幕中央 */
  public *drop(duration = 0.7): ThreadGenerator {
    const fades: ThreadGenerator[] = [
      this.label().y(0, duration, easeOutBack),
      this.label().opacity(1, duration * 0.35, easeOutCubic),
      this.label().shadowBlur(28, duration, easeOutCubic),
    ];
    if (this.useVeil) {
      fades.push(this.veilRect().opacity(1, duration * 0.45, easeOutCubic));
    }
    yield* all(...fades);
  }

  /** 向右滑出屏幕 */
  public *slideOut(duration = 0.55): ThreadGenerator {
    const fades: ThreadGenerator[] = [
      this.label().x(SLIDE_TO_X, duration, easeInCubic),
      this.label().opacity(0, duration, easeInCubic),
    ];
    if (this.useVeil) {
      fades.push(this.veilRect().opacity(0, duration * 0.8, easeInCubic));
    }
    yield* all(...fades);
  }

  /**
   * 完整强调：落入 → 停留 → 滑出。
   * @param hold 停留秒数，默认 0.9
   */
  public *play(hold = 0.9): ThreadGenerator {
    yield* this.drop();
    yield* waitFor(hold);
    yield* this.slideOut();
  }

  /** 中途改词（下次 drop 前调用） */
  public setText(value: string) {
    this.label().text(value);
  }
}
