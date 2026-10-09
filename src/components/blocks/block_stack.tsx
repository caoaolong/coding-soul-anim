import {Latex, Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  Reference,
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

/** 二进制位表 */
const TABLE_ROW_H = 56;
const TARGET_COL_W = 170;
const BIT_COL_W = 108;
const TABLE_LINE = '#2a3a4c';
const TABLE_HEADER_BG = '#1a2430';
const TABLE_BODY_BG = '#121820';

/** 表格下方进度条 */
const PROGRESS_W = 520;
const PROGRESS_H = 10;
/** 表格底边到进度条中心的间距 */
const PROGRESS_GAP = 48;
/** 进度条右端到百分比文字中心的间距 */
const PROGRESS_LABEL_GAP = 64;
const PROGRESS_FILL = '#3dd6c6';
const PROGRESS_TRACK = 'rgba(232,238,247,0.15)';
const MUTED = '#8a9bb0';

const PAPER = '#e8eef7';
/** Uniform style for used blocks. */
const USED_FILL = 'rgba(232,238,247,0.28)';
const USED_STROKE = '#e8eef7';
/** 默认行配色：自上而下循环取色 */
const PALETTE = ['#3dd6c6', '#ffb454', '#7aa2ff', '#f472b6', '#a3e635'];
/** 行左侧细分单位 2^{-N} 与块堆左边的间距 */
const UNIT_LABEL_GAP = 36;
/** 每行除首块外：虚线 + 半透明 */
const GHOST_OPACITY = 0.38;
const GHOST_DASH: [number, number] = [10, 8];

/** #rrggbb + 透明度 → rgba() 字符串 */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 字号按块宽与分母位数自适应 */
function fitFont(base: number, bw: number, denom: number): number {
  const digits = String(denom).length;
  return Math.min(base, bw * 0.38, (bw * 0.9) / (0.55 * Math.max(1, digits)));
}

export interface BlockStackProps extends NodeProps {
  /** 行数；自上而下块数依次为 2^(depth-1) … 4、2、1（最后一行 1 个） */
  depth: number;
  /** 每行总宽度（所有行一致），默认 1500 */
  totalWidth?: number;
  /** 块高，默认 72 */
  blockHeight?: number;
  /** 块间距，默认 8 */
  hGap?: number;
  /** 行间距，默认 18 */
  vGap?: number;
  /** 各行颜色（自上而下循环取色），默认五色调色板 */
  colors?: string[];
  /** 分数字号（会按块宽自适应缩小），默认 26 */
  fontSize?: number;
  /** 块宽低于此值时省略文字，默认 34 */
  minTextWidth?: number;
  /** 小于 1 的浮点数值，表头「目标值」列，如 0.2345 */
  value?: number;
  /** 整体下移量（给上方表格让位），默认 90 */
  stackY?: number;
  /** 上方表格中心 y，默认 -360 */
  equationY?: number;
  /** 最大放大精度（分母指数 + 1，如 24 表示最细到 2^-23），默认 24 */
  maxPrecision?: number;
  /** 二进制位列数：表头 2^{-1} … 2^{-bitCount}，默认 8 */
  bitCount?: number;
}

/** 一行的状态：容器固定槽位；块只增减不跨容器，引用永久有效 */
interface RowState {
  node: Reference<Node>;
  boxes: Reference<Rect>[];
  texs: (Reference<Latex> | null)[];
  used: boolean[];
  /** 该位是否已判定（选中为 1 或写入 0）；续算时跳过 */
  decided: boolean[];
  /** 行左侧细分单位标签 2^{-N} */
  unitLabel: Reference<Latex>;
  /** 当前块数（恒为槽位满格） */
  count: number;
  /** 当前分母（绝对值，缩放后不变） */
  denom: number;
  bw: number;
  fs: number;
}

/**
 * 矩形块堆叠：各行总宽度一致、自上而下按 2 的幂递减，
 * 内容整体水平垂直居中（组件原点即中心）。
 * 上方为「目标值 | 2^{-1} … 2^{-n}」二进制位表；zoomIn 细分后继续填位。
 */
export class BlockStack extends Node {
  private readonly bitTable = createRef<Rect>();
  private readonly targetTxt = createRef<Txt>();
  /** 下标 0 → 2^{-1}，依次到 2^{-bitCount} */
  private readonly bitTxts: Reference<Txt>[] = [];
  private readonly bitCellNodes: Reference<Rect>[] = [];
  private readonly progressRoot = createRef<Node>();
  private readonly progressFill = createRef<Rect>();
  private readonly progressLabel = createRef<Txt>();
  private rows: RowState[] = [];
  private slotY: number[] = [];
  private rowColors: string[] = [];
  private spanW = 1500;
  private cellH = 72;
  private gapH = 8;
  private stepY = 90;
  private fsBase = 26;
  private minTW = 34;
  private zoom = 0;
  private maxPrec = 24;
  private bitCount = 8;
  private readonly tableWidth: number;
  private readonly tableHeight: number;
  private readonly valueText: string | null;
  private tableShown = false;
  /** 目标值；进度条 = 已选块真实和 / targetValue */
  private targetValue = 0;
  /** 已选分数之和（跨 zoom/calc 续算保留） */
  private currentSum = 0;

  public constructor(props: BlockStackProps) {
    const {
      depth,
      totalWidth = 1500,
      blockHeight = 72,
      hGap = 8,
      vGap = 18,
      colors = PALETTE,
      fontSize = 26,
      minTextWidth = 34,
      value = null,
      stackY = 90,
      equationY = -360,
      maxPrecision = 24,
      bitCount = 8,
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});
    this.rowColors = colors;
    this.spanW = totalWidth;
    this.cellH = blockHeight;
    this.gapH = hGap;
    this.stepY = blockHeight + vGap;
    this.fsBase = fontSize;
    this.minTW = minTextWidth;
    this.maxPrec = maxPrecision;
    this.bitCount = Math.max(1, Math.round(bitCount));
    this.valueText = value === null ? null : String(value);
    if (value !== null) this.targetValue = value;

    this.tableWidth = TARGET_COL_W + this.bitCount * BIT_COL_W;
    this.tableHeight = TABLE_ROW_H * 2;

    // 上方二进制位表：目标值 | 2^{-1} … 2^{-bitCount}
    this.add(
      <Rect
        ref={this.bitTable}
        layout
        direction={'column'}
        width={this.tableWidth}
        radius={10}
        stroke={TABLE_LINE}
        lineWidth={2}
        fill={TABLE_BODY_BG}
        x={0}
        y={equationY}
        opacity={0}
        scale={0.96}
      >
        <Layout layout direction={'row'} width={this.tableWidth} height={TABLE_ROW_H}>
          <Rect
            layout
            width={TARGET_COL_W}
            height={TABLE_ROW_H}
            fill={TABLE_HEADER_BG}
            stroke={TABLE_LINE}
            lineWidth={1}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              text={'目标值'}
              fontFamily={FONT}
              fontSize={26}
              fontWeight={700}
              fill={PAPER}
            />
          </Rect>
          {Array.from({length: this.bitCount}, (_, i) => (
            <Rect
              layout
              width={BIT_COL_W}
              height={TABLE_ROW_H}
              fill={TABLE_HEADER_BG}
              stroke={TABLE_LINE}
              lineWidth={1}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Latex
                tex={[`2^{${-(i + 1)}}`]}
                fill={PAPER}
                fontSize={24}
              />
            </Rect>
          ))}
        </Layout>
        <Layout layout direction={'row'} width={this.tableWidth} height={TABLE_ROW_H}>
          <Rect
            layout
            width={TARGET_COL_W}
            height={TABLE_ROW_H}
            stroke={TABLE_LINE}
            lineWidth={1}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              ref={this.targetTxt}
              text={this.valueText ?? ''}
              fontFamily={FONT}
              fontSize={28}
              fontWeight={700}
              fill={MUTED}
            />
          </Rect>
          {Array.from({length: this.bitCount}, () => {
            const cellRef = createRef<Rect>();
            const txtRef = createRef<Txt>();
            this.bitCellNodes.push(cellRef);
            this.bitTxts.push(txtRef);
            return (
              <Rect
                ref={cellRef}
                layout
                width={BIT_COL_W}
                height={TABLE_ROW_H}
                stroke={TABLE_LINE}
                lineWidth={1}
                alignItems={'center'}
                justifyContent={'center'}
              >
                <Txt
                  ref={txtRef}
                  text={''}
                  fontFamily={FONT}
                  fontSize={30}
                  fontWeight={700}
                  fill={PAPER}
                  opacity={0}
                  scale={0.7}
                />
              </Rect>
            );
          })}
        </Layout>
      </Rect>,
    );

    // 表格下方：已逼近比例进度条（current / target）
    this.add(
      <Node
        ref={this.progressRoot}
        x={0}
        y={equationY + this.tableHeight / 2 + PROGRESS_GAP}
        opacity={0}
      >
        <Rect
          width={PROGRESS_W}
          height={PROGRESS_H}
          radius={PROGRESS_H / 2}
          fill={PROGRESS_TRACK}
        />
        <Rect
          ref={this.progressFill}
          width={0}
          height={PROGRESS_H}
          radius={PROGRESS_H / 2}
          fill={PROGRESS_FILL}
          offset={[-1, 0]}
          x={-PROGRESS_W / 2}
        />
        <Txt
          ref={this.progressLabel}
          text={'0.00%'}
          fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
          fontSize={22}
          fontWeight={600}
          fill={MUTED}
          x={PROGRESS_W / 2 + PROGRESS_LABEL_GAP}
        />
      </Node>,
    );

    const rows = Math.max(1, Math.round(depth));
    for (let s = 0; s < rows; s++) {
      this.slotY.push((s - (rows - 1) / 2) * this.stepY + stackY);
      const count = 2 ** (rows - 1 - s);
      this.rows.push(this.buildRow(count, count, this.slotColor(s), this.slotY[s]));
    }
  }

  /** 槽位颜色：颜色标注的是层，内容流动时换色 */
  private slotColor(s: number): string {
    return this.rowColors[s % this.rowColors.length];
  }

  /** 槽位分母：2^(zoom + R - 1 - s) */
  private denomOf(s: number): number {
    return 2 ** (this.zoom + this.rows.length - 1 - s);
  }

  private buildRow(count: number, denom: number, color: string, y: number): RowState {
    const nodeRef = createRef<Node>();
    const unitLabel = createRef<Latex>();
    const boxes: Reference<Rect>[] = [];
    const texs: (Reference<Latex> | null)[] = [];
    const used: boolean[] = [];
    const decided: boolean[] = [];
    const bw = (this.spanW - (count - 1) * this.gapH) / count;
    const fs = fitFont(this.fsBase, bw, denom);
    const showText = bw >= this.minTW;
    const exp = Math.round(Math.log2(Math.max(1, denom)));
    const unitTex = exp === 0 ? '2^{0}' : `2^{${-exp}}`;
    // 行左侧：细分单位，贴在块堆左缘之外
    const unitX = -this.spanW / 2 - UNIT_LABEL_GAP;
    this.add(
      <Node ref={nodeRef} y={y} opacity={0}>
        <Latex
          ref={unitLabel}
          tex={[unitTex]}
          fill={MUTED}
          fontSize={28}
          x={unitX}
          offset={[1, 0]}
        />
        {Array.from({length: count}, (_, j) => {
          const b = createRef<Rect>();
          boxes.push(b);
          used.push(false);
          decided.push(false);
          let t: Reference<Latex> | null = null;
          let label = null;
          if (showText) {
            const tr = createRef<Latex>();
            t = tr;
            label = (
              <Latex
                ref={tr}
                tex={[`\\frac{1}{${denom}}`]}
                fill={PAPER}
                fontSize={fs}
              />
            );
          }
          texs.push(t);
          const ghost = j > 0;
          return (
            <Rect
              ref={b}
              layout
              direction={'row'}
              alignItems={'center'}
              justifyContent={'center'}
              x={(j - (count - 1) / 2) * (bw + this.gapH)}
              width={Math.max(bw, 1)}
              height={this.cellH}
              radius={Math.min(6, bw / 2)}
              fill={tint(color, ghost ? 0.08 : 0.18)}
              stroke={color}
              lineWidth={2.5}
              lineDash={ghost ? GHOST_DASH : []}
              opacity={ghost ? GHOST_OPACITY : 1}
            >
              {label}
            </Rect>
          );
        })}
      </Node>,
    );
    return {
      node: nodeRef,
      boxes,
      texs,
      used,
      decided,
      unitLabel,
      count,
      denom,
      bw,
      fs,
    };
  }

  /** 入场：从最后一行开始，逐行向上滑出并淡入 */
  public *reveal(): ThreadGenerator {
    const rows = this.rows.length;
    for (let i = rows - 1; i >= 0; i--) {
      const row = this.rows[i].node();
      const restY = row.y();
      row.y(restY + 80);
      yield* all(
        row.opacity(1, 0.4, easeOutCubic),
        row.y(restY, 0.45, easeOutCubic),
      );
      yield* waitFor(0.12);
    }
  }

  /** 进度是否已达 100%（已精确拼出目标，无需再细分） */
  public get isComplete(): boolean {
    if (this.targetValue <= 0) return false;
    return this.currentSum + 1e-9 >= this.targetValue;
  }

  /** 是否还能继续放大（未凑齐、未超 maxPrecision、且下一级仍在位表列范围内） */
  public get canZoomIn(): boolean {
    if (this.isComplete) return false;
    const R = this.rows.length;
    if (R < 2) return false;
    // 放大后顶层指数 = zoom + R
    const nextTopExp = this.zoom + R;
    return (
      this.zoom + R - 1 < this.maxPrec - 1 && nextTopExp <= this.bitCount
    );
  }

  /**
   * 放大一级（恒定层数）：最底层淡出，其余各行下移一格
   * （右半淡出删除、左半放大铺满并换新槽色），顶部添新一级。
   * 分母是绝对值，保留块无需改字。
   */
  public *zoomIn(): ThreadGenerator {
    const R = this.rows.length;
    if (!this.canZoomIn) return;
    this.zoom++;

    // 1. 先把该隐藏的隐藏掉：最底层整行 + 各行右半块
    const bottom = this.rows[R - 1];
    const graveyard: Rect[] = [];
    const fades: ThreadGenerator[] = [
      bottom.node().opacity(0, 0.35, easeOutCubic),
    ];
    for (let s = 0; s < R - 1; s++) {
      const st = this.rows[s];
      const newCount = st.count / 2;
      for (let k = newCount; k < st.count; k++) {
        const box = st.boxes[k]();
        fades.push(box.opacity(0, 0.3, easeOutCubic));
        graveyard.push(box);
      }
      st.count = newCount;
      st.boxes = st.boxes.slice(0, newCount);
      st.texs = st.texs.slice(0, newCount);
      st.used = st.used.slice(0, newCount);
      st.decided = st.decided.slice(0, newCount);
    }
    yield* all(...fades);

    // 2. 再缩放：各行下移一格，左半放大铺满并换新槽色，顶部添新行
    const morphs: ThreadGenerator[] = [];
    for (let s = 0; s < R - 1; s++) {
      const st = this.rows[s];
      const newBW = (this.spanW - (st.count - 1) * this.gapH) / st.count;
      const newFS = fitFont(this.fsBase, newBW, st.denom);
      const newColor = this.slotColor(s + 1);
      morphs.push(st.node().y(this.slotY[s + 1], 0.55, easeInOutCubic));
      for (let k = 0; k < st.count; k++) {
        const box = st.boxes[k]();
        const nx = (k - (st.count - 1) / 2) * (newBW + this.gapH);
        const step: ThreadGenerator[] = [
          box.x(nx, 0.55, easeInOutCubic),
          box.width(newBW, 0.55, easeInOutCubic),
        ];
        const t = st.texs[k];
        if (t) step.push(t().fontSize(newFS, 0.55, easeOutCubic));
        if (!st.used[k]) {
          const ghost = k > 0;
          step.push(
            box.fill(tint(newColor, ghost ? 0.08 : 0.18), 0.55, easeOutCubic),
          );
          step.push(box.stroke(newColor, 0.55, easeOutCubic));
        }
        morphs.push(all(...step));
      }
      st.bw = newBW;
      st.fs = newFS;
    }

    // 3. 顶部新行：满格块数、分母再细一级；
    //    缩放完成后，再从当前最顶层（已下移到 slot1 的行）的位置向上滑入
    const fresh = this.buildRow(
      2 ** (R - 1),
      this.denomOf(0),
      this.slotColor(0),
      this.slotY[1],
    );

    yield* all(...morphs);
    yield* waitFor(0.1);

    yield* all(
      fresh.node().opacity(1, 0.45, easeOutCubic),
      fresh.node().y(this.slotY[0], 0.55, easeOutCubic),
    );
    yield* waitFor(0.1);

    // 4. 清理淡出节点并旋转行表
    for (const g of graveyard) g.remove();
    bottom.node().remove();
    this.rows = [fresh, ...this.rows.slice(0, R - 1)];
  }

  /** 尝试该行但放回：首块轻闪一下，并标记该位已判定为 0 */
  private *trySkip(row: number): ThreadGenerator {
    const cell = this.rows[row].boxes[0]();
    this.rows[row].decided[0] = true;
    yield* cell.scale(1.1, 0.14, easeOutCubic);
    yield* cell.scale(1, 0.16, easeInOutCubic);
  }

  /** 选中该行首块：高亮一下 → 恢复原来大小 → 换统一已用样式 */
  private *trySelect(row: number): ThreadGenerator {
    const cell = this.rows[row].boxes[0]();
    this.rows[row].used[0] = true;
    this.rows[row].decided[0] = true;
    yield* cell.scale(1.15, 0.2, easeOutCubic);
    yield* all(
      cell.scale(1, 0.25, easeInOutCubic),
      cell.fill(USED_FILL, 0.25, easeOutCubic),
      cell.stroke(USED_STROKE, 0.25, easeOutCubic),
    );
  }

  /** 分母 → 位指数 n（2^{-n}）；非 2 的幂返回 null */
  private expOfDenom(denom: number): number | null {
    if (denom < 2) return null;
    const e = Math.round(Math.log2(denom));
    if (2 ** e !== denom) return null;
    return e;
  }

  /** 淡入位表与进度条（仅一次）；场景可先于 reveal 调用 */
  public *showTable(target?: number): ThreadGenerator {
    if (this.tableShown) return;
    this.tableShown = true;
    const shown =
      this.valueText ??
      (target !== undefined
        ? String(target)
        : this.targetValue > 0
          ? String(this.targetValue)
          : '');
    this.targetTxt().text(shown);
    yield* all(
      this.bitTable().opacity(1, 0.4, easeOutCubic),
      this.bitTable().scale(1, 0.45, easeOutBack),
      this.progressRoot().opacity(1, 0.4, easeOutCubic),
    );
  }

  /** 在 2^{-exp} 列写入 0 或 1 */
  private *writeBit(exp: number, bit: 0 | 1): ThreadGenerator {
    if (exp < 1 || exp > this.bitCount) return;
    const txt = this.bitTxts[exp - 1]();
    txt.text(String(bit));
    txt.fill(bit === 1 ? PROGRESS_FILL : MUTED);
    yield* all(
      txt.opacity(1, 0.25, easeOutCubic),
      txt.scale(1, 0.3, easeOutBack),
    );
  }

  /**
   * 选中块飞往对应位格：克隆体飞入后淡出，再点亮表格中的 1。
   */
  private *flyToBit(row: number, exp: number, color: string): ThreadGenerator {
    if (exp < 1 || exp > this.bitCount) {
      yield* this.writeBit(exp, 1);
      return;
    }

    const bw = this.rows[row].bw;
    const fs = this.rows[row].fs;
    const rowY = this.rows[row].node().y();
    const srcX = -this.spanW / 2 + bw / 2;
    const denom = 2 ** exp;

    const destAbs = this.bitCellNodes[exp - 1]().absolutePosition();
    const selfAbs = this.absolutePosition();
    const dest = new Vector2(destAbs.x - selfAbs.x, destAbs.y - selfAbs.y);

    const cloneRef = createRef<Rect>();
    const cloneTexRef = createRef<Latex>();
    this.add(
      <Rect
        ref={cloneRef}
        layout
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        x={srcX}
        y={rowY}
        width={bw}
        height={this.cellH}
        radius={Math.min(6, bw / 2)}
        fill={tint(color, 0.5)}
        stroke={color}
        lineWidth={2.5}
      >
        <Latex
          ref={cloneTexRef}
          tex={[`\\frac{1}{${denom}}`]}
          fill={PAPER}
          fontSize={fs}
        />
      </Rect>,
    );

    yield* all(
      cloneRef().position(dest, 0.55, easeInOutCubic),
      cloneRef().width(BIT_COL_W * 0.7, 0.55, easeInOutCubic),
      cloneRef().height(TABLE_ROW_H * 0.75, 0.55, easeInOutCubic),
      cloneTexRef().fontSize(18, 0.55, easeInOutCubic),
    );
    yield* cloneRef().opacity(0, 0.12, easeOutCubic);
    cloneRef().remove();
    yield* this.writeBit(exp, 1);
  }

  /** 按已选真实和 / 目标 更新进度条（百分比保留两位小数；未凑齐时不超过 99.99%） */
  private *updateProgress(duration = 0.35): ThreadGenerator {
    const ratio =
      this.targetValue <= 0
        ? 0
        : Math.min(1, Math.max(0, this.currentSum / this.targetValue));
    const pct = this.isComplete
      ? '100.00'
      : Math.min(99.99, Math.floor(ratio * 10000) / 100).toFixed(2);
    this.progressLabel().text(`${pct}%`);
    yield* this.progressFill().width(PROGRESS_W * ratio, duration, easeOutCubic);
  }

  /**
   * 从底层开始自下而上贪心逼近目标值：
   * 某行未判定且 1/denom ≤ 剩余则选中（位表写 1），
   * 否则轻闪并在位表写 0（该位不能空过）。
   * 可多次调用：不重置已选和，用于 zoomIn 后继续细分逼近。
   * @param target 默认用构造时的 value
   */
  public *calc(target?: number): ThreadGenerator {
    const goal =
      target ??
      (this.targetValue > 0
        ? this.targetValue
        : this.valueText !== null
          ? Number(this.valueText)
          : 0);
    this.targetValue = goal;
    yield* this.showTable(goal);

    const eps = 1e-9;
    let remaining = goal - this.currentSum;
    const rows = this.rows.length;

    for (let i = rows - 1; i >= 0; i--) {
      if (remaining <= eps) break;
      // 该位已判定（1 或 0），续算时跳过
      if (this.rows[i].decided[0]) continue;

      const d = this.rows[i].denom;
      // 最底层 1/1 不参与（整数 1，不属于 (0,1) 小数展开）
      if (d === 1) continue;

      const exp = this.expOfDenom(d);
      const v = 1 / d;
      if (remaining + eps >= v) {
        const color = this.slotColor(i);
        yield* this.trySelect(i);
        if (exp !== null) {
          yield* this.flyToBit(i, exp, color);
        }
        remaining -= v;
        this.currentSum += v;
        yield* this.updateProgress();
      } else {
        yield* this.trySkip(i);
        if (exp !== null) {
          yield* this.writeBit(exp, 0);
        }
      }
      yield* waitFor(0.15);
    }
  }
}
