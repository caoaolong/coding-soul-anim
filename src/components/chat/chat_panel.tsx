import {Circle, Img, Layout, Line, Node, NodeProps, Rect, Txt} from '@motion-canvas/2d';
import {
  ThreadGenerator,
  Vector2,
  all,
  createRef,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  tween,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';
import chatGptIcon from '../../assets/icons/ChatGPT.svg';

const PAPER = '#e8eef7';
const MUTED = '#8a9bb0';
const ACCENT = '#3dd6c6';
const USER_BG = '#1a3a4a';
const USER_BORDER = '#2a6a7a';
const AI_BG = '#1a2030';
const AI_BORDER = '#2a3a4c';
const FRAME = '#121820';
const HEADER = '#1a2430';
const LINE = '#2a3a4c';
const INPUT_BG = '#0e141c';
const SEND_BG = '#1a4a52';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  /** 消息正文（支持换行） */
  content: string;
  /** 覆盖全局打字速度（秒/字；用户=输入框，AI=气泡） */
  charDelay?: number;
  /** 本条出现后额外停顿（秒） */
  hold?: number;
}

export interface ChatPanelProps extends NodeProps {
  /** 对话内容（按顺序播放） */
  messages: ChatMessage[];
  /** 顶栏标题 */
  title?: string;
  /** 面板宽度，默认 1480 */
  panelWidth?: number;
  /** 消息区高度（不含顶栏/输入栏），默认 680 */
  panelHeight?: number;
  /** 用户侧显示名 */
  userName?: string;
  /** AI 侧显示名 */
  assistantName?: string;
  /** AI 头像图标，默认 ChatGPT.svg */
  assistantIcon?: string;
  /** AI 气泡打字速度（秒/字），默认 0.03 */
  typeSpeed?: number;
  /** 用户输入框打字速度（秒/字），默认 0.045 */
  inputTypeSpeed?: number;
  /** 相邻消息间隔，默认 0.35 */
  messageGap?: number;
  /** 气泡最大文本宽度，默认 920 */
  bubbleMaxWidth?: number;
  /** 正文字号，默认 28 */
  fontSize?: number;
}

interface BubbleHandles {
  row: ReturnType<typeof createRef<Rect>>;
  bubble: ReturnType<typeof createRef<Rect>>;
  body: ReturnType<typeof createRef<Txt>>;
  caret: ReturnType<typeof createRef<Txt>>;
  role: ChatRole;
  content: string;
  charDelay?: number;
  hold: number;
}

/**
 * ChatGPT 风格对话面板：
 * - 用户：底部输入框逐字输入 → 模拟光标点发送 → 气泡飞入记录
 * - AI：左侧气泡入场后打字机逐字出现
 */
export class ChatPanel extends Node {
  private readonly frame = createRef<Rect>();
  private readonly list = createRef<Layout>();
  private readonly inputBar = createRef<Rect>();
  private readonly inputField = createRef<Rect>();
  private readonly inputTxt = createRef<Txt>();
  private readonly inputCaret = createRef<Txt>();
  private readonly sendBtn = createRef<Rect>();
  private readonly flyBubble = createRef<Rect>();
  private readonly flyTxt = createRef<Txt>();
  private readonly mouse = createRef<Node>();

  private readonly bubbles: BubbleHandles[] = [];

  private readonly typeSpeed: number;
  private readonly inputTypeSpeed: number;
  private readonly messageGap: number;
  private readonly panelHeight: number;
  private readonly panelWidth: number;
  private readonly fontSize: number;
  private readonly bubbleMaxWidth: number;
  private readonly userName: string;

