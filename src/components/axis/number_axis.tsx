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
const HIGHLIGHT = '#7aa2ff';
const MARK = '#f0a060';
/** 轴线两端超出首/末刻度的像素余量，避免箭头与末刻度重合 */
const AXIS_OVERHANG = 52;
const ARROW_SIZE = 18;
const LENGTH_LABEL_Y = -56;
const TICK_LABEL_Y = 56;
const TICK_LABEL_SIZE = 28;
const MARK_LABEL_Y = -78;
const MARK_STEM_H = 48;
/** 左上角精度标注 */
const PRECISION_Y = -228;
const PRECISION_SIZE = 30;

export interface NumberAxisProps extends NodeProps {
  /** 轴线可视宽度（像素），默认 1600 */
  axisWidth?: number;
  /** 初始可见区间左端 */
  viewMin?: number;
  /** 初始可见区间右端 */
  viewMax?: number;
  /** 主刻度步长 */
  tickStep?: number;
  /** 轴颜色 */
  stroke?: string;
}

interface TickHandles {
  value: number;
  major: boolean;
  tick: ReturnType<typeof createRef<Line>>;
  /** 仅主刻度有 LaTeX，次刻度不创建以降低开销 */
  label: ReturnType<typeof createRef<Latex>> | null;
}

export interface ZoomStep {
  min: number;
  max: number;
}

/**
 * 按进制 base 生成逐级放大区间，最多 maxLevels 次。
 * 例：value=0.2345, base=10, maxLevels=4
 *   → [0,1] → [0.2,0.3] → [0.23,0.24] → [0.234,0.235]
 * 例：base=2 时每次将含目标值的区间对半切开。
 */
export function buildZoomSteps(
  value: number,
  base = 10,
  maxLevels = 4,
): ZoomStep[] {
  if (base <= 1 || maxLevels < 1) return [];

  const steps: ZoomStep[] = [];
  let width = 1;

  for (let i = 0; i < maxLevels; i++) {
    const min = floorToWidth(value, width);
    const max = addWidth(min, width);
    steps.push({min, max});
    width = width / base;
  }

  return steps;
}

/** 十进制精确查找：放大次数 = 小数位数 */
export function buildDecimalZoomSteps(value: number): ZoomStep[] {
  return buildZoomSteps(value, 10, Math.max(1, countDecimals(value)));
}

function countDecimals(value: number): number {
  const normalized = Number(value.toPrecision(12));
  const s = normalized.toString().toLowerCase();
  if (s.includes('e')) {
    const [mant, expStr] = s.split('e');
    const exp = Number(expStr);
    const frac = mant.includes('.')
      ? mant.split('.')[1].replace(/0+$/, '').length
      : 0;
    return Math.max(0, frac - exp);
  }
  const i = s.indexOf('.');
  if (i < 0) return 0;
  return s.replace(/0+$/, '').length - i - 1 || 0;
}

/**
 * 对齐到 width 网格。
 * 注意：不能用 toFixed(-log10(width))——对 0.25/0.125 会算出只有 1 位小数，
 * 把 0.25 收成 0.3，最终区间/长度被显示成 1/3。
 */
function floorToWidth(value: number, width: number): number {
  const n = Math.floor(value / width + 1e-12);
  return n * width;
}

function addWidth(min: number, width: number): number {
  return min + width;
}

/**
 * 可缩放数轴：通过改变可见区间实现「放大某一段」，
 * 并可在放大后细分刻度。
 */
export class NumberAxis extends Node {
  private readonly axisLine = createRef<Line>();
  private readonly arrowR = createRef<Line>();
  private readonly ticksRoot = createRef<Node>();
  private readonly highlight = createRef<Rect>();
  private readonly lengthLabel = createRef<Latex>();
  private readonly precisionLabel = createRef<Latex>();
  private readonly markStem = createRef<Line>();
  private readonly markDot = createRef<Circle>();
  private readonly markLabel = createRef<Latex>();

