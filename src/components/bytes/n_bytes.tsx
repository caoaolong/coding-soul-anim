import {
  Latex,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
} from "@motion-canvas/2d";
import {
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  ThreadGenerator,
} from "@motion-canvas/core";

export interface NBytesProps extends NodeProps {
  /** 字节数，必须 1–2 */
  N: number;
  /** 初始十进制数值（小端拆成 N 字节填入格子，左侧显示为「xx=」） */
  value?: number;
  /** 单个 bit 格子边长 */
  cellSize?: number;
  /** bit 格子间距 */
  gap?: number;
  /** 多字节时的字节间距（横向） */
  byteGap?: number;
  /** index 表头左侧描述，默认 Index */
  indexLabel?: string;
  /** power 表头左侧描述，默认 Number */
  powerLabel?: string;
}

/**
 * 显示 N 个字节（每字节 8 bit，N ≤ 2）。
 * 字节横向排列：高字节在左、低字节在右（整体左高右低）；
 * 格内 bit 从左到右为高位→低位（右侧为 bit 0）。
 * value 按小端拆分：低字节写入右侧字节槽。
 */
export class NBytes extends Node {
  public readonly cells = createRefArray<Rect>();
  public readonly bitTexts = createRefArray<Txt>();

  private readonly indexHeader = createRef<Node>();
  private readonly powerHeader = createRef<Node>();
  private readonly valueLabel = createRef<Txt>();

  private readonly byteCount: number;
  private readonly cellSize: number;
  private readonly gap: number;
  private readonly byteGap: number;
  private readonly bits: number[][];
  private headerShown: "index" | "power" | null = null;

