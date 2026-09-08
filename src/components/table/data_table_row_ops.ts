import { Node } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  easeInOutCubic,
} from "@motion-canvas/core";
import {
  DataTableOpsContext,
  reindexGroups,
  restripeRows,
} from "./data_table_ops_context";

export interface DeleteRowOptions {
  /** 删除动画时长，默认 0.45（deleteGroup 默认 0.5） */
  duration?: number;
  /** 删除前是否先高亮，默认 false */
  highlight?: boolean;
  /** 高亮闪烁时长，默认 0.7 */
  highlightDuration?: number;
  /** 高亮颜色，默认琥珀 */
  highlightColor?: string;
}

function* highlightBeforeDelete(
  ctx: DataTableOpsContext,
  targets: Node[],
  options: DeleteRowOptions,
): ThreadGenerator {
  if (!options.highlight) return;
  const list = targets.filter(Boolean);
  if (list.length === 0) return;
  yield* ctx.annotation.focusBox(list, {
    padding: 6,
    color: options.highlightColor ?? "#FBBF24",
    lineWidth: 3,
    radius: 8,
    duration: options.highlightDuration ?? 0.7,
  });
}

/** 删除指定行 */
export function* deleteRow(
  ctx: DataTableOpsContext,
  rowIndex: number,
  options: DeleteRowOptions = {},
): ThreadGenerator {
  const { duration = 0.45 } = options;
  if (rowIndex < 0 || rowIndex >= ctx.rowCount) {
    throw new Error(
      `DataTable.deleteRow: 行下标越界 (${rowIndex})，当前行数 ${ctx.rowCount}`,
    );
  }

  const rowLayout = ctx.dataRowLayouts[rowIndex];
  const highlightTargets: Node[] = [];
  if (rowLayout) highlightTargets.push(rowLayout);
  for (const column of ctx.columns) {
    if (column.isGroup) continue;
    const cell = column.cells[rowIndex];
    if (cell) highlightTargets.push(cell);
  }
  if (ctx.groupCol !== null) {
    const gIdx = ctx.groups.findIndex(
      (g) => rowIndex >= g.startRow && rowIndex < g.startRow + g.rows.length,
    );
    if (gIdx >= 0 && ctx.groups[gIdx].rows.length === 1) {
      const frame = ctx.groupFrameRefs[gIdx];
      if (frame) highlightTargets.push(frame);
    }
  }
  yield* highlightBeforeDelete(ctx, highlightTargets, options);

  const cellAnims: ThreadGenerator[] = [];

  for (const column of ctx.columns) {
    if (column.isGroup) continue;
    const cell = column.cells[rowIndex];
    if (!cell) continue;
    cellAnims.push(cell.collapseHeight(duration));
  }

  if (rowLayout) {
    cellAnims.push(rowLayout.height(0, duration, easeInOutCubic));
    cellAnims.push(rowLayout.opacity(0, duration, easeInOutCubic));
  }

  let groupIdx = -1;
  let removeWholeGroup = false;
  if (ctx.groupCol !== null) {
    groupIdx = ctx.groups.findIndex(
      (g) => rowIndex >= g.startRow && rowIndex < g.startRow + g.rows.length,
    );
    if (groupIdx < 0) {
      throw new Error(`DataTable.deleteRow: 找不到行 ${rowIndex} 所属分组`);
    }
    const g = ctx.groups[groupIdx];
    const nextCount = g.rows.length - 1;
    removeWholeGroup = nextCount <= 0;
    const nextH = Math.max(0, nextCount) * ctx.rowHeight;

    const frame = ctx.groupFrameRefs[groupIdx];
    const inner = ctx.groupInnerRefs[groupIdx];
    const stack = ctx.dataStackRefs[groupIdx];
    const groupCol = ctx.columns[ctx.groupCol];
    const gCell = groupCol.groupCells[groupIdx];

    if (removeWholeGroup) {
      if (gCell) cellAnims.push(gCell.cell.collapseHeight(duration));
      if (frame) {
        cellAnims.push(frame.height(0, duration, easeInOutCubic));
        cellAnims.push(frame.opacity(0, duration, easeInOutCubic));
      }
      if (inner) cellAnims.push(inner.height(0, duration, easeInOutCubic));
      if (stack) cellAnims.push(stack.height(0, duration, easeInOutCubic));
    } else {
      if (gCell) {
        cellAnims.push(gCell.cell.height(nextH, duration, easeInOutCubic));
      }
      if (frame) {
        cellAnims.push(frame.height(nextH, duration, easeInOutCubic));
      }
      if (inner) {
        cellAnims.push(inner.height(nextH, duration, easeInOutCubic));
      }
      if (stack) {
        cellAnims.push(stack.height(nextH, duration, easeInOutCubic));
      }
    }
  }

  const nextTableH = (ctx.rowCount - 1 + 1) * ctx.rowHeight;
  cellAnims.push(ctx.tableRoot.height(nextTableH, duration, easeInOutCubic));

  yield* all(...cellAnims);

  for (const column of ctx.columns) {
    if (column.isGroup) continue;
    column.cells[rowIndex]?.remove();
  }
  rowLayout?.remove();

  if (ctx.groupCol !== null && groupIdx >= 0) {
    if (removeWholeGroup) {
      const groupCol = ctx.columns[ctx.groupCol];
      groupCol.groupCells[groupIdx]?.cell.remove();
      ctx.groupFrameRefs[groupIdx]?.remove();
      ctx.groupFrameRefs.splice(groupIdx, 1);
      ctx.groupInnerRefs.splice(groupIdx, 1);
      ctx.dataStackRefs.splice(groupIdx, 1);
      groupCol.groupCells.splice(groupIdx, 1);
      ctx.groups.splice(groupIdx, 1);
    } else {
      const g = ctx.groups[groupIdx];
      const local = rowIndex - g.startRow;
      g.rows.splice(local, 1);
      const groupCol = ctx.columns[ctx.groupCol];
      const gCell = groupCol.groupCells[groupIdx];
      if (gCell) gCell.rowCount -= 1;
    }
    reindexGroups(ctx);
  }

  ctx.currentRows.splice(rowIndex, 1);
  ctx.dataRowLayouts.splice(rowIndex, 1);
  for (const column of ctx.columns) {
    if (column.isGroup) continue;
    column.cells.splice(rowIndex, 1);
  }
  ctx.setRowCount(ctx.rowCount - 1);

  restripeRows(ctx);
}

