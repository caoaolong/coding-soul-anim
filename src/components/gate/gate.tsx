import {
  Circle,
  Line,
  Node,
  NodeProps,
  Path,
  Shape,
  Txt,
} from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkPulseTxt, inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = Ink.font;
const BIT_FONT = "SF Mono, Consolas, monospace";

export type GateType = "and" | "or" | "not" | "xor";
export type Bit = 0 | 1;

export interface GateProps extends NodeProps {
  /** 门类型：与 / 或 / 非 / 异或 */
  type: GateType;
  /** 整体尺度，默认 140 */
  size?: number;
  /** 初始输入；NOT 长度 1，其余 2；默认全 0 */
  inputs?: Bit[];
  /** 是否显示 A/B、Y 标注，默认 true */
  showLabels?: boolean;
}

function arityOf(type: GateType): 1 | 2 {
  return type === "not" ? 1 : 2;
}

function evalGate(type: GateType, inputs: Bit[]): Bit {
  switch (type) {
    case "and":
      return (inputs[0] & inputs[1]) as Bit;
    case "or":
      return (inputs[0] | inputs[1]) as Bit;
    case "xor":
      return (inputs[0] ^ inputs[1]) as Bit;
    case "not":
      return (inputs[0] ^ 1) as Bit;
  }
}

function normalizeInputs(type: GateType, raw?: Bit[]): Bit[] {
  const n = arityOf(type);
  const src = raw ?? [];
  const out: Bit[] = [];
  for (let i = 0; i < n; i++) {
    out.push(src[i] === 1 ? 1 : 0);
  }
  return out;
}

function bitFill(bit: Bit): string {
  return bit === 1 ? Ink.goldSoft : Ink.paperSoft;
}

/**
 * IEEE 标准外形逻辑门：AND / OR / NOT / XOR。
 * 设输入后播简化信号流：输入翻位 → 门外形短闪 → 输出翻位。
 */
export class Gate extends Node {
  private readonly bodyParts = createRefArray<Shape>();
  private readonly inputWires = createRefArray<Line>();
  private readonly inputTxts = createRefArray<Txt>();
  private readonly outputWire = createRef<Line>();
  private readonly outputTxt = createRef<Txt>();
  private readonly bubble = createRef<Circle>();

  private readonly gateType: GateType;
  private readonly inputs: Bit[];
  private output: Bit;

  public constructor(props: GateProps) {
    const {
      type,
      size = 140,
      inputs: rawInputs,
      showLabels = true,
      ...nodeProps
    } = props;

    super({ opacity: 0, ...nodeProps });

    this.gateType = type;
    this.inputs = normalizeInputs(type, rawInputs);
    this.output = evalGate(type, this.inputs);

    const w = size * 0.55;
    const h = size * 0.38;
    const wire = size * 0.38;
    const bitFs = size * 0.28;
    const labelFs = size * 0.16;
    const stroke = Ink.blueDeep;
    const lw = Ink.lineWidth;

    // 门外形本地坐标：左缘约 x=0，输出端约 x=w（NOT 圆泡略超出）
    const bodyPaths = this.buildBodyPaths(type, w, h);

    this.add(
      <Node>
        {bodyPaths.map((data) => (
          <Path
            ref={this.bodyParts}
            data={data}
            stroke={stroke}
            lineWidth={lw}
            fill={null}
            lineCap={"round"}
            lineJoin={"round"}
            shadowColor={"#00000000"}
            shadowBlur={0}
          />
        ))}

        {type === "not" ? (
          <Circle
            ref={this.bubble}
            x={w * 0.78 + size * 0.055}
            y={0}
            width={size * 0.11}
            height={size * 0.11}
            stroke={stroke}
            lineWidth={lw}
            fill={Ink.deep}
            shadowColor={"#00000000"}
            shadowBlur={0}
          />
        ) : null}

        {/* 输入线 + 位值 */}
        {this.inputYs(type, h).map((y, i) => {
          const left = -wire;
          return (
            <Node>
              <Line
                ref={this.inputWires}
                points={[
                  [left, y],
                  [this.inputAttachX(type, w), y],
                ]}
                stroke={stroke}
                lineWidth={lw}
                lineCap={"round"}
              />
              <Txt
                ref={this.inputTxts}
                text={`${this.inputs[i]}`}
                x={left - bitFs * 0.55}
                y={y}
                fill={bitFill(this.inputs[i])}
                fontSize={bitFs}
                fontWeight={700}
                fontFamily={BIT_FONT}
                textAlign={"center"}
              />
              {showLabels ? (
                <Txt
                  text={i === 0 ? "A" : "B"}
                  x={left - bitFs * 0.55}
                  y={y - bitFs * 0.7}
                  fill={Ink.teal}
                  fontSize={labelFs}
                  fontWeight={700}
                  fontFamily={LABEL_FONT}
                  textAlign={"center"}
                />
              ) : null}
            </Node>
          );
        })}

        {/* 输出线 + 结果 */}
        {(() => {
          const tipX = this.outputTipX(type, w, size);
          const right = tipX + wire * 0.85;
          return (
            <Node>
              <Line
                ref={this.outputWire}
                points={[
                  [tipX, 0],
                  [right, 0],
                ]}
                stroke={stroke}
                lineWidth={lw}
                lineCap={"round"}
              />
              <Txt
                ref={this.outputTxt}
                text={`${this.output}`}
                x={right + bitFs * 0.55}
                y={0}
                fill={bitFill(this.output)}
                fontSize={bitFs}
                fontWeight={700}
                fontFamily={BIT_FONT}
                textAlign={"center"}
              />
              {showLabels ? (
                <Txt
                  text={"Y"}
                  x={right + bitFs * 0.55}
                  y={-bitFs * 0.7}
                  fill={Ink.teal}
                  fontSize={labelFs}
                  fontWeight={700}
                  fontFamily={LABEL_FONT}
                  textAlign={"center"}
                />
              ) : null}
            </Node>
          );
        })()}
      </Node>,
    );
  }

