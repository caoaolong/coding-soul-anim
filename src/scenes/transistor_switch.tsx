import {Circle, Img, Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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

/** —— 左侧：简单开关电路（simpleRoot 局部坐标） —— */
const S = {
  bulb: {x: 0, y: -90},
  topY: -60,
  botY: 130,
  leftX: -190,
  rightX: 190,
  swL: -50,
  swR: 50,
  battTop: -10,
  battBot: 70,
};

/** —— 右侧晶体管（transRoot 局部坐标，沿用原布局） —— */
const DEVICE = {x: 0, y: -120, size: 200};
const pinX = (svgX: number) =>
  DEVICE.x - DEVICE.size / 2 + (svgX / 200) * DEVICE.size;
const pinY = (svgY: number) =>
  DEVICE.y - DEVICE.size / 2 + (svgY / 200) * DEVICE.size;

const PIN_C = {x: pinX(52), y: pinY(172)};
const PIN_B = {x: pinX(100), y: pinY(172)};
const PIN_E = {x: pinX(148), y: pinY(172)};

const DROP = 56;
const BUS_Y = PIN_B.y + DROP;
const LAMP = {x: -260, y: BUS_Y};
const GND_X = 220;

export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();

  /** 左侧简单电路容器：先居中演示，后移到左侧 */
  const simpleRoot = createRef<Node>();
  /** 左上：灯泡底部 → 左竖 → 电池上沿（拐角在同一 Line 内，lineJoin 完整闭合） */
  const sLeftTop = createRef<Line>();
  /** 左下：电池下沿 → 左竖 → 开关左触点 */
  const sLeftBot = createRef<Line>();
  /** 右侧整段：灯泡底部 → 右竖 → 开关右触点 */
  const sRight = createRef<Line>();
  const sBlade = createRef<Node>();
  const sDotL = createRef<Circle>();
  const sDotR = createRef<Circle>();
  const sBulbOn = createRef<Img>();
  const sBulbOff = createRef<Img>();
  const sGlow = createRef<Circle>();
  const sBulbLabel = createRef<Txt>();
  const sSwitchLabel = createRef<Txt>();
  const sPanelLabel = createRef<Txt>();

  /** 右侧晶体管容器 */
  const transRoot = createRef<Node>();
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
  const transLabel = createRef<Txt>();

  view.add(<SceneTitle ref={title} text={'开关控制灯泡'} />);

  // ——— 左侧：简单开关 + 灯泡 ———
  view.add(
    <Node ref={simpleRoot} x={0} y={40} opacity={0} scale={0.92}>
      <Txt
        ref={sPanelLabel}
        text={'开关电路'}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={28}
        fontWeight={700}
        fill={PAPER}
        y={-195}
        opacity={0}
      />
      {/* 导线先画（3 段连续折线，拐角由 lineJoin 一次成型，无对接缝） */}
      <Line ref={sLeftTop} points={[[0, -48], [S.leftX, -48], [S.leftX, S.battTop]]} stroke={OFF} lineWidth={4} lineCap={'butt'} lineJoin={'bevel'} end={0} />
      <Line ref={sRight} points={[[0, -48], [S.rightX, -48], [S.rightX, S.botY], [S.swR, S.botY]]} stroke={OFF} lineWidth={4} lineCap={'butt'} lineJoin={'bevel'} end={0} />
      <Line ref={sLeftBot} points={[[S.leftX, S.battBot], [S.leftX, S.botY], [S.swL, S.botY]]} stroke={OFF} lineWidth={4} lineCap={'butt'} lineJoin={'bevel'} end={0} />
      {/* 灯泡盖住导线中间接头 */}
      <Circle ref={sGlow} x={S.bulb.x} y={S.bulb.y} size={130} fill={'#FFC807'} opacity={0} />
      <Img ref={sBulbOff} src={lightOff} width={90} height={90} x={S.bulb.x} y={S.bulb.y} opacity={0} scale={0.85} />
      <Img ref={sBulbOn} src={lightOn} width={90} height={90} x={S.bulb.x} y={S.bulb.y} opacity={0} scale={0.85} />
      <Txt
        ref={sBulbLabel}
        text={'灯泡：灭'}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={24}
        fill={PAPER}
        y={-8}
        opacity={0}
      />
      {/* 左侧电源（盖住左右两段导线的电池端头） */}
      <Rect x={S.leftX} y={30} width={56} height={80} fill={DEEP} stroke={LINE} lineWidth={3} radius={8} opacity={0.95} />
      <Txt text={'+'} fontFamily={'Consolas, Menlo, monospace'} fontSize={26} fontWeight={700} fill={PAPER} x={S.leftX} y={8} />
      <Txt text={'−'} fontFamily={'Consolas, Menlo, monospace'} fontSize={26} fontWeight={700} fill={PAPER} x={S.leftX} y={52} />
      <Txt text={'电源'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={20} fill={PAPER} x={S.leftX - 78} y={30} opacity={0.9} />
      {/* 刀开关：触点盖住导线端头 */}
      <Circle ref={sDotL} x={S.swL} y={S.botY} size={16} fill={OFF} stroke={LINE} lineWidth={2} opacity={0} />
      <Circle ref={sDotR} x={S.swR} y={S.botY} size={16} fill={OFF} stroke={LINE} lineWidth={2} opacity={0} />
      <Node ref={sBlade} x={S.swR} y={S.botY} rotation={-28}>
        <Line points={[[0, 0], [S.swL - S.swR, 0]]} stroke={PAPER} lineWidth={6} lineCap={'round'} />
        <Circle x={S.swL - S.swR} y={0} size={12} fill={PAPER} />
      </Node>
      <Txt
        ref={sSwitchLabel}
        text={'开关：断开'}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={24}
        fill={PAPER}
        y={188}
        opacity={0}
      />
    </Node>,
  );

  // ——— 右侧：晶体管动画（局部坐标，容器负责移到右侧） ———
  view.add(
    <Node ref={transRoot} x={440} y={20}>
      <Txt
        ref={transLabel}
        text={'BJT'}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={28}
        fontWeight={700}
        fill={PAPER}
        y={-330}
        opacity={0}
      />
      <Img ref={device} src={transistorIcon} width={DEVICE.size} height={DEVICE.size} x={DEVICE.x} y={DEVICE.y} opacity={0} scale={0.9} />
      <Line ref={collectorWire} points={[[PIN_C.x, PIN_C.y], [PIN_C.x, BUS_Y], [LAMP.x + 36, BUS_Y]]} stroke={OFF} lineWidth={3} lineCap={'round'} lineJoin={'round'} end={0} />
      <Circle ref={lampGlow} x={LAMP.x} y={LAMP.y - 8} size={110} fill={'#FFC807'} opacity={0} />
      <Img ref={lampOff} src={lightOff} width={72} height={72} x={LAMP.x} y={LAMP.y - 8} opacity={0} scale={0.85} />
      <Img ref={lampOn} src={lightOn} width={72} height={72} x={LAMP.x} y={LAMP.y - 8} opacity={0} scale={0.85} />
      <Txt ref={pathLabel} text={'通路：断'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={22} fill={PAPER} x={LAMP.x} y={LAMP.y + 58} opacity={0} />
      <Line ref={baseWire} points={[[PIN_B.x, PIN_B.y], [PIN_B.x, BUS_Y + 90], [-200, BUS_Y + 90]]} stroke={OFF} lineWidth={3} lineCap={'round'} lineJoin={'round'} end={0} />
      <Circle ref={baseDot} x={-200} y={BUS_Y + 90} size={18} fill={OFF} stroke={LINE} lineWidth={2} opacity={0} scale={0.7} />
      <Txt ref={baseLabel} text={'基极信号'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={20} fill={PAPER} x={-200} y={BUS_Y + 128} opacity={0} />
      <Line ref={emitterWire} points={[[PIN_E.x, PIN_E.y], [PIN_E.x, BUS_Y], [GND_X, BUS_Y], [GND_X, BUS_Y + 36]]} stroke={LINE} lineWidth={3} lineCap={'round'} lineJoin={'round'} end={0} opacity={0.95} />
      <Line ref={gndTop} points={[[GND_X - 30, BUS_Y + 36], [GND_X + 30, BUS_Y + 36]]} stroke={LINE} lineWidth={3} lineCap={'round'} end={0} />
      <Line points={[[GND_X - 20, BUS_Y + 46], [GND_X + 20, BUS_Y + 46]]} stroke={LINE} lineWidth={2.5} lineCap={'round'} opacity={0.75} />
      <Line points={[[GND_X - 10, BUS_Y + 56], [GND_X + 10, BUS_Y + 56]]} stroke={LINE} lineWidth={2} lineCap={'round'} opacity={0.55} />
      <Txt ref={tagB} text={'B'} fontFamily={'Consolas, Menlo, monospace'} fontSize={22} fontWeight={700} fill={PAPER} x={PIN_B.x} y={PIN_B.y + 24} opacity={0} scale={0.8} />
      <Txt ref={tagC} text={'C'} fontFamily={'Consolas, Menlo, monospace'} fontSize={22} fontWeight={700} fill={PAPER} x={PIN_C.x} y={PIN_C.y + 24} opacity={0} scale={0.8} />
      <Txt ref={tagE} text={'E'} fontFamily={'Consolas, Menlo, monospace'} fontSize={22} fontWeight={700} fill={PAPER} x={PIN_E.x} y={PIN_E.y + 24} opacity={0} scale={0.8} />
      <Rect ref={bitBox} layout x={320} y={-80} padding={[14, 28]} fill={DEEP} stroke={LINE} lineWidth={2} radius={10} opacity={0} scale={0.9}>
        <Txt ref={bitTxt} text={'0'} fontFamily={'Consolas, Menlo, monospace'} fontSize={48} fontWeight={700} fill={PAPER} />
      </Rect>
      <Txt ref={stateTxt} text={'数字位'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={18} fill={PAPER} x={320} y={-20} opacity={0} />
    </Node>,
  );

  // ═══ 第一幕：简单开关电路（居中） ═══
  yield* title().show(0.4);
  yield* all(
    simpleRoot().opacity(1, 0.5, easeOutCubic),
    simpleRoot().scale(1, 0.55, easeOutCubic),
  );
  yield* all(
    sLeftTop().end(1, 0.5, easeInOutCubic),
    sRight().end(1, 0.6, easeInOutCubic),
    sLeftBot().end(1, 0.4, easeInOutCubic),
    sDotL().opacity(1, 0.3, easeOutCubic),
    sDotR().opacity(1, 0.3, easeOutCubic),
    sBulbOff().opacity(1, 0.4, easeOutCubic),
    sBulbOff().scale(1, 0.4, easeOutCubic),
    sBulbOn().scale(1, 0.4, easeOutCubic),
    sBulbLabel().opacity(0.95, 0.3),
    sSwitchLabel().opacity(0.95, 0.3),
    sPanelLabel().opacity(0.95, 0.3),
  );
  yield* waitFor(0.4);

  const simpleRefs = {sLeftTop, sLeftBot, sRight, sBlade, sDotL, sDotR, sBulbOn, sBulbOff, sGlow, sBulbLabel, sSwitchLabel};

  // 开关断开 → 灯灭（初始已是断开，停顿展示）
  yield* waitFor(0.6);
  // 开关闭合 → 灯亮
  yield* setSimple(true, simpleRefs);
  yield* waitFor(0.9);
  // 开关断开 → 灯灭
  yield* setSimple(false, simpleRefs);
  yield* waitFor(0.7);

  // ═══ 第二幕：左移，为晶体管腾出右侧 ═══
  yield* all(
    simpleRoot().x(-500, 0.8, easeInOutCubic),
    simpleRoot().scale(0.92, 0.8, easeInOutCubic),
    title().setText('晶体管 = 开关', 0.3),
  );
  yield* waitFor(0.2);

  // ═══ 第三幕：右侧晶体管动画（原流程） ═══
  yield* all(
    transLabel().opacity(0.95, 0.4, easeOutCubic),
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

  yield* all(tagB().opacity(1, 0.3, easeOutCubic), tagB().scale(1, 0.3, easeOutCubic));
  yield* waitFor(0.2);
  yield* all(tagC().opacity(1, 0.3, easeOutCubic), tagC().scale(1, 0.3, easeOutCubic));
  yield* waitFor(0.2);
  yield* all(tagE().opacity(1, 0.3, easeOutCubic), tagE().scale(1, 0.3, easeOutCubic));
  yield* waitFor(0.45);

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
  yield* all(
    tagE().fill(PAPER, 0.3, easeOutCubic),
    tagE().scale(1, 0.3, easeOutCubic),
  );
  yield* waitFor(0.25);

  const switchRefs = {baseDot, baseWire, collectorWire, lampOn, lampOff, lampGlow, pathLabel, bitBox, bitTxt};

  yield* setSwitch(true, switchRefs);
  yield* waitFor(0.7);
  yield* setSwitch(false, switchRefs);
  yield* waitFor(0.55);
  yield* setSwitch(true, switchRefs);
  yield* waitFor(0.8);

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

type SimpleRefs = {
  sLeftTop: ReturnType<typeof createRef<Line>>;
  sLeftBot: ReturnType<typeof createRef<Line>>;
  sRight: ReturnType<typeof createRef<Line>>;
  sBlade: ReturnType<typeof createRef<Node>>;
  sDotL: ReturnType<typeof createRef<Circle>>;
  sDotR: ReturnType<typeof createRef<Circle>>;
  sBulbOn: ReturnType<typeof createRef<Img>>;
  sBulbOff: ReturnType<typeof createRef<Img>>;
  sGlow: ReturnType<typeof createRef<Circle>>;
  sBulbLabel: ReturnType<typeof createRef<Txt>>;
  sSwitchLabel: ReturnType<typeof createRef<Txt>>;
};

/** 简单开关：闭合灯亮 / 断开灯灭 */
function* setSimple(on: boolean, refs: SimpleRefs) {
  const wire = on ? ACCENT : OFF;
  yield* all(
    refs.sBlade().rotation(on ? 0 : -28, 0.4, easeInOutCubic),
    refs.sLeftTop().stroke(wire, 0.35, easeInOutCubic),
    refs.sLeftBot().stroke(wire, 0.35, easeInOutCubic),
    refs.sRight().stroke(wire, 0.35, easeInOutCubic),
    refs.sDotL().fill(on ? ACCENT : OFF, 0.3),
    refs.sDotR().fill(on ? ACCENT : OFF, 0.3),
  );
  yield* waitFor(0.1);
  yield* all(
    refs.sBulbOn().opacity(on ? 1 : 0, 0.35, easeOutCubic),
    refs.sBulbOff().opacity(on ? 0 : 1, 0.35, easeOutCubic),
    refs.sGlow().opacity(on ? 0.22 : 0, 0.4, easeOutCubic),
    refs.sBulbLabel().text(on ? '灯泡：亮' : '灯泡：灭', 0.2),
    refs.sBulbLabel().fill(on ? ACCENT : PAPER, 0.3),
    refs.sSwitchLabel().text(on ? '开关：闭合 ✓' : '开关：断开', 0.2),
    refs.sSwitchLabel().fill(on ? ACCENT : PAPER, 0.3),
  );
}

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
