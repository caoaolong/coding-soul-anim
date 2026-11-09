import {
  Circle,
  Latex,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';
import {Camera3D, Vec3, project3D} from './three_proj';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const CARD = '#121820';
const DEEP = '#0e141c';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const GOLD = '#ffb454';
const BLUE = '#7aa2ff';
const RED = '#ff6b6b';
const GREEN = '#a3e635';

const GRID_N = 9;

export interface CrossEntropyLossBoardProps extends NodeProps {}

/**
 * 第六章组件：为什么交叉熵是损失函数设计的理论基础？（<<<loss>>>）
 * 1) 左侧：3D 交叉熵损失曲面（可旋转三维网格）+ 梯度下降小球沿曲面滚落至全局极小点
 * 2) 右上：三次训练迭代进度条（70% → 90% → 99%），纯绝对坐标无重叠
 * 3) 右下：Softmax + 交叉熵反向传播闭环动画（∂L/∂z_i = q_i - p_i）与三大特点标签
 */
export class CrossEntropyLossBoard extends Node {
  private readonly surfaceCard = createRef<Rect>();
  private readonly uLines = createRefArray<Line>();
  private readonly vLines = createRefArray<Line>();
  private readonly pathLine = createRef<Line>();
  private readonly waypointDots = createRefArray<Circle>();
  private readonly waypointTags = createRefArray<Txt>();
  private readonly ballGlow = createRef<Circle>();
  private readonly ballCore = createRef<Circle>();

  // 右上训练步
  private readonly trainCard = createRef<Rect>();
  private readonly stepRows = createRefArray<Rect>();
  private readonly stepFills = createRefArray<Rect>();

  // 右下 Softmax 梯度闭环卡片
  private readonly gradCard = createRef<Rect>();
  private readonly fwdArrows = createRefArray<Line>();
  private readonly bwdArrow = createRef<Line>();
  private readonly pulseDot = createRef<Circle>();
  private readonly traitPills = createRefArray<Rect>();

  private camYaw = -0.62;
  private readonly camPitch = 0.48;
  private ballProgress = 0; // 0 -> 0.5 -> 1.0
  private readonly surfaceCenter = {x: -415, y: 120};

  // 三次训练在 3D 曲面上的参数坐标 (x, z)
  private readonly waypointsXZ: Array<{x: number; z: number; label: string; color: string}> = [
    {x: -145, z: -125, label: '70% (0.515 bit)', color: GOLD},
    {x: -68, z: -55, label: '90% (0.152 bit)', color: BLUE},
    {x: 0, z: 0, label: '99% (0.0145 bit)', color: GREEN},
  ];

  public constructor(props: CrossEntropyLossBoardProps = {}) {
    super({...props});

    // 左侧 3D 损失曲面容器框
    this.add(
      <Rect
        ref={this.surfaceCard}
        width={760}
        height={760}
        x={-415}
        y={40}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'3D 交叉熵损失曲面 L(θ) 与梯度下降'}
          fontFamily={FONT}
          fontSize={25}
          fontWeight={700}
          fill={PAPER}
          y={-335}
        />
        <Txt
          text={'沿着负梯度方向滚落  ⇒  损失最小化 (Q → P)'}
          fontFamily={FONT}
          fontSize={21}
          fontWeight={700}
          fill={ACCENT}
          y={335}
        />
      </Rect>,
    );

    // 3D 曲面网格线（GRID_N 条横线 + GRID_N 条纵线）
    for (let i = 0; i < GRID_N; i++) {
      const isEdge = i === 0 || i === GRID_N - 1;
      this.add(
        <Line
          ref={this.uLines}
          points={[]}
          stroke={isEdge ? ACCENT : '#29435c'}
          lineWidth={isEdge ? 2.2 : 1.5}
          opacity={0}
        />,
      );
      this.add(
        <Line
          ref={this.vLines}
          points={[]}
          stroke={isEdge ? BLUE : '#29435c'}
          lineWidth={isEdge ? 2.2 : 1.5}
          opacity={0}
        />,
      );
    }

    // 3D 梯度下降轨迹线
    this.add(
      <Line
        ref={this.pathLine}
        points={[]}
        stroke={GOLD}
        lineWidth={4}
        lineCap={'round'}
        end={0}
        opacity={0}
      />,
    );

    // 3 个里程碑点与标签
    this.waypointsXZ.forEach(wp => {
      this.add(
        <Circle
          ref={this.waypointDots}
          size={14}
          fill={wp.color}
          stroke={PAPER}
          lineWidth={2}
          opacity={0}
        />,
      );
      this.add(
        <Txt
          ref={this.waypointTags}
          text={wp.label}
          fontFamily={FONT}
          fontSize={19}
          fontWeight={700}
          fill={wp.color}
          opacity={0}
        />,
      );
    });

    // 3D 滚落小球
    this.add(
      <Circle
        ref={this.ballGlow}
        size={38}
        fill={'rgba(61, 214, 198, 0.32)'}
        opacity={0}
      />,
    );
    this.add(
      <Circle
        ref={this.ballCore}
        size={18}
        fill={ACCENT}
        stroke={PAPER}
        lineWidth={2.5}
        opacity={0}
      />,
    );

    // 右上：三次训练预测演进卡片（纯坐标布局，零重叠）
    this.add(
      <Rect
        ref={this.trainCard}
        width={800}
        height={350}
        x={410}
        y={-165}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'🐱 真实标签：猫 100%  |  训练预测演进'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={PAPER}
          x={-355}
          y={-132}
          offset={[-1, 0]}
        />

        {[
          {y: -58, step: '第 1 次预测', pct: '猫 70%', loss: '0.515 bit', w: 182, color: GOLD},
          {y: 24, step: '第 2 次预测', pct: '猫 90%', loss: '0.152 bit', w: 234, color: BLUE},
          {y: 106, step: '第 3 次预测', pct: '猫 99%', loss: '0.0145 bit', w: 258, color: GREEN},
        ].map(row => (
          <Rect
            ref={this.stepRows}
            width={720}
            height={66}
            y={row.y}
            radius={12}
            fill={DEEP}
            stroke={row.color}
            lineWidth={2}
            opacity={0}
            scale={0.94}
          >
            <Txt
              text={row.step}
              fontFamily={FONT}
              fontSize={21}
              fontWeight={700}
              fill={row.color}
              x={-330}
              offset={[-1, 0]}
            />
            <Txt
              text={row.pct}
              fontFamily={FONT}
              fontSize={21}
              fill={PAPER}
              x={-165}
              offset={[-1, 0]}
            />
            <Rect
              width={260}
              height={16}
              x={45}
              radius={8}
              fill={'#1b2533'}
              clip
            >
              <Rect
                ref={this.stepFills}
                width={0}
                height={16}
                x={-130}
                offset={[-1, 0]}
                fill={row.color}
              />
            </Rect>
            <Txt
              text={row.loss}
              fontFamily={FONT}
              fontSize={22}
              fontWeight={700}
              fill={row.color}
              x={330}
              offset={[1, 0]}
            />
          </Rect>
        ))}
      </Rect>,
    );

    // 右下：Softmax + 交叉熵反向传播梯度闭环卡片
    this.add(
      <Rect
        ref={this.gradCard}
        width={800}
        height={370}
        x={410}
        y={235}
        fill={CARD}
        stroke={BLUE}
        lineWidth={2}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'Softmax + 交叉熵反向传播闭环'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={BLUE}
          x={-355}
          y={-142}
          offset={[-1, 0]}
        />

        {/* 前向节点：Logits z_i -> Softmax q_i -> CrossEntropy L */}
        {[
          {x: -260, label: '输出分数', tex: 'z_i', color: MUTED},
          {x: 0, label: 'Softmax', tex: 'q_i', color: BLUE},
          {x: 260, label: '交叉熵损失', tex: '\\mathcal{L}', color: RED},
        ].map(box => (
          <Rect
            width={165}
            height={78}
            x={box.x}
            y={-58}
            radius={12}
            fill={DEEP}
            stroke={box.color}
            lineWidth={2}
          >
            <Txt
              text={box.label}
              fontFamily={FONT}
              fontSize={18}
              fill={MUTED}
              y={-18}
            />
            <Latex tex={[box.tex]} fontSize={26} fill={PAPER} y={14} />
          </Rect>
        ))}

        {/* 前向箭头 */}
        {[
          [
            [-172, -58],
            [-88, -58],
          ],
          [
            [88, -58],
            [172, -58],
          ],
        ].map(pts => (
          <Line
            ref={this.fwdArrows}
            points={pts as [number, number][]}
            stroke={ACCENT}
            lineWidth={3}
            endArrow
            arrowSize={10}
            end={0}
          />
        ))}

        {/* 反向传播折线箭头：从 L 底部回到 z_i */}
        <Line
          ref={this.bwdArrow}
          points={[
            [260, -18],
            [260, 42],
            [-260, 42],
            [-260, -18],
          ]}
          stroke={GOLD}
          lineWidth={3}
          lineDash={[8, 6]}
          endArrow
          arrowSize={11}
          end={0}
        />

        {/* 简洁梯度公式徽章 */}
        <Rect
          width={310}
          height={56}
          x={0}
          y={42}
          radius={10}
          fill={CARD}
          stroke={GOLD}
          lineWidth={2}
        >
          <Latex
            tex={['\\dfrac{\\partial \\mathcal{L}}{\\partial z_i} = q_i - p_i']}
            fontSize={28}
            fill={GOLD}
          />
        </Rect>

        <Circle
          ref={this.pulseDot}
          size={14}
          fill={GOLD}
          x={260}
          y={-18}
          opacity={0}
        />

        {/* 底部三大特点胶囊 */}
        {[
          {x: -245, text: '1. 衡量分布差异', color: ACCENT},
          {x: 0, text: '2. 严惩高置信错判', color: RED},
          {x: 245, text: '3. 梯度简洁 (Q→P)', color: GREEN},
        ].map(p => (
          <Rect
            ref={this.traitPills}
            width={225}
            height={48}
            x={p.x}
            y={128}
            radius={24}
            fill={DEEP}
            stroke={p.color}
            lineWidth={2}
            opacity={0}
            scale={0.85}
          >
            <Txt
              text={p.text}
              fontFamily={FONT}
              fontSize={20}
              fontWeight={700}
              fill={p.color}
            />
          </Rect>
        ))}
      </Rect>,
    );

    this.sync3DSurface();
  }

  /** 3D 损失曲面高度函数：平滑凸碗 + 错判陡壁 */
  private lossSurfaceY(x: number, z: number): number {
    const bowl = 0.0052 * (x * x + z * z);
    const steep = 0.000018 * Math.max(0, -x) ** 3;
    return bowl + steep - 95;
  }

  /** 根据进度 t ∈ [0, 1] 插值计算小球在 3D 曲面上的三维位置 */
  private sampleBall3D(t: number): Vec3 {
    const p0 = this.waypointsXZ[0];
    const p1 = this.waypointsXZ[1];
    const p2 = this.waypointsXZ[2];
    let x: number;
    let z: number;
    if (t <= 0.5) {
      const u = t * 2;
      x = p0.x + (p1.x - p0.x) * u;
      z = p0.z + (p1.z - p0.z) * u;
    } else {
      const u = (t - 0.5) * 2;
      x = p1.x + (p2.x - p1.x) * u;
      z = p1.z + (p2.z - p1.z) * u;
    }
    return {x, y: this.lossSurfaceY(x, z) + 8, z};
  }

  private sync3DSurface() {
    const cam: Camera3D = {
      yaw: this.camYaw,
      pitch: this.camPitch,
      distance: 880,
      fov: 880,
    };

    const span = 185;
    for (let i = 0; i < GRID_N; i++) {
      const u = -span + (2 * span * i) / (GRID_N - 1);
      const uPts: Vector2[] = [];
      const vPts: Vector2[] = [];
      for (let j = 0; j < GRID_N; j++) {
        const v = -span + (2 * span * j) / (GRID_N - 1);
        uPts.push(
          project3D({x: u, y: this.lossSurfaceY(u, v), z: v}, cam, this.surfaceCenter).pos,
        );
        vPts.push(
          project3D({x: v, y: this.lossSurfaceY(v, u), z: u}, cam, this.surfaceCenter).pos,
        );
      }
      this.uLines[i].points(uPts);
      this.vLines[i].points(vPts);
    }

    // 轨迹线
    const pathPts: Vector2[] = [];
    for (let s = 0; s <= 24; s++) {
      const pos3 = this.sampleBall3D(s / 24);
      pathPts.push(project3D(pos3, cam, this.surfaceCenter).pos);
    }
    this.pathLine().points(pathPts);

    // 3 个里程碑点
    this.waypointsXZ.forEach((wp, idx) => {
      const p3 = {x: wp.x, y: this.lossSurfaceY(wp.x, wp.z) + 8, z: wp.z};
      const proj = project3D(p3, cam, this.surfaceCenter).pos;
      this.waypointDots[idx].position(proj);
      this.waypointTags[idx].position([proj.x + 88, proj.y - 18]);
    });

    // 当前小球位置
    const ball3 = this.sampleBall3D(this.ballProgress);
    const ball2 = project3D(ball3, cam, this.surfaceCenter).pos;
    this.ballGlow().position(ball2);
    this.ballCore().position(ball2);
  }

  public *play(): ThreadGenerator {
    // 1) 左侧 3D 损失曲面与右侧训练面板入场
    yield* all(
      this.surfaceCard().opacity(1, 0.4, easeOutCubic),
      this.surfaceCard().scale(1, 0.45, easeOutBack),
      this.trainCard().opacity(1, 0.4, easeOutCubic),
      this.trainCard().scale(1, 0.45, easeOutBack),
      ...this.uLines.map(l => l.opacity(0.75, 0.4)),
      ...this.vLines.map(l => l.opacity(0.75, 0.4)),
    );

    // 2) 小球出现在第 1 次预测位置（高损失点），同步点亮第 1 行
    this.ballProgress = 0;
    this.sync3DSurface();
    yield* all(
      this.ballGlow().opacity(1, 0.3),
      this.ballCore().opacity(1, 0.3),
      this.pathLine().opacity(0.9, 0.3),
      this.waypointDots[0].opacity(1, 0.3),
      this.waypointTags[0].opacity(1, 0.3),
      this.stepRows[0].opacity(1, 0.35, easeOutCubic),
      this.stepRows[0].scale(1, 0.4, easeOutBack),
      this.stepFills[0].width(182, 0.45, easeOutCubic),
    );
    yield* waitFor(0.25);

    // 3) 小球沿 3D 曲面滚落至第 2 次预测（猫 90%）+ 3D 视角旋转
    yield* all(
      tween(0.85, v => {
        const t = easeInOutCubic(v);
        this.ballProgress = 0.5 * t;
        this.camYaw = -0.62 + 0.22 * t;
        this.sync3DSurface();
      }),
      this.pathLine().end(0.5, 0.85, easeInOutCubic),
      this.stepRows[1].opacity(1, 0.4, easeOutCubic),
      this.stepRows[1].scale(1, 0.45, easeOutBack),
      this.stepFills[1].width(234, 0.55, easeOutCubic),
    );
    yield* all(
      this.waypointDots[1].opacity(1, 0.25),
      this.waypointTags[1].opacity(1, 0.25),
    );
    yield* waitFor(0.2);

    // 4) 小球继续滚落至碗底全局最小点（第 3 次预测：猫 99%）
    yield* all(
      tween(0.85, v => {
        const t = easeInOutCubic(v);
        this.ballProgress = 0.5 + 0.5 * t;
        this.camYaw = -0.4 + 0.24 * t;
        this.sync3DSurface();
      }),
      this.pathLine().end(1, 0.85, easeInOutCubic),
      this.stepRows[2].opacity(1, 0.4, easeOutCubic),
      this.stepRows[2].scale(1, 0.45, easeOutBack),
      this.stepFills[2].width(258, 0.55, easeOutCubic),
    );
    yield* all(
      this.waypointDots[2].opacity(1, 0.25),
      this.waypointTags[2].opacity(1, 0.25),
    );
    yield* waitFor(0.25);

    // 5) 右下 Softmax + 交叉熵反向传播闭环卡片入场与信号流演示
    yield* all(
      this.gradCard().opacity(1, 0.4, easeOutCubic),
      this.gradCard().scale(1, 0.45, easeOutBack),
    );
    yield* all(...this.fwdArrows.map(a => a.end(1, 0.35, easeOutCubic)));
    yield* this.bwdArrow().end(1, 0.55, easeInOutCubic);

    // 反向梯度脉冲小球 + 3D 曲面继续缓慢自转 + 三大特点胶囊弹出
    yield* all(
      tween(1.1, v => {
        this.camYaw = -0.16 - 0.32 * Math.sin(v * Math.PI);
        this.sync3DSurface();
      }),
      ...this.traitPills.map((p, i) =>
        all(
          p.opacity(1, 0.35 + i * 0.1, easeOutCubic),
          p.scale(1, 0.4 + i * 0.1, easeOutBack),
        ),
      ),
    );

    yield* waitFor(1.1);
  }
}
