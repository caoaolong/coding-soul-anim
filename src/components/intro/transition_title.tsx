import {
  Circle,
  Layout,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushWidth } from "../../theme/ink_anim";

export interface TransitionTitleProps extends NodeProps {
  /** 过渡页居中主标题 */
  title: string;
  /** 可选副标题（如中文译名 / 英文说明） */
  subtitle?: string;
  /** 主标题字号，默认 64 */
  fontSize?: number;
  /** 副标题字号，默认 36 */
  subtitleSize?: number;
}

/**
 * 科技风章节过渡：HUD 四角 + 脉冲环 + 扫描揭开标题 + 青色强调线。
 */
export class TransitionTitle extends Node {
  private readonly hud = createRef<Node>();
  private readonly rings = createRefArray<Circle>();
  private readonly scan = createRef<Rect>();
  private readonly revealRoot = createRef<Node>();
  private readonly revealMask = createRef<Rect>();
  private readonly titleTxt = createRef<Txt>();
  private readonly subtitleTxt = createRef<Txt>();
  private readonly underline = createRef<Rect>();
  private readonly accentBar = createRef<Rect>();
  private readonly hasSubtitle: boolean;
  private readonly revealTop: number;
  private readonly revealH: number;

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
    this.revealH = this.hasSubtitle ? 200 : 140;
    this.revealTop = -this.revealH / 2;

    // —— HUD 四角 ——
    this.add(<Node ref={this.hud} opacity={0} />);
    const arm = 40;
    const inset = 160;
    const corners: Array<[number, number, number, number]> = [
      [-960 + inset, -540 + inset, 1, 1],
      [960 - inset, -540 + inset, -1, 1],
      [-960 + inset, 540 - inset, 1, -1],
      [960 - inset, 540 - inset, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      this.hud().add(
        <Line
          points={[
            [cx, cy + sy * arm],
            [cx, cy],
            [cx + sx * arm, cy],
          ]}
          stroke={Ink.teal}
          lineWidth={2.25}
          lineCap={"square"}
        />,
      );
    }

    // —— 脉冲环 ——
    for (let i = 0; i < 2; i++) {
      this.add(
        <Circle
          ref={this.rings}
          size={100 + i * 70}
          stroke={i === 0 ? Ink.blue : Ink.teal}
          lineWidth={2}
          opacity={0}
        />,
      );
    }

    // —— 标题（cache + destination-in 扫描揭开） ——
    this.add(
      <Node ref={this.revealRoot} cache>
        <Layout layout direction={"column"} gap={20} alignItems={"center"}>
          <Layout layout direction={"row"} gap={16} alignItems={"center"}>
            <Rect
              ref={this.accentBar}
              width={6}
              height={Math.round(fontSize * 0.85)}
              fill={Ink.teal}
              radius={1}
              shadowColor={Ink.teal}
              shadowBlur={10}
            />
            <Txt
              ref={this.titleTxt}
              text={title}
              fontFamily={Ink.font}
              fontSize={fontSize}
              fontWeight={500}
              fill={Ink.paper}
              letterSpacing={title.length <= 6 ? 4 : 2}
            />
          </Layout>
          <Rect
            ref={this.underline}
            width={0}
            height={3}
            fill={Ink.teal}
            radius={1}
            shadowColor={Ink.teal}
            shadowBlur={12}
          />
          {this.hasSubtitle && (
            <Txt
              ref={this.subtitleTxt}
              text={subtitle!.trim()}
              fontFamily={Ink.font}
              fontSize={subtitleSize}
              fontWeight={400}
              fill={Ink.paperSoft}
              letterSpacing={1}
            />
          )}
        </Layout>
        <Rect
          ref={this.revealMask}
          width={1600}
          height={0}
          y={this.revealTop}
          offset={[0, -1]}
          fill={"#ffffff"}
          compositeOperation={"destination-in"}
        />
      </Node>,
    );

    // —— 扫描线 ——
    this.add(
      <Rect
        ref={this.scan}
        width={1400}
        height={3}
        fill={Ink.blue}
        opacity={0}
        y={this.revealTop}
        shadowColor={Ink.blue}
        shadowBlur={16}
      />,
    );
  }

  /** 播放过渡入场，结束后定格 */
  public *play(): ThreadGenerator {
    const top = this.revealTop;
    const height = this.revealH;

    yield* this.hud().opacity(1, 0.3, easeOutCubic);
    yield* all(
      ...this.rings.map((ring, i) => {
        const target = 420 + i * 120;
        return delay(
          i * 0.1,
          all(
            ring.opacity(0.5, 0.16, easeOutCubic),
            ring.size(target, 0.55, easeOutCubic),
            delay(0.18, ring.opacity(0, 0.4, easeInOutCubic)),
          ),
        );
      }),
    );

    this.scan().opacity(0.9);
    this.scan().y(top);
    this.revealMask().height(0);
    this.revealMask().y(top);

    const scanDur = 0.75;
    yield* all(
      this.scan().y(top + height, scanDur, easeInOutSine),
      this.revealMask().height(height, scanDur, easeInOutSine),
    );
    yield* this.scan().opacity(0, 0.2, easeOutCubic);

    const span = this.hasSubtitle ? this.subtitleTxt() : this.titleTxt();
    const lineW = Math.max(160, span.width() + 36);
    yield* all(
      brushWidth(this.underline(), lineW, { duration: 0.4 }),
      this.titleTxt()
        .fill(Ink.gold, 0.14, easeOutCubic)
        .to(Ink.paper, 0.36, easeInOutCubic),
      this.accentBar().fill(Ink.goldBright, 0.14).to(Ink.teal, 0.36),
      this.underline()
        .shadowBlur(28, 0.14, easeOutCubic)
        .to(12, 0.36, easeInOutCubic),
    );

    yield* this.hud().opacity(0.55, 0.35, easeInOutCubic);
    yield* waitFor(0.55);
  }

  /** 淡出整幅过渡（接下文时用） */
  public *hide(duration = 0.45): ThreadGenerator {
    yield* all(
      this.hud().opacity(0, duration, easeOutCubic),
      this.revealRoot().opacity(0, duration, easeOutCubic),
      this.underline().opacity(0, duration * 0.85, easeOutCubic),
      this.scan().opacity(0, duration * 0.5, easeOutCubic),
      ...this.rings.map((r) => r.opacity(0, duration * 0.5, easeOutCubic)),
    );
  }
}
