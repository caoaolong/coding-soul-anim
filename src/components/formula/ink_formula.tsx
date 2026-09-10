import { Latex, Line, Node, NodeProps } from "@motion-canvas/2d";
import { BBox, ThreadGenerator, createRef } from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushLine, inkFade, inkReveal } from "../../theme/ink_anim";

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
 */
export class InkFormula extends Node {
  private readonly latex = createRef<Latex>();
  private readonly underline = createRef<Line>();

  private readonly fontSize: number;
  private readonly underlineEnabled: boolean;

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

  /**
   * 书写出场：公式墨晕显现，随后下划线自左向右运笔。
   * 下划线位置按公式实测包围盒摆放（显现动画已播过若干帧，布局有效）。
   */
  public *write(duration = 0.6): ThreadGenerator {
    yield* inkReveal(this.latex(), { duration });
    if (!this.underlineEnabled) {
      return;
    }
    if (!this.layoutUnderline()) {
      return;
    }
    this.underline().opacity(1);
    yield* brushLine(this.underline(), { duration: duration * 0.8 });
  }

  /** 隐去：公式与下划线一并墨色淡出 */
  public *hide(duration = 0.35): ThreadGenerator {
    yield* inkFade([this.latex(), this.underline()], { duration });
  }

  /** 公式在本组件本地坐标系下的包围盒；尚未布局时返回 null */
  private measureLocal(): BBox | null {
    const latex = this.latex();
    const cached = latex.cacheBBox();
    if (cached.width < 1 || cached.height < 1) {
      return null;
    }
    const world = BBox.fromPoints(
      ...cached.transformCorners(latex.localToWorld()),
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
