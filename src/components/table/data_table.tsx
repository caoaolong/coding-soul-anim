import { Layout, Node, NodeProps, Rect } from "@motion-canvas/2d";
import { ThreadGenerator, createRef } from "@motion-canvas/core";
import { Annotation, FocusBoxOptions } from "../annotation/annotation";
import { DataTableCell, createHeaderCell } from "./data_table_cell";
import {
  RowGroup,
  groupConsecutiveRows,
  resolveColumnIndex,
  resolveGroupColumn,
  stripeBand,
} from "./data_table_layout";
import {
  addColumn as addColumnOp,
  removeColumn as removeColumnOp,
  updateData as updateDataOp,
  type ColumnAnimOptions,
  type UpdateDataOptions,
} from "./data_table_column_ops";
import {
  ColumnState,
  DataTableOpsContext,
} from "./data_table_ops_context";
import {
  deleteGroup as deleteGroupOp,
  deleteRow as deleteRowOp,
  type DeleteRowOptions,
} from "./data_table_row_ops";

export type { UpdateDataOptions, ColumnAnimOptions } from "./data_table_column_ops";
export type { DeleteRowOptions } from "./data_table_row_ops";

export interface DataTableProps extends NodeProps {
  headers: string[];
  rows: string[][];
  /**
   * 隔行变色周期，默认 1。
   * 有 group 时每个分组内部从 0 重新起算。
   */
  stripeEvery?: number;
  /** 分组列：列名或下标 */
  group?: string | number;
  columnWidths?: number[];
  /** 新列默认宽度 */
  defaultColumnWidth?: number;
  rowHeight?: number;
  fontSize?: number;
  headerFill?: string;
  rowFillA?: string;
  rowFillB?: string;
  groupFill?: string;
  groupFillAlt?: string;
  headerTextColor?: string;
  textColor?: string;
  groupTextColor?: string;
  cellPaddingX?: number;
  stroke?: string;
  groupBorderColor?: string;
  groupBorderWidth?: number;
}

/**
 * 居中表格：分组 / 隔行变色 / updateData / addColumn / removeColumn / deleteRow / deleteGroup。
 */
export class DataTable extends Node {
  private readonly tableRoot = createRef<Layout>();
  private readonly headerRow = createRef<Layout>();
  private readonly annotation = createRef<Annotation>();
  /** 分组外框 */
  private readonly groupFrameRefs: Rect[] = [];
  /** 分组内：groupCell + dataStack 的横向 Layout */
  private readonly groupInnerRefs: Layout[] = [];
  /** 分组内：仅数据列的纵向 stack */
  private readonly dataStackRefs: Layout[] = [];
  private readonly dataRowLayouts: Layout[] = [];

  private readonly columns: ColumnState[] = [];
  private headers: string[];
  private currentRows: string[][];
  private readonly groupCol: number | null;
  private groups: RowGroup[];
  private rowCount: number;

  private readonly stripe: number;
  private readonly rowHeight: number;
  private readonly fontSize: number;
  private readonly fontFamily = "JetBrains Mono, Consolas, monospace";
  private readonly headerFill: string;
  private readonly rowFillA: string;
  private readonly rowFillB: string;
  private readonly groupFill: string;
  private readonly altGroupFill: string;
  private readonly headerTextColor: string;
  private readonly textColor: string;
  private readonly groupTextColor: string;
  private readonly cellPaddingX: number;
  private readonly stroke: string;
  private readonly groupBorderColor: string;
  private readonly groupBorderWidth: number;
  private readonly defaultColumnWidth: number;
  private readonly cellLine = 1;

