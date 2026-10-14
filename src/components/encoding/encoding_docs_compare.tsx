import {Layout, Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {csvNumber, parseCsv} from '../../utils/parse_csv';

const CARD = '#0f141c';
const CARD_EDGE = '#243044';
const PAPER = '#f2f0ea';
const PAPER_RULE = '#d8d4cb';
const PAPER_TEXT = '#2a3140';
const MUTED = '#7a8a9c';
const LABEL = '#9aabbc';
const UTF8 = '#3dd6c6';
const UTF16 = '#7aa2ff';
const UTF32 = '#e8a067';
const BAR_TRACK = '#1a2230';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';
const SERIF = '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif';

/** 卡片类型强调色 */
const TYPE_ACCENTS = [UTF8, UTF16, UTF32] as const;

export interface EncodingDocItem {
  /** 顶部类型，如「英文」 */
  type: string;
  /** 文档正文预览（组件内截断并加省略号） */
  preview: string;
  utf8Bytes: number;
  utf16Bytes: number;
  utf32Bytes: number;
  /** 相对 UTF-8 的比值（UTF-8 = 1） */
  utf16OverUtf8: number;
  utf32OverUtf8: number;
}

export interface EncodingDocsCompareProps extends NodeProps {
  /** encoding_sizes.csv 原文 */
  csv: string;
  /**
   * 三段预览正文（与 CSV 行顺序对应）。
   * 未提供时用内置摘录。
   */
  previews?: [string, string, string];
  cardWidth?: number;
  cardGap?: number;
  /** 正文最多显示字符数（之后 …） */
  previewChars?: number;
  /** 柱状图最大高度（对应最大比值） */
  barMaxHeight?: number;
}

const DEFAULT_PREVIEWS: [string, string, string] = [
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading,',
  '却说那悟空把毫毛拔下一口，吹口仙气，叫声「变！」即变做三五十个小猴，一个个手执铁棒。Alice was beginning to get very tired of sitting by her sister on the bank,',
  '诗曰：混沌未分天地乱，茫茫渺渺无人见。自从盘古破鸿蒙，开辟从兹清浊辨。覆载群生仰至仁，发明万物皆成善。欲知造化会元功，须看《西游释厄传》。',
];

/** 从 CSV label 提炼短类型名 */
export function shortEncodingType(label: string): string {
  if (label.includes('中英')) return '中英混合';
  if (label.includes('偏中文') || label.includes('中文')) return '偏中文';
  if (label.includes('英文')) return '英文';
  return label.length > 10 ? label.slice(0, 10) + '…' : label;
}

export function parseEncodingSizeRows(
  csv: string,
  previews: [string, string, string] = DEFAULT_PREVIEWS,
): EncodingDocItem[] {
  const table = parseCsv(csv);
  return table.rows.slice(0, 3).map((row, i) => {
    const label = String(row.label ?? '');
    const utf8 = csvNumber(row, 'utf8_bytes') ?? 1;
    const utf16 = csvNumber(row, 'utf16_bytes') ?? utf8;
    const utf32 = csvNumber(row, 'utf32_bytes') ?? utf8;
    const r16 = csvNumber(row, 'utf16_over_utf8') ?? utf16 / utf8;
    const r32 = csvNumber(row, 'utf32_over_utf8') ?? utf32 / utf8;
    return {
      type: shortEncodingType(label),
      preview: previews[i] ?? '',
      utf8Bytes: utf8,
      utf16Bytes: utf16,
      utf32Bytes: utf32,
      utf16OverUtf8: r16,
      utf32OverUtf8: r32,
    };
  });
}

function clipPreview(text: string, maxChars: number): string {
  const chars = [...text];
  if (chars.length <= maxChars) return text;
  return chars.slice(0, maxChars).join('') + '…';
}

/**
 * 横向三份文档：顶部类型、正文摘要、下方 UTF-8 / UTF-16 / UTF-32 比值柱（UTF-8 = 1）。
 */
export class EncodingDocsCompare extends Node {
  private readonly row = createRef<Layout>();
  private readonly cards = createRefArray<Rect>();
  private readonly bars = createRefArray<Rect>();
  private readonly ratioLabels = createRefArray<Txt>();

  private readonly items: EncodingDocItem[];
  private readonly barMaxH: number;
  private readonly maxRatio: number;
  private cardIndex = 0;

  public constructor(props: EncodingDocsCompareProps) {
    const {
      csv,
      previews = DEFAULT_PREVIEWS,
      cardWidth = 400,
      cardGap = 32,
      previewChars = 68,
      barMaxHeight = 140,
      ...rest
    } = props;
    super({opacity: 0, ...rest});

    this.items = parseEncodingSizeRows(csv, previews);
    this.barMaxH = barMaxHeight;
    this.maxRatio = Math.max(
      1,
      ...this.items.flatMap(it => [1, it.utf16OverUtf8, it.utf32OverUtf8]),
    );

    this.add(
      <Layout
        ref={this.row}
        layout
        direction={'row'}
        gap={cardGap}
        alignItems={'start'}
        justifyContent={'center'}
      />,
    );

    for (const item of this.items) {
      this.row().add(this.makeCard(item, cardWidth, previewChars));
    }
  }

  public getItems(): EncodingDocItem[] {
    return this.items;
  }

  public *show(duration = 0.55, stagger = 0.12): ThreadGenerator {
    yield* this.opacity(1, duration * 0.35, easeOutCubic);
    const anims = this.cards.map((card, i) =>
      delay(
        i * stagger,
        all(
          card.opacity(1, 0.4, easeOutCubic),
          card.scale(1, 0.45, easeOutBack),
        ),
      ),
    );
    if (anims.length > 0) yield* all(...anims);

    const barAnims = this.bars.map((bar, i) => {
      const targetH = bar.height();
      bar.height(0);
      return delay(
        0.12 + i * 0.035,
        all(
          bar.height(targetH, 0.5, easeOutCubic),
          this.ratioLabels[i].opacity(1, 0.35, easeOutCubic),
        ),
      );
    });
    if (barAnims.length > 0) yield* all(...barAnims);
    yield* waitFor(0.1);
  }

  private barHeight(ratio: number): number {
    return Math.max(10, (ratio / this.maxRatio) * this.barMaxH);
  }

  private makeCard(
    item: EncodingDocItem,
    width: number,
    previewChars: number,
  ) {
    const accent = TYPE_ACCENTS[this.cardIndex % TYPE_ACCENTS.length];
    this.cardIndex++;
    const preview = clipPreview(item.preview, previewChars);
    const innerW = width - 40;
    const ratios: Array<{key: string; ratio: number; color: string}> = [
      {key: 'UTF-8', ratio: 1, color: UTF8},
      {key: 'UTF-16', ratio: item.utf16OverUtf8, color: UTF16},
      {key: 'UTF-32', ratio: item.utf32OverUtf8, color: UTF32},
    ];

    return (
      <Rect
        ref={this.cards}
        layout
        direction={'column'}
        width={width}
        gap={0}
        radius={16}
        fill={CARD}
        stroke={CARD_EDGE}
        lineWidth={1.5}
        opacity={0}
        scale={0.92}
        clip
      >
        {/* 顶栏：类型 */}
        <Layout
          layout
          direction={'row'}
          width={width}
          padding={[16, 20]}
          gap={12}
          alignItems={'center'}
        >
          <Rect width={4} height={22} radius={2} fill={accent} />
          <Txt
            text={item.type}
            fontFamily={MONO}
            fontSize={24}
            fontWeight={700}
            fill={accent}
          />
        </Layout>

        {/* 文档纸面 */}
        <Layout layout direction={'column'} padding={[0, 20, 4, 20]}>
          <Rect
            layout
            direction={'column'}
            width={innerW}
            height={178}
            radius={10}
            fill={PAPER}
            stroke={PAPER_RULE}
            lineWidth={1}
            padding={[18, 18]}
            gap={10}
            clip
          >
            {/* 仿纸张横线氛围：顶部分隔条 */}
            <Rect width={innerW - 36} height={2} radius={1} fill={PAPER_RULE} />
            <Txt
              text={preview}
              fontFamily={SERIF}
              fontSize={17}
              lineHeight={28}
              fill={PAPER_TEXT}
              width={innerW - 36}
              textWrap
            />
          </Rect>
        </Layout>

        {/* 图表区 */}
        <Layout
          layout
          direction={'column'}
          width={width}
          padding={[14, 20, 18, 20]}
          gap={10}
        >
          <Layout
            layout
            direction={'row'}
            width={innerW}
            alignItems={'center'}
            gap={10}
          >
            <Txt
              text={'相对体积'}
              fontFamily={MONO}
              fontSize={13}
              fill={MUTED}
            />
            <Line
              points={[
                [0, 0],
                [innerW - 100, 0],
              ]}
              stroke={CARD_EDGE}
              lineWidth={1}
              opacity={0.9}
            />
            <Txt
              text={'UTF-8=1'}
              fontFamily={MONO}
              fontSize={12}
              fill={LABEL}
            />
          </Layout>

          <Layout
            layout
            direction={'column'}
            width={innerW}
            gap={0}
            alignItems={'center'}
          >
            <Layout
              layout
              direction={'row'}
              width={innerW}
              height={this.barMaxH + 36}
              gap={14}
              alignItems={'end'}
              justifyContent={'space-evenly'}
            >
              {ratios.map(r => (
                <Layout
                  layout
                  direction={'column'}
                  gap={8}
                  alignItems={'center'}
                  justifyContent={'end'}
                  height={this.barMaxH + 32}
                >
                  <Txt
                    ref={this.ratioLabels}
                    text={formatRatio(r.ratio)}
                    fontFamily={MONO}
                    fontSize={15}
                    fontWeight={700}
                    fill={r.color}
                    opacity={0}
                  />
                  <Rect
                    width={40}
                    height={this.barMaxH}
                    radius={8}
                    fill={BAR_TRACK}
                    layout
                    alignItems={'end'}
                    justifyContent={'center'}
                    padding={3}
                  >
                    <Rect
                      ref={this.bars}
                      width={34}
                      height={this.barHeight(r.ratio)}
                      radius={[5, 5, 3, 3]}
                      fill={r.color}
                    />
                  </Rect>
                </Layout>
              ))}
            </Layout>
            <Layout
              layout
              direction={'row'}
              width={innerW}
              gap={14}
              justifyContent={'space-evenly'}
              paddingTop={8}
            >
              {ratios.map(r => (
                <Txt
                  text={r.key}
                  fontFamily={MONO}
                  fontSize={13}
                  fill={LABEL}
                  width={40}
                  textAlign={'center'}
                />
              ))}
            </Layout>
          </Layout>
        </Layout>
      </Rect>
    );
  }
}

function formatRatio(ratio: number): string {
  if (Math.abs(ratio - 1) < 1e-6) return '1×';
  return ratio.toFixed(2) + '×';
}
