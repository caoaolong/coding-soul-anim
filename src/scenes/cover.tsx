import {Circle, Grid, Layout, Line, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

/** 每集只改这一处副标；可用 \\n 换行 */
const EPISODE_TITLE = '浮点数\n为什么会丢失精度？';

/** 系列通用封面：抽象节点网络 + 系列主标题 */
export default makeScene2D(function* (view) {
  const bg = '#0a0e14';
  const paper = '#e8eef7';
  const muted = '#5a6a7e';
  const accent = '#3dd6c6';
  const line = '#1c2836';
  const edge = '#2a3a4c';

  view.fill(bg);

  const grid = createRef<Grid>();
  const hero = createRef<Layout>();
  const seriesTitle = createRef<Txt>();
  const episodeBlock = createRef<Layout>();
  const accentLine = createRef<Line>();
  const nodes = createRefArray<Circle>();
  const edges = createRefArray<Line>();

  const episodeLines = EPISODE_TITLE.replace(/\r\n/g, '\n')
    .replace(/^\n+|\n+$/g, '')
    .split('\n')
    .map(line => line.trim());

  view.add(
    <Grid
      ref={grid}
      width={'100%'}
      height={'100%'}
      stroke={line}
      lineWidth={1}
      spacing={72}
      start={0}
      end={0}
      opacity={0.45}
    />,
  );

  // 背景抽象图：节点坐标（避开中心标题区）
  const nodePos: [number, number][] = [
    [-480, -260],
    [-300, -180],
    [-520, 40],
    [-340, 120],
    [460, -220],
    [320, -100],
    [500, 80],
    [360, 200],
    [-200, 260],
    [180, -280],
  ];

  const edgePairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [1, 3],
    [4, 5],
    [5, 6],
    [6, 7],
    [5, 7],
    [3, 8],
    [4, 9],
    [9, 5],
  ];

  for (const [a, b] of edgePairs) {
    const [x1, y1] = nodePos[a];
    const [x2, y2] = nodePos[b];
    view.add(
      <Line
        ref={edges}
        points={[
          [x1, y1],
          [x2, y2],
        ]}
        stroke={edge}
        lineWidth={1.5}
        lineCap={'round'}
        end={0}
        opacity={0.85}
      />,
    );
  }

  for (const [x, y] of nodePos) {
    view.add(
      <Circle
        ref={nodes}
        x={x}
        y={y}
        size={10}
        fill={bg}
        stroke={accent}
        lineWidth={1.5}
        opacity={0}
        scale={0.6}
      />,
    );
  }

  // 系列名 + 本集标题纵向排布，换行时不会互相遮盖
  view.add(
    <Layout
      ref={hero}
      layout
      direction={'column'}
      alignItems={'center'}
      gap={28}
      y={0}
    >
      <Txt
        ref={seriesTitle}
        text={'重铸编程之魂'}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={24}
        fontWeight={500}
        fill={muted}
        letterSpacing={8}
        opacity={0}
      />
      <Layout
        ref={episodeBlock}
        layout
        direction={'column'}
        alignItems={'center'}
        gap={12}
        opacity={0}
        scale={0.94}
      >
        {episodeLines.map(line => (
          <Txt
            text={line.length > 0 ? line : ' '}
            fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
            fontSize={96}
            fontWeight={700}
            fill={paper}
            letterSpacing={16}
          />
        ))}
      </Layout>
    </Layout>,
  );

  view.add(
    <Line
      ref={accentLine}
      points={[
        [-140, 120],
        [140, 120],
      ]}
      stroke={accent}
      lineWidth={2}
      lineCap={'round'}
      end={0}
      opacity={0.9}
    />,
  );

  // 网格展开
  yield* grid().end(1, 0.9, easeInOutCubic);

  // 边与节点依次显现
  yield* all(
    ...edges.map((e, i) => delay(i * 0.04, e.end(1, 0.35, easeOutCubic))),
    ...nodes.map((n, i) =>
      delay(
        0.12 + i * 0.05,
        all(n.opacity(0.9, 0.3, easeOutCubic), n.scale(1, 0.35, easeOutCubic)),
      ),
    ),
  );

  // 系列名小字先行
  yield* seriesTitle().opacity(0.9, 0.35, easeOutCubic);

  // 本集大标题入场（支持多行，始终在系列名下方）
  yield* all(
    episodeBlock().opacity(1, 0.55, easeOutCubic),
    episodeBlock().scale(1, 0.65, easeOutCubic),
  );

  // 点缀线贴在整块标题下方
  const barY = hero().y() + hero().height() / 2 + 28;
  accentLine().points([
    [-140, barY],
    [140, barY],
  ]);
  yield* accentLine().end(1, 0.4, easeInOutCubic);

  // 节点轻脉冲一轮后定格
  yield* all(
    ...nodes.map((n, i) =>
      delay(
        i * 0.05,
        n.scale(1.25, 0.2, easeOutCubic).to(1, 0.28, easeInOutCubic),
      ),
    ),
  );

  yield* waitFor(1.2);
});
