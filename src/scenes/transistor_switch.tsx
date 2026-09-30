import {Circle, Img, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

import transistorIcon from '../assets/transistor.svg';
import lightOn from '../assets/light_light.svg';
import lightOff from '../assets/light_dark.svg';
import {Question} from '../components/question/question';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE = '#2a3a4c';
const OFF = '#3a4555';

/** 图标 200×200，引脚朝下：左集电极 / 中基极 / 右发射极 */
const DEVICE = {x: 0, y: -120, size: 200};
const pinX = (svgX: number) =>
  DEVICE.x - DEVICE.size / 2 + (svgX / 200) * DEVICE.size;
const pinY = (svgY: number) =>
  DEVICE.y - DEVICE.size / 2 + (svgY / 200) * DEVICE.size;

const PIN_C = {x: pinX(52), y: pinY(172)};
const PIN_B = {x: pinX(100), y: pinY(172)};
const PIN_E = {x: pinX(148), y: pinY(172)};

/** 三脚统一向下引出后再分叉 */
const DROP = 56;
const BUS_Y = PIN_B.y + DROP;
const LAMP = {x: -260, y: BUS_Y};
const GND_X = 220;

/**
 * 晶体管作开关：引脚朝下连线，灯泡通断 + 0/1。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const device = createRef<Img>();
  const baseWire = createRef<Line>();
  const baseDot = createRef<Circle>();
  const baseLabel = createRef<Txt>();
  const collectorWire = createRef<Line>();
  const emitterWire = createRef<Line>();
  const gndTop = createRef<Line>();
  const lampOn = createRef<Img>();
  const lampOff = createRef<Img>();
  const lampGlow = createRef<Circle>();
  const pathLabel = createRef<Txt>();
  const bitBox = createRef<Rect>();
  const bitTxt = createRef<Txt>();
  const stateTxt = createRef<Txt>();
  const tagC = createRef<Txt>();
  const tagB = createRef<Txt>();
  const tagE = createRef<Txt>();

  view.add(<SceneTitle ref={title} text={'晶体管 = 开关'} />);

  // 晶体管（引脚朝下）
  view.add(
    <Img
      ref={device}
      src={transistorIcon}
      width={DEVICE.size}
      height={DEVICE.size}
      x={DEVICE.x}
      y={DEVICE.y}
      opacity={0}
      scale={0.9}
    />,
  );

  // 集电极：左脚下 → 左到灯泡
  view.add(
    <Line
      ref={collectorWire}
      points={[
        [PIN_C.x, PIN_C.y],
        [PIN_C.x, BUS_Y],
        [LAMP.x + 36, BUS_Y],
      ]}
      stroke={OFF}
      lineWidth={3}
      lineCap={'round'}
      lineJoin={'round'}
      end={0}
    />,
  );

  view.add(
    <Circle
      ref={lampGlow}
      x={LAMP.x}
      y={LAMP.y - 8}
      size={110}
      fill={'#FFC807'}
      opacity={0}
    />,
  );
  view.add(
    <Img
      ref={lampOff}
      src={lightOff}
      width={72}
      height={72}
      x={LAMP.x}
      y={LAMP.y - 8}
      opacity={0}
      scale={0.85}
    />,
  );
  view.add(
    <Img
      ref={lampOn}
      src={lightOn}
      width={72}
      height={72}
      x={LAMP.x}
      y={LAMP.y - 8}
      opacity={0}
      scale={0.85}
    />,
  );
  view.add(
    <Txt
      ref={pathLabel}
      text={'通路：断'}
      fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
      fontSize={22}
      fill={PAPER}
      x={LAMP.x}
      y={LAMP.y + 58}
      opacity={0}
    />,
  );

  // 基极：中脚下 → 再下到控制端
  view.add(
    <Line
      ref={baseWire}
      points={[
        [PIN_B.x, PIN_B.y],
        [PIN_B.x, BUS_Y + 90],
        [-200, BUS_Y + 90],
      ]}
      stroke={OFF}
      lineWidth={3}
      lineCap={'round'}
      lineJoin={'round'}
      end={0}
    />,
  );
  view.add(
    <Circle
      ref={baseDot}
      x={-200}
      y={BUS_Y + 90}
      size={18}
      fill={OFF}
      stroke={LINE}
      lineWidth={2}
      opacity={0}
      scale={0.7}
    />,
  );
  view.add(
    <Txt
      ref={baseLabel}
      text={'基极信号'}
      fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
      fontSize={20}
      fill={PAPER}
      x={-200}
      y={BUS_Y + 128}
      opacity={0}
    />,
  );

  // 发射极：右脚下 → 右到地
  view.add(
    <Line
      ref={emitterWire}
      points={[
        [PIN_E.x, PIN_E.y],
        [PIN_E.x, BUS_Y],
        [GND_X, BUS_Y],
        [GND_X, BUS_Y + 36],
      ]}
      stroke={LINE}
      lineWidth={3}
      lineCap={'round'}
      lineJoin={'round'}
      end={0}
      opacity={0.95}
    />,
  );
  view.add(
    <Line
      ref={gndTop}
      points={[
        [GND_X - 30, BUS_Y + 36],
        [GND_X + 30, BUS_Y + 36],
      ]}
      stroke={LINE}
      lineWidth={3}
      lineCap={'round'}
      end={0}
    />,
  );
  view.add(
    <Line
      points={[
        [GND_X - 20, BUS_Y + 46],
        [GND_X + 20, BUS_Y + 46],
      ]}
      stroke={LINE}
      lineWidth={2.5}
      lineCap={'round'}
      opacity={0.75}
    />,
  );
  view.add(
    <Line
      points={[
        [GND_X - 10, BUS_Y + 56],
        [GND_X + 10, BUS_Y + 56],
      ]}
      stroke={LINE}
      lineWidth={2}
      lineCap={'round'}
      opacity={0.55}
    />,
  );

  // 引脚字母标注（对齐各引脚中心，入场完成后再依次显现）
  view.add(
    <Txt
      ref={tagB}
      text={'B'}
      fontFamily={'Consolas, Menlo, monospace'}
      fontSize={22}
      fontWeight={700}
      fill={PAPER}
      x={PIN_B.x}
      y={PIN_B.y + 24}
      opacity={0}
      scale={0.8}
    />,
  );
  view.add(
    <Txt
      ref={tagC}
      text={'C'}
      fontFamily={'Consolas, Menlo, monospace'}
      fontSize={22}
      fontWeight={700}
      fill={PAPER}
      x={PIN_C.x}
      y={PIN_C.y + 24}
      opacity={0}
      scale={0.8}
    />,
  );
  view.add(
    <Txt
      ref={tagE}
      text={'E'}
      fontFamily={'Consolas, Menlo, monospace'}
      fontSize={22}
      fontWeight={700}
      fill={PAPER}
      x={PIN_E.x}
      y={PIN_E.y + 24}
      opacity={0}
      scale={0.8}
    />,
  );

  // 0/1
  view.add(
    <Rect
      ref={bitBox}
      layout
      x={320}
      y={-80}
      padding={[14, 28]}
      fill={DEEP}
      stroke={LINE}
      lineWidth={2}
      radius={10}
      opacity={0}
      scale={0.9}
    >
      <Txt
        ref={bitTxt}
        text={'0'}
        fontFamily={'Consolas, Menlo, monospace'}
        fontSize={48}
        fontWeight={700}
        fill={PAPER}
      />
    </Rect>,
  );
  view.add(
    <Txt
      ref={stateTxt}
      text={'数字位'}
      fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
      fontSize={18}
      fill={PAPER}
      x={320}
      y={-20}
      opacity={0}
    />,
  );

  // —— 入场 ——
  yield* all(
    title().show(0.4),
    device().opacity(1, 0.5, easeOutCubic),
    device().scale(1, 0.55, easeOutCubic),
  );
  yield* all(
    collectorWire().end(1, 0.5, easeInOutCubic),
    baseWire().end(1, 0.55, easeInOutCubic),
    emitterWire().end(1, 0.5, easeInOutCubic),
    gndTop().end(1, 0.35, easeInOutCubic),
    baseDot().opacity(1, 0.35, easeOutCubic),
    baseDot().scale(1, 0.35, easeOutCubic),
    lampOff().opacity(1, 0.4, easeOutCubic),
    lampOff().scale(1, 0.4, easeOutCubic),
    lampOn().scale(1, 0.4, easeOutCubic),
    baseLabel().opacity(0.95, 0.35),
    pathLabel().opacity(0.95, 0.35),
  );
  yield* all(
    bitBox().opacity(1, 0.35, easeOutCubic),
    bitBox().scale(1, 0.4, easeOutCubic),
    stateTxt().opacity(0.95, 0.3),
  );
  yield* waitFor(0.35);

  // 引脚字母依次出现：基极 B → 集电极 C → 发射极 E
  yield* all(tagB().opacity(1, 0.3, easeOutCubic), tagB().scale(1, 0.3, easeOutCubic));
  yield* waitFor(0.2);
  yield* all(tagC().opacity(1, 0.3, easeOutCubic), tagC().scale(1, 0.3, easeOutCubic));
  yield* waitFor(0.2);
  yield* all(tagE().opacity(1, 0.3, easeOutCubic), tagE().scale(1, 0.3, easeOutCubic));
  yield* waitFor(0.45);

  // 全部显现后依次高亮：B → C → E，每个间隔 1 秒
  const pinTags = [tagB, tagC, tagE];
  for (let i = 0; i < pinTags.length; i++) {
    if (i > 0) {
      const prev = pinTags[i - 1];
      yield* all(
        prev().fill(PAPER, 0.25, easeOutCubic),
        prev().scale(1, 0.25, easeOutCubic),
      );
    }
    const cur = pinTags[i];
    yield* all(
      cur().fill(ACCENT, 0.3, easeOutCubic),
      cur().scale(1.35, 0.3, easeOutCubic),
    );
    yield* waitFor(1);
  }
  // 收束：最后一脚回到常态
  yield* all(
    tagE().fill(PAPER, 0.3, easeOutCubic),
    tagE().scale(1, 0.3, easeOutCubic),
  );
  yield* waitFor(0.25);

  const switchRefs = {
    baseDot,
    baseWire,
    collectorWire,
    lampOn,
    lampOff,
    lampGlow,
    pathLabel,
    bitBox,
    bitTxt,
  };

  yield* setSwitch(true, switchRefs);
  yield* waitFor(0.7);
  yield* setSwitch(false, switchRefs);
  yield* waitFor(0.55);
  yield* setSwitch(true, switchRefs);
  yield* waitFor(0.8);

  // 顶层追问
  const question = createRef<Question>();
  view.add(
    <Question
      ref={question}
      text={'那么仅凭 0 和 1 这两个数字能实现计算吗？'}
      top={-440}
      zIndex={100}
    />,
  );
  yield* question().ask();
  yield* waitFor(1.0);
});

function* setSwitch(
  on: boolean,
  refs: {
    baseDot: ReturnType<typeof createRef<Circle>>;
    baseWire: ReturnType<typeof createRef<Line>>;
    collectorWire: ReturnType<typeof createRef<Line>>;
    lampOn: ReturnType<typeof createRef<Img>>;
    lampOff: ReturnType<typeof createRef<Img>>;
    lampGlow: ReturnType<typeof createRef<Circle>>;
    pathLabel: ReturnType<typeof createRef<Txt>>;
    bitBox: ReturnType<typeof createRef<Rect>>;
    bitTxt: ReturnType<typeof createRef<Txt>>;
  },
) {
  const signal = on ? ACCENT : OFF;
  const path = on ? ACCENT : OFF;

  yield* all(
    refs.baseDot().fill(signal, 0.35, easeOutCubic),
    refs.baseDot().stroke(on ? ACCENT : LINE, 0.35),
    refs.baseWire().stroke(signal, 0.4, easeInOutCubic),
  );
  yield* waitFor(0.12);
  yield* all(
    refs.collectorWire().stroke(path, 0.4, easeInOutCubic),
    refs.lampOn().opacity(on ? 1 : 0, 0.35, easeOutCubic),
    refs.lampOff().opacity(on ? 0 : 1, 0.35, easeOutCubic),
    refs.lampGlow().opacity(on ? 0.22 : 0, 0.4, easeOutCubic),
    refs.pathLabel().text(on ? '通路：通' : '通路：断', 0.25),
    refs.pathLabel().fill(PAPER, 0.25),
    refs.bitTxt().text(on ? '1' : '0', 0.25),
    refs.bitTxt().fill(on ? ACCENT : PAPER, 0.35),
    refs.bitBox().stroke(on ? ACCENT : LINE, 0.35),
  );
}
