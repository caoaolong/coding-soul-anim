import {Img, Rect, Txt, View2D, makeScene2D} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import compressIcon from '../../assets/icons/压缩.svg';
import {SceneTitle} from '../../components/title/scene_title';
import {FONT} from '../../theme/fonts';

const BG = '#0a0e14';
const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const RED = '#ff6b8a';
const GREEN = '#3ddc97';

const VIEW_HALF = 960;
const ICON_SIZE = 110;
const GATE = ICON_SIZE * 0.42;
const MASK_H = 96;
const MASK_W = VIEW_HALF - GATE;
const LEFT_MASK_X = -(VIEW_HALF + GATE) / 2;
const RIGHT_MASK_X = (VIEW_HALF + GATE) / 2;

/** 三行竖直中心 */
const ROW_YS = [-210, 20, 250] as const;
/** 每行循环次数 */
const CYCLES = 10;
const MONO = '"Cascadia Mono", "Consolas", "Courier New", monospace';

type Lane = {
  icon: ReturnType<typeof createRef<Img>>;
  leftMask: ReturnType<typeof createRef<Rect>>;
  rightMask: ReturnType<typeof createRef<Rect>>;
  inCard: ReturnType<typeof createRef<Rect>>;
  inTxt: ReturnType<typeof createRef<Txt>>;
  outCard: ReturnType<typeof createRef<Rect>>;
  outTxt: ReturnType<typeof createRef<Txt>>;
  ratioTxt: ReturnType<typeof createRef<Txt>>;
  y: number;
};

