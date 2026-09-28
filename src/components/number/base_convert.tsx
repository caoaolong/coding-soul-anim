import { Latex, Layout, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";
import { Annotation } from "../annotation/annotation";
import {
  BasePart,
  cleanDecimal,
  digitsInBase,
  formatDecimal,
  fracDigitsInBase,
  placeDigitsInBase,
  splitNonNeg,
} from "./base";

export interface BaseConvertProps extends NodeProps {
  /** 要转换的非负实数（按十进制数值理解，可含小数） */
  value: number;
  /** 源进制，默认 10 */
  fromBase?: number;
  /** 目标进制 */
  toBase: number;
  /**
   * 小数转换最多取几位；默认自动（遇尽早停，最多 12 位）。
   */
  fracPlaces?: number;
  /**
   * 演示范围：all 整数+小数；int 仅连除；frac 仅乘基取整。
   * 默认 all。
   */
  part?: BasePart;
  /** 字号，默认 32 */
  fontSize?: number;
  /** 步骤行距，默认 18 */
  rowGap?: number;
  /** 步骤区宽度（用于左右对齐），默认 560 */
  stepWidth?: number;
  /** 公式颜色 */
  fill?: string;
}

interface DivStep {
  dividend: number;
  quotient: number;
  remainder: number;
}

interface MulStep {
  /** 参与乘法的小数（[0,1)） */
  factor: number;
  /** factor × toBase */
  product: number;
  /** 取出的整数位 */
  digit: number;
}

const FRAC_EPS = 1e-12;
const DEFAULT_MAX_FRAC = 12;

/** 连除法步骤：整数部分不断 ÷ toBase，记录商与余数 */
export function divisionSteps(value: number, toBase: number): DivStep[] {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("BaseConvert: value 须为非负有限数");
  }
  if (!Number.isInteger(toBase) || toBase < 2) {
    throw new Error("BaseConvert: toBase 须为 ≥2 的整数");
  }
  const intPart = Math.floor(value + FRAC_EPS);
  if (intPart === 0) {
    return [{ dividend: 0, quotient: 0, remainder: 0 }];
  }
  const steps: DivStep[] = [];
  let x = intPart;
  while (x > 0) {
    const remainder = x % toBase;
    const quotient = Math.floor(x / toBase);
    steps.push({ dividend: x, quotient, remainder });
    x = quotient;
  }
  return steps;
}

/** 乘基取整步骤：小数部分不断 × toBase，记录取出的整数位 */
export function multiplySteps(
  value: number,
  toBase: number,
  maxPlaces = DEFAULT_MAX_FRAC,
): MulStep[] {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("BaseConvert: value 须为非负有限数");
  }
  if (!Number.isInteger(toBase) || toBase < 2) {
    throw new Error("BaseConvert: toBase 须为 ≥2 的整数");
  }
  const { fracPart } = splitNonNeg(value);
  if (fracPart < FRAC_EPS) {
    return [];
  }

  const steps: MulStep[] = [];
  let x = cleanDecimal(fracPart);
  for (let i = 0; i < maxPlaces; i++) {
    if (x < FRAC_EPS) {
      break;
    }
    const factor = x;
    const product = cleanDecimal(factor * toBase);
    let digit = Math.floor(product + FRAC_EPS);
    if (digit >= toBase) {
      digit = toBase - 1;
    }
    steps.push({ factor, product, digit });
    x = cleanDecimal(product - digit);
    if (x < FRAC_EPS) {
      break;
    }
  }
  return steps;
}

function leftPlainLenDiv(step: DivStep, toBase: number): number {
  return (
    String(step.dividend).length +
    1 +
    String(toBase).length +
    1 +
    String(step.quotient).length
  );
}

function leftPlainLenMul(step: MulStep, toBase: number): number {
  return (
    formatDecimal(step.factor).length +
    1 +
    String(toBase).length +
    1 +
    formatDecimal(step.product).length
  );
}

function padDots(missing: number): string {
  const n = Math.max(1, missing + 1);
  return Array.from({ length: n }, () => "\\ldots").join("");
}

