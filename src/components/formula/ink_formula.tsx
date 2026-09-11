import { Latex, Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import { BBox, ThreadGenerator, createRef } from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushLine, inkFade, inkReveal } from "../../theme/ink_anim";

const PLAIN_FONT = '"SimFang", FangSong, STFangsong, serif';

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
 * 亦支持 rewrite 切换为纯中文标题（仿宋）。
 */
export class InkFormula extends Node {
  private readonly latex = createRef<Latex>();
  private readonly plain = createRef<Txt>();
  private readonly underline = createRef<Line>();

  private readonly fontSize: number;
  private readonly underlineEnabled: boolean;
  private readonly fillColor: string;
  private mode: "latex" | "plain" = "latex";

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
      <Latex
        ref={this.latex}
        tex={`{${tex}}`}
        fill={fill}
        fontSize={fontSize}
        opacity={0}
      />,
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
  }

  private activeText(): Latex | Txt {
    return this.mode === "plain" ? this.plain() : this.latex();
  }

  /**
   * 书写出场：公式墨晕显现，随后下划线自左向右运笔。
   * 下划线位置按公式实测包围盒摆放（显现动画已播过若干帧，布局有效）。
   */
  public *write(duration = 0.6): ThreadGenerator {
    this.mode = "latex";
    this.plain().opacity(0);
    yield* inkReveal(this.latex(), { duration });
    yield* this.writeUnderline(duration * 0.8);
  }

  /** 以仿宋纯文本书写（如「伙伴系统」） */
  public *writePlain(text: string, duration = 0.55): ThreadGenerator {
    this.mode = "plain";
    this.latex().opacity(0);
    this.plain().text(text);
    this.plain().fill(this.fillColor);
    this.plain().opacity(0);
    yield* inkReveal(this.plain(), { duration });
    yield* this.writeUnderline(duration * 0.7);
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
      this.latex().opacity(0);
      this.plain().text(content);
      this.plain().fill(this.fillColor);
      this.plain().opacity(0);
      yield* inkReveal(this.plain(), { duration: duration * 0.55 });
    } else {
      this.mode = "latex";
      this.plain().opacity(0);
      this.latex().tex(`{${content}}`);
      this.latex().opacity(0);
      yield* inkReveal(this.latex(), { duration: duration * 0.55 });
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
