import { Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  PossibleVector2,
  ThreadGenerator,
  Vector2,
  all,
  createRefArray,
  easeInOutCubic,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";

export type PlotFn = (x: number) => number;

export interface FunctionPlotProps extends NodeProps {
  /** y = fn(x) */
  fn: PlotFn;
  /**
   * x 区间左端，默认 0。
   * 仅第一象限：会钳到 ≥ 0。
   */
  xMin?: number;
  /** x 区间右端（须 > xMin，且为正） */
  xMax: number;
  /** 绘图区宽度（像素） */
  width?: number;
  /** 绘图区高度（像素） */
  height?: number;
  /** 采样点数，默认 200 */
  samples?: number;
  /** 曲线颜色，默认琥珀 */
  stroke?: string;
  /** 曲线线宽 */
  lineWidth?: number;
  /** 坐标轴颜色 */
  axisColor?: string;
  /** y 上端相对边距比例，默认 0.08 */
  yPadding?: number;
}

function formatTick(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) < 1e-9) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e3 || abs < 1e-2) return n.toExponential(1);
  return String(Number(n.toPrecision(3)));
}

/**
 * 二维函数图像（仅第一象限）：
 * 传入 fn(x)，在 [xMin, xMax]（均 ≥ 0）上采样，y 从 0 自动适配上界；
 * 只画正 x / 正 y 轴；通过 trace() 从左到右描线。
 */
export class FunctionPlot extends Node {
  private readonly curves = createRefArray<Line>();
  private readonly plotW: number;
  private readonly plotH: number;
  private readonly xMin: number;
  private readonly xMax: number;
  private readonly yMin: number;
  private readonly yMax: number;

  public constructor(props: FunctionPlotProps) {
    const {
      fn,
      xMin: rawXMin = 0,
      xMax: rawXMax,
      width = 800,
      height = 450,
      samples = 200,
      stroke = Highlight.accent,
      lineWidth = 3,
      axisColor = "#6B7280",
      yPadding = 0.08,
      ...nodeProps
    } = props;

    super(nodeProps);

    const xMin = Math.max(0, rawXMin);
    const xMax = Math.max(0, rawXMax);
    if (!(xMax > xMin)) {
      throw new Error("FunctionPlot: xMax 必须大于 xMin（第一象限，均 ≥ 0）");
    }

    this.plotW = width;
    this.plotH = height;
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = 0;

    const n = Math.max(2, Math.floor(samples));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = xMin + (xMax - xMin) * t;
      const y = fn(x);
      xs.push(x);
      ys.push(y);
    }

    // 仅保留非负有限 y，上界自动适配；下界固定为 0
    const finiteYs = ys.filter((y) => Number.isFinite(y) && y >= 0);
    let dataYMax = 1;
    if (finiteYs.length > 0) {
      dataYMax = Math.max(...finiteYs, 0);
    }
    if (dataYMax <= 0) {
      dataYMax = 1;
    }
    const yMax = dataYMax * (1 + yPadding);
    this.yMax = yMax;

    // 原点在绘图区左下，只铺满第一象限
    const toLocal = (x: number, y: number): Vector2 => {
      const px = ((x - xMin) / (xMax - xMin) - 0.5) * width;
      const py = (0.5 - (y - 0) / (yMax - 0)) * height;
      return new Vector2(px, py);
    };

    const origin = toLocal(xMin === 0 ? 0 : xMin, 0);
    // 正半轴：从原点（或可视左下）沿 +x / +y
    const xAxisStart = toLocal(xMin, 0);
    const xAxisEnd = toLocal(xMax, 0);
    const yAxisStart = toLocal(xMin, 0);
    const yAxisEnd = toLocal(xMin, yMax);

    this.add(
      <Line
        points={[xAxisStart, xAxisEnd]}
        stroke={axisColor}
        lineWidth={2}
        endArrow
        arrowSize={10}
      />,
    );
    this.add(
      <Line
        points={[yAxisStart, yAxisEnd]}
        stroke={axisColor}
        lineWidth={2}
        endArrow
        arrowSize={10}
      />,
    );

    const labelColor = "#9CA3AF";
    const labelSize = 22;
    const labelGap = 18;

    // 原点、xMax、yMax
    this.add(
      <Txt
        text="0"
        fill={labelColor}
        fontSize={labelSize}
        fontFamily="JetBrains Mono, Consolas, monospace"
        x={origin.x - labelGap * 0.6}
        y={origin.y + labelGap}
      />,
    );
    this.add(
      <Txt
        text={formatTick(xMax)}
        fill={labelColor}
        fontSize={labelSize}
        fontFamily="JetBrains Mono, Consolas, monospace"
        x={xAxisEnd.x}
        y={xAxisEnd.y + labelGap}
      />,
    );
    this.add(
      <Txt
        text={formatTick(dataYMax)}
        fill={labelColor}
        fontSize={labelSize}
        fontFamily="JetBrains Mono, Consolas, monospace"
        x={yAxisEnd.x - labelGap}
        y={yAxisEnd.y}
        offsetX={1}
      />,
    );

    // —— 按有限非负值切段 ——
    const segments: PossibleVector2[][] = [];
    let current: PossibleVector2[] = [];
    for (let i = 0; i < n; i++) {
      const y = ys[i];
      if (!Number.isFinite(y) || y < 0) {
        if (current.length >= 2) segments.push(current);
        current = [];
        continue;
      }
      current.push(toLocal(xs[i], y));
    }
    if (current.length >= 2) segments.push(current);

    for (const points of segments) {
      this.add(
        <Line
          ref={this.curves}
          points={points}
          stroke={stroke}
          lineWidth={lineWidth}
          lineCap="round"
          lineJoin="round"
          end={0}
        />,
      );
    }
  }

  /** 从左到右描出曲线 */
  public *trace(duration = 1.2): ThreadGenerator {
    if (this.curves.length === 0) {
      return;
    }
    yield* all(
      ...this.curves.map((curve) => curve.end(1, duration, easeInOutCubic)),
    );
  }

  /** 当前 y 范围（yMin 恒为 0） */
  public getYRange(): { yMin: number; yMax: number } {
    return { yMin: this.yMin, yMax: this.yMax };
  }
}
