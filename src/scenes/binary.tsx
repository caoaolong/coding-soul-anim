import { Img, makeScene2D, View2D } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  waitFor,
} from "@motion-canvas/core";
import { Brace, braceEdgeFromNodes } from "../components/annotation/brace";
import { BuddyRoot } from "../components/buddy/buddy_root";
import { NBytes } from "../components/bytes/n_bytes";
import { InkFormula } from "../components/formula/ink_formula";
import { CourseCover } from "../components/intro/course_cover";
import { TransitionTitle } from "../components/intro/transition_title";
import { MM } from "../components/memory/mm";
import { ComplexityPlot } from "../components/plot/complexity_plot";
import { Timeline } from "../components/timeline/timeline";
import { Ink } from "../theme/ink";
import { inkReveal } from "../theme/ink_anim";

import sceneBg from "../assets/bg.png";
import eniacImg from "../assets/binary/ENIAC.jpg";
import system360Img from "../assets/binary/IBM System_360.jpg";
import bellLabsImg from "../assets/binary/贝尔实验室.webp";
import windowsImg from "../assets/binary/Windows1.0.png";
import officeImg from "../assets/binary/办公.jpg";

/** 全场景共用背景透明度：压得很淡以呈若隐若现 */
const SCENE_BG_OPACITY = 0.08;

/**
 * 大道至简：二进制
 *
 * 整集拆成多段素材单独导出：只改下面 ACTIVE 即可切换要渲染的段。
 * 新增段：写 playXxx → 加入 SegmentId → 登记到 segments。
 */
type SegmentId =
  | "cover"
  | "introduction"
  | "memory"
  | "ops"
  | "o"
  | "buddy_title"
  | "buddy"
  | "buddy_demo";

/** 改这一行切换要导出的素材段 */
const ACTIVE = "buddy_demo" as SegmentId;

/** 片头自带不透明背景，其余段用淡墨共用底图 */
function useSharedSceneBg(segment: SegmentId): boolean {
  return segment !== "cover";
}

/** 片头：CourseCover */
function* playCover(view: View2D): ThreadGenerator {
  const cover = createRef<CourseCover>();
  view.add(
    <CourseCover
      ref={cover}
      series="算法之道"
      episodeTitle={"大道至简：二进制"}
      bgHeight={view.height()}
      bgOpacity={1}
    />,
  );

  yield* cover().play();
}

/** 引言：时间轴五节点（ENIAC → 无处不在） */
function* playIntroduction(view: View2D): ThreadGenerator {
  const timeline = createRef<Timeline>();
  view.add(
    <Timeline
      ref={timeline}
      canvasWidth={view.width()}
      canvasHeight={view.height()}
      nodes={[
        {
          time: "1946",
          title: "ENIAC问世",
          text: "ENIAC问世",
          detail:
            "ENIAC（Electronic Numerical Integrator and Computer，电子数值积分计算机）是世界上最早的通用电子数字计算机之一，于1946年在美国宾夕法尼亚大学正式公开。",
          image: eniacImg,
        },
        {
          time: "1964",
          title: "IBM System/360",
          text: "IBM System/360诞生",
          detail:
            "IBM System/360 是 IBM 于 1964 年推出的一系列大型计算机。它推动了计算机从“各自定制”走向标准化、系列化，对后来的计算机产业产生了深远影响。",
          image: system360Img,
        },
        {
          time: "1972",
          title: "C语言诞生",
          text: "C语言诞生",
          detail:
            "C语言诞生于 1972 年，由丹尼斯·里奇在贝尔实验室开发。它既能直接操作底层硬件，又具有较好的可移植性，后来被广泛用于操作系统和系统软件开发。",
          image: bellLabsImg,
        },
        {
          time: "1985",
          title: "Windows 1.0",
          text: "Windows1.0诞生",
          detail:
            "Windows 1.0 是微软于 1985 年推出的首个 Windows 图形化操作环境。它引入了窗口、图标、鼠标等图形界面，让用户可以通过点击操作计算机，而不再完全依赖命令行。它也标志着计算机开始进一步走向普通个人用户。",
          image: windowsImg,
        },
        {
          time: "现在",
          title: "无处不在",
          text: "计算机已经无处不在",
          detail:
            "而现在，计算机早已无处不在，从手机、汽车，到互联网和人工智能，正在深刻改变我们的世界。",
          image: officeImg,
        },
      ]}
    />,
  );

  for (let i = 0; i < 5; i++) {
    yield* timeline().next();
    yield* waitFor(1.2);
  }
}