  public constructor(props: DataTableProps) {
    const {
      headers,
      rows,
      stripeEvery = 1,
      group,
      columnWidths,
      defaultColumnWidth = 200,
      rowHeight = 52,
      fontSize = 24,
      headerFill = "#1E293B",
      rowFillA = "#161B22",
      rowFillB = "#252D3A",
      groupFill = "#243044",
      groupFillAlt,
      headerTextColor = "#FBBF24",
      textColor = "#E2E8F0",
      groupTextColor = "#FBBF24",
      cellPaddingX = 16,
      stroke = "#334155",
      groupBorderColor = "#94A3B8",
      groupBorderWidth = 3,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!headers?.length) throw new Error("DataTable: headers 不能为空");

    this.headers = [...headers];
    this.currentRows = rows.map((r) => [...r]);
    this.rowCount = rows.length;
    this.stripe = Math.max(1, Math.floor(stripeEvery));
    this.groupCol = resolveGroupColumn(headers, group);
    this.groups =
      this.groupCol === null
        ? rows.map((row, i) => ({ key: "", rows: [row], startRow: i }))
        : groupConsecutiveRows(rows, this.groupCol);

    this.rowHeight = rowHeight;
    this.fontSize = fontSize;
    this.headerFill = headerFill;
    this.rowFillA = rowFillA;
    this.rowFillB = rowFillB;
    this.groupFill = groupFill;
    this.altGroupFill = groupFillAlt ?? "#1B2838";
    this.headerTextColor = headerTextColor;
    this.textColor = textColor;
    this.groupTextColor = groupTextColor;
    this.cellPaddingX = cellPaddingX;
    this.stroke = stroke;
    this.groupBorderColor = groupBorderColor;
    this.groupBorderWidth = groupBorderWidth;
    this.defaultColumnWidth = defaultColumnWidth;

    const widths =
      columnWidths && columnWidths.length === headers.length
        ? [...columnWidths]
        : headers.map(() => defaultColumnWidth);

    const tableWidth = widths.reduce((a, b) => a + b, 0);
    const tableHeight = (rows.length + 1) * rowHeight;

    // —— 表头 ——
    const headerNodes: DataTableCell[] = [];
    for (let c = 0; c < headers.length; c++) {
      const headerCell = createHeaderCell({
        text: headers[c],
        width: widths[c],
        height: rowHeight,
        fill: headerFill,
        stroke,
        lineWidth: this.cellLine,
        textFill: headerTextColor,
        fontSize,
        fontFamily: this.fontFamily,
        cellPaddingX,
      });
      this.columns.push({
        header: headers[c],
        width: widths[c],
        headerCell,
        cells: new Array(rows.length),
        groupCells: [],
        isGroup: this.groupCol === c,
      });
      headerNodes.push(headerCell);
    }

    const bodyNodes: Node[] = [];
    const pendingRowRefs: Array<{
      absRow: number;
      ref: ReturnType<typeof createRef<Layout>>;
    }> = [];

    if (this.groupCol === null) {
      for (let r = 0; r < rows.length; r++) {
        const band = stripeBand(r, this.stripe);
        const fill = band === 0 ? rowFillA : rowFillB;
        const rowRef = createRef<Layout>();
        pendingRowRefs.push({ absRow: r, ref: rowRef });
        const cellNodes: DataTableCell[] = [];
        for (let c = 0; c < headers.length; c++) {
          const cell = new DataTableCell({
            text: rows[r][c] ?? "",
            width: widths[c],
            height: rowHeight,
            fill,
            stroke,
            lineWidth: this.cellLine,
            textFill: textColor,
            fontSize,
            fontFamily: this.fontFamily,
            cellPaddingX,
          });
          this.columns[c].cells[r] = cell;
          cellNodes.push(cell);
        }
        bodyNodes.push(
          <Layout
            ref={rowRef}
            layout
            direction="row"
            width={tableWidth}
            height={rowHeight}
          >
            {cellNodes}
          </Layout>,
        );
      }
    } else {
      const gCol = this.groupCol;
      const dataColsWidth = widths.reduce(
        (s, w, i) => (i === gCol ? s : s + w),
        0,
      );
      const pendingGroupUi: Array<{
        frame: ReturnType<typeof createRef<Rect>>;
        inner: ReturnType<typeof createRef<Layout>>;
        stack: ReturnType<typeof createRef<Layout>>;
      }> = [];

      this.groups.forEach((g, groupIndex) => {
        const groupH = g.rows.length * rowHeight;
        const gFill = groupIndex % 2 === 0 ? groupFill : this.altGroupFill;
        const frameRef = createRef<Rect>();
        const innerRef = createRef<Layout>();
        const stackRef = createRef<Layout>();
        pendingGroupUi.push({
          frame: frameRef,
          inner: innerRef,
          stack: stackRef,
        });

        const groupCell = new DataTableCell({
          text: g.key,
          width: widths[gCol],
          height: groupH,
          fill: gFill,
          stroke,
          lineWidth: this.cellLine,
          textFill: groupTextColor,
          fontSize,
          fontFamily: this.fontFamily,
          fontWeight: 700,
          cellPaddingX,
        });
        this.columns[gCol].groupCells.push({
          cell: groupCell,
          rowStart: g.startRow,
          rowCount: g.rows.length,
        });

        const rowNodes: Node[] = [];
        for (let ri = 0; ri < g.rows.length; ri++) {
          const absRow = g.startRow + ri;
          const band = stripeBand(ri, this.stripe);
          const fill = band === 0 ? rowFillA : rowFillB;
          const rowRef = createRef<Layout>();
          pendingRowRefs.push({ absRow, ref: rowRef });
          const cellNodes: DataTableCell[] = [];
          for (let c = 0; c < headers.length; c++) {
            if (c === gCol) continue;
            const cell = new DataTableCell({
              text: g.rows[ri][c] ?? "",
              width: widths[c],
              height: rowHeight,
              fill,
              stroke,
              lineWidth: this.cellLine,
              textFill: textColor,
              fontSize,
              fontFamily: this.fontFamily,
              cellPaddingX,
            });
            this.columns[c].cells[absRow] = cell;
            cellNodes.push(cell);
          }
          rowNodes.push(
            <Layout
              ref={rowRef}
              layout
              direction="row"
              width={dataColsWidth}
              height={rowHeight}
              minWidth={0}
            >
              {cellNodes}
            </Layout>,
          );
        }

        bodyNodes.push(
          <Rect
            ref={frameRef}
            layout
            width={tableWidth}
            height={groupH}
            minWidth={0}
            fill={null}
            stroke={groupBorderColor}
            lineWidth={groupBorderWidth}
            justifyContent="start"
            alignItems="start"
            clip
          >
            <Layout
              ref={innerRef}
              layout
              direction="row"
              width={tableWidth}
              height={groupH}
              minWidth={0}
              justifyContent="start"
              alignItems="start"
            >
              {groupCell}
              <Layout
                ref={stackRef}
                layout
                direction="column"
                width={dataColsWidth}
                height={groupH}
                minWidth={0}
              >
                {rowNodes}
              </Layout>
            </Layout>
          </Rect>,
        );
      });

      (
        this as unknown as {
          _pendingGroupUi: typeof pendingGroupUi;
        }
      )._pendingGroupUi = pendingGroupUi;
    }

    this.add(
      <Layout
        ref={this.tableRoot}
        layout
        direction="column"
        width={tableWidth}
        height={tableHeight}
        offset={[0, 0]}
      >
        <Layout
          ref={this.headerRow}
          layout
          direction="row"
          width={tableWidth}
          height={rowHeight}
        >
          {headerNodes}
        </Layout>
        {bodyNodes}
      </Layout>,
    );
    this.add(<Annotation ref={this.annotation} />);

    for (const { absRow, ref } of pendingRowRefs) {
      if (absRow < 0) continue;
      this.dataRowLayouts[absRow] = ref();
    }

    const pendingGroupUi = (
      this as unknown as {
        _pendingGroupUi?: Array<{
          frame: ReturnType<typeof createRef<Rect>>;
          inner: ReturnType<typeof createRef<Layout>>;
          stack: ReturnType<typeof createRef<Layout>>;
        }>;
      }
    )._pendingGroupUi;
    if (pendingGroupUi) {
      for (const ui of pendingGroupUi) {
        this.groupFrameRefs.push(ui.frame());
        this.groupInnerRefs.push(ui.inner());
        this.dataStackRefs.push(ui.stack());
      }
      delete (this as unknown as { _pendingGroupUi?: unknown })._pendingGroupUi;
    }
  }

