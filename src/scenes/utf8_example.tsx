import {Layout, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {Question} from '../components/question/question';
import {DataTable} from '../components/table/data_table';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
/** 一屏高度（与 project.meta 一致） */
const SCREEN_H = 1080;

const CARD = '#121820';
const LINE = '#2a3a4c';
const CHAR_COLOR = '#e8eef7';
const MUTED = '#6a7a8c';
/** UTF-8 固定前缀位（0 / 110 / 1110 / 11110 / 10） */
const FIXED_BIT = '#7aa2ff';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

const RULE_HEADERS = [
  '字符范围（Unicode）',
  '字节数',
  '首字节格式',
  '续字节格式',
];

const RULE_COL_WIDTHS = [360, 140, 300, 300];

const RULE_ROWS = [
  ['U+0000 – U+007F', '1', '0xxxxxxx', '—'],
  ['U+0080 – U+07FF', '2', '110xxxxx', '10xxxxxx'],
  ['U+0800 – U+FFFF', '3', '1110xxxx', '10xxxxxx'],
  ['U+10000 – U+10FFFF', '4', '11110xxx', '10xxxxxx'],
];

type ExampleRow = {
  char: string;
  /** 左侧小标签，如「英文」 */
  kind: string;
  accent: string;
};

const ROWS: ExampleRow[] = [
  {char: 'A', kind: '英文', accent: '#3dd6c6'},
  {char: '你', kind: '汉字', accent: '#ffb454'},
  {char: '😀', kind: '表情', accent: '#f472b6'},
];

function codePointLabel(ch: string): string {
  const cp = ch.codePointAt(0)!;
  const width = cp > 0xffff ? 5 : 4;
  return 'U+' + cp.toString(16).toUpperCase().padStart(width, '0');
}

function toUtf8Bytes(ch: string): number[] {
  return [...new TextEncoder().encode(ch)];
}

function toBinByte(b: number): string {
  return b.toString(2).padStart(8, '0');
}

/** 首字节中固定前缀所占 bit 数 */
function leadPrefixBitCount(byteLen: number): number {
  if (byteLen <= 1) return 1;
  if (byteLen === 2) return 3;
  if (byteLen === 3) return 4;
  return 5;
}

/** 按字节拆出固定前缀与载荷位 */
function splitUtf8Bits(
  bits: string,
  byteIndex: number,
  byteLen: number,
): {prefix: string; data: string} {
  const n =
    byteIndex === 0 ? leadPrefixBitCount(byteLen) : 2; // 续字节固定 10
  return {prefix: bits.slice(0, n), data: bits.slice(n)};
}

/**
 * UTF-8 示例（两屏）：
 * 0) UTF-8 字节数规则表
 * 1) 英文 / 汉字 / 表情 码点 + UTF-8 二进制
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const pages = createRef<Node>();
  const screen0 = createRef<Node>();
  const screen1 = createRef<Node>();
  const titleRules = createRef<SceneTitle>();
  const titleExamples = createRef<SceneTitle>();
  const table = createRef<DataTable>();
  const grid = createRef<Layout>();
  const rowCards = createRefArray<Rect>();
  const charTxts = createRefArray<Txt>();
  const codeTxts = createRefArray<Txt>();

  const rowBytes = ROWS.map(r => toUtf8Bytes(r.char));
  const tableW = RULE_COL_WIDTHS.reduce((a, b) => a + b, 0);

  view.add(
    <Node ref={pages}>
      <Node ref={screen0} />
      <Node ref={screen1} y={SCREEN_H} />
    </Node>,
  );

  // ── 第 0 屏：UTF-8 编码规则表 ──
  screen0().add(<SceneTitle ref={titleRules} text={'UTF-8 编码规则'} />);
  screen0().add(
    <DataTable
      ref={table}
      headers={RULE_HEADERS}
      rows={RULE_ROWS}
      columnWidths={RULE_COL_WIDTHS}
      totalWidth={tableW}
      rowHeight={72}
      headerSize={26}
      cellSize={24}
      rowBeat={0.28}
      y={36}
    />,
  );

  // ── 第 1 屏：码点示例（三行三列） ──
  screen1().add(<SceneTitle ref={titleExamples} text={'Unicode 码点示例'} />);
  screen1().add(
    <Layout
      ref={grid}
      layout
      direction={'column'}
      gap={36}
      y={40}
      alignItems={'center'}
    >
      {ROWS.map((row, ri) => (
        <Rect
          ref={rowCards}
          layout
          direction={'row'}
          gap={40}
          padding={[28, 40]}
          radius={16}
          fill={CARD}
          stroke={LINE}
          lineWidth={2}
          alignItems={'center'}
          justifyContent={'center'}
          opacity={0}
          scale={0.92}
        >
          {/* 第 1 列：种类 + 字符 */}
          <Layout
            layout
            direction={'column'}
            gap={10}
            width={160}
            alignItems={'center'}
          >
            <Txt
              text={row.kind}
              fontFamily={MONO}
              fontSize={20}
              fill={MUTED}
            />
            <Txt
              ref={charTxts}
              text={row.char}
              fontFamily={MONO}
              fontSize={64}
              fontWeight={700}
              fill={CHAR_COLOR}
            />
          </Layout>

          {/* 第 2 列：Unicode 码点 */}
          <Layout
            layout
            direction={'column'}
            gap={10}
            width={200}
            alignItems={'center'}
          >
            <Txt
              text={'Unicode'}
              fontFamily={MONO}
              fontSize={20}
              fill={MUTED}
            />
            <Txt
              ref={codeTxts}
              text={codePointLabel(row.char)}
              fontFamily={MONO}
              fontSize={34}
              fontWeight={700}
              fill={row.accent}
            />
          </Layout>

          {/* 第 3 列：UTF-8 二进制，按字节分开展示 */}
          <Layout
            layout
            direction={'column'}
            gap={12}
            width={560}
            alignItems={'center'}
          >
            <Txt
              text={'UTF-8 二进制'}
              fontFamily={MONO}
              fontSize={20}
              fill={MUTED}
            />
            <Layout layout direction={'row'} gap={14} alignItems={'center'}>
              {rowBytes[ri].map((b, bi) => {
                const {prefix, data} = splitUtf8Bits(
                  toBinByte(b),
                  bi,
                  rowBytes[ri].length,
                );
                return (
                  <Rect
                    layout
                    padding={[8, 12]}
                    radius={8}
                    fill={'#0a0e14'}
                    stroke={row.accent}
                    lineWidth={1.5}
                    alignItems={'center'}
                    justifyContent={'center'}
                  >
                    <Layout layout direction={'row'} alignItems={'center'}>
                      <Txt
                        text={prefix}
                        fontFamily={MONO}
                        fontSize={22}
                        fontWeight={700}
                        fill={FIXED_BIT}
                      />
                      <Txt
                        text={data}
                        fontFamily={MONO}
                        fontSize={22}
                        fontWeight={600}
                        fill={row.accent}
                      />
                    </Layout>
                  </Rect>
                );
              })}
            </Layout>
          </Layout>
        </Rect>
      ))}
    </Layout>,
  );

  // ════════ 第 0 屏：规则表 ════════
  yield* titleRules().show();
  yield* waitFor(0.15);
  yield* table().run();
  yield* waitFor(0.8);

  // ════════ 滚入第 1 屏：码点示例 ════════
  yield* pages().y(-SCREEN_H, 1.0, easeInOutCubic);
  yield* waitFor(0.15);
  yield* titleExamples().show();
  yield* waitFor(0.2);

  for (let i = 0; i < ROWS.length; i++) {
    yield* all(
      rowCards[i].opacity(1, 0.4, easeOutCubic),
      rowCards[i].scale(1, 0.45, easeOutBack),
      delay(0.1, charTxts[i].scale(1.1, 0.22, easeOutBack).to(1, 0.18)),
    );
    yield* waitFor(0.3);
  }

  yield* waitFor(0.6);

  // 收尾提问：引出字节序
  const question = createRef<Question>();
  view.add(
    <Question
      ref={question}
      text={'什么是**字节序**呢？'}
      top={-440}
      zIndex={100}
    />,
  );
  yield* question().ask();
  yield* waitFor(1.2);
});
