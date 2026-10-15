import {Layout, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
import {AsciiCoordGrid} from '../components/ascii/ascii_coord_grid';
import {Terminal} from '../components/terminal/terminal';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
/** 一屏高度（与 project.meta 一致） */
const SCREEN_H = 1080;

const CARD = '#121820';
const LINE = '#2a3a4c';
const CHAR_COLOR = '#e8eef7';
const CHAR_DIM = '#5a6a7c';
const HIGHLIGHT = '#ffe08a';
const ASCII_COLOR = '#3dd6c6';
const ARROW_COLOR = '#5ec8ff';
const GAP_COLOR = '#6a7a8c';
const MUTED = '#6a7a8c';

/** 输入：仅英文（含标点） */
const INPUT_TEXT = 'Hello,World!';

const COL_W = 76;
const COL_GAP = 4;
const CELL_H = 52;
const TOP_SIZE = 40;
const TABLE_CHAR_SIZE = 28;
const TABLE_CODE_SIZE = 18;
const RESULT_SIZE = 22;
const FONT = 'JetBrains Mono, Consolas, monospace';

const TOP_Y = -300;
const TABLE_Y = -10;
const RESULT_Y = 290;

/** 坐标屏：输入串上方字号与间距 */
const COORD_TOP_SIZE = 36;
const COORD_TOP_Y = -420;
const COORD_TOP_STEP = 56;

type TableCol =
  | {kind: 'gap'}
  | {kind: 'char'; ch: string; code: number};

/** ASCII 码显示为十六进制，如 0x48 */
function toHex(code: number): string {
  return '0x' + code.toString(16).toUpperCase().padStart(2, '0');
}

/** 按 ASCII 排序的唯一字符，非相邻处插入 ...，两端也加 ... */
function buildTableColumns(text: string): TableCol[] {
  const unique = [...new Set([...text])].sort(
    (a, b) => a.charCodeAt(0) - b.charCodeAt(0),
  );
  const cols: TableCol[] = [{kind: 'gap'}];
  for (let i = 0; i < unique.length; i++) {
    if (i > 0) {
      const prev = unique[i - 1].charCodeAt(0);
      const cur = unique[i].charCodeAt(0);
      if (cur - prev > 1) cols.push({kind: 'gap'});
    }
    cols.push({
      kind: 'char',
      ch: unique[i],
      code: unique[i].charCodeAt(0),
    });
  }
  cols.push({kind: 'gap'});
  return cols;
}

/**
 * ASCII 编码演示（两屏）：
 * 0) ASCII 码平面：逐字行列交汇高亮
 * 1) 编码：字符串 → 唯一表 → hex 结果 → hexdump
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const text = INPUT_TEXT;
  const chars = [...text];
  const ascii = chars.map((_, i) => text.charCodeAt(i));
  const n = chars.length;

  const tableCols = buildTableColumns(text);
  const colCount = tableCols.length;
  const tableW = colCount * COL_W + (colCount - 1) * COL_GAP + 24;
  const colXs = tableCols.map(
    (_, i) =>
      -((colCount - 1) * (COL_W + COL_GAP)) / 2 + i * (COL_W + COL_GAP),
  );

  /** 字符 → 表列下标 */
  const charColIndex = new Map<string, number>();
  tableCols.forEach((c, i) => {
    if (c.kind === 'char') charColIndex.set(c.ch, i);
  });

  /** 上方按原文顺序排布的 x（加大间距） */
  const TOP_STEP = 72;
  const topXs = chars.map(
    (_, i) => -((n - 1) * TOP_STEP) / 2 + i * TOP_STEP,
  );
  const topColOf = chars.map(ch => charColIndex.get(ch)!);

  const titleCoord = createRef<SceneTitle>();
  const grid = createRef<AsciiCoordGrid>();
  const coordChars = createRefArray<Txt>();
  const title = createRef<SceneTitle>();
  const topChars = createRefArray<Txt>();
  const tableFrame = createRef<Rect>();
  const tableCharTxt = createRefArray<Txt>();
  const tableCodeTxt = createRefArray<Txt>();
  const topArrows = createRefArray<Line>();
  const resultArrows = createRefArray<Line>();
  const resultCodes = createRefArray<Txt>();
  const term = createRef<Terminal>();
  const pages = createRef<Node>();
  const screen0 = createRef<Node>();
  const screen1 = createRef<Node>();

  const coordTopXs = chars.map(
    (_, i) => -((n - 1) * COORD_TOP_STEP) / 2 + i * COORD_TOP_STEP,
  );

  // 两屏容器：码平面 → 编码；整体上移即「向下滚动」
  view.add(
    <Node ref={pages}>
      <Node ref={screen0} />
      <Node ref={screen1} y={SCREEN_H} />
    </Node>,
  );

  // ── 第 0 屏：ASCII 码平面 ──
  screen0().add(<SceneTitle ref={titleCoord} text={'ASCII 码平面'} />);
  for (let i = 0; i < n; i++) {
    const ch = chars[i];
    screen0().add(
      <Txt
        ref={coordChars}
        text={ch === ' ' ? '␣' : ch}
        fontSize={COORD_TOP_SIZE}
        fontFamily={FONT}
        fill={ch === ' ' ? MUTED : CHAR_COLOR}
        x={coordTopXs[i]}
        y={COORD_TOP_Y}
        opacity={0}
        scale={0.85}
      />,
    );
  }
  screen0().add(
    <AsciiCoordGrid
      ref={grid}
      cellSize={56}
      fontSize={24}
      tickFontSize={20}
      axisLabelSize={26}
      y={40}
    />,
  );

  // ── 第 1 屏：ASCII 编码（原内容） ──
  screen1().add(<SceneTitle ref={title} text={'ASCII 编码'} />);

  // ── 上：字符串保持原文顺序（等距横排） ──
  for (let i = 0; i < n; i++) {
    const ch = chars[i];
    screen1().add(
      <Txt
        ref={topChars}
        text={ch === ' ' ? '␣' : ch}
        fontSize={TOP_SIZE}
        fontFamily={FONT}
        fill={ch === ' ' ? MUTED : CHAR_COLOR}
        x={topXs[i]}
        y={TOP_Y}
        opacity={0}
        scale={0.85}
      />,
    );
  }

  // ── 中：唯一字符表 + 省略列 ──
  screen1().add(
    <Rect
      ref={tableFrame}
      layout
      direction={'column'}
      width={tableW}
      fill={CARD}
      stroke={LINE}
      lineWidth={2}
      radius={12}
      y={TABLE_Y}
      opacity={0}
      scale={0.96}
      clip
    >
      <Layout layout direction={'row'} gap={COL_GAP} padding={[8, 12]}>
        {tableCols.map(col => (
          <Layout
            layout
            width={COL_W}
            height={CELL_H}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              ref={tableCharTxt}
              text={
                col.kind === 'gap' ? '...' : col.ch === ' ' ? '␣' : col.ch
              }
              fontSize={TABLE_CHAR_SIZE}
              fontFamily={FONT}
              fill={col.kind === 'gap' ? GAP_COLOR : CHAR_COLOR}
              opacity={0}
            />
          </Layout>
        ))}
      </Layout>
      <Rect height={1} width={tableW} fill={LINE} />
      <Layout layout direction={'row'} gap={COL_GAP} padding={[8, 12]}>
        {tableCols.map(col => (
          <Layout
            layout
            width={COL_W}
            height={CELL_H}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              ref={tableCodeTxt}
              text={col.kind === 'gap' ? '...' : toHex(col.code)}
              fontSize={TABLE_CODE_SIZE}
              fontFamily={FONT}
              fill={col.kind === 'gap' ? GAP_COLOR : ASCII_COLOR}
              opacity={0}
            />
          </Layout>
        ))}
      </Layout>
    </Rect>,
  );

  // 上 → 中 箭头（原文顺序 → 对应唯一列，可斜向）
  const tableTopY = TABLE_Y - CELL_H - 14;
  for (let i = 0; i < n; i++) {
    screen1().add(
      <Line
        ref={topArrows}
        points={[
          [topXs[i], TOP_Y + 28],
          [colXs[topColOf[i]], tableTopY],
        ]}
        stroke={ARROW_COLOR}
        lineWidth={2}
        endArrow
        arrowSize={8}
        lineCap={'round'}
        end={0}
        opacity={0.85}
      />,
    );
  }

  // 下：完整编码（按字符串顺序）
  const resultXs = chars.map(
    (_, i) => -((n - 1) * (COL_W + COL_GAP)) / 2 + i * (COL_W + COL_GAP),
  );
  const tableBotY = TABLE_Y + CELL_H + 14;
  const resultTopY = RESULT_Y - 32;

  for (let i = 0; i < n; i++) {
    screen1().add(
      <Line
        ref={resultArrows}
        points={[
          [colXs[topColOf[i]], tableBotY],
          [resultXs[i], resultTopY],
        ]}
        stroke={ARROW_COLOR}
        lineWidth={2}
        endArrow
        arrowSize={8}
        lineCap={'round'}
        end={0}
        opacity={0.85}
      />,
    );
  }

  screen1().add(
    <Layout y={RESULT_Y} layout={false}>
      {ascii.map((code, i) => (
        <Txt
          ref={resultCodes}
          text={toHex(code)}
          fontSize={RESULT_SIZE}
          fontFamily={FONT}
          fill={ASCII_COLOR}
          x={resultXs[i]}
          opacity={0}
          scale={0.85}
        />
      ))}
    </Layout>,
  );

  // 终端：自底部打开到中央
  screen1().add(
    <Terminal
      ref={term}
      title={'bash — hexdump'}
      prompt={'$ '}
      width={1280}
      height={320}
      fontSize={24}
      typeSpeed={0.035}
      y={520}
      scale={0.55}
      opacity={0}
    />,
  );

  // ════════ 第 0 屏：码平面 + 快速行列交汇 ════════
  yield* titleCoord().show();
  yield* waitFor(0.12);
  yield* grid().show(0.5, 0.005);
  yield* waitFor(0.15);

  // 输入串出现在网格上方
  yield* all(
    ...coordChars.map((t, i) =>
      delay(
        i * 0.03,
        all(
          t.opacity(1, 0.22, easeOutCubic),
          t.scale(1, 0.26, easeOutBack),
        ),
      ),
    ),
  );
  yield* waitFor(0.12);
  yield* all(...coordChars.map(t => t.fill(CHAR_DIM, 0.18, easeOutCubic)));

  // 依次高亮：行亮 + 列亮 + 交汇更亮（整体偏快）
  for (let i = 0; i < n; i++) {
    const baseFill = chars[i] === ' ' ? MUTED : CHAR_COLOR;
    yield* all(
      coordChars[i].fill(HIGHLIGHT, 0.1, easeOutCubic),
      coordChars[i].scale(1.22, 0.12, easeOutBack),
      grid().highlightCross(ascii[i], 0.12),
    );
    yield* waitFor(0.06);
    yield* all(
      coordChars[i].fill(baseFill, 0.1, easeOutCubic),
      coordChars[i].scale(1, 0.1, easeOutCubic),
    );
  }
  yield* grid().clearCrossHighlight(0.15);
  yield* waitFor(0.25);

  // ════════ 滚入第 1 屏：原 ASCII 编码 ════════
  yield* pages().y(-SCREEN_H, 1.0, easeInOutCubic);
  yield* waitFor(0.15);
  yield* title().show();
  yield* waitFor(0.2);

  // 1) 上方字符串全部出现（随后逐个高亮）
  yield* all(
    ...topChars.map((t, i) =>
      delay(
        i * 0.04,
        all(
          t.opacity(1, 0.28, easeOutCubic),
          t.scale(1, 0.32, easeOutBack),
        ),
      ),
    ),
  );
  yield* waitFor(0.25);

  // 2) 中间表入场
  yield* all(
    tableFrame().opacity(1, 0.4, easeOutCubic),
    tableFrame().scale(1, 0.45, easeOutCubic),
  );
  yield* waitFor(0.1);
  yield* all(
    ...tableCharTxt.map((t, i) =>
      delay(i * 0.03, t.opacity(1, 0.22, easeOutCubic)),
    ),
  );
  yield* waitFor(0.1);
  yield* all(
    ...tableCodeTxt.map((t, i) =>
      delay(i * 0.03, t.opacity(1, 0.22, easeOutCubic)),
    ),
  );
  yield* waitFor(0.35);

  // 其余字符先压暗，便于逐个高亮
  yield* all(...topChars.map(t => t.fill(CHAR_DIM, 0.25, easeOutCubic)));

  // 3) 逐个高亮：字符→表→结果，完成后藏箭头再下一个
  for (let i = 0; i < n; i++) {
    const col = topColOf[i];
    const baseFill = chars[i] === ' ' ? MUTED : CHAR_COLOR;

    // 高亮当前字符
    yield* all(
      topChars[i].fill(HIGHLIGHT, 0.2, easeOutCubic),
      topChars[i].scale(1.2, 0.25, easeOutBack),
    );

    // 箭头：字符 → 表
    yield* all(
      topArrows[i].end(1, 0.35, easeInOutCubic),
      tableCharTxt[col].scale(1.18, 0.18, easeOutCubic),
      tableCodeTxt[col].scale(1.18, 0.18, easeOutCubic),
      tableCodeTxt[col].fill('#7dffef', 0.2, easeOutCubic),
    );
    yield* waitFor(0.08);

    // 箭头：表 → 编码结果
    yield* all(
      resultArrows[i].end(1, 0.38, easeInOutCubic),
      delay(
        0.15,
        all(
          resultCodes[i].opacity(1, 0.28, easeOutCubic),
          resultCodes[i].scale(1, 0.32, easeOutBack),
        ),
      ),
    );
    yield* waitFor(0.28);

    // 隐藏箭头，取消高亮，准备下一个
    yield* all(
      topArrows[i].opacity(0, 0.22, easeOutCubic),
      resultArrows[i].opacity(0, 0.22, easeOutCubic),
      topChars[i].fill(baseFill, 0.22, easeOutCubic),
      topChars[i].scale(1, 0.22, easeOutCubic),
      tableCharTxt[col].scale(1, 0.22, easeOutCubic),
      tableCodeTxt[col].scale(1, 0.22, easeOutCubic),
      tableCodeTxt[col].fill(
        tableCols[col].kind === 'gap' ? GAP_COLOR : ASCII_COLOR,
        0.22,
        easeOutCubic,
      ),
    );
    // 重置箭头，避免残留
    topArrows[i].end(0);
    resultArrows[i].end(0);
    topArrows[i].opacity(0.85);
    resultArrows[i].opacity(0.85);

    yield* waitFor(0.1);
  }

  // 全部恢复正常亮度
  yield* all(
    ...topChars.map((t, i) =>
      t.fill(chars[i] === ' ' ? MUTED : CHAR_COLOR, 0.35, easeOutCubic),
    ),
  );
  yield* waitFor(0.5);

  // 4) 终端自底部缩放到中央（打开窗口），执行 hexdump
  yield* all(
    term().opacity(1, 0.35, easeOutCubic),
    term().y(40, 0.7, easeOutCubic),
    term().scale(1, 0.7, easeOutBack),
  );
  yield* waitFor(0.2);
  yield* term().run({
    command: 'echo -n "Hello,World!" | hexdump -C',
    output:
      '00000000  48 65 6c 6c 6f 2c 57 6f  72 6c 64 21              |Hello,World!|\n' +
      '0000000c',
  });
  yield* waitFor(1.0);
});
