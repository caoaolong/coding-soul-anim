import {
  Img,
  Layout,
  Node,
  Rect,
  Txt,
  makeScene2D,
} from '@motion-canvas/2d';
import {
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import compressIcon from '../assets/icons/压缩.svg';
import docIcon from '../assets/icons/文档.svg';
import flagBr from '../assets/flags/br.svg';
import flagCn from '../assets/flags/cn.svg';
import flagDe from '../assets/flags/de.svg';
import flagDk from '../assets/flags/dk.svg';
import flagEs from '../assets/flags/es.svg';
import flagFi from '../assets/flags/fi.svg';
import flagFr from '../assets/flags/fr.svg';
import flagGb from '../assets/flags/gb.svg';
import flagGr from '../assets/flags/gr.svg';
import flagIt from '../assets/flags/it.svg';
import flagJp from '../assets/flags/jp.svg';
import flagKr from '../assets/flags/kr.svg';
import flagNl from '../assets/flags/nl.svg';
import flagNo from '../assets/flags/no.svg';
import flagPl from '../assets/flags/pl.svg';
import flagPt from '../assets/flags/pt.svg';
import flagRo from '../assets/flags/ro.svg';
import flagRu from '../assets/flags/ru.svg';
import flagSe from '../assets/flags/se.svg';
import flagUs from '../assets/flags/us.svg';
import {LanguageGraph3D} from '../components/language/language_graph_3d';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const MUTED = '#6a7a8c';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';
const SCREEN_H = 1080;

/** 第一屏：文件经 ZIP 后分类的循环次数（可配置） */
const CLASSIFY_ROUNDS = 5;

type Category = {
  label: string;
  flag: string;
  color: string;
};

/** 分类槽（语族）——循环时每次落入不同槽 */
const CATEGORIES: Category[] = [
  {label: 'English', flag: flagGb, color: '#3dd6c6'},
  {label: 'Romance', flag: flagEs, color: '#a3e635'},
  {label: 'Germanic', flag: flagDe, color: '#ffb454'},
  {label: 'Nordic', flag: flagSe, color: '#7aa2ff'},
  {label: 'Slavic', flag: flagRu, color: '#fb7185'},
  {label: 'East Asian', flag: flagCn, color: '#fbbf24'},
];

type LangNode = {
  code: string;
  label: string;
  flag: string;
  color: string;
};

/**
 * 语种集合（论文语种 + 扩展）。
 * 顺序对应下方 CROSS_MATRIX。
 */
const LANGS: LangNode[] = [
  {code: 'eng', label: 'English', flag: flagGb, color: '#3dd6c6'},
  {code: 'fra', label: 'French', flag: flagFr, color: '#7aa2ff'},
  {code: 'deu', label: 'German', flag: flagDe, color: '#ffb454'},
  {code: 'ita', label: 'Italian', flag: flagIt, color: '#f472b6'},
  {code: 'spa', label: 'Spanish', flag: flagEs, color: '#a3e635'},
  {code: 'por_PT', label: 'Port. PT', flag: flagPt, color: '#c084fc'},
  {code: 'por_BR', label: 'Port. BR', flag: flagBr, color: '#f0a060'},
  {code: 'nld', label: 'Dutch', flag: flagNl, color: '#5ec8ff'},
  {code: 'swe', label: 'Swedish', flag: flagSe, color: '#94a3b8'},
  {code: 'fin', label: 'Finnish', flag: flagFi, color: '#38bdf8'},
  {code: 'dan', label: 'Danish', flag: flagDk, color: '#fb7185'},
  {code: 'cmn', label: 'Chinese', flag: flagCn, color: '#fbbf24'},
  {code: 'eng_US', label: 'English US', flag: flagUs, color: '#2dd4bf'},
  {code: 'kor', label: 'Korean', flag: flagKr, color: '#f87171'},
  {code: 'jpn', label: 'Japanese', flag: flagJp, color: '#fda4af'},
  {code: 'rus', label: 'Russian', flag: flagRu, color: '#60a5fa'},
  {code: 'pol', label: 'Polish', flag: flagPl, color: '#e879f9'},
  {code: 'nor', label: 'Norwegian', flag: flagNo, color: '#fbbf24'},
  {code: 'ron', label: 'Romanian', flag: flagRo, color: '#a78bfa'},
  {code: 'ell', label: 'Greek', flag: flagGr, color: '#67e8f9'},
];

/**
 * 交叉压缩矩阵（越小越相似）。
 * 前 12×12 取自 Language Trees and Zipping；扩展语种按语族相近度合成。
 */
const BASE_MATRIX: number[][] = [
  [157, 4288, 4488, 4406, 4124, 4196, 4005, 4373, 4566, 4830, 4512, 4691],
  [3601, 180, 4505, 4399, 4077, 4119, 3985, 4442, 4586, 4840, 4543, 4689],
  [3798, 4533, 174, 4534, 4283, 4337, 4136, 4356, 4535, 4835, 4507, 4694],
  [3655, 4383, 4510, 179, 4036, 4134, 3937, 4409, 4593, 4843, 4548, 4724],
  [3652, 4329, 4520, 4323, 174, 3769, 3667, 4440, 4596, 4840, 4550, 4708],
  [3667, 4334, 4526, 4345, 3761, 170, 2547, 4446, 4595, 4851, 4546, 4699],
  [3689, 4399, 4540, 4378, 3826, 2729, 164, 4475, 4616, 4856, 4564, 4682],
  [3754, 4518, 4415, 4498, 4257, 4308, 4125, 181, 4545, 4823, 4497, 4709],
  [3787, 4507, 4439, 4532, 4281, 4340, 4140, 4398, 176, 4786, 4096, 4709],
  [3868, 4579, 4557, 4609, 4320, 4366, 4166, 4509, 4593, 185, 4595, 4733],
  [3760, 4522, 4459, 4530, 4257, 4325, 4122, 4381, 4176, 4806, 175, 4720],
  [4351, 5060, 5053, 5109, 4827, 4862, 4630, 5011, 5162, 5364, 5144, 133],
];

/** 扩展语种相对各语种的交叉距离（按 LANGS 顺序：自身对角用小值） */
const EXTRA_ROWS: number[][] = [
  // eng_US：极近 eng，其余贴近 eng 行
  [720, 4320, 4510, 4430, 4150, 4220, 4030, 4400, 4580, 4840, 4530, 4710, 150, 5280, 5220, 4980, 4920, 4560, 4480, 5100],
  // kor
  [5280, 5340, 5320, 5360, 5300, 5310, 5260, 5330, 5350, 5380, 5340, 4480, 5290, 140, 4120, 5200, 5180, 5360, 5300, 5250],
  // jpn
  [5220, 5300, 5280, 5320, 5260, 5270, 5220, 5290, 5310, 5340, 5300, 4560, 5230, 4180, 145, 5160, 5140, 5320, 5260, 5210],
  // rus
  [4980, 5040, 5020, 5060, 5000, 5010, 4960, 5030, 5050, 5080, 5040, 5120, 4990, 5200, 5160, 160, 2860, 5060, 5000, 4920],
  // pol
  [4920, 4980, 4960, 5000, 4940, 4950, 4900, 4970, 4990, 5020, 4980, 5080, 4930, 5180, 5140, 2940, 155, 5000, 4940, 4860],
  // nor：近 dan / swe
  [4560, 4620, 4480, 4600, 4560, 4570, 4520, 4480, 2680, 4760, 2520, 5080, 4570, 5360, 5320, 5060, 5000, 170, 4620, 5080],
  // ron：Romance 侧
  [4480, 3920, 4580, 3680, 3620, 3780, 3720, 4560, 4620, 4860, 4600, 5080, 4490, 5300, 5260, 5000, 4940, 4620, 168, 4780],
  // ell
  [5100, 4980, 5080, 4920, 4900, 4940, 4880, 5100, 5120, 5200, 5100, 5180, 5110, 5250, 5210, 4920, 4860, 5080, 4780, 162],
];

function buildCrossMatrix(): number[][] {
  const n = LANGS.length;
  const m = Array.from({length: n}, () => Array(n).fill(0));
  const baseN = BASE_MATRIX.length;
  for (let i = 0; i < baseN; i++) {
    for (let j = 0; j < baseN; j++) m[i][j] = BASE_MATRIX[i][j];
  }
  for (let e = 0; e < EXTRA_ROWS.length; e++) {
    const i = baseN + e;
    for (let j = 0; j < n; j++) {
      m[i][j] = EXTRA_ROWS[e][j];
      if (j < baseN) m[j][i] = EXTRA_ROWS[e][j];
    }
  }
  return m;
}

const CROSS_MATRIX = buildCrossMatrix();

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 生成分类目标序列：每轮类别互不相同；
 * 若轮次超过类别数，则多轮洗牌拼接，并避免相邻两轮相同。
 */
function pickDistinctTargets(count: number, rounds: number): number[] {
  const out: number[] = [];
  while (out.length < rounds) {
    const deck = shuffleInPlace([...Array(count).keys()]);
    if (out.length > 0 && deck[0] === out[out.length - 1] && deck.length > 1) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    out.push(...deck);
  }
  return out.slice(0, rounds);
}

function computeLayout(matrix: number[][]): {
  pos: {x: number; y: number}[];
  raw: number[][];
  maxRaw: number;
  minRaw: number;
} {
  const n = matrix.length;
  const raw = Array.from({length: n}, () => Array(n).fill(0));
  let maxRaw = 0;
  let minRaw = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = (matrix[i][j] + matrix[j][i]) / 2;
      raw[i][j] = raw[j][i] = d;
      if (d > maxRaw) maxRaw = d;
      if (d < minRaw) minRaw = d;
    }
  }
  const span = Math.max(maxRaw - minRaw, 1);
  // 幂次映射拉大远近差：相似→很近，不相似→很远
  const DIST_NEAR = 48;
  const DIST_FAR = 720;
  const GAMMA = 1.55;
  const ideal = Array.from({length: n}, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const t = (raw[i][j] - minRaw) / span;
      ideal[i][j] = DIST_NEAR + Math.pow(t, GAMMA) * (DIST_FAR - DIST_NEAR);
    }
  }

  const pos = Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {x: Math.cos(a) * 360, y: Math.sin(a) * 280};
  });

  for (let iter = 0; iter < 420; iter++) {
    const force = pos.map(() => ({x: 0, y: 0}));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = (dist - ideal[i][j]) * 0.085;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        force[i].x += fx;
        force[i].y += fy;
        force[j].x -= fx;
        force[j].y -= fy;
      }
      // 弱中心拉力，让远近差异更能拉开
      force[i].x -= pos[i].x * 0.006;
      force[i].y -= pos[i].y * 0.006;
    }
    for (let i = 0; i < n; i++) {
      pos[i].x += force[i].x;
      pos[i].y += force[i].y;
    }
  }

  const cx = pos.reduce((s, p) => s + p.x, 0) / n;
  const cy = pos.reduce((s, p) => s + p.y, 0) / n;
  let centered = pos.map(p => ({x: p.x - cx, y: p.y - cy}));
  // 等比缩放到画布内，同时尽量保留距离对比
  let maxR = 1;
  for (const p of centered) maxR = Math.max(maxR, Math.hypot(p.x, p.y));
  const fit = Math.min(820 / maxR, 1.15);
  centered = centered.map(p => ({x: p.x * fit, y: p.y * fit + 36}));
  return {
    pos: centered,
    raw,
    maxRaw,
    minRaw,
  };
}

