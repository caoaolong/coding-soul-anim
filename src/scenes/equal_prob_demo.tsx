import {Latex, Layout, Line, Node, Rect, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {Dice, DiceValue} from '../components/dice/dice';
import {FormulaDerive} from '../components/formula/formula_derive';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const DIVIDER = '#4a5d72';
const BADGE_BG = '#152238';

const DICE_SIZE = 108;
const CELL = 132;
const PROB_TEX = '\\dfrac{1}{6}';
const MERGE_PROB_TEX = '\\dfrac{1}{3}';

/** 右侧：去掉 6，末行两个 5 → P(5)=2/6=1/3 */
const RIGHT_VALUES: DiceValue[] = [1, 2, 3, 4, 5, 5];

/** 单点信息量 I = -log₂(1/6) = log₂ 6，保留 4 位小数；约数用 ≈ */
const INFO_EXACT = -Math.log2(1 / 6);
const INFO_RESULT = INFO_EXACT.toFixed(4);
const RESULT_OP =
  Math.abs(INFO_EXACT - Number(INFO_RESULT)) > 1e-12 ? '\\approx' : '=';

const FORMULA_LINES = [
  'I = -\\log_{2} p',
  '= -\\log_{2}\\left(\\dfrac{1}{6}\\right)',
  `${RESULT_OP} ${INFO_RESULT}\\,\\text{(bit)}`,
];

/** 右侧不等概：分别算 I_{1-4}、I_5 信息量 */
const INFO_14_EXACT = -Math.log2(1 / 6);
const INFO_14_RESULT = INFO_14_EXACT.toFixed(4);
const INFO_14_OP =
  Math.abs(INFO_14_EXACT - Number(INFO_14_RESULT)) > 1e-12 ? '\\approx' : '=';
const INFO_5_EXACT = -Math.log2(1 / 3);
const INFO_5_RESULT = INFO_5_EXACT.toFixed(4);
const INFO_5_OP =
  Math.abs(INFO_5_EXACT - Number(INFO_5_RESULT)) > 1e-12 ? '\\approx' : '=';

const RIGHT_FORMULA_LINES = [
  'I_{1-4} = -\\log_{2}\\left(\\dfrac{1}{6}\\right)',
  `${INFO_14_OP} ${INFO_14_RESULT}\\,\\text{(bit)}`,
  'I_{5} = -\\log_{2}\\left(\\dfrac{1}{3}\\right)',
  `${INFO_5_OP} ${INFO_5_RESULT}\\,\\text{(bit)}`,
];

/** 配对后卡片 / 公式在 leftGroup 内的局部位移（间距收紧） */
const CARD_PAIR_X = -210;
const FORMULA_PAIR_X = 150;
const PAIR_SCALE = 0.88;
/** 左半屏中心（1920 宽 → -960…0） */
const LEFT_HALF_CX = -480;
const LEFT_HALF_CY = 36;
const FINAL_SCALE = 0.82;
/** 右半屏中心 */
const RIGHT_HALF_CX = 480;
/** 右侧卡片与公式并排局部位移 */
const RIGHT_CARD_PAIR_X = -200;
const RIGHT_FORMULA_PAIR_X = 175;

/**
 * 等概率数据表示：
 * 1) 中央卡片 3×2 骰子，标注 1/6（保持显示）
 * 2) 卡片移至左侧，右侧书写信息量公式 → 代入 → 数值结果
 * 3) 左侧整体再左移腾出右半屏，中央画垂直虚线
 * 4) 右侧卡片 123455，1–4 标 1/6，两个 5 合框标 1/3
 * 5) 右侧分别计算 I_{1-4}、I_5 信息量
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const leftGroup = createRef<Node>();
  const card = createRef<Rect>();
  const diceRefs = createRefArray<Dice>();
  const formula = createRef<FormulaDerive>();
  const divider = createRef<Line>();

  const rightGroup = createRef<Node>();
  const rightCard = createRef<Rect>();
  const rightDice = createRefArray<Dice>();
  const fiveFrame = createRef<Rect>();
  const fiveBadge = createRef<Rect>();
  const rightFormula = createRef<FormulaDerive>();

  view.add(<SceneTitle ref={title} text={'等概率表示'} />);

  view.add(
    <Node ref={leftGroup} y={LEFT_HALF_CY}>
      <Rect
        ref={card}
        layout
        direction={'column'}
        alignItems={'center'}
        justifyContent={'center'}
        gap={8}
        padding={[22, 28]}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        radius={16}
        opacity={0}
        scale={0.94}
      >
        {[0, 1, 2].map(row => (
          <Layout layout direction={'row'} gap={12} alignItems={'center'}>
            {([1, 2] as const).map(col => {
              const value = (row * 2 + col) as DiceValue;
              return (
                <Layout
                  layout
                  width={CELL}
                  height={CELL}
                  alignItems={'center'}
                  justifyContent={'center'}
                >
                  <Dice
                    ref={diceRefs}
                    value={value}
                    size={DICE_SIZE}
                    badge={PROB_TEX}
                    badgeSize={26}
                    badgeFill={ACCENT}
                    opacity={0}
                  />
                </Layout>
              );
            })}
          </Layout>
        ))}
      </Rect>

      <FormulaDerive
        ref={formula}
        lines={FORMULA_LINES}
        fontSize={44}
        rowGap={32}
        x={FORMULA_PAIR_X}
        opacity={0}
      />
    </Node>,
  );

  // 画面中线：分隔左右各 50%
  view.add(
    <Line
      ref={divider}
      points={[
        [0, -360],
        [0, 440],
      ]}
      stroke={DIVIDER}
      lineWidth={2}
      lineDash={[12, 10]}
      end={0}
      opacity={0}
    />,
  );

  // 右半屏：123455，末行两个 5 合框标 1/3
  view.add(
    <Node
      ref={rightGroup}
      x={RIGHT_HALF_CX}
      y={LEFT_HALF_CY}
      scale={FINAL_SCALE}
      opacity={0}
    >
      <Rect
        ref={rightCard}
        layout
        direction={'column'}
        alignItems={'center'}
        justifyContent={'center'}
        gap={8}
        padding={[22, 28]}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        radius={16}
      >
        {[0, 1].map(row => (
          <Layout layout direction={'row'} gap={12} alignItems={'center'}>
            {([0, 1] as const).map(col => {
              const value = RIGHT_VALUES[row * 2 + col];
              return (
                <Layout
                  layout
                  width={CELL}
                  height={CELL}
                  alignItems={'center'}
                  justifyContent={'center'}
                >
                  <Dice
                    ref={rightDice}
                    value={value}
                    size={DICE_SIZE}
                    badge={PROB_TEX}
                    badgeSize={26}
                    badgeFill={ACCENT}
                    opacity={0}
                  />
                </Layout>
              );
            })}
          </Layout>
        ))}

        {/* 末行两个 5：外框 + 合并角标 1/3 */}
        <Layout
          layout
          direction={'row'}
          gap={12}
          alignItems={'center'}
          justifyContent={'center'}
          padding={10}
        >
          <Rect
            ref={fiveFrame}
            layout={false}
            width={CELL * 2 + 12 + 20}
            height={CELL + 20}
            stroke={ACCENT}
            lineWidth={2.5}
            lineDash={[8, 6]}
            radius={14}
            opacity={0}
            scale={0.92}
          />
          {([0, 1] as const).map(col => (
            <Layout
              layout
              width={CELL}
              height={CELL}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Dice
                ref={rightDice}
                value={RIGHT_VALUES[4 + col]}
                size={DICE_SIZE}
                opacity={0}
              />
            </Layout>
          ))}
          {/* 不参与 flex，叠在右上角 */}
          <Layout layout={false} x={CELL + 6} y={-CELL * 0.5 - 4} zIndex={2}>
            <Rect
              ref={fiveBadge}
              layout
              direction={'row'}
              alignItems={'center'}
              justifyContent={'center'}
              padding={[6, 10]}
              radius={8}
              fill={BADGE_BG}
              stroke={ACCENT}
              lineWidth={2}
              opacity={0}
              scale={0.85}
            >
              <Latex tex={[MERGE_PROB_TEX]} fontSize={26} fill={ACCENT} />
            </Rect>
          </Layout>
        </Layout>
      </Rect>

      <FormulaDerive
        ref={rightFormula}
        lines={RIGHT_FORMULA_LINES}
        fontSize={36}
        rowGap={24}
        x={RIGHT_FORMULA_PAIR_X}
        opacity={0}
      />
    </Node>,
  );

  yield* title().show();
  yield* waitFor(0.2);

  yield* all(
    card().opacity(1, 0.45, easeOutCubic),
    card().scale(1, 0.5, easeOutCubic),
  );
  yield* waitFor(0.15);

  yield* all(...diceRefs.map((d, i) => delay(i * 0.08, d.show(0.4))));
  yield* waitFor(0.25);
  // 标注淡入后保持显示
  yield* all(...diceRefs.map((d, i) => delay(i * 0.05, d.showBadge(0.35))));
  yield* waitFor(0.7);

  // 卡片与公式收紧并排，右侧书写公式
  yield* all(
    card().x(CARD_PAIR_X, 0.75, easeInOutCubic),
    card().scale(PAIR_SCALE, 0.75, easeInOutCubic),
    formula().opacity(1, 0.35, easeOutCubic),
  );
  yield* waitFor(0.2);

  // 逐行：公式 → 代入 1/6 → 计算结果（4 位小数）
  yield* formula().run(0.65, 0.45);
  yield* waitFor(0.55);

  // 整体移入左半屏中心（按卡片/公式中点对齐），腾出右半屏
  const pairMidX = (CARD_PAIR_X + FORMULA_PAIR_X) / 2;
  yield* all(
    leftGroup().x(LEFT_HALF_CX - pairMidX * FINAL_SCALE, 0.8, easeInOutCubic),
    leftGroup().scale(FINAL_SCALE, 0.8, easeInOutCubic),
  );
  yield* waitFor(0.12);
  yield* all(
    divider().opacity(1, 0.25, easeOutCubic),
    divider().end(1, 0.55, easeOutCubic),
  );
  yield* waitFor(0.35);

  // 右侧卡片入场：123455
  rightGroup().scale(FINAL_SCALE * 0.94);
  yield* all(
    rightGroup().opacity(1, 0.45, easeOutCubic),
    rightGroup().scale(FINAL_SCALE, 0.5, easeOutCubic),
  );
  yield* waitFor(0.12);
  yield* all(...rightDice.map((d, i) => delay(i * 0.08, d.show(0.4))));
  yield* waitFor(0.25);

  // 1–4 标 1/6；两个 5 合框标 1/3
  yield* all(
    ...rightDice.slice(0, 4).map((d, i) => delay(i * 0.05, d.showBadge(0.35))),
    delay(
      0.12,
      all(
        fiveFrame().opacity(1, 0.4, easeOutCubic),
        fiveFrame().scale(1, 0.45, easeOutBack),
        fiveBadge().opacity(1, 0.4, easeOutCubic),
        fiveBadge().scale(1, 0.45, easeOutBack),
      ),
    ),
  );
  yield* waitFor(0.45);

  // 右侧卡片左移，分别书写 I_{1-4}、I_5 信息量
  const rightPairMidX = (RIGHT_CARD_PAIR_X + RIGHT_FORMULA_PAIR_X) / 2;
  yield* all(
    rightCard().x(RIGHT_CARD_PAIR_X, 0.65, easeInOutCubic),
    rightGroup().x(
      RIGHT_HALF_CX - rightPairMidX * FINAL_SCALE,
      0.65,
      easeInOutCubic,
    ),
    rightFormula().opacity(1, 0.3, easeOutCubic),
  );
  yield* waitFor(0.15);
  yield* rightFormula().run(0.55, 0.4);
  yield* waitFor(1.2);
});
