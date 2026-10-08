import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {NumberAxis} from '../components/axis/number_axis';
import {Question} from '../components/question/question';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

// ───────── 可配置 ─────────
/** 初始可见区间 */
const INIT_MIN = -10;
const INIT_MAX = 10;
const INIT_STEP = 1;

/** 要标注的数（据此自动生成逐级放大动画） */
const MARK_VALUE = 0.25;

/** 第一轮放大的细分进制 */
const SUBDIVIDE_BASE = 10;

/** 回到原点后的细分 / 第二轮进制（2 → 对半切） */
const RETURN_BASE = 2;

/**
 * 第二轮最大放大次数（精度上限）。
 * 若中途已精确落到刻度上会提前停止（如 0.25）；否则最多放大这么多次。
 */
const MAX_ZOOM_LEVELS = 8;
// ──────────────────────────

/**
 * 数轴精度演示：
 * 十进制精确查找 → 缩回 → base=2 细分 → 再按有限次数查找同一数字。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const question = createRef<Question>();
  const axis = createRef<NumberAxis>();

  view.add(<SceneTitle ref={title} text={'什么是精度'} />);
  view.add(
    <Question
      ref={question}
      text={`在数轴上找到 **${MARK_VALUE}** 这个值的准确刻度该怎么做呢？`}
    />,
  );
  view.add(
    <NumberAxis
      ref={axis}
      viewMin={INIT_MIN}
      viewMax={INIT_MAX}
      tickStep={INIT_STEP}
      axisWidth={1600}
      y={40}
    />,
  );

  // 1) 先显示标题与数轴
  yield* title().show();
  yield* waitFor(0.15);
  yield* axis().show();
  yield* waitFor(0.55);

  // 2) 再提问，然后隐藏
  yield* question().ask();
  yield* waitFor(0.5);
  yield* question().hide();
  yield* waitFor(0.3);

  // 3) 精确查找 → 缩回 → base=2 → 有限精度再查找
  yield* axis().revealValue(
    MARK_VALUE,
    SUBDIVIDE_BASE,
    RETURN_BASE,
    MAX_ZOOM_LEVELS,
  );
  yield* waitFor(1.6);
});
