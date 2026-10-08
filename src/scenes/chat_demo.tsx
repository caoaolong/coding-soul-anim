import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {ChatMessage, ChatPanel} from '../components/chat/chat_panel';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

// ───────── 可配置对话内容 ─────────
const MESSAGES: ChatMessage[] = [
  {
    role: 'user',
    content: '浮点数为什么会丢失精度？',
    hold: 0.35,
  },
  {
    role: 'assistant',
    content:
      '用一个有限位的二进制小数去表示一个十进制的小数，结果就是只能无限接近，但永远无法精确替代，这就是精度丢失的根本原因。',
    charDelay: 0.028,
    hold: 0.5,
  },
  {
    role: 'user',
    content: '更深层的原因是什么？用一句话总结。',
    hold: 0.3,
  },
  {
    role: 'assistant',
    content:
      '计算机必须用有限数量的离散状态去编码一个连续的实数空间。',
    charDelay: 0.026,
    hold: 0.6,
  },
];

const TITLE = 'ChatGPT';
const USER_NAME = '你';
const AI_NAME = 'AI';
// ──────────────────────────────────

/**
 * AI 对话 UI 演示：按 MESSAGES 配置依次播放。
 * 用户气泡整段入场；AI 气泡打字机逐字出现。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const chat = createRef<ChatPanel>();

  view.add(<SceneTitle ref={title} text={'对话 · 浮点误差'} />);
  view.add(
    <ChatPanel
      ref={chat}
      messages={MESSAGES}
      title={TITLE}
      userName={USER_NAME}
      assistantName={AI_NAME}
      panelWidth={1520}
      panelHeight={700}
      bubbleMaxWidth={960}
      fontSize={28}
      typeSpeed={0.028}
      inputTypeSpeed={0.04}
      messageGap={0.4}
      y={40}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* chat().run();
  yield* waitFor(1.2);
});
