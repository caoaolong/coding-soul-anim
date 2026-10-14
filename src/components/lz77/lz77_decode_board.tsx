import {Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
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
import {lz77TokenAccent, type Lz77Token} from './lz77_token_style';

const MUTED = '#6a7a8c';
const CHAR_COLOR = '#e8eef7';
const ORIG_COLOR = '#8a9bb0';
const OUTER_BORDER = '#2a3a4c';
const NEWLINE_GLYPH = '↩︎';
const MONO = '"Cascadia Mono", "Consolas", monospace';

function displayChar(ch: string): string {
  if (ch === '\n' || ch === '\r') return NEWLINE_GLYPH;
  if (ch === ' ') return '␣';
  return ch;
}

/** 默认画布宽（与 project 1920 一致） */
const VIEW_WIDTH = 1920;
/** 左右各留边距 */
const SIDE_MARGIN = 100;

export interface Lz77DecodeBoardProps extends NodeProps {
  fontSize?: number;
  charStep?: number;
  /** 适配缩放时左右边距，默认 100 */
  sideMargin?: number;
  /** 画布宽度，默认 1920 */
  viewWidth?: number;
}

/**
 * LZ77 还原板：按三元组顺序拼回字符串。
 * - offset>0 且 length>0：框选源串 → 逐字飞入复制到末尾 → 再写 next
 * - 字面量：直接落下 next
 * - 完成后可在下方上移淡入原始串（与还原串逐字对齐）
 */
export class Lz77DecodeBoard extends Node {
  private readonly fontSize: number;
  private readonly charStep: number;
  private readonly sideMargin: number;
  private readonly viewWidth: number;

  private readonly content = createRef<Node>();
  private readonly frame = createRef<Rect>();
  private readonly charsRoot = createRef<Layout>();
  private readonly originalsRoot = createRef<Layout>();
  private readonly charTxts = createRefArray<Txt>();
  private readonly originalTxts = createRefArray<Txt>();
  private readonly mark = createRef<Rect>();
  private readonly decoded: string[] = [];

  public constructor(props: Lz77DecodeBoardProps = {}) {
    const {
      fontSize = 48,
      charStep = 56,
      sideMargin = SIDE_MARGIN,
      viewWidth = VIEW_WIDTH,
      ...rest
    } = props;
    super({opacity: 0, ...rest});

    this.fontSize = fontSize;
    this.charStep = charStep;
    this.sideMargin = sideMargin;
    this.viewWidth = viewWidth;

    this.add(
      <Node ref={this.content}>
        <Rect
          ref={this.frame}
          width={200}
          height={fontSize + 44}
          stroke={OUTER_BORDER}
          lineWidth={2.5}
          radius={10}
          fill={'#00000000'}
          opacity={0}
        />
        <Layout ref={this.charsRoot} layout={false}>
          <Rect
            ref={this.mark}
            width={0}
            height={fontSize + 20}
            stroke={'#3dd6c6'}
            lineWidth={3}
            radius={6}
            fill={'#3dd6c622'}
            opacity={0}
            y={0}
          />
        </Layout>
        {/* 与还原串共用同一套 x 坐标，保证逐字对齐 */}
        <Layout ref={this.originalsRoot} layout={false} />
      </Node>,
    );
  }

  public getDecoded(): string {
    return this.decoded.join('');
  }

  /** 框架入场 */
  public *show(duration = 0.45): ThreadGenerator {
    yield* all(
      this.opacity(1, duration * 0.6, easeOutCubic),
      this.frame().opacity(1, duration, easeOutCubic),
    );
  }

  /** 还原单个三元组 */
  public *stepToken(
    token: Lz77Token,
    options?: {beat?: number},
  ): ThreadGenerator {
    const beat = options?.beat ?? 0.12;
    yield* this.applyToken(token, lz77TokenAccent(token), beat);
  }

  /** 按 token 列表逐步还原 */
  public *replay(
    tokens: Lz77Token[],
    options?: {beat?: number; hold?: number},
  ): ThreadGenerator {
    const beat = options?.beat ?? 0.12;
    const hold = options?.hold ?? 0.35;

    for (const token of tokens) {
      yield* this.stepToken(token, {beat});
      yield* waitFor(hold);
    }

    yield* this.finish();
  }

  /** 收尾停顿 */
  public *finish(duration = 0.4): ThreadGenerator {
    yield* waitFor(duration);
  }

  /**
   * 在还原串下方上移淡入原始字符串（逐字对齐），
   * 同时将两行整体缩小到屏幕可容纳（左右留边距）。
   */
  public *revealOriginal(
    original: string,
    duration = 0.65,
  ): ThreadGenerator {
    const chars = [...original];
    const gap = this.fontSize + 36;
    const yFrom = gap + 36;
    const yTo = gap;

    // 与还原串使用相同的水平偏移
    this.originalsRoot().x(this.charsRoot().x());

    for (let i = 0; i < chars.length; i++) {
      const disp = displayChar(chars[i]);
      const muted = disp === '␣' || disp === NEWLINE_GLYPH;
      this.originalsRoot().add(
        <Txt
          ref={this.originalTxts}
          text={disp}
          fontFamily={MONO}
          fontSize={this.fontSize}
          fill={muted ? MUTED : ORIG_COLOR}
          x={this.charX(i)}
          y={yFrom}
          opacity={0}
        />,
      );
    }

    const fitScale = this.computeFitScale();
    const fadeAnims = this.originalTxts.map(t =>
      all(
        t.opacity(1, duration, easeOutCubic),
        t.y(yTo, duration, easeOutCubic),
      ),
    );

    yield* all(
      this.content().scale(fitScale, duration, easeInOutCubic),
      ...fadeAnims,
    );
  }

  /** 按画布宽度与左右边距计算整体缩放 */
  private computeFitScale(): number {
    const contentW = this.frame().width();
    const available = this.viewWidth - this.sideMargin * 2;
    if (contentW <= 0) return 1;
    return Math.min(1, available / contentW);
  }

  private *applyToken(
    token: Lz77Token,
    accent: string,
    beat: number,
  ): ThreadGenerator {
    if (token.kind === 'literal') {
      yield* this.appendLiteral(token.char, accent, beat * 1.15);
      return;
    }

    // 引用 (length, offset)：框选源串后逐字复制
    const start = this.decoded.length - token.offset;
    if (start >= 0 && token.offset <= this.decoded.length) {
      const visibleEnd = this.decoded.length;
      yield* this.showSourceMark(start, visibleEnd, accent, 0.35);
      yield* waitFor(0.28);

      for (let i = 0; i < token.length; i++) {
        yield* this.copyAppendFrom(start + i, accent, beat);
      }

      yield* this.hideSourceMark(0.25);
    }
  }

  private *showSourceMark(
    from: number,
    to: number,
    color: string,
    duration: number,
  ): ThreadGenerator {
    if (to <= from || from >= this.charTxts.length) return;

    const last = Math.min(to, this.charTxts.length) - 1;
    const pad = this.charStep * 0.42;
    const left = this.charX(from) - pad;
    const right = this.charX(last) + pad;
    this.mark().stroke(color);
    this.mark().fill(color + '28');
    this.mark().width(Math.max(right - left, this.charStep));
    this.mark().x((left + right) / 2);
    this.mark().height(this.fontSize + 22);

    const tints = [];
    for (let i = from; i <= last; i++) {
      tints.push(this.charTxts[i].fill(color, duration, easeOutCubic));
    }
    yield* all(
      this.mark().opacity(1, duration, easeOutCubic),
      this.mark().scale(1.04, duration * 0.5, easeOutCubic),
      ...tints,
    );
    yield* this.mark().scale(1, 0.15, easeOutCubic);
  }

  private *hideSourceMark(duration: number): ThreadGenerator {
    const restores = [];
    for (let i = 0; i < this.charTxts.length; i++) {
      const disp = this.charTxts[i].text();
      const muted = disp === '␣' || disp === NEWLINE_GLYPH;
      restores.push(
        this.charTxts[i].fill(
          muted ? MUTED : CHAR_COLOR,
          duration,
          easeOutCubic,
        ),
      );
    }
    yield* all(
      this.mark().opacity(0, duration, easeOutCubic),
      ...restores,
    );
  }

  private *copyAppendFrom(
    srcIndex: number,
    accent: string,
    beat: number,
  ): ThreadGenerator {
    const ch = this.decoded[srcIndex];
    const destIndex = this.decoded.length;
    const disp = displayChar(ch);
    const muted = disp === '␣' || disp === NEWLINE_GLYPH;

    this.decoded.push(ch);
    this.charsRoot().add(
      <Txt
        ref={this.charTxts}
        text={disp}
        fontFamily={MONO}
        fontSize={this.fontSize}
        fill={muted ? MUTED : accent}
        x={this.charX(destIndex)}
        y={0}
        opacity={0}
      />,
    );
    this.relayoutFrame();
    // 原始串若已存在则同步水平偏移
    this.originalsRoot().x(this.charsRoot().x());
    yield;

    const start = this.charTxts[srcIndex].absolutePosition();
    const end = this.charTxts[destIndex].absolutePosition();

    const flyer = createRef<Txt>();
    this.view().add(
      <Txt
        ref={flyer}
        text={disp}
        fontFamily={MONO}
        fontSize={this.fontSize}
        fill={muted ? MUTED : accent}
        zIndex={100}
        opacity={1}
        scale={1.08}
      />,
    );
    flyer().absolutePosition(start);

    yield* all(
      this.charTxts[srcIndex].scale(1.12, beat * 0.45, easeOutCubic),
      flyer().scale(1.2, beat * 0.45, easeOutCubic),
    );

    const flyDur = Math.max(0.28, beat * 2.2);
    yield* all(
      flyer().absolutePosition(end, flyDur, easeInOutCubic),
      flyer().scale(1, flyDur, easeInOutCubic),
      this.charTxts[srcIndex].scale(1, flyDur * 0.6, easeOutCubic),
    );

    const dest = this.charTxts[destIndex];
    dest.opacity(1);
    flyer().remove();

    yield* dest.fill(muted ? MUTED : CHAR_COLOR, beat * 1.1, easeOutCubic);
  }

  private *appendLiteral(
    ch: string,
    color: string,
    beat: number,
  ): ThreadGenerator {
    const i = this.decoded.length;
    this.decoded.push(ch);
    const disp = displayChar(ch);
    const muted = disp === '␣' || disp === NEWLINE_GLYPH;

    this.charsRoot().add(
      <Txt
        ref={this.charTxts}
        text={disp}
        fontFamily={MONO}
        fontSize={this.fontSize}
        fill={muted ? MUTED : color}
        x={this.charX(i)}
        y={0}
        opacity={0}
        scale={0.7}
      />,
    );

    this.relayoutFrame();
    this.originalsRoot().x(this.charsRoot().x());
    const txt = this.charTxts[i];
    yield* all(
      txt.opacity(1, beat, easeOutCubic),
      txt.scale(1, beat * 1.1, easeOutBack),
    );
    yield* txt.fill(muted ? MUTED : CHAR_COLOR, beat * 1.2, easeOutCubic);
  }

  private charX(index: number): number {
    return index * this.charStep;
  }

  private relayoutFrame() {
    const n = this.decoded.length;
    const pad = 28;
    const span = n <= 1 ? 0 : (n - 1) * this.charStep;
    const w = Math.max(200, span + this.fontSize + pad * 2);
    const centerX = span / 2;
    this.frame().width(w);
    this.frame().height(this.fontSize + 44);
    this.frame().x(0);
    this.charsRoot().x(-centerX);
    this.originalsRoot().x(-centerX);
  }
}
