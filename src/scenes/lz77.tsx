import {Node, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Lz77Board} from '../components/lz77/lz77_board';
import {Lz77DecodeBoard} from '../components/lz77/lz77_decode_board';
import {Lz77FlowBadge} from '../components/lz77/lz77_flow_badge';
import {Lz77TokenTable} from '../components/lz77/lz77_token_table';
import {Lz77TokenTags} from '../components/lz77/lz77_token_tags';
import type {Lz77Token} from '../components/lz77/lz77_token_style';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
/** 一屏高度（与 project.meta 一致） */
const SCREEN_H = 1080;

/**
 * 演示用输入文本（可含换行；显示时换行渲染为 ↩︎）。
 * 修改此处即可换示例。
 */
const INPUT_TEXT =
  'abracadabra abracadabra';

/** 搜索窗口大小（字符数） */
const WINDOW_SIZE = 12;
/**
 * Look-ahead 缓冲大小（字符数；须 ≥ 3，与 DEFLATE 最短匹配一致）。
 * 取 8 以便引用展开出不同明文（abra / abracada / bra），避免全是 abra。
 */
const LOOK_AHEAD = 8;

/**
 * 第一屏：LZ77 编解码演示
 * 第二屏：向下滚动后，上方一行 tokens tag
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const pages = createRef<Node>();
  const screen1 = createRef<Node>();
  const screen2 = createRef<Node>();

  const title = createRef<SceneTitle>();
  const title2 = createRef<SceneTitle>();
  const board = createRef<Lz77Board>();
  const table = createRef<Lz77TokenTable>();
  const decode = createRef<Lz77DecodeBoard>();
  const compressBadge = createRef<Lz77FlowBadge>();
  const decompressBadge = createRef<Lz77FlowBadge>();
  const tags = createRef<Lz77TokenTags>();
  const tokens: Lz77Token[] = [];

  view.add(
    <Node ref={pages}>
      <Node ref={screen1} />
      <Node ref={screen2} y={SCREEN_H} />
    </Node>,
  );

  // ── 第一屏 ──
  screen1().add(<SceneTitle ref={title} text={'LZ77 编码过程'} />);
  screen1().add(
    <Lz77Board
      ref={board}
      text={INPUT_TEXT}
      windowSize={WINDOW_SIZE}
      lookAheadSize={LOOK_AHEAD}
      fontSize={64}
      charStep={84}
      x={0}
      y={-320}
    />,
  );
  screen1().add(
    <Lz77FlowBadge
      ref={compressBadge}
      label={'LZ77编码'}
      height={180}
      boxWidth={140}
      y={-70}
    />,
  );
  screen1().add(
    <Lz77TokenTable
      ref={table}
      labelWidth={120}
      colWidth={108}
      rowHeight={40}
      y={160}
    />,
  );
  screen1().add(
    <Lz77FlowBadge
      ref={decompressBadge}
      label={'LZ77解码'}
      height={170}
      boxWidth={140}
      y={0}
    />,
  );
  screen1().add(
    <Lz77DecodeBoard
      ref={decode}
      fontSize={44}
      charStep={52}
      y={200}
    />,
  );

  // ── 第二屏：token tags ──
  screen2().add(<SceneTitle ref={title2} text={'LZ77 编码结果'} />);
  screen2().add(
    <Lz77TokenTags
      ref={tags}
      tagHeight={76}
      gap={14}
      fontSize={28}
      y={-320}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* board().show(0.7);
  yield* waitFor(0.15);
  yield* compressBadge().show(0.4);
  yield* waitFor(0.1);
  yield* table().show(0.45);
  yield* waitFor(0.25);

  const stepOpts = {
    scanBeat: 0.1,
    holdMatch: 0.4,
    holdToken: 0.45,
    showTokenPopup: true,
    keepTokenVisible: true,
  };

  while (!board().isDone()) {
    yield* board().step(stepOpts);
    const token = board().getLastToken();
    if (token) {
      tokens.push(token);
      const from = board().tokenPopupAbsolutePosition();
      yield* all(
        table().appendTokenFrom(token, from, 0.55),
        board().hideTokenPopup(0.35),
      );
    }
    if (!board().isDone()) yield* waitFor(0.12);
  }

  // 编码结束：隐藏原文与「压缩」箭头，表格上移，露出还原区
  yield* waitFor(0.35);
  yield* all(
    board().opacity(0, 0.5, easeInOutCubic),
    compressBadge().hide(0.4),
    table().y(-280, 0.55, easeInOutCubic),
  );

  yield* title().setText('LZ77 还原过程', 0.35);
  yield* waitFor(0.15);
  decompressBadge().y(-30);
  yield* all(
    decompressBadge().show(0.4),
    decode().show(0.45),
  );
  yield* waitFor(0.25);

  for (let i = 0; i < tokens.length; i++) {
    yield* table().highlightColumn(i, 0.28);
    yield* decode().stepToken(tokens[i], {beat: 0.1});
    yield* waitFor(0.22);
  }
  yield* all(
    table().clearHighlight(0.3),
    decode().finish(0.35),
  );
  yield* decode().revealOriginal(INPUT_TEXT, 0.7);
  yield* waitFor(0.8);

  // 向下滚动到第二屏，展示 tokens tag 行
  tags().build(tokens);
  yield* all(
    pages().y(-SCREEN_H, 0.85, easeInOutCubic),
    title2().show(0.5),
  );
  yield* waitFor(0.2);
  yield* tags().show(0.45, 0.05);
  yield* waitFor(1.5);
});
