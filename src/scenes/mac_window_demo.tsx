import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { MacWindow } from "../components/window/mac_window";
import image from "../assets/Person/C.E.Shannon.jpg";

export default makeScene2D(function* (view) {
  view.fill("#0a0e14");

  const win = createRef<MacWindow>();

  view.add(
    <MacWindow
      ref={win}
      title={"克劳德·香农 · 1916—2001"}
      mode={"both"}
      image={image}
      text={`
**克劳德·香农（Claude Shannon）**，
美国数学家、**信息论**之父。
1937年硕士论文证明**布尔代数与开关电路**的一致性：
**与、或、非** 都可以用**电路通断**实现。
1948年发表**《通信的数学理论》**，
提出**比特**概念，奠定了**数字通信**的基础。
        `}
      windowWidth={1480}
      contentHeight={720}
      imageWidth={480}
    />,
  );

  yield* win().show(0.55);
  // 名字与图片初始即模糊：先高亮模糊处，再讲其余加粗，最后揭晓变清晰
  yield* win().highlightSecrets();
  yield* win().emphasizeBolds(1.3, 0.25, 0.12, 0.3, '#ffd166', 1, true);
  yield* waitFor(0.4);
  yield* win().revealSecrets();
  yield* waitFor(1);
});
