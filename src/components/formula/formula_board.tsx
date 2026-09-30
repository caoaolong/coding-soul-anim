import {
  Latex,
  Layout,
  Line,
  Node,
  NodeProps,
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

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';

/** 公式片段：有 id 的可被标注；无 id 的仅展示（如等号） */
export interface FormulaPart {
  /** 标注用 id，如 'I' / 'p' / 'log2' */
  id?: string;
  /** LaTeX 片段，如 '\\log_{2}' */
  tex: string;
}

/** 一次标注：指向某个 part.id */
export interface FormulaAnnotation {
  id: string;
  /** 说明文字 */
  label: string;
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
  /** 说明文字 y，默认 160 */
  noteY?: number;
}

/**
 * 通用公式板：居中展示公式，支持按片段依次高亮标注。
 * 场景标题请使用 SceneTitle，勿在本组件内再放标题。
 */
export class FormulaBoard extends Node {
  private readonly formula = createRef<Layout>();
  private readonly note = createRef<Txt>();
  private readonly underline = createRef<Line>();
  private readonly partsMap = createRefMap<Latex>();

  private readonly defaultAnnotations: FormulaAnnotation[];
  private readonly paper = PAPER;
  private readonly accent = ACCENT;

  public constructor(props: FormulaBoardProps) {
    const {
      parts,
      annotations = [],
      fontSize = 96,
      gap = 12,
      noteY = 160,
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});

    this.defaultAnnotations = annotations;

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
              fill={this.paper}
              fontSize={fontSize}
            />
          ) : (
            <Latex tex={[part.tex]} fill={this.paper} fontSize={fontSize} />
          ),
        )}
      </Layout>,
    );

    this.add(
      <Line
        ref={this.underline}
        points={[
          [-40, 80],
          [40, 80],
        ]}
        stroke={this.accent}
        lineWidth={4}
        lineCap={'round'}
        end={0}
        opacity={0}
      />,
    );

    this.add(
      <Txt
        ref={this.note}
        text={''}
        fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
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

  /** 标注某一个片段 */
  public *annotate(
    id: string,
    label: string,
    hold = 1.1,
  ): ThreadGenerator {
    const node = this.partsMap[id]();
    if (!node) {
      throw new Error(`FormulaBoard: 找不到片段 id="${id}"`);
    }

    const origin = this.absolutePosition();
    const pos = node.absolutePosition();
    const w = Math.max(node.width() * 0.55, 36);
    const x = pos.x - origin.x;
    const y = pos.y - origin.y + node.height() * 0.55 + 18;

    this.underline().end(0);
    this.underline().opacity(0);
    this.underline().points([
      [x - w, y],
      [x + w, y],
    ]);

    yield* all(
      node.fill(this.accent, 0.35, easeOutCubic),
      node.scale(1.18, 0.35, easeOutCubic),
      this.underline().opacity(1, 0.3, easeOutCubic),
      this.underline().end(1, 0.35, easeInOutCubic),
      this.note().text(label, 0),
      this.note().opacity(1, 0.35, easeOutCubic),
    );
    yield* waitFor(hold);

    yield* all(
      node.fill(this.paper, 0.3, easeInOutCubic),
      node.scale(1, 0.3, easeInOutCubic),
      this.underline().opacity(0, 0.25, easeInOutCubic),
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
      yield* this.annotate(item.id, item.label, hold);
      yield* waitFor(gap);
    }
  }

  /** 整式脉冲一下（收束用） */
  public *pulseAll(duration = 0.35): ThreadGenerator {
    const nodes = this.formula().childrenAs<Latex>();
    yield* all(...nodes.map(n => n.fill(this.accent, duration, easeOutCubic)));
    yield* waitFor(0.35);
    yield* all(...nodes.map(n => n.fill(this.paper, duration * 1.1, easeInOutCubic)));
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
