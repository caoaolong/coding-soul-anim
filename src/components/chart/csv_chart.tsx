import {
  Circle,
  Latex,
  Layout,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {csvNumber, parseCsv, type CsvTable} from '../../utils/parse_csv';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const AXIS = '#e8eef7';
const GRID = 'rgba(138,155,176,0.18)';

export type ChartSeriesType = 'line' | 'area' | 'bar';
export type ChartAxisSide = 'left' | 'right';
export type ChartXScale = 'linear' | 'log2';

export interface CsvChartSeriesOptions {
  id: string;
  /** CSV 中的 Y 列名 */
  yColumn: string;
  /** 使用左轴或右轴 */
  axis?: ChartAxisSide;
  type?: ChartSeriesType;
  color?: string;
  lineWidth?: number;
  dashed?: boolean;
  showDots?: boolean;
  dotRadius?: number;
  /** 区域填充透明度 0–1，默认 0.28 */
  areaOpacity?: number;
  /** 柱宽相对类目间距比例，默认 0.55 */
  barWidth?: number;
  /** 图例文案，默认用 id */
  label?: string;
}

interface DataPoint {
  x: number;
  y: number;
}

interface SeriesStyle {
  lineWidth: number;
  dashed: boolean;
  showDots: boolean;
  dotRadius: number;
  areaOpacity: number;
  barWidth: number;
}

interface SeriesHandles {
  id: string;
  points: DataPoint[];
  axis: ChartAxisSide;
  type: ChartSeriesType;
  color: string;
  label: string;
  style: SeriesStyle;
  line: ReturnType<typeof createRef<Line>> | null;
  area: ReturnType<typeof createRef<Line>> | null;
  dots: Array<ReturnType<typeof createRef<Circle>>>;
  bars: Array<ReturnType<typeof createRef<Rect>>>;
  barTargets: number[];
  legendSwatch: ReturnType<typeof createRef<Rect>>;
  legendText: ReturnType<typeof createRef<Txt>>;
}

export interface CsvChartProps extends NodeProps {
  /** CSV 原文（推荐 `import x from '...csv?raw'`） */
  csv: string;
  /** X 轴列名 */
  xColumn: string;
  xScale?: ChartXScale;
  plotWidth?: number;
  plotHeight?: number;
  xLabel?: string;
  yLeftLabel?: string;
  yRightLabel?: string;
  showGrid?: boolean;
  xTicks?: number;
  yTicks?: number;
  /** 覆盖自动范围；未设则按数据估算 */
  xMin?: number;
  xMax?: number;
  yLeftMin?: number;
  yLeftMax?: number;
  yRightMin?: number;
  yRightMax?: number;
  /** 是否显示内置图例 */
  showLegend?: boolean;
}

/**
 * 读取 CSV 的统计图：支持多 series、折线/区域/柱状、双 Y 轴、linear/log2 X 轴。
 */
export class CsvChart extends Node {
  private readonly table: CsvTable;
  private readonly xColumn: string;
  private readonly xScale: ChartXScale;
  private readonly plotWidth: number;
  private readonly plotHeight: number;
  private readonly xTickCount: number;
  private readonly yTickCount: number;
  private readonly useGrid: boolean;
  private readonly useLegend: boolean;

  private xMin: number;
  private xMax: number;
  private yLeftMin: number;
  private yLeftMax: number;
  private yRightMin: number;
  private yRightMax: number;
  private readonly xMinOverride?: number;
  private readonly xMaxOverride?: number;
  private readonly yLeftMinOverride?: number;
  private readonly yLeftMaxOverride?: number;
  private readonly yRightMinOverride?: number;
  private readonly yRightMaxOverride?: number;

  private readonly axisX = createRef<Line>();
  private readonly axisYLeft = createRef<Line>();
  private readonly axisYRight = createRef<Line>();
  private readonly arrowX = createRef<Line>();
  private readonly arrowYL = createRef<Line>();
  private readonly arrowYR = createRef<Line>();
  private readonly xLabelRef = createRef<Latex>();
  private readonly yLeftLabelRef = createRef<Latex>();
  private readonly yRightLabelRef = createRef<Latex>();
  private readonly gridRoot = createRef<Node>();
  private readonly seriesRoot = createRef<Node>();
  private readonly ticksRoot = createRef<Node>();
  private readonly legendRoot = createRef<Layout>();

  private readonly series = new Map<string, SeriesHandles>();
  private hasRightAxis = false;
  private rangesReady = false;

  public constructor(props: CsvChartProps) {
    const {
      csv,
      xColumn,
      xScale = 'linear',
      plotWidth = 1100,
      plotHeight = 560,
      xLabel = '',
      yLeftLabel = '',
      yRightLabel = '',
      showGrid = true,
      xTicks = 6,
      yTicks = 5,
      xMin,
      xMax,
      yLeftMin,
      yLeftMax,
      yRightMin,
      yRightMax,
      showLegend = true,
      ...rest
    } = props;

    super({...rest});

    this.table = parseCsv(csv);
    this.xColumn = xColumn;
    this.xScale = xScale;
    this.plotWidth = plotWidth;
    this.plotHeight = plotHeight;
    this.xTickCount = xTicks;
    this.yTickCount = yTicks;
    this.useGrid = showGrid;
    this.useLegend = showLegend;
    this.xMinOverride = xMin;
    this.xMaxOverride = xMax;
    this.yLeftMinOverride = yLeftMin;
    this.yLeftMaxOverride = yLeftMax;
    this.yRightMinOverride = yRightMin;
    this.yRightMaxOverride = yRightMax;

    this.xMin = 0;
    this.xMax = 1;
    this.yLeftMin = 0;
    this.yLeftMax = 1;
    this.yRightMin = 0;
    this.yRightMax = 1;

    const origin = this.originLocal();

    this.add(
      <Node>
        <Rect
          x={origin.x + plotWidth / 2}
          y={origin.y - plotHeight / 2}
          width={plotWidth}
          height={plotHeight}
          clip
        >
          <Node ref={this.gridRoot} opacity={0} />
          <Node ref={this.seriesRoot} />
        </Rect>
        <Node ref={this.ticksRoot} opacity={0} />
        <Line
          ref={this.axisX}
          points={[
            [origin.x, origin.y],
            [origin.x + plotWidth, origin.y],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          end={0}
        />
        <Line
          ref={this.axisYLeft}
          points={[
            [origin.x, origin.y],
            [origin.x, origin.y - plotHeight],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          end={0}
        />
        <Line
          ref={this.axisYRight}
          points={[
            [origin.x + plotWidth, origin.y],
            [origin.x + plotWidth, origin.y - plotHeight],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          end={0}
          opacity={0}
        />
        <Line
          ref={this.arrowX}
          points={[
            [origin.x + plotWidth - 16, origin.y - 10],
            [origin.x + plotWidth, origin.y],
            [origin.x + plotWidth - 16, origin.y + 10],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          lineJoin={'round'}
          end={0}
        />
        <Line
          ref={this.arrowYL}
          points={[
            [origin.x - 10, origin.y - plotHeight + 16],
            [origin.x, origin.y - plotHeight],
            [origin.x + 10, origin.y - plotHeight + 16],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          lineJoin={'round'}
          end={0}
        />
        <Line
          ref={this.arrowYR}
          points={[
            [origin.x + plotWidth - 10, origin.y - plotHeight + 16],
            [origin.x + plotWidth, origin.y - plotHeight],
            [origin.x + plotWidth + 10, origin.y - plotHeight + 16],
          ]}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          lineJoin={'round'}
          end={0}
          opacity={0}
        />
        <Latex
          ref={this.xLabelRef}
          tex={[xLabel || ' ']}
          fill={PAPER}
          fontSize={28}
          x={origin.x + plotWidth + 36}
          y={origin.y}
          opacity={0}
        />
        <Latex
          ref={this.yLeftLabelRef}
          tex={[yLeftLabel || ' ']}
          fill={PAPER}
          fontSize={28}
          x={origin.x}
          y={origin.y - plotHeight - 36}
          opacity={0}
        />
        <Latex
          ref={this.yRightLabelRef}
          tex={[yRightLabel || ' ']}
          fill={PAPER}
          fontSize={28}
          x={origin.x + plotWidth}
          y={origin.y - plotHeight - 36}
          opacity={0}
        />
        {/* 图例放在绘图区外右上角，避免与曲线/柱体重叠 */}
        <Layout
          ref={this.legendRoot}
          layout
          direction={'column'}
          alignItems={'end'}
          gap={10}
          x={origin.x + plotWidth}
          y={origin.y - plotHeight - 88}
          offset={[1, 1]}
          opacity={0}
        />
      </Node>,
    );
  }

  /** 解析后的表（只读用途） */
  public getTable(): CsvTable {
    return this.table;
  }

  /** 注册一条 series（先不可见，用 drawSeries 入场） */
  public addSeries(options: CsvChartSeriesOptions) {
    const {
      id,
      yColumn,
      axis = 'left',
      type = 'line',
      color = '#7aa2ff',
      lineWidth = 3.5,
      dashed = false,
      showDots = false,
      dotRadius = 7,
      areaOpacity = 0.28,
      barWidth = 0.55,
      label,
    } = options;

    if (this.series.has(id)) {
      throw new Error(`CsvChart: series id "${id}" 已存在`);
    }
    if (!this.table.headers.includes(this.xColumn)) {
      throw new Error(`CsvChart: 找不到 X 列 "${this.xColumn}"`);
    }
    if (!this.table.headers.includes(yColumn)) {
      throw new Error(`CsvChart: 找不到 Y 列 "${yColumn}"`);
    }

    if (axis === 'right') this.hasRightAxis = true;

    const points: DataPoint[] = [];
    for (const row of this.table.rows) {
      const x = csvNumber(row, this.xColumn);
      const y = csvNumber(row, yColumn);
      if (x === null || y === null) continue;
      if (this.xScale === 'log2' && x <= 0) continue;
      points.push({x, y});
    }
    points.sort((a, b) => a.x - b.x);

    if (points.length === 0) {
      throw new Error(`CsvChart: series "${id}" 无有效数据点`);
    }

    // 延迟布局：所有 series 加完后由 finalize 统一映射
    this.series.set(id, {
      id,
      points,
      axis,
      type,
      color,
      label: label ?? id,
      style: {
        lineWidth,
        dashed,
        showDots,
        dotRadius,
        areaOpacity,
        barWidth,
      },
      line: null,
      area: null,
      dots: [],
      bars: [],
      barTargets: [],
      legendSwatch: createRef<Rect>(),
      legendText: createRef<Txt>(),
    });
  }

  /** 在 addSeries 之后、动画之前调用；也可由 showAxes/drawSeries 自动触发 */
  public finalize() {
    if (this.rangesReady) return;
    this.computeRanges();
    this.buildSeriesNodes();
    this.rebuildDecorations();
    this.buildLegend();
    // Y 轴标题颜色与该侧图注 series 一致
    this.yLeftLabelRef().fill(this.seriesColorForAxis('left'));
    this.yRightLabelRef().fill(this.seriesColorForAxis('right'));
    this.rangesReady = true;
  }

  /** 取该侧第一条 series 的颜色（与图注色块一致） */
  private seriesColorForAxis(side: ChartAxisSide): string {
    for (const s of this.series.values()) {
      if (s.axis === side) return s.color;
    }
    return MUTED;
  }

  /** 坐标轴、刻度、标签、图例入场 */
  public *showAxes(duration = 0.55): ThreadGenerator {
    this.finalize();
    const rightOpacity = this.hasRightAxis ? 1 : 0;
    this.axisYRight().opacity(rightOpacity);
    this.arrowYR().opacity(rightOpacity);

    yield* all(
      this.axisX().end(1, duration, easeOutCubic),
      this.axisYLeft().end(1, duration, easeOutCubic),
      this.arrowX().end(1, duration, easeOutCubic),
      this.arrowYL().end(1, duration, easeOutCubic),
      this.hasRightAxis
        ? this.axisYRight().end(1, duration, easeOutCubic)
        : waitFor(0),
      this.hasRightAxis
        ? this.arrowYR().end(1, duration, easeOutCubic)
        : waitFor(0),
    );

    yield* all(
      this.gridRoot().opacity(this.useGrid ? 1 : 0, 0.35, easeOutCubic),
      this.ticksRoot().opacity(1, 0.35, easeOutCubic),
      this.xLabelRef().opacity(1, 0.35, easeOutCubic),
      this.yLeftLabelRef().opacity(1, 0.35, easeOutCubic),
      this.hasRightAxis
        ? this.yRightLabelRef().opacity(1, 0.35, easeOutCubic)
        : waitFor(0),
      this.useLegend
        ? this.legendRoot().opacity(1, 0.35, easeOutCubic)
        : waitFor(0),
    );
  }

  /** 按类型画出指定 series */
  public *drawSeries(id: string, duration = 1.2): ThreadGenerator {
    this.finalize();
    const s = this.series.get(id);
    if (!s) return;

    if (s.type === 'bar') {
      const beat = duration / Math.max(1, s.bars.length);
      yield* all(
        ...s.bars.map((bar, i) =>
          delay(
            i * beat * 0.55,
            bar().height(s.barTargets[i], beat * 1.2, easeOutCubic),
          ),
        ),
      );
      return;
    }

    if (s.type === 'area' && s.area && s.line) {
      yield* all(
        s.line().end(1, duration, easeInOutCubic),
        delay(
          duration * 0.15,
          s.area().opacity(s.style.areaOpacity, duration * 0.7, easeOutCubic),
        ),
      );
    } else if (s.line) {
      yield* s.line().end(1, duration, easeInOutCubic);
    }

    if (s.dots.length > 0) {
      const beat = Math.min(0.1, duration / Math.max(1, s.dots.length));
      for (let i = 0; i < s.dots.length; i++) {
        yield* s.dots[i]().opacity(1, beat * 0.8, easeOutCubic);
        yield* waitFor(beat * 0.25);
      }
    }
  }

  /** 依次画出全部 series */
  public *drawAll(duration = 1.0, stagger = 0.35): ThreadGenerator {
    this.finalize();
    const ids = [...this.series.keys()];
    for (let i = 0; i < ids.length; i++) {
      yield* this.drawSeries(ids[i], duration);
      if (i < ids.length - 1) yield* waitFor(stagger);
    }
  }

  public mapX(x: number): number {
    const t = this.xToT(x);
    return this.originLocal().x + t * this.plotWidth;
  }

  public mapY(y: number, axis: ChartAxisSide = 'left'): number {
    const min = axis === 'left' ? this.yLeftMin : this.yRightMin;
    const max = axis === 'left' ? this.yLeftMax : this.yRightMax;
    const t = (y - min) / (max - min || 1);
    return this.originLocal().y - t * this.plotHeight;
  }

  private xToT(x: number): number {
    if (this.xScale === 'log2') {
      const a = Math.log2(this.xMin);
      const b = Math.log2(this.xMax);
      return (Math.log2(x) - a) / (b - a || 1);
    }
    return (x - this.xMin) / (this.xMax - this.xMin || 1);
  }

  private tToX(t: number): number {
    if (this.xScale === 'log2') {
      const a = Math.log2(this.xMin);
      const b = Math.log2(this.xMax);
      return Math.pow(2, a + t * (b - a));
    }
    return this.xMin + t * (this.xMax - this.xMin);
  }

  private computeRanges() {
    let xMin = Infinity;
    let xMax = -Infinity;
    let yLMin = Infinity;
    let yLMax = -Infinity;
    let yRMin = Infinity;
    let yRMax = -Infinity;
    let hasLeft = false;
    let hasRight = false;

    for (const s of this.series.values()) {
      for (const p of s.points) {
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        if (s.axis === 'left') {
          hasLeft = true;
          yLMin = Math.min(yLMin, p.y);
          yLMax = Math.max(yLMax, p.y);
        } else {
          hasRight = true;
          yRMin = Math.min(yRMin, p.y);
          yRMax = Math.max(yRMax, p.y);
        }
      }
    }

    this.xMin = this.xMinOverride ?? xMin;
    this.xMax = this.xMaxOverride ?? xMax;
    if (this.xScale === 'log2') {
      this.xMin = Math.max(this.xMin, Number.EPSILON);
      if (this.xMax <= this.xMin) this.xMax = this.xMin * 2;
    } else if (this.xMax <= this.xMin) {
      this.xMax = this.xMin + 1;
    }

    const pad = (min: number, max: number, lo?: number, hi?: number) => {
      if (lo !== undefined && hi !== undefined) return {min: lo, max: hi};
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return {min: 0, max: 1};
      }
      let a = min;
      let b = max;
      if (a === b) {
        const d = Math.abs(a) > 1e-9 ? Math.abs(a) * 0.1 : 1;
        a -= d;
        b += d;
      }
      // 统计图通常贴底 0（若全为正）
      if (a > 0) a = 0;
      const span = b - a;
      b = b + span * 0.12;
      return {
        min: lo ?? a,
        max: hi ?? b,
      };
    };

    if (hasLeft) {
      const r = pad(
        yLMin,
        yLMax,
        this.yLeftMinOverride,
        this.yLeftMaxOverride,
      );
      this.yLeftMin = r.min;
      this.yLeftMax = r.max;
    }
    if (hasRight) {
      const r = pad(
        yRMin,
        yRMax,
        this.yRightMinOverride,
        this.yRightMaxOverride,
      );
      this.yRightMin = r.min;
      this.yRightMax = r.max;
    }
    this.hasRightAxis = hasRight;
  }

  private buildSeriesNodes() {
    // 类目间距：相邻 x 映射后的平均像素距，用于柱宽
    const allX = [
      ...new Set(
        [...this.series.values()].flatMap(s => s.points.map(p => p.x)),
      ),
    ].sort((a, b) => a - b);

    let avgGap = this.plotWidth / Math.max(1, allX.length);
    if (allX.length >= 2) {
      let sum = 0;
      for (let i = 1; i < allX.length; i++) {
        sum += Math.abs(this.mapX(allX[i]) - this.mapX(allX[i - 1]));
      }
      avgGap = sum / (allX.length - 1);
    }

    // 柱状先画（底层），折线/区域后画
    const ordered = [...this.series.values()].sort((a, b) => {
      const rank = (t: ChartSeriesType) => (t === 'bar' ? 0 : 1);
      return rank(a.type) - rank(b.type);
    });

    for (const s of ordered) {
      const style = s.style;
      const pix = s.points.map(
        p => [this.mapX(p.x), this.mapY(p.y, s.axis)] as [number, number],
      );

      if (s.type === 'bar') {
        const w = avgGap * style.barWidth;
        for (const p of s.points) {
          const bar = createRef<Rect>();
          const x = this.mapX(p.x);
          const y0 = this.mapY(0, s.axis);
          const y1 = this.mapY(p.y, s.axis);
          const h = Math.abs(y0 - y1);
          // 从底边向上长高：锚点在底部中心
          this.seriesRoot().add(
            <Rect
              ref={bar}
              x={x}
              y={y0}
              width={w}
              height={0}
              offset={[0, 1]}
              fill={s.color}
              radius={3}
            />,
          );
          s.bars.push(bar);
          s.barTargets.push(h);
        }
      } else {
        if (s.type === 'area') {
          const area = createRef<Line>();
          const baseY = this.mapY(0, s.axis);
          const closed: [number, number][] = [
            [pix[0][0], baseY],
            ...pix,
            [pix[pix.length - 1][0], baseY],
          ];
          this.seriesRoot().add(
            <Line
              ref={area}
              points={closed}
              fill={s.color}
              opacity={0}
              lineWidth={0}
              closed
            />,
          );
          s.area = area;
        }

        const line = createRef<Line>();
        this.seriesRoot().add(
          <Line
            ref={line}
            points={pix}
            stroke={s.color}
            lineWidth={style.lineWidth}
            lineCap={'round'}
            lineJoin={'round'}
            lineDash={style.dashed ? [10, 10] : []}
            end={0}
          />,
        );
        s.line = line;

        if (style.showDots) {
          for (const p of s.points) {
            const dot = createRef<Circle>();
            this.seriesRoot().add(
              <Circle
                ref={dot}
                width={style.dotRadius * 2}
                height={style.dotRadius * 2}
                fill={s.color}
                x={this.mapX(p.x)}
                y={this.mapY(p.y, s.axis)}
                opacity={0}
              />,
            );
            s.dots.push(dot);
          }
        }
      }
    }
  }

  private buildLegend() {
    this.legendRoot().removeChildren();
    if (!this.useLegend) return;

    for (const s of this.series.values()) {
      this.legendRoot().add(
        <Layout layout direction={'row'} alignItems={'center'} gap={10}>
          <Rect
            ref={s.legendSwatch}
            width={s.type === 'bar' ? 18 : 28}
            height={s.type === 'bar' ? 18 : 10}
            radius={3}
            fill={s.color}
            opacity={s.type === 'area' ? 0.85 : 1}
          />
          <Txt
            ref={s.legendText}
            text={s.label}
            fontFamily={FONT}
            fontSize={22}
            fill={MUTED}
          />
        </Layout>,
      );
    }
  }

  private rebuildDecorations() {
    this.gridRoot().removeChildren();
    this.ticksRoot().removeChildren();
    if (this.useGrid) this.buildGrid();
    this.buildTickLabels();
  }

  private originLocal(): {x: number; y: number} {
    return {x: -this.plotWidth / 2, y: this.plotHeight / 2};
  }

  private buildGrid() {
    const o = this.originLocal();
    const xTicks = this.xTickValues();
    for (const xv of xTicks) {
      const x = this.mapX(xv);
      if (x <= o.x + 1 || x >= o.x + this.plotWidth - 1) continue;
      this.gridRoot().add(
        <Line
          points={[
            [x, o.y],
            [x, o.y - this.plotHeight],
          ]}
          stroke={GRID}
          lineWidth={1}
        />,
      );
    }
    for (let i = 1; i < this.yTickCount; i++) {
      const t = i / (this.yTickCount - 1);
      const y = o.y - t * this.plotHeight;
      this.gridRoot().add(
        <Line
          points={[
            [o.x, y],
            [o.x + this.plotWidth, y],
          ]}
          stroke={GRID}
          lineWidth={1}
        />,
      );
    }
  }

  private buildTickLabels() {
    const o = this.originLocal();
    for (const xv of this.xTickValues()) {
      const x = this.mapX(xv);
      this.ticksRoot().add(
        <Latex
          tex={[this.formatTick(xv)]}
          fill={MUTED}
          fontSize={22}
          x={x}
          y={o.y + 28}
        />,
      );
    }

    const leftColor = this.seriesColorForAxis('left');
    const rightColor = this.seriesColorForAxis('right');

    for (let i = 0; i < this.yTickCount; i++) {
      const t = i / Math.max(1, this.yTickCount - 1);
      const y = o.y - t * this.plotHeight;
      if (i === 0) continue;
      const yvL =
        this.yLeftMin + t * (this.yLeftMax - this.yLeftMin);
      this.ticksRoot().add(
        <Latex
          tex={[this.formatTick(yvL)]}
          fill={leftColor}
          fontSize={20}
          x={o.x - 40}
          y={y}
        />,
      );
      if (this.hasRightAxis) {
        const yvR =
          this.yRightMin + t * (this.yRightMax - this.yRightMin);
        this.ticksRoot().add(
          <Latex
            tex={[this.formatTick(yvR)]}
            fill={rightColor}
            fontSize={20}
            x={o.x + this.plotWidth + 44}
            y={y}
          />,
        );
      }
    }
  }

  /** log2：优先整数幂；linear：均匀切分 */
  private xTickValues(): number[] {
    if (this.xScale === 'log2') {
      const lo = Math.ceil(Math.log2(this.xMin) - 1e-9);
      const hi = Math.floor(Math.log2(this.xMax) + 1e-9);
      const vals: number[] = [];
      for (let e = lo; e <= hi; e++) {
        const v = Math.pow(2, e);
        if (v >= this.xMin * (1 - 1e-9) && v <= this.xMax * (1 + 1e-9)) {
          vals.push(v);
        }
      }
      if (vals.length === 0) {
        vals.push(this.xMin, this.xMax);
      }
      // 过多时抽稀
      if (vals.length > this.xTickCount) {
        const step = Math.ceil(vals.length / this.xTickCount);
        return vals.filter((_, i) => i % step === 0 || i === vals.length - 1);
      }
      return vals;
    }

    const out: number[] = [];
    for (let i = 0; i < this.xTickCount; i++) {
      const t = i / Math.max(1, this.xTickCount - 1);
      out.push(this.tToX(t));
    }
    return out;
  }

  private formatTick(v: number): string {
    if (Math.abs(v) < 1e-12) return '0';
    if (Number.isInteger(v)) return `${v}`;
    const a = Math.abs(v);
    if (a >= 1000) return Number(v.toFixed(0)).toString();
    if (a >= 0.01) return Number(v.toFixed(3)).toString();
    const m = v.toExponential(1).match(/^(-?\d+\.?\d*)e([+-]?\d+)$/);
    if (m) return `${m[1]}\\times 10^{${Number(m[2])}}`;
    return Number(v.toPrecision(3)).toString();
  }
}
