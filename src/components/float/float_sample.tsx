import {
  Latex,
  Layout,
  Node,
  NodeProps,
  Rect,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

export type FloatPartId = 'sign' | 'integer' | 'frac';

export interface ParsedFloat {
  /** 符号文本：'-' | '+' */
  sign: string;
  /** 整数部分（不含符号） */
  integer: string;
  /** 小数部分（不含点；无小数则为 ''） */
  frac: string;
}

/** 解析演示用浮点字符串/数字，拆成符号、整数、小数三部分（正数也带 +） */
export function parseDemoFloat(value: number | string): ParsedFloat {
  const raw = String(value).trim().replace(/^−/, '-');
  const m = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!m) {
    throw new Error(`无法解析演示浮点数: ${value}`);
  }
  const sign = m[1] === '-' ? '-' : '+';
  return {
    sign,
    integer: m[2],
    frac: m[3] ?? '',
  };
}

/** IEEE 754 符号位：负数为 1，否则为 0 */
export function ieeeSignBit(value: number | string): '0' | '1' {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return n < 0 || Object.is(n, -0) ? '1' : '0';
}

/** 非负整数 → 二进制（无前导零，0 → "0"） */
export function intToBinary(intStr: string): string {
  const n = Math.abs(Math.trunc(Number(intStr)));
  return n.toString(2);
}

/**
 * 小数部分字符串（如 "32" 表示 0.32）→ 二进制小数位串（不含点）。
 * 逐次 ×2 取整，默认保留 bits 位。
 */
export function fracToBinary(fracStr: string, bits = 10): string {
  if (!fracStr) return '';
  let x = Number(`0.${fracStr}`);
  if (!Number.isFinite(x) || x <= 0) return '0'.repeat(Math.max(bits, 1));
  let out = '';
  for (let i = 0; i < bits; i++) {
    x *= 2;
    if (x >= 1) {
      out += '1';
      x -= 1;
    } else {
      out += '0';
    }
    if (x < 1e-15) {
      out += '0'.repeat(bits - i - 1);
      break;
    }
  }
  return out;
}

/** 由二进制整数+小数得到规格化形式与指数 */
export function normalizeBinary(
  intBin: string,
  fracBin: string,
): {mantissa: string; exponent: number} {
  const all = intBin + fracBin;
  const firstOne = all.indexOf('1');
  if (firstOne < 0) {
    return {mantissa: `0.${'0'.repeat(Math.max(fracBin.length, 1))}`, exponent: 0};
  }
  const exp = intBin.length - (firstOne + 1);
  const shifted = all.slice(firstOne); // 以 1 开头
  const mantissa = `${shifted[0]}.${shifted.slice(1) || '0'}`;
  return {mantissa, exponent: exp};
}

export interface FloatSampleProps extends NodeProps {
  /** 演示数值，如 -9.32 或 '-9.32' */
  value: number | string;
  /** LaTeX 字号 */
  fontSize?: number;
  /** 默认文字色 */
  fill?: string;
  /** 边框色 */
  stroke?: string;
  /** 底色 */
  background?: string;
  /** 内边距 [x, y] */
  padding?: [number, number];
}

/**
 * 带边框的演示浮点数（全程 LaTeX，边框随 layout 自适应）。
 * 规格化：右侧箭头 → 规格化结果 → 原式与箭头淡出，结果居中。
 */
export class FloatSample extends Node {
  private readonly stage = createRef<Layout>();
  private readonly srcFrame = createRef<Rect>();
  private readonly signTex = createRef<Latex>();
  private readonly integerTex = createRef<Latex>();
  private readonly pointTex = createRef<Latex>();
  private readonly fracTex = createRef<Latex>();

  private readonly arrow = createRef<Latex>();
  private readonly normFrame = createRef<Rect>();
  /** 规格化结果主体，如 -1.001\times 2 */
  private readonly normBody = createRef<Latex>();
  /** 指数部分 ^{N}，可单独呼吸高亮 */
  private readonly normExp = createRef<Latex>();

  private readonly parsed: ParsedFloat;
  private readonly baseFill: string;
  private readonly fontSize: number;
  private readonly strokeColor: string;
  private readonly bgColor: string;
  private readonly pad: [number, number];

  private binaryInteger = '';
  private binaryFrac = '';
  private normExponent = 0;
  private normMantissa = '';

