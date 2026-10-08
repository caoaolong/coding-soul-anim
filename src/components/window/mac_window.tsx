import {
  Circle,
  Img,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
  blur,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  Reference,
  SimpleSignal,
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

export type MacWindowMode = 'text' | 'image' | 'both';

export interface MacWindowProps extends NodeProps {
  /** 窗口标题栏文字 */
  title?: string;
  /** 内容模式：纯文本 / 纯图片 / 左图右文 */
  mode?: MacWindowMode;
  /** 正文（text / both）；支持 **加粗** 与换行 */
  text?: string;
  /** 图片路径（image / both） */
  image?: string;
  /** 窗口宽度，默认 1400 */
  windowWidth?: number;
  /** 窗口内容区高度（不含标题栏），默认 680 */
  contentHeight?: number;
  /** 图片区宽度（both 模式），默认 460 */
  imageWidth?: number;
}

const TITLE_H = 44;
const RADIUS = 12;
const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840'] as const;

const BG_WINDOW = '#1e1e1e';
const BG_TITLE = '#2a2a2a';
const BG_CONTENT = '#252526';
const PAPER = '#e8eef7';
const BOLD_HIGHLIGHT = '#ffd166';
const MUTED = '#9aa0a6';
const LINE = '#3c3c3c';

/**
 * macOS 风格窗口：可配置纯文本 / 纯图片 / 左图右文。
 */
export class MacWindow extends Node {
  @initial('Untitled')
  @signal()
  public declare readonly title: SimpleSignal<string, this>;

  @initial('text')
  @signal()
  public declare readonly mode: SimpleSignal<MacWindowMode, this>;

  @initial('')
  @signal()
  public declare readonly text: SimpleSignal<string, this>;

  @initial('')
  @signal()
  public declare readonly image: SimpleSignal<string, this>;

  @initial(1400)
  @signal()
  public declare readonly windowWidth: SimpleSignal<number, this>;

  @initial(680)
  @signal()
  public declare readonly contentHeight: SimpleSignal<number, this>;

  @initial(460)
  @signal()
  public declare readonly imageWidth: SimpleSignal<number, this>;

  private readonly root = createRef<Rect>();
  private readonly imgRef = createRef<Img>();
  private readonly titleTxt = createRef<Txt>();
  /** 所有 **加粗** 片段的引用，用于显示完成后的依次放大动画 */
  private readonly boldRefs: Reference<Txt>[] = [];
  /** 秘密模糊：图片强模糊，标题/名字弱模糊；揭晓时 tween 到 0 */
  private readonly imgBlur = blur(16);
  private readonly txtBlur = blur(7);

  public constructor(props?: MacWindowProps) {
    super({opacity: 0, scale: 0.94, ...props});

    const mode = props?.mode ?? 'text';
    const image = props?.image ?? '';
    const imgW = props?.imageWidth ?? 460;
    const winW = props?.windowWidth ?? 1400;
    const contentH = props?.contentHeight ?? 680;
    const bodyH = contentH - 48;

    this.add(
      <Rect
        ref={this.root}
        layout
        direction={'column'}
        width={() => this.windowWidth()}
        radius={RADIUS}
        fill={BG_WINDOW}
        stroke={LINE}
        lineWidth={1}
        clip
        shadowColor={'rgba(0,0,0,0.45)'}
        shadowBlur={28}
        shadowOffset={[0, 14]}
      >
        {/* 标题栏：layout 横向三段，标题真正水平 + 垂直居中 */}
        <Rect
          layout
          direction={'row'}
          alignItems={'center'}
          justifyContent={'space-between'}
          width={'100%'}
          height={TITLE_H}
          fill={BG_TITLE}
          padding={[0, 16, 0, 16]}
        >
          <Layout layout direction={'row'} gap={8} alignItems={'center'}>
            {TRAFFIC.map(color => (
              <Circle size={12} fill={color} />
            ))}
          </Layout>
          <Txt
            ref={this.titleTxt}
            text={() => this.title()}
            fontFamily={FONT}
            fontSize={22}
            fontWeight={600}
            fill={MUTED}
            filters={[this.txtBlur]}
          />
          {/* 右侧占位，与左侧红绿灯等宽，保证标题居中 */}
          <Layout width={52} />
        </Rect>

        {/* 内容区 */}
        <Rect
          layout
          direction={'row'}
          width={'100%'}
          height={() => this.contentHeight()}
          fill={BG_CONTENT}
          padding={24}
          gap={28}
          alignItems={'center'}
        >
          {mode === 'image' && image ? (
            <Rect
              width={'100%'}
              height={bodyH}
              radius={8}
              clip
              layout
              alignItems={'center'}
              justifyContent={'center'}
            >
              {/* 只定高度，宽度按原图比例，避免拉伸 */}
              <Img
                ref={this.imgRef}
                src={image}
                height={bodyH}
                radius={8}
                filters={[this.imgBlur]}
              />
            </Rect>
          ) : null}

          {mode === 'text'
            ? this.buildTextBlock('100%', 34, 54)
            : null}

          {mode === 'both' ? (
            <>
              {image ? (
                <Rect
                  width={imgW}
                  height={bodyH}
                  radius={8}
                  clip
                  layout
                  alignItems={'center'}
                  justifyContent={'center'}
                >
                  {/* 只定宽度，高度按原图比例，超出区域裁切 */}
                  <Img
                    ref={this.imgRef}
                    src={image}
                    width={imgW}
                    radius={8}
                    filters={[this.imgBlur]}
                  />
                </Rect>
              ) : null}
              {this.buildTextBlock(winW - imgW - 24 * 2 - 28, 32, 50)}
            </>
          ) : null}
        </Rect>
      </Rect>,
    );
  }

  /** 按 \\n 拆行，并解析 **加粗** 片段 */
  private buildTextBlock(
    width: number | `${number}%`,
    fontSize: number,
    lineHeight: number,
  ) {
    const lines = this.text()
      .replace(/\r\n/g, '\n')
      .replace(/^\n+|\n+$/g, '')
      .split('\n')
      .map(line => line.trim());

    return (
      <Layout
        layout
        direction={'column'}
        width={width}
        gap={Math.max(4, lineHeight - fontSize)}
        alignItems={'start'}
      >
        {lines.map(line => this.buildRichLine(line, width, fontSize, lineHeight))}
      </Layout>
    );
  }

  /** 单行：普通文字 + **加粗** → 嵌套 Txt */
  private buildRichLine(
    line: string,
    width: number | `${number}%`,
    fontSize: number,
    lineHeight: number,
  ) {
    const segments = parseBoldSegments(line.length > 0 ? line : ' ');

    return (
      <Txt
        fontFamily={FONT}
        fontSize={fontSize}
        fill={PAPER}
        textWrap={true}
        width={width}
        lineHeight={lineHeight}
      >
        {segments.map(seg => {
          if (!seg.bold) {
            return seg.text;
          }
          // 第一个加粗片段视为名字，初始模糊，揭晓时变清晰
          const isName = this.boldRefs.length === 0;
          const boldRef = createRef<Txt>();
          this.boldRefs.push(boldRef);
          return (
            <Txt
              ref={boldRef}
              text={seg.text}
              fontFamily={FONT}
              fontWeight={700}
              fill={PAPER}
              scale={1}
              filters={isName ? [this.txtBlur] : undefined}
            />
          );
        })}
      </Txt>
    );
  }

  public *show(duration = 0.5): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration * 1.1, easeOutCubic),
    );
  }

  /**
   * 高亮被模糊的秘密（图片 + 名字）：依次放大脉冲，此时仍保持模糊。
   */
  public *highlightSecrets(): ThreadGenerator {
    const nodes = [this.imgRef(), this.boldRefs[0]?.()].filter(
      (n): n is Img | Txt => !!n,
    );
    for (const node of nodes) {
      yield* node.scale(1.12, 0.28, easeOutCubic);
      yield* node.scale(1, 0.3, easeInOutCubic);
    }
  }

  /**
   * 最终揭晓：图片与名字由模糊变清晰。
   */
  public *revealSecrets(duration = 0.7): ThreadGenerator {
    yield* all(
      this.imgBlur.value(0, duration, easeInOutCubic),
      this.txtBlur.value(0, duration, easeInOutCubic),
    );
  }

  /**
   * 显示完成后调用：每个 **加粗** 片段依次放大再恢复，颜色同步渐变再恢复。
   * @param scaleTo 放大到的倍数，默认 1.3
   * @param upDuration 放大 + 变色耗时，默认 0.25s
   * @param holdDuration 高亮停留，默认 0.12s
   * @param downDuration 恢复 + 颜色还原耗时，默认 0.3s
   * @param highlight 高亮颜色，默认暖黄
   * @param gapDuration 恢复后到下一部分的间隔，默认 1s
   * @param skipFirst 跳过第一个加粗片段（名字仍模糊时用），默认 false
   */
  public *emphasizeBolds(
    scaleTo = 1.3,
    upDuration = 0.25,
    holdDuration = 0.12,
    downDuration = 0.3,
    highlight: string = BOLD_HIGHLIGHT,
    gapDuration = 1,
    skipFirst = false,
  ): ThreadGenerator {
    for (let i = skipFirst ? 1 : 0; i < this.boldRefs.length; i++) {
      const node = this.boldRefs[i]();
      if (!node) {
        continue;
      }
      yield* all(
        node.scale(scaleTo, upDuration, easeOutCubic),
        node.fill(highlight, upDuration, easeOutCubic),
      );
      if (holdDuration > 0) {
        yield* waitFor(holdDuration);
      }
      yield* all(
        node.scale(1, downDuration, easeInOutCubic),
        node.fill(PAPER, downDuration, easeInOutCubic),
      );
      // 不是最后一个时，等待后再下一个
      if (gapDuration > 0 && i < this.boldRefs.length - 1) {
        yield* waitFor(gapDuration);
      }
    }
  }

  public *hide(duration = 0.35): ThreadGenerator {
    yield* all(
      this.opacity(0, duration, easeOutCubic),
      this.scale(0.96, duration, easeOutCubic),
    );
  }
}

type BoldSegment = {text: string; bold: boolean};

/** 解析 `**加粗**`；未闭合的 `**` 按普通文本处理 */
function parseBoldSegments(raw: string): BoldSegment[] {
  const segments: BoldSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > last) {
      segments.push({text: raw.slice(last, match.index), bold: false});
    }
    segments.push({text: match[1], bold: true});
    last = match.index + match[0].length;
  }
  if (last < raw.length) {
    segments.push({text: raw.slice(last), bold: false});
  }
  if (segments.length === 0) {
    segments.push({text: raw || ' ', bold: false});
  }
  return segments;
}