/**
 * 进制转换演示：
 * 整数：连除取余（余数自下而上）；
 * 小数：乘基取整（整数位自上而下）；
 * 最后各位飞入结果行。
 */
export class BaseConvert extends Node {
  private readonly header = createRef<Latex>();
  private readonly hintInt = createRef<Txt>();
  private readonly hintFrac = createRef<Txt>();
  private readonly intStepRows = createRefArray<Layout>();
  private readonly fracStepRows = createRefArray<Layout>();
  private readonly intRemParts = createRefArray<Latex>();
  private readonly fracDigitParts = createRefArray<Latex>();
  private readonly resultLeft = createRef<Latex>();
  private readonly resultIntDigits = createRefArray<Latex>();
  private readonly resultDot = createRef<Latex>();
  private readonly resultFracDigits = createRefArray<Latex>();
  private readonly resultRight = createRef<Latex>();
  private readonly annotation = createRef<Annotation>();
  private readonly remAnnotations = createRefArray<Annotation>();

  private readonly intSteps: DivStep[];
  private readonly fracSteps: MulStep[];
  private readonly value: number;
  private readonly fromBase: number;
  private readonly toBase: number;
  private readonly intDigitValues: number[];
  private readonly fracDigitValues: number[];
  private readonly showInt: boolean;
  private readonly showFrac: boolean;
  private readonly stepFontSize: number;
  private readonly resultFontSize: number;