  public constructor(props: ChatPanelProps) {
    const {
      messages,
      title = 'ChatGPT',
      panelWidth = 1480,
      panelHeight = 680,
      userName = '你',
      assistantName = 'AI',
      assistantIcon = chatGptIcon,
      typeSpeed = 0.03,
      inputTypeSpeed = 0.045,
      messageGap = 0.35,
      bubbleMaxWidth = 920,
      fontSize = 28,
      ...rest
    } = props;

    super({...rest});
    this.typeSpeed = typeSpeed;
    this.inputTypeSpeed = inputTypeSpeed;
    this.messageGap = messageGap;
    this.panelHeight = panelHeight;
    this.panelWidth = panelWidth;
    this.fontSize = fontSize;
    this.bubbleMaxWidth = bubbleMaxWidth;
    this.userName = userName;

    const headerH = 64;
    const inputH = 88;
    const avatarSize = 52;

    this.add(
      <Rect
        ref={this.frame}
        layout
        direction={'column'}
        width={panelWidth}
        radius={16}
        fill={FRAME}
        stroke={LINE}
        lineWidth={2}
        clip
        opacity={0}
        scale={0.96}
      >
        {/* 顶栏 */}
        <Rect
          layout
          direction={'row'}
          width={panelWidth}
          height={headerH}
          fill={HEADER}
          alignItems={'center'}
          justifyContent={'center'}
          gap={10}
        >
          <Circle width={12} height={12} fill={ACCENT} />
          <Txt
            text={title}
            fontFamily={FONT}
            fontSize={30}
            fontWeight={700}
            fill={PAPER}
          />
        </Rect>

        {/* 消息列表 */}
        <Rect width={panelWidth} height={panelHeight} fill={FRAME} clip>
          <Layout
            ref={this.list}
            layout
            direction={'column'}
            width={panelWidth}
            padding={[28, 44, 20, 44]}
            gap={26}
            alignItems={'stretch'}
            offset={[0, -1]}
            y={-panelHeight / 2 + 8}
          >
            {messages.map(msg => {
              const row = createRef<Rect>();
              const bubble = createRef<Rect>();
              const body = createRef<Txt>();
              const caret = createRef<Txt>();
              const isUser = msg.role === 'user';

              this.bubbles.push({
                row,
                bubble,
                body,
                caret,
                role: msg.role,
                content: msg.content,
                charDelay: msg.charDelay,
                hold: msg.hold ?? 0,
              });

              return (
                <Rect
                  ref={row}
                  layout
                  direction={'row'}
                  width={panelWidth - 88}
                  justifyContent={isUser ? 'end' : 'start'}
                  alignItems={'start'}
                  gap={18}
                  opacity={0}
                >
                  {!isUser ? (
                    <Img
                      src={assistantIcon}
                      width={avatarSize}
                      height={avatarSize}
                      radius={avatarSize / 2}
                    />
                  ) : null}

                  <Rect
                    ref={bubble}
                    layout
                    direction={'column'}
                    maxWidth={bubbleMaxWidth}
                    padding={[20, 26]}
                    radius={16}
                    fill={isUser ? USER_BG : AI_BG}
                    stroke={isUser ? USER_BORDER : AI_BORDER}
                    lineWidth={2}
                    gap={8}
                  >
                    <Txt
                      text={isUser ? userName : assistantName}
                      fontFamily={FONT}
                      fontSize={20}
                      fill={isUser ? ACCENT : MUTED}
                    />
                    <Layout direction={'row'} gap={2} alignItems={'end'}>
                      <Txt
                        ref={body}
                        text={isUser ? msg.content : ''}
                        fontFamily={FONT}
                        fontSize={fontSize}
                        fill={PAPER}
                        textWrap={true}
                        width={bubbleMaxWidth - 56}
                        lineHeight={fontSize * 1.45}
                      />
                      {!isUser ? (
                        <Txt
                          ref={caret}
                          text={'▍'}
                          fontFamily={FONT}
                          fontSize={fontSize}
                          fill={ACCENT}
                          opacity={0}
                        />
                      ) : null}
                    </Layout>
                  </Rect>

                  {isUser ? (
                    <Circle
                      width={avatarSize}
                      height={avatarSize}
                      fill={'#1e3340'}
                      stroke={USER_BORDER}
                      lineWidth={2.5}
                      layout
                      alignItems={'center'}
                      justifyContent={'center'}
                    >
                      <Txt
                        text={userName.slice(0, 1)}
                        fontFamily={FONT}
                        fontSize={20}
                        fontWeight={700}
                        fill={ACCENT}
                      />
                    </Circle>
                  ) : null}
                </Rect>
              );
            })}
          </Layout>
        </Rect>

        {/* 底部输入栏 */}
        <Rect
          ref={this.inputBar}
          layout
          direction={'row'}
          width={panelWidth}
          height={inputH}
          fill={HEADER}
          padding={[14, 28]}
          gap={18}
          alignItems={'center'}
        >
          <Rect
            ref={this.inputField}
            layout
            direction={'row'}
            grow={1}
            height={60}
            radius={14}
            fill={INPUT_BG}
            stroke={LINE}
            lineWidth={2}
            padding={[0, 22]}
            alignItems={'center'}
            gap={4}
          >
            <Txt
              ref={this.inputTxt}
              text={''}
              fontFamily={FONT}
              fontSize={28}
              fill={PAPER}
              textWrap={false}
            />
            <Txt
              ref={this.inputCaret}
              text={'|'}
              fontFamily={FONT}
              fontSize={28}
              fill={ACCENT}
              opacity={0}
            />
          </Rect>
          <Rect
            ref={this.sendBtn}
            layout
            width={120}
            height={60}
            radius={14}
            fill={SEND_BG}
            stroke={ACCENT}
            lineWidth={2.5}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Txt
              text={'发送'}
              fontFamily={FONT}
              fontSize={28}
              fontWeight={700}
              fill={ACCENT}
            />
          </Rect>
        </Rect>
      </Rect>,
    );

    // 飞入用的临时气泡（屏幕空间，挂在面板外层）
    this.add(
      <Rect
        ref={this.flyBubble}
        layout
        direction={'column'}
        maxWidth={bubbleMaxWidth}
        padding={[18, 24]}
        radius={16}
        fill={USER_BG}
        stroke={USER_BORDER}
        lineWidth={2}
        opacity={0}
        zIndex={20}
        gap={6}
      >
        <Txt
          text={userName}
          fontFamily={FONT}
          fontSize={18}
          fill={ACCENT}
        />
        <Txt
          ref={this.flyTxt}
          text={''}
          fontFamily={FONT}
          fontSize={fontSize}
          fill={PAPER}
          textWrap={true}
          width={Math.min(bubbleMaxWidth - 48, panelWidth * 0.55)}
          lineHeight={fontSize * 1.4}
        />
      </Rect>,
    );

    // 模拟鼠标光标
    this.add(
      <Node ref={this.mouse} opacity={0} zIndex={50} scale={1.35}>
        <Line
          points={[
            [0, 0],
            [0, 32],
            [8, 25],
            [14, 40],
            [19, 38],
            [12, 21],
            [24, 21],
          ]}
          fill={PAPER}
          stroke={'#0a0e14'}
          lineWidth={1.5}
          lineJoin={'round'}
          closed
        />
      </Node>,
    );
  }

