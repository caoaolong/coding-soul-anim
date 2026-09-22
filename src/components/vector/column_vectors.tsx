import { Latex, Layout, Node, NodeProps } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  createRef,
  createRefArray,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";

export interface ColumnVectorItem {
  /** 左侧名称 LaTeX，如 N_{2} */
  name: string;
  /** 向量分量，按列自上而下 */
  values: number[];
}

export interface ColumnVectorsProps extends NodeProps {
  /** 向量列表（从左到右） */
  vectors: ColumnVectorItem[];
  /** 字号，默认 42 */
  fontSize?: number;
  /** 列间距，默认 220 */
  gap?: number;
  /** 公式颜色，默认 Ink.paper */
  fill?: string;
}

/** 将分量拼成带尺寸下标的 bmatrix 列向量 LaTeX */
function toColumnTex(name: string, values: number[]): string {
  if (values.length === 0) {
    throw new Error("ColumnVectors: values 不能为空");
  }
  const m = values.length;
  const body = values.join("\\\\");
  return `${name}=\\begin{bmatrix}${body}\\end{bmatrix}_{${m}\\times 1}`;
}

/**
 * 横向排列的列向量组：墨晕逐个出场。
 * 分量与名称均由参数传入，内部生成方括号列式。
 */
export class ColumnVectors extends Node {
  private readonly formulas = createRefArray<Latex>();
  private readonly count: number;

  public constructor(props: ColumnVectorsProps) {
    const {
      vectors,
      fontSize = 42,
      gap = 220,
      fill = Ink.paper,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!vectors || vectors.length === 0) {
      throw new Error("ColumnVectors: vectors 不能为空");
    }
    this.count = vectors.length;

    const row = createRef<Layout>();
    this.add(
      <Layout
        ref={row}
        layout
        direction={"row"}
        gap={gap}
        alignItems={"center"}
        justifyContent={"center"}
      >
        {vectors.map((item) => (
          <Latex
            ref={this.formulas}
            tex={toColumnTex(item.name, item.values)}
            fill={fill}
            fontSize={fontSize}
            opacity={0}
          />
        ))}
      </Layout>,
    );
  }

  /**
   * 从左到右依次墨晕显现。
   * @param stepDuration 单个向量入场时长
   * @param hold 相邻向量间隔
   */
  public *play(stepDuration = 0.55, hold = 0.35): ThreadGenerator {
    for (let i = 0; i < this.count; i++) {
      yield* inkReveal(this.formulas[i], {
        duration: stepDuration,
        fromY: 14,
      });
      if (hold > 0 && i < this.count - 1) {
        yield* waitFor(hold);
      }
    }
  }

  /** 整组隐去 */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* inkFade(this.formulas, { duration });
  }
}