  private readonly axisWidth: number;
  private readonly initMin: number;
  private readonly initMax: number;
  private readonly initStep: number;
  private viewMin: number;
  private viewMax: number;
  private tickStep: number;
  /** 细分时的进制/份数：新步长 = 旧步长 / base，主刻度为每 base 个次刻度 */
  private tickBase: number;
  private readonly strokeColor: string;

  private ticks: TickHandles[] = [];
  /** 刻度是否已入场；未入场时 layout 只改位置、不强制显示 */
  private ticksShown = false;
  /** 已标注并「记录」的数值；非空时缩放过程中持续跟随显示 */
  private markedValue: number | null = null;

  public constructor(props: NumberAxisProps = {}) {
    const {
      axisWidth = 1600,
      viewMin = -10,
      viewMax = 10,
      tickStep = 1,
      stroke = PAPER,
      ...rest
    } = props;

    super({...rest});

    this.axisWidth = axisWidth;
    this.initMin = viewMin;
    this.initMax = viewMax;
    this.initStep = tickStep;
    this.viewMin = viewMin;
    this.viewMax = viewMax;
    this.tickStep = tickStep;
    this.tickBase = 1;
    this.strokeColor = stroke;

    const half = axisWidth / 2;
    const y = 0;
    // 正方向箭头：尖端在轴末端，箭身在末端内侧，整体落在 overhang 余量内
    const tipX = half;
    const baseX = half - ARROW_SIZE;

    this.add(
      <Node>
        <Rect
          ref={this.highlight}
          height={56}
          y={-4}
          fill={HIGHLIGHT}
          opacity={0}
          radius={4}
          offset={[-1, 0]}
          width={0}
        />
        <Line
          ref={this.axisLine}
          points={[
            [-half, y],
            [half, y],
          ]}
          stroke={stroke}
          lineWidth={3}
          lineCap={'round'}
          end={0}
        />
        <Line
          ref={this.arrowR}
          points={[
            [baseX, y - 12],
            [tipX, y],
            [baseX, y + 12],
          ]}
          stroke={stroke}
          lineWidth={3}
          lineCap={'round'}
          lineJoin={'round'}
          end={0}
        />
        <Latex
          ref={this.lengthLabel}
          tex={['']}
          fill={PAPER}
          fontSize={32}
          y={LENGTH_LABEL_Y}
          opacity={0}
        />
        <Latex
          ref={this.precisionLabel}
          tex={[this.formatPrecisionTex(tickStep)]}
          fill={MUTED}
          fontSize={PRECISION_SIZE}
          x={-half + 12}
          y={PRECISION_Y}
          offset={[-1, 0]}
          opacity={0}
        />
        <Line
          ref={this.markStem}
          points={[
            [0, 0],
            [0, -MARK_STEM_H],
          ]}
          stroke={MARK}
          lineWidth={2.5}
          lineCap={'round'}
          end={0}
        />
        <Circle
          ref={this.markDot}
          width={14}
          height={14}
          fill={MARK}
          opacity={0}
        />
        <Latex
          ref={this.markLabel}
          tex={['']}
          fill={MARK}
          fontSize={34}
          y={MARK_LABEL_Y}
          opacity={0}
        />
        <Node ref={this.ticksRoot} />
      </Node>,
    );

    this.rebuildTicks(tickStep, true);
  }

  public get range(): {min: number; max: number} {
    return {min: this.viewMin, max: this.viewMax};
  }

  /**
   * 数值 → 轴上本地 x。
   * 刻度映射在轴宽减去两端 overhang 的区间内，
   * 因此首/末刻度与箭头之间留出一截空白。
   */
  public mapX(value: number): number {
    const tickSpan = this.axisWidth - AXIS_OVERHANG * 2;
    const t = (value - this.viewMin) / (this.viewMax - this.viewMin);
    return (t - 0.5) * tickSpan;
  }

