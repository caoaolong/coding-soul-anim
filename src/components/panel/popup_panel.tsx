import { Layout, Node, NodeProps, Rect } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";

export interface PopupPanelProps extends NodeProps {
  /** 内边距，默认 28 */
  padding?: number;
  /** 内容间距，默认 28 */
  gap?: number;
  /**
   * 面板底色。默认偏暖的抬升墨色，明显亮于场景 Ink.bg，
   * 避免与视频底融成一块。
   */
  fill?: string;
  /** 描边色，默认淡金 Ink.goldSoft */
  stroke?: string;
  /** 描边宽，默认 3（略粗于常规墨线） */
  lineWidth?: number;
  /** 下落距离（相对落点向上），默认 120 */
  dropDistance?: number;
}

/** 相对场景底抬升一档的面板色（比 Ink.deep / deepAlt 更亮） */
const PANEL_FILL = "#2E2C28";

/**
 * 临时浮层：带底色与边框，统一「自顶落下 → 收起消失」。
 * 子节点直接作为面板内容。
 */
export class PopupPanel extends Node {
  private readonly frame = createRef<Rect>();
  private readonly restY: number;
  private readonly dropDistance: number;

  public constructor(props: PopupPanelProps) {
    const {
      padding = 28,
      gap = 28,
      fill = PANEL_FILL,
      stroke = Ink.goldSoft,
      lineWidth = 3,
      dropDistance = 120,
      children,
      opacity = 0,
      ...nodeProps
    } = props;

    super({ opacity, ...nodeProps });

    this.dropDistance = dropDistance;
    this.restY = this.y();
    this.y(this.restY - dropDistance);

    this.add(
      <Rect
        ref={this.frame}
        layout
        direction={"column"}
        gap={gap}
        padding={padding}
        fill={fill}
        stroke={stroke}
        lineWidth={lineWidth}
        radius={0}
        alignItems={"center"}
        shadowColor={Ink.veil}
        shadowBlur={36}
        shadowOffsetY={10}
      >
        <Layout layout direction={"column"} gap={gap} alignItems={"center"}>
          {children}
        </Layout>
      </Rect>,
    );
  }

  /** 自顶落下显现 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.y(this.restY, duration, easeOutCubic),
    );
  }

  /** 向上收起并移除 */
  public *hide(duration = 0.45): ThreadGenerator {
    yield* all(
      this.opacity(0, duration, easeInCubic),
      this.y(this.restY - this.dropDistance, duration, easeInCubic),
    );
    this.remove();
  }

  /** 落下 → 停留 → 收起 */
  public *present(
    hold = 2,
    showDuration = 0.55,
    hideDuration = 0.45,
  ): ThreadGenerator {
    yield* this.show(showDuration);
    yield* waitFor(hold);
    yield* this.hide(hideDuration);
  }
}
