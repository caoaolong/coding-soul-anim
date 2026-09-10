import { Latex, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  sequence,
} from "@motion-canvas/core";
import { Brace } from "../annotation/brace";
import { Ink } from "../../theme/ink";
import { Highlight } from "../../theme/highlight";
import { highlightShapes } from "../../theme/highlight_anim";

export type FloatSection = "sign" | "exponent" | "mantissa";

export interface FloatProps extends NodeProps {
  /** 初始浮点数值（按 IEEE 754 float32 编码） */
  value?: number;
  /** 单个 bit 格子边长，默认 36 */
  cellSize?: number;
  /** 格间距，默认 3 */
  gap?: number;
  /** 段（Sign / Exp / Mant）之间额外间距，默认 14 */
  sectionGap?: number;
}

const SECTION_STYLE: Record<
  FloatSection,
  { fill: string; stroke: string; label: string }
> = {
  sign: { fill: Ink.deep, stroke: Ink.goldSoft, label: "Sign" },
  exponent: { fill: Ink.deep, stroke: Ink.warn, label: "Exponent" },
  mantissa: { fill: Ink.deep, stroke: "#6E7D6E", label: "Mantissa" },
};

const SECTIONS: FloatSection[] = ["sign", "exponent", "mantissa"];

const SIGN_END = 1;
const EXP_END = 9; // 1 + 8
const BIT_COUNT = 32;

/** 下方解码公式（IEEE 754 规格化数） */
const DECODE_FORMULA =
  "{V=(-1)^{S}\\times(1.M)_{2}\\times 2^{\\,E_{\\text{存}}-\\mathrm{Bias}}}";

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

function formatFloatLabel(value: number): string {
  if (Number.isNaN(value)) return "NaN=";
  if (value === Infinity) return "∞=";
  if (value === -Infinity) return "-∞=";
  if (Object.is(value, -0)) return "-0=";
  return `${value}=`;
}

/**
 * IEEE 754 float32 位布局：Sign(1) | Exponent(8) | Mantissa(23)，左高右低。
 */
export class Float extends Node {
  public readonly cells = createRefArray<Rect>();
  public readonly bitTexts = createRefArray<Txt>();
  private readonly valueLabel = createRef<Txt>();
  private readonly braces = createRefArray<Brace>();
  private readonly formula = createRef<Latex>();

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
      gap = 3,
      sectionGap = 14,
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
        fontFamily={"SF Mono, Consolas, monospace"}
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
          radius={Ink.radius}
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
            fontFamily={"SF Mono, Consolas, monospace"}
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
          stroke={style.stroke}
          labelFill={style.stroke}
          lineWidth={Ink.lineWidth}
          fontSize={Math.max(18, Math.round(cellSize * 0.55))}
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
   * 依次绘出 Sign / Exponent / Mantissa 上方花括号标注。
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
   * 更新为新的 float32 值：各位淡出改写淡入，左侧文案同步。
   */
  public *setValue(value: number, duration = 0.45): ThreadGenerator {
    const nextBits = float32ToBits(value);
    const half = duration * 0.5;

    yield* all(
      ...this.bitTexts.map((txt) =>
        txt.opacity(0, half, easeInOutCubic),
      ),
      this.valueLabel().opacity(0.35, half, easeInOutCubic),
    );

    this.currentValue = value;
    this.bits = nextBits;
    this.valueLabel().text(formatFloatLabel(value));
    for (let i = 0; i < BIT_COUNT; i++) {
      this.bitTexts[i].text(`${nextBits[i]}`);
    }

    yield* all(
      ...this.bitTexts.map((txt) =>
        txt.opacity(1, half, easeInOutCubic),
      ),
      this.valueLabel().opacity(1, half, easeInOutCubic),
    );
  }

  /**
   * 高亮某一段：sign / exponent / mantissa。
   * @param recovery 高亮后是否复原
   */
  public *highlight(
    section: FloatSection,
    recovery = false,
    duration = Highlight.duration,
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
