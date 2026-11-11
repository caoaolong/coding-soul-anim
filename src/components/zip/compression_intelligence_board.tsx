import {
  Circle,
  Img,
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
  easeOutQuad,
  waitFor,
} from '@motion-canvas/core';
import compressIcon from '../../assets/icons/压缩.svg';
import aiIcon from '../../assets/icons/ChatGPT.svg';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const CARD = '#121820';
const DEEP = '#0e141c';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const GOLD = '#ffb454';
const BLUE = '#7aa2ff';
const ROSE = '#fb7185';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

export interface CompressionIntelligenceBoardProps extends NodeProps {}

/**
 * 压缩即智能（口播终章组件）：
 * 1) 视角升维：语言识别（压缩 ≈ 分类 / 特征相似度） ↔ 作者识别（压缩 ≈ 智能 / 深层规律）
 * 2) 本质与人类学习：对世界高度抽象与压缩 → 接收信息 → 寻找规律 → 理解
 * 3) 哲学转折：表面「减少数据」 → 深层「寻找规律」 → 诞生智能
 * 4) 终极猜想：「压缩 ＝ 智能」核心等式定格
 */
export class CompressionIntelligenceBoard extends Node {
  // ── Act 1: 双视角对比 ──
  private readonly act1Group = createRef<Node>();
  private readonly centerHub = createRef<Rect>();
  private readonly leftWing = createRef<Rect>();
  private readonly rightWing = createRef<Rect>();
  private readonly leftBridge = createRef<Line>();
  private readonly rightBridge = createRef<Line>();
  private readonly leftSubTag = createRef<Rect>();
  private readonly rightSubTag = createRef<Rect>();

  // ── Act 2: 抽象能力 + 人类学习三步 ──
  private readonly act2Group = createRef<Node>();
  private readonly essenceBanner = createRef<Rect>();
  private readonly stepCards = createRefArray<Rect>();
  private readonly stepArrows = createRefArray<Line>();
  private readonly stepGlows = createRefArray<Rect>();

  // ── Act 3: 认知反转（减少数据 -> 寻找规律 -> 诞生智能）──
  private readonly act3Group = createRef<Node>();
  private readonly mythCard = createRef<Rect>();
  private readonly strikeLine = createRef<Line>();
  private readonly truthCard = createRef<Rect>();
  private readonly birthLine = createRef<Line>();
  private readonly mindNode = createRef<Rect>();
  private readonly patternRings = createRefArray<Circle>();

  // ── Act 4: 大胆猜想「压缩即智能」──
  private readonly act4Group = createRef<Node>();
  private readonly guessHint = createRef<Txt>();
  private readonly eqLeftCard = createRef<Rect>();
  private readonly eqRightCard = createRef<Rect>();
  private readonly eqSign = createRef<Txt>();
  private readonly eqHalo = createRef<Circle>();
  private readonly thesisBanner = createRef<Rect>();