  public constructor(props: NBytesProps) {
    const {
      N,
      value = 0,
      cellSize = 56,
      gap = 8,
      byteGap = 24,
      indexLabel = "Index",
      powerLabel = "Number",
      ...nodeProps
    } = props;

    super(nodeProps);

    this.byteCount = Math.max(1, Math.min(2, Math.floor(N)));
    this.cellSize = cellSize;
    this.gap = gap;
    this.byteGap = byteGap;
    this.bits = [];

    const num = Math.max(0, Math.floor(value));
    for (let b = 0; b < this.byteCount; b++) {
      const byteVal = (num >> (b * 8)) & 0xff;
      const row: number[] = [];
      for (let i = 7; i >= 0; i--) {
        row.push((byteVal >> i) & 1);
      }
      this.bits.push(row);
    }

    const byteWidth = 8 * cellSize + 7 * gap;
    const gridWidth =
      this.byteCount * byteWidth + (this.byteCount - 1) * byteGap;
    const gridHeight = cellSize;
    const headerGap = 20;
    const powerHeaderH = 56;
    // 预留 power 表头高度，避免切换时整体跳动；index 垂直居中于该区域
    const headerAreaH = powerHeaderH;
    const totalH = headerAreaH + headerGap + gridHeight;

    const topY = -totalH / 2;
    const headerCenterY = topY + headerAreaH / 2;
    const gridY = topY + headerAreaH + headerGap + cellSize / 2;

    /** 高字节在左：visualSlot 0 对应最高字节 */
    const byteOriginX = (visualSlot: number) =>
      -gridWidth / 2 + visualSlot * (byteWidth + byteGap);

    const cellX = (byteIndex: number, col: number) => {
      const visualSlot = this.byteCount - 1 - byteIndex;
      return byteOriginX(visualSlot) + cellSize / 2 + col * (cellSize + gap);
    };

    // 表头左侧描述：右对齐贴在最左列左侧
    const labelX = -gridWidth / 2 - 16;

    // 当前十进制值：右对齐贴在格子左侧，格式「xx=」；随 showHeader 一并显现
    this.add(
      <Txt
        ref={this.valueLabel}
        text={`${this.computeNumber()}=`}
        x={labelX}
        y={gridY}
        offset={[1, 0]}
        fill={"#FFFFFF"}
        fontSize={cellSize * 0.42}
        fontWeight={700}
        fontFamily={"SF Mono, Consolas, monospace"}
        opacity={0}
      />,
    );

    // index 表头：每个字节上方各一份 7…0
    this.add(
      <Node ref={this.indexHeader} opacity={0}>
        <Txt
          text={indexLabel}
          x={labelX}
          y={headerCenterY}
          offset={[1, 0]}
          fill={"#FFFFFF"}
          fontSize={26}
          fontWeight={700}
          fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
        />
        {Array.from({ length: this.byteCount }, (_, visualSlot) => {
          const byteIndex = this.byteCount - 1 - visualSlot;
          return Array.from({ length: 8 }, (_, col) => {
            const bitIndex = 7 - col;
            return (
              <Txt
                x={cellX(byteIndex, col)}
                y={headerCenterY}
                text={`${bitIndex}`}
                fill={"#FFFFFF"}
                fontSize={28}
                fontWeight={700}
                textAlign={"center"}
              />
            );
          });
        }).flat()}
      </Node>,
    );

    // power 表头：按整体位权（小端低字节在右）显示 2^n + 十进制
    this.add(
      <Node ref={this.powerHeader} opacity={0}>
        <Txt
          text={powerLabel}
          x={labelX}
          y={headerCenterY}
          offset={[1, 0]}
          fill={"#FFFFFF"}
          fontSize={26}
          fontWeight={700}
          fontFamily={"SF Pro Text, Segoe UI, sans-serif"}
        />
        {Array.from({ length: this.byteCount }, (_, visualSlot) => {
          const byteIndex = this.byteCount - 1 - visualSlot;
          const base = byteIndex * 8;
          return Array.from({ length: 8 }, (_, col) => {
            const bitIndex = 7 - col;
            const absBit = base + bitIndex;
            const power = Math.pow(2, absBit);
            return (
              <Layout
                layout
                direction={"column"}
                gap={4}
                x={cellX(byteIndex, col)}
                y={headerCenterY}
                alignItems={"center"}
              >
                <Latex
                  tex={`{2^{${absBit}}}`}
                  fill={"#FFFFFF"}
                  fontSize={22}
                />
                <Txt
                  text={`${power}`}
                  fill={"#FFFFFF"}
                  fontSize={20}
                  fontWeight={700}
                  textAlign={"center"}
                />
              </Layout>
            );
          });
        }).flat()}
      </Node>,
    );

    // bit 格子：按字节×列显式坐标（高字节在左）
    for (let byteIdx = 0; byteIdx < this.byteCount; byteIdx++) {
      for (let col = 0; col < 8; col++) {
        const bit = this.bits[byteIdx][col];
        this.add(
          <Rect
            ref={this.cells}
            x={cellX(byteIdx, col)}
            y={gridY}
            width={cellSize}
            height={cellSize}
            radius={8}
            fill={"#1D293B"}
            stroke={"#5C79A3"}
            lineWidth={3}
            layout
            justifyContent={"center"}
            alignItems={"center"}
          >
            <Txt
              ref={this.bitTexts}
              text={`${bit}`}
              fill={"#FFFFFF"}
              fontSize={cellSize * 0.45}
              fontWeight={700}
              fontFamily={"SF Mono, Consolas, monospace"}
            />
          </Rect>,
        );
      }
    }
  }

  /**
   * 在顶部显示每个格子对应的 bit 位（从右向左）。
   * - `index`：每字节 0–7 编号
   * - `power`：上行 2^n，下行十进制值（按整体位权）
   */
  public *showHeader(
    type: "index" | "power",
    duration = 0.45,
  ): ThreadGenerator {
    const show = type === "index" ? this.indexHeader() : this.powerHeader();
    const hide =
      type === "index" ? this.powerHeader() : this.indexHeader();
    const value = this.valueLabel();

    if (this.headerShown === type) {
      yield* all(
        show.opacity(1, duration, easeInOutCubic),
        value.opacity(1, duration, easeInOutCubic),
      );
      return;
    }

    if (this.headerShown == null) {
      hide.opacity(0);
      yield* all(
        show.opacity(1, duration, easeInOutCubic),
        value.opacity(1, duration, easeInOutCubic),
      );
    } else {
      yield* all(
        hide.opacity(0, duration * 0.5, easeInOutCubic),
        show.opacity(1, duration, easeInOutCubic),
        value.opacity(1, duration, easeInOutCubic),
      );
    }

    this.headerShown = type;
  }

