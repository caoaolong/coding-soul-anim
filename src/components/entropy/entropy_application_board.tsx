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
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FormulaDerive} from '../formula/formula_derive';
import {SceneTitle} from '../title/scene_title';
import {TreeBoard} from '../tree/tree_board';
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
const GREEN = '#a3e635';
const PURPLE = '#c084fc';

const SCREEN_H = 1080;

export interface EntropyApplicationBoardProps extends NodeProps {}

/**
 * 第三章组件：信息熵有什么用？（<<<application>>>）
 * 第一屏：哈夫曼编码树 + 比特流色块实时挤压压缩演示（2.00 bit → 1.75 bit 下界）
 * 第二屏：决策树 48 颗猫狗样本粒子动态分流动画（混杂划分 H=1.0 vs 纯净划分 H→0.14）
 */
export class EntropyApplicationBoard extends Node {
  private readonly pages = createRef<Node>();
  private readonly screen1 = createRef<Node>();
  private readonly screen2 = createRef<Node>();

  // 第一屏引用
  private readonly huffmanTree = createRef<TreeBoard>();
  private readonly fixedBlocks = createRefArray<Rect>();
  private readonly huffBlocks = createRefArray<Rect>();
  private readonly fixedLabel = createRef<Txt>();
  private readonly huffLabel = createRef<Txt>();
  private readonly boundLine = createRef<Line>();
  private readonly boundTxt = createRef<Txt>();
  private readonly lengthDerive = createRef<FormulaDerive>();

  // 第二屏引用：粒子分流演示
  private readonly rootPool = createRef<Rect>();
  private readonly leftBucket = createRef<Rect>();
  private readonly rightBucket = createRef<Rect>();
  private readonly leftBucketTitle = createRef<Txt>();
  private readonly rightBucketTitle = createRef<Txt>();
  private readonly splitWires = createRefArray<Line>();
  private readonly particles = createRefArray<Circle>();
  private readonly modeBadge = createRef<Rect>();
  private readonly modeTxt = createRef<Txt>();
  private readonly entropyMeterFill = createRef<Rect>();
  private readonly entropyValTxt = createRef<Txt>();
  private readonly gainBadge = createRef<Rect>();
  private readonly gainTxt = createRef<Txt>();

  // 48 颗粒子：前 24 颗为猫（青色），后 24 颗为狗（金色）
  private readonly particleCount = 48;

  public constructor(props: EntropyApplicationBoardProps = {}) {
    super({...props});

    this.add(
      <Node ref={this.pages}>
        <Node ref={this.screen1} />
        <Node ref={this.screen2} y={SCREEN_H} />
      </Node>,
    );

    this.buildScreen1();
    this.buildScreen2();
  }

