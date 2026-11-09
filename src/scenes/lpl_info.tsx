import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {LplInfoBoard} from '../components/entropy/lpl_info_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景一（<<<lpl>>>）：什么是信息量？
 * 从 LPL 比赛预测（BLG 90% vs 弱队 10%）出发，引出香农信息量 I(x) = -log₂ P(x)。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<LplInfoBoard>();

  view.add(<SceneTitle ref={title} text={'什么是信息量？'} />);
  view.add(<LplInfoBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
