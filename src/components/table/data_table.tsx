import {Latex, Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const HEADER_BG = '#1a2430';
const LINE = '#2a3a4c';
const ROW_ALT = '#0e141c';
const MUTED = '#8a9bb0';

function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 单元格：纯文本，或 LaTeX */
export type TableCell = string | {tex: string};

export interface DataTableProps extends NodeProps {
  /** 表头 */
  headers: string[];
  /** 数据行（与 headers 列数对齐） */
  rows: TableCell[][];
  /** 各列宽度；缺省均分 totalWidth */
  columnWidths?: number[];
  /** 表格总宽，默认 1280 */
  totalWidth?: number;
  /** 行高，默认 64 */
  rowHeight?: number;
  /** 表头字号，默认 28 */
  headerSize?: number;
  /** 正文字号，默认 26 */
  cellSize?: number;
  /** 行入场错开间隔，默认 0.28 */
  rowBeat?: number;
}

function cellText(cell: TableCell): string | null {
  return typeof cell === 'string' ? cell : null;
}

function cellTex(cell: TableCell): string | null {
  return typeof cell === 'string' ? null : cell.tex;
}

/**
 * 通用数据表：表头先入场 → 数据行依次滑入。
 */
export class DataTable extends Node {
  private readonly frame = createRef<Rect>();
  private readonly headerRow = createRef<Rect>();
  private readonly accent = createRef<Rect>();
  private readonly bodyRows = createRefArray<Rect>();
  private readonly colHighlight = createRef<Rect>();

  private readonly rowBeat: number;
  private readonly widths: number[];
  private readonly totalWidth: number;
  private readonly tableHeight: number;

  public constructor(props: DataTableProps) {
    const {
      headers,
      rows,
      columnWidths,
      totalWidth = 1280,
      rowHeight = 64,
      headerSize = 28,
      cellSize = 26,
      rowBeat = 0.28,
      ...rest
    } = props;

    super({...rest});
    this.rowBeat = rowBeat;

    const cols = headers.length;
    const widths =
      columnWidths && columnWidths.length === cols
        ? columnWidths
        : Array.from({length: cols}, () => totalWidth / cols);
    this.widths = widths;
    this.totalWidth = totalWidth;
    // 顶栏 4px + 表头 + 数据行
    this.tableHeight = 4 + rowHeight * (1 + rows.length);

    const makeCell = (
      content: TableCell,
      width: number,
      height: number,
      opts: {header?: boolean; firstCol?: boolean},
    ) => {
      const tex = cellTex(content);
      const text = cellText(content);
      const fill = opts.header ? PAPER : opts.firstCol ? MUTED : PAPER;
      const size = opts.header ? headerSize : cellSize;
      return (
        <Layout
          width={width}
          height={height}
          alignItems={'center'}
          justifyContent={'center'}
          padding={[0, 18]}
        >
          {tex ? (
            <Latex tex={[tex]} fill={fill} fontSize={size} />
          ) : (
            <Txt
              text={text ?? ''}
              fontFamily={FONT}
              fontSize={size}
              fontWeight={opts.header || opts.firstCol ? 700 : 400}
              fill={fill}
              textAlign={'center'}
            />
          )}
        </Layout>
      );
    };

    this.add(
      <Rect
        ref={this.frame}
        layout
        direction={'column'}
        width={totalWidth}
        radius={12}
        stroke={LINE}
        lineWidth={2}
        fill={DEEP}
        opacity={0}
        scale={0.96}
      >
        <Rect
          ref={this.accent}
          width={totalWidth}
          height={4}
          fill={ACCENT}
          opacity={0}
        />
        {/* 表头 */}
        <Rect
          ref={this.headerRow}
          layout
          direction={'row'}
          width={totalWidth}
          height={rowHeight}
          fill={HEADER_BG}
          opacity={0}
        >
          {headers.map((h, c) => (
            <Rect
              layout
              width={widths[c]}
              height={rowHeight}
              stroke={LINE}
              lineWidth={1}
              alignItems={'center'}
              justifyContent={'center'}
            >
              {makeCell(h, widths[c], rowHeight, {header: true})}
            </Rect>
          ))}
        </Rect>

        {/* 数据行：自右侧滑入 */}
        {rows.map((row, r) => (
          <Rect
            ref={this.bodyRows}
            layout
            direction={'row'}
            width={totalWidth}
            height={rowHeight}
            fill={r % 2 === 0 ? DEEP : ROW_ALT}
            opacity={0}
            x={56}
          >
            {row.map((cell, c) => (
              <Rect
                layout
                width={widths[c]}
                height={rowHeight}
                stroke={LINE}
                lineWidth={1}
                alignItems={'center'}
                justifyContent={'center'}
              >
                {makeCell(cell, widths[c], rowHeight, {firstCol: c === 0})}
              </Rect>
            ))}
          </Rect>
        ))}
      </Rect>,
    );

    // 列高亮遮罩（与表格同中心，按列定位）
    this.add(
      <Rect
        ref={this.colHighlight}
        width={widths[0]}
        height={this.tableHeight}
        fill={tint(ACCENT, 0.2)}
        stroke={ACCENT}
        lineWidth={2.5}
        radius={8}
        opacity={0}
        zIndex={5}
      />,
    );
  }

  /** 表头入场（整框 + 顶栏 + 表头） */
  public *showHeader(duration = 0.55): ThreadGenerator {
    const frame = this.frame();
    yield* all(
      frame.opacity(1, duration * 0.7, easeOutCubic),
      frame.scale(1, duration, easeOutCubic),
      this.accent().opacity(1, duration, easeOutCubic),
      this.headerRow().opacity(1, duration, easeOutCubic),
    );
  }

  /** 数据行依次从右侧滑入 */
  public *showRows(): ThreadGenerator {
    for (let i = 0; i < this.bodyRows.length; i++) {
      const row = this.bodyRows[i];
      yield* all(
        row.opacity(1, 0.32, easeOutCubic),
        row.x(0, 0.42, easeOutCubic),
      );
      yield* waitFor(this.rowBeat);
    }
  }

  /**
   * 高亮某一列（0-based）。
   * 半透明色块罩住整列，带描边。
   */
  public *highlightColumn(col: number, duration = 0.5): ThreadGenerator {
    if (col < 0 || col >= this.widths.length) return;

    let left = -this.totalWidth / 2;
    for (let i = 0; i < col; i++) left += this.widths[i];
    const w = this.widths[col];

    const hl = this.colHighlight();
    hl.width(w);
    hl.height(this.tableHeight);
    hl.position([left + w / 2, 0]);
    hl.opacity(0);
    hl.scale(1.04);

    yield* all(
      hl.opacity(1, duration, easeOutCubic),
      hl.scale(1, duration, easeOutCubic),
    );
  }

  /** 完整流程：表头 → 逐行 */
  public *run(): ThreadGenerator {
    yield* this.showHeader();
    yield* waitFor(0.25);
    yield* this.showRows();
  }
}
