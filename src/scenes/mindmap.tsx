import {Circle, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

/** —— 可配置：根节点与各级子节点 —— */
const ROOT = '二进制';
const CHILDREN = ['🔋晶体管', '🔢布尔代数', '💡门电路', '💬信息论'] as const;

/** 子节点到中心的距离 */
const RADIUS = 280;
/** 第一个子节点起始角（度，0=右，逆时针；-90=正上） */
const START_DEG = -90;

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE = '#2a3a4c';
const EDGE = '#3a4d63';

/** 径向思维导图：根居中，二级节点环绕 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const rootBox = createRef<Rect>();
  const rootTxt = createRef<Txt>();
  const edges = createRefArray<Line>();
  const childBoxes = createRefArray<Rect>();
  const childTxts = createRefArray<Txt>();
  const hubs = createRefArray<Circle>();

  const n = CHILDREN.length;
  const childPos = CHILDREN.map((_, i) => {
    const deg = START_DEG + (360 / n) * i;
    const rad = (deg * Math.PI) / 180;
    return new Vector2(Math.cos(rad) * RADIUS, Math.sin(rad) * RADIUS);
  });

  // 连线（先画，压在节点下）
  for (const pos of childPos) {
    view.add(
      <Line
        ref={edges}
        points={[Vector2.zero, pos]}
        stroke={EDGE}
        lineWidth={2}
        lineCap={'round'}
        end={0}
        opacity={0.9}
      />,
    );
  }

  // 子节点靠近根一侧的小枢纽点
  for (const pos of childPos) {
    const hub = pos.mul(0.18);
    view.add(
      <Circle
        ref={hubs}
        position={hub}
        size={8}
        fill={ACCENT}
        opacity={0}
      />,
    );
  }

  // 二级节点
  for (let i = 0; i < n; i++) {
    view.add(
      <Rect
        ref={childBoxes}
        layout
        position={childPos[i]}
        padding={[16, 28]}
        fill={DEEP}
        stroke={LINE}
        lineWidth={2}
        radius={10}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={childTxts}
          text={CHILDREN[i]}
          fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
          fontSize={32}
          fill={PAPER}
        />
      </Rect>,
    );
  }

  // 根节点
  view.add(
    <Rect
      ref={rootBox}
      layout
      padding={[22, 40]}
      fill={DEEP}
      stroke={ACCENT}
      lineWidth={2.5}
      radius={12}
      opacity={0}
      scale={0.88}
    >
      <Txt
        ref={rootTxt}
        text={ROOT}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={44}
        fontWeight={700}
        fill={PAPER}
      />
    </Rect>,
  );

  // 根入场
  yield* all(
    rootBox().opacity(1, 0.45, easeOutCubic),
    rootBox().scale(1, 0.55, easeOutCubic),
  );
  yield* waitFor(0.2);

  // 连线 + 子节点依次展开
  for (let i = 0; i < n; i++) {
    yield* all(
      hubs[i].opacity(0.9, 0.2, easeOutCubic),
      edges[i].end(1, 0.4, easeInOutCubic),
      delay(
        0.12,
        all(
          childBoxes[i].opacity(1, 0.35, easeOutCubic),
          childBoxes[i].scale(1, 0.4, easeOutCubic),
        ),
      ),
    );
    yield* waitFor(0.12);
  }

  // 轻量定格强调：子节点描边依次点亮
  for (let i = 0; i < n; i++) {
    yield* childBoxes[i].stroke(ACCENT, 0.25, easeOutCubic);
    yield* waitFor(0.35);
    yield* childBoxes[i].stroke(LINE, 0.25, easeInOutCubic);
  }

  yield* waitFor(0.8);
});
