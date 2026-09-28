import { Circle, Layout, Line, Node, NodeProps, Rect, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from "@motion-canvas/core";
import { Ink } from "../../theme/ink";
import { inkReveal } from "../../theme/ink_anim";

const LABEL_FONT = Ink.font;

export interface BitCellProps extends NodeProps {
  /**
   * 电路整体尺度，默认 150。
   * 影响 MOSFET / 电容尺寸与连线长度。
   */
  iconSize?: number;
  /** 位线方向拉伸（电容–MOS 纵向间距），默认 iconSize * 1.05 */
  pairGap?: number;
  /** 位数字号，默认 52 */
  bitFontSize?: number;
  /** 是否显示「电容」「晶体管」及 WL/BL 标注，默认 true */
  showParts?: boolean;
}

/**
 * 教学向 1-bit DRAM 存储单元（示意逻辑电路）：
 * 一个 MOSFET（晶体管开关）+ 一个电容（蓄电）。
 * 写 1：栅极导通 → 位线向电容充电；写 0：导通泄放 → 关断。
 */
export class BitCell extends Node {
  private readonly frame = createRef<Layout>();
  private readonly bitLine = createRef<Line>();
  private readonly wordLine = createRef<Line>();
  private readonly drainWire = createRef<Line>();
  private readonly storageWire = createRef<Line>();
  /** MOSFET：三道栅极竖线 */
  private readonly gateBar = createRef<Line>();
  private readonly channelBar = createRef<Line>();
  private readonly sourceArm = createRef<Line>();
  private readonly drainArm = createRef<Line>();
  private readonly gateDot = createRef<Circle>();
  /** 电容两极板 + 充电辉光 */
  private readonly capTop = createRef<Line>();
  private readonly capBot = createRef<Line>();
  private readonly capGlow = createRef<Rect>();
  private readonly bitTxt = createRef<Txt>();
  private readonly gateFill = createRef<Rect>();

  private bit: 0 | 1 = 0;
  private readonly idleStroke = Ink.line;
  private readonly activeStroke = Ink.goldSoft;

  public constructor(props: BitCellProps = {}) {
    const {
      iconSize = 150,
      pairGap,
      bitFontSize = 52,
      showParts = true,
      ...nodeProps
    } = props;

    super({ opacity: 0, ...nodeProps });

    const s = iconSize;
    const gap = pairGap ?? s * 1.05;

    // —— 坐标：电容在上、MOS 在下，中间竖位线 ——
    const capY = -gap;
    const mosY = gap * 0.35;
    const blX = 0;
    const wlY = mosY;
    const wlLeft = -s * 1.15;
    const wlRight = -s * 0.22;

    // MOSFET 符号（简化：栅极竖条 + 沟道 + 源/漏臂）
    const gateX = -s * 0.18;
    const chX = s * 0.02;
    const mosTop = mosY - s * 0.28;
    const mosBot = mosY + s * 0.28;
    const mosMid = mosY;

    // 电容平行板
    const capW = s * 0.42;
    const capGap = s * 0.14;

    this.add(
      <Layout ref={this.frame} layout={false}>
        {/* Word Line（栅极控制线） */}
        <Line
          ref={this.wordLine}
          points={[
            [wlLeft, wlY],
            [wlRight, wlY],
          ]}
          stroke={this.idleStroke}
          lineWidth={2.5}
          lineCap={"square"}
        />
        <Circle
          ref={this.gateDot}
          size={8}
          fill={this.idleStroke}
          x={wlRight}
          y={wlY}
        />

        {/* 栅极竖条（绝缘栅示意） */}
        <Line
          ref={this.gateBar}
          points={[
            [gateX, mosTop],
            [gateX, mosBot],
          ]}
          stroke={this.idleStroke}
          lineWidth={3}
          lineCap={"square"}
        />
        {/* 导通时栅极区域淡金填充 */}
        <Rect
          ref={this.gateFill}
          x={(gateX + chX) / 2}
          y={mosMid}
          width={Math.abs(chX - gateX) + 6}
          height={mosBot - mosTop}
          fill={Ink.gold}
          opacity={0}
          radius={2}
        />
        {/* 沟道 */}
        <Line
          ref={this.channelBar}
          points={[
            [chX, mosTop],
            [chX, mosBot],
          ]}
          stroke={this.idleStroke}
          lineWidth={2.5}
          lineCap={"square"}
        />
        {/* 漏极臂 → 接电容 */}
        <Line
          ref={this.drainArm}
          points={[
            [chX, mosTop],
            [blX, mosTop],
            [blX, mosTop - s * 0.08],
          ]}
          stroke={this.idleStroke}
          lineWidth={2.5}
          lineCap={"square"}
          lineJoin={"miter"}
        />
        {/* 源极臂 → 接位线下方 */}
        <Line
          ref={this.sourceArm}
          points={[
            [chX, mosBot],
            [blX, mosBot],
            [blX, mosBot + s * 0.35],
          ]}
          stroke={this.idleStroke}
          lineWidth={2.5}
          lineCap={"square"}
          lineJoin={"miter"}
        />

        {/* Bit Line：穿过 MOS 接到电容 */}
        <Line
          ref={this.bitLine}
          points={[
            [blX, mosBot + s * 0.35],
            [blX, mosTop - s * 0.08],
          ]}
          stroke={this.idleStroke}
          lineWidth={2}
          lineCap={"square"}
          opacity={0.35}
        />
        <Line
          ref={this.drainWire}
          points={[
            [blX, mosTop - s * 0.08],
            [blX, capY + capGap * 0.5 + 2],
          ]}
          stroke={this.idleStroke}
          lineWidth={2.5}
          lineCap={"square"}
        />
        <Line
          ref={this.storageWire}
          points={[
            [blX, capY - capGap * 0.5 - 2],
            [blX, capY - s * 0.55],
          ]}
          stroke={this.idleStroke}
          lineWidth={2}
          lineCap={"square"}
          opacity={0.5}
        />

        {/* 电容：两极板 + 充电辉光 */}
        <Rect
          ref={this.capGlow}
          x={blX}
          y={capY}
          width={capW * 1.35}
          height={capGap * 2.2}
          fill={Ink.gold}
          opacity={0}
          radius={3}
          shadowColor={Ink.gold}
          shadowBlur={18}
        />
        <Line
          ref={this.capTop}
          points={[
            [-capW / 2, capY - capGap / 2],
            [capW / 2, capY - capGap / 2],
          ]}
          stroke={this.idleStroke}
          lineWidth={4}
          lineCap={"square"}
        />
        <Line
          ref={this.capBot}
          points={[
            [-capW / 2, capY + capGap / 2],
            [capW / 2, capY + capGap / 2],
          ]}
          stroke={this.idleStroke}
          lineWidth={4}
          lineCap={"square"}
        />

        {/* 位值 */}
        <Txt
          ref={this.bitTxt}
          text={"0"}
          fontFamily={LABEL_FONT}
          fontSize={bitFontSize}
          fill={Ink.muted}
          x={s * 0.95}
          y={capY}
        />

        {showParts ? (
          <>
            <Txt
              text={"电容"}
              fontFamily={LABEL_FONT}
              fontSize={24}
              fill={Ink.paperSoft}
              x={-s * 0.95}
              y={capY}
            />
            <Txt
              text={"晶体管"}
              fontFamily={LABEL_FONT}
              fontSize={24}
              fill={Ink.paperSoft}
              x={-s * 1.05}
              y={mosY + s * 0.55}
            />
            <Txt
              text={"WL"}
              fontFamily={LABEL_FONT}
              fontSize={22}
              fill={Ink.teal}
              x={wlLeft + 22}
              y={wlY - 22}
            />
            <Txt
              text={"BL"}
              fontFamily={LABEL_FONT}
              fontSize={22}
              fill={Ink.teal}
              x={blX + 26}
              y={mosBot + s * 0.35}
            />
          </>
        ) : null}
      </Layout>,
    );
  }

  public getBit(): 0 | 1 {
    return this.bit;
  }

  private *setGateOn(duration: number): ThreadGenerator {
    yield* all(
      this.wordLine().stroke(this.activeStroke, duration, easeInOutCubic),
      this.gateBar().stroke(this.activeStroke, duration, easeInOutCubic),
      this.gateDot().fill(this.activeStroke, duration, easeInOutCubic),
      this.gateFill().opacity(0.22, duration, easeOutCubic),
      this.channelBar().stroke(this.activeStroke, duration, easeInOutCubic),
      this.drainArm().stroke(this.activeStroke, duration, easeInOutCubic),
      this.sourceArm().stroke(this.activeStroke, duration, easeInOutCubic),
      this.drainWire().stroke(this.activeStroke, duration, easeInOutCubic),
    );
  }

  private *setGateOff(duration: number): ThreadGenerator {
    yield* all(
      this.wordLine().stroke(this.idleStroke, duration, easeInOutCubic),
      this.gateBar().stroke(this.idleStroke, duration, easeInOutCubic),
      this.gateDot().fill(this.idleStroke, duration, easeInOutCubic),
      this.gateFill().opacity(0, duration, easeInOutCubic),
      this.channelBar().stroke(this.idleStroke, duration, easeInOutCubic),
      this.drainArm().stroke(this.idleStroke, duration, easeInOutCubic),
      this.sourceArm().stroke(this.idleStroke, duration, easeInOutCubic),
      this.drainWire().stroke(
        this.bit === 1 ? this.activeStroke : this.idleStroke,
        duration,
        easeInOutCubic,
      ),
    );
  }

  private *setCapCharged(on: boolean, duration: number): ThreadGenerator {
    const stroke = on ? this.activeStroke : this.idleStroke;
    yield* all(
      this.capTop().stroke(stroke, duration, easeOutCubic),
      this.capBot().stroke(stroke, duration, easeOutCubic),
      this.capGlow().opacity(on ? 0.35 : 0, duration, easeOutCubic),
      this.storageWire().stroke(
        on ? this.activeStroke : this.idleStroke,
        duration,
        easeOutCubic,
      ),
      this.drainWire().stroke(stroke, duration, easeOutCubic),
    );
  }

  /** 入场 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this, { duration, fromY: 14 });
  }

  /** 退场 */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* this.opacity(0, duration, easeInOutCubic);
  }

  /**
   * 写 1：字线拉高 → MOSFET 导通 → 电容充电 → 标「1」→ 可选关断保持
   */
  public *writeOne(duration = 0.7): ThreadGenerator {
    const open = duration * 0.3;
    const charge = duration * 0.45;
    const hold = duration * 0.25;
    yield* this.setGateOn(open);
    this.bitTxt().text("1");
    yield* all(
      this.setCapCharged(true, charge),
      this.bitTxt().fill(Ink.goldBright, charge, easeOutCubic),
    );
    this.bit = 1;
    // 关断晶体管，电荷留在电容上
    yield* this.setGateOff(hold);
  }

  /**
   * 写 0：导通 → 电容放电 → 关断 → 标「0」
   */
  public *writeZero(duration = 0.75): ThreadGenerator {
    const open = duration * 0.25;
    const drain = duration * 0.45;
    const close = duration * 0.3;
    yield* this.setGateOn(open);
    this.bitTxt().text("0");
    yield* all(
      this.setCapCharged(false, drain),
      this.bitTxt().fill(Ink.muted, drain, easeInOutCubic),
    );
    this.bit = 0;
    yield* this.setGateOff(close);
  }

  /** 瞬间置于指定位（无动画，供阵列复制用） */
  public setBitInstant(value: 0 | 1) {
    this.bit = value;
    const on = value === 1;
    const stroke = on ? this.activeStroke : this.idleStroke;
    this.capTop().stroke(stroke);
    this.capBot().stroke(stroke);
    this.capGlow().opacity(on ? 0.35 : 0);
    this.storageWire().stroke(stroke);
    this.drainWire().stroke(stroke);
    // 阵列态默认晶体管关断，靠电容保持
    this.wordLine().stroke(this.idleStroke);
    this.gateBar().stroke(this.idleStroke);
    this.gateDot().fill(this.idleStroke);
    this.gateFill().opacity(0);
    this.channelBar().stroke(this.idleStroke);
    this.drainArm().stroke(this.idleStroke);
    this.sourceArm().stroke(this.idleStroke);
    this.bitTxt().text(on ? "1" : "0");
    this.bitTxt().fill(on ? Ink.goldBright : Ink.muted);
  }
}

