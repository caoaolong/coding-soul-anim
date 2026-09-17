import { Layout, LayoutProps, Txt } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  linear,
  tween,
  waitFor,
} from "@motion-canvas/core";
import * as THREE from "three";
import { Ink } from "../../theme/ink";
import { Three } from "./three";

/** 三轴配色：X 朱砂、Y 淡金、Z 青灰 */
const AXIS_COLOR = {
  x: Ink.seal,
  y: Ink.gold,
  z: "#6B8A9A",
} as const;

const AXIS_FONT = '"SimFang", FangSong, STFangsong, serif';
const VECTOR_COLOR = Ink.goldSoft;

export interface Axes3DProps extends LayoutProps {
  /** 轴半长（原点向正负各延伸），默认 5 */
  size?: number;
  /** 是否绘制 XZ 水平网格，默认 true */
  showGrid?: boolean;
  /** 网格分段数，默认 10 */
  gridDivisions?: number;
  /** 是否显示轴名与刻度数字，默认 true */
  showLabels?: boolean;
  /** 数轴刻度间隔，默认 1 */
  tickStep?: number;
  /** 渲染分辨率倍率，默认 2 */
  quality?: number;
  /** 底部标题文案，如「三维向量」 */
  caption?: string;
}

/**
 * 自包含 3D 坐标轴：数轴（含刻度/轴名）+ XZ 网格。
 * 可选从原点出发的向量箭头，支持生长画出与路径移动；相机默认固定。
 * 内部使用 {@link Three} 渲染，可直接放入 Motion Canvas 场景。
 */
export class Axes3D extends Layout {
  public readonly threeScene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  /** 轴与网格所在根节点 */
  public readonly root: THREE.Group;

  private readonly three = createRef<Three>();
  private readonly captionTxt = createRef<Txt>();
  private readonly hasCaption: boolean;
  /** 轴半长（勿命名为 size，会遮蔽 Layout.size 信号导致 dispose 崩溃） */
  private readonly axisSize: number;
  /** 布局宽高缓存 */
  private readonly frameW: number;
  private readonly frameH: number;

  private readonly cameraRadius: number;
  private readonly cameraHeight: number;
  private orbitAngle = Math.PI / 4;

  private readonly tipX = createSignal(0);
  private readonly tipY = createSignal(0);
  private readonly tipZ = createSignal(0);

  /** 自定义向量（箭杆 + 锥头） */
  private readonly vectorGroup: THREE.Group;
  private readonly vectorShaft: THREE.Line;
  private readonly vectorHead: THREE.Mesh;
  private readonly yUp = new THREE.Vector3(0, 1, 0);

  public constructor(props: Axes3DProps = {}) {
    const {
      size = 5,
      showGrid = true,
      gridDivisions = 10,
      showLabels = true,
      tickStep = 1,
      quality = 2,
      caption = "",
      width = 960,
      height = 720,
      ...rest
    } = props;

    const frameW = typeof width === "number" ? width : 960;
    const frameH = typeof height === "number" ? height : 720;

    super({ width: frameW, height: frameH, layout: false, cache: false, ...rest });

    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    const cameraRadius = size * 2.4;
    const cameraHeight = size * 1.15;
    camera.position.set(
      cameraRadius * Math.sin(Math.PI / 4),
      cameraHeight,
      cameraRadius * Math.cos(Math.PI / 4),
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    threeScene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2d6, 0.85);
    key.position.set(size * 1.2, size * 2, size);
    threeScene.add(key);

    const root = buildAxesContent({
      size,
      showGrid,
      gridDivisions,
      showLabels,
      tickStep,
    });
    threeScene.add(root);

    const { group, shaft, head } = createVectorArrow(VECTOR_COLOR, size);
    root.add(group);

    this.threeScene = threeScene;
    this.camera = camera;
    this.root = root;
    this.vectorGroup = group;
    this.vectorShaft = shaft;
    this.vectorHead = head;
    this.axisSize = size;
    this.frameW = frameW;
    this.frameH = frameH;
    this.cameraRadius = cameraRadius;
    this.cameraHeight = cameraHeight;
    this.hasCaption = Boolean(caption);

    this.add(
      <Three
        ref={this.three}
        width={frameW}
        height={frameH}
        scene={threeScene}
        camera={camera}
        quality={quality}
        overlayText={""}
        overlayOpacity={0}
      />,
      caption ? (
        <Txt
          ref={this.captionTxt}
          text={caption}
          fontFamily={AXIS_FONT}
          fontSize={36}
          fill={Ink.paper}
          y={frameH / 2 - 48}
          zIndex={10}
          opacity={0}
        />
      ) : null,
    );
  }

