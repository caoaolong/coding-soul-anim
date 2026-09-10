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
  easeInOutCubic,
  ThreadGenerator,
  Vector2,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";

export interface TimelineNodeData {
  /** 轴上显示的时间文案，如 "2020.03" */
  time?: string;
  /** macOS 标题栏文字（聚焦详情窗） */
  title?: string;
  /** 轴上摘要 / 详情正文 */
  text?: string;
  /** 详情窗图片（仅聚焦时显示） */
  image?: string;
}

export interface TimelineProps extends NodeProps {
  nodes: TimelineNodeData[];
  /** 显示方向，默认横向 */
  orientation?: "horizontal" | "vertical";
  /** 节点间距 */
  spacing?: number;
  /** 中央详情窗尺寸 */
  expandedSize?: Vector2;
  /** 画布宽（用于贴边布局，默认 1920） */
  canvasWidth?: number;
  /** 画布高（用于贴边布局，默认 1080） */
  canvasHeight?: number;
}

/** macOS 深色风格详情窗口：可选左图右文 */
class MacOSWindow extends Rect {
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
      contentPadding = 12,
      ...rectProps
    } = props;

    super({
      layout: true,
      direction: "column",
      radius: 12,
      fill: Ink.deep,
      stroke: Ink.line,
      lineWidth: 1,
      shadowColor: "rgba(0,0,0,0.55)",
      shadowBlur: 28,
      shadowOffsetY: 12,
      clip: true,
      ...rectProps,
    });

    const titleBar = (
      <Rect
        layout
        width={"100%"}
        height={32}
        fill={Ink.veil}
        paddingLeft={12}
        paddingRight={12}
        alignItems={"center"}
        gap={8}
      >
        <Layout layout direction={"row"} gap={7} alignItems={"center"}>
          <Circle size={10} fill={Ink.muted} stroke={Ink.line} lineWidth={1} />
          <Circle size={10} fill={Ink.gold} stroke={Ink.goldSoft} lineWidth={1} />
          <Circle size={10} fill={Ink.muted} stroke={Ink.line} lineWidth={1} />
        </Layout>
        <Txt
          text={title}
          fill={Ink.paper}
          fontSize={14}
          fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
          fontWeight={500}
          grow={1}
          textAlign={"center"}
        />
        {/* 右侧占位，让标题视觉居中 */}
        <Layout width={44} height={10} />
      </Rect>
    );

    const hasImage = Boolean(image);
    const hasText = Boolean(text);
    const bodyTextColor = Ink.paper;

    let body: Node;
    if (hasImage && hasText) {
      body = (
        <Layout
          layout
          width={"100%"}
          height={"100%"}
          grow={1}
          direction={"row"}
          gap={12}
          padding={contentPadding}
          alignItems={"center"}
        >
          <Img src={image!} radius={6} width={160} height={160} />
          <Txt
            text={text!}
            fill={bodyTextColor}
            fontSize={22}
            fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
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
          <Img src={image!} radius={6} width={"100%"} height={"100%"} />
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
            fill={bodyTextColor}
            fontSize={22}
            fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
            textWrap
            width={"100%"}
            textAlign={"left"}
          />
        </Layout>
      );
    }

    this.add(titleBar);
    this.add(body);
  }
}

/**
 * 时间轴：轴无限延伸；非焦点仅显示时间+文本；聚焦时弹出 macOS 详情窗。
 */
export class Timeline extends Node {
  public readonly windows = createRefArray<MacOSWindow>();
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
    this.expandedSize = expandedSize ?? new Vector2(720, 400);
    this.labelGap = 20;
    this.spacing = spacing ?? (orientation === "horizontal" ? 320 : 220);

    const edgePad = 48;
    const axisY = canvasHeight / 2 - edgePad;
    const axisX = -canvasWidth / 2 + edgePad;

    // 焦点锚点对齐屏幕中轴：横向 x=0，纵向 y=0
    this.focusPoint =
      orientation === "horizontal"
        ? new Vector2(0, axisY)
        : new Vector2(axisX, 0);

    this.slotOffset =
      orientation === "horizontal" ? new Vector2(0, 1) : new Vector2(-1, 0);

    const count = nodes.length;

    for (let i = 0; i < count; i++) {
      if (orientation === "horizontal") {
        this.anchorPositions.push(new Vector2(i * this.spacing, 0));
        this.slotPositions.push(new Vector2(i * this.spacing, -this.labelGap));
      } else {
        this.anchorPositions.push(new Vector2(0, i * this.spacing));
        this.slotPositions.push(new Vector2(this.labelGap, i * this.spacing));
      }
    }

    const trackOrigin = this.focusPoint.sub(
      this.anchorPositions[0] ?? new Vector2(0, 0),
    );

    // 轴线向两侧大幅延伸，端点落在画布外，形成无限长度观感
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
            stroke={Ink.line}
            lineWidth={4}
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
            stroke={Ink.paperSoft}
            lineWidth={3}
            zIndex={1}
          />
        ))}

        {/* 非焦点：仅时间 + 文本 */}
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
              fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
            />
            <Txt
              text={node.text ?? ""}
              fill={Ink.paperSoft}
              fontSize={16}
              fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
              textAlign={orientation === "horizontal" ? "center" : "left"}
              width={orientation === "horizontal" ? 260 : 280}
              textWrap
            />
          </Layout>
        ))}

        {/* 详情窗：初始隐藏，聚焦时再弹出 */}
        {nodes.map((node, i) => (
          <MacOSWindow
            ref={this.windows}
            offset={this.slotOffset}
            position={this.slotPositions[i]}
            width={this.expandedSize.x * 0.35}
            height={this.expandedSize.y * 0.35}
            scale={0}
            opacity={0}
            title={node.title ?? node.time ?? ""}
            text={node.text}
            image={node.image}
            zIndex={3}
          />
        ))}
      </Node>,
    );
  }

  /**
   * 滚动到下一个时间节点，并将其详情窗展开到屏幕中央。
   */
  public *next(duration = 0.8): ThreadGenerator {
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

    // 挂到 view：本地坐标原点 = 画布正中心
    const start =
      this.orientation === "horizontal"
        ? new Vector2(0, this.focusPoint.y - 100)
        : new Vector2(this.focusPoint.x + 100, 0);

    win.reparent(view);
    win.offset([0, 0]);
    win.position(start);
    win.scale(0.4);
    win.size(this.expandedSize);

    yield* all(
      label.opacity(0, duration * 0.35, easeInOutCubic),
      win.opacity(1, duration * 0.3, easeInOutCubic),
      win.scale(1, duration, easeInOutCubic),
      win.position([0, 0], duration, easeInOutCubic),
    );
  }

  private *collapseFocused(duration: number): ThreadGenerator {
    const index = this.index;
    const win = this.windows[index];
    const label = this.labels[index];
    const slot = this.slotPositions[index];

    const end =
      this.orientation === "horizontal"
        ? new Vector2(0, this.focusPoint.y - 100)
        : new Vector2(this.focusPoint.x + 100, 0);

    yield* all(
      win.position(end, duration, easeInOutCubic),
      win.scale(0.4, duration, easeInOutCubic),
      win.opacity(0, duration * 0.75, easeInOutCubic),
      label.opacity(1, duration, easeInOutCubic),
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