  public *show(duration = 0.5): ThreadGenerator {
    // 先画数轴（仅正方向箭头），再淡入刻度与精度
    this.updatePrecisionLabel();
    yield* all(
      this.axisLine().end(1, duration, easeOutCubic),
      this.arrowR().end(1, duration, easeOutCubic),
    );
    yield* all(
      this.fadeTicks(1, 0.45),
      this.precisionLabel().opacity(1, 0.45, easeOutCubic),
    );
  }

  /** 高亮即将放大的区间：半透明矩形从左向右展开，完成后在上方用 LaTeX 标出长度 */
  public *highlightRange(
    min: number,
    max: number,
    duration = 0.4,
  ): ThreadGenerator {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const x0 = this.mapX(lo);
    const x1 = this.mapX(hi);
    const width = Math.max(0, x1 - x0);
    const hl = this.highlight();
    const lenLabel = this.lengthLabel();
    hl.x(x0);
    hl.width(0);
    hl.opacity(0.28);
    lenLabel.opacity(0);
    const len = hi - lo;
    // 长度标注的步长取区间本身，便于二进制下显示为分数
    const lenStep = len > 0 ? len : this.tickStep;
    lenLabel.tex([this.formatLatexNumber(len, lenStep)]);
    lenLabel.x((x0 + x1) / 2);
    yield* hl.width(width, duration, easeOutCubic);
    yield* lenLabel.opacity(1, 0.3, easeOutCubic);
  }

  public *clearHighlight(duration = 0.3): ThreadGenerator {
    yield* all(
      this.highlight().opacity(0, duration, easeOutCubic),
      this.lengthLabel().opacity(0, duration, easeOutCubic),
    );
  }

  /**
   * 将可见区间缩放到 [min, max]，使该段铺满轴线；
   * 刻度位置随区间插值移动（无限放大的感觉）。
   */
  public *zoomTo(
    min: number,
    max: number,
    duration = 1.4,
  ): ThreadGenerator {
    const fromMin = this.viewMin;
    const fromMax = this.viewMax;
    const hl = this.highlight();
    const lenLabel = this.lengthLabel();
    const hadHl = hl.opacity() > 0.01;

    yield* tween(duration, t => {
      const e = easeInOutCubic(t);
      this.viewMin = fromMin + (min - fromMin) * e;
      this.viewMax = fromMax + (max - fromMax) * e;
      this.layoutTicks();
      this.layoutMark();
      if (hadHl) {
        // 高亮始终对齐目标区间 [min,max]，随视野放大而铺满轴线
        const x0 = this.mapX(min);
        const x1 = this.mapX(max);
        hl.x(Math.min(x0, x1));
        hl.width(Math.abs(x1 - x0));
        lenLabel.x((x0 + x1) / 2);
      }
    });

    this.viewMin = min;
    this.viewMax = max;
    this.layoutTicks();
    this.layoutMark();
    if (hadHl) {
      // 放大结束后高亮已铺满整轴，淡出以免误判宽度
      yield* all(
        hl.opacity(0, 0.25, easeOutCubic),
        lenLabel.opacity(0, 0.25, easeOutCubic),
      );
    }
  }

  /**
   * 细分刻度：将当前步长除以 base，直接重建显示（无淡入淡出）。
   * 例：当前步长 1、base=10 → 新步长 0.1；再 subdivide(10) → 0.01。
   * @param base 每个原刻度区间再等分为几份
   */
  public *subdivide(base = 10): ThreadGenerator {
    if (base <= 1) return;
    yield* this.clearHighlight(0.25);
    this.tickBase = base;
    this.tickStep = this.tickStep / base;
    this.ticksShown = true;
    this.rebuildTicks(this.tickStep, false);
    this.layoutTicks();
    this.layoutMark();
    this.updatePrecisionLabel();
  }

  /**
   * 在轴上标注某个具体数值：垂线 + 圆点 + 上方 LaTeX 标签。
   * 标注后会持续跟随缩放显示。
   */
  public *markValue(value: number, duration = 0.5): ThreadGenerator {
    this.markedValue = value;
    const x = this.mapX(value);
    const stem = this.markStem();
    const dot = this.markDot();
    const label = this.markLabel();

    stem.x(x);
    stem.end(0);
    dot.x(x);
    dot.opacity(0);
    label.x(x);
    label.tex([this.formatMarkTex(value)]);
    label.opacity(0);

    yield* stem.end(1, duration * 0.55, easeOutCubic);
    yield* all(
      dot.opacity(1, duration * 0.35, easeOutCubic),
      label.opacity(1, duration * 0.45, easeOutCubic),
    );
  }

