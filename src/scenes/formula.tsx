import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { Formula } from "../components/formula/formula";

/** stack：普通字符串即可 */
const STACK_STEPS = [
  {
    tex: "V=(-1)^{S}\\times(1.M)_{2}\\times 2^{E_{\\text{存}}-\\mathrm{Bias}}",
  },
  {
    prefix: "=",
    tex: "(-1)^{1}\\times(1.100011)_{2}\\times 2^{130-127}",
  },
  {
    prefix: "=",
    tex: "-1.100011_{2}\\times 2^{3}",
  },
  {
    prefix: "\\Rightarrow",
    tex: "-12.375",
  },
];

/**
 * morph：用 {{...}} 拆子式，相同块会路径变形，不同块淡入/淡出
 * （这是 Motion Canvas 官方 Latex 动画方式）
 */
const MORPH_STEPS = [
  {
    tex: "{{V=}}{{(-1)^{S}}}{{\\times}}{{(1.M)_{2}}}{{\\times}}{{2^{E_{\\text{存}}-\\mathrm{Bias}}}}",
  },
  {
    prefix: "=",
    tex: "{{(-1)^{1}}}{{\\times}}{{(1.100011)_{2}}}{{\\times}}{{2^{130-127}}}",
  },
  {
    prefix: "=",
    tex: "{{-1.100011_{2}}}{{\\times}}{{2^{3}}}",
  },
  {
    prefix: "\\Rightarrow",
    tex: "{{-12.375}}",
  },
];

/**
 * 上：stack 多行淡入；下：morph 官方 Latex.tex 变形
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const stack = createRef<Formula>();
  const morph = createRef<Formula>();

  view.add(
    <Formula
      ref={stack}
      mode={"stack"}
      fontSize={34}
      gap={28}
      y={-220}
      steps={STACK_STEPS}
    />,
  );

  view.add(
    <Formula
      ref={morph}
      mode={"morph"}
      fontSize={38}
      y={200}
      steps={MORPH_STEPS}
    />,
  );

  yield* waitFor(0.3);
  yield* stack().play(0.4);
  yield* waitFor(0.5);
  yield* morph().play(0.9);
  yield* waitFor(1);
});
