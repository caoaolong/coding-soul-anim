import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {TreeBoard} from '../components/tree/tree_board';

const BG = '#0a0e14';

/**
 * Unicode 编码体系树：
 * 根为 Unicode（统一码点空间），子节点为三种 UTF 编码形式；
 * 展开后最终高亮 UTF-8。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const tree = createRef<TreeBoard>();

  view.add(<SceneTitle ref={title} text={'Unicode 编码体系'} />);

  view.add(
    <TreeBoard
      ref={tree}
      x={0}
      y={-160}
      nodeStyle={'circle'}
      edgeStyle={'straight'}
      circleSize={136}
      hGap={56}
      vGap={48}
      fontSize={24}
      tree={{
        label: 'Unicode',
        color: '#7aa2ff',
        year: 1991,
        children: [
          {
            label: 'UTF-8',
            color: '#3dd6c6',
            year: 1993,
            dashed: true,
          },
          {
            label: 'UTF-16',
            color: '#ffb454',
            year: 1996,
            dashed: true,
          },
          {
            label: 'UTF-32',
            color: '#f472b6',
            year: 2001,
            dashed: true,
          },
        ],
      }}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* tree().reveal();
  yield* waitFor(0.55);

  // 最终锁定 UTF-8
  yield* tree().highlight('UTF-8', 0.5);
  yield* waitFor(1.8);
});
