import { Img, Layout, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  createRef,
  createRefArray,
  waitFor,
} from "@motion-canvas/core";
import placeholderImg from "../../assets/placeholder.svg";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';

export interface GridItem {
  /** 图片资源；省略则使用 placeholder.svg */
  image?: string;
  /** 单元格下方文案 */
  label: string;
}

export interface GridProps extends NodeProps {
  /** 网格单元格（按行优先排布） */
  items: GridItem[];
  /** 列数，默认按条目数（最多 4） */
  columns?: number;
  /** 单元格图片宽度，默认 360 */
  cellWidth?: number;
  /** 单元格图片高度，默认与 cellWidth 相同 */
  cellHeight?: number;
  /** 单元格间距，默认 48 */
  gap?: number;
  /** 文案字号，默认 32 */
  fontSize?: number;
}

/**
 * 网格图文：上图下文，按行列排布。
 * 未提供 image 时使用 assets/placeholder.svg 占位。
 */
export class Grid extends Node {
  private readonly cells = createRefArray<Layout>();
  private readonly count: number;

  public constructor(props: GridProps) {
    const {
      items,
      columns,
      cellWidth = 360,
      cellHeight,
      gap = 48,
      fontSize = 32,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!items || items.length === 0) {
      throw new Error("Grid: items 不能为空");
    }

    this.count = items.length;
    const cols = Math.max(
      1,
      columns ?? Math.min(items.length, 4),
    );
    const imgH = cellHeight ?? cellWidth;

    const grid = createRef<Layout>();
    this.add(
      <Layout
        ref={grid}
        layout
        direction={"column"}
        gap={gap}
        alignItems={"center"}
      />,
    );

    for (let start = 0; start < items.length; start += cols) {
      const rowItems = items.slice(start, start + cols);
      const row = createRef<Layout>();
      grid().add(
        <Layout
          ref={row}
          layout
          direction={"row"}
          gap={gap}
          alignItems={"start"}
          justifyContent={"center"}
        />,
      );

      for (const item of rowItems) {
        const cell = createRef<Layout>();
        const src = item.image ?? placeholderImg;
        row().add(
          <Layout
            ref={cell}
            layout
            direction={"column"}
            alignItems={"center"}
            gap={20}
            width={cellWidth}
            opacity={0}
          >
            <Img src={src} width={cellWidth} height={imgH} />
            <Txt
              text={item.label}
              fontFamily={LABEL_FONT}
              fontSize={fontSize}
              fill={Ink.paper}
              textAlign={"center"}
            />
          </Layout>,
        );
        this.cells.push(cell());
      }
    }
  }

  /** 逐格墨晕显现 */
  public *play(stepDuration = 0.45, pause = 0.2): ThreadGenerator {
    for (let i = 0; i < this.count; i++) {
      yield* inkReveal(this.cells[i], { duration: stepDuration, fromY: 14 });
      if (i < this.count - 1 && pause > 0) {
        yield* waitFor(pause);
      }
    }
  }

  /** 整组同时淡入 */
  public *show(duration = Ink.duration): ThreadGenerator {
    yield* inkReveal(this.cells, { duration, fromY: 12 });
  }

  /** 整组淡出 */
  public *hide(duration = Ink.duration): ThreadGenerator {
    yield* inkFade(this.cells, { duration });
  }
}