  /** 记录当前标注：脉冲强调，表示「记下这个刻度」 */
  public *recordMark(duration = 0.55): ThreadGenerator {
    if (this.markedValue === null) return;
    const dot = this.markDot();
    const label = this.markLabel();
    yield* all(
      dot.scale(1.55, duration * 0.4, easeOutCubic).to(1, duration * 0.6, easeInOutCubic),
      label.scale(1.2, duration * 0.4, easeOutCubic).to(1, duration * 0.6, easeInOutCubic),
    );
  }

  /**
   * 连续缩小视野回到初始区间；刻度随跨度逐步变粗，避免末尾突变。
   * 若已标注，数字标记全程跟随显示。
   *
   * 性能：tween 内只 layout；仅在步长升到下一档 10^n 时重建刻度
   *（禁止每帧 rebuildTicks / 创建 Latex，否则会严重卡顿）。
   */
  public *resetToInitial(duration = 2.4): ThreadGenerator {
    yield* this.clearHighlight(0.2);
    const fromMin = this.viewMin;
    const fromMax = this.viewMax;
    let currentStep = this.tickStep;

    yield* tween(duration, t => {
      const e = easeInOutCubic(t);
      this.viewMin = fromMin + (this.initMin - fromMin) * e;
      this.viewMax = fromMax + (this.initMax - fromMax) * e;

      const nice = this.pickZoomOutStep(this.viewMax - this.viewMin);
      const next = Math.min(this.initStep, Math.max(currentStep, nice));
      if (next > currentStep * (1 + 1e-9)) {
        currentStep = next;
        this.tickStep = next;
        this.tickBase = next >= this.initStep ? 1 : 10;
        this.rebuildTicks(next, false);
        this.updatePrecisionLabel();
      } else {
        this.layoutTicks();
      }
      this.layoutMark();
    });

    this.viewMin = this.initMin;
    this.viewMax = this.initMax;
    this.tickStep = this.initStep;
    this.tickBase = 1;
    this.ticksShown = true;
    if (Math.abs(currentStep - this.initStep) > 1e-12) {
      this.rebuildTicks(this.initStep, false);
    } else {
      this.layoutTicks();
    }
    this.layoutMark();
    this.updatePrecisionLabel();
  }

  /** 连续：高亮 → 放大 → 按 base 细分 */
  public *zoomInto(
    min: number,
    max: number,
    base = 10,
    zoomDuration = 1.4,
  ): ThreadGenerator {
    yield* this.highlightRange(min, max, 0.45);
    yield* waitFor(0.45);
    yield* this.zoomTo(min, max, zoomDuration);
    yield* waitFor(0.35);
    yield* this.subdivide(base);
  }

  /**
   * 完整演示：
   * 1) 按 base（默认 10）逐级放大并精确标出
   * 2) 记录 → 缩回原点 → 按 returnBase（默认 2）细分
   * 3) 再按 returnBase 查找同一数字，最多放大 maxLevels 次（控制精度；
   *    不一定落在刻度上）
   *
   * @param value 目标数，如 0.2345
   * @param base 第一轮细分进制，默认 10
   * @param returnBase 回到原点后的细分 / 第二轮进制，默认 2
   * @param maxLevels 第二轮最大放大次数（精度上限）
   */
  public *revealValue(
    value: number,
    base = 10,
    returnBase = 2,
    maxLevels = 8,
  ): ThreadGenerator {
    // ── 第一轮：十进制精确查找 ──
    const exactLevels =
      base === 10 ? Math.max(1, countDecimals(value)) : maxLevels;
    const stepsExact = buildZoomSteps(value, base, exactLevels);
    for (const step of stepsExact) {
      yield* this.zoomInto(step.min, step.max, base, 1.5);
      yield* waitFor(0.55);
    }
    yield* this.markValue(value, 0.55);
    yield* waitFor(0.45);
    yield* this.recordMark();
    yield* waitFor(0.5);
    yield* this.resetToInitial(2.4);
    yield* waitFor(0.35);
    yield* this.subdivide(returnBase);
    yield* waitFor(0.55);

    // ── 第二轮：有限精度查找（可能无法精确落在刻度上）──
    const stepsApprox = buildZoomSteps(value, returnBase, maxLevels);
    for (const step of stepsApprox) {
      yield* this.zoomInto(step.min, step.max, returnBase, 1.35);
      yield* waitFor(0.4);
    }
    // 标记已在，再强调一次落点
    yield* this.recordMark(0.5);
  }

