import { Latex, Layout, Node, NodeProps } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  waitFor,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";
import { Annotation } from "../annotation/annotation";

/** all=整数+小数；int=仅整数位；frac=仅小数位 */
export type BasePart = "all" | "int" | "frac";

export interface BaseNumberProps extends NodeProps {
  /** 要演示的非负实数（含小数） */
  value: number;
  /** 基数，≥2 */
  base: number;
  /**
   * 小数位最多展开几位；默认自动（遇尽早停，最多 12 位）。
   * 整数不受影响。
   */
  fracPlaces?: number;
  /**
   * 展开范围：all 整数+小数；int 仅整数；frac 仅小数。
   * 默认 all。
   */
  part?: BasePart;
  /** 字号，默认 42 */
  fontSize?: number;
  /** 公式颜色，默认 Ink.paper */
  fill?: string;
}

/** 按位拆分结果：整数位高位在前，小数位自小数点后第一位起 */
export interface PlaceDigits {
  intDigits: number[];
  fracDigits: number[];
}

const FRAC_EPS = 1e-12;
const DEFAULT_MAX_FRAC = 12;

/** 压掉二进制浮点毛刺后再参与展示 / 运算 */
export function cleanDecimal(value: number, places = 10): number {
  if (!Number.isFinite(value)) {
    throw new Error("cleanDecimal: value 须为有限数");
  }
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

/**
 * 格式化展示用十进制文案：先去浮点毛刺，再去掉多余尾零。
 * @param maxFracDigits 最多保留的小数位，默认 6
 */
export function formatDecimal(value: number, maxFracDigits = 6): string {
  if (!Number.isFinite(value)) {
    throw new Error("formatDecimal: value 须为有限数");
  }
  const v = cleanDecimal(value, Math.max(maxFracDigits + 2, 10));
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 1e-10) {
    return String(Math.round(v));
  }
  return v
    .toFixed(maxFracDigits)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
}

/** 拆出非负实数的整数部分与小数部分 */
export function splitNonNeg(value: number): {
  intPart: number;
  fracPart: number;
} {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("value 须为非负有限数");
  }
  const intPart = Math.floor(value + FRAC_EPS);
  let fracPart = value - intPart;
  if (fracPart < FRAC_EPS) {
    fracPart = 0;
  }
  if (fracPart > 1 - FRAC_EPS) {
    return { intPart: intPart + 1, fracPart: 0 };
  }
  return { intPart, fracPart };
}

/** 按基数拆出整数各位数字（高位在前） */
export function digitsInBase(value: number, base: number): number[] {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("digitsInBase: value 须为非负有限数");
  }
  if (!Number.isInteger(base) || base < 2) {
    throw new Error("digitsInBase: base 须为 ≥2 的整数");
  }
  const intPart = Math.floor(value + FRAC_EPS);
  if (intPart === 0) {
    return [0];
  }
  const digits: number[] = [];
  let x = intPart;
  while (x > 0) {
    digits.unshift(x % base);
    x = Math.floor(x / base);
  }
  return digits;
}

/** 小数部分乘基取整，得到小数位数字（自左向右） */
export function fracDigitsInBase(
  fracPart: number,
  base: number,
  maxPlaces = DEFAULT_MAX_FRAC,
): number[] {
  if (!Number.isFinite(fracPart) || fracPart < 0 || fracPart >= 1) {
    if (fracPart < FRAC_EPS) {
      return [];
    }
    throw new Error("fracDigitsInBase: fracPart 须在 [0, 1)");
  }
  if (!Number.isInteger(base) || base < 2) {
    throw new Error("fracDigitsInBase: base 须为 ≥2 的整数");
  }
  if (!Number.isInteger(maxPlaces) || maxPlaces < 0) {
    throw new Error("fracDigitsInBase: maxPlaces 须为非负整数");
  }

  const digits: number[] = [];
  let x = cleanDecimal(fracPart);
  for (let i = 0; i < maxPlaces; i++) {
    if (x < FRAC_EPS) {
      break;
    }
    x = cleanDecimal(x * base);
    let d = Math.floor(x + FRAC_EPS);
    if (d >= base) {
      d = base - 1;
      x = 0;
    }
    digits.push(d);
    x = cleanDecimal(x - d);
    if (x < FRAC_EPS) {
      break;
    }
  }
  return digits;
}

/** 整数位 + 小数位一并拆出 */
export function placeDigitsInBase(
  value: number,
  base: number,
  fracPlaces = DEFAULT_MAX_FRAC,
): PlaceDigits {
  const { intPart, fracPart } = splitNonNeg(value);
  return {
    intDigits: digitsInBase(intPart, base),
    fracDigits:
      fracPart > 0 ? fracDigitsInBase(fracPart, base, fracPlaces) : [],
  };
}

interface ExpandTerm {
  digit: number;
  power: number;
  /** digit × base^power 的展示文案 */
  valueTex: string;
}

