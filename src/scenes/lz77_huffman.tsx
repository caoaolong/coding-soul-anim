import {makeScene2D} from '@motion-canvas/2d';
import {createRef} from '@motion-canvas/core';
import {Lz77HuffmanBoard} from '../components/lz77/lz77_huffman_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * DEFLATE 双树哈夫曼编码：
 * 1) 展示 LZ77 Token Tags，按 DEFLATE 拆分为「字面量/长度」与「偏移距离」双流并统计频次
 * 2) 构建双哈夫曼树与变长前缀码表（高频 'a' 仅 2 bit）
 * 3) 将 11 个 Token 逐一编码为 37 bit 紧凑比特流，并与原始 184 bit 对比压缩比
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<Lz77HuffmanBoard>();

  view.add(<SceneTitle ref={title} text={'哈夫曼编码'} />);
  view.add(<Lz77HuffmanBoard ref={board} />);

  yield* title().show();
  yield* board().play();
});
