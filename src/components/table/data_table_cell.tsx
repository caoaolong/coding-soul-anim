import { Rect, RectProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
} from "@motion-canvas/core";

export interface DataTableCellProps extends RectProps {
  text?: string;
  textFill?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  cellPaddingX?: number;
}

/**
 * 表格单元格：Rect + 居中文字，统一样式与宽高收拢/展开动画。
 */
export class DataTableCell extends Rect {
  private readonly label = createRef<Txt>();
  private readonly cellPaddingX: number;

  public constructor(props: DataTableCellProps = {}) {
    const {
      text = "",
      textFill = "#E2E8F0",
      fontSize = 24,
      fontFamily = "JetBrains Mono, Consolas, monospace",
      fontWeight = 400,
      cellPaddingX = 16,
      lineWidth = 1,
      layout = true,
      minWidth = 0,
      justifyContent = "center",
      alignItems = "center",
      clip = true,
      padding,
      ...rectProps
    } = props;

    super({
      layout,
      minWidth,
      justifyContent,
      alignItems,
      clip,
      lineWidth,
      padding: padding ?? [0, cellPaddingX],
      ...rectProps,
    });

    this.cellPaddingX = cellPaddingX;
    this.add(
      <Txt
        ref={this.label}
        text={text}
        fill={textFill}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
      />,
    );
  }

  public get txt(): Txt {
    return this.label();
  }

  /** 兼容旧 `{ rect, txt }` 访问：单元格自身即 Rect */
  public get rect(): Rect {
    return this;
  }

  public setText(value: string) {
    this.txt.text(value);
  }

  public clearText() {
    this.txt.text("");
  }

  /** 宽度从当前值展开到 target，并恢复水平 padding、淡入 */
  public *expandWidth(
    targetWidth: number,
    duration: number,
    paddingX = this.cellPaddingX,
  ): ThreadGenerator {
    yield* all(
      this.width(targetWidth, duration, easeInOutCubic),
      this.opacity(1, duration, easeInOutCubic),
      this.padding([0, paddingX], duration, easeInOutCubic),
    );
  }

  /** 清文字后宽度收到 0 并淡出 */
  public *collapseWidth(duration: number): ThreadGenerator {
    this.clearText();
    yield* all(
      this.width(0, duration, easeInOutCubic),
      this.opacity(0, duration, easeInOutCubic),
      this.padding(0, duration, easeInOutCubic),
    );
  }

  /** 清文字后高度收到 0 并淡出（删行用） */
  public *collapseHeight(duration: number): ThreadGenerator {
    this.clearText();
    yield* all(
      this.height(0, duration, easeInOutCubic),
      this.opacity(0, duration, easeInOutCubic),
      this.padding(0, duration, easeInOutCubic),
    );
  }
}

/** 创建表头单元格（字重加粗） */
export function createHeaderCell(
  props: DataTableCellProps & { text: string },
): DataTableCell {
  return new DataTableCell({
    fontWeight: 700,
    ...props,
  });
}
