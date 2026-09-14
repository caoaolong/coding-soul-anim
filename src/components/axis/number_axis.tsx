import { Layout, Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  createRef,
  easeInOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";

export interface NumberAxisProps extends NodeProps {
  /** 原点对应的数值，默认 0 */
  origin?: number;
  /** 原点向左覆盖的数值跨度，默认 8 */
  leftSpan?: number;
  /** 原点向右覆盖的数值跨度，默认 8 */
  rightSpan?: number;
  /** 轴线像素宽度，默认 520 */
  width?: number;
  /** 刻度步长，默认 1 */
  tickStep?: number;
  /** 游标初始绝对数值，默认等于 origin */
  initialValue?: number;
  /** 下方读数格式化，默认原样数字 */
  formatValue?: (value: number) => string;
  /** 轴线颜色 */
  axisColor?: string;
  /** 游标颜色 */
  cursorColor?: string;
  /** 读数字号 */
  fontSize?: number;
}

/**
 * 横向数轴：可设原点数值、可移动游标；游标下方同步显示当前读数。
 */
export class NumberAxis extends Node {
  private readonly track = createRef<Layout>();
  private readonly cursor = createRef<Layout>();
  private readonly readout = createRef<Txt>();

  private readonly origin: number;
  private readonly minValue: number;
  private readonly maxValue: number;
  private readonly axisWidth: number;
  private readonly formatValue: (value: number) => string;
  private currentValue: number;

  public constructor(props: NumberAxisProps) {
    const {
      origin = 0,
      leftSpan = 8,
      rightSpan = 8,
      width = 520,
      tickStep = 1,
      initialValue,
      formatValue = (v) => String(v),
      axisColor = Ink.line,
      cursorColor = Ink.seal,
      fontSize = 28,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.origin = origin;
    this.minValue = origin - leftSpan;
    this.maxValue = origin + rightSpan;
    this.axisWidth = width;
    this.formatValue = formatValue;
    this.currentValue = this.clamp(
      initialValue ?? origin,
    );

    const tickH = 10;
    const originTickH = 16;
    const axisY = 0;

    this.add(
      <Layout
        ref={this.track}
        layout={false}
        width={width}
        height={96}
      >
        {/* 主轴线 */}
        <Line
          points={[
            [-width / 2, axisY],
            [width / 2, axisY],
          ]}
          stroke={axisColor}
          lineWidth={Ink.lineWidth}
          lineCap={"round"}
          endArrow
          arrowSize={10}
        />
        {/* 左端短箭头感：左端小帽 */}
        <Line
          points={[
            [-width / 2, axisY],
            [-width / 2 + 10, axisY],
          ]}
          stroke={axisColor}
          lineWidth={Ink.lineWidth}
          startArrow
          arrowSize={10}
        />

        {/* 刻度 */}
        {this.buildTicks(tickStep, tickH, originTickH, axisY, axisColor)}

        {/* 原点数值标注 */}
        <Txt
          text={String(origin)}
          fontFamily={"JetBrains Mono, Consolas, monospace"}
          fontSize={Math.round(fontSize * 0.75)}
          fill={Ink.goldSoft}
          x={this.valueToX(origin)}
          y={axisY + 28}
        />

        {/* 游标：倒三角指轴线 */}
        <Layout
          ref={this.cursor}
          x={this.valueToX(this.currentValue)}
          y={axisY - 18}
          layout={false}
        >
          <Line
            points={[
              [0, 14],
              [-9, -4],
              [9, -4],
            ]}
            closed
            fill={cursorColor}
            stroke={cursorColor}
            lineWidth={1}
          />
        </Layout>

        {/* 下方读数 */}
        <Txt
          ref={this.readout}
          text={formatValue(this.currentValue)}
          fontFamily={"JetBrains Mono, Consolas, monospace"}
          fontSize={fontSize}
          fill={Ink.paper}
          y={axisY + 58}
        />
      </Layout>,
    );
  }

  public getValue(): number {
    return this.currentValue;
  }

  /** 游标移到绝对数值，同步更新下方读数 */
  public *moveCursor(value: number, duration = 0.55): ThreadGenerator {
    const target = this.clamp(value);
    this.currentValue = target;
    this.readout().text(this.formatValue(target));
    yield* this.cursor().x(this.valueToX(target), duration, easeInOutCubic);
  }

  /**
   * 按路径依次移动游标（适合来回演示）。
   * @param values 绝对数值序列
   * @param stepDuration 每段时长
   * @param hold 到达后短暂停顿
   */
  public *travel(
    values: number[],
    stepDuration = 0.55,
    hold = 0.2,
  ): ThreadGenerator {
    for (const v of values) {
      yield* this.moveCursor(v, stepDuration);
      if (hold > 0) {
        yield* waitFor(hold);
      }
    }
  }

  private clamp(value: number): number {
    return Math.min(this.maxValue, Math.max(this.minValue, value));
  }

  private valueToX(value: number): number {
    const t =
      (value - this.minValue) / (this.maxValue - this.minValue);
    return -this.axisWidth / 2 + t * this.axisWidth;
  }

  private buildTicks(
    tickStep: number,
    tickH: number,
    originTickH: number,
    axisY: number,
    axisColor: string,
  ): Node[] {
    const ticks: Node[] = [];
    const start =
      Math.ceil(this.minValue / tickStep) * tickStep;
    for (let v = start; v <= this.maxValue + 1e-9; v += tickStep) {
      const x = this.valueToX(v);
      const isOrigin = Math.abs(v - this.origin) < 1e-9;
      const h = isOrigin ? originTickH : tickH;
      ticks.push(
        <Line
          points={[
            [x, axisY - h / 2],
            [x, axisY + h / 2],
          ]}
          stroke={isOrigin ? Ink.goldSoft : axisColor}
          lineWidth={isOrigin ? 2.5 : Ink.lineWidth}
          lineCap={"round"}
        />,
      );
    }
    return ticks;
  }
}
