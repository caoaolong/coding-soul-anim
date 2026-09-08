import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { ComplexityPlot } from "../components/plot/complexity_plot";

/**
 * 算法时间复杂度对比：轴 + 图注 → 多曲线同时描线
 */
export default makeScene2D(function* (view) {
  view.fill("#121212");

  const plot = createRef<ComplexityPlot>();
  view.add(
    <ComplexityPlot
      ref={plot}
      complexities={["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"]}
      nMax={16}
      width={780}
      height={500}
    />,
  );

  yield* waitFor(0.3);
  yield* plot().play();
  yield* waitFor(1.2);
});
