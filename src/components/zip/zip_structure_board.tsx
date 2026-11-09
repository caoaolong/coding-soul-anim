import {Img, Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
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
  easeOutQuad,
  waitFor,
} from '@motion-canvas/core';
import compressIcon from '../../assets/icons/压缩.svg';
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

const STRIP_Y = -20;
const BLOCK_H = 132;

type SegSpec = {
  title: string;
  sub: string;
  color: string;
  w: number;
};

const SEGS: SegSpec[] = [
  {title: 'Local Header', sub: '文件元数据', color: BLUE, w: 188},
  {title: 'CRC', sub: '校验和', color: ROSE, w: 140},
  {title: 'DEFLATE', sub: '压缩数据载荷', color: ACCENT, w: 300},
  {title: 'Central Dir', sub: '全部文件索引', color: GOLD, w: 200},
  {title: 'EOCD', sub: '入口点', color: GOLD, w: 160},
];

const GAP = 12;
const STRIP_W =
  SEGS.reduce((s, seg) => s + seg.w, 0) + GAP * (SEGS.length - 1);

function segCenters(): number[] {
  const xs: number[] = [];
  let x = -STRIP_W / 2;
  for (const seg of SEGS) {
    xs.push(x + seg.w / 2);
    x += seg.w + GAP;
  }
  return xs;
}

export interface ZipStructureBoardProps extends NodeProps {}

/**
 * ZIP 编码结构：字节轨生长 → 左右套壳 → 定格 → 聚焦 DEFLATE → 拆解 LZ77/哈夫曼
 */
export class ZipStructureBoard extends Node {
  private readonly intro = createRef<Node>();
  private readonly zipIcon = createRef<Img>();
  private readonly zipLabel = createRef<Txt>();
  private readonly toolHint = createRef<Txt>();

  private readonly rail = createRef<Line>();
  private readonly railGlow = createRef<Line>();
  private readonly blocks = createRefArray<Rect>();
  private readonly blockTitles = createRefArray<Txt>();
  private readonly blockSubs = createRefArray<Txt>();

  private readonly groupBraces = createRefArray<Line>();
  private readonly groupLabels = createRefArray<Txt>();

  private readonly focusGlow = createRef<Rect>();

  private readonly splitStage = createRef<Node>();
  private readonly fromLine = createRef<Line>();
  private readonly lz77Card = createRef<Rect>();
  private readonly huffCard = createRef<Rect>();
  private readonly between = createRef<Line>();

  private readonly centers = segCenters();

