import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {BlockStack} from '../components/blocks/block_stack';

const BG = '#0a0e14';

/** 块堆叠演示：depth=5（16 / 8 / 4 / 2 / 1），拼出 0.625 后再放大两级 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const stack = createRef<BlockStack>();

  view.add(<SceneTitle ref={title} text={'2的幂'} />);
  view.add(<BlockStack ref={stack} depth={5} value={0.625} />);

  yield* title().show();
  yield* stack().reveal();
  yield* waitFor(0.4);
  yield* stack().calc(0.625);
  yield* waitFor(0.4);
  yield* stack().zoomIn();
  yield* waitFor(0.3);
  yield* stack().zoomIn();
  yield* waitFor(1.2);
});
