import {Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';
import {
  MIN_MATCH_LENGTH,
  formatTokenLabel,
  lz77TokenAccent,
  type Lz77Token,
} from './lz77_token_style';

export type {Lz77Token};
export {MIN_MATCH_LENGTH};

const PAPER = '#e8eef7';
const MUTED = '#6a7a8c';
const CHAR_COLOR = '#e8eef7';
const SEARCH_BORDER = '#7aa2ff';
const LOOKAHEAD_BORDER = '#f0a060';
const SCAN_COLOR = '#ffe08a';
const MATCH_COLOR = '#3dd6c6';
const NEXT_COLOR = '#ff7a9a';
const TOKEN_BG = '#121820';
const TOKEN_BORDER = '#2a3a4c';
const OUTER_BORDER = '#2a3a4c';

const NEWLINE_GLYPH = '↩︎';
/** 字符串外边框相对字符中心的水平/垂直内边距 */
const FRAME_PAD_X = 28;
const FRAME_PAD_Y = 22;

export interface Lz77BoardProps extends NodeProps {
  /** 原始输入文本（可含换行） */
  text: string;
  /** 搜索窗口最大字符数 */
  windowSize?: number;
  /** Look-ahead 最大字符数 */
  lookAheadSize?: number;
  fontSize?: number;
  /** 字符水平间距（中心到中心） */
  charStep?: number;
  /** 字符基线 y（相对组件原点） */
  textY?: number;
}

/**
 * LZ77 双缓冲演示板：
 * - 单行字符（换行显示为 ↩︎），可向右延伸
 * - 上方：搜索窗 / look-ahead 仅边框
 * - 颜色高亮演示最长匹配查找
 */
export class Lz77Board extends Node {
  private readonly chars: string[];
  private readonly display: string[];
  private readonly windowSize: number;
  private readonly lookAheadSize: number;
  private readonly fontSize: number;
  private readonly charStep: number;
  private readonly textY: number;

  private readonly charTxts = createRefArray<Txt>();
  private readonly outerFrame = createRef<Rect>();
  private readonly searchWin = createRef<Rect>();
  private readonly lookWin = createRef<Rect>();
  private readonly searchLabel = createRef<Txt>();
  private readonly lookLabel = createRef<Txt>();
  private readonly tokenBox = createRef<Rect>();
  private readonly tokenTxt = createRef<Txt>();
  private readonly content = createRef<Node>();

  /** 已编码字符数（look-ahead 起点） */
  private cursor = 0;
  private lastToken: Lz77Token | null = null;
  private readonly baseFills: string[] = [];

  public constructor(props: Lz77BoardProps) {
    const {
      text,
      windowSize = 8,
      lookAheadSize = 4,
      fontSize = 56,
      charStep = 72,
      textY = 0,
      ...rest
    } = props;

    super({...rest});

    this.chars = [...text];
    this.display = this.chars.map(ch =>
      ch === '\n' || ch === '\r' ? NEWLINE_GLYPH : ch === ' ' ? '␣' : ch,
    );
    this.windowSize = windowSize;
    this.lookAheadSize = lookAheadSize;
    this.fontSize = fontSize;
    this.charStep = charStep;
    this.textY = textY;

    // 文本从 x=0 起向右延伸；组件原点在首字符处，便于左起开窗
    const n = this.display.length;
    const frameLeft = -FRAME_PAD_X;
    const frameRight = Math.max(0, n - 1) * charStep + FRAME_PAD_X;
    const frameW = Math.max(frameRight - frameLeft, fontSize + FRAME_PAD_X * 2);
    const frameH = fontSize + FRAME_PAD_Y * 2;
    const frameX = (frameLeft + frameRight) / 2;
    const frameY = textY;

    // 滑动窗与字符串同高，真正框选字符；标签仍在框上方
    const winH = frameH + 8;
    const winY = frameY;
    const labelY = frameY - frameH / 2 - 28;
    const tokenPlaceholder = '(0, 0, _)';

    this.add(
      <Node ref={this.content}>
        <Rect
          ref={this.outerFrame}
          x={frameX}
          y={frameY}
          width={frameW}
          height={frameH}
          stroke={OUTER_BORDER}
          lineWidth={2.5}
          radius={10}
          fill={'#00000000'}
          opacity={0}
        />
        <Rect
          ref={this.searchWin}
          x={0}
          y={winY}
          width={0}
          height={winH}
          stroke={SEARCH_BORDER}
          lineWidth={3}
          radius={6}
          fill={'#00000000'}
          opacity={0}
        />
        <Rect
          ref={this.lookWin}
          x={0}
          y={winY}
          width={0}
          height={winH}
          stroke={LOOKAHEAD_BORDER}
          lineWidth={3}
          radius={6}
          fill={'#00000000'}
          opacity={0}
        />
        <Txt
          ref={this.searchLabel}
          text={'搜索窗'}
          fontFamily={FONT}
          fontSize={22}
          fill={SEARCH_BORDER}
          y={labelY}
          opacity={0}
        />
        <Txt
          ref={this.lookLabel}
          text={'Look-ahead'}
          fontFamily={FONT}
          fontSize={22}
          fill={LOOKAHEAD_BORDER}
          y={labelY}
          opacity={0}
        />
        <Layout layout={false}>
          {this.display.map((ch, i) => {
            const muted = ch === '␣' || ch === NEWLINE_GLYPH;
            const fill = muted ? MUTED : CHAR_COLOR;
            this.baseFills.push(fill);
            return (
              <Txt
                ref={this.charTxts}
                text={ch}
                fontFamily={'"Cascadia Mono", "Consolas", monospace'}
                fontSize={fontSize}
                fill={fill}
                x={i * charStep}
                y={textY}
                opacity={0}
              />
            );
          })}
        </Layout>
        <Rect
          ref={this.tokenBox}
          y={textY + frameH / 2 + 64}
          width={400}
          height={60}
          radius={8}
          fill={TOKEN_BG}
          stroke={TOKEN_BORDER}
          lineWidth={2}
          opacity={0}
        />
        <Txt
          ref={this.tokenTxt}
          text={tokenPlaceholder}
          fontFamily={'"Cascadia Mono", "Consolas", monospace'}
          fontSize={30}
          fill={PAPER}
          y={textY + frameH / 2 + 64}
          opacity={0}
        />
      </Node>,
    );
  }

  public get length(): number {
    return this.chars.length;
  }

  public getCursor(): number {
    return this.cursor;
  }

  public isDone(): boolean {
    return this.cursor >= this.chars.length;
  }

  /** 最近一步产出的 token（step 之后可读） */
  public getLastToken(): Lz77Token | null {
    return this.lastToken;
  }

  /** 将 token 格式化为气泡文案 */
  public formatTokenLabel(token: Lz77Token): string {
    return formatTokenLabel(token);
  }

  /** 二元组气泡的世界坐标（飞入表格用） */
  public tokenPopupAbsolutePosition(): Vector2 {
    return this.tokenBox().absolutePosition();
  }

  /** 隐藏二元组气泡 */
  public *hideTokenPopup(duration = 0.2): ThreadGenerator {
    yield* all(
      this.tokenBox().opacity(0, duration, easeOutCubic),
      this.tokenTxt().opacity(0, duration, easeOutCubic),
    );
  }

  /** 字符中心 x（组件本地） */
  public charX(index: number): number {
    return index * this.charStep;
  }

  /** 整串几何中心（本地 x） */
  private stringCenterX(): number {
    const n = this.chars.length;
    if (n <= 0) return 0;
    return (this.charX(0) + this.charX(n - 1)) / 2;
  }

  /**
   * 字符入场 + 外边框 / 窗口出现：
   * 1) 整串先居中显示
   * 2) 画出搜索窗 / Look-ahead
   * 3) 再平移到窗口居中位置
   */
  public *show(duration = 0.6): ThreadGenerator {
    // 入场前先把整串放到屏幕中央
    this.content().x(-this.x() - this.stringCenterX());

    yield* this.outerFrame().opacity(1, 0.35, easeOutCubic);
    const n = this.charTxts.length;
    const beat = Math.min(0.05, duration / Math.max(1, n));
    for (let i = 0; i < n; i++) {
      yield* all(
        this.charTxts[i].opacity(1, beat * 2, easeOutCubic),
      );
      if (i < n - 1) yield* waitFor(beat * 0.35);
    }

    this.layoutWindows(false);
    // 搜索窗大小为 0（编码起始）时不显示
    const searchEmpty = this.cursor <= 0;
    yield* all(
      this.searchWin().opacity(searchEmpty ? 0 : 1, 0.4, easeOutCubic),
      this.lookWin().opacity(1, 0.4, easeOutCubic),
      this.searchLabel().opacity(searchEmpty ? 0 : 1, 0.4, easeOutCubic),
      this.lookLabel().opacity(1, 0.4, easeOutCubic),
    );

    yield* waitFor(0.25);
    const lookTo0 = Math.min(this.chars.length, this.lookAheadSize);
    yield* this.panToWindowSpan(0, 0, 0, lookTo0, 0.55);
  }

  /** 执行一步编码动画；已结束则直接返回。结果见 getLastToken() */
  public *step(options?: {
    scanBeat?: number;
    holdMatch?: number;
    holdToken?: number;
    /** 是否在字符串下方弹出二元组气泡，默认 true */
    showTokenPopup?: boolean;
    /** 弹出后保持可见（供飞入表格），默认 false */
    keepTokenVisible?: boolean;
  }): ThreadGenerator {
    if (this.isDone()) {
      this.lastToken = null;
      return;
    }

    const scanBeat = options?.scanBeat ?? 0.12;
    const holdMatch = options?.holdMatch ?? 0.55;
    const holdToken = options?.holdToken ?? 0.7;
    const showTokenPopup = options?.showTokenPopup ?? true;
    const keepTokenVisible = options?.keepTokenVisible ?? false;

    const token = this.encodeAt(this.cursor);
    const searchFrom = Math.max(0, this.cursor - this.windowSize);
    const searchTo = this.cursor; // exclusive
    const lookTo = Math.min(
      this.chars.length,
      this.cursor + this.lookAheadSize,
    );

    yield* all(
      this.moveWindows(searchFrom, searchTo, this.cursor, lookTo, 0.45),
      this.panToWindowSpan(searchFrom, searchTo, this.cursor, lookTo, 0.45),
    );
    yield* this.resetCharColors(0.2);

    // 1) 高亮 look-ahead 待匹配前缀（先整段淡色，再强调首位）
    if (this.cursor < lookTo) {
      yield* this.tintRange(this.cursor, lookTo, LOOKAHEAD_BORDER, 0.25);
      yield* this.tintRange(this.cursor, this.cursor + 1, SCAN_COLOR, 0.2);
    }

    // 2) 在搜索窗内从右往左扫，找与 look-ahead 对齐的候选
    if (searchTo > searchFrom) {
      for (let i = searchTo - 1; i >= searchFrom; i--) {
        yield* this.tintRange(i, i + 1, SCAN_COLOR, scanBeat * 0.55);
        const len = this.matchLength(i, this.cursor);
        if (len > 0) {
          yield* all(
            this.tintRange(i, i + Math.min(len, 1), SCAN_COLOR, scanBeat * 0.4),
            this.tintRange(
              this.cursor,
              this.cursor + Math.min(len, 1),
              SCAN_COLOR,
              scanBeat * 0.4,
            ),
          );
        }
        yield* this.tintRange(i, i + 1, this.baseFills[i], scanBeat * 0.35);
      }
    }

    // 3) 高亮结果：引用高亮匹配段，字面量高亮单字符
    yield* this.resetCharColors(0.15);
    if (token.kind === 'ref') {
      const matchStart = this.cursor - token.offset;
      yield* all(
        this.tintRange(matchStart, matchStart + token.length, MATCH_COLOR, 0.35),
        this.tintRange(
          this.cursor,
          this.cursor + token.length,
          MATCH_COLOR,
          0.35,
        ),
      );
    } else {
      yield* this.tintRange(this.cursor, this.cursor + 1, NEXT_COLOR, 0.25);
    }
    yield* waitFor(holdMatch);

    // 4) 可选：字符串下方弹出二元组（按规则着色）
    if (showTokenPopup) {
      const tokenLabel = this.formatTokenLabel(token);
      const accent = lz77TokenAccent(token);
      this.tokenTxt().text(tokenLabel);
      this.tokenTxt().fill(accent);
      this.tokenBox().stroke(accent);
      const tokenX = this.charX(this.cursor);
      this.tokenBox().x(tokenX);
      this.tokenTxt().x(tokenX);
      yield* all(
        this.tokenBox().opacity(1, 0.25, easeOutCubic),
        this.tokenTxt().opacity(1, 0.25, easeOutCubic),
      );
      yield* waitFor(holdToken);
      if (!keepTokenVisible) {
        yield* this.hideTokenPopup(0.2);
      }
    }

    // 5) 推进光标：引用前进 length，字面量前进 1
    const advance = token.kind === 'ref' ? token.length : 1;
    this.cursor = Math.min(this.chars.length, this.cursor + advance);
    yield* this.resetCharColors(0.25);

    if (!this.isDone()) {
      const nf = Math.max(0, this.cursor - this.windowSize);
      const nt = this.cursor;
      const nl = Math.min(
        this.chars.length,
        this.cursor + this.lookAheadSize,
      );
      yield* all(
        this.moveWindows(nf, nt, this.cursor, nl, 0.4),
        this.panToWindowSpan(nf, nt, this.cursor, nl, 0.4),
      );
    } else {
      yield* all(
        this.searchWin().opacity(0, 0.3),
        this.lookWin().opacity(0, 0.3),
        this.searchLabel().opacity(0, 0.3),
        this.lookLabel().opacity(0, 0.3),
      );
    }

    this.lastToken = token;
  }

  /** 连续执行多步（默认直到结束或 maxSteps） */
  public *runAll(options?: {
    maxSteps?: number;
    scanBeat?: number;
    holdMatch?: number;
    holdToken?: number;
    showTokenPopup?: boolean;
    keepTokenVisible?: boolean;
    gap?: number;
  }): ThreadGenerator {
    const maxSteps = options?.maxSteps ?? 999;
    const gap = options?.gap ?? 0.25;
    for (let i = 0; i < maxSteps && !this.isDone(); i++) {
      yield* this.step(options);
      if (!this.isDone()) yield* waitFor(gap);
    }
  }

  /**
   * 在 cursor 处编码一步 → 二元组：
   * - 匹配长度 ≥ MIN_MATCH_LENGTH(3)：引用 (length, offset)，光标前进 length
   * - 否则：字面量 char，光标前进 1
   * （最短可复用长度 3 为 DEFLATE / gzip 规定）
   */
  private encodeAt(cursor: number): Lz77Token {
    const searchFrom = Math.max(0, cursor - this.windowSize);
    let bestLen = 0;
    let bestOffset = 0;
    const maxLen = Math.min(this.lookAheadSize, this.chars.length - cursor);

    for (let i = searchFrom; i < cursor; i++) {
      const len = Math.min(this.matchLength(i, cursor), maxLen);
      if (
        len > bestLen ||
        (len === bestLen && len > 0 && i > cursor - bestOffset)
      ) {
        bestLen = len;
        bestOffset = cursor - i;
      }
    }

    if (bestLen >= MIN_MATCH_LENGTH) {
      const text = this.chars.slice(cursor, cursor + bestLen).join('');
      return {kind: 'ref', length: bestLen, offset: bestOffset, text};
    }
    return {kind: 'literal', char: this.chars[cursor]};
  }

  private matchLength(from: number, cursor: number): number {
    let len = 0;
    const limit = Math.min(
      this.lookAheadSize,
      this.chars.length - cursor,
      // 允许匹配延伸到 look-ahead 内（经典 LZ77 可自重叠）
      this.chars.length - from,
    );
    while (len < limit && this.chars[from + len] === this.chars[cursor + len]) {
      len++;
    }
    return len;
  }

  private layoutWindows(
    animate: boolean,
    searchFrom = Math.max(0, this.cursor - this.windowSize),
    searchTo = this.cursor,
    lookFrom = this.cursor,
    lookTo = Math.min(this.chars.length, this.cursor + this.lookAheadSize),
  ) {
    const geom = this.windowGeom(searchFrom, searchTo, lookFrom, lookTo);
    this.searchWin().x(geom.sx);
    this.searchWin().width(geom.sw);
    this.lookWin().x(geom.lx);
    this.lookWin().width(geom.lw);
    this.searchLabel().x(geom.sx);
    this.lookLabel().x(geom.lx);
    void animate;
  }

  private windowGeom(
    searchFrom: number,
    searchTo: number,
    lookFrom: number,
    lookTo: number,
  ) {
    const pad = this.charStep * 0.45;
    const box = (from: number, to: number) => {
      if (to <= from) {
        // 空窗：贴在边界上的窄框
        const x = this.charX(Math.max(0, from)) - pad * 0.2;
        return {x, w: Math.max(12, pad * 0.4)};
      }
      const left = this.charX(from) - pad;
      const right = this.charX(to - 1) + pad;
      return {x: (left + right) / 2, w: right - left};
    };
    const s = box(searchFrom, searchTo);
    const l = box(lookFrom, lookTo);
    return {sx: s.x, sw: s.w, lx: l.x, lw: l.w};
  }

  private *moveWindows(
    searchFrom: number,
    searchTo: number,
    lookFrom: number,
    lookTo: number,
    duration: number,
  ): ThreadGenerator {
    const geom = this.windowGeom(searchFrom, searchTo, lookFrom, lookTo);
    const emptySearch = searchTo <= searchFrom;
    yield* all(
      this.searchWin().x(geom.sx, duration, easeInOutCubic),
      this.searchWin().width(geom.sw, duration, easeInOutCubic),
      this.searchWin().opacity(emptySearch ? 0 : 1, duration * 0.5),
      this.lookWin().x(geom.lx, duration, easeInOutCubic),
      this.lookWin().width(geom.lw, duration, easeInOutCubic),
      this.searchLabel().x(geom.sx, duration, easeInOutCubic),
      this.searchLabel().opacity(emptySearch ? 0 : 1, duration * 0.5),
      this.lookLabel().x(geom.lx, duration, easeInOutCubic),
    );
  }

  /**
   * 将「搜索窗 + Look-ahead」整体中心平移到屏幕中央。
   * 世界坐标：board.x + content.x + localX ≈ 0
   */
  private *panToWindowSpan(
    searchFrom: number,
    searchTo: number,
    lookFrom: number,
    lookTo: number,
    duration: number,
  ): ThreadGenerator {
    const leftIdx =
      searchTo > searchFrom ? searchFrom : Math.max(0, lookFrom);
    const rightIdx =
      lookTo > lookFrom
        ? lookTo - 1
        : searchTo > searchFrom
          ? searchTo - 1
          : leftIdx;
    const focusLocalX = (this.charX(leftIdx) + this.charX(rightIdx)) / 2;
    yield* this.panToLocalX(focusLocalX, duration);
  }

  private *panToLocalX(
    focusLocalX: number,
    duration: number,
  ): ThreadGenerator {
    const targetContentX = -this.x() - focusLocalX;
    if (Math.abs(this.content().x() - targetContentX) < 2) return;
    yield* this.content().x(targetContentX, duration, easeInOutCubic);
  }

  private *tintRange(
    from: number,
    to: number,
    color: string,
    duration: number,
  ): ThreadGenerator {
    const anims = [];
    for (let i = from; i < to && i < this.charTxts.length; i++) {
      anims.push(this.charTxts[i].fill(color, duration, easeOutCubic));
    }
    if (anims.length > 0) yield* all(...anims);
  }

  private *resetCharColors(duration: number): ThreadGenerator {
    const anims = this.charTxts.map((t, i) =>
      t.fill(this.baseFills[i], duration, easeOutCubic),
    );
    if (anims.length > 0) yield* all(...anims);
  }
}