  public constructor(props: BaseConvertProps) {
    const {
      value,
      fromBase = 10,
      toBase,
      fracPlaces = DEFAULT_MAX_FRAC,
      part = "all",
      fontSize = 32,
      rowGap = 18,
      stepWidth = 560,
      fill = Ink.paper,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error("BaseConvert: value 须为非负有限数");
    }

    this.value = value;
    this.fromBase = fromBase;
    this.toBase = toBase;
    this.stepFontSize = fontSize;
    this.resultFontSize = fontSize + 4;

    const places = placeDigitsInBase(value, toBase, fracPlaces);
    this.showInt = part !== "frac";
    this.showFrac = part !== "int" && places.fracDigits.length > 0;
    this.intSteps = this.showInt ? divisionSteps(value, toBase) : [];
    this.fracSteps = this.showFrac
      ? multiplySteps(value, toBase, fracPlaces)
      : [];
    // 仅小数演示时结果仍写成 0.xxxx
    this.intDigitValues = this.showInt ? places.intDigits : [0];
    this.fracDigitValues = this.showFrac ? places.fracDigits : [];

    const maxLeft = Math.max(
      1,
      ...this.intSteps.map((s) => leftPlainLenDiv(s, toBase)),
      ...this.fracSteps.map((s) => leftPlainLenMul(s, toBase)),
    );

    const col = createRef<Layout>();
    this.add(
      <Layout
        ref={col}
        layout
        direction={"column"}
        gap={16}
        alignItems={"center"}
      />,
    );

    const valueTex = formatDecimal(value);
    col().add(
      <Latex
        ref={this.header}
        tex={`${valueTex}_{(${fromBase})}\\rightarrow_{(${toBase})}`}
        fill={fill}
        fontSize={fontSize + 8}
        opacity={0}
      />,
    );

    // 固定行宽 + 右栏贴齐取出位，避免长公式撑破行宽后被父级居中错位
    const remColW = Math.round(fontSize * 1.8);
    const formulaColW = stepWidth - remColW;

    if (this.showInt) {
      col().add(
        <Txt
          ref={this.hintInt}
          text={"整数：连除取余（余数自下而上）"}
          fontFamily={Ink.font}
          fontSize={22}
          fill={Ink.paperSoft}
          opacity={0}
        />,
      );

      const intCol = createRef<Layout>();
      col().add(
        <Layout
          ref={intCol}
          layout
          direction={"column"}
          gap={rowGap}
          alignItems={"stretch"}
          width={stepWidth}
        />,
      );

      for (let i = 0; i < this.intSteps.length; i++) {
        const step = this.intSteps[i];
        const missing = maxLeft - leftPlainLenDiv(step, toBase);
        const dots = padDots(missing);
        const leftTex = `${step.dividend}\\div ${toBase}=${step.quotient}`;

        intCol().add(
          <Layout
            ref={this.intStepRows}
            layout
            direction={"row"}
            width={stepWidth}
            alignItems={"center"}
            opacity={0}
          >
            <Layout
              layout
              direction={"row"}
              width={formulaColW}
              alignItems={"center"}
            >
              <Latex tex={leftTex} fill={fill} fontSize={fontSize} />
              <Layout
                grow={1}
                layout
                direction={"row"}
                justifyContent={"center"}
              >
                <Latex tex={dots} fill={Ink.muted} fontSize={fontSize} />
              </Layout>
            </Layout>
            <Layout
              layout
              direction={"row"}
              width={remColW}
              justifyContent={"end"}
              alignItems={"center"}
            >
              <Latex
                ref={this.intRemParts}
                tex={`${step.remainder}`}
                fill={Ink.gold}
                fontSize={fontSize}
              />
            </Layout>
          </Layout>,
        );
        this.add(<Annotation ref={this.remAnnotations} />);
      }
    }

    if (this.showFrac) {
      col().add(
        <Txt
          ref={this.hintFrac}
          text={"小数：乘基取整（整数位自上而下）"}
          fontFamily={Ink.font}
          fontSize={22}
          fill={Ink.paperSoft}
          opacity={0}
        />,
      );

      const fracCol = createRef<Layout>();
      col().add(
        <Layout
          ref={fracCol}
          layout
          direction={"column"}
          gap={rowGap}
          alignItems={"stretch"}
          width={stepWidth}
        />,
      );

      for (let i = 0; i < this.fracSteps.length; i++) {
        const step = this.fracSteps[i];
        const missing = maxLeft - leftPlainLenMul(step, toBase);
        const dots = padDots(missing);
        const leftTex = `${formatDecimal(step.factor)}\\times ${toBase}=${formatDecimal(step.product)}`;

        fracCol().add(
          <Layout
            ref={this.fracStepRows}
            layout
            direction={"row"}
            width={stepWidth}
            alignItems={"center"}
            opacity={0}
          >
            <Layout
              layout
              direction={"row"}
              width={formulaColW}
              alignItems={"center"}
            >
              <Latex tex={leftTex} fill={fill} fontSize={fontSize} />
              <Layout
                grow={1}
                layout
                direction={"row"}
                justifyContent={"center"}
              >
                <Latex tex={dots} fill={Ink.muted} fontSize={fontSize} />
              </Layout>
            </Layout>
            <Layout
              layout
              direction={"row"}
              width={remColW}
              justifyContent={"end"}
              alignItems={"center"}
            >
              <Latex
                ref={this.fracDigitParts}
                tex={`${step.digit}`}
                fill={Ink.gold}
                fontSize={fontSize}
              />
            </Layout>
          </Layout>,
        );
        this.add(<Annotation ref={this.remAnnotations} />);
      }
    }

    const resultRow = createRef<Layout>();
    col().add(
      <Layout
        ref={resultRow}
        layout
        direction={"row"}
        gap={2}
        alignItems={"center"}
      />,
    );

    // 含小数转换时结果多为截断近似，用 ≈；纯整数用 =
    const resultEq = this.showFrac ? "\\approx" : "=";
    resultRow().add(
      <Latex
        ref={this.resultLeft}
        tex={`${valueTex}_{(${fromBase})}${resultEq}`}
        fill={fill}
        fontSize={this.resultFontSize}
        opacity={0}
      />,
    );

    for (const digit of this.intDigitValues) {
      resultRow().add(
        <Latex
          ref={this.resultIntDigits}
          tex={`${digit}`}
          fill={Ink.gold}
          fontSize={this.resultFontSize}
          opacity={0}
        />,
      );
    }

    if (this.showFrac) {
      resultRow().add(
        <Latex
          ref={this.resultDot}
          tex={"."}
          fill={Ink.gold}
          fontSize={this.resultFontSize}
          opacity={0}
        />,
      );

      for (const digit of this.fracDigitValues) {
        resultRow().add(
          <Latex
            ref={this.resultFracDigits}
            tex={`${digit}`}
            fill={Ink.gold}
            fontSize={this.resultFontSize}
            opacity={0}
          />,
        );
      }
    }

    resultRow().add(
      <Latex
        ref={this.resultRight}
        tex={`_{(${toBase})}`}
        fill={fill}
        fontSize={this.resultFontSize}
        opacity={0}
      />,
    );

    this.add(<Annotation ref={this.annotation} />);
  }

