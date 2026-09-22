import { Gradient, Node, NodeProps, Rect } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  tween,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { InkFormula } from "../formula/ink_formula";

export interface PaletteProps extends NodeProps {
  /** 主色域边长，默认 320 */
  size?: number;
  /** 色相条宽度，默认 28 */
  hueWidth?: number;
  /** 色相条与主色域间距，默认 16 */
  gap?: number;
  /** 初始色相位置 0~1（自上而下），默认 0（红） */
  hueT?: number;
  /** RGB 公式相对色域下沿的间距，默认 56 */
  formulaGap?: number;
  /** RGB 公式字号，默认 40 */
  formulaSize?: number;
}

/** 色相条：红→黄→绿→青→蓝→品红→红 */
const HUE_STOPS = [
  { offset: 0, color: "#FF0000" },
  { offset: 1 / 6, color: "#FFFF00" },
  { offset: 2 / 6, color: "#00FF00" },
  { offset: 3 / 6, color: "#00FFFF" },
  { offset: 4 / 6, color: "#0000FF" },
  { offset: 5 / 6, color: "#FF00FF" },
  { offset: 1, color: "#FF0000" },
];

/** HSV（S=V=1）色相 t∈[0,1] → RGB 0~255 */
function hueToRgb(t: number): { r: number; g: number; b: number } {
  const h = (((t % 1) + 1) % 1) * 6;
  const i = Math.floor(h);
  const f = h - i;
  const q = 1 - f;
  const channels: Array<[number, number, number]> = [
    [1, f, 0],
    [q, 1, 0],
    [0, 1, f],
    [0, q, 1],
    [f, 0, 1],
    [1, 0, q],
  ];
  const [r, g, b] = channels[i % 6];
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function hueToHex(t: number): string {
  const { r, g, b } = hueToRgb(t);
  const byte = (x: number) => x.toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function colorTex(r: number, g: number, b: number): string {
  return `Color(${r}, ${g}, ${b})`;
}

/**
 * PS 式颜色盘：左侧饱和度/明度色域 + 右侧色相竖条与横条标记；
 * 下方 InkFormula 实时显示 Color(R, G, B)。
 */
export class Palette extends Node {
  private readonly satLayer = createRef<Rect>();
  private readonly hueMarker = createRef<Rect>();
  private readonly rgbFormula = createRef<InkFormula>();

  private readonly size: number;
  private readonly half: number;
  private readonly hueX: number;
  private currentHueT: number;
  private rgbShown = false;

  public constructor(props: PaletteProps = {}) {
    const {
      size = 320,
      hueWidth = 28,
      gap = 16,
      hueT = 0,
      formulaGap = 56,
      formulaSize = 40,
      ...nodeProps
    } = props;

    super({ opacity: 0, ...nodeProps });

    this.size = size;
    this.half = size / 2;
    this.currentHueT = hueT;

    const totalW = size + gap + hueWidth;
    const fieldX = -totalW / 2 + size / 2;
    this.hueX = totalW / 2 - hueWidth / 2;

    const initialHue = hueToHex(hueT);
    const initialRgb = hueToRgb(hueT);

    const valGradient = new Gradient({
      type: "linear",
      from: [0, -this.half],
      to: [0, this.half],
      stops: [
        { offset: 0, color: "#00000000" },
        { offset: 1, color: "#000000" },
      ],
    });

    const hueGradient = new Gradient({
      type: "linear",
      from: [0, -this.half],
      to: [0, this.half],
      stops: HUE_STOPS,
    });

    // 主色域
    this.add(
      <Node x={fieldX}>
        <Rect
          ref={this.satLayer}
          width={size}
          height={size}
          fill={this.makeSatGradient(initialHue)}
          radius={4}
        />
        <Rect width={size} height={size} fill={valGradient} radius={4} />
        <Rect
          width={size}
          height={size}
          fill={null}
          radius={4}
          stroke={Ink.goldSoft}
          lineWidth={2}
        />
      </Node>,
    );

    // 色相竖条
    this.add(
      <Rect
        x={this.hueX}
        width={hueWidth}
        height={size}
        fill={hueGradient}
        radius={4}
        stroke={Ink.goldSoft}
        lineWidth={2}
      />,
    );

    // 横条标记：指示当前色相
    this.add(
      <Rect
        ref={this.hueMarker}
        x={this.hueX}
        y={this.hueToY(hueT)}
        width={hueWidth + 14}
        height={5}
        fill={Ink.paper}
        stroke={Ink.goldSoft}
        lineWidth={1.5}
        radius={2}
      />,
    );

    // 下方 RGB 公式
    this.add(
      <InkFormula
        ref={this.rgbFormula}
        tex={colorTex(initialRgb.r, initialRgb.g, initialRgb.b)}
        fontSize={formulaSize}
        y={size / 2 + formulaGap}
      />,
    );
  }

  private makeSatGradient(hueHex: string): Gradient {
    return new Gradient({
      type: "linear",
      from: [-this.half, 0],
      to: [this.half, 0],
      stops: [
        { offset: 0, color: "#FFFFFF" },
        { offset: 1, color: hueHex },
      ],
    });
  }

  private hueToY(t: number): number {
    const clamped = Math.min(1, Math.max(0, t));
    return -this.half + clamped * this.size;
  }

  /** 设置色相 t∈[0,1]，同步横条、色域与 RGB 公式 */
  public setHue(t: number): void {
    const clamped = Math.min(1, Math.max(0, t));
    this.currentHueT = clamped;
    const hex = hueToHex(clamped);
    const { r, g, b } = hueToRgb(clamped);
    this.hueMarker().y(this.hueToY(clamped));
    this.satLayer().fill(this.makeSatGradient(hex));
    if (this.rgbShown) {
      this.rgbFormula().setTex(colorTex(r, g, b));
    }
  }

  /** 下方 Color(R, G, B) 书写出场 */
  public *showRgb(duration = 0.5): ThreadGenerator {
    yield* this.rgbFormula().write(duration);
    this.rgbShown = true;
  }

  /**
   * 色相横条滑动动画：色域与 RGB 公式实时跟随。
   * @param to 目标色相 0~1
   * @param duration 时长
   * @param from 起点；默认当前色相
   */
  public *animateHue(
    to: number,
    duration = 2.4,
    from?: number,
  ): ThreadGenerator {
    const start = from ?? this.currentHueT;
    const end = Math.min(1, Math.max(0, to));
    yield* tween(duration, (value) => {
      const t = start + (end - start) * easeInOutCubic(value);
      this.setHue(t);
    });
  }

  /** 自右侧滑入并淡入 */
  public *enterFromRight(
    duration = 0.75,
    distance = 560,
  ): ThreadGenerator {
    const targetX = this.x();
    this.x(targetX + distance);
    this.opacity(0);
    yield* all(
      this.x(targetX, duration, easeOutCubic),
      this.opacity(1, duration, easeOutCubic),
    );
  }

  /** 向右滑出淡出（备用） */
  public *exitRight(duration = 0.7, distance = 560): ThreadGenerator {
    yield* all(
      this.x(this.x() + distance, duration, easeInOutCubic),
      this.opacity(0, duration, easeInOutCubic),
    );
  }
}
