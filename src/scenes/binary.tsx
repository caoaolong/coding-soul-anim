import { Img, Txt, makeScene2D, View2D } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Brace, braceEdgeFromNodes } from "../components/annotation/brace";
import { BuddyRoot } from "../components/buddy/buddy_root";
import { NBytes } from "../components/bytes/n_bytes";
import { InkFormula } from "../components/formula/ink_formula";
import { CourseCover } from "../components/intro/course_cover";
import { TransitionTitle } from "../components/intro/transition_title";
import { MM } from "../components/memory/mm";
import { BitCell, spawnBitRow } from "../components/memory/bit_cell";
import { ComplexityPlot } from "../components/plot/complexity_plot";
import { FunctionPlot } from "../components/plot/function_plot";
import { CycleRing } from "../components/cycle/cycle_ring";
import { DataTable } from "../components/table/data_table";
import { Float } from "../components/float/float";
import { PopupPanel } from "../components/panel/popup_panel";
import { NumberAxis } from "../components/axis/number_axis";
import { BTree } from "../components/tree/b_tree";
import { FlowChart } from "../components/flow/flow_chart";
import { Timeline } from "../components/timeline/timeline";
import { Ink } from "../theme/ink";
import { inkFade, inkReveal } from "../theme/ink_anim";

import sceneBg from "../assets/bg.png";
import eniacImg from "../assets/binary/ENIAC.jpg";
import system360Img from "../assets/binary/IBM System_360.jpg";
import bellLabsImg from "../assets/binary/贝尔实验室.webp";
import windowsImg from "../assets/binary/Windows1.0.png";
import officeImg from "../assets/binary/办公.jpg";
import memoryIcon from "../assets/binary/pp.svg";
import btreeIcon from "../assets/binary/btree.svg";
import bambooIcon from "../assets/binary/竹简.svg";
import battleIcon from "../assets/binary/对战.svg";
import systemIcon from "../assets/binary/系统.svg";
import arrayIcon from "../assets/binary/数组.svg";
import algoIcon from "../assets/binary/算法.svg";

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
  | "storage_title"
  | "storage"
  | "memory"
  | "ops"
  | "o"
  | "buddy_title"
  | "buddy"
  | "buddy_demo"
  | "cycle"
  | "address"
  | "btree"
  | "btree2array"
  | "btree_address"
  | "b2f"
  | "float"
  | "overview"
  | "tradeoff"
  | "analogy";

/** 改这一行切换要导出的素材段 */
const ACTIVE = "cover" as SegmentId;

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

/** 过渡：二进制存储 */
function* playStorageTitle(view: View2D): ThreadGenerator {
  const page = createRef<TransitionTitle>();
  view.add(<TransitionTitle ref={page} title={"二进制存储"} />);
  yield* page().play();
}

/**
 * 存储原理（教学简化）：晶体管＝开关，电容＝蓄电。
 * 单格写 1 / 写 0 → 点题「有电＝1，无电＝0」→ 复制成 8 格过渡到 memory。
 */
function* playStorage(view: View2D): ThreadGenerator {
  const cell = createRef<BitCell>();
  const title = createRef<InkFormula>();

  view.add(<BitCell ref={cell} y={-20} />);
  view.add(
    <InkFormula
      ref={title}
      tex={"\\,"}
      fontSize={40}
      y={280}
    />,
  );

  yield* cell().show(0.55);
  yield* waitFor(0.35);

  yield* cell().writeOne(0.75);
  yield* waitFor(0.55);

  yield* cell().writeZero(0.8);
  yield* waitFor(0.35);

  yield* title().writePlain("有电＝1，无电＝0", 0.55);
  yield* waitFor(0.7);

  // 再写回 1，以「有电」态展开成 8 格，衔接下一段字节
  yield* cell().writeOne(0.55);
  yield* waitFor(0.25);
  yield* title().hide(0.35);
  yield* spawnBitRow(view, cell(), 8, 140, 0.75);
  yield* waitFor(0.35);
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

/** Buddy 演示：概念预演后，在同一棵树上依次申请 7KB、3KB */
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

  // 正式演示：亮出空闲链表与 AllocPage
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

  // 7KB 申请分裂
  yield* root().alloc(7);
  const firstAlloc = root().lastAllocated;
  yield* waitFor(1.0);

  // 保持当前占用，继续在剩余空闲块上申请 3KB
  yield* formula().rewrite("\\mathrm{AllocPage}(3072)", 0.55, false);
  yield* waitFor(0.4);
  yield* root().alloc(3);
  const secondAlloc = root().lastAllocated;
  yield* waitFor(1.0);

  // 先释放第二次申请的 3KB
  if (secondAlloc) {
    yield* formula().rewrite("\\mathrm{FreePage}(3072)", 0.5, false);
    yield* waitFor(0.35);
    yield* root().free(secondAlloc);
  }
  yield* waitFor(0.8);

  // 再释放第一次申请的 7KB（继续向上合并）
  if (firstAlloc) {
    yield* formula().rewrite("\\mathrm{FreePage}(7168)", 0.5, false);
    yield* waitFor(0.35);
    yield* root().free(firstAlloc);
  }
  yield* waitFor(1.2);
}