/** 计算并格式化一项 digit×base^power 的十进制值 */
export function formatTermValue(
  digit: number,
  base: number,
  power: number,
): string {
  const raw = digit * base ** power;
  if (power >= 0) {
    return String(Math.round(raw));
  }
  return formatDecimal(raw, Math.min(12, Math.abs(power) + 2));
}

/**
 * 基数展开演示：先显示数字，再按位展开（含小数负指数位）；
 * 可框选单项 M×N^x，或同时框选展开式中所有基数 N；
 * 亦可在每一项正下方同时显示 digit×base^power 的求值结果。
 */
export class BaseNumber extends Node {
  private readonly valueLatex = createRef<Latex>();
  private readonly eqLatex = createRef<Latex>();
  /** 整项块（公式 + 下方求值），供 expand 显现 */
  private readonly termBlocks = createRefArray<Layout>();
  /** 公式行（digit×base^power），供 highlightTerm */
  private readonly terms = createRefArray<Layout>();
  /** 每项中的基数 Latex，供 highlightBases */
  private readonly baseParts = createRefArray<Latex>();
  private readonly pluses = createRefArray<Latex>();
  /** 各项下方的求值结果 */
  private readonly termValues = createRefArray<Latex>();
  private readonly termAnnotation = createRef<Annotation>();
  private readonly baseAnnotations = createRefArray<Annotation>();

  private readonly expandTerms: ExpandTerm[];
  private readonly baseValue: number;

  public constructor(props: BaseNumberProps) {
    const {
      value,
      base,
      fracPlaces = DEFAULT_MAX_FRAC,
      part = "all",
      fontSize = 42,
      fill = Ink.paper,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error("BaseNumber: value 须为非负有限数");
    }
    if (!Number.isInteger(base) || base < 2) {
      throw new Error("BaseNumber: base 须为 ≥2 的整数");
    }

    const places = placeDigitsInBase(value, base, fracPlaces);
    const intTerms =
      part === "frac"
        ? []
        : places.intDigits.map((digit, i) => {
            const power = places.intDigits.length - 1 - i;
            return {
              digit,
              power,
              valueTex: formatTermValue(digit, base, power),
            };
          });
    const fracTerms =
      part === "int"
        ? []
        : places.fracDigits.map((digit, i) => {
            const power = -(i + 1);
            return {
              digit,
              power,
              valueTex: formatTermValue(digit, base, power),
            };
          });
    this.expandTerms = [...intTerms, ...fracTerms];
    if (this.expandTerms.length === 0) {
      throw new Error("BaseNumber: 当前 part 下没有可展开的位");
    }
    this.baseValue = base;
    // 含小数位时一般为截断/近似，用 ≈；纯整数用 =
    const eqTex = fracTerms.length > 0 ? "\\approx" : "=";
    const valueFontSize = Math.round(fontSize * 0.85);

    const row = createRef<Layout>();
    this.add(
      <Layout
        ref={row}
        layout
        direction={"row"}
        gap={10}
        alignItems={"start"}
        justifyContent={"center"}
      />,
    );

    row().add(
      <Latex
        ref={this.valueLatex}
        tex={formatDecimal(value)}
        fill={fill}
        fontSize={fontSize}
        opacity={0}
      />,
    );
    row().add(
      <Latex
        ref={this.eqLatex}
        tex={eqTex}
        fill={fill}
        fontSize={fontSize}
        opacity={0}
      />,
    );

    const n = this.expandTerms.length;
    for (let i = 0; i < n; i++) {
      const { digit, power, valueTex } = this.expandTerms[i];

      // 每项：上方公式，下方求值（显式 add，保证 ref 数组挂载可靠）
      row().add(
        <Layout
          ref={this.termBlocks}
          layout
          direction={"column"}
          gap={Math.round(fontSize * 0.28)}
          alignItems={"center"}
          opacity={0}
        />,
      );
      const block = this.termBlocks[i];

      block.add(
        <Layout
          ref={this.terms}
          layout
          direction={"row"}
          gap={2}
          alignItems={"center"}
        />,
      );
      const formula = this.terms[i];
      formula.add(
        <Latex tex={`${digit}\\times`} fill={fill} fontSize={fontSize} />,
      );
      formula.add(
        <Latex
          ref={this.baseParts}
          tex={`${base}`}
          fill={fill}
          fontSize={fontSize}
        />,
      );
      formula.add(
        <Latex tex={`^{${power}}`} fill={fill} fontSize={fontSize} />,
      );

      block.add(
        <Latex
          ref={this.termValues}
          tex={valueTex}
          fill={Ink.gold}
          fontSize={valueFontSize}
          opacity={0}
        />,
      );

      this.add(<Annotation ref={this.baseAnnotations} />);

      if (i < n - 1) {
        row().add(
          <Latex
            ref={this.pluses}
            tex={"+"}
            fill={fill}
            fontSize={fontSize}
            opacity={0}
          />,
        );
      }
    }

    this.add(<Annotation ref={this.termAnnotation} />);
  }

  /** 位数（展开项个数，含小数位） */
  public get termCount(): number {
    return this.expandTerms.length;
  }

