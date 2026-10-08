import {Circle, Latex, Line, Node, NodeProps, Rect} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const AXIS = '#e8eef7';
const GRID = 'rgba(138,155,176,0.18)';
const HIGHLIGHT = '#7aa2ff';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphViewRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface FunctionGraphProps extends NodeProps {
  /** 绘图区宽度（像素） */
  plotWidth?: number;
  /** 绘图区高度（像素） */
  plotHeight?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** x 轴 LaTeX 标签 */
  xLabel?: string;
  /** y 轴 LaTeX 标签 */
  yLabel?: string;
  /** 是否画浅色网格 */
  showGrid?: boolean;
  /** x 方向主刻度数（含端点），默认 6 */
  xTicks?: number;
  /** y 方向主刻度数（含端点），默认 5 */
  yTicks?: number;
}

interface SeriesHandles {
  id: string;
  points: GraphPoint[];
  line: ReturnType<typeof createRef<Line>>;
  dots: Array<ReturnType<typeof createRef<Circle>>>;
  /** 哪些散点已经入场（缩放时区间外隐藏、区间内恢复） */
  dotRevealed: boolean[];
  color: string;
  lineWidth: number;
  dashed: boolean;
}

/**
 * 通用 2D 函数图像：坐标轴 + 多条曲线/散点，支持描线入场与区间放大。
 */
export class FunctionGraph extends Node {
  private readonly plotWidth: number;
  private readonly plotHeight: number;
  private readonly initView: GraphViewRange;
  private readonly xTickCount: number;
  private readonly yTickCount: number;
  private readonly useGrid: boolean;

  private xMin: number;
  private xMax: number;
  private yMin: number;
  private yMax: number;

  private readonly axisX = createRef<Line>();
  private readonly axisY = createRef<Line>();
  private readonly arrowX = createRef<Line>();
  private readonly arrowY = createRef<Line>();
  private readonly xLabelRef = createRef<Latex>();
  private readonly yLabelRef = createRef<Latex>();
  private readonly gridRoot = createRef<Node>();
  private readonly seriesRoot = createRef<Node>();
  private readonly ticksRoot = createRef<Node>();
  private readonly highlight = createRef<Rect>();

  private readonly series = new Map<string, SeriesHandles>();

  public constructor(props: FunctionGraphProps = {}) {
    const {
      plotWidth = 1100,
      plotHeight = 560,
      xMin = 0,
      xMax = 10,
      yMin = 0,
      yMax = 1,
      xLabel = 'n',
      yLabel = 'E',
      showGrid = true,
      xTicks = 6,
      yTicks = 5,
      ...rest
    } = props;

    super({...rest});

    this.plotWidth = plotWidth;
    this.plotHeight = plotHeight;
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.initView = {xMin, xMax, yMin, yMax};
    this.xTickCount = xTicks;
    this.yTickCount = yTicks;
    this.useGrid = showGrid;

    const origin = this.originLocal();

    this.add(
      <Node>
        <Rect
          ref={this.highlight}
          height={plotHeight}
          y={origin.y - plotHeight / 2}
          fill={HIGHLIGHT}
          opacity={0}
          radius={4}
          offset={[-1, 0]}
          width={0}
        />
        <Node ref={this.gridRoot} opacity={0} />
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
          ref={this.axisY}
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
          ref={this.arrowY}
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
        <Latex
          ref={this.xLabelRef}
          tex={[xLabel]}
          fill={PAPER}
          fontSize={28}
          x={origin.x + plotWidth + 36}
          y={origin.y}
          opacity={0}
        />
        <Latex
          ref={this.yLabelRef}
          tex={[yLabel]}
          fill={PAPER}
          fontSize={28}
          x={origin.x}
          y={origin.y - plotHeight - 36}
          opacity={0}
        />
        <Node ref={this.seriesRoot} />
      </Node>,
    );

    this.rebuildDecorations();
  }

  public get view(): GraphViewRange {
    return {
      xMin: this.xMin,
      xMax: this.xMax,
      yMin: this.yMin,
      yMax: this.yMax,
    };
  }

  /** 数据坐标 → 本地像素 */
  public mapX(x: number): number {
    const t = (x - this.xMin) / (this.xMax - this.xMin);
    return this.originLocal().x + t * this.plotWidth;
  }

  public mapY(y: number): number {
    const t = (y - this.yMin) / (this.yMax - this.yMin);
    return this.originLocal().y - t * this.plotHeight;
  }

