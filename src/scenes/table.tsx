import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {DataTable, TableCell} from '../components/table/data_table';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';

// ───────── 可配置：IEEE 754 基本格式对照 ─────────
const HEADERS = ['项目', '单精度 binary32', '双精度 binary64'];

const COLUMN_WIDTHS = [320, 420, 420];

const ROWS: TableCell[][] = [
  ['总位数', '32', '64'],
  ['符号位 S', '1', '1'],
  ['指数位 E', '8', '11'],
  ['尾数位 M', '23', '52'],
  ['指数偏置 bias', '127', '1023'],
  [
    '指数范围',
    {tex: '-126\\sim +127'},
    {tex: '-1022\\sim +1023'},
  ],
  [
    '机器精度 ε',
    {tex: '2^{-23}\\approx 1.19\\times 10^{-7}'},
    {tex: '2^{-52}\\approx 2.22\\times 10^{-16}'},
  ],
];
// ────────────────────────────────────────────────

/**
 * 通用表格演示：表头入场 → 数据行依次滑入。
 * 示例数据为 IEEE 754 单/双精度格式定义（上方常量可改）。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const table = createRef<DataTable>();

  view.add(<SceneTitle ref={title} text={'IEEE 754 · 基本格式'} />);
  view.add(
    <DataTable
      ref={table}
      headers={HEADERS}
      rows={ROWS}
      columnWidths={COLUMN_WIDTHS}
      totalWidth={COLUMN_WIDTHS.reduce((a, b) => a + b, 0)}
      rowHeight={68}
      headerSize={28}
      cellSize={26}
      rowBeat={0.3}
      y={36}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* table().run();
  yield* waitFor(1);
  // 高亮「单精度 binary32」列（第 2 列，下标 1）
  yield* table().highlightColumn(1);
  yield* waitFor(1.5);
});
