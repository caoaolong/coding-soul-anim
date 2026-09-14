import { Latex, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  chain,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  sequence,
  waitFor,
} from "@motion-canvas/core";
import { Annotation } from "../annotation/annotation";
import { Brace } from "../annotation/brace";
import { Ink } from "../../theme/ink";
import { Highlight } from "../../theme/highlight";
import { highlightShapes } from "../../theme/highlight_anim";

/** 数值/段名标注 */
const LABEL_FONT = "SF Pro Text, Segoe UI, Microsoft YaHei, sans-serif";
/** 格内 bit 数字 */
const BIT_FONT = "SF Mono, Consolas, monospace";

export type FloatSection = "sign" | "exponent" | "mantissa";

export interface FloatProps extends NodeProps {
  /** 初始浮点数值（按 IEEE 754 float32 编码） */
  value?: number;
  /** 单个 bit 格子边长，默认 36 */
  cellSize?: number;
  /** 格间距，默认 6 */
  gap?: number;
  /** 段（Sign / Exp / Mant）之间额外间距，默认 16 */
  sectionGap?: number;
}

/**
 * 三段水墨配色：格底统一深墨，描边结构墨线；
 * 段别仅由上方花括号/标注色区分（朱砂 / 淡金 / 淡赭）。
 */
const SECTION_STYLE: Record<
  FloatSection,
  { fill: string; stroke: string; accent: string; label: string }
> = {
  sign: {
    fill: Ink.deep,
    stroke: Ink.line,
    accent: Ink.seal,
    label: "S",
  },
  exponent: {
    fill: Ink.deep,
    stroke: Ink.line,
    accent: Ink.goldSoft,
    label: "E",
  },
  mantissa: {
    fill: Ink.deepAlt,
    stroke: Ink.line,
    accent: Ink.warn,
    label: "M",
  },
};

const SECTIONS: FloatSection[] = ["sign", "exponent", "mantissa"];

const SIGN_END = 1;
const EXP_END = 9; // 1 + 8
const BIT_COUNT = 32;

/** 下方解码公式（IEEE 754 规格化数） */
const DECODE_FORMULA =
  "{V=(-1)^{S}\\times(1.M)_{2}\\times 2^{\\,E-\\mathrm{Bias}}}";

function sectionOf(bitIndex: number): FloatSection {
  if (bitIndex < SIGN_END) return "sign";
  if (bitIndex < EXP_END) return "exponent";
  return "mantissa";
}

/** IEEE 754 float32 → 32 位数组，index 0 为符号位（最高位） */
export function float32ToBits(value: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, false);
  const bits: number[] = [];
  const view = new DataView(buf);
  for (let b = 0; b < 4; b++) {
    const byte = view.getUint8(b);
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/** IEEE 754 float32 位数组 → 数值（index 0 为符号位） */
export function bitsToFloat32(bits: number[]): number {
  let u = 0;
  for (let i = 0; i < BIT_COUNT; i++) {
    u = (u << 1) | (bits[i] & 1);
  }
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, u >>> 0, false);
  return new DataView(buf).getFloat32(0, false);
}

function formatFloatLabel(value: number): string {
  if (Number.isNaN(value)) return "NaN=";
  if (value === Infinity) return "∞=";
  if (value === -Infinity) return "-∞=";
  if (Object.is(value, -0)) return "-0.00=";
  if (value === 0) return "0.00=";
  return `${value}=`;
}

/**
 * IEEE 754 float32 位布局：Sign(1) | Exponent(8) | Mantissa(23)，左高右低。
 * 水墨格网：直角深墨底、结构墨线；段别以花括号淡墨色相点题。
 */
export class Float extends Node {
  public readonly cells = createRefArray<Rect>();
  public readonly bitTexts = createRefArray<Txt>();
  private readonly valueLabel = createRef<Txt>();
  private readonly braces = createRefArray<Brace>();
  private readonly formula = createRef<Latex>();
  private readonly annotation = createRef<Annotation>();

  private readonly cellSize: number;
  private readonly gap: number;
  private readonly sectionGap: number;
  private readonly gridWidth: number;
  private bits: number[];
  private currentValue: number;