  /** 面板本地坐标：把子节点中心转到本面板坐标 */
  private localOf(node: Node): Vector2 {
    return node.absolutePosition().transformAsPoint(this.worldToLocal());
  }

  /** 面板入场 */
  public *appear(duration = 0.5): ThreadGenerator {
    yield* all(
      this.frame().opacity(1, duration * 0.7, easeOutCubic),
      this.frame().scale(1, duration, easeOutCubic),
    );
  }

  /** 保证最新消息落在可视区内 */
  private *ensureVisible(): ThreadGenerator {
    const list = this.list();
    const h = list.height();
    const overflow = h - this.panelHeight + 36;
    if (overflow > 0) {
      const targetY = -this.panelHeight / 2 + 8 - overflow;
      yield* list.y(targetY, 0.35, easeOutCubic);
    }
  }

  /** 输入框光标闪烁几下 */
  private *blinkInputCaret(times = 2): ThreadGenerator {
    const c = this.inputCaret();
    for (let i = 0; i < times; i++) {
      yield* c.opacity(1, 0.08);
      yield* waitFor(0.18);
      yield* c.opacity(0.2, 0.08);
      yield* waitFor(0.12);
    }
    c.opacity(1);
  }

  /** 模拟光标移到目标并点击 */
  private *cursorClick(target: Rect, moveDuration = 0.55): ThreadGenerator {
    const mouse = this.mouse();
    const to = this.localOf(target).add(new Vector2(8, 10));

    if (mouse.opacity() < 0.5) {
      mouse.position(this.localOf(this.inputField()).add(new Vector2(40, 8)));
      yield* mouse.opacity(1, 0.2, easeOutCubic);
    }

    yield* mouse.position(to, moveDuration, easeInOutCubic);
    yield* waitFor(0.08);

    // 按下
    yield* all(
      mouse.scale(0.88, 0.08, easeOutCubic),
      target.scale(0.92, 0.08, easeOutCubic),
    );
    yield* waitFor(0.06);
    yield* all(
      mouse.scale(1.05, 0.12, easeOutBack),
      target.scale(1, 0.12, easeOutBack),
    );
  }

