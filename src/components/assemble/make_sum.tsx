import { Latex, Line, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";

export interface MakeSumProps extends NodeProps {
  /** 进制，决定横纵轴刻度。默认 10 */
  base?: number;
  /**
   * 目标数，仅用于预置横轴列数（按 base 拆出的位数）。
   * showNumber 的值位数不同时会自动重建横轴。默认 2026
   */
  target?: number;
  /** 坐标轴总宽，默认 1240 */
  axisWidth?: number;
  /** 坐标轴总高，默认 620 */
  axisHeight?: number;
  /** 柱子填充色，默认 Ink.teal */
  barFill?: string;
  /** 是否显示坐标轴网格，默认 true */
  showGrid?: boolean;
  /** 柱状图上方 LaTeX 值标签的字号，默认 40 */
  valueFontSize?: number;
}

/** 按基数拆出整数各位数字（高位在前），0 → [0] */
function digitsInBase(value: number, base: number): number[] {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("MakeSum: value 须为非负整数");
  }
  if (value === 0) {
    return [0];
  }
  const digits: number[] = [];
  let x = value;
  while (x > 0) {
    digits.unshift(x % base);
    x = Math.floor(x / base);
  }
  return digits;
}

/**
 * 凑数演示（重构版）：屏幕中央第一象限坐标轴 + 柱状图 + 网格。
 *
 * - 横轴刻度为 base^power（左高位 → 右低位，如 base=10 时 10^3…10^0）；
 * - 纵轴刻度为 0…base-1（base=2 时为 0、1；base=10 时为 0…9）；
 * - 网格横向对齐纵轴刻度、纵向对齐每根柱中心；
 * - showNumber(value) 按 base 拆位，从左起依次从 0 升起柱子，
 *   柱间留有间距，每根柱顶显示该位数字；
 * - updateBase(newBase) 保持当前值不变，按新 base 重建刻度/网格/柱列。
 * - showValueLabel() 在柱状图上方用 LaTeX 显示当前值在当前 base 下的表示。
 */
export class MakeSum extends Node {
  private readonly frame = createRef<Node>();
  private readonly xAxis = createRef<Line>();
  private readonly yAxis = createRef<Line>();
  private readonly gridLayer = createRef<Node>();
  private readonly xTickLayer = createRef<Node>();
  private readonly yTickLayer = createRef<Node>();
  private readonly barsLayer = createRef<Node>();
  private readonly valueLabel = createRef<Latex>();

  private baseValue: number;
  private readonly targetValue: number;
  private readonly axisW: number;
  private readonly axisH: number;
  private readonly barFill: string;
  private readonly showGrid: boolean;
  private readonly valueFontSize: number;

  private columnCount = 0;
  private slotW = 0;
  private barW = 0;
  private unitY = 0;
  private origin = new Vector2(0, 0);

  private bars: Rect[] = [];
  private barLabels: Txt[] = [];
  private xTickNodes: Node[] = [];
  private yTickNodes: Node[] = [];
  private gridNodes: Node[] = [];

  private currentValue: number | null = null;