  /** 入场：淡入（与 {@link Three.show} 一致） */
  public *show(duration: number = Ink.duration): ThreadGenerator {
    yield* this.opacity(1, duration, easeOutCubic);
    if (this.hasCaption) {
      yield* this.captionTxt().opacity(1, duration * 0.7, easeInOutCubic);
    }
  }

  /** 退场：淡出（与 {@link Three.hide} 一致） */
  public *hide(duration: number = Ink.duration): ThreadGenerator {
    yield* this.opacity(0, duration, easeInCubic);
  }

  /**
   * 画出从原点到 (x, y, z) 的向量，并显示坐标读数。
   */
  public *showVector(
    x: number,
    y: number,
    z: number,
    duration = 0.55,
  ): ThreadGenerator {
    this.tipX(x);
    this.tipY(y);
    this.tipZ(z);
    this.syncArrow(0);
    this.syncReadout();
    this.three().overlayOpacity(0);

    yield* all(
      tween(duration, (value) => {
        const t = easeOutCubic(value);
        this.syncArrow(t);
        this.syncReadout();
      }),
      this.three().overlayOpacity(1, duration * 0.7, easeInOutCubic),
    );
    this.syncArrow(1);
    this.syncReadout();
    this.three().overlayOpacity(1);
  }

  /**
   * 将向量尖端移到 (x, y, z)，途中实时更新坐标文字。
   */
  public *moveVector(
    x: number,
    y: number,
    z: number,
    duration = 0.8,
  ): ThreadGenerator {
    const fromX = this.tipX();
    const fromY = this.tipY();
    const fromZ = this.tipZ();
    yield* tween(duration, (value) => {
      const t = easeInOutCubic(value);
      this.tipX(fromX + (x - fromX) * t);
      this.tipY(fromY + (y - fromY) * t);
      this.tipZ(fromZ + (z - fromZ) * t);
      this.syncArrow(1);
      this.syncReadout();
    });
  }

  /**
   * 按路径移动向量尖端。
   * @param points 目标点序列（不含当前点）
   */
  public *travel(
    points: Array<[number, number, number]>,
    stepDuration = 0.8,
    hold = 0.15,
  ): ThreadGenerator {
    for (const [x, y, z] of points) {
      yield* this.moveVector(x, y, z, stepDuration);
      if (hold > 0) {
        yield* waitFor(hold);
      }
    }
  }

  /** 相机绕 Y 轴环绕（始终看向原点），默认匀速一周 */
  public *orbit(duration = 4): ThreadGenerator {
    const start = this.orbitAngle;
    yield* tween(duration, (value) => {
      const t = linear(value);
      this.orbitAngle = start + t * Math.PI * 2;
      this.camera.position.set(
        this.cameraRadius * Math.sin(this.orbitAngle),
        this.cameraHeight,
        this.cameraRadius * Math.cos(this.orbitAngle),
      );
      this.camera.lookAt(0, 0, 0);
    });
  }

  /** 按 tip 信号同步向量方向与长度；scale∈[0,1] 用于生长画出 */
  private syncArrow(scale: number) {
    const tip = new THREE.Vector3(this.tipX(), this.tipY(), this.tipZ());
    const fullLen = tip.length() * scale;
    if (fullLen < 1e-4) {
      this.vectorGroup.visible = false;
      return;
    }

    this.vectorGroup.visible = true;
    this.vectorGroup.quaternion.setFromUnitVectors(
      this.yUp,
      tip.clone().normalize(),
    );

    const headLen = Math.min(this.axisSize * 0.18, fullLen * 0.28);
    const shaftLen = Math.max(fullLen - headLen, 0.001);

    this.vectorShaft.geometry.setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, shaftLen, 0),
    ]);

    // 锥体默认沿 +Y、几何中心在原点 → 放到箭杆末端
    const baseHeadLen = this.axisSize * 0.18;
    this.vectorHead.position.set(0, shaftLen + headLen * 0.5, 0);
    this.vectorHead.scale.set(1, headLen / baseHeadLen, 1);
  }

  /** 把当前尖端坐标同步到 Three 右上角 2D 叠字 */
  private syncReadout() {
    const view = this.three();
    if (!view) return;
    view.overlayText(this.formatXYZ(this.tipX(), this.tipY(), this.tipZ()));
  }

  private formatXYZ(x: number, y: number, z: number): string {
    return `(${this.fmt(x)}, ${this.fmt(y)}, ${this.fmt(z)})`;
  }

  private fmt(n: number): string {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
}

interface BuildAxesOptions {
  size: number;
  showGrid: boolean;
  gridDivisions: number;
  showLabels: boolean;
  tickStep: number;
}