  private buildScreen1() {
    // 左侧：哈夫曼编码树
    this.screen1().add(
      <TreeBoard
        ref={this.huffmanTree}
        x={-450}
        y={-280}
        nodeStyle={'rect'}
        edgeStyle={'elbow'}
        nodeWidth={150}
        nodeHeight={66}
        hGap={30}
        vGap={52}
        fontSize={22}
        tree={{
          label: '字符分布',
          color: ACCENT,
          children: [
            {label: 'A : 0', year: '50%', color: ACCENT},
            {
              label: '1 (50%)',
              color: GOLD,
              children: [
                {label: 'B : 10', year: '25%', color: BLUE},
                {
                  label: '11 (25%)',
                  color: GOLD,
                  children: [
                    {label: 'C : 110', year: '12.5%', color: PURPLE},
                    {label: 'D : 111', year: '12.5%', color: '#f472b6'},
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );

    // 右上：实时比特块压缩对比舞台
    // 示例序列 8 字符：A A B A C A D B（4A=50%, 2B=25%, 1C=12.5%, 1D=12.5%）
    const seq = [
      {ch: 'A', fix: '00', huff: '0', bits: 1, color: ACCENT},
      {ch: 'A', fix: '00', huff: '0', bits: 1, color: ACCENT},
      {ch: 'B', fix: '01', huff: '10', bits: 2, color: BLUE},
      {ch: 'A', fix: '00', huff: '0', bits: 1, color: ACCENT},
      {ch: 'C', fix: '10', huff: '110', bits: 3, color: PURPLE},
      {ch: 'A', fix: '00', huff: '0', bits: 1, color: ACCENT},
      {ch: 'D', fix: '11', huff: '111', bits: 3, color: '#f472b6'},
      {ch: 'B', fix: '01', huff: '10', bits: 2, color: BLUE},
    ];

    const unitPx = 42; // 1 bit = 42px
    const startX = -15;
    const fixY = -230;
    const huffY = -75;

    this.screen1().add(
      <Txt
        ref={this.fixedLabel}
        text={'定长编码：每个字符 2 bit  →  平均 2.00 bit'}
        fontFamily={FONT}
        fontSize={24}
        fontWeight={700}
        fill={MUTED}
        x={startX}
        y={fixY - 58}
        offset={[-1, 0]}
        opacity={0}
      />,
    );

    // 定长编码块（8 × 2 bit = 16 bit = 672px）
    seq.forEach((item, i) => {
      const w = 2 * unitPx - 4;
      const cx = startX + i * (2 * unitPx) + w / 2;
      this.screen1().add(
        <Rect
          ref={this.fixedBlocks}
          width={w}
          height={64}
          x={cx}
          y={fixY}
          radius={8}
          fill={CARD}
          stroke={item.color}
          lineWidth={2}
          opacity={0}
          scale={0.8}
        >
          <Txt
            text={`${item.ch}:${item.fix}`}
            fontFamily={FONT}
            fontSize={20}
            fontWeight={700}
            fill={PAPER}
          />
        </Rect>,
      );
    });

    this.screen1().add(
      <Txt
        ref={this.huffLabel}
        text={'哈夫曼编码：高频短码 · 低频长码  →  平均 1.75 bit'}
        fontFamily={FONT}
        fontSize={24}
        fontWeight={700}
        fill={ACCENT}
        x={startX}
        y={huffY - 58}
        offset={[-1, 0]}
        opacity={0}
      />,
    );

    // 哈夫曼编码块：初始先按未压缩间距散开，动画中向左紧密挤压成 14 bit（588px）
    let bitCursor = 0;
    seq.forEach((item, i) => {
      const w = item.bits * unitPx - 4;
      const initialX = startX + i * (2.5 * unitPx) + w / 2;
      const packedX = startX + bitCursor * unitPx + w / 2;
      bitCursor += item.bits;
      this.screen1().add(
        <Rect
          ref={this.huffBlocks}
          width={w}
          height={64}
          x={initialX}
          y={huffY}
          radius={8}
          fill={DEEP}
          stroke={item.color}
          lineWidth={2.5}
          opacity={0}
          scale={0.8}
          data-packed-x={packedX}
        >
          <Txt
            text={`${item.ch}:${item.huff}`}
            fontFamily={FONT}
            fontSize={19}
            fontWeight={700}
            fill={item.color}
          />
        </Rect>,
      );
    });

    // 理论下界标尺线（在 14 bit = 1.75 bit/字符 处）
    const boundX = startX + 14 * unitPx;
    this.screen1().add(
      <Line
        ref={this.boundLine}
        points={[
          [boundX, fixY - 40],
          [boundX, huffY + 55],
        ]}
        stroke={GOLD}
        lineWidth={3}
        lineDash={[8, 6]}
        end={0}
        opacity={0}
      />,
    );
    this.screen1().add(
      <Txt
        ref={this.boundTxt}
        text={'信息熵下界 H(X) = 1.75 bit'}
        fontFamily={FONT}
        fontSize={22}
        fontWeight={700}
        fill={GOLD}
        x={boundX}
        y={huffY + 80}
        opacity={0}
      />,
    );

    // 右下：精简公式推导
    this.screen1().add(
      <FormulaDerive
        ref={this.lengthDerive}
        lines={[
          'L = 0.5\\times 1 + 0.25\\times 2 + 0.125\\times 3 + 0.125\\times 3',
          '= 1.75\\ \\text{bit} = H(X)\\ \\text{（无损压缩理论下界）}',
        ]}
        fontSize={36}
        rowGap={26}
        x={320}
        y={195}
      />,
    );
  }

  private buildScreen2() {
    // 顶部初始样本池容器
    this.screen2().add(
      <Rect
        ref={this.rootPool}
        width={620}
        height={160}
        x={-160}
        y={-250}
        radius={18}
        fill={CARD}
        stroke={BLUE}
        lineWidth={2.5}
        opacity={0}
      >
        <Txt
          text={'初始样本池（猫 50%  |  狗 50%）'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={PAPER}
          y={-52}
        />
      </Rect>,
    );

    // 右上：实时信息熵仪表盘
    this.screen2().add(
      <Rect
        width={420}
        height={160}
        x={450}
        y={-250}
        radius={18}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
      >
        <Txt
          text={'划分后平均信息熵'}
          fontFamily={FONT}
          fontSize={22}
          fill={MUTED}
          y={-46}
        />
        <Rect
          width={340}
          height={26}
          y={0}
          radius={13}
          fill={DEEP}
          stroke={LINE}
          lineWidth={1.5}
          clip
        >
          <Rect
            ref={this.entropyMeterFill}
            width={340}
            height={26}
            x={-170}
            offset={[-1, 0]}
            fill={GOLD}
          />
        </Rect>
        <Txt
          ref={this.entropyValTxt}
          text={'H = 1.00 bit（高度混杂）'}
          fontFamily={FONT}
          fontSize={25}
          fontWeight={700}
          fill={GOLD}
          y={46}
        />
      </Rect>,
    );

    // 分流连线
    [
      [
        [-160, -170],
        [-420, -170],
        [-420, -20],
      ],
      [
        [-160, -170],
        [100, -170],
        [100, -20],
      ],
    ].forEach(pts => {
      this.screen2().add(
        <Line
          ref={this.splitWires}
          points={pts as [number, number][]}
          stroke={ACCENT}
          lineWidth={3}
          lineCap={'round'}
          end={0}
          opacity={0.75}
        />,
      );
    });

    // 左右两个划分后子桶
    this.screen2().add(
      <Rect
        ref={this.leftBucket}
        width={440}
        height={240}
        x={-420}
        y={100}
        radius={18}
        fill={CARD}
        stroke={LINE}
        lineWidth={2.5}
        opacity={0}
      >
        <Txt
          ref={this.leftBucketTitle}
          text={'子集 A'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={PAPER}
          y={-86}
        />
      </Rect>,
    );

    this.screen2().add(
      <Rect
        ref={this.rightBucket}
        width={440}
        height={240}
        x={100}
        y={100}
        radius={18}
        fill={CARD}
        stroke={LINE}
        lineWidth={2.5}
        opacity={0}
      >
        <Txt
          ref={this.rightBucketTitle}
          text={'子集 B'}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={PAPER}
          y={-86}
        />
      </Rect>,
    );

    // 右下：当前特征状态与信息增益卡片
    this.screen2().add(
      <Rect
        ref={this.modeBadge}
        width={420}
        height={110}
        x={450}
        y={40}
        radius={16}
        fill={CARD}
        stroke={RED}
        lineWidth={2.5}
        opacity={0}
      >
        <Txt
          ref={this.modeTxt}
          text={'特征一：猫狗依然混杂'}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={RED}
        />
      </Rect>,
    );

    this.screen2().add(
      <Rect
        ref={this.gainBadge}
        width={420}
        height={110}
        x={450}
        y={175}
        radius={16}
        fill={CARD}
        stroke={RED}
        lineWidth={2.5}
        opacity={0}
      >
        <Txt
          ref={this.gainTxt}
          text={'信息增益 ΔH ≈ 0 bit'}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={RED}
        />
      </Rect>,
    );

    // 创建 48 颗样本粒子（初始交错排列在顶部样本池内）
    for (let i = 0; i < this.particleCount; i++) {
      const isCat = i < 24;
      const pos = this.rootSlotPos(i);
      this.screen2().add(
        <Circle
          ref={this.particles}
          x={pos.x}
          y={pos.y}
          size={18}
          fill={isCat ? ACCENT : GOLD}
          opacity={0}
          scale={0.3}
        />,
      );
    }
  }

  /** 初始样本池中的混杂网格坐标（猫狗交错） */
  private rootSlotPos(i: number): Vector2 {
    // 将 0..23(猫) 和 24..47(狗) 交错映射到 12×4 网格
    const isCat = i < 24;
    const k = isCat ? i * 2 : (i - 24) * 2 + 1;
    const col = k % 12;
    const row = Math.floor(k / 12);
    return new Vector2(-160 + (col - 5.5) * 40, -250 + 18 + (row - 1.5) * 26);
  }

  /** 子集桶内的 6×4 网格坐标 */
  private bucketSlotPos(bucketCenter: {x: number; y: number}, slotIdx: number): Vector2 {
    const col = slotIdx % 6;
    const row = Math.floor(slotIdx / 6);
    return new Vector2(
      bucketCenter.x + (col - 2.5) * 52,
      bucketCenter.y + 18 + (row - 1.5) * 36,
    );
  }

  public *play(sceneTitle?: SceneTitle): ThreadGenerator {
    // ── 第一屏：哈夫曼树 + 比特块实时压缩动画 ──
    yield* this.huffmanTree().reveal();

    yield* all(
      this.fixedLabel().opacity(1, 0.35),
      ...this.fixedBlocks.map((b, i) =>
        delay(
          i * 0.05,
          all(
            b.opacity(1, 0.3, easeOutCubic),
            b.scale(1, 0.35, easeOutBack),
          ),
        ),
      ),
    );
    yield* waitFor(0.2);

    // 哈夫曼块先散开出现，再向右对齐挤压到 1.75 bit/字符
    yield* all(
      this.huffLabel().opacity(1, 0.35),
      ...this.huffBlocks.map((b, i) =>
        delay(
          i * 0.05,
          all(
            b.opacity(1, 0.3, easeOutCubic),
            b.scale(1, 0.35, easeOutBack),
          ),
        ),
      ),
    );
    yield* waitFor(0.2);

    // 挤压合拢动画 + 理论下界标尺落入
    const packedXs = [6, 48, 111, 174, 258, 342, 426, 531];
    yield* all(
      ...this.huffBlocks.map((b, i) =>
        b.x(packedXs[i], 0.65, easeInOutCubic),
      ),
      this.boundLine().opacity(1, 0.3),
      this.boundLine().end(1, 0.65, easeOutCubic),
      this.boundTxt().opacity(1, 0.5, easeOutCubic),
    );

    yield* this.lengthDerive().run(0.4, 0.38);
    yield* waitFor(0.8);

    // ── 滚屏至第二屏：决策树样本粒子动态分流 ──
    if (sceneTitle) {
      yield* all(
        this.pages().y(-SCREEN_H, 0.85, easeInOutCubic),
        sceneTitle.setText('信息熵的应用 · 决策树分类', 0.4),
      );
    } else {
      yield* this.pages().y(-SCREEN_H, 0.85, easeInOutCubic);
    }

    // 1) 初始池与 48 颗猫狗粒子显现
    yield* all(
      this.rootPool().opacity(1, 0.35),
      this.leftBucket().opacity(1, 0.35),
      this.rightBucket().opacity(1, 0.35),
      ...this.splitWires.map(w => w.end(1, 0.45, easeInOutCubic)),
      ...this.particles.map((p, i) =>
        delay(
          (i % 12) * 0.02,
          all(
            p.opacity(1, 0.25, easeOutCubic),
            p.scale(1, 0.3, easeOutBack),
          ),
        ),
      ),
    );
    yield* waitFor(0.3);

    // 2) 差特征划分：猫狗各半飞入左右子集（依然混杂）
    yield* all(
      this.modeBadge().opacity(1, 0.3),
      this.gainBadge().opacity(1, 0.3),
      this.leftBucketTitle().text('子集 A：猫 50% | 狗 50%', 0.2),
      this.rightBucketTitle().text('子集 B：猫 50% | 狗 50%', 0.2),
      ...this.particles.map((p, i) => {
        // 前 12 猫 + 前 12 狗去左桶；后 12 猫 + 后 12 狗去右桶
        const isCat = i < 24;
        const localIdx = isCat ? i : i - 24;
        const goLeft = localIdx < 12;
        const slot = isCat
          ? (localIdx % 12) * 2
          : (localIdx % 12) * 2 + 1;
        const center = goLeft ? {x: -420, y: 100} : {x: 100, y: 100};
        const target = this.bucketSlotPos(center, slot);
        return delay(
          (i % 12) * 0.025,
          p.position(target, 0.65, easeInOutCubic),
        );
      }),
    );
    yield* waitFor(0.75);

    // 3) 切换为好特征划分：青色猫粒子全部汇聚左桶，金色狗粒子全部汇聚右桶！
    yield* all(
      this.leftBucket().stroke(ACCENT, 0.4),
      this.rightBucket().stroke(GOLD, 0.4),
      this.leftBucketTitle().text('子集 A：纯猫簇 (99%)', 0.3),
      this.leftBucketTitle().fill(ACCENT, 0.3),
      this.rightBucketTitle().text('子集 B：纯狗簇 (99%)', 0.3),
      this.rightBucketTitle().fill(GOLD, 0.3),
      this.modeBadge().stroke(GREEN, 0.35),
      this.modeTxt().text('特征二：高纯度分离！', 0.3),
      this.modeTxt().fill(GREEN, 0.35),
      this.gainBadge().stroke(ACCENT, 0.35),
      this.gainTxt().text('信息增益 ΔH ≈ 0.86 bit ↑', 0.3),
      this.gainTxt().fill(ACCENT, 0.35),
      this.entropyMeterFill().width(48, 0.75, easeInOutCubic),
      this.entropyMeterFill().fill(ACCENT, 0.5),
      this.entropyValTxt().text('H ≈ 0.14 bit（确定性极高）', 0.3),
      this.entropyValTxt().fill(ACCENT, 0.35),
      ...this.particles.map((p, i) => {
        const isCat = i < 24;
        const slot = isCat ? i : i - 24;
        const center = isCat ? {x: -420, y: 100} : {x: 100, y: 100};
        const target = this.bucketSlotPos(center, slot);
        return delay(
          (i % 12) * 0.02,
          p.position(target, 0.7, easeInOutCubic),
        );
      }),
    );

    yield* waitFor(1.2);
  }
}
