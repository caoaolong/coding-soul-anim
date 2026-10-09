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
const DEC_COLOR = '#e8eef7';
const BIN_COLOR = '#f0a060';
const COINCIDE = '#3dd6c6';
/** 轴线两端超出首/末刻度的像素余量 */
const AXIS_OVERHANG = 52;
const ARROW_SIZE = 18;
const LENGTH_LABEL_Y = -64;
const DEC_LABEL_Y = -52;
const BIN_LABEL_Y = 52;
const TICK_LABEL_SIZE = 26;
const MARK_LABEL_Y = -92;
const MARK_STEM_H = 56;
const PRECISION_SIZE = 28;
const PRECISION_DEC_Y = -210;
const PRECISION_BIN_Y = 210;
const COINCIDE_R = 24;

export interface DualNumberAxisProps extends NodeProps {
  /** 轴线可视宽度（像素），默认 1600 */
  axisWidth?: number;
  /** 初始可见区间左端 */
  viewMin?: number;
  /** 初始可见区间右端 */
  viewMax?: number;
  /** 上半区（十进制）初始步长 */
  decStep?: number;
  /** 下半区（二进制）初始步长 */
  binStep?: number;
  /** 轴颜色 */
  stroke?: string;
}

interface TickHandles {
  value: number;
  major: boolean;
  tick: ReturnType<typeof createRef<Line>>;
  label: ReturnType<typeof createRef<Latex>> | null;
}

interface CoincideHandles {
  value: number;
  ring: ReturnType<typeof createRef<Circle>>;
}

/**
 * 双刻度数轴：
 * - 上半区：十进制刻度（向上）+ 十进制标注
 * - 下半区：二进制刻度（向下）+ 分数标注
 * - 共享视野，可高亮 / 放大到某一区间，两侧各自细分
 */
export class DualNumberAxis extends Node {
  private readonly axisLine = createRef<Line>();
  private readonly arrowR = createRef<Line>();
  private readonly ticksDecRoot = createRef<Node>();
  private readonly ticksBinRoot = createRef<Node>();
  private readonly coincideRoot = createRef<Node>();
  private readonly highlight = createRef<Rect>();
  private readonly lengthLabel = createRef<Latex>();
  private readonly precisionDec = createRef<Latex>();
  private readonly precisionBin = createRef<Latex>();
  private readonly markStem = createRef<Line>();
  private readonly markDot = createRef<Circle>();
  private readonly markLabel = createRef<Latex>();

  private readonly axisWidth: number;
  private readonly initMin: number;
  private readonly initMax: number;
  private readonly initDecStep: number;
  private readonly initBinStep: number;
  private viewMin: number;
  private viewMax: number;
  private decStep: number;
  private binStep: number;
  private decBase = 10;
  private binBase = 2;
  private readonly strokeColor: string;

  private ticksDec: TickHandles[] = [];
  private ticksBin: TickHandles[] = [];
  private coincides: CoincideHandles[] = [];
  private ticksShown = false;
  private markedValue: number | null = null;

