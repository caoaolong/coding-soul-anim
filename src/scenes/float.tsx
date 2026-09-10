import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { Float } from "../components/float/float";

/**
 * float32 位布局演示：分段标注 + setValue + 分段高亮
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const f = createRef<Float>();
  view.add(
    <Float
      ref={f}
      value={-12.375}
      cellSize={36}
      gap={3}
      sectionGap={14}
    />,
  );

  yield* waitFor(0.6);

  // 三段上方花括号：Sign / Exponent / Mantissa
  yield* f().showLabels();
  yield* waitFor(0.5);

  yield* f().highlight("sign", true);
  yield* waitFor(0.3);
  yield* f().highlight("exponent", true);
  yield* waitFor(0.3);
  yield* f().highlight("mantissa", true);
  yield* waitFor(0.6);

  // 下方解码公式
  yield* f().showFormula();
  yield* waitFor(0.8);

  yield* f().setValue(1.0);
  yield* waitFor(0.8);
  yield* f().setValue(0.1);
  yield* waitFor(1);
});
