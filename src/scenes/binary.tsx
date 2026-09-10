import { makeScene2D } from "@motion-canvas/2d";
import { createRef } from "@motion-canvas/core";
import { CourseCover } from "../components/intro/course_cover";
import { Ink } from "../theme/ink";

/**
 * 大道至简：二进制 — 片头（CourseCover）
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const cover = createRef<CourseCover>();
  view.add(
    <CourseCover
      ref={cover}
      episodeTitle={"大道至简：二进制"}
      bgHeight={view.height()}
    />,
  );

  yield* cover().play();
});