  public constructor(props: ZipStructureBoardProps = {}) {
    super({y: -30, ...props});

    // ── Intro ──
    this.add(
      <Node ref={this.intro} y={-40}>
        <Img
          ref={this.zipIcon}
          src={compressIcon}
          width={110}
          height={110}
          y={-48}
          opacity={0}
          scale={0.7}
        />
        <Txt
          ref={this.zipLabel}
          text={'ZIP'}
          fontFamily={MONO}
          fontSize={42}
          fontWeight={700}
          fill={ACCENT}
          y={40}
          opacity={0}
          letterSpacing={6}
        />
        <Txt
          ref={this.toolHint}
          text={'论文实验使用的压缩工具'}
          fontFamily={FONT}
          fontSize={26}
          fill={MUTED}
          y={92}
          opacity={0}
        />
      </Node>,
    );

    // ── 底层光轨 ──
    this.add(
      <Line
        ref={this.railGlow}
        points={[
          [-STRIP_W / 2 - 20, STRIP_Y + BLOCK_H / 2 + 18],
          [STRIP_W / 2 + 20, STRIP_Y + BLOCK_H / 2 + 18],
        ]}
        stroke={'#3dd6c633'}
        lineWidth={10}
        lineCap={'round'}
        end={0}
        opacity={0}
      />,
    );
    this.add(
      <Line
        ref={this.rail}
        points={[
          [-STRIP_W / 2 - 8, STRIP_Y + BLOCK_H / 2 + 18],
          [STRIP_W / 2 + 8, STRIP_Y + BLOCK_H / 2 + 18],
        ]}
        stroke={LINE}
        lineWidth={2}
        lineCap={'round'}
        end={0}
        opacity={0}
      />,
    );

    // ── 五段字节块（绝对定位，便于滑入）──
    SEGS.forEach((seg, i) => {
      const isCore = i === 2;
      this.add(
        <Rect
          ref={this.blocks}
          width={seg.w}
          height={isCore ? BLOCK_H + 16 : BLOCK_H}
          radius={14}
          fill={isCore ? DEEP : CARD}
          stroke={seg.color}
          lineWidth={isCore ? 3 : 2}
          x={this.centers[i]}
          y={STRIP_Y}
          opacity={0}
          scale={0.92}
          shadowColor={`${seg.color}00`}
          shadowBlur={0}
        >
          <Txt
            ref={this.blockTitles}
            text={seg.title}
            fontFamily={MONO}
            fontSize={isCore ? 26 : 18}
            fontWeight={700}
            fill={seg.color}
            y={-22}
          />
          <Txt
            ref={this.blockSubs}
            text={seg.sub}
            fontFamily={FONT}
            fontSize={isCore ? 22 : 18}
            fill={PAPER}
            y={22}
          />
        </Rect>,
      );
    });

    // 分组括号：Header / Payload / Directory
    const braceY = STRIP_Y - BLOCK_H / 2 - 48;
    const groups = [
      {label: 'Header', color: BLUE, from: 0, to: 1},
      {label: 'Payload', color: ACCENT, from: 2, to: 2},
      {label: 'Directory', color: GOLD, from: 3, to: 4},
    ];
    for (const g of groups) {
      const left = this.centers[g.from] - SEGS[g.from].w / 2;
      const right = this.centers[g.to] + SEGS[g.to].w / 2;
      const mid = (left + right) / 2;
      this.add(
        <Line
          ref={this.groupBraces}
          points={[
            [left, braceY + 14],
            [left, braceY],
            [right, braceY],
            [right, braceY + 14],
          ]}
          stroke={g.color}
          lineWidth={2}
          lineCap={'round'}
          lineJoin={'round'}
          end={0}
          opacity={0}
        />,
      );
      this.add(
        <Txt
          ref={this.groupLabels}
          text={g.label}
          fontFamily={MONO}
          fontSize={20}
          fontWeight={700}
          fill={g.color}
          x={mid}
          y={braceY - 22}
          opacity={0}
        />,
      );
    }

    // 聚焦光晕
    this.add(
      <Rect
        ref={this.focusGlow}
        width={SEGS[2].w + 48}
        height={BLOCK_H + 56}
        radius={20}
        x={this.centers[2]}
        y={STRIP_Y}
        fill={'#3dd6c610'}
        stroke={ACCENT}
        lineWidth={2}
        opacity={0}
        scale={0.9}
      />,
    );
    // ── 拆解：卡片从 DEFLATE 正下方长出再左右分开 ──
    this.add(
      <Line
        ref={this.fromLine}
        points={[
          [0, STRIP_Y + 70],
          [0, STRIP_Y + 150],
        ]}
        stroke={ACCENT}
        lineWidth={2.5}
        endArrow
        arrowSize={12}
        end={0}
        opacity={0}
      />,
    );
    this.add(
      <Line
        ref={this.between}
        points={[
          [0, STRIP_Y + 220],
          [0, STRIP_Y + 220],
        ]}
        stroke={LINE}
        lineWidth={2.5}
        endArrow
        arrowSize={11}
        end={1}
        opacity={0}
      />,
    );
    this.add(
      <Rect
        ref={this.lz77Card}
        width={280}
        height={110}
        radius={16}
        fill={CARD}
        stroke={ACCENT}
        lineWidth={2.5}
        x={0}
        y={STRIP_Y}
        opacity={0}
        scale={0.55}
        shadowColor={'#3dd6c655'}
        shadowBlur={0}
      >
        <Txt
          text={'①  LZ77'}
          fontFamily={MONO}
          fontSize={28}
          fontWeight={700}
          fill={ACCENT}
          y={-22}
        />
        <Txt
          text={'滑动窗口 · 消除重复'}
          fontFamily={FONT}
          fontSize={20}
          fill={PAPER}
          y={24}
        />
      </Rect>,
    );
    this.add(
      <Rect
        ref={this.huffCard}
        width={300}
        height={110}
        radius={16}
        fill={CARD}
        stroke={GOLD}
        lineWidth={2.5}
        x={0}
        y={STRIP_Y}
        opacity={0}
        scale={0.55}
        shadowColor={'#ffb45455'}
        shadowBlur={0}
      >
        <Txt
          text={'②  哈夫曼编码'}
          fontFamily={MONO}
          fontSize={26}
          fontWeight={700}
          fill={GOLD}
          y={-22}
        />
        <Txt
          text={'变长码 · 逼近熵下界'}
          fontFamily={FONT}
          fontSize={20}
          fill={PAPER}
          y={24}
        />
      </Rect>,
    );
    // 占位：保留 ref 兼容，不再作为布局容器
    this.add(<Node ref={this.splitStage} opacity={0} />);
  }