/** 环形循环组件预览 */
function* playCycle(view: View2D): ThreadGenerator {
  const ring = createRef<CycleRing>();
  const formula = createRef<InkFormula>();

  view.add(
    <CycleRing
      ref={ring}
      theme={"伙伴系统"}
      labels={["分裂", "合并"]}
      radius={240}
      nodeSize={80}
    />,
  );

  yield* ring().play();
  yield* waitFor(0.35);

  view.add(
    <InkFormula
      ref={formula}
      tex={"\\,"}
      fontSize={40}
      y={-380}
    />,
  );
  yield* formula().writePlain("伙伴寻址", 0.6);
  yield* waitFor(1.0);
}

/** 生成 order 伙伴系统各阶内存块：起始地址（十六进制）与大小 */
function buddyAddressRows(
  order: number,
  pageSize: number,
  start = 0,
): string[][] {
  const rows: string[][] = [];
  const maxVal = Math.max(
    start + pageSize * 2 ** order - 1,
    pageSize * 2 ** order,
  );
  const hexDigits = Math.max(4, maxVal.toString(16).length);
  const fmtHex = (addr: number) =>
    `0x${addr.toString(16).toUpperCase().padStart(hexDigits, "0")}`;

  for (let o = order; o >= 0; o--) {
    const size = pageSize * 2 ** o;
    const count = 2 ** (order - o);
    for (let i = 0; i < count; i++) {
      const blockStart = start + i * size;
      rows.push([`order=${o}`, fmtHex(blockStart), fmtHex(size)]);
    }
  }
  return rows;
}

/** 删掉顶阶后，剩余块按两行一对的伙伴对（含表格行下标） */
function buddyPairsAfterDropTop(
  order: number,
  pageSize: number,
  start = 0,
): Array<{
  rows: [number, number];
  addrA: number;
  addrB: number;
  size: number;
  left: string;
  mid: string;
  right: string;
  equation: string;
}> {
  const maxVal = Math.max(
    start + pageSize * 2 ** order - 1,
    pageSize * 2 ** order,
  );
  const hexDigits = Math.max(4, maxVal.toString(16).length);
  const fmtHex = (n: number) =>
    `0x${n.toString(16).toUpperCase().padStart(hexDigits, "0")}`;

  const pairs: Array<{
    rows: [number, number];
    addrA: number;
    addrB: number;
    size: number;
    left: string;
    mid: string;
    right: string;
    equation: string;
  }> = [];
  let row = 0;
  for (let o = order - 1; o >= 0; o--) {
    const size = pageSize * 2 ** o;
    const count = 2 ** (order - o);
    for (let i = 0; i < count; i += 2) {
      const addrA = start + i * size;
      const addrB = start + (i + 1) * size;
      const left = fmtHex(addrA);
      const mid = fmtHex(size);
      const right = fmtHex(addrB);
      pairs.push({
        rows: [row, row + 1],
        addrA,
        addrB,
        size,
        left,
        mid,
        right,
        equation: `${left} + ${mid} = ${right}`,
      });
      row += 2;
    }
  }
  return pairs;
}

