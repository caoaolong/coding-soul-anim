import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {ImageStack3D} from '../components/gallery/image_stack_3d';
import {SceneTitle} from '../components/title/scene_title';

import imgAl from '../assets/LPL/AL.png';
import imgBlg from '../assets/LPL/BLG.png';
import imgEdg from '../assets/LPL/EDG.png';
import imgIg from '../assets/LPL/IG.png';
import imgJdg from '../assets/LPL/JDG.png';

const BG = '#0a0e14';

/**
 * 伪 3D 图片堆叠轮播演示：堆叠 → 逐张正视 → 消失 → 再循环一轮。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const stack = createRef<ImageStack3D>();

  view.add(<SceneTitle ref={title} text={'图片堆叠'} />);
  view.add(
    <ImageStack3D
      ref={stack}
      images={[imgJdg, imgBlg, imgEdg, imgAl, imgIg]}
      width={420}
      height={420}
      depthX={40}
      depthY={-26}
      depthScale={0.06}
      depthRotate={5}
      y={20}
    />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* stack().play({hold: 0.7, loops: 2, pauseBetweenLoops: 0.5});
  yield* waitFor(0.8);
});
