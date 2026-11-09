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
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import logoBLG from '../../assets/LPL/BLG.png';
import logoTT from '../../assets/LPL/TT.png';
import {FocusWord} from '../emphasis/focus_word';
import {FunctionGraph, GraphPoint} from '../graph/function_graph';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const CARD = '#121820';
const DEEP = '#0e141c';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const GOLD = '#ffb454';
const BLUE = '#7aa2ff';
const RED = '#ff6b6b';

const SCREEN_H = 1080;

export interface LplInfoBoardProps extends NodeProps {}

/**
 * 第一章组件：什么是信息量？（<<<lpl>>>）
 * 第一屏：LPL 胜率拉锯条 + 两种比赛结果的「意外冲击波」与「信息能量柱」动态演示
 * 第二屏：I(x) = -log₂ P(x) 动态曲线扫描仪 + 同步比特能量柱对比（精简文字，强化演示）
 */
export class LplInfoBoard extends Node {
  private readonly pages = createRef<Node>();
  private readonly screen1 = createRef<Node>();
  private readonly screen2 = createRef<Node>();

  // 第一屏
  private readonly matchCard = createRef<Rect>();
  private readonly blgBar = createRef<Rect>();
  private readonly oppBar = createRef<Rect>();
  private readonly outcomeCards = createRefArray<Rect>();
  private readonly infoMeters = createRefArray<Rect>();
  private readonly shockRings = createRefArray<Circle>();
  private readonly focusWord = createRef<FocusWord>();

  // 第二屏
  private readonly formulaCard = createRef<Rect>();
  private readonly infoGraph = createRef<FunctionGraph>();
  private readonly scanDot = createRef<Circle>();
  private readonly scanLineX = createRef<Line>();
  private readonly scanLineY = createRef<Line>();
  private readonly scanReadout = createRef<Rect>();
  private readonly scanProbTxt = createRef<Txt>();
  private readonly scanBitTxt = createRef<Txt>();
  private readonly barCols = createRefArray<Node>();
  private readonly barFills = createRefArray<Rect>();
  private readonly barLabels = createRefArray<Txt>();
  private readonly bottomTag = createRef<Rect>();

  private readonly samples = [
    {label: '必然', p: 1.0, bits: 0.0, text: '0 bit', color: MUTED},
    {label: '抛硬币', p: 0.5, bits: 1.0, text: '1 bit', color: ACCENT},
    {label: '四选一', p: 0.25, bits: 2.0, text: '2 bit', color: BLUE},
    {label: '爆冷输', p: 0.1, bits: 3.32, text: '3.32 bit', color: GOLD},
    {label: '罕见', p: 0.01, bits: 6.64, text: '6.64 bit', color: RED},
  ];

  public constructor(props: LplInfoBoardProps = {}) {
    super({...props});

    this.add(
      <Node ref={this.pages}>
        <Node ref={this.screen1} />
        <Node ref={this.screen2} y={SCREEN_H} />
      </Node>,
    );

    this.buildScreen1();
    this.buildScreen2();
    this.add(<FocusWord ref={this.focusWord} text={'信息量'} />);
  }

