import {Node, Rect, Txt, View2D, makeScene2D} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {Brace} from '../components/brace/brace';
import {FloatSample, ieeeSignBit} from '../components/float/float_sample';
import {SceneTitle} from '../components/title/scene_title';
import {FONT} from '../theme/fonts';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const DEEP = '#121820';
const LINE = '#2a3a4c';
const MUTED = '#8a9bb0';

/** 本次演示用浮点数（改这里即可切换样例） */
const DEMO_FLOAT = -9.32;
/** 小数部分转二进制时保留的位数 */
const FRAC_BIN_BITS = 10;

/** IEEE 754 单精度三段着色 */
const COLOR_S = '#ff6b8a';
const COLOR_E = '#7aa2ff';
const COLOR_M = '#3dd6c6';

const BITS = 32;
const S_LEN = 1;
const E_LEN = 8;
const M_LEN = 23;

const BIT_SIZE = 36;
const BIT_GAP = 4;
const BYTE_GAP = 18;

const partOf = (i: number): 'S' | 'E' | 'M' => {
  if (i < S_LEN) return 'S';
  if (i < S_LEN + E_LEN) return 'E';
  return 'M';
};

const colorOf = (p: 'S' | 'E' | 'M') =>
  p === 'S' ? COLOR_S : p === 'E' ? COLOR_E : COLOR_M;

