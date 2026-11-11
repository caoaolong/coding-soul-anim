import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {CompressionIntelligenceBoard} from '../components/zip/compression_intelligence_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * 压缩即智能（口播终章场景）：
 * 1) 语言识别（分类 · 特征相似度） ↔ 作者识别（智能 · 深层规律）
 * 2) 智能 = 对世界进行高度抽象和压缩的能力 + 人类学习三步（接收信息 → 寻找规律 → 理解）
 * 3) 表面「减少数据」 → 深层「寻找规律」 → 诞生智能
 * 4) 大胆猜想：「压缩即智能」定格
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<CompressionIntelligenceBoard>();

  view.add(<SceneTitle ref={title} text={'压缩即智能'} />);
  view.add(<CompressionIntelligenceBoard ref={board} />);

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().play();
});
