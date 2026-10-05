import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { ProgressBar } from "../components/progress/progress_bar";
import { SceneTitle } from "../components/title/scene_title";
import { Question } from "../components/question/question";
import booleImg from "../assets/Person/GeorgeBoole.jpg";
import shannonImg from "../assets/Person/C.E.Shannon.jpg";
import transistorImg from "../assets/Person/贝尔实验室三兄弟.jpeg";

const BG = "#0a0e14";

/**
 * 1800–2000 进度时间轴：布尔代数 → 香农 → 晶体管
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const bar = createRef<ProgressBar>();
  const question = createRef<Question>();

  view.add(<SceneTitle ref={title} text={"计算之路 · 1800 — 2000"} />);
  view.add(
    <Question
      ref={question}
      text={"那到底是谁将布尔代数代入到晶体管数字电路的呢？"}
    />,
  );

  view.add(
    <ProgressBar
      ref={bar}
      start={1800}
      end={2000}
      barWidth={1760}
      barY={40}
      nodes={[
        {
          year: 1847,
          title: "乔治·布尔提出布尔代数",
          image: booleImg,
        },
        // {
        //   year: 1937,
        //   title: "克劳德·香农证明布尔代数与开关电路的一致性",
        //   image: shannonImg,
        // },
        {
          year: 1947,
          title: "晶体管在贝尔实验室诞生",
          image: transistorImg,
        },
      ]}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  yield* bar().play({ duration: 5, holdPerNode: 1.0 });
  yield* waitFor(0.6);
  yield* question().ask();
  yield* waitFor(0.8);
});
