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
  waitFor,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";

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
  /**
   * 右侧图注文案，与 complexities 一一对应；
   * 未传或某项缺省时回退到复杂度自身标签（如 O(n)）。
   */
  legendLabels?: string[];
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
  "O(1)": { label: "O(1)", color: Ink.paperSoft, fn: () => 1 },
  "O(log n)": {
    label: "O(log n)",
    color: "#6B7F6A",
    fn: (n) => Math.log2(Math.max(n, 1)),
  },
  "O(n)": { label: "O(n)", color: Ink.gold, fn: (n) => n },
  "O(n log n)": {
    label: "O(n log n)",
    color: "#9A8B6E",
    fn: (n) => n * Math.log2(Math.max(n, 1)),
  },
  "O(n²)": { label: "O(n²)", color: Ink.goldSoft, fn: (n) => n * n },
  "O(n^2)": { label: "O(n²)", color: Ink.goldSoft, fn: (n) => n * n },
  "O(n³)": { label: "O(n³)", color: "#8B6B5C", fn: (n) => n * n * n },
  "O(n^3)": { label: "O(n³)", color: "#8B6B5C", fn: (n) => n * n * n },
  "O(2ⁿ)": {
    label: "O(2ⁿ)",
    color: Ink.warn,
    fn: (n) => Math.pow(2, n),
    explosive: true,
  },
  "O(2^n)": {
    label: "O(2ⁿ)",
    color: Ink.warn,
    fn: (n) => Math.pow(2, n),
    explosive: true,
  },
  "O(n!)": {
    label: "O(n!)",
    color: Ink.warnDeep,
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
 * play = 轴/图注 → 同时描线 → 依次高亮曲线与图注。
 */
export class ComplexityPlot extends Node {
  private readonly curves = createRefArray<Line>();
  private readonly legendLines = createRefArray<Line>();
  private readonly legendTexts = createRefArray<Txt>();
  private readonly axesRoot = createRef<Node>();
  private readonly legendRoot = createRef<Node>();
  private readonly curveColors: string[] = [];
  private readonly baseLineWidth: number;

  public constructor(props: ComplexityPlotProps) {
    const {
      complexities,
      nMax: rawNMax = 16,
      width = 720,
      height = 480,
      samples = 160,
      lineWidth = Ink.lineWidth,
      axisColor = Ink.muted,
      gridColor = Ink.line,
      gridX = 4,
      gridY = 4,
      legendWidth = 168,
      legendLabels,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.baseLineWidth = lineWidth;

    if (!complexities || complexities.length === 0) {
      throw new Error("ComplexityPlot: complexities 不能为空");
    }

    const nMin = 1;
    const nMax = Math.max(nMin + 1e-6, rawNMax);
    const metas = complexities.map((key, i) => {
      const meta = resolveComplexity(key);
      const custom = legendLabels?.[i]?.trim();
      return custom ? { ...meta, label: custom } : meta;
    });
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
          lineWidth={Ink.lineWidth}
          endArrow
          arrowSize={10}
        />
        <Line
          points={[origin, yAxisEnd]}
          stroke={axisColor}
          lineWidth={Ink.lineWidth}
          endArrow
          arrowSize={10}
        />
        <Txt
          text="n"
          fill={Ink.paperSoft}
          fontSize={22}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={xAxisEnd.x + 18}
          y={xAxisEnd.y}
        />
        <Txt
          text="T"
          fill={Ink.paperSoft}
          fontSize={22}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={yAxisEnd.x}
          y={yAxisEnd.y - 22}
        />
        <Txt
          text="0"
          fill={Ink.paperSoft}
          fontSize={20}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={origin.x - 14}
          y={origin.y + 18}
        />
        <Txt
          text={formatTick(nMax)}
          fill={Ink.paperSoft}
          fontSize={20}
          fontFamily="JetBrains Mono, Consolas, monospace"
          x={xAxisEnd.x}
          y={xAxisEnd.y + 20}
        />
        <Txt
          text={formatTick(dataYMax)}
          fill={Ink.paperSoft}
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
      this.curveColors.push(metas[s].color);
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
              ref={this.legendLines}
              points={[
                [-legendWidth / 2 + 8, 0],
                [-legendWidth / 2 + 40, 0],
              ]}
              stroke={meta.color}
              lineWidth={lineWidth}
              lineCap="round"
            />
            <Txt
              ref={this.legendTexts}
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

  /**
   * 高亮第 index 条曲线及其图注（加粗 + 提亮），其余略淡；结束后复原。
   * 各段 up/hold/down 固定等长，避免因曲线长短造成「亮得久/短」的观感偏差。
   */
  public *highlight(index: number, duration = 1.2): ThreadGenerator {
    const count = this.curves.length;
    if (count === 0) return;
    const i = Math.max(0, Math.min(count - 1, Math.floor(index)));
    // 固定三阶段，不按曲线长度变化
    const up = 0.28;
    const hold = Math.max(0.55, duration - up * 2);
    const down = 0.28;
    const peakW = this.baseLineWidth * 3.2;
    const hi = Highlight.accent;

    yield* all(
      ...this.curves.map((curve, j) =>
        j === i
          ? all(
              curve.lineWidth(peakW, up, easeOutCubic),
              curve.stroke(hi, up, easeOutCubic),
              curve.opacity(1, up, easeOutCubic),
            )
          : curve.opacity(0.22, up, easeOutCubic),
      ),
      ...this.legendLines.map((line, j) =>
        j === i
          ? all(
              line.lineWidth(peakW, up, easeOutCubic),
              line.stroke(hi, up, easeOutCubic),
              line.opacity(1, up, easeOutCubic),
            )
          : line.opacity(0.22, up, easeOutCubic),
      ),
      ...this.legendTexts.map((txt, j) =>
        j === i
          ? all(
              txt.fill(hi, up, easeOutCubic),
              txt.scale(1.1, up, easeOutCubic),
              txt.opacity(1, up, easeOutCubic),
            )
          : txt.opacity(0.22, up, easeOutCubic),
      ),
    );

    yield* waitFor(hold);

    yield* all(
      ...this.curves.map((curve, j) =>
        all(
          curve.lineWidth(this.baseLineWidth, down, easeInOutCubic),
          curve.stroke(this.curveColors[j], down, easeInOutCubic),
          curve.opacity(1, down, easeInOutCubic),
        ),
      ),
      ...this.legendLines.map((line, j) =>
        all(
          line.lineWidth(this.baseLineWidth, down, easeInOutCubic),
          line.stroke(this.curveColors[j], down, easeInOutCubic),
          line.opacity(1, down, easeInOutCubic),
        ),
      ),
      ...this.legendTexts.map((txt, j) =>
        all(
          txt.fill(this.curveColors[j], down, easeInOutCubic),
          txt.scale(1, down, easeInOutCubic),
          txt.opacity(1, down, easeInOutCubic),
        ),
      ),
    );
  }

  /** 按图注顺序依次高亮每条曲线（每条同等时长） */
  public *highlightSequence(
    duration = 1.2,
    gap = 0.3,
  ): ThreadGenerator {
    for (let i = 0; i < this.curves.length; i++) {
      yield* this.highlight(i, duration);
      if (i < this.curves.length - 1 && gap > 0) {
        yield* waitFor(gap);
      }
    }
  }

  /** 先轴/图注，再同时描线，再依次高亮 */
  public *play(
    axesDuration = 0.55,
    traceDuration = 1.4,
    highlightDuration = 1.2,
  ): ThreadGenerator {
    yield* this.showAxes(axesDuration);
    yield* this.trace(traceDuration);
    yield* waitFor(0.35);
    yield* this.highlightSequence(highlightDuration);
  }
}
