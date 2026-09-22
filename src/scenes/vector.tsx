import { Img, makeScene2D, View2D } from "@motion-canvas/2d";
import { ThreadGenerator, all, createRef, waitFor } from "@motion-canvas/core";
import { Axes2D } from "../components/axis/axes_2d";
import { InkFormula } from "../components/formula/ink_formula";
import { Grid } from "../components/grid/grid";
import { CourseCover } from "../components/intro/course_cover";
import { MindMap } from "../components/mindmap/mindmap";
import { Axes3D } from "../components/three/axes_3d";
import { SimpleTimeline } from "../components/timeline/simple_timeline";
import { ColumnVectors } from "../components/vector/column_vectors";
import { PrimaryColors } from "../components/color/primary_colors";
import { Palette } from "../components/color/palette";
import { Ink } from "../theme/ink";

import sceneBg from "../assets/bg.png";
import appleImg from "../assets/vector/苹果.webp";
import watchImg from "../assets/vector/手表.png";
import brainImg from "../assets/vector/大脑.svg";
import computerImg from "../assets/vector/计算机.svg";

/** 全场景共用背景透明度：压得很淡以呈若隐若现 */
const SCENE_BG_OPACITY = 0.08;

/**
 * 万象归一：向量
 *
 * 整集拆成多段素材单独导出：只改下面 ACTIVE 即可切换要渲染的段。
 * 新增段：写 playXxx → 加入 SegmentId → 登记到 segments。
 */
type SegmentId =
  | "cover"
  | "introduction"
  | "mindmap"
  | "cv_timeline"
  | "vector2d"
  | "vector3d"
  | "column_vectors"
  | "color";

/** 改这一行切换要导出的素材段 */
const ACTIVE = "color" as SegmentId;

/** 片头自带不透明背景，其余段用淡墨共用底图 */
function useSharedSceneBg(segment: SegmentId): boolean {
  return segment !== "cover";
}

/** 片头：CourseCover */
function* playCover(view: View2D): ThreadGenerator {
  const cover = createRef<CourseCover>();
  view.add(
    <CourseCover
      ref={cover}
      series="算法之道"
      episodeTitle={"万象归一：向量"}
      bgHeight={view.height()}
      bgOpacity={1}
    />,
  );

  yield* cover().play();
}

/**
 * 引言：先出两图（问号），再逐格揭晓文案
 */
function* playIntroduction(view: View2D): ThreadGenerator {
  const grid = createRef<Grid>();
  view.add(
    <Grid
      ref={grid}
      columns={2}
      cellWidth={240}
      gap={64}
      fontSize={30}
      items={[
        { image: appleImg, label: "?" },
        { image: watchImg, label: "?" },
      ]}
    />,
  );

  yield* grid().play(0.5, 0.3);
  yield* waitFor(0.45);
  yield* grid().updateCell(0, { label: "苹果" });
  yield* waitFor(0.25);
  yield* grid().updateCell(1, { label: "手表" });
  yield* waitFor(1.0);
}

/**
 * 思维导图：根「大脑」→ 特征 →「苹果」→ 主节点换成「计算机」
 */
function* playMindmap(view: View2D): ThreadGenerator {
  const map = createRef<MindMap>();
  view.add(
    <MindMap
      ref={map}
      root={{ icon: brainImg, label: "大脑" }}
      iconSize={96}
      fontSize={34}
      branchGap={380}
      childGap={92}
      edgePadding={40}
    />,
  );

  yield* map().showRoot(0.55);
  yield* waitFor(0.3);
  yield* map().addChildren(
    [
      { label: "红色" },
      { label: "手掌大小" },
      { label: "类圆形" },
      { label: "表面光滑" },
      { label: "红绿相间" },
    ],
    0.5,
    0.22,
  );
  yield* waitFor(0.35);
  yield* map().addResult({ icon: appleImg, label: "苹果" }, 0.6);
  yield* waitFor(0.45);
  yield* map().updateNode("root", {
    icon: computerImg,
    label: "计算机",
  });
  yield* waitFor(1.0);
}

/**
 * 计算机视觉简史：横向时间轴自右向左推进，屏心聚焦；结束后上方点题「向量」
 */
function* playCvTimeline(view: View2D): ThreadGenerator {
  const timeline = createRef<SimpleTimeline>();
  const title = createRef<InkFormula>();
  view.add(
    <SimpleTimeline
      ref={timeline}
      spacing={320}
      timeFontSize={44}
      briefFontSize={30}
      events={[
        { time: "1966", brief: "计算机视觉诞生" },
        { time: "1982", brief: "Marr：视觉理论" },
        { time: "1999", brief: "SIFT：人工设计特征" },
        { time: "2009", brief: "ImageNet：大规模数据" },
        { time: "2012", brief: "AlexNet：机器学习特征" },
        { time: "2020", brief: "ViT：Transformer进入视觉" },
      ]}
    />,
  );
  view.add(
    <InkFormula
      ref={title}
      tex={"\\,"}
      fontSize={72}
      y={-320}
    />,
  );

  yield* timeline().play(2.35);
  yield* waitFor(0.35);
  yield* title().writePlain("向量", 0.55);
  yield* waitFor(1.0);
}

