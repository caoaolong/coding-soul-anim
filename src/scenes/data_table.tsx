import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { DataTable } from "../components/table/data_table";

function hex(addr: number, digits = 4): string {
  return `0x${addr.toString(16).toUpperCase().padStart(digits, "0")}`;
}

function bin(addr: number, bits = 16): string {
  return `0b${addr.toString(2).padStart(bits, "0")}`;
}

type BuddyRow = {
  order: number;
  start: number;
  end: number;
  size: number;
};

/**
 * 与 buddy_system 场景一致：order=3, pageSize=0x1000, start=0x0000
 */
function buddyBlocks(
  rootOrder = 3,
  pageSize = 0x1000,
  start = 0x0000,
): BuddyRow[] {
  const rows: BuddyRow[] = [];
  for (let order = rootOrder; order >= 0; order--) {
    const size = pageSize << order;
    const count = 1 << (rootOrder - order);
    for (let i = 0; i < count; i++) {
      const blockStart = start + i * size;
      rows.push({
        order,
        start: blockStart,
        end: blockStart + size - 1,
        size,
      });
    }
  }
  return rows;
}

/**
 * 表格演示：删除 blockEnd → 添加 blockSize → 全部改为二进制
 */
export default makeScene2D(function* (view) {
  view.fill("#121212");

  const blocks = buddyBlocks();
  const hexRows = blocks.map((b) => [
    String(b.order),
    hex(b.start),
    hex(b.end),
  ]);
  const blockSizesHex = blocks.map((b) => hex(b.size));
  // remove + add 之后列顺序：order / blockStart / blockSize
  const binRows = blocks.map((b) => [
    String(b.order),
    bin(b.start),
    bin(b.size),
  ]);

  const table = createRef<DataTable>();
  view.add(
    <DataTable
      ref={table}
      headers={["order", "blockStart", "blockEnd"]}
      rows={hexRows}
      group="order"
      stripeEvery={2}
      columnWidths={[100, 340, 340]}
      defaultColumnWidth={340}
      fontSize={18}
      rowHeight={46}
    />,
  );

  yield* waitFor(0.8);

  yield* table().removeColumn("blockEnd", { duration: 0.65 });
  yield* waitFor(0.45);

  yield* table().addColumn("blockSize", blockSizesHex, {
    width: 340,
    duration: 0.65,
  });
  yield* waitFor(0.45);

  yield* table().updateData(binRows, { duration: 0.7 });
  yield* waitFor(0.5);

  yield* table().deleteGroup(3, { highlight: true });
  yield* waitFor(0.5);

  // stripeEvery=2：order=2 的两行同色 → 先标第一行 blockStart+blockSize，再标第二行 blockStart
  yield* table().annotateCells([
    { row: 0, column: "blockStart" },
    { row: 0, column: "blockSize" },
  ]);
  yield* waitFor(0.25);
  yield* table().annotateCells([{ row: 1, column: "blockStart" }]);
  yield* waitFor(1.2);
});
