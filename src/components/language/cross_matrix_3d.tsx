import {Img, Line, Node, NodeProps, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import {Camera3D, Vec3, project3D} from '../../utils/three_proj';

/**
 * 按相机 yaw 选择朝向镜头的两个竖直面 + 顶面。
 * |yaw|<π/2 时 +z 始终更近；yaw≥0 时 -x 更近，yaw<0 时 +x 更近。
 */
function buildBarFacesForCam(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  height: number,
  cam: Camera3D,
  origin: {x: number; y: number},
): {
  top: Vector2[];
  front: Vector2[];
  side: Vector2[];
  topCenter: Vector2;
  /** 近侧 x 法向，供 morph 对齐正交边 */
  sx: number;
  /** 近侧 z 法向 */
  sz: number;
} {
  const hw = width / 2;
  const hd = depth / 2;
  const h = Math.max(height, 1);
  const p = (x: number, y: number, z: number) =>
    project3D({x, y, z} as Vec3, cam, origin).pos;

  const sx = cam.yaw >= 0 ? -1 : 1;
  const sz = 1; // |yaw|<π/2 时朝 +z 的面朝向镜头

  const tFL = p(cx - hw, h, cz + hd);
  const tFR = p(cx + hw, h, cz + hd);
  const tBR = p(cx + hw, h, cz - hd);
  const tBL = p(cx - hw, h, cz - hd);

  // 近侧 z 竖直面（与顶面共棱，组成完整柱体）
  const fz = cz + sz * hd;
  const front = [
    p(cx - hw, 0, fz),
    p(cx + hw, 0, fz),
    p(cx + hw, h, fz),
    p(cx - hw, h, fz),
  ];
  // 近侧 x 竖直面
  const fx = cx + sx * hw;
  const side = [
    p(fx, 0, cz - hd),
    p(fx, 0, cz + hd),
    p(fx, h, cz + hd),
    p(fx, h, cz - hd),
  ];

  return {
    top: [tFL, tFR, tBR, tBL],
    front,
    side,
    topCenter: p(cx, h, cz),
    sx,
    sz,
  };
}

const PAPER = '#e8eef7';
const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const GOLD = '#ffe08a';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';
const HEAT_NEAR = '#5af0dc';
const HEAT_MID = '#3d6f9c';
const HEAT_FAR = '#1a3048';

/** 与 language_zip_demo 2D 矩阵完全一致，保证形态可无缝对接 */
const CELL_W = 72;
const CELL_H = 56;
const FLAG_W = 44;
const FLAG_H = 28;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpColor(a: string, b: string, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return (
    '#' +
    [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('')
  );
}

function heatColor(value: number, minV: number, maxV: number): string {
  if (maxV <= minV) return HEAT_MID;
  const t = Math.pow((value - minV) / (maxV - minV), 0.8);
  if (t < 0.5) return lerpColor(HEAT_NEAR, HEAT_MID, t * 2);
  return lerpColor(HEAT_MID, HEAT_FAR, (t - 0.5) * 2);
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

function lerp2(a: Vector2, b: Vector2, t: number): Vector2 {
  return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

function lerpPoly(a: Vector2[], b: Vector2[], t: number): Vector2[] {
  return a.map((p, i) => lerp2(p, b[i], t));
}

export interface CrossMatrix3DProps extends NodeProps {
  matrix: number[][];
  flags: string[];
  /** 最高柱高度（世界单位） */
  maxHeight?: number;
}

/**
 * 交叉压缩矩阵：从与 2D 表像素级对齐的正交顶面，
 * 通过角点插值 + 相机运镜，平滑过渡到斜视 3D 柱场。
 */
export class CrossMatrix3D extends Node {
  private readonly matrix: number[][];
  private readonly flags: string[];
  private readonly n: number;
  private readonly maxHeight: number;
  private readonly minV: number;
  private readonly maxV: number;

  private readonly frameBorder = createRefArray<Line>();
  private readonly barFronts = createRefArray<Line>();
  private readonly barSides = createRefArray<Line>();
  private readonly barTops = createRefArray<Line>();
  private readonly valueTxts = createRefArray<Txt>();
  private readonly headerFlags = createRefArray<Img>();
  private readonly rowFlags = createRefArray<Img>();
  private readonly cornerCell = createRefArray<Line>();
  private readonly headerCells = createRefArray<Line>();
  private readonly rowCells = createRefArray<Line>();
  private readonly titleTxt = createRefArray<Txt>();

  private readonly targetHeights: number[];
  private readonly topColors: string[];
  private readonly textFills: string[];

  /** 0 = 纯 2D 正交表，1 = 斜视 3D */
  private morph = 0;
  private heights: number[];

  private camYaw = 0;
  private camPitch = 1.52;
  private camDistance = 2200;
  private camFov = 2200;
  /** 正交对接时的投影中心；morph→1 时上移，给底部字幕留空 */
  private readonly originBase = {x: 0, y: 36};
  private readonly originLift = -150;

  /** 正交布局：整表（含表头）相对原点的左上角 */
  private readonly flatOriginX: number;
  private readonly flatOriginY: number;

  public constructor(props: CrossMatrix3DProps) {
    const {matrix, flags, maxHeight = 200, ...nodeProps} = props;
    super({...nodeProps});

    this.matrix = matrix;
    this.flags = flags;
    this.n = matrix.length;
    this.maxHeight = maxHeight;

    let minV = Infinity;
    let maxV = -Infinity;
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        minV = Math.min(minV, matrix[r][c]);
        maxV = Math.max(maxV, matrix[r][c]);
      }
    }
    this.minV = minV;
    this.maxV = maxV;

    this.targetHeights = [];
    this.topColors = [];
    this.textFills = [];
    this.heights = [];
    const span = Math.max(maxV - minV, 1);
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const v = matrix[r][c];
        const near = 1 - (v - minV) / span; // 越大越相似 → 柱越高
        const heatT = (v - minV) / span; // 与 2D 表相同：越小越亮
        this.targetHeights.push(12 + Math.pow(near, 1.15) * maxHeight);
        this.topColors.push(heatColor(v, minV, maxV));
        this.textFills.push(heatT < 0.35 ? BG : PAPER);
        this.heights.push(0);
      }
    }

    // (n+1) × (n+1) 格：含表头；与 2D Layout 一致
    const tableW = (this.n + 1) * CELL_W;
    const tableH = (this.n + 1) * CELL_H;
    this.flatOriginX = -tableW / 2;
    this.flatOriginY = -tableH / 2 + 28;

    this.add(
      <Txt
        ref={this.titleTxt}
        text={'交叉压缩距离'}
        fontFamily={MONO}
        fontSize={24}
        fontWeight={700}
        fill={PAPER}
        y={this.flatOriginY - 36}
        opacity={0}
      />,
    );

    // 外框（正交四边形，morph 时跟顶面一起插值）
    this.add(
      <Line
        ref={this.frameBorder}
        closed
        points={[
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        opacity={0}
        zIndex={0}
      />,
    );

    // 左上角空单元格
    this.add(
      <Line
        ref={this.cornerCell}
        closed
        points={[
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]}
        fill={CARD}
        stroke={LINE}
        lineWidth={1}
        opacity={0}
        zIndex={1}
      />,
    );

    for (let i = 0; i < this.n; i++) {
      this.add(
        <Line
          ref={this.headerCells}
          closed
          points={[
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ]}
          fill={CARD}
          stroke={LINE}
          lineWidth={1}
          opacity={0}
          zIndex={1}
        />,
      );
      this.add(
        <Img
          ref={this.headerFlags}
          src={flags[i]}
          width={FLAG_W}
          height={FLAG_H}
          radius={2}
          opacity={0}
          zIndex={5}
        />,
      );
      this.add(
        <Line
          ref={this.rowCells}
          closed
          points={[
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ]}
          fill={CARD}
          stroke={LINE}
          lineWidth={1}
          opacity={0}
          zIndex={1}
        />,
      );
      this.add(
        <Img
          ref={this.rowFlags}
          src={flags[i]}
          width={FLAG_W}
          height={FLAG_H}
          radius={2}
          opacity={0}
          zIndex={5}
        />,
      );
    }

    for (let i = 0; i < this.n * this.n; i++) {
      const top = this.topColors[i];
      this.add(
        <Line
          ref={this.barFronts}
          closed
          points={[
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ]}
          fill={shade(top, 0.72)}
          stroke={top}
          lineWidth={1}
          opacity={0}
        />,
      );
      this.add(
        <Line
          ref={this.barSides}
          closed
          points={[
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ]}
          fill={shade(top, 0.5)}
          stroke={top}
          lineWidth={1}
          opacity={0}
        />,
      );
      this.add(
        <Line
          ref={this.barTops}
          closed
          points={[
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ]}
          fill={top}
          stroke={LINE}
          lineWidth={1}
          opacity={0}
        />,
      );
      this.add(
        <Txt
          ref={this.valueTxts}
          text={String(matrix[Math.floor(i / this.n)][i % this.n])}
          fontFamily={MONO}
          fontSize={12}
          fontWeight={700}
          fill={this.textFills[i]}
          opacity={0}
          zIndex={6}
        />,
      );
    }

    this.sync();
  }

  private flatRect(col: number, row: number): Vector2[] {
    const x = this.flatOriginX + col * CELL_W;
    const y = this.flatOriginY + row * CELL_H;
    return [
      new Vector2(x, y),
      new Vector2(x + CELL_W, y),
      new Vector2(x + CELL_W, y + CELL_H),
      new Vector2(x, y + CELL_H),
    ];
  }

  private flatCenter(col: number, row: number): Vector2 {
    return new Vector2(
      this.flatOriginX + col * CELL_W + CELL_W / 2,
      this.flatOriginY + row * CELL_H + CELL_H / 2,
    );
  }

  /** 数据格 (r,c) 在 3D 世界中的地面中心 */
  private worldCenter(r: number, c: number): {cx: number; cz: number} {
    const pitch = CELL_W; // 世界间距与格宽同量级，便于对位
    const half = ((this.n - 1) * pitch) / 2;
    return {
      cx: -half + c * pitch,
      cz: -half + r * pitch,
    };
  }

  private cam(): Camera3D {
    return {
      yaw: this.camYaw,
      pitch: this.camPitch,
      distance: this.camDistance,
      fov: this.camFov,
    };
  }

  /** 随 morph 上移画布投影中心（y 减小 = 画面上移） */
  private viewOrigin(): {x: number; y: number} {
    return {
      x: this.originBase.x,
      y: this.originBase.y + this.morph * this.originLift,
    };
  }

  private sync() {
    const t = this.morph;
    const cam = this.cam();
    const origin = this.viewOrigin();

    // 外框：正交整表矩形 → 3D 地面投影框
    const tableCols = this.n + 1;
    const tableRows = this.n + 1;
    const flatFrame = [
      new Vector2(this.flatOriginX, this.flatOriginY),
      new Vector2(this.flatOriginX + tableCols * CELL_W, this.flatOriginY),
      new Vector2(
        this.flatOriginX + tableCols * CELL_W,
        this.flatOriginY + tableRows * CELL_H,
      ),
      new Vector2(this.flatOriginX, this.flatOriginY + tableRows * CELL_H),
    ];
    const half = (this.n * CELL_W) / 2 + CELL_W;
    const frame3 = [
      project3D({x: -half, y: 0, z: -half}, cam, origin).pos,
      project3D({x: half, y: 0, z: -half}, cam, origin).pos,
      project3D({x: half, y: 0, z: half}, cam, origin).pos,
      project3D({x: -half, y: 0, z: half}, cam, origin).pos,
    ];
    this.frameBorder[0].points(lerpPoly(flatFrame, frame3, t));

    // 国旗放在相机近侧两条边外：-x（行头）与 +z（表头），避免被柱体挡住
    const dataHalf = ((this.n - 1) * CELL_W) / 2;
    const flagOut = CELL_W * 0.95;
    const nearX = -dataHalf - flagOut; // 行头外侧
    const nearZ = dataHalf + flagOut; // 表头外侧（+z 为近侧）
    const flagY = 18; // 略抬高，减少被前景柱裁切

    // 表头 / 行头 / 角格
    const cornerFlat = this.flatRect(0, 0);
    const corner3 = [
      project3D(
        {x: nearX - CELL_W / 2, y: 0, z: nearZ - CELL_W / 2},
        cam,
        origin,
      ).pos,
      project3D(
        {x: nearX + CELL_W / 2, y: 0, z: nearZ - CELL_W / 2},
        cam,
        origin,
      ).pos,
      project3D(
        {x: nearX + CELL_W / 2, y: 0, z: nearZ + CELL_W / 2},
        cam,
        origin,
      ).pos,
      project3D(
        {x: nearX - CELL_W / 2, y: 0, z: nearZ + CELL_W / 2},
        cam,
        origin,
      ).pos,
    ];
    this.cornerCell[0].points(lerpPoly(cornerFlat, corner3, t));

    for (let i = 0; i < this.n; i++) {
      const hFlat = this.flatRect(i + 1, 0);
      const {cx} = this.worldCenter(0, i);
      const h3 = [
        project3D(
          {x: cx - CELL_W / 2, y: 0, z: nearZ - CELL_W / 2},
          cam,
          origin,
        ).pos,
        project3D(
          {x: cx + CELL_W / 2, y: 0, z: nearZ - CELL_W / 2},
          cam,
          origin,
        ).pos,
        project3D(
          {x: cx + CELL_W / 2, y: 0, z: nearZ + CELL_W / 2},
          cam,
          origin,
        ).pos,
        project3D(
          {x: cx - CELL_W / 2, y: 0, z: nearZ + CELL_W / 2},
          cam,
          origin,
        ).pos,
      ];
      this.headerCells[i].points(lerpPoly(hFlat, h3, t));
      const hCenter = lerp2(
        this.flatCenter(i + 1, 0),
        project3D({x: cx, y: flagY, z: nearZ}, cam, origin).pos,
        t,
      );
      this.headerFlags[i].position(hCenter);
      this.headerFlags[i].scale(1 - 0.08 * t);
      this.headerFlags[i].zIndex(8000 + i);

      const rFlat = this.flatRect(0, i + 1);
      const {cz} = this.worldCenter(i, 0);
      const r3 = [
        project3D(
          {x: nearX - CELL_W / 2, y: 0, z: cz - CELL_W / 2},
          cam,
          origin,
        ).pos,
        project3D(
          {x: nearX + CELL_W / 2, y: 0, z: cz - CELL_W / 2},
          cam,
          origin,
        ).pos,
        project3D(
          {x: nearX + CELL_W / 2, y: 0, z: cz + CELL_W / 2},
          cam,
          origin,
        ).pos,
        project3D(
          {x: nearX - CELL_W / 2, y: 0, z: cz + CELL_W / 2},
          cam,
          origin,
        ).pos,
      ];
      this.rowCells[i].points(lerpPoly(rFlat, r3, t));
      const rCenter = lerp2(
        this.flatCenter(0, i + 1),
        project3D({x: nearX, y: flagY, z: cz}, cam, origin).pos,
        t,
      );
      this.rowFlags[i].position(rCenter);
      this.rowFlags[i].scale(1 - 0.08 * t);
      this.rowFlags[i].zIndex(8100 + i);
    }

    // 数据柱：顶面角点从正交格插值到 3D；侧面随 morph/高度显现
    const order: {idx: number; depth: number}[] = [];
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const {cx, cz} = this.worldCenter(r, c);
        const d = project3D({x: cx, y: 0, z: cz}, cam, origin).depth;
        order.push({idx: r * this.n + c, depth: d});
      }
    }
    order.sort((a, b) => b.depth - a.depth);

    for (const {idx, depth} of order) {
      const r = Math.floor(idx / this.n);
      const c = idx % this.n;
      const flatTop = this.flatRect(c + 1, r + 1);
      const {cx, cz} = this.worldCenter(r, c);
      const h = Math.max(this.heights[idx], 1);
      const faces = buildBarFacesForCam(
        cx,
        cz,
        CELL_W * 0.92,
        CELL_W * 0.92,
        h,
        cam,
        origin,
      );

      const top = lerpPoly(flatTop, faces.top, t);
      // flatTop: 0=TL 1=TR 2=BR 3=BL；+z 近 → 底边 3-2；-x 近 → 左边 0-3；+x 近 → 右边 1-2
      const flatFront = [flatTop[3], flatTop[2], flatTop[2], flatTop[3]];
      const flatSide =
        faces.sx < 0
          ? [flatTop[0], flatTop[3], flatTop[3], flatTop[0]]
          : [flatTop[1], flatTop[2], flatTop[2], flatTop[1]];
      const front = lerpPoly(flatFront, faces.front, t);
      const side = lerpPoly(flatSide, faces.side, t);

      const z = Math.round(100 + (1 - t) * 50 + t * (3000 - depth));
      this.barTops[idx].points(top);
      this.barFronts[idx].points(front);
      this.barSides[idx].points(side);
      this.barTops[idx].zIndex(z + 2);
      this.barFronts[idx].zIndex(z);
      this.barSides[idx].zIndex(z + 1);

      const flatC = this.flatCenter(c + 1, r + 1);
      const topC = lerp2(flatC, faces.topCenter, t);
      this.valueTxts[idx].position(topC);
      // 数字在开始倾斜后迅速淡出，避免歪斜难读
      this.valueTxts[idx].opacity(Math.max(0, 1 - t * 1.8));
      this.valueTxts[idx].scale(1 - 0.25 * t);
      this.valueTxts[idx].zIndex(z + 3);
    }

    // 标题随 3D 上移，避免落入字幕区
    this.titleTxt[0].y(this.flatOriginY - 36 + t * (this.originLift - 24));
    this.titleTxt[0].opacity(1);
  }

  /** 设为与 2D 表一致的正交态（morph=0，高度尚未拔起） */
  public armFlat() {
    this.morph = 0;
    this.camYaw = 0;
    this.camPitch = 1.52;
    this.camDistance = 2200;
    this.camFov = 2200;
    for (let i = 0; i < this.heights.length; i++) this.heights[i] = 1;
    this.sync();
  }

  /**
   * 先以正交态显现（应与 2D 矩阵视觉对齐），
   * 再同时：运镜到斜视 + 柱高生长 + 侧面显现。
   */
  public *play(): ThreadGenerator {
    this.armFlat();

    // 正交表淡入（与正在淡出的 2D 表叠化）
    yield* all(
      this.frameBorder[0].opacity(1, 0.35, easeOutCubic),
      this.cornerCell[0].opacity(1, 0.35, easeOutCubic),
      ...this.headerCells.map(c => c.opacity(1, 0.35, easeOutCubic)),
      ...this.rowCells.map(c => c.opacity(1, 0.35, easeOutCubic)),
      ...this.headerFlags.map(f => f.opacity(1, 0.35, easeOutCubic)),
      ...this.rowFlags.map(f => f.opacity(1, 0.35, easeOutCubic)),
      ...this.barTops.map(t => t.opacity(1, 0.35, easeOutCubic)),
      ...this.valueTxts.map(t => t.opacity(1, 0.35, easeOutCubic)),
      this.titleTxt[0].opacity(1, 0.35, easeOutCubic),
    );

    // 稍顿：让观众确认「还是同一张表」
    yield* waitFor(0.45);

    // 丝滑变形：morph + 柱高 + 相机 同步插值
    const yaw0 = 0;
    const pitch0 = 1.52;
    const dist0 = 2200;
    // 正 yaw + 更高俯仰：两列国旗都在近侧边外，柱体不易遮挡
    const yaw1 = 0.78;
    const pitch1 = 0.72;
    const dist1 = 1520;

    yield* tween(1.7, v => {
      const u = easeInOutCubic(v);
      this.morph = u;
      this.camYaw = yaw0 + (yaw1 - yaw0) * u;
      this.camPitch = pitch0 + (pitch1 - pitch0) * u;
      this.camDistance = dist0 + (dist1 - dist0) * u;
      this.camFov = this.camDistance;
      const grow = easeOutCubic(Math.max(0, (v - 0.08) / 0.92));
      for (let i = 0; i < this.heights.length; i++) {
        this.heights[i] = 1 + (this.targetHeights[i] - 1) * grow;
      }
      // 侧面随倾斜显现
      const sideOp = Math.max(0, (u - 0.12) / 0.55);
      for (const f of this.barFronts) f.opacity(sideOp);
      for (const s of this.barSides) s.opacity(sideOp);
      // 表头底格在斜视时略淡，避免抢柱体
      const headOp = 1 - 0.35 * u;
      this.cornerCell[0].opacity(headOp);
      for (const c of this.headerCells) c.opacity(headOp);
      for (const c of this.rowCells) c.opacity(headOp);
      this.sync();
    });

    // 顶面描边提亮
    yield* all(
      ...this.barTops.map(t => t.stroke(PAPER, 0.35, easeOutCubic)),
    );

    yield* waitFor(0.35);

    // 对角线高亮 + 轻环绕
    const yawHold = this.camYaw;
    yield* all(
      ...Array.from({length: this.n}, (_, i) => {
        const idx = i * this.n + i;
        return delay(
          i * 0.05,
          all(
            this.barTops[idx].fill(GOLD, 0.35, easeOutCubic),
            this.barFronts[idx].fill(shade(GOLD, 0.75), 0.35, easeOutCubic),
            this.barSides[idx].fill(shade(GOLD, 0.55), 0.35, easeOutCubic),
            this.barTops[idx].stroke(ACCENT, 0.35, easeOutCubic),
          ),
        );
      }),
      tween(1.1, v => {
        this.camYaw = yawHold + 0.12 * Math.sin(v * Math.PI);
        this.camPitch = pitch1 + 0.025 * Math.sin(v * Math.PI);
        this.sync();
      }),
    );

    yield* waitFor(0.75);

    const settleYaw = this.camYaw;
    const settlePitch = this.camPitch;
    yield* all(
      ...Array.from({length: this.n}, (_, i) => {
        const idx = i * this.n + i;
        const top = this.topColors[idx];
        return delay(
          i * 0.04,
          all(
            this.barTops[idx].fill(top, 0.35, easeOutCubic),
            this.barFronts[idx].fill(shade(top, 0.72), 0.35, easeOutCubic),
            this.barSides[idx].fill(shade(top, 0.5), 0.35, easeOutCubic),
            this.barTops[idx].stroke(PAPER, 0.35, easeOutCubic),
          ),
        );
      }),
      tween(0.7, v => {
        const u = easeInOutCubic(v);
        this.camYaw = settleYaw + (yaw1 - settleYaw) * u;
        this.camPitch = settlePitch + (pitch1 - settlePitch) * u;
        this.sync();
      }),
    );

    yield* waitFor(0.85);
  }
}