/** 单位锥高 / 半径基准与 syncArrow 中的缩放对应 */
function createVectorArrow(
  colorHex: string,
  size: number,
): { group: THREE.Group; shaft: THREE.Line; head: THREE.Mesh } {
  const group = new THREE.Group();
  group.visible = false;

  const color = new THREE.Color(colorHex);
  const shaftGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  const shaft = new THREE.Line(
    shaftGeo,
    new THREE.LineBasicMaterial({ color, linewidth: 2 }),
  );
  group.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.055, size * 0.18, 16),
    new THREE.MeshBasicMaterial({ color }),
  );
  group.add(head);

  return { group, shaft, head };
}

function buildAxesContent(options: BuildAxesOptions): THREE.Group {
  const { size, showGrid, gridDivisions, showLabels, tickStep } = options;
  const root = new THREE.Group();

  if (showGrid) {
    const grid = new THREE.GridHelper(
      size * 2,
      gridDivisions,
      new THREE.Color(Ink.goldSoft),
      new THREE.Color(Ink.line),
    );
    const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const mat of mats) {
      const m = mat as THREE.LineBasicMaterial;
      m.transparent = true;
      m.opacity = 0.55;
      m.depthWrite = false;
    }
    root.add(grid);
  }

  root.add(buildAxis("x", new THREE.Vector3(1, 0, 0), AXIS_COLOR.x, size, tickStep, showLabels));
  root.add(buildAxis("y", new THREE.Vector3(0, 1, 0), AXIS_COLOR.y, size, tickStep, showLabels));
  root.add(buildAxis("z", new THREE.Vector3(0, 0, 1), AXIS_COLOR.z, size, tickStep, showLabels));

  // 原点小球
  const origin = new THREE.Mesh(
    new THREE.SphereGeometry(size * 0.035, 16, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(Ink.paper) }),
  );
  root.add(origin);

  return root;
}

function buildAxis(
  name: "x" | "y" | "z",
  dir: THREE.Vector3,
  colorHex: string,
  size: number,
  tickStep: number,
  showLabels: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(colorHex);
  const negColor = color.clone().multiplyScalar(0.55);

  // 正半轴
  group.add(makeLine(new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(size), color, 1));
  // 负半轴（略淡）
  group.add(
    makeLine(new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(-size), negColor, 0.45),
  );

  // 正半轴箭头
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.028, size * 0.09, 12),
    new THREE.MeshBasicMaterial({ color }),
  );
  arrow.position.copy(dir.clone().multiplyScalar(size));
  alignArrow(arrow, dir);
  group.add(arrow);

  // 刻度
  const tickLen = size * 0.05;
  const up = pickTickBinormal(dir);
  for (let v = -size; v <= size + 1e-6; v += tickStep) {
    if (Math.abs(v) < 1e-6) continue;
    const center = dir.clone().multiplyScalar(v);
    const a = center.clone().add(up.clone().multiplyScalar(-tickLen / 2));
    const b = center.clone().add(up.clone().multiplyScalar(tickLen / 2));
    const tickColor = v > 0 ? color : negColor;
    const opacity = v > 0 ? 0.9 : 0.4;
    group.add(makeLine(a, b, tickColor, opacity));

    if (showLabels) {
      const label = makeTextSprite(formatTick(v), colorHex, size * 0.11);
      label.position.copy(center.clone().add(up.clone().multiplyScalar(tickLen * 1.8)));
      group.add(label);
    }
  }

  if (showLabels) {
    const axisLabel = makeTextSprite(name.toUpperCase(), colorHex, size * 0.18, true);
    axisLabel.position.copy(
      dir.clone().multiplyScalar(size + size * 0.16).add(up.clone().multiplyScalar(size * 0.05)),
    );
    group.add(axisLabel);
  }

  return group;
}

function makeLine(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: THREE.Color,
  opacity: number,
): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: true,
  });
  return new THREE.Line(geo, mat);
}

/** 将圆锥默认 +Y 对齐到目标方向 */
function alignArrow(mesh: THREE.Mesh, dir: THREE.Vector3) {
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.quaternion.copy(q);
}

/** 选一条与轴正交的方向，用于刻度朝向 */
function pickTickBinormal(dir: THREE.Vector3): THREE.Vector3 {
  const axis = dir.clone().normalize();
  const helper =
    Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(axis, helper).normalize();
}

function formatTick(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return String(Number(n.toPrecision(3)));
}

function makeTextSprite(
  text: string,
  colorHex: string,
  worldHeight: number,
  bold = false,
): THREE.Sprite {
  const pad = 24;
  const fontSize = bold ? 96 : 72;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `${bold ? 700 : 500} ${fontSize}px "SimFang", FangSong, STFangsong, serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width + pad * 2);
  canvas.height = Math.ceil(fontSize * 1.4 + pad * 2);

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colorHex;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  sprite.renderOrder = 10;
  return sprite;
}
