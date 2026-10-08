import {
  Circle,
  Line,
  Node,
  NodeProps,
  Txt,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

export type LogicOp = 'AND' | 'OR' | 'NOT';

export interface LogicFlowProps extends NodeProps {
  /** 运算符 */
  op?: LogicOp;
  /** 列标题，如「与」 */
  title?: string;
  /** 列宽，默认 420 */
  columnWidth?: number;
}

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE_C = '#2a3a4c';
const OFF = '#3a4555';
const MUTED = '#8a9bb0';

const NODE_R = 36;
const IN_X = -140;
const OUT_X = 140;
/** 直角拐点的竖干 x */
const BUS_X = 0;

function evalOp(op: LogicOp, inputs: number[]): number {
  if (op === 'NOT') return inputs[0] ? 0 : 1;
  if (op === 'AND') return inputs[0] && inputs[1] ? 1 : 0;
  return inputs[0] || inputs[1] ? 1 : 0;
}

function bitColor(v: number) {
  return v ? ACCENT : OFF;
}

/** 直角折线：左出 → 横到总线 → 竖到出口高度 → 横到右入 */
function elbowPoints(inY: number): Vector2[] {
  const from = new Vector2(IN_X + NODE_R, inY);
  const to = new Vector2(OUT_X - NODE_R, 0);
  if (Math.abs(inY) < 0.5) {
    // 同高度：纯水平
    return [from, to];
  }
  return [
    from,
    new Vector2(BUS_X, inY),
    new Vector2(BUS_X, 0),
    to,
  ];
}

/**
 * 逻辑运算流程图：左输入 → 直角连线标运算符 → 右输出。
 * AND/OR 双输入，NOT 单输入；节点显示 0/1。
 */
export class LogicFlow extends Node {
  @initial('AND')
  @signal()
  public declare readonly op: SimpleSignal<LogicOp, this>;

  @initial('')
  @signal()
  public declare readonly title: SimpleSignal<string, this>;

  @initial(420)
  @signal()
  public declare readonly columnWidth: SimpleSignal<number, this>;

  private readonly titleTxt = createRef<Txt>();
  private readonly outCircle = createRef<Circle>();
  private readonly outTxt = createRef<Txt>();
  private readonly inCircles = createRefArray<Circle>();
  private readonly inTxts = createRefArray<Txt>();
  private readonly wires = createRefArray<Line>();
  private readonly opLabels = createRefArray<Txt>();

  private inputCount = 2;
  private values: number[] = [0, 0];

  public constructor(props?: LogicFlowProps) {
    super({opacity: 0, ...props});

    const op = props?.op ?? 'AND';
    this.inputCount = op === 'NOT' ? 1 : 2;
    this.values = op === 'NOT' ? [0] : [0, 0];

    const inYs = this.inputCount === 1 ? [0] : [-70, 70];

    this.add(
      <Txt
        ref={this.titleTxt}
        text={() => this.title() || opTitle(this.op())}
        fontFamily={FONT}
        fontSize={34}
        fontWeight={700}
        fill={PAPER}
        y={-200}
        opacity={0}
      />,
    );

    // 直角连线 + 运算符标签（先画，压在节点下）
    for (let i = 0; i < this.inputCount; i++) {
      const pts = elbowPoints(inYs[i]);

      this.add(
        <Line
          ref={this.wires}
          points={pts}
          stroke={LINE_C}
          lineWidth={3}
          lineCap={'round'}
          lineJoin={'miter'}
          radius={0}
          end={0}
          opacity={0.9}
        />,
      );

      // 双输入：运算符标在总线旁；单输入：标在水平线上方
      const labelPos =
        this.inputCount === 1
          ? new Vector2((IN_X + OUT_X) / 2, -28)
          : new Vector2(BUS_X + 36, i === 0 ? -36 : 36);

      this.add(
        <Txt
          ref={this.opLabels}
          text={op}
          fontFamily={FONT}
          fontSize={22}
          fontWeight={700}
          fill={MUTED}
          position={labelPos}
          opacity={0}
        />,
      );
    }

    // 输入节点
    for (let i = 0; i < this.inputCount; i++) {
      this.add(
        <Circle
          ref={this.inCircles}
          x={IN_X}
          y={inYs[i]}
          size={NODE_R * 2}
          fill={DEEP}
          stroke={LINE_C}
          lineWidth={2.5}
          opacity={0}
          scale={0.85}
        >
          <Txt
            ref={this.inTxts}
            text={'0'}
            fontFamily={FONT}
            fontSize={32}
            fontWeight={700}
            fill={PAPER}
          />
        </Circle>,
      );
    }

    // 输出节点
    this.add(
      <Circle
        ref={this.outCircle}
        x={OUT_X}
        y={0}
        size={NODE_R * 2}
        fill={DEEP}
        stroke={LINE_C}
        lineWidth={2.5}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={this.outTxt}
          text={'0'}
          fontFamily={FONT}
          fontSize={32}
          fontWeight={700}
          fill={PAPER}
        />
      </Circle>,
    );
  }

  /** 整列淡入结构（标题 + 节点 + 连线），输入输出先显示 0 */
  public *reveal(duration = 0.45): ThreadGenerator {
    yield* this.opacity(1, 0.2, easeOutCubic);
    yield* this.titleTxt().opacity(1, duration * 0.7, easeOutCubic);

    yield* all(
      ...this.inCircles.map(c =>
        all(
          c.opacity(1, duration, easeOutCubic),
          c.scale(1, duration * 1.1, easeOutCubic),
        ),
      ),
      all(
        this.outCircle().opacity(1, duration, easeOutCubic),
        this.outCircle().scale(1, duration * 1.1, easeOutCubic),
      ),
    );

    yield* all(
      ...this.wires.map(w => w.end(1, duration * 1.1, easeInOutCubic)),
      ...this.opLabels.map((lbl, i) =>
        this.inputCount === 1 || i === 0
          ? lbl.opacity(1, duration * 0.8, easeOutCubic)
          : lbl.opacity(0, 0),
      ),
    );
  }

  /** 设置输入并更新输出；输入与结果几乎同时高亮（模拟电信号瞬时传递） */
  public *apply(inputs: number[], duration = 0.4): ThreadGenerator {
    const op = this.op();
    const next = inputs.slice(0, this.inputCount);
    this.values = next;
    const out = evalOp(op, next);

    const active =
      op === 'AND'
        ? next.every(v => v === 1)
        : op === 'OR'
          ? next.some(v => v === 1)
          : true;

    const settleStroke = bitColor(out);
    const settleFill = out ? ACCENT : PAPER;
    const rise = duration * 0.5;
    const fall = duration * 0.5;

    // 上升沿：输入、连线、运算符、输出同时点亮
    yield* all(
      ...next.map((v, i) =>
        all(
          this.inTxts[i].text(String(v), rise * 0.7),
          this.inTxts[i].fill(v ? ACCENT : PAPER, rise),
          this.inCircles[i].stroke(bitColor(v), rise),
          this.inCircles[i].scale(1.12, rise, easeOutCubic),
          this.wires[i].stroke(bitColor(v), rise, easeInOutCubic),
        ),
      ),
      this.opLabels[0].fill(active && out === 1 ? ACCENT : MUTED, rise),
      this.outTxt().text(String(out), rise * 0.7),
      this.outTxt().fill(ACCENT, rise),
      this.outTxt().scale(1.15, rise, easeOutCubic),
      this.outCircle().stroke(ACCENT, rise),
      this.outCircle().lineWidth(4, rise),
      this.outCircle().scale(1.22, rise, easeOutCubic),
    );

    // 回落：输出落到稳态色，输入尺度收回
    yield* all(
      ...this.inCircles.map(c => c.scale(1, fall, easeInOutCubic)),
      this.outCircle().scale(1, fall, easeInOutCubic),
      this.outCircle().stroke(settleStroke, fall, easeInOutCubic),
      this.outCircle().lineWidth(2.5, fall, easeInOutCubic),
      this.outTxt().fill(settleFill, fall, easeInOutCubic),
      this.outTxt().scale(1, fall, easeInOutCubic),
    );
  }

  /** 按用例序列演示 */
  public *demo(cases: number[][], hold = 0.85): ThreadGenerator {
    for (const c of cases) {
      yield* this.apply(c);
      yield* waitFor(hold);
    }
  }
}

function opTitle(op: LogicOp): string {
  if (op === 'AND') return '与 AND';
  if (op === 'OR') return '或 OR';
  return '非 NOT';
}
