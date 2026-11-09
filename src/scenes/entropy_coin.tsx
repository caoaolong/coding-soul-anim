import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {EntropyCoinBoard} from '../components/entropy/entropy_coin_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景二（<<<entropy>>>）：什么是信息熵？
 * 对比均匀硬币（50%/50%）与偏置硬币（99%/1%），推导信息熵 H(X) = -∑ p_i log₂ p_i。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<EntropyCoinBoard>();

  view.add(<SceneTitle ref={title} text={'什么是信息熵？'} />);
  view.add(<EntropyCoinBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
