import { Img, Node, NodeProps, Rect } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  Random,
  waitFor,
} from "@motion-canvas/core";

export type SlideshowEffect =
  | "fade"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "zoomFade"
  | "rotateFade";

const DEFAULT_EFFECTS: SlideshowEffect[] = [
  "fade",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "zoomFade",
  "rotateFade",
];

export interface SlideshowProps extends NodeProps {
  /** 图片 URL / 导入资源数组 */
  images: string[];
  /** 画布宽 */
  width: number;
  /** 画布高 */
  height: number;
  /** 每张停留时长（秒），默认 2.5 */
  holdDuration?: number;
  /** 切换动画时长（秒），默认 0.8 */
  transitionDuration?: number;
  /** 随机种子，便于复现；默认随机构造 */
  seed?: number;
  /** 可用切换效果池，默认全套 */
  effects?: SlideshowEffect[];
}

/**
 * 双缓冲幻灯片：cover 铺满，无限循环，切换效果随机（避免连续重复）。
 * 场景侧用 any(slideshow.play(), waitFor(...)) 打断。
 */
export class Slideshow extends Node {
  private readonly layerA = createRef<Img>();
  private readonly layerB = createRef<Img>();
  private readonly images: string[];
  private readonly frameW: number;
  private readonly frameH: number;
  private readonly holdDuration: number;
  private readonly transitionDuration: number;
  private readonly effects: SlideshowEffect[];
  private readonly rng: Random;

  private index = 0;
  /** true = A 在上层为当前图 */
  private frontIsA = true;
  private lastEffect: SlideshowEffect | null = null;

  public constructor(props: SlideshowProps) {
    const {
      images,
      width,
      height,
      holdDuration = 2.5,
      transitionDuration = 0.8,
      seed = Random.createSeed(),
      effects = DEFAULT_EFFECTS,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!images || images.length === 0) {
      throw new Error("Slideshow: images 不能为空");
    }
    if (effects.length === 0) {
      throw new Error("Slideshow: effects 不能为空");
    }

    this.images = images;
    this.frameW = width;
    this.frameH = height;
    this.holdDuration = holdDuration;
    this.transitionDuration = transitionDuration;
    this.effects = effects;
    this.rng = new Random(seed);

    this.add(
      <Rect width={width} height={height} clip>
        <Img
          ref={this.layerA}
          src={images[0]}
          opacity={1}
          zIndex={1}
        />
        <Img
          ref={this.layerB}
          src={images[0]}
          opacity={0}
          zIndex={0}
        />
      </Rect>,
    );

    this.applyCover(this.layerA(), images[0]);
    this.applyCover(this.layerB(), images[0]);
    this.resetLayer(this.layerB(), false);
  }

  /** 无限循环播放；由场景侧 any / 线程打断停止 */
  public *play(): ThreadGenerator {
    if (this.images.length < 2) {
      while (true) {
        yield* waitFor(this.holdDuration);
      }
    }

    while (true) {
      yield* waitFor(this.holdDuration);
      yield* this.advance();
    }
  }

  /** 切到下一张（随机过渡） */
  public *advance(): ThreadGenerator {
    if (this.images.length < 2) {
      return;
    }

    const nextIndex = (this.index + 1) % this.images.length;
    const nextSrc = this.images[nextIndex];
    const outgoing = this.frontIsA ? this.layerA() : this.layerB();
    const incoming = this.frontIsA ? this.layerB() : this.layerA();
    const effect = this.pickEffect();

    this.applyCover(incoming, nextSrc);
    this.prepareIncoming(incoming, effect);
    incoming.zIndex(2);
    outgoing.zIndex(1);

    yield* this.runEffect(outgoing, incoming, effect);

    this.resetLayer(outgoing, false);
    outgoing.zIndex(0);
    incoming.zIndex(1);
    this.resetLayer(incoming, true);

    this.frontIsA = !this.frontIsA;
    this.index = nextIndex;
    this.lastEffect = effect;
  }

  private pickEffect(): SlideshowEffect {
    const pool =
      this.effects.length > 1 && this.lastEffect != null
        ? this.effects.filter((e) => e !== this.lastEffect)
        : this.effects;
    const i = this.rng.nextInt(0, pool.length);
    return pool[i];
  }

  private applyCover(img: Img, src: string) {
    img.src(src);
    const natural = img.naturalSize();
    const nw = natural.x > 0 ? natural.x : this.frameW;
    const nh = natural.y > 0 ? natural.y : this.frameH;
    const scale = Math.max(this.frameW / nw, this.frameH / nh);
    img.size([nw * scale, nh * scale]);
    img.position([0, 0]);
    img.scale(1);
    img.rotation(0);
  }

  private resetLayer(img: Img, visible: boolean) {
    img.opacity(visible ? 1 : 0);
    img.position([0, 0]);
    img.scale(1);
    img.rotation(0);
  }

  private prepareIncoming(img: Img, effect: SlideshowEffect) {
    img.opacity(0);
    img.position([0, 0]);
    img.scale(1);
    img.rotation(0);

    const w = this.frameW;
    const h = this.frameH;

    switch (effect) {
      case "fade":
        break;
      case "slideLeft":
        img.x(w);
        img.opacity(1);
        break;
      case "slideRight":
        img.x(-w);
        img.opacity(1);
        break;
      case "slideUp":
        img.y(h);
        img.opacity(1);
        break;
      case "slideDown":
        img.y(-h);
        img.opacity(1);
        break;
      case "zoomFade":
        img.scale(1.18);
        break;
      case "rotateFade": {
        const sign = this.rng.nextFloat() < 0.5 ? -1 : 1;
        img.rotation(sign * 10);
        break;
      }
    }
  }

  private *runEffect(
    outgoing: Img,
    incoming: Img,
    effect: SlideshowEffect,
  ): ThreadGenerator {
    const d = this.transitionDuration;
    const ease = easeInOutCubic;
    const w = this.frameW;
    const h = this.frameH;

    switch (effect) {
      case "fade":
        yield* all(
          outgoing.opacity(0, d, easeOutCubic),
          incoming.opacity(1, d, easeOutCubic),
        );
        break;
      case "slideLeft":
        yield* all(
          outgoing.x(-w, d, ease),
          outgoing.opacity(0, d, easeOutCubic),
          incoming.x(0, d, ease),
        );
        break;
      case "slideRight":
        yield* all(
          outgoing.x(w, d, ease),
          outgoing.opacity(0, d, easeOutCubic),
          incoming.x(0, d, ease),
        );
        break;
      case "slideUp":
        yield* all(
          outgoing.y(-h, d, ease),
          outgoing.opacity(0, d, easeOutCubic),
          incoming.y(0, d, ease),
        );
        break;
      case "slideDown":
        yield* all(
          outgoing.y(h, d, ease),
          outgoing.opacity(0, d, easeOutCubic),
          incoming.y(0, d, ease),
        );
        break;
      case "zoomFade":
        yield* all(
          outgoing.scale(0.92, d, ease),
          outgoing.opacity(0, d, easeOutCubic),
          incoming.scale(1, d, ease),
          incoming.opacity(1, d, easeOutCubic),
        );
        break;
      case "rotateFade": {
        const outRot = incoming.rotation() === 0 ? 8 : -incoming.rotation();
        yield* all(
          outgoing.rotation(outRot, d, ease),
          outgoing.opacity(0, d, easeOutCubic),
          incoming.rotation(0, d, ease),
          incoming.opacity(1, d, easeOutCubic),
        );
        break;
      }
    }
  }
}
