import {Layout, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  all,
  createRef,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const CARD = '#121820';
const LINE = '#2a3a4c';
const MUTED = '#7a8a9c';
const PAPER = '#e8eef7';
const MONO = '"Cascadia Mono", "Consolas", "JetBrains Mono", monospace';

export interface EncodingIntroInfo {
  /** 简称 */
  short: string;
  /** 全称 */
  full: string;
  /** 中文名 */
  chinese: string;
  /** 提出方 */
  by: string;
  /** 核心特点 */
  trait: string;
  /** 强调色 */
  accent?: string;
}

export interface EncodingIntroCardProps extends NodeProps {
  width?: number;
}

/**
 * 编码介绍卡片：简称 / 全称 / 中文 / 提出方 / 核心特点，支持切换并淡入淡出。
 */
export class EncodingIntroCard extends Node {
  private readonly box = createRef<Rect>();
  private readonly accentBar = createRef<Rect>();
  private readonly shortTxt = createRef<Txt>();
  private readonly fullTxt = createRef<Txt>();
  private readonly chineseTxt = createRef<Txt>();
  private readonly byTxt = createRef<Txt>();
  private readonly traitTxt = createRef<Txt>();

  private readonly cardW: number;
  private visible = false;

  public constructor(props: EncodingIntroCardProps = {}) {
    const {width = 520, ...rest} = props;
    super({opacity: 0, ...rest});
    this.cardW = width;

    this.add(
      <Rect
        ref={this.box}
        layout
        direction={'column'}
        width={width}
        gap={16}
        padding={[26, 30]}
        radius={16}
        fill={CARD}
        stroke={LINE}
        lineWidth={2}
        scale={0.94}
      >
        <Layout layout direction={'row'} gap={14} alignItems={'center'}>
          <Rect ref={this.accentBar} width={5} height={36} radius={3} fill={'#3dd6c6'} />
          <Txt
            ref={this.shortTxt}
            text={''}
            fontFamily={MONO}
            fontSize={40}
            fontWeight={700}
            fill={PAPER}
          />
        </Layout>

        {this.row('全称', this.fullTxt)}
        {this.row('中文', this.chineseTxt)}
        {this.row('提出方', this.byTxt)}
        {this.row('核心特点', this.traitTxt)}
      </Rect>,
    );
  }

  private row(label: string, valueRef: ReturnType<typeof createRef<Txt>>) {
    return (
      <Layout layout direction={'column'} gap={6} width={this.cardW - 64}>
        <Txt
          text={label}
          fontFamily={MONO}
          fontSize={16}
          fill={MUTED}
        />
        <Txt
          ref={valueRef}
          text={''}
          fontFamily={MONO}
          fontSize={22}
          fill={PAPER}
          width={this.cardW - 64}
          textWrap
        />
      </Layout>
    );
  }

  private applyInfo(info: EncodingIntroInfo) {
    const accent = info.accent ?? '#3dd6c6';
    this.accentBar().fill(accent);
    this.box().stroke(accent);
    this.shortTxt().text(info.short);
    this.shortTxt().fill(accent);
    this.fullTxt().text(info.full);
    this.chineseTxt().text(info.chinese);
    this.byTxt().text(info.by);
    this.traitTxt().text(info.trait);
  }

  /** 首次或切换：若已显示则先淡出再换内容淡入 */
  public *showInfo(info: EncodingIntroInfo, duration = 0.45): ThreadGenerator {
    if (this.visible) {
      yield* all(
        this.opacity(0, duration * 0.45, easeOutCubic),
        this.box().scale(0.94, duration * 0.45, easeOutCubic),
      );
    }
    this.applyInfo(info);
    this.visible = true;
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.box().scale(1, duration, easeOutBack),
    );
    yield* waitFor(0.05);
  }

  public *hide(duration = 0.35): ThreadGenerator {
    if (!this.visible) return;
    yield* all(
      this.opacity(0, duration, easeOutCubic),
      this.box().scale(0.94, duration, easeOutCubic),
    );
    this.visible = false;
  }
}
