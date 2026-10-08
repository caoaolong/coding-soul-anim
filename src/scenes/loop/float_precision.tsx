import {Img, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {Question} from '../../components/question/question';
import {SceneTitle} from '../../components/title/scene_title';
import computerIcon from '../../assets/icons/计算机.svg';
import {FONT} from '../../theme/fonts';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const WARN = '#ffb020';
const OK = '#3ddc97';
const DEEP = '#121820';
const LINE = '#2a3a4c';

/**
 * 可配置：依次演示的「输入字符串」。
 * 右侧输出由 IEEE754 双精度实际存储值生成（与字面量可能不同）。
 */
const FLOAT_CASES = ['0.1', '0.5', '0.3', '0.25', '0.625'] as const;

const VIEW_HALF = 960;
const COMPUTER_SIZE = 260;
/** 图标可视遮挡半宽（略小于图宽，贴合主体） */
const GATE = COMPUTER_SIZE * 0.42;
const CARD_Y = 20;
const MASK_H = 220;
/** 与左右说明文字共用同一竖直中线（卡片相对文字水平居中） */
const LABEL_IN_X = -520;
const LABEL_OUT_X = 520;
const LABEL_Y = -160;

const LEFT_MASK_W = VIEW_HALF - GATE;
const LEFT_MASK_X = -(VIEW_HALF + GATE) / 2;
const RIGHT_MASK_W = VIEW_HALF - GATE;
const RIGHT_MASK_X = (VIEW_HALF + GATE) / 2;

/**
 * 浮点精度丢失：
 * 字符串在左侧裁剪区内滑入并逐渐被计算机遮住；
 * 编码结果在右侧裁剪区从图标边缘逐渐露出再滑出。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const question = createRef<Question>();
  const computer = createRef<Img>();
  const hint = createRef<Txt>();
  const labelIn = createRef<Txt>();
  const labelOut = createRef<Txt>();

  const leftMask = createRef<Rect>();
  const rightMask = createRef<Rect>();
  const inCard = createRef<Rect>();
  const inTxt = createRef<Txt>();
  const outCard = createRef<Rect>();
  const outTxt = createRef<Txt>();

  view.add(<SceneTitle ref={title} text={'浮点精度'} />);
  view.add(
    <Question
      ref={question}
      text={'计算机是如何处理这个**精度问题**的呢？'}
      zIndex={100}
    />,
  );

  // 左半屏裁剪：卡片只能出现在计算机左侧
  view.add(
    <Rect
      ref={leftMask}
      x={LEFT_MASK_X}
      y={CARD_Y}
      width={LEFT_MASK_W}
      height={MASK_H}
      clip
      zIndex={5}
    >
      <Rect
        ref={inCard}
        layout
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        padding={[18, 28]}
        fill={DEEP}
        stroke={ACCENT}
        lineWidth={2.5}
        radius={12}
        // 相对 leftMask；与「输入字符串」同一竖直中线
        x={worldToLocal(LEFT_MASK_X, LABEL_IN_X)}
        opacity={0}
        scale={0.92}
      >
        <Txt
          ref={inTxt}
          text={''}
          fontFamily={FONT}
          fontSize={34}
          fontWeight={700}
          fill={PAPER}
        />
      </Rect>
    </Rect>,
  );

  // 右半屏裁剪：卡片只能出现在计算机右侧 → 长串逐渐露出
  view.add(
    <Rect
      ref={rightMask}
      x={RIGHT_MASK_X}
      y={CARD_Y}
      width={RIGHT_MASK_W}
      height={MASK_H}
      clip
      zIndex={5}
    >
      <Rect
        ref={outCard}
        layout
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        padding={[18, 28]}
        fill={DEEP}
        stroke={WARN}
        lineWidth={2.5}
        radius={12}
        x={worldToLocal(RIGHT_MASK_X, 0)}
        opacity={0}
        scale={0.92}
      >
        <Txt
          ref={outTxt}
          text={''}
          fontFamily={FONT}
          fontSize={34}
          fontWeight={700}
          fill={WARN}
        />
      </Rect>
    </Rect>,
  );

  view.add(
    <Img
      ref={computer}
      src={computerIcon}
      width={COMPUTER_SIZE}
      height={COMPUTER_SIZE}
      x={0}
      y={CARD_Y}
      opacity={0}
      scale={0.9}
      zIndex={20}
    />,
  );

  view.add(
    <Txt
      ref={labelIn}
      text={'输入字符串'}
      fontFamily={FONT}
      fontSize={20}
      fill={ACCENT}
      x={LABEL_IN_X}
      y={LABEL_Y}
      opacity={0}
    />,
  );
  view.add(
    <Txt
      ref={labelOut}
      text={'浮点编码结果'}
      fontFamily={FONT}
      fontSize={20}
      fill={WARN}
      x={LABEL_OUT_X}
      y={LABEL_Y}
      opacity={0}
    />,
  );
  view.add(
    <Txt
      ref={hint}
      text={'IEEE 754 编码'}
      fontFamily={FONT}
      fontSize={22}
      fill={ACCENT}
      y={260}
      opacity={0}
    />,
  );

  yield* title().show();
  yield* all(
    computer().opacity(1, 0.45, easeOutCubic),
    computer().scale(1, 0.5, easeOutCubic),
    hint().opacity(0.9, 0.4, easeOutCubic),
    labelIn().opacity(0.85, 0.4, easeOutCubic),
    labelOut().opacity(0.85, 0.4, easeOutCubic),
  );
  yield* waitFor(0.25);

  // 淡入落点 / 滑出停点：与对应说明文字同一竖直中线（水平居中对齐）
  const enterFrom = worldToLocal(LEFT_MASK_X, LABEL_IN_X);
  // 滑到遮挡缝内侧，完全被裁掉
  const enterTo = worldToLocal(LEFT_MASK_X, GATE + 40);
  const exitFrom = worldToLocal(RIGHT_MASK_X, -GATE - 40);
  const exitRead = worldToLocal(RIGHT_MASK_X, LABEL_OUT_X);
  const exitGone = worldToLocal(RIGHT_MASK_X, 900);

  for (const input of FLOAT_CASES) {
    const output = toIeeeDisplay(input);
    const same = isConsistent(input, output);
    const outColor = same ? OK : WARN;

    // —— 左侧：先在「输入字符串」处淡入，再向右滑入计算机 ——
    inTxt().text(input);
    inCard().x(enterFrom);
    inCard().opacity(0);
    inCard().scale(0.92);

    outCard().opacity(0);
    outCard().x(exitFrom);
    outCard().stroke(outColor);
    outTxt().text(output);
    outTxt().fill(outColor);

    yield* all(
      inCard().opacity(1, 0.35, easeOutCubic),
      inCard().scale(1, 0.4, easeOutCubic),
    );
    yield* waitFor(0.25);
    yield* inCard().x(enterTo, 0.85, easeInOutCubic);
    inCard().opacity(0);

    // 编码瞬间
    yield* computer().scale(1.1, 0.16, easeOutCubic).to(1, 0.2, easeInOutCubic);
    yield* waitFor(0.06);

    // —— 右侧：长浮点从遮挡边缘逐渐露出 ——
    outCard().x(exitFrom);
    outCard().opacity(1);
    outCard().scale(1);

    yield* outCard().x(exitRead, 0.9, easeInOutCubic);
    yield* waitFor(0.55);
    yield* all(
      outCard().x(exitGone, 0.5, easeInOutCubic),
      delay(0.12, outCard().opacity(0, 0.35, easeInOutCubic)),
    );
    yield* waitFor(0.15);
  }

  yield* waitFor(0.5);
  yield* question().ask();
  yield* waitFor(1.0);
});

function worldToLocal(maskX: number, worldX: number): number {
  return worldX - maskX;
}

function toIeeeDisplay(expr: string): string {
  const trimmed = expr.trim();
  if (!/^[\d\s.+\-*/()eE]+$/.test(trimmed)) {
    throw new Error(`FLOAT_CASES 含非法字符: ${expr}`);
  }
  const value = Function(`"use strict"; return (${trimmed});`)() as number;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value);
  }
  return trimTrailingZeros(value.toFixed(20));
}

function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '.0');
}

/** 输入与编码展示是否一致（无可见精度损失 → 绿色边框） */
function isConsistent(input: string, output: string): boolean {
  const a = input.replace(/\s+/g, '');
  const b = output.replace(/\s+/g, '');
  if (a === b) return true;
  // 纯数字字面量：0.50 与 0.5 视为一致
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(a) && Number(a) === Number(b) && b === String(Number(a))) {
    return true;
  }
  return false;
}
