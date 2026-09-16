import { Layout, LayoutProps } from "@motion-canvas/2d";
import {
  ThreadGenerator,
  createRef,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  tween,
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
}

/**
 * 自包含 3D 坐标轴：数轴（含刻度/轴名）+ XZ 网格。
 * 内部使用 {@link Three} 渲染，可直接放入 Motion Canvas 场景。
 */
export class Axes3D extends Layout {
  public readonly threeScene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  /** 轴与网格所在根节点 */
  public readonly root: THREE.Group;

  private readonly three = createRef<Three>();
  private readonly cameraRadius: number;
  private readonly cameraHeight: number;
  private orbitAngle = Math.PI / 4;

  public constructor(props: Axes3DProps = {}) {
    const {
      size = 5,
      showGrid = true,
      gridDivisions = 10,
      showLabels = true,
      tickStep = 1,
      quality = 2,
      width = 960,
      height = 720,
      ...rest
    } = props;

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

    super({ width, height, ...rest });

    this.threeScene = threeScene;
    this.camera = camera;
    this.root = root;
    this.cameraRadius = cameraRadius;
    this.cameraHeight = cameraHeight;

    this.add(
      <Three
        ref={this.three}
        width={() => this.width()}
        height={() => this.height()}
        scene={threeScene}
        camera={camera}
        quality={quality}
      />,
    );
  }

  /** 入场：淡入（与 {@link Three.show} 一致） */
  public *show(duration = Ink.duration): ThreadGenerator {
    yield* this.opacity(1, duration, easeOutCubic);
  }

  /** 退场：淡出（与 {@link Three.hide} 一致） */
  public *hide(duration = Ink.duration): ThreadGenerator {
    yield* this.opacity(0, duration, easeInCubic);
  }

  /** 相机绕 Y 轴环绕一圈，便于看清立体坐标 */
  public *orbit(duration = 4): ThreadGenerator {
    const start = this.orbitAngle;
    yield* tween(duration, (value) => {
      const t = easeInOutCubic(value);
      this.orbitAngle = start + t * Math.PI * 2;
      this.camera.position.set(
        this.cameraRadius * Math.sin(this.orbitAngle),
        this.cameraHeight,
        this.cameraRadius * Math.cos(this.orbitAngle),
      );
      this.camera.lookAt(0, 0, 0);
    });
  }
}

interface BuildAxesOptions {
  size: number;
  showGrid: boolean;
  gridDivisions: number;
  showLabels: boolean;
  tickStep: number;
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
  ctx.font = `${bold ? 700 : 500} ${fontSize}px "Noto Serif SC", "Songti SC", serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width + pad * 2);
  canvas.height = Math.ceil(fontSize * 1.4 + pad * 2);

  ctx.font = `${bold ? 700 : 500} ${fontSize}px "Noto Serif SC", "Songti SC", serif`;
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
