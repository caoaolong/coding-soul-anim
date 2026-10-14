import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {UnicodeCoordPlanes} from '../components/ascii/unicode_coord_planes';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 先展示 Unicode 1.0 的 16-bit 编码空间，再扩展到 2.0 的十七平面。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const planes = createRef<UnicodeCoordPlanes>();

  view.add(<SceneTitle ref={title} text={'Unicode 1.0 编码空间'} />);
  view.add(
    <UnicodeCoordPlanes
      ref={planes}
      plotWidth={1100}
      rowHeight={36}
      v1Height={280}
      tickFontSize={18}
      axisLabelSize={24}
      planeLabelSize={15}
      y={10}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* planes().showUnicode10(0.55);
  yield* waitFor(1.0);

  yield* title().setText('Unicode 2.0：十七平面', 0.4);
  yield* waitFor(0.15);
  yield* planes().expandToUnicode20(0.85, 0.028);
  yield* waitFor(0.35);
  // 各平面码点首字节（前缀 0x00–0x10）
  yield* planes().showPlanePrefixes(0.4, 0.025);
  yield* waitFor(0.4);
  yield* planes().highlightPlane(0, 0.4);
  yield* waitFor(1.5);
});
