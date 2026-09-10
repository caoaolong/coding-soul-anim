import { makeScene2D } from "@motion-canvas/2d";
import { any, createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { Slideshow } from "../components/slideshow/slideshow";
import bg from "../assets/bg.png";

/** 演示用色块图（无需额外素材） */
function solidSvg(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <rect width="100%" height="100%" fill="${color}"/>
  <text x="50%" y="50%" fill="#E8E0D0" font-size="64" font-family="sans-serif"
    text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * 幻灯片演示：无限循环 + 随机切换；约 12 秒后用 any 打断
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const slideshow = createRef<Slideshow>();
  view.add(
    <Slideshow
      ref={slideshow}
      images={[
        bg,
        solidSvg("#1e3a5f", "Slide 2"),
        solidSvg("#3d2a1a", "Slide 3"),
        solidSvg("#1a3328", "Slide 4"),
      ]}
      width={view.width()}
      height={view.height()}
      holdDuration={2.2}
      transitionDuration={0.85}
    />,
  );

  // play() 无限循环；与 waitFor 竞速，到时打断
  yield* any(slideshow().play(), waitFor(12));
});
