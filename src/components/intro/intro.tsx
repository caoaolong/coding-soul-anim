import {
  Circle,
  Img,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
} from "@motion-canvas/2d";
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  waitFor,
} from "@motion-canvas/core";
import forgeBg from "../../assets/bg.png";

const AMBER = "#F59E0B";
const AMBER_BRIGHT = "#FBBF24";
const MUTED = "#94A3B8";
const SUB = "#CBD5E1";
const CODE_CHARS = "01{}[]<>/;#$&*=+ABCDEF{}";

export interface IntroProps extends NodeProps {
  /** 本集标题（三层阶梯最下层） */
  episodeTitle: string;
  /** 品牌名，默认 CodingSoul */
  brand?: string;
  /** 系列名，默认 重铸编程之魂 */
  series?: string;
  /** 背景熔炉图高度（通常传 view.height()） */
  bgHeight: number;
  /** 背景图透明度，默认 0.18 */
  bgOpacity?: number;
}

/**
 * CodingSoul 片头：代码熔炉
 * 乱码 → 吸入光环 → 品牌 → 系列名 → 本集标题（三层阶梯）
 */
export class Intro extends Node {
  private readonly ring = createRef<Circle>();
  private readonly title = createRef<Txt>();
  private readonly glitchA = createRef<Txt>();
  private readonly glitchB = createRef<Txt>();
  private readonly subtitle = createRef<Txt>();
  private readonly episode = createRef<Layout>();
  private readonly sweep = createRef<Rect>();
  private readonly chaos = createRefArray<Txt>();

  public constructor(props: IntroProps) {
    const {
      episodeTitle,
      brand = "CodingSoul",
      series = "重铸编程之魂",
      bgHeight,
      bgOpacity = 0.18,
      ...nodeProps
    } = props;

    super(nodeProps);

    const brandY = -40;

    // 熔炉图作低透明度背景：高度铺满画布并居中
    this.add(
      <Img src={forgeBg} height={bgHeight} opacity={bgOpacity} />,
    );

    const chaosCount = 40;
    for (let i = 0; i < chaosCount; i++) {
      const angle = (i / chaosCount) * Math.PI * 2 + (i % 5) * 0.15;
      const radius = 380 + (i % 7) * 55;
      const ch = CODE_CHARS[i % CODE_CHARS.length];
      this.add(
        <Txt
          ref={this.chaos}
          text={ch}
          fontFamily={"SF Mono, Consolas, monospace"}
          fontSize={26 + (i % 5) * 6}
          fontWeight={700}
          fill={i % 3 === 0 ? AMBER : MUTED}
          opacity={0}
          x={Math.cos(angle) * radius}
          y={Math.sin(angle) * radius}
        />,
      );
    }

    this.add(
      <Circle
        ref={this.ring}
        size={0}
        stroke={AMBER}
        lineWidth={3}
        opacity={0}
      />,
    );

    this.add(
      <Txt
        ref={this.glitchA}
        text={brand}
        fontFamily={"SF Mono, Consolas, monospace"}
        fontSize={92}
        fontWeight={700}
        fill={"#22D3EE"}
        opacity={0}
        x={-10}
        y={brandY}
      />,
    );
    this.add(
      <Txt
        ref={this.glitchB}
        text={brand}
        fontFamily={"SF Mono, Consolas, monospace"}
        fontSize={92}
        fontWeight={700}
        fill={"#F43F5E"}
        opacity={0}
        x={10}
        y={brandY}
      />,
    );
    this.add(
      <Txt
        ref={this.title}
        text={brand}
        fontFamily={"SF Mono, Consolas, monospace"}
        fontSize={92}
        fontWeight={700}
        fill={"#FFFFFF"}
        opacity={0}
        scale={0.35}
        y={brandY}
      />,
    );
    this.add(
      <Txt
        ref={this.subtitle}
        text={series}
        fontFamily={
          "SF Pro Text, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
        }
        fontSize={36}
        fontWeight={600}
        fill={SUB}
        y={70}
        opacity={0}
      />,
    );

    // 第三层：琥珀竖线 + 本集标题
    this.add(
      <Layout
        ref={this.episode}
        layout
        direction={"row"}
        gap={16}
        alignItems={"center"}
        y={155}
        opacity={0}
      >
        <Rect width={4} height={34} fill={AMBER} radius={2} />
        <Txt
          text={episodeTitle}
          fontFamily={
            "SF Pro Text, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
          }
          fontSize={34}
          fontWeight={700}
          fill={"#FFFFFF"}
        />
      </Layout>,
    );

    this.add(
      <Rect
        ref={this.sweep}
        width={28}
        height={110}
        fill={AMBER_BRIGHT}
        opacity={0}
        x={-460}
        y={brandY}
        shadowColor={AMBER_BRIGHT}
        shadowBlur={28}
      />,
    );
  }

