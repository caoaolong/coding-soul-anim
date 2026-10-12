import {
  Circle,
  Layout,
  Node,
  NodeProps,
  Rect,
  Txt,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  all,
  createRef,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

const TITLE_H = 40;
const RADIUS = 12;
const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840'] as const;

const BG_WINDOW = '#0d1117';
const BG_TITLE = '#161b22';
const LINE = '#30363d';
const MUTED = '#8b949e';
/** 提示符 */
const PROMPT_COLOR = '#3dd6c6';
/** 用户输入的命令 */
const CMD_COLOR = '#79c0ff';
/** 命令执行输出 */
const OUT_COLOR = '#7ee787';
const CURSOR_COLOR = '#79c0ff';
const MONO = '"Cascadia Mono", "Consolas", "Courier New", monospace';

export interface TerminalCommand {
  /** 要逐字输入的命令（不含提示符） */
  command: string;
  /** 执行结果（可多行），输入完成后一次性显示 */
  output?: string;
}

export interface TerminalProps extends NodeProps {
  /** 标题栏文字，默认 Terminal */
  title?: string;
  /** 提示符，默认 `$ ` */
  prompt?: string;
  /** 窗口宽度，默认 960 */
  width?: number;
  /** 内容区高度，默认 420 */
  height?: number;
  /** 正文字号，默认 26 */
  fontSize?: number;
  /** 打字速度（秒/字），默认 0.05 */
  typeSpeed?: number;
  /** 行距，默认 10 */
  lineGap?: number;
  /** 命令文字颜色，默认亮蓝 */
  commandColor?: string;
  /** 输出文字颜色，默认终端绿 */
  outputColor?: string;
}

/**
 * 命令行模拟：命令逐字输入，结果一次性显示。
 *
 * @example
 * ```tsx
 * const term = createRef<Terminal>();
 * view.add(<Terminal ref={term} />);
 * yield* term().show();
 * yield* term().run({
 *   command: 'echo hello',
 *   output: 'hello',
 * });
 * ```
 */
export class Terminal extends Node {
  @initial('Terminal')
  @signal()
  public declare readonly title: SimpleSignal<string, this>;

  @initial('$ ')
  @signal()
  public declare readonly prompt: SimpleSignal<string, this>;

  @initial(960)
  @signal()
  public declare readonly width: SimpleSignal<number, this>;

  @initial(420)
  @signal()
  public declare readonly height: SimpleSignal<number, this>;

  @initial(26)
  @signal()
  public declare readonly fontSize: SimpleSignal<number, this>;

  @initial(0.05)
  @signal()
  public declare readonly typeSpeed: SimpleSignal<number, this>;

  private readonly root = createRef<Rect>();
  private readonly body = createRef<Layout>();
  private readonly lineGap: number;
  private readonly commandColor: string;
  private readonly outputColor: string;

  public constructor(props: TerminalProps = {}) {
    const {
      title = 'Terminal',
      prompt = '$ ',
      width = 960,
      height = 420,
      fontSize = 26,
      typeSpeed = 0.05,
      lineGap = 10,
      commandColor = CMD_COLOR,
      outputColor = OUT_COLOR,
      opacity = 0,
      scale = 0.96,
      ...rest
    } = props;

    super({opacity, scale, ...rest});
    this.lineGap = lineGap;
    this.commandColor = commandColor;
    this.outputColor = outputColor;

    this.title(title);
    this.prompt(prompt);
    this.width(width);
    this.height(height);
    this.fontSize(fontSize);
    this.typeSpeed(typeSpeed);

    this.add(
      <Rect
        ref={this.root}
        layout
        direction={'column'}
        width={() => this.width()}
        radius={RADIUS}
        fill={BG_WINDOW}
        stroke={LINE}
        lineWidth={1}
        clip
        shadowColor={'rgba(0,0,0,0.45)'}
        shadowBlur={28}
        shadowOffset={[0, 14]}
      >
        <Rect
          layout
          direction={'row'}
          alignItems={'center'}
          justifyContent={'space-between'}
          width={'100%'}
          height={TITLE_H}
          fill={BG_TITLE}
          padding={[0, 14]}
        >
          <Layout layout direction={'row'} gap={8} alignItems={'center'}>
            {TRAFFIC.map(color => (
              <Circle size={11} fill={color} />
            ))}
          </Layout>
          <Txt
            text={() => this.title()}
            fontFamily={FONT}
            fontSize={18}
            fontWeight={600}
            fill={MUTED}
          />
          <Layout width={48} />
        </Rect>

        <Layout
          layout
          width={'100%'}
          height={() => this.height()}
          padding={[18, 22]}
        >
          <Layout
            ref={this.body}
            layout
            direction={'column'}
            alignItems={'start'}
            gap={() => this.lineGap}
            width={'100%'}
          />
        </Layout>
      </Rect>,
    );
  }

  public *show(duration = 0.45): ThreadGenerator {
    yield* all(
      this.opacity(1, duration, easeOutCubic),
      this.scale(1, duration, easeOutCubic),
    );
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* all(
      this.opacity(0, duration, easeOutCubic),
      this.scale(0.96, duration, easeOutCubic),
    );
  }

  /** 清空内容区 */
  public clear() {
    this.body().removeChildren();
  }

  /**
   * 执行一条命令：提示符 + 逐字输入 → 结果一次性出现。
   */
  public *run(
    step: TerminalCommand,
    options?: {typeSpeed?: number; holdAfterType?: number},
  ): ThreadGenerator {
    const speed = options?.typeSpeed ?? this.typeSpeed();
    const hold = options?.holdAfterType ?? 0.25;
    const size = this.fontSize();
    const promptText = this.prompt();

    const cmdTxt = createRef<Txt>();
    const cursor = createRef<Rect>();

    this.body().add(
      <Layout layout direction={'row'} alignItems={'center'} gap={0}>
        <Txt
          text={promptText}
          fontFamily={MONO}
          fontSize={size}
          fill={PROMPT_COLOR}
        />
        <Txt
          ref={cmdTxt}
          text={''}
          fontFamily={MONO}
          fontSize={size}
          fill={this.commandColor}
        />
        <Rect
          ref={cursor}
          width={Math.max(2, size * 0.12)}
          height={size * 0.9}
          fill={this.commandColor}
          marginLeft={2}
          opacity={1}
        />
      </Layout>,
    );

    // 光标闪烁与打字并行感：打字循环里顺带闪一下即可
    const cmd = step.command;
    for (let i = 1; i <= cmd.length; i++) {
      cmdTxt().text(cmd.slice(0, i));
      cursor().opacity(i % 2 === 0 ? 0.35 : 1);
      yield* waitFor(speed);
    }
    cursor().opacity(1);
    yield* waitFor(hold);
    yield* cursor().opacity(0, 0.12, easeOutCubic);

    const output = step.output ?? '';
    if (output.length === 0) return;

    const outLines = output.replace(/\r\n/g, '\n').split('\n');
    const outBlock = createRef<Layout>();
    this.body().add(
      <Layout
        ref={outBlock}
        layout
        direction={'column'}
        alignItems={'start'}
        gap={4}
        opacity={0}
      >
        {outLines.map(line => (
          <Txt
            text={line.length > 0 ? line : ' '}
            fontFamily={MONO}
            fontSize={size}
            fill={this.outputColor}
          />
        ))}
      </Layout>,
    );
    yield* outBlock().opacity(1, 0.28, easeOutCubic);
  }

  /** 依次执行多条命令 */
  public *runAll(
    steps: TerminalCommand[],
    options?: {
      typeSpeed?: number;
      holdAfterType?: number;
      gapBetween?: number;
    },
  ): ThreadGenerator {
    const gap = options?.gapBetween ?? 0.45;
    for (let i = 0; i < steps.length; i++) {
      yield* this.run(steps[i], options);
      if (i < steps.length - 1) yield* waitFor(gap);
    }
  }
}