  public constructor(props: CompressionIntelligenceBoardProps = {}) {
    super({...props});

    // ══════════════════════════════════════════════════
    // Act 1: 语言识别（分类） vs 作者识别（智能）
    // ══════════════════════════════════════════════════
    this.add(
      <Node ref={this.act1Group} y={-20}>
        {/* 左右连接线 */}
        <Line
          ref={this.leftBridge}
          points={[
            [-110, -40],
            [-260, -40],
          ]}
          stroke={ACCENT}
          lineWidth={3}
          lineCap={'round'}
          endArrow
          arrowSize={12}
          end={0}
          opacity={0}
        />
        <Line
          ref={this.rightBridge}
          points={[
            [110, -40],
            [260, -40],
          ]}
          stroke={GOLD}
          lineWidth={3}
          lineCap={'round'}
          endArrow
          arrowSize={12}
          end={0}
          opacity={0}
        />

        {/* 中央压缩核心 */}
        <Rect
          ref={this.centerHub}
          width={210}
          height={210}
          y={-40}
          radius={28}
          fill={DEEP}
          stroke={ACCENT}
          lineWidth={3}
          opacity={0}
          scale={0.75}
          shadowColor={'#3dd6c655'}
          shadowBlur={28}
        >
          <Img src={compressIcon} width={86} height={86} y={-24} />
          <Txt
            text={'无损压缩'}
            fontFamily={FONT}
            fontSize={28}
            fontWeight={700}
            fill={PAPER}
            y={52}
          />
        </Rect>

        {/* 左翼：语言识别 → 分类 */}
        <Rect
          ref={this.leftWing}
          width={470}
          height={230}
          x={-510}
          y={-40}
          radius={20}
          fill={CARD}
          stroke={ACCENT}
          lineWidth={2.5}
          opacity={0}
          scale={0.88}
          shadowColor={'#3dd6c633'}
          shadowBlur={0}
        >
          <Txt
            text={'SCENE 01 · 语言识别'}
            fontFamily={MONO}
            fontSize={20}
            fontWeight={700}
            fill={ACCENT}
            y={-72}
            letterSpacing={2}
          />
          <Txt
            text={'压缩 ≈ 一种分类'}
            fontFamily={FONT}
            fontSize={38}
            fontWeight={700}
            fill={PAPER}
            y={-14}
          />
          <Line
            points={[
              [-190, 26],
              [190, 26],
            ]}
            stroke={LINE}
            lineWidth={1.5}
          />
          <Txt
            text={'计算不同特征文本之间的相似度'}
            fontFamily={FONT}
            fontSize={22}
            fill={MUTED}
            y={64}
          />
        </Rect>

        {/* 左翼底部特征浮标 */}
        <Rect
          ref={this.leftSubTag}
          width={420}
          height={56}
          x={-510}
          y={122}
          radius={14}
          fill={DEEP}
          stroke={LINE}
          lineWidth={1.5}
          opacity={0}
          scale={0.9}
        >
          <Txt
            text={'Δ(A + x)  →  聚类语言演化树'}
            fontFamily={MONO}
            fontSize={20}
            fontWeight={600}
            fill={ACCENT}
          />
        </Rect>

        {/* 右翼：作者识别 → 智能 */}
        <Rect
          ref={this.rightWing}
          width={470}
          height={230}
          x={510}
          y={-40}
          radius={20}
          fill={CARD}
          stroke={GOLD}
          lineWidth={2.5}
          opacity={0}
          scale={0.88}
          shadowColor={'#ffb45433'}
          shadowBlur={0}
        >
          <Txt
            text={'SCENE 02 · 作者识别'}
            fontFamily={MONO}
            fontSize={20}
            fontWeight={700}
            fill={GOLD}
            y={-72}
            letterSpacing={2}
          />
          <Txt
            text={'压缩 ≈ 一种智能'}
            fontFamily={FONT}
            fontSize={38}
            fontWeight={700}
            fill={PAPER}
            y={-14}
          />
          <Line
            points={[
              [-190, 26],
              [190, 26],
            ]}
            stroke={LINE}
            lineWidth={1.5}
          />
          <Txt
            text={'捕捉文本之外更加深层的规律'}
            fontFamily={FONT}
            fontSize={22}
            fill={MUTED}
            y={64}
          />
        </Rect>

        {/* 右翼底部特征浮标 */}
        <Rect
          ref={this.rightSubTag}
          width={420}
          height={56}
          x={510}
          y={122}
          radius={14}
          fill={DEEP}
          stroke={LINE}
          lineWidth={1.5}
          opacity={0}
          scale={0.9}
        >
          <Txt
            text={'文风 · 句法习惯 · 隐含思维指纹'}
            fontFamily={FONT}
            fontSize={20}
            fontWeight={600}
            fill={GOLD}
          />
        </Rect>
      </Node>,
    );

    // ══════════════════════════════════════════════════
    // Act 2: 对世界高度抽象 + 人类学习三步曲
    // ══════════════════════════════════════════════════
    const steps = [
      {
        idx: '01',
        title: '接收信息',
        sub: '感知原始现象与海量输入',
        tag: 'INPUT · 原始数据',
        color: BLUE,
        x: -480,
      },
      {
        idx: '02',
        title: '寻找规律',
        sub: '提炼共性结构，消除冗余',
        tag: 'COMPRESS · 高度抽象',
        color: ACCENT,
        x: 0,
      },
      {
        idx: '03',
        title: '最后理解',
        sub: '内化为可迁移的认知模型',
        tag: 'INTELLIGENCE · 规律涌现',
        color: GOLD,
        x: 480,
      },
    ];

    this.add(
      <Node ref={this.act2Group} y={10}>
        {/* 上方总括横幅：智能 = 对世界进行高度抽象和压缩的能力 */}
        <Rect
          ref={this.essenceBanner}
          width={1160}
          height={128}
          y={-175}
          radius={20}
          fill={CARD}
          stroke={ACCENT}
          lineWidth={2.5}
          opacity={0}
          scale={0.92}
          shadowColor={'#3dd6c633'}
          shadowBlur={24}
        >
          <Txt
            text={'智能的本质'}
            fontFamily={MONO}
            fontSize={20}
            fontWeight={700}
            fill={ACCENT}
            y={-32}
            letterSpacing={4}
          />
          <Txt
            text={'对世界进行高度抽象与压缩的能力'}
            fontFamily={FONT}
            fontSize={38}
            fontWeight={700}
            fill={PAPER}
            y={18}
            letterSpacing={2}
          />
        </Rect>

        {/* 三步之间的演进箭头 */}
        {[-240, 240].map(ax => (
          <Line
            ref={this.stepArrows}
            points={[
              [ax - 58, 95],
              [ax + 58, 95],
            ]}
            stroke={ACCENT}
            lineWidth={3}
            lineCap={'round'}
            endArrow
            arrowSize={13}
            end={0}
            opacity={0}
          />
        ))}

        {/* 人类学习三步卡片 */}
        {steps.map(st => (
          <Node x={st.x} y={95}>
            <Rect
              ref={this.stepGlows}
              width={368}
              height={238}
              radius={22}
              fill={`${st.color}12`}
              stroke={st.color}
              lineWidth={2}
              opacity={0}
              scale={0.95}
            />
            <Rect
              ref={this.stepCards}
              width={350}
              height={220}
              radius={18}
              fill={CARD}
              stroke={st.color}
              lineWidth={2.5}
              opacity={0}
              scale={0.86}
            >
              <Txt
                text={`STEP ${st.idx}`}
                fontFamily={MONO}
                fontSize={19}
                fontWeight={700}
                fill={st.color}
                y={-68}
                letterSpacing={3}
              />
              <Txt
                text={st.title}
                fontFamily={FONT}
                fontSize={38}
                fontWeight={700}
                fill={PAPER}
                y={-14}
              />
              <Txt
                text={st.sub}
                fontFamily={FONT}
                fontSize={20}
                fill={MUTED}
                y={34}
              />
              <Rect
                width={260}
                height={34}
                y={78}
                radius={8}
                fill={DEEP}
                stroke={LINE}
                lineWidth={1}
              >
                <Txt
                  text={st.tag}
                  fontFamily={MONO}
                  fontSize={15}
                  fontWeight={600}
                  fill={st.color}
                />
              </Rect>
            </Rect>
          </Node>
        ))}
      </Node>,
    );

    // ══════════════════════════════════════════════════
    // Act 3: 认知反转：减少数据(表象) → 寻找规律(深层) → 诞生智能
    // ══════════════════════════════════════════════════
    this.add(
      <Node ref={this.act3Group} y={10}>
        {/* 背景同心规律波纹 */}
        {[280, 420, 560].map(d => (
          <Circle
            ref={this.patternRings}
            width={d}
            height={d}
            x={330}
            y={20}
            stroke={'#3dd6c628'}
            lineWidth={1.5}
            lineDash={[8, 8]}
            opacity={0}
            scale={0.7}
          />
        ))}

        {/* 表象卡片：压缩 = 减少数据 */}
        <Rect
          ref={this.mythCard}
          width={480}
          height={210}
          x={0}
          y={-60}
          radius={20}
          fill={CARD}
          stroke={ROSE}
          lineWidth={2.5}
          opacity={0}
          scale={0.88}
        >
          <Txt
            text={'表面认知 · SURFACE'}
            fontFamily={MONO}
            fontSize={19}
            fontWeight={700}
            fill={ROSE}
            y={-58}
            letterSpacing={2}
          />
          <Txt
            text={'压缩 ＝ 减少数据体积'}
            fontFamily={FONT}
            fontSize={38}
            fontWeight={700}
            fill={PAPER}
            y={4}
          />
          <Txt
            text={'删减冗余比特 · 节省存储空间'}
            fontFamily={FONT}
            fontSize={20}
            fill={MUTED}
            y={56}
          />
          {/* 删除斜线 */}
          <Line
            ref={this.strikeLine}
            points={[
              [-190, 4],
              [190, 4],
            ]}
            stroke={ROSE}
            lineWidth={4}
            lineCap={'round'}
            end={0}
            opacity={0}
          />
        </Rect>

        {/* 深层卡片：压缩 = 寻找规律 */}
        <Rect
          ref={this.truthCard}
          width={520}
          height={210}
          x={330}
          y={-85}
          radius={20}
          fill={CARD}
          stroke={ACCENT}
          lineWidth={3}
          opacity={0}
          scale={0.88}
          shadowColor={'#3dd6c655'}
          shadowBlur={28}
        >
          <Txt
            text={'更深层面 · DEEPER TRUTH'}
            fontFamily={MONO}
            fontSize={19}
            fontWeight={700}
            fill={ACCENT}
            y={-58}
            letterSpacing={2}
          />
          <Txt
            text={'压缩 ＝ 寻找深层规律'}
            fontFamily={FONT}
            fontSize={40}
            fontWeight={700}
            fill={PAPER}
            y={4}
          />
          <Txt
            text={'唯有洞察规律，才能实现极致压缩'}
            fontFamily={FONT}
            fontSize={21}
            fill={ACCENT}
            y={56}
          />
        </Rect>

        {/* 规律 → 智能 涌现连线 */}
        <Line
          ref={this.birthLine}
          points={[
            [330, 25],
            [330, 115],
          ]}
          stroke={GOLD}
          lineWidth={3}
          lineCap={'round'}
          endArrow
          arrowSize={13}
          end={0}
          opacity={0}
        />

        {/* 诞生智能节点 */}
        <Rect
          ref={this.mindNode}
          width={520}
          height={120}
          x={330}
          y={185}
          radius={18}
          fill={DEEP}
          stroke={GOLD}
          lineWidth={3}
          opacity={0}
          scale={0.86}
          shadowColor={'#ffb45455'}
          shadowBlur={28}
        >
          <Img src={aiIcon} width={54} height={54} x={-195} />
          <Txt
            text={'智能，正从这些规律中诞生'}
            fontFamily={FONT}
            fontSize={32}
            fontWeight={700}
            fill={GOLD}
            x={24}
          />
        </Rect>
      </Node>,
    );

    // ══════════════════════════════════════════════════
    // Act 4: 终极命题 —— 压缩即智能
    // ══════════════════════════════════════════════════
    this.add(
      <Node ref={this.act4Group} y={0}>
        <Circle
          ref={this.eqHalo}
          width={520}
          height={520}
          y={-10}
          fill={'#3dd6c60c'}
          stroke={'#3dd6c644'}
          lineWidth={2}
          lineDash={[12, 10]}
          opacity={0}
          scale={0.6}
        />

        <Txt
          ref={this.guessHint}
          text={'BOLD CONJECTURE · 如果猜想更大胆一些'}
          fontFamily={MONO}
          fontSize={22}
          fontWeight={700}
          fill={MUTED}
          y={-215}
          letterSpacing={4}
          opacity={0}
        />

        {/* 左：压缩 */}
        <Rect
          ref={this.eqLeftCard}
          width={360}
          height={210}
          x={-330}
          y={-20}
          radius={24}
          fill={CARD}
          stroke={ACCENT}
          lineWidth={3.5}
          opacity={0}
          scale={0.82}
          shadowColor={'#3dd6c666'}
          shadowBlur={32}
        >
          <Img src={compressIcon} width={68} height={68} y={-36} />
          <Txt
            text={'压  缩'}
            fontFamily={FONT}
            fontSize={48}
            fontWeight={700}
            fill={ACCENT}
            y={42}
          />
          <Txt
            text={'COMPRESSION'}
            fontFamily={MONO}
            fontSize={16}
            fontWeight={700}
            fill={MUTED}
            y={82}
            letterSpacing={3}
          />
        </Rect>

        {/* 中央恒等号 */}
        <Txt
          ref={this.eqSign}
          text={'＝'}
          fontFamily={MONO}
          fontSize={96}
          fontWeight={700}
          fill={PAPER}
          y={-20}
          opacity={0}
          scale={0.4}
          shadowColor={ACCENT}
          shadowBlur={24}
        />

        {/* 右：智能 */}
        <Rect
          ref={this.eqRightCard}
          width={360}
          height={210}
          x={330}
          y={-20}
          radius={24}
          fill={CARD}
          stroke={GOLD}
          lineWidth={3.5}
          opacity={0}
          scale={0.82}
          shadowColor={'#ffb45466'}
          shadowBlur={32}
        >
          <Img src={aiIcon} width={68} height={68} y={-36} />
          <Txt
            text={'智  能'}
            fontFamily={FONT}
            fontSize={48}
            fontWeight={700}
            fill={GOLD}
            y={42}
          />
          <Txt
            text={'INTELLIGENCE'}
            fontFamily={MONO}
            fontSize={16}
            fontWeight={700}
            fill={MUTED}
            y={82}
            letterSpacing={3}
          />
        </Rect>

        {/* 底部金句铭牌 */}
        <Rect
          ref={this.thesisBanner}
          width={760}
          height={88}
          y={195}
          radius={18}
          fill={DEEP}
          stroke={ACCENT}
          lineWidth={2.5}
          opacity={0}
          scale={0.9}
          shadowColor={'#3dd6c644'}
          shadowBlur={24}
        >
          <Txt
            text={'压 缩 即 智 能'}
            fontFamily={FONT}
            fontSize={44}
            fontWeight={700}
            fill={PAPER}
            letterSpacing={14}
          />
        </Rect>
      </Node>,
    );
  }

