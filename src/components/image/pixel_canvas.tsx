import {Img, Node, NodeProps, Rect} from '@motion-canvas/2d';
import {
  Color,
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const MARK = '#f0a060';

export interface PixelCanvasProps extends NodeProps {
  /** 图片资源（import 进来的 url） */
  src: string;
  /** 显示宽度（像素），高度按原图比例 */
  displayWidth?: number;
  /** 初始是否平滑插值，放大聚焦前可关掉以露出像素格 */
  smoothing?: boolean;
}

/**
 * 基于 Canvas 的像素画布（封装 Motion Canvas Img，内部用 Canvas 采样/绘制）。
 * 支持淡入、最近邻放大，以及按像素坐标聚焦高亮。
 */
export class PixelCanvas extends Node {
  private readonly img = createRef<Img>();
  private readonly pixelBox = createRef<Rect>();

  private readonly displayWidth: number;
  private displayHeight = 0;
  private natural = new Vector2(1, 1);

  public constructor(props: PixelCanvasProps) {
    const {src, displayWidth = 1280, smoothing = true, ...rest} = props;
    super({...rest});
    this.displayWidth = displayWidth;

    this.add(
      <Node>
        <Img
          ref={this.img}
          src={src}
          width={displayWidth}
          // 用 alpha 而非 opacity：避免父级 Camera/缓存路径把半透明节点裁成一角
          alpha={0}
          smoothing={smoothing}
        />
        <Rect
          ref={this.pixelBox}
          stroke={MARK}
          lineWidth={3}
          fill={null}
          opacity={0}
          zIndex={2}
        />
      </Node>,
    );
  }

  public image(): Img {
    return this.img();
  }

  /** 等图片资源就绪后读取自然尺寸并摆好布局 */
  public *prepare(): ThreadGenerator {
    // 先访问 naturalSize，触发 HTMLImageElement 加载并注册 Promise。
    // 注意：必须在 yield 之前访问；若先 yield 再读，可能读到 0×0，
    // 进而把 height 设成 NaN，首帧会只露出错误的一角，加载完成后才跳回全图。
    this.img().naturalSize();
    yield;

    let nat = this.img().naturalSize();
    let guard = 0;
    while ((nat.x === 0 || nat.y === 0) && guard < 180) {
      yield;
      nat = this.img().naturalSize();
      guard++;
    }

    this.natural = nat;
    const h = this.displayWidth * (nat.y / nat.x);
    this.displayHeight = h;
    // 宽高一起钉死，避免只设 width 时用未加载的 aspect-ratio 误布局
    this.img().size([this.displayWidth, h]);
  }

  public naturalSize(): Vector2 {
    return this.natural;
  }

  /** 像素坐标 → 本组件本地坐标（像素中心） */
  public pixelToLocal(px: number, py: number): Vector2 {
    const w = this.displayWidth;
    const h = this.displayHeight || this.img().height();
    return new Vector2(
      ((px + 0.5) / this.natural.x) * w - w / 2,
      ((py + 0.5) / this.natural.y) * h - h / 2,
    );
  }

  /** 单个像素在当前显示尺寸下的边长 */
  public pixelSize(): Vector2 {
    return new Vector2(
      this.displayWidth / this.natural.x,
      (this.displayHeight || this.img().height()) / this.natural.y,
    );
  }

  public getPixelColor(px: number, py: number): Color {
    return this.img().getPixelColor([px, py]);
  }

  public *fadeIn(duration = 0.7): ThreadGenerator {
    yield* this.img().alpha(1, duration, easeOutCubic);
  }

  /** 关闭平滑，露出像素块（Canvas nearest-neighbor） */
  public *setPixelated(pixelated: boolean, duration = 0.2): ThreadGenerator {
    this.img().smoothing(!pixelated);
    yield* waitFor(duration);
  }

  /**
   * 在指定像素上画框（本地坐标，线宽按 cameraZoom 补偿）。
   */
  public *focusPixel(
    px: number,
    py: number,
    duration = 0.45,
    cameraZoom = 1,
  ): ThreadGenerator {
    const pos = this.pixelToLocal(px, py);
    const size = this.pixelSize();
    const box = this.pixelBox();
    box.position(pos);
    box.size([size.x, size.y]);
    box.lineWidth(Math.max(1.5 / cameraZoom, 0.02));
    box.opacity(0);

    yield* all(
      box.opacity(1, duration, easeOutCubic),
      box
        .scale(2.2, duration * 0.45, easeOutCubic)
        .to(1, duration * 0.55, easeInOutCubic),
    );
  }

  /** 收起像素高亮框 */
  public *hideHighlight(duration = 0.2): ThreadGenerator {
    yield* this.pixelBox().opacity(0, duration, easeOutCubic);
  }

  public samplePixel(px: number, py: number): {
    color: Color;
    rgbTex: string;
    coordTex: string;
  } {
    const color = this.getPixelColor(px, py);
    const [r, g, b] = color.rgb();
    return {
      color,
      rgbTex: `\\mathrm{RGB}(${Math.round(r)},${Math.round(g)},${Math.round(b)})`,
      coordTex: `(${px},\\,${py})`,
    };
  }
}
