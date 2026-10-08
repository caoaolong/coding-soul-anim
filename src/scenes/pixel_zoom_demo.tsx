import {Latex, Rect, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeOutCubic, waitFor} from '@motion-canvas/core';
import {Magnifier, ViewCamera} from '../components/image/magnifier';
import {PixelCanvas} from '../components/image/pixel_canvas';
import {SceneTitle} from '../components/title/scene_title';
import natureImg from '../assets/Person/nature.png';

const BG = '#0a0e14';
const PAPER = '#e8eef7';

// ───────── 可配置 ─────────
const IMAGE_SRC = natureImg;
const DISPLAY_WIDTH = 1400;
/** 目标像素（-1 = 按比例自动取） */
const PIXEL_X = -1;
const PIXEL_Y = -1;
const PIXEL_U = 0.62;
const PIXEL_V = 0.38;
/** 圆形视野直径（屏幕空间） */
const LENS_SIZE = 520;
/** 视野最终倍率 */
const FINAL_ZOOM = 80;
// ──────────────────────────

/**
 * 图像像素演示：
 * 淡入底图 → 圆形视野（放大镜）出现 → 推近到目标像素 → RGB
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
  const px =
    PIXEL_X >= 0
      ? Math.min(Math.floor(PIXEL_X), nat.x - 1)
      : Math.min(Math.floor(PIXEL_U * nat.x), nat.x - 1);
  const py =
    PIXEL_Y >= 0
      ? Math.min(Math.floor(PIXEL_Y), nat.y - 1)
      : Math.min(Math.floor(PIXEL_V * nat.y), nat.y - 1);

  // 1) 底图淡入（全幅视野）
  yield* canvas().fadeIn(0.8);
  yield* waitFor(0.35);

  // 2) 圆形视野出现
  yield* lens().appear(0.55);
  yield* waitFor(0.2);

  // 3) 视野对准目标像素并拉近
  yield* cam().focusPixel(canvas(), px, py, {
    duration: 2.4,
    finalZoom: FINAL_ZOOM,
    pixelate: true,
    highlight: true,
  });
  yield* waitFor(0.25);

  // 4) HUD：色块 + 坐标/RGB
  const sample = canvas().samplePixel(px, py);
  swatch().fill(sample.color);
  info().tex([`${sample.coordTex}\\quad ${sample.rgbTex}`]);
  yield* all(
    swatch().opacity(1, 0.4, easeOutCubic),
    info().opacity(1, 0.4, easeOutCubic),
  );
  yield* waitFor(2.0);
});
