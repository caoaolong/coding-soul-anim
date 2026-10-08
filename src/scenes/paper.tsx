import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {PaperBoard} from '../components/paper/paper_board';

import paperImg from '../assets/papers/IEEE_754.png';

const BG = '#0a0e14';

/**
 * IEEE 754：标准文本中央入场 → 移到左侧 → 右侧三条要点依次显示
 * （第一条含浮点数通用公式）
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<PaperBoard>();

  view.add(<SceneTitle ref={title} text={'IEEE 754 浮点标准'} />);
  view.add(
    <PaperBoard
      ref={board}
      image={paperImg}
      caption={'IEEE · 1985 · Floating-Point Arithmetic'}
      paperHeight={580}
      paperX={-540}
      listX={60}
      rowStep={200}
      fontSize={28}
      formulaSize={34}
      points={[
        {
          text: '浮点数存储由 S、E、M 三部分组成',
          formula:
            '(-1)^{S}\\times(1.M)_{2}\\times 2^{E-\\mathrm{bias}}',
        },
        '确定了 32 位单精度和 64 位双精度两种基本浮点数格式',
        '规定了特殊数值的编码规则',
      ]}
    />,
  );

  yield* title().show();
  yield* board().run();
  yield* waitFor(1.2);
});
