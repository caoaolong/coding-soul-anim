import { makeScene2D } from "@motion-canvas/2d";
import { createRef } from "@motion-canvas/core";
import { Intro } from "../components/intro/intro";

export default makeScene2D(function* (view) {
  view.fill("#121212");

  const intro = createRef<Intro>();
  view.add(
    <Intro
      ref={intro}
      episodeTitle={"字节与二进制"}
      bgHeight={view.height()}
    />,
  );

  yield* intro().play();
});
