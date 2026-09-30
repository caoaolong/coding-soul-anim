import {Circle, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';

/** —— 可配置：根节点与各级子节点 —— */
const ROOT = '二进制';

type GroupId = 'theory' | 'circuit';
type EnterMode = 'group' | 'sequential';

/** 二级节点：label + 颜色 + 分组 */
const CHILDREN = [
  {label: '🔋晶体管', color: '#3dd6c6', group: 'circuit' as GroupId},
  {label: '🔢布尔代数', color: '#7aa2ff', group: 'theory' as GroupId},
  {label: '💡门电路', color: '#3dd6c6', group: 'circuit' as GroupId},
  {label: '💬信息论', color: '#7aa2ff', group: 'theory' as GroupId},
] as const;

/**
 * 子节点入场模式：
 * - sequential：单个节点依次入场（按 CHILDREN 顺序）
 * - group：同组同时入场，组间按 GROUP_ORDER
 */
const ENTER_MODE = 'group' as EnterMode;
/** 分组入场顺序（仅 group 模式） */
const GROUP_ORDER: GroupId[] = ['theory', 'circuit'];

/** 子节点到中心的距离 */
const RADIUS = 280;
/** 第一个子节点起始角（度，0=右，逆时针；-90=正上） */
const START_DEG = -90;

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';

/** 径向思维导图：根居中，二级节点环绕 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  view.add(<SceneTitle ref={title} text={'思维导图'} />);

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
  for (let i = 0; i < n; i++) {
    view.add(
      <Line
        ref={edges}
        points={[Vector2.zero, childPos[i]]}
        stroke={CHILDREN[i].color}
        lineWidth={2}
        lineCap={'round'}
        end={0}
        opacity={0.55}
      />,
    );
  }

  // 子节点靠近根一侧的小枢纽点
  for (let i = 0; i < n; i++) {
    const hub = childPos[i].mul(0.18);
    view.add(
      <Circle
        ref={hubs}
        position={hub}
        size={8}
        fill={CHILDREN[i].color}
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
        stroke={CHILDREN[i].color}
        lineWidth={2}
        radius={10}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={childTxts}
          text={CHILDREN[i].label}
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

  /** 单个子节点入场（连线 + 枢纽 + 卡片） */
  function* enterChild(i: number): ThreadGenerator {
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
  }

  /** 一批索引同时入场 */
  function* enterBatch(indices: number[]): ThreadGenerator {
    if (indices.length === 0) return;
    yield* all(...indices.map(i => enterChild(i)));
  }

  // 根入场
  yield* title().show(0.35);
  yield* all(
    rootBox().opacity(1, 0.45, easeOutCubic),
    rootBox().scale(1, 0.55, easeOutCubic),
  );
  yield* waitFor(0.2);

  // 子节点入场
  if (ENTER_MODE === 'sequential') {
    for (let i = 0; i < n; i++) {
      yield* enterChild(i);
      yield* waitFor(0.12);
    }
  } else {
    for (const group of GROUP_ORDER) {
      const indices = CHILDREN.map((c, i) => (c.group === group ? i : -1)).filter(
        i => i >= 0,
      );
      yield* enterBatch(indices);
      yield* waitFor(0.28);
    }
  }

  // 定格强调：逐个强脉冲（放大 + 描边加粗发亮 + 连线/枢纽同步）
  const emphasizeOrder =
    ENTER_MODE === 'sequential'
      ? CHILDREN.map((_, i) => i)
      : GROUP_ORDER.flatMap(group =>
          CHILDREN.map((c, i) => (c.group === group ? i : -1)).filter(i => i >= 0),
        );

  for (const i of emphasizeOrder) {
    const color = CHILDREN[i].color;
    yield* all(
      childBoxes[i].scale(1.18, 0.28, easeOutCubic),
      childBoxes[i].lineWidth(5, 0.28, easeOutCubic),
      childBoxes[i].stroke(color, 0.28, easeOutCubic),
      childBoxes[i].fill('#1a2430', 0.28, easeOutCubic),
      childTxts[i].scale(1.08, 0.28, easeOutCubic),
      childTxts[i].fill(color, 0.28, easeOutCubic),
      edges[i].lineWidth(4.5, 0.28, easeOutCubic),
      edges[i].opacity(1, 0.28, easeOutCubic),
      hubs[i].size(16, 0.28, easeOutCubic),
      hubs[i].opacity(1, 0.28, easeOutCubic),
    );
    yield* waitFor(0.45);
    yield* all(
      childBoxes[i].scale(1, 0.3, easeInOutCubic),
      childBoxes[i].lineWidth(2, 0.3, easeInOutCubic),
      childBoxes[i].fill(DEEP, 0.3, easeInOutCubic),
      childTxts[i].scale(1, 0.3, easeInOutCubic),
      childTxts[i].fill(PAPER, 0.3, easeInOutCubic),
      edges[i].lineWidth(2, 0.3, easeInOutCubic),
      edges[i].opacity(0.55, 0.3, easeInOutCubic),
      hubs[i].size(8, 0.3, easeInOutCubic),
      hubs[i].opacity(0.9, 0.3, easeInOutCubic),
    );
    yield* waitFor(0.12);
  }

  yield* waitFor(0.8);
});