/**
 * 二维向量：坐标轴 + 箭头，尖端来回移动并实时显示 (X, Y)
 */
function* playVector2d(view: View2D): ThreadGenerator {
  const axes = createRef<Axes2D>();

  view.add(
    <Axes2D
      ref={axes}
      xMin={-5}
      xMax={5}
      yMin={-4}
      yMax={4}
      unit={72}
      showGrid
      caption={"二维向量"}
    />,
  );

  yield* axes().show(0.55);
  yield* waitFor(0.25);
  yield* axes().showVector(3, 2, 0.6);
  yield* waitFor(0.3);

  // 来回移动，坐标实时刷新
  yield* axes().travel(
    [
      [1.5, 3],
      [4, 1],
      [2, -1.5],
      [3, 2],
    ],
    1.0,
    0.12,
  );
  yield* waitFor(0.8);
}

/**
 * 三维向量：Axes3D + 箭头生长画出，尖端路径移动并实时显示 (X, Y, Z)；
 * 相机绕原点环视（始终 lookAt 原点）
 */
function* playVector3d(view: View2D): ThreadGenerator {
  const axes = createRef<Axes3D>();

  view.add(
    <Axes3D
      ref={axes}
      width={960}
      height={720}
      size={4}
      showGrid
      gridDivisions={8}
      caption={"三维向量"}
      opacity={0}
    />,
  );

  yield* axes().show(0.55);
  yield* waitFor(0.25);
  yield* axes().showVector(2, 2.5, 1.5, 0.6);
  yield* waitFor(0.3);

  // 向量尖端移动的同时，相机绕原点匀速慢转（约 2.5 倍行程时长转一圈）
  const path: Array<[number, number, number]> = [
    [1, 3, 2],
    [3, 1, -1],
    [2, -1, 2.5],
    [2, 2.5, 1.5],
  ];
  const stepDuration = 1.0;
  const hold = 0.12;
  const travelDuration = path.length * (stepDuration + hold);
  const orbitDuration = travelDuration * 2.5;

  yield* all(
    axes().orbit(orbitDuration),
    axes().travel(path, stepDuration, hold),
  );
  yield* waitFor(0.8);
}

/**
 * 列向量：先横向排出列式，再上方点题 Xₙ∈ℝⁿˣ¹
 */
function* playColumnVectors(view: View2D): ThreadGenerator {
  const title = createRef<InkFormula>();
  const vectors = createRef<ColumnVectors>();

  view.add(
    <InkFormula
      ref={title}
      tex={String.raw`X_n \in \mathbb{R}^{n \times 1}`}
      fontSize={52}
      y={-260}
    />,
  );
  view.add(
    <ColumnVectors
      ref={vectors}
      fontSize={48}
      gap={200}
      y={40}
      vectors={[
        { name: String.raw`N_{2}`, values: [1, 1] },
        { name: String.raw`N_{3}`, values: [1, 1, 1] },
        { name: String.raw`N_{4}`, values: [1, 1, 1, 1] },
      ]}
    />,
  );

  yield* vectors().play(0.55, 0.4);
  yield* waitFor(0.35);
  yield* title().write(0.55);
  yield* waitFor(1.2);
}

/**
 * 三原色 → 调色板：叠圆加色显白后，三原色左出与 PS 色盘右入同时进行
 */
function* playColor(view: View2D): ThreadGenerator {
  const colors = createRef<PrimaryColors>();
  const palette = createRef<Palette>();

  view.add(<PrimaryColors ref={colors} radius={170} />);
  view.add(<Palette ref={palette} size={300} />);

  yield* colors().play(0.55, 0.35);
  yield* waitFor(0.8);
  yield* all(
    colors().exitLeft(0.75, 560),
    palette().enterFromRight(0.75, 560),
  );
  yield* waitFor(0.25);
  yield* palette().showRgb(0.5);
  yield* waitFor(0.2);
  // 色相横条：顶→底→顶，略慢
  yield* palette().animateHue(1, 3.2, 0);
  yield* palette().animateHue(0, 3.2);
  yield* waitFor(0.8);
}

const segments: Record<SegmentId, (view: View2D) => ThreadGenerator> = {
  cover: playCover,
  introduction: playIntroduction,
  mindmap: playMindmap,
  cv_timeline: playCvTimeline,
  vector2d: playVector2d,
  vector3d: playVector3d,
  column_vectors: playColumnVectors,
  color: playColor,
};

const vectorScene = makeScene2D(function* (view) {
  view.fill(Ink.bg);
  if (useSharedSceneBg(ACTIVE)) {
    view.add(
      <Img src={sceneBg} height={view.height()} opacity={SCENE_BG_OPACITY} />,
    );
  }
  yield* segments[ACTIVE](view);
});

export default vectorScene;
