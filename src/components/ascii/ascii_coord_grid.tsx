import {Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const DEEP = '#121820';
const AXIS = '#8a9bb0';
const GRID = '#2a3a4c';
const LABEL = '#6a7a8c';
const CHAR = '#e8eef7';
const CHAR_CTRL = '#5a6a7c';
const ACCENT = '#3dd6c6';
/** 行/列高亮描边 */
const BAND = '#5a9aaa';
/** 交汇格强调 */
const CROSS = '#ffe08a';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

/** 横轴：低 4 位 → 16 列 */
const COLS = 16;
/** 纵轴：高 3 位 → 8 行（ASCII 共 7 bit，0–127） */
const ROWS = 8;

export interface AsciiCoordGridProps extends NodeProps {
  /** 单格边长（像素） */
  cellSize?: number;
  /** 格内字符字号 */
  fontSize?: number;
  /** 轴刻度字号 */
  tickFontSize?: number;
  /** 轴标题字号 */
  axisLabelSize?: number;
  /** 是否绘制浅色网格线，默认 true */
  showGrid?: boolean;
}

/**
 * 将码点显示为格内文案：可打印字符原样，空格用 ␣，其余控制符用 ·。
 */
export function formatAsciiCell(code: number): string {
  if (code === 0x20) return '␣';
  if (code >= 0x21 && code <= 0x7e) return String.fromCharCode(code);
  return '·';
}

export function isPrintableAscii(code: number): boolean {
  return code === 0x20 || (code >= 0x21 && code <= 0x7e);
}

/**
 * 7-bit ASCII 二维坐标系：
 * - 横轴：低 4 位（0–F）
 * - 纵轴：高 3 位（0–7）
 * - 格 (x, y) 对应码点 `(y << 4) | x`（0–127）
 */
export class AsciiCoordGrid extends Node {
  private readonly root = createRef<Node>();
  private readonly xAxis = createRef<Line>();
  private readonly yAxis = createRef<Line>();
  private readonly xTitle = createRef<Txt>();
  private readonly yTitle = createRef<Txt>();
  private readonly cellsRoot = createRef<Node>();
  private readonly gridRoot = createRef<Node>();
  private readonly xTicks = createRefArray<Txt>();
  private readonly yTicks = createRefArray<Txt>();
  private readonly cellRects = createRefArray<Rect>();
  private readonly cellTxts = createRefArray<Txt>();
  private readonly rowBand = createRef<Rect>();
  private readonly colBand = createRef<Rect>();

  private readonly cellSize: number;
  private readonly fontSize: number;
  private readonly tickFontSize: number;
  private readonly axisLabelSize: number;
  private readonly showGrid: boolean;
  private readonly plotW: number;
  private readonly plotH: number;
  private readonly originX: number;
  private readonly originY: number;
  /** 当前交汇高亮的码点，-1 表示无 */
  private activeCode = -1;

  public constructor(props: AsciiCoordGridProps = {}) {
    const {
      cellSize = 56,
      fontSize = 24,
      tickFontSize = 20,
      axisLabelSize = 26,
      showGrid = true,
      ...rest
    } = props;
    super({opacity: 0, ...rest});

    this.cellSize = cellSize;
    this.fontSize = fontSize;
    this.tickFontSize = tickFontSize;
    this.axisLabelSize = axisLabelSize;
    this.showGrid = showGrid;
    this.plotW = COLS * cellSize;
    this.plotH = ROWS * cellSize;
    this.originX = -this.plotW / 2;
    this.originY = -this.plotH / 2;
    const originX = this.originX;
    const originY = this.originY;
    const overhang = 28;

    this.add(
      <Node ref={this.root} x={0} y={0}>
        <Node ref={this.gridRoot} opacity={0} />
        {/* 行/列光带，位于格子下方 */}
        <Rect
          ref={this.rowBand}
          width={this.plotW}
          height={cellSize}
          x={originX + this.plotW / 2}
          y={originY}
          radius={4}
          fill={BAND + '44'}
          opacity={0}
          zIndex={0}
        />
        <Rect
          ref={this.colBand}
          width={cellSize}
          height={this.plotH}
          x={originX}
          y={originY + this.plotH / 2}
          radius={4}
          fill={BAND + '44'}
          opacity={0}
          zIndex={0}
        />
        <Node ref={this.cellsRoot} zIndex={1} />
        <Line
          ref={this.xAxis}
          points={[
            [originX - overhang, originY],
            [originX + this.plotW + overhang, originY],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          endArrow
          arrowSize={14}
          end={0}
        />
        <Line
          ref={this.yAxis}
          points={[
            [originX, originY - overhang],
            [originX, originY + this.plotH + overhang],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          endArrow
          arrowSize={14}
          end={0}
        />
        <Txt
          ref={this.xTitle}
          text={'低 4 位'}
          fontFamily={MONO}
          fontSize={axisLabelSize}
          fill={ACCENT}
          x={originX + this.plotW / 2}
          y={originY - 56}
          opacity={0}
        />
        <Txt
          ref={this.yTitle}
          text={'高 3 位'}
          fontFamily={MONO}
          fontSize={axisLabelSize}
          fill={ACCENT}
          x={originX - 72}
          y={originY + this.plotH / 2}
          rotation={-90}
          opacity={0}
        />
      </Node>,
    );

    this.buildGrid(originX, originY);
    this.buildTicks(originX, originY);
    this.buildCells(originX, originY);
  }

  /** 码点 → 单元格中心（相对本组件） */
  public cellPosition(code: number): {x: number; y: number} {
    const low = code & 0xf;
    const high = (code >> 4) & 0x7;
    const originX = -this.plotW / 2;
    const originY = -this.plotH / 2;
    return {
      x: originX + (low + 0.5) * this.cellSize,
      y: originY + (high + 0.5) * this.cellSize,
    };
  }

  /** 轴 + 刻度 + 标题入场，再逐格填入字符 */
  public *show(
    duration = 0.55,
    cellStagger = 0.008,
  ): ThreadGenerator {
    yield* this.opacity(1, duration * 0.35, easeOutCubic);
    yield* all(
      this.xAxis().end(1, duration, easeOutCubic),
      this.yAxis().end(1, duration, easeOutCubic),
    );
    yield* all(
      this.xTitle().opacity(1, 0.35, easeOutCubic),
      this.yTitle().opacity(1, 0.35, easeOutCubic),
      ...this.xTicks.map(t => t.opacity(1, 0.35, easeOutCubic)),
      ...this.yTicks.map(t => t.opacity(1, 0.35, easeOutCubic)),
      this.gridRoot().opacity(1, 0.4, easeOutCubic),
    );

    const anims = this.cellRects.map((rect, i) =>
      delay(
        i * cellStagger,
        all(
          rect.opacity(1, 0.28, easeOutCubic),
          this.cellTxts[i].opacity(1, 0.28, easeOutCubic),
        ),
      ),
    );
    if (anims.length > 0) yield* all(...anims);
    yield* waitFor(0.1);
  }

  /** 高亮某个码点对应的格子 */
  public *highlight(code: number, duration = 0.4): ThreadGenerator {
    const idx = this.codeToIndex(code);
    if (idx < 0) return;
    const rect = this.cellRects[idx];
    const txt = this.cellTxts[idx];
    yield* all(
      rect.stroke(ACCENT, duration, easeOutCubic),
      rect.lineWidth(3, duration, easeOutCubic),
      rect.scale(1.12, duration, easeOutCubic),
      txt.fill(ACCENT, duration, easeOutCubic),
    );
  }

  /**
   * 行列交汇高亮：所在行、所在列整体提亮，交汇格更高亮。
   * 若已有高亮，会与新高亮并行切换（只恢复旧行/列），适合快速扫字。
   */
  public *highlightCross(
    code: number,
    duration = 0.14,
  ): ThreadGenerator {
    if (code < 0 || code > 0x7f) return;

    const prev = this.activeCode;
    const low = code & 0xf;
    const high = (code >> 4) & 0x7;
    this.activeCode = code;

    const rowY = this.originY + (high + 0.5) * this.cellSize;
    const colX = this.originX + (low + 0.5) * this.cellSize;

    const anims = [
      this.rowBand().y(rowY, duration, easeOutCubic),
      this.colBand().x(colX, duration, easeOutCubic),
      this.rowBand().opacity(1, duration, easeOutCubic),
      this.colBand().opacity(1, duration, easeOutCubic),
    ];

    // 恢复上一次行/列（与新高亮不重叠的格子）
    if (prev >= 0 && prev !== code) {
      const pLow = prev & 0xf;
      const pHigh = (prev >> 4) & 0x7;
      for (let h = 0; h < ROWS; h++) {
        for (let l = 0; l < COLS; l++) {
          const wasOn = h === pHigh || l === pLow;
          const nowOn = h === high || l === low;
          if (!wasOn || nowOn) continue;
          const idx = h * COLS + l;
          const cellCode = (h << 4) | l;
          const printable = isPrintableAscii(cellCode);
          anims.push(
            this.cellRects[idx].stroke(GRID, duration, easeOutCubic),
            this.cellRects[idx].lineWidth(1.5, duration, easeOutCubic),
            this.cellRects[idx].scale(1, duration, easeOutCubic),
            this.cellRects[idx].fill(DEEP, duration, easeOutCubic),
            this.cellTxts[idx].fill(
              printable ? CHAR : CHAR_CTRL,
              duration,
              easeOutCubic,
            ),
          );
        }
      }
    }

    for (let h = 0; h < ROWS; h++) {
      for (let l = 0; l < COLS; l++) {
        const idx = h * COLS + l;
        const onRow = h === high;
        const onCol = l === low;
        if (!onRow && !onCol) continue;

        if (onRow && onCol) {
          anims.push(
            this.cellRects[idx].stroke(CROSS, duration, easeOutCubic),
            this.cellRects[idx].lineWidth(3.5, duration, easeOutCubic),
            this.cellRects[idx].scale(1.16, duration, easeOutCubic),
            this.cellRects[idx].fill('#3a3420', duration, easeOutCubic),
            this.cellTxts[idx].fill(CROSS, duration, easeOutCubic),
          );
        } else {
          anims.push(
            this.cellRects[idx].stroke(BAND, duration, easeOutCubic),
            this.cellRects[idx].lineWidth(2.5, duration, easeOutCubic),
            this.cellRects[idx].scale(1, duration, easeOutCubic),
            this.cellRects[idx].fill('#1a2830', duration, easeOutCubic),
            this.cellTxts[idx].fill(ACCENT, duration, easeOutCubic),
          );
        }
      }
    }

    yield* all(...anims);
  }

  /** 清除行列交汇高亮，仅恢复当前行/列格 */
  public *clearCrossHighlight(duration = 0.12): ThreadGenerator {
    const anims = [
      this.rowBand().opacity(0, duration, easeOutCubic),
      this.colBand().opacity(0, duration, easeOutCubic),
    ];
    if (this.activeCode >= 0) {
      const low = this.activeCode & 0xf;
      const high = (this.activeCode >> 4) & 0x7;
      for (let h = 0; h < ROWS; h++) {
        for (let l = 0; l < COLS; l++) {
          if (h !== high && l !== low) continue;
          const idx = h * COLS + l;
          const cellCode = (h << 4) | l;
          const printable = isPrintableAscii(cellCode);
          anims.push(
            this.cellRects[idx].stroke(GRID, duration, easeOutCubic),
            this.cellRects[idx].lineWidth(1.5, duration, easeOutCubic),
            this.cellRects[idx].scale(1, duration, easeOutCubic),
            this.cellRects[idx].fill(DEEP, duration, easeOutCubic),
            this.cellTxts[idx].fill(
              printable ? CHAR : CHAR_CTRL,
              duration,
              easeOutCubic,
            ),
          );
        }
      }
    }
    this.activeCode = -1;
    yield* all(...anims);
  }

  private codeToIndex(code: number): number {
    if (code < 0 || code > 0x7f) return -1;
    const low = code & 0xf;
    const high = (code >> 4) & 0x7;
    return high * COLS + low;
  }

  private buildGrid(originX: number, originY: number) {
    if (!this.showGrid) return;
    for (let i = 0; i <= COLS; i++) {
      const x = originX + i * this.cellSize;
      this.gridRoot().add(
        <Line
          points={[
            [x, originY],
            [x, originY + this.plotH],
          ]}
          stroke={GRID}
          lineWidth={1}
          opacity={0.7}
        />,
      );
    }
    for (let i = 0; i <= ROWS; i++) {
      const y = originY + i * this.cellSize;
      this.gridRoot().add(
        <Line
          points={[
            [originX, y],
            [originX + this.plotW, y],
          ]}
          stroke={GRID}
          lineWidth={1}
          opacity={0.7}
        />,
      );
    }
  }

  private buildTicks(originX: number, originY: number) {
    for (let i = 0; i < COLS; i++) {
      const hex = i.toString(16).toUpperCase();
      const cx = originX + (i + 0.5) * this.cellSize;
      this.root().add(
        <Txt
          ref={this.xTicks}
          text={hex}
          fontFamily={MONO}
          fontSize={this.tickFontSize}
          fill={LABEL}
          x={cx}
          y={originY - 28}
          opacity={0}
        />,
      );
    }
    for (let i = 0; i < ROWS; i++) {
      const hex = i.toString(16).toUpperCase();
      const cy = originY + (i + 0.5) * this.cellSize;
      this.root().add(
        <Txt
          ref={this.yTicks}
          text={hex}
          fontFamily={MONO}
          fontSize={this.tickFontSize}
          fill={LABEL}
          x={originX - 28}
          y={cy}
          opacity={0}
        />,
      );
    }
  }

  private buildCells(originX: number, originY: number) {
    for (let high = 0; high < ROWS; high++) {
      for (let low = 0; low < COLS; low++) {
        const code = (high << 4) | low;
        const label = formatAsciiCell(code);
        const printable = isPrintableAscii(code);
        const x = originX + (low + 0.5) * this.cellSize;
        const y = originY + (high + 0.5) * this.cellSize;

        this.cellsRoot().add(
          <Rect
            ref={this.cellRects}
            width={this.cellSize - 4}
            height={this.cellSize - 4}
            x={x}
            y={y}
            radius={5}
            fill={DEEP}
            stroke={GRID}
            lineWidth={1.5}
            opacity={0}
          />,
        );
        this.cellsRoot().add(
          <Txt
            ref={this.cellTxts}
            text={label}
            fontFamily={MONO}
            fontSize={this.fontSize}
            fontWeight={printable ? 600 : 400}
            fill={printable ? CHAR : CHAR_CTRL}
            x={x}
            y={y}
            opacity={0}
          />,
        );
      }
    }
  }
}
