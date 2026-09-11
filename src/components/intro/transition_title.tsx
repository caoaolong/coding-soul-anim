import { Circle, Layout, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushWidth, inkReveal } from "../../theme/ink_anim";

const TITLE_CN_FONT = '"SimFang", FangSong, STFangsong, serif';
const TITLE_EN_FONT =
  "SF Pro Text, Segoe UI, Microsoft YaHei, sans-serif";

export interface TransitionTitleProps extends NodeProps {
  /** 过渡页居中主标题 */
  title: string;
  /** 可选副标题（如中文译名） */
  subtitle?: string;
  /** 主标题字号，默认 64 */
  fontSize?: number;
  /** 副标题字号，默认 36 */
  subtitleSize?: number;
}

/**
 * 章节过渡页：屏心标题（可带副标题）。
 * 墨晕入场 → 淡金底线运笔 → 墨金字色脉冲 → 金息圆晕散去（约 2.5–3 秒）。
 */
export class TransitionTitle extends Node {
  private readonly breath = createRef<Circle>();
  private readonly titleTxt = createRef<Txt>();
  private readonly subtitleTxt = createRef<Txt>();
  private readonly underline = createRef<Rect>();
  private readonly block = createRef<Layout>();
  private readonly hasSubtitle: boolean;

  public constructor(props: TransitionTitleProps) {
    const {
      title,
      subtitle,
      fontSize = 64,
      subtitleSize = 36,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.hasSubtitle = Boolean(subtitle?.trim());
    // 含拉丁字母时用无衬线，纯中文用仿宋
    const titleFont = /[A-Za-z]/.test(title) ? TITLE_EN_FONT : TITLE_CN_FONT;

    // 极淡金息：点题「道」，不抢标题
    this.add(
      <Circle
        ref={this.breath}
        size={280}
        stroke={Ink.gold}
        lineWidth={1.5}
        opacity={0}
        shadowColor={Ink.gold}
        shadowBlur={28}
      />,
    );

    this.add(
      <Layout
        ref={this.block}
        layout
        direction={"column"}
        gap={18}
        alignItems={"center"}
        opacity={0}
      >
        <Txt
          ref={this.titleTxt}
          text={title}
          fontFamily={titleFont}
          fontSize={fontSize}
          fontWeight={400}
          fill={Ink.paper}
          shadowColor={"#000000"}
          shadowBlur={12}
        />
        <Rect
          ref={this.underline}
          width={0}
          height={2}
          fill={Ink.gold}
          radius={1}
          shadowColor={Ink.gold}
          shadowBlur={10}
        />
        {this.hasSubtitle && (
          <Txt
            ref={this.subtitleTxt}
            text={subtitle!.trim()}
            fontFamily={TITLE_CN_FONT}
            fontSize={subtitleSize}
            fontWeight={400}
            fill={Ink.paperSoft}
            shadowColor={"#000000"}
            shadowBlur={8}
          />
        )}
      </Layout>,
    );
  }

  /** 播放过渡入场，结束后定格 */
  public *play(): ThreadGenerator {
    // —— 金息轻起 + 标题墨晕 ——
    yield* all(
      this.breath().opacity(0.2, 0.4, easeOutCubic),
      this.breath().size(340, 0.9, easeInOutCubic),
      inkReveal(this.block(), { fromY: 14, duration: 0.55 }),
    );

    // —— 底线运笔 + 墨金脉冲 ——
    const titleWidth = Math.max(200, this.titleTxt().width() + 48);
    yield* all(
      brushWidth(this.underline(), titleWidth),
      this.titleTxt().fill(Ink.goldSoft, 0.28, easeOutCubic),
      delay(0.28, this.titleTxt().fill(Ink.paper, 0.45, easeInOutCubic)),
      this.breath().opacity(0.06, 0.55, easeInOutCubic),
    );

    // —— 金息散去，短停定格 ——
    yield* this.breath().opacity(0, 0.45, easeOutCubic);
    yield* waitFor(0.6);
  }

  /** 淡出整幅过渡（接下文时用） */
  public *hide(duration = 0.45): ThreadGenerator {
    yield* all(
      this.block().opacity(0, duration, easeOutCubic),
      this.breath().opacity(0, duration * 0.6, easeOutCubic),
    );
  }
}