/**
 * 内存：1 字节全 0 → 括号点题「1 byte=8 bits」→ 收括号 →
 * 跑马灯（NBytes.show）→ 从低位起逐位点灯置 1，每步添上当前位的位权表头 →
 * 偏上书写点题公式 Index = log₂Number（一横落笔）→ 下方再书 Value 求和公式 →
 * 公式与表头一并隐去、字节格清零 → 低 4 位再点灯 → 左移两次、右移两次收尾。
 */
function* playMemory(view: View2D): ThreadGenerator {
  const bytes = createRef<NBytes>();
  const brace = createRef<Brace>();

  // 先隐藏整组，墨晕入场后再出括号
  view.add(<NBytes ref={bytes} N={1} value={0} opacity={0} />);

  // 相对 NBytes 本地坐标：括号跨全部 bit 格上沿
  const edge = braceEdgeFromNodes(bytes(), [...bytes().cells], "top", 8);
  bytes().add(
    <Brace
      ref={brace}
      from={edge.from}
      to={edge.to}
      side={"top"}
      depth={22}
      label={"1 byte=8 bits"}
      stroke={Ink.gold}
      labelFill={Ink.goldSoft}
      lineWidth={Ink.lineWidth}
      fontSize={28}
      zIndex={5}
    />,
  );

  yield* inkReveal(bytes(), { duration: 0.55, fromY: 16 });
  yield* waitFor(0.35);

  yield* brace().show(0.55);
  yield* waitFor(1.2);

  // 收起括号，清出舞台给跑马灯（暂不出表头）
  yield* brace().hide(0.35);
  yield* waitFor(0.4);

  // 跑马灯：从右（低位）到左逐位点亮至全 1，再从左到右逐位熄灭回全 0
  yield* bytes().show();
  yield* waitFor(0.8);

  // 逐位点灯：从低位起依次置 1，每步添上当前位的位权表头（旧位保留，翻位与表头并行动画）
  for (let bit = 0; bit < bytes().bitCount; bit++) {
    yield* all(
      bytes().setBit(bit, 1),
      bytes().showHeader("power", 0.35, bit, true),
    );
    yield* waitFor(0.5);
  }
  yield* waitFor(0.8);

  // 点题公式：偏上书写出场，一横落笔
  const formula = createRef<InkFormula>();
  view.add(
    <InkFormula ref={formula} tex={"Index = \\log_{2} Number"} y={-280} />,
  );
  yield* formula().write(0.6);
  yield* waitFor(1.2);

  // 求和公式：下方书写出场（与字节格拉开距离，避免与位权表头重叠）
  const valueFormula = createRef<InkFormula>();
  view.add(
    <InkFormula
      ref={valueFormula}
      tex={"Value = \\sum^{n}_{i=0} Value_i \\times (2^{i})"}
      y={250}
    />,
  );
  yield* valueFormula().write(0.6);
  yield* waitFor(1.2);

  // 中场：两式与全部表头（含左侧十进制）一并隐去，字节格清零
  yield* all(formula().hide(), valueFormula().hide(), bytes().hideHeader());
  yield* bytes().setNumber(0);
  yield* waitFor(0.8);

  // 再点四位：每次只亮当前位，前一位恢复为 0，并配位权表头
  for (let bit = 0; bit < 6; bit++) {
    yield* all(
      bytes().setBit(bit, 1),
      ...(bit > 0 ? [bytes().setBit(bit - 1, 0)] : []),
      bytes().showHeader("power", 0.35, bit, false),
    );
    yield* waitFor(0.5);
  }
  yield* waitFor(0.8);

  // 移位前先亮出全部位权表头，再将当前值设为 14（0b1110），
  // 并把最左 1～最右 1 之间的位文字改为高亮色
  yield* bytes().showHeader("power");
  yield* bytes().setNumber(14);
  yield* bytes().highlightSignificantSpan();
  yield* waitFor(0.5);

  // 移位：左移两次，再右移两次
  yield* bytes().shiftLeft();
  yield* waitFor(0.4);
  yield* bytes().shiftLeft();
  yield* waitFor(0.8);
  yield* bytes().shiftRight();
  yield* waitFor(0.4);
  yield* bytes().shiftRight();
  yield* waitFor(1.0);
}

