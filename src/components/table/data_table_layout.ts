/** 表格布局 / 分组纯函数 */

export type RowGroup = { key: string; rows: string[][]; startRow: number };

export function resolveGroupColumn(
  headers: string[],
  group: string | number | undefined,
): number | null {
  if (group === undefined || group === null || group === "") return null;
  if (typeof group === "number") {
    if (group < 0 || group >= headers.length) {
      throw new Error(`DataTable: group 列下标越界 (${group})`);
    }
    return Math.floor(group);
  }
  const idx = headers.indexOf(group);
  if (idx < 0) {
    throw new Error(
      `DataTable: 找不到分组列 "${group}"，当前 headers: ${headers.join(", ")}`,
    );
  }
  return idx;
}

export function resolveColumnIndex(
  headers: string[],
  col: string | number,
): number {
  if (typeof col === "number") {
    if (col < 0 || col >= headers.length) {
      throw new Error(`DataTable: 列下标越界 (${col})`);
    }
    return Math.floor(col);
  }
  const idx = headers.indexOf(col);
  if (idx < 0) throw new Error(`DataTable: 找不到列 "${col}"`);
  return idx;
}

/** 按指定列连续相同值切分为组（保持原有行序） */
export function groupConsecutiveRows(
  rows: string[][],
  col: number,
): RowGroup[] {
  const groups: RowGroup[] = [];
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i][col] ?? "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(rows[i]);
    else groups.push({ key, rows: [rows[i]], startRow: i });
  }
  return groups;
}

/** 组内斑马纹下标：每个分组都从 0 重新计数 */
export function stripeBand(indexInGroup: number, stripeEvery: number): number {
  return Math.floor(indexInGroup / stripeEvery) % 2;
}
