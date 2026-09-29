import {Circle, Img, Latex, Line, Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

import transistorIcon from '../assets/transistor.svg';
import lightOn from '../assets/light_light.svg';
import lightOff from '../assets/light_dark.svg';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const LINE = '#2a3a4c';
const OFF = '#3a4555';
const MUTED = '#8a9bb0';

const COL = [-580, 0, 580];

/**
 * 三列同屏：非门 | 与门 | 或门，逐列显现
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<Txt>();
  view.add(
    <Txt
      ref={title}
      text={'基础门电路'}
      fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
      fontSize={40}
      fontWeight={700}
      fill={PAPER}
      y={-480}
      opacity={0}
    />,
  );

  const colNot = createRef<Node>();
  const colAnd = createRef<Node>();
  const colOr = createRef<Node>();
  view.add(<Node ref={colNot} x={COL[0]} opacity={0} />);
  view.add(<Node ref={colAnd} x={COL[1]} opacity={0} />);
  view.add(<Node ref={colOr} x={COL[2]} opacity={0} />);

  const notGate = buildNot(colNot());
  const andGate = buildAnd(colAnd());
  const orGate = buildOr(colOr());

  yield* title().opacity(1, 0.4, easeOutCubic);

  // 左列：非门
  yield* colNot().opacity(1, 0.35, easeOutCubic);
  yield* notGate.reveal();
  yield* notGate.demo();
  yield* waitFor(0.35);

  // 中列：与门
  yield* colAnd().opacity(1, 0.35, easeOutCubic);
  yield* andGate.reveal();
  yield* andGate.demo();
  yield* waitFor(0.35);

  // 右列：或门
  yield* colOr().opacity(1, 0.35, easeOutCubic);
  yield* orGate.reveal();
  yield* orGate.demo();
  yield* waitFor(1.2);
});

function pinOf(x: number, y: number, size: number, which: 'C' | 'B' | 'E') {
  const py = y + size * 0.36;
  if (which === 'C') return {x: x - size * 0.24, y: py};
  if (which === 'E') return {x: x + size * 0.24, y: py};
  return {x, y: py};
}

function addPinLabels(
  host: Node,
  pins: {C: {x: number; y: number}; B: {x: number; y: number}; E: {x: number; y: number}},
  dy = 18,
) {
  const tagC = createRef<Txt>();
  const tagB = createRef<Txt>();
  const tagE = createRef<Txt>();
  host.add(
    <>
      <Txt ref={tagC} text={'C'} x={pins.C.x} y={pins.C.y + dy} fontFamily={'Consolas, Menlo, monospace'} fontSize={16} fontWeight={700} fill={PAPER} opacity={0} scale={0.85} />
      <Txt ref={tagB} text={'B'} x={pins.B.x} y={pins.B.y + dy} fontFamily={'Consolas, Menlo, monospace'} fontSize={16} fontWeight={700} fill={PAPER} opacity={0} scale={0.85} />
      <Txt ref={tagE} text={'E'} x={pins.E.x} y={pins.E.y + dy} fontFamily={'Consolas, Menlo, monospace'} fontSize={16} fontWeight={700} fill={PAPER} opacity={0} scale={0.85} />
    </>,
  );
  return {tagC, tagB, tagE};
}

function* revealPins(tags: ReturnType<typeof addPinLabels>): ThreadGenerator {
  yield* all(
    ...[tags.tagC, tags.tagB, tags.tagE].flatMap(t => [
      t().opacity(1, 0.22, easeOutCubic),
      t().scale(1, 0.22, easeOutCubic),
    ]),
  );
}

function buildNot(host: Node) {
  const size = 110;
  const qx = 40;
  const qy = -80;
  const C = pinOf(qx, qy, size, 'C');
  const B = pinOf(qx, qy, size, 'B');
  const E = pinOf(qx, qy, size, 'E');
  const busY = C.y + 44;
  const lampX = -160;

  const head = createRef<Txt>();
  const q = createRef<Img>();
  const cWire = createRef<Line>();
  const vccWire = createRef<Line>();
  const inWire = createRef<Line>();
  const gnd = createRef<Line>();
  const inDot = createRef<Circle>();
  const inLabel = createRef<Txt>();
  const lampOnImg = createRef<Img>();
  const lampOffImg = createRef<Img>();
  const vcc = createRef<Txt>();
  const yLabel = createRef<Txt>();
  const formula = createRef<Latex>();

  host.add(
    <>
      <Txt ref={head} text={'非门 NOT'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={28} fontWeight={700} fill={PAPER} y={-320} opacity={0} />
      <Img ref={q} src={transistorIcon} width={size} height={size} x={qx} y={qy} opacity={0} scale={0.9} />
      <Line ref={cWire} points={[[C.x, C.y], [C.x, busY], [lampX + 30, busY]]} stroke={OFF} lineWidth={2.5} lineCap={'round'} lineJoin={'round'} end={0} />
      <Line ref={vccWire} points={[[lampX + 30, busY], [lampX + 30, busY - 50]]} stroke={LINE} lineWidth={2.5} end={0} />
      <Txt ref={vcc} text={'Vcc'} fontFamily={'Consolas, Menlo, monospace'} fontSize={14} fill={MUTED} x={lampX + 30} y={busY - 72} opacity={0} />
      <Img ref={lampOffImg} src={lightOff} width={48} height={48} x={lampX} y={busY - 4} opacity={0} />
      <Img ref={lampOnImg} src={lightOn} width={48} height={48} x={lampX} y={busY - 4} opacity={0} />
      <Txt ref={yLabel} text={'Y'} fontFamily={'Consolas, Menlo, monospace'} fontSize={18} fill={PAPER} x={lampX} y={busY + 42} opacity={0} />
      <Line ref={inWire} points={[[B.x, B.y], [B.x, busY + 60], [-130, busY + 60]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Circle ref={inDot} x={-130} y={busY + 60} size={12} fill={OFF} opacity={0} />
      <Txt ref={inLabel} text={'A=0'} fontFamily={'Consolas, Menlo, monospace'} fontSize={16} fill={PAPER} x={-130} y={busY + 90} opacity={0} />
      <Line ref={gnd} points={[[E.x, E.y], [E.x, busY + 30], [E.x + 36, busY + 30], [E.x + 36, busY + 52]]} stroke={LINE} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Line points={[[E.x + 36 - 18, busY + 52], [E.x + 36 + 18, busY + 52]]} stroke={LINE} lineWidth={2.5} opacity={0.9} />
      <Latex ref={formula} tex={['Y = \\neg A']} fill={PAPER} fontSize={32} y={280} opacity={0} />
    </>,
  );
  const pins = addPinLabels(host, {C, B, E});

  return {
    *reveal(): ThreadGenerator {
      yield* head().opacity(1, 0.3, easeOutCubic);
      yield* all(q().opacity(1, 0.35, easeOutCubic), q().scale(1, 0.4, easeOutCubic));
      yield* revealPins(pins);
      yield* all(
        cWire().end(1, 0.4, easeInOutCubic),
        vccWire().end(1, 0.3, easeInOutCubic),
        inWire().end(1, 0.4, easeInOutCubic),
        gnd().end(1, 0.35, easeInOutCubic),
        inDot().opacity(1, 0.25),
        lampOffImg().opacity(1, 0.3),
        yLabel().opacity(1, 0.25),
        inLabel().opacity(1, 0.25),
        vcc().opacity(1, 0.25),
        formula().opacity(1, 0.35),
      );
    },
    *demo(): ThreadGenerator {
      yield* toggleInput(false, true, {inDot, inWire, path: cWire, lampOnImg, lampOffImg, inLabel, name: 'A'});
      yield* waitFor(0.45);
      yield* toggleInput(true, false, {inDot, inWire, path: cWire, lampOnImg, lampOffImg, inLabel, name: 'A'});
      yield* waitFor(0.45);
    },
  };
}

function buildAnd(host: Node) {
  const size = 88;
  const x = 50;
  const y1 = -160;
  const y2 = -20;
  const C1 = pinOf(x, y1, size, 'C');
  const B1 = pinOf(x, y1, size, 'B');
  const E1 = pinOf(x, y1, size, 'E');
  const C2 = pinOf(x, y2, size, 'C');
  const B2 = pinOf(x, y2, size, 'B');
  const E2 = pinOf(x, y2, size, 'E');
  const bus1 = C1.y + 36;
  const bus2 = C2.y + 36;
  const lampX = -150;

  const head = createRef<Txt>();
  const q1 = createRef<Img>();
  const q2 = createRef<Img>();
  const path = createRef<Line>();
  const aWire = createRef<Line>();
  const bWire = createRef<Line>();
  const aDot = createRef<Circle>();
  const bDot = createRef<Circle>();
  const aLabel = createRef<Txt>();
  const bLabel = createRef<Txt>();
  const lampOnImg = createRef<Img>();
  const lampOffImg = createRef<Img>();
  const vcc = createRef<Txt>();
  const yLabel = createRef<Txt>();
  const formula = createRef<Latex>();

  host.add(
    <>
      <Txt ref={head} text={'与门 AND'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={28} fontWeight={700} fill={PAPER} y={-320} opacity={0} />
      <Img ref={q1} src={transistorIcon} width={size} height={size} x={x} y={y1} opacity={0} scale={0.9} />
      <Img ref={q2} src={transistorIcon} width={size} height={size} x={x} y={y2} opacity={0} scale={0.9} />
      <Line
        ref={path}
        points={[
          [lampX + 28, bus1 - 48],
          [lampX + 28, bus1],
          [C1.x, bus1],
          [C1.x, C1.y],
          [E1.x, E1.y],
          [E1.x, (E1.y + C2.y) / 2],
          [C2.x, (E1.y + C2.y) / 2],
          [C2.x, C2.y],
          [E2.x, E2.y],
          [E2.x, bus2 + 28],
        ]}
        stroke={OFF}
        lineWidth={2.5}
        lineJoin={'round'}
        end={0}
      />
      <Txt ref={vcc} text={'Vcc'} fontFamily={'Consolas, Menlo, monospace'} fontSize={14} fill={MUTED} x={lampX + 28} y={bus1 - 70} opacity={0} />
      <Line points={[[E2.x - 16, bus2 + 28], [E2.x + 16, bus2 + 28]]} stroke={LINE} lineWidth={2.5} opacity={0.9} />
      <Img ref={lampOffImg} src={lightOff} width={48} height={48} x={lampX} y={bus1 - 4} opacity={0} />
      <Img ref={lampOnImg} src={lightOn} width={48} height={48} x={lampX} y={bus1 - 4} opacity={0} />
      <Txt ref={yLabel} text={'Y'} fontFamily={'Consolas, Menlo, monospace'} fontSize={18} fill={PAPER} x={lampX} y={bus1 + 42} opacity={0} />
      <Line ref={aWire} points={[[B1.x, B1.y], [B1.x, bus1 + 28], [-120, bus1 + 28]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Circle ref={aDot} x={-120} y={bus1 + 28} size={12} fill={OFF} opacity={0} />
      <Txt ref={aLabel} text={'A=0'} fontFamily={'Consolas, Menlo, monospace'} fontSize={15} fill={PAPER} x={-120} y={bus1 + 54} opacity={0} />
      <Line ref={bWire} points={[[B2.x, B2.y], [B2.x, bus2 + 16], [-120, bus2 + 16]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Circle ref={bDot} x={-120} y={bus2 + 16} size={12} fill={OFF} opacity={0} />
      <Txt ref={bLabel} text={'B=0'} fontFamily={'Consolas, Menlo, monospace'} fontSize={15} fill={PAPER} x={-120} y={bus2 + 42} opacity={0} />
      <Latex ref={formula} tex={['Y = A \\cdot B']} fill={PAPER} fontSize={32} y={280} opacity={0} />
    </>,
  );
  const pins1 = addPinLabels(host, {C: C1, B: B1, E: E1}, 16);
  const pins2 = addPinLabels(host, {C: C2, B: B2, E: E2}, 16);

  return {
    *reveal(): ThreadGenerator {
      yield* head().opacity(1, 0.3, easeOutCubic);
      yield* all(
        q1().opacity(1, 0.3, easeOutCubic),
        q1().scale(1, 0.35, easeOutCubic),
        delay(0.1, q2().opacity(1, 0.3, easeOutCubic)),
        delay(0.1, q2().scale(1, 0.35, easeOutCubic)),
      );
      yield* all(revealPins(pins1), revealPins(pins2));
      yield* all(
        path().end(1, 0.55, easeInOutCubic),
        aWire().end(1, 0.35, easeInOutCubic),
        bWire().end(1, 0.35, easeInOutCubic),
        aDot().opacity(1, 0.25),
        bDot().opacity(1, 0.25),
        aLabel().opacity(1, 0.25),
        bLabel().opacity(1, 0.25),
        lampOffImg().opacity(1, 0.3),
        yLabel().opacity(1, 0.25),
        vcc().opacity(1, 0.25),
        formula().opacity(1, 0.35),
      );
    },
    *demo(): ThreadGenerator {
      yield* toggleDual(true, false, false, {aDot, bDot, aWire, bWire, paths: [path], lampOnImg, lampOffImg, aLabel, bLabel});
      yield* waitFor(0.4);
      yield* toggleDual(true, true, true, {aDot, bDot, aWire, bWire, paths: [path], lampOnImg, lampOffImg, aLabel, bLabel});
      yield* waitFor(0.45);
    },
  };
}

function buildOr(host: Node) {
  const size = 88;
  const y = -60;
  const x1 = -30;
  const x2 = 90;
  const C1 = pinOf(x1, y, size, 'C');
  const B1 = pinOf(x1, y, size, 'B');
  const E1 = pinOf(x1, y, size, 'E');
  const C2 = pinOf(x2, y, size, 'C');
  const B2 = pinOf(x2, y, size, 'B');
  const E2 = pinOf(x2, y, size, 'E');
  const busY = C1.y + 40;
  const gndY = busY + 40;
  const lampX = -170;

  const head = createRef<Txt>();
  const q1 = createRef<Img>();
  const q2 = createRef<Img>();
  const rail = createRef<Line>();
  const leg1 = createRef<Line>();
  const leg2 = createRef<Line>();
  const gnd = createRef<Line>();
  const aWire = createRef<Line>();
  const bWire = createRef<Line>();
  const aDot = createRef<Circle>();
  const bDot = createRef<Circle>();
  const aLabel = createRef<Txt>();
  const bLabel = createRef<Txt>();
  const lampOnImg = createRef<Img>();
  const lampOffImg = createRef<Img>();
  const vcc = createRef<Txt>();
  const yLabel = createRef<Txt>();
  const formula = createRef<Latex>();

  host.add(
    <>
      <Txt ref={head} text={'或门 OR'} fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'} fontSize={28} fontWeight={700} fill={PAPER} y={-320} opacity={0} />
      <Img ref={q1} src={transistorIcon} width={size} height={size} x={x1} y={y} opacity={0} scale={0.9} />
      <Img ref={q2} src={transistorIcon} width={size} height={size} x={x2} y={y} opacity={0} scale={0.9} />
      <Line ref={rail} points={[[lampX + 28, busY - 48], [lampX + 28, busY], [C2.x, busY]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Line ref={leg1} points={[[C1.x, busY], [C1.x, C1.y], [E1.x, E1.y], [E1.x, gndY]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Line ref={leg2} points={[[C2.x, busY], [C2.x, C2.y], [E2.x, E2.y], [E2.x, gndY]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Line ref={gnd} points={[[E1.x - 14, gndY], [E2.x + 14, gndY]]} stroke={LINE} lineWidth={2.5} end={0} />
      <Txt ref={vcc} text={'Vcc'} fontFamily={'Consolas, Menlo, monospace'} fontSize={14} fill={MUTED} x={lampX + 28} y={busY - 70} opacity={0} />
      <Img ref={lampOffImg} src={lightOff} width={48} height={48} x={lampX} y={busY - 4} opacity={0} />
      <Img ref={lampOnImg} src={lightOn} width={48} height={48} x={lampX} y={busY - 4} opacity={0} />
      <Txt ref={yLabel} text={'Y'} fontFamily={'Consolas, Menlo, monospace'} fontSize={18} fill={PAPER} x={lampX} y={busY + 42} opacity={0} />
      <Line ref={aWire} points={[[B1.x, B1.y], [B1.x, busY + 55], [-140, busY + 55]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Circle ref={aDot} x={-140} y={busY + 55} size={12} fill={OFF} opacity={0} />
      <Txt ref={aLabel} text={'A=0'} fontFamily={'Consolas, Menlo, monospace'} fontSize={15} fill={PAPER} x={-140} y={busY + 82} opacity={0} />
      <Line ref={bWire} points={[[B2.x, B2.y], [B2.x, busY + 55], [B2.x + 55, busY + 55]]} stroke={OFF} lineWidth={2.5} lineJoin={'round'} end={0} />
      <Circle ref={bDot} x={B2.x + 55} y={busY + 55} size={12} fill={OFF} opacity={0} />
      <Txt ref={bLabel} text={'B=0'} fontFamily={'Consolas, Menlo, monospace'} fontSize={15} fill={PAPER} x={B2.x + 55} y={busY + 82} opacity={0} />
      <Latex ref={formula} tex={['Y = A + B']} fill={PAPER} fontSize={32} y={280} opacity={0} />
    </>,
  );
  const pins1 = addPinLabels(host, {C: C1, B: B1, E: E1}, 16);
  const pins2 = addPinLabels(host, {C: C2, B: B2, E: E2}, 16);

  return {
    *reveal(): ThreadGenerator {
      yield* head().opacity(1, 0.3, easeOutCubic);
      yield* all(
        q1().opacity(1, 0.3, easeOutCubic),
        q1().scale(1, 0.35, easeOutCubic),
        delay(0.1, q2().opacity(1, 0.3, easeOutCubic)),
        delay(0.1, q2().scale(1, 0.35, easeOutCubic)),
      );
      yield* all(revealPins(pins1), revealPins(pins2));
      yield* all(
        rail().end(1, 0.4, easeInOutCubic),
        leg1().end(1, 0.4, easeInOutCubic),
        leg2().end(1, 0.4, easeInOutCubic),
        gnd().end(1, 0.3, easeInOutCubic),
        aWire().end(1, 0.35, easeInOutCubic),
        bWire().end(1, 0.35, easeInOutCubic),
        aDot().opacity(1, 0.25),
        bDot().opacity(1, 0.25),
        aLabel().opacity(1, 0.25),
        bLabel().opacity(1, 0.25),
        lampOffImg().opacity(1, 0.3),
        yLabel().opacity(1, 0.25),
        vcc().opacity(1, 0.25),
        formula().opacity(1, 0.35),
      );
    },
    *demo(): ThreadGenerator {
      yield* toggleDual(true, false, true, {aDot, bDot, aWire, bWire, paths: [rail, leg1, leg2], lampOnImg, lampOffImg, aLabel, bLabel});
      yield* waitFor(0.4);
      yield* toggleDual(false, false, false, {aDot, bDot, aWire, bWire, paths: [rail, leg1, leg2], lampOnImg, lampOffImg, aLabel, bLabel});
      yield* waitFor(0.45);
    },
  };
}

function* toggleInput(
  aOn: boolean,
  yOn: boolean,
  refs: {
    inDot: ReturnType<typeof createRef<Circle>>;
    inWire: ReturnType<typeof createRef<Line>>;
    path: ReturnType<typeof createRef<Line>>;
    lampOnImg: ReturnType<typeof createRef<Img>>;
    lampOffImg: ReturnType<typeof createRef<Img>>;
    inLabel: ReturnType<typeof createRef<Txt>>;
    name: string;
  },
): ThreadGenerator {
  yield* all(
    refs.inDot().fill(aOn ? ACCENT : OFF, 0.25),
    refs.inWire().stroke(aOn ? ACCENT : OFF, 0.3),
    refs.inLabel().text(`${refs.name}=${aOn ? 1 : 0}`, 0.15),
  );
  yield* waitFor(0.08);
  yield* all(
    refs.path().stroke(yOn ? ACCENT : OFF, 0.3),
    refs.lampOnImg().opacity(yOn ? 1 : 0, 0.25),
    refs.lampOffImg().opacity(yOn ? 0 : 1, 0.25),
  );
}

function* toggleDual(
  aOn: boolean,
  bOn: boolean,
  yOn: boolean,
  refs: {
    aDot: ReturnType<typeof createRef<Circle>>;
    bDot: ReturnType<typeof createRef<Circle>>;
    aWire: ReturnType<typeof createRef<Line>>;
    bWire: ReturnType<typeof createRef<Line>>;
    paths: ReturnType<typeof createRef<Line>>[];
    lampOnImg: ReturnType<typeof createRef<Img>>;
    lampOffImg: ReturnType<typeof createRef<Img>>;
    aLabel: ReturnType<typeof createRef<Txt>>;
    bLabel: ReturnType<typeof createRef<Txt>>;
  },
): ThreadGenerator {
  yield* all(
    refs.aDot().fill(aOn ? ACCENT : OFF, 0.25),
    refs.bDot().fill(bOn ? ACCENT : OFF, 0.25),
    refs.aWire().stroke(aOn ? ACCENT : OFF, 0.3),
    refs.bWire().stroke(bOn ? ACCENT : OFF, 0.3),
    refs.aLabel().text(`A=${aOn ? 1 : 0}`, 0.15),
    refs.bLabel().text(`B=${bOn ? 1 : 0}`, 0.15),
  );
  yield* waitFor(0.08);
  const color = yOn ? ACCENT : OFF;
  yield* all(
    ...refs.paths.map(p => p().stroke(color, 0.3)),
    refs.lampOnImg().opacity(yOn ? 1 : 0, 0.25),
    refs.lampOffImg().opacity(yOn ? 0 : 1, 0.25),
  );
}
