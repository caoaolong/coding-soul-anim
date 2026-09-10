import { makeScene2D } from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { Ink } from "../theme";
import { NBytes } from "../components/bytes/n_bytes";

export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const bytes = createRef<NBytes>();

  view.add(
    <NBytes
      ref={bytes}
      N={2}
      value={0xb10f}
      cellSize={64}
    />,
  );

  yield* waitFor(0.6);

  // 顶部显示 bit 下标 7…0
  yield* bytes().showHeader("index");
  yield* waitFor(0.6);

  // 脉冲高亮 bit0、bit7、bit8（跨字节）
  yield* bytes().highlight(0);
  yield* waitFor(0.25);
  yield* bytes().highlight(7);
  yield* waitFor(0.25);
  yield* bytes().highlight(8);
  yield* waitFor(0.6);

  // 切换到 2^n + 十进制
  yield* bytes().showHeader("power");
  yield* waitFor(1.2);

  // 一次性写入新数值
  yield* bytes().setNumber(0x3c5a);
  yield* waitFor(0.6);

  // 逻辑左移：文字左滑，最高位舍弃
  yield* bytes().shiftLeft();
  yield* waitFor(0.4);
  yield* bytes().shiftLeft();
  yield* waitFor(0.6);

  // 逻辑右移：文字右滑，最低位舍弃
  yield* bytes().shiftRight();
  yield* waitFor(0.4);
  yield* bytes().shiftRight();
  yield* waitFor(1);
});
