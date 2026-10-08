import {
  Latex,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefMap,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
/** 默认多色调色板：不同片段自动取不同颜色 */
const PALETTE = ['#3dd6c6', '#ffb454', '#7aa2ff', '#f472b6', '#a3e635', '#c084fc'];

/** 公式片段：有 id 的可被标注；无 id 的仅展示（如等号） */
export interface FormulaPart {
  /** 标注用 id，如 'I' / 'p' / 'log2' */
  id?: string;
  /** LaTeX 片段，如 '\\log_{2}' */
  tex: string;
  /** 该片段专属颜色，不填则按顺序从调色板自动分配 */
  color?: string;
}

/** 一次标注：指向某个 part.id */
export interface FormulaAnnotation {
  id: string;
  /** 说明文字 */
  label: string;
  /** 本次框选/文字/高亮颜色，不填则用该片段专属色 */
  color?: string;
}

export interface FormulaBoardProps extends NodeProps {
  /** 公式片段（从左到右） */
  parts: FormulaPart[];
  /** 默认标注序列（可在 run/annotateSequence 中覆盖） */
  annotations?: FormulaAnnotation[];
  /** 公式字号，默认 96 */
  fontSize?: number;
  /** 片段间距，默认 12 */
  gap?: number;
  /** 说明文字 y，默认 200（底部） */
  noteY?: number;
  /** 框选内边距，默认 [20, 14] */
  boxPadding?: [number, number];
}

/**
 * 通用公式板：居中展示公式，支持按片段依次高亮标注。
 * 场景标题请使用 SceneTitle，勿在本组件内再放标题。
 */
export class FormulaBoard extends Node {
  private readonly formula = createRef<Layout>();
  private readonly note = createRef<Txt>();
  private readonly box = createRef<Rect>();
  private readonly partsMap = createRefMap<Latex>();

  private readonly defaultAnnotations: FormulaAnnotation[];
  private readonly paper = PAPER;
  private readonly accent = ACCENT;
  private readonly padX: number;
  private readonly padY: number;
  /** 每个可标注 id 的基础色（含自动分配） */
  private readonly baseColors = new Map<string, string>();
  /** 与 parts 顺序一一对应的子节点基础色（无 id 的用 PAPER） */
  private readonly baseFills: string[] = [];

  public constructor(props: FormulaBoardProps) {
    const {
      parts,
      annotations = [],
      fontSize = 96,
      gap = 12,
      noteY = 200,
      boxPadding = [20, 14] as [number, number],
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});

    this.defaultAnnotations = annotations;
    this.padX = boxPadding[0];
    this.padY = boxPadding[1];

    // 给每个可标注片段分配专属色：显式 color 优先，否则按顺序取调色板
    let autoIndex = 0;
    parts.forEach(part => {
      if (!part.id) {
        this.baseFills.push(this.paper);
        return;
      }
      const c = part.color ?? PALETTE[autoIndex % PALETTE.length];
      autoIndex++;
      this.baseColors.set(part.id, c);
      this.baseFills.push(c);
    });

    this.add(
      <Layout
        ref={this.formula}
        layout
        direction={'row'}
        alignItems={'center'}
        gap={gap}
        y={-20}
        opacity={0}
        scale={0.94}
      >
        {parts.map((part, index) =>
          part.id ? (
            <Latex
              ref={this.partsMap[part.id]}
              tex={[part.tex]}
              fill={this.baseFills[index]}
              fontSize={fontSize}
            />
          ) : (
            <Latex
              tex={[part.tex]}
              fill={this.baseFills[index]}
              fontSize={fontSize}
            />
          ),
        )}
      </Layout>,
    );

    this.add(
      <Rect
        ref={this.box}
        width={80}
        height={120}
        x={0}
        y={0}
        stroke={this.accent}
        lineWidth={4}
        radius={12}
        opacity={0}
        scale={1.15}
      />,
    );

    this.add(
      <Txt
        ref={this.note}
        text={''}
        fontFamily={FONT}
        fontSize={32}
        fill={this.accent}
        y={noteY}
        opacity={0}
      />,
    );
  }

  /** 公式淡入 */
  public *reveal(duration = 0.55): ThreadGenerator {
    yield* all(
      this.formula().opacity(1, duration, easeOutCubic),
      this.formula().scale(1, duration * 1.1, easeOutCubic),
    );
  }

  /** 取某 id 的专属色（标注覆盖色优先） */
  private resolveColor(id: string, override?: string): string {
    return override ?? this.baseColors.get(id) ?? this.accent;
  }

  /** 标注某一个片段：矩形框选 + 底部标注文本（颜色跟随该片段） */
  public *annotate(
    id: string,
    label: string,
    hold = 1.1,
    color?: string,
  ): ThreadGenerator {
    const node = this.partsMap[id]();
    if (!node) {
      throw new Error(`FormulaBoard: 找不到片段 id="${id}"`);
    }
    const c = this.resolveColor(id, color);
    const base = this.baseColors.get(id) ?? this.paper;

    const origin = this.absolutePosition();
    const pos = node.absolutePosition();
    const cx = pos.x - origin.x;
    const cy = pos.y - origin.y;
    const bw = Math.max(node.width() + this.padX * 2, 72);
    const bh = Math.max(node.height() + this.padY * 2, 110);

    // 重置框选位置/大小/颜色
    this.box().position([cx, cy]);
    this.box().size([bw, bh]);
    this.box().stroke(c);
    this.box().scale(1.15);
    this.box().opacity(0);
    this.note().fill(c);

    yield* all(
      node.fill(c, 0.35, easeOutCubic),
      this.box().opacity(1, 0.35, easeOutCubic),
      this.box().scale(1, 0.35, easeOutCubic),
      this.note().text(label, 0),
      this.note().opacity(1, 0.35, easeOutCubic),
    );
    yield* waitFor(hold);

    yield* all(
      node.fill(base, 0.3, easeInOutCubic),
      this.box().opacity(0, 0.25, easeInOutCubic),
      this.note().opacity(0, 0.25, easeInOutCubic),
    );
  }

  /** 按序列依次标注 */
  public *annotateSequence(
    annotations: FormulaAnnotation[] = this.defaultAnnotations,
    hold = 1.1,
    gap = 0.2,
  ): ThreadGenerator {
    for (const item of annotations) {
      yield* this.annotate(item.id, item.label, hold, item.color);
      yield* waitFor(gap);
    }
  }

  /** 整式脉冲一下（收束用）：整体放大再回弹，保持各自专属色 */
  public *pulseAll(duration = 0.35): ThreadGenerator {
    const nodes = this.formula().childrenAs<Latex>();
    yield* all(
      this.formula().scale(1.04, duration, easeOutCubic),
      ...nodes.map((n, i) =>
        n.fill('#ffffff', duration, easeOutCubic),
      ),
    );
    yield* waitFor(0.35);
    yield* all(
      this.formula().scale(1, duration * 1.1, easeInOutCubic),
      ...nodes.map((n, i) =>
        n.fill(this.baseFills[i] ?? this.paper, duration * 1.1, easeInOutCubic),
      ),
    );
  }

  /**
   * 完整流程：淡入 → 依次标注 → 整式脉冲
   */
  public *run(
    annotations: FormulaAnnotation[] = this.defaultAnnotations,
    options?: {hold?: number; gap?: number; pulse?: boolean},
  ): ThreadGenerator {
    const hold = options?.hold ?? 1.1;
    const gap = options?.gap ?? 0.2;
    const pulse = options?.pulse ?? true;

    yield* this.reveal();
    yield* waitFor(0.45);
    if (annotations.length > 0) {
      yield* this.annotateSequence(annotations, hold, gap);
    }
    if (pulse) {
      yield* this.pulseAll();
    }
  }
}
