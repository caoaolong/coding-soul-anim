import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FocusWord} from '../components/emphasis/focus_word';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/** 词语强调演示：顶部落入中央，停留后向右滑出 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const word = createRef<FocusWord>();

  view.add(<SceneTitle ref={title} text={'词语强调'} />);
  view.add(<FocusWord ref={word} text={'精度丢失'} />);

  yield* title().show();
  yield* waitFor(0.25);
  yield* word().play();
  yield* waitFor(0.8);
});