  public constructor(props: FloatProps = {}) {
    const {
      value = 0,
      cellSize = 36,
      gap = 6,
      sectionGap = 16,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.cellSize = cellSize;
    this.gap = gap;
    this.sectionGap = sectionGap;
    this.currentValue = value;
    this.bits = float32ToBits(value);

    this.gridWidth =
      BIT_COUNT * cellSize + (BIT_COUNT - 1) * gap + 2 * sectionGap;
    const gridY = 0;
    const labelX = -this.gridWidth / 2 - 16;

    this.add(
      <Txt
        ref={this.valueLabel}
        text={formatFloatLabel(value)}
        x={labelX}
        y={gridY}
        offset={[1, 0]}
        fill={Ink.paper}
        fontSize={cellSize * 0.42}
        fontWeight={700}
        fontFamily={LABEL_FONT}
      />,
    );

    for (let i = 0; i < BIT_COUNT; i++) {
      const section = sectionOf(i);
      const style = SECTION_STYLE[section];
      this.add(
        <Rect
          ref={this.cells}
          x={this.cellX(i)}
          y={gridY}
          width={cellSize}
          height={cellSize}
          radius={0}
          fill={style.fill}
          stroke={style.stroke}
          lineWidth={Ink.lineWidth}
          layout
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Txt
            ref={this.bitTexts}
            text={`${this.bits[i]}`}
            fill={Ink.paper}
            fontSize={cellSize * 0.45}
            fontWeight={700}
            fontFamily={BIT_FONT}
          />
        </Rect>,
      );
    }

    // 三段上方花括号标注（初始收起，由 showLabels 绘出）
    const topY = -cellSize / 2 - 4;
    const braceDepth = Math.max(14, Math.round(cellSize * 0.4));
    for (const section of SECTIONS) {
      const style = SECTION_STYLE[section];
      const [fromBit, toBit] = this.sectionRange(section);
      const x0 = this.cellX(fromBit) - cellSize / 2;
      const x1 = this.cellX(toBit - 1) + cellSize / 2;
      this.add(
        <Brace
          ref={this.braces}
          from={[x0, topY]}
          to={[x1, topY]}
          side={"top"}
          depth={braceDepth}
          label={style.label}
          stroke={style.accent}
          labelFill={style.accent}
          lineWidth={Ink.lineWidth}
          fontSize={Math.max(18, Math.round(cellSize * 0.55))}
          fontFamily={LABEL_FONT}
          zIndex={5}
        />,
      );
    }

    // 下方解码公式（初始隐藏，由 showFormula 唤出）
    this.add(
      <Latex
        ref={this.formula}
        tex={DECODE_FORMULA}
        fill={Ink.paper}
        fontSize={Math.max(26, Math.round(cellSize * 0.72))}
        y={cellSize / 2 + Math.max(36, Math.round(cellSize * 1.1))}
        opacity={0}
      />,
    );

    // 朱砂批注层（改 bit 时画红线）
    this.add(<Annotation ref={this.annotation} zIndex={20} />);
  }

  /** 当前浮点数值 */
  public getValue(): number {
    return this.currentValue;
  }

  /** 当前 32 位（只读副本） */
  public getBits(): number[] {
    return [...this.bits];
  }

  /**
   * 依次绘出 S / E / M 上方花括号标注。
   */
  public *showLabels(duration = 0.4): ThreadGenerator {
    yield* sequence(
      duration * 0.35,
      ...this.braces.map((brace) => brace.show(duration)),
    );
  }

  /** 收起全部分段标注 */
  public *hideLabels(duration = 0.3): ThreadGenerator {
    yield* all(...this.braces.map((brace) => brace.hide(duration)));
  }

  /**
   * 在位布局下方显示解码公式：
   * V = (-1)^S × (1.M)_2 × 2^(E_存 - Bias)
   */
  public *showFormula(duration = 0.5): ThreadGenerator {
    yield* this.formula().opacity(1, duration, easeOutCubic);
  }

  /** 隐藏下方解码公式 */
  public *hideFormula(duration = 0.35): ThreadGenerator {
    yield* this.formula().opacity(0, duration, easeInOutCubic);
  }

  /**
   * 按二进制串写入某一段（sign / exponent / mantissa）。
   * 串可短于段宽：mantissa / exponent 右侧补 0；过长则截断。
   * 朱砂底线点题变化位后改写。
   */
  public *writeSectionBits(
    section: FloatSection,
    binary: string,
    duration = 0.55,
  ): ThreadGenerator {
    const [from, to] = this.sectionRange(section);
    const width = to - from;
    const cleaned = binary.replace(/[^01]/g, "");
    const padded = (cleaned + "0".repeat(width)).slice(0, width);

    const nextBits = [...this.bits];
    const changed: number[] = [];
    for (let i = 0; i < width; i++) {
      const bit = (padded.charCodeAt(i) === 49 ? 1 : 0) as 0 | 1;
      const index = from + i;
      if (nextBits[index] !== bit) {
        nextBits[index] = bit;
        changed.push(index);
      }
    }

    if (changed.length === 0) return;

    const half = duration * 0.5;
    yield* all(
      this.markBits(changed, Math.max(0.9, duration + 0.5)),
      chain(
        waitFor(0.2),
        all(
          ...changed.map((i) =>
            this.bitTexts[i].opacity(0, half, easeInOutCubic),
          ),
          this.valueLabel().opacity(0.35, half, easeInOutCubic),
        ),
      ),
    );

    this.bits = nextBits;
    this.currentValue = bitsToFloat32(this.bits);
    this.valueLabel().text(formatFloatLabel(this.currentValue));
    for (const i of changed) {
      this.bitTexts[i].text(`${nextBits[i]}`);
    }

    yield* all(
      ...changed.map((i) =>
        this.bitTexts[i].opacity(1, half, easeInOutCubic),
      ),
      this.valueLabel().opacity(1, half, easeInOutCubic),
    );
  }

  /**
   * 单独改写某一 bit（0 为符号位）：朱砂底线点题 → 格内改写；左侧数值同步。
   */
  public *setBit(
    index: number,
    bit: 0 | 1,
    duration = 0.35,
  ): ThreadGenerator {
    if (index < 0 || index >= BIT_COUNT) return;
    if (this.bits[index] === bit) return;

    yield* all(
      this.markBits([index], Math.max(0.85, duration + 0.45)),
      chain(waitFor(0.18), this.applyBitChange(index, bit, duration)),
    );
  }

  /**
   * 更新为新的 float32 值：对变化位画朱砂底线，再淡出改写淡入。
   */
  public *setValue(value: number, duration = 0.45): ThreadGenerator {
    const nextBits = float32ToBits(value);
    const changed: number[] = [];
    for (let i = 0; i < BIT_COUNT; i++) {
      if (this.bits[i] !== nextBits[i]) changed.push(i);
    }
    if (changed.length === 0) {
      this.currentValue = value;
      this.valueLabel().text(formatFloatLabel(value));
      return;
    }

    const half = duration * 0.5;
    yield* all(
      this.markBits(changed, Math.max(0.9, duration + 0.5)),
      chain(
        waitFor(0.2),
        all(
          ...changed.map((i) =>
            this.bitTexts[i].opacity(0, half, easeInOutCubic),
          ),
          this.valueLabel().opacity(0.35, half, easeInOutCubic),
        ),
      ),
    );

    this.currentValue = value;
    this.bits = nextBits;
    this.valueLabel().text(formatFloatLabel(value));
    for (let i = 0; i < BIT_COUNT; i++) {
      this.bitTexts[i].text(`${nextBits[i]}`);
    }

    yield* all(
      ...changed.map((i) =>
        this.bitTexts[i].opacity(1, half, easeInOutCubic),
      ),
      this.valueLabel().opacity(1, half, easeInOutCubic),
    );
  }

  /** 在指定 bit 格下方落朱砂运笔底线 */
  private *markBits(
    indices: number[],
    duration = 0.8,
  ): ThreadGenerator {
    const targets = indices
      .map((i) => this.cells[i])
      .filter(Boolean);
    if (targets.length === 0) return;
    yield* this.annotation().focusBox(targets, {
      style: "underline",
      color: Ink.seal,
      lineWidth: 3,
      padding: 2,
      underlineGap: 6,
      duration,
    });
  }

  private *applyBitChange(
    index: number,
    bit: 0 | 1,
    duration: number,
  ): ThreadGenerator {
    const txt = this.bitTexts[index];
    const half = duration * 0.45;
    yield* all(
      txt.opacity(0, half, easeInOutCubic),
      this.valueLabel().opacity(0.35, half, easeInOutCubic),
    );

    this.bits[index] = bit;
    txt.text(`${bit}`);
    this.currentValue = bitsToFloat32(this.bits);
    this.valueLabel().text(formatFloatLabel(this.currentValue));

    yield* all(
      txt.opacity(1, duration - half, easeInOutCubic),
      this.valueLabel().opacity(1, duration - half, easeInOutCubic),
    );
  }

  /**
   * 高亮某一段：sign / exponent / mantissa。
   * @param recovery 高亮后是否复原
   */
  public *highlight(
    section: FloatSection,
    recovery = false,
    duration: number = Highlight.duration,
  ): ThreadGenerator {
    const [from, to] = this.sectionRange(section);
    const targets = [];
    for (let i = from; i < to; i++) {
      targets.push(this.cells[i]);
    }
    yield* highlightShapes(targets, { duration, recovery });
  }

  private sectionRange(section: FloatSection): [number, number] {
    switch (section) {
      case "sign":
        return [0, SIGN_END];
      case "exponent":
        return [SIGN_END, EXP_END];
      case "mantissa":
        return [EXP_END, BIT_COUNT];
    }
  }

  /** 位下标 → 格子中心 x（含段间距） */
  private cellX(bitIndex: number): number {
    let extra = 0;
    if (bitIndex >= SIGN_END) extra += this.sectionGap;
    if (bitIndex >= EXP_END) extra += this.sectionGap;
    return (
      -this.gridWidth / 2 +
      this.cellSize / 2 +
      bitIndex * (this.cellSize + this.gap) +
      extra
    );
  }
}
