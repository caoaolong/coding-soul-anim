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
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const CHROME_H = 52;
const ADDR_H = 36;
const RADIUS = 14;
const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840'] as const;

const BG_CHROME = '#3c4043';
const BG_ADDR = '#202124';
const BG_PAGE = '#ffffff';
const LINE = '#5f6368';
const URL_COLOR = '#e8eaed';
const MUTED = '#9aa0a6';
const LOCK = '#8ab4f8';

export interface BrowserWindowProps extends NodeProps {
  /** 地址栏 URL */
  url?: string;
  /** 网页截图 */
  screenshot?: string;
  /** 窗口宽度，默认 920 */
  width?: number;
  /** 内容区高度（不含顶栏），默认 560 */
  contentHeight?: number;
}

/**
 * 模拟浏览器窗口：红绿灯 + 地址栏 + 截图内容。
 * 提供从最小化放大打开的入场动画。
 */
export class BrowserWindow extends Node {
  @initial('https://example.com')
  @signal()
  public declare readonly url: SimpleSignal<string, this>;

  @initial(920)
  @signal()
  public declare readonly width: SimpleSignal<number, this>;

  @initial(560)
  @signal()
  public declare readonly contentHeight: SimpleSignal<number, this>;

  private readonly root = createRef<Rect>();
  private readonly pageImg = createRef<Img>();

  public constructor(props: BrowserWindowProps = {}) {
    const {
      url = 'https://example.com',
      screenshot = '',
      width = 920,
      contentHeight = 560,
      opacity = 0,
      scale = 0.2,
      ...rest
    } = props;

    super({opacity, scale, ...rest});

    this.url(url);
    this.width(width);
    this.contentHeight(contentHeight);

    this.add(
      <Rect
        ref={this.root}
        layout
        direction={'column'}
        width={() => this.width()}
        radius={RADIUS}
        fill={BG_CHROME}
        stroke={LINE}
        lineWidth={1}
        clip
        shadowColor={'rgba(0,0,0,0.5)'}
        shadowBlur={32}
        shadowOffset={[0, 16]}
      >
        {/* 顶栏：红绿灯 + 地址栏 */}
        <Rect
          layout
          direction={'row'}
          alignItems={'center'}
          width={'100%'}
          height={CHROME_H}
          fill={BG_CHROME}
          padding={[0, 14]}
          gap={14}
        >
          <Layout layout direction={'row'} gap={8} alignItems={'center'}>
            {TRAFFIC.map(color => (
              <Circle size={12} fill={color} />
            ))}
          </Layout>

          <Rect
            layout
            direction={'row'}
            alignItems={'center'}
            grow={1}
            height={ADDR_H}
            fill={BG_ADDR}
            radius={18}
            padding={[0, 14]}
            gap={8}
          >
            {/* 简易锁标 */}
            <Layout layout direction={'column'} alignItems={'center'} gap={1}>
              <Circle size={7} stroke={LOCK} lineWidth={1.5} fill={'#00000000'} />
              <Rect width={9} height={7} radius={1.5} fill={LOCK} />
            </Layout>
            <Txt
              text={() => this.url()}
              fontFamily={FONT}
              fontSize={18}
              fill={URL_COLOR}
            />
          </Rect>
        </Rect>

        {/* 网页截图 */}
        <Rect
          layout
          width={'100%'}
          height={() => this.contentHeight()}
          fill={BG_PAGE}
          clip
        >
          {screenshot ? (
            <Img
              ref={this.pageImg}
              src={screenshot}
              width={() => this.width()}
              height={() => this.contentHeight()}
            />
          ) : (
            <Layout
              layout
              width={'100%'}
              height={'100%'}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt text={'No screenshot'} fontFamily={FONT} fill={MUTED} fontSize={24} />
            </Layout>
          )}
        </Rect>
      </Rect>,
    );
  }

  /**
   * 模拟从底部任务栏打开窗口：
   * 小图标从下方升起并放大到目标位置。
   */
  public *open(
    duration = 0.85,
    options?: {fromY?: number; fromScale?: number},
  ): ThreadGenerator {
    const targetX = this.x();
    const targetY = this.y();
    const fromY = options?.fromY ?? 520;
    const fromScale = options?.fromScale ?? 0.1;

    this.opacity(0);
    this.scale(fromScale);
    this.y(fromY);

    yield* all(
      this.opacity(1, duration * 0.4, easeOutCubic),
      // 缩放：先慢后快
      this.scale(1, duration, easeInCubic),
      // 上浮弹出：先快后慢
      this.y(targetY, duration, easeOutCubic),
      this.x(targetX, duration * 0.9, easeOutCubic),
    );
  }

  public *show(duration = 0.5): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration, easeOutCubic),
    );
  }

  public *hide(duration = 0.35): ThreadGenerator {
    yield* all(
      this.opacity(0, duration, easeOutCubic),
      this.scale(0.12, duration, easeOutCubic),
      this.y(520, duration, easeInOutCubic),
    );
  }
}
