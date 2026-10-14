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
  formatDisplayChar,
  formatTokenLabel,
  lz77TokenAccent,
  type Lz77Token,
} from './lz77_token_style';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const HEADER_BG = '#1a2430';
const LINE = '#2a3a4c';
const ROW_ALT = '#0e141c';
const MUTED = '#8a9bb0';
const FLY_BG = '#121820';

/** # | 类型 | 值1(字面量或长度) | 值2(— 或偏移) */
const ROW_LABELS = ['#', '类型', '长度/字', '偏移'] as const;
const MONO = '"Cascadia Mono", "Consolas", monospace';
const ROW_COUNT = ROW_LABELS.length;

export interface Lz77TokenTableProps extends NodeProps {
  labelWidth?: number;
  colWidth?: number;
  rowHeight?: number;
}

/**
 * LZ77 二元组记录表（横向扩展）：
 * 每列一个 token —— 字面量，或 (长度, 偏移)。
 */
export class Lz77TokenTable extends Node {
  private readonly frame = createRef<Rect>();
  private readonly accent = createRef<Rect>();
  private readonly colsRoot = createRef<Layout>();
  private readonly tokenCols = createRefArray<Rect>();

  private readonly labelWidth: number;
  private readonly colWidth: number;
  private readonly rowHeight: number;
  private colCount = 0;

  public constructor(props: Lz77TokenTableProps = {}) {
    const {
      labelWidth = 120,
      colWidth = 110,
      rowHeight = 42,
      ...rest
    } = props;
    super({...rest});

    this.labelWidth = labelWidth;
    this.colWidth = colWidth;
    this.rowHeight = rowHeight;

    this.add(
      <Rect
        ref={this.frame}
        layout
        direction={'column'}
        radius={12}
        stroke={LINE}
        lineWidth={2}
        fill={DEEP}
        opacity={0}
        scale={0.96}
      >
        <Rect
          ref={this.accent}
          width={labelWidth}
          height={4}
          fill={ACCENT}
          opacity={0}
        />
        <Layout layout direction={'row'}>
          <Layout layout direction={'column'} width={labelWidth}>
            {ROW_LABELS.map((label, r) => (
              <Rect
                layout
                width={labelWidth}
                height={rowHeight}
                fill={r === 0 ? HEADER_BG : r % 2 === 0 ? DEEP : ROW_ALT}
                stroke={LINE}
                lineWidth={1}
                alignItems={'center'}
                justifyContent={'center'}
              >
                <Txt
                  text={label}
                  fontFamily={FONT}
                  fontSize={20}
                  fontWeight={700}
                  fill={r === 0 ? PAPER : MUTED}
                />
              </Rect>
            ))}
          </Layout>
          <Layout ref={this.colsRoot} layout direction={'row'} />
        </Layout>
      </Rect>,
    );
  }

  public *show(duration = 0.5): ThreadGenerator {
    this.accent().width(this.labelWidth);
    yield* all(
      this.frame().opacity(1, duration * 0.7, easeOutCubic),
      this.frame().scale(1, duration, easeOutCubic),
      this.accent().opacity(1, duration, easeOutCubic),
    );
  }

  public *appendToken(token: Lz77Token, duration = 0.4): ThreadGenerator {
    this.addTokenColumn(token);
    yield* this.revealLastColumn(duration);
  }

  public *appendTokenFrom(
    token: Lz77Token,
    fromAbsolute: Vector2,
    duration = 0.55,
  ): ThreadGenerator {
    this.addTokenColumn(token);
    yield;
    const col = this.tokenCols[this.tokenCols.length - 1];
    const end = col.absolutePosition();
    const accent = lz77TokenAccent(token);

    const flyer = createRef<Rect>();
    const flyerTxt = createRef<Txt>();
    this.view().add(
      <Rect
        ref={flyer}
        width={280}
        height={52}
        radius={8}
        fill={FLY_BG}
        stroke={accent}
        lineWidth={2}
        zIndex={100}
        opacity={1}
      >
        <Txt
          ref={flyerTxt}
          text={formatTokenLabel(token)}
          fontFamily={MONO}
          fontSize={28}
          fill={accent}
        />
      </Rect>,
    );
    flyer().absolutePosition(fromAbsolute);

    const accentW = this.labelWidth + this.colCount * this.colWidth;
    yield* all(
      flyer().absolutePosition(end, duration, easeInOutCubic),
      flyer().scale(0.72, duration, easeInOutCubic),
      flyer().width(this.colWidth + 8, duration, easeInOutCubic),
      flyer().height(this.rowHeight * ROW_COUNT, duration, easeInOutCubic),
      this.accent().width(accentW, duration, easeInOutCubic),
    );

    yield* all(
      flyer().opacity(0, 0.18, easeOutCubic),
      this.revealLastColumn(0.35),
    );
    flyer().remove();
    yield* waitFor(0.04);
  }

  private addTokenColumn(token: Lz77Token) {
    this.colCount += 1;
    const idx = this.colCount;
    const accent = lz77TokenAccent(token);
    const values =
      token.kind === 'literal'
        ? [
            `${idx}`,
            '字面量',
            `'${formatDisplayChar(token.char)}'`,
            '—',
          ]
        : [
            `${idx}`,
            '引用',
            `${token.length}`,
            `${token.offset}`,
          ];

    this.colsRoot().add(
      <Rect
        ref={this.tokenCols}
        layout
        direction={'column'}
        width={this.colWidth}
        opacity={0}
        scale={0.92}
      >
        {values.map((text, r) => (
          <Rect
            layout
            width={this.colWidth}
            height={this.rowHeight}
            fill={r === 0 ? HEADER_BG : r % 2 === 0 ? DEEP : ROW_ALT}
            stroke={accent}
            lineWidth={1.5}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              text={text}
              fontFamily={r <= 1 ? FONT : MONO}
              fontSize={r === 0 ? 22 : 22}
              fontWeight={r <= 1 ? 700 : 400}
              fill={accent}
            />
          </Rect>
        ))}
      </Rect>,
    );
  }

  private *revealLastColumn(duration: number): ThreadGenerator {
    const col = this.tokenCols[this.tokenCols.length - 1];
    const accentW = this.labelWidth + this.colCount * this.colWidth;
    yield* all(
      col.opacity(1, duration * 0.75, easeOutCubic),
      col.scale(1, duration, easeOutCubic),
      this.accent().width(accentW, duration, easeOutCubic),
    );
  }

  public *highlightColumn(index: number, duration = 0.3): ThreadGenerator {
    const anims = [];
    for (let i = 0; i < this.tokenCols.length; i++) {
      const col = this.tokenCols[i];
      if (i === index) {
        anims.push(
          col.opacity(1, duration, easeOutCubic),
          col.scale(1.08, duration, easeOutCubic),
        );
      } else {
        anims.push(
          col.opacity(0.35, duration, easeOutCubic),
          col.scale(1, duration, easeOutCubic),
        );
      }
    }
    if (anims.length > 0) yield* all(...anims);
  }

  public *clearHighlight(duration = 0.25): ThreadGenerator {
    const anims = this.tokenCols.map(col =>
      all(
        col.opacity(1, duration, easeOutCubic),
        col.scale(1, duration, easeOutCubic),
      ),
    );
    if (anims.length > 0) yield* all(...anims);
  }

  public get columnCount(): number {
    return this.colCount;
  }
}