  /** 显示标题与对应提示 */
  public *showHeader(duration = 0.5): ThreadGenerator {
    yield* inkReveal(this.header(), { duration, fromY: 12 });
    yield* waitFor(0.15);
    if (this.showInt) {
      yield* inkReveal(this.hintInt(), { duration: 0.4, fromY: 8 });
    } else if (this.showFrac) {
      yield* inkReveal(this.hintFrac(), { duration: 0.4, fromY: 8 });
    }
  }

  /** 逐步播放整数连除 */
  public *playIntSteps(stepDuration = 0.35, hold = 0.1): ThreadGenerator {
    if (!this.showInt) {
      return;
    }
    for (let i = 0; i < this.intStepRows.length; i++) {
      yield* inkReveal(this.intStepRows[i], {
        duration: stepDuration,
        fromY: 8,
      });
      if (hold > 0 && i < this.intStepRows.length - 1) {
        yield* waitFor(hold);
      }
    }
  }

  /** 显示小数提示（若尚未显示）并逐步播放乘基取整 */
  public *playFracSteps(stepDuration = 0.35, hold = 0.1): ThreadGenerator {
    if (!this.showFrac) {
      return;
    }
    // 与整数段连播时，小数提示在此补出；仅小数段时提示已在 showHeader
    if (this.showInt) {
      yield* inkReveal(this.hintFrac(), { duration: 0.4, fromY: 8 });
      yield* waitFor(0.15);
    }
    for (let i = 0; i < this.fracStepRows.length; i++) {
      yield* inkReveal(this.fracStepRows[i], {
        duration: stepDuration,
        fromY: 8,
      });
      if (hold > 0 && i < this.fracStepRows.length - 1) {
        yield* waitFor(hold);
      }
    }
  }

  /** @deprecated 使用 playIntSteps；保留兼容旧调用 */
  public *playSteps(stepDuration = 0.35, hold = 0.1): ThreadGenerator {
    yield* this.playIntSteps(stepDuration, hold);
  }

  /** 同时框选所有取出位（整数余数 + 小数整位） */
  public *highlightRemainders(
    options: { duration?: number; color?: string } = {},
  ): ThreadGenerator {
    const { duration = 0.55, color = Ink.gold } = options;
    const parts = [...this.intRemParts, ...this.fracDigitParts];
    yield* all(
      ...parts.map((node, i) =>
        this.remAnnotations[i].focusBox(node, {
          style: "hud",
          phase: "enter",
          color,
          lineWidth: 2.5,
          padding: 5,
          duration,
        }),
      ),
    );
  }

  public *clearRemainders(duration = 0.35): ThreadGenerator {
    yield* all(
      ...this.remAnnotations.map((ann) =>
        ann.focusBox([], { style: "hud", phase: "leave", duration }),
      ),
    );
  }

