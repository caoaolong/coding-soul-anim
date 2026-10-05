import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {TreeBoard} from '../components/tree/tree_board';

const BG = '#0a0e14';

/**
 * 命题树 → 基本运算树：
 * 1. 中央展开命题树（命题 → 真/假命题 → 雪是白色/蓝色的）
 * 2. 命题树移到左侧
 * 3. 右侧展开基本运算树（基本运算 → 与 / 或 / 非）
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const first = createRef<TreeBoard>();
  const second = createRef<TreeBoard>();

  view.add(<SceneTitle ref={title} text={'命题 · 基本运算'} />);
  view.add(
    <TreeBoard
      ref={first}
      x={0}
      y={-180}
      tree={{
        label: '命题',
        children: [
          {
            label: '真命题',
            color: '#3dd6c6',
            children: [{label: '1'}],
          },
          {
            label: '假命题',
            color: '#ff6b6b',
            children: [{label: '0'}],
          },
        ],
      }}
    />,
  );

  yield* title().show();
  yield* first().reveal();
  yield* waitFor(0.6);

  // 叶子 1/0 替换为具体命题
  yield* first().rename('1', '雪是白色的');
  yield* first().rename('0', '雪是蓝色的');
  yield* waitFor(0.6);

  // 第一棵树移到左侧
  yield* first().slideTo(-460, -180, 0.8);
  yield* waitFor(0.2);

  // 第二棵树在右侧展开
  view.add(
    <TreeBoard
      ref={second}
      x={430}
      y={-180}
      tree={{
        label: '基本运算',
        children: [{label: '与'}, {label: '或'}, {label: '非'}],
      }}
    />,
  );
  yield* second().reveal();
  yield* waitFor(1.2);
});
