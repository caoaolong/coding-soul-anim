import { Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  PossibleVector2,
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";

/** 内置支持的时间复杂度标识 */
export type ComplexityKind =
  | "O(1)"
  | "O(log n)"
  | "O(n)"
  | "O(n log n)"
  | "O(n²)"
  | "O(n^2)"
  | "O(n³)"
  | "O(n^3)"
  | "O(2ⁿ)"
  | "O(2^n)"
  | "O(n!)";

export interface ComplexityPlotProps extends NodeProps {
  /** 要绘制的复杂度列表（预设字符串） */
  complexities: ComplexityKind[];
  /** 横轴 n 上界，默认 16 */
  nMax?: number;
  /** 绘图区宽度（不含图注） */
  width?: number;
  /** 绘图区高度 */
  height?: number;
  /** 采样点数，默认 160 */
  samples?: number;
  /** 曲线线宽 */
  lineWidth?: number;
  /** 坐标轴颜色 */
  axisColor?: string;
  /** 网格线颜色 */
  gridColor?: string;
  /** 横轴方向网格分段数（不含原点轴），默认 4 */
  gridX?: number;
  /** 纵轴方向网格分段数（不含原点轴），默认 4 */
  gridY?: number;
  /** 图注区域宽度，默认 160 */
  legendWidth?: number;
}

type ComplexityMeta = {
  label: string;
  color: string;
  fn: (n: number) => number;
  /** 增长极快，与多项式同屏时做视觉封顶 */
  explosive?: boolean;
};

function factorial(n: number): number {
  const k = Math.max(0, Math.floor(n));
  if (k > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

const COMPLEXITY_TABLE: Record<string, ComplexityMeta> = {
  "O(1)": { label: "O(1)", color: Highlight.muted, fn: () => 1 },
  "O(log n)": {
    label: "O(log n)",
    color: "#38BDF8",
    fn: (n) => Math.log2(Math.max(n, 1)),
  },
  "O(n)": { label: "O(n)", color: Highlight.accent, fn: (n) => n },
  "O(n log n)": {
    label: "O(n log n)",
    color: "#34D399",
    fn: (n) => n * Math.log2(Math.max(n, 1)),
  },
  "O(n²)": { label: "O(n²)", color: "#F97316", fn: (n) => n * n },
  "O(n^2)": { label: "O(n²)", color: "#F97316", fn: (n) => n * n },
  "O(n³)": { label: "O(n³)", color: "#FB7185", fn: (n) => n * n * n },
  "O(n^3)": { label: "O(n³)", color: "#FB7185", fn: (n) => n * n * n },
  "O(2ⁿ)": {
    label: "O(2ⁿ)",
    color: "#EF4444",
    fn: (n) => Math.pow(2, n),
    explosive: true,
  },
  "O(2^n)": {
    label: "O(2ⁿ)",
    color: "#EF4444",
    fn: (n) => Math.pow(2, n),
    explosive: true,
  },
  "O(n!)": {
    label: "O(n!)",
    color: "#D97706",
    fn: (n) => factorial(n),
    explosive: true,
  },
};

function resolveComplexity(key: string): ComplexityMeta {
  const meta = COMPLEXITY_TABLE[key];
  if (!meta) {
    const supported = Object.keys(COMPLEXITY_TABLE).join(", ");
    throw new Error(`ComplexityPlot: 不支持的复杂度 "${key}"。可用：${supported}`);
  }
  return meta;
}

function formatTick(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) < 1e-9) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e3 || abs < 1e-2) return n.toExponential(1);
  return String(Number(n.toPrecision(3)));
}

/**
 * 算法时间复杂度对比图（第一象限）：
 * 传入多个预设复杂度字符串，右侧图注；
 * showAxes 先出轴与图注，trace 同时描出全部曲线；play = 二者串联。
 */
export class ComplexityPlot extends Node {
  private readonly curves = createRefArray<Line>();
  private readonly axesRoot = createRef<Node>();
  private readonly legendRoot = createRef<Node>();

