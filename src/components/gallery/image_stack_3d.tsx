import {Img, Node, NodeProps, Rect} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRefArray,
  delay,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const CARD = '#121820';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';

export interface ImageStack3DProps extends NodeProps {
  /** 图片资源列表（至少 1 张） */
  images: string[];
  /** 展示区宽度，默认 560 */
  width?: number;
  /** 展示区高度，默认 360 */
  height?: number;
  /** 堆叠时每层向右偏移，默认 36 */
  depthX?: number;
  /** 堆叠时每层向上偏移，默认 -22 */
  depthY?: number;
  /** 堆叠时每层缩小比例，默认 0.055 */
  depthScale?: number;
  /** 堆叠时每层旋转角度（度），默认 4 */
  depthRotate?: number;
  /** 圆角，默认 14 */
  radius?: number;
}

interface CardPose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

/**
 * 伪 3D 图片堆叠轮播：
 * 多张图以透视堆叠排列 → 前张飞到正视中心展示 → 消失 → 下一张，
 * 全部展示完后可重新堆叠循环。
 */
export class ImageStack3D extends Node {
  private readonly cards = createRefArray<Rect>();
  private readonly imgs = createRefArray<Img>();

  private readonly sources: string[];
  private readonly cardW: number;
  private readonly cardH: number;
  private readonly depthX: number;
  private readonly depthY: number;
  private readonly depthScale: number;
  private readonly depthRotate: number;
  private readonly radius: number;

  /** 尚未展示的卡片下标（按栈从前到后） */
  private remaining: number[] = [];

  public constructor(props: ImageStack3DProps) {
    const {
      images,
      width = 560,
      height = 360,
      depthX = 36,
      depthY = -22,
      depthScale = 0.055,
      depthRotate = 4,
      radius = 14,
      ...rest
    } = props;

    if (!images || images.length === 0) {
      throw new Error('ImageStack3D: images 不能为空');
    }

    super({opacity: 0, ...rest});

    this.sources = images;
    this.cardW = width;
    this.cardH = height;
    this.depthX = depthX;
    this.depthY = depthY;
    this.depthScale = depthScale;
    this.depthRotate = depthRotate;
    this.radius = radius;
    this.remaining = images.map((_, i) => i);

    for (let i = 0; i < images.length; i++) {
      const pose = this.stackPose(i, images.length);
      this.add(
        <Rect
          ref={this.cards}
          width={width}
          height={height}
          radius={radius}
          fill={CARD}
          stroke={LINE}
          lineWidth={2}
          clip
          x={pose.x}
          y={pose.y}
          scale={pose.scale}
          rotation={pose.rotation}
          opacity={0}
          zIndex={images.length - i}
          shadowColor={'rgba(0,0,0,0.45)'}
          shadowBlur={28}
          shadowOffset={[10, 14]}
        >
          <Img
            ref={this.imgs}
            src={images[i]}
            width={width}
            height={height}
          />
        </Rect>,
      );
    }
  }

  /** 堆叠位姿：index 0 为最前 */
  private stackPose(stackIndex: number, total: number): CardPose {
    const i = stackIndex;
    return {
      x: i * this.depthX,
      y: i * this.depthY,
      scale: Math.max(0.55, 1 - i * this.depthScale),
      rotation: i * this.depthRotate,
      opacity: Math.max(0.45, 1 - i * 0.1),
    };
  }

  private frontPose(): CardPose {
    return {x: 0, y: 0, scale: 1.08, rotation: 0, opacity: 1};
  }

  /** 整组淡入并落到堆叠位 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* this.opacity(1, duration * 0.4, easeOutCubic);
    yield* all(
      ...this.cards.map((card, i) => {
        const pose = this.stackPose(i, this.sources.length);
        card.x(pose.x + 80);
        card.y(pose.y + 40);
        card.scale(pose.scale * 0.85);
        card.rotation(pose.rotation + 8);
        return delay(
          i * 0.07,
          all(
            card.opacity(pose.opacity, duration * 0.7, easeOutCubic),
            card.x(pose.x, duration, easeOutCubic),
            card.y(pose.y, duration, easeOutCubic),
            card.scale(pose.scale, duration, easeOutBack),
            card.rotation(pose.rotation, duration, easeOutCubic),
          ),
        );
      }),
    );
  }

  /** 剩余卡片重新收拢成堆 */
  private *restack(duration = 0.4): ThreadGenerator {
    const n = this.remaining.length;
    if (n === 0) return;
    yield* all(
      ...this.remaining.map((cardIdx, stackIdx) => {
        const pose = this.stackPose(stackIdx, n);
        const card = this.cards[cardIdx];
        card.zIndex(n - stackIdx);
        return all(
          card.x(pose.x, duration, easeInOutCubic),
          card.y(pose.y, duration, easeInOutCubic),
          card.scale(pose.scale, duration, easeInOutCubic),
          card.rotation(pose.rotation, duration, easeInOutCubic),
          card.opacity(pose.opacity, duration, easeOutCubic),
          card.stroke(LINE, duration, easeOutCubic),
          card.lineWidth(2, duration, easeOutCubic),
        );
      }),
    );
  }

