import {Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRefArray,
  delay,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
/** 连线常态透明度 */
const EDGE_OPACITY = 0.8;
/** 高亮时非焦点连线透明度 */
const EDGE_DIM = 0.12;
/** 分支配色：根的第一层子节点按顺序取色，深层继承父色 */
const PALETTE = ['#3dd6c6', '#ffb454', '#7aa2ff', '#f472b6', '#a3e635'];

/** #rrggbb + 透明度 → rgba() 字符串，用作节点实底色 */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 树节点数据：color 不填则自动分配（第一层按调色板，深层继承父色） */
export interface TreeNodeData {
  label: string;
  color?: string;
  /** 提出 / 发布年份，显示在名称下方 */
  year?: string | number;
  /** 虚线边框（如编码方式而非字符集标准） */
  dashed?: boolean;
  children?: TreeNodeData[];
}

export interface TreeBoardProps extends NodeProps {
  tree: TreeNodeData;
  /** 节点盒宽（矩形模式），默认 220 */
  nodeWidth?: number;
  /** 节点盒高（矩形模式），默认 88 */
  nodeHeight?: number;
  /** 圆形直径（圆形模式），默认 120 */
  circleSize?: number;
  /** 同层节点间距，默认 70 */
  hGap?: number;
  /** 层间距，默认 82 */
  vGap?: number;
  /** 节点字号，默认 30 */
  fontSize?: number;
  /** 节点外形：矩形（默认）或圆形 */
  nodeStyle?: 'rect' | 'circle';
  /** 连线：直角折线（默认）或直线 */
  edgeStyle?: 'elbow' | 'straight';
}

interface FlatNode {
  label: string;
  color: string;
  year: string;
  dashed: boolean;
  depth: number;
  x: number;
  y: number;
  parent: number;
}

/**
 * 自上而下的树组件：根在上、子在下。
 * 布局为槽位式：叶子依次占槽，父节点居于子节点正中。
 * 支持矩形/圆形节点，以及直角折线/直线连线。
 */
export class TreeBoard extends Node {
  private readonly nodeBoxes = createRefArray<Rect>();
  private readonly nodeTxts = createRefArray<Txt>();
  private readonly edgeLines = createRefArray<Line>();

  private readonly flats: FlatNode[] = [];
  /** flat 下标 → edgeLines 下标（根为 -1） */
  private readonly edgeOf: number[] = [];

  public constructor(props: TreeBoardProps) {
    const {
      tree,
      nodeWidth = 220,
      nodeHeight = 88,
      circleSize = 120,
      hGap = 70,
      vGap = 82,
      fontSize = 30,
      nodeStyle = 'rect',
      edgeStyle = 'elbow',
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});

    const isCircle = nodeStyle === 'circle';
    const boxW = isCircle ? circleSize : nodeWidth;
    const boxH = isCircle ? circleSize : nodeHeight;
    const radius = isCircle ? circleSize / 2 : 12;
    const slotW = boxW + hGap;
    const stepY = boxH + vGap;

    // 拍平 + 槽位布局
    let slot = 0;
    const place = (
      node: TreeNodeData,
      depth: number,
      parent: number,
      color: string,
    ): number => {
      const idx = this.flats.length;
      this.flats.push({
        label: node.label,
        color,
        year: node.year != null ? String(node.year) : '',
        dashed: !!node.dashed,
        depth,
        x: 0,
        y: depth * stepY,
        parent,
      });
      const kids = node.children ?? [];
      if (kids.length === 0) {
        this.flats[idx].x = slot++;
        return this.flats[idx].x;
      }
      const xs = kids.map((kid, i) => {
        const childColor =
          depth === 0
            ? (kid.color ?? PALETTE[i % PALETTE.length])
            : (kid.color ?? color);
        return place(kid, depth + 1, idx, childColor);
      });
      const x = (xs[0] + xs[xs.length - 1]) / 2;
      this.flats[idx].x = x;
      return x;
    };
    place(tree, 0, -1, tree.color ?? ACCENT);

    // 整体水平居中
    const center = (slot - 1) / 2;
    for (const f of this.flats) {
      f.x = (f.x - center) * slotW;
    }

    // 连线
    let edgeCount = 0;
    this.flats.forEach((f, fi) => {
      if (f.parent < 0) {
        this.edgeOf[fi] = -1;
        return;
      }
      const p = this.flats[f.parent];
      const y0 = p.y + boxH / 2;
      const y1 = f.y - boxH / 2;
      let pts: Vector2[];
      if (edgeStyle === 'straight') {
        pts = [new Vector2(p.x, y0), new Vector2(f.x, y1)];
      } else if (f.x === p.x) {
        pts = [new Vector2(p.x, y0), new Vector2(f.x, y1)];
      } else {
        pts = [
          new Vector2(p.x, y0),
          new Vector2(p.x, (y0 + y1) / 2),
          new Vector2(f.x, (y0 + y1) / 2),
          new Vector2(f.x, y1),
        ];
      }
      this.edgeOf[fi] = edgeCount++;
      this.add(
        <Line
          ref={this.edgeLines}
          points={pts}
          stroke={f.color}
          lineWidth={3}
          lineCap={'round'}
          end={0}
          opacity={EDGE_OPACITY}
          zIndex={0}
        />,
      );
    });

    const yearSize = Math.max(12, Math.round(fontSize * 0.72));
    for (const f of this.flats) {
      this.add(
        <Rect
          ref={this.nodeBoxes}
          layout
          direction={'column'}
          alignItems={'center'}
          justifyContent={'center'}
          gap={f.year ? 2 : 0}
          width={boxW}
          height={boxH}
          position={[f.x, f.y]}
          fill={tint(f.color, 0.22)}
          stroke={f.color}
          lineWidth={2.5}
          lineDash={f.dashed ? [9, 7] : []}
          radius={radius}
          opacity={0}
          scale={0.85}
          zIndex={1}
        >
          <Txt
            ref={this.nodeTxts}
            text={f.label}
            fontFamily={FONT}
            fontSize={fontSize}
            fontWeight={700}
            fill={PAPER}
          />
          {f.year ? (
            <Txt
              text={f.year}
              fontFamily={FONT}
              fontSize={yearSize}
              fontWeight={600}
              fill={PAPER}
              opacity={0.75}
            />
          ) : null}
        </Rect>,
      );
    }
  }

  /** 深度优先展开：按先序逐个生长连线 + 弹出节点 */
  public *reveal(): ThreadGenerator {
    yield* all(
      this.nodeBoxes[0].opacity(1, 0.4, easeOutCubic),
      this.nodeBoxes[0].scale(1, 0.45, easeOutCubic),
    );
    yield* waitFor(0.2);
    // flats 本身按先序存放，跳过根后依次即为深度优先顺序
    for (let fi = 1; fi < this.flats.length; fi++) {
      yield* all(
        this.edgeLines[this.edgeOf[fi]].end(1, 0.5, easeInOutCubic),
        delay(
          0.2,
          all(
            this.nodeBoxes[fi].opacity(1, 0.4, easeOutCubic),
            this.nodeBoxes[fi].scale(1, 0.45, easeOutCubic),
          ),
        ),
      );
      yield* waitFor(0.3);
    }
  }

  /** 按当前文案改名：淡出 → 换字 → 淡入 */
  public *rename(
    oldLabel: string,
    newLabel: string,
  ): ThreadGenerator {
    const fi = this.flats.findIndex(f => f.label === oldLabel);
    if (fi < 0) {
      throw new Error(`TreeBoard: 找不到节点 "${oldLabel}"`);
    }
    this.flats[fi].label = newLabel;
    const txt = this.nodeTxts[fi];
    yield* txt.opacity(0, 0.2, easeOutCubic);
    txt.text(newLabel);
    yield* txt.opacity(1, 0.3, easeOutCubic);
  }

  /** 高亮指定标签节点，其余节点与全部连线一并压暗 */
  public *highlight(label: string, duration = 0.4): ThreadGenerator {
    const fi = this.flats.findIndex(f => f.label === label);
    if (fi < 0) {
      throw new Error(`TreeBoard: 找不到节点 "${label}"`);
    }
    const nodeAnims = this.nodeBoxes.map((box, i) => {
      if (i === fi) {
        return all(
          box.opacity(1, duration, easeOutCubic),
          box.scale(1.14, duration, easeOutCubic),
          box.lineWidth(4, duration, easeOutCubic),
        );
      }
      return all(
        box.opacity(0.28, duration, easeOutCubic),
        box.scale(0.92, duration, easeOutCubic),
        box.lineWidth(2, duration, easeOutCubic),
      );
    });
    const edgeAnims = this.edgeLines.map(edge =>
      edge.opacity(EDGE_DIM, duration, easeOutCubic),
    );
    yield* all(...nodeAnims, ...edgeAnims);
  }

  /** 取消高亮，恢复全部节点与连线常态 */
  public *clearHighlight(duration = 0.35): ThreadGenerator {
    yield* all(
      ...this.nodeBoxes.map(box =>
        all(
          box.opacity(1, duration, easeOutCubic),
          box.scale(1, duration, easeOutCubic),
          box.lineWidth(2.5, duration, easeOutCubic),
        ),
      ),
      ...this.edgeLines.map(edge =>
        edge.opacity(EDGE_OPACITY, duration, easeOutCubic),
      ),
    );
  }

  /** 整体平移到 (x, y) */
  public *slideTo(x: number, y: number, duration = 0.8): ThreadGenerator {
    yield* this.position(new Vector2(x, y), duration, easeInOutCubic);
  }
}
