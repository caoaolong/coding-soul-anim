import {
  Img,
  Layout,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from "@motion-canvas/2d";
import {
  ThreadGenerator,
  createRef,
  createRefArray,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushLine, inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';
/** 无图标节点：芝麻行楷（global.css @font-face） */
const TITLE_FONT =
  '"Zhi Mang Xing", KaiTi, STKaiti, SF Pro Text, Microsoft YaHei, serif';

export interface FlowStep {
  /** 图标资源（Img src）；省略则只显示文案 */
  icon?: string;
  /** 节点下方文案 */
  label: string;
}

export interface FlowChartProps extends NodeProps {
  /** 流程节点（按顺序） */
  steps: FlowStep[];
  /** 图标边长，默认 96 */
  iconSize?: number;
  /** 节点间距（含箭头区域），默认 160 */
  gap?: number;
  /** 有图标时的文案字号，默认 28 */
  fontSize?: number;
  /** 无图标时的标题字号，默认 fontSize * 2.2 */
  titleFontSize?: number;
  /** 箭头线宽，默认 Ink.lineWidth */
  lineWidth?: number;
}

/**
 * 横向流程图：上图标、下文案；next() 依次绘出箭头并显现下一节点。
 * 无图标节点：行楷大字 + 宣纸色 + 淡金底线（与片头标题同系，避免立体金字）。
 */
export class FlowChart extends Node {
  private readonly cards = createRefArray<Layout>();
  private readonly arrows = createRefArray<Line>();
  private readonly count: number;
  /** 当前已显现到的节点下标；-1 表示尚未显示任何节点 */
  private shown = -1;

  public constructor(props: FlowChartProps) {
    const {
      steps,
      iconSize = 96,
      gap = 160,
      fontSize = 28,
      titleFontSize,
      lineWidth = Ink.lineWidth,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!steps || steps.length === 0) {
      throw new Error("FlowChart: steps 不能为空");
    }

    const heroSize = titleFontSize ?? Math.round(fontSize * 2.2);
    this.count = steps.length;
    const arrowLen = Math.max(48, gap * 0.42);
    const cardW = Math.max(
      ...steps.map((s) => {
        const fs = s.icon ? fontSize : heroSize;
        const iconFloor = s.icon ? iconSize + 24 : 0;
        return Math.max(iconFloor, fs * ([...s.label].length + 0.5));
      }),
    );

    const row = createRef<Layout>();
    this.add(
      <Layout
        ref={row}
        layout
        direction={"row"}
        alignItems={"center"}
        gap={Math.max(12, gap - arrowLen)}
      />,
    );

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const hasIcon = Boolean(step.icon);
      const card = createRef<Layout>();
      const underlineW = Math.min(
        cardW * 0.92,
        heroSize * [...step.label].length * 0.92,
      );
      row().add(
        <Layout
          ref={card}
          layout
          direction={"column"}
          alignItems={"center"}
          gap={hasIcon ? 16 : 14}
          width={cardW}
          opacity={0}
        >
          {hasIcon ? (
            <Img src={step.icon!} width={iconSize} height={iconSize} />
          ) : null}
          {hasIcon ? (
            <Txt
              text={step.label}
              fontFamily={LABEL_FONT}
              fontSize={fontSize}
              fill={Ink.paper}
            />
          ) : (
            // 点题句：行楷宣纸色 + 轻墨影 + 淡金底线
            <Layout layout direction={"column"} alignItems={"center"} gap={14}>
              <Txt
                text={step.label}
                fontFamily={TITLE_FONT}
                fontSize={heroSize}
                fill={Ink.paper}
                shadowColor={Ink.veil}
                shadowBlur={12}
                shadowOffsetY={2}
              />
              <Rect
                width={underlineW}
                height={2}
                fill={Ink.gold}
                radius={1}
                opacity={0.9}
                shadowColor={Ink.gold}
                shadowBlur={10}
              />
            </Layout>
          )}
        </Layout>,
      );
      this.cards.push(card());

      if (i < steps.length - 1) {
        const arrow = createRef<Line>();
        row().add(
          <Line
            ref={arrow}
            points={[
              [0, 0],
              [arrowLen, 0],
            ]}
            stroke={Ink.goldSoft}
            lineWidth={lineWidth}
            lineCap={"round"}
            endArrow
            arrowSize={14}
            end={0}
            opacity={1}
          />,
        );
        this.arrows.push(arrow());
      }
    }
  }

  /**
   * 显现下一环节：
   * - 首次：只淡入第一个节点
   * - 之后：运笔箭头 → 淡入下一节点
   */
  public *next(duration = 0.5): ThreadGenerator {
    if (this.shown >= this.count - 1) {
      return;
    }

    if (this.shown < 0) {
      this.shown = 0;
      yield* inkReveal(this.cards[0], { duration, fromY: 12 });
      return;
    }

    const arrow = this.arrows[this.shown];
    const nextCard = this.cards[this.shown + 1];
    const draw = Math.min(Ink.brushDuration, duration * 0.55);
    const reveal = duration * 0.65;

    yield* brushLine(arrow, { duration: draw });
    yield* inkReveal(nextCard, { duration: reveal, fromY: 12 });
    this.shown += 1;
  }

  /** 连续播放全部节点（含首节点与各 next） */
  public *play(stepDuration = 0.5, pause = 0.25): ThreadGenerator {
    for (let i = 0; i < this.count; i++) {
      yield* this.next(stepDuration);
      if (i < this.count - 1 && pause > 0) {
        yield* waitFor(pause);
      }
    }
  }
}