  /** 注册一条曲线（先不可见，用 drawSeries 描出） */
  public addSeries(
    id: string,
    points: GraphPoint[],
    options?: {
      color?: string;
      lineWidth?: number;
      dashed?: boolean;
      showDots?: boolean;
      dotRadius?: number;
    },
  ) {
    const color = options?.color ?? '#7aa2ff';
    const lineWidth = options?.lineWidth ?? 3.5;
    const dashed = options?.dashed ?? false;
    const showDots = options?.showDots ?? false;
    const dotRadius = options?.dotRadius ?? 7;

    const line = createRef<Line>();
    const dots: Array<ReturnType<typeof createRef<Circle>>> = [];
    const pix = points.map(
      p => [this.mapX(p.x), this.mapY(p.y)] as [number, number],
    );

    this.seriesRoot().add(
      <Line
        ref={line}
        points={pix}
        stroke={color}
        lineWidth={lineWidth}
        lineCap={'round'}
        lineJoin={'round'}
        lineDash={dashed ? [10, 10] : []}
        end={0}
      />,
    );

    if (showDots) {
      for (const p of points) {
        const dot = createRef<Circle>();
        this.seriesRoot().add(
          <Circle
            ref={dot}
            width={dotRadius * 2}
            height={dotRadius * 2}
            fill={color}
            x={this.mapX(p.x)}
            y={this.mapY(p.y)}
            opacity={0}
          />,
        );
        dots.push(dot);
      }
    }

    this.series.set(id, {
      id,
      points,
      line,
      dots,
      dotRevealed: points.map(() => false),
      color,
      lineWidth,
      dashed,
    });
  }

  /** 坐标轴与标签入场 */
  public *showAxes(duration = 0.55): ThreadGenerator {
    yield* all(
      this.axisX().end(1, duration, easeOutCubic),
      this.axisY().end(1, duration, easeOutCubic),
      this.arrowX().end(1, duration, easeOutCubic),
      this.arrowY().end(1, duration, easeOutCubic),
    );
    yield* all(
      this.gridRoot().opacity(1, 0.35, easeOutCubic),
      this.ticksRoot().opacity(1, 0.35, easeOutCubic),
      this.xLabelRef().opacity(1, 0.35, easeOutCubic),
      this.yLabelRef().opacity(1, 0.35, easeOutCubic),
    );
  }

  /** 按进度描出曲线 */
  public *drawSeries(id: string, duration = 1.2): ThreadGenerator {
    const s = this.series.get(id);
    if (!s) return;
    yield* s.line().end(1, duration, easeInOutCubic);
  }

  /** 依次点亮散点（带错开） */
  public *showDots(id: string, beat = 0.1): ThreadGenerator {
    const s = this.series.get(id);
    if (!s) return;
    for (let i = 0; i < s.dots.length; i++) {
      s.dotRevealed[i] = true;
      if (this.isInView(s.points[i].x, s.points[i].y)) {
        yield* s.dots[i]().opacity(1, beat * 0.8, easeOutCubic);
      }
      yield* waitFor(beat * 0.35);
    }
  }

  /** 点亮单个散点 */
  public *showDot(id: string, index: number, duration = 0.25): ThreadGenerator {
    const s = this.series.get(id);
    if (!s || !s.dots[index]) return;
    s.dotRevealed[index] = true;
    if (this.isInView(s.points[index].x, s.points[index].y)) {
      yield* s.dots[index]().opacity(1, duration, easeOutCubic);
    }
  }

  /**
   * 高亮 x 方向区间 [x0, x1]：半透明矩形从左向右展开。
   * 高度铺满绘图区。
   */
  public *highlightXRange(
    x0: number,
    x1: number,
    duration = 0.45,
  ): ThreadGenerator {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    const left = this.mapX(lo);
    const right = this.mapX(hi);
    const hl = this.highlight();
    hl.x(left);
    hl.width(0);
    hl.opacity(0.22);
    yield* hl.width(Math.max(0, right - left), duration, easeOutCubic);
  }

  public *clearHighlight(duration = 0.3): ThreadGenerator {
    yield* this.highlight().opacity(0, duration, easeOutCubic);
  }

