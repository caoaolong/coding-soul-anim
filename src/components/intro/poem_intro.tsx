import { Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRefArray,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";

export interface PoemIntroProps extends NodeProps {
  /** 诗句全文，用 \n 分行（一句一列） */
  poem: string;
  /** 画布宽，用于全屏居中 */
  width: number;
  /** 画布高 */
  height: number;
  /** 字体，默认芝麻行（需已在 global.css 注册） */
  fontFamily?: string;
  /** 字号，默认 56 */
  fontSize?: number;
  /** 文字颜色 */
  fill?: string;
  /** 背景色，默认深墨色 */
  background?: string | null;
  /**
   * 每列总动画时长（秒），与诗句行顺序一致（第一行 = 最右列）。
   * 通常对齐该句音频时长；列内自动均分到各字。
   * 未提供某列或未传数组时，回退到 charDelay / charDuration。
   */
  columnDurations?: number[];
  /** 相邻字出现间隔（秒），默认 0.38；有 columnDurations 时按列覆盖 */
  charDelay?: number;
  /** 列间距，默认 72 */
  columnGap?: number;
  /** 字间距（行内垂直），默认 18 */
  charGap?: number;
  /** 单字淡入时长上限，默认 0.55；有 columnDurations 时会按槽位缩短 */
  charDuration?: number;
  /** 写完后停留，默认 1.2 */
  holdAfter?: number;
}

export interface PoemIntroPlayOptions {
  /**
   * 覆盖构造时的每列总时长（秒），顺序同 poem 行序。
   * 适合在场景里按音频实测时长传入。
   */
  columnDurations?: number[];
}

/**
 * 竖排诗句片头：全屏，从右到左逐列、列内从上到下逐字书写。
 */
export class PoemIntro extends Node {
  private readonly chars = createRefArray<Txt>();
  private readonly columnLengths: number[] = [];
  private readonly columnDurations?: number[];
  private readonly charDelay: number;
  private readonly charDuration: number;
  private readonly holdAfter: number;

  public constructor(props: PoemIntroProps) {
    const {
      poem,
      width,
      height,
      fontFamily = '"Zhi Mang Xing", KaiTi, STKaiti, serif',
      fontSize = 56,
      fill = "#E8E0D0",
      background = "#121212",
      columnDurations,
      charDelay = 0.38,
      columnGap = 72,
      charGap = 18,
      charDuration = 0.55,
      holdAfter = 1.2,
      ...nodeProps
    } = props;

    super(nodeProps);

    this.columnDurations = columnDurations;
    this.charDelay = charDelay;
    this.charDuration = charDuration;
    this.holdAfter = holdAfter;

    const lines = poem
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) {
      throw new Error("PoemIntro: poem 不能为空");
    }

    if (background) {
      this.add(
        <Rect
          width={width}
          height={height}
          fill={background}
          zIndex={-1}
        />,
      );
    }

    const stepY = fontSize + charGap;
    const maxLen = Math.max(...lines.map((l) => l.length));
    const blockW = (lines.length - 1) * columnGap + fontSize;
    const blockH = (maxLen - 1) * stepY + fontSize;
    const originX = blockW / 2;
    const originY = -blockH / 2;

    // 列从右到左；书写顺序也按此推进
    for (let ci = 0; ci < lines.length; ci++) {
      const line = lines[ci];
      this.columnLengths.push(line.length);
      const colX = originX - ci * columnGap;
      for (let ji = 0; ji < line.length; ji++) {
        const ch = line[ji];
        const cy = originY + ji * stepY + fontSize / 2;
        this.add(
          <Txt
            ref={this.chars}
            text={ch}
            fontFamily={fontFamily}
            fontSize={fontSize}
            fill={fill}
            x={colX}
            y={cy}
            opacity={0}
          />,
        );
      }
    }
  }

  /**
   * 从右到左、列内上到下，逐字淡入书写。
   * 可通过 options.columnDurations 按音频时长控制每一列。
   */
  public *play(options?: PoemIntroPlayOptions): ThreadGenerator {
    const durations = options?.columnDurations ?? this.columnDurations;
    let offset = 0;

    for (let ci = 0; ci < this.columnLengths.length; ci++) {
      const n = this.columnLengths[ci];
      const columnChars: Txt[] = [];
      for (let j = 0; j < n; j++) {
        columnChars.push(this.chars[offset + j]);
      }
      offset += n;

      const columnDuration = durations?.[ci];
      yield* this.playColumn(columnChars, columnDuration);
    }

    yield* waitFor(this.holdAfter);
  }

  /** 播放单列：有总时长则均分到字，否则用全局 charDelay / charDuration */
  private *playColumn(
    glyphs: Txt[],
    columnDuration: number | undefined,
  ): ThreadGenerator {
    const n = glyphs.length;
    if (n === 0) {
      return;
    }

    let fade = this.charDuration;
    let gap = this.charDelay;

    if (columnDuration != null && columnDuration > 0) {
      fade = Math.min(this.charDuration, columnDuration / n);
      if (n === 1) {
        fade = Math.min(this.charDuration, columnDuration);
        gap = 0;
      } else {
        gap = (columnDuration - n * fade) / (n - 1);
        if (gap < 0) {
          fade = columnDuration / n;
          gap = 0;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const glyph = glyphs[i];
      const y0 = glyph.y();
      glyph.opacity(0);
      glyph.y(y0 + 8);
      yield* all(
        glyph.opacity(1, fade, easeOutCubic),
        glyph.y(y0, fade, easeOutCubic),
      );
      if (i < n - 1 && gap > 0) {
        yield* waitFor(gap);
      }
    }
  }
}
