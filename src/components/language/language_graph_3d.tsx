import {Circle, Img, Line, Node, NodeProps, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import {Camera3D, Vec3, project3D} from '../../utils/three_proj';

const PAPER = '#e8eef7';
const CARD = '#121820';
const ACCENT = '#3dd6c6';
const LINE = '#2a3a4c';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

export type LangGraphNode = {
  label: string;
  /** 国旗资源；作者图等场景可省略，改显示 initial */
  flag?: string;
  /** 无国旗时圆内缩写（默认取 label 前 2 字符） */
  initial?: string;
  color: string;
};

export type LangGraphEdge = {
  i: number;
  j: number;
  sim: number;
};

export type LangFocusCluster = {
  indices: number[];
  title: string;
};

export interface LanguageGraph3DProps extends NodeProps {
  langs: LangGraphNode[];
  /** 力导向后的 2D 布局（映射到 3D 地面：x→x, y→z） */
  layout: {x: number; y: number}[];
  edges: LangGraphEdge[];
  clusters: LangFocusCluster[];
  /** 地面网格半宽 */
  floorHalf?: number;
}

/**
 * 语言相似度图的 3D 透视舞台：
 * 节点落在倾斜地面上，相机可环绕 / 推近语簇。
 */
export class LanguageGraph3D extends Node {
  private readonly langs: LangGraphNode[];
  private readonly layout: {x: number; y: number}[];
  private readonly edges: LangGraphEdge[];
  private readonly clusters: LangFocusCluster[];
  private readonly floorHalf: number;

  private readonly floorLines = createRefArray<Line>();
  private readonly edgeLines = createRefArray<Line>();
  private readonly nodeRoots = createRefArray<Node>();
  private readonly nodeRings = createRefArray<Circle>();
  private readonly nodeShadows = createRefArray<Circle>();
  private readonly focusRing = createRef<Circle>();
  private readonly focusLabel = createRef<Txt>();

  private readonly positions3D: Vec3[] = [];
  private readonly edgeBaseOpacity: number[] = [];

  private camYaw = -0.38;
  private camPitch = 0.52;
  private camDistance = 1180;
  private camFov = 1180;
  /** 画布投影中心偏上，给底部字幕留空 */
  private readonly stageCenter = {x: 0, y: -70};
  /** 相机注视点（世界 xz），聚焦语簇时平移到簇心 */
  private lookAtX = 0;
  private lookAtZ = 0;

  private readonly baseDistance = 1180;
  private readonly baseFov = 1180;

  /** 聚焦时非簇内节点的目标透明度 */
  private nodeDim: number[] = [];

  public constructor(props: LanguageGraph3DProps) {
    const {
      langs,
      layout,
      edges,
      clusters,
      floorHalf = 520,
      ...nodeProps
    } = props;
    super({...nodeProps});

    this.langs = langs;
    this.layout = layout;
    this.edges = edges;
    this.clusters = clusters;
    this.floorHalf = floorHalf;

    for (let i = 0; i < layout.length; i++) {
      // 轻微抬高：相似中心略高，增加层次
      const r = Math.hypot(layout[i].x, layout[i].y);
      const lift = Math.max(0, 28 - r * 0.04);
      this.positions3D.push({
        x: layout[i].x,
        y: lift,
        z: layout[i].y,
      });
      this.nodeDim.push(1);
    }

    this.edgeBaseOpacity = edges.map(
      e => 0.06 + Math.pow(e.sim, 1.4) * 0.78,
    );

    // 地面网格：横纵各 9 条（投影坐标在 sync 中写入）
    for (let i = 0; i < 18; i++) {
      this.add(
        <Line
          ref={this.floorLines}
          points={[
            [0, 0],
            [0, 0],
          ]}
          stroke={LINE}
          lineWidth={1.2}
          opacity={0}
        />,
      );
    }

    for (const e of edges) {
      this.add(
        <Line
          ref={this.edgeLines}
          points={[
            [0, 0],
            [0, 0],
          ]}
          stroke={ACCENT}
          lineWidth={0.8 + e.sim * 5}
          opacity={0}
          lineCap={'round'}
        />,
      );
    }

    langs.forEach((lang, i) => {
      const mark = (lang.initial ?? lang.label.slice(0, 2)).toUpperCase();
      this.add(
        <Circle
          ref={this.nodeShadows}
          width={48}
          height={16}
          fill={'rgba(0,0,0,0.4)'}
          opacity={0}
        />,
      );
      this.add(
        <Node ref={this.nodeRoots} opacity={0} scale={0.7}>
          <Circle
            ref={this.nodeRings}
            width={58}
            height={58}
            fill={CARD}
            stroke={lang.color}
            lineWidth={2.5}
          />
          {lang.flag ? (
            <Img src={lang.flag} width={34} height={22} radius={3} />
          ) : (
            <Txt
              text={mark}
              fontFamily={MONO}
              fontSize={16}
              fontWeight={700}
              fill={lang.color}
            />
          )}
          <Txt
            text={lang.label}
            fontFamily={MONO}
            fontSize={13}
            fill={PAPER}
            y={42}
          />
        </Node>,
      );
    });

    this.add(
      <Circle
        ref={this.focusRing}
        width={160}
        height={160}
        stroke={ACCENT}
        lineWidth={3.5}
        fill={'#3dd6c618'}
        opacity={0}
        scale={0.85}
      />,
    );
    this.add(
      <Txt
        ref={this.focusLabel}
        text={''}
        fontFamily={MONO}
        fontSize={26}
        fontWeight={700}
        fill={ACCENT}
        y={320}
        opacity={0}
      />,
    );

    // 装饰：远处地平线淡化圆
    this.sync3DGeometry();
  }

  private cam(): Camera3D {
    return {
      yaw: this.camYaw,
      pitch: this.camPitch,
      distance: this.camDistance,
      fov: this.camFov,
    };
  }

  /** 相对注视点投影，实现镜头对准语簇 */
  private proj(p: Vec3) {
    return project3D(
      {
        x: p.x - this.lookAtX,
        y: p.y,
        z: p.z - this.lookAtZ,
      },
      this.cam(),
      this.stageCenter,
    );
  }

  /** 同步地面 / 节点 / 连线的投影几何 */
  private sync3DGeometry() {
    const h = this.floorHalf;
    let fi = 0;
    for (let i = -4; i <= 4; i++) {
      const a = (i / 4) * h;
      this.floorLines[fi].points([
        this.proj({x: -h, y: 0, z: a}).pos,
        this.proj({x: h, y: 0, z: a}).pos,
      ]);
      fi++;
      this.floorLines[fi].points([
        this.proj({x: a, y: 0, z: -h}).pos,
        this.proj({x: a, y: 0, z: h}).pos,
      ]);
      fi++;
    }

    const projected = this.positions3D.map(p => this.proj(p));

    this.edges.forEach((e, idx) => {
      this.edgeLines[idx].points([
        projected[e.i].pos,
        projected[e.j].pos,
      ]);
      this.edgeLines[idx].zIndex(
        Math.round(1500 - (projected[e.i].depth + projected[e.j].depth) / 2),
      );
    });

    projected.forEach((p, idx) => {
      // 推近时允许更大透视缩放，节点会明显变大
      const base = Math.max(0.7, Math.min(1.65, p.scale * 0.95));
      const dim = this.nodeDim[idx];
      this.nodeRoots[idx].position(p.pos);
      // 保留当前 opacity，只调 scale / zIndex
      const curOp = this.nodeRoots[idx].opacity();
      if (curOp > 0.02) {
        this.nodeRoots[idx].scale(base * (0.9 + 0.1 * dim));
      }
      this.nodeRoots[idx].zIndex(Math.round(2000 - p.depth));

      const shadow = this.proj({
        x: this.positions3D[idx].x,
        y: 0,
        z: this.positions3D[idx].z,
      });
      this.nodeShadows[idx].position(
        new Vector2(shadow.pos.x + 6, shadow.pos.y + 18),
      );
      this.nodeShadows[idx].scale(base * 0.9);
      this.nodeShadows[idx].zIndex(Math.round(1900 - p.depth));
      if (curOp > 0.02) {
        this.nodeShadows[idx].opacity(0.55 * dim);
      }
    });
  }

  public *play(): ThreadGenerator {
    // 1) 地面网格
    yield* all(...this.floorLines.map(l => l.opacity(0.4, 0.4, easeOutCubic)));

    // 2) 节点弹出
    yield* all(
      ...this.nodeRoots.map((node, i) =>
        delay(
          i * 0.045,
          all(
            node.opacity(1, 0.4, easeOutCubic),
            node.scale(1, 0.45, easeOutBack),
            this.nodeShadows[i].opacity(0.55, 0.4, easeOutCubic),
          ),
        ),
      ),
    );
    this.sync3DGeometry();
    yield* waitFor(0.2);

    // 3) 连线显现
    yield* all(
      ...this.edgeLines.map((edge, i) =>
        delay(
          i * 0.016,
          edge.opacity(this.edgeBaseOpacity[i], 0.4, easeOutCubic),
        ),
      ),
    );

    // 4) 相机环绕 + 节点轻微起伏
    const yaw0 = this.camYaw;
    const pitch0 = this.camPitch;
    yield* tween(2.6, v => {
      this.camYaw = yaw0 + 0.55 * Math.sin(v * Math.PI * 2);
      this.camPitch = pitch0 + 0.06 * Math.sin(v * Math.PI * 2 + 0.8);
      for (let i = 0; i < this.positions3D.length; i++) {
        const phase = (i / this.positions3D.length) * Math.PI * 2;
        const lift =
          Math.max(0, 28 - Math.hypot(this.layout[i].x, this.layout[i].y) * 0.04) +
          Math.sin(v * Math.PI * 2 + phase) * 10;
        this.positions3D[i].y = lift;
      }
      this.sync3DGeometry();
    });

    // 复位高度
    for (let i = 0; i < this.positions3D.length; i++) {
      const r = Math.hypot(this.layout[i].x, this.layout[i].y);
      this.positions3D[i].y = Math.max(0, 28 - r * 0.04);
    }
    this.camYaw = yaw0;
    this.camPitch = pitch0;
    this.sync3DGeometry();
    yield* waitFor(0.15);

    // 5) 逐簇推近聚焦
    for (const cluster of this.clusters) {
      const set = new Set(cluster.indices);
      let cx = 0;
      let cz = 0;
      for (const i of cluster.indices) {
        cx += this.positions3D[i].x;
        cz += this.positions3D[i].z;
      }
      cx /= cluster.indices.length;
      cz /= cluster.indices.length;

      let maxR = 0;
      for (const i of cluster.indices) {
        maxR = Math.max(
          maxR,
          Math.hypot(this.positions3D[i].x - cx, this.positions3D[i].z - cz),
        );
      }
      const pad = 70;
      const ringWorldR = Math.max(maxR + pad, 90);
      // 簇越小推得越近：约 1.75x ~ 2.45x
      const zoom = Math.min(2.45, Math.max(1.75, 360 / (maxR + pad)));

      this.focusLabel().text(cluster.title);

      yield* all(
        this.focusRing().opacity(0, 0.2, easeOutCubic),
        this.focusRing().scale(0.85, 0.2, easeOutCubic),
        this.focusLabel().opacity(0, 0.18, easeOutCubic),
      );

      const startYaw = this.camYaw;
      const startPitch = this.camPitch;
      const startDist = this.camDistance;
      const startFov = this.camFov;
      const startLookX = this.lookAtX;
      const startLookZ = this.lookAtZ;
      // 注视簇心 + 减小 distance（fov 不变）→ 真推近放大
      const targetYaw = startYaw + (-Math.atan2(cx - startLookX, 700)) * 0.35;
      const targetPitch = 0.62;
      const targetDist = this.baseDistance / zoom;
      const targetFov = this.baseFov;

      yield* tween(1.0, v => {
        const t = easeInOutCubic(v);
        this.camYaw = startYaw + (targetYaw - startYaw) * t;
        this.camPitch = startPitch + (targetPitch - startPitch) * t;
        this.camDistance = startDist + (targetDist - startDist) * t;
        this.camFov = startFov + (targetFov - startFov) * t;
        this.lookAtX = startLookX + (cx - startLookX) * t;
        this.lookAtZ = startLookZ + (cz - startLookZ) * t;
        for (let i = 0; i < this.langs.length; i++) {
          this.nodeDim[i] = set.has(i) ? 1 : 0.18 + (1 - t) * 0.82;
        }
        this.edges.forEach((e, ei) => {
          const inside = set.has(e.i) && set.has(e.j);
          const half = set.has(e.i) || set.has(e.j);
          const op = inside
            ? Math.min(1, this.edgeBaseOpacity[ei] + 0.45)
            : half
              ? this.edgeBaseOpacity[ei] * 0.55
              : this.edgeBaseOpacity[ei] * 0.12;
          const from = this.edgeLines[ei].opacity();
          this.edgeLines[ei].opacity(from + (op - from) * t);
        });
        this.sync3DGeometry();
        // 同步节点透明度
        for (let i = 0; i < this.langs.length; i++) {
          this.nodeRoots[i].opacity(this.nodeDim[i]);
          this.nodeShadows[i].opacity(0.55 * this.nodeDim[i]);
        }
      });

      // 聚焦环投影到地面
      const ringPts: Vector2[] = [];
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        ringPts.push(
          this.proj({
            x: cx + Math.cos(a) * ringWorldR,
            y: 2,
            z: cz + Math.sin(a) * ringWorldR,
          }).pos,
        );
      }
      // 用包围圆近似：中心 + 平均半径
      const rc = this.proj({x: cx, y: 4, z: cz});
      let avgR = 0;
      for (const p of ringPts) {
        avgR += Math.hypot(p.x - rc.pos.x, p.y - rc.pos.y);
      }
      avgR /= ringPts.length;
      this.focusRing().position(rc.pos);
      this.focusRing().size(avgR * 2);
      this.focusRing().zIndex(2100);

      yield* all(
        this.focusRing().opacity(1, 0.35, easeOutCubic),
        this.focusRing().scale(1, 0.45, easeOutBack),
        this.focusLabel().opacity(1, 0.3, easeOutCubic),
      );
      yield* this.focusRing().scale(1.06, 0.26, easeInOutCubic);
      yield* this.focusRing().scale(1, 0.26, easeInOutCubic);
      yield* waitFor(0.35);
    }

    // 6) 拉回全景
    const endYaw = this.camYaw;
    const endPitch = this.camPitch;
    const endDist = this.camDistance;
    const endFov = this.camFov;
    const endLookX = this.lookAtX;
    const endLookZ = this.lookAtZ;
    yield* all(
      this.focusRing().opacity(0, 0.3, easeOutCubic),
      this.focusLabel().opacity(0, 0.25, easeOutCubic),
      tween(1.05, v => {
        const t = easeInOutCubic(v);
        this.camYaw = endYaw + (yaw0 - endYaw) * t;
        this.camPitch = endPitch + (pitch0 - endPitch) * t;
        this.camDistance = endDist + (this.baseDistance - endDist) * t;
        this.camFov = endFov + (this.baseFov - endFov) * t;
        this.lookAtX = endLookX * (1 - t);
        this.lookAtZ = endLookZ * (1 - t);
        for (let i = 0; i < this.langs.length; i++) {
          this.nodeDim[i] = 0.18 + (1 - 0.18) * t;
          this.nodeRoots[i].opacity(this.nodeDim[i]);
          this.nodeShadows[i].opacity(0.55 * this.nodeDim[i]);
        }
        this.edges.forEach((_, ei) => {
          const target = this.edgeBaseOpacity[ei];
          const from = this.edgeLines[ei].opacity();
          this.edgeLines[ei].opacity(from + (target - from) * t);
        });
        this.sync3DGeometry();
      }),
    );

    for (let i = 0; i < this.langs.length; i++) {
      this.nodeDim[i] = 1;
      this.nodeRoots[i].opacity(1);
      this.nodeShadows[i].opacity(0.55);
    }
    this.sync3DGeometry();
    yield* waitFor(1.0);
  }
}
