import { Layout, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";

/** 演示步数：每步最低位落一次「+1」并按二进制进位更新 */
const STEPS = 16;

const BG = "#0a0e14";
const PAPER = "#e8eef7";
const MUTED = "#5a6a7e";
const ACCENT = "#3dd6c6";
const DEEP = "#121820";
const LINE = "#2a3a4c";

const BITS = 8;
const CELL = 72;
const GAP = 12;

/**
 * 中央 8 格表示一个字节：左高位、右低位，默认全 0。
 * 每步「+1」落入最低位格顶，再刷新字节。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const frames = createRefArray<Rect>();
  const digits = createRefArray<Txt>();
  const plusOne = createRef<Txt>();
  const label = createRef<Txt>();

  let value = 0;

  view.add(
    <Txt
      ref={label}
      text={"1 Byte"}
      fontFamily={"Consolas, Menlo, monospace"}
      fontSize={22}
      fill={MUTED}
      letterSpacing={4}
      y={-130}
      opacity={0}
    />,
  );

  const row = createRef<Layout>();
  view.add(
    <Layout
      ref={row}
      layout
      direction={"row"}
      gap={GAP}
      alignItems={"center"}
      y={0}
    />,
  );

  for (let i = 0; i < BITS; i++) {
    const cell = createRef<Layout>();
    row().add(<Layout ref={cell} layout width={CELL} height={CELL} />);
    cell().add(
      <Rect
        ref={frames}
        layout={false}
        width={CELL}
        height={CELL}
        x={CELL / 2}
        y={CELL / 2}
        fill={DEEP}
        stroke={LINE}
        lineWidth={2}
        radius={8}
        clip
        opacity={0}
        scale={0.88}
      >
        <Txt
          ref={digits}
          layout={false}
          text={"0"}
          fontFamily={"Consolas, Menlo, monospace"}
          fontSize={36}
          fontWeight={700}
          fill={PAPER}
        />
      </Rect>,
    );
  }

  // 「+1」挂在 view 上，每步定位到最低位格上方再下落
  view.add(
    <Txt
      ref={plusOne}
      text={"+1"}
      fontFamily={"Consolas, Menlo, monospace"}
      fontSize={28}
      fontWeight={700}
      fill={ACCENT}
      opacity={0}
    />,
  );

  // 入场
  yield* all(
    label().opacity(0.9, 0.35, easeOutCubic),
    ...frames.map((f, i) =>
      delay(
        i * 0.04,
        all(f.opacity(1, 0.3, easeOutCubic), f.scale(1, 0.35, easeOutCubic)),
      ),
    ),
  );
  yield* waitFor(0.35);

  for (let step = 0; step < STEPS; step++) {
    yield* dropPlusOne(plusOne(), frames[BITS - 1]);
    const next = (value + 1) & 0xff;
    yield* applyByte(frames, digits, value, next);
    value = next;
    yield* waitFor(0.2);
  }

  yield* waitFor(0.8);
});

function* dropPlusOne(txt: Txt, lsbFrame: Rect): ThreadGenerator {
  // 用绝对坐标：格子世界中心上方落下
  const top = lsbFrame.absolutePosition();
  // absolutePosition 是世界坐标；Txt 挂在 view 上时可直接用
  txt.absolutePosition(top.addY(-110));
  txt.opacity(0);
  txt.scale(0.85);

  yield* all(
    txt.opacity(1, 0.18, easeOutCubic),
    txt.scale(1, 0.18, easeOutCubic),
  );
  yield* all(
    txt.absolutePosition(top.addY(-CELL / 2 - 18), 0.4, easeInOutCubic),
    txt.opacity(1, 0.25),
  );
  yield* all(
    txt.opacity(0, 0.18, easeOutCubic),
    txt.scale(0.7, 0.18, easeInOutCubic),
  );
}

function* applyByte(
  frames: Rect[],
  digits: Txt[],
  prev: number,
  next: number,
): ThreadGenerator {
  // uiIndex 0 = 最高位；bitIndex 0 = 最低位
  const flips: number[] = [];
  for (let bit = 0; bit < BITS; bit++) {
    const mask = 1 << bit;
    if ((prev & mask) !== (next & mask)) {
      flips.push(bit);
    }
  }

  const step = 0.42 / Math.max(flips.length, 1);
  yield* all(
    ...flips.map((bit, k) => {
      const ui = BITS - 1 - bit;
      const newBit = (next >> bit) & 1;
      return delay(
        k * step * 0.85,
        flipDigit(frames[ui], digits[ui], newBit, step * 1.15),
      );
    }),
  );
}

function* flipDigit(
  frame: Rect,
  txt: Txt,
  newBit: number,
  duration: number,
): ThreadGenerator {
  const travel = CELL * 0.85;
  const outDur = duration * 0.4;
  const inDur = duration * 0.45;

  yield* all(
    frame.stroke(ACCENT, outDur, easeOutCubic),
    txt.y(travel, outDur, easeInOutCubic),
    txt.opacity(0, outDur, easeInOutCubic),
  );

  txt.text(`${newBit}`);
  txt.fill(newBit === 1 ? ACCENT : PAPER);
  txt.y(-travel);
  txt.opacity(0);

  yield* all(
    txt.y(0, inDur, easeOutCubic),
    txt.opacity(1, inDur * 0.85, easeOutCubic),
    frame.stroke(newBit === 1 ? ACCENT : LINE, inDur),
  );
}
