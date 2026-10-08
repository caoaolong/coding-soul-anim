import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FormulaDerive} from '../components/formula/formula_derive';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

// ───────── 可配置：每一行一个推导式 ─────────
const LINES = [
  '9.32 = 9 \\times 2^0 + 3 \\times 10^{-1} + 2 \\times 10^{-2}',
  '= -(9 + 0.32)',
  '= -(1001_{2} + 0.0101000111_{2})',
  '= -1.0010101000111 \\times 2^{3}',
];
const FONT_SIZE = 52;
const ROW_GAP = 40;
const STEP_HOLD = 0.7;
// ───────────────────────────────────────────

/**
 * 屏幕中央多行 LaTeX 推导：整体居中，各行等号竖直对齐。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const derive = createRef<FormulaDerive>();

  view.add(<SceneTitle ref={title} text={'公式推导'} />);
  view.add(
    <FormulaDerive
      ref={derive}
      lines={LINES}
      fontSize={FONT_SIZE}
      rowGap={ROW_GAP}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* derive().run(STEP_HOLD);
  yield* waitFor(1.2);
});
