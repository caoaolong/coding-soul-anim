import { Circle, Line, Node, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { SceneTitle } from "../components/title/scene_title";

/** —— 可配置：根节点、二级节点、三级节点 —— */
const ROOT = "💻计算机";

type GroupId = "theory" | "circuit";
type EnterMode = "group" | "sequential";
/** 连线类型：straight 直线 / elbow 直角折线 / curve 曲线 */
type EdgeStyle = "straight" | "elbow" | "curve";

interface ChildDef {
  label: string;
  color: string;
  group: GroupId;
  /** 三级节点：挂在该二级节点下 */
  grandchildren?: string[];
}

/** 二级节点：label + 颜色 + 分组 + 可选三级节点 */
const CHILDREN: ChildDef[] = [
  { label: "晶体管", color: "#3dd6c6", group: "circuit" as GroupId },
  {
    label: "理论支持",
    color: "#7aa2ff",
    group: "theory" as GroupId,
    grandchildren: ["1. 仅包含 0 和 1 两个数字", "2. 可以进行数学运算"],
  },
];

/** 三级节点拍平：记录归属父节点 + 继承父节点颜色 */
interface GrandDef {
  parent: number;
  label: string;
  color: string;
}
const GRANDS: GrandDef[] = CHILDREN.flatMap((c, i) =>
  (c.grandchildren ?? []).map((label) => ({
    parent: i,
    label,
    color: c.color,
  })),
);

/**
 * 子节点入场模式：
 * - sequential：单个节点依次入场（按 CHILDREN 顺序）
 * - group：同组同时入场，组间按 GROUP_ORDER
 */
const ENTER_MODE = "sequential" as EnterMode;
/** 分组入场顺序（仅 group 模式） */
const GROUP_ORDER: GroupId[] = ["theory", "circuit"];

/**
 * 连线类型：'straight' 直线 / 'elbow' 直角折线（先横后竖）/ 'curve' 曲线
 * 同时作用于二级与三级连线
 */
const EDGE_STYLE = "elbow" as EdgeStyle;

/** 二级节点到中心的距离 */
const RADIUS = 280;
/** 第一个二级节点起始角（度，0=右，180=左；两节点时左右排布） */
const START_DEG = 180;
/** 三级节点相对父节点的外扩距离 */
const L3_DIST = 300;
/** 同父三级节点间的垂直间距 */
const L3_SPREAD = 130;

const BG = "#0a0e14";
const PAPER = "#e8eef7";
const ACCENT = "#3dd6c6";

/** #rrggbb + 透明度 → rgba() 字符串，用作节点实底色 */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 各节点实底色：自家颜色淡 tint，不再是近透明深色 */
const ROOT_FILL = tint(ACCENT, 0.22);
const CHILD_FILL = CHILDREN.map((c) => tint(c.color, 0.22));
const GRAND_FILL = GRANDS.map((g) => tint(g.color, 0.18));

/** 按连线类型生成点列：elbow 取直角拐点，curve 用二次贝塞尔采样拟合 */
function edgePoints(from: Vector2, to: Vector2, style: EdgeStyle): Vector2[] {
  if (style === "elbow") {
    // 起终点已横向/纵向对齐时退化为直线，避免零长线段
    if (from.x === to.x || from.y === to.y) return [from, to];
    return [from, new Vector2(to.x, from.y), to];
  }
  if (style === "curve") {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(60, len * 0.18);
    const cx = (from.x + to.x) / 2 + (-dy / len) * bow;
    const cy = (from.y + to.y) / 2 + (dx / len) * bow;
    const SEG = 16;
    const pts: Vector2[] = [];
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const u = 1 - t;
      pts.push(
        new Vector2(
          u * u * from.x + 2 * u * t * cx + t * t * to.x,
          u * u * from.y + 2 * u * t * cy + t * t * to.y,
        ),
      );
    }
    return pts;
  }
  return [from, to];
}

/** 取点列上 t（0~1，按弧长）处的位置，用于放置枢纽点 */
function pointOnEdge(pts: Vector2[], t: number): Vector2 {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lens.push(l);
    total += l;
  }
  if (total === 0) return pts[0];
  let target = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i]) {
      const k = lens[i] === 0 ? 0 : target / lens[i];
      const a = pts[i];
      const b = pts[i + 1];
      return new Vector2(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
    }
    target -= lens[i];
  }
  return pts[pts.length - 1];
}

/**
 * 射线与轴对齐矩形边框的交点：center 为矩形中心，dir 为射线方向。
 * 水平布局下自然得到左右中点（左侧节点取右侧中点，右侧节点取左侧中点）。
 */
function borderPoint(center: Vector2, hw: number, hh: number, dir: Vector2): Vector2 {
  const ax = Math.abs(dir.x) < 1e-6 ? Infinity : hw / Math.abs(dir.x);
  const ay = Math.abs(dir.y) < 1e-6 ? Infinity : hh / Math.abs(dir.y);
  const t = Math.min(ax, ay);
  return new Vector2(center.x + dir.x * t, center.y + dir.y * t);
}

