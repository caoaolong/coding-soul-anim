import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {EntropyApplicationBoard} from '../components/entropy/entropy_application_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 场景三（<<<application>>>）：信息熵有什么用？
 * 1) 哈夫曼编码（定长 2 bit → 变长 1.75 bit，无损压缩理论下界）
 * 2) 决策树分类（100 个猫狗样本特征划分与信息增益）
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<EntropyApplicationBoard>();

  view.add(<SceneTitle ref={title} text={'信息熵的应用 · 哈夫曼编码'} />);
  view.add(<EntropyApplicationBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play(title());
});
