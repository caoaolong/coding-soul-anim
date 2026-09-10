import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { CourseCover } from "../components/intro/course_cover";

/**
 * 封面片头演示：云开见字
 * 每集只需改 episodeTitle
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const cover = createRef<CourseCover>();
  view.add(
    <CourseCover
      ref={cover}
      episodeTitle={"浮点数与 IEEE 754"}
      bgHeight={view.height()}
    />,
  );

  yield* cover().play();
  yield* waitFor(1.2);
  yield* cover().hide(0.6);
  yield* waitFor(0.4);
});
