import {Img, Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

import logoAL from '../assets/LPL/AL.png';
import logoBLG from '../assets/LPL/BLG.png';
import logoIG from '../assets/LPL/IG.png';
import logoWE from '../assets/LPL/WE.png';
import logoLGD from '../assets/LPL/LGD.png';
import logoJDG from '../assets/LPL/JDG.png';
import logoTES from '../assets/LPL/TES.png';
import logoNIP from '../assets/LPL/NIP.png';
import logoTT from '../assets/LPL/TT.png';
import logoEDG from '../assets/LPL/EDG.png';
import {SceneTitle, SCENE_TITLE_X, SCENE_TITLE_Y} from '../components/title/scene_title';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const ACCENT = '#3dd6c6';
const GOLD = '#e6c35c';
const DEEP = '#121820';
const LINE = '#3a4d63';
const WIN = '#3dd6c6';
const LOSE = '#5a6570';

const CARD_W = 168;
const FINAL_W = 188;
const HW = CARD_W / 2;
const FW = FINAL_W / 2;
const EDGE = 8;
/** 卡片近似半高（含标题），用于竖向接线 */
const HH = 55;

type TeamId = 'AL' | 'BLG' | 'IG' | 'WE' | 'LGD' | 'JDG' | 'TES' | 'NIP' | 'TT' | 'EDG';

const LOGOS: Record<TeamId, string> = {
  AL: logoAL,
  BLG: logoBLG,
  IG: logoIG,
  WE: logoWE,
  LGD: logoLGD,
  JDG: logoJDG,
  TES: logoTES,
  NIP: logoNIP,
  TT: logoTT,
  EDG: logoEDG,
};

interface MatchData {
  id: string;
  label: string;
  a: TeamId;
  b: TeamId;
  scoreA: number;
  scoreB: number;
  date: string;
  final?: boolean;
}

/** 完整双败：资格赛 + 胜者组 + 败者组 + 总决赛 */
const MATCHES: MatchData[] = [
  {id: 'q1', label: '资格赛', a: 'EDG', b: 'NIP', scoreA: 0, scoreB: 3, date: '8/27'},
  {id: 'q2', label: '资格赛', a: 'TT', b: 'IG', scoreA: 0, scoreB: 3, date: '8/28'},
  {id: 'ubqf1', label: '胜者组 1/4', a: 'TES', b: 'LGD', scoreA: 2, scoreB: 3, date: '8/29'},
  {id: 'ubqf2', label: '胜者组 1/4', a: 'JDG', b: 'WE', scoreA: 1, scoreB: 3, date: '8/30'},
  {id: 'ubsf1', label: '胜者组半决', a: 'AL', b: 'LGD', scoreA: 3, scoreB: 1, date: '9/4'},
  {id: 'ubsf2', label: '胜者组半决', a: 'BLG', b: 'WE', scoreA: 3, scoreB: 1, date: '9/3'},
  {id: 'ubf', label: '胜者组决赛', a: 'AL', b: 'BLG', scoreA: 0, scoreB: 3, date: '9/7'},
  {id: 'lbr1a', label: '败者组 R1', a: 'TES', b: 'IG', scoreA: 2, scoreB: 3, date: '9/4'},
  {id: 'lbr1b', label: '败者组 R1', a: 'JDG', b: 'NIP', scoreA: 0, scoreB: 3, date: '9/5'},
  {id: 'lbr2a', label: '败者组 R2', a: 'WE', b: 'IG', scoreA: 1, scoreB: 3, date: '9/5'},
  {id: 'lbr2b', label: '败者组 R2', a: 'LGD', b: 'NIP', scoreA: 3, scoreB: 2, date: '9/6'},
  {id: 'lbr3', label: '败者组 R3', a: 'IG', b: 'LGD', scoreA: 3, scoreB: 0, date: '9/8'},
  {id: 'lbf', label: '败者组决赛', a: 'AL', b: 'IG', scoreA: 3, scoreB: 2, date: '9/12'},
  {id: 'gf', label: '总决赛', a: 'AL', b: 'BLG', scoreA: 3, scoreB: 1, date: '9/13', final: true},
];

/** 原始相对坐标（随后整体平移居中） */
const RAW_POS: Record<string, {x: number; y: number}> = {
  q1: {x: -860, y: 40},
  q2: {x: -860, y: 200},
  ubqf1: {x: -560, y: -320},
  ubqf2: {x: -560, y: -160},
  ubsf1: {x: -260, y: -320},
  ubsf2: {x: -260, y: -160},
  ubf: {x: 40, y: -240},
  lbr1a: {x: -560, y: 40},
  lbr1b: {x: -560, y: 200},
  lbr2a: {x: -260, y: 40},
  lbr2b: {x: -260, y: 200},
  lbr3: {x: 40, y: 120},
  lbf: {x: 340, y: 120},
  gf: {x: 340, y: -240},
};

const RAW_TAGS: {text: string; x: number; y: number}[] = [
  {text: '资格赛', x: -860, y: -40},
  {text: '胜者组', x: -560, y: -400},
  {text: '败者组', x: -560, y: -40},
  {text: '总决赛', x: 340, y: -360},
];

// 按卡片包围盒居中到画布原点
const _xs = Object.values(RAW_POS).map(p => p.x);
const _ys = Object.values(RAW_POS).map(p => p.y);
const OX = -((_xs.reduce((a, b) => Math.min(a, b), Infinity) - HW +
  (_xs.reduce((a, b) => Math.max(a, b), -Infinity) + FW)) /
  2);
const OY = -((_ys.reduce((a, b) => Math.min(a, b), Infinity) - HH +
  (_ys.reduce((a, b) => Math.max(a, b), -Infinity) + HH)) /
  2);

const POS: Record<string, {x: number; y: number}> = Object.fromEntries(
  Object.entries(RAW_POS).map(([id, p]) => [id, {x: p.x + OX, y: p.y + OY}]),
);
const TAGS = RAW_TAGS.map(t => ({...t, x: t.x + OX, y: t.y + OY}));


function halfOf(id: string) {
  return id === 'gf' ? FW : HW;
}
function outR(id: string) {
  return POS[id].x + halfOf(id) + EDGE;
}
function inL(id: string) {
  return POS[id].x - halfOf(id) - EDGE;
}
function cy(id: string) {
  return POS[id].y;
}
function topY(id: string) {
  return POS[id].y - HH;
}
function botY(id: string) {
  return POS[id].y + HH;
}

export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const subtitle = createRef<Txt>();
  const tags = createRefArray<Txt>();
  const wires = createRefArray<Line>();
  const cards: Layout[] = [];
  const champ = createRef<Txt>();

  view.add(<SceneTitle ref={title} text={'2026 LPL 第三赛段 · 淘汰赛'} />);
  view.add(
    <Txt
      ref={subtitle}
      text={'完整双败对阵'}
      fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
      fontSize={20}
      fill={ACCENT}
      x={SCENE_TITLE_X}
      y={SCENE_TITLE_Y + 42}
      offset={[-1, 0]}
      textAlign={'left'}
      opacity={0}
    />,
  );

  for (const s of TAGS) {
    view.add(
      <Txt
        ref={tags}
        text={s.text}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={18}
        fill={MUTED}
        x={s.x}
        y={s.y}
        opacity={0}
      />,
    );
  }

  const stemUBSF = (outR('ubsf1') + inL('ubf')) / 2;
  const stemUBF = (outR('ubf') + inL('gf')) / 2;
  const stemLBR2 = (outR('lbr2a') + inL('lbr3')) / 2;
  const stemQ = (outR('q1') + inL('lbr1a')) / 2;

  const wireDefs: [number, number][][] = [
    // 资格赛 → 败者组 R1（NIP→lbr1b，IG→lbr1a）
    [
      [outR('q1'), cy('q1')],
      [stemQ, cy('q1')],
      [stemQ, cy('lbr1b')],
      [inL('lbr1b'), cy('lbr1b')],
    ],
    [
      [outR('q2'), cy('q2')],
      [stemQ, cy('q2')],
      [stemQ, cy('lbr1a')],
      [inL('lbr1a'), cy('lbr1a')],
    ],
    // 胜者组
    [
      [outR('ubqf1'), cy('ubqf1')],
      [inL('ubsf1'), cy('ubsf1')],
    ],
    [
      [outR('ubqf2'), cy('ubqf2')],
      [inL('ubsf2'), cy('ubsf2')],
    ],
    [
      [outR('ubsf1'), cy('ubsf1')],
      [stemUBSF, cy('ubsf1')],
      [stemUBSF, cy('ubf')],
      [inL('ubf'), cy('ubf')],
    ],
    [
      [outR('ubsf2'), cy('ubsf2')],
      [stemUBSF, cy('ubsf2')],
      [stemUBSF, cy('ubf')],
      [inL('ubf'), cy('ubf')],
    ],
    [
      [outR('ubf'), cy('ubf')],
      [stemUBF, cy('ubf')],
      [stemUBF, cy('gf')],
      [inL('gf'), cy('gf')],
    ],
    // 败者组
    [
      [outR('lbr1a'), cy('lbr1a')],
      [inL('lbr2a'), cy('lbr2a')],
    ],
    [
      [outR('lbr1b'), cy('lbr1b')],
      [inL('lbr2b'), cy('lbr2b')],
    ],
    [
      [outR('lbr2a'), cy('lbr2a')],
      [stemLBR2, cy('lbr2a')],
      [stemLBR2, cy('lbr3')],
      [inL('lbr3'), cy('lbr3')],
    ],
    [
      [outR('lbr2b'), cy('lbr2b')],
      [stemLBR2, cy('lbr2b')],
      [stemLBR2, cy('lbr3')],
      [inL('lbr3'), cy('lbr3')],
    ],
    [
      [outR('lbr3'), cy('lbr3')],
      [inL('lbf'), cy('lbf')],
    ],
    // 败者组决赛 ↑ 总决赛（同列竖线）
    [
      [POS.lbf.x, topY('lbf')],
      [POS.gf.x, botY('gf')],
    ],
  ];

  for (const pts of wireDefs) {
    view.add(
      <Line
        ref={wires}
        points={pts}
        stroke={LINE}
        lineWidth={2}
        lineCap={'square'}
        lineJoin={'miter'}
        end={0}
        opacity={0.88}
      />,
    );
  }

  for (const m of MATCHES) {
    const card = buildMatchCard(m);
    card.position(POS[m.id]);
    card.opacity(0);
    card.scale(0.92);
    view.add(card);
    cards.push(card);
  }

  view.add(
    <Txt
      ref={champ}
      text={'冠军 AL'}
      fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
      fontSize={26}
      fontWeight={700}
      fill={GOLD}
      x={POS.gf.x}
      y={POS.gf.y - 120}
      opacity={0}
    />,
  );

  yield* all(
    title().show(0.35),
    delay(0.08, subtitle().opacity(1, 0.3, easeOutCubic)),
  );
  yield* all(...tags.map((t, i) => delay(i * 0.05, t.opacity(0.95, 0.25))));

  // 卡片与折线交错点亮
  for (let i = 0; i < cards.length; i++) {
    yield* all(
      cards[i].opacity(1, 0.26, easeOutCubic),
      cards[i].scale(1, 0.3, easeOutCubic),
    );
    if (i < wires.length) {
      yield* wires[i].end(1, 0.26, easeInOutCubic);
    }
    yield* waitFor(0.04);
  }
  for (let i = cards.length; i < wires.length; i++) {
    yield* wires[i].end(1, 0.25, easeInOutCubic);
  }

  yield* champ().opacity(1, 0.4, easeOutCubic);
  yield* waitFor(1.5);
});

