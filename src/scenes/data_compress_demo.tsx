import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FileContentReveal} from '../components/file/file_content_reveal';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/** 演示用文件内容（等宽数据串，后续可接压缩高亮） */
const DEMO_CONTENT = 'Remote work has transformed from a rare privilege to a mainstream practice in just a few years. Companies across the globe have discovered that employees can maintain, or even increase, productivity while working from home. This shift has challenged traditional notions of workplace culture and forced organizations to rethink their approach to collaboration and communication. While some employees thrive in the flexibility of remote arrangements, others miss the social interactions and clear boundaries that physical offices provide.';
const DEMO_LABEL = '文档';

/**
 * 数据压缩开场：
 * 1) 中央文件图标（上图下标题）
 * 2) 气泡弹出显示文件内容（等宽打字机），整组始终居中
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const file = createRef<FileContentReveal>();

  view.add(<SceneTitle ref={title} text={'数据压缩'} />);
  view.add(
    <FileContentReveal
      ref={file}
      label={DEMO_LABEL}
      content={DEMO_CONTENT}
      maxWidth={1400}
      fontSize={22}
      iconSize={110}
      typeSpeed={0.016}
      y={40}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* file().show();
  yield* waitFor(0.45);
  yield* file().revealContent();
  yield* waitFor(0.5);
  yield* file().highlightWord('the');
  yield* waitFor(0.8);
  // 换词时会自动把上一批 "the" 恢复原状
  yield* file().highlightWord('remote', {ignoreCase: true});
  yield* waitFor(1.2);
});
