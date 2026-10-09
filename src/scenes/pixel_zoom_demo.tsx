import {Latex, Rect, makeScene2D} from '@motion-canvas/2d';
import {
  Vector2,
  all,
  createRef,
  easeOutCubic,
  useRandom,
  waitFor,
} from '@motion-canvas/core';
import {Magnifier, ViewCamera} from '../components/image/magnifier';
import {PixelCanvas} from '../components/image/pixel_canvas';
import {SceneTitle} from '../components/title/scene_title';
import natureImg from '../assets/Person/nature.png';

const BG = '#0a0e14';
const PAPER = '#e8eef7';

// ───────── 可配置 ─────────
const IMAGE_SRC = natureImg;
const DISPLAY_WIDTH = 1400;
/** 随机聚焦次数 */
const FOCUS_COUNT = 3;
/** 圆形视野直径（屏幕空间） */
const LENS_SIZE = 520;
/** 视野最终倍率 */
const FINAL_ZOOM = 80;
// ──────────────────────────

function pickDistinctPixels(
  random: {nextFloat(): number},
  nat: Vector2,
  count: number,
): Array<{x: number; y: number}> {
  const minDist = Math.min(nat.x, nat.y) * 0.18;
  const pts: Array<{x: number; y: number}> = [];
  let guard = 0;
  while (pts.length < count && guard < 400) {
    guard++;
    const x = Math.min(nat.x - 1, Math.floor(random.nextFloat() * nat.x));
    const y = Math.min(nat.y - 1, Math.floor(random.nextFloat() * nat.y));
    if (pts.every(p => Math.hypot(p.x - x, p.y - y) >= minDist)) {
      pts.push({x, y});
    }
  }
  while (pts.length < count) {
    pts.push({
      x: Math.floor((pts.length + 0.5) * (nat.x / (count + 1))),
      y: Math.floor(nat.y * (0.3 + 0.2 * pts.length)),
    });
  }
  return pts;
}

/**
 * 图像像素演示：
 * 淡入底图 → 圆形视野出现 → 三次随机选像素并移动视角聚焦 → RGB
 *
 * 不用 Motion Canvas 自带 Camera：它对 Img 有缓存裁切 bug，
 * 半透明时会只露出一角，opacity=1 才突然全图。
 * 改用 ViewCamera（Node position/scale）模拟正交视野。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const cam = createRef<ViewCamera>();
  const canvas = createRef<PixelCanvas>();
  const lens = createRef<Magnifier>();
  const swatch = createRef<Rect>();
  const info = createRef<Latex>();
  const random = useRandom();

  view.add(<SceneTitle ref={title} text={'离散的图像'} />);

  view.add(
    <ViewCamera ref={cam}>
      <PixelCanvas
        ref={canvas}
        src={IMAGE_SRC}
        displayWidth={DISPLAY_WIDTH}
        smoothing={true}
        y={20}
      />
    </ViewCamera>,
  );

  view.add(
    <Magnifier ref={lens} lensSize={LENS_SIZE} maskColor={BG} />,
  );

  // HUD 在视野节点外，不受推拉影响
  view.add(
    <Rect
      ref={swatch}
      width={64}
      height={64}
      radius={8}
      x={720}
      y={360}
      stroke={PAPER}
      lineWidth={2}
      opacity={0}
      zIndex={20}
    />,
  );
  view.add(
    <Latex
      ref={info}
      tex={['']}
      fill={PAPER}
      fontSize={30}
      x={540}
      y={360}
      opacity={0}
      zIndex={20}
    />,
  );

  yield* title().show();
  yield* canvas().prepare();

  const nat = canvas().naturalSize();
  const targets = pickDistinctPixels(random, nat, FOCUS_COUNT);

  // 1) 底图淡入（全幅视野）
  yield* canvas().fadeIn(0.8);
  yield* waitFor(0.35);

  // 2) 圆形视野出现
  yield* lens().appear(0.55);
  yield* waitFor(0.2);

  // 3) 三次随机像素：首次推近，之后平移视角到新像素
  for (let i = 0; i < targets.length; i++) {
    const {x: px, y: py} = targets[i];

    if (i > 0) {
      yield* all(
        canvas().hideHighlight(0.18),
        swatch().opacity(0, 0.18, easeOutCubic),
        info().opacity(0, 0.18, easeOutCubic),
      );
    }

    yield* cam().focusPixel(canvas(), px, py, {
      duration: i === 0 ? 2.2 : 1.6,
      finalZoom: FINAL_ZOOM,
      pixelate: true,
      highlight: true,
    });
    yield* waitFor(0.2);

    const sample = canvas().samplePixel(px, py);
    swatch().fill(sample.color);
    info().tex([`${sample.coordTex}\\quad ${sample.rgbTex}`]);
    yield* all(
      swatch().opacity(1, 0.35, easeOutCubic),
      info().opacity(1, 0.35, easeOutCubic),
    );
    yield* waitFor(i === targets.length - 1 ? 1.6 : 0.9);
  }
});
