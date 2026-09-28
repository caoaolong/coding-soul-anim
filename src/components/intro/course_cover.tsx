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

export interface CourseCoverProps extends NodeProps {
  /** 本集标题（每集必改，视觉焦点） */
  episodeTitle: string;
  /** 系列名，默认 重铸编程之魂 */
  series?: string;
  /** 背景高度（保留接口兼容） */
  bgHeight: number;
  /** @deprecated 忽略 */
  bgOpacity?: number;
  /** @deprecated 忽略 */
  veilOpacity?: number;
}

/** 遮罩顶边与高度 */
const REVEAL_TOP = -110;
const REVEAL_HEIGHT = 220;

/**
 * 科技风封面：网格始终可见；
 * 文字固定，用 cache + destination-in 遮罩自上而下揭开。
 */
export class CourseCover extends Node {
  private readonly gridRoot = createRef<Node>();
  private readonly rings = createRefArray<Circle>();
  private readonly scan = createRef<Rect>();
  private readonly hud = createRef<Node>();
  private readonly revealRoot = createRef<Node>();
  private readonly revealMask = createRef<Rect>();
  private readonly titleBlock = createRef<Layout>();
  private readonly seriesTxt = createRef<Txt>();
  private readonly episodeTxt = createRef<Txt>();
  private readonly underline = createRef<Rect>();
  private readonly accentBar = createRef<Rect>();

