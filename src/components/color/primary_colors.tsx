import { Circle, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRefArray,
  easeInOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';

export interface PrimaryColorsProps extends NodeProps {
  /** 圆半径，默认 168 */
  radius?: number;
  /** 圆心相对中心的偏移（越大重叠越少），默认 radius * 0.52 */
  offset?: number;
  /** 是否显示红/绿/蓝标签，默认 true */
  showLabels?: boolean;
  /** 标签字号，默认 28 */
  labelSize?: number;
}

/**
 * RGB 三原色叠圆：加色混合（lighter），三圆交叠处呈白。
 * 布局为上红、左下绿、右下蓝的等边三角。
 */
export class PrimaryColors extends Node {
  private readonly discs = createRefArray<Circle>();
  private readonly labels = createRefArray<Txt>();
  private readonly showLabels: boolean;

  public constructor(props: PrimaryColorsProps = {}) {
    const {
      radius = 168,
      offset = radius * 0.52,
      showLabels = true,
      labelSize = 28,
      ...nodeProps
    } = props;

    super(nodeProps);
    this.showLabels = showLabels;

    // 等边三角：上 / 左下 / 右下
    const positions: Array<{
      x: number;
      y: number;
      fill: string;
      text: string;
    }> = [
      { x: 0, y: -offset * 0.9, fill: "#FF1A1A", text: "红" },
      { x: -offset, y: offset * 0.55, fill: "#1AFF1A", text: "绿" },
      { x: offset, y: offset * 0.55, fill: "#1A66FF", text: "蓝" },
    ];

    for (const p of positions) {
      this.add(
        <Circle
          ref={this.discs}
          x={p.x}
          y={p.y}
          width={radius * 2}
          height={radius * 2}
          fill={p.fill}
          compositeOperation={"lighter"}
          opacity={0}
        />,
      );
    }

    if (showLabels) {
      const labelOffset = radius + 36;
      const labelPos = [
        { x: 0, y: -offset * 0.9 - labelOffset * 0.35 },
        { x: -offset - labelOffset * 0.55, y: offset * 0.55 + 8 },
        { x: offset + labelOffset * 0.55, y: offset * 0.55 + 8 },
      ];
      for (let i = 0; i < 3; i++) {
        this.add(
          <Txt
            ref={this.labels}
            text={positions[i].text}
            fontFamily={LABEL_FONT}
            fontSize={labelSize}
            fill={Ink.paper}
            x={labelPos[i].x}
            y={labelPos[i].y}
            opacity={0}
          />,
        );
      }
    }
  }

  /**
   * 三圆依次墨晕入场，交叠处显白。
   */
  public *play(stepDuration = 0.55, hold = 0.3): ThreadGenerator {
    for (let i = 0; i < this.discs.length; i++) {
      if (this.showLabels) {
        yield* all(
          inkReveal(this.discs[i], { duration: stepDuration, fromY: 10 }),
          inkReveal(this.labels[i], { duration: stepDuration, fromY: 8 }),
        );
      } else {
        yield* inkReveal(this.discs[i], {
          duration: stepDuration,
          fromY: 10,
        });
      }
      if (hold > 0 && i < this.discs.length - 1) {
        yield* waitFor(hold);
      }
    }
  }

  public *hide(duration = 0.4): ThreadGenerator {
    yield* inkFade([...this.discs, ...this.labels], { duration });
  }

  /** 整组向左滑出并淡出 */
  public *exitLeft(duration = 0.7, distance = 520): ThreadGenerator {
    const targetX = this.x() - distance;
    yield* all(
      this.x(targetX, duration, easeInOutCubic),
      this.opacity(0, duration, easeInOutCubic),
    );
  }
}
