import {Latex, Node, Rect, Txt, View2D, makeScene2D} from '@motion-canvas/2d';
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
const DEMO_FLOAT = 0.2345;
/** 小数部分转二进制时保留的位数（单精度尾数 23） */
const FRAC_BIN_BITS = 23;
/** 单精度指数偏置 */
const EXP_BIAS = 127;

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
 * 4) 写入 S/E/M 后回到横向，并恢复花括号
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
  const expCalc = createRef<Rect>();
  const expLineE = createRef<Latex>();
  const expLineBias = createRef<Latex>();
  const expLineSum = createRef<Latex>();
  const expLineBin = createRef<Latex>();

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

  // S / E / M 初始全 0，后续由动画写入真实比特
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
          text={'0'}
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

  // 指数偏置计算卡片（S 右侧 / E 行旁，先隐藏；数值在 normalize 后填入）
  view.add(
    <Rect
      ref={expCalc}
      layout
      direction={'column'}
      alignItems={'start'}
      gap={10}
      padding={[22, 28]}
      fill={DEEP}
      stroke={COLOR_E}
      lineWidth={2}
      radius={12}
      x={420}
      y={-80}
      opacity={0}
      scale={0.94}
    >
      <Txt
        text={'指数偏置'}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={26}
        fontWeight={700}
        fill={COLOR_E}
      />
      <Latex ref={expLineE} tex={['e=\\,?']} fill={PAPER} fontSize={28} />
      <Latex
        ref={expLineBias}
        tex={[`\\mathrm{bias}=${EXP_BIAS}`]}
        fill={MUTED}
        fontSize={26}
      />
      <Latex
        ref={expLineSum}
        tex={['E=e+\\mathrm{bias}=\\,?']}
        fill={PAPER}
        fontSize={28}
      />
      <Latex
        ref={expLineBin}
        tex={['']}
        fill={COLOR_E}
        fontSize={28}
      />
    </Rect>,
  );

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

  // 6) 整数部分直接换成二进制
  yield* sample().highlight('integer', COLOR_M, 0.35);
  yield* sample().toIntegerBinary(0.45);
  yield* waitFor(0.35);

  // 7) 小数部分直接换成 23 位二进制
  yield* sample().highlight('frac', COLOR_M, 0.35);
  yield* sample().toFracBinary(0.55, FRAC_BIN_BITS);
  yield* waitFor(0.45);

  // 8) 规格化：原值上移淡出，新值从下方上移淡入（含 ×2^e 高亮）
  yield* sample().normalize('#ffb454');
  yield* waitFor(2.35);

  // 9) 归一化完成后：符号飞入 S 位
  const sBitIndices = Array.from({length: S_LEN}, (_, i) => i);
  const COLOR_S_FILL = '#5a1a28';
  yield* all(
    sample().normalizedSign().fill(COLOR_S, 0.4, easeOutCubic),
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

  const signBit = ieeeSignBit(DEMO_FLOAT);
  yield* flyPartToBit(
    view,
    sample().normalizedSign(),
    bitBoxes[0],
    sample().parts.sign,
    COLOR_S,
    0.55,
    56,
    bitTxts[0].text(signBit, 0.25, easeOutCubic),
  );
  yield* waitFor(0.25);

  // 10) S 右侧淡入指数偏置计算：E = e + bias
  const trueExp = sample().normalizeExponent;
  const storedE = trueExp + EXP_BIAS;
  const eBin = storedE.toString(2).padStart(E_LEN, '0');
  expLineE().tex([`e=${trueExp}`]);
  expLineSum().tex([
    `E=e+\\mathrm{bias}=${trueExp}+${EXP_BIAS}=${storedE}`,
  ]);
  expLineBin().tex([`=${eBin}_{2}`]);

  yield* all(
    expCalc().opacity(1, 0.45, easeOutCubic),
    expCalc().scale(1, 0.5, easeOutCubic),
  );
  yield* waitFor(2.55);

  // 11) 算出的 E 整串一起飞入 E 段中心，再一次性更新全部 E 比特
  const eBitIndices = Array.from({length: E_LEN}, (_, i) => S_LEN + i);
  const COLOR_E_FILL = '#152238';
  const eLeft = bitBoxes[S_LEN].absolutePosition();
  const eRight = bitBoxes[S_LEN + E_LEN - 1].absolutePosition();
  const eMidAbs = new Vector2((eLeft.x + eRight.x) / 2, (eLeft.y + eRight.y) / 2);
  yield* all(
    expLineBin().fill('#fff0c8', 0.3, easeOutCubic),
    ...eBitIndices.map(i =>
      all(
        bitBoxes[i].fill(COLOR_E_FILL, 0.35, easeOutCubic),
        bitBoxes[i].lineWidth(3.5, 0.35, easeOutCubic),
        bitBoxes[i].stroke(COLOR_E, 0.35, easeOutCubic),
        bitTxts[i].fill(PAPER, 0.35, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(0.15);

  // 结果飞入比特位的同时隐藏偏置指数计算卡片
  yield* all(
    flyTextToPoint(
      view,
      expLineBin(),
      eMidAbs,
      eBin,
      COLOR_E,
      0.55,
      34,
      true,
      all(
        ...eBitIndices.map((i, k) =>
          bitTxts[i].text(eBin[k], 0.25, easeOutCubic),
        ),
      ),
    ),
    expCalc().opacity(0, 0.45, easeOutCubic),
    expCalc().scale(0.94, 0.45, easeOutCubic),
  );
  yield* waitFor(0.35);

  // 12) 从顶部规格化框裁出尾数 M（小数点后 23 位）飞入并更新
  const mBitIndices = Array.from(
    {length: M_LEN},
    (_, i) => S_LEN + E_LEN + i,
  );
  const COLOR_M_FILL = '#0f2a28';
  const mLeft = bitBoxes[S_LEN + E_LEN].absolutePosition();
  const mRight = bitBoxes[BITS - 1].absolutePosition();
  const mMidAbs = new Vector2(
    (mLeft.x + mRight.x) / 2,
    (mLeft.y + mRight.y) / 2,
  );

  // 要舍弃的位标红，再删除
  yield* sample().markFracDiscard(M_LEN, COLOR_S, 0.4);
  yield* waitFor(0.45);
  sample().cropFracToMantissa(M_LEN);
  const mBin = sample().mantissaFieldBits(M_LEN);
  yield* waitFor(0.25);

  yield* all(
    ...mBitIndices.map(i =>
      all(
        bitBoxes[i].fill(COLOR_M_FILL, 0.35, easeOutCubic),
        bitBoxes[i].lineWidth(3.5, 0.35, easeOutCubic),
        bitBoxes[i].stroke(COLOR_M, 0.35, easeOutCubic),
        bitTxts[i].fill(PAPER, 0.35, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(0.1);

  yield* flyTextToPoint(
    view,
    sample().normalizedFrac(),
    mMidAbs,
    mBin,
    COLOR_M,
    0.6,
    28,
    true,
    all(
      ...mBitIndices.map((i, k) =>
        bitTxts[i].text(mBin[k], 0.25, easeOutCubic),
      ),
      sample().normalizedFracTex().fill(PAPER, 0.25, easeOutCubic),
    ),
  );
  yield* waitFor(0.45);

  // 13) 全部写入完成后：纵排回横向四字节，并恢复花括号 / 字节标签
  yield* all(
    ...rowLabels.map(l => l.opacity(0, 0.3, easeOutCubic)),
    sample().opacity(0, 0.35, easeOutCubic),
    ...bitBoxes.map((box, i) => {
      const p = bitPosH(i);
      return box.position(p, 0.75, easeInOutCubic);
    }),
  );
  yield* waitFor(0.15);
  yield* all(
    ...byteTags.map((t, i) =>
      delay(i * 0.05, t.opacity(0.9, 0.3, easeOutCubic)),
    ),
    braceS().show(0.4),
    delay(0.1, braceE().show(0.45)),
    delay(0.2, braceM().show(0.5)),
  );
  yield* waitFor(1.2);
});

/**
 * 将案例数字某一部分的视觉副本，从源节点飞入目标比特格中心并淡出。
 * onArrive 与飞入物淡出同时播放（用于立即更新比特）。
 */
function* flyPartToBit(
  view: View2D,
  from: Node,
  toBox: Rect,
  text: string,
  color: string,
  duration = 0.55,
  fontSize = 56,
  onArrive?: ThreadGenerator,
): ThreadGenerator {
  yield* flyTextToPoint(
    view,
    from,
    toBox.absolutePosition(),
    text,
    color,
    duration,
    fontSize,
    true,
    onArrive,
  );
}

/** 文本从源节点飞到目标点；淡出时同步执行 onArrive */
function* flyTextToPoint(
  view: View2D,
  from: Node,
  target: Vector2,
  text: string,
  color: string,
  duration = 0.55,
  fontSize = 56,
  targetIsAbsolute = false,
  onArrive?: ThreadGenerator,
): ThreadGenerator {
  const flyer = createRef<Txt>();
  const start = from.absolutePosition();
  const end = targetIsAbsolute
    ? target
    : (() => {
        const viewAbs = view.absolutePosition();
        return new Vector2(viewAbs.x + target.x, viewAbs.y + target.y);
      })();

  view.add(
    <Txt
      ref={flyer}
      text={text}
      fontFamily={FONT}
      fontSize={fontSize}
      fontWeight={700}
      fill={color}
      opacity={1}
      scale={1}
      zIndex={100}
    />,
  );
  flyer().absolutePosition(start);

  const fadeDur = duration * 0.4;
  yield* all(
    flyer().absolutePosition(end, duration, easeInOutCubic),
    flyer().scale(0.55, duration, easeInOutCubic),
    delay(
      duration * 0.55,
      all(
        flyer().opacity(0, fadeDur, easeOutCubic),
        ...(onArrive ? [onArrive] : []),
      ),
    ),
  );

  flyer().remove();
}