  /**
   * 用户消息：输入框打字 → 光标点发送 → 气泡飞入记录
   */
  private *playUser(b: BubbleHandles): ThreadGenerator {
    const full = b.content;
    const delay = b.charDelay ?? this.inputTypeSpeed;

    // 1) 聚焦输入框
    this.inputTxt().text('');
    this.inputField().stroke(ACCENT);
    yield* this.blinkInputCaret(2);

    // 2) 逐字输入
    const typeDur = Math.max(full.length * delay, 0.25);
    yield* tween(typeDur, t => {
      const n = Math.min(full.length, Math.floor(full.length * t + 1e-6));
      this.inputTxt().text(full.slice(0, n));
    });
    this.inputTxt().text(full);
    yield* waitFor(0.2);

    // 3) 光标移到发送并点击
    yield* this.cursorClick(this.sendBtn(), 0.5);
    yield* waitFor(0.1);

    // 4) 清空输入框，准备飞入
    this.inputCaret().opacity(0);
    this.inputField().stroke(LINE);
    this.flyTxt().text(full);
    const from = this.localOf(this.inputField());
    // 目标：聊天记录中该气泡位置（行先占位但透明）
    b.row().opacity(0.001);
    yield* this.ensureVisible();
    yield;
    const to = this.localOf(b.bubble());

    this.flyBubble().position(from);
    this.flyBubble().scale(0.92);
    this.flyBubble().opacity(1);
    this.inputTxt().text('');

    // 5) 飞入聊天记录
    yield* all(
      this.flyBubble().position(to, 0.55, easeInOutCubic),
      this.flyBubble().scale(1, 0.55, easeOutCubic),
    );

    // 6) 落位：显示正式气泡，隐藏飞行体
    b.body().text(full);
    b.row().opacity(1);
    this.flyBubble().opacity(0);
    yield* this.ensureVisible();

    // 光标稍退到旁边，不挡内容
    yield* this.mouse().opacity(0.35, 0.2);
  }

  /** AI 消息：入场 + 打字机 */
  private *playAssistant(b: BubbleHandles): ThreadGenerator {
    const full = b.content;
    const delay = b.charDelay ?? this.typeSpeed;

    b.body().text('');
    yield* b.row().opacity(1, 0.35, easeOutCubic);
    yield* this.ensureVisible();

    b.caret().opacity(1);
    yield* waitFor(0.12);

    const duration = Math.max(full.length * delay, 0.2);
    yield* tween(duration, t => {
      const n = Math.min(full.length, Math.floor(full.length * t + 1e-6));
      b.body().text(full.slice(0, n));
    });
    b.body().text(full);

    yield* b.caret().opacity(0, 0.12).to(1, 0.12).to(0, 0.18);
    yield* this.ensureVisible();
  }

  /** 按配置顺序播放全部消息 */
  public *playMessages(): ThreadGenerator {
    for (const b of this.bubbles) {
      if (b.role === 'user') {
        yield* this.playUser(b);
      } else {
        yield* this.playAssistant(b);
      }
      if (b.hold > 0) yield* waitFor(b.hold);
      yield* waitFor(this.messageGap);
    }
    // 结束时收起鼠标
    yield* this.mouse().opacity(0, 0.3);
  }

  /** 完整流程：面板入场 → 逐条对话 */
  public *run(): ThreadGenerator {
    yield* this.appear();
    yield* waitFor(0.25);
    yield* this.playMessages();
  }
}