/** 删除整个分组（按分组列的值） */
export function* deleteGroup(
  ctx: DataTableOpsContext,
  groupKey: string | number,
  options: DeleteRowOptions = {},
): ThreadGenerator {
  const { duration = 0.5 } = options;
  if (ctx.groupCol === null) {
    throw new Error("DataTable.deleteGroup: 当前表格未启用 group");
  }

  const key = String(groupKey);
  const groupIdx = ctx.groups.findIndex((g) => g.key === key);
  if (groupIdx < 0) {
    throw new Error(
      `DataTable.deleteGroup: 找不到分组 "${key}"，现有：${ctx.groups
        .map((g) => g.key)
        .join(", ")}`,
    );
  }

  const g = ctx.groups[groupIdx];
  const start = g.startRow;
  const count = g.rows.length;
  const end = start + count;

  const frame = ctx.groupFrameRefs[groupIdx];
  const highlightTargets: Node[] = [];
  if (frame) highlightTargets.push(frame);
  else {
    for (let r = start; r < end; r++) {
      if (ctx.dataRowLayouts[r]) highlightTargets.push(ctx.dataRowLayouts[r]);
    }
  }
  yield* highlightBeforeDelete(ctx, highlightTargets, options);

  const anims: ThreadGenerator[] = [];

  for (let r = start; r < end; r++) {
    for (const column of ctx.columns) {
      if (column.isGroup) continue;
      const cell = column.cells[r];
      if (!cell) continue;
      anims.push(cell.collapseHeight(duration));
    }
    const rowLayout = ctx.dataRowLayouts[r];
    if (rowLayout) {
      anims.push(rowLayout.height(0, duration, easeInOutCubic));
      anims.push(rowLayout.opacity(0, duration, easeInOutCubic));
    }
  }

  const groupCol = ctx.columns[ctx.groupCol];
  const gCell = groupCol.groupCells[groupIdx];
  const inner = ctx.groupInnerRefs[groupIdx];
  const stack = ctx.dataStackRefs[groupIdx];

  if (gCell) anims.push(gCell.cell.collapseHeight(duration));
  if (frame) {
    anims.push(frame.height(0, duration, easeInOutCubic));
    anims.push(frame.opacity(0, duration, easeInOutCubic));
  }
  if (inner) anims.push(inner.height(0, duration, easeInOutCubic));
  if (stack) anims.push(stack.height(0, duration, easeInOutCubic));

  const nextTableH = (ctx.rowCount - count + 1) * ctx.rowHeight;
  anims.push(ctx.tableRoot.height(nextTableH, duration, easeInOutCubic));

  yield* all(...anims);

  for (let r = start; r < end; r++) {
    for (const column of ctx.columns) {
      if (column.isGroup) continue;
      column.cells[r]?.remove();
    }
    ctx.dataRowLayouts[r]?.remove();
  }
  gCell?.cell.remove();
  frame?.remove();

  ctx.groupFrameRefs.splice(groupIdx, 1);
  ctx.groupInnerRefs.splice(groupIdx, 1);
  ctx.dataStackRefs.splice(groupIdx, 1);
  groupCol.groupCells.splice(groupIdx, 1);
  ctx.groups.splice(groupIdx, 1);

  ctx.currentRows.splice(start, count);
  ctx.dataRowLayouts.splice(start, count);
  for (const column of ctx.columns) {
    if (column.isGroup) continue;
    column.cells.splice(start, count);
  }
  ctx.setRowCount(ctx.rowCount - count);

  reindexGroups(ctx);
  restripeRows(ctx);
}
