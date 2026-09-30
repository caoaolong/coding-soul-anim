import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FormulaBoard} from '../components/formula/formula_board';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

/**
 * FormulaBoard 演示：香农信息量 I = -log₂ p
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<FormulaBoard>();

  view.add(<SceneTitle ref={title} text={'香农 · 信息量'} />);

  view.add(
    <FormulaBoard
      ref={board}
      parts={[
        {id: 'I', tex: 'I'},
        {tex: '= -'},
        {id: 'log2', tex: '\\log_{2}'},
        {id: 'p', tex: 'p'},
      ]}
      annotations={[
        {id: 'I', label: 'I　信息量（比特）'},
        {id: 'p', label: 'p　事件发生的概率'},
        {id: 'log2', label: 'log₂　以 2 为底的对数'},
      ]}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* board().run();
  yield* waitFor(1.0);
});
