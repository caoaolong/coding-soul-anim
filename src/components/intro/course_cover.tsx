import { Circle, Img, Layout, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import taijiBg from "../../assets/bg.png";
import { Highlight } from "../../theme/highlight";

const INK = "#E8E0D0";
const INK_SOFT = "#C4B8A8";
const GOLD = Highlight.accent;
const GOLD_SOFT = Highlight.stroke;
const VEIL = "#0A0A0C";

export interface CourseCoverProps extends NodeProps {
  /** 本集标题（每集必改，视觉焦点） */
  episodeTitle: string;
  /** 系列名，默认 重铸编程之魂 */
  series?: string;
  /** 背景图高度（通常传 view.height()） */
  bgHeight: number;
  /** 背景显影后的目标透明度，默认 0.78 */
  bgOpacity?: number;
  /** 底部文字区暗纱透明度，默认 0.42 */
  veilOpacity?: number;
}

/**
 * 每集封面片头：云开见字
 * 水墨太极背景缓缓显影 → 系列名 → 本集标题强调动效（约 5 秒）
 */
export class CourseCover extends Node {
  private readonly bg = createRef<Img>();
  private readonly veil = createRef<Rect>();
  private readonly breath = createRef<Circle>();
  private readonly seriesTxt = createRef<Txt>();
  private readonly episodeTxt = createRef<Txt>();
  private readonly episodeMark = createRef<Rect>();
  private readonly underline = createRef<Rect>();
  private readonly episodeBlock = createRef<Layout>();

  private readonly targetBgOpacity: number;
  private readonly targetVeilOpacity: number;

  public constructor(props: CourseCoverProps) {
    const {
      episodeTitle,
      series = "重铸编程之魂",
      bgHeight,
      bgOpacity = 0.78,
      veilOpacity = 0.42,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.targetBgOpacity = bgOpacity;
    this.targetVeilOpacity = veilOpacity;

    // 全幅水墨太极：初始隐藏，由 play 显影
    this.add(
      <Img
        ref={this.bg}
        src={taijiBg}
        height={bgHeight}
        opacity={0}
        scale={1.04}
      />,
    );

    // 太极处极淡金息：点题「道」，不抢画面
    this.add(
      <Circle
        ref={this.breath}
        size={420}
        y={-160}
        stroke={GOLD}
        lineWidth={1.5}
        opacity={0}
        shadowColor={GOLD}
        shadowBlur={36}
      />,
    );

    // 底部暗纱：让标题落在云海留白上仍可读
    this.add(
      <Rect
        ref={this.veil}
        width={1920}
        height={460}
        y={340}
        fill={VEIL}
        opacity={0}
      />,
    );

    // 文字压在下半：太极完整留在上半；系列弱、本集强
    const seriesY = 150;
    const episodeY = 248;

    this.add(
      <Txt
        ref={this.seriesTxt}
        text={series}
        fontFamily={
          '"Zhi Mang Xing", KaiTi, STKaiti, SF Pro Text, Microsoft YaHei, serif'
        }
        fontSize={36}
        fill={INK_SOFT}
        y={seriesY}
        opacity={0}
        shadowColor={"#000000"}
        shadowBlur={10}
      />,
    );

    // 本集标题：大字号 + 左侧金标 + 底线（动效焦点）
    this.add(
      <Layout
        ref={this.episodeBlock}
        layout
        direction={"column"}
        gap={18}
        alignItems={"center"}
        y={episodeY}
        opacity={0}
        scale={0.88}
      >
        <Layout layout direction={"row"} gap={18} alignItems={"center"}>
          <Rect
            ref={this.episodeMark}
            width={5}
            height={52}
            fill={GOLD}
            radius={2}
            opacity={0}
          />
          <Txt
            ref={this.episodeTxt}
            text={episodeTitle}
            fontFamily={'"SimFang", FangSong, STFangsong, serif'}
            fontSize={56}
            fontWeight={400}
            fill={INK}
            shadowColor={"#000000"}
            shadowBlur={14}
          />
        </Layout>
        <Rect
          ref={this.underline}
          width={0}
          height={3}
          fill={GOLD}
          radius={2}
          shadowColor={GOLD}
          shadowBlur={12}
        />
      </Layout>,
    );
  }

  /** 播放封面入场（约 5 秒），结束后定格 */
  public *play(): ThreadGenerator {
    const seriesY = this.seriesTxt().y();
    const episodeY = this.episodeBlock().y();

    // —— 云开（背景显影 + 微缩放回落）——
    yield* all(
      this.bg().opacity(this.targetBgOpacity, 1.35, easeOutCubic),
      this.bg().scale(1, 1.45, easeOutCubic),
      this.veil().opacity(this.targetVeilOpacity, 1.2, easeOutCubic),
    );

    // —— 系列名轻入（配角）——
    this.seriesTxt().y(seriesY - 12);
    yield* all(
      this.breath().opacity(0.22, 0.4, easeOutCubic),
      this.breath().size(460, 1.0, easeInOutCubic),
      this.seriesTxt().opacity(1, 0.5, easeOutCubic),
      this.seriesTxt().y(seriesY, 0.55, easeOutCubic),
    );

    // —— 本集标题强调：放大回落 + 金标/底线展开 + 金色脉冲 ——
    this.episodeBlock().y(episodeY - 16);
    yield* all(
      this.breath().opacity(0.06, 0.6, easeInOutCubic),
      this.episodeBlock().opacity(1, 0.35, easeOutCubic),
      this.episodeBlock().y(episodeY, 0.55, easeOutCubic),
      this.episodeBlock().scale(1.06, 0.45, easeOutCubic),
      this.episodeMark().opacity(1, 0.35, easeOutCubic),
    );

    // 底线自中心向外「写」开；标题墨色 → 金 → 墨
    const titleWidth = Math.max(280, this.episodeTxt().width() + 40);
    yield* all(
      this.episodeBlock().scale(1, 0.35, easeInOutCubic),
      this.underline().width(titleWidth, 0.55, easeOutCubic),
      this.episodeTxt().fill(GOLD_SOFT, 0.28, easeOutCubic),
      delay(0.28, this.episodeTxt().fill(INK, 0.45, easeInOutCubic)),
      this.breath().opacity(0, 0.5, easeOutCubic),
    );

    // 短促金息余韵
    yield* all(
      this.underline().shadowBlur(22, 0.2, easeOutCubic).to(12, 0.35),
      this.episodeMark().fill(GOLD_SOFT, 0.2).to(GOLD, 0.35),
    );

    yield* waitFor(0.5);
  }

  /** 淡出整幅封面（接下文内容时用） */
  public *hide(duration = 0.55): ThreadGenerator {
    yield* all(
      this.bg().opacity(0, duration, easeOutCubic),
      this.veil().opacity(0, duration, easeOutCubic),
      this.seriesTxt().opacity(0, duration * 0.85, easeOutCubic),
      this.episodeBlock().opacity(0, duration * 0.85, easeOutCubic),
      this.breath().opacity(0, duration * 0.5, easeOutCubic),
    );
  }
}