  private rowFill(absRow: number): string {
    if (this.groupCol === null) {
      return stripeBand(absRow, this.stripe) === 0
        ? this.rowFillA
        : this.rowFillB;
    }
    for (const g of this.groups) {
      if (absRow >= g.startRow && absRow < g.startRow + g.rows.length) {
        const ri = absRow - g.startRow;
        return stripeBand(ri, this.stripe) === 0
          ? this.rowFillA
          : this.rowFillB;
      }
    }
    return this.rowFillA;
  }

  private makeOpsCtx(): DataTableOpsContext {
    const self = this;
    return {
      get tableRoot() {
        return self.tableRoot();
      },
      get headerRow() {
        return self.headerRow();
      },
      get annotation() {
        return self.annotation();
      },
      groupFrameRefs: this.groupFrameRefs,
      groupInnerRefs: this.groupInnerRefs,
      dataStackRefs: this.dataStackRefs,
      dataRowLayouts: this.dataRowLayouts,
      columns: this.columns,
      headers: this.headers,
      currentRows: this.currentRows,
      groupCol: this.groupCol,
      groups: this.groups,
      get rowCount() {
        return self.rowCount;
      },
      stripe: this.stripe,
      rowHeight: this.rowHeight,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      headerFill: this.headerFill,
      rowFillA: this.rowFillA,
      rowFillB: this.rowFillB,
      headerTextColor: this.headerTextColor,
      textColor: this.textColor,
      cellPaddingX: this.cellPaddingX,
      stroke: this.stroke,
      defaultColumnWidth: this.defaultColumnWidth,
      cellLine: this.cellLine,
      rowFill: (r) => self.rowFill(r),
      setRowCount(n) {
        self.rowCount = n;
      },
    };
  }

