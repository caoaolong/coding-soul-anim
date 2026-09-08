import { Layout, Rect } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  easeInOutCubic,
} from "@motion-canvas/core";
import type { Annotation } from "../annotation/annotation";
import type { DataTableCell } from "./data_table_cell";
import type { RowGroup } from "./data_table_layout";
import { stripeBand } from "./data_table_layout";

export type ColumnState = {
  header: string;
  width: number;
  headerCell: DataTableCell;
  cells: Array<DataTableCell | undefined>;
  groupCells: Array<{
    cell: DataTableCell;
    rowStart: number;
    rowCount: number;
  }>;
  isGroup: boolean;
};

/**
 * 表格可变状态视图：供 column/row ops 读写，由 DataTable 组装。
 */
export interface DataTableOpsContext {
  tableRoot: Layout;
  headerRow: Layout;
  annotation: Annotation;
  groupFrameRefs: Rect[];
  groupInnerRefs: Layout[];
  dataStackRefs: Layout[];
  dataRowLayouts: Layout[];
  columns: ColumnState[];
  headers: string[];
  currentRows: string[][];
  groupCol: number | null;
  groups: RowGroup[];
  rowCount: number;

  stripe: number;
  rowHeight: number;
  fontSize: number;
  fontFamily: string;
  headerFill: string;
  rowFillA: string;
  rowFillB: string;
  headerTextColor: string;
  textColor: string;
  cellPaddingX: number;
  stroke: string;
  defaultColumnWidth: number;
  cellLine: number;

  rowFill(absRow: number): string;
  setRowCount(n: number): void;
}

export function tableWidth(ctx: DataTableOpsContext): number {
  return ctx.columns.reduce((s, c) => s + c.width, 0);
}

export function dataColsWidth(ctx: DataTableOpsContext): number {
  return ctx.columns.reduce(
    (s, c, i) => (i === ctx.groupCol || c.isGroup ? s : s + c.width),
    0,
  );
}

export function* syncShellWidths(
  ctx: DataTableOpsContext,
  duration: number,
): ThreadGenerator {
  const total = tableWidth(ctx);
  const dataW = dataColsWidth(ctx);
  const anims = [
    ctx.tableRoot.width(total, duration, easeInOutCubic),
    ctx.headerRow.width(total, duration, easeInOutCubic),
  ];
  for (const frame of ctx.groupFrameRefs) {
    anims.push(frame.width(total, duration, easeInOutCubic));
  }
  for (const inner of ctx.groupInnerRefs) {
    anims.push(inner.width(total, duration, easeInOutCubic));
  }
  for (const stack of ctx.dataStackRefs) {
    anims.push(stack.width(dataW, duration, easeInOutCubic));
  }
  for (const layout of ctx.dataRowLayouts) {
    if (!layout) continue;
    anims.push(
      layout.width(
        ctx.groupCol === null ? total : dataW,
        duration,
        easeInOutCubic,
      ),
    );
  }
  if (anims.length > 0) {
    yield* all(...anims);
  }
}

export function snapShellWidths(ctx: DataTableOpsContext) {
  const total = tableWidth(ctx);
  const dataW = dataColsWidth(ctx);
  ctx.tableRoot.width(total);
  ctx.headerRow.width(total);
  for (const frame of ctx.groupFrameRefs) frame.width(total);
  for (const inner of ctx.groupInnerRefs) inner.width(total);
  for (const stack of ctx.dataStackRefs) stack.width(dataW);
  for (const layout of ctx.dataRowLayouts) {
    if (!layout) continue;
    layout.width(ctx.groupCol === null ? total : dataW);
  }
}

export function restripeRows(ctx: DataTableOpsContext) {
  if (ctx.groupCol === null) {
    for (let r = 0; r < ctx.rowCount; r++) {
      const fill =
        stripeBand(r, ctx.stripe) === 0 ? ctx.rowFillA : ctx.rowFillB;
      for (const column of ctx.columns) {
        if (column.isGroup) continue;
        column.cells[r]?.fill(fill);
      }
    }
    return;
  }
  for (const g of ctx.groups) {
    for (let ri = 0; ri < g.rows.length; ri++) {
      const abs = g.startRow + ri;
      const fill =
        stripeBand(ri, ctx.stripe) === 0 ? ctx.rowFillA : ctx.rowFillB;
      for (const column of ctx.columns) {
        if (column.isGroup) continue;
        column.cells[abs]?.fill(fill);
      }
    }
  }
}

/** 删除后重算各组 startRow / groupCells 元数据 */
export function reindexGroups(ctx: DataTableOpsContext) {
  if (ctx.groupCol === null) return;
  const groupCol = ctx.columns[ctx.groupCol];
  let cursor = 0;
  for (let gi = 0; gi < ctx.groups.length; gi++) {
    ctx.groups[gi].startRow = cursor;
    const gc = groupCol.groupCells[gi];
    if (gc) {
      gc.rowStart = cursor;
      gc.rowCount = ctx.groups[gi].rows.length;
    }
    cursor += ctx.groups[gi].rows.length;
  }
}
