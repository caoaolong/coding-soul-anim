import { Latex, Node, NodeProps } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";

export type FormulaMode = "stack" | "morph";

export interface FormulaStep {
  /**
   * 左侧推导符号（LaTeX），如 "="、"\\Rightarrow"。
   * 首行通常省略。stack 显示在左侧列；morph 作为独立子式参与变形。
   */
  prefix?: string;
  /**
   * 公式主体。
   * - stack：普通 LaTeX 字符串即可
   * - morph：请用 {{...}} 或 string[] 拆成子式，官方靠子式匹配做 SVG 变形
   *   （相同子式补间，新增淡入，消失淡出）
   */
  tex: string | string[];
}

export interface FormulaProps extends NodeProps {
  /** 推导步骤（自上而下 / 依次变形） */
  steps: FormulaStep[];
  /**
   * 呈现模式：
   * - stack：多行竖排，逐行淡入
   * - morph：同一位置 Latex.tex() SVG 路径变形（官方推荐）
   * 默认 stack
   */
  mode?: FormulaMode;
  /** 字号，默认 36 */
  fontSize?: number;
  /** 行距（仅 stack），默认 28 */
  gap?: number;
  /** 前缀列与公式列间距（仅 stack），默认 16 */
  prefixGap?: number;
  /** 前缀列固定宽度（仅 stack），默认随字号估算 */
  prefixWidth?: number;
  /** 单行占位高度（仅 stack），默认 fontSize * 1.35 */
  lineHeight?: number;
  /** 公式颜色 */
  fill?: string;
  /** 前缀颜色，默认与 fill 相同（主要影响 stack） */
  prefixFill?: string;
}

/** stack 用：拼成单行显示字符串 */
export function composeStepTexString(step: FormulaStep): string {
  const prefix = step.prefix?.trim() ?? "";
  const body = Array.isArray(step.tex) ? step.tex.join("") : step.tex.trim();
  if (prefix.length > 0) {
    return `{${prefix}\\;${body}}`;
  }
  return `{${body}}`;
}

/**
 * morph 用：交给 Latex.tex() 的子式序列。
 * 官方用 patience diff：同名 {{part}} 做路径变形，其余淡入/淡出。
 */
export function composeStepTexParts(step: FormulaStep): string | string[] {
  const prefix = step.prefix?.trim() ?? "";
  if (Array.isArray(step.tex)) {
    return prefix.length > 0 ? [`{{${prefix}}}`, "\\;", ...step.tex] : step.tex;
  }
  const body = step.tex.trim();
  if (prefix.length > 0) {
    // 前缀单独成块，便于跨步对齐变形
    return `{{${prefix}}}\\;${body}`;
  }
  return body;
}

/**
 * 公式推导：
 * - stack：多行左对齐，带 = / ⇒ 前缀，逐行淡入
 * - morph：单行 Latex.tex() 官方 SVG 变形（需拆分 {{子式}}）
 */
export class Formula extends Node {
  private readonly mode: FormulaMode;
  private readonly stepsData: FormulaStep[];
  private readonly stepCount: number;
  private readonly rows = createRefArray<Node>();
  private readonly morphLatex = createRef<Latex>();
  /** 已显示到的步骤下标；-1 表示尚未显示任何内容 */
  private cursor = -1;

