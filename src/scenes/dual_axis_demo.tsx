import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {DualNumberAxis} from '../components/axis/dual_number_axis';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

// ───────── 可配置 ─────────
const INIT_MIN = -2;
const INIT_MAX = 2;
const DEC_STEP = 1;
const BIN_STEP = 1;
/** 逐级放大细分次数：第 i 次放大到 [0, 1/2^{i}]，默认 3 */
const SUBDIVIDE_COUNT = 3;
// ──────────────────────────

/**
 * 双刻度数轴演示：
 * 上半十进制、下半二进制；按 SUBDIVIDE_COUNT 次放大 [0,1] → [0,1/2] → …
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const axis = createRef<DualNumberAxis>();

  view.add(<SceneTitle ref={title} text={'不丢失精度的浮点数'} />);
  view.add(
    <DualNumberAxis
      ref={axis}
      viewMin={INIT_MIN}
      viewMax={INIT_MAX}
      decStep={DEC_STEP}
      binStep={BIN_STEP}
      axisWidth={1600}
      y={20}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* axis().show();
  yield* waitFor(0.6);

  for (let i = 0; i < SUBDIVIDE_COUNT; i++) {
    const max = Math.pow(2, -i);
    yield* axis().zoomInto(0, max, 1.4);
    yield* waitFor(i === SUBDIVIDE_COUNT - 1 ? 1.5 : 0.5);
  }
});
