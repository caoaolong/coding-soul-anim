import { createRef } from "@motion-canvas/core";
import { TreeNode } from "../components/tree_node";
import { makeScene2D } from "@motion-canvas/2d";

export default makeScene2D(function* (view) {
  view.fill("#121212");

  const treeNodeRef = createRef<TreeNode>();

  view.add(<TreeNode ref={treeNodeRef} y={-200} />);

  // 动画控制
  yield* treeNodeRef().y(0, 1);
});
