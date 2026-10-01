import {
  Circle,
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
  easeOutCubic,
} from '@motion-canvas/core';

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
        {/* 标题栏 */}
        <Rect
          width={'100%'}
          height={TITLE_H}
          fill={BG_TITLE}
        >
          <Layout
            layout
            direction={'row'}
            gap={8}
            alignItems={'center'}
            x={-winW / 2 + 42}
            y={0}
          >
            {TRAFFIC.map(color => (
              <Circle size={12} fill={color} />
            ))}
          </Layout>
          <Txt
            text={() => this.title()}
            fontFamily={'"SF Pro Text", "Helvetica Neue", "Microsoft YaHei", sans-serif'}
            fontSize={14}
            fill={MUTED}
            y={0}
          />
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
              <Img src={image} height={bodyH} radius={8} />
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
                  <Img src={image} width={imgW} radius={8} />
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
    const fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif';

    return (
      <Txt
        fontFamily={fontFamily}
        fontSize={fontSize}
        fill={PAPER}
        textWrap={true}
        width={width}
        lineHeight={lineHeight}
      >
        {segments.map(seg =>
          seg.bold ? (
            <Txt
              text={seg.text}
              fontFamily={fontFamily}
              fontWeight={700}
              fill={PAPER}
            />
          ) : (
            seg.text
          ),
        )}
      </Txt>
    );
  }

  public *show(duration = 0.5): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration * 1.1, easeOutCubic),
    );
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
