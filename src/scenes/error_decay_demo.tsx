import {Latex, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutCubic, waitFor} from '@motion-canvas/core';
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
/**
 * 四次递进放大的 x 区间左端（右端始终到 MAX_BITS）。
 * 逐步收紧到尾部，看清指数衰减细节。
 */
const ZOOM_FROM = [8, 16, 24, 28] as const;
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

/** 区间内两条曲线的共同 y 上界（含留白） */
function yMaxInRange(
  errorPts: GraphPoint[],
  boundPts: GraphPoint[],
  x0: number,
  x1: number,
  pad = 1.25,
): number {
  let m = 0;
  for (const p of errorPts) {
    if (p.x >= x0 && p.x <= x1) m = Math.max(m, p.y);
  }
  for (const p of boundPts) {
    if (p.x >= x0 && p.x <= x1) m = Math.max(m, p.y);
  }
  return Math.max(m * pad, 1e-6);
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
  const legend = createRef<Latex>();

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

  view.add(<SceneTitle ref={title} text={'精度丢失 · 误差随位数衰减'} />);
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
    <Latex
      ref={legend}
      tex={[`\\text{虚线: 上界 }${BASE}^{-n}/2\\quad\\text{实线: 实际误差 }E(n)`]}
      fill={MUTED}
      fontSize={24}
      y={-430}
      opacity={0}
    />,
  );

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
  yield* waitFor(0.2);
  yield* graph().showAxes(0.6);
  yield* waitFor(0.25);

  yield* all(
    caption().opacity(1, 0.4, easeOutCubic),
    legend().opacity(1, 0.4, easeOutCubic),
  );
  yield* waitFor(0.35);

  // 先画上界（虚线），再画实际误差并点亮采样点
  yield* graph().drawSeries('bound', 1.2);
  yield* waitFor(0.25);
  yield* graph().drawSeries('error', 1.6);
  yield* waitFor(0.15);
  yield* graph().showDots('error', 0.035);
  yield* waitFor(0.6);

  // 四次递进放大：每次收紧到更靠后的位数区间，Y 取双曲线共同值域
  for (let i = 0; i < ZOOM_FROM.length; i++) {
    const x0 = ZOOM_FROM[i];
    const x1 = MAX_BITS;
    const zoomY = yMaxInRange(errorPts, boundPts, x0, x1);
    yield* graph().zoomIntoX(x0, x1, {
      yMin: 0,
      yMax: zoomY,
      duration: 1.35,
    });
    yield* waitFor(i === ZOOM_FROM.length - 1 ? 1.5 : 0.55);
  }
});
