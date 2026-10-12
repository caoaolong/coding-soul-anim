import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {Terminal} from '../components/terminal/terminal';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 命令行组件演示：逐字输入命令，结果一次性显示。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const term = createRef<Terminal>();

  view.add(<SceneTitle ref={title} text={'命令行'} />);
  view.add(
    <Terminal
      ref={term}
      title={'bash — coding-soul'}
      prompt={'$ '}
      width={1100}
      height={460}
      fontSize={28}
      typeSpeed={0.045}
      y={40}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* term().show();
  yield* waitFor(0.25);

  yield* term().runAll(
    [
      {
        command: 'echo Hello,World!',
        output: 'Hello,World!',
      },
      {
        command: 'printf "%x\\n" 72',
        output: '48',
      },
      {
        command: 'cat greeting.txt',
        output: 'Hello,World!\nASCII ready.',
      },
    ],
    {gapBetween: 0.55},
  );

  yield* waitFor(1.2);
});
