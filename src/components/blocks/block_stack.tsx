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

const CHIP_W = 110;
const CHIP_H = 64;
const CHIP_FS = 26;

const PAPER = '#e8eef7';
/** Uniform style for used blocks. */
const USED_FILL = 'rgba(232,238,247,0.28)';
const USED_STROKE = '#e8eef7';
/** 默认行配色：自上而下循环取色 */
const PALETTE = ['#3dd6c6', '#ffb454', '#7aa2ff', '#f472b6', '#a3e635'];

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
  /** 小于 1 的浮点数值，显示在上方方程左侧，如 0.625 */
  value?: number;
  /** 整体下移量（给上方方程让位），默认 90 */
  stackY?: number;
  /** 上方方程 y，默认 -360 */
  equationY?: number;
  /** 最大放大精度（分母指数 + 1，如 24 表示最细到 2^-23），默认 24 */
  maxPrecision?: number;
}

/** 一行的状态：容器固定槽位；块只增减不跨容器，引用永久有效 */
interface RowState {
  node: Reference<Node>;
  boxes: Reference<Rect>[];
  texs: (Reference<Latex> | null)[];
  used: boolean[];
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
 * zoomIn() 可无限放大：恒定显示 depth 层，分母逐级加细。
 */
export class BlockStack extends Node {
  private readonly eqRow = createRef<Layout>();
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
  private readonly valueText: string | null;
  private hasLabel = false;

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
    this.valueText = value === null ? null : String(value);

    // 上方方程行：`value =` + 选中色块（加号连接），calc 时动态追加
    this.add(
      <Layout
        ref={this.eqRow}
        layout
        direction={'row'}
        alignItems={'center'}
        gap={14}
        x={0}
        y={equationY}
      />,
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
    const boxes: Reference<Rect>[] = [];
    const texs: (Reference<Latex> | null)[] = [];
    const used: boolean[] = [];
    const bw = (this.spanW - (count - 1) * this.gapH) / count;
    const fs = fitFont(this.fsBase, bw, denom);
    const showText = bw >= this.minTW;
    this.add(
      <Node ref={nodeRef} y={y} opacity={0}>
        {Array.from({length: count}, (_, j) => {
          const b = createRef<Rect>();
          boxes.push(b);
          used.push(false);
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
              fill={tint(color, 0.18)}
              stroke={color}
              lineWidth={2.5}
            >
              {label}
            </Rect>
          );
        })}
      </Node>,
    );
    return {node: nodeRef, boxes, texs, used, count, denom, bw, fs};
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