  public constructor(props: DualNumberAxisProps = {}) {
    const {
      axisWidth = 1600,
      viewMin = -2,
      viewMax = 2,
      decStep = 1,
      binStep = 1,
      stroke = PAPER,
      ...rest
    } = props;

    super({...rest});

    this.axisWidth = axisWidth;
    this.initMin = viewMin;
    this.initMax = viewMax;
    this.initDecStep = decStep;
    this.initBinStep = binStep;
    this.viewMin = viewMin;
    this.viewMax = viewMax;
    this.decStep = decStep;
    this.binStep = binStep;
    this.strokeColor = stroke;

    const half = axisWidth / 2;
    const tipX = half;
    const baseX = half - ARROW_SIZE;

    this.add(
      <Node>
        <Rect
          ref={this.highlight}
          height={72}
          y={0}
          fill={HIGHLIGHT}
          opacity={0}
          radius={4}
          offset={[-1, 0]}
          width={0}
        />
        <Line
          ref={this.axisLine}
          points={[
            [-half, 0],
            [half, 0],
          ]}
          stroke={stroke}
          lineWidth={3}
          lineCap={'round'}
          end={0}
        />
        <Line
          ref={this.arrowR}
          points={[
            [baseX, -12],
            [tipX, 0],
            [baseX, 12],
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
          fontSize={30}
          y={LENGTH_LABEL_Y}
          opacity={0}
        />
        <Latex
          ref={this.precisionDec}
          tex={[this.formatPrecisionTex(10, decStep)]}
          fill={DEC_COLOR}
          fontSize={PRECISION_SIZE}
          x={-half + 12}
          y={PRECISION_DEC_Y}
          offset={[-1, 0]}
          opacity={0}
        />
        <Latex
          ref={this.precisionBin}
          tex={[this.formatPrecisionTex(2, binStep)]}
          fill={BIN_COLOR}
          fontSize={PRECISION_SIZE}
          x={-half + 12}
          y={PRECISION_BIN_Y}
          offset={[-1, 0]}
          opacity={0}
        />
        <Line
          ref={this.markStem}
          points={[
            [0, MARK_STEM_H * 0.35],
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
          fontSize={32}
          y={MARK_LABEL_Y}
          opacity={0}
        />
        <Node ref={this.ticksDecRoot} />
        <Node ref={this.ticksBinRoot} />
        {/* 十进制∩二进制重合点：圆圈 + 数值 */}
        <Node ref={this.coincideRoot} zIndex={4} />
      </Node>,
    );

    this.rebuildDecTicks(true);
    this.rebuildBinTicks(true);
  }

  public get range(): {min: number; max: number} {
    return {min: this.viewMin, max: this.viewMax};
  }

  /** 数值 → 轴上本地 x（两端留 overhang） */
  public mapX(value: number): number {
    const tickSpan = this.axisWidth - AXIS_OVERHANG * 2;
    const t = (value - this.viewMin) / (this.viewMax - this.viewMin);
    return (t - 0.5) * tickSpan;
  }

  public *show(duration = 0.5): ThreadGenerator {
    this.updatePrecisionLabels();
    yield* all(
      this.axisLine().end(1, duration, easeOutCubic),
      this.arrowR().end(1, duration, easeOutCubic),
    );
    yield* all(
      this.fadeSide(this.ticksDec, 1, 0.45),
      this.fadeSide(this.ticksBin, 1, 0.45),
      this.precisionDec().opacity(1, 0.45, easeOutCubic),
      this.precisionBin().opacity(1, 0.45, easeOutCubic),
    );
    this.ticksShown = true;
  }

  /** 高亮即将放大的区间 */
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
    const lenStep = len > 0 ? len : Math.min(this.decStep, this.binStep);
    lenLabel.tex([this.formatLengthTex(len, lenStep)]);
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

  /** 将可见区间缩放到 [min, max]；双侧刻度只 layout、不重建 */
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
      this.layoutAllTicks();
      this.layoutMark();
      this.layoutCoincidences();
      if (hadHl) {
        const x0 = this.mapX(min);
        const x1 = this.mapX(max);
        hl.x(Math.min(x0, x1));
        hl.width(Math.abs(x1 - x0));
        lenLabel.x((x0 + x1) / 2);
      }
    });

    this.viewMin = min;
    this.viewMax = max;
    this.layoutAllTicks();
    this.layoutMark();
    this.layoutCoincidences();
    if (hadHl) {
      yield* all(
        hl.opacity(0, 0.25, easeOutCubic),
        lenLabel.opacity(0, 0.25, easeOutCubic),
      );
    }
  }

  /**
   * 上半区十进制细分：步长 ÷ base。
   * @param showCoincide 是否在细分后刷新重合标注（默认 true）
   */
  public *subdivideDec(base = 10, showCoincide = true): ThreadGenerator {
    if (base <= 1) return;
    if (showCoincide) yield* this.fadeOutCoincidences(0.25);
    this.decBase = base;
    this.decStep = this.decStep / base;
    this.ticksShown = true;
    this.rebuildDecTicks(false);
    this.layoutAllTicks();
    this.layoutMark();
    this.updatePrecisionLabels();
    if (showCoincide) yield* this.refreshCoincidences();
  }

  /**
   * 下半区二进制细分：步长 ÷ base。
   * @param showCoincide 是否在细分后刷新重合标注（默认 true）
   */
  public *subdivideBin(base = 2, showCoincide = true): ThreadGenerator {
    if (base <= 1) return;
    if (showCoincide) yield* this.fadeOutCoincidences(0.25);
    this.binBase = base;
    this.binStep = this.binStep / base;
    this.ticksShown = true;
    this.rebuildBinTicks(false);
    this.layoutAllTicks();
    this.layoutMark();
    this.updatePrecisionLabels();
    if (showCoincide) yield* this.refreshCoincidences();
  }

  /**
   * 高亮 → 放大 → 两侧各细分一档（十进制 ÷10，二进制 ÷2）
   * → 圆圈标出 (0,1) 内双侧重合刻度
   */
  public *zoomInto(
    min: number,
    max: number,
    zoomDuration = 1.4,
  ): ThreadGenerator {
    // 下次细分前，先淡出上一轮重合标注
    yield* this.fadeOutCoincidences(0.3);
    yield* this.highlightRange(min, max, 0.45);
    yield* waitFor(0.4);
    yield* this.zoomTo(min, max, zoomDuration);
    yield* waitFor(0.3);
    yield* this.clearHighlight(0.2);
    // 顺序重建，末尾统一刷新重合点，避免闪两次
    yield* this.subdivideDec(10, false);
    yield* this.subdivideBin(2, false);
    yield* this.refreshCoincidences();
  }

  /** 淡出并清空当前重合标注 */
  public *fadeOutCoincidences(duration = 0.3): ThreadGenerator {
    if (this.coincides.length === 0) return;
    yield* all(
      ...this.coincides.map(c => c.ring().opacity(0, duration, easeOutCubic)),
    );
    this.coincideRoot().removeChildren();
    this.coincides = [];
  }

  /**
   * 刷新「十进制 ∩ 二进制」重合刻度（仅圆圈）。
   * 仅标注开区间 (0, 1) 内的点（不含 0、1）。
   */
  public *refreshCoincidences(duration = 0.4): ThreadGenerator {
    // 若仍有旧标注，先淡出（zoomInto 开头通常已清过）
    if (this.coincides.length > 0) {
      yield* this.fadeOutCoincidences(0.2);
    }
    this.rebuildCoincideMarkers();
    this.layoutCoincidences();
    if (this.coincides.length === 0) return;
    yield* all(
      ...this.coincides.map(c =>
        all(
          c.ring().opacity(1, duration, easeOutCubic),
          c.ring().scale(1, duration, easeOutCubic),
        ),
      ),
    );
  }

  /** 在轴上标注数值（垂线跨上下两侧） */
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

  public *recordMark(duration = 0.55): ThreadGenerator {
    if (this.markedValue === null) return;
    const dot = this.markDot();
    const label = this.markLabel();
    yield* all(
      dot
        .scale(1.55, duration * 0.4, easeOutCubic)
        .to(1, duration * 0.6, easeInOutCubic),
      label
        .scale(1.2, duration * 0.4, easeOutCubic)
        .to(1, duration * 0.6, easeInOutCubic),
    );
  }

  /** 缩回初始视野；结束时双侧步长复位 */
  public *resetToInitial(duration = 2.0): ThreadGenerator {
    yield* this.clearHighlight(0.2);
    const fromMin = this.viewMin;
    const fromMax = this.viewMax;

    yield* tween(duration, t => {
      const e = easeInOutCubic(t);
      this.viewMin = fromMin + (this.initMin - fromMin) * e;
      this.viewMax = fromMax + (this.initMax - fromMax) * e;
      this.layoutAllTicks();
      this.layoutMark();
      this.layoutCoincidences();
    });

    this.viewMin = this.initMin;
    this.viewMax = this.initMax;
    this.decStep = this.initDecStep;
    this.binStep = this.initBinStep;
    this.decBase = 10;
    this.binBase = 2;
    this.ticksShown = true;
    this.rebuildDecTicks(false);
    this.rebuildBinTicks(false);
    this.layoutAllTicks();
    this.layoutMark();
    this.updatePrecisionLabels();
    this.rebuildCoincideMarkers();
    this.layoutCoincidences();
  }

  // ─── 内部 ───

  private *fadeSide(
    ticks: TickHandles[],
    to: number,
    duration: number,
  ): ThreadGenerator {
    if (ticks.length === 0) return;
    yield* all(
      ...ticks.map(tk => {
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
  }

  private rebuildDecTicks(startHidden: boolean) {
    this.ticksDecRoot().removeChildren();
    this.ticksDec = [];
    const step = this.decStep;
    const {min, max} = this.visibleTickBounds(step);
    const majorEvery = Math.max(1, this.decBase);

    for (let v = min; v <= max + step * 0.5; v += step) {
      const value = this.snapToStep(v, step);
      const major = this.isMajor(value, step, majorEvery);
      const tick = createRef<Line>();
      const label = major ? createRef<Latex>() : null;
      const h = major ? 14 : 7;
      const hidden = startHidden || !this.ticksShown;

      this.ticksDecRoot().add(
        <Line
          ref={tick}
          points={[
            [0, 0],
            [0, -h],
          ]}
          stroke={DEC_COLOR}
          lineWidth={major ? 2.5 : 1.5}
          lineCap={'round'}
          opacity={hidden ? 0 : 1}
        />,
      );
      if (major && label) {
        this.ticksDecRoot().add(
          <Latex
            ref={label}
            tex={[this.formatDecTex(value, step)]}
            fill={MUTED}
            fontSize={TICK_LABEL_SIZE}
            y={DEC_LABEL_Y}
            opacity={hidden ? 0 : 1}
          />,
        );
      }
      this.ticksDec.push({value, major, tick, label});
    }
    this.layoutSide(this.ticksDec);
  }

  private rebuildBinTicks(startHidden: boolean) {
    this.ticksBinRoot().removeChildren();
    this.ticksBin = [];
    const step = this.binStep;
    const {min, max} = this.visibleTickBounds(step);
    // 二进制侧每个刻度都标分数，便于与上方十进制对照
    const majorEvery = 1;

    for (let v = min; v <= max + step * 0.5; v += step) {
      const value = this.snapToStep(v, step);
      const major = this.isMajor(value, step, majorEvery);
      const tick = createRef<Line>();
      const label = major ? createRef<Latex>() : null;
      const h = major ? 14 : 7;
      const hidden = startHidden || !this.ticksShown;

      this.ticksBinRoot().add(
        <Line
          ref={tick}
          points={[
            [0, 0],
            [0, h],
          ]}
          stroke={BIN_COLOR}
          lineWidth={major ? 2.5 : 1.5}
          lineCap={'round'}
          opacity={hidden ? 0 : 1}
        />,
      );
      if (major && label) {
        this.ticksBinRoot().add(
          <Latex
            ref={label}
            tex={[this.toFractionTex(value, step)]}
            fill={BIN_COLOR}
            fontSize={TICK_LABEL_SIZE}
            y={BIN_LABEL_Y}
            opacity={hidden ? 0 : 1}
          />,
        );
      }
      this.ticksBin.push({value, major, tick, label});
    }
    this.layoutSide(this.ticksBin);
  }

  private layoutAllTicks() {
    this.layoutSide(this.ticksDec);
    this.layoutSide(this.ticksBin);
  }

  private layoutSide(ticks: TickHandles[]) {
    for (const tk of ticks) {
      const x = this.mapX(tk.value);
      tk.tick().x(x);
      if (tk.label) tk.label().x(x);
      if (!this.ticksShown) continue;
      const inside = this.isTickInside(tk.value);
      tk.tick().opacity(inside ? 1 : 0);
      if (tk.label) tk.label().opacity(inside && tk.major ? 1 : 0);
    }
  }

  private layoutMark() {
    if (this.markedValue === null) return;
    const x = this.mapX(this.markedValue);
    this.markStem().x(x);
    this.markDot().x(x);
    this.markLabel().x(x);
  }

  /**
   * 同时落在十进制/二进制网格上的点。
   * 只取开区间 (0, 1)，不含端点 0 与 1。
   */
  private collectCoincideValues(): number[] {
    const step = Math.min(this.decStep, this.binStep);
    const {min, max} = this.visibleTickBounds(step);
    const out: number[] = [];
    for (let v = min; v <= max + step * 0.5; v += step) {
      const value = this.snapToStep(v, step);
      // 仅 (0, 1)
      if (value <= 1e-9 || value >= 1 - 1e-9) continue;
      if (!this.isTickInside(value)) continue;
      if (!this.isOnGrid(value, this.decStep)) continue;
      if (!this.isOnGrid(value, this.binStep)) continue;
      if (out.some(x => Math.abs(x - value) < 1e-9)) continue;
      out.push(value);
    }
    return out;
  }

  private rebuildCoincideMarkers() {
    this.coincideRoot().removeChildren();
    this.coincides = [];
    for (const value of this.collectCoincideValues()) {
      const ring = createRef<Circle>();
      this.coincideRoot().add(
        <Circle
          ref={ring}
          width={COINCIDE_R}
          height={COINCIDE_R}
          stroke={COINCIDE}
          lineWidth={3}
          fill={null}
          opacity={0}
          scale={0.6}
        />,
      );
      this.coincides.push({value, ring});
    }
  }

  private layoutCoincidences() {
    for (const c of this.coincides) {
      c.ring().x(this.mapX(c.value));
      const inside = this.isTickInside(c.value);
      // 缩放过程中：已显示的保持显隐；新建未 reveal 的保持 opacity 0
      if (c.ring().opacity() > 0.01) {
        c.ring().opacity(inside ? 1 : 0);
      }
    }
  }

  private isOnGrid(value: number, step: number): boolean {
    if (step <= 0) return false;
    const n = value / step;
    return Math.abs(n - Math.round(n)) < 1e-9;
  }

  private updatePrecisionLabels() {
    this.precisionDec().tex([this.formatPrecisionTex(10, this.decStep)]);
    this.precisionBin().tex([this.formatPrecisionTex(2, this.binStep)]);
  }

  private formatPrecisionTex(base: number, step: number): string {
    const n = Math.round(
      Math.log(Math.max(step, 1e-15)) / Math.log(base),
    );
    return `\\Delta = ${base}^{${n}}`;
  }

  private isTickInside(value: number): boolean {
    return value >= this.viewMin - 1e-9 && value <= this.viewMax + 1e-9;
  }

  private visibleTickBounds(step: number): {min: number; max: number} {
    const pad = (this.viewMax - this.viewMin) * 0.3;
    const lo = this.viewMin - pad;
    const hi = this.viewMax + pad;
    const min = Math.ceil(lo / step - 1e-9) * step;
    const max = Math.floor(hi / step + 1e-9) * step;
    return {min, max};
  }

  private isMajor(value: number, step: number, every: number): boolean {
    const idx = Math.round(value / step);
    return idx % every === 0;
  }

  private snapToStep(value: number, step: number): number {
    if (step <= 0) return value;
    return Math.round(value / step) * step;
  }

  private formatDecTex(value: number, step: number): string {
    const snapped = this.snapToStep(value, step);
    const eps = Math.max(Math.abs(step), 1e-12) * 0.5;
    if (Math.abs(snapped) < eps) return '0';
    const p = Math.max(
      0,
      Math.ceil(-Math.log10(Math.max(step, 1e-12)) - 1e-12),
    );
    const n = Number(snapped.toFixed(p));
    if (n === 0) return '0';
    return n < 0 ? `-${Math.abs(n)}` : `${n}`;
  }

  private formatLengthTex(value: number, step: number): string {
    if (this.isDyadicStep(step) || Math.abs(step - this.binStep) < 1e-12) {
      return this.toFractionTex(value, step);
    }
    return this.formatDecTex(value, step);
  }

  private isDyadicStep(step: number): boolean {
    if (step <= 0) return false;
    const denom = Math.round(1 / step);
    if (denom <= 0) return false;
    if (Math.abs(1 / denom - step) > 1e-9) return false;
    return (denom & (denom - 1)) === 0;
  }

  private toFractionTex(value: number, step: number): string {
    const snapped = this.snapToStep(value, step);
    const eps = Math.max(Math.abs(step), 1e-12) * 0.5;
    if (Math.abs(snapped) < eps) return '0';

    let denom = Math.max(1, Math.round(1 / step));
    let num = Math.round(snapped / step);
    const g = gcd(Math.abs(num), denom);
    num /= g;
    denom /= g;
    if (denom === 1) return num < 0 ? `-${Math.abs(num)}` : `${num}`;
    if (num < 0) return `-\\frac{${Math.abs(num)}}{${denom}}`;
    return `\\frac{${num}}{${denom}}`;
  }

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
