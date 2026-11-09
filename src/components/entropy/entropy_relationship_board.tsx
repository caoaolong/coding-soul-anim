import {
  Circle,
  Latex,
  Line,
  Node,
  NodeProps,
  Rect,
  Txt,
} from '@motion-canvas/2d';
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
import {FONT} from '../../theme/fonts';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const CARD = '#121820';
const DEEP = '#0e141c';
const LINE = '#2a3a4c';
const ACCENT = '#3dd6c6';
const GOLD = '#ffb454';
const BLUE = '#7aa2ff';
const GREEN = '#a3e635';

export interface EntropyRelationshipBoardProps extends NodeProps {}

/**
 * 第五章组件：信息量、信息熵和交叉熵之间的关系（<<<relationship>>>）
 * 1) 上半部：三张可视化卡片（单事件脉冲 → 单分布柱群 → 双分布对比），极简文字
 * 2) 下半部：H(P,Q) = H(P) + D_KL(P||Q) 分布对齐演示：
 *    左侧 Q 分布柱动态对齐到 P 分布柱，右侧 D_KL(P||Q) 能量块同步收缩至 0
 */
export class EntropyRelationshipBoard extends Node {
  private readonly conceptCards = createRefArray<Rect>();
  private readonly arrows = createRefArray<Txt>();

  // 卡片内部小型图形动画引用
  private readonly eventRing = createRef<Circle>();
  private readonly singleDistBars = createRefArray<Rect>();
  private readonly dualPBars = createRefArray<Rect>();
  private readonly dualQBars = createRefArray<Rect>();

  // 下半部 KL 散度对齐演示
  private readonly klCard = createRef<Rect>();
  private readonly alignPBars = createRefArray<Rect>();
  private readonly alignQBars = createRefArray<Rect>();
  private readonly klBarFill = createRef<Rect>();
  private readonly klBarTxt = createRef<Txt>();
  private readonly stateLabel = createRef<Txt>();

  private readonly pTargetHs = [125, 85, 50, 28];
  private readonly qInitHs = [42, 115, 95, 36];

