import { Node, NodeProps, Ray } from "@motion-canvas/2d";
import { all, createRefArray, ThreadGenerator } from "@motion-canvas/core";
import { TreeNode } from "./tree_node";

export interface BTreeProps extends NodeProps {
  /** 二叉树层数 */
  L?: number;
  /** 节点间距 */
  spacing?: number;
  /** 节点尺寸 */
  nodeSize?: number;
}

export class BTree extends Node {
  public readonly nodes = createRefArray<TreeNode>();
  public readonly edges = createRefArray<Ray>();
  private readonly levels: number;

  public constructor(props?: BTreeProps) {
    const { L = 3, spacing = 60, nodeSize = 120, ...nodeProps } = props ?? {};

    super(nodeProps);
    this.levels = L;

    // 以最底层叶子总宽为基准，上层按槽位均分，父节点落在子节点中点正上方
    const leafCount = Math.pow(2, L - 1);
    const treeWidth = leafCount * nodeSize + (leafCount - 1) * spacing;
    const treeHeight = L * nodeSize + (L - 1) * spacing;
    const startY = -treeHeight / 2 + nodeSize / 2;
    const radius = nodeSize / 2;

    const positions: { x: number; y: number }[] = [];
    for (let level = 0; level < L; level++) {
      // N代表当前行有多少个节点
      const N = Math.pow(2, level);
      const slotWidth = treeWidth / N;
      const y = startY + level * (nodeSize + spacing);

      for (let j = 0; j < N; j++) {
        positions.push({
          x: -treeWidth / 2 + (j + 0.5) * slotWidth,
          y,
        });
      }
    }

    // 先画箭头（在节点下方），从父节点底边指向子节点顶边
    for (let i = 1; i < positions.length; i++) {
      const parentIndex = Math.floor((i + 1) / 2) - 1;
      const parent = positions[parentIndex];
      const child = positions[i];

      this.add(
        <Ray
          ref={this.edges}
          from={[parent.x, parent.y + radius]}
          to={[child.x, child.y - radius]}
          stroke={"#5C79A3"}
          lineWidth={4}
          endArrow
          arrowSize={12}
        />,
      );
    }

    // 构建组件 UI 结构：节点叠在箭头之上
    for (let i = 0; i < positions.length; i++) {
      const { x, y } = positions[i];
      const id = i + 1;

      this.add(
        <TreeNode
          ref={this.nodes}
          title={`Node ${id}`}
          size={nodeSize}
          x={x}
          y={y}
        />,
      );
    }
  }

  /**
   * 从根节点开始，逐层分裂展开直到显示全部节点。
   * @param duration 每一层展开的时长（秒）
   */
  public *create(duration = 0.5): ThreadGenerator {
    const count = this.nodes.length;
    if (count === 0) {
      return;
    }

    // 记录最终布局位置
    const finals = this.nodes.map((node) => ({
      x: node.x(),
      y: node.y(),
    }));

    // 初始：箭头收起；根节点缩为 0；其余节点叠在父节点位置并隐藏
    for (const edge of this.edges) {
      edge.end(0);
    }
    this.nodes[0].scale(0);
    for (let i = 1; i < count; i++) {
      const parentIndex = Math.floor((i + 1) / 2) - 1;
      this.nodes[i].position([finals[parentIndex].x, finals[parentIndex].y]);
      this.nodes[i].scale(0);
    }

    // 根节点出现
    yield* this.nodes[0].scale(1, duration);

    // 逐层从父节点位置分裂到最终位置，同时展开对应箭头
    for (let level = 1; level < this.levels; level++) {
      const start = Math.pow(2, level) - 1;
      const n = Math.pow(2, level);
      const tasks: ThreadGenerator[] = [];

      for (let j = 0; j < n; j++) {
        const i = start + j;
        const node = this.nodes[i];
        tasks.push(
          all(
            node.position([finals[i].x, finals[i].y], duration),
            node.scale(1, duration),
            this.edges[i - 1].end(1, duration),
          ),
        );
      }

      yield* all(...tasks);
    }
  }
}