  public constructor(props: ComplexityPlotProps) {
    const {
      complexities,
      nMax: rawNMax = 16,
      width = 720,
      height = 480,
      samples = 160,
      lineWidth = 3,
      axisColor = "#6B7280",
      gridColor = "#2D2D2D",
      gridX = 4,
      gridY = 4,
      legendWidth = 168,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!complexities || complexities.length === 0) {
      throw new Error("ComplexityPlot: complexities 不能为空");
    }

    const nMin = 1;
    const nMax = Math.max(nMin + 1e-6, rawNMax);
    const metas = complexities.map(resolveComplexity);
    const sampleCount = Math.max(2, Math.floor(samples));

    const xs: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1);
      xs.push(nMin + (nMax - nMin) * t);
    }

    const seriesRaw: number[][] = metas.map((meta) =>
      xs.map((x) => {
        const y = meta.fn(x);
        return Number.isFinite(y) && y >= 0 ? y : NaN;
      }),
    );

    // 多项式类决定可视上界；指数/阶乘同屏时封顶，避免压扁其它曲线
    let moderateMax = 0;
    let anyModerate = false;
    for (let s = 0; s < metas.length; s++) {
      if (metas[s].explosive) continue;
      anyModerate = true;
      for (const y of seriesRaw[s]) {
        if (Number.isFinite(y)) moderateMax = Math.max(moderateMax, y);
      }
    }

    let globalMax = 0;
    for (const row of seriesRaw) {
      for (const y of row) {
        if (Number.isFinite(y)) globalMax = Math.max(globalMax, y);
      }
    }

    const dataYMax =
      anyModerate && moderateMax > 0
        ? moderateMax
        : globalMax > 0
          ? globalMax
          : 1;
    // 爆炸类允许略高于多项式上界，仍封顶以免整屏只剩一条竖线
    const clipY = dataYMax * (anyModerate ? 1.35 : 1);
    const yMax = clipY * 1.08;

    const seriesClipped: number[][] = seriesRaw.map((row, s) =>
      metas[s].explosive
        ? row.map((y) => (Number.isFinite(y) ? Math.min(y, clipY) : y))
        : row,
    );

    const gap = 36;
    const plotOffsetX = -(legendWidth + gap) / 2;
    const legendOffsetX = width / 2 + gap / 2 + plotOffsetX + legendWidth / 2;

    const toLocal = (n: number, y: number): Vector2 => {
      const px = ((n - nMin) / (nMax - nMin) - 0.5) * width + plotOffsetX;
      const py = (0.5 - y / yMax) * height;
      return new Vector2(px, py);
    };

    const origin = toLocal(nMin, 0);
    const xAxisEnd = toLocal(nMax, 0);
    const yAxisEnd = toLocal(nMin, yMax);

    const xDiv = Math.max(1, Math.floor(gridX));
    const yDiv = Math.max(1, Math.floor(gridY));
    const gridLines: PossibleVector2[][] = [];
    for (let i = 1; i <= xDiv; i++) {
      const n = nMin + ((nMax - nMin) * i) / xDiv;
      gridLines.push([toLocal(n, 0), toLocal(n, yMax)]);
    }
    for (let i = 1; i <= yDiv; i++) {
      const y = (yMax * i) / yDiv;
      gridLines.push([toLocal(nMin, y), toLocal(nMax, y)]);
    }

    this.add(
      <Node ref={this.axesRoot} opacity={0}>
        {gridLines.map((points) => (
          <Line
            points={points}
            stroke={gridColor}
            lineWidth={1}
            opacity={0.9}
          />
        ))}
        <Line
          points={[origin, xAxisEnd]}
          stroke={axisColor}
          lineWidth={2}
          endArrow
          arrowSize={10}
        />
        <Line
          points={[origin, yAxisEnd]}
          stroke={axisColor}
          lineWidth={2}
          endArrow
          arrowSize={10}
        />
        <Txt
          text="n"
          fill="#9CA3AF"
          fontSize={22}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={xAxisEnd.x + 18}
          y={xAxisEnd.y}
        />
        <Txt
          text="T"
          fill="#9CA3AF"
          fontSize={22}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={yAxisEnd.x}
          y={yAxisEnd.y - 22}
        />
        <Txt
          text="0"
          fill="#9CA3AF"
          fontSize={20}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={origin.x - 14}
          y={origin.y + 18}
        />
        <Txt
          text={formatTick(nMax)}
          fill="#9CA3AF"
          fontSize={20}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={xAxisEnd.x}
          y={xAxisEnd.y + 20}
        />
        <Txt
          text={formatTick(dataYMax)}
          fill="#9CA3AF"
          fontSize={20}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={yAxisEnd.x - 14}
          y={yAxisEnd.y}
          offsetX={1}
        />
      </Node>,
    );

    // 曲线（初始 end=0）
    for (let s = 0; s < metas.length; s++) {
      const points: PossibleVector2[] = [];
      for (let i = 0; i < sampleCount; i++) {
        const y = seriesClipped[s][i];
        if (!Number.isFinite(y)) continue;
        points.push(toLocal(xs[i], y));
      }
      if (points.length < 2) continue;
      this.add(
        <Line
          ref={this.curves}
          points={points}
          stroke={metas[s].color}
          lineWidth={lineWidth}
          lineCap="round"
          lineJoin="round"
          end={0}
        />,
      );
    }

    // 右侧图注
    const rowH = 36;
    const legendH = metas.length * rowH;
    this.add(
      <Node ref={this.legendRoot} x={legendOffsetX} opacity={0}>
        {metas.map((meta, i) => (
          <Node y={-legendH / 2 + rowH / 2 + i * rowH}>
            <Line
              points={[
                [-legendWidth / 2 + 8, 0],
                [-legendWidth / 2 + 40, 0],
              ]}
              stroke={meta.color}
              lineWidth={lineWidth}
              lineCap="round"
            />
            <Txt
              text={meta.label}
              fill={meta.color}
              fontSize={24}
              fontFamily="JetBrains Mono, Consolas, monospace"
              x={-legendWidth / 2 + 52}
              offsetX={-1}
            />
          </Node>
        ))}
      </Node>,
    );
  }

  /** 坐标轴 + 图注淡入 */
  public *showAxes(duration = 0.55): ThreadGenerator {
    yield* all(
      this.axesRoot().opacity(1, duration, easeOutCubic),
      this.legendRoot().opacity(1, duration, easeOutCubic),
    );
  }

  /** 全部曲线同时从左到右描线 */
  public *trace(duration = 1.4): ThreadGenerator {
    if (this.curves.length === 0) return;
    yield* all(
      ...this.curves.map((curve) => curve.end(1, duration, easeInOutCubic)),
    );
  }

  /** 先轴/图注，再同时描线 */
  public *play(axesDuration = 0.55, traceDuration = 1.4): ThreadGenerator {
    yield* this.showAxes(axesDuration);
    yield* this.trace(traceDuration);
  }
}