  private getCellTxt(row: number, col: number) {
    return this.getCell(row, col)?.txt ?? null;
  }

  private getCell(row: number, col: number): DataTableCell | null {
    const column = this.columns[col];
    if (!column) return null;
    if (column.isGroup) {
      const g = column.groupCells.find(
        (gc) => row >= gc.rowStart && row < gc.rowStart + gc.rowCount,
      );
      return g?.cell ?? null;
    }
    return column.cells[row] ?? null;
  }

  /**
   * 高亮若干单元格（可跨行），闪烁一次。
   * @param cells `{ row, column }`，column 为列名或下标
   */
  public *annotateCells(
    cells: Array<{ row: number; column: string | number }>,
    options: FocusBoxOptions = {},
  ): ThreadGenerator {
    const targets: Node[] = [];
    for (const { row, column } of cells) {
      if (row < 0 || row >= this.rowCount) {
        throw new Error(`DataTable.annotateCells: 行下标越界 (${row})`);
      }
      const col = resolveColumnIndex(this.headers, column);
      const cell = this.getCell(row, col);
      if (cell) targets.push(cell);
    }
    if (targets.length === 0) return;
    yield* this.annotation().focusBox(targets, {
      padding: 4,
      ...options,
    });
  }

  /** 批量更新单元格：淡出 → 改字 → 淡入 */
  public *updateData(
    nextRows: string[][],
    options: UpdateDataOptions = {},
  ): ThreadGenerator {
    yield* updateDataOp(
      this.makeOpsCtx(),
      nextRows,
      (r, c) => this.getCellTxt(r, c),
      options,
    );
  }

  /** 在表尾追加一列，宽度从 0 展开并淡入（与外框同步变宽） */
  public *addColumn(
    header: string,
    data: string[],
    options: ColumnAnimOptions = {},
  ): ThreadGenerator {
    yield* addColumnOp(this.makeOpsCtx(), header, data, options);
  }

  /** 删除指定列：收窄淡出后移除（与外框同步变窄） */
  public *removeColumn(
    header: string | number,
    options: ColumnAnimOptions = {},
  ): ThreadGenerator {
    yield* removeColumnOp(this.makeOpsCtx(), header, options);
  }

  /**
   * 删除指定行：淡出并收拢行高，同步缩小所属分组外框。
   * @param rowIndex 数据行下标（从 0 起）
   */
  public *deleteRow(
    rowIndex: number,
    options: DeleteRowOptions = {},
  ): ThreadGenerator {
    yield* deleteRowOp(this.makeOpsCtx(), rowIndex, options);
  }

  /**
   * 删除整个分组（按分组列的值，如 "3" / 3）。
   * 需已启用 group。
   */
  public *deleteGroup(
    groupKey: string | number,
    options: DeleteRowOptions = {},
  ): ThreadGenerator {
    yield* deleteGroupOp(this.makeOpsCtx(), groupKey, options);
  }
}
