import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {EntropyRelationshipBoard} from '../components/entropy/entropy_relationship_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景五（<<<relationship>>>）：信息量、信息熵和交叉熵之间的关系
 * 三者递进对比（单个事件 → 单个概率分布 → 两个概率分布）及 H(P,Q) = H(P) + D_KL(P||Q)。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<EntropyRelationshipBoard>();

  view.add(<SceneTitle ref={title} text={'信息量、信息熵与交叉熵的关系'} />);
  view.add(<EntropyRelationshipBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
