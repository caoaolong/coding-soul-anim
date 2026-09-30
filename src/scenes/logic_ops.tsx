import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {LogicFlow} from '../components/flow/logic_flow';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/** 三列：与 | 或 | 非，依次演示真值 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const andFlow = createRef<LogicFlow>();
  const orFlow = createRef<LogicFlow>();
  const notFlow = createRef<LogicFlow>();

  view.add(<SceneTitle ref={title} text={'三个基本运算符'} />);

  view.add(
    <LogicFlow
      ref={andFlow}
      op={'AND'}
      title={'与'}
      x={-560}
      y={40}
    />,
  );
  view.add(
    <LogicFlow
      ref={orFlow}
      op={'OR'}
      title={'或'}
      x={0}
      y={40}
    />,
  );
  view.add(
    <LogicFlow
      ref={notFlow}
      op={'NOT'}
      title={'非'}
      x={560}
      y={40}
    />,
  );

  yield* title().show();

  yield* andFlow().reveal();
  yield* andFlow().demo(
    [
      [1, 0],
      [0, 0],
      [1, 1],
    ],
    1.0,
  );
  yield* waitFor(0.25);

  yield* orFlow().reveal();
  yield* orFlow().demo(
    [
      [1, 0],
      [0, 0],
      [1, 1],
    ],
    1.0,
  );
  yield* waitFor(0.25);

  yield* notFlow().reveal();
  yield* notFlow().demo([[1], [0]], 1.0);

  yield* waitFor(1.2);
});
