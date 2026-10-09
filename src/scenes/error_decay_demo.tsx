import {Latex, Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutCubic, waitFor} from '@motion-canvas/core';
import {FocusWord} from '../components/emphasis/focus_word';
import {FunctionGraph, GraphPoint} from '../components/graph/function_graph';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CURVE = '#7aa2ff';
const BOUND = '#f0a060';
const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';

// ───────── 可配置 ─────────
/** 目标数（非二进制有限小数，用于展示逼近误差） */
const TARGET = 0.2345;
/** 进制 */
const BASE = 2;
/** 最大位数 / 细分级数（x 轴 0…MAX_BITS） */
const MAX_BITS = 32;
// ──────────────────────────

/** 位数 n 下，最近可表示点 k·base^{-n} 与真值的绝对误差 */
function errorAtBits(value: number, base: number, n: number): number {
  const step = Math.pow(base, -n);
  const nearest = Math.round(value / step) * step;
  return Math.abs(value - nearest);
}

/** 理论上界：半个格子 base^{-n}/2 */
function errorBound(base: number, n: number): number {
  return Math.pow(base, -n) / 2;
}

/**
 * 误差随位数衰减：
 * 画出 E(n)=|x − round(x, base^{-n})| 与上界 base^{-n}/2，
 * 说明有限位只能逼近、无法精确落到非格子点上。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const graph = createRef<FunctionGraph>();
  const caption = createRef<Latex>();
  const legend = createRef<Layout>();
  const focus = createRef<FocusWord>();

  const errorPts: GraphPoint[] = [];
  const boundPts: GraphPoint[] = [];
  let yMax = 0;
  for (let n = 0; n <= MAX_BITS; n++) {
    const e = errorAtBits(TARGET, BASE, n);
    const b = errorBound(BASE, n);
    errorPts.push({x: n, y: e});
    boundPts.push({x: n, y: b});
    yMax = Math.max(yMax, e, b);
  }
  yMax *= 1.15;

  view.add(<SceneTitle ref={title} text={'逼近0.2345的误差'} />);
  view.add(
    <FunctionGraph
      ref={graph}
      plotWidth={1120}
      plotHeight={520}
      xMin={0}
      xMax={MAX_BITS}
      yMin={0}
      yMax={yMax}
      xLabel={'n'}
      yLabel={'E'}
      xTicks={9}
      yTicks={5}
      y={20}
    />,
  );
  view.add(
    <Latex
      ref={caption}
      tex={[
        `x=${TARGET}\\quad E(n)=\\left|x-\\mathrm{round}\\!(x,\\,${BASE}^{-n})\\right|`,
      ]}
      fill={PAPER}
      fontSize={28}
      y={430}
      opacity={0}
    />,
  );
  view.add(
    <Layout
      ref={legend}
      layout
      direction={'column'}
      alignItems={'start'}
      gap={8}
      x={860}
      y={-420}
      offset={[1, 0]}
      opacity={0}
    >
      <Layout layout direction={'row'} alignItems={'center'} gap={10}>
        <Rect
          width={28}
          height={10}
          radius={3}
          fill={BOUND}
          stroke={BOUND}
          lineWidth={2}
          lineDash={[6, 5]}
        />
        <Txt
          text={'上界'}
          fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
          fontSize={24}
          fill={MUTED}
        />
        <Latex tex={[`${BASE}^{-n}/2`]} fill={PAPER} fontSize={24} />
      </Layout>
      <Layout layout direction={'row'} alignItems={'center'} gap={10}>
        <Rect width={28} height={10} radius={3} fill={CURVE} />
        <Txt
          text={'实际误差'}
          fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
          fontSize={24}
          fill={MUTED}
        />
        <Latex tex={['E(n)']} fill={PAPER} fontSize={24} />
      </Layout>
    </Layout>,
  );
  view.add(<FocusWord ref={focus} text={'逐次逼近法'} />);

  graph().addSeries('bound', boundPts, {
    color: BOUND,
    lineWidth: 3,
    dashed: true,
  });
  graph().addSeries('error', errorPts, {
    color: CURVE,
    lineWidth: 4,
    showDots: true,
    dotRadius: 5,
  });

  yield* title().show();
  yield* waitFor(0.15);
  yield* graph().showAxes(0.4);
  yield* waitFor(0.12);

  yield* all(
    caption().opacity(1, 0.28, easeOutCubic),
    legend().opacity(1, 0.28, easeOutCubic),
  );
  yield* waitFor(0.15);

  // 先画上界（虚线），再画实际误差并点亮采样点
  yield* graph().drawSeries('bound', 0.45);
  yield* waitFor(0.1);
  yield* graph().drawSeries('error', 0.55);
  yield* waitFor(0.08);
  yield* graph().showDots('error', 0.012);
  yield* waitFor(0.35);
  yield* focus().play();

  // 强调词结束后：对曲线末尾连续 3 次 1/2 放大
  for (let i = 0; i < 3; i++) {
    yield* waitFor(0.2);
    yield* graph().zoomTail(0.8);
  }
  yield* waitFor(0.8);
});