/**
 * 压缩循环（三行）：
 * 左侧滑入随机行程串（如 AAAABBB）→ 中央压缩图标 →
 * 右侧飞出 RLE（4A3B）+ 压缩率%，越高越绿、越低越红。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const labelIn = createRef<Txt>();
  const labelOut = createRef<Txt>();

  view.add(<SceneTitle ref={title} text={'数据压缩'} />);
  view.add(
    <Txt
      ref={labelIn}
      text={'原始串'}
      fontFamily={FONT}
      fontSize={20}
      fill={ACCENT}
      x={-520}
      y={-340}
      opacity={0}
    />,
  );
  view.add(
    <Txt
      ref={labelOut}
      text={'RLE 压缩'}
      fontFamily={FONT}
      fontSize={20}
      fill={ACCENT}
      x={520}
      y={-340}
      opacity={0}
    />,
  );

  const lanes: Lane[] = ROW_YS.map(y => createLane(view, y));

  yield* title().show();
  yield* all(
    ...lanes.map(l =>
      all(
        l.icon().opacity(1, 0.4, easeOutCubic),
        l.icon().scale(1, 0.45, easeOutCubic),
      ),
    ),
    labelIn().opacity(0.9, 0.4, easeOutCubic),
    labelOut().opacity(0.9, 0.4, easeOutCubic),
  );
  yield* waitFor(0.3);

  // 三行错相并行循环
  yield* all(
    playLane(lanes[0], 0),
    playLane(lanes[1], 0.35),
    playLane(lanes[2], 0.7),
  );

  yield* waitFor(0.8);
});

function createLane(view: View2D, y: number): Lane {
  const lane: Lane = {
    icon: createRef<Img>(),
    leftMask: createRef<Rect>(),
    rightMask: createRef<Rect>(),
    inCard: createRef<Rect>(),
    inTxt: createRef<Txt>(),
    outCard: createRef<Rect>(),
    outTxt: createRef<Txt>(),
    ratioTxt: createRef<Txt>(),
    y,
  };

  view.add(
    <Rect
      ref={lane.leftMask}
      x={LEFT_MASK_X}
      y={y}
      width={MASK_W}
      height={MASK_H}
      clip
      zIndex={5}
    >
      <Rect
        ref={lane.inCard}
        layout
        direction={'row'}
        alignItems={'center'}
        padding={[12, 20]}
        fill={DEEP}
        stroke={ACCENT}
        lineWidth={2}
        radius={10}
        x={worldToLocal(LEFT_MASK_X, -520)}
        opacity={0}
        scale={0.92}
      >
        <Txt
          ref={lane.inTxt}
          text={''}
          fontFamily={MONO}
          fontSize={28}
          fontWeight={700}
          fill={PAPER}
        />
      </Rect>
    </Rect>,
  );

  view.add(
    <Rect
      ref={lane.rightMask}
      x={RIGHT_MASK_X}
      y={y}
      width={MASK_W}
      height={MASK_H}
      clip
      zIndex={5}
    >
      <Rect
        ref={lane.outCard}
        layout
        direction={'row'}
        alignItems={'center'}
        gap={14}
        padding={[12, 20]}
        fill={DEEP}
        stroke={GREEN}
        lineWidth={2}
        radius={10}
        x={worldToLocal(RIGHT_MASK_X, 0)}
        opacity={0}
        scale={0.92}
      >
        <Txt
          ref={lane.outTxt}
          text={''}
          fontFamily={MONO}
          fontSize={28}
          fontWeight={700}
          fill={PAPER}
        />
        <Txt
          ref={lane.ratioTxt}
          text={''}
          fontFamily={MONO}
          fontSize={24}
          fontWeight={700}
          fill={GREEN}
        />
      </Rect>
    </Rect>,
  );

  view.add(
    <Img
      ref={lane.icon}
      src={compressIcon}
      width={ICON_SIZE}
      height={ICON_SIZE}
      x={0}
      y={y}
      opacity={0}
      scale={0.9}
      zIndex={20}
    />,
  );

  return lane;
}

function* playLane(lane: Lane, startDelay: number): ThreadGenerator {
  yield* waitFor(startDelay);

  const enterFrom = worldToLocal(LEFT_MASK_X, -520);
  const enterTo = worldToLocal(LEFT_MASK_X, GATE + 36);
  const exitFrom = worldToLocal(RIGHT_MASK_X, -GATE - 36);
  const exitRead = worldToLocal(RIGHT_MASK_X, 520);
  const exitGone = worldToLocal(RIGHT_MASK_X, 900);

  for (let i = 0; i < CYCLES; i++) {
    const raw = randomRunString();
    const encoded = rleEncode(raw);
    const ratio = compressionRatio(raw, encoded); // 0..1 节省比例
    const color = ratioColor(ratio);
    const pct = `${Math.round(ratio * 100)}%`;

    lane.inTxt().text(raw);
    lane.inCard().x(enterFrom);
    lane.inCard().opacity(0);
    lane.inCard().scale(0.92);

    lane.outTxt().text(encoded);
    lane.ratioTxt().text(pct);
    lane.ratioTxt().fill(color);
    lane.outCard().stroke(color);
    lane.outCard().opacity(0);
    lane.outCard().x(exitFrom);
    lane.outCard().scale(0.92);

    yield* all(
      lane.inCard().opacity(1, 0.28, easeOutCubic),
      lane.inCard().scale(1, 0.32, easeOutCubic),
    );
    yield* waitFor(0.18);
    yield* lane.inCard().x(enterTo, 0.7, easeInOutCubic);
    lane.inCard().opacity(0);

    yield* lane
      .icon()
      .scale(1.12, 0.12, easeOutCubic)
      .to(1, 0.16, easeInOutCubic);
    yield* waitFor(0.04);

    lane.outCard().opacity(1);
    lane.outCard().scale(1);
    lane.outCard().x(exitFrom);

    yield* lane.outCard().x(exitRead, 0.75, easeInOutCubic);
    yield* waitFor(0.45);
    yield* all(
      lane.outCard().x(exitGone, 0.42, easeInOutCubic),
      delay(0.1, lane.outCard().opacity(0, 0.3, easeInOutCubic)),
    );
    yield* waitFor(0.12);
  }
}

function worldToLocal(maskX: number, worldX: number): number {
  return worldX - maskX;
}

/** AAAABBB → 4A3B */
function rleEncode(input: string): string {
  if (!input) return '';
  let out = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    let n = 1;
    while (i + n < input.length && input[i + n] === ch) n++;
    out += `${n}${ch}`;
    i += n;
  }
  return out;
}

/** 压缩率：节省比例 (0~1)，越高越好 */
function compressionRatio(raw: string, encoded: string): number {
  if (raw.length === 0) return 0;
  return Math.max(0, Math.min(1, 1 - encoded.length / raw.length));
}

/** 压缩率 → 红→黄→绿 */
function ratioColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  if (t < 0.5) {
    return lerpHex(RED, '#ffb020', t * 2);
  }
  return lerpHex('#ffb020', GREEN, (t - 0.5) * 2);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

const LETTERS = 'ABCDEFGH';

/** 随机连续行程串，如 AAAABBBCC */
function randomRunString(): string {
  const runs = 2 + Math.floor(Math.random() * 3); // 2~4 段
  let s = '';
  let last = -1;
  for (let r = 0; r < runs; r++) {
    let li = Math.floor(Math.random() * LETTERS.length);
    if (li === last) li = (li + 1) % LETTERS.length;
    last = li;
    const n = 2 + Math.floor(Math.random() * 5); // 2~6
    s += LETTERS[li].repeat(n);
  }
  return s;
}