  /**
   * 将可见区间缩放到目标范围（类似数轴 zoomTo）。
   * 曲线与散点随视野连续移动；刻度在放大结束后重建。
   */
  public *zoomTo(
    range: Partial<GraphViewRange>,
    duration = 1.5,
  ): ThreadGenerator {
    const to: GraphViewRange = {
      xMin: range.xMin ?? this.xMin,
      xMax: range.xMax ?? this.xMax,
      yMin: range.yMin ?? this.yMin,
      yMax: range.yMax ?? this.yMax,
    };
    const from: GraphViewRange = {
      xMin: this.xMin,
      xMax: this.xMax,
      yMin: this.yMin,
      yMax: this.yMax,
    };
    const hl = this.highlight();
    const hadHl = hl.opacity() > 0.01;
    // 高亮跟踪目标 x 区间，随放大铺满绘图区
    const trackX0 = to.xMin;
    const trackX1 = to.xMax;

    yield* this.ticksRoot().opacity(0, 0.2, easeOutCubic);

    yield* tween(duration, t => {
      const e = easeInOutCubic(t);
      this.xMin = from.xMin + (to.xMin - from.xMin) * e;
      this.xMax = from.xMax + (to.xMax - from.xMax) * e;
      this.yMin = from.yMin + (to.yMin - from.yMin) * e;
      this.yMax = from.yMax + (to.yMax - from.yMax) * e;
      this.layoutSeries();
      if (hadHl) {
        const left = this.mapX(trackX0);
        const right = this.mapX(trackX1);
        hl.x(Math.min(left, right));
        hl.width(Math.abs(right - left));
      }
    });

    this.xMin = to.xMin;
    this.xMax = to.xMax;
    this.yMin = to.yMin;
    this.yMax = to.yMax;
    this.layoutSeries();
    this.rebuildDecorations();
    this.ticksRoot().opacity(0);
    yield* all(
      this.ticksRoot().opacity(1, 0.35, easeOutCubic),
      this.gridRoot().opacity(this.useGrid ? 1 : 0, 0.35, easeOutCubic),
    );

    if (hadHl) {
      yield* this.clearHighlight(0.25);
    }
  }

  /** 缩回初始视野 */
  public *resetView(duration = 1.5): ThreadGenerator {
    yield* this.zoomTo(this.initView, duration);
  }

  /**
   * 高亮 x 区间后放大到该区间；可选同时收紧 y。
   */
  public *zoomIntoX(
    x0: number,
    x1: number,
    options?: {yMin?: number; yMax?: number; duration?: number},
  ): ThreadGenerator {
    const duration = options?.duration ?? 1.5;
    yield* this.highlightXRange(x0, x1, 0.45);
    yield* waitFor(0.4);
    yield* this.zoomTo(
      {
        xMin: Math.min(x0, x1),
        xMax: Math.max(x0, x1),
        yMin: options?.yMin,
        yMax: options?.yMax,
      },
      duration,
    );
  }

  private layoutSeries() {
    for (const s of this.series.values()) {
      // 按当前视野裁剪：区间外不进入折线，避免纵轴装不下时整条曲线被压扁变形
      const clipped = this.clipPolylineToView(s.points);
      const lineDrawn = s.line().end() > 0.01;
      if (clipped.length >= 2) {
        s.line().points(
          clipped.map(
            p => [this.mapX(p.x), this.mapY(p.y)] as [number, number],
          ),
        );
        if (lineDrawn) s.line().opacity(1);
      } else if (clipped.length === 1) {
        const p = clipped[0];
        const xy: [number, number] = [this.mapX(p.x), this.mapY(p.y)];
        s.line().points([xy, xy]);
        if (lineDrawn) s.line().opacity(1);
      } else if (lineDrawn) {
        s.line().opacity(0);
      }

      s.dots.forEach((dot, i) => {
        if (!s.dotRevealed[i]) return;
        const p = s.points[i];
        const inside = this.isInView(p.x, p.y);
        if (inside) {
          dot().position([this.mapX(p.x), this.mapY(p.y)]);
          dot().opacity(1);
        } else {
          dot().opacity(0);
        }
      });
    }
  }

  private isInView(x: number, y: number): boolean {
    return (
      x >= this.xMin - 1e-9 &&
      x <= this.xMax + 1e-9 &&
      y >= this.yMin - 1e-9 &&
      y <= this.yMax + 1e-9
    );
  }

  /**
   * 将折线裁剪到当前视野矩形内；跨越边界时插入交点，保证截断干净。
   */
  private clipPolylineToView(points: GraphPoint[]): GraphPoint[] {
    if (points.length === 0) return [];
    const out: GraphPoint[] = [];

    const push = (p: GraphPoint) => {
      const last = out[out.length - 1];
      if (
        last &&
        Math.abs(last.x - p.x) < 1e-12 &&
        Math.abs(last.y - p.y) < 1e-12
      ) {
        return;
      }
      out.push(p);
    };

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const seg = this.clipSegmentToView(a, b);
      if (!seg) continue;
      push(seg[0]);
      push(seg[1]);
    }

