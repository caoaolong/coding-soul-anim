import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {ZipStructureBoard} from '../components/zip/zip_structure_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * ZIP 编码结构：
 * ZIP 工具 → DEFLATE 载荷 → 头部元数据/校验 → 尾部目录/入口
 * → 聚焦 DEFLATE → 拆解为 LZ77 + 哈夫曼（衔接下场 lz77）
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<ZipStructureBoard>();

  view.add(<SceneTitle ref={title} text={'ZIP 编码结构'} />);
  view.add(<ZipStructureBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
