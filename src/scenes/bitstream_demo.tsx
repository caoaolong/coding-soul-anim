import {Img, Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
import {SceneTitle} from '../components/title/scene_title';
import {FONT} from '../theme/fonts';
import pcHost from '../assets/icons/pc_host.svg';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const PAPER = '#e8eef7';
const ENCODE = '#3dd6c6';
const DECODE = '#5ec8ff';
const BIT = '#ffe08a';
const MONO = 'JetBrains Mono, Consolas, monospace';

const LEFT_X = -640;
const RIGHT_X = 640;
/** 整体上移：PC / 传输线在上半屏，卡片在下半屏（再上移，给底部字幕留空） */
const PC_Y = -260;
const PC_SIZE = 220;
const CARD_Y = 140;
const CARD_W = 620;
const CARD_H = 360;
/** 传输线起止（PC 内沿之间） */
const WIRE_X0 = -500;
const WIRE_X1 = 500;
/** 编码 / 解码盒位置：连线上方，靠左 / 靠右 */
const ENCODE_X = -270;
const DECODE_X = 270;
const BOX_Y = PC_Y - 100;

const ROW_H = 34;

/**
 * 演示文本：Hello,世界！
 * ASCII 用 8 位，中文及全角标点用 UTF-8 3 字节（24 位）。
 */
const SEND_TEXT = 'Hello,世界！';
const SEND_BYTES = [
  '01001000', // H
  '01100101', // e
  '01101100', // l
  '01101100', // l
  '01101111', // o
  '00101100', // ,
  '111001001011100010010110', // 世 U+4E16
  '111001111001010110001100', // 界 U+754C
  '111011111011110010000001', // ！ U+FF01
];
const BITS = SEND_BYTES.join('').split('');

/** 每个字符的比特长度 */
const CHAR_BITLEN = SEND_BYTES.map(b => b.length);
/** 每个字符起始的全局比特下标 */
const CHAR_START: number[] = [];
{
  let acc = 0;
  for (const b of SEND_BYTES) {
    CHAR_START.push(acc);
    acc += b.length;
  }
}
/** 每个全局比特所属的字符下标 */
const BIT_CHAR: number[] = [];
SEND_BYTES.forEach((b, ci) => {
  for (let k = 0; k < b.length; k++) BIT_CHAR.push(ci);
});

/** 比特串解码：8 位 ASCII，或 24 位 UTF-8 三字节 */
function bitsToChar(byteStr: string): string {
  if (byteStr.length === 8) {
    return String.fromCharCode(parseInt(byteStr, 2));
  }
  const bytes = [
    parseInt(byteStr.slice(0, 8), 2),
    parseInt(byteStr.slice(8, 16), 2),
    parseInt(byteStr.slice(16, 24), 2),
  ];
  const codePoint =
    ((bytes[0] & 0x0f) << 12) | ((bytes[1] & 0x3f) << 6) | (bytes[2] & 0x3f);
  return String.fromCharCode(codePoint);
}

/**
 * 比特流传输（网格卡片版）：
 * 上：左右 PC + 传输线 + 编码 / 解码盒（盒在连线上方，无连线）
 * 下：左右大卡片均为网格布局——最左列为字符串，每行对应二进制码；
 * 左侧随发送递减（比特逐个减少、整字符发完整行消失），
 * 右侧随接收递增（先攒原始 0101，凑齐一个字符立刻解析出字符）。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const leftPc = createRef<Img>();
  const rightPc = createRef<Img>();
  const leftLabel = createRef<Txt>();
  const rightLabel = createRef<Txt>();
  const wire = createRef<Line>();
  const encodeBox = createRef<Rect>();
  const decodeBox = createRef<Rect>();
  const bits = createRefArray<Txt>();

  const leftCard = createRef<Rect>();
  const rightCard = createRef<Rect>();
  const senderRows = createRefArray<Layout>();
  const senderCharTxts = createRefArray<Txt>();
  const senderBitTxts = createRefArray<Txt>();
  const receiverRows = createRefArray<Layout>();
  const receiverCharTxts = createRefArray<Txt>();
  const receiverBitTxts = createRefArray<Txt>();

  view.add(<SceneTitle ref={title} text={'比特流传输'} />);

  // ── 上半：左右 PC ──
  view.add(
    <Img
      ref={leftPc}
      src={pcHost}
      width={PC_SIZE}
      height={PC_SIZE}
      x={LEFT_X}
      y={PC_Y}
      opacity={0}
      scale={0.9}
    />,
  );
  view.add(
    <Img
      ref={rightPc}
      src={pcHost}
      width={PC_SIZE}
      height={PC_SIZE}
      x={RIGHT_X}
      y={PC_Y}
      opacity={0}
      scale={0.9}
    />,
  );
  view.add(
    <Txt
      ref={leftLabel}
      text={'发送主机'}
      fontFamily={FONT}
      fontSize={28}
      fill={PAPER}
      x={LEFT_X}
      y={PC_Y + 158}
      opacity={0}
    />,
  );
  view.add(
    <Txt
      ref={rightLabel}
      text={'接收主机'}
      fontFamily={FONT}
      fontSize={28}
      fill={PAPER}
      x={RIGHT_X}
      y={PC_Y + 158}
      opacity={0}
    />,
  );

  // ── 上半：中间连线 ──
  view.add(
    <Line
      ref={wire}
      points={[
        [WIRE_X0, PC_Y],
        [WIRE_X1, PC_Y],
      ]}
      stroke={LINE}
      lineWidth={6}
      lineCap={'round'}
      end={0}
    />,
  );

  // ── 上半：编码（连线上方靠左）、解码（连线上方靠右），无连线 ──
  view.add(
    <Rect
      ref={encodeBox}
      width={180}
      height={88}
      x={ENCODE_X}
      y={BOX_Y}
      fill={CARD}
      stroke={ENCODE}
      lineWidth={3}
      radius={14}
      opacity={0}
      scale={0.9}
    >
      <Txt
        text={'编码'}
        fontFamily={FONT}
        fontSize={38}
        fontWeight={700}
        fill={ENCODE}
      />
    </Rect>,
  );
  view.add(
    <Rect
      ref={decodeBox}
      width={180}
      height={88}
      x={DECODE_X}
      y={BOX_Y}
      fill={CARD}
      stroke={DECODE}
      lineWidth={3}
      radius={14}
      opacity={0}
      scale={0.9}
    >
      <Txt
        text={'解码'}
        fontFamily={FONT}
        fontSize={38}
        fontWeight={700}
        fill={DECODE}
      />
    </Rect>,
  );

  // ── 比特流 ──
  for (let i = 0; i < BITS.length; i++) {
    view.add(
      <Txt
        ref={bits}
        text={BITS[i]}
        fontFamily={MONO}
        fontSize={34}
        fontWeight={700}
        fill={BIT}
        x={WIRE_X0}
        y={PC_Y}
        zIndex={10}
        opacity={0}
      />,
    );
  }

  // ── 下半：左侧卡片 = 待发送网格（字符 | 二进制，无描述文案）──
  view.add(
    <Rect
      ref={leftCard}
      width={CARD_W}
      height={CARD_H}
      x={LEFT_X}
      y={CARD_Y}
      fill={CARD}
      stroke={LINE}
      lineWidth={2}
      radius={16}
      opacity={0}
      scale={0.96}
      layout
      direction={'column'}
      alignItems={'center'}
      justifyContent={'center'}
      gap={3}
      padding={[18, 16]}
    >
      {[...SEND_TEXT].map((ch, i) => (
        <Layout
          ref={senderRows}
          layout
          direction={'row'}
          gap={14}
          alignItems={'center'}
          width={540}
          height={ROW_H}
        >
          <Layout width={64} alignItems={'center'} justifyContent={'center'}>
            <Txt
              ref={senderCharTxts}
              text={ch}
              fontFamily={FONT}
              fontSize={30}
              fontWeight={700}
              fill={PAPER}
            />
          </Layout>
          <Txt
            ref={senderBitTxts}
            text={SEND_BYTES[i]}
            fontFamily={MONO}
            fontSize={20}
            fill={ENCODE}
          />
        </Layout>
      ))}
    </Rect>,
  );

  // ── 下半：右侧卡片 = 已接收网格（字符 | 二进制，无描述文案）──
  view.add(
    <Rect
      ref={rightCard}
      width={CARD_W}
      height={CARD_H}
      x={RIGHT_X}
      y={CARD_Y}
      fill={CARD}
      stroke={LINE}
      lineWidth={2}
      radius={16}
      opacity={0}
      scale={0.96}
      layout
      direction={'column'}
      alignItems={'center'}
      justifyContent={'center'}
      gap={3}
      padding={[18, 16]}
    >
      {[...SEND_TEXT].map((_, i) => (
        <Layout
          ref={receiverRows}
          layout
          direction={'row'}
          gap={14}
          alignItems={'center'}
          width={540}
          height={0}
          opacity={0}
        >
          <Layout width={64} alignItems={'center'} justifyContent={'center'}>
            <Txt
              ref={receiverCharTxts}
              text={''}
              fontFamily={FONT}
              fontSize={30}
              fontWeight={700}
              fill={PAPER}
            />
          </Layout>
          <Txt
            ref={receiverBitTxts}
            text={''}
            fontFamily={MONO}
            fontSize={20}
            fill={BIT}
          />
        </Layout>
      ))}
    </Rect>,
  );

  yield* title().show();
  yield* waitFor(0.2);

  // 1) PC 入场
  yield* all(
    leftPc().opacity(1, 0.45, easeOutCubic),
    leftPc().scale(1, 0.5, easeOutBack),
    rightPc().opacity(1, 0.45, easeOutCubic),
    rightPc().scale(1, 0.5, easeOutBack),
    leftLabel().opacity(1, 0.4, easeOutCubic),
    rightLabel().opacity(1, 0.4, easeOutCubic),
  );
  yield* waitFor(0.2);

  // 2) 连线 + 编解码盒（盒在连线上方，无连线）
  yield* wire().end(1, 0.7, easeInOutCubic);
  yield* all(
    encodeBox().opacity(1, 0.35, easeOutCubic),
    encodeBox().scale(1, 0.4, easeOutBack),
    delay(
      0.12,
      all(
        decodeBox().opacity(1, 0.35, easeOutCubic),
        decodeBox().scale(1, 0.4, easeOutBack),
      ),
    ),
  );
  yield* waitFor(0.2);

  // 3) 双卡片入场
  yield* all(
    leftCard().opacity(1, 0.4, easeOutCubic),
    leftCard().scale(1, 0.45, easeOutCubic),
    delay(
      0.12,
      all(
        rightCard().opacity(1, 0.4, easeOutCubic),
        rightCard().scale(1, 0.45, easeOutCubic),
      ),
    ),
  );
  yield* waitFor(0.4);

  // 4) 连续发送：120 比特在传输线上同时流动；
  // 左侧随发出递减（比特逐个减少、整字符发完整行消失），
  // 右侧随到达递增（先攒原始 0101，凑齐一个字符立刻解析出字符）。
  bits.forEach(b => {
    b.x(WIRE_X0);
    b.opacity(0);
  });

  const GAP = 0.12; // 相邻比特发出间隔
  const TRAVEL = 1.8; // 单个比特走完全程耗时

  // 比特流：staggered 连续发出
  function* flowAll() {
    yield* all(
      ...bits.map((b, i) =>
        delay(
          i * GAP,
          (function* () {
            yield* b.opacity(1, 0.08, easeOutCubic);
            yield* b.x(WIRE_X1, TRAVEL, easeInOutCubic);
            yield* b.opacity(0, 0.1, easeOutCubic);
          })(),
        ),
      ),
    );
  }

  // 发送端：按发出节拍递减左侧网格
  function* senderAll() {
    for (let i = 0; i < BITS.length; i++) {
      const charIdx = BIT_CHAR[i];
      const posInChar = i - CHAR_START[charIdx];
      const isLast = i === BITS.length - 1;
      // 发出一位：该行二进制减少一位
      senderBitTxts[charIdx].text(SEND_BYTES[charIdx].slice(posInChar + 1));
      if (posInChar + 1 === CHAR_BITLEN[charIdx]) {
        // 整字符发完：整行消失（折叠高度）
        senderRows[charIdx].opacity(0);
        senderRows[charIdx].height(0);
      }
      if (!isLast) yield* waitFor(GAP);
    }
  }

  // 接收端：按到达节拍递增右侧网格
  function* receiveAll() {
    yield* waitFor(TRAVEL);
    let pending = '';
    for (let i = 0; i < BITS.length; i++) {
      const charIdx = BIT_CHAR[i];
      const posInChar = i - CHAR_START[charIdx];
      const isLast = i === BITS.length - 1;
      if (posInChar === 0) {
        // 新行出现
        receiverRows[charIdx].height(ROW_H);
        receiverRows[charIdx].opacity(1);
      }
      pending += BITS[i];
      if (posInChar + 1 === CHAR_BITLEN[charIdx]) {
        // 凑齐一个字符：立刻解析出字符
        const ch = bitsToChar(pending);
        receiverCharTxts[charIdx].text(ch);
        receiverBitTxts[charIdx].text(pending);
        pending = '';
        const pulse = (function* () {
          yield* all(
            receiverCharTxts[charIdx].scale(1.15, 0.05, easeOutCubic),
            rightCard().scale(1.012, 0.05, easeOutCubic),
          );
          yield* all(
            receiverCharTxts[charIdx].scale(1, 0.06, easeOutCubic),
            rightCard().scale(1, 0.06, easeOutCubic),
          );
        })();
        if (!isLast) {
          yield* all(waitFor(GAP), pulse);
        } else {
          yield* pulse;
        }
      } else {
        // 还不够一个字符：保持原始 0101 显示
        receiverBitTxts[charIdx].text(pending);
        if (!isLast) yield* waitFor(GAP);
      }
    }
  }

  yield* all(
    flowAll(),
    senderAll(),
    receiveAll(),
    // 编解码盒在流经过时各脉动一次示意
    delay(0.5, encodeBox().scale(1.07, 0.15, easeOutCubic)),
    delay(TRAVEL * 0.6, decodeBox().scale(1.07, 0.15, easeOutCubic)),
  );
  yield* all(
    encodeBox().scale(1, 0.15, easeOutCubic),
    decodeBox().scale(1, 0.15, easeOutCubic),
  );

  yield* waitFor(1.2);
});
