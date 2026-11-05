import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { ProgressBar } from "../components/progress/progress_bar";
import { SceneTitle } from "../components/title/scene_title";

const BG = "#0a0e14";

/**
 * Unicode 1.0 → 17.0 进度时间轴（1991 — 2025）：
 * 15 个版本节点，超宽进度条（6200）+ playCentered，
 * 播放时整体平移使聚焦节点尽量保持在屏幕中央。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const bar = createRef<ProgressBar>();

  view.add(<SceneTitle ref={title} text={"Unicode 版本时间线 · 1.0 — 17.0"} />);

  view.add(
    <ProgressBar
      ref={bar}
      start={1991}
      end={2026}
      barWidth={6200}
      barY={110}
      leftLabel={"1991 · 1.0"}
      rightLabel={"2025 · 17.0"}
      cardWidth={320}
      nodes={[
        { year: 1991.75, label: "1.0 · 1991-10", title: "初版，约7k字符" },
        { year: 1993.42, label: "1.1 · 1993-06", title: "对齐ISO 10646，扩CJK/Hangul" },
        { year: 1996.5, label: "2.0 · 1996-07", title: "17平面与代理对架构" },
        { year: 1999.67, label: "3.0 · 1999-09", title: "多脚本大扩充" },
        { year: 2001.17, label: "3.1 · 2001-03", title: "补充平面（CJK Ext-B）" },
        { year: 2003.25, label: "4.0 · 2003-04", title: "同步10646:2003" },
        { year: 2006.5, label: "5.0 · 2006-07", title: "N’Ko/Balinese等" },
        { year: 2010.75, label: "6.0 · 2010-10", title: "Emoji标准化起点" },
        { year: 2015.42, label: "8.0 · 2015-06", title: "肤色修饰符" },
        { year: 2017.42, label: "10.0 · 2017-06", title: "₿比特币符" },
        { year: 2020.17, label: "13.0 · 2020-03", title: "🥲/🥷/CJK Ext-G" },
        { year: 2021.67, label: "14.0 · 2021-09", title: "🫠/🫶，新脚本" },
        { year: 2022.67, label: "15.0 · 2022-09", title: "🫨，新印度脚本" },
        { year: 2024.67, label: "16.0 · 2024-09", title: "15.5万+字符，新非洲/南亚脚本" },
        { year: 2025.67, label: "17.0 · 2025-09", title: "新emoji与序列" },
      ]}
    />,
  );

  yield* title().show();
  yield* waitFor(0.2);
  // 超宽条带：边走边平移，焦点节点居中
  yield* bar().playCentered({ duration: 9, holdPerNode: 0.7 });
  yield* waitFor(1.2);
});
