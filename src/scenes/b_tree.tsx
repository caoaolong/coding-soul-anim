import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { makeScene2D } from "@motion-canvas/2d";
import { BTree } from "../components/tree/b_tree";

export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const tree = createRef<BTree>();
  view.add(<BTree ref={tree} L={4} nodeSize={72} spacing={36} />);

  // 动画控制
  yield* tree().create(0.6);
  yield* tree().rowNumber(0.4);
  yield* tree().rowCount(0.4);
  yield* tree().highlightLeaves(true);
  yield* tree().highlightNonLeaves(true);
  yield* tree().index();
  yield* waitFor(1);
});
