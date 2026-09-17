import { Img, Layout, Node, NodeProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
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

export interface GridCellUpdate {
  /** 新图片；传 `null` 回退到 placeholder */
  image?: string | null;
  /** 新文案 */
  label?: string;
}

export interface GridProps extends NodeProps {
  /** 网格单元格（按行优先排布） */
  items: GridItem[];
  /** 列数，默认按条目数（最多 4） */
  columns?: number;
  /** 单元格图片宽度，默认 260；只约束宽度，高度按原比例（不拉伸） */
  cellWidth?: number;
  /** 单元格间距，默认 40 */
  gap?: number;
  /** 文案字号，默认 28 */
  fontSize?: number;
}

/**
 * 网格图文：上图下文，按行列排布。
 * 未提供 image 时使用 assets/placeholder.svg 占位。
 */
export class Grid extends Node {
  private readonly cells = createRefArray<Layout>();
  private readonly images = createRefArray<Img>();
  private readonly labels = createRefArray<Txt>();
  private readonly cellWidth: number;
  private readonly count: number;

  public constructor(props: GridProps) {
    const {
      items,
      columns,
      cellWidth = 260,
      gap = 40,
      fontSize = 28,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!items || items.length === 0) {
      throw new Error("Grid: items 不能为空");
    }

    this.count = items.length;
    this.cellWidth = cellWidth;
    const cols = Math.max(
      1,
      columns ?? Math.min(items.length, 4),
    );

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
        const img = createRef<Img>();
        const label = createRef<Txt>();
        const src = item.image ?? placeholderImg;
        row().add(
          <Layout
            ref={cell}
            layout
            direction={"column"}
            alignItems={"center"}
            gap={16}
            width={cellWidth}
            opacity={0}
          >
            {/* 只设 width，高度随原图比例，避免拉伸 */}
            <Img ref={img} src={src} width={cellWidth} />
            <Txt
              ref={label}
              text={item.label}
              fontFamily={LABEL_FONT}
              fontSize={fontSize}
              fill={Ink.paper}
              textAlign={"center"}
            />
          </Layout>,
        );
        this.cells.push(cell());
        this.images.push(img());
        this.labels.push(label());
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

  /**
   * 更新指定单元格：先淡出变更项 → 换内容 → 再淡入。
   * `image` / `label` 可只传其中一个。
   */
  public *updateCell(
    index: number,
    next: GridCellUpdate,
    duration = 0.45,
  ): ThreadGenerator {
    if (index < 0 || index >= this.count) {
      throw new Error(`Grid.updateCell: 下标 ${index} 越界（共 ${this.count} 格）`);
    }
    if (next.image === undefined && next.label === undefined) {
      return;
    }

    const img = this.images[index];
    const label = this.labels[index];
    const half = duration * 0.5;
    const fadeOut: ThreadGenerator[] = [];
    const fadeIn: ThreadGenerator[] = [];

    const changeImage = next.image !== undefined;
    const changeLabel = next.label !== undefined;

    if (changeImage) {
      fadeOut.push(img.opacity(0, half, easeInOutCubic));
      fadeIn.push(img.opacity(1, half, easeInOutCubic));
    }
    if (changeLabel) {
      fadeOut.push(label.opacity(0, half, easeInOutCubic));
      fadeIn.push(label.opacity(1, half, easeInOutCubic));
    }

    yield* all(...fadeOut);

    if (changeImage) {
      const src =
        next.image === null || next.image === ""
          ? placeholderImg
          : next.image;
      img.src(src);
      img.width(this.cellWidth);
    }
    if (changeLabel) {
      label.text(next.label!);
    }

    yield* all(...fadeIn);
  }
}