  /** 当前基数 */
  public get base(): number {
    return this.baseValue;
  }

  /** 显示左侧数字 */
  public *showNumber(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this.valueLatex(), { duration, fromY: 12 });
  }

  /**
   * 按基数展开：写出 = / ≈ 与各项 digit×base^power；
   * 每显现一项，即在其下方从上往下淡入该项求值。
   */
  public *expand(stepDuration = 0.4, hold = 0.12): ThreadGenerator {
    yield* inkReveal(this.eqLatex(), { duration: stepDuration * 0.8, fromY: 8 });
    yield* waitFor(hold);

    for (let i = 0; i < this.termBlocks.length; i++) {
      this.termValues[i].opacity(0);
      yield* inkReveal(this.termBlocks[i], {
        duration: stepDuration,
        fromY: 10,
      });
      // 从上往下淡入该项求值（如 2×10³ → 2000）
      yield* inkReveal(this.termValues[i], {
        duration: stepDuration * 0.85,
        fromY: 16,
      });
      if (i < this.pluses.length) {
        yield* inkReveal(this.pluses[i], {
          duration: stepDuration * 0.55,
          fromY: 0,
        });
      }
      if (hold > 0 && i < this.termBlocks.length - 1) {
        yield* waitFor(hold);
      }
    }
  }

  /** 先显示数字，再展开 */
  public *play(
    showDuration = 0.55,
    expandStep = 0.4,
    expandHold = 0.12,
    pauseAfterShow = 0.35,
  ): ThreadGenerator {
    yield* this.showNumber(showDuration);
    yield* waitFor(pauseAfterShow);
    yield* this.expand(expandStep, expandHold);
  }

  /**
   * 框选展开式中第 index 项（整项 M×N^x）。
   * @param index 从左到右，0 为最高位
   */
  public *highlightTerm(
    index: number,
    options: { duration?: number; color?: string } = {},
  ): ThreadGenerator {
    if (index < 0 || index >= this.terms.length) {
      throw new Error(
        `BaseNumber.highlightTerm: index 须在 [0, ${this.terms.length - 1}]`,
      );
    }
    const { duration = 0.55, color = Highlight.hud.color } = options;
    yield* this.clearBaseHighlights(0.2);
    yield* this.termAnnotation().focusBox(this.terms[index], {
      style: "hud",
      color,
      lineWidth: Highlight.hud.lineWidth,
      padding: 8,
      fillOpacity: Highlight.hud.fillOpacity,
      duration,
      phase: "enter",
    });
  }

  /**
   * 一次性在每一项正下方显示求值（从上往下淡入）。
   * 默认 expand 已逐项显示；此方法供需要补播/重播时使用。
   */
  public *showTermValues(duration = 0.5): ThreadGenerator {
    if (this.termValues.length === 0) {
      return;
    }
    for (const node of this.termValues) {
      node.opacity(0);
    }
    yield* all(
      ...this.termValues.map((node) =>
        inkReveal(node, { duration, fromY: 16 }),
      ),
    );
  }

  /** 收起各项下方的求值 */
  public *hideTermValues(duration = 0.35): ThreadGenerator {
    yield* inkFade([...this.termValues], { duration });
  }

  /** @deprecated 使用 hideTermValues */
  public *hideTermValue(duration = 0.35): ThreadGenerator {
    yield* this.hideTermValues(duration);
  }

  /**
   * 同时 HUD 锁定展开式中所有基数 N（每一项里的 base）。
   * 框会停留，需 clearHighlight / clearBaseHighlights 清除。
   */
  public *highlightBases(
    options: { duration?: number; color?: string } = {},
  ): ThreadGenerator {
    const { duration = 0.55, color = Highlight.hud.color } = options;
    yield* this.termAnnotation().focusBox([], {
      style: "hud",
      phase: "leave",
      duration: 0.2,
    });

    yield* all(
      ...this.baseParts.map((node, i) =>
        this.baseAnnotations[i].focusBox(node, {
          style: "hud",
          phase: "enter",
          color,
          lineWidth: Highlight.hud.lineWidth,
          padding: 6,
          fillOpacity: Highlight.hud.fillOpacity,
          duration,
        }),
      ),
    );
  }

  /** 清除所有基数框选 */
  public *clearBaseHighlights(duration = 0.35): ThreadGenerator {
    yield* all(
      ...this.baseAnnotations.map((ann) =>
        ann.focusBox([], { style: "hud", phase: "leave", duration }),
      ),
    );
  }

  /** 清除单项框选与基数框选 */
  public *clearHighlight(duration = 0.35): ThreadGenerator {
    yield* all(
      this.termAnnotation().focusBox([], {
        style: "hud",
        phase: "leave",
        duration,
      }),
      this.clearBaseHighlights(duration),
    );
  }

  /** 整组隐去 */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* this.clearHighlight(duration * 0.5);
    yield* inkFade(
      [
        this.valueLatex(),
        this.eqLatex(),
        ...this.termBlocks,
        ...this.termValues,
        ...this.pluses,
      ],
      { duration },
    );
  }
}
