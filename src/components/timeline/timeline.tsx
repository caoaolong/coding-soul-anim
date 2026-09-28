import {
  Circle,
  Img,
  Layout,
  Line,
  Node,
  NodeProps,
  Rect,
  RectProps,
  Txt,
} from "@motion-canvas/2d";
import {
  all,
  createRef,
  createRefArray,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  Vector2,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";

const TITLE_FONT = Ink.font;
const BODY_FONT = Ink.font;

/** macOS 窗口色 */
const MAC = {
  chrome: "#2C2C2E",
  titleBar: "#3A3A3C",
  border: "#48484A",
  trafficClose: "#FF5F57",
  trafficMin: "#FEBC2E",
  trafficMax: "#28C840",
  trafficBorder: "rgba(0,0,0,0.25)",
} as const;

export interface TimelineNodeData {
  /** 轴上显示的时间文案，如 "2020.03" */
  time?: string;
  /** 详情窗口标题 */
  title?: string;
  /** 轴上摘要；若未提供 detail，详情正文也用它 */
  text?: string;
  /** 详情正文（有图时显示在图旁）；优先于 text */
  detail?: string;
  /** 详情图片（仅聚焦时显示） */
  image?: string;
}

export interface TimelineProps extends NodeProps {
  nodes: TimelineNodeData[];
  /** 显示方向，默认横向 */
  orientation?: "horizontal" | "vertical";
  /** 节点间距 */
  spacing?: number;
  /** 中央详情窗口尺寸，默认 1400×780 */
  expandedSize?: Vector2;
  /** 画布宽（用于贴边布局，默认 1920） */
  canvasWidth?: number;
  /** 画布高（用于贴边布局，默认 1080） */
  canvasHeight?: number;
}

/** macOS 风格详情窗口：红绿灯标题栏 + 内容区 */
class MacWindowPanel extends Rect {
  public constructor(
    props: RectProps & {
      title?: string;
      text?: string;
      image?: string;
      contentPadding?: number;
    },
  ) {
    const {
      title = "",
      text,
      image,
      contentPadding = 28,
      ...rectProps
    } = props;

    super({
      layout: true,
      direction: "column",
      radius: 12,
      fill: MAC.chrome,
      stroke: MAC.border,
      lineWidth: 1,
      shadowColor: "rgba(0,0,0,0.55)",
      shadowBlur: 28,
      shadowOffsetY: 14,
      clip: true,
      ...rectProps,
    });

    // 标题栏：左红绿灯 + 居中标题（右侧等宽占位）
    const titleBar = (
      <Rect
        layout
        width={"100%"}
        height={44}
        direction={"row"}
        alignItems={"center"}
        fill={MAC.titleBar}
        paddingLeft={16}
        paddingRight={16}
        gap={12}
      >
        <Layout layout direction={"row"} gap={8} alignItems={"center"}>
          <Circle
            size={12}
            fill={MAC.trafficClose}
            stroke={MAC.trafficBorder}
            lineWidth={1}
          />
          <Circle
            size={12}
            fill={MAC.trafficMin}
            stroke={MAC.trafficBorder}
            lineWidth={1}
          />
          <Circle
            size={12}
            fill={MAC.trafficMax}
            stroke={MAC.trafficBorder}
            lineWidth={1}
          />
        </Layout>
        <Txt
          text={title}
          fill={Ink.paperSoft}
          fontSize={18}
          fontFamily={TITLE_FONT}
          fontWeight={500}
          textAlign={"center"}
          grow={1}
        />
        <Layout width={52} height={12} />
      </Rect>
    );

    const hasImage = Boolean(image);
    const hasText = Boolean(text);

    let body: Node;
    if (hasImage && hasText) {
      body = (
        <Layout
          layout
          width={"100%"}
          height={"100%"}
          grow={1}
          direction={"row"}
          gap={28}
          padding={contentPadding}
          alignItems={"center"}
        >
          <Img
            src={image!}
            radius={8}
            width={440}
            height={440}
            stroke={MAC.border}
            lineWidth={1}
          />
          <Txt
            text={text!}
            fill={Ink.paper}
            fontSize={28}
            fontFamily={BODY_FONT}
            lineHeight={44}
            textWrap
            grow={1}
            textAlign={"left"}
          />
        </Layout>
      );
    } else if (hasImage) {
      body = (
        <Layout
          layout
          width={"100%"}
          height={"100%"}
          grow={1}
          padding={contentPadding}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Img
            src={image!}
            radius={8}
            width={"100%"}
            height={"100%"}
            stroke={MAC.border}
            lineWidth={1}
          />
        </Layout>
      );
    } else {
      body = (
        <Layout
          layout
          width={"100%"}
          height={"100%"}
          grow={1}
          padding={contentPadding}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Txt
            text={text ?? ""}
            fill={Ink.paper}
            fontSize={26}
            fontFamily={BODY_FONT}
            lineHeight={40}
            textWrap
            width={"100%"}
            textAlign={"left"}
          />
        </Layout>
      );
    }

    this.add(titleBar);
    this.add(<Rect width={"100%"} height={1} fill={MAC.border} />);
    this.add(body);
  }
}

/**
 * 时间轴：轴无限延伸；非焦点仅显示时间+文本；聚焦时弹出 macOS 风格详情窗口。
 */
export class Timeline extends Node {
  public readonly windows = createRefArray<MacWindowPanel>();
  public readonly dots = createRefArray<Circle>();
  public readonly labels = createRefArray<Layout>();

  private readonly track = createRef<Node>();
  private readonly orientation: "horizontal" | "vertical";
  private readonly spacing: number;
  private readonly expandedSize: Vector2;
  private readonly slotPositions: Vector2[] = [];
  private readonly anchorPositions: Vector2[] = [];
  private readonly focusPoint: Vector2;
  /** 轴上标签对接点：横向底边中点，纵向左边中点 */
  private readonly slotOffset: Vector2;
  private readonly labelGap: number;

  /** 当前聚焦节点下标，-1 表示尚未聚焦 */
  private index = -1;

  public constructor(props: TimelineProps) {
    const {
      nodes,
      orientation = "horizontal",
      spacing,
      expandedSize,
      canvasWidth = 1920,
      canvasHeight = 1080,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.orientation = orientation;
    this.expandedSize = expandedSize ?? new Vector2(1400, 780);
    this.labelGap = 20;
    this.spacing = spacing ?? (orientation === "horizontal" ? 320 : 220);

    const edgePad = 48;
    const axisY = -canvasHeight / 2 + edgePad;
    const axisX = -canvasWidth / 2 + edgePad;

    this.focusPoint =
      orientation === "horizontal"
        ? new Vector2(0, axisY)
        : new Vector2(axisX, 0);

    this.slotOffset =
      orientation === "horizontal" ? new Vector2(0, -1) : new Vector2(-1, 0);

    const count = nodes.length;

    for (let i = 0; i < count; i++) {
      if (orientation === "horizontal") {
        this.anchorPositions.push(new Vector2(i * this.spacing, 0));
        this.slotPositions.push(new Vector2(i * this.spacing, this.labelGap));
      } else {
        this.anchorPositions.push(new Vector2(0, i * this.spacing));
        this.slotPositions.push(new Vector2(this.labelGap, i * this.spacing));
      }
    }

    const trackOrigin = this.focusPoint.sub(
      this.anchorPositions[0] ?? new Vector2(0, 0),
    );

    const axisExtend = Math.max(canvasWidth, canvasHeight) * 2.5;
    const lastAnchor = (count - 1) * this.spacing;

    this.add(
      <Node ref={this.track} position={trackOrigin}>
        {count > 0 && (
          <Line
            points={
              orientation === "horizontal"
                ? [
                    [-axisExtend, 0],
                    [lastAnchor + axisExtend, 0],
                  ]
                : [
                    [0, -axisExtend],
                    [0, lastAnchor + axisExtend],
                  ]
            }
            stroke={Ink.blue}
            lineWidth={3}
            lineCap={"butt"}
            zIndex={0}
          />
        )}

        {nodes.map((_, i) => (
          <Circle
            ref={this.dots}
            position={this.anchorPositions[i]}
            size={16}
            fill={Ink.muted}
            stroke={Ink.blue}
            lineWidth={2}
            zIndex={1}
          />
        ))}

        {nodes.map((node, i) => (
          <Layout
            ref={this.labels}
            layout
            direction={"column"}
            gap={6}
            offset={this.slotOffset}
            position={this.slotPositions[i]}
            alignItems={orientation === "horizontal" ? "center" : "start"}
            zIndex={2}
          >
            <Txt
              text={node.time ?? node.title ?? ""}
              fill={Ink.paper}
              fontSize={22}
              fontWeight={700}
              fontFamily={Ink.font}
            />
            <Txt
              text={node.text ?? ""}
              fill={Ink.paperSoft}
              fontSize={16}
              fontFamily={Ink.font}
              textAlign={orientation === "horizontal" ? "center" : "left"}
              width={orientation === "horizontal" ? 260 : 280}
              textWrap
            />
          </Layout>
        ))}

        {nodes.map((node, i) => (
          <MacWindowPanel
            ref={this.windows}
            offset={this.slotOffset}
            position={this.slotPositions[i]}
            width={this.expandedSize.x * 0.35}
            height={this.expandedSize.y * 0.35}
            scale={0}
            opacity={0}
            title={node.title ?? node.time ?? ""}
            text={node.detail ?? node.text}
            image={node.image}
            zIndex={3}
          />
        ))}
      </Node>,
    );
  }

  /**
   * 滚动到下一个时间节点，并将其详情窗口展开到屏幕中央。
   */
  public *next(duration = 1.6): ThreadGenerator {
    const count = this.windows.length;
    if (count === 0) {
      return;
    }

    const nextIndex = this.index + 1;
    if (nextIndex >= count) {
      return;
    }

    const collapseDur = this.index >= 0 ? duration * 0.3 : 0;
    const scrollDur = duration * (this.index >= 0 ? 0.35 : 0.45);
    const expandDur = duration * (this.index >= 0 ? 0.35 : 0.55);

    if (this.index >= 0) {
      yield* this.collapseFocused(collapseDur);
    }

    yield* this.scrollToIndex(nextIndex, scrollDur);
    yield* this.expandIndex(nextIndex, expandDur);
    this.index = nextIndex;
  }

  private trackOffsetForIndex(index: number): Vector2 {
    return this.focusPoint.sub(this.anchorPositions[index]);
  }

  private *scrollToIndex(index: number, duration: number): ThreadGenerator {
    const highlightDur = Math.max(duration * 0.5, 0.15);
    yield* all(
      this.track().position(
        this.trackOffsetForIndex(index),
        duration,
        easeInOutCubic,
      ),
      ...this.dots.map((dot, i) =>
        all(
          dot.fill(i === index ? Highlight.fill : Highlight.muted, highlightDur),
          dot.size(i === index ? 22 : 16, highlightDur),
        ),
      ),
    );
  }

  private *expandIndex(index: number, duration: number): ThreadGenerator {
    const win = this.windows[index];
    const label = this.labels[index];
    const view = this.view();

    const start =
      this.orientation === "horizontal"
        ? new Vector2(0, this.focusPoint.y + 100)
        : new Vector2(this.focusPoint.x + 100, 0);

    win.reparent(view);
    win.offset([0, 0]);
    win.position(start);
    win.scale(0.4);
    win.size(this.expandedSize);

    yield* all(
      label.opacity(0, duration * 0.35, easeOutCubic),
      win.opacity(1, duration * 0.3, easeOutCubic),
      win.scale(1, duration, easeOutCubic),
      win.position([0, 0], duration, easeOutCubic),
    );
  }

  private *collapseFocused(duration: number): ThreadGenerator {
    const index = this.index;
    const win = this.windows[index];
    const label = this.labels[index];
    const slot = this.slotPositions[index];

    const end =
      this.orientation === "horizontal"
        ? new Vector2(0, this.focusPoint.y + 100)
        : new Vector2(this.focusPoint.x + 100, 0);

    yield* all(
      win.position(end, duration, easeInCubic),
      win.scale(0.4, duration, easeInCubic),
      win.opacity(0, duration * 0.75, easeInCubic),
      label.opacity(1, duration, easeInCubic),
    );

    win.reparent(this.track());
    win.offset(this.slotOffset);
    win.position(slot);
    win.scale(0);
    win.size(
      new Vector2(this.expandedSize.x * 0.35, this.expandedSize.y * 0.35),
    );
  }
}