/** 地址表：删 order=3 后两行一组框选；先演示加法寻址，再演示异或寻址 */
function* playAddress(view: View2D): ThreadGenerator {
  const table = createRef<DataTable>();
  const formula = createRef<InkFormula>();
  const order = 3;
  const pageSize = 0x1000;
  const rows = buddyAddressRows(order, pageSize, 0);
  const pairs = buddyPairsAfterDropTop(order, pageSize, 0);

  view.add(
    <DataTable
      ref={table}
      headers={["order", "起始地址", "大小"]}
      rows={rows}
      group={"order"}
      stripeEvery={2}
      columnWidths={[160, 280, 160]}
      rowHeight={44}
      fontSize={22}
      borders={"horizontal"}
      headerTextColor={Ink.goldSoft}
      groupTextColor={Ink.goldSoft}
      stroke={Ink.line}
      opacity={0}
    />,
  );

  yield* inkReveal(table(), { duration: 0.6, fromY: 16 });
  yield* waitFor(0.8);

  // 删掉 order=3 整组
  yield* table().deleteGroup("order=3", {
    duration: 0.55,
    highlight: true,
    highlightDuration: 0.85,
    highlightColor: Ink.seal,
  });
  yield* waitFor(0.5);

  view.add(
    <InkFormula
      ref={formula}
      tex={"\\,"}
      fontSize={36}
      y={-460}
    />,
  );

  // 第一遍：addr + size = buddy
  yield* playAddressPairPass(table(), formula(), pairs, "+");
  yield* waitFor(0.35);
  yield* formula().hide(0.3);
  yield* waitFor(0.25);

  // 第二遍：addr ⊕ size = buddy
  yield* playAddressPairPass(table(), formula(), pairs, "⊕");
  yield* waitFor(0.6);
}

/** 两行一组框选并同步顶部算式（op 为 + 或 ⊕） */
function* playAddressPairPass(
  table: DataTable,
  formula: InkFormula,
  pairs: Array<{
    rows: [number, number];
    left: string;
    mid: string;
    right: string;
  }>,
  op: string,
): ThreadGenerator {
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    yield* table.annotateCells(
      [
        { row: pair.rows[0], column: "起始地址" },
        { row: pair.rows[0], column: "大小" },
        { row: pair.rows[1], column: "起始地址" },
        { row: pair.rows[1], column: "大小" },
      ],
      {
        style: "box",
        phase: i === 0 ? "enter" : "move",
        color: Ink.seal,
        padding: 8,
        lineWidth: Ink.lineWidth,
        radius: 0,
        duration: i === 0 ? 0.45 : 0.55,
      },
    );
    yield* waitFor(0.12);
    if (i === 0) {
      yield* formula.writeEquation(pair.left, pair.mid, pair.right, 0.55, op);
    } else {
      yield* formula.updateEquation(pair.left, pair.mid, pair.right, 0.4, op);
    }
    yield* waitFor(0.35);
  }

  yield* table.annotateCells([], {
    style: "box",
    phase: "leave",
    duration: 0.4,
  });
}

