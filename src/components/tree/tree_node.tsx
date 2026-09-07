import { Txt, Circle, CircleProps } from "@motion-canvas/2d";
import { SignalValue } from "@motion-canvas/core";

export interface TreeNodeProps extends CircleProps {
  title?: SignalValue<string>;
  size?: SignalValue<number>;
}

export class TreeNode extends Circle {
  public constructor(props?: TreeNodeProps) {
    super({
      layout: true,
      justifyContent: "center",
      alignItems: "center",
      size: props?.size ?? 120,
      fill: props?.fill ?? "#1D293B",
      stroke: props?.stroke ?? "#5C79A3",
      lineWidth: 4,
      ...props, // 透传底层 Circle 的属性
    });

    // 构建组件 UI 结构
    this.add(
      <Circle>
        <Txt
          text={props?.title ?? "Node"}
          fill={"#FFFFFF"}
          fontSize={32}
          fontWeight={700}
        />
      </Circle>,
    );
  }
}