  public *play(): ThreadGenerator {
    // ═══ Act 1: 语言识别（分类） vs 作者识别（智能） ═══
    // 「从语言识别的场景上讲，压缩好像是一种分类；可以把不同特征的文本之间的相似度计算出来」
    yield* all(
      this.centerHub().opacity(1, 0.45, easeOutCubic),
      this.centerHub().scale(1, 0.55, easeOutBack),
    );
    yield* all(
      this.leftBridge().opacity(1, 0.25, easeOutCubic),
      this.leftBridge().end(1, 0.45, easeInOutCubic),
      this.leftWing().opacity(1, 0.45, easeOutCubic),
      this.leftWing().scale(1, 0.55, easeOutBack),
      this.leftWing().shadowBlur(24, 0.55, easeOutQuad),
    );
    yield* all(
      this.leftSubTag().opacity(1, 0.35, easeOutCubic),
      this.leftSubTag().scale(1, 0.4, easeOutBack),
    );
    yield* waitFor(0.75);

    // 「从作者识别的场景上讲，它好像又是一种智能；可以捕捉到文本之外更加深层的规律」
    yield* all(
      this.rightBridge().opacity(1, 0.25, easeOutCubic),
      this.rightBridge().end(1, 0.45, easeInOutCubic),
      this.rightWing().opacity(1, 0.45, easeOutCubic),
      this.rightWing().scale(1, 0.55, easeOutBack),
      this.rightWing().shadowBlur(24, 0.55, easeOutQuad),
    );
    yield* all(
      this.rightSubTag().opacity(1, 0.35, easeOutCubic),
      this.rightSubTag().scale(1, 0.4, easeOutBack),
    );
    yield* waitFor(1.0);

    // Act 1 退场
    yield* all(
      this.act1Group().opacity(0, 0.5, easeInOutCubic),
      this.act1Group().y(-60, 0.5, easeInOutCubic),
      this.act1Group().scale(0.92, 0.5, easeInOutCubic),
    );

    // ═══ Act 2: 对世界高度抽象 + 人类学习三步曲 ═══
    // 「那么智能，或许就是一种对世界进行高度抽象和压缩的能力」
    yield* all(
      this.essenceBanner().opacity(1, 0.5, easeOutCubic),
      this.essenceBanner().scale(1, 0.55, easeOutBack),
    );
    yield* waitFor(0.6);

    // 「这其实也是人类学习的过程：先接收信息，再寻找规律，最后理解。」
    for (let i = 0; i < 3; i++) {
      const anims: ThreadGenerator[] = [
        this.stepCards[i].opacity(1, 0.42, easeOutCubic),
        this.stepCards[i].scale(1, 0.48, easeOutBack),
        this.stepGlows[i].opacity(0.85, 0.45, easeOutCubic),
        this.stepGlows[i].scale(1, 0.48, easeOutCubic),
      ];
      if (i > 0) {
        anims.push(
          this.stepArrows[i - 1].opacity(1, 0.25, easeOutCubic),
          this.stepArrows[i - 1].end(1, 0.42, easeInOutCubic),
        );
      }
      yield* all(...anims);
      yield* waitFor(0.45);
    }
    yield* waitFor(0.9);

    // Act 2 退场
    yield* all(
      this.act2Group().opacity(0, 0.5, easeInOutCubic),
      this.act2Group().y(-40, 0.5, easeInOutCubic),
      this.act2Group().scale(0.92, 0.5, easeInOutCubic),
    );

    // ═══ Act 3: 认知反转（减少数据 → 寻找规律 → 诞生智能）═══
    // 「我们一直以为，压缩是在减少数据」
    yield* all(
      this.mythCard().opacity(1, 0.45, easeOutCubic),
      this.mythCard().scale(1, 0.5, easeOutBack),
    );
    yield* waitFor(0.65);

    // 「但也许在更深的层面上，压缩是在寻找规律」
    yield* all(
      this.strikeLine().opacity(1, 0.15, easeOutCubic),
      this.strikeLine().end(1, 0.35, easeInOutCubic),
      this.mythCard().x(-360, 0.65, easeInOutCubic),
      this.mythCard().opacity(0.42, 0.65, easeInOutCubic),
      this.mythCard().scale(0.9, 0.65, easeInOutCubic),
      this.truthCard().opacity(1, 0.55, easeOutCubic),
      this.truthCard().scale(1, 0.6, easeOutBack),
      ...this.patternRings.map((ring, idx) =>
        delay(
          idx * 0.08,
          all(
            ring.opacity(0.75, 0.5, easeOutCubic),
            ring.scale(1, 0.6, easeOutCubic),
          ),
        ),
      ),
    );
    yield* waitFor(0.65);

    // 「而智能，正是从这些规律中诞生的。」
    yield* all(
      this.birthLine().opacity(1, 0.25, easeOutCubic),
      this.birthLine().end(1, 0.45, easeInOutCubic),
      this.mindNode().opacity(1, 0.5, easeOutCubic),
      this.mindNode().scale(1, 0.55, easeOutBack),
    );
    yield* waitFor(1.0);

    // Act 3 退场
    yield* all(
      this.act3Group().opacity(0, 0.5, easeInOutCubic),
      this.act3Group().scale(0.9, 0.5, easeInOutCubic),
    );

    // ═══ Act 4: 终极猜想「压缩即智能」 ═══
    // 「如果猜想更大胆一些；那么就是：压缩即智能」
    yield* this.guessHint().opacity(1, 0.4, easeOutCubic);
    yield* all(
      this.eqHalo().opacity(1, 0.6, easeOutCubic),
      this.eqHalo().scale(1, 0.7, easeOutCubic),
      this.eqLeftCard().opacity(1, 0.45, easeOutCubic),
      this.eqLeftCard().scale(1, 0.55, easeOutBack),
      this.eqRightCard().opacity(1, 0.45, easeOutCubic),
      this.eqRightCard().scale(1, 0.55, easeOutBack),
    );

    // 恒等号强力落位 + 双卡向中心靠拢微震共鸣
    yield* all(
      this.eqSign().opacity(1, 0.3, easeOutCubic),
      this.eqSign().scale(1.18, 0.38, easeOutBack),
      this.eqLeftCard().x(-285, 0.45, easeInOutCubic),
      this.eqRightCard().x(285, 0.45, easeInOutCubic),
    );
    yield* all(
      this.eqSign().scale(1, 0.2, easeOutCubic),
      this.thesisBanner().opacity(1, 0.45, easeOutCubic),
      this.thesisBanner().scale(1, 0.5, easeOutBack),
      this.eqHalo().scale(1.12, 0.6, easeInOutCubic),
    );
    yield* waitFor(1.5);
  }
}
