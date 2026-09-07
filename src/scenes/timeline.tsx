import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Timeline } from "../components/timeline";

export default makeScene2D(function* (view) {
  view.fill("#121212");

  const timeline = createRef<Timeline>();
  const size = view.size();

  view.add(
    <Timeline
      ref={timeline}
      canvasWidth={size.x}
      canvasHeight={size.y}
      nodes={[
        {
          time: "2023.01",
          title: "Idea",
          text: "从一个问题出发：如何把时间线讲清楚？",
        },
        {
          time: "2023.06",
          title: "Design",
          text: "横向贴底，窗口在轴上方；next 先滚轴再放大到中央。",
          image:
            "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80",
        },
        {
          time: "2024.02",
          title: "Build",
          text: "封装 Timeline 组件，节点支持纯文字或左图右文。",
          image:
            "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80",
        },
        {
          time: "2024.09",
          title: "Demo",
          text: "调用 next()，逐个展开时间节点。",
        },
      ]}
    />,
  );

  // 初始停顿：全部小窗在轴上
  yield* waitFor(0.6);

  // 依次聚焦四个节点
  yield* timeline().next(0.9);
  yield* waitFor(0.8);

  yield* timeline().next(0.9);
  yield* waitFor(0.8);

  yield* timeline().next(0.9);
  yield* waitFor(0.8);

  yield* timeline().next(0.9);
  yield* waitFor(1.2);
});
