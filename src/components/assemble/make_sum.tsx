import { Img, Layout, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  createRefArray,
  delay,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import moneyIcon from "../../assets/binary/money.svg";
import { Ink } from "../../theme/ink";
import { inkFade, inkReveal } from "../../theme/ink_anim";

/** 单次放入：面值 + 是否因超过目标而丢弃 */
export interface MakeSumStep {
  weight: number;
  /** true：放入后总和大于目标，随后丢掉 */
  discard: boolean;
}

export interface MakeSumProps extends NodeProps {
  /** 目标数，默认 2026 */
  target?: number;
  /**
   * 凑数脚本。默认对应 2026：
   * 1000×3（末次丢）、100×1（丢）、10×3（末次丢）、1×6（不丢）
   */
  script?: MakeSumStep[];
  /** 主字号，默认 42 */
  fontSize?: number;
  /** 钞票图标边长，默认 56 */
  iconSize?: number;
}

/** 2026 的默认凑数剧本 */
export const MAKE_SUM_2026: MakeSumStep[] = [
  { weight: 1000, discard: false },
  { weight: 1000, discard: false },
  { weight: 1000, discard: true },
  { weight: 100, discard: true },
  { weight: 10, discard: false },
  { weight: 10, discard: false },
  { weight: 10, discard: true },
  { weight: 1, discard: false },
  { weight: 1, discard: false },
  { weight: 1, discard: false },
  { weight: 1, discard: false },
  { weight: 1, discard: false },
  { weight: 1, discard: false },
];

const BOX_FILL = "#2A2A2A";

type Relation = "lt" | "gt" | "eq";

function relationOf(sum: number, target: number): Relation {
  if (sum < target) {
    return "lt";
  }
  if (sum > target) {
    return "gt";
  }
  return "eq";
}

function relationLabel(r: Relation): string {
  if (r === "lt") {
    return "小于";
  }
  if (r === "gt") {
    return "大于";
  }
  return "等于";
}

function relationColor(r: Relation): string {
  if (r === "gt") {
    return Ink.warn;
  }
  if (r === "eq") {
    return Ink.gold;
  }
  return Ink.teal;
}

/**
 * 凑数演示：用钞票面值（1000 / 100 / 10 / 1）往空盒里放，
 * 实时比较与目标的大小；超过则警告并丢掉该项。
 * 完整场景片段，挂在 assemble 分类下。
 */
export class MakeSum extends Node {
  private readonly targetBox = createRef<Rect>();
  private readonly sumBox = createRef<Rect>();
  private readonly targetTxt = createRef<Txt>();
  private readonly sumTxt = createRef<Txt>();
  private readonly relationTxt = createRef<Txt>();
  private readonly hintTxt = createRef<Txt>();

  /** 每种面值一个源节点（图标上、面值下），放钞时从这里复制 */
  private readonly noteSources = createRefArray<Layout>();
  private readonly denominations: number[];
  private readonly noteByWeight = new Map<number, Layout>();

  private readonly target: number;
  private readonly script: MakeSumStep[];
  private readonly iconSize: number;

  private sum = 0;
  private nextStep = 0;

  public constructor(props: MakeSumProps) {
    const {
      target = 2026,
      script = MAKE_SUM_2026,
      fontSize = 42,
      iconSize = 56,
      ...nodeProps
    } = props;

    super(nodeProps);

    if (!Number.isInteger(target) || target < 0) {
      throw new Error("MakeSum: target 须为非负整数");
    }
    if (script.length === 0) {
      throw new Error("MakeSum: script 不能为空");
    }

    this.target = target;
    this.script = script;
    this.iconSize = iconSize;
    this.denominations = [...new Set(script.map((s) => s.weight))].sort(
      (a, b) => b - a,
    );

    const root = createRef<Layout>();
    this.add(
      <Layout
        ref={root}
        layout
        direction={"column"}
        gap={40}
        alignItems={"center"}
      />,
    );

    // —— 上方：钞票面值（同面值只显示一个）——
    const pool = createRef<Layout>();
    root().add(
      <Layout
        ref={pool}
        layout
        direction={"row"}
        gap={48}
        alignItems={"center"}
        justifyContent={"center"}
      />,
    );

    for (const den of this.denominations) {
      pool().add(
        <Layout
          ref={this.noteSources}
          layout
          direction={"column"}
          gap={8}
          alignItems={"center"}
          opacity={0}
        >
          <Img src={moneyIcon} width={iconSize} height={iconSize * 0.8} />
          <Txt
            text={`${den}`}
            fontFamily={Ink.font}
            fontSize={26}
            fill={Ink.paper}
            fontWeight={600}
          />
        </Layout>,
      );
      this.noteByWeight.set(den, this.noteSources[this.noteSources.length - 1]);
    }

    // —— 中央：目标盒 | 关系 | 凑数盒 ——
    const stage = createRef<Layout>();
    root().add(
      <Layout
        ref={stage}
        layout
        direction={"row"}
        gap={36}
        alignItems={"center"}
      />,
    );

    stage().add(
      <Rect
        ref={this.targetBox}
        layout
        direction={"column"}
        gap={12}
        padding={28}
        width={220}
        height={180}
        fill={BOX_FILL}
        stroke={Ink.line}
        lineWidth={2}
        radius={Ink.radius}
        alignItems={"center"}
        justifyContent={"center"}
        opacity={0}
      >
        <Txt
          text={"目标"}
          fontFamily={Ink.font}
          fontSize={22}
          fill={Ink.paperSoft}
        />
        <Txt
          ref={this.targetTxt}
          text={`${target}`}
          fontFamily={Ink.font}
          fontSize={fontSize + 8}
          fill={Ink.paper}
          fontWeight={700}
        />
      </Rect>,
    );

    stage().add(
      <Layout layout direction={"column"} gap={8} alignItems={"center"}>
        <Txt
          ref={this.relationTxt}
          text={"？"}
          fontFamily={Ink.font}
          fontSize={36}
          fill={Ink.muted}
          opacity={0}
        />
        <Txt
          ref={this.hintTxt}
          text={""}
          fontFamily={Ink.font}
          fontSize={20}
          fill={Ink.muted}
          opacity={0}
        />
      </Layout>,
    );

    stage().add(
      <Rect
        ref={this.sumBox}
        layout
        direction={"column"}
        gap={12}
        padding={24}
        width={280}
        height={180}
        fill={BOX_FILL}
        stroke={Ink.line}
        lineWidth={2}
        radius={Ink.radius}
        alignItems={"center"}
        justifyContent={"center"}
        opacity={0}
      >
        <Txt
          text={"凑数盒"}
          fontFamily={Ink.font}
          fontSize={22}
          fill={Ink.paperSoft}
        />
        <Txt
          ref={this.sumTxt}
          text={"0"}
          fontFamily={Ink.font}
          fontSize={fontSize + 4}
          fill={Ink.gold}
          fontWeight={700}
        />
      </Rect>,
    );
  }

  public get stepCount(): number {
    return this.script.length;
  }

  public get currentSum(): number {
    return this.sum;
  }

  /** 入场：面值 → 两盒 → 关系 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* all(
      ...this.noteSources.map((n, i) =>
        delay(0.06 * i, inkReveal(n, { duration, fromY: 12 })),
      ),
    );
    yield* waitFor(0.15);
    yield* all(
      inkReveal(this.targetBox(), { duration, fromY: 16 }),
      inkReveal(this.sumBox(), { duration, fromY: 16 }),
    );
    yield* waitFor(0.1);
    yield* inkReveal(this.relationTxt(), { duration: 0.35, fromY: 8 });
  }

  private refreshSum(): void {
    this.sumTxt().text(`${this.sum}`);
  }

  private *setRelation(sum: number, duration = 0.35): ThreadGenerator {
    const r = relationOf(sum, this.target);
    const label = relationLabel(r);
    const color = relationColor(r);

    this.relationTxt().text(label);
    this.hintTxt().text(
      r === "gt" ? "超过目标，丢掉！" : r === "eq" ? "刚好凑成！" : "还不够",
    );

    yield* all(
      this.relationTxt().fill(color, duration, easeOutCubic),
      this.relationTxt().opacity(1, duration * 0.5),
      this.hintTxt().fill(color, duration, easeOutCubic),
      this.hintTxt().opacity(1, duration * 0.5),
      this.sumBox().stroke(
        r === "gt" ? Ink.warn : r === "eq" ? Ink.gold : Ink.line,
        duration,
        easeOutCubic,
      ),
      this.sumTxt().fill(
        r === "gt" ? Ink.warn : Ink.gold,
        duration,
        easeOutCubic,
      ),
    );
  }

  /** 从源面值处复制一张钞票（图标 + 面值） */
  private spawnFlyer(weight: number): { flyer: Layout; valueTxt: Txt } {
    const source = this.noteByWeight.get(weight);
    if (!source) {
      throw new Error(`MakeSum: 未找到面值 ${weight} 的源节点`);
    }
    const pos = source.absolutePosition();
    const flyerRef = createRef<Layout>();
    const valueRef = createRef<Txt>();

    this.add(
      <Layout
        ref={flyerRef}
        layout
        direction={"column"}
        gap={8}
        alignItems={"center"}
        zIndex={30}
      >
        <Img
          src={moneyIcon}
          width={this.iconSize}
          height={this.iconSize * 0.8}
        />
        <Txt
          ref={valueRef}
          text={`${weight}`}
          fontFamily={Ink.font}
          fontSize={26}
          fill={Ink.paper}
          fontWeight={600}
        />
      </Layout>,
    );

    const flyer = flyerRef();
    flyer.layout(false);
    flyer.absolutePosition(new Vector2(pos.x, pos.y));
    return { flyer, valueTxt: valueRef() };
  }

  /**
   * 执行下一步：从上方面值复制钞票飞入 → 更新和 → 显示关系；
   * 若超标则警告并丢掉该钞。
   */
  public *playStep(
    options: {
      flyDuration?: number;
      hold?: number;
      discardDuration?: number;
    } = {},
  ): ThreadGenerator {
    if (this.nextStep >= this.script.length) {
      return;
    }

    const {
      flyDuration = 0.55,
      hold = 0.35,
      discardDuration = 0.55,
    } = options;

    const step = this.script[this.nextStep];
    this.nextStep += 1;

    const { flyer, valueTxt } = this.spawnFlyer(step.weight);
    const targetPos = this.sumBox().absolutePosition();

    yield* all(
      flyer.absolutePosition(targetPos, flyDuration, easeInOutCubic),
      flyer.scale(1.1, flyDuration * 0.45, easeOutCubic).to(0.95, flyDuration * 0.55),
    );

    this.sum += step.weight;
    this.refreshSum();
    flyer.opacity(0);

    yield* this.setRelation(this.sum, 0.3);
    yield* waitFor(hold);

    if (step.discard) {
      yield* all(
        this.sumBox().stroke(Ink.warn, 0.15).to(Ink.warn, 0.2),
        this.relationTxt().scale(1.15, 0.2, easeOutCubic).to(1, 0.2),
      );

      flyer.opacity(1);
      valueTxt.fill(Ink.warn);

      const throwTo = new Vector2(targetPos.x + 280, targetPos.y + 160);
      yield* all(
        flyer.absolutePosition(throwTo, discardDuration, easeInCubic),
        flyer.opacity(0, discardDuration, easeInCubic),
        flyer.rotation(28, discardDuration, easeInCubic),
        flyer.scale(0.7, discardDuration, easeInCubic),
      );
      flyer.remove();

      this.sum -= step.weight;
      this.refreshSum();
      yield* this.setRelation(this.sum, 0.3);
      yield* waitFor(hold * 0.6);
    } else {
      flyer.remove();
      if (relationOf(this.sum, this.target) === "eq") {
        yield* all(
          this.sumBox().stroke(Ink.gold, 0.35),
          this.relationTxt().scale(1.2, 0.25, easeOutCubic).to(1, 0.25),
          this.targetBox().stroke(Ink.gold, 0.35),
        );
      }
    }
  }

  /** 完整播放全部凑数步骤 */
  public *play(
    options: {
      showDuration?: number;
      pauseAfterShow?: number;
      flyDuration?: number;
      hold?: number;
      discardDuration?: number;
      stepGap?: number;
    } = {},
  ): ThreadGenerator {
    const {
      showDuration = 0.55,
      pauseAfterShow = 0.45,
      flyDuration = 0.5,
      hold = 0.28,
      discardDuration = 0.5,
      stepGap = 0.12,
    } = options;

    yield* this.show(showDuration);
    yield* waitFor(pauseAfterShow);

    while (this.nextStep < this.script.length) {
      yield* this.playStep({ flyDuration, hold, discardDuration });
      if (this.nextStep < this.script.length && stepGap > 0) {
        yield* waitFor(stepGap);
      }
    }

    yield* waitFor(0.6);
  }

  public *hide(duration = 0.4): ThreadGenerator {
    yield* inkFade(
      [
        ...this.noteSources,
        this.targetBox(),
        this.sumBox(),
        this.relationTxt(),
        this.hintTxt(),
      ],
      { duration },
    );
  }
}
