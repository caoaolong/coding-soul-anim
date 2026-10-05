import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { SceneTitle } from "../components/title/scene_title";
import { PaperBoard } from "../components/paper/paper_board";

import paperImg from "../assets/papers/信息论.png";

const BG = "#0a0e14";

/**
 * 香农信息论：论文中央入场 → 移到左侧 → 右侧主要论点依次显示
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const board = createRef<PaperBoard>();

  view.add(<SceneTitle ref={title} text={"信息论的诞生"} />);
  view.add(
    <PaperBoard
      ref={board}
      image={paperImg}
      caption={"香农 · 1948 ·《通信的数学理论》"}
      points={[
        "通信的根本是在一端复现另一端选出的消息",
        "“比特”成为信息单位",
        "信息是消除不确定性的量",
        "无损压缩的极限就是信息熵",
      ]}
    />,
  );

  yield* title().show();
  yield* board().run();
  yield* waitFor(1.2);
});
