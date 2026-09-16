import { Txt, makeScene2D } from "@motion-canvas/2d";
import { all, createRef, waitFor } from "@motion-canvas/core";
import * as THREE from "three";
import { Axes3D } from "../components/three/axes_3d";
import { Ink } from "../theme/ink";

/**
 * Axes3D 演示：3D 数轴 + 网格，相机环绕一圈。
 */
export default makeScene2D(function* (view) {
  view.fill(Ink.bg);

  const axes = createRef<Axes3D>();
  const caption = createRef<Txt>();

  view.add(
    <>
      <Axes3D
        ref={axes}
        width={960}
        height={720}
        size={4}
        showGrid
        gridDivisions={8}
        showLabels
        tickStep={1}
        quality={2}
        opacity={0}
      />
      <Txt
        ref={caption}
        text={"3D 坐标轴 · 数轴与网格"}
        fill={Ink.paperSoft}
        fontSize={36}
        fontFamily={"Noto Serif SC, Songti SC, serif"}
        y={420}
        opacity={0}
      />
    </>,
  );

  // 原点旁放一个小参考立方体，便于感知轴向
  const cubeGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const cube = new THREE.Mesh(
    cubeGeo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(Ink.gold),
      metalness: 0.3,
      roughness: 0.45,
    }),
  );
  cube.position.set(0.7, 0.35, 0.7);
  cube.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(cubeGeo),
      new THREE.LineBasicMaterial({ color: new THREE.Color(Ink.goldBright) }),
    ),
  );
  axes().threeScene.add(cube);

  yield* all(caption().opacity(1, 0.45), axes().show());
  yield* waitFor(0.35);
  yield* axes().orbit(5);
  yield* waitFor(0.35);
  yield* all(caption().opacity(0, 0.4), axes().hide());
  yield* waitFor(0.25);
});
