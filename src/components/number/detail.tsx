import { Latex, Layout, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { Highlight } from "../../theme/highlight";
import { inkFade, inkReveal } from "../../theme/ink_anim";
import { Annotation } from "../annotation/annotation";
import { digitsInBase } from "./base";

export interface NumberDetailProps extends NodeProps {
  /** 要详细展示的非负整数 */
  value: number;
  /**
   * 进制，默认 10。
   * 各位数字按此进制拆分，公式中的基数与权重均为此进制下的含义；
   * 位名汉字（个/十/百/千…）仅在十进制下使用，其他进制下位名显示为 `base^power`（个位仍为「个」）。
   */
  base?: number;
  /** 数字字号，默认 56 */
  fontSize?: number;
  /** 位名字号，默认 fontSize × 0.38 */
  placeFontSize?: number;
  /** 公式字号，默认 fontSize × 0.55 */
  formulaFontSize?: number;
  /** 数字颜色，默认 Ink.paper */
  fill?: string;
  /** 位名颜色，默认 Ink.gold */
  placeFill?: string;
  /** 公式颜色，默认 Ink.paperSoft */
  formulaFill?: string;
  /** 各位水平间距，默认 28 */
  digitGap?: number;
  /** 基数/权重说明文字的纵坐标（组件局部坐标），默认 -280（屏幕偏上） */
  captionY?: number;
  /** 基数/权重说明文字字号，默认 fontSize × 0.75 */
  captionFontSize?: number;
  /** 基数说明文案，默认「基数」 */
  baseCaptionText?: string;
  /** 权重说明文案，默认「权重」 */
  weightCaptionText?: string;
}

const BIG_UNITS = ["", "万", "亿", "兆", "京"] as const;
const SMALL_UNITS = ["", "十", "百", "千"] as const;

/**
 * 十进制位权汉字：个、十、百、千、万、十万…亿、十亿…
 * @param power 从个位起的指数（0=个，1=十，…）
 */
export function placeNameZh(power: number): string {
  if (!Number.isInteger(power) || power < 0) {
    throw new Error("placeNameZh: power 须为非负整数");
  }
  if (power === 0) {
    return "个";
  }
  const bigIdx = Math.floor(power / 4);
  const smallIdx = power % 4;
  if (bigIdx >= BIG_UNITS.length) {
    throw new Error(`placeNameZh: power=${power} 超出支持范围（至京）`);
  }
  if (smallIdx === 0) {
    return BIG_UNITS[bigIdx];
  }
  return `${SMALL_UNITS[smallIdx]}${BIG_UNITS[bigIdx]}`;
}

/** 生成各位位名（高位在前，与 digits 对齐） */
export function placeNamesForDigits(digitCount: number): string[] {
  if (!Number.isInteger(digitCount) || digitCount < 1) {
    throw new Error("placeNamesForDigits: digitCount 须为正整数");
  }
  return Array.from({ length: digitCount }, (_, i) =>
    placeNameZh(digitCount - 1 - i),
  );
}

/**
 * 生成各位位名（高位在前）。
 * 十进制用汉字位名；其他进制个位为「个」，其余显示为 `base^power`（如 `2^3`）。
 */
export function placeLabelsForBase(digitCount: number, base = 10): string[] {
  if (!Number.isInteger(digitCount) || digitCount < 1) {
    throw new Error("placeLabelsForBase: digitCount 须为正整数");
  }
  if (!Number.isInteger(base) || base < 2) {
    throw new Error("placeLabelsForBase: base 须为 ≥2 的整数");
  }
  if (base === 10) {
    return placeNamesForDigits(digitCount);
  }
  return Array.from({ length: digitCount }, (_, i) => {
    const power = digitCount - 1 - i;
    return power === 0 ? "个" : `${base}^${power}`;
  });
}

/** 权值展开：2×1000+0×100+2×10+6×1（base 进制下权为 base^power 的十进制值） */
export function weightExpandTex(digits: number[], base = 10): string {
  return digits
    .map((d, i) => {
      const power = digits.length - 1 - i;
      const weight = base ** power;
      return `${d}\\times ${weight}`;
    })
    .join("+");
}

/** 幂次展开：2×10^{3}+0×10^{2}+2×10^{1}+6×10^{0}（基数为 base） */
export function powerExpandTex(digits: number[], base = 10): string {
  return digits
    .map((d, i) => {
      const power = digits.length - 1 - i;
      return `${d}\\times ${base}^{${power}}`;
    })
    .join("+");
}

/**
 * 数字位权详解：上排各位数字，下排位名，再逐步追加拆解公式行。
 *
 * 公式默认两行（每次 showDecomposeLine 显示一行）：
 *   = 2×1000 + 0×100 + 2×10 + 6×1
 *   = 2×10³ + 0×10² + 2×10¹ + 6×10⁰
 *
 * 幂次行按词元拆分，可一起框选其中所有部分的基数（highlightBases →「基数」）
 * 与所有部分的指数（highlightWeights →「权重」），文字在框选完成后显示。
 */
export class NumberDetail extends Node {
  private readonly digitLatex = createRefArray<Latex>();
  private readonly placeLabels = createRefArray<Txt>();
  private readonly weightLine = createRef<Latex>();
  private readonly powerRow = createRef<Layout>();
  /** 幂次行中各基数词元（`10` 部分），供 highlightBases 框选 */
  private readonly baseParts = createRefArray<Latex>();
  /** 幂次行中各指数词元（`^{n}` 部分），供 highlightWeights 框选 */
  private readonly expParts = createRefArray<Latex>();
  private readonly baseCaption = createRef<Txt>();
  private readonly weightCaption = createRef<Txt>();
  /** 说明文字 glitch 残影（teal / seal 错位闪烁，科技感入场） */
  private readonly baseGhostA = createRef<Txt>();
  private readonly baseGhostB = createRef<Txt>();
  private readonly weightGhostA = createRef<Txt>();
  private readonly weightGhostB = createRef<Txt>();
  /** 每部分基数各一个标注框（同时播放） */
  private readonly baseAnns = createRefArray<Annotation>();
  /** 每部分指数各一个标注框（同时播放） */
  private readonly weightAnns = createRefArray<Annotation>();

  private readonly digitValues: number[];
  private readonly baseValue: number;
  private readonly placeNames: string[];
  private readonly weightTex: string;
  private readonly captionRestY: number;
  private nextFormulaIndex = 0;
  private baseShown = false;
  private weightShown = false;

  public constructor(props: NumberDetailProps) {
    const {
      value,
      base = 10,
      fontSize = 56,
      placeFontSize,
      formulaFontSize,
      fill = Ink.paper,
      placeFill = Ink.gold,
      formulaFill = Ink.paperSoft,
      digitGap = 28,
      captionY = -280,
      captionFontSize,
      baseCaptionText = "基数",
      weightCaptionText = "权重",
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error("NumberDetail: value 须为非负整数");
    }
    if (!Number.isInteger(base) || base < 2) {
      throw new Error("NumberDetail: base 须为 ≥2 的整数");
    }
    this.baseValue = base;

    this.digitValues = digitsInBase(value, base);
    this.placeNames = placeLabelsForBase(this.digitValues.length, base);
    this.weightTex = `=${weightExpandTex(this.digitValues, base)}`;
    this.captionRestY = captionY;

    const placeSize = placeFontSize ?? Math.round(fontSize * 0.38);
    const formulaSize = formulaFontSize ?? Math.round(fontSize * 0.55);
    const captionSize = captionFontSize ?? Math.round(fontSize * 0.75);
    // 多字位名（如「十万」）需要足够列宽，避免挤叠
    const colWidth = Math.max(
      Math.round(fontSize * 1.15),
      Math.round(placeSize * 2.6),
    );
    const colStep = colWidth + digitGap;
    const n = this.digitValues.length;
    const totalWidth = n * colWidth + (n - 1) * digitGap;
    const colX = (i: number) => -totalWidth / 2 + colWidth / 2 + i * colStep;

    // 手工纵向排布（所有动画叶子挂在普通 Node 下，保证是布局根节点，
    // y 位移不受 flex 接管，可正常下落；之前放在 Layout 里只剩淡入）。
    // 高度按字号估算（中心定位，误差只影响行距，不影响动画）。
    const digitH = Math.round(fontSize * 1.2);
    const placeH = Math.round(placeSize * 1.5);
    const formulaH = Math.round(formulaSize * 1.4);
    const colGap = Math.round(fontSize * 0.22);
    const rowGap = Math.round(fontSize * 0.45);
    const formulaGap = Math.round(formulaSize * 0.45);

    const digitY = 0;
    const placeY = digitH / 2 + colGap + placeH / 2;
    const formulaTop = placeY + placeH / 2 + rowGap;
    const formulaY = (i: number) =>
      formulaTop + formulaH / 2 + i * (formulaH + formulaGap);

    // 三层均为普通 Node：digits / 位名 / 公式互不干扰定位
    const digitsLayer = new Node({});
    const placesLayer = new Node({});
    const formulaLayer = new Node({});
    this.add(digitsLayer);
    this.add(placesLayer);
    this.add(formulaLayer);

    for (let i = 0; i < n; i++) {
      digitsLayer.add(
        <Latex
          ref={this.digitLatex}
          tex={`${this.digitValues[i]}`}
          fill={fill}
          fontSize={fontSize}
          x={colX(i)}
          y={digitY}
          opacity={0}
        />,
      );
      placesLayer.add(
        <Txt
          ref={this.placeLabels}
          text={this.placeNames[i]}
          fontFamily={Ink.font}
          fontSize={placeSize}
          fill={placeFill}
          x={colX(i)}
          y={placeY}
          opacity={0}
        />,
      );
    }

    // 第 1 行：权值展开（整行单个 Latex）
    formulaLayer.add(
      <Latex
        ref={this.weightLine}
        tex={this.weightTex}
        fill={formulaFill}
        fontSize={formulaSize}
        x={0}
        y={formulaY(0)}
        opacity={0}
      />,
    );

    // 第 2 行：幂次展开（词元拆分，基数 / 指数可单独框选）。
    // 行容器是普通 Node 的直接子 Layout（布局根节点），整行动画 y 位移有效；
    // 行内词元只做静态排布 + 框选目标，不单独做位移动画。
    const tokenGap = Math.max(4, Math.round(formulaSize * 0.18));
    formulaLayer.add(
      <Layout
        ref={this.powerRow}
        layout
        direction={"row"}
        gap={tokenGap}
        alignItems={"center"}
        x={0}
        y={formulaY(1)}
        opacity={0}
      />,
    );
    const row = this.powerRow();
    row.add(<Latex tex={"="} fill={formulaFill} fontSize={formulaSize} />);
    for (let i = 0; i < n; i++) {
      const power = n - 1 - i;
      row.add(
        <Latex
          tex={`${this.digitValues[i]}\\times`}
          fill={formulaFill}
          fontSize={formulaSize}
        />,
      );
      row.add(
        <Latex
          ref={this.baseParts}
          tex={`${base}`}
          fill={formulaFill}
          fontSize={formulaSize}
        />,
      );
      row.add(
        <Latex
          ref={this.expParts}
          tex={`^{${power}}`}
          fill={formulaFill}
          fontSize={formulaSize}
        />,
      );
      if (i < n - 1) {
        row.add(
          <Latex tex={"+"} fill={formulaFill} fontSize={formulaSize} />,
        );
      }
    }

    // 基数 / 权重说明文字（屏幕偏上，按需显现）。
    // 主体常驻辉光 + 双残影：glitch 入场 → 落定脉冲（见 revealCaption）。
    const captionCommon = {
      fontFamily: Ink.font,
      fontSize: captionSize,
      x: 0,
      y: captionY,
      opacity: 0,
    } as const;
    this.add(
      <Txt
        ref={this.baseCaption}
        text={baseCaptionText}
        fill={Ink.paper}
        shadowColor={Ink.teal}
        shadowBlur={10}
        {...captionCommon}
      />,
    );
    this.add(
      <Txt
        ref={this.baseGhostA}
        text={baseCaptionText}
        fill={Ink.teal}
        {...captionCommon}
      />,
    );
    this.add(
      <Txt
        ref={this.baseGhostB}
        text={baseCaptionText}
        fill={Ink.seal}
        {...captionCommon}
      />,
    );
    this.add(
      <Txt
        ref={this.weightCaption}
        text={weightCaptionText}
        fill={Ink.paper}
        shadowColor={Highlight.fill}
        shadowBlur={10}
        {...captionCommon}
      />,
    );
    this.add(
      <Txt
        ref={this.weightGhostA}
        text={weightCaptionText}
        fill={Ink.teal}
        {...captionCommon}
      />,
    );
    this.add(
      <Txt
        ref={this.weightGhostB}
        text={weightCaptionText}
        fill={Ink.seal}
        {...captionCommon}
      />,
    );
    // 每部分各一个标注框（与词元一一对应，同时播放整体框选）
    for (let i = 0; i < n; i++) {
      this.add(<Annotation ref={this.baseAnns} />);
      this.add(<Annotation ref={this.weightAnns} />);
    }
  }

  /** 位数 */
  public get digitCount(): number {
    return this.digitValues.length;
  }

  /** 当前进制 */
  public get base(): number {
    return this.baseValue;
  }

  /** 拆解公式总行数（当前固定 2） */
  public get formulaLineCount(): number {
    return 2;
  }

  /** 下一条待显示公式行的下标；全部显示完则为 lineCount */
  public get nextDecomposeIndex(): number {
    return this.nextFormulaIndex;
  }

  /** 基数词元个数（即位数） */
  public get basePartCount(): number {
    return this.baseParts.length;
  }

  /** 指数词元个数（即位数） */
  public get weightPartCount(): number {
    return this.expParts.length;
  }

  /** 显示上排各位数字（同时显现） */
  public *showNumber(duration = 0.55): ThreadGenerator {
    if (this.digitLatex.length === 0) {
      return;
    }
    yield* all(
      ...this.digitLatex.map((node) =>
        inkReveal(node, { duration, fromY: 12 }),
      ),
    );
  }

  /**
   * 在每位数字下方显示位名（个、十、百、千…）。
   * 从右向左依次：自数字下方往下掉落并淡入。
   */
  public *showPlaceNames(duration = 0.4, stagger = 0.1): ThreadGenerator {
    if (this.placeLabels.length === 0) {
      return;
    }
    const n = this.placeLabels.length;
    // 右→左：个位先掉，再到十、百、千…；交错启动形成级联
    yield* all(
      ...Array.from({ length: n }, (_, k) => {
        const i = n - 1 - k;
        return delay(
          k * stagger,
          inkReveal(this.placeLabels[i], { duration, fromY: 28 }),
        );
      }),
    );
  }

  /**
   * 显示下一行拆解公式（一个等号一行，调用一次显示一行）。
   * 第 1 次：权值展开；第 2 次：幂次展开。
   * 已全部显示后再调用则直接返回。
   */
  public *showDecomposeLine(duration = 0.5): ThreadGenerator {
    if (this.nextFormulaIndex >= this.formulaLineCount) {
      return;
    }
    const index = this.nextFormulaIndex;
    this.nextFormulaIndex += 1;
    if (index === 0) {
      yield* inkReveal(this.weightLine(), { duration, fromY: 10 });
    } else {
      yield* inkReveal(this.powerRow(), { duration, fromY: 10 });
    }
  }

  /** 一次性显示剩余全部拆解行 */
  public *showDecomposeAll(
    stepDuration = 0.5,
    hold = 0.2,
  ): ThreadGenerator {
    while (this.nextFormulaIndex < this.formulaLineCount) {
      yield* this.showDecomposeLine(stepDuration);
      if (
        hold > 0 &&
        this.nextFormulaIndex < this.formulaLineCount
      ) {
        yield* waitFor(hold);
      }
    }
  }

  private ensurePowerLineShown(caller: string): void {
    if (this.nextFormulaIndex < this.formulaLineCount) {
      throw new Error(
        `NumberDetail.${caller}: 请先显示最后一行幂次展开（showDecomposeAll）`,
      );
    }
  }

  /**
   * 说明文字科技感显现：残影错位闪烁（glitch-in）→ 辉光落定脉冲。
   * 常驻辉光即显示后的持续科技感。
   */
  private *revealCaption(
    main: Txt,
    ghostA: Txt,
    ghostB: Txt,
    restY: number,
    options: { captionDuration?: number } = {},
  ): ThreadGenerator {
    const { captionDuration = 0.45 } = options;
    const snap = Math.max(0.2, captionDuration * 0.55);
    main.y(restY - 10);
    main.scale(1.14);
    yield* all(
      ghostA.opacity(0.8, 0.06).to(0, 0.22),
      ghostB.opacity(0.8, 0.06).to(0, 0.22),
      ghostA.x(-14, 0.1).to(0, 0.2),
      ghostB.x(14, 0.1).to(0, 0.2),
      main.opacity(1, snap, easeOutCubic),
      main.y(restY, snap, easeOutCubic),
      main.scale(1, snap, easeOutCubic),
    );
    yield* all(
      main.scale(1.045, 0.14, easeOutCubic).to(1, 0.2, easeInOutCubic),
      main.shadowBlur(28, 0.14).to(10, 0.25),
    );
  }

  /**
   * 整体框选幂次行中所有部分的基数词元：每一部分独立一框，所有框同时播放；
   * 框选完成后再在屏幕偏上显示「基数」。框体停留，需 clearHighlights / highlightWeights 清除。
   */
  public *highlightBases(
    options: {
      duration?: number;
      captionDuration?: number;
      color?: string;
    } = {},
  ): ThreadGenerator {
    const {
      duration = 0.55,
      captionDuration = 0.45,
      color = Highlight.hud.color,
    } = options;
    this.ensurePowerLineShown("highlightBases");
    if (this.baseShown) {
      return;
    }
    yield* this.clearHighlights(0.2);
    yield* all(
      ...this.baseParts.map((part, i) =>
        this.baseAnns[i].focusBox(part, {
          style: "hud",
          phase: "enter",
          color,
          lineWidth: Highlight.hud.lineWidth,
          padding: Highlight.hud.padding,
          fillOpacity: Highlight.hud.fillOpacity,
          duration,
        }),
      ),
    );
    yield* this.revealCaption(
      this.baseCaption(),
      this.baseGhostA(),
      this.baseGhostB(),
      this.captionRestY,
      { captionDuration },
    );
    this.baseShown = true;
  }

  /**
   * 整体框选幂次行中所有部分的指数词元（如每个 `^{n}` 各独立一框，即权重），
   * 所有框同时播放；再在屏幕偏上显示「权重」。会先收起基数标注；框体停留，需 clearHighlights 清除。
   */
  public *highlightWeights(
    options: {
      duration?: number;
      captionDuration?: number;
      color?: string;
    } = {},
  ): ThreadGenerator {
    const {
      duration = 0.55,
      captionDuration = 0.45,
      color = Highlight.fill,
    } = options;
    this.ensurePowerLineShown("highlightWeights");
    if (this.weightShown) {
      return;
    }
    yield* all(
      ...this.baseAnns.map((ann) =>
        ann.focusBox([], {
          style: "hud",
          phase: "leave",
          duration: 0.3,
        }),
      ),
      ...this.weightAnns.map((ann) =>
        ann.focusBox([], {
          style: "hud",
          phase: "leave",
          duration: 0.3,
        }),
      ),
      inkFade([this.baseCaption(), this.weightCaption()], { duration: 0.3 }),
    );
    this.baseShown = false;
    this.weightShown = false;
    yield* all(
      ...this.expParts.map((part, i) =>
        this.weightAnns[i].focusBox(part, {
          style: "hud",
          phase: "enter",
          color,
          lineWidth: Highlight.hud.lineWidth,
          padding: Highlight.hud.padding,
          fillOpacity: Highlight.hud.fillOpacity,
          duration,
        }),
      ),
    );
    yield* this.revealCaption(
      this.weightCaption(),
      this.weightGhostA(),
      this.weightGhostB(),
      this.captionRestY,
      { captionDuration },
    );
    this.weightShown = true;
  }

  /** 清除基数 / 权重框选与说明文字（含残影复位） */
  public *clearHighlights(duration = 0.35): ThreadGenerator {
    for (const ghost of [
      this.baseGhostA(),
      this.baseGhostB(),
      this.weightGhostA(),
      this.weightGhostB(),
    ]) {
      ghost.opacity(0);
      ghost.x(0);
    }
    for (const caption of [this.baseCaption(), this.weightCaption()]) {
      caption.scale(1);
      caption.shadowBlur(10);
    }
    yield* all(
      ...this.baseAnns.map((ann) =>
        ann.focusBox([], {
          style: "hud",
          phase: "leave",
          duration,
        }),
      ),
      ...this.weightAnns.map((ann) =>
        ann.focusBox([], {
          style: "hud",
          phase: "leave",
          duration,
        }),
      ),
      inkFade([this.baseCaption(), this.weightCaption()], { duration }),
    );
    this.baseShown = false;
    this.weightShown = false;
  }

  /**
   * 完整演示：数字 → 位名 → 拆解公式逐行。
   */
  public *play(
    options: {
      numberDuration?: number;
      placeDuration?: number;
      formulaDuration?: number;
      pauseAfterNumber?: number;
      pauseAfterPlaces?: number;
      formulaHold?: number;
    } = {},
  ): ThreadGenerator {
    const {
      numberDuration = 0.5,
      placeDuration = 0.4,
      formulaDuration = 0.5,
      pauseAfterNumber = 0.35,
      pauseAfterPlaces = 0.4,
      formulaHold = 0.25,
    } = options;

    yield* this.showNumber(numberDuration);
    yield* waitFor(pauseAfterNumber);
    yield* this.showPlaceNames(placeDuration);
    yield* waitFor(pauseAfterPlaces);
    yield* this.showDecomposeAll(formulaDuration, formulaHold);
  }

  /** 整组隐去（含框选与说明文字） */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* this.clearHighlights(duration * 0.5);
    yield* inkFade(
      [
        ...this.digitLatex,
        ...this.placeLabels,
        this.weightLine(),
        this.powerRow(),
      ],
      { duration },
    );
  }
}
