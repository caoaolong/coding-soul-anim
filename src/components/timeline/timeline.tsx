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

const TITLE_FONT =
  '"SimFang", FangSong, STFangsong, KaiTi, STKaiti, serif';
const BODY_FONT =
  '"SimFang", FangSong, STFangsong, SF Pro Text, Microsoft YaHei, serif';

export interface TimelineNodeData {
  /** 轴上显示的时间文案，如 "2020.03" */
  time?: string;
  /** 详情笺标题 */
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
  /** 中央详情笺尺寸，默认 1400×780 */
  expandedSize?: Vector2;
  /** 画布宽（用于贴边布局，默认 1920） */
  canvasWidth?: number;
  /** 画布高（用于贴边布局，默认 1080） */
  canvasHeight?: number;
}

/** 水墨笺纸详情面板：可选左图右文 */
class InkPanel extends Rect {
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
      radius: Ink.radius,
      fill: Ink.deep,
      stroke: Ink.gold,
      lineWidth: 1.5,
      shadowColor: "rgba(0,0,0,0.35)",
      shadowBlur: 18,
      shadowOffsetY: 8,
      clip: true,
      ...rectProps,
    });

    // 顶栏：仿宋标题 + 底金线（无红绿灯）
    const titleBar = (
      <Layout
        layout
        width={"100%"}
        direction={"column"}
        gap={10}
        paddingTop={20}
        paddingBottom={4}
        paddingLeft={contentPadding}
        paddingRight={contentPadding}
      >
        <Txt
          text={title}
          fill={Ink.paper}
          fontSize={32}
          fontFamily={TITLE_FONT}
          fontWeight={400}
          width={"100%"}
          textAlign={"left"}
        />
        <Rect width={"100%"} height={2} fill={Ink.gold} radius={1} />
      </Layout>
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
            radius={Ink.radius}
            width={440}
            height={440}
            stroke={Ink.line}
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
            radius={Ink.radius}
            width={"100%"}
            height={"100%"}
            stroke={Ink.line}
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
    this.add(body);
  }
}

/**
 * 时间轴：轴无限延伸；非焦点仅显示时间+文本；聚焦时弹出水墨笺纸详情。
 */
export class Timeline extends Node {
  public readonly windows = createRefArray<InkPanel>();
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
    // 横向贴顶：避开底部字幕；纵向仍贴左
    const axisY = -canvasHeight / 2 + edgePad;
    const axisX = -canvasWidth / 2 + edgePad;

    // 焦点锚点对齐屏幕中轴：横向 x=0，纵向 y=0
    this.focusPoint =
      orientation === "horizontal"
        ? new Vector2(0, axisY)
        : new Vector2(axisX, 0);

    // 横向：标签挂在轴下方（轴在顶边，避免裁切）
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

        {/* 详情笺：初始隐藏，聚焦时再弹出 */}
        {nodes.map((node, i) => (
          <InkPanel
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
   * 滚动到下一个时间节点，并将其详情笺展开到屏幕中央。
   * 展开：先快后慢（easeOut）；收起：先慢后快（easeIn）。
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

    // 挂到 view：本地坐标原点 = 画布正中心
    // 横向轴在顶边，笺纸从轴下方飞入中心
    const start =
      this.orientation === "horizontal"
        ? new Vector2(0, this.focusPoint.y + 100)
        : new Vector2(this.focusPoint.x + 100, 0);

    win.reparent(view);
    win.offset([0, 0]);
    win.position(start);
    win.scale(0.4);
    win.size(this.expandedSize);

    // 弹出：先快后慢
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

    // 缩小：先慢后快
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
