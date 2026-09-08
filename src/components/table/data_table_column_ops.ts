import { Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  easeInOutCubic,
} from "@motion-canvas/core";
import {
  DataTableCell,
  createHeaderCell,
} from "./data_table_cell";
import { resolveColumnIndex } from "./data_table_layout";
import {
  ColumnState,
  DataTableOpsContext,
  snapShellWidths,
  syncShellWidths,
} from "./data_table_ops_context";

export interface UpdateDataOptions {
  duration?: number;
  columns?: Array<string | number>;
}

export interface ColumnAnimOptions {
  duration?: number;
  width?: number;
}

/** 批量更新单元格：淡出 → 改字 → 淡入 */
export function* updateData(
  ctx: DataTableOpsContext,
  nextRows: string[][],
  getCellTxt: (row: number, col: number) => Txt | null,
  options: UpdateDataOptions = {},
): ThreadGenerator {
  const { duration = 0.55, columns } = options;
  if (nextRows.length !== ctx.currentRows.length) {
    throw new Error(
      `DataTable.updateData: 行数不一致 (${nextRows.length} vs ${ctx.currentRows.length})`,
    );
  }

  const colFilter =
    columns === undefined
      ? null
      : new Set(columns.map((c) => resolveColumnIndex(ctx.headers, c)));

  type Target = { txt: Txt; next: string };
  const targets: Target[] = [];
  const seen = new Set<Txt>();

  for (let r = 0; r < nextRows.length; r++) {
    for (let c = 0; c < ctx.headers.length; c++) {
      if (colFilter && !colFilter.has(c)) continue;
      const txt = getCellTxt(r, c);
      if (!txt) continue;
      const next = nextRows[r][c] ?? "";
      const prev = ctx.currentRows[r][c] ?? "";
      if (next === prev) continue;
      if (seen.has(txt)) continue;
      seen.add(txt);
      targets.push({ txt, next });
    }
  }

  ctx.currentRows.splice(
    0,
    ctx.currentRows.length,
    ...nextRows.map((row) => [...row]),
  );
  if (targets.length === 0) return;

  const half = duration / 2;
  yield* all(
    ...targets.map(({ txt }) => txt.opacity(0, half, easeInOutCubic)),
  );
  for (const t of targets) t.txt.text(t.next);
  yield* all(
    ...targets.map(({ txt }) => txt.opacity(1, half, easeInOutCubic)),
  );
}

/** 表尾追加一列 */
export function* addColumn(
  ctx: DataTableOpsContext,
  header: string,
  data: string[],
  options: ColumnAnimOptions = {},
): ThreadGenerator {
  const { duration = 0.55, width = ctx.defaultColumnWidth } = options;
  if (data.length !== ctx.rowCount) {
    throw new Error(
      `DataTable.addColumn: data 长度 ${data.length} 与行数 ${ctx.rowCount} 不一致`,
    );
  }
  if (ctx.headers.includes(header)) {
    throw new Error(`DataTable.addColumn: 列 "${header}" 已存在`);
  }

  const headerCell = createHeaderCell({
    text: header,
    width: 0,
    height: ctx.rowHeight,
    fill: ctx.headerFill,
    stroke: ctx.stroke,
    lineWidth: ctx.cellLine,
    textFill: ctx.headerTextColor,
    fontSize: ctx.fontSize,
    fontFamily: ctx.fontFamily,
    cellPaddingX: ctx.cellPaddingX,
    padding: 0,
    opacity: 0,
  });
  ctx.headerRow.add(headerCell);

  const cells: Array<DataTableCell | undefined> = new Array(ctx.rowCount);
  for (let r = 0; r < ctx.rowCount; r++) {
    const cell = new DataTableCell({
      text: data[r] ?? "",
      width: 0,
      height: ctx.rowHeight,
      fill: ctx.rowFill(r),
      stroke: ctx.stroke,
      lineWidth: ctx.cellLine,
      textFill: ctx.textColor,
      fontSize: ctx.fontSize,
      fontFamily: ctx.fontFamily,
      cellPaddingX: ctx.cellPaddingX,
      padding: 0,
      opacity: 0,
    });
    ctx.dataRowLayouts[r].add(cell);
    cells[r] = cell;
  }

  const column: ColumnState = {
    header,
    width: 0,
    headerCell,
    cells,
    groupCells: [],
    isGroup: false,
  };
  ctx.columns.push(column);
  ctx.headers.push(header);
  for (let r = 0; r < ctx.rowCount; r++) {
    ctx.currentRows[r].push(data[r] ?? "");
  }

  column.width = width;
  yield* all(
    headerCell.expandWidth(width, duration),
    ...cells.map((cell) => cell!.expandWidth(width, duration)),
    syncShellWidths(ctx, duration),
  );
}

/** 删除指定列 */
export function* removeColumn(
  ctx: DataTableOpsContext,
  header: string | number,
  options: ColumnAnimOptions = {},
): ThreadGenerator {
  const { duration = 0.55 } = options;
  const col = resolveColumnIndex(ctx.headers, header);
  const column = ctx.columns[col];
  if (column.isGroup || ctx.groupCol === col) {
    throw new Error(`DataTable.removeColumn: 不能删除分组列`);
  }

  column.width = 0;
  yield* all(
    column.headerCell.collapseWidth(duration),
    ...column.cells
      .filter(Boolean)
      .map((cell) => cell!.collapseWidth(duration)),
    syncShellWidths(ctx, duration),
  );

  column.headerCell.remove();
  for (const cell of column.cells) {
    cell?.remove();
  }

  ctx.columns.splice(col, 1);
  ctx.headers.splice(col, 1);
  for (const row of ctx.currentRows) {
    row.splice(col, 1);
  }
  snapShellWidths(ctx);
}
