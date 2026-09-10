import {
  Latex,
  Node,
  NodeProps,
  Rect,
  Txt,
} from "@motion-canvas/2d";
import {
  all,
  chain,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutCubic,
  ThreadGenerator,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { Highlight } from "../../theme/highlight";
import { pulseShapes, pulseTxt } from "../../theme/highlight_anim";
import { inkPulseTxt } from "../../theme/ink_anim";

/** 英文/数字标注 */
const LABEL_FONT = "SF Pro Text, Segoe UI, Microsoft YaHei, sans-serif";
/** 格内 bit 数字 */
const BIT_FONT = "SF Mono, Consolas, monospace";

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

  /** 表头左侧描述（Index / Number） */
  private readonly indexLabelTxt = createRef<Txt>();
  private readonly powerLabelTxt = createRef<Txt>();
  /** 每格表头：index 数字；power 上方 2^n、下方十进制位权 */
  private readonly indexHeaderCells = createRefArray<Txt>();
  private readonly powerTopCells = createRefArray<Latex>();
  private readonly powerBottomCells = createRefArray<Txt>();

  private readonly byteCount: number;
  private readonly cellSize: number;
  private readonly gap: number;
  private readonly byteGap: number;
  private readonly bits: number[][];
  /**
   * 位文字高亮标记（与 cells/bitTexts 同下标：byte*8+col）。
   * 跟「文本」走：移位时空隙与 ghost 一并平移，不钉死在格子上。
   */
  private readonly textHighlight: boolean[];
  private headerShown: "index" | "power" | null = null;
  /** 当前单独显示的位（整体位权下标），整体显示时为 null */
  private headerBit: number | null = null;

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

    this.textHighlight = Array(this.byteCount * 8).fill(false);

    const byteWidth = 8 * cellSize + 7 * gap;
    const gridWidth =
      this.byteCount * byteWidth + (this.byteCount - 1) * byteGap;
    const gridHeight = cellSize;
    const headerGap = 16;
    const footerGap = 16;
    // 上方：index 编号或 2^n；下方：power 模式的十进制位权（预留高度避免切换跳动）
    const headerAreaH = 40;
    const footerAreaH = 32;
    const totalH =
      headerAreaH + headerGap + gridHeight + footerGap + footerAreaH;

    const topY = -totalH / 2;
    const headerCenterY = topY + headerAreaH / 2;
    const gridY = topY + headerAreaH + headerGap + cellSize / 2;
    const footerCenterY =
      topY +
      headerAreaH +
      headerGap +
      gridHeight +
      footerGap +
      footerAreaH / 2;

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
        fill={Ink.paper}
        fontSize={cellSize * 0.42}
        fontWeight={700}
        fontFamily={LABEL_FONT}
        opacity={0}
      />,
    );

    // index 表头：格子上方，每个字节各一份 7…0
    this.add(
      <Node ref={this.indexHeader} opacity={0}>
        <Txt
          ref={this.indexLabelTxt}
          text={indexLabel}
          x={labelX}
          y={headerCenterY}
          offset={[1, 0]}
          fill={Ink.paperSoft}
          fontSize={26}
          fontWeight={700}
          fontFamily={LABEL_FONT}
        />
        {Array.from({ length: this.byteCount }, (_, visualSlot) => {
          const byteIndex = this.byteCount - 1 - visualSlot;
          return Array.from({ length: 8 }, (_, col) => {
            const bitIndex = 7 - col;
            return (
              <Txt
                ref={this.indexHeaderCells}
                x={cellX(byteIndex, col)}
                y={headerCenterY}
                text={`${bitIndex}`}
                fill={Ink.paper}
                fontSize={28}
                fontWeight={700}
                fontFamily={LABEL_FONT}
                textAlign={"center"}
              />
            );
          });
        }).flat()}
      </Node>,
    );

    // power：2^n 在格子上方，十进制位权在格子下方
    this.add(
      <Node ref={this.powerHeader} opacity={0}>
        <Txt
          ref={this.powerLabelTxt}
          text={powerLabel}
          x={labelX}
          y={headerCenterY}
          offset={[1, 0]}
          fill={Ink.paperSoft}
          fontSize={26}
          fontWeight={700}
          fontFamily={LABEL_FONT}
        />
        {Array.from({ length: this.byteCount }, (_, visualSlot) => {
          const byteIndex = this.byteCount - 1 - visualSlot;
          const base = byteIndex * 8;
          return Array.from({ length: 8 }, (_, col) => {
            const bitIndex = 7 - col;
            const absBit = base + bitIndex;
            const power = Math.pow(2, absBit);
            const x = cellX(byteIndex, col);
            return (
              <Node>
                <Latex
                  ref={this.powerTopCells}
                  x={x}
                  y={headerCenterY}
                  tex={`{2^{${absBit}}}`}
                  fill={Ink.paper}
                  fontSize={22}
                />
                <Txt
                  ref={this.powerBottomCells}
                  x={x}
                  y={footerCenterY}
                  text={`${power}`}
                  fill={Ink.muted}
                  fontSize={20}
                  fontWeight={700}
                  fontFamily={LABEL_FONT}
                  textAlign={"center"}
                />
              </Node>
            );
          });
        }).flat()}
      </Node>,
    );

    // bit 格子：方格无圆角（水墨线框）；高字节在左
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
            radius={0}
            fill={Ink.deep}
            stroke={Ink.line}
            lineWidth={Ink.lineWidth}
            layout
            justifyContent={"center"}
            alignItems={"center"}
          >
            <Txt
              ref={this.bitTexts}
              text={`${bit}`}
              fill={Ink.paper}
              fontSize={cellSize * 0.45}
              fontWeight={700}
              fontFamily={BIT_FONT}
            />
          </Rect>,
        );
      }
    }
  }

  /**
   * 显示每个格子对应的位权说明。
   * - `index`：格子上方显示每字节 0–7 编号
   * - `power`：格子上方 2^n，格子下方对应十进制值（按整体位权）
   * - `bit`：整体位权下标（0 为最低位），只显示该位的表头；省略则显示全部
   * - `accumulate`：单-bit 模式下是否保留已显示的位（默认 false，即只留当前位）
   */
  public *showHeader(
    type: "index" | "power",
    duration = 0.45,
    bit?: number,
    accumulate = false,
  ): ThreadGenerator {
    const total = this.byteCount * 8;
    const targetBit =
      bit == null ? null : Math.max(0, Math.min(total - 1, Math.floor(bit)));

    const show = type === "index" ? this.indexHeader() : this.powerHeader();
    const hide =
      type === "index" ? this.powerHeader() : this.indexHeader();
    const label = this.headerLabelNode(type);
    const value = this.valueLabel();

    if (targetBit == null) {
      // 整体：容器与全部子项一并显现
      yield* all(
        hide.opacity(0, duration * 0.5, easeInOutCubic),
        show.opacity(1, duration, easeInOutCubic),
        ...this.headerCellNodes(type).map((n) =>
          n.opacity(1, duration, easeInOutCubic),
        ),
        label.opacity(1, duration, easeInOutCubic),
        value.opacity(1, duration, easeInOutCubic),
      );
    } else {
      const byteIndex = Math.floor(targetBit / 8);
      const col = 7 - (targetBit % 8);
      const cellIdx = this.headerCellIndex(byteIndex, col);
      const targets = this.headerBitNodes(type, cellIdx);
      const targetSet = new Set<Node>(targets);
      const others = this.headerCellNodes(type).filter(
        (n) => !targetSet.has(n),
      );

      // 切表头或首次显示时容器不可见：先瞬间藏好非目标（不闪），再整体淡入
      if (this.headerShown !== type) {
        for (const n of others) {
          n.opacity(0);
        }
      }

      yield* all(
        hide.opacity(0, duration * 0.5, easeInOutCubic),
        show.opacity(1, duration, easeInOutCubic),
        ...targets.map((n) => n.opacity(1, duration, easeInOutCubic)),
        // 同表头内切换且非累积时才淡出旧位；切表头时非目标已瞬间藏好
        ...(this.headerShown === type && !accumulate
          ? others.map((n) => n.opacity(0, duration, easeInOutCubic))
          : []),
        label.opacity(1, duration, easeInOutCubic),
        value.opacity(1, duration, easeInOutCubic),
      );
    }

    this.headerShown = type;
    this.headerBit = targetBit;
  }

  /** 隐藏全部表头（含左侧十进制） */
  public *hideHeader(duration = 0.35): ThreadGenerator {
    yield* all(
      this.indexHeader().opacity(0, duration, easeInOutCubic),
      this.powerHeader().opacity(0, duration, easeInOutCubic),
      this.valueLabel().opacity(0, duration, easeInOutCubic),
    );
    this.headerShown = null;
    this.headerBit = null;
  }

  /** 总位数（N*8） */
  public get bitCount(): number {
    return this.byteCount * 8;
  }

  /**
   * 将指定位设为 0/1（水墨翻位动画 + 十进制联动脉冲）。
   * @param bitPos 整体位权下标：0 为最低位（最右侧）
   */
  public *setBit(
    bitPos: number,
    value: 0 | 1,
    bitDuration = 0.3,
  ): ThreadGenerator {
    const total = this.byteCount * 8;
    const pos = Math.max(0, Math.min(total - 1, Math.floor(bitPos)));
    const byteIndex = Math.floor(pos / 8);
    const col = 7 - (pos % 8);
    yield* this.flipBit(byteIndex, col, value, bitDuration);
    yield* this.pulseValueLabel();
  }

  /** 某表头全部位格节点（index：数字；power：2^n + 十进制位权） */
  private headerCellNodes(type: "index" | "power"): Node[] {
    return type === "index"
      ? [...this.indexHeaderCells]
      : [...this.powerTopCells, ...this.powerBottomCells];
  }

  /** 某一位对应的表头节点（index：1 个；power：上方 2^n + 下方位权） */
  private headerBitNodes(type: "index" | "power", cellIdx: number): Node[] {
    return type === "index"
      ? [this.indexHeaderCells[cellIdx]]
      : [this.powerTopCells[cellIdx], this.powerBottomCells[cellIdx]];
  }

  private headerLabelNode(type: "index" | "power"): Txt {
    return type === "index" ? this.indexLabelTxt() : this.powerLabelTxt();
  }

  /** 表头格创建顺序对应的下标：visualSlot 外层、col 内层 */
  private headerCellIndex(byteIndex: number, col: number): number {
    return (this.byteCount - 1 - byteIndex) * 8 + col;
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

  /**
   * 脉冲高亮某一个 bit 位（描边 + 缩放 + 文字变色）。
   * @param index 整体位权下标：0 为最低位（最右侧），最大为 `N*8-1`
   */
  public *highlight(index: number, duration = 0.5): ThreadGenerator {
    const total = this.byteCount * 8;
    const bitPos = Math.max(0, Math.min(total - 1, Math.floor(index)));
    const byteIndex = Math.floor(bitPos / 8);
    const col = 7 - (bitPos % 8);
    const idx = byteIndex * 8 + col;

    const cell = this.cells[idx];
    const txt = this.bitTexts[idx];

    yield* all(
      pulseShapes(cell, {
        duration,
        scalePeak: 1.14,
      }),
      pulseTxt(txt, { duration, scalePeak: 1.2 }),
    );
  }

  /**
   * 按当前数值：将显示序上「最左的 1」到「最右的 1」之间（含两端）的
   * 位文字改为高亮色，并写入 textHighlight（随后续移位跟随文本移动）；
   * 区间外恢复纸色。全 0 时全部恢复纸色。
   */
  public *highlightSignificantSpan(duration = 0.35): ThreadGenerator {
    const order = this.displayOrder();
    let left = -1;
    let right = -1;
    for (let i = 0; i < order.length; i++) {
      const [b, c] = order[i];
      if (this.bits[b][c] === 1) {
        if (left < 0) {
          left = i;
        }
        right = i;
      }
    }

    for (let i = 0; i < order.length; i++) {
      const [b, c] = order[i];
      this.textHighlight[b * 8 + c] = left >= 0 && i >= left && i <= right;
    }

    yield* all(
      ...order.map(([b, c]) => {
        const idx = b * 8 + c;
        return this.bitTexts[idx].fill(
          this.textHighlight[idx] ? Highlight.fill : Ink.paper,
          duration,
          easeOutCubic,
        );
      }),
    );
  }

  /**
   * 跑马灯翻位演示：点亮波从右（低位 bit 0）到左逐位 0→1，
   * 熄灭波紧接其尾、从左（高位）到右逐位 1→0。
   * 两波均以 stepDelay 流水启动、零间隙折返：后一位不等前一位的
   * 余晖（墨金脉冲）结束就启动，全程一气呵成。
   * 全程只用 Ink / Highlight token 与 easeInOutCubic，保持克制无弹跳。
   * @param bitDuration 单个 bit 原子翻位时长（淡出 + 淡入）
   * @param stepDelay 相邻位启动间隔（小于 bitDuration 即形成重叠波）
   */
  public *show(bitDuration = 0.3, stepDelay = 0.18): ThreadGenerator {
    const total = this.byteCount * 8;
    // 熄灭波起点：点亮波最后一位原子翻位结束时（其墨金余晖仍可重叠，不冲突属性）
    const turnStart = (total - 1) * stepDelay + bitDuration;
    const endTime = turnStart + (total - 1) * stepDelay + bitDuration;

    const lightUp: ThreadGenerator[] = [];
    for (let bitPos = 0; bitPos < total; bitPos++) {
      const byteIndex = Math.floor(bitPos / 8);
      const col = 7 - (bitPos % 8);
      lightUp.push(
        chain(
          waitFor(bitPos * stepDelay),
          this.flipBit(byteIndex, col, 1, bitDuration),
        ),
      );
    }

    const putOut: ThreadGenerator[] = [];
    for (let k = 0; k < total; k++) {
      const bitPos = total - 1 - k; // 从高位到低位（显示上从左到右）
      const byteIndex = Math.floor(bitPos / 8);
      const col = 7 - (bitPos % 8);
      putOut.push(
        chain(
          waitFor(turnStart + k * stepDelay),
          this.flipBit(byteIndex, col, 0, bitDuration),
        ),
      );
    }

    yield* all(
      ...lightUp,
      ...putOut,
      // 全 1 峰值与全 0 收尾时各联动一次左侧十进制（无表头时仅同步文案）
      chain(waitFor(turnStart), this.pulseValueLabel(0.4)),
      chain(waitFor(endTime), this.pulseValueLabel(0.4)),
    );
  }

  /**
   * 单个 bit 原子翻位：淡出旧字 + 墨线转色 → 换字淡入（点亮带墨金余晖）。
   * 左侧十进制只同步文案、不做脉冲，避免流水并发时抢同一节点属性。
   */
  private *flipBit(
    byteIndex: number,
    col: number,
    to: 0 | 1,
    bitDuration: number,
  ): ThreadGenerator {
    if (this.bits[byteIndex][col] === to) {
      return;
    }

    const half = bitDuration * 0.5;
    const idx = byteIndex * 8 + col;
    const cell = this.cells[idx];
    const txt = this.bitTexts[idx];

    yield* all(
      txt.opacity(0, half, easeInOutCubic),
      cell.stroke(to === 1 ? Highlight.fill : Ink.line, half, easeInOutCubic),
    );
    this.bits[byteIndex][col] = to;
    txt.text(`${to}`);
    this.syncValueLabel();
    yield* txt.opacity(1, half, easeInOutCubic);

    if (to === 1) {
      yield* inkPulseTxt(txt, { duration: half, scalePeak: 1.03 });
    }
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
        .fill(Highlight.accent, duration * 0.3, easeInOutCubic)
        .to(Ink.paper, duration * 0.7, easeInOutCubic),
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
          this.cells[idx].stroke(Highlight.fill, half, easeInOutCubic),
        );
      }
    }
    yield* all(...fadeOut);

    for (let b = 0; b < this.byteCount; b++) {
      for (let col = 0; col < 8; col++) {
        this.bits[b][col] = nextBits[b][col];
        this.bitTexts[b * 8 + col].text(`${nextBits[b][col]}`);
        this.textHighlight[b * 8 + col] = false;
        this.bitTexts[b * 8 + col].fill(Ink.paper);
      }
    }

    const fadeIn: ThreadGenerator[] = [];
    for (let b = 0; b < this.byteCount; b++) {
      for (let col = 0; col < 8; col++) {
        const idx = b * 8 + col;
        fadeIn.push(
          this.bitTexts[idx].opacity(1, half, easeInOutCubic),
          this.cells[idx].stroke(Ink.line, half, easeInOutCubic),
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

    // 当前显示序列（左→右）及对应文本高亮（随字平移，不钉格子）
    const values = order.map(([b, c]) => this.bits[b][c]);
    const highlights = order.map(([b, c]) => this.textHighlight[b * 8 + c]);
    const positions = order.map(([b, c]) => {
      const cell = this.cells[b * 8 + c];
      return { x: cell.x(), y: cell.y() };
    });

    const step = this.cellSize + this.gap;
    const incoming = 0;
    const outgoing = dir < 0 ? values[0] : values[total - 1];
    const outgoingLit = dir < 0 ? highlights[0] : highlights[total - 1];

    // 目标序列：补入位不高亮
    const nextValues =
      dir < 0
        ? [...values.slice(1), incoming]
        : [incoming, ...values.slice(0, total - 1)];
    const nextHighlights =
      dir < 0
        ? [...highlights.slice(1), false]
        : [false, ...highlights.slice(0, total - 1)];

    // 隐藏格内原文，用浮层文字做位移动画（继承原字高亮色）
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
          fill={highlights[i] ? Highlight.fill : Ink.paper}
          fontSize={fontSize}
          fontWeight={700}
          fontFamily={BIT_FONT}
          textAlign={"center"}
        />,
      );
    }

    // 补入的 0：从外侧滑入（不高亮）
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
        fill={Ink.paper}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={BIT_FONT}
        textAlign={"center"}
        opacity={0}
      />,
    );

    // 被丢弃位：滑出并淡出（保持原高亮色）
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
        fill={outgoingLit ? Highlight.fill : Ink.paper}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={BIT_FONT}
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

    // 写回 bits、高亮标记与格内文字颜色
    for (let i = 0; i < total; i++) {
      const [b, c] = order[i];
      const idx = b * 8 + c;
      this.bits[b][c] = nextValues[i];
      this.textHighlight[idx] = nextHighlights[i];
      const txt = this.bitTexts[idx];
      txt.text(`${nextValues[i]}`);
      txt.fill(nextHighlights[i] ? Highlight.fill : Ink.paper);
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
