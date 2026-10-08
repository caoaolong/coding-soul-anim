import {Layout, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {FracToBinaryBoard} from '../components/float/frac_to_binary_board';
import {IntToBinaryBoard} from '../components/float/int_to_binary_board';
import {SceneTitle} from '../components/title/scene_title';

// ───────── 可配置项 ─────────
/** 显示模式：只整数 / 只小数 / 两侧都显示 */
type ShowMode = 'int' | 'frac' | 'both';
const SHOW_MODE: ShowMode = 'both';

/** 整数部分（十进制） */
const INT_VALUE = 9;
/** 小数部分："32" → 0.32 */
const FRAC_VALUE = '32';
/** 小数 ×2 次数 = 二进制小数精度位数 */
const FRAC_BITS = 8;

const CARD_WIDTH_INT = 520;
const CARD_WIDTH_FRAC = 640;
const GAP = 72;
const ROW_GAP = 22;
const FONT_INT = 40;
const FONT_FRAC = 34;
// ────────────────────────────

/**
 * 预览：整数 / 小数 → 二进制步骤表
 * 改顶部 SHOW_MODE / FRAC_BITS 即可切换。
 */
export default makeScene2D(function* (view) {
  view.fill('#0a0e14');

  const title = createRef<SceneTitle>();
  const intBoard = createRef<IntToBinaryBoard>();
  const fracBoard = createRef<FracToBinaryBoard>();
  const row = createRef<Layout>();

  const showInt = SHOW_MODE === 'int' || SHOW_MODE === 'both';
  const showFrac = SHOW_MODE === 'frac' || SHOW_MODE === 'both';

  view.add(<SceneTitle ref={title} text={'十进制 → 二进制'} />);

  view.add(
    <Layout
      ref={row}
      layout
      direction={'row'}
      alignItems={'start'}
      gap={GAP}
      y={40}
    >
      {showInt ? (
        <IntToBinaryBoard
          ref={intBoard}
          value={INT_VALUE}
          fontSize={FONT_INT}
          rowGap={ROW_GAP}
          cardWidth={CARD_WIDTH_INT}
        />
      ) : null}
      {showFrac ? (
        <FracToBinaryBoard
          ref={fracBoard}
          value={FRAC_VALUE}
          bits={FRAC_BITS}
          fontSize={FONT_FRAC}
          rowGap={ROW_GAP}
          cardWidth={CARD_WIDTH_FRAC}
        />
      ) : null}
    </Layout>,
  );

  yield* title().show();

  // 双侧时先 layout 一帧，再把卡片高度对齐到较高的一侧
  if (showInt && showFrac) {
    yield;
    const h = Math.max(intBoard().panelHeight(), fracBoard().panelHeight());
    intBoard().setCardHeight(h);
    fracBoard().setCardHeight(h);
    yield;
  }

  if (showInt) {
    yield* intBoard().show();
    yield* intBoard().run(0.3);
    if (showFrac) yield* waitFor(0.35);
  }

  if (showFrac) {
    yield* fracBoard().show();
    yield* fracBoard().run(0.22);
  }

  yield* waitFor(1);
});
