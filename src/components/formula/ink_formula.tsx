import { Latex, Layout, Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  BBox,
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushLine, inkFade, inkPulseTxt, inkReveal } from "../../theme/ink_anim";
import { Annotation } from "../annotation/annotation";

const PLAIN_FONT = '"SimFang", FangSong, STFangsong, serif';

export type FloatLitPart = "sign" | "int" | "frac";

export type LatexPiece = {
  tex: string;
  /** 可选键，供 annotateKey 方框圈选 */
  key?: string;
};

export interface InkFormulaProps extends NodeProps {
  /** 单行公式（LaTeX），如 `Index = \log_{2} Number` */
  tex: string;
  /** 字号，默认 44 */
  fontSize?: number;
  /** 公式颜色，默认 Ink.paper */
  fill?: string;
  /** 是否落笔添一条书写下划线，默认 true */
  underline?: boolean;
  /** 下划线颜色，默认 Ink.goldSoft */
  underlineStroke?: string;
}

/**
 * 水墨单行公式：以墨晕显现 + 下划线运笔「书写」出场，一横落笔即点题。
 * 亦支持 rewrite 切换为纯中文标题（仿宋），以及算式局部更新（只换变化的数字）。
 */
export class InkFormula extends Node {
  /** 主公式 + 右侧追加片段行 */
  private readonly latexRow = createRef<Layout>();
  private readonly latex = createRef<Latex>();
  private readonly latexExt = createRef<Layout>();
  private readonly latexKeys = new Map<string, Latex>();
  private readonly plain = createRef<Txt>();
  private readonly equation = createRef<Layout>();
  private readonly eqLeft = createRef<Txt>();
  private readonly eqPlus = createRef<Txt>();
  private readonly eqMid = createRef<Txt>();
  private readonly eqEq = createRef<Txt>();
  private readonly eqRight = createRef<Txt>();
  /** max(n_i)=2^i , i=log2{max(n_i)} 分段公式 */
  private readonly maxNi = createRef<Layout>();
  private readonly maxNiTerm = createRef<Latex>();
  private readonly maxNiPow = createRef<Latex>();
  private readonly maxNiI = createRef<Latex>();
  private readonly maxNiLog = createRef<Latex>();
  /** float f = ±整数.小数;（LaTeX 分段，可方框圈选） */
  private readonly floatLit = createRef<Layout>();
  private readonly floatLitSign = createRef<Latex>();
  private readonly floatLitInt = createRef<Latex>();
  private readonly floatLitFrac = createRef<Latex>();
  private readonly underline = createRef<Line>();
  private readonly annotation = createRef<Annotation>();

  private readonly fontSize: number;
  private readonly underlineEnabled: boolean;
  private readonly fillColor: string;
  private mode: "latex" | "plain" | "equation" | "maxNi" | "floatLit" =
    "latex";
  private eqParts = { left: "", mid: "", right: "", op: "+" };
  private maxNiIndex = -1;

