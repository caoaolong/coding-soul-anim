import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {MacWindow} from '../components/window/mac_window';
import georgeBoole from '../assets/Person/GeorgeBoole.jpg';

export default makeScene2D(function* (view) {
  view.fill('#0a0e14');

  const win = createRef<MacWindow>();

  view.add(
    <MacWindow
      ref={win}
      title={'George Boole · 1847'}
      mode={'both'}
      image={georgeBoole}
      text={
        `
威廉·肖克利（William Shockley）、约翰·巴丁（John Bardeen）和沃尔特·布拉顿（Walter Brattain）供职于美国新泽西州的**贝尔实验室**。
1947年，巴丁和布拉顿成功演示了**点接触晶体管**，随后肖克利完善了结型晶体管理论，这是他们对微电子学与整个现代计算机产业诸多贡献中的第一次。
        `
      }
      windowWidth={1480}
      contentHeight={720}
      imageWidth={480}
    />,
  );

  yield* win().show(0.55);
  yield* waitFor(3);
});