  public constructor(props: EntropyRelationshipBoardProps = {}) {
    super({...props});

    const cards = [
      {
        x: -545,
        title: '信息量',
        tag: '单个事件',
        formula: 'I(x) = -\\log_{2} P(x)',
        color: ACCENT,
      },
      {
        x: 0,
        title: '信息熵',
        tag: '一个概率分布 P',
        formula: 'H(P) = -\\sum_{i} p_{i}\\log_{2} p_{i}',
        color: GOLD,
      },
      {
        x: 545,
        title: '交叉熵',
        tag: '两个概率分布 P, Q',
        formula: 'H(P, Q) = -\\sum_{i} p_{i}\\log_{2} q_{i}',
        color: BLUE,
      },
    ];

    cards.forEach((c, idx) => {
      this.add(
        <Rect
          ref={this.conceptCards}
          width={490}
          height={310}
          x={c.x}
          y={-180}
          fill={CARD}
          stroke={c.color}
          lineWidth={2.5}
          radius={18}
          opacity={0}
          scale={0.9}
        >
          <Txt
            text={c.title}
            fontFamily={FONT}
            fontSize={30}
            fontWeight={700}
            fill={c.color}
            x={-205}
            y={-112}
            offset={[-1, 0]}
          />
          <Rect
            width={185}
            height={36}
            x={115}
            y={-112}
            radius={8}
            fill={DEEP}
            stroke={c.color}
            lineWidth={1.5}
          >
            <Txt
              text={c.tag}
              fontFamily={FONT}
              fontSize={18}
              fontWeight={700}
              fill={c.color}
            />
          </Rect>

          {/* 中部可视化微缩示意图 */}
          <Rect
            width={430}
            height={115}
            y={-22}
            radius={12}
            fill={DEEP}
            stroke={LINE}
            lineWidth={1.5}
          >
            {idx === 0 ? (
              <Node>
                <Circle
                  ref={this.eventRing}
                  size={36}
                  stroke={ACCENT}
                  lineWidth={2.5}
                  opacity={0.8}
                />
                <Circle size={22} fill={ACCENT} />
                <Txt
                  text={'x'}
                  fontFamily={FONT}
                  fontSize={22}
                  fontWeight={700}
                  fill={DEEP}
                />
              </Node>
            ) : null}

            {idx === 1 ? (
              <Node y={42}>
                {[78, 52, 36, 64].map((h, bi) => (
                  <Rect
                    ref={this.singleDistBars}
                    width={36}
                    height={0}
                    x={(bi - 1.5) * 68}
                    offset={[0, 1]}
                    radius={5}
                    fill={GOLD}
                    data-h={h}
                  />
                ))}
              </Node>
            ) : null}

            {idx === 2 ? (
              <Node y={42}>
                {[78, 52, 36, 64].map((ph, bi) => {
                  const qh = [44, 76, 62, 28][bi];
                  const gx = (bi - 1.5) * 78;
                  return (
                    <Node x={gx}>
                      <Rect
                        ref={this.dualPBars}
                        width={22}
                        height={0}
                        x={-13}
                        offset={[0, 1]}
                        radius={4}
                        fill={ACCENT}
                        data-h={ph}
                      />
                      <Rect
                        ref={this.dualQBars}
                        width={22}
                        height={0}
                        x={13}
                        offset={[0, 1]}
                        radius={4}
                        fill={BLUE}
                        data-h={qh}
                      />
                    </Node>
                  );
                })}
              </Node>
            ) : null}
          </Rect>

          {/* 底部公式 */}
          <Latex tex={[c.formula]} fontSize={32} fill={PAPER} y={92} />
        </Rect>,
      );
    });

    [-272, 272].forEach(ax => {
      this.add(
        <Txt
          ref={this.arrows}
          text={'⇒'}
          fontFamily={FONT}
          fontSize={42}
          fontWeight={700}
          fill={MUTED}
          x={ax}
          y={-180}
          opacity={0}
        />,
      );
    });

    // 下半部：KL 散度与分布对齐演示台
    this.add(
      <Rect
        ref={this.klCard}
        width={1580}
        height={390}
        y={215}
        fill={CARD}
        stroke={BLUE}
        lineWidth={2.5}
        radius={18}
        opacity={0}
        scale={0.94}
      >
        {/* 顶栏：恒等式 */}
        <Latex
          tex={['H(P, Q) = H(P) + D_{\\mathrm{KL}}(P\\,\\|\\,Q)']}
          fontSize={46}
          fill={PAPER}
          x={-360}
          y={-125}
        />
        <Latex
          tex={['D_{\\mathrm{KL}}(P\\,\\|\\,Q) \\ge 0 \\implies H(P, Q) \\ge H(P)']}
          fontSize={32}
          fill={GOLD}
          x={380}
          y={-125}
        />

        <Line
          points={[
            [-730, -68],
            [730, -68],
          ]}
          stroke={LINE}
          lineWidth={1.5}
        />

        {/* 左下：P 与 Q 分布柱动态拟合演示 */}
        <Txt
          text={'分布拟合演示（青：P  |  金：Q）'}
          fontFamily={FONT}
          fontSize={22}
          fontWeight={700}
          fill={MUTED}
          x={-470}
          y={-30}
        />
        <Line
          points={[
            [-680, 145],
            [-260, 145],
          ]}
          stroke={LINE}
          lineWidth={2}
        />
        {this.pTargetHs.map((ph, i) => {
          const qh = this.qInitHs[i];
          const gx = -615 + i * 96;
          return (
            <Node x={gx} y={145}>
              <Rect
                ref={this.alignPBars}
                width={30}
                height={ph}
                x={-17}
                offset={[0, 1]}
                radius={[6, 6, 0, 0]}
                fill={ACCENT}
              />
              <Rect
                ref={this.alignQBars}
                width={30}
                height={qh}
                x={17}
                offset={[0, 1]}
                radius={[6, 6, 0, 0]}
                fill={GOLD}
              />
            </Node>
          );
        })}

        {/* 右下：H(P,Q) = H(P) + D_KL 活塞能量条 */}
        <Txt
          ref={this.stateLabel}
          text={'当 Q ≠ P 时：存在额外代价 D_KL(P ‖ Q) > 0'}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={700}
          fill={GOLD}
          x={240}
          y={-18}
        />

        {/* 左段固定 H(P) */}
        <Rect
          width={420}
          height={64}
          x={10}
          y={68}
          radius={[12, 0, 0, 12]}
          fill={'rgba(61, 214, 198, 0.24)'}
          stroke={ACCENT}
          lineWidth={2.5}
        >
          <Txt
            text={'真实分布熵 H(P)'}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={ACCENT}
          />
        </Rect>

        {/* 右段动态收缩 D_KL(P||Q) */}
        <Rect
          ref={this.klBarFill}
          width={460}
          height={64}
          x={220}
          y={68}
          offset={[-1, 0]}
          radius={[0, 12, 12, 0]}
          fill={'rgba(255, 180, 84, 0.26)'}
          stroke={GOLD}
          lineWidth={2.5}
          clip
        >
          <Txt
            ref={this.klBarTxt}
            text={'+ 额外代价 D_KL(P ‖ Q)'}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={700}
            fill={GOLD}
          />
        </Rect>
      </Rect>,
    );
  }

