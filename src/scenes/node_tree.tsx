import {Img, Latex, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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

import iconFlip from '../assets/抛硬币.svg';
import iconHeads from '../assets/硬币正面.svg';
import iconTails from '../assets/硬币反面.svg';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE = '#2a3a4c';
/** 概率标注高亮色（金色，醒目） */
const BADGE = '#FFDC51';
const BADGE_BG = '#2a2208';

const ROOT_POS = new Vector2(0, -220);
const CHILD_Y = 180;
const CHILD_GAP = 280;
/** 子节点右上角标注相对卡片中心的偏移 */
const BADGE_OFFSET = new Vector2(108, -92);

type TreeItem = {
  label: string;
  icon: string;
  position: Vector2;
};

/**
 * 树场景：根在上、子在下，直角连线；节点为上图下文。
 * 展开完成后在每个子节点右上角标注 p=1/2。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const rootBox = createRef<Rect>();
  const childBoxes = createRefArray<Rect>();
  const wires = createRefArray<Line>();
  const badges = createRefArray<Rect>();

  const root: TreeItem = {
    label: '抛硬币',
    icon: iconFlip,
    position: ROOT_POS,
  };
  const children: TreeItem[] = [
    {
      label: '正面',
      icon: iconHeads,
      position: new Vector2(-CHILD_GAP / 2, CHILD_Y),
    },
    {
      label: '反面',
      icon: iconTails,
      position: new Vector2(CHILD_GAP / 2, CHILD_Y),
    },
  ];

  view.add(<SceneTitle ref={title} text={'事件树'} />);

  // 直角连线：根底 → 竖干 → 横梁 → 落子
  const busY = (ROOT_POS.y + CHILD_Y) / 2;
  for (const child of children) {
    view.add(
      <Line
        ref={wires}
        points={[
          [ROOT_POS.x, ROOT_POS.y + 70],
          [ROOT_POS.x, busY],
          [child.position.x, busY],
          [child.position.x, child.position.y - 70],
        ]}
        stroke={ACCENT}
        lineWidth={3}
        lineCap={'round'}
        lineJoin={'miter'}
        end={0}
        opacity={0.75}
      />,
    );
  }

  view.add(makeNode(rootBox, root));

  for (const child of children) {
    view.add(makeNode(childBoxes, child));
  }

  // 子节点右上角概率标注（展开后再显现）
  for (const child of children) {
    view.add(
      <Rect
        ref={badges}
        layout
        position={child.position.add(BADGE_OFFSET)}
        padding={[8, 14]}
        fill={BADGE_BG}
        stroke={BADGE}
        lineWidth={2.5}
        radius={10}
        opacity={0}
        scale={0.75}
      >
        <Latex tex={['p = \\dfrac{1}{2}']} fill={BADGE} fontSize={30} />
      </Rect>,
    );
  }

  yield* title().show();

  // 根入场
  yield* all(
    rootBox().opacity(1, 0.4, easeOutCubic),
    rootBox().scale(1, 0.5, easeOutCubic),
  );
  yield* waitFor(0.2);

  // 连线 + 子节点
  yield* all(
    ...wires.map((w, i) =>
      all(
        w.end(1, 0.55, easeInOutCubic),
        delay(
          0.25,
          all(
            childBoxes[i].opacity(1, 0.4, easeOutCubic),
            childBoxes[i].scale(1, 0.45, easeOutCubic),
          ),
        ),
      ),
    ),
  );

  yield* waitFor(0.35);

  // 右上角 LaTeX 标注依次弹出
  for (let i = 0; i < badges.length; i++) {
    yield* all(
      badges[i].opacity(1, 0.35, easeOutCubic),
      badges[i].scale(1.08, 0.35, easeOutCubic),
    );
    yield* badges[i].scale(1, 0.2, easeInOutCubic);
    yield* waitFor(0.15);
  }

  yield* waitFor(1.2);
});

function makeNode(
  ref: ReturnType<typeof createRef<Rect>> | ReturnType<typeof createRefArray<Rect>>,
  item: TreeItem,
) {
  return (
    <Rect
      ref={ref}
      layout
      direction={'column'}
      alignItems={'center'}
      gap={10}
      padding={[18, 22]}
      position={item.position}
      fill={DEEP}
      stroke={LINE}
      lineWidth={2}
      radius={14}
      opacity={0}
      scale={0.88}
    >
      <Img src={item.icon} width={88} height={88} />
      <Txt
        text={item.label}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={28}
        fontWeight={700}
        fill={PAPER}
      />
    </Rect>
  );
}
