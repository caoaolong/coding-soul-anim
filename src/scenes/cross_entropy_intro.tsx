import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {CrossEntropyBoard} from '../components/entropy/cross_entropy_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景四（<<<cross_entropy>>>）：什么是交叉熵？
 * 猫狗图像分类：真实分布 P=(1,0) 与不同预测分布 Q 的交叉熵 H(P,Q) = -∑ p_i log₂ q_i 对比。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<CrossEntropyBoard>();

  view.add(<SceneTitle ref={title} text={'什么是交叉熵？'} />);
  view.add(<CrossEntropyBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