/** 满二叉树：展开标注 → 高亮 h → 逐行横线扫描并展示 max(n_i) 公式 */
function* playBtree(view: View2D): ThreadGenerator {
  const tree = createRef<BTree>();
  const formula = createRef<InkFormula>();
  const L = 4;

  view.add(
    <BTree
      ref={tree}
      L={L}
      nodeSize={90}
      spacing={40}
    />,
  );

  yield* tree().create(0.45);
  yield* waitFor(0.35);
  yield* tree().rowNumber(0.4);
  yield* waitFor(0.2);
  yield* tree().showHeight(0.55);
  yield* waitFor(0.35);
  yield* tree().highlightHeight(0.55);
  yield* waitFor(0.3);

  view.add(
    <InkFormula
      ref={formula}
      tex={"\\,"}
      fontSize={34}
      y={-460}
    />,
  );

  // 逐行：横线 enter/move + 高亮该行节点 + 顶部公式局部更新
  for (let i = 0; i < L; i++) {
    const phase = i === 0 ? "enter" : "move";
    yield* all(
      tree().annotateRow(i, phase, i === 0 ? 0.5 : 0.45),
      tree().highlightLevel(i, true, 0.45),
      tree().pulseRowNumber(i, 0.4),
    );
    yield* waitFor(0.08);
    if (i === 0) {
      yield* formula().writeMaxNi(0, 0.55);
    } else {
      yield* formula().updateMaxNi(i, 0.4);
    }
    yield* waitFor(0.28);
  }

  yield* all(
    tree().annotateRow(0, "leave", 0.4),
    formula().hide(0.35),
  );
  yield* waitFor(0.35);

  // 顶部：依次高亮 i=x，累加 2^i，最后闭合为等比求和公式
  const sumFormula = createRef<InkFormula>();
  view.add(
    <InkFormula
      ref={sumFormula}
      tex={"\\,"}
      fontSize={30}
      y={-460}
    />,
  );

  for (let i = 0; i < L; i++) {
    yield* tree().pulseRowNumber(i, 0.45);
    const partial = geomSumPartial(i);
    if (i === 0) {
      yield* sumFormula().writeTex(partial, 0.5);
    } else {
      yield* sumFormula().updateLatex(partial, 0.4);
    }
    yield* waitFor(0.28);
  }

  yield* waitFor(0.35);
  yield* sumFormula().updateLatex(geomSumClosed(), 0.55);
  yield* waitFor(0.8);

  // 收起标注与公式，重建一棵无标注的满二叉树
  yield* all(
    inkFade(tree(), { duration: 0.45 }),
    sumFormula().hide(0.4),
  );
  tree().remove();
  sumFormula().remove();
  yield* waitFor(0.2);

  const fresh = createRef<BTree>();
  view.add(
    <BTree
      ref={fresh}
      L={L}
      nodeSize={90}
      spacing={40}
    />,
  );
  yield* fresh().create(0.45);
  yield* waitFor(1.0);
}

/** 累加到 2^i：2^0 + 2^1 + 2^2 + … */
function geomSumPartial(upto: number): string {
  const parts: string[] = [];
  for (let k = 0; k <= upto; k++) {
    parts.push(`2^{${k}}`);
  }
  return parts.join(" + ");
}

/**
 * 闭合等比求和（与树上 h 标注一致：末项 2^h，和为 2^{h+1}-1）。
 * 逐项相加展示的是 i=0..h 共 h+1 层时用 h=L-1；
 * 此处按用户给定格式使用符号 h。
 */
function geomSumClosed(): string {
  return String.raw`1 + 2 + 4 + \cdots + 2^{h} = \frac{1 - 2^{h+1}}{1 - 2} = 2^{h+1} - 1`;
}

/**
 * 二叉树 ↔ 线性结构：两行流程图
 * 物理内存 → 伙伴系统
 * 数组 → 满二叉树
 */
function* playBtree2Array(view: View2D): ThreadGenerator {
  const row1 = createRef<FlowChart>();
  const row2 = createRef<FlowChart>();
  const rows = [row1, row2];
  const rowPitch = 280;

  const chartProps = {
    iconSize: 110,
    gap: 200,
    fontSize: 30,
  } as const;

  view.add(
    <FlowChart
      ref={row1}
      {...chartProps}
      steps={[
        { icon: memoryIcon, label: "物理内存" },
        { icon: systemIcon, label: "伙伴系统" },
      ]}
    />,
  );
  view.add(
    <FlowChart
      ref={row2}
      {...chartProps}
      steps={[
        { icon: arrayIcon, label: "数组" },
        { icon: btreeIcon, label: "满二叉树" },
      ]}
    />,
  );

  /** 让前 visible 行相对屏幕中心对称排布 */
  function* recenter(visible: number, duration = 0.5): ThreadGenerator {
    const anims = [];
    for (let i = 0; i < visible; i++) {
      const y = (i - (visible - 1) / 2) * rowPitch;
      anims.push(rows[i]().y(y, duration, easeInOutCubic));
    }
    yield* all(...anims);
  }

  yield* recenter(1, 0);
  yield* row1().play(0.55, 0.35);
  yield* waitFor(0.45);

  yield* recenter(2);
  yield* row2().play(0.55, 0.35);
  yield* waitFor(1.2);
}

