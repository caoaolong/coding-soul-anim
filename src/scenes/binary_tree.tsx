import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {NodeTree} from '../components/tree/node_tree';

import rootIcon from '../assets/icons/二进制.svg';
import imageIcon from '../assets/icons/图片.svg';
import audioIcon from '../assets/icons/音频.svg';
import videoIcon from '../assets/icons/视频.svg';
import otherIcon from '../assets/icons/其他.svg';

const BG = '#0a0e14';

/**
 * 二进制表示：二进制 → 图片 / 音频 / 视频 / 其他
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const tree = createRef<NodeTree>();

  view.add(<SceneTitle ref={title} text={'二进制'} />);
  view.add(
    <NodeTree
      ref={tree}
      root={{label: '二进制', icon: rootIcon}}
      children={[
        {label: '图片', icon: imageIcon},
        {label: '音频', icon: audioIcon},
        {label: '视频', icon: videoIcon},
        {label: '其他', icon: otherIcon},
      ]}
    />,
  );

  yield* title().show();
  yield* tree().reveal();
  yield* waitFor(1.2);
});