  private *fadeTicks(to: number, duration: number): ThreadGenerator {
    if (this.ticks.length === 0) return;
    if (to > 0) this.ticksShown = true;
    yield* all(
      ...this.ticks.map(tk => {
        const inside = this.isTickInside(tk.value);
        const tickTo = to > 0 && inside ? to : 0;
        const labelTo = to > 0 && inside && tk.major && tk.label ? to : 0;
        if (tk.label) {
          return all(
            tk.tick().opacity(tickTo, duration, easeOutCubic),
            tk.label().opacity(labelTo, duration, easeOutCubic),
          );
        }
        return tk.tick().opacity(tickTo, duration, easeOutCubic);
      }),
    );
    if (to <= 0) this.ticksShown = false;
  }

  private rebuildTicks(step: number, startHidden: boolean) {
    this.ticksRoot().removeChildren();
    this.ticks = [];

    const {min, max} = this.visibleTickBounds(step);
    const majorEvery = this.pickMajorEvery(step);

    for (let v = min; v <= max + step * 0.5; v += step) {
      const value = this.roundTick(v, step);

      const major = this.isMajor(value, step, majorEvery);
      const tick = createRef<Line>();
      const label = major ? createRef<Latex>() : null;
      // 刻度只画在轴线上方；数字用 LaTeX 标在下方
      const h = major ? 14 : 7;
      const hidden = startHidden || !this.ticksShown;

      this.ticksRoot().add(
        <Line
          ref={tick}
          points={[
            [0, 0],
            [0, -h],
          ]}
          stroke={this.strokeColor}
          lineWidth={major ? 2.5 : 1.5}
          lineCap={'round'}
          opacity={hidden ? 0 : 1}
        />,
      );
      // 次刻度不挂 Latex，避免 KaTeX 拖垮预览帧率
      if (major && label) {
        this.ticksRoot().add(
          <Latex
            ref={label}
            tex={[this.formatLatexNumber(value, step)]}
            fill={MUTED}
            fontSize={TICK_LABEL_SIZE}
            y={TICK_LABEL_Y}
            opacity={hidden ? 0 : 1}
          />,
        );
      }

      this.ticks.push({value, major, tick, label});
    }

    this.layoutTicks();
  }

  private layoutTicks() {
    for (const tk of this.ticks) {
      const x = this.mapX(tk.value);
      tk.tick().x(x);
      if (tk.label) tk.label().x(x);
      // 未入场时只更新位置，保持透明，避免「先有刻度、没有数轴」
      if (!this.ticksShown) continue;
      const inside = this.isTickInside(tk.value);
      tk.tick().opacity(inside ? 1 : 0);
      if (tk.label) tk.label().opacity(inside && tk.major ? 1 : 0);
    }
  }

  /** 已标注数字随当前可见区间更新轴上位置 */
  private layoutMark() {
    if (this.markedValue === null) return;
    const x = this.mapX(this.markedValue);
    this.markStem().x(x);
    this.markDot().x(x);
    this.markLabel().x(x);
  }

  /** 左上角：当前细分精度（步长）用 base^{N} 显示，N 多为负数 */
  private updatePrecisionLabel() {
    this.precisionLabel().tex([this.formatPrecisionTex(this.tickStep)]);
  }