/** 伙伴寻址：满二叉树 + i/order 行标注 + 父子组高亮与左右孩子公式 */
function* playBtreeAddress(view: View2D): ThreadGenerator {
  const tree = createRef<BTree>();
  const formula = createRef<InkFormula>();

  view.add(
    <BTree
      ref={tree}
      L={4}
      nodeSize={90}
      spacing={40}
      labelStyle={"number"}
      startIndex={0}
      rowLabel={"i/order"}
    />,
  );
  yield* tree().create(0.45);
  yield* waitFor(0.35);
  yield* tree().rowNumber(0.4);
  yield* waitFor(0.35);

  view.add(
    <InkFormula
      ref={formula}
      tex={"\\,"}
      fontSize={32}
      y={-360}
    />,
  );

  // 从根起依次高亮「父 + 左右子」，顶部局部更新 n_左=2n+1 / n_右=2n+2
  const nonLeaves = tree().nonLeafCount;
  for (let n = 0; n < nonLeaves; n++) {
    yield* tree().highlightFamily(n, true, 0.5);
    if (n === 0) {
      yield* formula().writeTex(childIndexFormula(n), 0.5);
    } else {
      yield* formula().updateLatex(childIndexFormula(n), 0.4);
    }
    yield* waitFor(0.28);
  }

  yield* waitFor(0.45);
  // 编号步长改为 4K：整树一次性改写为 0、4K、8K…
  yield* formula().hide(0.35);
  yield* waitFor(0.2);
  yield* tree().relabelByStride(4, 0.45);
  yield* waitFor(0.8);
}

/** n_left=2n+1，n_right=2n+2（n 为当前父节点编号） */
function childIndexFormula(n: number): string {
  return String.raw`n_{\mathrm{left}}=2\cdot ${n}+1,\quad n_{\mathrm{right}}=2\cdot ${n}+2`;
}

/** 过渡：伙伴系统 → 浮点数 */
function* playB2f(view: View2D): ThreadGenerator {
  const page = createRef<TransitionTitle>();
  view.add(
    <TransitionTitle
      ref={page}
      title={"浮点数"}
      subtitle={"IEEE Standard for Floating-Point Arithmetic (IEEE 754)"}
    />,
  );
  yield* page().play();
}

