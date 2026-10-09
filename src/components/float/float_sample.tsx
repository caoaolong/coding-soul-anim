import {
  Latex,
  Layout,
  Node,
  NodeProps,
  Rect,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
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
 * 规格化：原值上移淡出，新值从下方上移淡入；入场后再在框外右侧显示 ×2^e。
 */
export class FloatSample extends Node {
  private readonly stage = createRef<Layout>();
  private readonly srcFrame = createRef<Rect>();
  private readonly signTex = createRef<Latex>();
  private readonly integerTex = createRef<Latex>();
  private readonly pointTex = createRef<Latex>();
  private readonly fracTex = createRef<Latex>();

  private readonly arrow = createRef<Latex>();
  /** 非 layout 包裹层：规格化入场的位移在这里做，避免 Rect.layout 冲掉 y */
  private readonly normWrap = createRef<Node>();
  private readonly normFrame = createRef<Rect>();
  private readonly normSignTex = createRef<Latex>();
  private readonly normIntegerTex = createRef<Latex>();
  private readonly normPointTex = createRef<Latex>();
  private readonly normFracTex = createRef<Latex>();
  /** 小数位拆成单字符，用于「保留位」方框标注 */
  private readonly fracDigitRoot = createRef<Layout>();
  /** 框外右侧 ×2^{N}（入场完成后再显示；绝对定位） */
  private readonly suffixTex = createRef<Latex>();

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

    // 规格化数字框
    this.add(
      <Node ref={this.normWrap} opacity={0}>
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
          gap={2}
        >
          <Latex
            ref={this.normSignTex}
            tex={['']}
            fill={fill}
            fontSize={fontSize}
          />
          <Latex
            ref={this.normIntegerTex}
            tex={['']}
            fill={fill}
            fontSize={fontSize}
          />
          <Latex
            ref={this.normPointTex}
            tex={['.']}
            fill={fill}
            fontSize={fontSize}
          />
          <Latex
            ref={this.normFracTex}
            tex={['']}
            fill={fill}
            fontSize={fontSize}
          />
          <Layout
            ref={this.fracDigitRoot}
            layout
            direction={'row'}
            alignItems={'center'}
            gap={0}
          />
        </Rect>
      </Node>,
    );

    // ×2^e 整体挂在组件根上，绝对定位贴到框右缘
    this.add(
      <Latex
        ref={this.suffixTex}
        tex={['']}
        fill={fill}
        fontSize={fontSize}
        opacity={0}
        offset={[-1, 0]}
        zIndex={5}
      />,
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

  /**
   * IEEE 754 尾数域：规格化形式 1.f… 中小数点后的位串，
   * 截断/补零到 len 位（单精度 23）。
   */
  public mantissaFieldBits(len = 23): string {
    const dot = this.normMantissa.indexOf('.');
    let frac = dot >= 0 ? this.normMantissa.slice(dot + 1) : '';
    frac = frac.replace(/[^01]/g, '');
    if (frac.length < len) return frac.padEnd(len, '0');
    return frac.slice(0, len);
  }

  public part(id: FloatPartId): Latex {
    if (id === 'sign') return this.signTex();
    if (id === 'integer') return this.integerTex();
    return this.fracTex();
  }

  /** 规格化后数字框内的符号（原式 stage 已移除） */
  public normalizedSign(): Latex {
    return this.normSignTex();
  }

  /** 规格化后数字框内的小数位（尾数 f）；若已拆成单字符则返回 digit root */
  public normalizedFrac(): Node {
    if (this.fracDigitRoot().children().length > 0) {
      return this.fracDigitRoot();
    }
    return this.normFracTex();
  }

  /** 规格化小数整段 LaTeX（裁切恢复后可直接改 fill） */
  public normalizedFracTex(): Latex {
    return this.normFracTex();
  }

  /**
   * 将小数位拆成单字符：保留位正常色，要舍弃的位红色高亮。
   * 注意：整段 frac Latex 会退出 layout，避免仍占宽导致大空隙。
   */
  public *markFracDiscard(
    keepLen = 23,
    discardColor = '#ff6b8a',
    duration = 0.35,
  ): ThreadGenerator {
    const dot = this.normMantissa.indexOf('.');
    const full = (dot >= 0 ? this.normMantissa.slice(dot + 1) : '').replace(
      /[^01]/g,
      '',
    );
    if (!full) return;

    // 整段 frac 退出布局，否则 opacity=0 仍占位
    this.normFracTex().opacity(0);
    this.normFracTex().layout(false);

    this.fracDigitRoot().removeChildren();
    this.fracDigitRoot().layout(true);
    const discardDigits: Latex[] = [];

    for (let i = 0; i < full.length; i++) {
      const discard = i >= keepLen;
      const digitRef = createRef<Latex>();
      // 与框内整数/小数点同字号的 Latex，避免 Txt 视觉上偏小
      this.fracDigitRoot().add(
        <Latex
          ref={digitRef}
          tex={[full[i]]}
          fill={this.baseFill}
          fontSize={this.fontSize}
        />,
      );
      if (discard) {
        discardDigits.push(digitRef());
      }
    }
    yield;

    if (discardDigits.length === 0) return;
    yield* all(
      ...discardDigits.map(t =>
        t.fill(discardColor, duration, easeOutCubic),
      ),
    );
  }

  /** 删除已标红的舍弃位，保留前 len 位（就地删除，无淡入淡出） */
  public cropFracToMantissa(len = 23) {
    const bits = this.mantissaFieldBits(len);
    const dot = this.normMantissa.indexOf('.');
    const intPart =
      dot >= 0 ? this.normMantissa.slice(0, dot) : this.normMantissa;
    this.normMantissa = `${intPart}.${bits}`;

    // 清掉单字符，恢复整段 LaTeX 并重新参与 layout
    this.fracDigitRoot().removeChildren();
    this.normFracTex().tex([bits]);
    this.normFracTex().layout(true);
    this.normFracTex().opacity(1);
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

  /** 仅把整数部分换成二进制（小数先不动） */
  public *toIntegerBinary(duration = 0.5): ThreadGenerator {
    this.binaryInteger = intToBinary(this.parsed.integer);
    yield* this.integerTex().tex([this.binaryInteger], duration, easeOutCubic);
  }

  /** 仅把小数部分换成二进制（默认 23 位，对应单精度尾数） */
  public *toFracBinary(duration = 0.5, fracBits = 23): ThreadGenerator {
    this.binaryFrac = this.parsed.frac
      ? fracToBinary(this.parsed.frac, fracBits)
      : '';
    const hasFrac = this.binaryFrac.length > 0;
    yield* all(
      this.pointTex().opacity(hasFrac ? 1 : 0, duration * 0.4, easeOutCubic),
      this.fracTex().opacity(hasFrac ? 1 : 0, duration * 0.4, easeOutCubic),
      hasFrac
        ? this.fracTex().tex([this.binaryFrac], duration, easeOutCubic)
        : this.fracTex().tex(['\\phantom{0}'], 0),
    );
  }

  /** 整数 / 小数改为二进制 LaTeX（小数点仍为独立节点） */
  public *toBinary(duration = 0.5, fracBits = 23): ThreadGenerator {
    if (!this.binaryInteger) {
      this.binaryInteger = intToBinary(this.parsed.integer);
    }
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
   * 原值向上移出并淡出，规格化结果同时从下方上移淡入。
   */
  public *normalize(accent = '#ffb454', duration = 0.7): ThreadGenerator {
    if (!this.binaryInteger && !this.binaryFrac) return;

    const {mantissa, exponent} = normalizeBinary(
      this.binaryInteger,
      this.binaryFrac,
    );
    this.normMantissa = mantissa;
    this.normExponent = exponent;

    // 只显示规格化尾数，不再带 ×2^e 后缀；拆成与原式相同的符号/整数/点/小数
    const dot = mantissa.indexOf('.');
    const intPart = dot >= 0 ? mantissa.slice(0, dot) : mantissa;
    const fracPart = dot >= 0 ? mantissa.slice(dot + 1) : '';
    this.normSignTex().tex([this.parsed.sign]);
    this.normIntegerTex().tex([intPart]);
    this.normFracTex().tex([fracPart || '\\phantom{0}']);
    this.normPointTex().opacity(fracPart ? 1 : 0);
    this.normFracTex().opacity(fracPart ? 1 : 0);
    this.suffixTex().opacity(0);
    if (exponent !== 0) {
      this.suffixTex().tex([`\\times 2^{${exponent}}`]);
    } else {
      this.suffixTex().tex(['']);
    }

    // 框尺寸与原式一致，中心对齐原式（不因后缀而整体居中）
    yield;
    const boxW = this.srcFrame().width();
    const boxH = this.srcFrame().height();
    this.normFrame().minWidth(boxW);
    this.normFrame().minHeight(boxH);
    this.normFrame().width(boxW);
    this.normFrame().height(boxH);
    this.normFrame().position(0, 0);

    const slide = 80;
    this.normWrap().y(slide);
    this.normWrap().opacity(0);
    yield;

    yield* all(
      this.stage().y(-slide, duration, easeInOutCubic),
      this.stage().opacity(0, duration, easeOutCubic),
      this.normWrap().y(0, duration, easeInOutCubic),
      this.normWrap().opacity(1, duration, easeOutCubic),
    );
    this.stage().remove();
    this.arrow().remove();
    yield* waitFor(0.2);

    // 入场完成后：绝对定位到数字框右缘外侧，整体淡入并呼吸高亮
    if (exponent !== 0) {
      yield;
      const gap = 16;
      const frameAbs = this.normFrame().absolutePosition();
      const frameW = this.normFrame().width();
      this.suffixTex().absolutePosition(
        new Vector2(frameAbs.x + frameW / 2 + gap, frameAbs.y),
      );
      yield* this.suffixTex().opacity(1, 0.4, easeOutCubic);
      yield* waitFor(0.15);
      yield* this.breatheSuffix(accent, 1);
    } else {
      yield* waitFor(0.25);
    }
  }

  /** 对整段 ×2^e 做呼吸高亮 */
  public *breatheSuffix(color: string, times = 2): ThreadGenerator {
    const s = this.suffixTex();
    for (let i = 0; i < times; i++) {
      yield* all(
        s.fill(color, 0.32, easeOutCubic),
        s.scale(1.25, 0.32, easeOutCubic),
      );
      yield* all(
        s.fill(this.baseFill, 0.32, easeOutCubic),
        s.scale(1, 0.32, easeOutCubic),
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
