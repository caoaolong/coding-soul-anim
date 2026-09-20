import { Img, Layout, Line, Node, NodeProps, Txt } from "@motion-canvas/2d";
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

import capacitorEmptyImg from "../../assets/binary/电容器没电.svg";
import capacitorChargedImg from "../../assets/binary/电容器有电.svg";
import transistorOffImg from "../../assets/binary/晶体管关.svg";
import transistorOnImg from "../../assets/binary/晶体管开.svg";

const LABEL_FONT = '"SimFang", FangSong, STFangsong, serif';

export interface BitCellProps extends NodeProps {
  /** 图标边长，默认 96 */
  iconSize?: number;
  /** 两图标中心距（半距），默认 iconSize * 1.15 */
  pairGap?: number;
  /** 位数字号，默认 44 */
  bitFontSize?: number;
  /** 是否显示「电容」「晶体管」旁注，默认 true */
  showParts?: boolean;
}

/**
 * 教学向 1-bit 存储单元：电容蓄电 + 晶体管开关（各两态矢量图 + 连线）。
 * 不追求真实 DRAM 拓扑，只表达「有电＝1 / 无电＝0」。
 */
export class BitCell extends Node {
  private readonly frame = createRef<Layout>();
  private readonly capacitorEmpty = createRef<Img>();
  private readonly capacitorCharged = createRef<Img>();
  private readonly transistorOff = createRef<Img>();
  private readonly transistorOn = createRef<Img>();
  private readonly wire = createRef<Line>();
  private readonly bitTxt = createRef<Txt>();

  private bit: 0 | 1 = 0;

  public constructor(props: BitCellProps = {}) {
    const {
      iconSize = 96,
      pairGap,
      bitFontSize = 44,
      showParts = true,
      ...nodeProps
    } = props;

    super({ opacity: 0, ...nodeProps });

    const gap = pairGap ?? iconSize * 1.15;
    const capY = -gap;
    const trY = gap;
    // 连线：电容底边附近 → 晶体管顶边附近
    const wireTop = capY + iconSize * 0.42;
    const wireBottom = trY - iconSize * 0.42;

    this.add(
      <Layout ref={this.frame} layout={false}>
        {/* 电容：没电 / 有电 */}
        <Img
          ref={this.capacitorEmpty}
          src={capacitorEmptyImg}
          width={iconSize}
          height={iconSize}
          y={capY}
          opacity={1}
        />
        <Img
          ref={this.capacitorCharged}
          src={capacitorChargedImg}
          width={iconSize}
          height={iconSize}
          y={capY}
          opacity={0}
        />

        {/* 电容 ↔ 晶体管 连线 */}
        <Line
          ref={this.wire}
          points={[
            [0, wireTop],
            [0, wireBottom],
          ]}
          stroke={Ink.line}
          lineWidth={Ink.lineWidth + 1}
          lineCap={"round"}
        />

        {/* 晶体管：关 / 开 */}
        <Img
          ref={this.transistorOff}
          src={transistorOffImg}
          width={iconSize}
          height={iconSize}
          y={trY}
          opacity={1}
        />
        <Img
          ref={this.transistorOn}
          src={transistorOnImg}
          width={iconSize}
          height={iconSize}
          y={trY}
          opacity={0}
        />

        <Txt
          ref={this.bitTxt}
          text={"0"}
          fontFamily={LABEL_FONT}
          fontSize={bitFontSize}
          fill={Ink.muted}
          x={iconSize * 0.95}
          y={capY}
        />

        {showParts ? (
          <>
            <Txt
              text={"电容"}
              fontFamily={LABEL_FONT}
              fontSize={22}
              fill={Ink.paperSoft}
              x={-iconSize * 1.05}
              y={capY}
            />
            <Txt
              text={"晶体管"}
              fontFamily={LABEL_FONT}
              fontSize={22}
              fill={Ink.paperSoft}
              x={-iconSize * 1.05}
              y={trY}
            />
          </>
        ) : null}
      </Layout>,
    );
  }

  public getBit(): 0 | 1 {
    return this.bit;
  }

  /** 墨晕入场 */
  public *show(duration = 0.55): ThreadGenerator {
    yield* inkReveal(this, { duration, fromY: 14 });
  }

  /** 退场 */
  public *hide(duration = 0.4): ThreadGenerator {
    yield* this.opacity(0, duration, easeInOutCubic);
  }

  /**
   * 写 1：晶体管导通 → 电容充入（切到有电图）→ 标「1」
   */
  public *writeOne(duration = 0.7): ThreadGenerator {
    const close = duration * 0.35;
    const charge = duration * 0.65;
    yield* all(
      this.transistorOff().opacity(0, close, easeInOutCubic),
      this.transistorOn().opacity(1, close, easeInOutCubic),
      this.wire().stroke(Ink.goldSoft, close, easeInOutCubic),
    );
    this.bitTxt().text("1");
    yield* all(
      this.capacitorEmpty().opacity(0, charge, easeOutCubic),
      this.capacitorCharged().opacity(1, charge, easeOutCubic),
      this.bitTxt().fill(Ink.goldBright, charge, easeOutCubic),
    );
    this.bit = 1;
  }

  /**
   * 写 0：晶体管导通放电 → 电容切到没电 → 晶体管关断 → 标「0」
   */
  public *writeZero(duration = 0.75): ThreadGenerator {
    const close = duration * 0.25;
    const drain = duration * 0.5;
    const open = duration * 0.25;
    yield* all(
      this.transistorOff().opacity(0, close, easeInOutCubic),
      this.transistorOn().opacity(1, close, easeInOutCubic),
      this.wire().stroke(Ink.goldSoft, close, easeInOutCubic),
    );
    this.bitTxt().text("0");
    yield* all(
      this.capacitorCharged().opacity(0, drain, easeInOutCubic),
      this.capacitorEmpty().opacity(1, drain, easeInOutCubic),
      this.bitTxt().fill(Ink.muted, drain, easeInOutCubic),
    );
    yield* all(
      this.transistorOn().opacity(0, open, easeInOutCubic),
      this.transistorOff().opacity(1, open, easeInOutCubic),
      this.wire().stroke(Ink.line, open, easeInOutCubic),
    );
    this.bit = 0;
  }

  /** 瞬间置于指定位（无动画，供阵列复制用） */
  public setBitInstant(value: 0 | 1) {
    this.bit = value;
    const on = value === 1;
    this.capacitorCharged().opacity(on ? 1 : 0);
    this.capacitorEmpty().opacity(on ? 0 : 1);
    this.transistorOn().opacity(on ? 1 : 0);
    this.transistorOff().opacity(on ? 0 : 1);
    this.wire().stroke(on ? Ink.goldSoft : Ink.line);
    this.bitTxt().text(on ? "1" : "0");
    this.bitTxt().fill(on ? Ink.goldBright : Ink.muted);
  }
}

/**
 * 将单格复制为横向 N 格，表达「多比特」过渡。
 * 阵列格使用更短的电容–晶体管连线（compact pairGap）。
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
  /** 阵列态：图标仍 96，中心距压到约半距，连线明显缩短 */
  const rowIconSize = 96;
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