  /** 是否还能继续放大（分母指数 + 1 未超 maxPrecision） */
  public get canZoomIn(): boolean {
    const R = this.rows.length;
    return R >= 2 && this.zoom + R - 1 < this.maxPrec - 1;
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
          step.push(box.fill(tint(newColor, 0.18), 0.55, easeOutCubic));
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

  /** 尝试该行但放回：首块轻闪一下 */
  private *trySkip(row: number): ThreadGenerator {
    const cell = this.rows[row].boxes[0]();
    yield* cell.scale(1.1, 0.14, easeOutCubic);
    yield* cell.scale(1, 0.16, easeInOutCubic);
  }

  /** 选中该行首块：高亮一下 → 恢复原来大小 → 换统一已用样式 */
  private *trySelect(row: number): ThreadGenerator {
    const cell = this.rows[row].boxes[0]();
    this.rows[row].used[0] = true;
    yield* cell.scale(1.15, 0.2, easeOutCubic);
    yield* all(
      cell.scale(1, 0.25, easeInOutCubic),
      cell.fill(USED_FILL, 0.25, easeOutCubic),
      cell.stroke(USED_STROKE, 0.25, easeOutCubic),
    );
  }

  /** 上方方程行动态追加：`value =` 标签（仅一次） */
  private *ensureLabel(target: number): ThreadGenerator {
    if (this.hasLabel) return;
    this.hasLabel = true;
    const labelRef = createRef<Txt>();
    this.eqRow().add(
      <Txt
        ref={labelRef}
        text={`${this.valueText ?? String(target)} =`}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={40}
        fontWeight={700}
        fill={PAPER}
        opacity={0}
        scale={0.8}
      />,
    );
    yield* all(
      labelRef().opacity(1, 0.3, easeOutCubic),
      labelRef().scale(1, 0.35, easeOutBack),
    );
  }

  /**
   * 选中块飞往方程行：复制一个同尺寸克隆体，
   * 边飞边缩到筹码尺寸，落定后淡出并由真正的筹码接替弹出。
   */
  private *flyClone(
    row: number,
    denom: number,
    color: string,
    first: boolean,
  ): ThreadGenerator {
    const bw = this.rows[row].bw;
    const fs = this.rows[row].fs;
    const rowY = this.rows[row].node().y();
    const srcX = -this.spanW / 2 + bw / 2;

    // + 号与筹码先不可见占位，等布局落定后再量目的地
    const plusRef = createRef<Txt>();
    if (!first) {
      this.eqRow().add(
        <Txt
          ref={plusRef}
          text={'+'}
          fontFamily={'Consolas, Menlo, monospace'}
          fontSize={34}
          fontWeight={700}
          fill={PAPER}
          opacity={0}
        />,
      );
    }
    const chipRef = createRef<Rect>();
    this.eqRow().add(
      <Rect
        ref={chipRef}
        layout
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        width={CHIP_W}
        height={CHIP_H}
        radius={10}
        fill={tint(color, 0.25)}
        stroke={color}
        lineWidth={2.5}
        opacity={0}
        scale={0.7}
      >
        <Latex tex={[`\\frac{1}{${denom}}`]} fill={PAPER} fontSize={CHIP_FS} />
      </Rect>,
    );
    yield* waitFor(0.05);

    // 目的地：筹码落定后的布局中心（换算到本组件坐标）
    const destAbs = chipRef().absolutePosition();
    const selfAbs = this.absolutePosition();
    const dest = new Vector2(destAbs.x - selfAbs.x, destAbs.y - selfAbs.y);

    // 克隆体：与源块同尺寸同样式
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

    const flight: ThreadGenerator[] = [
      cloneRef().position(dest, 0.6, easeInOutCubic),
      cloneRef().width(CHIP_W, 0.6, easeInOutCubic),
      cloneRef().height(CHIP_H, 0.6, easeInOutCubic),
      cloneTexRef().fontSize(CHIP_FS, 0.6, easeInOutCubic),
    ];
    if (!first) {
      flight.push(plusRef().opacity(1, 0.3, easeOutCubic));
    }
    yield* all(...flight);

    yield* all(
      cloneRef().opacity(0, 0.15, easeOutCubic),
      chipRef().opacity(1, 0.25, easeOutCubic),
      chipRef().scale(1, 0.3, easeOutBack),
    );
  }

  /**
   * 从底层开始自下而上贪心拼出目标值：
   * 某行块值 1/denom ≤ 剩余则选中（上方方程追加色块），否则轻闪跳过。
   */
  public *calc(target: number): ThreadGenerator {
    yield* this.ensureLabel(target);
    const rows = this.rows.length;
    let remaining = target;
    const eps = 1e-9;
    let firstChip = true;
    for (let i = rows - 1; i >= 0; i--) {
      if (remaining <= eps) break;
      const d = this.rows[i].denom;
      const v = 1 / d;
      if (remaining + eps >= v) {
        const color = this.slotColor(i);
        yield* this.trySelect(i);
        yield* this.flyClone(i, d, color, firstChip);
        firstChip = false;
        remaining -= v;
      } else {
        yield* this.trySkip(i);
      }
      yield* waitFor(0.15);
    }
  }
}
