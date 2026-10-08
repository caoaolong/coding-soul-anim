import {
  Latex,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const DEEP = '#121820';
const LINE = '#2a3a4c';
const ACCENT = '#7aa2ff';
const REM = '#ffb454';

export interface IntDivStep {
  /** 被除数 */
  dividend: number;
  /** 商 */
  quotient: number;
  /** 余数 0|1 */
  remainder: 0 | 1;
}

/** 计算整数 ÷2 取余的每一步（余数自下而上拼成二进制） */
export function buildIntDivSteps(value: number | string): IntDivStep[] {
  let n = Math.abs(Math.trunc(Number(value)));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`无效整数: ${value}`);
  }
  if (n === 0) {
    return [{dividend: 0, quotient: 0, remainder: 0}];
  }
  const steps: IntDivStep[] = [];
  while (n > 0) {
    const remainder = (n % 2) as 0 | 1;
    const quotient = Math.floor(n / 2);
    steps.push({dividend: n, quotient, remainder});
    n = quotient;
  }
  return steps;
}

export function stepsToBinary(steps: IntDivStep[]): string {
  return [...steps].reverse().map(s => String(s.remainder)).join('');
}

export interface IntToBinaryBoardProps extends NodeProps {
  /** 十进制整数（非负；符号由外层处理） */
  value: number | string;
  /** 标题，默认「整数 → 二进制」 */
  title?: string;
  /** 公式字号 */
  fontSize?: number;
  /** 行距 */
  rowGap?: number;
  /** 卡片固定高度（用于双侧对齐）；不传则随内容 */
  cardHeight?: number;
  /** 卡片最小宽度 */
  cardWidth?: number;
}

/**
 * 十进制整数转二进制步骤表：卡内逐步 ÷2 取余，
 * 余数自下而上飞到卡片下方拼成结果。
 */
export class IntToBinaryBoard extends Node {
  private readonly root = createRef<Layout>();
  private readonly panel = createRef<Rect>();
  private readonly titleTxt = createRef<Txt>();
  private readonly rows = createRefArray<Layout>();
  private readonly remLatex = createRefArray<Latex>();
  private readonly resultRow = createRef<Layout>();
  private readonly resultSlots = createRefArray<Txt>();
  private readonly resultSub = createRef<Txt>();

  private readonly steps: IntDivStep[];
  private readonly binary: string;
  private readonly fontSize: number;
  private readonly accent = ACCENT;
  private readonly remColor = REM;

  public constructor(props: IntToBinaryBoardProps) {
    const {
      value,
      title = '整数 → 二进制',
      fontSize = 40,
      rowGap = 22,
      cardHeight,
      cardWidth = 520,
      opacity = 0,
      ...rest
    } = props;

    super({opacity, ...rest});

    this.steps = buildIntDivSteps(value);
    this.binary = stepsToBinary(this.steps);
    this.fontSize = fontSize;

    this.add(
      <Layout
        ref={this.root}
        layout
        direction={'column'}
        alignItems={'center'}
        gap={16}
      >
        {/* 标题在卡片外上方，居中 */}
        <Txt
          ref={this.titleTxt}
          text={title}
          fontFamily={FONT}
          fontSize={32}
          fontWeight={700}
          fill={PAPER}
          opacity={0}
        />

        {/* 卡片：仅步骤 */}
        <Rect
          ref={this.panel}
          layout
          direction={'column'}
          alignItems={'start'}
          justifyContent={'start'}
          gap={22}
          padding={[28, 36]}
          width={cardWidth}
          {...(cardHeight != null ? {height: cardHeight} : {})}
          fill={DEEP}
          stroke={LINE}
          lineWidth={2}
          radius={14}
          clip
        >
          <Layout layout direction={'column'} gap={rowGap} alignItems={'start'}>
            {this.steps.map(step => (
              <Layout
                ref={this.rows}
                layout
                direction={'row'}
                alignItems={'center'}
                gap={16}
                opacity={0}
                scale={0.92}
              >
                <Latex
                  tex={[
                    `${step.dividend}\\div 2 = ${step.quotient}\\cdots`,
                  ]}
                  fill={PAPER}
                  fontSize={fontSize}
                />
                <Latex
                  ref={this.remLatex}
                  tex={[String(step.remainder)]}
                  fill={this.remColor}
                  fontSize={fontSize}
                />
              </Layout>
            ))}
          </Layout>
        </Rect>

        {/* 必须参与纵向 layout，才会落在卡片正下方（layout=false 会回到父级中心） */}
        <Layout
          ref={this.resultRow}
          layout
          direction={'row'}
          alignItems={'center'}
          justifyContent={'center'}
          gap={4}
          width={cardWidth}
          height={fontSize + 16}
        >
          {this.binary.split('').map(ch => (
            <Txt
              ref={this.resultSlots}
              text={ch}
              fontFamily={FONT}
              fontSize={fontSize}
              fontWeight={700}
              fill={this.accent}
              width={fontSize * 0.55}
              opacity={0}
            />
          ))}
          <Txt
            ref={this.resultSub}
            text={'(2)'}
            fontFamily={FONT}
            fontSize={fontSize * 0.55}
            fill={this.accent}
            opacity={0}
          />
        </Layout>
      </Layout>,
    );
  }