  public constructor(props: FloatSampleProps) {
    const {
      value,
      fontSize = 56,
      fill = '#e8eef7',
      stroke = '#2a3a4c',
      background = '#121820',
      padding = [28, 16] as [number, number],
      opacity = 0,
      ...rest
    } = props;

    super({opacity, ...rest});

    this.parsed = parseDemoFloat(value);
    this.baseFill = fill;
    this.fontSize = fontSize;
    this.strokeColor = stroke;
    this.bgColor = background;
    this.pad = padding;

    const hasFrac = !!this.parsed.frac;

    // 初始仅原式居中；箭头与结果稍后插入 stage，避免提前占宽
    this.add(
      <Layout
        ref={this.stage}
        layout
        direction={'row'}
        alignItems={'center'}
        gap={28}
      >
        <Rect
          ref={this.srcFrame}
          layout
          direction={'row'}
          alignItems={'center'}
          justifyContent={'center'}
          padding={[padding[1], padding[0]]}
          fill={background}
          stroke={stroke}
          lineWidth={2}
          radius={10}
          gap={2}
        >
          <Latex
            ref={this.signTex}
            tex={[this.parsed.sign]}
            fill={fill}
            fontSize={fontSize}
          />
          <Latex
            ref={this.integerTex}
            tex={[this.parsed.integer]}
            fill={fill}
            fontSize={fontSize}
          />
          <Latex
            ref={this.pointTex}
            tex={['.']}
            fill={fill}
            fontSize={fontSize}
            opacity={hasFrac ? 1 : 0}
          />
          <Latex
            ref={this.fracTex}
            tex={[this.parsed.frac || '\\phantom{0}']}
            fill={fill}
            fontSize={fontSize}
            opacity={hasFrac ? 1 : 0}
          />
        </Rect>
      </Layout>,
    );

    this.add(
      <Latex
        ref={this.arrow}
        tex={['\\Rightarrow']}
        fill={fill}
        fontSize={fontSize * 0.85}
        opacity={0}
      />,
    );

    this.add(
      <Rect
        ref={this.normFrame}
        layout
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        padding={[padding[1], padding[0]]}
        fill={background}
        stroke={stroke}
        lineWidth={2}
        radius={10}
        opacity={0}
        scale={0.94}
        gap={0}
      >
        <Latex
          ref={this.normBody}
          tex={['']}
          fill={fill}
          fontSize={fontSize * 0.85}
        />
        <Latex
          ref={this.normExp}
          tex={['']}
          fill={fill}
          fontSize={fontSize * 0.85}
        />
      </Rect>,
    );
  }

  public get parts(): ParsedFloat {
    return this.parsed;
  }

  public get binInteger(): string {
    return this.binaryInteger;
  }

  public get binFrac(): string {
    return this.binaryFrac;
  }

  public get normalizeExponent(): number {
    return this.normExponent;
  }

  public get normalizedMantissa(): string {
    return this.normMantissa;
  }

  public part(id: FloatPartId): Latex {
    if (id === 'sign') return this.signTex();
    if (id === 'integer') return this.integerTex();
    return this.fracTex();
  }