  public constructor(props: FormulaProps) {
    const {
      steps,
      mode = "stack",
      fontSize = 36,
      gap = 28,
      prefixGap = 16,
      prefixWidth = Math.round(fontSize * 1.35),
      lineHeight = Math.round(fontSize * 1.35),
      fill = Ink.paper,
      prefixFill,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!steps || steps.length === 0) {
      throw new Error("Formula: steps 不能为空");
    }

    this.mode = mode;
    this.stepsData = steps;
    this.stepCount = steps.length;

    if (mode === "morph") {
      this.add(
        <Latex
          ref={this.morphLatex}
          tex={composeStepTexParts(steps[0])}
          fill={fill}
          fontSize={fontSize}
          opacity={0}
        />,
      );
      return;
    }

    // —— stack ——
    const pFill = prefixFill ?? fill;
    const rowPitch = lineHeight + gap;
    const startY = -((steps.length - 1) * rowPitch) / 2;
    const bodyX = prefixWidth + prefixGap;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const prefix = step.prefix?.trim() ?? "";
      const body = Array.isArray(step.tex) ? step.tex.join("") : step.tex;

      this.add(
        <Node ref={this.rows} y={startY + i * rowPitch} opacity={0}>
          {prefix.length > 0 ? (
            <Latex
              tex={`{${prefix}}`}
              x={prefixWidth}
              offset={[1, 0]}
              fill={pFill}
              fontSize={fontSize}
            />
          ) : null}
          <Latex
            tex={`{${body}}`}
            x={bodyX}
            offset={[-1, 0]}
            fill={fill}
            fontSize={fontSize}
          />
        </Node>,
      );
    }
  }

  public getMode(): FormulaMode {
    return this.mode;
  }

  /** 当前已显示到第几步（0-based）；尚未显示时为 -1 */
  public currentStep(): number {
    return this.cursor;
  }

  /** 是否还有未显示的步骤 */
  public hasNext(): boolean {
    return this.cursor < this.stepCount - 1;
  }

  /**
   * 下一步：
   * - stack：淡入下一行
   * - morph：首次淡入；之后 Latex.tex() 路径变形
   */
  public *next(duration?: number): ThreadGenerator {
    if (this.cursor >= this.stepCount - 1) {
      return;
    }

    const d =
      duration ?? (this.mode === "morph" ? 0.85 : 0.4);

    if (this.mode === "morph") {
      yield* this.nextMorph(d);
      return;
    }

    this.cursor += 1;
    yield* this.rows[this.cursor].opacity(1, d, easeOutCubic);
  }

  /**
   * 从当前位置依次播完剩余步骤。
   */
  public *play(stepDuration?: number): ThreadGenerator {
    while (this.cursor < this.stepCount - 1) {
      yield* this.next(stepDuration);
    }
  }

  /** 立刻显示到最后一步（无动画） */
  public revealAll(): void {
    if (this.mode === "morph") {
      this.morphLatex().opacity(1);
      this.morphLatex().tex(
        composeStepTexParts(this.stepsData[this.stepCount - 1]),
      );
      this.cursor = this.stepCount - 1;
      return;
    }

    for (let i = 0; i < this.stepCount; i++) {
      this.rows[i].opacity(1);
    }
    this.cursor = this.stepCount - 1;
  }

  /** 隐藏并重置到初始状态（无动画） */
  public reset(): void {
    this.cursor = -1;
    if (this.mode === "morph") {
      this.morphLatex().opacity(0);
      this.morphLatex().tex(composeStepTexParts(this.stepsData[0]));
      return;
    }
    for (let i = 0; i < this.stepCount; i++) {
      this.rows[i].opacity(0);
    }
  }

  /** 淡出并重置 */
  public *hideAll(duration = 0.3): ThreadGenerator {
    if (this.mode === "morph") {
      if (this.cursor < 0) {
        return;
      }
      yield* this.morphLatex().opacity(0, duration, easeOutCubic);
      this.morphLatex().tex(composeStepTexParts(this.stepsData[0]));
      this.cursor = -1;
      return;
    }

    const n = this.cursor + 1;
    if (n <= 0) {
      return;
    }
    yield* all(
      ...Array.from({ length: n }, (_, i) =>
        this.rows[i].opacity(0, duration, easeOutCubic),
      ),
    );
    this.cursor = -1;
  }

  private *nextMorph(duration: number): ThreadGenerator {
    if (this.cursor < 0) {
      this.cursor = 0;
      this.morphLatex().tex(composeStepTexParts(this.stepsData[0]));
      // 先瞬时设好起始 scale（不要用 duration=0 的 tween：
      // MC 内部是 time/duration，duration 为 0 会得到 Infinity，整式被拉成一条色带）
      this.morphLatex().scale(0.96);
      // 首帧仍用透明度出现；后续步骤走官方 tex 变形，不再整式淡入淡出
      yield* all(
        this.morphLatex().opacity(1, duration * 0.6, easeOutCubic),
        this.morphLatex().scale(1, duration, easeOutCubic),
      );
      return;
    }

    if (!this.hasNext()) {
      return;
    }

    this.cursor += 1;
    yield* this.morphLatex().tex(
      composeStepTexParts(this.stepsData[this.cursor]),
      duration,
      easeInOutCubic,
    );
  }
}