/** 过渡：二进制运算 */
function* playOps(view: View2D): ThreadGenerator {
  const page = createRef<TransitionTitle>();
  view.add(<TransitionTitle ref={page} title={"二进制运算"} />);
  yield* page().play();
}

/** 复杂度：O(n) vs O(1) 曲线对比（loop / bitwise） */
function* playO(view: View2D): ThreadGenerator {
  const plot = createRef<ComplexityPlot>();
  view.add(
    <ComplexityPlot
      ref={plot}
      complexities={["O(n)", "O(1)"]}
      legendLabels={["O(n)：loop", "O(1)：bitwise"]}
      legendWidth={260}
      width={900}
      height={560}
    />,
  );

  yield* plot().play();
  yield* waitFor(1.2);
}

/** 过渡：Buddy System / 伙伴系统 */
function* playBuddyTitle(view: View2D): ThreadGenerator {
  const page = createRef<TransitionTitle>();
  view.add(
    <TransitionTitle
      ref={page}
      title={"Buddy System"}
      subtitle={"伙伴系统"}
    />,
  );
  yield* page().play();
}

/** Buddy：内存管理三层示意（应用 → 分页 → 物理页） */
function* playBuddy(view: View2D): ThreadGenerator {
  const mm = createRef<MM>();
  view.add(<MM ref={mm} />);
  yield* mm().play();
}

/**
 * 伙伴概念预演：根块分裂一次 → 框选左右伙伴 → 点题「伙伴系统」→ 恢复原状。
 * 预演期间不显示空闲链表，也不显示 AllocPage。
 */
function* playBuddyConceptPreview(
  view: View2D,
  root: BuddyRoot,
): ThreadGenerator {
  const title = createRef<InkFormula>();

  // 分裂后框选两个内存块
  yield* root.demoSplitOnce(2.2, false);
  yield* waitFor(0.3);

  // 框选完成后再出现「伙伴系统」
  view.add(
    <InkFormula
      ref={title}
      tex={"\\,"}
      fontSize={40}
      y={-320}
    />,
  );
  yield* title().writePlain("伙伴系统", 0.55);
  yield* waitFor(0.35);

  // 标题出现即预演结束：直接恢复，不再二次框选
  yield* all(
    root.demoRestore(1.6, false),
    title().hide(0.35),
  );
  yield* waitFor(0.15);
}

/** Buddy 演示：概念预演后，再 AllocPage(7168) 申请 7KB */
function* playBuddyDemo(view: View2D): ThreadGenerator {
  const root = createRef<BuddyRoot>();
  const formula = createRef<InkFormula>();

  view.add(
    <BuddyRoot
      ref={root}
      order={3}
      pageSize={0x1000}
      start={0}
      canvasWidth={view.width()}
      canvasHeight={view.height()}
    />,
  );

  yield* root().showOrder();
  yield* waitFor(0.35);

  // 预演：无空闲链表、无 AllocPage
  yield* playBuddyConceptPreview(view, root());

  // 正式演示：亮出空闲链表与 AllocPage，再申请 7KB
  yield* root().setFreeListVisible(true, 0.4);
  yield* root().initFreeList();
  yield* waitFor(0.3);

  view.add(
    <InkFormula
      ref={formula}
      tex={"\\mathrm{AllocPage}(7168)"}
      fontSize={36}
      y={-320}
    />,
  );
  yield* formula().write(0.65);
  yield* waitFor(0.45);

  yield* root().alloc(7);
  yield* waitFor(1.2);
}

const segments: Record<
  SegmentId,
  (view: View2D) => ThreadGenerator
> = {
  cover: playCover,
  introduction: playIntroduction,
  memory: playMemory,
  ops: playOps,
  o: playO,
  buddy_title: playBuddyTitle,
  buddy: playBuddy,
  buddy_demo: playBuddyDemo,
};

export default makeScene2D(function* (view) {
  view.fill(Ink.bg);
  // 片头 CourseCover 自带不透明背景；其余段用淡墨共用底图
  if (useSharedSceneBg(ACTIVE)) {
    view.add(
      <Img src={sceneBg} height={view.height()} opacity={SCENE_BG_OPACITY} />,
    );
  }
  yield* segments[ACTIVE](view);
});