  public constructor(props: MakeSumProps) {
    const {
      base = 10,
      target = 2026,
      axisWidth = 1240,
      axisHeight = 620,
      barFill = Ink.teal,
      showGrid = true,
      valueFontSize = 40,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!Number.isInteger(base) || base < 2) {
      throw new Error("MakeSum: base 须为 ≥2 的整数");
    }
    if (!Number.isInteger(target) || target < 0) {
      throw new Error("MakeSum: target 须为非负整数");
    }

    this.baseValue = base;
    this.targetValue = target;
    this.axisW = axisWidth;
    this.axisH = axisHeight;
    this.barFill = barFill;
    this.showGrid = showGrid;
    this.valueFontSize = valueFontSize;
    this.origin = new Vector2(-axisWidth / 2, axisHeight / 2);
    this.unitY = axisHeight / (base - 1);

    this.add(
      <Node ref={this.frame} opacity={0}>
        <Node ref={this.gridLayer} />
        <Line
          ref={this.xAxis}
          points={[
            new Vector2(this.origin.x, this.origin.y),
            new Vector2(this.origin.x + this.axisW, this.origin.y),
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
          lineCap={"round"}
          endArrow
          arrowSize={12}
        />
        <Line
          ref={this.yAxis}
          points={[
            new Vector2(this.origin.x, this.origin.y),
            new Vector2(this.origin.x, this.origin.y - this.axisH),
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
          lineCap={"round"}
          endArrow
          arrowSize={12}
        />
        <Node ref={this.yTickLayer} />
        <Node ref={this.xTickLayer} />
        <Node ref={this.barsLayer} />
        <Latex
          ref={this.valueLabel}
          tex={"{}"}
          fill={Ink.paper}
          fontSize={valueFontSize}
          x={0}
          y={this.origin.y - this.axisH - 130}
          opacity={0}
        />
      </Node>,
    );

    this.buildYTicks();
    this.ensureColumns(digitsInBase(target, base).length);
    this.rebuildGrid();
  }

  public get base(): number {
    return this.baseValue;
  }

  public get value(): number | null {
    return this.currentValue;
  }

  /** 轴线墨晕入场（坐标轴位于屏幕中央第一象限） */
  public *show(duration = 0.6): ThreadGenerator {
    yield* inkReveal(this.frame(), { duration, fromY: 12 });
  }

  /**
   * 在坐标轴上用柱状图表示数字。
   * 柱子从左侧起依次从 0 升高，柱顶显示该位数字。
   */
  public *showNumber(
    value: number,
    options: { growDuration?: number; gap?: number } = {},
  ): ThreadGenerator {
    const { growDuration = 0.5, gap = 0.15 } = options;
    const digits = digitsInBase(value, this.baseValue);
    this.ensureColumns(digits.length);
    this.rebuildGrid();
    this.currentValue = value;

    // 归零：柱高 0，标签隐藏
    for (let i = 0; i < this.bars.length; i++) {
      const cx = this.barCenterX(i);
      this.bars[i].height(0);
      this.bars[i].position(new Vector2(cx, this.origin.y));
      this.bars[i].opacity(1);
      this.barLabels[i].opacity(0);
      this.barLabels[i].position(new Vector2(cx, this.origin.y - 30));
      this.barLabels[i].text(`${digits[i]}`);
    }

    // 从左依次升起
    for (let i = 0; i < digits.length; i++) {
      const h = digits[i] * this.unitY;
      const cx = this.barCenterX(i);
      const bar = this.bars[i];
      const label = this.barLabels[i];
      label.position(new Vector2(cx, this.origin.y - h - 32));
      yield* all(
        bar.height(h, growDuration, easeOutCubic),
        bar.position(
          new Vector2(cx, this.origin.y - h / 2),
          growDuration,
          easeOutCubic,
        ),
        label.opacity(1, growDuration * 0.6, easeOutCubic),
      );
      if (gap > 0 && i < digits.length - 1) {
        yield* waitFor(gap);
      }
    }

    yield* waitFor(0.4);
  }

  /**
   * 用新的 base 重绘当前的柱状图，值不变。
   * 横/纵轴刻度、网格与柱列均按新 base 重建，再把当前值按新 base
   * 拆位并从左依次升起；尚未 showNumber 时仅重建空轴。
   */
  public *updateBase(
    newBase: number,
    options: { growDuration?: number; gap?: number } = {},
  ): ThreadGenerator {
    if (!Number.isInteger(newBase) || newBase < 2) {
      throw new Error("MakeSum.updateBase: base 须为 ≥2 的整数");
    }
    if (newBase === this.baseValue) {
      return;
    }
    const { growDuration = 0.5, gap = 0.15 } = options;
    this.baseValue = newBase;
    this.unitY = this.axisH / (newBase - 1);

    this.buildYTicks();
    const value = this.currentValue ?? this.targetValue;
    const digits = digitsInBase(value, newBase);
    // base 变化后刻度文案必然变化，强制重建横轴
    this.ensureColumns(digits.length, true);
    this.rebuildGrid();

    if (this.currentValue === null) {
      return;
    }

    for (let i = 0; i < this.bars.length; i++) {
      const cx = this.barCenterX(i);
      this.bars[i].height(0);
      this.bars[i].position(new Vector2(cx, this.origin.y));
      this.bars[i].opacity(1);
      this.barLabels[i].opacity(0);
      this.barLabels[i].position(new Vector2(cx, this.origin.y - 30));
      this.barLabels[i].text(`${digits[i]}`);
    }

    for (let i = 0; i < digits.length; i++) {
      const h = digits[i] * this.unitY;
      const cx = this.barCenterX(i);
      const bar = this.bars[i];
      const label = this.barLabels[i];
      label.position(new Vector2(cx, this.origin.y - h - 32));
      yield* all(
        bar.height(h, growDuration, easeOutCubic),
        bar.position(
          new Vector2(cx, this.origin.y - h / 2),
          growDuration,
          easeOutCubic,
        ),
        label.opacity(1, growDuration * 0.6, easeOutCubic),
      );
      if (gap > 0 && i < digits.length - 1) {
        yield* waitFor(gap);
      }
    }

    yield* waitFor(0.4);
  }

  /**
   * 在柱状图上方用 LaTeX 显示当前值在当前 base 下的表示，
   * 如 2026_{(10)}、3752_{(8)}、11111101010_{(2)}。
   * 供 showNumber / updateBase 之后调用；重复调用时更新文案。
   */
  public *showValueLabel(duration = 0.5): ThreadGenerator {
    const value = this.currentValue ?? this.targetValue;
    const digits = digitsInBase(value, this.baseValue).join("");
    const label = this.valueLabel();
    if (label.opacity() > 0.05) {
      yield* label.opacity(0, duration * 0.4, easeOutCubic);
    }
    label.tex(`{${digits}_{(${this.baseValue})}}`);
    label.fill(Ink.paper);
    yield* inkReveal(label, { duration: duration * 0.6, fromY: 12 });
  }

  public *hide(duration = 0.4): ThreadGenerator {
    yield* inkFade([this.frame()], { duration });
  }

  private barCenterX(i: number): number {
    return this.origin.x + (i + 0.5) * this.slotW;
  }

  /** 纵轴刻度：0 … base-1 */
  private buildYTicks(): void {
    for (const node of this.yTickNodes) {
      node.remove();
    }
    this.yTickNodes = [];
    const layer = this.yTickLayer();
    const fontSize = this.unitY < 28 ? 18 : 22;
    for (let d = 0; d < this.baseValue; d++) {
      const y = this.origin.y - d * this.unitY;
      const tick = (
        <Line
          points={[
            new Vector2(this.origin.x - 7, y),
            new Vector2(this.origin.x + 7, y),
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
        />
      ) as unknown as Node;
      const label = (
        <Txt
          text={`${d}`}
          fontFamily={Ink.font}
          fontSize={fontSize}
          fill={Ink.muted}
          x={this.origin.x - 30}
          y={y}
        />
      ) as unknown as Node;
      layer.add(tick);
      layer.add(label);
      this.yTickNodes.push(tick, label);
    }
  }

  /** 第一象限网格：横向对齐纵轴刻度，纵向对齐每根柱中心 */
  private rebuildGrid(): void {
    for (const node of this.gridNodes) {
      node.remove();
    }
    this.gridNodes = [];
    if (!this.showGrid || this.columnCount <= 0) {
      return;
    }
    const layer = this.gridLayer();
    // 横向网格线（d=0 与 X 轴重合，跳过）
    for (let d = 1; d < this.baseValue; d++) {
      const y = this.origin.y - d * this.unitY;
      const line = (
        <Line
          points={[
            new Vector2(this.origin.x, y),
            new Vector2(this.origin.x + this.axisW, y),
          ]}
          stroke={Ink.line}
          lineWidth={1}
          opacity={0.25}
        />
      ) as unknown as Node;
      layer.add(line);
      this.gridNodes.push(line);
    }
    // 纵向网格线（每根柱中心一条）
    for (let i = 0; i < this.columnCount; i++) {
      const cx = this.barCenterX(i);
      const line = (
        <Line
          points={[
            new Vector2(cx, this.origin.y),
            new Vector2(cx, this.origin.y - this.axisH),
          ]}
          stroke={Ink.line}
          lineWidth={1}
          opacity={0.25}
        />
      ) as unknown as Node;
      layer.add(line);
      this.gridNodes.push(line);
    }
  }

  /**
   * 按列数重建横轴刻度与柱子。
   * 横轴刻度为 base^power，左高位 → 右低位；
   * 每列槽宽 slotW，柱宽 barW（< slotW，柱间留白）。
   */
  private ensureColumns(n: number, force = false): void {
    if (n <= 0) {
      throw new Error("MakeSum: 列数须为正整数");
    }
    if (!force && n === this.columnCount && this.bars.length > 0) {
      return;
    }
    this.columnCount = n;
    this.slotW = this.axisW / n;
    this.barW = this.slotW * 0.55;

    // 清掉旧横轴刻度与柱子
    for (const node of this.xTickNodes) {
      node.remove();
    }
    this.xTickNodes = [];
    for (const bar of this.bars) {
      bar.remove();
    }
    for (const label of this.barLabels) {
      label.remove();
    }
    this.bars = [];
    this.barLabels = [];

    const xLayer = this.xTickLayer();
    const barsLayer = this.barsLayer();

    for (let i = 0; i < n; i++) {
      const power = n - 1 - i;
      const cx = this.barCenterX(i);
      const tick: Node = (
        <Line
          points={[
            new Vector2(cx, this.origin.y - 7),
            new Vector2(cx, this.origin.y + 7),
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
        />
      ) as unknown as Node;
      const label: Node = (
        <Latex
          tex={`{${this.baseValue}^{${power}}}`}
          fill={Ink.muted}
          fontSize={28}
          x={cx}
          y={this.origin.y + 44}
        />
      ) as unknown as Node;
      xLayer.add(tick);
      xLayer.add(label);
      this.xTickNodes.push(tick, label);

      const barRef = createRef<Rect>();
      const labelRef = createRef<Txt>();
      barsLayer.add(
        <Rect
          ref={barRef}
          width={this.barW}
          height={0}
          fill={this.barFill}
          radius={4}
          x={cx}
          y={this.origin.y}
        />,
      );
      barsLayer.add(
        <Txt
          ref={labelRef}
          text={"0"}
          fontFamily={Ink.font}
          fontSize={30}
          fontWeight={700}
          fill={Ink.paper}
          x={cx}
          y={this.origin.y - 30}
          opacity={0}
        />,
      );
      this.bars.push(barRef());
      this.barLabels.push(labelRef());
    }
  }
}
