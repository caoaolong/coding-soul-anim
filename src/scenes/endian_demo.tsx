import {Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const PAPER = '#e8eef7';
const MUTED = '#6a7a8c';
const ACCENT = '#3dd6c6';
const BIG = '#7aa2ff';
const LITTLE = '#f0a060';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

/** 演示用 32-bit 值：高位在左 */
const VALUE_HEX = '12345678';
const BYTES = ['12', '34', '56', '78'] as const;
/** 逻辑下标：0 = 最高字节，3 = 最低字节 */
const BYTE_COLORS = ['#3dd6c6', '#7aa2ff', '#ffb454', '#f472b6'] as const;

const SLOT = 120;
const GAP = 18;

/** 大端主要应用场景（各自独立 tag） */
const BE_TAGS = ['网络协议'] as const;
/** 小端主要应用场景 */
const LE_TAGS = ['x86', 'ARM', '常见 PC'] as const;

/**
 * 字节序演示：
 * 1) 展示多字节整数并拆成字节
 * 2) 大端：高位字节写入低地址
 * 3) 小端：低位字节写入低地址
 * 4) 并排对照
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const valueCard = createRef<Rect>();
  const valueTxt = createRef<Txt>();
  const byteCards = createRefArray<Rect>();
  const byteTxts = createRefArray<Txt>();
  const slotBoxes = createRefArray<Rect>();
  const slotTxts = createRefArray<Txt>();
  const lowAddr = createRef<Txt>();
  const highAddr = createRef<Txt>();
  const addrArrow = createRef<Line>();
  const modeLabel = createRef<Txt>();
  const compare = createRef<Layout>();
  const beTags = createRefArray<Rect>();
  const leTags = createRefArray<Rect>();
  const beName = createRef<Txt>();
  const leName = createRef<Txt>();
  const beAlias = createRef<Layout>();
  const leAlias = createRef<Layout>();
  const beAliasEq = createRef<Txt>();
  const leAliasEq = createRef<Txt>();
  const beAliasTxt = createRef<Txt>();
  const leAliasTxt = createRef<Txt>();

  const byteRowX = (i: number) =>
    -((BYTES.length - 1) * (SLOT + GAP)) / 2 + i * (SLOT + GAP);

  const makeTag = (
    text: string,
    color: string,
    refs: ReturnType<typeof createRefArray<Rect>>,
  ) => (
    <Rect
      ref={refs}
      layout
      padding={[10, 18]}
      radius={8}
      fill={CARD}
      stroke={color}
      lineWidth={2}
      alignItems={'center'}
      justifyContent={'center'}
      opacity={0}
      scale={0.85}
    >
      <Txt
        text={text}
        fontFamily={MONO}
        fontSize={22}
        fontWeight={700}
        fill={color}
      />
    </Rect>
  );

  view.add(<SceneTitle ref={title} text={'字节序'} />);

  // ── 整数值 ──
  view.add(
    <Rect
      ref={valueCard}
      layout
      padding={[28, 48]}
      radius={16}
      fill={CARD}
      stroke={LINE}
      lineWidth={2}
      alignItems={'center'}
      y={-260}
      opacity={0}
      scale={0.9}
    >
      <Txt
        ref={valueTxt}
        text={'0x' + VALUE_HEX}
        fontFamily={MONO}
        fontSize={64}
        fontWeight={700}
        fill={PAPER}
      />
    </Rect>,
  );

  for (let i = 0; i < BYTES.length; i++) {
    view.add(
      <Rect
        ref={byteCards}
        width={SLOT}
        height={88}
        radius={12}
        fill={CARD}
        stroke={BYTE_COLORS[i]}
        lineWidth={2.5}
        x={byteRowX(i)}
        y={-80}
        opacity={0}
        scale={0.85}
      >
        <Txt
          ref={byteTxts}
          text={BYTES[i]}
          fontFamily={MONO}
          fontSize={36}
          fontWeight={700}
          fill={BYTE_COLORS[i]}
        />
      </Rect>,
    );
  }

  // ── 内存槽 ──
  const SLOT_Y = 140;
  const ARROW_Y = 230;
  const ADDR_Y = 262;
  for (let i = 0; i < 4; i++) {
    view.add(
      <Rect
        ref={slotBoxes}
        width={SLOT}
        height={88}
        radius={12}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        x={byteRowX(i)}
        y={SLOT_Y}
        opacity={0}
        scale={0.9}
      >
        <Txt
          ref={slotTxts}
          text={'··'}
          fontFamily={MONO}
          fontSize={32}
          fontWeight={700}
          fill={MUTED}
        />
      </Rect>,
    );
  }

  // 低地址 → 高地址（大端 / 小端写入共用）
  view.add(
    <Txt
      ref={lowAddr}
      text={'低地址'}
      fontFamily={MONO}
      fontSize={22}
      fontWeight={700}
      fill={ACCENT}
      x={byteRowX(0)}
      y={ADDR_Y}
      opacity={0}
    />,
  );
  view.add(
    <Txt
      ref={highAddr}
      text={'高地址'}
      fontFamily={MONO}
      fontSize={22}
      fontWeight={700}
      fill={ACCENT}
      x={byteRowX(3)}
      y={ADDR_Y}
      opacity={0}
    />,
  );
  view.add(
    <Line
      ref={addrArrow}
      points={[
        [byteRowX(0) + 52, ARROW_Y],
        [byteRowX(3) - 52, ARROW_Y],
      ]}
      stroke={ACCENT}
      lineWidth={3}
      lineCap={'round'}
      endArrow
      arrowSize={14}
      end={0}
      opacity={0}
    />,
  );

  view.add(
    <Txt
      ref={modeLabel}
      text={''}
      fontFamily={MONO}
      fontSize={36}
      fontWeight={700}
      fill={BIG}
      y={320}
      opacity={0}
    />,
  );

  // ── 最终对照 ──
  view.add(
    <Layout
      ref={compare}
      layout
      direction={'column'}
      gap={28}
      y={40}
      opacity={0}
      scale={0.96}
    >
      <Layout layout direction={'row'} gap={28} alignItems={'center'}>
        <Layout
          layout
          direction={'row'}
          gap={12}
          alignItems={'center'}
          width={360}
        >
          <Txt
            ref={beName}
            text={'大端'}
            fontFamily={MONO}
            fontSize={28}
            fontWeight={700}
            fill={BIG}
          />
          {/* 别名：大端 = 网络字节序（划入展开） */}
          <Layout
            ref={beAlias}
            layout
            direction={'row'}
            gap={10}
            alignItems={'center'}
            opacity={0}
            scale={0.9}
          >
            <Txt
              ref={beAliasEq}
              text={'='}
              fontFamily={MONO}
              fontSize={28}
              fontWeight={700}
              fill={MUTED}
            />
            <Rect
              layout
              padding={[8, 16]}
              radius={8}
              fill={'#0a0e14'}
              stroke={BIG}
              lineWidth={2}
              lineDash={[7, 5]}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt
                ref={beAliasTxt}
                text={'网络字节序'}
                fontFamily={MONO}
                fontSize={24}
                fontWeight={700}
                fill={BIG}
              />
            </Rect>
          </Layout>
        </Layout>
        <Layout layout direction={'row'} gap={GAP}>
          {BYTES.map((b, i) => (
            <Rect
              layout
              width={SLOT}
              height={72}
              radius={10}
              fill={CARD}
              stroke={BIG}
              lineWidth={2}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt
                text={b}
                fontFamily={MONO}
                fontSize={28}
                fontWeight={700}
                fill={BYTE_COLORS[i]}
              />
            </Rect>
          ))}
        </Layout>
        <Layout layout direction={'row'} gap={12} alignItems={'center'}>
          {BE_TAGS.map(t => makeTag(t, BIG, beTags))}
        </Layout>
      </Layout>
      <Layout layout direction={'row'} gap={28} alignItems={'center'}>
        <Layout
          layout
          direction={'row'}
          gap={12}
          alignItems={'center'}
          width={360}
        >
          <Txt
            ref={leName}
            text={'小端'}
            fontFamily={MONO}
            fontSize={28}
            fontWeight={700}
            fill={LITTLE}
          />
          {/* 别名：小端 = 主机字节序 */}
          <Layout
            ref={leAlias}
            layout
            direction={'row'}
            gap={10}
            alignItems={'center'}
            opacity={0}
            scale={0.9}
          >
            <Txt
              ref={leAliasEq}
              text={'='}
              fontFamily={MONO}
              fontSize={28}
              fontWeight={700}
              fill={MUTED}
            />
            <Rect
              layout
              padding={[8, 16]}
              radius={8}
              fill={'#0a0e14'}
              stroke={LITTLE}
              lineWidth={2}
              lineDash={[7, 5]}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt
                ref={leAliasTxt}
                text={'主机字节序'}
                fontFamily={MONO}
                fontSize={24}
                fontWeight={700}
                fill={LITTLE}
              />
            </Rect>
          </Layout>
        </Layout>
        <Layout layout direction={'row'} gap={GAP}>
          {[...BYTES].reverse().map((b, i) => (
            <Rect
              layout
              width={SLOT}
              height={72}
              radius={10}
              fill={CARD}
              stroke={LITTLE}
              lineWidth={2}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt
                text={b}
                fontFamily={MONO}
                fontSize={28}
                fontWeight={700}
                fill={BYTE_COLORS[3 - i]}
              />
            </Rect>
          ))}
        </Layout>
        <Layout layout direction={'row'} gap={12} alignItems={'center'}>
          {LE_TAGS.map(t => makeTag(t, LITTLE, leTags))}
        </Layout>
      </Layout>
    </Layout>,
  );

  // ════════ 动画 ════════
  yield* title().show();
  yield* waitFor(0.15);

  yield* all(
    valueCard().opacity(1, 0.4, easeOutCubic),
    valueCard().scale(1, 0.45, easeOutBack),
  );
  yield* waitFor(0.45);

  yield* all(
    ...byteCards.map((c, i) =>
      delay(
        i * 0.08,
        all(
          c.opacity(1, 0.35, easeOutCubic),
          c.scale(1, 0.4, easeOutBack),
        ),
      ),
    ),
  );
  yield* waitFor(0.45);

  yield* all(
    ...slotBoxes.map((s, i) =>
      delay(
        i * 0.06,
        all(
          s.opacity(1, 0.35, easeOutCubic),
          s.scale(1, 0.4, easeOutBack),
        ),
      ),
    ),
  );
  yield* waitFor(0.15);
  // 标注地址方向：低 → 高
  yield* all(
    lowAddr().opacity(1, 0.3, easeOutCubic),
    highAddr().opacity(1, 0.3, easeOutCubic),
    addrArrow().opacity(0.9, 0.25, easeOutCubic),
    addrArrow().end(1, 0.55, easeInOutCubic),
  );
  yield* waitFor(0.3);

  // ── 大端写入：字节 i → 槽 i ──
  modeLabel().text('大端序');
  modeLabel().fill(BIG);
  yield* modeLabel().opacity(1, 0.3, easeOutCubic);
  yield* waitFor(0.25);

  for (let i = 0; i < 4; i++) {
    yield* all(
      byteCards[i].scale(1.12, 0.18, easeOutBack),
      slotBoxes[i].stroke(BIG, 0.2, easeOutCubic),
      slotBoxes[i].lineWidth(3, 0.2, easeOutCubic),
    );
    slotTxts[i].text(BYTES[i]);
    slotTxts[i].fill(BYTE_COLORS[i]);
    yield* all(
      slotTxts[i].scale(0.7, 0).to(1, 0.28, easeOutBack),
      byteCards[i].scale(1, 0.2, easeOutCubic),
    );
    yield* waitFor(0.12);
  }
  yield* waitFor(0.9);

  // 清空槽，准备小端
  yield* all(
    modeLabel().opacity(0, 0.2, easeOutCubic),
    ...slotBoxes.map(s =>
      all(
        s.stroke(LINE, 0.25, easeOutCubic),
        s.lineWidth(2, 0.25, easeOutCubic),
      ),
    ),
    ...slotTxts.map(t =>
      all(t.opacity(0, 0.2, easeOutCubic), t.scale(0.8, 0.2, easeOutCubic)),
    ),
  );
  for (const t of slotTxts) {
    t.text('··');
    t.fill(MUTED);
    t.opacity(1);
    t.scale(1);
  }

  // ── 小端写入：字节 (3-i) → 槽 i ──
  modeLabel().text('小端序');
  modeLabel().fill(LITTLE);
  yield* modeLabel().opacity(1, 0.3, easeOutCubic);
  yield* waitFor(0.25);

  for (let i = 0; i < 4; i++) {
    const src = 3 - i;
    yield* all(
      byteCards[src].scale(1.12, 0.18, easeOutBack),
      slotBoxes[i].stroke(LITTLE, 0.2, easeOutCubic),
      slotBoxes[i].lineWidth(3, 0.2, easeOutCubic),
    );
    slotTxts[i].text(BYTES[src]);
    slotTxts[i].fill(BYTE_COLORS[src]);
    yield* all(
      slotTxts[i].scale(0.7, 0).to(1, 0.28, easeOutBack),
      byteCards[src].scale(1, 0.2, easeOutCubic),
    );
    yield* waitFor(0.12);
  }
  yield* waitFor(1.0);

  // ── 收束：隐去过程，展示对照 ──
  yield* all(
    valueCard().opacity(0, 0.35, easeOutCubic),
    ...byteCards.map(c => c.opacity(0, 0.35, easeOutCubic)),
    ...slotBoxes.map(s => s.opacity(0, 0.35, easeOutCubic)),
    lowAddr().opacity(0, 0.35, easeOutCubic),
    highAddr().opacity(0, 0.35, easeOutCubic),
    addrArrow().opacity(0, 0.35, easeOutCubic),
    modeLabel().opacity(0, 0.35, easeOutCubic),
  );

  yield* waitFor(0.15);
  yield* all(
    compare().opacity(1, 0.45, easeOutCubic),
    compare().scale(1, 0.5, easeOutBack),
  );
  yield* waitFor(0.25);

  // 应用场景 tag 依次弹出：先大端，再小端
  for (const tag of beTags) {
    yield* all(
      tag.opacity(1, 0.28, easeOutCubic),
      tag.scale(1, 0.32, easeOutBack),
    );
    yield* waitFor(0.12);
  }
  yield* waitFor(0.2);
  for (const tag of leTags) {
    yield* all(
      tag.opacity(1, 0.28, easeOutCubic),
      tag.scale(1, 0.32, easeOutBack),
    );
    yield* waitFor(0.12);
  }

  yield* waitFor(0.45);

  // 别名展开（与 tag 不同）：名称轻跳 → 「=」+ 虚线别名牌滑入
  yield* beName().scale(1.18, 0.22, easeOutBack);
  yield* all(
    beAlias().opacity(1, 0.35, easeOutCubic),
    beAlias().scale(1, 0.4, easeOutBack),
    beName().scale(1, 0.25, easeOutCubic),
    beAliasEq().scale(0.6, 0).to(1.2, 0.2, easeOutBack).to(1, 0.15),
  );
  yield* waitFor(0.45);

  yield* leName().scale(1.18, 0.22, easeOutBack);
  yield* all(
    leAlias().opacity(1, 0.35, easeOutCubic),
    leAlias().scale(1, 0.4, easeOutBack),
    leName().scale(1, 0.25, easeOutCubic),
    leAliasEq().scale(0.6, 0).to(1.2, 0.2, easeOutBack).to(1, 0.15),
  );

  yield* waitFor(1.8);
});