/** 浮点数：位布局 → S/E/M → 顶部赋值 → 符号/整数/小数与进制换算 */
function* playFloat(view: View2D): ThreadGenerator {
  const f = createRef<Float>();
  const code = createRef<InkFormula>();
  const radix = createRef<InkFormula>();

  view.add(
    <Float
      ref={f}
      value={0}
      opacity={0}
    />,
  );
  yield* inkReveal(f(), { duration: 0.6, fromY: 16 });
  yield* waitFor(0.35);
  yield* f().showLabels(0.45);
  yield* waitFor(0.3);
  yield* f().highlight("sign", true, 0.5);
  yield* waitFor(0.15);
  yield* f().highlight("exponent", true, 0.5);
  yield* waitFor(0.15);
  yield* f().highlight("mantissa", true, 0.5);
  yield* waitFor(0.35);

  view.add(
    <InkFormula
      ref={code}
      tex={"\\,"}
      fontSize={36}
      y={-320}
    />,
  );
  yield* code().writeFloatAssign(-12.75, 0.9);
  yield* waitFor(0.35);
  yield* code().highlightFloatPart("sign", 0.8);
  yield* f().setBit(0, 1, 0.35);
  yield* waitFor(0.25);

  view.add(
    <InkFormula
      ref={radix}
      tex={"\\,"}
      fontSize={32}
      y={220}
    />,
  );

  // 整数 12 → 二进制
  yield* code().highlightFloatPart("int", 0.8);
  yield* radix().writeTex(
    String.raw`12_{(10)} = 1100_{(2)}`,
    0.75,
  );
  yield* waitFor(0.45);

  // 小数 0.75 → 二进制
  yield* code().highlightFloatPart("frac", 0.8);
  yield* radix().rewrite(
    String.raw`0.75_{(10)} = 0.11_{(2)}`,
    0.95,
  );
  yield* waitFor(0.45);

  // 合并绝对值
  yield* radix().rewrite(
    String.raw`12.75_{(10)} = 1100.11_{(2)}`,
    0.95,
  );
  yield* waitFor(0.5);

  // 规格化：小数点左移 → 1.xxxx，记下真指数 e（10011 可单独圈选为 M）
  yield* radix().appendLatexPieces(
    [
      { tex: String.raw`\xrightarrow{\text{Standardization}}` },
      { tex: String.raw`1.` },
      { tex: String.raw`10011`, key: "M" },
      { tex: String.raw`_{(2)},\ e=3` },
    ],
    0.85,
  );
  yield* waitFor(0.6);

  // PopupPanel：IEEE 754 偏置参数 + E = e + bias + 数轴演示
  const panel = createRef<PopupPanel>();
  const biasEq = createRef<InkFormula>();
  const axis = createRef<NumberAxis>();
  view.add(
    <PopupPanel ref={panel} zIndex={40} y={-20}>
      <DataTable
        headers={["格式", "符号位", "指数位", "尾数位", "偏置"]}
        rows={[
          ["单精度 float32", "1", "8", "23", "127"],
          ["双精度 float64", "1", "11", "52", "1023"],
        ]}
        columnWidths={[240, 110, 110, 110, 120]}
        rowHeight={42}
        fontSize={20}
        borders={"box"}
        headerTextColor={Ink.goldSoft}
        stroke={Ink.line}
      />
      <InkFormula
        ref={biasEq}
        tex={"\\,"}
        fontSize={34}
        underline={false}
      />
      <NumberAxis
        ref={axis}
        origin={127}
        leftSpan={8}
        rightSpan={8}
        width={560}
        initialValue={127}
        formatValue={(v) => `E=${v}`}
        fontSize={28}
      />
    </PopupPanel>,
  );
  yield* panel().show(0.55);
  yield* biasEq().writeTex(
    String.raw`E = e + \mathrm{bias}`,
    0.7,
  );
  yield* waitFor(0.35);
  // 游标沿真指数来回：E = 127 + e
  yield* axis().travel([130, 122, 135, 127, 130], 0.65, 0.25);
  yield* waitFor(0.8);
  yield* panel().hide(0.45);
  yield* waitFor(0.35);

  // 套用偏置：E = bias + e → 十进制 / 二进制（10000010 可圈选为 E）
  yield* radix().appendLatexPieces(
    [
      { tex: String.raw`\xrightarrow{}` },
      { tex: String.raw`E=127+3=130_{(10)}=` },
      { tex: String.raw`10000010`, key: "E" },
      { tex: String.raw`_{(2)}` },
    ],
    0.9,
  );
  yield* waitFor(0.45);

  // 红框圈选尾数 10011 → M，再圈选阶码 10000010 → E
  yield* radix().annotateKey("M", {
    label: "M",
    color: Ink.seal,
    duration: 1.1,
  });
  yield* waitFor(0.25);
  yield* radix().annotateKey("E", {
    label: "E",
    color: Ink.goldSoft,
    duration: 1.1,
  });
  yield* waitFor(0.35);

  // 写入 Float：E=10000010，M=10011（右侧补 0）
  yield* f().writeSectionBits("exponent", "10000010", 0.65);
  yield* waitFor(0.2);
  yield* f().writeSectionBits("mantissa", "10011", 0.65);
  yield* waitFor(0.8);
}

/** 总览环：伙伴系统 / 二叉树 / 浮点数编码，核心「自身性质」 */
function* playOverview(view: View2D): ThreadGenerator {
  const ring = createRef<CycleRing>();
  view.add(
    <CycleRing
      ref={ring}
      theme={"自身性质"}
      labels={["伙伴系统", "二叉树", "浮点数编码"]}
      radius={320}
      nodeSize={168}
      themeSize={44}
    />,
  );
  yield* ring().play({
    spinTurns: 1,
    spinDuration: 1.6,
  });
  yield* waitFor(1.2);
}

/**
 * 取舍示意：算法复杂度 ↑ → 系统稳定性 ↓（反比曲线）
 */
