import { Img, Layout, Line, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Highlight } from "../../theme/highlight";
import { Ink } from "../../theme/ink";
import { brushLine, inkReveal } from "../../theme/ink_anim";

import exeIcon from "../../assets/binary/exe.svg";
import ppIcon from "../../assets/binary/pp.svg";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';
const PAGE_FONT = "SF Mono, Consolas, monospace";

export interface MMProps extends NodeProps {
  /** 页表示意格数，默认 6 */
  pageEntries?: number;
  /** 物理页总数（标签用），默认 16；显示为前 3 + … + 后 2 */
  physPageTotal?: number;
  /** 应用程序数量，默认 2 */
  appCount?: number;
  /** 图标边长，默认 72 */
  iconSize?: number;
}

/** 可见物理页标签：开头 3 个下标 + 末尾 2 个下标 */
function visiblePhysIndices(total: number): number[] {
  const n = Math.max(5, Math.floor(total));
  return [0, 1, 2, n - 2, n - 1];
}

/**
 * 内存管理示意：垂直四层
 * 应用程序 → 分页机制 → 物理页管理算法 → 物理内存页
 */
export class MM extends Node {
  private readonly appLayer = createRef<Layout>();
  private readonly pageLayer = createRef<Layout>();
  private readonly algoLayer = createRef<Layout>();
  private readonly algoBox = createRef<Rect>();
  private readonly algoTxt = createRef<Txt>();
  private readonly physLayer = createRef<Layout>();
  private readonly pageCells = createRefArray<Rect>();
  private readonly connectorTop = createRef<Line>();
  private readonly connectorMid = createRef<Line>();
  private readonly connectorBottom = createRef<Line>();

  public constructor(props: MMProps = {}) {
    const {
      pageEntries = 6,
      physPageTotal = 16,
      appCount = 2,
      iconSize = 64,
      ...nodeProps
    } = props;

    super(nodeProps);

    const cellSize = 32;
    const cellGap = 8;
    const physGap = 20;
    const physIcon = Math.round(iconSize * 0.85);
    const apps = Math.max(1, Math.floor(appCount));
    const physIndices = visiblePhysIndices(physPageTotal);
    const slotW = physIcon + 14;

    // —— 1. 应用程序 ——
    this.add(
      <Layout
        ref={this.appLayer}
        layout
        direction={"column"}
        gap={12}
        alignItems={"center"}
        y={-340}
        opacity={0}
      >
        <Layout layout direction={"row"} gap={40} alignItems={"end"}>
          {Array.from({ length: apps }, (_, i) => (
            <Layout layout direction={"column"} gap={8} alignItems={"center"}>
              <Img src={exeIcon} width={iconSize} height={iconSize} />
              <Txt
                text={
                  apps === 1
                    ? "应用程序"
                    : `应用程序 ${String.fromCharCode(65 + i)}`
                }
                fontFamily={LABEL_FONT}
                fontSize={26}
                fill={Ink.paper}
              />
            </Layout>
          ))}
        </Layout>
      </Layout>,
    );

    this.add(
      <Line
        ref={this.connectorTop}
        points={[
          [0, -270],
          [0, -210],
        ]}
        stroke={Ink.gold}
        lineWidth={Ink.lineWidth}
        lineCap={"round"}
        end={0}
      />,
    );

    // —— 2. 分页机制 ——
    this.add(
      <Layout
        ref={this.pageLayer}
        layout
        direction={"column"}
        gap={12}
        alignItems={"center"}
        y={-140}
        opacity={0}
      >
        <Txt
          text={"分页机制"}
          fontFamily={LABEL_FONT}
          fontSize={26}
          fill={Ink.paperSoft}
        />
        <Layout layout direction={"row"} gap={cellGap} alignItems={"center"}>
          {Array.from({ length: pageEntries }, (_, i) => (
            <Rect
              ref={this.pageCells}
              width={cellSize}
              height={cellSize}
              radius={0}
              fill={Ink.deep}
              stroke={Ink.line}
              lineWidth={Ink.lineWidth}
              opacity={0}
              layout
              justifyContent={"center"}
              alignItems={"center"}
            >
              <Txt
                text={`${i}`}
                fill={Ink.muted}
                fontSize={15}
                fontFamily={PAGE_FONT}
              />
            </Rect>
          ))}
        </Layout>
      </Layout>,
    );

    this.add(
      <Line
        ref={this.connectorMid}
        points={[
          [0, -70],
          [0, -10],
        ]}
        stroke={Ink.gold}
        lineWidth={Ink.lineWidth}
        lineCap={"round"}
        end={0}
      />,
    );

    // —— 3. 物理页管理算法（完全显示后高亮）——
    this.add(
      <Layout
        ref={this.algoLayer}
        layout
        direction={"column"}
        gap={0}
        alignItems={"center"}
        y={40}
        opacity={0}
      >
        <Rect
          ref={this.algoBox}
          layout
          padding={[16, 36]}
          radius={0}
          fill={Ink.deep}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Txt
            ref={this.algoTxt}
            text={"物理页管理算法"}
            fontFamily={LABEL_FONT}
            fontSize={30}
            fill={Ink.paper}
          />
        </Rect>
      </Layout>,
    );

    this.add(
      <Line
        ref={this.connectorBottom}
        points={[
          [0, 90],
          [0, 150],
        ]}
        stroke={Ink.line}
        lineWidth={Ink.lineWidth}
        lineCap={"round"}
        end={0}
        opacity={0.5}
      />,
    );

    // —— 4. 物理内存页 ——
    const physItems: Array<
      { kind: "page"; index: number } | { kind: "ellipsis" }
    > = [
      { kind: "page", index: physIndices[0] },
      { kind: "page", index: physIndices[1] },
      { kind: "page", index: physIndices[2] },
      { kind: "ellipsis" },
      { kind: "page", index: physIndices[3] },
      { kind: "page", index: physIndices[4] },
    ];

    this.add(
      <Layout
        ref={this.physLayer}
        layout
        direction={"column"}
        gap={12}
        alignItems={"center"}
        y={300}
        opacity={0}
      >
        <Layout layout direction={"row"} gap={physGap} alignItems={"end"}>
          {physItems.map((item) =>
            item.kind === "ellipsis" ? (
              <Layout
                layout
                direction={"column"}
                gap={6}
                alignItems={"center"}
                width={slotW}
                height={physIcon + 14 + 24}
                justifyContent={"center"}
              >
                <Txt
                  text={"···"}
                  fontFamily={PAGE_FONT}
                  fontSize={26}
                  fill={Ink.paperSoft}
                />
              </Layout>
            ) : (
              <Layout layout direction={"column"} gap={6} alignItems={"center"}>
                <Rect
                  width={slotW}
                  height={physIcon + 14}
                  radius={0}
                  fill={Ink.deep}
                  stroke={Ink.line}
                  lineWidth={Ink.lineWidth}
                  layout
                  justifyContent={"center"}
                  alignItems={"center"}
                >
                  <Img src={ppIcon} width={physIcon} height={physIcon} />
                </Rect>
                <Txt
                  text={`Page${item.index}`}
                  fontFamily={PAGE_FONT}
                  fontSize={16}
                  fill={Ink.paperSoft}
                />
              </Layout>
            ),
          )}
        </Layout>
        <Txt
          text={"物理内存页"}
          fontFamily={LABEL_FONT}
          fontSize={26}
          fill={Ink.paper}
        />
      </Layout>,
    );
  }