  private buildScreen1() {
    // 顶部对战预测面板（纯坐标布局，杜绝重叠）
    this.screen1().add(
      <Rect
        ref={this.matchCard}
        width={1320}
        height={210}
        y={-220}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Txt
          text={'LPL 赛前胜率预测'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={MUTED}
          y={-68}
        />

        {/* 左：BLG */}
        <Img src={logoBLG} width={92} height={92} x={-540} y={10} />
        <Txt
          text={'BLG'}
          fontFamily={FONT}
          fontSize={36}
          fontWeight={700}
          fill={PAPER}
          x={-410}
          y={-12}
        />
        <Txt
          text={'90%'}
          fontFamily={FONT}
          fontSize={40}
          fontWeight={700}
          fill={ACCENT}
          x={-410}
          y={34}
        />

        {/* 中央动态胜率条 */}
        <Rect
          width={560}
          height={32}
          y={8}
          radius={16}
          fill={DEEP}
          stroke={LINE}
          lineWidth={2}
          clip
        >
          <Rect
            ref={this.blgBar}
            width={0}
            height={32}
            x={-280}
            offset={[-1, 0]}
            fill={ACCENT}
          />
          <Rect
            ref={this.oppBar}
            width={0}
            height={32}
            x={280}
            offset={[1, 0]}
            fill={GOLD}
          />
        </Rect>
        <Txt
          text={'VS'}
          fontFamily={FONT}
          fontSize={28}
          fontWeight={700}
          fill={PAPER}
          y={-30}
        />

        {/* 右：弱队对手 */}
        <Img src={logoTT} width={92} height={92} x={540} y={10} />
        <Txt
          text={'对手'}
          fontFamily={FONT}
          fontSize={36}
          fontWeight={700}
          fill={PAPER}
          x={410}
          y={-12}
        />
        <Txt
          text={'10%'}
          fontFamily={FONT}
          fontSize={40}
          fontWeight={700}
          fill={GOLD}
          x={410}
          y={34}
        />
      </Rect>,
    );

    // 下方左右两个结果演示台
    const outcomes = [
      {
        x: -350,
        title: '结果一：BLG 正常获胜',
        prob: 'P = 90%',
        tag: '预料之中 · 信息量少',
        meterW: 52,
        bits: '0.15 bit',
        color: ACCENT,
      },
      {
        x: 350,
        title: '结果二：BLG 爆冷输球',
        prob: 'P = 10%',
        tag: '大出意料 · 信息量极大！',
        meterW: 360,
        bits: '3.32 bit',
        color: GOLD,
      },
    ];

    // 右侧爆冷卡片背后的脉冲波纹环
    for (let k = 0; k < 2; k++) {
      this.screen1().add(
        <Circle
          ref={this.shockRings}
          x={350}
          y={140}
          size={160}
          stroke={RED}
          lineWidth={3}
          opacity={0}
        />,
      );
    }

    outcomes.forEach(item => {
      this.screen1().add(
        <Rect
          ref={this.outcomeCards}
          width={620}
          height={310}
          x={item.x}
          y={140}
          fill={CARD}
          stroke={item.color}
          lineWidth={2.5}
          radius={18}
          opacity={0}
          scale={0.9}
        >
          <Txt
            text={item.title}
            fontFamily={FONT}
            fontSize={34}
            fontWeight={700}
            fill={PAPER}
            x={-265}
            y={-98}
            offset={[-1, 0]}
          />
          <Txt
            text={item.prob}
            fontFamily={FONT}
            fontSize={32}
            fontWeight={700}
            fill={item.color}
            x={265}
            y={-98}
            offset={[1, 0]}
          />

          <Line
            points={[
              [-265, -52],
              [265, -52],
            ]}
            stroke={LINE}
            lineWidth={1.5}
          />

          {/* 信息量能量槽演示 */}
          <Txt
            text={'携带信息量'}
            fontFamily={FONT}
            fontSize={22}
            fill={MUTED}
            x={-265}
            y={-8}
            offset={[-1, 0]}
          />
          <Txt
            text={item.bits}
            fontFamily={FONT}
            fontSize={28}
            fontWeight={700}
            fill={item.color}
            x={265}
            y={-8}
            offset={[1, 0]}
          />
          <Rect
            width={530}
            height={28}
            y={34}
            radius={14}
            fill={DEEP}
            stroke={LINE}
            lineWidth={1.5}
            clip
          >
            <Rect
              ref={this.infoMeters}
              width={0}
              height={28}
              x={-265}
              offset={[-1, 0]}
              fill={item.color}
            />
          </Rect>

          <Txt
            text={item.tag}
            fontFamily={FONT}
            fontSize={26}
            fontWeight={700}
            fill={item.color}
            y={104}
          />
        </Rect>,
      );
    });
  }

  private buildScreen2() {
    // 顶部：精简公式卡片
    this.screen2().add(
      <Rect
        ref={this.formulaCard}
        width={1560}
        height={130}
        y={-300}
        fill={CARD}
        stroke={ACCENT}
        lineWidth={2.5}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        <Latex
          tex={['I(x) = -\\log_{2} P(x)']}
          fontSize={54}
          fill={PAPER}
          x={-440}
        />
        <Line
          points={[
            [-110, -42],
            [-110, 42],
          ]}
          stroke={LINE}
          lineWidth={2}
        />
        <Txt
          text={'P(x)：发生概率'}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={GOLD}
          x={70}
          y={-22}
        />
        <Txt
          text={'I(x)：信息量 (bit)'}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={ACCENT}
          x={70}
          y={22}
        />
        <Rect
          width={360}
          height={64}
          x={520}
          radius={12}
          fill={DEEP}
          stroke={BLUE}
          lineWidth={2}
        >
          <Txt
            text={'概率越低  ⇒  信息量越大'}
            fontFamily={FONT}
            fontSize={26}
            fontWeight={700}
            fill={BLUE}
          />
        </Rect>
      </Rect>,
    );

    // 左下：5 根动态生长的信息量能量柱（替代冗长文字表格）
    const baseLineY = 250;
    const maxBarH = 300;
    this.samples.forEach((s, idx) => {
      const cx = -680 + idx * 155;
      this.screen2().add(
        <Node ref={this.barCols} x={cx} opacity={0}>
          {/* 柱槽背景 */}
          <Rect
            width={86}
            height={maxBarH}
            y={baseLineY - maxBarH / 2}
            radius={10}
            fill={DEEP}
            stroke={LINE}
            lineWidth={1.5}
          />
          {/* 动态填充柱 */}
          <Rect
            ref={this.barFills}
            width={86}
            height={0}
            y={baseLineY}
            offset={[0, 1]}
            radius={10}
            fill={s.color}
          />
          {/* 柱顶比特数 */}
          <Txt
            ref={this.barLabels}
            text={s.text}
            fontFamily={FONT}
            fontSize={22}
            fontWeight={700}
            fill={s.color}
            y={baseLineY - (s.bits / 7) * maxBarH - 24}
            opacity={0}
          />
          {/* 底部概率与场景名 */}
          <Txt
            text={`${Math.round(s.p * 100)}%`}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={PAPER}
            y={baseLineY + 30}
          />
          <Txt
            text={s.label}
            fontFamily={FONT}
            fontSize={20}
            fill={MUTED}
            y={baseLineY + 62}
          />
        </Node>,
      );
    });

    // 右下：I(P) = -log2(P) 函数图像 + 动态扫描游标
    const curvePts: GraphPoint[] = [];
    for (let i = 1; i <= 100; i++) {
      const p = i / 100;
      curvePts.push({x: p, y: -Math.log2(p)});
    }
    const samplePts: GraphPoint[] = this.samples.map(s => ({
      x: s.p,
      y: -Math.log2(s.p),
    }));

    const graphX = 410;
    const graphY = 75;
    this.screen2().add(
      <FunctionGraph
        ref={this.infoGraph}
        x={graphX}
        y={graphY}
        plotWidth={660}
        plotHeight={350}
        xMin={0}
        xMax={1}
        yMin={0}
        yMax={7}
        xLabel={'P'}
        yLabel={'I'}
        xTicks={5}
        yTicks={5}
      />,
    );

    this.infoGraph().addSeries('curve', curvePts, {
      color: ACCENT,
      lineWidth: 4,
    });
    this.infoGraph().addSeries('samples', samplePts, {
      color: GOLD,
      lineWidth: 0,
      showDots: true,
      dotRadius: 7,
    });

    // 曲线动态扫描探针与准星虚线
    this.screen2().add(
      <Line
        ref={this.scanLineX}
        points={[
          [0, 0],
          [0, 0],
        ]}
        stroke={GOLD}
        lineWidth={2}
        lineDash={[6, 6]}
        opacity={0}
      />,
    );
    this.screen2().add(
      <Line
        ref={this.scanLineY}
        points={[
          [0, 0],
          [0, 0],
        ]}
        stroke={GOLD}
        lineWidth={2}
        lineDash={[6, 6]}
        opacity={0}
      />,
    );
    this.screen2().add(
      <Circle
        ref={this.scanDot}
        size={22}
        fill={GOLD}
        stroke={PAPER}
        lineWidth={3}
        opacity={0}
      />,
    );

    // 扫描读数浮窗
    this.screen2().add(
      <Rect
        ref={this.scanReadout}
        width={260}
        height={84}
        x={graphX + 160}
        y={graphY - 115}
        radius={12}
        fill={CARD}
        stroke={GOLD}
        lineWidth={2}
        opacity={0}
      >
        <Txt
          ref={this.scanProbTxt}
          text={'P = 100%'}
          fontFamily={FONT}
          fontSize={22}
          fill={MUTED}
          y={-16}
        />
        <Txt
          ref={this.scanBitTxt}
          text={'I = 0.00 bit'}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={GOLD}
          y={18}
        />
      </Rect>,
    );

    // 底部一句话核心标签
    this.screen2().add(
      <Rect
        ref={this.bottomTag}
        width={960}
        height={66}
        y={415}
        fill={CARD}
        stroke={ACCENT}
        lineWidth={2}
        radius={33}
        opacity={0}
        scale={0.92}
      >
        <Txt
          text={'信息量 = 事件发生后消除的不确定性'}
          fontFamily={FONT}
          fontSize={28}
          fontWeight={700}
          fill={ACCENT}
        />
      </Rect>,
    );
  }

  /** 将 (p, I) 转换到 screen2 坐标 */
  private mapGraphPoint(p: number, bits: number): {x: number; y: number; ox: number; oy: number} {
    const gx = 410;
    const gy = 75;
    const ox = gx + this.infoGraph().mapX(0);
    const oy = gy + this.infoGraph().mapY(0);
    return {
      x: gx + this.infoGraph().mapX(p),
      y: gy + this.infoGraph().mapY(bits),
      ox,
      oy,
    };
  }

  private updateScanner(p: number) {
    const clampedP = Math.max(0.01, Math.min(1, p));
    const bits = -Math.log2(clampedP);
    const pt = this.mapGraphPoint(clampedP, bits);
    this.scanDot().position([pt.x, pt.y]);
    this.scanLineX().points([
      [pt.x, pt.oy],
      [pt.x, pt.y],
    ]);
    this.scanLineY().points([
      [pt.ox, pt.y],
      [pt.x, pt.y],
    ]);
    this.scanProbTxt().text(`P(x) = ${(clampedP * 100).toFixed(0)}%`);
    this.scanBitTxt().text(`I(x) = ${bits.toFixed(2)} bit`);
  }

  public *play(): ThreadGenerator {
    // ── 第一屏：LPL 胜率拉锯 + 爆冷冲击波演示 ──
    yield* all(
      this.matchCard().opacity(1, 0.4, easeOutCubic),
      this.matchCard().scale(1, 0.45, easeOutBack),
    );
    yield* all(
      this.blgBar().width(560 * 0.9, 0.65, easeInOutCubic),
      this.oppBar().width(560 * 0.1, 0.65, easeInOutCubic),
    );
    yield* waitFor(0.2);

    // 结果一：正常赢球（小幅能量）
    yield* all(
      this.outcomeCards[0].opacity(1, 0.38, easeOutCubic),
      this.outcomeCards[0].scale(1, 0.42, easeOutBack),
      this.infoMeters[0].width(52, 0.5, easeOutCubic),
    );
    yield* waitFor(0.2);

    // 结果二：爆冷输球（能量槽暴涨 + 冲击波环扩散）
    yield* all(
      this.outcomeCards[1].opacity(1, 0.38, easeOutCubic),
      this.outcomeCards[1].scale(1, 0.42, easeOutBack),
      this.infoMeters[1].width(470, 0.65, easeOutCubic),
    );

    // 爆冷脉冲冲击波
    yield* all(
      this.outcomeCards[0].opacity(0.45, 0.35, easeOutCubic),
      this.outcomeCards[1].scale(1.05, 0.35, easeOutBack),
      this.outcomeCards[1].stroke(RED, 0.3, easeOutCubic),
      ...this.shockRings.map((ring, i) =>
        all(
          ring.opacity(0.85, 0.1).to(0, 0.65, easeOutCubic),
          ring.size(180 + i * 60, 0).to(680 + i * 90, 0.75, easeOutCubic),
        ),
      ),
    );
    yield* waitFor(0.4);

    // 强调「信息量」
    yield* this.focusWord().play(0.75);

    // ── 第二屏：公式 + 动态曲线扫描与柱状能量联动 ──
    yield* this.pages().y(-SCREEN_H, 0.8, easeInOutCubic);
    yield* waitFor(0.12);

    yield* all(
      this.formulaCard().opacity(1, 0.4, easeOutCubic),
      this.formulaCard().scale(1, 0.45, easeOutBack),
      this.infoGraph().showAxes(0.45),
      ...this.barCols.map(c => c.opacity(1, 0.4, easeOutCubic)),
    );
    yield* this.infoGraph().drawSeries('curve', 0.8);

    // 启动扫描探针：从 P=1.0 连续滑向 P=0.01，逐个点亮左侧信息量柱
    this.updateScanner(1.0);
    yield* all(
      this.scanDot().opacity(1, 0.25),
      this.scanLineX().opacity(0.75, 0.25),
      this.scanLineY().opacity(0.75, 0.25),
      this.scanReadout().opacity(1, 0.25),
    );

    const maxBarH = 300;
    for (let i = 0; i < this.samples.length; i++) {
      const prevP = i === 0 ? 1.0 : this.samples[i - 1].p;
      const targetP = this.samples[i].p;
      const targetH = Math.max(6, (this.samples[i].bits / 7) * maxBarH);

      if (i > 0) {
        yield* tween(0.42, v => {
          const t = easeInOutCubic(v);
          this.updateScanner(prevP + (targetP - prevP) * t);
        });
      }
      yield* all(
        this.infoGraph().showDot('samples', i, 0.22),
        this.barFills[i].height(targetH, 0.35, easeOutBack),
        this.barLabels[i].opacity(1, 0.25, easeOutCubic),
      );
      yield* waitFor(0.15);
    }

    yield* all(
      this.bottomTag().opacity(1, 0.4, easeOutCubic),
      this.bottomTag().scale(1, 0.45, easeOutBack),
    );
    yield* waitFor(1.1);
  }
}
