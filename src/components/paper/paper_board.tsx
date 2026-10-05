import {Img, Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  createRefArray,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE = '#2a3a4c';
const MUTED = '#8a9bb0';

/** #rrggbb + 透明度 → rgba() 字符串 */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface PaperBoardProps extends NodeProps {
  /** 论文图片 */
  image: string;
  /** 右侧主要论点（有序列表，依次显示） */
  points: string[];
  /** 图片下方小字 caption，如出处 */
  caption?: string;
  /** 论文图高度（只定高、宽按比例），默认 640 */
  paperHeight?: number;
  /** 移到左侧后的 x，默认 -560 */
  paperX?: number;
  /** 论文 / 列表中心 y，默认 20 */
  paperY?: number;
  /** 右侧列表中心 x，默认 200 */
  listX?: number;
  /** 列表行距（固定步进，行间距偏大），默认 150 */
  rowStep?: number;
  /** 论点字号，默认 30 */
  fontSize?: number;
}

/**
 * 论文展示：图片中央入场 → 移到左侧 → 右侧纵向有序列表依次显示。
 */
export class PaperBoard extends Node {
  private readonly paperWrap = createRef<Rect>();
  private readonly rows = createRefArray<Rect>();
  private readonly rowTxts = createRefArray<Txt>();

  private readonly homeX = 0;
  private readonly asideX: number;
  private readonly restY: number;
  private readonly listHomeX: number;

  public constructor(props: PaperBoardProps) {
    const {
      image,
      points,
      caption = '',
      paperHeight = 640,
      paperX = -560,
      paperY = 20,
      listX = 200,
      rowStep = 150,
      fontSize = 30,
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});
    this.asideX = paperX;
    this.restY = paperY;
    this.listHomeX = listX;

    // 论文卡：中央首发，入场时微旋下落
    this.add(
      <Rect
        ref={this.paperWrap}
        layout
        direction={'column'}
        alignItems={'center'}
        gap={14}
        x={this.homeX}
        y={paperY - 120}
        padding={16}
        fill={DEEP}
        stroke={LINE}
        lineWidth={2}
        radius={12}
        shadowColor={'rgba(0,0,0,0.5)'}
        shadowBlur={30}
        shadowOffset={[0, 12]}
        rotation={-4}
        scale={0.9}
        opacity={0}
      >
        <Img src={image} height={paperHeight} radius={6} />
        {caption ? (
          <Txt
            text={caption}
            fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
            fontSize={24}
            fill={MUTED}
          />
        ) : null}
      </Rect>,
    );

    // 右侧有序列表：行位置固定，逐行滑入
    const topY = paperY - ((points.length - 1) / 2) * rowStep;
    points.forEach((point, i) => {
      this.add(
        <Rect
          ref={this.rows}
          layout
          direction={'row'}
          alignItems={'center'}
          gap={16}
          x={listX + 80}
          y={topY + i * rowStep}
          opacity={0}
        >
          <Rect
            layout
            width={56}
            height={56}
            radius={12}
            fill={tint(ACCENT, 0.22)}
            stroke={ACCENT}
            lineWidth={2}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              text={String(i + 1)}
              fontFamily={'Consolas, Menlo, monospace'}
              fontSize={28}
              fontWeight={700}
              fill={ACCENT}
            />
          </Rect>
          <Txt
            ref={this.rowTxts}
            text={point}
            fontFamily={'"Microsoft YaHei", "PingFang SC", sans-serif'}
            fontSize={fontSize}
            fill={PAPER}
            lineHeight={48}
            textWrap={true}
            width={600}
          />
        </Rect>,
      );
    });
  }

  /** 论文入场：微旋下落 + 回弹落定 */
  public *reveal(): ThreadGenerator {
    const paper = this.paperWrap();
    yield* all(
      paper.opacity(1, 0.5, easeOutCubic),
      paper.y(this.restY, 0.7, easeOutCubic),
      paper.scale(1, 0.7, easeOutBack),
      paper.rotation(0, 0.7, easeOutCubic),
    );
  }

  /** 论文移到左侧 */
  public *moveAside(duration = 0.8): ThreadGenerator {
    yield* this.paperWrap().x(this.asideX, duration, easeInOutCubic);
  }

  /** 右侧论点逐行从右滑入 */
  public *showPoints(): ThreadGenerator {
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      yield* all(
        row.opacity(1, 0.35, easeOutCubic),
        row.x(this.listHomeX, 0.45, easeOutCubic),
      );
      yield* waitFor(0.35);
    }
  }

  /** 完整流程：入场 → 左移 → 逐条论点 */
  public *run(): ThreadGenerator {
    yield* this.reveal();
    yield* waitFor(0.5);
    yield* this.moveAside();
    yield* waitFor(0.25);
    yield* this.showPoints();
  }
}
