import { makeScene2D } from "@motion-canvas/2d";
import { createRef } from "@motion-canvas/core";
import { PoemIntro } from "../components/intro/poem_intro";

const POEM_FONT = "Zhi Mang Xing";

/**
 * 竖排诗句片头演示：从右到左逐字书写
 */
export default makeScene2D(function* (view) {
  view.fill("#121212");

  // 等本地字体就绪，避免首帧回退到系统字体
  yield document.fonts.load(`58px "${POEM_FONT}"`);

  const poem = createRef<PoemIntro>();
  view.add(
    <PoemIntro
      ref={poem}
      poem={"床前明月光\n疑是地上霜\n举头望明月\n低头思故乡"}
      width={view.width()}
      height={view.height()}
      fontFamily={`"${POEM_FONT}", KaiTi, STKaiti, serif`}
      fontSize={58}
      // 每列总时长对齐该句音频（秒）；也可在 play({ columnDurations }) 里传入
      columnDurations={[2.4, 2.6, 2.5, 3.0]}
    />,
  );

  yield* poem().play();
});

