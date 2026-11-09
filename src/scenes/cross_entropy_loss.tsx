import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {CrossEntropyLossBoard} from '../components/entropy/cross_entropy_loss_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景六（<<<loss>>>）：为什么交叉熵是损失函数设计的理论基础？
 * 三次训练预测演进（70% → 90% → 99%）、损失曲线 L(q) = -log₂ q 与三大理论特点。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<CrossEntropyLossBoard>();

  view.add(<SceneTitle ref={title} text={'为什么交叉熵是损失函数的理论基础？'} />);
  view.add(<CrossEntropyLossBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
