import {Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createRefArray,
  delay,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {SceneTitle} from '../components/title/scene_title';

const BG = '#0a0e14';
const CARD = '#121820';
const LINE = '#2a3a4c';
const CHAR_COLOR = '#e8eef7';
const MUTED = '#6a7a8c';
const ACCENT = '#3dd6c6';
const DIM = '#3a4555';
/** 首字节 */
const LEAD_COLOR = '#3dd6c6';
/** 续字节最高 2 bit（固定 10） */
const CONT_PREFIX_COLOR = '#7aa2ff';
/** 数据载荷位 */
const DATA_COLOR = '#f0a060';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

/** 演示用符号（可改成任意 Unicode 字符） */
const SYMBOL = '你';

function toUtf8Bytes(ch: string): number[] {
  return [...new TextEncoder().encode(ch)];
}

function toBinByte(b: number): string {
  return b.toString(2).padStart(8, '0');
}

/** UTF-8 首字节中「长度前缀」所占比特数 */
function leadPrefixBitCount(byteLen: number): number {
  if (byteLen <= 1) return 1;
  if (byteLen === 2) return 3;
  if (byteLen === 3) return 4;
  return 5;
}

function codePointLabel(ch: string): string {
  const cp = ch.codePointAt(0)!;
  return 'U+' + cp.toString(16).toUpperCase().padStart(cp > 0xffff ? 5 : 4, '0');
}

/**
 * 符号 → UTF-8 二进制字节，再分步高亮：
 * 1) 首字节 +「平面前缀」
 * 2) 续字节最高 2 bit
 * 3) 续字节数据位（低 6 bit；首字节不再高亮）
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const bytes = toUtf8Bytes(SYMBOL);
  const cpLabel = codePointLabel(SYMBOL);
  const leadBits = toBinByte(bytes[0]);
  const leadPrefN = leadPrefixBitCount(bytes.length);
  const leadPrefStr = leadBits.slice(0, leadPrefN);
  const leadDataStr = leadBits.slice(leadPrefN);

  const title = createRef<SceneTitle>();
  const charBox = createRef<Rect>();
  const charTxt = createRef<Txt>();
  const cpTxt = createRef<Txt>();
  const arrow = createRef<Line>();
  const utf8Label = createRef<Txt>();
  const byteRow = createRef<Layout>();
  const byteBoxes = createRefArray<Rect>();
  const leadPrefixTxt = createRef<Txt>();
  const leadDataTxt = createRef<Txt>();
  const contPrefixTxts = createRefArray<Txt>();
  const contDataTxts = createRefArray<Txt>();
  const caption = createRef<Txt>();

  view.add(<SceneTitle ref={title} text={'UTF-8 编码'} />);

  view.add(
    <Rect
      ref={charBox}
      layout
      direction={'column'}
      gap={16}
      padding={[36, 56]}
      radius={16}
      fill={CARD}
      stroke={LINE}
      lineWidth={2}
      alignItems={'center'}
      y={-200}
      opacity={0}
      scale={0.9}
    >
      <Txt
        ref={charTxt}
        text={SYMBOL}
        fontFamily={MONO}
        fontSize={120}
        fontWeight={700}
        fill={CHAR_COLOR}
      />
      <Txt
        ref={cpTxt}
        text={cpLabel}
        fontFamily={MONO}
        fontSize={28}
        fill={MUTED}
      />
    </Rect>,
  );

  view.add(
    <Line
      ref={arrow}
      points={[
        [0, -40],
        [0, 40],
      ]}
      stroke={MUTED}
      lineWidth={3}
      lineCap={'round'}
      endArrow
      arrowSize={14}
      y={-10}
      end={0}
      opacity={0}
    />,
  );

  view.add(
    <Txt
      ref={utf8Label}
      text={'UTF-8'}
      fontFamily={MONO}
      fontSize={22}
      fill={ACCENT}
      y={60}
      opacity={0}
    />,
  );

  view.add(
    <Layout
      ref={byteRow}
      layout
      direction={'row'}
      gap={18}
      alignItems={'center'}
      justifyContent={'center'}
      y={160}
    />,
  );

  view.add(
    <Txt
      ref={caption}
      text={''}
      fontFamily={MONO}
      fontSize={32}
      fontWeight={700}
      fill={ACCENT}
      y={320}
      opacity={0}
    />,
  );

  // ── 首字节：前缀 + 数据（初始同色，看起来像整段） ──
  byteRow().add(
    <Rect
      ref={byteBoxes}
      layout
      width={210}
      height={72}
      radius={12}
      fill={CARD}
      stroke={LEAD_COLOR}
      lineWidth={3}
      alignItems={'center'}
      justifyContent={'center'}
      opacity={0}
      scale={0.85}
    >
      <Layout layout direction={'row'} alignItems={'center'}>
        <Txt
          ref={leadPrefixTxt}
          text={leadPrefStr}
          fontFamily={MONO}
          fontSize={26}
          fontWeight={700}
          fill={LEAD_COLOR}
        />
        <Txt
          ref={leadDataTxt}
          text={leadDataStr}
          fontFamily={MONO}
          fontSize={26}
          fontWeight={700}
          fill={LEAD_COLOR}
        />
      </Layout>
    </Rect>,
  );

  // ── 续字节：最高 2 bit + 载荷 ──
  for (let i = 1; i < bytes.length; i++) {
    const bits = toBinByte(bytes[i]);
    byteRow().add(
      <Rect
        ref={byteBoxes}
        layout
        width={210}
        height={72}
        radius={12}
        fill={CARD}
        stroke={CONT_PREFIX_COLOR}
        lineWidth={2.5}
        alignItems={'center'}
        justifyContent={'center'}
        opacity={0}
        scale={0.85}
      >
        <Layout layout direction={'row'} alignItems={'center'}>
          <Txt
            ref={contPrefixTxts}
            text={bits.slice(0, 2)}
            fontFamily={MONO}
            fontSize={26}
            fontWeight={700}
            fill={CONT_PREFIX_COLOR}
          />
          <Txt
            ref={contDataTxts}
            text={bits.slice(2)}
            fontFamily={MONO}
            fontSize={26}
            fontWeight={700}
            fill={DATA_COLOR}
          />
        </Layout>
      </Rect>,
    );
  }

  yield* title().show();
  yield* waitFor(0.15);

  yield* all(
    charBox().opacity(1, 0.45, easeOutCubic),
    charBox().scale(1, 0.5, easeOutBack),
  );
  yield* waitFor(0.45);

  arrow().opacity(1);
  yield* all(
    arrow().end(1, 0.4, easeOutCubic),
    utf8Label().opacity(1, 0.35, easeOutCubic),
  );
  yield* waitFor(0.2);

  const byteAnims = byteBoxes.map((box, i) =>
    delay(
      i * 0.12,
      all(
        box.opacity(1, 0.35, easeOutCubic),
        box.scale(1, 0.4, easeOutBack),
      ),
    ),
  );
  if (byteAnims.length > 0) yield* all(...byteAnims);
  yield* waitFor(0.55);

  /** 恢复到入场后的常态，再进入下一轮高亮 */
  const restoreNormal = function* (duration = 0.35) {
    yield* all(
      caption().opacity(0, duration * 0.8, easeOutCubic),
      byteBoxes[0].opacity(1, duration, easeOutCubic),
      byteBoxes[0].scale(1, duration, easeOutCubic),
      byteBoxes[0].lineWidth(3, duration, easeOutCubic),
      leadPrefixTxt().fill(LEAD_COLOR, duration, easeOutCubic),
      leadPrefixTxt().scale(1, duration, easeOutCubic),
      leadDataTxt().fill(LEAD_COLOR, duration, easeOutCubic),
      leadDataTxt().scale(1, duration, easeOutCubic),
      ...byteBoxes.slice(1).map(b =>
        all(
          b.opacity(1, duration, easeOutCubic),
          b.scale(1, duration, easeOutCubic),
          b.lineWidth(2.5, duration, easeOutCubic),
        ),
      ),
      ...contPrefixTxts.map(t =>
        all(
          t.fill(CONT_PREFIX_COLOR, duration, easeOutCubic),
          t.scale(1, duration, easeOutCubic),
        ),
      ),
      ...contDataTxts.map(t =>
        all(
          t.fill(DATA_COLOR, duration, easeOutCubic),
          t.scale(1, duration, easeOutCubic),
        ),
      ),
    );
  };

  // ── 1) 高亮首字节 + 底部「平面前缀」 ──
  caption().text('平面前缀');
  caption().fill(LEAD_COLOR);
  yield* all(
    byteBoxes[0].scale(1.12, 0.4, easeOutCubic),
    byteBoxes[0].lineWidth(4, 0.4, easeOutCubic),
    leadPrefixTxt().fill(LEAD_COLOR, 0.35, easeOutCubic),
    leadDataTxt().fill(LEAD_COLOR, 0.35, easeOutCubic),
    ...byteBoxes
      .slice(1)
      .map(b =>
        all(
          b.opacity(0.35, 0.35, easeOutCubic),
          b.scale(0.92, 0.35, easeOutCubic),
        ),
      ),
    ...contPrefixTxts.map(t => t.fill(DIM, 0.35, easeOutCubic)),
    ...contDataTxts.map(t => t.fill(DIM, 0.35, easeOutCubic)),
    caption().opacity(1, 0.4, easeOutCubic),
  );
  yield* waitFor(0.85);
  yield* restoreNormal();
  yield* waitFor(0.2);

  // ── 2) 高亮续字节最高 2 bit ──
  caption().text('续字节前缀');
  caption().fill(CONT_PREFIX_COLOR);
  yield* all(
    byteBoxes[0].opacity(0.35, 0.35, easeOutCubic),
    byteBoxes[0].scale(0.92, 0.35, easeOutCubic),
    leadPrefixTxt().fill(DIM, 0.35, easeOutCubic),
    leadDataTxt().fill(DIM, 0.35, easeOutCubic),
    ...byteBoxes.slice(1).map(b =>
      all(
        b.opacity(1, 0.35, easeOutCubic),
        b.scale(1.08, 0.4, easeOutCubic),
        b.lineWidth(3.5, 0.35, easeOutCubic),
      ),
    ),
    ...contPrefixTxts.map(t =>
      all(
        t.fill(CONT_PREFIX_COLOR, 0.35, easeOutCubic),
        t.scale(1.15, 0.4, easeOutBack),
      ),
    ),
    ...contDataTxts.map(t => t.fill(DIM, 0.35, easeOutCubic)),
    caption().opacity(1, 0.4, easeOutCubic),
  );
  yield* waitFor(0.85);
  yield* restoreNormal();
  yield* waitFor(0.2);

  // ── 3) 高亮数据位：仅续字节低 6 bit ──
  caption().text('数据位');
  caption().fill(DATA_COLOR);
  yield* all(
    byteBoxes[0].opacity(0.35, 0.35, easeOutCubic),
    byteBoxes[0].scale(0.92, 0.35, easeOutCubic),
    leadPrefixTxt().fill(DIM, 0.35, easeOutCubic),
    leadDataTxt().fill(DIM, 0.35, easeOutCubic),
    ...byteBoxes.slice(1).map(b =>
      all(
        b.opacity(1, 0.35, easeOutCubic),
        b.scale(1.06, 0.4, easeOutCubic),
        b.lineWidth(2.5, 0.35, easeOutCubic),
      ),
    ),
    ...contPrefixTxts.map(t =>
      all(
        t.fill(DIM, 0.35, easeOutCubic),
        t.scale(1, 0.35, easeOutCubic),
      ),
    ),
    ...contDataTxts.map(t =>
      all(
        t.fill(DATA_COLOR, 0.35, easeOutCubic),
        t.scale(1.12, 0.4, easeOutBack),
      ),
    ),
    caption().opacity(1, 0.4, easeOutCubic),
  );
  yield* waitFor(0.85);
  yield* restoreNormal();
  yield* waitFor(0.8);
});
