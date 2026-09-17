import { Img, makeScene2D, View2D } from "@motion-canvas/2d";
import { ThreadGenerator, createRef, waitFor } from "@motion-canvas/core";
import { Grid } from "../components/grid/grid";
import { CourseCover } from "../components/intro/course_cover";
import { Ink } from "../theme/ink";

import sceneBg from "../assets/bg.png";

/** 全场景共用背景透明度：压得很淡以呈若隐若现 */
const SCENE_BG_OPACITY = 0.08;

/**
 * 万象归一：向量
 *
 * 整集拆成多段素材单独导出：只改下面 ACTIVE 即可切换要渲染的段。
 * 新增段：写 playXxx → 加入 SegmentId → 登记到 segments。
 */
type SegmentId = "cover" | "introduction";

/** 改这一行切换要导出的素材段 */
const ACTIVE = "introduction" as SegmentId;

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
 * 引言：两格图文（暂无 placeholder，后续可换成真实素材）
 */
function* playIntroduction(view: View2D): ThreadGenerator {
  const grid = createRef<Grid>();
  view.add(
    <Grid
      ref={grid}
      columns={2}
      cellWidth={420}
      gap={80}
      fontSize={36}
      items={[
        { label: "方向与大小" },
        { label: "坐标表示" },
      ]}
    />,
  );

  yield* grid().play(0.5, 0.3);
  yield* waitFor(1.2);
}

const segments: Record<SegmentId, (view: View2D) => ThreadGenerator> = {
  cover: playCover,
  introduction: playIntroduction,
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