  public constructor(props: InkFormulaProps) {
    const {
      tex,
      fontSize = 44,
      fill = Ink.paper,
      underline = true,
      underlineStroke = Ink.goldSoft,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.fontSize = fontSize;
    this.underlineEnabled = underline;
    this.fillColor = fill;

    this.add(
      <Layout
        ref={this.latexRow}
        layout
        direction={"row"}
        gap={4}
        alignItems={"center"}
        opacity={0}
      >
        <Latex
          ref={this.latex}
          tex={`{${tex}}`}
          fill={fill}
          fontSize={fontSize}
        />
        <Layout
          ref={this.latexExt}
          layout
          direction={"row"}
          gap={2}
          alignItems={"center"}
        />
      </Layout>,
    );
    this.add(
      <Txt
        ref={this.plain}
        text={""}
        fontFamily={PLAIN_FONT}
        fontSize={fontSize}
        fill={fill}
        opacity={0}
      />,
    );
    this.add(
      <Layout
        ref={this.equation}
        layout
        direction={"row"}
        gap={14}
        alignItems={"center"}
        opacity={0}
      >
        <Txt
          ref={this.eqLeft}
          text={""}
          fontFamily={PLAIN_FONT}
          fontSize={fontSize}
          fill={fill}
        />
        <Txt
          ref={this.eqPlus}
          text={"+"}
          fontFamily={PLAIN_FONT}
          fontSize={fontSize}
          fill={fill}
        />
        <Txt
          ref={this.eqMid}
          text={""}
          fontFamily={PLAIN_FONT}
          fontSize={fontSize}
          fill={fill}
        />
        <Txt
          ref={this.eqEq}
          text={"="}
          fontFamily={PLAIN_FONT}
          fontSize={fontSize}
          fill={fill}
        />
        <Txt
          ref={this.eqRight}
          text={""}
          fontFamily={PLAIN_FONT}
          fontSize={fontSize}
          fill={fill}
        />
      </Layout>,
    );
    this.add(
      <Layout
        ref={this.maxNi}
        layout
        direction={"row"}
        gap={8}
        alignItems={"center"}
        opacity={0}
      >
        <Latex
          ref={this.maxNiTerm}
          tex={"{\\max(n_{0})}"}
          fill={fill}
          fontSize={fontSize}
        />
        <Latex tex="{=}" fill={fill} fontSize={fontSize} />
        <Latex
          ref={this.maxNiPow}
          tex="{2^{0}}"
          fill={fill}
          fontSize={fontSize}
        />
        <Latex tex="{,}" fill={fill} fontSize={fontSize} />
        <Latex
          ref={this.maxNiI}
          tex="{0}"
          fill={fill}
          fontSize={fontSize}
        />
        <Latex tex="{=}" fill={fill} fontSize={fontSize} />
        <Latex
          ref={this.maxNiLog}
          tex={"{\\log_{2}\\max(n_{0})}"}
          fill={fill}
          fontSize={fontSize}
        />
      </Layout>,
    );
    this.add(
      <Layout
        ref={this.floatLit}
        layout
        direction={"row"}
        gap={2}
        alignItems={"center"}
        opacity={0}
      >
        <Latex
          tex={"{\\texttt{float\\ f\\ =\\ }}"}
          fill={fill}
          fontSize={fontSize}
        />
        <Latex
          ref={this.floatLitSign}
          tex={"{-}"}
          fill={fill}
          fontSize={fontSize}
        />
        <Latex
          ref={this.floatLitInt}
          tex={"{12}"}
          fill={fill}
          fontSize={fontSize}
        />
        <Latex tex="{.}" fill={fill} fontSize={fontSize} />
        <Latex
          ref={this.floatLitFrac}
          tex={"{75}"}
          fill={fill}
          fontSize={fontSize}
        />
        <Latex tex="{;}" fill={fill} fontSize={fontSize} />
      </Layout>,
    );
    this.add(
      <Line
        ref={this.underline}
        points={[
          [0, 0],
          [1, 0],
        ]}
        stroke={underlineStroke}
        lineWidth={Ink.lineWidth}
        lineCap={"round"}
        opacity={0}
      />,
    );
    this.add(<Annotation ref={this.annotation} zIndex={30} />);
  }

  private activeText(): Latex | Txt | Layout {
    if (this.mode === "plain") return this.plain();
    if (this.mode === "equation") return this.equation();
    if (this.mode === "maxNi") return this.maxNi();
    if (this.mode === "floatLit") return this.floatLit();
    return this.latexRow();
  }

  private hideInactive(): void {
    if (this.mode !== "latex") this.latexRow().opacity(0);
    if (this.mode !== "plain") this.plain().opacity(0);
    if (this.mode !== "equation") this.equation().opacity(0);
    if (this.mode !== "maxNi") this.maxNi().opacity(0);
    if (this.mode !== "floatLit") this.floatLit().opacity(0);
  }

  private clearLatexExt(): void {
    for (const child of [...this.latexExt().children()]) {
      child.remove();
    }
    this.latexKeys.clear();
  }

  /**
   * 书写出场：公式墨晕显现，随后下划线自左向右运笔。
   * 下划线位置按公式实测包围盒摆放（显现动画已播过若干帧，布局有效）。
   */
  public *write(duration = 0.6): ThreadGenerator {
    this.mode = "latex";
    this.hideInactive();
    this.clearLatexExt();
    yield* inkReveal(this.latexRow(), { duration });
    yield* this.writeUnderline(duration * 0.8);
  }

  /** 指定 LaTeX 后书写出场 */
  public *writeTex(content: string, duration = 0.55): ThreadGenerator {
    this.mode = "latex";
    this.hideInactive();
    this.clearLatexExt();
    this.latex().tex(`{${content}}`);
    this.latex().fill(this.fillColor);
    this.latexRow().opacity(0);
    this.underline().opacity(0);
    yield* inkReveal(this.latexRow(), { duration });
    yield* this.writeUnderline(duration * 0.7);
  }

  /**
   * 用官方 Latex.tex(…, duration) 补间切换整式。
   * 若新旧式用 {{…}} 标出相同片段，则共有片段会变形衔接，其余淡入/淡出。
   * 过渡期间隐藏底线，结束后重新运笔写出。
   */
  public *updateLatex(content: string, duration = 0.4): ThreadGenerator {
    if (this.mode !== "latex" || this.latexRow().opacity() < 0.05) {
      yield* this.writeTex(content, duration);
      return;
    }
    this.clearLatexExt();
    yield* this.runLatexTween(
      duration,
      this.latex().tex(`{${content}}`, duration, easeInOutCubic),
    );
  }

  /**
   * 在已有公式后追加片段：走官方 Latex SVG 补间（共有段保留，新段淡入）。
   * 过渡期间隐藏底线，结束后重新运笔写出。
   */
  public *appendLatex(suffix: string, duration = 0.85): ThreadGenerator {
    if (this.mode !== "latex" || this.latexRow().opacity() < 0.05) {
      yield* this.writeTex(suffix, duration);
      return;
    }
    const parts = this.latex().tex();
    yield* this.runLatexTween(
      duration,
      this.latex().tex([...parts, `\\;${suffix}`], duration, easeInOutCubic),
    );
  }

  /**
   * 在公式右侧追加若干独立 LaTeX 节点（可带 key，供方框圈选）。
   */
  public *appendLatexPieces(
    pieces: LatexPiece[],
    duration = 0.85,
  ): ThreadGenerator {
    if (this.mode !== "latex" || this.latexRow().opacity() < 0.05) {
      const joined = pieces.map((p) => p.tex).join(" ");
      yield* this.writeTex(joined, duration);
      return;
    }

    const created: Latex[] = [];
    for (const piece of pieces) {
      const node = (
        <Latex
          tex={`{\\;${piece.tex}}`}
          fill={this.fillColor}
          fontSize={this.fontSize}
          opacity={0}
        />
      ) as Latex;
      this.latexExt().add(node);
      if (piece.key) {
        this.latexKeys.set(piece.key, node);
      }
      created.push(node);
    }

    yield* waitFor(0);
    yield* this.runLatexTween(duration, inkReveal(created, {
      duration: duration * 0.7,
      fromY: 8,
    }));
  }

  /**
   * 对方框圈选带 key 的片段，并可在上方显示纯文字标注（如 M，无括号）。
   */
  public *annotateKey(
    key: string,
    options: {
      label?: string;
      duration?: number;
      color?: string;
    } = {},
  ): ThreadGenerator {
    const node = this.latexKeys.get(key);
    if (!node) return;

    const {
      label,
      duration = 1.0,
      color = Ink.seal,
    } = options;

    const tasks: ThreadGenerator[] = [
      this.annotation().focusBox(node, {
        style: "box",
        color,
        lineWidth: 2.5,
        padding: 5,
        radius: 0,
        duration,
      }),
    ];

    if (label) {
      const world = BBox.fromPoints(
        ...node.cacheBBox().transformCorners(node.localToWorld()),
      );
      const local = BBox.fromPoints(
        ...world.transformCorners(this.worldToLocal()),
      );
      const tag = (
        <Txt
          text={label}
          fontFamily={"SF Pro Text, Segoe UI, Microsoft YaHei, sans-serif"}
          fontSize={Math.round(this.fontSize * 0.9)}
          fill={color}
          x={local.center.x}
          y={local.top - Math.max(18, this.fontSize * 0.55)}
          opacity={0}
          zIndex={40}
        />
      ) as Txt;
      this.add(tag);
      tasks.push(
        (function* () {
          yield* tag.opacity(1, duration * 0.25, easeInOutCubic);
          yield* waitFor(duration * 0.5);
          yield* tag.opacity(0, duration * 0.25, easeInOutCubic);
          tag.remove();
        })(),
      );
    }

    yield* all(...tasks);
  }

  /** LaTeX 补间：先藏底线 → 播动画 → 再落笔重画底线 */
  private *runLatexTween(
    duration: number,
    tween: ThreadGenerator,
  ): ThreadGenerator {
    const restoreUnderline =
      this.underlineEnabled && this.underline().opacity() > 0.05;
    if (restoreUnderline) {
      yield* this.underline().opacity(
        0,
        Math.min(0.2, duration * 0.18),
        easeInOutCubic,
      );
    }
    yield* tween;
    this.latex().fill(this.fillColor);
    if (restoreUnderline) {
      yield* this.writeUnderline(
        Math.min(0.5, Math.max(0.28, duration * 0.35)),
      );
    } else {
      this.layoutUnderline();
    }
  }

  /** 以仿宋纯文本书写（如「伙伴系统」） */
  public *writePlain(text: string, duration = 0.55): ThreadGenerator {
    this.mode = "plain";
    this.hideInactive();
    this.plain().text(text);
    this.plain().fill(this.fillColor);
    this.plain().opacity(0);
    yield* inkReveal(this.plain(), { duration });
    yield* this.writeUnderline(duration * 0.7);
  }

  /**
   * 书写二元算式：`left op mid = right`（首行完整出场）。
   * @param op 运算符，如 `+` / `⊕`
   */
  public *writeEquation(
    left: string,
    mid: string,
    right: string,
    duration = 0.55,
    op = "+",
  ): ThreadGenerator {
    this.mode = "equation";
    this.hideInactive();
    this.setEquationParts(left, mid, right, op);
    this.underline().opacity(0);
    this.equation().opacity(0);
    yield* inkReveal(this.equation(), { duration });
    yield* this.writeUnderline(duration * 0.7);
  }

  /**
   * 局部更新算式：运算符与数字仅替换变化项并墨金脉冲提示。
   */
  public *updateEquation(
    left: string,
    mid: string,
    right: string,
    duration = 0.4,
    op?: string,
  ): ThreadGenerator {
    if (this.mode !== "equation") {
      yield* this.writeEquation(left, mid, right, duration, op ?? "+");
      return;
    }

    const nextOp = op ?? this.eqParts.op;
    const changed: Txt[] = [];
    if (left !== this.eqParts.left) {
      this.eqLeft().text(left);
      this.eqParts.left = left;
      changed.push(this.eqLeft());
    }
    if (mid !== this.eqParts.mid) {
      this.eqMid().text(mid);
      this.eqParts.mid = mid;
      changed.push(this.eqMid());
    }
    if (right !== this.eqParts.right) {
      this.eqRight().text(right);
      this.eqParts.right = right;
      changed.push(this.eqRight());
    }
    if (nextOp !== this.eqParts.op) {
      this.eqPlus().text(nextOp);
      this.eqParts.op = nextOp;
      changed.push(this.eqPlus());
    }

    // 宽度变化时静默贴齐下划线，不再整行淡入淡出
    this.layoutUnderline();

    if (changed.length === 0) {
      yield* waitFor(duration * 0.5);
      return;
    }

    yield* inkPulseTxt(changed, {
      color: Ink.seal,
      restore: this.fillColor,
      duration,
      scalePeak: 1,
    });
  }

  /**
   * 书写：`max(n_i)=2^i , i=log_2{max(n_i)}`（首行完整出场）。
   */
  public *writeMaxNi(i: number, duration = 0.55): ThreadGenerator {
    this.mode = "maxNi";
    this.hideInactive();
    this.setMaxNiParts(i);
    this.underline().opacity(0);
    this.maxNi().opacity(0);
    yield* inkReveal(this.maxNi(), { duration });
    yield* this.writeUnderline(duration * 0.7);
  }

  /**
   * 局部更新 max(n_i) 公式：仅替换含 i 的片段并脉冲。
   */
  public *updateMaxNi(i: number, duration = 0.4): ThreadGenerator {
    if (this.mode !== "maxNi") {
      yield* this.writeMaxNi(i, duration);
      return;
    }
    if (i === this.maxNiIndex) {
      yield* waitFor(duration * 0.5);
      return;
    }

    this.setMaxNiParts(i);
    this.layoutUnderline();
    yield* pulseLatexNodes(
      [
        this.maxNiTerm(),
        this.maxNiPow(),
        this.maxNiI(),
        this.maxNiLog(),
      ],
      duration,
      Ink.seal,
      this.fillColor,
    );
  }

  private setMaxNiParts(i: number): void {
    this.maxNiIndex = i;
    this.maxNiTerm().tex(`{\\max(n_{${i}})}`);
    this.maxNiPow().tex(`{2^{${i}}}`);
    this.maxNiI().tex(`{${i}}`);
    this.maxNiLog().tex(`{\\log_{2}\\max(n_{${i}})}`);
    this.maxNiTerm().fill(this.fillColor);
    this.maxNiPow().fill(this.fillColor);
    this.maxNiI().fill(this.fillColor);
    this.maxNiLog().fill(this.fillColor);
  }

  /**
   * 书写赋值行：`float f = ±整数.小数;`（LaTeX 分段）。
   */
  public *writeFloatAssign(
    value: number,
    duration = 0.9,
  ): ThreadGenerator {
    this.mode = "floatLit";
    this.hideInactive();
    this.setFloatLitParts(value);
    this.underline().opacity(0);
    this.floatLit().opacity(0);
    yield* inkReveal(this.floatLit(), { duration });
    yield* this.writeUnderline(duration * 0.7);
  }

  /**
   * 方框圈选浮点字面量片段：sign / int / frac。
   * 色相与 Float 的 S/E/M 呼应（朱砂 / 淡金 / 淡赭）。
   */
  public *highlightFloatPart(
    part: FloatLitPart,
    duration = 0.8,
  ): ThreadGenerator {
    if (this.mode !== "floatLit") return;
    const node =
      part === "sign"
        ? this.floatLitSign()
        : part === "int"
          ? this.floatLitInt()
          : this.floatLitFrac();
    const color =
      part === "sign"
        ? Ink.seal
        : part === "int"
          ? Ink.goldSoft
          : Ink.warn;
    yield* this.annotation().focusBox(node, {
      style: "box",
      color,
      lineWidth: 2.5,
      padding: 6,
      radius: 0,
      duration,
    });
  }

  private setFloatLitParts(value: number): void {
    const { sign, intPart, frac } = splitFloatLiteral(value);
    if (sign) {
      this.floatLitSign().tex(`{${sign}}`);
      this.floatLitSign().opacity(1);
    } else {
      this.floatLitSign().tex("{}");
      this.floatLitSign().opacity(0);
    }
    this.floatLitInt().tex(`{${intPart}}`);
    this.floatLitFrac().tex(`{${frac}}`);
    this.floatLitSign().fill(this.fillColor);
    this.floatLitInt().fill(this.fillColor);
    this.floatLitFrac().fill(this.fillColor);
  }

  private setEquationParts(
    left: string,
    mid: string,
    right: string,
    op: string,
  ): void {
    this.eqParts = { left, mid, right, op };
    this.eqLeft().text(left);
    this.eqPlus().text(op);
    this.eqMid().text(mid);
    this.eqRight().text(right);
    this.eqLeft().fill(this.fillColor);
    this.eqPlus().fill(this.fillColor);
    this.eqMid().fill(this.fillColor);
    this.eqEq().fill(this.fillColor);
    this.eqRight().fill(this.fillColor);
  }

  private *writeUnderline(duration: number): ThreadGenerator {
    if (!this.underlineEnabled) {
      return;
    }
    if (!this.layoutUnderline()) {
      return;
    }
    this.underline().opacity(1);
    yield* brushLine(this.underline(), { duration });
  }

  /**
   * 淡出后切换文案再书写：
   * - plain=true：中文/纯文本（仿宋）
   * - plain=false：LaTeX 公式
   */
  public *rewrite(
    content: string,
    duration = 0.55,
    plain = false,
  ): ThreadGenerator {
    yield* this.hide(duration * 0.45);
    this.underline().opacity(0);
    this.underline().points([
      [0, 0],
      [1, 0],
    ]);

    if (plain) {
      this.mode = "plain";
      this.hideInactive();
      this.plain().text(content);
      this.plain().fill(this.fillColor);
      this.plain().opacity(0);
      yield* inkReveal(this.plain(), { duration: duration * 0.55 });
    } else {
      this.mode = "latex";
      this.hideInactive();
      this.clearLatexExt();
      this.latex().tex(`{${content}}`);
      this.latex().fill(this.fillColor);
      this.latexRow().opacity(0);
      yield* inkReveal(this.latexRow(), { duration: duration * 0.55 });
    }

    if (!this.underlineEnabled) {
      return;
    }
    if (!this.layoutUnderline()) {
      return;
    }
    this.underline().opacity(1);
    yield* brushLine(this.underline(), { duration: duration * 0.5 });
  }

  /** 隐去：当前文案与下划线一并墨色淡出 */
  public *hide(duration = 0.35): ThreadGenerator {
    yield* inkFade([this.activeText(), this.underline()], { duration });
  }

  /** 公式在本组件本地坐标系下的包围盒；尚未布局时返回 null */
  private measureLocal(): BBox | null {
    const node = this.activeText();
    const cached = node.cacheBBox();
    if (cached.width < 1 || cached.height < 1) {
      return null;
    }
    const world = BBox.fromPoints(
      ...cached.transformCorners(node.localToWorld()),
    );
    return BBox.fromPoints(...world.transformCorners(this.worldToLocal()));
  }

  /** 按实测包围盒摆下划线（公式下方一小段间距） */
  private layoutUnderline(): boolean {
    const local = this.measureLocal();
    if (!local) {
      return false;
    }
    const y = local.bottom + Math.max(8, this.fontSize * 0.22);
    this.underline().points([
      [local.left, y],
      [local.right, y],
    ]);
    return true;
  }
}

/** Latex 片段脉冲：变色后复原（局部更新提示） */
function* pulseLatexNodes(
  nodes: Latex[],
  duration: number,
  color: string,
  restore: string,
): ThreadGenerator {
  const list = nodes.filter(Boolean);
  if (list.length === 0) return;
  const up = duration * 0.35;
  const down = duration * 0.65;
  yield* all(
    ...list.map((node) =>
      node.fill(color, up, easeInOutCubic).to(restore, down, easeInOutCubic),
    ),
  );
}

/** 拆成符号 / 整数 / 小数三段（默认两位小数） */
function splitFloatLiteral(value: number): {
  sign: string;
  intPart: string;
  frac: string;
} {
  const sign = value < 0 || Object.is(value, -0) ? "-" : "";
  const abs = Math.abs(value);
  const [intPart, frac = "0"] = abs.toFixed(2).split(".");
  return { sign, intPart, frac };
}