  /** 播放完整片头动画（约 5 秒） */
  public *play(): ThreadGenerator {
    // —— 0.0–1.0s：乱码闪现并抖动 ——
    yield* all(
      ...this.chaos.map((t, i) =>
        delay((i % 10) * 0.035, t.opacity(0.9, 0.18)),
      ),
    );

    for (let step = 0; step < 5; step++) {
      yield* all(
        ...this.chaos.map((t, i) => {
          t.text(CODE_CHARS[(i * 3 + step * 7) % CODE_CHARS.length]);
          const jx = ((i * 13 + step * 29) % 17) - 8;
          const jy = ((i * 7 + step * 11) % 15) - 7;
          return t.position([t.x() + jx * 2.2, t.y() + jy * 2.2], 0.1);
        }),
      );
    }

    // —— 1.0–2.0s：吸入中心 + 熔炉光环收缩 ——
    yield* all(
      this.ring().opacity(1, 0.15),
      this.ring().size(560, 0.5, easeOutCubic),
      ...this.chaos.map((t, i) =>
        delay(
          i * 0.01,
          all(
            t.position([0, 0], 0.5, easeInCubic),
            t.scale(0.15, 0.5, easeInCubic),
            t.opacity(0, 0.45, easeInCubic),
          ),
        ),
      ),
    );

    yield* all(
      this.ring().size(72, 0.32, easeInCubic),
      this.ring().lineWidth(10, 0.32),
      this.ring().stroke(AMBER_BRIGHT, 0.32),
    );

    // —— 2.0–3.0s：光环炸开，品牌字 + glitch ——
    yield* all(
      this.ring().size(1100, 0.4, easeOutCubic),
      this.ring().opacity(0, 0.35),
      this.ring().lineWidth(2, 0.35),
      this.title().opacity(1, 0.2),
      this.title().scale(1.1, 0.28, easeOutCubic).to(1, 0.18, easeInOutCubic),
      this.glitchA().opacity(0.75, 0.06).to(0, 0.28),
      this.glitchB().opacity(0.75, 0.06).to(0, 0.28),
      this.glitchA().x(-22, 0.12).to(0, 0.22),
      this.glitchB().x(22, 0.12).to(0, 0.22),
    );

    // 二次短 glitch
    yield* all(
      this.glitchA().opacity(0.45, 0.04).to(0, 0.12),
      this.glitchB().opacity(0.45, 0.04).to(0, 0.12),
      this.glitchA().x(-14, 0.08).to(0, 0.1),
      this.glitchB().x(14, 0.08).to(0, 0.1),
    );

    // —— 系列名 ——
    yield* all(
      this.subtitle().opacity(1, 0.32, easeOutCubic),
      this.subtitle().y(52, 0.4, easeOutCubic),
    );

    // 品牌光扫
    this.sweep().opacity(0.7);
    yield* this.sweep().x(460, 0.38, easeInOutCubic);
    this.sweep().opacity(0);

    // —— 本集标题（第三层）——
    yield* all(
      this.episode().opacity(1, 0.35, easeOutCubic),
      this.episode().y(128, 0.42, easeOutCubic),
    );

    yield* waitFor(0.45);
  }
}