  public getInputs(): Bit[] {
    return [...this.inputs];
  }

  public getOutput(): Bit {
    return this.output;
  }

  /** 入场 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this, { duration, fromY: 14 });
  }

  /** 退场 */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* this.opacity(0, duration, easeInOutCubic);
  }

  /**
   * 一次性设置全部输入并播放求值动画。
   * NOT 传 1 个 bit，其余传 2 个。
   */
  public *setInputs(...bits: Bit[]): ThreadGenerator {
    const n = arityOf(this.gateType);
    if (bits.length !== n) {
      throw new Error(
        `Gate(${this.gateType}) 需要 ${n} 个输入，收到 ${bits.length}`,
      );
    }
    const next = bits.map((b) => (b === 1 ? 1 : 0)) as Bit[];
    yield* this.evaluate(next, 0.65);
  }

  /**
   * 改单个输入脚后重算输出并播放动画。
   * @param index 0=A，1=B（NOT 仅 0）
   */
  public *setInput(index: number, value: Bit): ThreadGenerator {
    const n = arityOf(this.gateType);
    const i = Math.max(0, Math.min(n - 1, Math.floor(index)));
    const next = [...this.inputs] as Bit[];
    next[i] = value === 1 ? 1 : 0;
    yield* this.evaluate(next, 0.65);
  }

  /** 输入翻位 → 门闪 → 输出翻位 */
  private *evaluate(nextInputs: Bit[], duration: number): ThreadGenerator {
    const nextOut = evalGate(this.gateType, nextInputs);
    const tIn = duration * 0.35;
    const tFlash = duration * 0.3;
    const tOut = duration * 0.35;

    // 1) 变更的输入翻位
    const flips: ThreadGenerator[] = [];
    for (let i = 0; i < nextInputs.length; i++) {
      if (nextInputs[i] !== this.inputs[i]) {
        flips.push(this.flipBitTxt(this.inputTxts[i], nextInputs[i], tIn));
      } else {
        // 未变也轻脉冲，提示已参与求值
        flips.push(
          inkPulseTxt(this.inputTxts[i], {
            duration: tIn * 0.8,
            scalePeak: 1.06,
            restore: bitFill(this.inputs[i]),
            color: nextInputs[i] === 1 ? Ink.gold : Ink.teal,
          }),
        );
      }
    }
    yield* all(...flips);
    for (let i = 0; i < nextInputs.length; i++) {
      this.inputs[i] = nextInputs[i];
    }

    // 2) 门外形短闪
    yield* this.flashBody(tFlash);

    // 3) 输出翻位（结果未变则脉冲确认）
    if (nextOut !== this.output) {
      yield* this.flipBitTxt(this.outputTxt(), nextOut, tOut);
      this.output = nextOut;
    } else {
      yield* inkPulseTxt(this.outputTxt(), {
        duration: tOut,
        scalePeak: 1.08,
        restore: bitFill(this.output),
        color: this.output === 1 ? Ink.gold : Ink.teal,
      });
    }
  }

  private *flipBitTxt(
    txt: Txt,
    to: Bit,
    duration: number,
  ): ThreadGenerator {
    const half = duration * 0.5;
    yield* txt.opacity(0, half, easeInOutCubic);
    txt.text(`${to}`);
    txt.fill(bitFill(to));
    yield* txt.opacity(1, half, easeOutCubic);
    yield* inkPulseTxt(txt, {
      duration: half * 0.9,
      scalePeak: 1.06,
      restore: bitFill(to),
      color: to === 1 ? Ink.gold : Ink.teal,
    });
  }

  private *flashBody(duration: number): ThreadGenerator {
    const up = duration * 0.4;
    const down = duration * 0.6;
    const parts: Shape[] = [...this.bodyParts];
    if (this.gateType === "not" && this.bubble()) {
      parts.push(this.bubble());
    }

    yield* all(
      ...parts.map((p) =>
        all(
          p.stroke(Ink.gold, up, easeOutCubic).to(Ink.blueDeep, down, easeInOutCubic),
          p.shadowColor(Ink.gold, up, easeOutCubic).to(
            "#00000000",
            down,
            easeInOutCubic,
          ),
          p.shadowBlur(14, up, easeOutCubic).to(0, down, easeInOutCubic),
        ),
      ),
    );
    // 稍顿，让闪完再出输出
    yield* waitFor(0.02);
  }

  private inputYs(type: GateType, h: number): number[] {
    if (type === "not") {
      return [0];
    }
    const dy = h * 0.48;
    return [-dy, dy];
  }

  private inputAttachX(type: GateType, w: number): number {
    // XOR 输入线接到第二弧内侧；其余接到左缘
    if (type === "xor") {
      return w * 0.02;
    }
    if (type === "or") {
      return w * 0.1;
    }
    return 0;
  }

  private outputTipX(type: GateType, w: number, size: number): number {
    if (type === "not") {
      return w * 0.78 + size * 0.11;
    }
    return w;
  }

  /** IEEE 门外形 SVG path（相对门体原点） */
  private buildBodyPaths(type: GateType, w: number, h: number): string[] {
    switch (type) {
      case "and": {
        // 左竖直 + 上下水平 + 右侧半圆
        const r = h;
        const cx = w - r;
        return [
          `M 0 ${-h} L ${cx} ${-h} A ${r} ${r} 0 0 1 ${cx} ${h} L 0 ${h} Z`,
        ];
      }
      case "or": {
        // 经典弧形或门
        return [
          [
            `M ${w * 0.06} ${-h}`,
            `C ${w * 0.45} ${-h} ${w * 0.72} ${-h * 0.4} ${w} 0`,
            `C ${w * 0.72} ${h * 0.4} ${w * 0.45} ${h} ${w * 0.06} ${h}`,
            `C ${w * 0.28} ${h * 0.42} ${w * 0.28} ${-h * 0.42} ${w * 0.06} ${-h}`,
          ].join(" "),
        ];
      }
      case "xor": {
        const body = [
          `M ${w * 0.14} ${-h}`,
          `C ${w * 0.5} ${-h} ${w * 0.74} ${-h * 0.4} ${w} 0`,
          `C ${w * 0.74} ${h * 0.4} ${w * 0.5} ${h} ${w * 0.14} ${h}`,
          `C ${w * 0.34} ${h * 0.42} ${w * 0.34} ${-h * 0.42} ${w * 0.14} ${-h}`,
        ].join(" ");
        // 左侧第二弧（异或特征）
        const arc = [
          `M ${-w * 0.02} ${-h}`,
          `C ${w * 0.18} ${-h * 0.42} ${w * 0.18} ${h * 0.42} ${-w * 0.02} ${h}`,
        ].join(" ");
        return [body, arc];
      }
      case "not": {
        // 三角形（尖端朝右）；圆泡用 Circle 另画
        const tip = w * 0.78;
        return [`M 0 ${-h} L 0 ${h} L ${tip} 0 Z`];
      }
    }
  }
}
