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
  all,
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
const GREEN = '#a3e635';

export interface EntropySummaryBoardProps extends NodeProps {}

interface StarNodeDef {
  pos: Vec3;
  title: string;
  sub: string;
  color: string;
  major: boolean;
}

/**
 * 第七章组件：结语（<<<ending>>>）
 * 1) 上半部：3D 旋转知识星图（三维空间中连接 信息量 — 信息熵 — 交叉熵 及五大应用卫星节点）
 * 2) 下半部：精简双栏对比（系统固有不确定性 vs 模型认知代价），纯坐标无重叠
 */
export class EntropySummaryBoard extends Node {
  private readonly edgeLines = createRefArray<Line>();
  private readonly nodeCards = createRefArray<Rect>();
  private readonly orbitRings = createRefArray<Circle>();
  private readonly contrastCards = createRefArray<Rect>();

  private camYaw = 0;
  private readonly camPitch = 0.34;
  private readonly starCenter = {x: 0, y: -95};

  private readonly nodes3D: StarNodeDef[] = [
    // 三大核心主节点（正三角形分布）
    {pos: {x: -360, y: 35, z: 90}, title: '信息量 I(x)', sub: '-log₂ P(x) · 单事件', color: ACCENT, major: true},
    {pos: {x: 0, y: 65, z: -210}, title: '信息熵 H(P)', sub: '信息量期望 · 单分布', color: GOLD, major: true},
    {pos: {x: 360, y: 35, z: 90}, title: '交叉熵 H(P,Q)', sub: 'H(P)+D_KL · 双分布', color: BLUE, major: true},
    // 五个应用与直觉卫星节点
    {pos: {x: -560, y: -65, z: -40}, title: 'LPL 爆冷', sub: '小概率高信息', color: ACCENT, major: false},
    {pos: {x: -210, y: -85, z: -280}, title: '哈夫曼编码', sub: '无损压缩下界', color: GOLD, major: false},
    {pos: {x: 210, y: -85, z: -280}, title: '决策树', sub: '信息增益划分', color: GREEN, major: false},
    {pos: {x: 560, y: -65, z: -40}, title: 'Softmax 损失', sub: '深度学习分类', color: BLUE, major: false},
  ];

  private readonly edges3D: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 6],
  ];

  public constructor(props: EntropySummaryBoardProps = {}) {
    super({...props});

    // 背景轨道装饰环
    [560, 820].forEach(w => {
      this.add(
        <Circle
          ref={this.orbitRings}
          x={this.starCenter.x}
          y={this.starCenter.y + 10}
          width={w}
          height={w * 0.32}
          stroke={LINE}
          lineWidth={1.5}
          lineDash={[10, 8]}
          opacity={0}
        />,
      );
    });

    // 3D 连线
    this.edges3D.forEach(([a, b]) => {
      const isMain = a < 3 && b < 3;
      this.add(
        <Line
          ref={this.edgeLines}
          points={[
            [0, 0],
            [0, 0],
          ]}
          stroke={isMain ? ACCENT : '#3a5068'}
          lineWidth={isMain ? 3 : 2}
          lineDash={isMain ? [] : [8, 6]}
          opacity={0}
        />,
      );
    });

    // 3D 节点卡片
    this.nodes3D.forEach(nd => {
      const w = nd.major ? 250 : 185;
      const h = nd.major ? 96 : 74;
      this.add(
        <Rect
          ref={this.nodeCards}
          width={w}
          height={h}
          radius={nd.major ? 16 : 12}
          fill={nd.major ? CARD : DEEP}
          stroke={nd.color}
          lineWidth={nd.major ? 3 : 2}
          opacity={0}
          scale={0.7}
        >
          <Txt
            text={nd.title}
            fontFamily={FONT}
            fontSize={nd.major ? 26 : 21}
            fontWeight={700}
            fill={nd.color}
            y={-15}
          />
          <Txt
            text={nd.sub}
            fontFamily={FONT}
            fontSize={nd.major ? 18 : 16}
            fill={PAPER}
            y={18}
          />
        </Rect>,
      );
    });

    // 底部双栏点睛对比卡片
    const contrasts = [
      {
        x: -395,
        tag: '信息熵 H(P)',
        main: '系统自身包含多少不确定性',
        tex: 'H(P) = -\\sum p_i\\log_2 p_i',
        color: GOLD,
      },
      {
        x: 395,
        tag: '交叉熵 H(P, Q)',
        main: '模型描述系统需付出的额外代价',
        tex: 'H(P,Q) = H(P) + D_{\\mathrm{KL}}(P\\,\\|\\,Q)',
        color: BLUE,
      },
    ];

    contrasts.forEach(ct => {
      this.add(
        <Rect
          ref={this.contrastCards}
          width={740}
          height={175}
          x={ct.x}
          y={315}
          fill={CARD}
          stroke={ct.color}
          lineWidth={2.5}
          radius={18}
          opacity={0}
          scale={0.92}
        >
          <Txt
            text={ct.tag}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={ct.color}
            x={-325}
            y={-48}
            offset={[-1, 0]}
          />
          <Latex
            tex={[ct.tex]}
            fontSize={26}
            fill={MUTED}
            x={325}
            y={-48}
            offset={[1, 0]}
          />
          <Line
            points={[
              [-325, -8],
              [325, -8],
            ]}
            stroke={LINE}
            lineWidth={1.5}
          />
          <Txt
            text={ct.main}
            fontFamily={FONT}
            fontSize={30}
            fontWeight={700}
            fill={PAPER}
            y={38}
          />
        </Rect>,
      );
    });

    this.sync3DConstellation();
  }

  private sync3DConstellation() {
    const cam: Camera3D = {
      yaw: this.camYaw,
      pitch: this.camPitch,
      distance: 1100,
      fov: 1100,
    };

    const projected = this.nodes3D.map(nd =>
      project3D(nd.pos, cam, this.starCenter),
    );

    this.edges3D.forEach(([a, b], idx) => {
      this.edgeLines[idx].points([projected[a].pos, projected[b].pos]);
    });

    projected.forEach((p, idx) => {
      const card = this.nodeCards[idx];
      card.position(p.pos);
      const depthScale = Math.max(0.78, Math.min(1.12, p.scale));
      card.scale(depthScale);
      card.zIndex(Math.round(2000 - p.depth));
    });
  }

  public *play(): ThreadGenerator {
    // 1) 3D 知识星图淡入展开
    yield* all(
      ...this.orbitRings.map(r => r.opacity(0.55, 0.4)),
      ...this.edgeLines.map(e => e.opacity(0.85, 0.45)),
      ...this.nodeCards.map(c => c.opacity(1, 0.45, easeOutCubic)),
    );

    // 2) 底部双栏升华对比卡片弹出 + 3D 星图平稳旋转环绕
    yield* all(
      tween(3.2, v => {
        this.camYaw = Math.sin(v * Math.PI * 2) * 0.42;
        this.sync3DConstellation();
      }),
      this.contrastCards[0].opacity(1, 0.45, easeOutCubic),
      this.contrastCards[0].scale(1, 0.5, easeOutBack),
      this.contrastCards[1].opacity(1, 0.55, easeOutCubic),
      this.contrastCards[1].scale(1, 0.6, easeOutBack),
    );

    yield* waitFor(0.8);
  }
}
