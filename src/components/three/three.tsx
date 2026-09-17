import {
  Layout,
  LayoutProps,
  computed,
  initial,
  signal,
} from "@motion-canvas/2d";
import {
  SimpleSignal,
  ThreadGenerator,
  Vector2,
  easeInCubic,
  easeOutCubic,
} from "@motion-canvas/core";
import {
  Camera,
  Color,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { Ink } from "../../theme/ink";

export interface ThreeRenderCallback {
  (renderer: WebGLRenderer, scene: Scene, camera: Camera): void;
}

export interface ThreeProps extends LayoutProps {
  /** Three.js 场景 */
  scene?: Scene;
  /** Three.js 相机 */
  camera?: Camera;
  /** 渲染分辨率倍率，默认 1 */
  quality?: number;
  /** 场景背景色；不传则透明，便于叠在 Ink 底上 */
  background?: string | null;
  /** 正交相机视口缩放，默认 1 */
  zoom?: number;
  /** 自定义渲染回调；默认 `renderer.render(scene, camera)` */
  onRender?: ThreeRenderCallback;
  /** 叠在 WebGL 之上的 2D 文案（如坐标读数） */
  overlayText?: string;
  /** 叠字不透明度，默认 0 */
  overlayOpacity?: number;
}

/**
 * 将 Three.js 场景画进 Motion Canvas 的 Layout。
 * 每帧在 WebGL 离屏 canvas 上渲染，再 drawImage 到 2D 上下文；
 * 可选在右上角叠 2D 文字（画在 WebGL 之后，不会被盖住）。
 */
export class Three extends Layout {
  @initial(1)
  @signal()
  public declare readonly quality: SimpleSignal<number, this>;

  @initial(null)
  @signal()
  public declare readonly camera: SimpleSignal<Camera | null, this>;

  @initial(null)
  @signal()
  public declare readonly scene: SimpleSignal<Scene | null, this>;

  @initial(null)
  @signal()
  public declare readonly background: SimpleSignal<string | null, this>;

  @initial(1)
  @signal()
  public declare readonly zoom: SimpleSignal<number, this>;

  @initial("")
  @signal()
  public declare readonly overlayText: SimpleSignal<string, this>;

  @initial(0)
  @signal()
  public declare readonly overlayOpacity: SimpleSignal<number, this>;

  private renderer: WebGLRenderer;
  private readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  private readonly pixelSample = new Uint8Array(4);
  public onRender: ThreeRenderCallback;

  public constructor({ onRender, ...props }: ThreeProps) {
    super(props);
    this.renderer = borrow();
    let ctx = this.renderer.getContext();
    if (!ctx) {
      // 池中渲染器上下文可能已丢失，重建
      this.renderer = createRenderer();
      ctx = this.renderer.getContext();
    }
    if (!ctx) {
      throw new Error("WebGL context unavailable");
    }
    this.gl = ctx;
    this.onRender =
      onRender ?? ((renderer, scene, camera) => renderer.render(scene, camera));
  }

  protected override draw(context: CanvasRenderingContext2D) {
    if (!context || !this.gl) {
      super.draw(context);
      return;
    }

    const { width, height } = this.computedSize();
    const quality = this.quality();
    const scene = this.configuredScene();
    const camera = this.configuredCamera();
    const renderer = this.configuredRenderer();

    if (width > 0 && height > 0 && scene && camera && renderer) {
      try {
        this.onRender(renderer, scene, camera);
        context.imageSmoothingEnabled = false;
        context.drawImage(
          renderer.domElement,
          0,
          0,
          quality * width,
          quality * height,
          width / -2,
          height / -2,
          width,
          height,
        );
      } catch {
        // HMR / 上下文丢失时跳过本帧，避免整场景崩溃
      }
    }

    this.drawOverlay(context, width, height);
    super.draw(context);
  }

  /** 在 WebGL 画面之上画 2D 叠字（固定右上角） */
  private drawOverlay(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const text = this.overlayText();
    const opacity = this.overlayOpacity();
    if (!text || opacity <= 0 || width <= 0 || height <= 0) return;

    const pad = 28;
    const fontSize = 28;
    context.save();
    context.globalAlpha = opacity;
    context.font = `500 ${fontSize}px "SimFang", FangSong, STFangsong, serif`;
    context.textAlign = "right";
    context.textBaseline = "top";
    context.fillStyle = Ink.goldBright;
    context.fillText(text, width / 2 - pad, -height / 2 + pad);
    context.restore();
  }

  @computed()
  private configuredRenderer(): WebGLRenderer {
    const size = this.computedSize();
    const quality = this.quality();
    this.renderer.setSize(size.width * quality, size.height * quality);
    return this.renderer;
  }

  @computed()
  private configuredCamera(): Camera | null {
    const size = this.computedSize();
    const camera = this.camera();
    if (!camera) return null;

    const ratio = size.width / size.height;
    const scale = this.zoom() / 2;
    if (camera instanceof OrthographicCamera) {
      camera.left = -ratio * scale;
      camera.right = ratio * scale;
      camera.bottom = -scale;
      camera.top = scale;
      camera.updateProjectionMatrix();
    } else if (camera instanceof PerspectiveCamera) {
      camera.aspect = ratio;
      camera.updateProjectionMatrix();
    }

    return camera;
  }

  @computed()
  private configuredScene(): Scene | null {
    const scene = this.scene();
    const background = this.background();
    if (scene) {
      scene.background = background ? new Color(background) : null;
    }
    return scene;
  }

  /**
   * 入场：淡入到完全不透明。
   * @param duration 时长（秒），默认 Ink.duration
   */
  public *show(duration: number = Ink.duration): ThreadGenerator {
    yield* this.opacity(1, duration, easeOutCubic);
  }

  /**
   * 退场：淡出到完全透明。
   * @param duration 时长（秒），默认 Ink.duration
   */
  public *hide(duration: number = Ink.duration): ThreadGenerator {
    yield* this.opacity(0, duration, easeInCubic);
  }

  /** 读取组件局部坐标处的像素色（调试 / 拾取用） */
  public getColorAtPoint(position: Vector2): Color {
    const relativePosition = position.scale(this.quality());
    this.gl.readPixels(
      relativePosition.x,
      relativePosition.y,
      1,
      1,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.pixelSample,
    );
    const color = new Color();
    color.setRGB(
      this.pixelSample[0] / 255,
      this.pixelSample[1] / 255,
      this.pixelSample[2] / 255,
    );
    return color;
  }

  public dispose() {
    dispose(this.renderer);
    super.dispose();
  }
}

const pool: WebGLRenderer[] = [];

function createRenderer(): WebGLRenderer {
  return new WebGLRenderer({
    canvas: document.createElement("canvas"),
    alpha: true,
    stencil: true,
    antialias: true,
  });
}

function borrow(): WebGLRenderer {
  while (pool.length) {
    const renderer = pool.pop()!;
    if (renderer.getContext()) {
      return renderer;
    }
    try {
      renderer.dispose();
    } catch {
      // ignore
    }
  }
  return createRenderer();
}

function dispose(renderer: WebGLRenderer) {
  if (renderer.getContext()) {
    pool.push(renderer);
  } else {
    try {
      renderer.dispose();
    } catch {
      // ignore
    }
  }
}