/**
 * IEEE 754 单精度示意：
 * 1) 横向 4 字节（32 bit）
 * 2) 花括号标注 S / E / M 并着色
 * 3) 隐藏标注后改为纵向三行，左侧 Label
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const sample = createRef<FloatSample>();
  const bitBoxes = createRefArray<Rect>();
  const bitTxts = createRefArray<Txt>();
  const byteTags = createRefArray<Txt>();
  const braceS = createRef<Brace>();
  const braceE = createRef<Brace>();
  const braceM = createRef<Brace>();
  const rowLabels = createRefArray<Txt>();

  view.add(<SceneTitle ref={title} text={'IEEE 754'} />);

  // 上方：带边框的演示浮点数（符号 / 整数 / 小数可分别高亮）
  view.add(
    <FloatSample
      ref={sample}
      value={DEMO_FLOAT}
      y={-280}
      scale={0.92}
      fontSize={64}
      fill={PAPER}
      stroke={LINE}
      background={DEEP}
    />,
  );

  // —— 横向 4 字节布局 ——
  const byteW = 8 * BIT_SIZE + 7 * BIT_GAP;
  const totalW = 4 * byteW + 3 * BYTE_GAP;
  const originX = -totalW / 2;
  const rowY = -20;

  const bitPosH = (i: number) => {
    const byteIndex = Math.floor(i / 8);
    const bitInByte = i % 8;
    const x =
      originX +
      byteIndex * (byteW + BYTE_GAP) +
      bitInByte * (BIT_SIZE + BIT_GAP) +
      BIT_SIZE / 2;
    return new Vector2(x, rowY);
  };

  // 示例比特串（仅作视觉示意，可改）
  const bits =
    '0' + // S
    '10000001' + // E
    '10100000000000000000000'; // M (23)

  for (let i = 0; i < BITS; i++) {
    const pos = bitPosH(i);
    view.add(
      <Rect
        ref={bitBoxes}
        width={BIT_SIZE}
        height={BIT_SIZE}
        x={pos.x}
        y={pos.y}
        fill={DEEP}
        stroke={LINE}
        lineWidth={2}
        radius={6}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={bitTxts}
          text={bits[i] ?? '0'}
          fontFamily={FONT}
          fontSize={20}
          fontWeight={700}
          fill={PAPER}
        />
      </Rect>,
    );
  }

  // 字节序号（横向阶段）
  for (let b = 0; b < 4; b++) {
    const cx = originX + b * (byteW + BYTE_GAP) + byteW / 2;
    view.add(
      <Txt
        ref={byteTags}
        text={`Byte ${b}`}
        fontFamily={FONT}
        fontSize={18}
        fill={MUTED}
        x={cx}
        y={rowY - 42}
        opacity={0}
      />,
    );
  }

  // 三段跨度（中心与宽度）
  const span = (from: number, len: number) => {
    const left = bitPosH(from).x - BIT_SIZE / 2;
    const right = bitPosH(from + len - 1).x + BIT_SIZE / 2;
    return {x: (left + right) / 2, w: right - left};
  };
  const sSpan = span(0, S_LEN);
  const eSpan = span(S_LEN, E_LEN);
  const mSpan = span(S_LEN + E_LEN, M_LEN);
  const braceY = rowY + BIT_SIZE / 2 + 14;

  view.add(
    <Brace
      ref={braceS}
      x={sSpan.x}
      y={braceY}
      length={sSpan.w}
      depth={24}
      stroke={COLOR_S}
      label={'S'}
      labelSize={26}
      labelGap={10}
    />,
  );
  view.add(
    <Brace
      ref={braceE}
      x={eSpan.x}
      y={braceY}
      length={eSpan.w}
      depth={24}
      stroke={COLOR_E}
      label={'E'}
      labelSize={26}
      labelGap={10}
    />,
  );
  view.add(
    <Brace
      ref={braceM}
      x={mSpan.x}
      y={braceY}
      length={mSpan.w}
      depth={24}
      stroke={COLOR_M}
      label={'M'}
      labelSize={26}
      labelGap={10}
    />,
  );

  // 纵向阶段的左侧 Label（先隐藏）
  const vRows: {key: 'S' | 'E' | 'M'; y: number; start: number; len: number}[] = [
    {key: 'S', y: -160, start: 0, len: S_LEN},
    {key: 'E', y: 0, start: S_LEN, len: E_LEN},
    {key: 'M', y: 160, start: S_LEN + E_LEN, len: M_LEN},
  ];
  const bitsStartX = -280;
  const labelX = -480;

  for (const row of vRows) {
    view.add(
      <Txt
        ref={rowLabels}
        text={`${row.key} (${row.len})`}
        fontFamily={FONT}
        fontSize={32}
        fontWeight={700}
        fill={colorOf(row.key)}
        x={labelX}
        y={row.y}
        opacity={0}
        offset={[-1, 0]}
      />,
    );
  }

  const bitPosV = (i: number) => {
    const row = vRows.find(r => i >= r.start && i < r.start + r.len)!;
    const idx = i - row.start;
    const x = bitsStartX + idx * (BIT_SIZE + BIT_GAP) + BIT_SIZE / 2;
    return new Vector2(x, row.y);
  };

  // —— 动画 ——
  yield* title().show();

  // 1) 横向四字节入场
  yield* all(
    ...byteTags.map((t, i) => delay(i * 0.06, t.opacity(0.9, 0.3, easeOutCubic))),
    ...bitBoxes.map((box, i) =>
      delay(
        0.05 + i * 0.02,
        all(
          box.opacity(1, 0.28, easeOutCubic),
          box.scale(1, 0.32, easeOutCubic),
        ),
      ),
    ),
  );
  yield* waitFor(0.35);

  // 2) 着色 + 花括号标注
  yield* all(
    ...bitBoxes.map((box, i) => {
      const c = colorOf(partOf(i));
      return all(box.stroke(c, 0.4, easeOutCubic), bitTxts[i].fill(c, 0.4));
    }),
  );
  yield* waitFor(0.15);
  yield* all(braceS().show(0.4), delay(0.12, braceE().show(0.45)), delay(0.24, braceM().show(0.5)));
  yield* waitFor(1.1);

  // 3) 隐藏标注与字节标签
  yield* all(
    braceS().hide(0.3),
    braceE().hide(0.3),
    braceM().hide(0.3),
    ...byteTags.map(t => t.opacity(0, 0.25, easeOutCubic)),
  );
  yield* waitFor(0.2);

  // 4) 改为纵向三行，左侧 Label
  yield* all(
    ...bitBoxes.map((box, i) => {
      const p = bitPosV(i);
      return all(
        box.position(p, 0.75, easeInOutCubic),
      );
    }),
    delay(
      0.35,
      all(...rowLabels.map(l => l.opacity(1, 0.4, easeOutCubic))),
    ),
  );

  // 5) 纵向排布完成后再显示顶部演示数字
  yield* waitFor(0.2);
  yield* sample().show(0.45);
  yield* waitFor(0.35);

  // 6) 用 S 色同时高亮符号 与 S 段比特 → 符号飞入比特位淡出 → 写入符号位
  const sBitIndices = Array.from({length: S_LEN}, (_, i) => i);
  const COLOR_S_FILL = '#5a1a28';
  yield* all(
    sample().highlight('sign', COLOR_S, 0.4),
    ...sBitIndices.map(i =>
      all(
        bitBoxes[i].fill(COLOR_S_FILL, 0.4, easeOutCubic),
        bitBoxes[i].lineWidth(3.5, 0.4, easeOutCubic),
        bitBoxes[i].stroke(COLOR_S, 0.4, easeOutCubic),
        bitTxts[i].fill(PAPER, 0.4, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(0.2);

  // 符号副本飞入 S 位中心并淡出（原数字保留）
  yield* flyPartToBit(
    view,
    sample().part('sign'),
    bitBoxes[0],
    sample().parts.sign,
    COLOR_S,
  );

  const signBit = ieeeSignBit(DEMO_FLOAT);
  yield* bitTxts[0].text(signBit, 0.3, easeOutCubic);
  yield* waitFor(1);

  // 7) 整数 / 小数转为二进制显示
  yield* sample().toBinary(0.55, FRAC_BIN_BITS);
  yield* waitFor(1);

  // 8) 规格化：原式左移 → 箭头 → 右侧结果 → 淡出并居中
  yield* sample().normalize('#ffb454');
  yield* waitFor(0.8);
});

/**
 * 将案例数字某一部分的视觉副本，从源节点飞入目标比特格中心并淡出。
 */
function* flyPartToBit(
  view: View2D,
  from: Node,
  toBox: Rect,
  text: string,
  color: string,
  duration = 0.55,
): ThreadGenerator {
  const flyer = createRef<Txt>();
  const start = from.absolutePosition();
  const end = toBox.absolutePosition();

  view.add(
    <Txt
      ref={flyer}
      text={text}
      fontFamily={FONT}
      fontSize={56}
      fontWeight={700}
      fill={color}
      opacity={1}
      scale={1}
      zIndex={100}
    />,
  );
  flyer().absolutePosition(start);

  yield* all(
    flyer().absolutePosition(end, duration, easeInOutCubic),
    flyer().scale(0.45, duration, easeInOutCubic),
    delay(duration * 0.55, flyer().opacity(0, duration * 0.4, easeOutCubic)),
  );

  flyer().remove();
}