/**
 * 循环场景：
 * 1) 文件 → ZIP → 随机分到不同语言类别（次数可配置）
 * 2) 上滚进入论文结果：国旗节点相似度图（近=相似，远=不相似）
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const pages = createRef<Node>();
  const screen0 = createRef<Node>();
  const screen1 = createRef<Node>();
  const title0 = createRef<SceneTitle>();
  const title1 = createRef<SceneTitle>();

  const docImg = createRef<Img>();
  const zipImg = createRef<Img>();
  /** 分类时从主压缩包「复制」出来飞向类别的小图标 */
  const zipFlyer = createRef<Img>();
  const catBoxes = createRefArray<Rect>();
  const catFlags = createRefArray<Img>();
  const catLabels = createRefArray<Txt>();

  const graph3d = createRef<LanguageGraph3D>();

  const targets = pickDistinctTargets(CATEGORIES.length, CLASSIFY_ROUNDS);
  const {pos, raw, maxRaw, minRaw} = computeLayout(CROSS_MATRIX);
  const rawSpan = Math.max(maxRaw - minRaw, 1);

  // 全连接：所有语言对都画线，相似度越高线越粗、越亮
  type Edge = {i: number; j: number; d: number; sim: number};
  const edges: Edge[] = [];
  for (let i = 0; i < LANGS.length; i++) {
    for (let j = i + 1; j < LANGS.length; j++) {
      const d = raw[i][j];
      const sim = 1 - (d - minRaw) / rawSpan;
      edges.push({i, j, d, sim});
    }
  }
  edges.sort((a, b) => b.sim - a.sim);

  // 高相似度语簇：3D 相机推近聚焦
  const FOCUS_CLUSTERS = [
    {indices: [5, 6], title: 'Port. PT · Port. BR'},
    {indices: [0, 12], title: 'English · English US'},
    {indices: [8, 10, 17], title: 'Swedish · Danish · Norwegian'},
    {indices: [15, 16], title: 'Russian · Polish'},
    {indices: [3, 4, 18], title: 'Italian · Spanish · Romanian'},
  ];

  view.add(
    <Node ref={pages}>
      <Node ref={screen0} />
      <Node ref={screen1} y={SCREEN_H} />
    </Node>,
  );

  // ════════ 第一屏：ZIP 分类循环 ════════
  screen0().add(<SceneTitle ref={title0} text={'压缩 · 语言分类'} />);

  // 文档 → 压缩包：自上而下，无箭头（整体上移，给底部字幕留空）
  const DOC_Y = -220;
  const ZIP_Y = -40;
  const CAT_Y = 180;
  screen0().add(
    <Img
      ref={docImg}
      src={docIcon}
      width={110}
      height={110}
      x={0}
      y={DOC_Y}
      opacity={0}
      scale={0.85}
    />,
  );
  screen0().add(
    <Img
      ref={zipImg}
      src={compressIcon}
      width={110}
      height={110}
      x={0}
      y={ZIP_Y}
      opacity={0}
      scale={0.85}
    />,
  );
  screen0().add(
    <Img
      ref={zipFlyer}
      src={compressIcon}
      width={64}
      height={64}
      x={0}
      y={ZIP_Y}
      opacity={0}
      scale={0.6}
      zIndex={10}
    />,
  );

  // 类别带：底部语族分类槽
  const catCount = CATEGORIES.length;
  const catGap = 168;
  const catStartX = -((catCount - 1) * catGap) / 2;
  CATEGORIES.forEach((cat, i) => {
    const x = catStartX + i * catGap;
    screen0().add(
      <Rect
        ref={catBoxes}
        width={140}
        height={130}
        radius={14}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        x={x}
        y={CAT_Y}
        opacity={0}
        scale={0.9}
      >
        <Layout layout direction={'column'} gap={8} alignItems={'center'}>
          <Img
            ref={catFlags}
            src={cat.flag}
            width={48}
            height={32}
            radius={4}
          />
          <Txt
            ref={catLabels}
            text={cat.label}
            fontFamily={MONO}
            fontSize={15}
            fontWeight={700}
            fill={MUTED}
            textAlign={'center'}
          />
        </Layout>
      </Rect>,
    );
  });

  // ════════ 第二屏：3D 相似度图 ════════
  screen1().add(
    <SceneTitle ref={title1} text={'Language Trees and Zipping'} />,
  );
  screen1().add(
    <LanguageGraph3D
      ref={graph3d}
      langs={LANGS.map(l => ({
        label: l.label,
        flag: l.flag,
        color: l.color,
      }))}
      layout={pos}
      edges={edges.map(e => ({i: e.i, j: e.j, sim: e.sim}))}
      clusters={FOCUS_CLUSTERS}
      y={-55}
    />,
  );

  // ── 动画 ──
  yield* title0().show();
  yield* waitFor(0.15);

  yield* all(
    ...catBoxes.map((box, i) =>
      delay(
        i * 0.03,
        all(
          box.opacity(1, 0.3, easeOutCubic),
          box.scale(1, 0.35, easeOutBack),
        ),
      ),
    ),
  );
  yield* waitFor(0.25);

  // 中间压缩包常驻，之后不再消失
  yield* all(
    zipImg().opacity(1, 0.35, easeOutCubic),
    zipImg().scale(1, 0.4, easeOutBack),
  );
  yield* waitFor(0.15);

  // 分类循环
  for (let round = 0; round < CLASSIFY_ROUNDS; round++) {
    const target = targets[round];
    const catX = catStartX + target * catGap;
    const catY = CAT_Y;

    // 重置文档（上→下落入主压缩包）
    docImg().position(new Vector2(0, DOC_Y));
    docImg().opacity(0);
    docImg().scale(0.85);

    // 重置飞行副本：叠在主压缩包上
    zipFlyer().position(new Vector2(0, ZIP_Y));
    zipFlyer().opacity(0);
    zipFlyer().scale(0.6);

    yield* all(
      docImg().opacity(1, 0.3, easeOutCubic),
      docImg().scale(1, 0.35, easeOutBack),
    );
    yield* waitFor(0.12);

    // 压缩过程：文档自上落入主压缩包（主图标只做缩放反馈，不消失）
    yield* all(
      docImg().position(new Vector2(0, ZIP_Y), 0.5, easeInOutCubic),
      docImg().scale(0.35, 0.5, easeInOutCubic),
      docImg().opacity(0, 0.45, easeOutCubic),
      zipImg().scale(1.18, 0.25, easeOutBack).to(1, 0.25),
    );
    yield* waitFor(0.08);

    // 复制出小压缩包，飞入目标类别
    zipFlyer().opacity(1);
    zipFlyer().scale(0.85);
    yield* all(
      zipFlyer().position(new Vector2(catX, catY), 0.55, easeInOutCubic),
      zipFlyer().scale(0.55, 0.55, easeInOutCubic),
      catBoxes[target].stroke(CATEGORIES[target].color, 0.35, easeOutCubic),
      catBoxes[target].lineWidth(3.5, 0.35, easeOutCubic),
      catBoxes[target].scale(1.12, 0.4, easeOutBack),
      catLabels[target].fill(ACCENT, 0.35, easeOutCubic),
    );

    yield* all(
      zipFlyer().opacity(0, 0.28, easeOutCubic),
      zipFlyer().scale(0.35, 0.28, easeOutCubic),
    );
    yield* waitFor(0.3);

    // 类别复位，准备下一轮（主压缩包保持可见）
    yield* all(
      catBoxes[target].stroke(LINE, 0.3, easeOutCubic),
      catBoxes[target].lineWidth(2, 0.3, easeOutCubic),
      catBoxes[target].scale(1, 0.3, easeOutCubic),
      catLabels[target].fill(MUTED, 0.3, easeOutCubic),
    );
    yield* waitFor(0.15);
  }

  yield* waitFor(0.4);

  // ════════ 上滚进入 3D 论文结果图 ════════
  yield* pages().y(-SCREEN_H, 1.0, easeInOutCubic);
  yield* waitFor(0.15);
  yield* title1().show();
  yield* waitFor(0.15);
  yield* graph3d().play();
});