/**
 * 将单格复制为横向 N 格，表达「多比特」过渡。
 * @param prototype 已在场景中的样板格（会隐藏）
 */
export function* spawnBitRow(
  parent: Node,
  prototype: BitCell,
  count = 8,
  spacing = 130,
  duration = 0.7,
): ThreadGenerator {
  const bit = prototype.getBit();
  const cells: BitCell[] = [];
  const totalW = (count - 1) * spacing;
  const startX = -totalW / 2;
  const rowIconSize = 120;
  const rowPairGap = rowIconSize * 0.52;

  for (let i = 0; i < count; i++) {
    const cell = createRef<BitCell>();
    parent.add(
      <BitCell
        ref={cell}
        x={prototype.x()}
        y={prototype.y()}
        iconSize={rowIconSize}
        pairGap={rowPairGap}
        scale={0.48}
        showParts={false}
        opacity={0}
      />,
    );
    cell().setBitInstant(bit);
    cells.push(cell());
  }

  yield* prototype.hide(duration * 0.45);
  yield* all(
    ...cells.map((c, i) =>
      all(
        c.opacity(1, duration * 0.55, easeOutCubic),
        c.x(startX + i * spacing, duration, easeInOutCubic),
        c.y(0, duration, easeInOutCubic),
      ),
    ),
  );
  yield* waitFor(0.55);
  yield* all(...cells.map((c) => c.opacity(0, 0.4, easeInOutCubic)));
}
