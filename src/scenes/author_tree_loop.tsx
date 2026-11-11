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
import {LanguageGraph3D} from '../components/language/language_graph_3d';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const MUTED = '#6a7a8c';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';
const SCREEN_H = 1080;

/** 第一屏：文件经 ZIP 后按作者分类的循环次数 */
const CLASSIFY_ROUNDS = 5;

type Category = {
  label: string;
  initial: string;
  color: string;
};

/** 分类槽（代表作者）——循环时每次落入不同槽 */
const CATEGORIES: Category[] = [
  {label: 'Dante', initial: 'DA', color: '#3dd6c6'},
  {label: 'Manzoni', initial: 'MA', color: '#a3e635'},
  {label: 'Pirandello', initial: 'PI', color: '#ffb454'},
  {label: 'Calvino', initial: 'CA', color: '#7aa2ff'},
  {label: 'Eco', initial: 'EC', color: '#fb7185'},
  {label: 'Verga', initial: 'VE', color: '#fbbf24'},
];

type AuthorNode = {
  code: string;
  label: string;
  initial: string;
  color: string;
};

/**
 * 意大利文学作者集合（示意，贴近 Language Trees and Zipping 作者识别叙事）。
 * 顺序对应下方 CROSS_MATRIX。
 */
const AUTHORS: AuthorNode[] = [
  {code: 'dante', label: 'Dante', initial: 'DA', color: '#3dd6c6'},
  {code: 'boccaccio', label: 'Boccaccio', initial: 'BO', color: '#2dd4bf'},
  {code: 'petrarca', label: 'Petrarca', initial: 'PE', color: '#67e8f9'},
  {code: 'manzoni', label: 'Manzoni', initial: 'MA', color: '#a3e635'},
  {code: 'verga', label: 'Verga', initial: 'VE', color: '#fbbf24'},
  {code: 'pirandello', label: 'Pirandello', initial: 'PI', color: '#ffb454'},
  {code: 'svevo', label: 'Svevo', initial: 'SV', color: '#f472b6'},
  {code: 'calvino', label: 'Calvino', initial: 'CA', color: '#7aa2ff'},
  {code: 'eco', label: 'Eco', initial: 'EC', color: '#fb7185'},
  {code: 'moravia', label: 'Moravia', initial: 'MO', color: '#c084fc'},
];

/**
 * 交叉压缩距离矩阵（越小越相似；对角为自压缩）。
 * 同流派 / 同时代更近，跨世纪更远——用于力导向布局示意。
 */