  /** 高亮「物理页管理算法」层（描边/字色提亮 + 轻缩放，保持高亮） */
  public *highlightAlgo(duration = 0.55): ThreadGenerator {
    yield* all(
      this.algoBox().stroke(Highlight.stroke, duration, easeOutCubic),
      this.algoBox().lineWidth(Ink.lineWidth + 1.5, duration, easeOutCubic),
      this.algoBox().scale(1.06, duration, easeOutCubic),
      this.algoTxt().fill(Highlight.accent, duration, easeOutCubic),
      this.algoLayer().scale(1.04, duration, easeOutCubic),
    );
  }

  /** 自上而下依次显现四层，全部显示后高亮算法层 */
  public *play(): ThreadGenerator {
    yield* inkReveal(this.appLayer(), { fromY: 16, duration: 0.45 });
    yield* waitFor(0.15);

    yield* brushLine(this.connectorTop(), { duration: 0.3 });
    yield* waitFor(0.1);

    yield* inkReveal(this.pageLayer(), { fromY: 12, duration: 0.4 });
    yield* all(
      ...this.pageCells.map((cell, i) =>
        delay(i * 0.045, cell.opacity(1, 0.25, easeOutCubic)),
      ),
    );
    yield* waitFor(0.12);

    yield* brushLine(this.connectorMid(), { duration: 0.28 });
    yield* waitFor(0.08);

    yield* inkReveal(this.algoLayer(), { fromY: 12, duration: 0.4 });
    yield* waitFor(0.12);

    yield* brushLine(this.connectorBottom(), { duration: 0.28 });
    yield* waitFor(0.1);

    yield* inkReveal(this.physLayer(), { fromY: 14, duration: 0.45 });
    yield* waitFor(0.45);

    // 完全显示后高亮算法层
    yield* this.highlightAlgo();
    yield* waitFor(0.9);
  }
}
