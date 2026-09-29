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
乔治·布尔（George Boole）生于英格兰的林肯郡。
在备课的时候，布尔不满意当时的数学课本，便决定阅读伟大数学家的论文。在阅读法国数学家拉格朗日的论文时，布尔有了变分法方面的新发现。变分法是数学分析的分支，它处理的是寻求优化某些参数的曲线和曲面。
1847年，布尔出版了《逻辑的数学分析》（The Mathematical Analysis of Logic），这是他对符号逻辑诸多贡献中的第一次。
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
