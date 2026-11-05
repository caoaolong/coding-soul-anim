import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {PaperBoard} from '../components/paper/paper_board';

import paperImg from '../assets/papers/LanguageTrees&Zipping.png';

const BG = '#0a0e14';

/**
 * Language Trees and Zipping：论文中央立体入场 → 移到左侧 → 右侧要点依次显示
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<PaperBoard>();

  view.add(<SceneTitle ref={title} text={'Language Trees and Zipping'} />);
  view.add(
    <PaperBoard
      ref={board}
      image={paperImg}
      caption={'Benedetto · Caglioti · Loreto · 2002'}
      paperHeight={620}
      paperX={-520}
      listX={80}
      rowStep={180}
      fontSize={28}
      depthLayers={3}
      points={[
        '用交叉压缩距离衡量文本（语言）之间的相似度',
        '相似度越高，压缩后的相对距离越近；反之越远',
        '据此可将多种语言排布成关系图 / 语言树',
      ]}
    />,
  );

  yield* title().show();
  yield* board().run();
  yield* waitFor(1.2);
});