  /** 聚焦 DEFLATE 并丝滑拆成 LZ77 → 哈夫曼 */
  private *revealDeflateSteps(): ThreadGenerator {
    const core = this.blocks[2];
    const focusY = -70;
    const cardY = 200;

    this.focusGlow().position(new Vector2(this.centers[2], STRIP_Y));

    // A. 彻底清场（无关元素全部 opacity→0）+ 核心居中上移
    yield* all(
      ...[0, 1, 3, 4].map((i, k) => {
        const dir = i < 2 ? -1 : 1;
        return all(
          this.blocks[i].opacity(0, 0.55, easeInOutCubic),
          this.blocks[i].x(
            this.centers[i] + dir * (120 + k * 16),
            0.7,
            easeInOutCubic,
          ),
          this.blocks[i].y(STRIP_Y + 40, 0.7, easeInOutCubic),
          this.blocks[i].scale(0.85, 0.7, easeInOutCubic),
          this.blocks[i].shadowBlur(0, 0.35, easeOutCubic),
        );
      }),
      ...this.groupBraces.map(b =>
        all(
          b.opacity(0, 0.45, easeInOutCubic),
          b.end(0, 0.45, easeInOutCubic),
        ),
      ),
      ...this.groupLabels.map(l => l.opacity(0, 0.4, easeInOutCubic)),
      this.rail().opacity(0, 0.45, easeInOutCubic),
      this.railGlow().opacity(0, 0.45, easeInOutCubic),
      this.rail().end(0, 0.5, easeInOutCubic),
      this.railGlow().end(0, 0.5, easeInOutCubic),
      this.intro().opacity(0, 0.4, easeInOutCubic),
      this.zipIcon().opacity(0, 0.35, easeOutCubic),
      this.zipLabel().opacity(0, 0.35, easeOutCubic),
      this.toolHint().opacity(0, 0.3, easeOutCubic),
      core.x(0, 0.85, easeInOutCubic),
      core.y(focusY, 0.85, easeInOutCubic),
      core.scale(1.18, 0.85, easeInOutCubic),
      core.shadowColor(`${ACCENT}99`, 0.65, easeOutQuad),
      core.shadowBlur(42, 0.65, easeOutQuad),
      this.focusGlow().opacity(0.85, 0.65, easeInOutCubic),
      this.focusGlow().position(new Vector2(0, focusY), 0.85, easeInOutCubic),
      this.focusGlow().scale(1.08, 0.85, easeInOutCubic),
    );

    // 硬清：确保残留完全不可见
    for (const i of [0, 1, 3, 4]) {
      this.blocks[i].opacity(0);
      this.blocks[i].shadowBlur(0);
    }
    for (const b of this.groupBraces) {
      b.opacity(0);
      b.end(0);
    }
    for (const l of this.groupLabels) l.opacity(0);
    this.rail().opacity(0);
    this.railGlow().opacity(0);
    this.intro().opacity(0);
    this.zipIcon().opacity(0);
    this.zipLabel().opacity(0);
    this.toolHint().opacity(0);

    yield* waitFor(0.3);

    // B. 从 DEFLATE 底边垂线「生长」下来（连接感）
    this.fromLine().points([
      [0, focusY + BLOCK_H * 0.55],
      [0, cardY - 70],
    ]);
    this.fromLine().end(0);
    yield* all(
      this.fromLine().opacity(0.9, 0.2, easeOutCubic),
      this.fromLine().end(1, 0.55, easeInOutCubic),
    );

    // C. 两张卡片叠在连线末端出生（同源），再左右分开
    this.lz77Card().position(new Vector2(0, cardY));
    this.huffCard().position(new Vector2(0, cardY));
    this.lz77Card().scale(0.72);
    this.huffCard().scale(0.72);
    this.lz77Card().opacity(0);
    this.huffCard().opacity(0);

    yield* all(
      this.lz77Card().opacity(1, 0.4, easeOutCubic),
      this.huffCard().opacity(1, 0.4, easeOutCubic),
      this.lz77Card().scale(1, 0.55, easeInOutCubic),
      this.huffCard().scale(1, 0.55, easeInOutCubic),
      // 核心略收，把视觉重心让给两步
      core.scale(1.06, 0.7, easeInOutCubic),
      core.opacity(0.92, 0.5, easeOutCubic),
      this.focusGlow().opacity(0.45, 0.55, easeInOutCubic),
    );

    // D. 对开 + 中间箭头随间距拉长（全程 easeInOut，无回弹）
    const leftX = -210;
    const rightX = 220;
    this.between().opacity(0);
    this.between().points([
      [0, cardY],
      [0, cardY],
    ]);

    yield* all(
      this.lz77Card().x(leftX, 0.95, easeInOutCubic),
      this.huffCard().x(rightX, 0.95, easeInOutCubic),
      this.lz77Card().shadowBlur(26, 0.7, easeOutQuad),
      this.huffCard().shadowBlur(26, 0.7, easeOutQuad),
      // between 线随分开拉长
      this.between().opacity(1, 0.35, easeOutCubic),
      this.between().points(
        [
          [leftX + 150, cardY],
          [rightX - 160, cardY],
        ],
        0.95,
        easeInOutCubic,
      ),
      // 垂线末端跟到卡片高度中心
      this.fromLine().points(
        [
          [0, focusY + BLOCK_H * 0.55],
          [0, cardY - 58],
        ],
        0.95,
        easeInOutCubic,
      ),
    );

    yield* waitFor(1.0);
  }

