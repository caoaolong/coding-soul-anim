import { Circle, Layout, Line, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeOutCubic,
  linear,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";

const TIME_FONT = '"SimFang", FangSong, STFangsong, serif';
const BRIEF_FONT = '"SimFang", FangSong, STFangsong, KaiTi, STKaiti, serif';

export interface SimpleTimelineEvent {
  /** 时间文案，如 "1966" */
  time: string;
  /** 简介 */
  brief: string;
}

export interface SimpleTimelineProps extends NodeProps {
  /** 事件节点（按时间顺序） */
  events: SimpleTimelineEvent[];
  /** 节点间距，默认 420 */
  spacing?: number;
  /** 时间字号，默认 40 */
  timeFontSize?: number;
  /** 简介字号，默认 28 */
  briefFontSize?: number;
  /** 轴线条宽，默认 Ink.lineWidth */
  lineWidth?: number;
}

/**
 * 轻量横向时间轴：仅时间 + 简介。
 * 轨道自右向左平移，节点抵达屏心时聚焦高亮。
 */
export class SimpleTimeline extends Node {
  private readonly track = createRef<Layout>();
  private readonly dots = createRefArray<Circle>();
  private readonly timeTxts = createRefArray<Txt>();
  private readonly briefTxts = createRefArray<Txt>();
  private readonly nodeBlocks = createRefArray<Layout>();

  private readonly spacing: number;
  private readonly count: number;

  public constructor(props: SimpleTimelineProps) {
    const {
      events,
      spacing = 420,
      timeFontSize = 40,
      briefFontSize = 28,
      lineWidth = Ink.lineWidth,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!events || events.length === 0) {
      throw new Error("SimpleTimeline: events 不能为空");
    }

    this.spacing = spacing;
    this.count = events.length;
    // 轴线向两侧大幅延伸：任意平移位置下，屏内都看不到端点
    const span = (events.length - 1) * spacing;
    const axisPad = 6000;
    const axisStart = -axisPad;
    const axisEnd = span + axisPad;

    // 屏心聚焦指示：淡金竖线
    this.add(
      <Rect
        width={2}
        height={220}
        fill={Ink.gold}
        opacity={0.35}
        radius={1}
        shadowColor={Ink.gold}
        shadowBlur={12}
      />,
    );

    // 初始：第一个节点在右侧，随后轨道左移送入屏心
    this.add(
      <Layout ref={this.track} x={spacing}>
        <Line
          points={[
            [axisStart, 0],
            [axisEnd, 0],
          ]}
          stroke={Ink.line}
          lineWidth={lineWidth}
          lineCap={"round"}
          opacity={0.85}
        />
      </Layout>,
    );

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const x = i * spacing;
      const block = createRef<Layout>();
      const dot = createRef<Circle>();
      const time = createRef<Txt>();
      const brief = createRef<Txt>();

      this.track().add(
        <Layout ref={block} x={x} y={0}>
          <Circle
            ref={dot}
            size={18}
            fill={Ink.muted}
            stroke={Ink.line}
            lineWidth={2}
            y={0}
          />
          <Txt
            ref={time}
            text={ev.time}
            fontFamily={TIME_FONT}
            fontSize={timeFontSize}
            fill={Ink.paperSoft}
            y={-56}
            opacity={0.75}
          />
          <Txt
            ref={brief}
            text={ev.brief}
            fontFamily={BRIEF_FONT}
            fontSize={briefFontSize}
            fill={Ink.muted}
            y={58}
            textAlign={"center"}
            width={spacing * 0.85}
            opacity={0.7}
          />
        </Layout>,
      );

      this.nodeBlocks.push(block());
      this.dots.push(dot());
      this.timeTxts.push(time());
      this.briefTxts.push(brief());
    }
  }

  /**
   * 播放：轨道右→左匀速连续平移，节点过屏心时切换高亮（不停顿）。
   * @param stepDuration 相邻节点间距的平移时长
   */
  public *play(stepDuration: number = 0.85): ThreadGenerator {
    for (let i = 0; i < this.count; i++) {
      const targetX = -i * this.spacing;
      yield* all(
        this.track().x(targetX, stepDuration, linear),
        this.focus(i, Math.min(0.3, stepDuration * 0.35)),
      );
    }
  }

  /** 将指定下标节点设为聚焦，其余弱化 */
  public *focus(index: number, duration: number = 0.45): ThreadGenerator {
    if (index < 0 || index >= this.count) {
      throw new Error(
        `SimpleTimeline.focus: 下标 ${index} 越界（共 ${this.count} 个）`,
      );
    }

    const tasks: ThreadGenerator[] = [];
    for (let i = 0; i < this.count; i++) {
      const on = i === index;
      tasks.push(
        this.dots[i].size(on ? 28 : 16, duration, easeOutCubic),
        this.dots[i].fill(on ? Highlight.fill : Ink.muted, duration, easeOutCubic),
        this.dots[i].stroke(on ? Highlight.stroke : Ink.line, duration, easeOutCubic),
        this.dots[i].scale(on ? Highlight.scalePeak : 1, duration, easeOutCubic),
        this.timeTxts[i].fill(on ? Ink.goldBright : Ink.paperSoft, duration, easeOutCubic),
        this.timeTxts[i].opacity(on ? 1 : 0.55, duration, easeOutCubic),
        this.timeTxts[i].scale(on ? 1.12 : 1, duration, easeOutCubic),
        this.briefTxts[i].fill(on ? Ink.paper : Ink.muted, duration, easeOutCubic),
        this.briefTxts[i].opacity(on ? 1 : 0.45, duration, easeOutCubic),
        this.briefTxts[i].scale(on ? 1.06 : 1, duration, easeOutCubic),
        this.nodeBlocks[i].opacity(on ? 1 : 0.5, duration, easeOutCubic),
      );
    }

    yield* all(...tasks);
  }
}
