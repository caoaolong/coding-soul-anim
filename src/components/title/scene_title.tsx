import {Node, NodeProps, Txt, initial, signal} from '@motion-canvas/2d';
import {
  SimpleSignal,
  ThreadGenerator,
  createRef,
  easeOutCubic,
} from '@motion-canvas/core';
import {FONT} from '../../theme/fonts';

/** 1920×1080 下标题锚点（左上，左对齐） */
export const SCENE_TITLE_X = -860;
export const SCENE_TITLE_Y = -460;

const PAPER = '#e8eef7';

export interface SceneTitleProps extends NodeProps {
  /** 标题文案 */
  text?: string;
  /** 字号，默认 36（全场景统一） */
  fontSize?: number;
}

/**
 * 场景标题：固定在屏幕左上方，风格全站统一。
 *
 * @example
 * ```tsx
 * const title = createRef<SceneTitle>();
 * view.add(<SceneTitle ref={title} text="事件树" />);
 * yield* title().show();
 * ```
 */
export class SceneTitle extends Node {
  @initial('')
  @signal()
  public declare readonly text: SimpleSignal<string, this>;

  private readonly label = createRef<Txt>();

  public constructor(props?: SceneTitleProps) {
    super({
      x: SCENE_TITLE_X,
      y: SCENE_TITLE_Y,
      zIndex: 50,
      opacity: 0,
      ...props,
    });

    const fontSize = props?.fontSize ?? 36;
    const content = props?.text ?? '';

    this.add(
      <Txt
        ref={this.label}
        text={content}
        fontFamily={FONT}
        fontSize={fontSize}
        fontWeight={700}
        fill={PAPER}
        offset={[-1, 0]}
        textAlign={'left'}
      />,
    );
  }

  public *show(duration = 0.4): ThreadGenerator {
    yield* this.opacity(1, duration, easeOutCubic);
  }

  public *hide(duration = 0.3): ThreadGenerator {
    yield* this.opacity(0, duration, easeOutCubic);
  }

  /** 更新文案（若需中途改标题） */
  public *setText(value: string, duration = 0): ThreadGenerator {
    if (duration <= 0) {
      this.label().text(value);
      return;
    }
    yield* this.label().text(value, duration);
  }
}