  /** 读取某字节当前按位组成的数值（0–255） */
  public getByte(byteIndex: number): number {
    const row = this.bits[byteIndex];
    if (!row) {
      return 0;
    }
    return row.reduce((acc, bit, col) => acc + (bit << (7 - col)), 0);
  }

  /** 读取当前整体小端十进制数值 */
  public getNumber(): number {
    return this.computeNumber();
  }

  private computeNumber(): number {
    let n = 0;
    for (let b = 0; b < this.byteCount; b++) {
      n |= this.getByte(b) << (b * 8);
    }
    return n;
  }

  private syncValueLabel(): void {
    this.valueLabel().text(`${this.computeNumber()}=`);
  }

  /** 更新左侧十进制，并做一次颜色+缩放脉冲高亮 */
  private *pulseValueLabel(duration = 0.38): ThreadGenerator {
    this.syncValueLabel();
    // 表头未显示时数字仍隐藏，只改文案
    if (this.headerShown == null) {
      return;
    }

    const label = this.valueLabel();
    label.opacity(1);
    yield* all(
      label
        .fill("#FBBF24", duration * 0.3, easeInOutCubic)
        .to("#FFFFFF", duration * 0.7, easeInOutCubic),
      label
        .scale(1.22, duration * 0.3, easeInOutCubic)
        .to(1, duration * 0.7, easeInOutCubic),
    );
  }

  /**
   * 一次性将整数按小端写入全部格子，并更新左侧十进制显示。
   */
  public *setNumber(num: number, duration = 0.45): ThreadGenerator {
    const value = Math.max(0, Math.floor(num));
    const nextBits: number[][] = [];

    for (let b = 0; b < this.byteCount; b++) {
      const byteVal = (value >> (b * 8)) & 0xff;
      const row: number[] = [];
      for (let i = 7; i >= 0; i--) {
        row.push((byteVal >> i) & 1);
      }
      nextBits.push(row);
    }

    const half = duration * 0.5;
    const fadeOut: ThreadGenerator[] = [];
    for (let b = 0; b < this.byteCount; b++) {
      for (let col = 0; col < 8; col++) {
        const idx = b * 8 + col;
        fadeOut.push(
          this.bitTexts[idx].opacity(0, half, easeInOutCubic),
          this.cells[idx].stroke("#F59E0B", half, easeInOutCubic),
        );
      }
    }
    yield* all(...fadeOut);

    for (let b = 0; b < this.byteCount; b++) {
      for (let col = 0; col < 8; col++) {
        this.bits[b][col] = nextBits[b][col];
        this.bitTexts[b * 8 + col].text(`${nextBits[b][col]}`);
      }
    }

    const fadeIn: ThreadGenerator[] = [];
    for (let b = 0; b < this.byteCount; b++) {
      for (let col = 0; col < 8; col++) {
        const idx = b * 8 + col;
        fadeIn.push(
          this.bitTexts[idx].opacity(1, half, easeInOutCubic),
          this.cells[idx].stroke("#5C79A3", half, easeInOutCubic),
        );
      }
    }
    yield* all(...fadeIn);
    yield* this.pulseValueLabel();
  }

  /**
   * 整体逻辑左移：格内文字向左滑动，最左（最高位）舍弃，最右补 0。
   */
  public *shiftLeft(duration = 0.55): ThreadGenerator {
    yield* this.shiftBits(-1, duration);
  }

  /**
   * 整体逻辑右移：格内文字向右滑动，最右（最低位）舍弃，最左补 0。
   */
  public *shiftRight(duration = 0.55): ThreadGenerator {
    yield* this.shiftBits(1, duration);
  }

