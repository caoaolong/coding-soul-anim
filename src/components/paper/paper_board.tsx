import {Img, Latex, Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
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

const PAPER = '#e8eef7';
const ACCENT = '#3dd6c6';
const DEEP = '#121820';
const LINE = '#2a3a4c';
const MUTED = '#8a9bb0';
const SHEET = '#1a2430';

/** #rrggbb + 透明度 → rgba() 字符串 */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 论点：纯文本，或文本 + 下方 LaTeX 公式 */
export type PaperPoint =
  | string
  | {
      text: string;
      /** 显示在论点下方的 LaTeX 公式（不含 $） */
      formula?: string;
    };

function normalizePoint(point: PaperPoint): {text: string; formula?: string} {
  return typeof point === 'string' ? {text: point} : point;
}

export interface PaperBoardProps extends NodeProps {
  /** 论文图片 */
  image: string;
  /** 右侧主要论点（有序列表，依次显示） */
  points: PaperPoint[];
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
  /** 公式字号，默认 32 */
  formulaSize?: number;
  /** 伪 3D 衬页层数（不含主页），默认 3 */
  depthLayers?: number;
}

/**
 * 论文展示：伪 3D 衬页堆叠入场 → 正视落定 → 移到左侧 → 右侧论点依次显示。
 */
export class PaperBoard extends Node {
  private readonly stage = createRef<Node>();
  private readonly sheets = createRefArray<Rect>();
  private readonly paperWrap = createRef<Rect>();
  private readonly glow = createRef<Rect>();
  private readonly rows = createRefArray<Rect>();
  private readonly rowTxts = createRefArray<Txt>();

  private readonly homeX = 0;
  private readonly asideX: number;
  private readonly restY: number;
  private readonly listHomeX: number;
  private readonly depthCount: number;

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
      formulaSize = 32,
      depthLayers = 3,
      ...nodeProps
    } = props;

    super({opacity: 1, ...nodeProps});
    this.asideX = paperX;
    this.restY = paperY;
    this.listHomeX = listX;
    this.depthCount = Math.max(0, depthLayers);

    // 估算卡片宽（按常见论文竖版比例），供衬页对齐
    const cardW = paperHeight * 0.78;
    const cardH = paperHeight + (caption ? 56 : 20);

    this.add(
      <Node ref={this.stage} x={this.homeX} y={paperY - 140} scale={0.88}>
        {/* 伪 3D 衬页：由后向前堆叠 */}
        {Array.from({length: this.depthCount}, (_, i) => {
          const depth = this.depthCount - i;
          const pose = this.sheetPose(depth, true);
          return (
            <Rect
              ref={this.sheets}
              width={cardW}
              height={cardH}
              radius={12}
              fill={SHEET}
              stroke={LINE}
              lineWidth={2}
              x={pose.x}
              y={pose.y}
              scale={pose.scale}
              rotation={pose.rotation}
              opacity={0}
              zIndex={i}
              shadowColor={'rgba(0,0,0,0.4)'}
              shadowBlur={18 + depth * 4}
              shadowOffset={[8 + depth * 2, 10 + depth * 2]}
            />
          );
        })}

        {/* 主论文卡 */}
        <Rect
          ref={this.paperWrap}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={14}
          padding={16}
          fill={DEEP}
          stroke={ACCENT}
          lineWidth={2}
          radius={12}
          shadowColor={'rgba(0,0,0,0.55)'}
          shadowBlur={36}
          shadowOffset={[14, 18]}
          rotation={-10}
          scale={0.92}
          opacity={0}
          zIndex={this.depthCount + 1}
        >
          {/* 顶部高光条：模拟受光面 */}
          <Rect
            ref={this.glow}
            width={cardW - 8}
            height={10}
            radius={5}
            fill={tint(ACCENT, 0.35)}
            opacity={0}
            layout={false}
            y={-paperHeight * 0.5 - 2}
          />
          <Img src={image} height={paperHeight} radius={6} />
          {caption ? (
            <Txt
              text={caption}
              fontFamily={FONT}
              fontSize={22}
              fill={MUTED}
              width={paperHeight * 0.85}
              textWrap={true}
              textAlign={'center'}
            />
          ) : null}
        </Rect>
      </Node>,
    );

    // 右侧有序列表：行位置固定，逐行滑入
    const topY = paperY - ((points.length - 1) / 2) * rowStep;
    points.forEach((raw, i) => {
      const point = normalizePoint(raw);
      this.add(
        <Rect
          ref={this.rows}
          layout
          direction={'row'}
          alignItems={'start'}
          gap={16}
          // 左对齐：listX 表示列表左缘，避免宽文本向左侵占论文卡片
          offset={[-1, 0]}
          x={listX + 100}
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
              fontFamily={FONT}
              fontSize={28}
              fontWeight={700}
              fill={ACCENT}
            />
          </Rect>
          <Layout direction={'column'} gap={14} alignItems={'start'}>
            <Txt
              ref={this.rowTxts}
              text={point.text}
              fontFamily={FONT}
              fontSize={fontSize}
              fill={PAPER}
              lineHeight={48}
              textWrap={true}
              width={620}
            />
            {point.formula ? (
              <Latex
                tex={[point.formula]}
                fill={ACCENT}
                fontSize={formulaSize}
              />
            ) : null}
          </Layout>
        </Rect>,
      );
    });
  }

  /** 衬页姿态：spread=true 时更散，落定后收拢 */
  private sheetPose(depth: number, spread: boolean) {
    const k = spread ? 1.35 : 1;
    return {
      x: depth * 18 * k,
      y: depth * 14 * k,
      scale: 1 - depth * 0.045,
      rotation: depth * 3.2 * k,
    };
  }

  /** 论文入场：衬页散开 → 主页旋落 → 收拢成立体叠放 */
  public *reveal(): ThreadGenerator {
    const stage = this.stage();
    const paper = this.paperWrap();

    // 衬页由后向前弹出
    yield* all(
      ...this.sheets.map((sheet, i) => {
        const depth = this.depthCount - i;
        const pose = this.sheetPose(depth, true);
        sheet.position(new Vector2(pose.x + 40, pose.y + 60));
        sheet.rotation(pose.rotation + 8);
        return delay(
          i * 0.07,
          all(
            sheet.opacity(0.85 - i * 0.08, 0.35, easeOutCubic),
            sheet.position(new Vector2(pose.x, pose.y), 0.55, easeOutCubic),
            sheet.rotation(pose.rotation, 0.55, easeOutCubic),
            sheet.scale(pose.scale, 0.55, easeOutBack),
          ),
        );
      }),
    );

    // 主论文从斜上方旋入
    yield* all(
      paper.opacity(1, 0.45, easeOutCubic),
      paper.rotation(0, 0.75, easeOutCubic),
      paper.scale(1, 0.75, easeOutBack),
      paper.shadowBlur(42, 0.6, easeOutCubic),
      paper.shadowOffset([16, 20], 0.6, easeOutCubic),
      stage.y(this.restY, 0.8, easeOutCubic),
      stage.scale(1, 0.8, easeOutBack),
      this.glow().opacity(0.9, 0.5, easeOutCubic),
    );

    // 衬页收拢，形成更紧的立体厚度
    yield* all(
      ...this.sheets.map((sheet, i) => {
        const depth = this.depthCount - i;
        const pose = this.sheetPose(depth, false);
        return all(
          sheet.position(new Vector2(pose.x, pose.y), 0.45, easeInOutCubic),
          sheet.rotation(pose.rotation, 0.45, easeInOutCubic),
          sheet.scale(pose.scale, 0.45, easeInOutCubic),
          sheet.opacity(0.75 - i * 0.06, 0.35, easeOutCubic),
        );
      }),
      this.glow().opacity(0.45, 0.4, easeOutCubic),
    );
  }

  /** 论文移到左侧（带轻微透视倾角） */
  public *moveAside(duration = 0.85): ThreadGenerator {
    const stage = this.stage();
    yield* all(
      stage.x(this.asideX, duration, easeInOutCubic),
      stage.rotation(-3, duration, easeInOutCubic),
      stage.scale(0.92, duration, easeInOutCubic),
      this.paperWrap().shadowOffset([10, 22], duration, easeInOutCubic),
      this.paperWrap().shadowBlur(48, duration, easeInOutCubic),
      ...this.sheets.map((sheet, i) => {
        const depth = this.depthCount - i;
        return all(
          sheet.x(depth * 14, duration, easeInOutCubic),
          sheet.y(depth * 16, duration, easeInOutCubic),
          sheet.rotation(depth * 2.4 - 2, duration, easeInOutCubic),
        );
      }),
    );
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
    yield* waitFor(0.55);
    yield* this.moveAside();
    yield* waitFor(0.25);
    yield* this.showPoints();
  }
}
