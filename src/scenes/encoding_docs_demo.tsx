import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {EncodingDocsCompare} from '../components/encoding/encoding_docs_compare';
import {SceneTitle} from '../components/title/scene_title';
import encodingSizesCsv from '../assets/data/encoding_sizes.csv?raw';

const BG = '#0a0e14';

/**
 * 三份文档横向对比：类型 + 摘要 + UTF-8/16/32 相对体积（UTF-8 = 1）。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const docs = createRef<EncodingDocsCompare>();

  view.add(<SceneTitle ref={title} text={'编码体积对比'} />);
  view.add(
    <EncodingDocsCompare
      ref={docs}
      csv={encodingSizesCsv}
      cardWidth={400}
      cardGap={30}
      previewChars={68}
      barMaxHeight={132}
      y={36}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* docs().show(0.55, 0.14);
  yield* waitFor(2.0);
});
