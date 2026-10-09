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

export interface GraphPoint {
  x: number;
  y: number;
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
  color: string;
  lineWidth: number;
  dashed: boolean;
}

/**
 * 通用 2D 函数图像：坐标轴 + 多条曲线/散点描线入场。
 */
export class FunctionGraph extends Node {
  private readonly plotWidth: number;
  private readonly plotHeight: number;
  private readonly xTickCount: number;
  private readonly yTickCount: number;
  private readonly useGrid: boolean;

  /** 初始数据范围（构造时锁定） */
  private readonly xMin: number;
  private readonly xMax: number;
  private readonly yMin: number;
  private readonly yMax: number;
  /** 当前视野（zoomTail 会收窄） */
  private vxMin: number;
  private vxMax: number;
  private vyMin: number;
  private vyMax: number;

  private readonly axisX = createRef<Line>();
  private readonly axisY = createRef<Line>();
  private readonly arrowX = createRef<Line>();
  private readonly arrowY = createRef<Line>();
  private readonly xLabelRef = createRef<Latex>();
  private readonly yLabelRef = createRef<Latex>();
  private readonly gridRoot = createRef<Node>();
  private readonly seriesRoot = createRef<Node>();
  private readonly ticksRoot = createRef<Node>();

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
    this.vxMin = xMin;
    this.vxMax = xMax;
    this.vyMin = yMin;
    this.vyMax = yMax;
    this.xTickCount = xTicks;
    this.yTickCount = yTicks;
    this.useGrid = showGrid;

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
      </Node>,
    );

    this.rebuildDecorations();
  }

  /** 数据坐标 → 本地像素（按当前视野） */
  public mapX(x: number): number {
    const t = (x - this.vxMin) / (this.vxMax - this.vxMin);
    return this.originLocal().x + t * this.plotWidth;
  }

  public mapY(y: number): number {
    const t = (y - this.vyMin) / (this.vyMax - this.vyMin);
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
      this.gridRoot().opacity(this.useGrid ? 1 : 0, 0.35, easeOutCubic),
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
      yield* s.dots[i]().opacity(1, beat * 0.8, easeOutCubic);
      yield* waitFor(beat * 0.35);
    }
  }

  /** 点亮单个散点 */
  public *showDot(id: string, index: number, duration = 0.25): ThreadGenerator {
    const s = this.series.get(id);
    if (!s || !s.dots[index]) return;
    yield* s.dots[index]().opacity(1, duration, easeOutCubic);
  }

  /** 按当前视野重算曲线与散点像素位置 */
  private remapAll() {
    for (const s of this.series.values()) {
      const pix = s.points.map(
        p => [this.mapX(p.x), this.mapY(p.y)] as [number, number],
      );
      s.line().points(pix);
      for (let i = 0; i < s.dots.length; i++) {
        s.dots[i]().x(this.mapX(s.points[i].x));
        s.dots[i]().y(this.mapY(s.points[i].y));
      }
    }
  }

  /**
   * 末尾 1/2 放大：x 保留右半区间，y 按可见点重标定（贴底轴）。
   */
  public *zoomTail(duration = 0.85): ThreadGenerator {
    const nxMin = this.vxMax - (this.vxMax - this.vxMin) * 0.5;
    const nxMax = this.vxMax;
    const nyMin = this.vyMin;
    let nyMax = nyMin;
    for (const s of this.series.values()) {
      for (const p of s.points) {
        if (p.x + 1e-9 >= nxMin && p.x - 1e-9 <= nxMax) {
          nyMax = Math.max(nyMax, p.y);
        }
      }
    }
    nyMax = Math.max(nyMax * 1.15, nyMin + 1e-15);

    const oxMin = this.vxMin;
    const oxMax = this.vxMax;
    const oyMin = this.vyMin;
    const oyMax = this.vyMax;

    yield* all(
      this.ticksRoot().opacity(0, 0.12, easeOutCubic),
      this.gridRoot().opacity(0, 0.12, easeOutCubic),
    );
    yield* tween(duration, value => {
      const t = easeInOutCubic(value);
      this.vxMin = oxMin + (nxMin - oxMin) * t;
      this.vxMax = oxMax + (nxMax - oxMax) * t;
      this.vyMin = oyMin + (nyMin - oyMin) * t;
      this.vyMax = oyMax + (nyMax - oyMax) * t;
      this.remapAll();
    });
    this.rebuildDecorations();
    yield* all(
      this.ticksRoot().opacity(1, 0.22, easeOutCubic),
      this.gridRoot().opacity(this.useGrid ? 1 : 0, 0.22, easeOutCubic),
    );
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
      const xv = this.vxMin + t * (this.vxMax - this.vxMin);
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
      const yv = this.vyMin + t * (this.vyMax - this.vyMin);
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
