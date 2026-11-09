import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {EntropySummaryBoard} from '../components/entropy/entropy_summary_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景七（<<<ending>>>）：结语 —— 从信息论到人工智能
 * 回顾信息量、信息熵、交叉熵的完整脉络与核心哲学内涵。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<EntropySummaryBoard>();

  view.add(<SceneTitle ref={title} text={'结语 · 从信息论到人工智能'} />);
  view.add(<EntropySummaryBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