function buildMatchCard(m: MatchData): Layout {
  const aWin = m.scoreA > m.scoreB;
  const border = m.final ? GOLD : LINE;
  const width = m.final ? FINAL_W : CARD_W;

  return (
    <Layout layout direction={'column'} gap={3} alignItems={'center'}>
      <Txt
        text={m.label}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={11}
        fill={m.final ? GOLD : MUTED}
      />
      <Rect
        layout
        direction={'column'}
        gap={3}
        padding={[6, 8]}
        fill={DEEP}
        stroke={border}
        lineWidth={m.final ? 2.5 : 1.5}
        radius={8}
        width={width}
      >
        <Layout layout direction={'row'} gap={4} alignItems={'center'} justifyContent={'space-between'} width={'100%'}>
          <Layout layout direction={'row'} gap={4} alignItems={'center'}>
            <Img src={LOGOS[m.a]} width={22} height={22} />
            <Txt text={m.a} fontFamily={'Consolas, Menlo, monospace'} fontSize={14} fontWeight={700} fill={aWin ? WIN : LOSE} />
          </Layout>
          <Txt text={`${m.scoreA}`} fontFamily={'Consolas, Menlo, monospace'} fontSize={15} fontWeight={700} fill={aWin ? WIN : LOSE} />
        </Layout>
        <Layout layout direction={'row'} gap={4} alignItems={'center'} justifyContent={'space-between'} width={'100%'}>
          <Layout layout direction={'row'} gap={4} alignItems={'center'}>
            <Img src={LOGOS[m.b]} width={22} height={22} />
            <Txt text={m.b} fontFamily={'Consolas, Menlo, monospace'} fontSize={14} fontWeight={700} fill={!aWin ? WIN : LOSE} />
          </Layout>
          <Txt text={`${m.scoreB}`} fontFamily={'Consolas, Menlo, monospace'} fontSize={15} fontWeight={700} fill={!aWin ? WIN : LOSE} />
        </Layout>
        <Txt text={m.date} fontFamily={'Consolas, Menlo, monospace'} fontSize={11} fill={MUTED} />
      </Rect>
    </Layout>
  ) as Layout;
}