  public *play(): ThreadGenerator {
    const pHs = [78, 52, 36, 64];
    const qHs = [44, 76, 62, 28];

    // 1) 三张概念卡片 + 内部微缩动画依次展开
    yield* all(
      this.conceptCards[0].opacity(1, 0.38, easeOutCubic),
      this.conceptCards[0].scale(1, 0.42, easeOutBack),
      this.eventRing().size(92, 0.65, easeOutCubic),
      this.eventRing().opacity(0.15, 0.65, easeOutCubic),
    );
    yield* this.arrows[0].opacity(1, 0.2);

    yield* all(
      this.conceptCards[1].opacity(1, 0.38, easeOutCubic),
      this.conceptCards[1].scale(1, 0.42, easeOutBack),
      ...this.singleDistBars.map((b, i) =>
        b.height(pHs[i], 0.45, easeOutBack),
      ),
    );
    yield* this.arrows[1].opacity(1, 0.2);

    yield* all(
      this.conceptCards[2].opacity(1, 0.38, easeOutCubic),
      this.conceptCards[2].scale(1, 0.42, easeOutBack),
      ...this.dualPBars.map((b, i) => b.height(pHs[i], 0.45, easeOutBack)),
      ...this.dualQBars.map((b, i) => b.height(qHs[i], 0.45, easeOutBack)),
    );
    yield* waitFor(0.3);

    // 2) 下半部 KL 散度演示台入场
    yield* all(
      this.klCard().opacity(1, 0.42, easeOutCubic),
      this.klCard().scale(1, 0.48, easeOutBack),
    );
    yield* waitFor(0.5);

    // 3) 动态演示 Q → P：左侧 4 根金色 Q 柱拟合对齐到青色 P 柱，右侧 D_KL 活塞同步归零！
    yield* all(
      ...this.alignQBars.map((qb, i) =>
        all(
          qb.height(this.pTargetHs[i], 1.1, easeInOutCubic),
          qb.fill(GREEN, 1.1, easeInOutCubic),
        ),
      ),
      this.klBarTxt().opacity(0, 0.4, easeOutCubic),
      this.klBarFill().width(0, 1.1, easeInOutCubic),
      this.klBarFill().opacity(0, 1.0, easeOutCubic),
      this.stateLabel().text('当 Q = P 时：D_KL(P ‖ Q) = 0  ⇒  H(P, Q) = H(P)', 0.4),
      this.stateLabel().fill(GREEN, 0.4),
    );

    yield* waitFor(1.2);
  }
}
