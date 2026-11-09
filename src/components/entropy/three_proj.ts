import {Vector2} from '@motion-canvas/core';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Camera3D {
  /** 绕 Y 轴旋转角（弧度） */
  yaw: number;
  /** 俯仰角（弧度） */
  pitch: number;
  /** 相机距离（用于透视缩放） */
  distance: number;
  /** 焦距缩放系数 */
  fov: number;
}

/**
 * 将三维点 (x, y, z) 经绕 Y 轴 yaw、绕 X 轴 pitch 旋转后透视投影到 2D 画布坐标。
 * Y 轴朝上（画布 y 轴向下，因此投影后取 -y）。
 */
export function project3D(
  p: Vec3,
  cam: Camera3D,
  center: {x: number; y: number} = {x: 0, y: 0},
): {pos: Vector2; scale: number; depth: number} {
  const cosY = Math.cos(cam.yaw);
  const sinY = Math.sin(cam.yaw);
  const cosP = Math.cos(cam.pitch);
  const sinP = Math.sin(cam.pitch);

  // 绕 Y 轴旋转
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;
  const y1 = p.y;

  // 绕 X 轴俯仰
  const y2 = y1 * cosP - z1 * sinP;
  const z2 = y1 * sinP + z1 * cosP;

  const depth = cam.distance - z2;
  const safeDepth = Math.max(depth, 10);
  const scale = cam.fov / safeDepth;

  return {
    pos: new Vector2(center.x + x1 * scale, center.y - y2 * scale),
    scale,
    depth,
  };
}

/**
 * 生成 3D 柱体（长方体）顶面、正面、侧面的 2D 投影多边形顶点（等轴/透视通用）
 */
export function build3DBarFaces(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  height: number,
  cam: Camera3D,
  origin: {x: number; y: number},
): {
  top: Vector2[];
  front: Vector2[];
  side: Vector2[];
  topCenter: Vector2;
  bottomCenter: Vector2;
} {
  const hw = width / 2;
  const hd = depth / 2;
  const h = Math.max(height, 1);

  const p = (x: number, y: number, z: number) =>
    project3D({x, y, z}, cam, origin).pos;

  // 底面四角 (y = 0)
  const bFL = p(cx - hw, 0, cz + hd);
  const bFR = p(cx + hw, 0, cz + hd);
  const bBR = p(cx + hw, 0, cz - hd);

  // 顶面四角 (y = h)
  const tFL = p(cx - hw, h, cz + hd);
  const tFR = p(cx + hw, h, cz + hd);
  const tBR = p(cx + hw, h, cz - hd);
  const tBL = p(cx - hw, h, cz - hd);

  return {
    top: [tFL, tFR, tBR, tBL],
    front: [bFL, bFR, tFR, tFL],
    side: [bFR, bBR, tBR, tFR],
    topCenter: p(cx, h, cz),
    bottomCenter: p(cx, 0, cz),
  };
}