  /** 将栈顶一张拉到正视 → 停留 → 消失 */
  public *presentNext(
    hold = 0.85,
    flyDuration = 0.55,
    leaveDuration = 0.4,
  ): ThreadGenerator {
    if (this.remaining.length === 0) return;

    const cardIdx = this.remaining[0];
    const card = this.cards[cardIdx];
    const front = this.frontPose();

    // 其余压暗
    const dimAnims = this.remaining.slice(1).map(idx =>
      all(
        this.cards[idx].opacity(0.28, flyDuration * 0.6, easeOutCubic),
        this.cards[idx].scale(
          this.cards[idx].scale() * 0.96,
          flyDuration * 0.6,
          easeOutCubic,
        ),
      ),
    );

    card.zIndex(100);
    yield* all(
      card.x(front.x, flyDuration, easeInOutCubic),
      card.y(front.y, flyDuration, easeInOutCubic),
      card.scale(front.scale, flyDuration, easeOutBack),
      card.rotation(front.rotation, flyDuration, easeInOutCubic),
      card.opacity(1, flyDuration * 0.5, easeOutCubic),
      card.stroke(ACCENT, flyDuration * 0.5, easeOutCubic),
      card.lineWidth(3.5, flyDuration * 0.5, easeOutCubic),
      card.shadowBlur(40, flyDuration, easeOutCubic),
      ...dimAnims,
    );

    yield* waitFor(hold);

    // 正视卡片飞出消失
    yield* all(
      card.y(front.y - 120, leaveDuration, easeInCubic),
      card.scale(0.75, leaveDuration, easeInCubic),
      card.opacity(0, leaveDuration * 0.85, easeInCubic),
      card.rotation(-8, leaveDuration, easeInCubic),
    );

    this.remaining.shift();
    yield* this.restack(0.35);
  }

  /** 重置为完整堆叠（用于循环） */
  public *resetStack(duration = 0.5): ThreadGenerator {
    this.remaining = this.sources.map((_, i) => i);
    for (let i = 0; i < this.cards.length; i++) {
      const pose = this.stackPose(i, this.sources.length);
      const card = this.cards[i];
      card.zIndex(this.sources.length - i);
      card.x(pose.x + 60);
      card.y(pose.y + 30);
      card.scale(pose.scale * 0.8);
      card.rotation(pose.rotation + 6);
      card.opacity(0);
      card.stroke(LINE);
      card.lineWidth(2);
      card.shadowBlur(28);
    }
    yield* all(
      ...this.cards.map((card, i) => {
        const pose = this.stackPose(i, this.sources.length);
        return delay(
          i * 0.06,
          all(
            card.opacity(pose.opacity, duration * 0.7, easeOutCubic),
            card.x(pose.x, duration, easeOutCubic),
            card.y(pose.y, duration, easeOutCubic),
            card.scale(pose.scale, duration, easeOutBack),
            card.rotation(pose.rotation, duration, easeOutCubic),
          ),
        );
      }),
    );
  }

  /**
   * 完整流程：展示堆叠 → 逐张正视并消失 → 可选循环。
   * @param loops 循环次数（整轮），默认 1；传 Infinity 需由场景自行截断
   */
  public *play(options?: {
    hold?: number;
    loops?: number;
    pauseBetweenLoops?: number;
  }): ThreadGenerator {
    const hold = options?.hold ?? 0.85;
    const loops = options?.loops ?? 1;
    const pause = options?.pauseBetweenLoops ?? 0.45;

    yield* this.show();
    yield* waitFor(0.35);

    for (let round = 0; round < loops; round++) {
      if (round > 0) {
        yield* waitFor(pause);
        yield* this.resetStack();
        yield* waitFor(0.3);
      }
      while (this.remaining.length > 0) {
        yield* this.presentNext(hold);
        yield* waitFor(0.15);
      }
    }
  }
}