function* playTradeoff(view: View2D): ThreadGenerator {
  const title = createRef<Txt>();
  const plot = createRef<FunctionPlot>();

  view.add(
    <Txt
      ref={title}
      text={"简单算法才能构建稳定的复杂系统"}
      fontFamily={'"SimFang", FangSong, STFangsong, serif'}
      fontSize={40}
      fill={Ink.paper}
      y={-360}
      opacity={0}
    />,
  );
  view.add(
    <FunctionPlot
      ref={plot}
      fn={(x) => 12 / x}
      xMin={1}
      xMax={12}
      width={920}
      height={540}
      xLabel={"算法复杂度"}
      yLabel={"系统稳定性"}
      stroke={Ink.goldSoft}
      opacity={0}
    />,
  );
  yield* inkReveal(plot(), { duration: 0.55, fromY: 16 });
  yield* waitFor(0.2);
  yield* plot().trace(1.8);
  yield* waitFor(0.35);
  yield* inkReveal(title(), { duration: 0.55, fromY: 12 });
  yield* waitFor(1.5);
}

/**
 * 类比流程图（逐行显现，每加入一行整体重新居中）：
 * 善之善者 → 不战而屈人之兵
 * 复杂系统 → 简单算法
 * 万物之繁 → 大道至简
 */
function* playAnalogy(view: View2D): ThreadGenerator {
  const row1 = createRef<FlowChart>();
  const row2 = createRef<FlowChart>();
  const row3 = createRef<FlowChart>();
  const rows = [row1, row2, row3];
  /** 行中心间距；每多一行按此重算整体垂直居中 */
  const rowPitch = 300;

  const chartProps = {
    iconSize: 100,
    gap: 240,
    fontSize: 28,
    titleFontSize: 64,
  } as const;

  view.add(
    <FlowChart
      ref={row1}
      {...chartProps}
      steps={[
        { icon: bambooIcon, label: "善之善者" },
        { icon: battleIcon, label: "不战而屈人之兵" },
      ]}
    />,
  );
  view.add(
    <FlowChart
      ref={row2}
      {...chartProps}
      steps={[
        { icon: systemIcon, label: "复杂系统" },
        { icon: algoIcon, label: "简单算法" },
      ]}
    />,
  );
  view.add(
    <FlowChart
      ref={row3}
      {...chartProps}
      steps={[{ label: "万物之繁" }, { label: "大道至简" }]}
    />,
  );

  /** 让前 visible 行相对屏幕中心对称排布 */
  function* recenter(visible: number, duration = 0.5): ThreadGenerator {
    const anims = [];
    for (let i = 0; i < visible; i++) {
      const y = (i - (visible - 1) / 2) * rowPitch;
      anims.push(rows[i]().y(y, duration, easeInOutCubic));
    }
    yield* all(...anims);
  }

  // 第一行：单独居中后播放
  yield* recenter(1, 0);
  yield* row1().play(0.55, 0.35);
  yield* waitFor(0.45);

  // 第二行加入 → 两行整体居中 → 再播第二行
  yield* recenter(2);
  yield* row2().play(0.55, 0.35);
  yield* waitFor(0.45);

  // 第三行加入 → 三行整体居中 → 再播第三行
  yield* recenter(3);
  yield* row3().play(0.55, 0.35);
  yield* waitFor(1.2);
}

const segments: Record<
  SegmentId,
  (view: View2D) => ThreadGenerator
> = {
  cover: playCover,
  introduction: playIntroduction,
  storage_title: playStorageTitle,
  storage: playStorage,
  memory: playMemory,
  ops: playOps,
  o: playO,
  buddy_title: playBuddyTitle,
  buddy: playBuddy,
  buddy_demo: playBuddyDemo,
  cycle: playCycle,
  address: playAddress,
  btree: playBtree,
  btree2array: playBtree2Array,
  btree_address: playBtreeAddress,
  b2f: playB2f,
  float: playFloat,
  overview: playOverview,
  tradeoff: playTradeoff,
  analogy: playAnalogy,
};

const binaryScene = makeScene2D(function* (view) {
  view.fill(Ink.bg);
  // 片头 CourseCover 自带不透明背景；其余段用淡墨共用底图
  if (useSharedSceneBg(ACTIVE)) {
    view.add(
      <Img src={sceneBg} height={view.height()} opacity={SCENE_BG_OPACITY} />,
    );
  }
  yield* segments[ACTIVE](view);
});

export default binaryScene;