    // 单点落在视野内
    if (out.length === 0 && points.length === 1 && this.isInView(points[0].x, points[0].y)) {
      return [points[0]];
    }
    return out;
  }

  /** Cohen–Sutherland 风格：线段与轴对齐矩形求交 */
  private clipSegmentToView(
    a: GraphPoint,
    b: GraphPoint,
  ): [GraphPoint, GraphPoint] | null {
    const xmin = this.xMin;
    const xmax = this.xMax;
    const ymin = this.yMin;
    const ymax = this.yMax;

    const code = (p: GraphPoint) => {
      let c = 0;
      if (p.x < xmin - 1e-12) c |= 1;
      else if (p.x > xmax + 1e-12) c |= 2;
      if (p.y < ymin - 1e-12) c |= 4;
      else if (p.y > ymax + 1e-12) c |= 8;
      return c;
    };

    let p0 = {...a};
    let p1 = {...b};
    let c0 = code(p0);
    let c1 = code(p1);

    for (let iter = 0; iter < 8; iter++) {
      if (!(c0 | c1)) return [p0, p1];
      if (c0 & c1) return null;
      const cOut = c0 ? c0 : c1;
      let x = 0;
      let y = 0;
      if (cOut & 8) {
        x = p0.x + ((p1.x - p0.x) * (ymax - p0.y)) / (p1.y - p0.y);
        y = ymax;
      } else if (cOut & 4) {
        x = p0.x + ((p1.x - p0.x) * (ymin - p0.y)) / (p1.y - p0.y);
        y = ymin;
      } else if (cOut & 2) {
        y = p0.y + ((p1.y - p0.y) * (xmax - p0.x)) / (p1.x - p0.x);
        x = xmax;
      } else {
        y = p0.y + ((p1.y - p0.y) * (xmin - p0.x)) / (p1.x - p0.x);
        x = xmin;
      }
      if (cOut === c0) {
        p0 = {x, y};
        c0 = code(p0);
      } else {
        p1 = {x, y};
        c1 = code(p1);
      }
    }
    return null;
  }

  private rebuildDecorations() {
    this.gridRoot().removeChildren();
    this.ticksRoot().removeChildren();
    if (this.useGrid) {
      this.buildGrid(this.xTickCount, this.yTickCount);
    }
    this.buildTickLabels(this.xTickCount, this.yTickCount);
  }

  private originLocal(): {x: number; y: number} {
    return {x: -this.plotWidth / 2, y: this.plotHeight / 2};
  }

  private buildGrid(xTicks: number, yTicks: number) {
    const o = this.originLocal();
    for (let i = 1; i < xTicks; i++) {
      const t = i / (xTicks - 1);
      const x = o.x + t * this.plotWidth;
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
    for (let i = 1; i < yTicks; i++) {
      const t = i / (yTicks - 1);
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

  private buildTickLabels(xTicks: number, yTicks: number) {
    const o = this.originLocal();
    for (let i = 0; i < xTicks; i++) {
      const t = i / Math.max(1, xTicks - 1);
      const xv = this.xMin + t * (this.xMax - this.xMin);
      const x = o.x + t * this.plotWidth;
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
    for (let i = 0; i < yTicks; i++) {
      const t = i / Math.max(1, yTicks - 1);
      const yv = this.yMin + t * (this.yMax - this.yMin);
      const y = o.y - t * this.plotHeight;
      if (i === 0) continue;
      this.ticksRoot().add(
        <Latex
          tex={[this.formatTick(yv)]}
          fill={MUTED}
          fontSize={20}
          x={o.x - 40}
          y={y}
        />,
      );
    }
  }

  private formatTick(v: number): string {
    if (Math.abs(v) < 1e-12) return '0';
    if (Number.isInteger(v)) return `${v}`;
    const a = Math.abs(v);
    if (a >= 0.01) return Number(v.toFixed(3)).toString();
    const m = v.toExponential(1).match(/^(-?\d+\.?\d*)e([+-]?\d+)$/);
    if (m) return `${m[1]}\\times 10^{${Number(m[2])}}`;
    return Number(v.toPrecision(3)).toString();
  }
}
