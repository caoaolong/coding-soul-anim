import { Layout, Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  tween,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { brushLine, inkReveal } from "../../theme/ink_anim";

const AXIS_FONT = '"SimFang", FangSong, STFangsong, serif';
const READOUT_FONT = "JetBrains Mono, Consolas, monospace";

export interface Axes2DProps extends NodeProps {
  /** x 最小刻度，默认 -5 */
  xMin?: number;
  /** x 最大刻度，默认 5 */
  xMax?: number;
  /** y 最小刻度，默认 -4 */
  yMin?: number;
  /** y 最大刻度，默认 4 */
  yMax?: number;
  /** 单位长度像素，默认 70 */
  unit?: number;
  /** 是否画网格，默认 true */
  showGrid?: boolean;
  /** 刻度步长，默认 1 */
  tickStep?: number;
  /** 底部标题文案，如「二维向量」 */
  caption?: string;
}

/**
 * 二维直角坐标轴 + 从原点出发的向量箭头。
 * 支持向量移动，并实时刷新 (X, Y) 读数。
 */
export class Axes2D extends Node {
  private readonly frame = createRef<Layout>();
  private readonly vector = createRef<Line>();
  private readonly tipLabel = createRef<Txt>();
  private readonly captionTxt = createRef<Txt>();
  private readonly hasCaption: boolean;

  private readonly unit: number;
  private readonly xMin: number;
  private readonly xMax: number;
  private readonly yMin: number;
  private readonly yMax: number;

  private readonly tipX = createSignal(0);
  private readonly tipY = createSignal(0);

  public constructor(props: Axes2DProps = {}) {
    const {
      xMin = -5,
      xMax = 5,
      yMin = -4,
      yMax = 4,
      unit = 70,
      showGrid = true,
      tickStep = 1,
      caption = "",
      ...nodeProps
    } = props;

    super(nodeProps);

    this.unit = unit;
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.hasCaption = Boolean(caption);

    const x0 = this.toX(0);
    const y0 = this.toY(0);
    const left = this.toX(xMin);
    const right = this.toX(xMax);
    const bottom = this.toY(yMin);
    const top = this.toY(yMax);

    this.add(
      <Layout ref={this.frame} layout={false} opacity={0}>
        {showGrid
          ? this.buildGrid(tickStep, left, right, top, bottom, x0, y0)
          : null}

        {/* X 轴 */}
        <Line
          points={[
            [left, y0],
            [right, y0],
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
          lineCap={"round"}
          endArrow
          arrowSize={12}
        />
        {/* Y 轴 */}
        <Line
          points={[
            [x0, bottom],
            [x0, top],
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
          lineCap={"round"}
          endArrow
          arrowSize={12}
        />

        <Txt
          text={"x"}
          fontFamily={AXIS_FONT}
          fontSize={28}
          fill={Ink.paperSoft}
          x={right + 22}
          y={y0 + 4}
        />
        <Txt
          text={"y"}
          fontFamily={AXIS_FONT}
          fontSize={28}
          fill={Ink.paperSoft}
          x={x0 + 18}
          y={top - 8}
        />

        {this.buildTicks(tickStep, x0, y0)}

        {/* 向量：原点 → 尖端 */}
        <Line
          ref={this.vector}
          points={() => [
            new Vector2(this.toX(0), this.toY(0)),
            new Vector2(this.toX(this.tipX()), this.toY(this.tipY())),
          ]}
          stroke={Ink.goldSoft}
          lineWidth={3}
          lineCap={"round"}
          endArrow
          arrowSize={16}
          end={0}
          opacity={0}
        />

        {/* 尖端旁实时坐标 */}
        <Txt
          ref={this.tipLabel}
          text={() => this.formatXY(this.tipX(), this.tipY())}
          fontFamily={READOUT_FONT}
          fontSize={26}
          fill={Ink.goldBright}
          x={() => this.toX(this.tipX()) + 36}
          y={() => this.toY(this.tipY()) - 28}
          opacity={0}
        />

        {caption ? (
          <Txt
            ref={this.captionTxt}
            text={caption}
            fontFamily={AXIS_FONT}
            fontSize={36}
            fill={Ink.paper}
            y={bottom + 56}
            opacity={0}
          />
        ) : null}
      </Layout>,
    );
  }

  public getTip(): Vector2 {
    return new Vector2(this.tipX(), this.tipY());
  }

  /** 坐标轴墨晕入场 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this.frame(), { duration, fromY: 12 });
    if (this.hasCaption) {
      yield* this.captionTxt().opacity(1, duration * 0.7, easeInOutCubic);
    }
  }

  /**
   * 画出从原点到 (x, y) 的向量，并显示坐标读数。
   */
  public *showVector(
    x: number,
    y: number,
    duration = 0.55,
  ): ThreadGenerator {
    this.tipX(x);
    this.tipY(y);
    this.vector().opacity(1);
    this.vector().end(0);
    this.tipLabel().opacity(0);
    yield* all(
      brushLine(this.vector(), { duration }),
      this.tipLabel().opacity(1, duration * 0.7, easeInOutCubic),
    );
  }

  /**
   * 将向量尖端移到 (x, y)，途中实时更新坐标文字。
   */
  public *moveVector(
    x: number,
    y: number,
    duration = 0.8,
  ): ThreadGenerator {
    const fromX = this.tipX();
    const fromY = this.tipY();
    yield* tween(duration, (value) => {
      const t = easeInOutCubic(value);
      this.tipX(fromX + (x - fromX) * t);
      this.tipY(fromY + (y - fromY) * t);
    });
  }

  /**
   * 按路径来回移动向量尖端。
   * @param points 目标点序列（不含当前点）
   */
  public *travel(
    points: Array<[number, number]>,
    stepDuration = 0.8,
    hold = 0.15,
  ): ThreadGenerator {
    for (const [x, y] of points) {
      yield* this.moveVector(x, y, stepDuration);
      if (hold > 0) {
        yield* waitFor(hold);
      }
    }
  }

  private formatXY(x: number, y: number): string {
    return `(${this.fmt(x)}, ${this.fmt(y)})`;
  }

  private fmt(n: number): string {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  private toX(v: number): number {
    return v * this.unit;
  }

  /** 屏幕 y 向下，数学 y 向上 */
  private toY(v: number): number {
    return -v * this.unit;
  }

  private buildGrid(
    step: number,
    left: number,
    right: number,
    top: number,
    bottom: number,
    x0: number,
    y0: number,
  ) {
    const lines: Node[] = [];
    for (let x = Math.ceil(this.xMin / step) * step; x <= this.xMax + 1e-6; x += step) {
      if (Math.abs(x) < 1e-6) continue;
      const px = this.toX(x);
      lines.push(
        <Line
          points={[
            [px, bottom],
            [px, top],
          ]}
          stroke={Ink.line}
          lineWidth={1}
          opacity={0.25}
        />,
      );
    }
    for (let y = Math.ceil(this.yMin / step) * step; y <= this.yMax + 1e-6; y += step) {
      if (Math.abs(y) < 1e-6) continue;
      const py = this.toY(y);
      lines.push(
        <Line
          points={[
            [left, py],
            [right, py],
          ]}
          stroke={Ink.line}
          lineWidth={1}
          opacity={0.25}
        />,
      );
    }
    // 原点十字略亮
    lines.push(
      <Line
        points={[
          [x0, bottom],
          [x0, top],
        ]}
        stroke={Ink.goldSoft}
        lineWidth={1}
        opacity={0.2}
      />,
      <Line
        points={[
          [left, y0],
          [right, y0],
        ]}
        stroke={Ink.goldSoft}
        lineWidth={1}
        opacity={0.2}
      />,
    );
    return lines;
  }

  private buildTicks(step: number, x0: number, y0: number) {
    const ticks: Node[] = [];
    const tick = 8;
    for (let x = Math.ceil(this.xMin / step) * step; x <= this.xMax + 1e-6; x += step) {
      if (Math.abs(x) < 1e-6) continue;
      const px = this.toX(x);
      ticks.push(
        <Line
          points={[
            [px, y0 - tick / 2],
            [px, y0 + tick / 2],
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
        />,
        <Txt
          text={String(x)}
          fontFamily={READOUT_FONT}
          fontSize={18}
          fill={Ink.muted}
          x={px}
          y={y0 + 22}
        />,
      );
    }
    for (let y = Math.ceil(this.yMin / step) * step; y <= this.yMax + 1e-6; y += step) {
      if (Math.abs(y) < 1e-6) continue;
      const py = this.toY(y);
      ticks.push(
        <Line
          points={[
            [x0 - tick / 2, py],
            [x0 + tick / 2, py],
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
        />,
        <Txt
          text={String(y)}
          fontFamily={READOUT_FONT}
          fontSize={18}
          fill={Ink.muted}
          x={x0 - 22}
          y={py}
        />,
      );
    }
    return ticks;
  }
}
