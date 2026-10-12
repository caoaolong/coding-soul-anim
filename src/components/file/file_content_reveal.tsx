import {
  Img,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  all,
  createRef,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import docIcon from '../../assets/icons/文档.svg';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const DEEP = '#121820';
const MUTED = '#8a9bb0';
const ACCENT = '#3dd6c6';
const HIGHLIGHT = '#ffb454';
const MONO = '"Cascadia Mono", "Consolas", "Courier New", monospace';

interface TextPiece {
  text: string;
  hit: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 将正文按目标词切成普通 / 命中片段（命中全部出现） */
function splitByWord(
  text: string,
  word: string,
  wholeWord: boolean,
  ignoreCase: boolean,
): TextPiece[] {
  if (!word) return [{text, hit: false}];

  const flags = ignoreCase ? 'gi' : 'g';
  const pattern = wholeWord
    ? new RegExp(`\\b(${escapeRegExp(word)})\\b`, flags)
    : new RegExp(`(${escapeRegExp(word)})`, flags);

  const parts: TextPiece[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      parts.push({text: text.slice(last, match.index), hit: false});
    }
    parts.push({text: match[1], hit: true});
    last = match.index + match[1].length;
    // 避免零宽匹配死循环
    if (match[1].length === 0) {
      pattern.lastIndex += 1;
    }
  }
  if (last < text.length) {
    parts.push({text: text.slice(last), hit: false});
  }
  return parts.length > 0 ? parts : [{text, hit: false}];
}

export interface FileContentRevealProps extends NodeProps {
  /** 图标资源，默认文档.svg */
  icon?: string;
  /** 图标下方标题，默认「文档」 */
  label?: string;
  /** 气泡内等宽字符串（文件内容） */
  content?: string;
  /** 图标边长，默认 160 */
  iconSize?: number;
  /** 气泡正文字号，默认 24 */
  fontSize?: number;
  /** 气泡最大宽度，默认 1280 */
  maxWidth?: number;
  /** 打字速度（秒/字），默认 0.02 */
  typeSpeed?: number;
}

/**
 * 文件图标（上图下标题）+ 内容气泡弹出。
 * 纵向 Layout：气泡在上、图标居中、标题在下；尺寸变化时整组保持画面中心。
 *
 * @example
 * ```tsx
 * const file = createRef<FileContentReveal>();
 * view.add(
 *   <FileContentReveal
 *     ref={file}
 *     label="文档"
 *     content="AAAAABBBAAACCC"
 *   />,
 * );
 * yield* file().show();
 * yield* file().revealContent();
 * ```
 */
export class FileContentReveal extends Node {
  @initial('文档')
  @signal()
  public declare readonly label: SimpleSignal<string, this>;

  @initial('')
  @signal()
  public declare readonly content: SimpleSignal<string, this>;

  private readonly column = createRef<Layout>();
  private readonly bubbleWrap = createRef<Layout>();
  private readonly bubble = createRef<Rect>();
  private readonly body = createRef<Txt>();
  private readonly icon = createRef<Img>();
  private readonly title = createRef<Txt>();
  private readonly tail = createRef<Rect>();

  private readonly typeSpeed: number;
  private readonly maxWidth: number;
  private readonly fontSize: number;
  private readonly textWidth: number;
  /** 当前高亮命中的嵌套 Txt */
  private highlightNodes: Txt[] = [];

  public constructor(props?: FileContentRevealProps) {
    const {
      icon = docIcon,
      label = '文档',
      content = '',
      iconSize = 120,
      fontSize = 24,
      maxWidth = 1280,
      typeSpeed = 0.02,
      opacity = 0,
      ...rest
    } = props ?? {};

    super({opacity, ...rest});

    this.typeSpeed = typeSpeed;
    this.maxWidth = maxWidth;
    this.fontSize = fontSize;
    this.textWidth = maxWidth - 56;
    this.label(label);
    this.content(content);

    const textWidth = this.textWidth;

    this.add(
      <Layout
        ref={this.column}
        layout
        direction={'column'}
        alignItems={'center'}
        gap={0}
      >
        {/* 气泡槽：未揭示时高度 0，不占位，保证图标真正居中 */}
        <Layout
          ref={this.bubbleWrap}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={0}
          height={0}
          opacity={0}
          scale={0.86}
          clip
          margin={0}
        >
          <Rect
            ref={this.bubble}
            layout
            direction={'column'}
            alignItems={'start'}
            padding={[22, 28]}
            width={maxWidth}
            fill={DEEP}
            stroke={ACCENT}
            lineWidth={2.5}
            radius={16}
          >
            <Txt
              ref={this.body}
              text={''}
              fontFamily={MONO}
              fontSize={fontSize}
              fontWeight={600}
              fill={PAPER}
              textWrap={true}
              width={textWidth}
              lineHeight={fontSize * 1.45}
            />
          </Rect>
          {/* 指向文件的小三角（跟在气泡下方，负间距贴合底边） */}
          <Rect
            ref={this.tail}
            width={16}
            height={16}
            fill={DEEP}
            stroke={ACCENT}
            lineWidth={2}
            rotation={45}
            margin={[-10, 0, 0, 0]}
            zIndex={-1}
          />
        </Layout>

        <Layout layout direction={'column'} alignItems={'center'} gap={14}>
          <Img ref={this.icon} src={icon} width={iconSize} height={iconSize} />
          <Txt
            ref={this.title}
            text={label}
            fontFamily={FONT}
            fontSize={Math.round(iconSize * 0.24)}
            fontWeight={700}
            fill={MUTED}
          />
        </Layout>
      </Layout>,
    );
  }

  /** 图标 + 标题入场（整组已在画面中心） */
  public *show(duration = 0.45): ThreadGenerator {
    this.opacity(0);
    this.scale(0.9);
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration, easeOutBack),
    );
  }

  /**
   * 气泡从图标上方弹出（整组随 layout 保持居中），再等宽打字机显示内容。
   */
  public *revealContent(options?: {
    popDuration?: number;
    typeSpeed?: number;
  }): ThreadGenerator {
    const popDuration = options?.popDuration ?? 0.45;
    const speed = options?.typeSpeed ?? this.typeSpeed;
    const full = this.content();

    this.body().text('');

    // 放开高度并留出与图标的间距 → 图标自然上移，整组中心不变
    this.bubbleWrap().height(null);
    this.bubbleWrap().clip(false);
    this.bubbleWrap().margin.bottom(20);

    yield* all(
      this.bubbleWrap().opacity(1, popDuration * 0.7, easeOutCubic),
      this.bubbleWrap().scale(1, popDuration, easeOutBack),
    );

    yield* waitFor(0.1);

    if (full.length === 0) {
      return;
    }

    // 光标以字符形式跟在文末，不占额外 layout 宽度，长文可完整换行
    const caret = '▌';
    const duration = Math.max(full.length * speed, 0.25);
    yield* tween(duration, t => {
      const n = Math.min(full.length, Math.floor(full.length * t + 1e-6));
      this.body().text(full.slice(0, n) + caret);
    });
    this.body().text(full + caret);
    yield* waitFor(0.12);
    this.body().text(full);
    yield* waitFor(0.12);
    this.body().text(full + caret);
    yield* waitFor(0.12);
    this.body().text(full);
  }

  /**
   * 将文件内容中指定单词的全部出现高亮。
   * 若已有高亮，会先把上一批恢复原色，再高亮新词。
   *
   * @param word 目标单词 / 子串
   * @param options.color 高亮色，默认暖橙
   * @param options.duration 变色时长
   * @param options.clearDuration 清除旧高亮时长，默认 0.28
   * @param options.wholeWord 默认 true，按英文单词边界匹配
   * @param options.ignoreCase 默认 false
   */
  public *highlightWord(
    word: string,
    options?: {
      color?: string;
      duration?: number;
      clearDuration?: number;
      wholeWord?: boolean;
      ignoreCase?: boolean;
    },
  ): ThreadGenerator {
    const color = options?.color ?? HIGHLIGHT;
    const duration = options?.duration ?? 0.4;
    const clearDuration = options?.clearDuration ?? 0.28;
    const wholeWord = options?.wholeWord ?? true;
    const ignoreCase = options?.ignoreCase ?? false;
    const full = this.content();

    if (!word || !full) return;

    const pieces = splitByWord(full, word, wholeWord, ignoreCase);
    const hitCount = pieces.filter(p => p.hit).length;
    if (hitCount === 0) return;

    // 换词前：旧高亮先复原，再拆段重排
    if (this.highlightNodes.length > 0) {
      yield* this.clearHighlight(clearDuration);
    }

    this.buildRichBody(pieces);

    yield;
    yield* all(
      ...this.highlightNodes.map(node =>
        node.fill(color, duration, easeOutCubic),
      ),
    );
  }

  /** 取消当前单词高亮并恢复为整段纯文本 */
  public *clearHighlight(duration = 0.3): ThreadGenerator {
    if (this.highlightNodes.length === 0) {
      this.restorePlainBody();
      return;
    }
    yield* all(
      ...this.highlightNodes.map(node =>
        node.fill(PAPER, duration, easeOutCubic),
      ),
    );
    this.restorePlainBody();
  }

  /** 按片段重建气泡正文；命中段记入 highlightNodes */
  private buildRichBody(pieces: TextPiece[]) {
    this.body().text('');
    this.body().removeChildren();
    this.highlightNodes = [];

    for (const piece of pieces) {
      if (!piece.text) continue;
      if (!piece.hit) {
        this.body().add(
          <Txt
            text={piece.text}
            fontFamily={MONO}
            fontSize={this.fontSize}
            fontWeight={600}
            fill={PAPER}
          />,
        );
        continue;
      }

      const hitRef = createRef<Txt>();
      this.body().add(
        <Txt
          ref={hitRef}
          text={piece.text}
          fontFamily={MONO}
          fontSize={this.fontSize}
          fontWeight={700}
          fill={PAPER}
        />,
      );
      this.highlightNodes.push(hitRef());
    }
  }

  /** 去掉富文本子节点，恢复打字机结束后的整段正文 */
  private restorePlainBody() {
    this.body().removeChildren();
    this.highlightNodes = [];
    this.body().text(this.content());
  }

  /** 气泡正文节点（后续压缩高亮可复用） */
  public bodyTxt(): Txt {
    return this.body();
  }

  public bubbleRect(): Rect {
    return this.bubble();
  }
}
