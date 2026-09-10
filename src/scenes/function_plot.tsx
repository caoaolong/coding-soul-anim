import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { FunctionPlot } from "../components/plot/function_plot";

/**
 * ???????????y = sin(x)?x ? [0, ?]
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const plot = createRef<FunctionPlot>();
  view.add(
    <FunctionPlot
      ref={plot}
      fn={(x) => Math.sin(x)}
      xMin={0}
      xMax={Math.PI}
      width={900}
      height={480}
      samples={240}
    />,
  );

  yield* waitFor(0.4);
  yield* plot().trace(1.6);
  yield* waitFor(1.2);
});
