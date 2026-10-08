import {Circle, Line, Node, NodeProps, Rect} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
} from '@motion-canvas/core';
import type {PixelCanvas} from './pixel_canvas';

const RIM = '#e8eef7';
const RIM_INNER = '#3dd6c6';
const HANDLE = '#8a9bb0';
const MASK = '#0a0e14';

export interface MagnifierProps extends NodeProps {
  /** 圆形视野直径（屏幕空间） */
  lensSize?: number;
  /** 遮罩底色，应与场景背景一致 */
  maskColor?: string;
  /** 是否显示手柄 */
  showHandle?: boolean;
}

/**
 * 圆形视野遮罩（放大镜镜框）。
 *
 * 真正的推拉由外部的「视野节点」完成（{@link ViewCamera}）：
 * Motion Canvas 自带 Camera 对 Img + opacity 有缓存裁切 bug
 * （github.com/motion-canvas/motion-canvas/issues/1057），
 * 会表现为只先画出一角、opacity=1 时才突然全图。
 */
export class Magnifier extends Node {
  private readonly aperture = createRef<Circle>();
  private readonly rim = createRef<Circle>();
  private readonly rimInner = createRef<Circle>();
  private readonly handle = createRef<Line>();

  private readonly lensSize: number;

  public constructor(props: MagnifierProps) {
    const {
      lensSize = 420,
      maskColor = MASK,
      showHandle = true,
      ...rest
    } = props;

    super({
      opacity: 0,
      zIndex: 10,
      ...rest,
    });

    this.lensSize = lensSize;
    const r = lensSize / 2;

    this.add(
      <Node>
        {/* 圆形开孔遮罩：外部变暗，中间露出视野 */}
        <Node cache>
          <Rect width={4000} height={4000} fill={maskColor} />
          <Circle
            ref={this.aperture}
            width={lensSize}
            height={lensSize}
            fill={'#ffffff'}
            compositeOperation={'destination-out'}
          />
        </Node>
        <Circle
          ref={this.rim}
          width={lensSize}
          height={lensSize}
          stroke={RIM}
          lineWidth={10}
          fill={null}
        />
        <Circle
          ref={this.rimInner}
          width={lensSize - 14}
          height={lensSize - 14}
          stroke={RIM_INNER}
          lineWidth={2}
          fill={null}
          opacity={0.85}
        />
        {showHandle ? (
          <Line
            ref={this.handle}
            points={[
              [r * 0.72, r * 0.72],
              [r * 1.55, r * 1.55],
            ]}
            stroke={HANDLE}
            lineWidth={18}
            lineCap={'round'}
          />
        ) : null}
      </Node>,
    );
  }

  public getLensSize(): number {
    return this.aperture().width();
  }

  /** 入场：淡入镜框与遮罩 */
  public *appear(duration = 0.55): ThreadGenerator {
    this.scale(0.85);
    yield* all(
      this.opacity(1, duration * 0.55, easeOutCubic),
      this.scale(1, duration, easeOutBack),
    );
  }

  /** 改变圆形视野直径（屏幕空间） */
  public *setLensSize(size: number, duration = 0.6): ThreadGenerator {
    const r = size / 2;
    const anims: ThreadGenerator[] = [
      this.aperture().size(size, duration, easeInOutCubic),
      this.rim().size(size, duration, easeInOutCubic),
      this.rimInner().size(size - 14, duration, easeInOutCubic),
    ];
    if (this.handle()) {
      anims.push(
        this.handle().points(
          [
            [r * 0.72, r * 0.72],
            [r * 1.55, r * 1.55],
          ],
          duration,
          easeInOutCubic,
        ),
      );
    }
    yield* all(...anims);
  }
}

/**
 * 用 Node 的 position + scale 模拟正交摄像机视野。
 * 避免 Motion Canvas Camera × Img 的缓存裁切 bug。
 *
 * 约定：看向场景点 `lookAt`、倍率为 `zoom` 时：
 *   scale = zoom
 *   position = -lookAt * zoom
 * 这样 `lookAt` 会落在屏幕中心。
 */
export class ViewCamera extends Node {
  private lookAt = new Vector2(0, 0);
  private zoomLevel = 1;

  public getZoom(): number {
    return this.zoomLevel;
  }

  public getLookAt(): Vector2 {
    return this.lookAt;
  }

  /** 立即落到指定焦点与倍率 */
  public applyView(lookAt: Vector2, zoom: number) {
    this.lookAt = lookAt;
    this.zoomLevel = zoom;
    this.scale(zoom);
    this.position(lookAt.scale(-zoom));
  }

  /** 推拉到目标点 */
  public *focusOn(
    lookAt: Vector2,
    zoom: number,
    duration = 2.2,
  ): ThreadGenerator {
    const fromLook = this.lookAt;
    const fromZoom = this.zoomLevel;
    yield* tween(duration, t => {
      const e = easeInOutCubic(t);
      const z = fromZoom + (zoom - fromZoom) * e;
      const p = Vector2.lerp(fromLook, lookAt, e);
      this.applyView(p, z);
    });
    this.applyView(lookAt, zoom);
  }

  /**
   * 聚焦画布上的某个像素：圆形视野中心对准该像素并拉近。
   */
  public *focusPixel(
    canvas: PixelCanvas,
    px: number,
    py: number,
    options?: {
      duration?: number;
      finalZoom?: number;
      pixelate?: boolean;
      highlight?: boolean;
    },
  ): ThreadGenerator {
    const duration = options?.duration ?? 2.4;
    const finalZoom = options?.finalZoom ?? 72;
    const pixelate = options?.pixelate ?? true;
    const highlight = options?.highlight ?? true;

    const local = canvas.pixelToLocal(px, py);
    const target = canvas.position().add(local);

    if (pixelate) {
      canvas.image().smoothing(false);
    }

    yield* this.focusOn(target, finalZoom, duration);

    if (highlight) {
      yield* canvas.focusPixel(px, py, 0.4, finalZoom);
    }
  }
}
