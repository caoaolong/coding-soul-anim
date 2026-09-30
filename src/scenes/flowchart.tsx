import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FlowChart} from '../components/flow/flow_chart';
import {SceneTitle} from '../components/title/scene_title';

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

  view.add(<SceneTitle ref={title} text={'流程图'} />);

  view.add(
    <FlowChart
      ref={chart}
      y={40}
      columns={COLUMNS}
      nodes={[
        {label: '提出问题'},
        {label: '建立模型'},
        {label: '布尔代数'},
        {label: '开关电路'},
        {label: '晶体管'},
        {label: '逻辑门'},
        {label: '二进制'},
        {label: '可计算'},
      ]}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* chart().play({gap: 0.2});
  yield* waitFor(1.2);
});