  public constructor(props: CourseCoverProps) {
    const {
      episodeTitle,
      series = "重铸编程之魂",
      bgHeight: _bgHeight,
      bgOpacity: _bgOpacity,
      veilOpacity: _veilOpacity,
      ...nodeProps
    } = props;

    super(nodeProps);

    // —— 淡网格底纹 ——
    const gStep = 80;
    const gHalfW = 960;
    const gHalfH = 540;
    this.add(<Node ref={this.gridRoot} opacity={0} />);
    for (let x = -gHalfW; x <= gHalfW; x += gStep) {
      this.gridRoot().add(
        <Line
          points={[
            [x, -gHalfH],
            [x, gHalfH],
          ]}
          stroke={Ink.blueDeep}
          lineWidth={1}
          opacity={0.35}
        />,
      );
    }
    for (let y = -gHalfH; y <= gHalfH; y += gStep) {
      this.gridRoot().add(
        <Line
          points={[
            [-gHalfW, y],
            [gHalfW, y],
          ]}
          stroke={Ink.blueDeep}
          lineWidth={1}
          opacity={0.35}
        />,
      );
    }

    // —— 三层脉冲环 ——
    for (let i = 0; i < 3; i++) {
      this.add(
        <Circle
          ref={this.rings}
          size={120 + i * 90}
          stroke={i === 1 ? Ink.gold : Ink.blue}
          lineWidth={2}
          opacity={0}
        />,
      );
    }

    // —— HUD 四角 ——
    this.add(<Node ref={this.hud} opacity={0} />);
    const arm = 48;
    const inset = 120;
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
          lineWidth={2.5}
          lineCap={"square"}
        />,
      );
    }

    // —— 文字固定 + destination-in 遮罩揭开（不改文字坐标） ——
    this.add(
      <Node ref={this.revealRoot} cache>
        <Layout
          ref={this.titleBlock}
          layout
          direction={"column"}
          gap={22}
          alignItems={"center"}
          y={10}
        >
          <Txt
            ref={this.seriesTxt}
            text={series}
            fontFamily={Ink.font}
            fontSize={34}
            fill={Ink.teal}
            letterSpacing={6}
          />
          <Layout layout direction={"row"} gap={18} alignItems={"center"}>
            <Rect
              ref={this.accentBar}
              width={5}
              height={72}
              fill={Ink.gold}
              radius={1}
            />
            <Txt
              ref={this.episodeTxt}
              text={episodeTitle}
              fontFamily={Ink.font}
              fontSize={78}
              fontWeight={700}
              fill={Ink.paper}
            />
          </Layout>
        </Layout>
        {/* 白矩形作遮罩：增高 = 从上往下露出已绘制的文字 */}
        <Rect
          ref={this.revealMask}
          width={1800}
          height={0}
          fill={"#ffffff"}
          x={0}
          y={REVEAL_TOP}
          offset={[0, -1]}
          compositeOperation={"destination-in"}
        />
      </Node>,
    );

    // 底线在遮罩外，扫完再写
    this.add(
      <Rect
        ref={this.underline}
        y={REVEAL_TOP + REVEAL_HEIGHT + 8}
        width={0}
        height={3}
        fill={Ink.blue}
        radius={1}
        shadowColor={Ink.blue}
        shadowBlur={12}
      />,
    );

    // —— 扫描线 ——
    this.add(
      <Rect
        ref={this.scan}
        width={1600}
        height={3}
        fill={Ink.blue}
        opacity={0}
        y={REVEAL_TOP}
        shadowColor={Ink.blue}
        shadowBlur={18}
      />,
    );
  }

  /** 播放封面入场 */
  public *play(): ThreadGenerator {
    yield* this.gridRoot().opacity(1, 0.45, easeOutCubic);
    yield* this.hud().opacity(1, 0.35, easeOutCubic);

    yield* all(
      ...this.rings.map((ring, i) => {
        const target = 520 + i * 140;
        return delay(
          i * 0.12,
          all(
            ring.opacity(0.55, 0.18, easeOutCubic),
            ring.size(target, 0.7, easeOutCubic),
            delay(0.22, ring.opacity(0, 0.5, easeInOutCubic)),
          ),
        );
      }),
    );

    // 扫描线与遮罩高度同步；文字 y 始终不变
    const scanDur = 1.05;
    this.scan().opacity(0.95);
    this.scan().y(REVEAL_TOP);
    this.revealMask().height(0);

    yield* all(
      this.scan().y(REVEAL_TOP + REVEAL_HEIGHT, scanDur, easeInOutSine),
      this.revealMask().height(REVEAL_HEIGHT, scanDur, easeInOutSine),
    );
    yield* this.scan().opacity(0, 0.25, easeOutCubic);

    const titleW = Math.max(320, this.episodeTxt().width() + 40);
    yield* brushWidth(this.underline(), titleW, { duration: 0.42 });

    this.rings[1].size(180);
    yield* all(
      this.episodeTxt()
        .fill(Ink.gold, 0.14, easeOutCubic)
        .to(Ink.paper, 0.36, easeInOutCubic),
      this.episodeTxt()
        .scale(1.08, 0.14, easeOutCubic)
        .to(1, 0.36, easeInOutCubic),
      this.underline()
        .shadowBlur(32, 0.14, easeOutCubic)
        .to(12, 0.36, easeInOutCubic),
      this.accentBar().fill(Ink.goldBright, 0.14).to(Ink.gold, 0.36),
      all(
        this.rings[1].opacity(0.45, 0.1, easeOutCubic).to(
          0,
          0.42,
          easeInOutCubic,
        ),
        this.rings[1].size(680, 0.52, easeOutCubic),
      ),
    );

    yield* all(
      this.gridRoot().opacity(0.4, 0.4, easeInOutCubic),
      this.hud().opacity(0.5, 0.4, easeInOutCubic),
    );

    yield* waitFor(1);
  }

  /** 淡出整幅封面 */
  public *hide(duration = 0.55): ThreadGenerator {
    yield* all(
      this.gridRoot().opacity(0, duration, easeOutCubic),
      this.hud().opacity(0, duration, easeOutCubic),
      this.revealRoot().opacity(0, duration * 0.85, easeOutCubic),
      this.underline().opacity(0, duration * 0.85, easeOutCubic),
      this.scan().opacity(0, duration * 0.5, easeOutCubic),
      ...this.rings.map((r) => r.opacity(0, duration * 0.5, easeOutCubic)),
    );
  }
}
