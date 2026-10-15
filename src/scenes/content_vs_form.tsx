import {Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';
import {TreeBoard} from '../components/tree/tree_board';
import {FONT} from '../theme/fonts';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const PAPER = '#e8eef7';
const CONTENT = '#3dd6c6';
const FORM = '#7aa2ff';
const NEQ = '#ff6b6b';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

/**
 * 信息内容 ≠ 表示方式：
 * 中央两框 + 不等号摇晃强调 → 整体上移 →
 * 下方树：数字 2 → 二 / 贰 / Two / II 等不同表示。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const pair = createRef<Node>();
  const leftBox = createRef<Rect>();
  const rightBox = createRef<Rect>();
  const neq = createRef<Txt>();
  const tree = createRef<TreeBoard>();

  view.add(<SceneTitle ref={title} text={'内容与表示'} />);

  view.add(
    <Node ref={pair} y={40}>
      <Rect
        ref={leftBox}
        layout
        width={320}
        height={140}
        x={-280}
        radius={16}
        fill={CARD}
        stroke={CONTENT}
        lineWidth={3}
        alignItems={'center'}
        justifyContent={'center'}
        opacity={0}
        scale={0.9}
      >
        <Txt
          text={'信息内容'}
          fontFamily={FONT}
          fontSize={42}
          fontWeight={700}
          fill={CONTENT}
        />
      </Rect>

      <Txt
        ref={neq}
        text={'≠'}
        fontFamily={MONO}
        fontSize={72}
        fontWeight={700}
        fill={NEQ}
        x={0}
        y={0}
        opacity={0}
        scale={0.6}
      />

      <Rect
        ref={rightBox}
        layout
        width={320}
        height={140}
        x={280}
        radius={16}
        fill={CARD}
        stroke={FORM}
        lineWidth={3}
        alignItems={'center'}
        justifyContent={'center'}
        opacity={0}
        scale={0.9}
      >
        <Txt
          text={'表示方式'}
          fontFamily={FONT}
          fontSize={42}
          fontWeight={700}
          fill={FORM}
        />
      </Rect>
    </Node>,
  );

  view.add(
    <TreeBoard
      ref={tree}
      x={0}
      y={20}
      opacity={0}
      nodeWidth={160}
      nodeHeight={72}
      hGap={48}
      vGap={56}
      fontSize={28}
      tree={{
        label: '数字 2',
        color: CONTENT,
        children: [
          {label: '二', color: FORM},
          {label: '贰', color: '#f0a060'},
          {label: 'Two', color: '#c084fc'},
          {label: 'II', color: '#5ec8ff'},
        ],
      }}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);

  // 1) 中央两框淡入
  yield* all(
    leftBox().opacity(1, 0.4, easeOutCubic),
    leftBox().scale(1, 0.45, easeOutBack),
    rightBox().opacity(1, 0.4, easeOutCubic),
    rightBox().scale(1, 0.45, easeOutBack),
  );
  yield* waitFor(0.2);

  // 2) 不等号弹出
  yield* all(
    neq().opacity(1, 0.3, easeOutCubic),
    neq().scale(1.15, 0.35, easeOutBack),
  );
  yield* neq().scale(1, 0.15, easeOutCubic);
  yield* waitFor(0.15);

  // 3) 仅不等号左右摇晃，强调「内容 ≠ 表示」
  const shakeAmp = 22;
  const shakeT = 0.07;
  for (let i = 0; i < 3; i++) {
    yield* neq().x(shakeAmp, shakeT, easeInOutCubic);
    yield* neq().x(-shakeAmp, shakeT * 2, easeInOutCubic);
    yield* neq().x(0, shakeT, easeInOutCubic);
  }
  // 再轻轻放大一次不等号
  yield* all(
    neq().scale(1.25, 0.2, easeOutCubic),
    neq().fill('#ff8a8a', 0.2, easeOutCubic),
  );
  yield* all(
    neq().scale(1, 0.2, easeOutCubic),
    neq().fill(NEQ, 0.2, easeOutCubic),
  );
  yield* waitFor(0.35);

  // 4) 整体上移，腾出下方给树
  yield* pair().y(-280, 0.7, easeInOutCubic);
  yield* waitFor(0.2);

  // 5) 展开「数字 2」多种表示方式树
  tree().opacity(1);
  yield* tree().reveal();
  yield* waitFor(1.5);
});
