import {Latex, Layout, Node, NodeProps} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const PAPER = '#e8eef7';

/** 将一行拆成等号左右；无等号则整行进右侧 */
export function splitAtEquals(line: string): {lhs: string; rhs: string} {
  const idx = line.indexOf('=');
  if (idx < 0) {
    return {lhs: '', rhs: line.trim()};
  }
  return {
    lhs: line.slice(0, idx).trim(),
    rhs: line.slice(idx + 1).trim(),
  };
}

export interface FormulaDeriveProps extends NodeProps {
  /** 每一行一个 LaTeX 式子（推导步骤，含 =） */
  lines: string[];
  /** 字号，默认 48 */
  fontSize?: number;
  /** 行距，默认 36 */
  rowGap?: number;
  /** 等号两侧间距，默认 16 */
  eqGap?: number;
  /** 文字色 */
  fill?: string;
  /** 书写入场：自下方上移的像素，默认 28 */
  writeOffset?: number;
}

/**
 * 多行公式推导：整体居中，各行按等号竖直对齐。
 * 入场：逐行淡入 + 轻微上移（书写感）。
 */
export class FormulaDerive extends Node {
  private readonly stack = createRef<Layout>();
  private readonly rows = createRefArray<Layout>();
  private readonly writers = createRefArray<Layout>();
  private readonly lhsCols = createRefArray<Layout>();
  private readonly lhsTex = createRefArray<Latex>();
  private readonly lines: string[];
  private readonly writeOffset: number;

  public constructor(props: FormulaDeriveProps) {
    const {
      lines,
      fontSize = 48,
      rowGap = 36,
      eqGap = 16,
      fill = PAPER,
      writeOffset = 28,
      opacity = 1,
      ...rest
    } = props;

    super({opacity, ...rest});
    this.lines = lines;
    this.writeOffset = writeOffset;

    const parsed = lines.map(splitAtEquals);

    this.add(
      <Layout
        ref={this.stack}
        layout
        direction={'column'}
        alignItems={'start'}
        gap={rowGap}
      >
        {parsed.map(({lhs, rhs}) => (
          // 外层占位行距；内层 writer 做位移，避免和 column layout 抢 y
          <Layout ref={this.rows} layout direction={'row'}>
            <Layout
              ref={this.writers}
              layout
              direction={'row'}
              alignItems={'center'}
              gap={eqGap}
              opacity={0}
              y={writeOffset}
              scale={0.96}
            >
              <Layout
                ref={this.lhsCols}
                layout
                direction={'row'}
                justifyContent={'end'}
                alignItems={'center'}
              >
                <Latex
                  ref={this.lhsTex}
                  tex={[lhs.length > 0 ? lhs : '\\phantom{x}']}
                  fill={fill}
                  fontSize={fontSize}
                  opacity={lhs.length > 0 ? 1 : 0}
                />
              </Layout>
              <Latex tex={['=']} fill={fill} fontSize={fontSize} />
              <Latex tex={[rhs]} fill={fill} fontSize={fontSize} />
            </Layout>
          </Layout>
        ))}
      </Layout>,
    );
  }

  public get lineCount(): number {
    return this.lines.length;
  }

  public line(index: number): Layout {
    return this.rows[index];
  }

  /** 按最宽左侧内容统一 lhs 列宽，保证等号对齐 */
  public syncEqualsAlign() {
    let maxW = 0;
    for (const tex of this.lhsTex) {
      maxW = Math.max(maxW, tex.width());
    }
    const w = Math.max(maxW, 8);
    for (const col of this.lhsCols) {
      col.width(w);
    }
  }

  private *writeLine(index: number, duration: number): ThreadGenerator {
    const w = this.writers[index];
    yield* all(
      w.opacity(1, duration, easeOutCubic),
      w.y(0, duration, easeOutCubic),
      w.scale(1, duration, easeOutCubic),
    );
  }

  /** 一次性全部显示（带轻微错落入场） */
  public *showAll(duration = 0.4): ThreadGenerator {
    yield;
    this.syncEqualsAlign();
    yield;
    yield* all(
      ...this.writers.map((w, i) =>
        delay(
          i * 0.08,
          all(
            w.opacity(1, duration, easeOutCubic),
            w.y(0, duration, easeOutCubic),
            w.scale(1, duration, easeOutCubic),
          ),
        ),
      ),
    );
  }

  /** 逐行书写式入场：淡入 + 自下而上 + 轻微放大 */
  public *run(hold = 0.55, duration = 0.45): ThreadGenerator {
    yield;
    this.syncEqualsAlign();
    yield;

    for (let i = 0; i < this.writers.length; i++) {
      yield* this.writeLine(i, duration);
      yield* waitFor(hold);
    }
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* all(
      ...this.writers.map(w =>
        all(
          w.opacity(0, duration, easeOutCubic),
          w.y(this.writeOffset * 0.5, duration, easeOutCubic),
        ),
      ),
    );
  }
}
