import {
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
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import {FocusWord} from '../emphasis/focus_word';
import {FONT} from '../../theme/fonts';
import {Camera3D, build3DBarFaces, project3D} from './three_proj';

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

export interface CrossEntropyBoardProps extends NodeProps {}

/**
 * 第四章组件：什么是交叉熵？（<<<cross_entropy>>>）
 * 1) 左侧：3D 双分布立体柱状台（后排真实分布 P=(1,0)，前排预测分布 Q 实时变形对比）
 * 2) 右侧：精简公式栏 + 三组预测状态行（0.515 bit / 0.0145 bit / 6.644 bit），纯坐标布局杜绝重叠
 */
export class CrossEntropyBoard extends Node {
  private readonly formulaCard = createRef<Rect>();
  private readonly stageCard = createRef<Rect>();
  private readonly qStateBadge = createRef<Txt>();
  private readonly stageGrids = createRefArray<Line>();

  // 4 根 3D 柱：[P_cat, P_dog, Q_cat, Q_dog]
  private readonly barFronts = createRefArray<Line>();
  private readonly barSides = createRefArray<Line>();
  private readonly barTops = createRefArray<Line>();
  private readonly barTags = createRefArray<Txt>();

  // 右侧三行对比卡片
  private readonly caseRows = createRefArray<Rect>();
  private readonly lossFills = createRefArray<Rect>();
  private readonly bottomTag = createRef<Rect>();
  private readonly focusWord = createRef<FocusWord>();

  private camYaw = -0.58;
  private readonly camPitch = 0.45;
  // 高度满分 180px
  private readonly heights = [180, 6, 126, 54];

  private readonly stageCenter = {x: -475, y: 155};
  private readonly barMeta = [
    {cx: -75, cz: -55, cFront: '#289e92', cSide: '#1c736a', cTop: ACCENT, label: 'P(猫)=1'},
    {cx: 75, cz: -55, cFront: '#289e92', cSide: '#1c736a', cTop: ACCENT, label: 'P(狗)=0'},
    {cx: -75, cz: 55, cFront: '#4e73cc', cSide: '#365296', cTop: BLUE, label: 'Q(猫)'},
    {cx: 75, cz: 55, cFront: '#cc8c3b', cSide: '#996626', cTop: GOLD, label: 'Q(狗)'},
  ];

  public constructor(props: CrossEntropyBoardProps = {}) {
    super({...props});

    // 顶部公式栏（显式绝对坐标，杜绝重叠）
    this.add(
      <Rect
        ref={this.formulaCard}
        width={1580}
        height={120}
        y={-295}
        fill={CARD}
        stroke={BLUE}
        lineWidth={2.5}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'交叉熵（Cross-Entropy）'}
          fontFamily={FONT}
          fontSize={30}
          fontWeight={700}
          fill={BLUE}
          x={-560}
          y={-20}
        />
        <Txt
          text={'P：真实分布    Q：预测分布'}
          fontFamily={FONT}
          fontSize={22}
          fill={MUTED}
          x={-560}
          y={22}
        />
        <Line
          points={[
            [-260, -40],
            [-260, 40],
          ]}
          stroke={LINE}
          lineWidth={2}
        />
        <Latex
          tex={['H(P, Q) = -\\sum_{i=1}^{n} p_{i}\\log_{2} q_{i}']}
          fontSize={48}
          fill={PAPER}
          x={240}
        />
      </Rect>,
    );

    // 左侧 3D 分布对比舞台外框
    this.add(
      <Rect
        ref={this.stageCard}
        width={610}
        height={490}
        x={-475}
        y={60}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'🐱 真实标签 P = (1, 0)  vs  模型预测 Q'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={PAPER}
          y={-202}
        />
        <Txt
          ref={this.qStateBadge}
          text={'当前预测：Q = (0.70, 0.30)'}
          fontFamily={FONT}
          fontSize={23}
          fontWeight={700}
          fill={BLUE}
          y={198}
        />
      </Rect>,
    );

    // 3D 舞台底座线
    for (let e = 0; e < 4; e++) {
      this.add(
        <Line
          ref={this.stageGrids}
          points={[
            [0, 0],
            [0, 0],
          ]}
          stroke={LINE}
          lineWidth={2}
          opacity={0}
        />,
      );
    }

    // 4 根 3D 柱体
    this.barMeta.forEach(m => {
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
          fill={m.cFront}
          stroke={m.cTop}
          lineWidth={1.5}
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
          fill={m.cSide}
          stroke={m.cTop}
          lineWidth={1.5}
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
          fill={m.cTop}
          stroke={PAPER}
          lineWidth={1.5}
          opacity={0}
        />,
      );
      this.add(
        <Txt
          ref={this.barTags}
          text={m.label}
          fontFamily={FONT}
          fontSize={20}
          fontWeight={700}
          fill={m.cTop}
          opacity={0}
        />,
      );
    });

    // 右侧三行状态对比卡片（纯绝对定位，零重叠）
    const cases = [
      {
        y: -110,
        title: '初步预测',
        qTex: 'Q = (0.7,\\,0.3)',
        calcTex: '-\\log_{2} 0.7 \\approx 0.515\\ \\text{bit}',
        barW: 110,
        color: GOLD,
      },
      {
        y: 60,
        title: '预测极准',
        qTex: 'Q = (0.99,\\,0.01)',
        calcTex: '-\\log_{2} 0.99 \\approx 0.0145\\ \\text{bit}',
        barW: 14,
        color: GREEN,
      },
      {
        y: 230,
        title: '严重误判',
        qTex: 'Q = (0.01,\\,0.99)',
        calcTex: '-\\log_{2} 0.01 \\approx 6.644\\ \\text{bit}',
        barW: 260,
        color: RED,
      },
    ];

    cases.forEach(c => {
      this.add(
        <Rect
          ref={this.caseRows}
          width={930}
          height={138}
          x={325}
          y={c.y}
          fill={CARD}
          stroke={c.color}
          lineWidth={2.5}
          radius={16}
          opacity={0}
          scale={0.92}
        >
          {/* 左：标题 + Q 分布 */}
          <Txt
            text={c.title}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={c.color}
            x={-355}
            y={-26}
          />
          <Latex
            tex={[c.qTex]}
            fontSize={28}
            fill={PAPER}
            x={-335}
            y={22}
          />

          <Line
            points={[
              [-205, -44],
              [-205, 44],
            ]}
            stroke={LINE}
            lineWidth={1.5}
          />

          {/* 中：计算式与比特代价 */}
          <Latex
            tex={[c.calcTex]}
            fontSize={32}
            fill={c.color}
            x={-15}
            y={0}
          />

          {/* 右：损失能量条 */}
          <Txt
            text={'信息代价'}
            fontFamily={FONT}
            fontSize={18}
            fill={MUTED}
            x={310}
            y={-24}
          />
          <Rect
            width={260}
            height={22}
            x={310}
            y={16}
            radius={11}
            fill={DEEP}
            stroke={LINE}
            lineWidth={1.5}
            clip
          >
            <Rect
              ref={this.lossFills}
              width={0}
              height={22}
              x={-130}
              offset={[-1, 0]}
              fill={c.color}
              data-w={c.barW}
            />
          </Rect>
        </Rect>,
      );
    });

    // 底部一句话结论
    this.add(
      <Rect
        ref={this.bottomTag}
        width={1120}
        height={64}
        y={400}
        fill={CARD}
        stroke={ACCENT}
        lineWidth={2}
        radius={32}
        opacity={0}
        scale={0.92}
      >
        <Txt
          text={'交叉熵 = 用预测分布 Q 描述真实分布 P 所需的平均信息代价'}
          fontFamily={FONT}
          fontSize={28}
          fontWeight={700}
          fill={ACCENT}
        />
      </Rect>,
    );

    this.add(<FocusWord ref={this.focusWord} text={'交叉熵'} />);
    this.sync3DStage();
  }

  private sync3DStage() {
    const cam: Camera3D = {
      yaw: this.camYaw,
      pitch: this.camPitch,
      distance: 900,
      fov: 900,
    };

    const corners = [
      project3D({x: -150, y: 0, z: -115}, cam, this.stageCenter).pos,
      project3D({x: 150, y: 0, z: -115}, cam, this.stageCenter).pos,
      project3D({x: 150, y: 0, z: 115}, cam, this.stageCenter).pos,
      project3D({x: -150, y: 0, z: 115}, cam, this.stageCenter).pos,
    ];
    for (let e = 0; e < 4; e++) {
      this.stageGrids[e].points([corners[e], corners[(e + 1) % 4]]);
    }

    this.barMeta.forEach((m, i) => {
      const faces = build3DBarFaces(
        m.cx,
        m.cz,
        58,
        58,
        this.heights[i],
        cam,
        this.stageCenter,
      );
      this.barFronts[i].points(faces.front);
      this.barSides[i].points(faces.side);
      this.barTops[i].points(faces.top);
      this.barTags[i].position([faces.topCenter.x, faces.topCenter.y - 24]);
    });
  }

  /** 将 3D 预测柱 (Q_cat, Q_dog) 动态变形到新高度，同时环绕镜头 */
  private *morphQ3D(
    qCatH: number,
    qDogH: number,
    targetYaw: number,
    label: string,
    duration = 0.75,
  ): ThreadGenerator {
    const h2Start = this.heights[2];
    const h3Start = this.heights[3];
    const yawStart = this.camYaw;
    this.qStateBadge().text(label);

    yield* tween(duration, v => {
      const t = easeInOutCubic(v);
      this.heights[2] = h2Start + (qCatH - h2Start) * t;
      this.heights[3] = h3Start + (qDogH - h3Start) * t;
      this.camYaw = yawStart + (targetYaw - yawStart) * t;
      this.sync3DStage();
    });
  }

  public *play(): ThreadGenerator {
    // 1) 3D 舞台入场
    yield* all(
      this.stageCard().opacity(1, 0.4, easeOutCubic),
      this.stageCard().scale(1, 0.45, easeOutBack),
      ...this.stageGrids.map(g => g.opacity(0.7, 0.35)),
      ...this.barFronts.map(f => f.opacity(1, 0.35)),
      ...this.barSides.map(s => s.opacity(1, 0.35)),
      ...this.barTops.map(t => t.opacity(1, 0.35)),
      ...this.barTags.map(l => l.opacity(1, 0.35)),
    );
    yield* waitFor(0.25);

    // 2) 强调「交叉熵」
    yield* this.focusWord().play(0.7);

    // 3) 顶部公式入场
    yield* all(
      this.formulaCard().opacity(1, 0.4, easeOutCubic),
      this.formulaCard().scale(1, 0.45, easeOutBack),
    );
    yield* waitFor(0.2);

    // 4) 情况一：Q = (0.7, 0.3) -> 0.515 bit
    yield* all(
      this.morphQ3D(126, 54, -0.42, '当前预测：Q = (0.70, 0.30)', 0.65),
      this.caseRows[0].opacity(1, 0.4, easeOutCubic),
      this.caseRows[0].scale(1, 0.45, easeOutBack),
      this.lossFills[0].width(110, 0.55, easeOutCubic),
    );
    yield* waitFor(0.35);

    // 5) 情况二：Q = (0.99, 0.01) -> 0.0145 bit（3D Q_cat 柱升起与 P_cat 对齐）
    yield* all(
      this.morphQ3D(178, 6, -0.68, '预测极准：Q = (0.99, 0.01)', 0.7),
      this.caseRows[1].opacity(1, 0.4, easeOutCubic),
      this.caseRows[1].scale(1, 0.45, easeOutBack),
      this.lossFills[1].width(14, 0.55, easeOutCubic),
    );
    yield* waitFor(0.35);

    // 6) 情况三：Q = (0.01, 0.99) -> 6.644 bit（3D Q_dog 柱反超，损失拉满）
    yield* all(
      this.morphQ3D(8, 178, -0.48, '严重误判：Q = (0.01, 0.99)', 0.7),
      this.caseRows[2].opacity(1, 0.4, easeOutCubic),
      this.caseRows[2].scale(1, 0.45, easeOutBack),
      this.lossFills[2].width(260, 0.6, easeOutCubic),
    );
    yield* waitFor(0.35);

    // 7) 底部总结
    yield* all(
      this.bottomTag().opacity(1, 0.4, easeOutCubic),
      this.bottomTag().scale(1, 0.45, easeOutBack),
    );
    yield* waitFor(1.1);
  }
}
