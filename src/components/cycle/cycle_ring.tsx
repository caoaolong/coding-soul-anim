import { Circle, Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  sequence,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushLine, inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';

export interface CycleRingProps extends NodeProps {
  /** 圆心核心主题文案（仅配底部运笔线，无外框） */
  theme: string;
  /** 环形节点文案（决定节点数 N） */
  labels: string[];
  /** 环半径（圆心到节点中心），默认 220 */
  radius?: number;
  /** 节点直径，默认 72 */
  nodeSize?: number;
  /** 箭头大小，默认 12 */
  arrowSize?: number;
  /** 起始角（度，0=右，-90=顶），默认 -90 */
  startAngle?: number;
  /** 主题字号，默认 40 */
  themeSize?: number;
}

/**
 * 环形循环：圆心主题 + 周围节点弧线箭头。
 * 出场：主题 → 环上节点/连线 → 依次高亮 → 整环旋转（主题固定在圆心）。
 */
export class CycleRing extends Node {
  private readonly themeRoot = createRef<Node>();
  private readonly themeTxt = createRef<Txt>();
  private readonly themeLine = createRef<Line>();
  private readonly rotor = createRef<Node>();
  private readonly nodesLayer = createRef<Node>();
  private readonly arcsLayer = createRef<Node>();
  private readonly slots = createRefArray<Node>();
  private readonly nodes = createRefArray<Circle>();
  private readonly labels = createRefArray<Txt>();
  private readonly arcs = createRefArray<Circle>();

  private readonly count: number;
  private readonly themeFontSize: number;

  public constructor(props: CycleRingProps) {
    const {
      theme,
      labels,
      radius = 220,
      nodeSize = 72,
      arrowSize = 12,
      startAngle = -90,
      themeSize = 40,
      ...nodeProps
    } = props;

    super(nodeProps);

    const list = labels.filter((s) => s.length > 0);
    if (list.length < 2) {
      throw new Error("CycleRing: labels 至少需要 2 个节点");
    }

    this.count = list.length;
    this.themeFontSize = themeSize;
    const fontSize = Math.max(18, Math.round(nodeSize * 0.32));
    const startRad = (startAngle * Math.PI) / 180;
    const step = (Math.PI * 2) / this.count;
    const stepDeg = 360 / this.count;

    const nodeRadius = nodeSize / 2;
    const ratio = Math.min(0.92, nodeRadius / radius);
    const arcInset =
      radius * Math.asin(ratio) + Math.max(6, arrowSize * 0.35);

    // 圆心主题：固定不随环旋转；仅文字 + 底线
    this.add(
      <Node ref={this.themeRoot} opacity={0}>
        <Txt
          ref={this.themeTxt}
          text={theme}
          fontFamily={LABEL_FONT}
          fontSize={themeSize}
          fontWeight={600}
          fill={Ink.paper}
        />
        <Line
          ref={this.themeLine}
          points={[
            [0, 0],
            [1, 0],
          ]}
          stroke={Ink.seal}
          lineWidth={3}
          lineCap={"round"}
          end={0}
          opacity={0}
        />
      </Node>,
    );

    this.add(<Node ref={this.rotor} />);
    // 节点与弧线分层：先显节点，高亮后再显箭头
    this.rotor().add(<Node ref={this.nodesLayer} opacity={0} />);
    this.rotor().add(<Node ref={this.arcsLayer} opacity={0} />);

    // 周围节点
    for (let i = 0; i < this.count; i++) {
      const a = startRad + i * step;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      this.nodesLayer().add(
        <Node ref={this.slots} x={x} y={y}>
          <Circle
            ref={this.nodes}
            width={nodeSize}
            height={nodeSize}
            fill={Ink.deep}
            stroke={Ink.gold}
            lineWidth={Ink.lineWidth}
          />
          <Txt
            ref={this.labels}
            text={list[i]}
            fontFamily={LABEL_FONT}
            fontSize={fontSize}
            fontWeight={600}
            fill={Ink.paper}
          />
        </Node>,
      );
    }

    // 圆环弧 + 末端箭头（初始 end=0，出场时运笔展开）
    for (let i = 0; i < this.count; i++) {
      const a0 = startAngle + i * stepDeg;
      const a1 = a0 + stepDeg;
      this.arcsLayer().add(
        <Circle
          ref={this.arcs}
          width={radius * 2}
          height={radius * 2}
          fill={null}
          stroke={Ink.goldSoft}
          lineWidth={Ink.lineWidth}
          startAngle={a0}
          endAngle={a1}
          closed={false}
          startOffset={arcInset}
          endOffset={arcInset}
          end={0}
          endArrow
          arrowSize={arrowSize}
          lineCap={"round"}
        />,
      );
    }
  }

  public get nodeCount(): number {
    return this.count;
  }

  /** 圆心主题：文字墨晕 + 底部朱砂运笔线（无外框） */
  public *showTheme(duration = 0.65): ThreadGenerator {
    yield* inkReveal(this.themeRoot(), { duration: duration * 0.55, fromY: 8 });
    this.layoutThemeUnderline();
    this.themeLine().opacity(1);
    yield* brushLine(this.themeLine(), { duration: duration * 0.55 });
  }

  /** 显现周围节点（尚无箭头） */
  public *showNodes(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this.nodesLayer(), { duration, fromY: 0 });
  }

  /** 运笔展开圆环弧与箭头 */
  public *showArrows(duration = 0.7): ThreadGenerator {
    this.arcsLayer().opacity(1);
    yield* all(
      ...this.arcs.map((arc) =>
        arc.end(1, duration, easeOutCubic),
      ),
    );
  }

  /** 依次高亮所有周围节点 */
  public *highlightAll(
    eachDuration = 0.45,
    gap = 0.08,
  ): ThreadGenerator {
    yield* sequence(
      gap,
      ...Array.from({ length: this.count }, (_, i) =>
        this.highlight(i, eachDuration),
      ),
    );
  }

  /**
   * 整环绕圆心旋转；节点槽反向旋转，标签保持正向；主题不动。
   */
  public *spin(
    turns = 1,
    duration = 1.4,
  ): ThreadGenerator {
    const delta = turns * 360;
    const rotor = this.rotor();
    const tasks: ThreadGenerator[] = [
      rotor.rotation(rotor.rotation() + delta, duration, easeInOutCubic),
    ];
    for (const slot of this.slots) {
      tasks.push(
        slot.rotation(slot.rotation() - delta, duration, easeInOutCubic),
      );
    }
    yield* all(...tasks);
  }

  /** 完整出场：主题 → 节点 → 依次高亮 → 箭头 → 转动 */
  public *play(
    options: {
      themeDuration?: number;
      nodesDuration?: number;
      highlightEach?: number;
      arrowsDuration?: number;
      spinTurns?: number;
      spinDuration?: number;
    } = {},
  ): ThreadGenerator {
    const {
      themeDuration = 0.65,
      nodesDuration = 0.55,
      highlightEach = 0.45,
      arrowsDuration = 0.7,
      spinTurns = 1,
      spinDuration = 1.4,
    } = options;

    yield* this.showTheme(themeDuration);
    yield* waitFor(0.25);
    yield* this.showNodes(nodesDuration);
    yield* waitFor(0.2);
    yield* this.highlightAll(highlightEach);
    yield* waitFor(0.2);
    yield* this.showArrows(arrowsDuration);
    yield* waitFor(0.25);
    yield* this.spin(spinTurns, spinDuration);
  }

  /** 高亮第 i 个节点（描边淡朱砂一闪） */
  public *highlight(
    index: number,
    duration = 0.7,
  ): ThreadGenerator {
    const i = ((index % this.count) + this.count) % this.count;
    const node = this.nodes[i];
    const stroke = node.stroke();
    yield* node
      .stroke(Ink.seal, duration * 0.35, easeOutCubic)
      .to(stroke, duration * 0.65, easeInOutCubic);
  }

  private layoutThemeUnderline(): void {
    const txt = this.themeTxt();
    const cached = txt.cacheBBox();
    if (cached.width < 1) {
      return;
    }
    const pad = 4;
    const y = cached.bottom + Math.max(8, this.themeFontSize * 0.2);
    this.themeLine().points([
      [cached.left - pad, y],
      [cached.right + pad, y],
    ]);
  }
}