  /**
   * @param dir -1 左移，+1 右移
   */
  private *shiftBits(dir: -1 | 1, duration: number): ThreadGenerator {
    const total = this.byteCount * 8;
    const order = this.displayOrder();

    // 当前显示序列（左→右）
    const values = order.map(([b, c]) => this.bits[b][c]);
    const positions = order.map(([b, c]) => {
      const cell = this.cells[b * 8 + c];
      return { x: cell.x(), y: cell.y() };
    });

    const step = this.cellSize + this.gap;
    const incoming = 0;
    const outgoing = dir < 0 ? values[0] : values[total - 1];

    // 目标序列
    const nextValues =
      dir < 0
        ? [...values.slice(1), incoming]
        : [incoming, ...values.slice(0, total - 1)];

    // 隐藏格内原文，用浮层文字做位移动画
    for (let i = 0; i < total; i++) {
      this.bitTexts[order[i][0] * 8 + order[i][1]].opacity(0);
    }

    const ghosts = createRefArray<Txt>();
    const fontSize = this.cellSize * 0.45;

    for (let i = 0; i < total; i++) {
      this.add(
        <Txt
          ref={ghosts}
          text={`${values[i]}`}
          x={positions[i].x}
          y={positions[i].y}
          fill={"#FFFFFF"}
          fontSize={fontSize}
          fontWeight={700}
          fontFamily={"SF Mono, Consolas, monospace"}
          textAlign={"center"}
        />,
      );
    }

    // 补入的 0：从外侧滑入
    const inGhost = createRef<Txt>();
    const inStartX =
      dir < 0
        ? positions[total - 1].x + step
        : positions[0].x - step;
    const inTargetX = dir < 0 ? positions[total - 1].x : positions[0].x;
    this.add(
      <Txt
        ref={inGhost}
        text={`${incoming}`}
        x={inStartX}
        y={positions[0].y}
        fill={"#FFFFFF"}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={"SF Mono, Consolas, monospace"}
        textAlign={"center"}
        opacity={0}
      />,
    );

    // 被丢弃位：滑出并淡出
    const outGhost = createRef<Txt>();
    const outStart = dir < 0 ? positions[0] : positions[total - 1];
    const outEndX =
      dir < 0 ? outStart.x - step : outStart.x + step;
    this.add(
      <Txt
        ref={outGhost}
        text={`${outgoing}`}
        x={outStart.x}
        y={outStart.y}
        fill={"#FFFFFF"}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={"SF Mono, Consolas, monospace"}
        textAlign={"center"}
      />,
    );
    // 格内对应 ghost 与 out 重叠时隐藏其一：左移时 ghost[0] 即 outgoing
    if (dir < 0) {
      ghosts[0].opacity(0);
    } else {
      ghosts[total - 1].opacity(0);
    }

    const moves: ThreadGenerator[] = [];
    for (let i = 0; i < total; i++) {
      const targetIndex = i + dir;
      if (targetIndex < 0 || targetIndex >= total) {
        continue;
      }
      moves.push(
        ghosts[i].position(
          [positions[targetIndex].x, positions[targetIndex].y],
          duration,
          easeInOutCubic,
        ),
      );
    }
    moves.push(
      outGhost().position([outEndX, outStart.y], duration, easeInOutCubic),
      outGhost().opacity(0, duration, easeInOutCubic),
      inGhost().opacity(1, duration * 0.35, easeInOutCubic),
      inGhost().position(
        [inTargetX, positions[0].y],
        duration,
        easeInOutCubic,
      ),
    );

    yield* all(...moves);

    // 写回 bits 与格内文字
    for (let i = 0; i < total; i++) {
      const [b, c] = order[i];
      this.bits[b][c] = nextValues[i];
      const txt = this.bitTexts[b * 8 + c];
      txt.text(`${nextValues[i]}`);
      txt.opacity(1);
    }
    yield* this.pulseValueLabel();

    for (const g of ghosts) {
      g.remove();
    }
    inGhost().remove();
    outGhost().remove();
  }

  /** 显示顺序（左→右）对应的 (byteIndex, col) */
  private displayOrder(): Array<[number, number]> {
    const order: Array<[number, number]> = [];
    for (let visualSlot = 0; visualSlot < this.byteCount; visualSlot++) {
      const byteIndex = this.byteCount - 1 - visualSlot;
      for (let col = 0; col < 8; col++) {
        order.push([byteIndex, col]);
      }
    }
    return order;
  }
}