const CROSS_MATRIX: number[][] = [
  // Dante Bocc Petr Manz Verg Pira Svev Calv Eco  Mora
  [160, 2480, 2620, 4120, 4280, 4360, 4480, 4620, 4700, 4560], // Dante
  [2520, 168, 2740, 4200, 4320, 4400, 4520, 4660, 4740, 4600], // Boccaccio
  [2680, 2800, 172, 4240, 4360, 4440, 4560, 4680, 4760, 4620], // Petrarca
  [4180, 4260, 4300, 158, 3180, 3420, 3680, 4020, 4100, 2860], // Manzoni
  [4300, 4380, 4420, 3240, 164, 2380, 3120, 3980, 4060, 3480], // Verga
  [4380, 4460, 4500, 3480, 2440, 170, 2560, 3720, 3840, 3320], // Pirandello
  [4500, 4580, 4620, 3720, 3180, 2620, 166, 3480, 3620, 3040], // Svevo
  [4660, 4720, 4760, 4080, 4020, 3780, 3520, 155, 2280, 3380], // Calvino
  [4740, 4800, 4840, 4160, 4100, 3900, 3660, 2340, 162, 3460], // Eco
  [4600, 4660, 4700, 2920, 3540, 3380, 3100, 3440, 3520, 159], // Moravia
];

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
 * 循环场景（镜像 languageTreeLoop，对象改为作者）：
 * 1) 文章 → ZIP → 分到不同作者类别（次数可配置）
 * 2) 上滚进入论文结果：作者节点相似度图（近=相似，远=不相似）
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
  const catLabels = createRefArray<Txt>();

  const graph3d = createRef<LanguageGraph3D>();

  const targets = pickDistinctTargets(CATEGORIES.length, CLASSIFY_ROUNDS);
  const {pos, raw, maxRaw, minRaw} = computeLayout(CROSS_MATRIX);
  const rawSpan = Math.max(maxRaw - minRaw, 1);

  type Edge = {i: number; j: number; d: number; sim: number};
  const edges: Edge[] = [];
  for (let i = 0; i < AUTHORS.length; i++) {
    for (let j = i + 1; j < AUTHORS.length; j++) {
      const d = raw[i][j];
      const sim = 1 - (d - minRaw) / rawSpan;
      edges.push({i, j, d, sim});
    }
  }
  edges.sort((a, b) => b.sim - a.sim);

  // 高相似度作者簇：3D 相机推近聚焦
  const FOCUS_CLUSTERS = [
    {indices: [0, 1, 2], title: 'Dante · Boccaccio · Petrarca'},
    {indices: [4, 5], title: 'Verga · Pirandello'},
    {indices: [7, 8], title: 'Calvino · Eco'},
    {indices: [3, 9], title: 'Manzoni · Moravia'},
    {indices: [5, 6], title: 'Pirandello · Svevo'},
  ];

  view.add(
    <Node ref={pages}>
      <Node ref={screen0} />
      <Node ref={screen1} y={SCREEN_H} />
    </Node>,
  );

  // ════════ 第一屏：ZIP 作者分类循环 ════════
  screen0().add(<SceneTitle ref={title0} text={'压缩 · 作者分类'} />);

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

  // 类别带：底部作者分类槽（缩写圆标 + 姓名）
  const catCount = CATEGORIES.length;
  const catGap = 168;
  const catStartX = -((catCount - 1) * catGap) / 2;
  CATEGORIES.forEach((cat, i) => {
    const x = catStartX + i * catGap;
    screen0().add(
      <Rect
        ref={catBoxes}
        width={148}
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
          <Rect
            width={48}
            height={48}
            radius={24}
            fill={'#0e141c'}
            stroke={cat.color}
            lineWidth={2}
            layout
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              text={cat.initial}
              fontFamily={MONO}
              fontSize={16}
              fontWeight={700}
              fill={cat.color}
            />
          </Rect>
          <Txt
            ref={catLabels}
            text={cat.label}
            fontFamily={MONO}
            fontSize={14}
            fontWeight={700}
            fill={MUTED}
            textAlign={'center'}
          />
        </Layout>
      </Rect>,
    );
  });

  // ════════ 第二屏：3D 作者相似度图 ════════
  screen1().add(
    <SceneTitle ref={title1} text={'Language Trees and Zipping'} />,
  );
  screen1().add(
    <LanguageGraph3D
      ref={graph3d}
      langs={AUTHORS.map(a => ({
        label: a.label,
        initial: a.initial,
        color: a.color,
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

  yield* all(
    zipImg().opacity(1, 0.35, easeOutCubic),
    zipImg().scale(1, 0.4, easeOutBack),
  );
  yield* waitFor(0.15);

  for (let round = 0; round < CLASSIFY_ROUNDS; round++) {
    const target = targets[round];
    const catX = catStartX + target * catGap;
    const catY = CAT_Y;

    docImg().position(new Vector2(0, DOC_Y));
    docImg().opacity(0);
    docImg().scale(0.85);

    zipFlyer().position(new Vector2(0, ZIP_Y));
    zipFlyer().opacity(0);
    zipFlyer().scale(0.6);

    yield* all(
      docImg().opacity(1, 0.3, easeOutCubic),
      docImg().scale(1, 0.35, easeOutBack),
    );
    yield* waitFor(0.12);

    yield* all(
      docImg().position(new Vector2(0, ZIP_Y), 0.5, easeInOutCubic),
      docImg().scale(0.35, 0.5, easeInOutCubic),
      docImg().opacity(0, 0.45, easeOutCubic),
      zipImg().scale(1.18, 0.25, easeOutBack).to(1, 0.25),
    );
    yield* waitFor(0.08);

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

    yield* all(
      catBoxes[target].stroke(LINE, 0.3, easeOutCubic),
      catBoxes[target].lineWidth(2, 0.3, easeOutCubic),
      catBoxes[target].scale(1, 0.3, easeOutCubic),
      catLabels[target].fill(MUTED, 0.3, easeOutCubic),
    );
    yield* waitFor(0.15);
  }

  yield* waitFor(0.4);

  // ════════ 上滚进入 3D 作者相似度图 ════════
  yield* pages().y(-SCREEN_H, 1.0, easeInOutCubic);
  yield* waitFor(0.15);
  yield* title1().show();
  yield* waitFor(0.15);
  yield* graph3d().play();
});