  private formatPrecisionTex(step: number): string {
    const base = this.tickBase >= 2 ? this.tickBase : 10;
    const n = Math.round(
      Math.log(Math.max(step, 1e-15)) / Math.log(base),
    );
    return `\\Delta = ${base}^{${n}}`;
  }

  /**
   * 缩小视野时的刻度步长：约一屏 10 格，取 10^n，
   * 与放大时的十进制细分互为逆过程。
   */
  private pickZoomOutStep(span: number): number {
    const target = Math.max(span / 10, 1e-12);
    const exp = Math.floor(Math.log10(target) + 1e-12);
    return Math.pow(10, exp);
  }

  /** 是否在当前数轴可见区间内（含端点） */
  private isTickInside(value: number): boolean {
    return value >= this.viewMin - 1e-9 && value <= this.viewMax + 1e-9;
  }

  private visibleTickBounds(step: number): {min: number; max: number} {
    // 多生成一截，缩放时边缘刻度可滑入；显示仍由 isTickInside 限制在轴内
    const pad = (this.viewMax - this.viewMin) * 0.3;
    const lo = this.viewMin - pad;
    const hi = this.viewMax + pad;
    const min = Math.ceil(lo / step - 1e-9) * step;
    const max = Math.floor(hi / step + 1e-9) * step;
    return {min, max};
  }

  private pickMajorEvery(_step: number): number {
    // 主刻度对齐上一层：每 base 个细刻度标一次数字
    return Math.max(1, this.tickBase);
  }

  private isMajor(value: number, step: number, every: number): boolean {
    const idx = Math.round(value / step);
    return idx % every === 0;
  }

  private roundTick(v: number, step: number): number {
    return this.snapToStep(v, step);
  }

  /** 对齐到步长网格，避免 0.25 被格式成 0.3 这类误差 */
  private snapToStep(value: number, step: number): number {
    if (step <= 0) return value;
    return Math.round(value / step) * step;
  }

  /**
   * 数值转 LaTeX：二元细分（步长为 1/2^k）用分数，否则用十进制。
   * 例：0.25 → \frac{1}{4}，0.5 → \frac{1}{2}
   */
  private formatLatexNumber(value: number, step = 1): string {
    const snapped = this.snapToStep(value, step);
    const eps = Math.max(Math.abs(step), 1e-12) * 0.5;
    if (Math.abs(snapped) < eps) return '0';

    if (this.tickBase === 2 || this.isDyadicStep(step)) {
      return this.toFractionTex(snapped, step);
    }

    const p = Math.max(0, Math.ceil(-Math.log10(Math.max(step, 1e-12)) - 1e-12));
    const n = Number(snapped.toFixed(p));
    if (n === 0) return '0';
    return n < 0 ? `-${Math.abs(n)}` : `${n}`;
  }

  /** 步长是否为 1/2^k（二进制刻度） */
  private isDyadicStep(step: number): boolean {
    if (step <= 0) return false;
    const denom = Math.round(1 / step);
    if (denom <= 0) return false;
    if (Math.abs(1 / denom - step) > 1e-9) return false;
    return (denom & (denom - 1)) === 0;
  }

  /** 将网格点写成最简分数 LaTeX */
  private toFractionTex(value: number, step: number): string {
    let denom = Math.max(1, Math.round(1 / step));
    let num = Math.round(value / step);
    const g = gcd(Math.abs(num), denom);
    num /= g;
    denom /= g;
    if (denom === 1) return num < 0 ? `-${Math.abs(num)}` : `${num}`;
    if (num < 0) return `-\\frac{${Math.abs(num)}}{${denom}}`;
    return `\\frac{${num}}{${denom}}`;
  }

  /** 标注点用：保留有效小数，避免科学计数 */
  private formatMarkTex(value: number): string {
    if (value === 0) return '0';
    const text = Number(value.toPrecision(12)).toString();
    return value < 0 ? `-${text.replace('-', '')}` : text;
  }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}
