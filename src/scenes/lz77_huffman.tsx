import {makeScene2D} from '@motion-canvas/2d';
import {createRef} from '@motion-canvas/core';
import {Lz77HuffmanBoard} from '../components/lz77/lz77_huffman_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * LZ77 编码结果 → DEFLATE 双树哈夫曼编码（位于 lz77 与 languageZipDemo 之间）：
 * 1) 承接 lz77 第二屏顶部的 LZ77 Token Tags
 * 2) 按 DEFLATE 标准拆分为「字面量/长度」与「偏移距离」双流，统计频次并排序
 * 3) 构建双哈夫曼树与变长前缀码表（高频 'a' 仅 2 bit）
 * 4) 将 11 个 Token 逐一编码为 37 bit 紧凑比特流，并与原始 184 bit 对比压缩比
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<Lz77HuffmanBoard>();

  view.add(<SceneTitle ref={title} text={'LZ77 编码结果'} opacity={1} />);
  view.add(<Lz77HuffmanBoard ref={board} />);

  yield* board().play(title());
});
