import { Latex, Layout, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";

export interface QuestionProps extends NodeProps {
  /** LaTeX 文本（单行），显示在屏幕中央 */
  tex: string;
  /** 文本字号，默认 56 */
  fontSize?: number;
  /** 文本颜色，默认 Ink.paper */
  fill?: string;
  /** 疑问表情，默认 🤔 */
  emoji?: string;
  /** 表情字号，默认 128 */
  emojiSize?: number;
  /** 文本与表情的间距，默认 56 */
  gap?: number;
}

export interface QuestionWonderOptions {
  /** 表情放大的时长（秒），默认 0.4 */
  popDuration?: number;
  /** 每次晃动的时长（秒），默认 0.2 */
  wobbleDuration?: number;
  /** 来回晃动的回合数，默认 3 */
  rounds?: number;
}

/**
 * 提问组件：屏幕中央用 LaTeX 显示一行文本，
 * 随后弹出疑问表情，放大并来回晃动几次。
 */
export class Question extends Node {
  private readonly latex = createRef<Latex>();
  private readonly face = createRef<Txt>();

  public constructor(props: QuestionProps) {
    const {
      tex,
      fontSize = 56,
      fill = Ink.paper,
      emoji = "🤔",
      emojiSize = 128,
      gap = 56,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.add(
      <Layout
        layout
        direction={"column"}
        gap={gap}
        alignItems={"center"}
        justifyContent={"center"}
      >
        <Latex
          ref={this.latex}
          tex={`{${tex}}`}
          fill={fill}
          fontSize={fontSize}
          opacity={0}
        />
        <Txt
          ref={this.face}
          text={emoji}
          fontSize={emojiSize}
          opacity={0}
          scale={0}
        />
      </Layout>,
    );
  }

  /** 显示 LaTeX 文本行 */
  public *showText(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this.latex(), { duration, fromY: 12 });
  }

  /**
   * 弹出疑问表情：先放大，再左右来回晃动（角度逐次衰减）。
   */
  public *wonder(options: QuestionWonderOptions = {}): ThreadGenerator {
    const { popDuration = 0.4, wobbleDuration = 0.2, rounds = 3 } = options;
    const face = this.face();
    face.rotation(0);
    face.scale(0);
    face.opacity(0);

    yield* all(
      face.opacity(1, popDuration * 0.6, easeOutCubic),
      face.scale(1.25, popDuration, easeOutBack).to(1, 0.18, easeOutCubic),
    );

    const peaks = [16, 14, 10];
    const total = Math.max(1, Math.round(rounds));
    for (let r = 0; r < total; r++) {
      const peak = peaks[Math.min(r, peaks.length - 1)];
      yield* face.rotation(-peak, wobbleDuration, easeInOutCubic);
      yield* face.rotation(peak, wobbleDuration, easeInOutCubic);
    }
    yield* face.rotation(0, wobbleDuration, easeInOutCubic);
  }

  /** 完整播放：文本 → 表情放大 → 来回晃动 */
  public *play(
    options: QuestionWonderOptions & {
      textDuration?: number;
      pause?: number;
    } = {},
  ): ThreadGenerator {
    const { textDuration = 0.55, pause = 0.35, ...wonderOptions } = options;
    yield* this.showText(textDuration);
    yield* waitFor(pause);
    yield* this.wonder(wonderOptions);
  }

  /** 整组隐去 */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* inkFade([this.latex(), this.face()], { duration });
  }
}
