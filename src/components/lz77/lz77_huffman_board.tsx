import {Circle, Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';
import {SceneTitle} from '../title/scene_title';
import {
  TOKEN_COLOR_LITERAL,
  TOKEN_COLOR_LONG,
  TOKEN_COLOR_SHORT,
  encodeLz77Tokens,
  type Lz77Token,
} from './lz77_token_style';
import {Lz77TokenTags} from './lz77_token_tags';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const CARD = '#121820';
const DEEP = '#0e141c';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const GOLD = '#ffb454';
const BLUE = '#7aa2ff';
const GREEN = '#a3e635';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

/** 与 lz77.tsx 保持完全一致的输入与窗口参数 */
export const LZ77_DEMO_TEXT = 'abracadabra abracadabra';
export const LZ77_DEMO_WINDOW = 12;
export const LZ77_DEMO_LOOKAHEAD = 8;

interface FreqItem {
  id: string;
  label: string;
  count: number;
  color: string;
  code: string;
  tagIndices: number[];
}

/** 字面量 + 匹配长度频次（共 11 次，按频次降序） */
const LIT_LEN_FREQ: FreqItem[] = [
  {id: 'lit-a', label: "'a'", count: 3, color: TOKEN_COLOR_LITERAL, code: '00', tagIndices: [0, 3, 5]},
  {id: 'lit-b', label: "'b'", count: 1, color: TOKEN_COLOR_LITERAL, code: '0100', tagIndices: [1]},
  {id: 'lit-r', label: "'r'", count: 1, color: TOKEN_COLOR_LITERAL, code: '0101', tagIndices: [2]},
  {id: 'lit-c', label: "'c'", count: 1, color: TOKEN_COLOR_LITERAL, code: '0110', tagIndices: [4]},
  {id: 'lit-d', label: "'d'", count: 1, color: TOKEN_COLOR_LITERAL, code: '0111', tagIndices: [6]},
  {id: 'lit-sp', label: "'␣'", count: 1, color: TOKEN_COLOR_LITERAL, code: '100', tagIndices: [8]},
  {id: 'len-4', label: '4', count: 1, color: TOKEN_COLOR_LONG, code: '101', tagIndices: [7]},
  {id: 'len-8', label: '8', count: 1, color: TOKEN_COLOR_LONG, code: '110', tagIndices: [9]},
  {id: 'len-3', label: '3', count: 1, color: TOKEN_COLOR_SHORT, code: '111', tagIndices: [10]},
];

/** 偏移距离频次（共 3 次，按频次降序） */
const DIST_FREQ: FreqItem[] = [
  {id: 'dist-7', label: '7', count: 2, color: GOLD, code: '0', tagIndices: [7, 10]},
  {id: 'dist-12', label: '12', count: 1, color: BLUE, code: '1', tagIndices: [9]},
];

interface InternalNodeSpec {
  id: string;
  weight: number;
  x: number;
  y: number;
  color: string;
  level: number;
}

interface LeafNodeSpec {
  id: string;
  label: string;
  code: string;
  x: number;
  y: number;
  color: string;
}

interface TreeEdgeSpec {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  level: number;
}

const NODE_R = 16; // 内部圆节点半径 (size=32)
const LEAF_H = 56; // 叶子高度 (半高 28)

/**
 * 树 ①（字面量/长度树，根权重 11）坐标（相对左面板中心）
 * 层间距 70px，保证父圆底沿到子节点顶沿有充足连线空间，无任何重叠
 */
const LEFT_LEAF_SPECS: LeafNodeSpec[] = [
  {id: 'lit-a', label: "'a'", code: '00', x: -460, y: 10, color: TOKEN_COLOR_LITERAL},
  {id: 'lit-b', label: "'b'", code: '0100', x: -340, y: 150, color: TOKEN_COLOR_LITERAL},
  {id: 'lit-r', label: "'r'", code: '0101', x: -225, y: 150, color: TOKEN_COLOR_LITERAL},
  {id: 'lit-c', label: "'c'", code: '0110', x: -110, y: 150, color: TOKEN_COLOR_LITERAL},
  {id: 'lit-d', label: "'d'", code: '0111', x: 5, y: 150, color: TOKEN_COLOR_LITERAL},
  {id: 'lit-sp', label: "'␣'", code: '100', x: 125, y: 80, color: TOKEN_COLOR_LITERAL},
  {id: 'len-4', label: '4', code: '101', x: 240, y: 80, color: TOKEN_COLOR_LONG},
  {id: 'len-8', label: '8', code: '110', x: 355, y: 80, color: TOKEN_COLOR_LONG},
  {id: 'len-3', label: '3', code: '111', x: 470, y: 80, color: TOKEN_COLOR_SHORT},
];

const LEFT_INTERNAL_SPECS: InternalNodeSpec[] = [
  // level 1 (1+1 -> 2)
  {id: 'n2-br', weight: 2, x: -282.5, y: 80, color: TOKEN_COLOR_LITERAL, level: 1},
  {id: 'n2-cd', weight: 2, x: -52.5, y: 80, color: TOKEN_COLOR_LITERAL, level: 1},
  {id: 'n2-sp4', weight: 2, x: 182.5, y: 10, color: ACCENT, level: 1},
  {id: 'n2-83', weight: 2, x: 412.5, y: 10, color: ACCENT, level: 1},
  // level 2 (2+2 -> 4)
  {id: 'n4-left', weight: 4, x: -167.5, y: 10, color: TOKEN_COLOR_LITERAL, level: 2},
  {id: 'n4-right', weight: 4, x: 297.5, y: -60, color: ACCENT, level: 2},
  // level 3 (3+4 -> 7)
  {id: 'n7-left', weight: 7, x: -313.75, y: -60, color: TOKEN_COLOR_LITERAL, level: 3},
  // level 4 (7+4 -> 11)
  {id: 'n11-root', weight: 11, x: -8, y: -130, color: PAPER, level: 4},
];

const LEFT_EDGE_SPECS: TreeEdgeSpec[] = [
  // level 1 (internal y -> leaf y - LEAF_H/2)
  {fromX: -282.5, fromY: 80 + NODE_R, toX: -340, toY: 150 - LEAF_H / 2, color: TOKEN_COLOR_LITERAL, level: 1},
  {fromX: -282.5, fromY: 80 + NODE_R, toX: -225, toY: 150 - LEAF_H / 2, color: TOKEN_COLOR_LITERAL, level: 1},
  {fromX: -52.5, fromY: 80 + NODE_R, toX: -110, toY: 150 - LEAF_H / 2, color: TOKEN_COLOR_LITERAL, level: 1},
  {fromX: -52.5, fromY: 80 + NODE_R, toX: 5, toY: 150 - LEAF_H / 2, color: TOKEN_COLOR_LITERAL, level: 1},
  {fromX: 182.5, fromY: 10 + NODE_R, toX: 125, toY: 80 - LEAF_H / 2, color: TOKEN_COLOR_LITERAL, level: 1},
  {fromX: 182.5, fromY: 10 + NODE_R, toX: 240, toY: 80 - LEAF_H / 2, color: TOKEN_COLOR_LONG, level: 1},
  {fromX: 412.5, fromY: 10 + NODE_R, toX: 355, toY: 80 - LEAF_H / 2, color: TOKEN_COLOR_LONG, level: 1},
  {fromX: 412.5, fromY: 10 + NODE_R, toX: 470, toY: 80 - LEAF_H / 2, color: TOKEN_COLOR_SHORT, level: 1},
  // level 2 (internal -> internal)
  {fromX: -167.5, fromY: 10 + NODE_R, toX: -282.5, toY: 80 - NODE_R, color: TOKEN_COLOR_LITERAL, level: 2},
  {fromX: -167.5, fromY: 10 + NODE_R, toX: -52.5, toY: 80 - NODE_R, color: TOKEN_COLOR_LITERAL, level: 2},
  {fromX: 297.5, fromY: -60 + NODE_R, toX: 182.5, toY: 10 - NODE_R, color: ACCENT, level: 2},
  {fromX: 297.5, fromY: -60 + NODE_R, toX: 412.5, toY: 10 - NODE_R, color: ACCENT, level: 2},
  // level 3 ('a' leaf + n4-left -> n7-left)
  {fromX: -313.75, fromY: -60 + NODE_R, toX: -460, toY: 10 - LEAF_H / 2, color: TOKEN_COLOR_LITERAL, level: 3},
  {fromX: -313.75, fromY: -60 + NODE_R, toX: -167.5, toY: 10 - NODE_R, color: TOKEN_COLOR_LITERAL, level: 3},
  // level 4 (n7-left + n4-right -> root)
  {fromX: -8, fromY: -130 + NODE_R, toX: -313.75, toY: -60 - NODE_R, color: TOKEN_COLOR_LITERAL, level: 4},
  {fromX: -8, fromY: -130 + NODE_R, toX: 297.5, toY: -60 - NODE_R, color: ACCENT, level: 4},
];

/**
 * 树 ②（偏移距离树，根权重 3）坐标（相对右面板中心）
 */
const RIGHT_LEAF_SPECS: LeafNodeSpec[] = [
  {id: 'dist-7', label: '7', code: '0', x: -105, y: 45, color: GOLD},
  {id: 'dist-12', label: '12', code: '1', x: 105, y: 45, color: BLUE},
];

const RIGHT_ROOT_SPEC: InternalNodeSpec = {
  id: 'dist-root',
  weight: 3,
  x: 0,
  y: -70,
  color: GOLD,
  level: 1,
};

const RIGHT_EDGE_SPECS: TreeEdgeSpec[] = [
  {fromX: 0, fromY: -70 + 18, toX: -105, toY: 45 - 30, color: GOLD, level: 1},
  {fromX: 0, fromY: -70 + 18, toX: 105, toY: 45 - 30, color: BLUE, level: 1},
];

interface EncodedTokenBlock {
  bitsText: string;
  bitCount: number;
  color: string;
  litLeafId: string;
  distLeafId?: string;
}

function buildEncodedBlocks(tokens: Lz77Token[]): EncodedTokenBlock[] {
  return tokens.map(t => {
    if (t.kind === 'literal') {
      const ch = t.char === ' ' ? '␣' : t.char;
      const map: Record<string, {code: string; id: string}> = {
        a: {code: '00', id: 'lit-a'},
        b: {code: '0100', id: 'lit-b'},
        r: {code: '0101', id: 'lit-r'},
        c: {code: '0110', id: 'lit-c'},
        d: {code: '0111', id: 'lit-d'},
        '␣': {code: '100', id: 'lit-sp'},
      };
      const entry = map[ch] ?? {code: '00', id: 'lit-a'};
      return {
        bitsText: entry.code,
        bitCount: entry.code.length,
        color: TOKEN_COLOR_LITERAL,
        litLeafId: entry.id,
      };
    }

    const lenMap: Record<number, {code: string; id: string; color: string}> = {
      4: {code: '101', id: 'len-4', color: TOKEN_COLOR_LONG},
      8: {code: '110', id: 'len-8', color: TOKEN_COLOR_LONG},
      3: {code: '111', id: 'len-3', color: TOKEN_COLOR_SHORT},
    };
    const distMap: Record<number, {code: string; id: string}> = {
      7: {code: '0', id: 'dist-7'},
      12: {code: '1', id: 'dist-12'},
    };
    const lEntry = lenMap[t.length];
    const dEntry = distMap[t.offset];
    return {
      bitsText: `${lEntry.code}${dEntry.code}`,
      bitCount: lEntry.code.length + dEntry.code.length,
      color: lEntry.color,
      litLeafId: lEntry.id,
      distLeafId: dEntry.id,
    };
  });
}

export interface Lz77HuffmanBoardProps extends NodeProps {}

/**
 * LZ77 编码结果 → DEFLATE 双树哈夫曼编码演示板（精简无重叠版）
 */
export class Lz77HuffmanBoard extends Node {
  private readonly tokens: Lz77Token[];
  private readonly encodedBlocks: EncodedTokenBlock[];

  private readonly tags = createRef<Lz77TokenTags>();

  // 中部左右大面板
  private readonly leftPanel = createRef<Rect>();
  private readonly rightPanel = createRef<Rect>();
  private readonly leftPanelTitle = createRef<Txt>();
  private readonly rightPanelTitle = createRef<Txt>();

  // 阶段一：频次统计视图
  private readonly leftFreqLayer = createRef<Node>();
  private readonly rightFreqLayer = createRef<Node>();
  private readonly litFreqCols = createRefArray<Rect>();
  private readonly litFreqBars = createRefArray<Rect>();
  private readonly distFreqCols = createRefArray<Rect>();
  private readonly distFreqBars = createRefArray<Rect>();

  // 阶段二：双哈夫曼树视图
  private readonly leftTreeLayer = createRef<Node>();
  private readonly rightTreeLayer = createRef<Node>();
  private readonly leftLeafBoxes = createRefArray<Rect>();
  private readonly leftLeafCodeBoxes = createRefArray<Rect>();
  private readonly leftInternalCircles = createRefArray<Circle>();
  private readonly leftEdgeLines = createRefArray<Line>();

  private readonly rightLeafBoxes = createRefArray<Rect>();
  private readonly rightLeafCodeBoxes = createRefArray<Rect>();
  private readonly rightRootCircle = createRef<Circle>();
  private readonly rightEdgeLines = createRefArray<Line>();

  // 阶段三：底部比特流与压缩率对比
  private readonly bitBlocks = createRefArray<Rect>();
  private readonly compareCard = createRef<Rect>();
  private readonly rawBarFill = createRef<Rect>();
  private readonly huffBarFill = createRef<Rect>();
  private readonly savingBadge = createRef<Rect>();

  private readonly packedBlockXs: number[] = [];

  public constructor(props: Lz77HuffmanBoardProps = {}) {
    super({...props});

    this.tokens = encodeLz77Tokens(
      LZ77_DEMO_TEXT,
      LZ77_DEMO_WINDOW,
      LZ77_DEMO_LOOKAHEAD,
    );
    this.encodedBlocks = buildEncodedBlocks(this.tokens);

    this.buildTopRow();
    this.buildMiddlePanels();
    this.buildBottomStage();
  }

  private buildTopRow() {
    // 与 lz77.tsx 第二屏完全一致的坐标与尺寸
    this.add(
      <Lz77TokenTags
        ref={this.tags}
        tagHeight={76}
        gap={14}
        fontSize={28}
        y={-320}
      />,
    );
    this.tags().build(this.tokens);
    this.tags().showInstant();
  }

  private buildMiddlePanels() {
    // 左侧面板：字面量 / 长度
    this.add(
      <Rect
        ref={this.leftPanel}
        width={1140}
        height={410}
        x={-260}
        y={-40}
        radius={16}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        opacity={0}
        scale={0.96}
      >
        <Txt
          ref={this.leftPanelTitle}
          text={'字面量 / 长度频次'}
          fontFamily={FONT}
          fontSize={22}
          fontWeight={700}
          fill={PAPER}
          y={-172}
        />
        <Node ref={this.leftFreqLayer} />
        <Node ref={this.leftTreeLayer} opacity={0} />
      </Rect>,
    );

    // 右侧面板：偏移距离
    this.add(
      <Rect
        ref={this.rightPanel}
        width={500}
        height={410}
        x={600}
        y={-40}
        radius={16}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        opacity={0}
        scale={0.96}
      >
        <Txt
          ref={this.rightPanelTitle}
          text={'距离频次'}
          fontFamily={FONT}
          fontSize={22}
          fontWeight={700}
          fill={GOLD}
          y={-172}
        />
        <Node ref={this.rightFreqLayer} />
        <Node ref={this.rightTreeLayer} opacity={0} />
      </Rect>,
    );

    this.buildFrequencyLayers();
    this.buildTreeLayers();
  }

  private buildFrequencyLayers() {
    // 左侧 9 个符号极简柱状卡片（仅保留：次数、柱条、符号）
    const colSpacing = 116;
    const startX = -((LIT_LEN_FREQ.length - 1) * colSpacing) / 2;

    LIT_LEN_FREQ.forEach((item, i) => {
      const cx = startX + i * colSpacing;
      const isTop = item.count === 3;

      this.leftFreqLayer().add(
        <Rect
          ref={this.litFreqCols}
          width={96}
          height={280}
          x={cx}
          y={22}
          radius={12}
          fill={isTop ? '#1a2230' : DEEP}
          stroke={isTop ? item.color : LINE}
          lineWidth={isTop ? 2.5 : 1.5}
          opacity={0}
          scale={0.88}
        >
          <Txt
            text={`×${item.count}`}
            fontFamily={MONO}
            fontSize={isTop ? 24 : 20}
            fontWeight={700}
            fill={isTop ? item.color : PAPER}
            y={-102}
          />
          <Rect
            ref={this.litFreqBars}
            width={46}
            height={0}
            x={0}
            y={64}
            offset={[0, 1]}
            radius={6}
            fill={item.color}
            opacity={0.9}
          />
          <Txt
            text={item.label}
            fontFamily={MONO}
            fontSize={24}
            fontWeight={700}
            fill={item.color}
            y={102}
          />
        </Rect>,
      );
    });

    // 右侧 2 个距离极简柱状卡片
    const distSpacing = 170;
    DIST_FREQ.forEach((item, i) => {
      const cx = -85 + i * distSpacing;

      this.rightFreqLayer().add(
        <Rect
          ref={this.distFreqCols}
          width={126}
          height={280}
          x={cx}
          y={22}
          radius={12}
          fill={DEEP}
          stroke={item.color}
          lineWidth={2}
          opacity={0}
          scale={0.88}
        >
          <Txt
            text={`×${item.count}`}
            fontFamily={MONO}
            fontSize={22}
            fontWeight={700}
            fill={item.color}
            y={-102}
          />
          <Rect
            ref={this.distFreqBars}
            width={52}
            height={0}
            x={0}
            y={64}
            offset={[0, 1]}
            radius={6}
            fill={item.color}
            opacity={0.9}
          />
          <Txt
            text={item.label}
            fontFamily={MONO}
            fontSize={24}
            fontWeight={700}
            fill={item.color}
            y={102}
          />
        </Rect>,
      );
    });
  }

  private buildTreeLayers() {
    // ── 左树：连线（起止点精确落在圆周/矩形边沿，不穿过节点内部） ──
    for (const edge of LEFT_EDGE_SPECS) {
      this.leftTreeLayer().add(
        <Line
          ref={this.leftEdgeLines}
          points={[
            [edge.fromX, edge.fromY],
            [edge.toX, edge.toY],
          ]}
          stroke={edge.color}
          lineWidth={2.4}
          lineCap={'round'}
          opacity={0.78}
          end={0}
        />,
      );
    }

    // ── 左树：内部权重圆节点 ──
    for (const node of LEFT_INTERNAL_SPECS) {
      this.leftTreeLayer().add(
        <Circle
          ref={this.leftInternalCircles}
          size={NODE_R * 2}
          x={node.x}
          y={node.y}
          fill={DEEP}
          stroke={node.color}
          lineWidth={2.2}
          opacity={0}
          scale={0.5}
        >
          <Txt
            text={String(node.weight)}
            fontFamily={MONO}
            fontSize={15}
            fontWeight={700}
            fill={PAPER}
          />
        </Circle>,
      );
    }

    // ── 左树：9 个叶子节点（上：符号，下：二进制码） ──
    for (const leaf of LEFT_LEAF_SPECS) {
      const isShort = leaf.id === 'lit-a';
      this.leftTreeLayer().add(
        <Rect
          ref={this.leftLeafBoxes}
          width={86}
          height={LEAF_H}
          x={leaf.x}
          y={leaf.y}
          radius={10}
          fill={isShort ? '#1f1822' : DEEP}
          stroke={leaf.color}
          lineWidth={isShort ? 2.8 : 2}
          opacity={0}
          scale={0.8}
        >
          <Txt
            text={leaf.label}
            fontFamily={MONO}
            fontSize={17}
            fontWeight={700}
            fill={PAPER}
            y={-12}
          />
          <Rect
            ref={this.leftLeafCodeBoxes}
            width={68}
            height={22}
            y={12}
            radius={5}
            fill={CARD}
            stroke={leaf.color}
            lineWidth={1.2}
            opacity={0}
            scale={0.7}
          >
            <Txt
              text={leaf.code}
              fontFamily={MONO}
              fontSize={15}
              fontWeight={700}
              fill={leaf.color}
            />
          </Rect>
        </Rect>,
      );
    }

    // ── 右树：连线 ──
    for (const edge of RIGHT_EDGE_SPECS) {
      this.rightTreeLayer().add(
        <Line
          ref={this.rightEdgeLines}
          points={[
            [edge.fromX, edge.fromY],
            [edge.toX, edge.toY],
          ]}
          stroke={edge.color}
          lineWidth={2.5}
          lineCap={'round'}
          opacity={0.8}
          end={0}
        />,
      );
    }

    // ── 右树：根节点 (3) ──
    this.rightTreeLayer().add(
      <Circle
        ref={this.rightRootCircle}
        size={36}
        x={RIGHT_ROOT_SPEC.x}
        y={RIGHT_ROOT_SPEC.y}
        fill={DEEP}
        stroke={GOLD}
        lineWidth={2.5}
        opacity={0}
        scale={0.5}
      >
        <Txt
          text={'3'}
          fontFamily={MONO}
          fontSize={17}
          fontWeight={700}
          fill={PAPER}
        />
      </Circle>,
    );

    // ── 右树：2 个距离叶子 ──
    for (const leaf of RIGHT_LEAF_SPECS) {
      this.rightTreeLayer().add(
        <Rect
          ref={this.rightLeafBoxes}
          width={110}
          height={60}
          x={leaf.x}
          y={leaf.y}
          radius={10}
          fill={DEEP}
          stroke={leaf.color}
          lineWidth={2.2}
          opacity={0}
          scale={0.8}
        >
          <Txt
            text={leaf.label}
            fontFamily={MONO}
            fontSize={19}
            fontWeight={700}
            fill={PAPER}
            y={-13}
          />
          <Rect
            ref={this.rightLeafCodeBoxes}
            width={78}
            height={24}
            y={13}
            radius={5}
            fill={CARD}
            stroke={leaf.color}
            lineWidth={1.3}
            opacity={0}
            scale={0.7}
          >
            <Txt
              text={leaf.code}
              fontFamily={MONO}
              fontSize={16}
              fontWeight={700}
              fill={leaf.color}
            />
          </Rect>
        </Rect>,
      );
    }
  }

  private buildBottomStage() {
    // ── 阶段三上半：11 个 Token 对应的哈夫曼比特块（无顶部冗余小字） ──
    const streamY = 238;
    const unitPx = 32; // 1 bit = 32px，37 bit 总宽 = 1184px
    const totalBits = this.encodedBlocks.reduce((s, b) => s + b.bitCount, 0);
    const packedTotalW = totalBits * unitPx;
    const packedStartX = -packedTotalW / 2;

    const spreadSpan = 1480;
    const spreadStartX = -spreadSpan / 2;
    const spreadStep = spreadSpan / (this.encodedBlocks.length - 1);

    let bitCursor = 0;
    this.encodedBlocks.forEach((blk, i) => {
      const w = blk.bitCount * unitPx - 4;
      const spreadX = spreadStartX + i * spreadStep;
      const packedX = packedStartX + bitCursor * unitPx + w / 2;
      this.packedBlockXs.push(packedX);
      bitCursor += blk.bitCount;

      this.add(
        <Rect
          ref={this.bitBlocks}
          width={w}
          height={54}
          x={spreadX}
          y={streamY}
          radius={8}
          fill={DEEP}
          stroke={blk.color}
          lineWidth={2.2}
          opacity={0}
          scale={0.75}
        >
          <Txt
            text={blk.bitsText}
            fontFamily={MONO}
            fontSize={21}
            fontWeight={700}
            fill={blk.color}
          />
        </Rect>,
      );
    });

    // ── 阶段三下半：极简压缩率对比条 ──
    const barMaxW = 900;
    const huffBarW = Math.round((37 / 184) * barMaxW);
    const barLeftX = -460;

    this.add(
      <Rect
        ref={this.compareCard}
        width={1680}
        height={132}
        x={0}
        y={390}
        radius={16}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        opacity={0}
        scale={0.96}
      >
        {/* 第一行：原始 ASCII */}
        <Txt
          text={'ASCII'}
          fontFamily={MONO}
          fontSize={21}
          fontWeight={700}
          fill={MUTED}
          x={-760}
          y={-26}
          offset={[-1, 0]}
        />
        <Rect
          width={barMaxW}
          height={26}
          x={barLeftX}
          y={-26}
          offset={[-1, 0]}
          radius={8}
          fill={DEEP}
          stroke={LINE}
          lineWidth={1.5}
          clip
        >
          <Rect
            ref={this.rawBarFill}
            width={0}
            height={26}
            x={-barMaxW / 2}
            offset={[-1, 0]}
            fill={BLUE}
            opacity={0.75}
          />
        </Rect>
        <Txt
          text={'184 bit'}
          fontFamily={MONO}
          fontSize={21}
          fontWeight={700}
          fill={BLUE}
          x={barLeftX + barMaxW + 24}
          y={-26}
          offset={[-1, 0]}
        />

        {/* 第二行：DEFLATE */}
        <Txt
          text={'DEFLATE'}
          fontFamily={MONO}
          fontSize={21}
          fontWeight={700}
          fill={ACCENT}
          x={-760}
          y={26}
          offset={[-1, 0]}
        />
        <Rect
          width={barMaxW}
          height={26}
          x={barLeftX}
          y={26}
          offset={[-1, 0]}
          radius={8}
          fill={DEEP}
          stroke={LINE}
          lineWidth={1.5}
          clip
        >
          <Rect
            ref={this.huffBarFill}
            width={0}
            height={26}
            x={-barMaxW / 2}
            offset={[-1, 0]}
            fill={ACCENT}
          />
        </Rect>
        <Txt
          text={'37 bit'}
          fontFamily={MONO}
          fontSize={21}
          fontWeight={700}
          fill={ACCENT}
          x={barLeftX + huffBarW + 24}
          y={26}
          offset={[-1, 0]}
        />

        {/* 右侧压缩比徽章 */}
        <Rect
          ref={this.savingBadge}
          width={220}
          height={74}
          x={660}
          y={0}
          radius={12}
          fill={DEEP}
          stroke={GREEN}
          lineWidth={2.5}
          opacity={0}
          scale={0.85}
        >
          <Txt
            text={'-79.9%'}
            fontFamily={MONO}
            fontSize={30}
            fontWeight={700}
            fill={GREEN}
          />
        </Rect>
      </Rect>,
    );
  }

  /** 高亮树中指定叶子节点 */
  private *pulseTreeLeaves(
    litLeafId: string,
    distLeafId: string | undefined,
    duration = 0.2,
  ): ThreadGenerator {
    const litIdx = LEFT_LEAF_SPECS.findIndex(l => l.id === litLeafId);
    const distIdx = distLeafId
      ? RIGHT_LEAF_SPECS.findIndex(r => r.id === distLeafId)
      : -1;

    const anims: ThreadGenerator[] = [];
    this.leftLeafBoxes.forEach((box, i) => {
      const active = i === litIdx;
      anims.push(
        all(
          box.scale(active ? 1.12 : 0.96, duration, easeOutCubic),
          box.opacity(active ? 1 : 0.38, duration, easeOutCubic),
        ),
      );
    });
    this.rightLeafBoxes.forEach((box, i) => {
      const active = distIdx >= 0 && i === distIdx;
      anims.push(
        all(
          box.scale(active ? 1.12 : distIdx >= 0 ? 0.96 : 1, duration, easeOutCubic),
          box.opacity(active ? 1 : distIdx >= 0 ? 0.38 : 0.75, duration, easeOutCubic),
        ),
      );
    });
    yield* all(...anims);
  }

  private *resetTreeLeaves(duration = 0.25): ThreadGenerator {
    yield* all(
      ...this.leftLeafBoxes.map(b =>
        all(b.scale(1, duration, easeOutCubic), b.opacity(1, duration, easeOutCubic)),
      ),
      ...this.rightLeafBoxes.map(b =>
        all(b.scale(1, duration, easeOutCubic), b.opacity(1, duration, easeOutCubic)),
      ),
    );
  }

  public *play(sceneTitle?: SceneTitle): ThreadGenerator {
    // ═══ 0. 承接 lz77 第二屏，切换标题并展开双面板 ═══
    yield* waitFor(0.25);
    if (sceneTitle) {
      yield* sceneTitle.setText('哈夫曼编码', 0.4);
    }
    yield* all(
      this.leftPanel().opacity(1, 0.4, easeOutCubic),
      this.leftPanel().scale(1, 0.45, easeOutCubic),
      this.rightPanel().opacity(1, 0.4, easeOutCubic),
      this.rightPanel().scale(1, 0.45, easeOutCubic),
    );
    yield* waitFor(0.2);

    // ═══ 1. 阶段一：双流频次统计 ═══
    // 1a) 高频字面量 'a' (×3)
    yield* all(
      this.tags().highlightIndices([0, 3, 5], 0.3),
      this.litFreqCols[0].opacity(1, 0.32, easeOutCubic),
      this.litFreqCols[0].scale(1, 0.38, easeOutBack),
      this.litFreqBars[0].height(140, 0.45, easeOutCubic),
    );
    yield* waitFor(0.35);

    // 1b) 其余 5 个单次字面量
    yield* all(
      this.tags().highlightIndices([1, 2, 4, 6, 8], 0.3),
      ...[1, 2, 3, 4, 5].map((colIdx, k) =>
        delay(
          k * 0.05,
          all(
            this.litFreqCols[colIdx].opacity(1, 0.3, easeOutCubic),
            this.litFreqCols[colIdx].scale(1, 0.35, easeOutBack),
            this.litFreqBars[colIdx].height(48, 0.4, easeOutCubic),
          ),
        ),
      ),
    );
    yield* waitFor(0.3);

    // 1c) 3 个匹配长度与 2 个偏移距离
    yield* all(
      this.tags().highlightIndices([7, 9, 10], 0.3),
      ...[6, 7, 8].map((colIdx, k) =>
        delay(
          k * 0.06,
          all(
            this.litFreqCols[colIdx].opacity(1, 0.3, easeOutCubic),
            this.litFreqCols[colIdx].scale(1, 0.35, easeOutBack),
            this.litFreqBars[colIdx].height(48, 0.4, easeOutCubic),
          ),
        ),
      ),
      this.distFreqCols[0].opacity(1, 0.32, easeOutCubic),
      this.distFreqCols[0].scale(1, 0.38, easeOutBack),
      this.distFreqBars[0].height(110, 0.45, easeOutCubic),
      delay(
        0.1,
        all(
          this.distFreqCols[1].opacity(1, 0.32, easeOutCubic),
          this.distFreqCols[1].scale(1, 0.38, easeOutBack),
          this.distFreqBars[1].height(55, 0.45, easeOutCubic),
        ),
      ),
    );

    yield* this.tags().clearHighlight(0.3);
    yield* waitFor(0.8);

    // ═══ 2. 阶段二：过渡为双哈夫曼树 ═══
    yield* all(
      this.leftFreqLayer().opacity(0, 0.35, easeOutCubic),
      this.rightFreqLayer().opacity(0, 0.35, easeOutCubic),
      this.leftPanelTitle().text('字面量 / 长度树', 0.3),
      this.rightPanelTitle().text('距离树', 0.3),
    );
    this.leftTreeLayer().opacity(1);
    this.rightTreeLayer().opacity(1);

    // 2a) 叶子节点出现
    yield* all(
      ...this.leftLeafBoxes.map((box, i) =>
        delay(
          i * 0.035,
          all(
            box.opacity(1, 0.3, easeOutCubic),
            box.scale(1, 0.35, easeOutBack),
          ),
        ),
      ),
      ...this.rightLeafBoxes.map((box, i) =>
        delay(
          i * 0.06,
          all(
            box.opacity(1, 0.3, easeOutCubic),
            box.scale(1, 0.35, easeOutBack),
          ),
        ),
      ),
    );
    yield* waitFor(0.25);

    // 2b) 自底向上逐层合并建树（level 1 → level 4）
    for (let lv = 1; lv <= 4; lv++) {
      const internalAnims: ThreadGenerator[] = [];
      LEFT_INTERNAL_SPECS.forEach((spec, idx) => {
        if (spec.level === lv) {
          internalAnims.push(
            all(
              this.leftInternalCircles[idx].opacity(1, 0.3, easeOutCubic),
              this.leftInternalCircles[idx].scale(1, 0.35, easeOutBack),
            ),
          );
        }
      });

      const edgeAnims: ThreadGenerator[] = [];
      LEFT_EDGE_SPECS.forEach((spec, idx) => {
        if (spec.level === lv) {
          edgeAnims.push(this.leftEdgeLines[idx].end(1, 0.38, easeInOutCubic));
        }
      });

      if (lv === 1) {
        internalAnims.push(
          all(
            this.rightRootCircle().opacity(1, 0.3, easeOutCubic),
            this.rightRootCircle().scale(1, 0.35, easeOutBack),
          ),
        );
        this.rightEdgeLines.forEach(line => {
          edgeAnims.push(line.end(1, 0.38, easeInOutCubic));
        });
      }

      yield* all(...internalAnims, ...edgeAnims);
      yield* waitFor(0.12);
    }

    // 2c) 叶子哈夫曼码弹出
    yield* all(
      ...this.leftLeafCodeBoxes.map((c, i) =>
        delay(
          i * 0.03,
          all(c.opacity(1, 0.3, easeOutCubic), c.scale(1, 0.35, easeOutBack)),
        ),
      ),
      ...this.rightLeafCodeBoxes.map(c =>
        all(c.opacity(1, 0.3, easeOutCubic), c.scale(1, 0.35, easeOutBack)),
      ),
    );
    yield* waitFor(0.75);

    // ═══ 3. 阶段三：逐个 Token 查树输出比特块 + 挤压合拢 ═══
    for (let i = 0; i < this.encodedBlocks.length; i++) {
      const blk = this.encodedBlocks[i];
      yield* all(
        this.tags().highlightSingle(i, 0.16),
        this.pulseTreeLeaves(blk.litLeafId, blk.distLeafId, 0.16),
        this.bitBlocks[i].opacity(1, 0.2, easeOutCubic),
        this.bitBlocks[i].scale(1, 0.24, easeOutBack),
      );
      yield* waitFor(0.08);
    }

    yield* all(
      this.tags().clearHighlight(0.28),
      this.resetTreeLeaves(0.28),
    );
    yield* waitFor(0.25);

    // 11 个比特块紧密挤压合拢为连续 37 bit 流
    yield* all(
      ...this.bitBlocks.map((b, i) =>
        b.x(this.packedBlockXs[i], 0.65, easeInOutCubic),
      ),
    );
    yield* waitFor(0.3);

    // ═══ 4. 展示压缩率对比（184 bit → 37 bit） ═══
    const barMaxW = 900;
    const huffBarW = Math.round((37 / 184) * barMaxW);

    yield* all(
      this.compareCard().opacity(1, 0.4, easeOutCubic),
      this.compareCard().scale(1, 0.45, easeOutBack),
    );
    yield* all(
      this.rawBarFill().width(barMaxW, 0.65, easeInOutCubic),
      delay(0.15, this.huffBarFill().width(huffBarW, 0.65, easeInOutCubic)),
      delay(
        0.35,
        all(
          this.savingBadge().opacity(1, 0.35, easeOutCubic),
          this.savingBadge().scale(1, 0.42, easeOutBack),
        ),
      ),
    );

    yield* waitFor(1.5);
  }
}