  /**
   * @param flights 按播放顺序的 (源, 目标, 文案)
   */
  private *flyFlights(
    flights: Array<{ src: Latex; target: Latex; tex: string }>,
    duration: number,
    stagger = 0.07,
  ): ThreadGenerator {
    if (flights.length === 0) {
      return;
    }
    const scale = this.resultFontSize / this.stepFontSize;
    const flyers: Latex[] = [];

    for (const f of flights) {
      const flyerRef = createRef<Latex>();
      this.add(
        <Latex
          ref={flyerRef}
          tex={f.tex}
          fill={Ink.gold}
          fontSize={this.stepFontSize}
          layout={false}
          zIndex={20}
        />,
      );
      const flyer = flyerRef();
      flyer.absolutePosition(f.src.absolutePosition());
      flyers.push(flyer);
    }

    yield* all(...flights.map((f) => f.src.opacity(0, 0.18)));

    yield* all(
      ...flights.map((f, k) =>
        delay(
          k * stagger,
          all(
            flyers[k].absolutePosition(
              f.target.absolutePosition(),
              duration,
              easeInOutCubic,
            ),
            flyers[k].scale(scale, duration, easeInOutCubic),
          ),
        ),
      ),
    );

    for (const f of flights) {
      f.target.opacity(1);
    }
    for (const flyer of flyers) {
      flyer.remove();
    }
  }

  /**
   * 取出位飞入结果：整数余数自下而上，小数整位自上而下；再写出等式。
   */
  public *showResult(duration = 0.7): ThreadGenerator {
    if (this.showInt && this.intRemParts.length > 0) {
      const nInt = this.intRemParts.length;
      const intFlights = Array.from({ length: nInt }, (_, k) => {
        const stepIdx = nInt - 1 - k;
        return {
          src: this.intRemParts[stepIdx],
          target: this.resultIntDigits[k],
          tex: `${this.intSteps[stepIdx].remainder}`,
        };
      });
      yield* this.flyFlights(intFlights, duration);
    } else if (this.showFrac) {
      // 仅小数：先亮出前导 0
      yield* all(
        ...this.resultIntDigits.map((d) => d.opacity(1, 0.25)),
      );
    }

    if (this.showFrac) {
      yield* waitFor(0.12);
      yield* this.resultDot().opacity(1, 0.25);
      const fracFlights = this.fracSteps.map((step, i) => ({
        src: this.fracDigitParts[i],
        target: this.resultFracDigits[i],
        tex: `${step.digit}`,
      }));
      yield* this.flyFlights(fracFlights, duration * 0.9);
    }

    yield* waitFor(0.12);
    yield* all(
      inkReveal(this.resultLeft(), { duration: 0.45, fromY: 8 }),
      inkReveal(this.resultRight(), { duration: 0.45, fromY: 8 }),
    );
  }

  /**
   * 完整转换动画：标题 →（连除）→（乘基）→ 各位归位 → 结果。
   */
  public *play(
    options: {
      headerDuration?: number;
      stepDuration?: number;
      stepHold?: number;
      remHold?: number;
      resultDuration?: number;
    } = {},
  ): ThreadGenerator {
    const {
      headerDuration = 0.5,
      stepDuration = 0.32,
      stepHold = 0.08,
      remHold = 0.9,
      resultDuration = 0.7,
    } = options;

    yield* this.showHeader(headerDuration);
    yield* waitFor(0.25);
    if (this.showInt) {
      yield* this.playIntSteps(stepDuration, stepHold);
    }
    if (this.showFrac) {
      if (this.showInt) {
        yield* waitFor(0.25);
      }
      yield* this.playFracSteps(stepDuration, stepHold);
    }
    yield* waitFor(remHold);
    yield* this.showResult(resultDuration);
  }

  public *hide(duration = 0.4): ThreadGenerator {
    yield* this.clearRemainders(duration * 0.5);
    const fadeNodes = [
      this.header(),
      this.resultLeft(),
      this.resultRight(),
      ...this.resultIntDigits,
    ];
    if (this.showInt) {
      fadeNodes.push(this.hintInt(), ...this.intStepRows);
    }
    if (this.showFrac) {
      fadeNodes.push(
        this.hintFrac(),
        this.resultDot(),
        ...this.resultFracDigits,
        ...this.fracStepRows,
      );
    }
    yield* inkFade(fadeNodes, { duration });
  }
}

export {
  cleanDecimal,
  digitsInBase,
  fracDigitsInBase,
  placeDigitsInBase,
  formatDecimal,
};