  public *show(duration = 0.4): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration, easeOutCubic),
    );
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* this.opacity(0, duration, easeOutCubic);
  }

  /** 整数 / 小数改为二进制 LaTeX（小数点仍为独立节点） */
  public *toBinary(duration = 0.5, fracBits = 10): ThreadGenerator {
    this.binaryInteger = intToBinary(this.parsed.integer);
    this.binaryFrac = this.parsed.frac
      ? fracToBinary(this.parsed.frac, fracBits)
      : '';

    const hasFrac = this.binaryFrac.length > 0;

    yield* all(
      this.integerTex().tex([this.binaryInteger], duration, easeOutCubic),
      this.pointTex().opacity(hasFrac ? 1 : 0, duration * 0.4, easeOutCubic),
      this.fracTex().opacity(hasFrac ? 1 : 0, duration * 0.4, easeOutCubic),
      hasFrac
        ? this.fracTex().tex([this.binaryFrac], duration, easeOutCubic)
        : this.fracTex().tex(['\\phantom{0}'], 0),
    );
  }

  /**
   * 规格化演示：
   * 1) 原式移到左侧
   * 2) 再显示箭头
   * 3) 再显示规格化结果（含 ×2^e）
   * 4) 原式与箭头淡出，结果移到居中
   */
  public *normalize(accent = '#ffb454', duration = 0.55): ThreadGenerator {
    if (!this.binaryInteger && !this.binaryFrac) return;

    const {mantissa, exponent} = normalizeBinary(
      this.binaryInteger,
      this.binaryFrac,
    );
    this.normMantissa = mantissa;
    this.normExponent = exponent;

    // 拆成主体 + ^{N}，便于单独高亮指数
    if (exponent === 0) {
      this.normBody().tex([`${this.parsed.sign}${mantissa}`]);
      this.normExp().tex(['']);
      this.normExp().opacity(0);
    } else {
      this.normBody().tex([`${this.parsed.sign}${mantissa}\\times 2`]);
      this.normExp().tex([`^{${exponent}}`]);
      this.normExp().opacity(1);
    }
    this.normFrame().stroke(accent);

    // 切到左锚定（无跳变），向右展开时原式不跟着挤
    const srcW = this.srcFrame().width();
    this.stage().offset([-1, 0]);
    this.stage().x(-srcW / 2);
    yield;

    // 1) 原式先移到左侧
    yield* this.stage().x(-560, 0.5, easeInOutCubic);
    yield* waitFor(0.15);

    // 2) 插入箭头并显示
    this.stage().add(this.arrow());
    yield;
    yield* all(
      this.arrow().opacity(1, 0.35, easeOutCubic),
      this.arrow().fill(accent, 0.35, easeOutCubic),
    );
    yield* waitFor(0.2);

    // 3) 插入规格化结果并显示
    this.stage().add(this.normFrame());
    yield;
    yield* all(
      this.normFrame().opacity(1, duration, easeOutCubic),
      this.normFrame().scale(1, duration, easeOutCubic),
    );

    // 4) 原式 + 箭头 + 结果 作为整体居中
    const leftX = this.stage().x();
    const groupW = this.stage().width();
    const visualCenter = leftX + groupW / 2;
    this.stage().offset([0, 0]);
    this.stage().x(visualCenter);
    yield;
    yield* this.stage().x(0, 0.5, easeInOutCubic);
    yield* waitFor(0.55);

    // 5) 先淡出原式与箭头；结果脱离 layout 后再平滑移到中间（避免 remove 导致突变）
    const normWorld = this.normFrame().absolutePosition();
    const center = this.absolutePosition();

    yield* all(
      this.srcFrame().opacity(0, 0.4, easeOutCubic),
      this.arrow().opacity(0, 0.4, easeOutCubic),
      this.normFrame().stroke(this.strokeColor, 0.4, easeOutCubic),
    );

    // 挂到根节点，保持当前世界坐标，不再受 stage layout 约束
    this.add(this.normFrame());
    this.normFrame().absolutePosition(normWorld);
    this.srcFrame().remove();
    this.arrow().remove();
    this.stage().remove();
    yield;

    yield* this.normFrame().absolutePosition(center, 0.55, easeInOutCubic);
    this.normFrame().position(0, 0);
    yield* waitFor(0.25);

    // 6) 指数 N 呼吸高亮两次
    if (exponent !== 0) {
      yield* this.breatheExponent(accent, 2);
    }
  }

  /** 对 2^N 中的 N（^{N} 节点）做呼吸高亮 */
  public *breatheExponent(color: string, times = 2): ThreadGenerator {
    const exp = this.normExp();
    for (let i = 0; i < times; i++) {
      yield* all(
        exp.fill(color, 0.32, easeOutCubic),
        exp.scale(1.4, 0.32, easeOutCubic),
      );
      yield* all(
        exp.fill(this.baseFill, 0.32, easeOutCubic),
        exp.scale(1, 0.32, easeOutCubic),
      );
      if (i < times - 1) {
        yield* waitFor(0.08);
      }
    }
  }

  public *highlight(
    id: FloatPartId | null,
    color: string,
    duration = 0.35,
  ): ThreadGenerator {
    const ids: FloatPartId[] = ['sign', 'integer', 'frac'];
    yield* all(
      ...ids.map(p => {
        if (p === 'frac') {
          // 小数高亮时连同小数点
          return all(
            this.part(p).fill(p === id ? color : this.baseFill, duration, easeOutCubic),
            this.pointTex().fill(
              id === 'frac' ? color : this.baseFill,
              duration,
              easeOutCubic,
            ),
          );
        }
        return this.part(p).fill(
          p === id ? color : this.baseFill,
          duration,
          easeOutCubic,
        );
      }),
    );
  }
}
