import { makeScene2D, View2D } from "@motion-canvas/2d";
import { ThreadGenerator, createRef } from "@motion-canvas/core";
import { CourseCover } from "../components/intro/course_cover";
import { Ink } from "../theme/ink";

/**
 * 万象归一：向量
 *
 * 整集拆成多段素材单独导出：只改下面 ACTIVE 即可切换要渲染的段。
 * 新增段：写 playXxx → 加入 SegmentId → 登记到 segments。
 */
type SegmentId = "cover";

/** 改这一行切换要导出的素材段 */
const ACTIVE = "cover" as SegmentId;

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

const segments: Record<SegmentId, (view: View2D) => ThreadGenerator> = {
  cover: playCover,
};

const vectorScene = makeScene2D(function* (view) {
  view.fill(Ink.bg);
  yield* segments[ACTIVE](view);
});

export default vectorScene;
