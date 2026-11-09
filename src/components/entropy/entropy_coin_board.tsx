import {
  Circle,
  Img,
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
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import iconHeads from '../../assets/硬币正面.svg';
import iconTails from '../../assets/硬币反面.svg';
import {FocusWord} from '../emphasis/focus_word';
import {FormulaDerive} from '../formula/formula_derive';
import {FONT} from '../../theme/fonts';
import {Camera3D, build3DBarFaces, project3D} from './three_proj';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const CARD = '#121820';
const DEEP = '#0e141c';
const LINE = '#2a3a4c';
const DIVIDER = '#4a5d72';
const ACCENT = '#3dd6c6';
const GOLD = '#ffb454';
const BLUE = '#7aa2ff';

export interface EntropyCoinBoardProps extends NodeProps {}

/**
 * 第二章组件：什么是信息熵？（<<<entropy>>>）
 * 1) 3D 抛硬币抽样模拟：均匀硬币（正反交错）vs 偏置硬币（几乎全正）
 * 2) 3D 等轴立体概率柱与信息熵柱动态生长 + 视角环绕旋转
 * 3) 左右精简公式推导 H(X)=1 bit vs H(X)≈0.081 bit
 */
export class EntropyCoinBoard extends Node {
  private readonly formulaHeader = createRef<Rect>();
  private readonly divider = createRef<Line>();

  // 3D 硬币旋转节点
  private readonly coinNodes = createRefArray<Node>();
  private readonly coinImgs = createRefArray<Img>();
  private readonly coinShadows = createRefArray<Circle>();
  private readonly leftSamples = createRefArray<Rect>();
  private readonly rightSamples = createRefArray<Rect>();

  // 3D 柱状台多边形引用（每个 3D 柱含 front, side, top 三个面）
  private readonly barFronts = createRefArray<Line>();
  private readonly barSides = createRefArray<Line>();
  private readonly barTops = createRefArray<Line>();
  private readonly barValueLabels = createRefArray<Txt>();
  private readonly stageGrids = createRefArray<Line>();

  private readonly leftDerive = createRef<FormulaDerive>();
  private readonly rightDerive = createRef<FormulaDerive>();
  private readonly essenceTag = createRef<Rect>();
  private readonly focusWord = createRef<FocusWord>();

  private camYaw = -0.52;
  private readonly camPitch = 0.42;
  private readonly barHeights = [0, 0, 0, 0, 0, 0];
  // 6 根 3D 柱定义：左台 [p1=0.5, p2=0.5, H=1.0]，右台 [p1=0.99, p2=0.01, H=0.081]
  private readonly barDefs = [
    {stage: 0, cx: -115, cz: 0, targetH: 85, label: '正 50%', cFront: '#289e92', cSide: '#1c736a', cTop: '#3dd6c6'},
    {stage: 0, cx: 0, cz: 0, targetH: 85, label: '反 50%', cFront: '#4e73cc', cSide: '#365296', cTop: '#7aa2ff'},
    {stage: 0, cx: 125, cz: 0, targetH: 170, label: 'H = 1 bit', cFront: '#cc8c3b', cSide: '#996626', cTop: '#ffb454'},
    {stage: 1, cx: -115, cz: 0, targetH: 168, label: '正 99%', cFront: '#289e92', cSide: '#1c736a', cTop: '#3dd6c6'},
    {stage: 1, cx: 0, cz: 0, targetH: 8, label: '反 1%', cFront: '#4e73cc', cSide: '#365296', cTop: '#7aa2ff'},
    {stage: 1, cx: 125, cz: 0, targetH: 18, label: 'H ≈ 0.081', cFront: '#cc8c3b', cSide: '#996626', cTop: '#ffb454'},
  ];

  private readonly stageCenters = [
    {x: -440, y: 80},
    {x: 440, y: 80},
  ];

  public constructor(props: EntropyCoinBoardProps = {}) {
    super({...props});

    // 顶部精简公式栏
    this.add(
      <Rect
        ref={this.formulaHeader}
        width={1360}
        height={108}
        y={-325}
        fill={CARD}
        stroke={ACCENT}
        lineWidth={2.5}
        radius={16}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'信息熵（加权平均信息量）'}
          fontFamily={FONT}
          fontSize={28}
          fontWeight={700}
          fill={ACCENT}
          x={-350}
        />
        <Latex
          tex={['H(X) = -\\sum_{i=1}^{n} p_{i}\\log_{2} p_{i}']}
          fontSize={46}
          fill={PAPER}
          x={240}
        />
      </Rect>,
    );

    // 中线
    this.add(
      <Line
        ref={this.divider}
        points={[
          [0, -230],
          [0, 340],
        ]}
        stroke={DIVIDER}
        lineWidth={2}
        lineDash={[12, 10]}
        end={0}
        opacity={0}
      />,
    );

    // 左右两枚 3D 硬币抛掷区 + 抽样序列
    const coinConfigs = [
      {
        cx: -440,
        title: '第一枚：均匀硬币 (50% / 50%)',
        color: ACCENT,
        outcomes: ['正', '反', '正', '反', '反', '正'],
        sampleRef: this.leftSamples,
      },
      {
        cx: 440,
        title: '第二枚：偏置硬币 (99% / 1%)',
        color: GOLD,
        outcomes: ['正', '正', '正', '正', '正', '正'],
        sampleRef: this.rightSamples,
      },
    ];

    coinConfigs.forEach(cfg => {
      this.add(
        <Txt
          text={cfg.title}
          fontFamily={FONT}
          fontSize={28}
          fontWeight={700}
          fill={cfg.color}
          x={cfg.cx}
          y={-225}
        />,
      );

      // 硬币阴影
      this.add(
        <Circle
          ref={this.coinShadows}
          x={cfg.cx - 210}
          y={-95}
          width={76}
          height={22}
          fill={'rgba(0,0,0,0.45)'}
          opacity={0}
        />,
      );

      // 3D 翻转硬币本体
      this.add(
        <Node ref={this.coinNodes} x={cfg.cx - 210} y={-140} opacity={0}>
          <Img ref={this.coinImgs} src={iconHeads} width={86} height={86} />
        </Node>,
      );

      // 6 个实时抽样落点徽章
      cfg.outcomes.forEach((out, idx) => {
        const isHead = out === '正';
        this.add(
          <Rect
            ref={cfg.sampleRef}
            width={52}
            height={52}
            x={cfg.cx - 95 + idx * 62}
            y={-140}
            radius={26}
            fill={DEEP}
            stroke={isHead ? ACCENT : BLUE}
            lineWidth={2.5}
            opacity={0}
            scale={0.4}
          >
            <Txt
              text={out}
              fontFamily={FONT}
              fontSize={24}
              fontWeight={700}
              fill={isHead ? ACCENT : BLUE}
            />
          </Rect>,
        );
      });
    });

    // 3D 底座网格线（左右各 1 个 3D 舞台）
    for (let s = 0; s < 2; s++) {
      for (let g = 0; g < 4; g++) {
        this.add(
          <Line
            ref={this.stageGrids}
            points={[
              [0, 0],
              [0, 0],
            ]}
            stroke={LINE}
            lineWidth={1.5}
            opacity={0}
          />,
        );
      }
    }

    // 6 根 3D 立体柱（每根柱：正面、侧面、顶面 + 顶部数值标签）
    this.barDefs.forEach(def => {
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
          fill={def.cFront}
          stroke={def.cTop}
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
          fill={def.cSide}
          stroke={def.cTop}
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
          fill={def.cTop}
          stroke={PAPER}
          lineWidth={1.5}
          opacity={0}
        />,
      );
      this.add(
        <Txt
          ref={this.barValueLabels}
          text={def.label}
          fontFamily={FONT}
          fontSize={22}
          fontWeight={700}
          fill={def.cTop}
          opacity={0}
        />,
      );
    });

    // 左右推导式
    this.add(
      <FormulaDerive
        ref={this.leftDerive}
        lines={[
          'H(X) = -0.5\\log_{2} 0.5 - 0.5\\log_{2} 0.5',
          '= 1\\ \\text{bit}',
        ]}
        fontSize={34}
        rowGap={22}
        x={-440}
        y={235}
      />,
    );

    this.add(
      <FormulaDerive
        ref={this.rightDerive}
        lines={[
          'H(X) = -0.99\\log_{2} 0.99 - 0.01\\log_{2} 0.01',
          '\\approx 0.081\\ \\text{bit}',
        ]}
        fontSize={34}
        rowGap={22}
        x={440}
        y={235}
      />,
    );

    // 底部精简核心定义
    this.add(
      <Rect
        ref={this.essenceTag}
        width={1080}
        height={66}
        y={410}
        fill={CARD}
        stroke={ACCENT}
        lineWidth={2}
        radius={33}
        opacity={0}
        scale={0.92}
      >
        <Txt
          text={'信息熵 = 随机变量信息量的期望值（衡量整体不确定性）'}
          fontFamily={FONT}
          fontSize={28}
          fontWeight={700}
          fill={ACCENT}
        />
      </Rect>,
    );

    this.add(<FocusWord ref={this.focusWord} text={'信息熵'} />);
    this.sync3DBars();
  }

  private sync3DBars() {
    const cam: Camera3D = {
      yaw: this.camYaw,
      pitch: this.camPitch,
      distance: 900,
      fov: 900,
    };

    // 更新底座框线
    for (let s = 0; s < 2; s++) {
      const center = this.stageCenters[s];
      const corners = [
        project3D({x: -190, y: 0, z: -70}, cam, center).pos,
        project3D({x: 195, y: 0, z: -70}, cam, center).pos,
        project3D({x: 195, y: 0, z: 70}, cam, center).pos,
        project3D({x: -190, y: 0, z: 70}, cam, center).pos,
      ];
      for (let e = 0; e < 4; e++) {
        this.stageGrids[s * 4 + e].points([corners[e], corners[(e + 1) % 4]]);
      }
    }

    // 更新 6 根 3D 柱体面片
    this.barDefs.forEach((def, i) => {
      const center = this.stageCenters[def.stage];
      const faces = build3DBarFaces(
        def.cx,
        def.cz,
        56,
        56,
        this.barHeights[i],
        cam,
        center,
      );
      this.barFronts[i].points(faces.front);
      this.barSides[i].points(faces.side);
      this.barTops[i].points(faces.top);
      this.barValueLabels[i].position([
        faces.topCenter.x,
        faces.topCenter.y - 26,
      ]);
    });
  }

  /** 单枚硬币 3D 抛起旋转动画 */
  private *flipCoin3D(index: number, spins = 3, duration = 0.85): ThreadGenerator {
    const node = this.coinNodes[index];
    const img = this.coinImgs[index];
    const shadow = this.coinShadows[index];
    const baseY = -140;

    yield* tween(duration, v => {
      const arc = Math.sin(v * Math.PI);
      node.y(baseY - arc * 68);
      shadow.scale(1 - arc * 0.45);
      const angle = v * Math.PI * 2 * spins;
      const cosA = Math.cos(angle);
      node.scale.x(cosA);
      img.src(cosA >= 0 ? iconHeads : iconTails);
    });
    node.y(baseY);
    node.scale.x(1);
    img.src(iconHeads);
    shadow.scale(1);
  }

  public *play(): ThreadGenerator {
    // 1) 中线与两枚 3D 硬币入场
    yield* all(
      this.divider().opacity(1, 0.3, easeOutCubic),
      this.divider().end(1, 0.5, easeOutCubic),
      ...this.coinNodes.map(c => c.opacity(1, 0.35, easeOutCubic)),
      ...this.coinShadows.map(s => s.opacity(1, 0.35, easeOutCubic)),
    );

    // 2) 两枚硬币同时做 3D 翻转抛掷，并依次弹出 6 次抽样结果
    yield* all(
      this.flipCoin3D(0, 3, 0.9),
      this.flipCoin3D(1, 3, 0.9),
      ...this.leftSamples.map((chip, i) =>
        delay(
          0.1 + i * 0.11,
          all(
            chip.opacity(1, 0.25, easeOutCubic),
            chip.scale(1, 0.3, easeOutBack),
          ),
        ),
      ),
      ...this.rightSamples.map((chip, i) =>
        delay(
          0.1 + i * 0.11,
          all(
            chip.opacity(1, 0.25, easeOutCubic),
            chip.scale(1, 0.3, easeOutBack),
          ),
        ),
      ),
    );
    yield* waitFor(0.25);

    // 3) 强调词「信息熵」
    yield* this.focusWord().play(0.7);

    // 4) 公式栏与 3D 舞台升起
    yield* all(
      this.formulaHeader().opacity(1, 0.4, easeOutCubic),
      this.formulaHeader().scale(1, 0.45, easeOutBack),
      ...this.stageGrids.map(g => g.opacity(0.65, 0.35)),
      ...this.barFronts.map(f => f.opacity(1, 0.3)),
      ...this.barSides.map(s => s.opacity(1, 0.3)),
      ...this.barTops.map(t => t.opacity(1, 0.3)),
      ...this.barValueLabels.map(l => l.opacity(1, 0.35)),
    );

    // 5) 3D 柱体拔地而起 + 视角缓慢环绕 + 左右推导式同步书写
    yield* all(
      tween(1.4, v => {
        const t = easeOutCubic(v);
        this.camYaw = -0.52 + 0.24 * Math.sin(v * Math.PI);
        for (let i = 0; i < this.barDefs.length; i++) {
          this.barHeights[i] = this.barDefs[i].targetH * t;
        }
        this.sync3DBars();
      }),
      this.leftDerive().run(0.35, 0.38),
      delay(0.35, this.rightDerive().run(0.35, 0.38)),
    );
    yield* waitFor(0.25);

    // 6) 底部一句话总结
    yield* all(
      this.essenceTag().opacity(1, 0.4, easeOutCubic),
      this.essenceTag().scale(1, 0.45, easeOutBack),
    );
    yield* waitFor(1.1);
  }
}
