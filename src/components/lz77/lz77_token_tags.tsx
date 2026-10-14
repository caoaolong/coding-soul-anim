import {Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {
  formatDisplayChar,
  lz77TokenAccent,
  type Lz77Token,
} from './lz77_token_style';

const DEEP = '#121820';
const MONO = '"Cascadia Mono", "Consolas", monospace';

/** Tag 文案：字面量直接显示字符；引用为「长度/距离」便于调试 */
export function formatTagLabel(token: Lz77Token): string {
  if (token.kind === 'literal') {
    return formatDisplayChar(token.char);
  }
  return `${token.length}/${token.offset}`;
}

export interface Lz77TokenTagsProps extends NodeProps {
  /** 字面量与引用外框统一高度（引用内为上下两格） */
  tagHeight?: number;
  gap?: number;
  fontSize?: number;
}

/**
 * LZ77 二元组 Tag 行：
 * 字面量：单格字符；引用：上下两格（上=长度，下=距离），总高与字面量一致。
 */
export class Lz77TokenTags extends Node {
  private readonly row = createRef<Layout>();
  private readonly tags = createRefArray<Rect>();

  private readonly tagHeight: number;
  private readonly gap: number;
  private readonly fontSize: number;

  private built = false;

  public constructor(props: Lz77TokenTagsProps = {}) {
    const {tagHeight = 72, gap = 12, fontSize = 26, ...rest} = props;
    super({opacity: 0, ...rest});

    this.tagHeight = tagHeight;
    this.gap = gap;
    this.fontSize = fontSize;

    this.add(
      <Layout
        ref={this.row}
        layout
        direction={'row'}
        gap={gap}
        alignItems={'center'}
        justifyContent={'center'}
      />,
    );
  }

  /** 根据 tokens 构建标签行 */
  public build(tokens: Lz77Token[]) {
    if (this.built) return;
    this.built = true;
    this.row().removeChildren();

    for (const token of tokens) {
      this.row().add(this.makeTagRect(token, this.tags, 0, 0.85));
    }
  }

  /** 整行淡入，标签依次弹出 */
  public *show(duration = 0.5, stagger = 0.06): ThreadGenerator {
    yield* this.opacity(1, duration * 0.4, easeOutCubic);
    const anims = this.tags.map((tag, i) =>
      delay(
        i * stagger,
        all(
          tag.opacity(1, 0.32, easeOutCubic),
          tag.scale(1, 0.38, easeOutBack),
        ),
      ),
    );
    if (anims.length > 0) yield* all(...anims);
    yield* waitFor(0.1);
  }

  private makeTagRect(
    token: Lz77Token,
    tagRef:
      | ReturnType<typeof createRefArray<Rect>>
      | ReturnType<typeof createRef<Rect>>,
    opacity: number,
    scale: number,
  ) {
    const accent = lz77TokenAccent(token);

    if (token.kind === 'literal') {
      const label = formatDisplayChar(token.char);
      const w = Math.max(52, label.length * (this.fontSize * 0.62) + 28);
      return (
        <Rect
          ref={tagRef}
          layout
          width={w}
          height={this.tagHeight}
          radius={10}
          fill={DEEP}
          stroke={accent}
          lineWidth={2}
          alignItems={'center'}
          justifyContent={'center'}
          opacity={opacity}
          scale={scale}
        >
          <Txt
            text={label}
            fontFamily={MONO}
            fontSize={this.fontSize}
            fontWeight={700}
            fill={accent}
          />
        </Rect>
      );
    }

    // 引用：上下两格（上长度、下距离），总高度与字面量 tag 一致
    const innerGap = 4;
    const halfH = (this.tagHeight - innerGap) / 2;
    const lenStr = String(token.length);
    const offStr = String(token.offset);
    const innerFs = this.fontSize * 0.72;
    const w = Math.max(
      52,
      Math.max(lenStr.length, offStr.length) * (innerFs * 0.7) + 24,
    );

    return (
      <Rect
        ref={tagRef}
        layout
        direction={'column'}
        gap={innerGap}
        width={w}
        height={this.tagHeight}
        fill={'#00000000'}
        lineWidth={0}
        opacity={opacity}
        scale={scale}
      >
        <Rect
          layout
          width={w}
          height={halfH}
          radius={8}
          fill={DEEP}
          stroke={accent}
          lineWidth={2}
          alignItems={'center'}
          justifyContent={'center'}
        >
          <Txt
            text={lenStr}
            fontFamily={MONO}
            fontSize={innerFs}
            fontWeight={700}
            fill={accent}
          />
        </Rect>
        <Rect
          layout
          width={w}
          height={halfH}
          radius={8}
          fill={DEEP}
          stroke={accent}
          lineWidth={2}
          alignItems={'center'}
          justifyContent={'center'}
        >
          <Txt
            text={offStr}
            fontFamily={MONO}
            fontSize={innerFs}
            fontWeight={700}
            fill={accent}
          />
        </Rect>
      </Rect>
    );
  }
}
