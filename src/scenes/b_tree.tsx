import { createRef, waitFor } from "@motion-canvas/core";
import { makeScene2D } from "@motion-canvas/2d";
import { BTree } from "../components/b_tree";

export default makeScene2D(function* (view) {
  view.fill("#121212");

  const tree = createRef<BTree>();
  view.add(<BTree ref={tree} L={3} />);

  // 动画控制
  yield* tree().create(0.6);
  yield* waitFor(1);
});