  private *slideIn(
    block: Rect,
    fromX: number,
    toX: number,
    duration = 0.55,
  ): ThreadGenerator {
    block.x(fromX);
    block.opacity(0);
    block.scale(0.92);
    yield* all(
      block.opacity(1, duration * 0.55, easeOutCubic),
      block.x(toX, duration, easeOutCubic),
      block.scale(1, duration, easeOutBack),
    );
  }

  private *expandCore(duration = 0.7): ThreadGenerator {
    const block = this.blocks[2];
    block.width(48);
    block.opacity(0);
    block.scale(1);
    yield* all(
      block.opacity(1, 0.25, easeOutCubic),
      block.width(SEGS[2].w, duration, easeOutCubic),
      block.shadowColor(`${ACCENT}55`, duration * 0.6, easeOutCubic),
      block.shadowBlur(28, duration * 0.6, easeOutCubic),
    );
  }

  public *play(): ThreadGenerator {
    // ═══ 1. ZIP 工具入场 ═══
    yield* all(
      this.zipIcon().opacity(1, 0.45, easeOutCubic),
      this.zipIcon().scale(1, 0.55, easeOutBack),
    );
    yield* all(
      this.zipLabel().opacity(1, 0.35, easeOutCubic),
      this.zipLabel().y(36, 0.4, easeOutCubic),
    );
    yield* this.toolHint().opacity(0.95, 0.35, easeOutCubic);
    yield* waitFor(0.7);

    // ═══ 2. Intro 上收，铺轨，DEFLATE 自中心展开 ═══
    yield* all(
      this.toolHint().opacity(0, 0.25, easeOutCubic),
      this.intro().y(-300, 0.65, easeInOutCubic),
      this.intro().scale(0.62, 0.65, easeInOutCubic),
      this.intro().opacity(0.28, 0.65, easeOutCubic),
      this.rail().opacity(1, 0.4, easeOutCubic),
      this.railGlow().opacity(1, 0.4, easeOutCubic),
      this.rail().end(1, 0.75, easeInOutCubic),
      this.railGlow().end(1, 0.75, easeInOutCubic),
    );

    yield* this.expandCore(0.75);
    yield* all(
      this.groupBraces[1].opacity(0.9, 0.3, easeOutCubic),
      this.groupBraces[1].end(1, 0.45, easeOutCubic),
      this.groupLabels[1].opacity(1, 0.35, easeOutCubic),
    );
    yield* waitFor(0.55);

    // ═══ 3. 头部自左侧滑入（元数据 → 校验）═══
    yield* all(
      this.slideIn(
        this.blocks[0],
        this.centers[0] - 160,
        this.centers[0],
        0.55,
      ),
      delay(
        0.14,
        this.slideIn(
          this.blocks[1],
          this.centers[1] - 140,
          this.centers[1],
          0.5,
        ),
      ),
    );
    yield* all(
      this.groupBraces[0].opacity(0.9, 0.3, easeOutCubic),
      this.groupBraces[0].end(1, 0.5, easeOutCubic),
      this.groupLabels[0].opacity(1, 0.35, easeOutCubic),
    );
    // 头部轻闪提示「加在前面」
    yield* all(
      this.blocks[0].shadowColor(`${BLUE}66`, 0.25, easeOutCubic),
      this.blocks[0].shadowBlur(22, 0.25, easeOutCubic),
      this.blocks[1].shadowColor(`${ROSE}66`, 0.25, easeOutCubic),
      this.blocks[1].shadowBlur(18, 0.25, easeOutCubic),
    );
    yield* all(
      this.blocks[0].shadowBlur(0, 0.35, easeOutCubic),
      this.blocks[1].shadowBlur(0, 0.35, easeOutCubic),
    );
    yield* waitFor(0.45);

    // ═══ 4. 尾部自右侧滑入（目录 → 入口）═══
    yield* all(
      this.slideIn(
        this.blocks[3],
        this.centers[3] + 160,
        this.centers[3],
        0.55,
      ),
      delay(
        0.14,
        this.slideIn(
          this.blocks[4],
          this.centers[4] + 140,
          this.centers[4],
          0.5,
        ),
      ),
    );
    yield* all(
      this.groupBraces[2].opacity(0.9, 0.3, easeOutCubic),
      this.groupBraces[2].end(1, 0.5, easeOutCubic),
      this.groupLabels[2].opacity(1, 0.35, easeOutCubic),
    );
    yield* all(
      this.blocks[3].shadowColor(`${GOLD}66`, 0.25, easeOutCubic),
      this.blocks[3].shadowBlur(20, 0.25, easeOutCubic),
      this.blocks[4].shadowColor(`${GOLD}66`, 0.25, easeOutCubic),
      this.blocks[4].shadowBlur(18, 0.25, easeOutCubic),
    );
    yield* all(
      this.blocks[3].shadowBlur(0, 0.35, easeOutCubic),
      this.blocks[4].shadowBlur(0, 0.35, easeOutCubic),
    );
    yield* waitFor(0.7);

    // ═══ 5. 整带定格：依次微亮扫过 ═══
    for (let i = 0; i < this.blocks.length; i++) {
      yield* all(
        this.blocks[i].scale(1.05, 0.18, easeOutCubic),
        this.blocks[i].shadowBlur(16, 0.18, easeOutCubic),
      );
      yield* all(
        this.blocks[i].scale(1, 0.2, easeInOutCubic),
        this.blocks[i].shadowBlur(i === 2 ? 20 : 0, 0.2, easeOutCubic),
      );
    }
    yield* waitFor(0.35);

    // ═══ 6–7. 聚焦 DEFLATE → 丝滑拆成 LZ77 / 哈夫曼 ═══
    yield* this.revealDeflateSteps();
  }
}
