import {Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const AXIS = '#8a9bb0';
const GRID = '#2a3a4c';
const LABEL = '#6a7a8c';
const ACCENT = '#3dd6c6';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

/** Unicode 共 17 个平面（Plane 0–16）；1.0 仅有 16-bit 单平面空间 */
export const UNICODE_PLANE_COUNT = 17;

export interface UnicodePlaneInfo {
  id: number;
  short: string;
  name: string;
  color: string;
  unassigned?: boolean;
}

export const UNICODE_PLANES: UnicodePlaneInfo[] = [
  {id: 0, short: 'BMP', name: '基本多文种平面', color: '#3dd6c6'},
  {id: 1, short: 'SMP', name: '补充多文种平面', color: '#7aa2ff'},
  {id: 2, short: 'SIP', name: '补充表意平面', color: '#f0a060'},
  {id: 3, short: 'TIP', name: '第三表意平面', color: '#e8c56b'},
  {id: 4, short: '—', name: '未分配', color: '#2a3340', unassigned: true},
  {id: 5, short: '—', name: '未分配', color: '#2c3544', unassigned: true},
  {id: 6, short: '—', name: '未分配', color: '#2a3340', unassigned: true},
  {id: 7, short: '—', name: '未分配', color: '#2c3544', unassigned: true},
  {id: 8, short: '—', name: '未分配', color: '#2a3340', unassigned: true},
  {id: 9, short: '—', name: '未分配', color: '#2c3544', unassigned: true},
  {id: 10, short: '—', name: '未分配', color: '#2a3340', unassigned: true},
  {id: 11, short: '—', name: '未分配', color: '#2c3544', unassigned: true},
  {id: 12, short: '—', name: '未分配', color: '#2a3340', unassigned: true},
  {id: 13, short: '—', name: '未分配', color: '#2c3544', unassigned: true},
  {id: 14, short: 'SSP', name: '补充特殊用途平面', color: '#c084fc'},
  {id: 15, short: 'PUA-A', name: '补充专用区 A', color: '#5ec8ff'},
  {id: 16, short: 'PUA-B', name: '补充专用区 B', color: '#ff7aad'},
];

/**
 * 平面首字节（码点高位前缀）：Plane n → U+(n)<<16 …，写作 0x00–0x10。
 */
export function planePrefixByte(plane: number): string {
  return '0x' + plane.toString(16).toUpperCase().padStart(2, '0');
}

export interface UnicodeCoordPlanesProps extends NodeProps {
  plotWidth?: number;
  rowHeight?: number;
  /** Unicode 1.0 单块示意高度 */
  v1Height?: number;
  tickFontSize?: number;
  axisLabelSize?: number;
  planeLabelSize?: number;
  versionFontSize?: number;
  showGrid?: boolean;
}

/**
 * Unicode 编码平面示意：
 * 1) 先展示 Unicode 1.0 的 16-bit 编码空间（单一色块）
 * 2) 再扩展为 Unicode 2.0 的 17 个平面色带
 */
export class UnicodeCoordPlanes extends Node {
  private readonly root = createRef<Node>();
  private readonly xAxis = createRef<Line>();
  private readonly yAxis = createRef<Line>();
  private readonly xTitle = createRef<Txt>();
  private readonly yTitle = createRef<Txt>();
  private readonly versionBadge = createRef<Txt>();
  private readonly v1Caption = createRef<Txt>();
  private readonly bandsRoot = createRef<Node>();
  private readonly gridRoot = createRef<Node>();
  private readonly xTicks = createRefArray<Txt>();
  private readonly yTicks = createRefArray<Txt>();
  private readonly bands = createRefArray<Rect>();
  private readonly planeLabels = createRefArray<Txt>();
  private readonly prefixLabels = createRefArray<Txt>();
  private readonly prefixHeader = createRef<Txt>();

  private readonly plotW: number;
  private readonly rowH: number;
  private readonly plotH: number;
  private readonly v1H: number;
  private readonly tickFontSize: number;
  private readonly axisLabelSize: number;
  private readonly planeLabelSize: number;
  private readonly showGrid: boolean;
  /** 右侧前缀列相对色带右缘的偏移 */
  private readonly prefixOffsetX = 72;

  private readonly originX: number;
  private readonly originY: number;
  private readonly overhang = 28;
  /** Unicode 1.0 时横纵轴在拐角处留白，互不相交 */
  private readonly axisGap = 36;

  public constructor(props: UnicodeCoordPlanesProps = {}) {
    const {
      plotWidth = 1100,
      rowHeight = 36,
      v1Height = 280,
      tickFontSize = 18,
      axisLabelSize = 24,
      planeLabelSize = 16,
      versionFontSize = 28,
      showGrid = true,
      ...rest
    } = props;
    super({opacity: 0, ...rest});

    this.plotW = plotWidth;
    this.rowH = rowHeight;
    this.plotH = UNICODE_PLANE_COUNT * rowHeight;
    this.v1H = v1Height;
    this.tickFontSize = tickFontSize;
    this.axisLabelSize = axisLabelSize;
    this.planeLabelSize = planeLabelSize;
    this.showGrid = showGrid;
    this.originX = -this.plotW / 2;
    this.originY = -this.plotH / 2;

    const v1 = this.v1AxisGeometry();

    this.add(
      <Node ref={this.root}>
        <Node ref={this.gridRoot} opacity={0} />
        <Node ref={this.bandsRoot} />
        {/* 1.0：横轴不接到纵轴 */}
        <Line
          ref={this.xAxis}
          points={v1.xPoints}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          endArrow
          arrowSize={14}
          end={0}
        />
        {/* 1.0：纵轴不接到横轴 */}
        <Line
          ref={this.yAxis}
          points={v1.yPoints}
          stroke={AXIS}
          lineWidth={2.5}
          lineCap={'round'}
          endArrow
          arrowSize={14}
          end={0}
        />
        <Txt
          ref={this.xTitle}
          text={'码点偏移'}
          fontFamily={MONO}
          fontSize={axisLabelSize}
          fill={ACCENT}
          x={this.originX + this.plotW / 2}
          y={v1.xTitleY}
          opacity={0}
        />
        <Txt
          ref={this.yTitle}
          text={'16-bit 空间'}
          fontFamily={MONO}
          fontSize={axisLabelSize}
          fill={ACCENT}
          x={this.originX - 78}
          y={0}
          rotation={-90}
          opacity={0}
        />
        <Txt
          ref={this.versionBadge}
          text={'Unicode 1.0'}
          fontFamily={MONO}
          fontSize={versionFontSize}
          fontWeight={700}
          fill={ACCENT}
          x={this.originX + this.plotW / 2}
          y={this.originY + this.plotH + 48}
          opacity={0}
        />
        <Txt
          ref={this.v1Caption}
          text={'U+0000  –  U+FFFF'}
          fontFamily={MONO}
          fontSize={22}
          fill={'#0a0e14'}
          x={0}
          y={0}
          opacity={0}
        />
        <Txt
          ref={this.prefixHeader}
          text={'首字节'}
          fontFamily={MONO}
          fontSize={tickFontSize}
          fontWeight={700}
          fill={ACCENT}
          x={this.originX + this.plotW + this.prefixOffsetX}
          y={this.originY - 28}
          opacity={0}
        />
      </Node>,
    );

    this.buildBands();
    this.buildGrid();
    this.buildTicks(v1.tickY);
    this.buildPrefixLabels();
  }

  /** Unicode 1.0：轴绕着中央色块，拐角留白互不相交 */
  private v1AxisGeometry() {
    const left = this.originX;
    const right = this.originX + this.plotW;
    const bottom = -this.v1H / 2;
    const top = this.v1H / 2;
    const g = this.axisGap;
    return {
      xPoints: [
        [left + g, bottom],
        [right + this.overhang, bottom],
      ] as [number, number][],
      yPoints: [
        [left, bottom + g],
        [left, top + this.overhang],
      ] as [number, number][],
      xTitleY: bottom - 58,
      tickY: bottom - 28,
    };
  }

  /** Unicode 2.0：横纵轴在原点相交 */
  private v2AxisGeometry() {
    return {
      xPoints: [
        [this.originX - this.overhang, this.originY],
        [this.originX + this.plotW + this.overhang, this.originY],
      ] as [number, number][],
      yPoints: [
        [this.originX, this.originY - this.overhang],
        [this.originX, this.originY + this.plotH + this.overhang],
      ] as [number, number][],
      xTitleY: this.originY - 58,
      tickY: this.originY - 28,
    };
  }

  public planePosition(plane: number): {x: number; y: number} {
    return {
      x: this.originX + this.plotW / 2,
      y: this.originY + (plane + 0.5) * this.rowH,
    };
  }

  /**
   * 展示 Unicode 1.0：单一 16-bit 编码空间色块（对应后来的平面 0）。
   */
  public *showUnicode10(duration = 0.55): ThreadGenerator {
    const bmp = UNICODE_PLANES[0];

    // 平面 0 条带先放大为 1.0 单块
    this.bands[0].height(this.v1H);
    this.bands[0].y(0);
    this.bands[0].fill(bmp.color + 'ee');
    this.planeLabels[0].y(0);
    this.planeLabels[0].text('16-bit 编码空间');
    this.planeLabels[0].fill('#0a0e14');
    this.v1Caption().y(36);

    yield* this.opacity(1, duration * 0.35, easeOutCubic);
    yield* all(
      this.xAxis().end(1, duration, easeOutCubic),
      this.yAxis().end(1, duration, easeOutCubic),
    );
    yield* all(
      this.xTitle().opacity(1, 0.35, easeOutCubic),
      this.yTitle().opacity(1, 0.35, easeOutCubic),
      this.versionBadge().opacity(1, 0.4, easeOutCubic),
      ...this.xTicks.map(t => t.opacity(1, 0.35, easeOutCubic)),
    );
    yield* all(
      this.bands[0].opacity(1, 0.45, easeOutCubic),
      this.planeLabels[0].opacity(1, 0.45, easeOutCubic),
      this.v1Caption().opacity(1, 0.45, easeOutCubic),
    );
    yield* waitFor(0.1);
  }

  /**
   * 扩展到 Unicode 2.0：引入代理机制后的 17 平面（U+0000–U+10FFFF）；
   * 横纵轴收束到原点并相交。
   */
  public *expandToUnicode20(
    duration = 0.85,
    bandStagger = 0.03,
  ): ThreadGenerator {
    const plane0Y = this.originY + 0.5 * this.rowH;
    const v2 = this.v2AxisGeometry();

    yield* all(
      this.versionBadge().text('Unicode 2.0', duration * 0.4, easeOutCubic),
      this.yTitle().text('平面号', duration * 0.4, easeOutCubic),
      this.xTitle().text('平面内偏移', duration * 0.4, easeOutCubic),
      this.v1Caption().opacity(0, duration * 0.35, easeOutCubic),
      this.planeLabels[0].text('0  BMP', duration * 0.35, easeOutCubic),
      // 单块收束为平面 0 条带
      this.bands[0].height(this.rowH - 4, duration, easeInOutCubic),
      this.bands[0].y(plane0Y, duration, easeInOutCubic),
      this.planeLabels[0].y(plane0Y, duration, easeInOutCubic),
      // 横纵轴移到原点并相交
      this.xAxis().points(v2.xPoints, duration, easeInOutCubic),
      this.yAxis().points(v2.yPoints, duration, easeInOutCubic),
      this.xTitle().y(v2.xTitleY, duration, easeInOutCubic),
      this.yTitle().y(this.originY + this.plotH / 2, duration, easeInOutCubic),
      ...this.xTicks.map((t, i) =>
        i === 0
          ? all(
              t.y(v2.tickY, duration, easeInOutCubic),
              t.x(this.originX + 8, duration, easeInOutCubic),
            )
          : t.y(v2.tickY, duration, easeInOutCubic),
      ),
    );

    yield* all(
      this.gridRoot().opacity(1, 0.4, easeOutCubic),
      ...this.yTicks.map(t => t.opacity(1, 0.4, easeOutCubic)),
    );

    const rest = [];
    for (let i = 1; i < UNICODE_PLANE_COUNT; i++) {
      rest.push(
        delay(
          (i - 1) * bandStagger,
          all(
            this.bands[i].opacity(1, 0.32, easeOutCubic),
            this.planeLabels[i].opacity(1, 0.32, easeOutCubic),
          ),
        ),
      );
    }
    if (rest.length > 0) yield* all(...rest);
    yield* waitFor(0.1);
  }

  /**
   * 显示各平面码点首字节（前缀）：Plane n → 0x00 … 0x10，
   * 对应 U+(n)<<16 起的高位字节。
   */
  public *showPlanePrefixes(
    duration = 0.4,
    stagger = 0.03,
  ): ThreadGenerator {
    yield* this.prefixHeader().opacity(1, duration * 0.6, easeOutCubic);
    const anims = this.prefixLabels.map((label, i) =>
      delay(i * stagger, label.opacity(1, duration, easeOutCubic)),
    );
    if (anims.length > 0) yield* all(...anims);
    yield* waitFor(0.1);
  }

  /** 高亮某个平面（需已扩展到 2.0） */
  public *highlightPlane(plane: number, duration = 0.4): ThreadGenerator {
    if (plane < 0 || plane >= UNICODE_PLANE_COUNT) return;
    const band = this.bands[plane];
    const label = this.planeLabels[plane];
    yield* all(
      band.lineWidth(3, duration, easeOutCubic),
      band.stroke('#e8eef7', duration, easeOutCubic),
      band.scale(1.04, duration, easeOutCubic),
      label.scale(1.08, duration, easeOutCubic),
    );
  }

  private buildBands() {
    for (const plane of UNICODE_PLANES) {
      const y = this.originY + (plane.id + 0.5) * this.rowH;
      const fill = plane.color + (plane.unassigned ? 'cc' : 'ee');

      this.bandsRoot().add(
        <Rect
          ref={this.bands}
          width={this.plotW - 4}
          height={this.rowH - 4}
          x={this.originX + this.plotW / 2}
          y={y}
          radius={4}
          fill={fill}
          stroke={plane.color}
          lineWidth={1.5}
          opacity={0}
        />,
      );

      const labelText = plane.unassigned
        ? `${plane.id}`
        : `${plane.id}  ${plane.short}`;
      this.bandsRoot().add(
        <Txt
          ref={this.planeLabels}
          text={labelText}
          fontFamily={MONO}
          fontSize={this.planeLabelSize}
          fontWeight={700}
          fill={plane.unassigned ? LABEL : '#0a0e14'}
          x={this.originX + this.plotW / 2}
          y={y}
          opacity={0}
        />,
      );
    }
  }

  private buildPrefixLabels() {
    const x = this.originX + this.plotW + this.prefixOffsetX;
    for (const plane of UNICODE_PLANES) {
      const y = this.originY + (plane.id + 0.5) * this.rowH;
      this.root().add(
        <Txt
          ref={this.prefixLabels}
          text={planePrefixByte(plane.id)}
          fontFamily={MONO}
          fontSize={this.tickFontSize}
          fontWeight={700}
          fill={plane.unassigned ? LABEL : plane.color}
          x={x}
          y={y}
          opacity={0}
        />,
      );
    }
  }

  private buildGrid() {
    if (!this.showGrid) return;
    for (let i = 0; i <= UNICODE_PLANE_COUNT; i++) {
      const y = this.originY + i * this.rowH;
      this.gridRoot().add(
        <Line
          points={[
            [this.originX, y],
            [this.originX + this.plotW, y],
          ]}
          stroke={GRID}
          lineWidth={1}
          opacity={0.5}
        />,
      );
    }
    for (let i = 1; i < 4; i++) {
      const x = this.originX + (this.plotW * i) / 4;
      this.gridRoot().add(
        <Line
          points={[
            [x, this.originY],
            [x, this.originY + this.plotH],
          ]}
          stroke={GRID}
          lineWidth={1}
          opacity={0.35}
        />,
      );
    }
  }

  private buildTicks(xTickY: number) {
    const xLabels = [
      {t: '0000', p: 0},
      {t: '4000', p: 0.25},
      {t: '8000', p: 0.5},
      {t: 'C000', p: 0.75},
      {t: 'FFFF', p: 1},
    ];
    for (const {t, p} of xLabels) {
      // 1.0 时横轴起点有 gap，首刻度略右移避免贴到纵轴空隙处
      const x =
        p === 0
          ? this.originX + this.axisGap + 8
          : p === 1
            ? this.originX + this.plotW - 8
            : this.originX + this.plotW * p;
      this.root().add(
        <Txt
          ref={this.xTicks}
          text={t}
          fontFamily={MONO}
          fontSize={this.tickFontSize}
          fill={LABEL}
          x={x}
          y={xTickY}
          opacity={0}
        />,
      );
    }

    for (let i = 0; i < UNICODE_PLANE_COUNT; i++) {
      const cy = this.originY + (i + 0.5) * this.rowH;
      this.root().add(
        <Txt
          ref={this.yTicks}
          text={String(i)}
          fontFamily={MONO}
          fontSize={this.tickFontSize}
          fill={LABEL}
          x={this.originX - 28}
          y={cy}
          opacity={0}
        />,
      );
    }
  }
}
