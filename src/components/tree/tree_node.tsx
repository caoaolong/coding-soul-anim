import { Txt, Circle, CircleProps } from "@motion-canvas/2d";
import {
  SignalValue,
  ThreadGenerator,
  createRef,
  easeOutCubic,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";

export interface TreeNodeProps extends CircleProps {
  title?: SignalValue<string>;
  size?: SignalValue<number>;
}

export class TreeNode extends Circle {
  private readonly label = createRef<Txt>();
  private readonly baseFontSize: number;

  public constructor(props?: TreeNodeProps) {
    const size = props?.size ?? 120;
    const sizeNum = typeof size === "number" ? size : 120;
    const baseFontSize = Math.round(sizeNum * 0.27);

    super({
      layout: true,
      justifyContent: "center",
      alignItems: "center",
      size,
      fill: props?.fill ?? Ink.deep,
      stroke: props?.stroke ?? Ink.line,
      lineWidth: Ink.lineWidth,
      ...props, // 透传底层 Circle 的属性
    });

    this.baseFontSize = baseFontSize;

    // 构建组件 UI 结构
    this.add(
      <Circle>
        <Txt
          ref={this.label}
          text={props?.title ?? "Node"}
          fill={Ink.paper}
          fontSize={baseFontSize}
          fontWeight={700}
        />
      </Circle>,
    );
  }

  /** 读取当前标题文本 */
  public titleText(): string {
    return this.label().text();
  }

  /**
   * 将标题改为指定文本（可带淡入）。
   * Index= 文案略缩小字号以免溢出。
   */
  public *setTitle(
    text: string,
    duration = 0.25,
  ): ThreadGenerator {
    const fontSize = text.startsWith("Index=")
      ? Math.round(this.baseFontSize * 0.82)
      : this.baseFontSize;

    if (duration <= 0) {
      this.label().text(text);
      this.label().fontSize(fontSize);
      this.label().opacity(1);
      return;
    }

    yield* this.label().opacity(0, duration * 0.4, easeOutCubic);
    this.label().text(text);
    this.label().fontSize(fontSize);
    yield* this.label().opacity(1, duration * 0.6, easeOutCubic);
  }
}
