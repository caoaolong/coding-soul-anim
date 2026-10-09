import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {BlockStack} from '../components/blocks/block_stack';

const BG = '#0a0e14';

/** 显示层数；首轮 calc 会填 2^{-1} … 2^{-(DEPTH-1)}（跳过 1/1） */
const DEPTH = 5;
/** 位表列数：2^{-1} … 2^{-BIT_COUNT} */
const BIT_COUNT = 15;
/**
 * 还需 zoom 的次数 = 位表剩余列数。
 * 与 BIT_COUNT 不是同一值：首轮已占 DEPTH-1 列，故 ZOOM_ROUNDS = BIT_COUNT - (DEPTH - 1)。
 */
const ZOOM_ROUNDS = BIT_COUNT - (DEPTH - 1);

/** 不可精确表示的目标：贪心选块 + 细分逼近，进度 = 已选真实和 / 目标 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const stack = createRef<BlockStack>();
  const target = 0.2345;

  view.add(<SceneTitle ref={title} text={'浮点数编码'} />);
  view.add(
    <BlockStack
      ref={stack}
      depth={DEPTH}
      value={target}
      bitCount={BIT_COUNT}
    />,
  );

  yield* title().show();
  yield* stack().showTable(target);
  yield* waitFor(0.3);
  yield* stack().reveal();
  yield* waitFor(1);
  yield* stack().calc(target);

  // 无法凑满则继续放大并续算（受 canZoomIn / bitCount 双重限制）
  for (let i = 0; i < ZOOM_ROUNDS; i++) {
    if (!stack().canZoomIn) break;
    yield* waitFor(0.35);
    yield* stack().zoomIn();
    yield* waitFor(0.25);
    yield* stack().calc(target);
  }

  yield* waitFor(1.2);
});
