import {Img, Latex, Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
import flagIt from '../assets/flags/it.svg';
import flagNl from '../assets/flags/nl.svg';
import flagPt from '../assets/flags/pt.svg';
import flagSe from '../assets/flags/se.svg';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
/**
 * 暗色主题同色系热力（亮青 → 雾蓝 → 深底）：
 * 数值越小越亮，越大越沉进背景，对比清晰且不跳出整体调性。
 */
const HEAT_NEAR = '#5af0dc';
const HEAT_MID = '#3d6f9c';
const HEAT_FAR = '#152030';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

type LangDoc = {
  code: string;
  label: string;
  rawBytes: number;
  gzipBytes: number;
  ratio: number;
  flag: string;
};

/**
 * 语料顺序与交叉矩阵行列一致：
 * eng,fra,deu_1996,ita,spa,por_PT,por_BR,nld,swe,fin,dan,cmn_hans
 */
const LANG_DOCS: LangDoc[] = [
  {
    code: 'eng',
    label: 'English',
    rawBytes: 12329,
    gzipBytes: 3862,
    ratio: 0.3132,
    flag: flagGb,
  },
  {
    code: 'fra',
    label: 'French',
    rawBytes: 14133,
    gzipBytes: 4571,
    ratio: 0.3234,
    flag: flagFr,
  },
  {
    code: 'deu_1996',
    label: 'German (1996)',
    rawBytes: 13795,
    gzipBytes: 4559,
    ratio: 0.3305,
    flag: flagDe,
  },
  {
    code: 'ita',
    label: 'Italian',
    rawBytes: 14419,
    gzipBytes: 4588,
    ratio: 0.3182,
    flag: flagIt,
  },
  {
    code: 'spa',
    label: 'Spanish',
    rawBytes: 13774,
    gzipBytes: 4317,
    ratio: 0.3134,
    flag: flagEs,
  },
  {
    code: 'por_PT',
    label: 'Portuguese (PT)',
    rawBytes: 13431,
    gzipBytes: 4361,
    ratio: 0.3247,
    flag: flagPt,
  },
  {
    code: 'por_BR',
    label: 'Portuguese (BR)',
    rawBytes: 12627,
    gzipBytes: 4153,
    ratio: 0.3289,
    flag: flagBr,
  },
  {
    code: 'nld',
    label: 'Dutch',
    rawBytes: 14440,
    gzipBytes: 4502,
    ratio: 0.3118,
    flag: flagNl,
  },
  {
    code: 'swe',
    label: 'Swedish',
    rawBytes: 13917,
    gzipBytes: 4654,
    ratio: 0.3344,
    flag: flagSe,
  },
  {
    code: 'fin',
    label: 'Finnish',
    rawBytes: 14445,
    gzipBytes: 4833,
    ratio: 0.3346,
    flag: flagFi,
  },
  {
    code: 'dan',
    label: 'Danish',
    rawBytes: 13948,
    gzipBytes: 4623,
    ratio: 0.3314,
    flag: flagDk,
  },
  {
    code: 'cmn_hans',
    label: 'Chinese (Simplified)',
    rawBytes: 10422,
    gzipBytes: 4200,
    ratio: 0.4030,
    flag: flagCn,
  },
];

/**
 * 交叉压缩结果矩阵（行=A，列=x）。
 * 数值越小，两种语言交叉压缩后越「近」。
 */
const CROSS_MATRIX: number[][] = [
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

/** 三行排布：4 + 4 + 4 */
const COLS = 4;
const DOC_SIZE = 72;
const ZIP_SIZE = 72;
/** 文档列宽度（图标与字大致占位） */
const DOC_COL_W = 96;
const FLAG_W = 34;
const FLAG_H = 22;
const CELL_W = 300;
const CELL_H = 200;
const GAP_X = 28;
const GAP_Y = 36;
const ARROW_W = 48;
/** 压缩包列展开目标宽度（图标 + 下方字） */
const ZIP_COL_W = 96;

/** 交叉验证矩阵：单元格宽高 / 表头国旗 */
const M_CELL_W = 72;
const M_CELL_H = 56;
const M_FLAG_W = 44;
const M_FLAG_H = 28;

/** 左侧列表最终锚点 */
const LIST_X = -640;
const LIST_Y = 24;
const LIST_GAP = 12;
function formatBytes(n: number): string {
  return n.toLocaleString('en-US') + ' B';
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpColor(a: string, b: string, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return (
    '#' +
    [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('')
  );
}

/** 按矩阵数值映射背景色：越小越亮青，越大越深暗 */
function heatColor(value: number, minV: number, maxV: number): string {
  if (maxV <= minV) return HEAT_MID;
  // 轻微提亮中低段，拉开观感差距
  const t = Math.pow((value - minV) / (maxV - minV), 0.8);
  if (t < 0.5) return lerpColor(HEAT_NEAR, HEAT_MID, t * 2);
  return lerpColor(HEAT_MID, HEAT_FAR, (t - 0.5) * 2);
}

function matrixExtent(matrix: number[][]): {min: number; max: number} {
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const v = matrix[r][c];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return {min, max};
}

/**
 * Language Trees and Zipping：
 * 文档入场 → 全体同时：文档 → 箭头 → 压缩包 + gzip 长度
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const cards = createRefArray<Layout>();
  const flowRows = createRefArray<Layout>();
  const docSides = createRefArray<Layout>();
  const arrowWraps = createRefArray<Layout>();
  const compressSides = createRefArray<Layout>();
  const zipImgs = createRefArray<Img>();
  const arrows = createRefArray<Line>();
  const grid = createRef<Layout>();
  const listPanel = createRef<Layout>();
  const listRows = createRefArray<Layout>();
  const listFlags = createRefArray<Img>();
  const flyItems = createRefArray<Layout>();
  const deltaRoot = createRef<Layout>();
  const slotA = createRef<Layout>();
  const slotX = createRef<Layout>();
  const matrixRoot = createRef<Layout>();
  const matrixFrame = createRef<Rect>();
  const matrixCells = createRefArray<Rect>();
  const matrixTxts = createRefArray<Txt>();
  const matrixHeaderRow = createRef<Layout>();
  const matrixBodyRows = createRefArray<Layout>();

  const {min: crossMin, max: crossMax} = matrixExtent(CROSS_MATRIX);
  const rows = Math.ceil(LANG_DOCS.length / COLS);
  const gridW = COLS * CELL_W + (COLS - 1) * GAP_X;
  const gridH = rows * CELL_H + (rows - 1) * GAP_Y;

  view.add(<SceneTitle ref={title} text={'Language Trees and Zipping'} />);

  // 左侧两列汇总目标位：国旗 | 压缩长度（先占位，飞入后再显示）
  view.add(
    <Layout
      ref={listPanel}
      layout
      direction={'column'}
      gap={LIST_GAP}
      x={LIST_X}
      y={LIST_Y}
      alignItems={'start'}
      opacity={0}
    >
      {LANG_DOCS.map(doc => (
        <Layout
          ref={listRows}
          layout
          direction={'row'}
          gap={22}
          alignItems={'center'}
          opacity={0}
        >
          <Rect
            layout
            padding={2}
            radius={3}
            fill={'#0a0e14'}
            stroke={'#2a3a4c'}
            lineWidth={1.5}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Img
              ref={listFlags}
              src={doc.flag}
              width={FLAG_W}
              height={FLAG_H}
              radius={2}
            />
          </Rect>
          <Txt
            text={formatBytes(doc.gzipBytes)}
            fontFamily={MONO}
            fontSize={22}
            fontWeight={700}
            fill={ACCENT}
          />
        </Layout>
      ))}
    </Layout>,
  );

  // 飞行中的国旗 + 压缩长度（压缩包淡出后从卡片飞向左侧）
  for (const doc of LANG_DOCS) {
    view.add(
      <Layout
        ref={flyItems}
        layout
        direction={'row'}
        gap={22}
        alignItems={'center'}
        opacity={0}
        zIndex={120}
      >
        <Rect
          layout
          padding={2}
          radius={3}
          fill={'#0a0e14'}
          stroke={'#2a3a4c'}
          lineWidth={1.5}
          alignItems={'center'}
          justifyContent={'center'}
        >
          <Img src={doc.flag} width={FLAG_W} height={FLAG_H} radius={2} />
        </Rect>
        <Txt
          text={formatBytes(doc.gzipBytes)}
          fontFamily={MONO}
          fontSize={22}
          fontWeight={700}
          fill={ACCENT}
        />
      </Layout>,
    );
  }

  // 矩阵出现前：右侧公式（无边框），A_i / x_j 为国旗飞入锚点
  view.add(
    <Layout
      ref={deltaRoot}
      layout
      direction={'column'}
      gap={22}
      x={280}
      y={40}
      alignItems={'center'}
      opacity={0}
      scale={0.9}
    >
      <Txt
        text={'交叉压缩增量'}
        fontFamily={MONO}
        fontSize={22}
        fontWeight={700}
        fill={PAPER}
      />
      <Layout layout direction={'row'} gap={6} alignItems={'center'}>
        <Latex tex={['\\Delta_{ij}=L(']} fontSize={42} fill={ACCENT} />
        <Layout
          ref={slotA}
          layout
          width={52}
          height={52}
          alignItems={'center'}
          justifyContent={'center'}
        >
          <Latex tex={['A_i']} fontSize={42} fill={ACCENT} />
        </Layout>
        <Latex tex={['+']} fontSize={42} fill={ACCENT} />
        <Layout
          ref={slotX}
          layout
          width={52}
          height={52}
          alignItems={'center'}
          justifyContent={'center'}
        >
          <Latex tex={['x_j']} fontSize={42} fill={ACCENT} />
        </Layout>
        <Latex tex={[')-L(A_i)']} fontSize={42} fill={ACCENT} />
      </Layout>
    </Layout>,
  );

  // 右侧交叉验证矩阵：横纵表头均为国旗（初始隐藏）
  view.add(
    <Layout
      ref={matrixRoot}
      layout
      direction={'column'}
      gap={10}
      x={300}
      y={16}
      alignItems={'center'}
      opacity={0}
      scale={0.94}
    >
      <Txt
        text={'交叉压缩距离'}
        fontFamily={MONO}
        fontSize={24}
        fontWeight={700}
        fill={PAPER}
      />
      <Rect
        ref={matrixFrame}
        layout
        direction={'column'}
        radius={10}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        clip
      >
        {/* 顶行：角标 + 横向国旗 */}
        <Layout
          ref={matrixHeaderRow}
          layout
          direction={'row'}
          opacity={0}
        >
          <Rect
            width={M_CELL_W}
            height={M_CELL_H}
            fill={CARD}
            stroke={LINE}
            lineWidth={1}
          />
          {LANG_DOCS.map(doc => (
            <Rect
              layout
              width={M_CELL_W}
              height={M_CELL_H}
              fill={CARD}
              stroke={LINE}
              lineWidth={1}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Img
                src={doc.flag}
                width={M_FLAG_W}
                height={M_FLAG_H}
                radius={2}
              />
            </Rect>
          ))}
        </Layout>

        {/* 数据行：纵向国旗 + N×N 空格（待填交叉结果） */}
        {LANG_DOCS.map((rowDoc, ri) => (
          <Layout ref={matrixBodyRows} layout direction={'row'} opacity={0}>
            <Rect
              layout
              width={M_CELL_W}
              height={M_CELL_H}
              fill={CARD}
              stroke={LINE}
              lineWidth={1}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Img
                src={rowDoc.flag}
                width={M_FLAG_W}
                height={M_FLAG_H}
                radius={2}
              />
            </Rect>
            {LANG_DOCS.map((_, ci) => {
              const value = CROSS_MATRIX[ri][ci];
              const t =
                crossMax > crossMin
                  ? (value - crossMin) / (crossMax - crossMin)
                  : 0.5;
              // 亮青底用深字，中深蓝/深底用浅字
              const textFill = t < 0.35 ? BG : PAPER;
              return (
                <Rect
                  ref={matrixCells}
                  layout
                  width={M_CELL_W}
                  height={M_CELL_H}
                  fill={BG}
                  stroke={LINE}
                  lineWidth={1}
                  alignItems={'center'}
                  justifyContent={'center'}
                  opacity={0}
                >
                  <Txt
                    ref={matrixTxts}
                    text={String(value)}
                    fontFamily={MONO}
                    fontSize={12}
                    fontWeight={700}
                    fill={textFill}
                    opacity={0}
                  />
                </Rect>
              );
            })}
          </Layout>
        ))}
      </Rect>
    </Layout>,
  );

  view.add(
    <Layout
      ref={grid}
      layout
      direction={'column'}
      gap={GAP_Y}
      width={gridW}
      height={gridH}
      y={40}
      alignItems={'center'}
    >
      {Array.from({length: rows}, (_, r) => {
        const start = r * COLS;
        const slice = LANG_DOCS.slice(start, start + COLS);
        return (
          <Layout
            layout
            direction={'row'}
            gap={GAP_X}
            alignItems={'center'}
            justifyContent={'center'}
          >
            {slice.map(doc => (
              <Layout
                ref={cards}
                layout
                direction={'column'}
                gap={10}
                width={CELL_W}
                alignItems={'center'}
                justifyContent={'center'}
                opacity={0}
                scale={0.85}
              >
                {/* 国旗：整卡水平居中 */}
                <Rect
                  layout
                  padding={2}
                  radius={3}
                  fill={'#0a0e14'}
                  stroke={'#2a3a4c'}
                  lineWidth={1.5}
                  alignItems={'center'}
                  justifyContent={'center'}
                >
                  <Img
                    src={doc.flag}
                    width={FLAG_W}
                    height={FLAG_H}
                    radius={2}
                  />
                </Rect>

                {/*
                  流程行：justify center。
                  箭头/压缩包初始 width=0，故文档与国旗垂直对齐；
                  展开宽度时整组实时保持居中。
                */}
                <Layout
                  ref={flowRows}
                  layout
                  direction={'row'}
                  gap={0}
                  alignItems={'center'}
                  justifyContent={'center'}
                >
                  <Layout
                    ref={docSides}
                    layout
                    direction={'column'}
                    gap={8}
                    width={DOC_COL_W}
                    alignItems={'center'}
                    clip
                  >
                    <Img src={docIcon} width={DOC_SIZE} height={DOC_SIZE} />
                    <Txt
                      text={formatBytes(doc.rawBytes)}
                      fontFamily={MONO}
                      fontSize={15}
                      fontWeight={600}
                      fill={PAPER}
                    />
                  </Layout>

                  <Layout
                    ref={arrowWraps}
                    layout
                    width={0}
                    height={DOC_SIZE}
                    alignItems={'center'}
                    justifyContent={'center'}
                    clip
                  >
                    <Line
                      ref={arrows}
                      points={[
                        [-ARROW_W / 2, 0],
                        [ARROW_W / 2, 0],
                      ]}
                      stroke={ACCENT}
                      lineWidth={3}
                      lineCap={'round'}
                      endArrow
                      arrowSize={12}
                      end={0}
                      opacity={0}
                    />
                  </Layout>

                  <Layout
                    ref={compressSides}
                    layout
                    direction={'column'}
                    gap={8}
                    width={0}
                    alignItems={'center'}
                    justifyContent={'center'}
                    clip
                    opacity={0}
                    scale={0.9}
                  >
                    <Img
                      ref={zipImgs}
                      src={compressIcon}
                      width={ZIP_SIZE}
                      height={ZIP_SIZE}
                    />
                    <Txt
                      text={formatBytes(doc.gzipBytes)}
                      fontFamily={MONO}
                      fontSize={15}
                      fontWeight={600}
                      fill={ACCENT}
                    />
                  </Layout>
                </Layout>
              </Layout>
            ))}
          </Layout>
        );
      })}
    </Layout>,
  );

  yield* title().show();
  yield* waitFor(0.2);

  // 1) 文档入场
  yield* all(
    ...cards.map((card, i) =>
      delay(
        i * 0.05,
        all(
          card.opacity(1, 0.35, easeOutCubic),
          card.scale(1, 0.4, easeOutBack),
        ),
      ),
    ),
  );
  yield* waitFor(0.55);

  // 2) 全体同时展开：宽度增长 → 文档相对国旗实时保持整组居中
  const expandDur = 0.55;
  yield* all(
    ...flowRows.map(row => row.gap(10, expandDur, easeInOutCubic)),
    ...arrowWraps.map(wrap =>
      wrap.width(ARROW_W + 8, expandDur, easeInOutCubic),
    ),
    ...compressSides.map(side =>
      all(
        side.width(ZIP_COL_W, expandDur, easeInOutCubic),
        side.opacity(1, expandDur * 0.7, easeOutCubic),
        side.scale(1, expandDur, easeOutBack),
      ),
    ),
    ...arrows.map(arrow =>
      all(
        arrow.opacity(1, expandDur * 0.45, easeOutCubic),
        arrow.end(1, expandDur, easeInOutCubic),
      ),
    ),
  );

  yield* waitFor(0.7);

  // 3) 隐藏文档与箭头，只留国旗 + 压缩包 + gzip 长度（宽度收拢，压缩包回正中）
  const hideDur = 0.5;
  yield* all(
    ...docSides.map(side =>
      all(
        side.opacity(0, hideDur * 0.7, easeOutCubic),
        side.width(0, hideDur, easeInOutCubic),
      ),
    ),
    ...arrows.map(arrow => arrow.opacity(0, hideDur * 0.6, easeOutCubic)),
    ...arrowWraps.map(wrap => wrap.width(0, hideDur, easeInOutCubic)),
    ...flowRows.map(row => row.gap(0, hideDur, easeInOutCubic)),
  );

  yield* waitFor(0.55);

  // 4) 压缩包淡出 → 国旗+压缩长度从原位飞到左侧两列
  yield* all(...zipImgs.map(img => img.opacity(0, 0.4, easeOutCubic)));
  yield* waitFor(0.12);
  // 让左侧目标位完成布局，便于读取绝对坐标
  listPanel().opacity(0.001);
  yield;
  yield;

  const flyStarts = cards.map(c => c.absolutePosition());
  const flyEnds = listRows.map(r => r.absolutePosition());
  for (let i = 0; i < flyItems.length; i++) {
    flyItems[i].absolutePosition(flyStarts[i]);
    flyItems[i].opacity(1);
  }

  // 原卡片隐去，飞行件飞向左侧列表位（全程 scale=1，与落点字号一致，避免交接突变）
  for (const flyer of flyItems) flyer.scale(1);
  yield* all(
    ...cards.map(c => c.opacity(0, 0.25, easeOutCubic)),
    ...flyItems.map((flyer, i) =>
      delay(
        i * 0.035,
        flyer.absolutePosition(flyEnds[i], 0.7, easeInOutCubic),
      ),
    ),
  );

  // 落位：正式列表淡入接力，飞行件淡出（同尺寸交叉，无放大跳变）
  listPanel().opacity(1);
  yield* all(
    ...listRows.map(row => row.opacity(1, 0.2, easeOutCubic)),
    ...flyItems.map(flyer => flyer.opacity(0, 0.2, easeOutCubic)),
    grid().opacity(0, 0.2, easeOutCubic),
  );

  yield* waitFor(0.35);

  // 5) 右侧展示交叉压缩增量公式（无边框）
  yield* all(
    deltaRoot().opacity(1, 0.45, easeOutCubic),
    deltaRoot().scale(1, 0.5, easeOutBack),
  );
  yield* waitFor(0.45);

  // 5b) 随机 5 对语言：国旗从左侧复制飞入 A_i、x_j 后淡出
  const nLang = LANG_DOCS.length;
  const pairSet = new Set<string>();
  const pairs: [number, number][] = [];
  while (pairs.length < 5) {
    const i = Math.floor(Math.random() * nLang);
    let j = Math.floor(Math.random() * nLang);
    while (j === i) j = Math.floor(Math.random() * nLang);
    const key = `${i}-${j}`;
    if (pairSet.has(key)) continue;
    pairSet.add(key);
    pairs.push([i, j]);
  }

  for (const [i, j] of pairs) {
    const flyA = createRef<Img>();
    const flyX = createRef<Img>();
    const startA = listFlags[i].absolutePosition();
    const startX = listFlags[j].absolutePosition();
    const endA = slotA().absolutePosition();
    const endX = slotX().absolutePosition();

    view.add(
      <Img
        ref={flyA}
        src={LANG_DOCS[i].flag}
        width={FLAG_W}
        height={FLAG_H}
        radius={2}
        zIndex={130}
        opacity={0}
      />,
    );
    view.add(
      <Img
        ref={flyX}
        src={LANG_DOCS[j].flag}
        width={FLAG_W}
        height={FLAG_H}
        radius={2}
        zIndex={130}
        opacity={0}
      />,
    );
    flyA().absolutePosition(startA);
    flyX().absolutePosition(startX);

    yield* all(
      listFlags[i].scale(1.15, 0.15, easeOutCubic),
      listFlags[j].scale(1.15, 0.15, easeOutCubic),
      flyA().opacity(1, 0.12, easeOutCubic),
      flyX().opacity(1, 0.12, easeOutCubic),
    );

    yield* all(
      flyA().absolutePosition(endA, 0.55, easeInOutCubic),
      flyX().absolutePosition(endX, 0.55, easeInOutCubic),
      listFlags[i].scale(1, 0.4, easeOutCubic),
      listFlags[j].scale(1, 0.4, easeOutCubic),
      slotA().scale(1.12, 0.55, easeOutBack),
      slotX().scale(1.12, 0.55, easeOutBack),
    );

    yield* all(
      flyA().opacity(0, 0.28, easeOutCubic),
      flyX().opacity(0, 0.28, easeOutCubic),
      flyA().scale(0.85, 0.28, easeOutCubic),
      flyX().scale(0.85, 0.28, easeOutCubic),
      slotA().scale(1, 0.28, easeOutCubic),
      slotX().scale(1, 0.28, easeOutCubic),
    );

    flyA().remove();
    flyX().remove();
    yield* waitFor(0.12);
  }

  yield* waitFor(0.35);

  // 公式淡出，交叉验证矩阵入场
  yield* all(
    deltaRoot().opacity(0, 0.4, easeOutCubic),
    deltaRoot().scale(0.94, 0.4, easeOutCubic),
    deltaRoot().y(20, 0.4, easeInOutCubic),
  );
  yield* waitFor(0.12);

  yield* all(
    matrixRoot().opacity(1, 0.45, easeOutCubic),
    matrixRoot().scale(1, 0.5, easeOutBack),
  );
  yield* waitFor(0.15);
  yield* matrixHeaderRow().opacity(1, 0.35, easeOutCubic);
  yield* all(
    ...matrixBodyRows.map((row, i) =>
      delay(i * 0.04, row.opacity(1, 0.28, easeOutCubic)),
    ),
  );
  yield* all(
    ...matrixCells.map((cell, i) =>
      delay(i * 0.008, cell.opacity(1, 0.22, easeOutCubic)),
    ),
  );

  // 6) 填入交叉压缩数值，并按大小上色（近=青，远=暗）
  const n = LANG_DOCS.length;
  const targetFills: string[] = [];
  for (let ri = 0; ri < n; ri++) {
    for (let ci = 0; ci < n; ci++) {
      targetFills.push(heatColor(CROSS_MATRIX[ri][ci], crossMin, crossMax));
    }
  }

  yield* waitFor(0.2);
  yield* all(
    ...matrixCells.map((cell, i) =>
      delay(
        i * 0.01,
        all(
          cell.fill(targetFills[i], 0.4, easeOutCubic),
          matrixTxts[i].opacity(1, 0.35, easeOutCubic),
        ),
      ),
    ),
  );

  yield* waitFor(0.8);

  // 7) 左侧国旗+压缩长度淡出，交叉压缩矩阵移至屏幕中央并略放大
  yield* all(
    listPanel().opacity(0, 0.55, easeOutCubic),
    listPanel().x(LIST_X - 40, 0.55, easeInOutCubic),
    matrixRoot().x(0, 0.7, easeInOutCubic),
    matrixRoot().y(10, 0.7, easeInOutCubic),
    matrixRoot().scale(1.12, 0.7, easeInOutCubic),
  );

  yield* waitFor(0.35);

  // 8) 高亮对角线（自压缩）→ 等待 1 秒 → 恢复热力原色
  const diagHighlight = '#ffe08a';
  yield* all(
    ...Array.from({length: n}, (_, i) => {
      const idx = i * n + i;
      return delay(
        i * 0.06,
        all(
          matrixCells[idx].fill(diagHighlight, 0.35, easeOutCubic),
          matrixCells[idx].stroke(ACCENT, 0.35, easeOutCubic),
          matrixCells[idx].lineWidth(2.5, 0.35, easeOutCubic),
          matrixCells[idx].scale(1.08, 0.35, easeOutBack),
          matrixTxts[idx].fill(BG, 0.35, easeOutCubic),
          matrixTxts[idx].scale(1.12, 0.35, easeOutBack),
        ),
      );
    }),
  );

  yield* waitFor(1.0);

  yield* all(
    ...Array.from({length: n}, (_, i) => {
      const idx = i * n + i;
      const value = CROSS_MATRIX[i][i];
      const t =
        crossMax > crossMin
          ? (value - crossMin) / (crossMax - crossMin)
          : 0.5;
      const textFill = t < 0.35 ? BG : PAPER;
      return delay(
        i * 0.04,
        all(
          matrixCells[idx].fill(targetFills[idx], 0.35, easeOutCubic),
          matrixCells[idx].stroke(LINE, 0.35, easeOutCubic),
          matrixCells[idx].lineWidth(1, 0.35, easeOutCubic),
          matrixCells[idx].scale(1, 0.35, easeOutCubic),
          matrixTxts[idx].fill(textFill, 0.35, easeOutCubic),
          matrixTxts[idx].scale(1, 0.35, easeOutCubic),
        ),
      );
    }),
  );

  yield* waitFor(1.0);
});
