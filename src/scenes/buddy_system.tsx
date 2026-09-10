import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { BuddyRoot } from "../components/buddy/buddy_root";

/** 整体放慢约 2 倍，便于看清分裂 / 分配 / 回收 */
const T = 2;

/**
 * Linux 伙伴系统演示：alloc 分配 → free 回收合并
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const buddy = createRef<BuddyRoot>();
  view.add(
    <BuddyRoot
      ref={buddy}
      order={3}
      pageSize={0x1000}
      start={0x0000}
      canvasWidth={view.width()}
      sideMargin={220}
      barHeight={48}
      levelGap={76}
      siblingGap={8}
      fontSize={16}
    />,
  );

  yield* waitFor(0.6 * T);
  yield* buddy().showOrder();
  yield* waitFor(0.5 * T);

  // 申请 7KB：显示 7KB < 32KB → 分裂… → 7KB ≤ 8KB → 占用
  yield* buddy().alloc(7);
  const blockA = buddy().lastAllocated;
  yield* waitFor(0.7 * T);

  // 再申请 3KB
  yield* buddy().alloc(3);
  const blockB = buddy().lastAllocated;
  yield* waitFor(0.7 * T);

  // 释放先分配的块（可能触发 buddy 合并）
  if (blockA) {
    yield* buddy().free(blockA);
    yield* waitFor(0.6 * T);
  }

  // 释放另一块，继续向上合并
  if (blockB) {
    yield* buddy().free(blockB);
    yield* waitFor(1 * T);
  }
});
