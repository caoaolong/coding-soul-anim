import {
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

export interface QuestionProps extends NodeProps {
  /**
   * 问题正文（末尾会自动追加 🤔）。
   * 支持 `**强调**`：强调段使用 emphasis 色。
   */
  text?: string;
  /** 落定后的 y（画面坐标，默认 -420，靠上居中） */
  top?: number;
  /** 问题文字字号，默认 36 */
  fontSize?: number;
  /** `**强调**` 段的颜色，默认暖橙 */
  emphasis?: string;
}

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const EMPHASIS = '#f0a060';
const EMOJI = '🤔';
/** 入场起始高度（画面上方外侧） */
const DROP_FROM = -720;

interface TextSegment {
  text: string;
  emph: boolean;
}

/** 解析 `**强调**` 标记为普通 / 强调片段 */
export function parseEmphasisSegments(input: string): TextSegment[] {
  const parts: TextSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) {
    if (match.index > last) {
      parts.push({text: input.slice(last, match.index), emph: false});
    }
    parts.push({text: match[1], emph: true});
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    parts.push({text: input.slice(last), emph: false});
  }
  if (parts.length === 0) {
    parts.push({text: input, emph: false});
  }
  return parts;
}

/**
 * 场景顶层浮动问题：虚线框、宽度随内容、水平居中；
 * 从顶部掉落入场，显示完后 🤔 左右晃动。
 * 正文支持 `**强调**` 高亮色。
 *
 * @example
 * ```tsx
 * const q = createRef<Question>();
 * view.add(<Question ref={q} text="找到 **0.2345** 该怎么做？" zIndex={100} />);
 * yield* q().ask();
 * ```
 */
export class Question extends Node {
  @initial('')
  @signal()
  public declare readonly text: SimpleSignal<string, this>;

  @initial(-420)
  @signal()
  public declare readonly top: SimpleSignal<number, this>;

  @initial(36)
  @signal()
  public declare readonly fontSize: SimpleSignal<number, this>;

  private readonly panel = createRef<Rect>();
  private readonly emoji = createRef<Txt>();
  private readonly restY: number;

  public constructor(props?: QuestionProps) {
    super({
      zIndex: 100,
      opacity: 0,
      ...props,
    });

    const fontSize = props?.fontSize ?? 36;
    const top = props?.top ?? -420;
    const question = props?.text ?? '';
    const emphasis = props?.emphasis ?? EMPHASIS;
    this.restY = top;

    const segments = parseEmphasisSegments(question);

    this.add(
      <Rect
        ref={this.panel}
        layout
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        gap={14}
        padding={[20, 32]}
        x={0}
        y={DROP_FROM}
        fill={'rgba(10,14,20,0.55)'}
        stroke={ACCENT}
        lineWidth={2.5}
        lineDash={[10, 8]}
        radius={14}
      >
        <Layout direction={'row'} alignItems={'center'} gap={0}>
          {segments.map(seg => (
            <Txt
              text={seg.text}
              fontFamily={FONT}
              fontSize={fontSize}
              fontWeight={700}
              fill={seg.emph ? emphasis : PAPER}
              textWrap={false}
            />
          ))}
        </Layout>
        <Txt
          ref={this.emoji}
          text={EMOJI}
          fontSize={fontSize + 10}
          y={2}
        />
      </Rect>,
    );
  }

  /** 从顶部掉落入场（宽度随内容，水平居中） */
  public *show(duration = 0.55): ThreadGenerator {
    yield* all(
      this.opacity(1, duration * 0.45, easeOutCubic),
      this.panel().y(this.restY, duration, easeOutBack),
    );
  }

  /** 🤔 左右晃几下 */
  public *wobble(cycles = 3, amplitude = 14, beat = 0.12): ThreadGenerator {
    const e = this.emoji();
    for (let i = 0; i < cycles; i++) {
      yield* e.rotation(amplitude, beat, easeInOutCubic);
      yield* e.rotation(-amplitude, beat * 2, easeInOutCubic);
      yield* e.rotation(amplitude * 0.6, beat, easeInOutCubic);
    }
    yield* e.rotation(0, beat, easeOutCubic);
  }

  /** 完整流程：掉落显示 → 停顿 → 表情晃动 */
  public *ask(options?: {
    showDuration?: number;
    hold?: number;
    cycles?: number;
  }): ThreadGenerator {
    const showDuration = options?.showDuration ?? 0.55;
    const hold = options?.hold ?? 0.35;
    const cycles = options?.cycles ?? 3;

    yield* this.show(showDuration);
    yield* waitFor(hold);
    yield* this.wobble(cycles);
  }

  public *hide(duration = 0.35): ThreadGenerator {
    yield* all(
      this.opacity(0, duration, easeOutCubic),
      this.panel().y(this.restY - 40, duration, easeInOutCubic),
    );
  }
}
