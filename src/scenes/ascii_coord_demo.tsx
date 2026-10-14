import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {AsciiCoordGrid} from '../components/ascii/ascii_coord_grid';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * ASCII 二维坐标：横轴低 4 位、纵轴高 3 位（7-bit），格内为对应字符。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const grid = createRef<AsciiCoordGrid>();

  view.add(<SceneTitle ref={title} text={'ASCII 码平面'} />);
  view.add(
    <AsciiCoordGrid
      ref={grid}
      cellSize={56}
      fontSize={24}
      tickFontSize={20}
      axisLabelSize={26}
      y={40}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* grid().show(0.55, 0.006);
  yield* waitFor(0.4);
  yield* grid().highlight(0x41, 0.45); // 'A'
  yield* waitFor(1.5);
});
