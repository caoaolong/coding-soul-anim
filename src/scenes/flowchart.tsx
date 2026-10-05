import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FlowChart} from '../components/flow/flow_chart';
import {SceneTitle} from '../components/title/scene_title';

import computerImg from '../assets/icons/计算机.svg';
import booleImg from '../assets/Person/GeorgeBoole.jpg';
import shannonImg from '../assets/Person/C.E.Shannon.jpg';
import transistorImg from '../assets/Person/贝尔实验室三兄弟.jpeg';
import infoImg from '../assets/papers/信息论.png';
import gateImg from '../assets/icons/门电路.svg';

const BG = '#0a0e14';

/** 每行列数（蛇形折返）；改这里即可调整布局密度 */
const COLUMNS = 3;

/**
 * 蛇形流程图演示：节点数 = nodes.length，显示顺序为蛇形。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const chart = createRef<FlowChart>();

  view.add(<SceneTitle ref={title} text={'计算之路'} />);

  view.add(
    <FlowChart
      ref={chart}
      y={40}
      columns={COLUMNS}
      imageSize={110}
      nodes={[
        {label: '二进制', image: computerImg},
        {label: '1847年·布尔代数', image: booleImg},
        {label: '1937年·香农的论文', image: shannonImg},
        {label: '1947年·晶体管诞生', image: transistorImg},
        {label: '1948年·信息论', image: infoImg},
        {label: '门电路', image: gateImg},
      ]}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* chart().play({gap: 0.2});
  yield* waitFor(1.2);
});