/** 径向思维导图：根居中，二级节点环绕，三级节点由父节点向外展开 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  view.add(<SceneTitle ref={title} text={"💻计算机"} />);

  // 整图容器：三级展开时平移 world 使内容居中（标题不动）
  const world = createRef<Node>();
  view.add(<Node ref={world} />);

  const rootBox = createRef<Rect>();
  const rootTxt = createRef<Txt>();
  const edges = createRefArray<Line>();
  const childBoxes = createRefArray<Rect>();
  const childTxts = createRefArray<Txt>();
  const hubs = createRefArray<Circle>();
  const subEdges = createRefArray<Line>();
  const subBoxes = createRefArray<Rect>();
  const subTxts = createRefArray<Txt>();
  const subHubs = createRefArray<Circle>();

  const n = CHILDREN.length;
  const units = CHILDREN.map((_, i) => {
    const deg = START_DEG + (360 / n) * i;
    const rad = (deg * Math.PI) / 180;
    return new Vector2(Math.cos(rad), Math.sin(rad));
  });
  const childPos = units.map((u) => u.mul(RADIUS));

  // 三级节点位置：父节点位置 + 外扩方向 * L3_DIST + 垂直错开
  const grandPos = GRANDS.map((g) => {
    const dir = units[g.parent];
    const px = -dir.y;
    const py = dir.x;
    const siblings = GRANDS.filter((x) => x.parent === g.parent);
    const k = siblings.indexOf(g);
    const off = (k - (siblings.length - 1) / 2) * L3_SPREAD;
    const c = childPos[g.parent];
    return new Vector2(
      c.x + dir.x * L3_DIST + px * off,
      c.y + dir.y * L3_DIST + py * off,
    );
  });

  // 按 EDGE_STYLE 生成二级 / 三级连线点列
  const edgePts = childPos.map((p) => edgePoints(Vector2.zero, p, EDGE_STYLE));
  const subEdgePts = GRANDS.map((g, gi) =>
    edgePoints(childPos[g.parent], grandPos[gi], EDGE_STYLE),
  );

  // 二级连线（先画，压在节点下）
  for (let i = 0; i < n; i++) {
    world().add(
      <Line
        ref={edges}
        points={edgePts[i]}
        stroke={CHILDREN[i].color}
        lineWidth={2}
        lineCap={"round"}
        end={0}
        opacity={0.55}
      />,
    );
  }

  // 子节点靠近根一侧的小枢纽点
  for (let i = 0; i < n; i++) {
    world().add(
      <Circle
        ref={hubs}
        position={pointOnEdge(edgePts[i], 0.18)}
        size={8}
        fill={CHILDREN[i].color}
        opacity={0}
      />,
    );
  }

  // 二级节点
  for (let i = 0; i < n; i++) {
    world().add(
      <Rect
        ref={childBoxes}
        layout
        position={childPos[i]}
        padding={[16, 28]}
        fill={CHILD_FILL[i]}
        stroke={CHILDREN[i].color}
        lineWidth={2}
        radius={10}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={childTxts}
          text={CHILDREN[i].label}
          fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
          fontSize={32}
          fill={PAPER}
        />
      </Rect>,
    );
  }

  // 三级连线 + 枢纽 + 节点
  for (let g = 0; g < GRANDS.length; g++) {
    world().add(
      <Line
        ref={subEdges}
        points={subEdgePts[g]}
        stroke={GRANDS[g].color}
        lineWidth={1.5}
        lineCap={"round"}
        end={0}
        opacity={0.55}
      />,
    );
  }
  for (let g = 0; g < GRANDS.length; g++) {
    world().add(
      <Circle
        ref={subHubs}
        position={pointOnEdge(subEdgePts[g], 0.18)}
        size={6}
        fill={GRANDS[g].color}
        opacity={0}
      />,
    );
  }
  for (let g = 0; g < GRANDS.length; g++) {
    world().add(
      <Rect
        ref={subBoxes}
        layout
        position={grandPos[g]}
        padding={[12, 22]}
        fill={GRAND_FILL[g]}
        stroke={GRANDS[g].color}
        lineWidth={1.5}
        radius={10}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={subTxts}
          text={GRANDS[g].label}
          fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
          fontSize={26}
          fill={PAPER}
        />
      </Rect>,
    );
  }

  // 根节点
  world().add(
    <Rect
      ref={rootBox}
      layout
      padding={[22, 40]}
      fill={ROOT_FILL}
      stroke={ACCENT}
      lineWidth={2.5}
      radius={12}
      opacity={0}
      scale={0.88}
    >
      <Txt
        ref={rootTxt}
        text={ROOT}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
        fontSize={44}
        fontWeight={700}
        fill={PAPER}
      />
    </Rect>,
  );

  /** 读取布局后的半宽高；布局未就绪（0）时返回 null */
  function halfSize(box: Rect): {hw: number; hh: number} | null {
    const w = box.width();
    const h = box.height();
    if (w <= 0 || h <= 0) return null;
    return {hw: w / 2, hh: h / 2};
  }

  /**
   * 按节点实际边框重算二级连线：起点=根边框，终点=子节点朝向根一侧的边框中点。
   * 在入场动画（end 0→1）前调用，此时线不可见，重算无闪烁。
   */
  function refreshEdge(i: number) {
    const to = childPos[i];
    const len = Math.hypot(to.x, to.y);
    if (len === 0) return;
    const dir = new Vector2(to.x / len, to.y / len);
    const rSize = halfSize(rootBox());
    const cSize = halfSize(childBoxes[i]);
    if (!rSize || !cSize) return;
    const start = borderPoint(Vector2.zero, rSize.hw, rSize.hh, dir);
    const end = borderPoint(to, cSize.hw, cSize.hh, new Vector2(-dir.x, -dir.y));
    const pts = edgePoints(start, end, EDGE_STYLE);
    edges[i].points(pts);
    hubs[i].position(pointOnEdge(pts, 0.18));
  }

  /** 按节点实际边框重算三级连线：起点=父节点外侧边框，终点=三级节点朝向父节点一侧的边框中点 */
  function refreshSubEdge(g: number) {
    const parent = childBoxes[GRANDS[g].parent];
    const from = childPos[GRANDS[g].parent];
    const to = grandPos[g];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const dir = new Vector2(dx / len, dy / len);
    const pSize = halfSize(parent);
    const gSize = halfSize(subBoxes[g]);
    if (!pSize || !gSize) return;
    const start = borderPoint(from, pSize.hw, pSize.hh, dir);
    const end = borderPoint(to, gSize.hw, gSize.hh, new Vector2(-dir.x, -dir.y));
    const pts = edgePoints(start, end, EDGE_STYLE);
    subEdges[g].points(pts);
    subHubs[g].position(pointOnEdge(pts, 0.18));
  }

  /** 单个二级节点入场（连线 + 枢纽 + 卡片） */
  function* enterChild(i: number): ThreadGenerator {
    refreshEdge(i);
    yield* all(
      hubs[i].opacity(0.9, 0.2, easeOutCubic),
      edges[i].end(1, 0.4, easeInOutCubic),
      delay(
        0.12,
        all(
          childBoxes[i].opacity(1, 0.35, easeOutCubic),
          childBoxes[i].scale(1, 0.4, easeOutCubic),
        ),
      ),
    );
  }

  /** 一批索引同时入场 */
  function* enterBatch(indices: number[]): ThreadGenerator {
    if (indices.length === 0) return;
    yield* all(...indices.map((i) => enterChild(i)));
  }

  /** 单个三级节点入场（连线 + 枢纽 + 卡片） */
  function* enterGrand(g: number): ThreadGenerator {
    refreshSubEdge(g);
    yield* all(
      subHubs[g].opacity(0.9, 0.2, easeOutCubic),
      subEdges[g].end(1, 0.4, easeInOutCubic),
      delay(
        0.12,
        all(
          subBoxes[g].opacity(1, 0.35, easeOutCubic),
          subBoxes[g].scale(1, 0.4, easeOutCubic),
        ),
      ),
    );
  }

  // 根入场
  yield* title().show(0.35);
  yield* all(
    rootBox().opacity(1, 0.45, easeOutCubic),
    rootBox().scale(1, 0.55, easeOutCubic),
  );
  yield* waitFor(0.2);

  // 二级节点入场
  if (ENTER_MODE === "sequential") {
    for (let i = 0; i < n; i++) {
      yield* enterChild(i);
      yield* waitFor(0.12);
    }
  } else {
    for (const group of GROUP_ORDER) {
      const indices = CHILDREN.map((c, i) =>
        c.group === group ? i : -1,
      ).filter((i) => i >= 0);
      yield* enterBatch(indices);
      yield* waitFor(0.28);
    }
  }

  // 右侧二级节点（当前即“理论支持”）的三级节点：其显示后依次展开
  const focusIndex = childPos.reduce(
    (best, p, i) => (p.x > childPos[best].x ? i : best),
    0,
  );
  const focusGs = GRANDS.map((g, gi) => (g.parent === focusIndex ? gi : -1)).filter(
    (gi) => gi >= 0,
  );

  // 三级展开时整体居中：按将要显示的全部节点实测 bounds 求水平偏移，
  // 与展开动画同步平移 world（标题不动）
  function contentShiftX(): number {
    let minX = Infinity;
    let maxX = -Infinity;
    const feed = (c: Vector2, box: Rect) => {
      const s = halfSize(box);
      if (!s) return;
      minX = Math.min(minX, c.x - s.hw);
      maxX = Math.max(maxX, c.x + s.hw);
    };
    feed(Vector2.zero, rootBox());
    childPos.forEach((c, i) => feed(c, childBoxes[i]));
    focusGs.forEach((gi) => feed(grandPos[gi], subBoxes[gi]));
    if (minX === Infinity) return 0;
    return (minX + maxX) / 2;
  }

  // 三级节点依次展开（无强调：连线生长 + 卡片弹出即可）
  function* expandFocus(): ThreadGenerator {
    for (const gi of focusGs) {
      yield* enterGrand(gi);
      yield* waitFor(0.3);
    }
  }

  yield* all(
    world().position.x(-contentShiftX(), 1.4, easeInOutCubic),
    expandFocus(),
  );

  yield* waitFor(0.8);
});