  public get binaryResult(): string {
    return this.binary;
  }

  public get stepData(): IntDivStep[] {
    return this.steps;
  }

  public panelHeight(): number {
    return this.panel().height();
  }

  public setCardHeight(height: number) {
    this.panel().height(height);
  }

  public *show(duration = 0.4): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.titleTxt().opacity(1, duration, easeOutCubic),
    );
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* this.opacity(0, duration, easeOutCubic);
  }

  /** 逐步弹出每一行，再将余数自下而上飞到卡片下方 */
  public *run(stepHold = 0.35): ThreadGenerator {
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const rem = this.remLatex[i];
      yield* all(
        row.opacity(1, 0.35, easeOutCubic),
        row.scale(1, 0.4, easeOutCubic),
      );
      yield* all(
        rem.scale(1.35, 0.22, easeOutCubic),
        rem.fill('#fff0c8', 0.22, easeOutCubic),
      );
      yield* all(
        rem.scale(1, 0.22, easeOutCubic),
        rem.fill(this.remColor, 0.22, easeOutCubic),
      );
      yield* waitFor(stepHold);
    }

    yield* waitFor(0.25);

    // 自下而上：最后一行余数 → 结果最高位
    const n = this.remLatex.length;
    for (let i = n - 1; i >= 0; i--) {
      const slotIndex = n - 1 - i;
      yield* this.flyDigitToSlot(
        this.remLatex[i],
        this.resultSlots[slotIndex],
        String(this.steps[i].remainder),
        this.remColor,
      );
      yield* waitFor(0.08);
    }

    yield* this.resultSub().opacity(1, 0.3, easeOutCubic);
  }

  private *flyDigitToSlot(
    from: Latex,
    slot: Txt,
    text: string,
    color: string,
    duration = 0.5,
  ): ThreadGenerator {
    const flyer = createRef<Txt>();
    // 先读终点再读起点，避免 layout 未结算
    yield;
    const end = slot.absolutePosition();
    const start = from.absolutePosition();

    // 挂到 view 上，绝对坐标才与源节点同一坐标系（参见 byte_inc）
    this.view().add(
      <Txt
        ref={flyer}
        text={text}
        fontFamily={FONT}
        fontSize={this.fontSize}
        fontWeight={700}
        fill={color}
        zIndex={100}
        opacity={1}
      />,
    );
    flyer().absolutePosition(start);

    yield* all(
      flyer().absolutePosition(end, duration, easeInOutCubic),
      flyer().fill(this.accent, duration, easeOutCubic),
      from.opacity(0.3, duration * 0.6, easeOutCubic),
    );

    slot.opacity(1);
    flyer().remove();
  }
}
