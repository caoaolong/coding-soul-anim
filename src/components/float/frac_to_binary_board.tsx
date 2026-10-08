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
const ACCENT = '#3dd6c6';
const BIT = '#ff6b8a';

export interface FracMulStep {
  /** ×2 前的小数（展示用，已截断） */
  before: number;
  /** ×2 后的完整值 */
  after: number;
  /** 取出的整数位 0|1 */
  bit: 0 | 1;
  /** 去掉整数位后留下的小数 */
  fracLeft: number;
}

/** 将展示用小数格式化为较短字符串（去尾零） */
function fmtFrac(x: number, digits = 6): string {
  if (x < 1e-12) return '0';
  const s = x.toFixed(digits);
  return s.replace(/\.?0+$/, '') || '0';
}

/**
 * 计算小数 ×2 取整的每一步。
 * @param frac 小数部分：字符串 "32" 表示 0.32，或直接传 0.32
 * @param bits ×2 次数 = 二进制小数位数（精度）
 */
export function buildFracMulSteps(
  frac: number | string,
  bits = 10,
): FracMulStep[] {
  let x: number;
  if (typeof frac === 'string') {
    const raw = frac.trim();
    x = raw.startsWith('0.') || raw.startsWith('.')
      ? Number(raw)
      : Number(`0.${raw}`);
  } else {
    x = frac;
    if (x >= 1) x = x - Math.trunc(x);
    if (x < 0) x = Math.abs(x);
  }

  if (!Number.isFinite(x) || x < 0) {
    throw new Error(`无效小数: ${frac}`);
  }

  const steps: FracMulStep[] = [];
  for (let i = 0; i < bits; i++) {
    if (x < 1e-15) {
      steps.push({before: 0, after: 0, bit: 0, fracLeft: 0});
      continue;
    }
    const before = x;
    const after = x * 2;
    const bit = (after >= 1 ? 1 : 0) as 0 | 1;
    const fracLeft = after - bit;
    steps.push({before, after, bit, fracLeft});
    x = fracLeft;
  }
  return steps;
}

export function fracStepsToBinary(steps: FracMulStep[]): string {
  return steps.map(s => String(s.bit)).join('');
}

export interface FracToBinaryBoardProps extends NodeProps {
  /**
   * 小数部分：`"32"` → 0.32，或传 `0.32`
   */
  value: number | string;
  /**
   * ×2 次数 = 二进制小数位数（精度），默认 10
   */
  bits?: number;
  /** 标题 */
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
 * 十进制小数转二进制步骤表：卡内逐步 ×2 取整，
 * 整数位从左到右飞到卡片下方拼成结果。
 */
export class FracToBinaryBoard extends Node {
  private readonly root = createRef<Layout>();
  private readonly panel = createRef<Rect>();
  private readonly titleTxt = createRef<Txt>();
  private readonly rows = createRefArray<Layout>();
  private readonly bitLatex = createRefArray<Latex>();
  private readonly resultRow = createRef<Layout>();
  private readonly resultPrefix = createRef<Txt>();
  private readonly resultSlots = createRefArray<Txt>();
  private readonly resultSub = createRef<Txt>();

  private readonly steps: FracMulStep[];
  private readonly binary: string;
  private readonly bits: number;
  private readonly fontSize: number;
  private readonly accent = ACCENT;
  private readonly bitColor = BIT;

  public constructor(props: FracToBinaryBoardProps) {
    const {
      value,
      bits = 10,
      title = '小数 → 二进制',
      fontSize = 34,
      rowGap = 22,
      cardHeight,
      cardWidth = 640,
      opacity = 0,
      ...rest
    } = props;

    super({opacity, ...rest});

    this.bits = bits;
    this.steps = buildFracMulSteps(value, bits);
    this.binary = fracStepsToBinary(this.steps);
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
          text={`${title}（${bits} 位）`}
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
                gap={14}
                opacity={0}
                scale={0.92}
              >
                <Latex
                  tex={[
                    `${fmtFrac(step.before)}\\times 2 = ${fmtFrac(step.after)}\\;\\Rightarrow`,
                  ]}
                  fill={PAPER}
                  fontSize={fontSize}
                />
                <Latex
                  ref={this.bitLatex}
                  tex={[String(step.bit)]}
                  fill={this.bitColor}
                  fontSize={fontSize}
                />
              </Layout>
            ))}
          </Layout>
        </Rect>

        {/* 必须参与纵向 layout，才会落在卡片正下方 */}
        <Layout
          ref={this.resultRow}
          layout
          direction={'row'}
          alignItems={'center'}
          justifyContent={'center'}
          gap={4}
          width={cardWidth}
          height={fontSize + 18}
        >
          <Txt
            ref={this.resultPrefix}
            text={'0.'}
            fontFamily={FONT}
            fontSize={fontSize + 2}
            fontWeight={700}
            fill={this.accent}
            opacity={0}
          />
          {this.binary.split('').map(ch => (
            <Txt
              ref={this.resultSlots}
              text={ch}
              fontFamily={FONT}
              fontSize={fontSize + 2}
              fontWeight={700}
              fill={this.accent}
              width={(fontSize + 2) * 0.55}
              opacity={0}
            />
          ))}
          <Txt
            ref={this.resultSub}
            text={'(2)'}
            fontFamily={FONT}
            fontSize={(fontSize + 2) * 0.55}
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

  public get precisionBits(): number {
    return this.bits;
  }

  public get stepData(): FracMulStep[] {
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

  /** 逐步弹出每一行，再将整数位从左到右飞到卡片下方 */
  public *run(stepHold = 0.28): ThreadGenerator {
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const bit = this.bitLatex[i];
      yield* all(
        row.opacity(1, 0.32, easeOutCubic),
        row.scale(1, 0.36, easeOutCubic),
      );
      yield* all(
        bit.scale(1.35, 0.2, easeOutCubic),
        bit.fill('#ffd0da', 0.2, easeOutCubic),
      );
      yield* all(
        bit.scale(1, 0.2, easeOutCubic),
        bit.fill(this.bitColor, 0.2, easeOutCubic),
      );
      yield* waitFor(stepHold);
    }

    yield* waitFor(0.25);
    yield* this.resultPrefix().opacity(1, 0.25, easeOutCubic);

    // 从左到右飞入
    for (let i = 0; i < this.bitLatex.length; i++) {
      yield* this.flyDigitToSlot(
        this.bitLatex[i],
        this.resultSlots[i],
        String(this.steps[i].bit),
        this.bitColor,
      );
      yield* waitFor(0.06);
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
    yield;
    const end = slot.absolutePosition();
    const start = from.absolutePosition();

    // 挂到 view 上，绝对坐标才与源节点同一坐标系（参见 byte_inc）
    this.view().add(
      <Txt
        ref={flyer}
        text={text}
        fontFamily={FONT}
        fontSize={this.fontSize + 2}
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
