import {
  getNarrativeChildren,
  getNarrativeNode,
  getNarrativeOutgoingEdges
} from './narrativeGraph';

const DEFAULT_LAYOUT = {
  nodeWidth: 248,
  nodeHeight: 152,
  columnGap: 200,
  rowGap: 78,
  rootGap: 1
};

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortRoots(graph, rootIds) {
  return [...rootIds].sort((leftId, rightId) => {
    const left = getNarrativeNode(graph, leftId);
    const right = getNarrativeNode(graph, rightId);
    return (left?.createdAt ?? 0) - (right?.createdAt ?? 0);
  });
}

export function createNarrativeGraphLayout(graph, options = {}) {
  const {
    nodeWidth,
    nodeHeight,
    columnGap,
    rowGap,
    rootGap
  } = { ...DEFAULT_LAYOUT, ...options };

  const verticalStep = nodeHeight + rowGap;
  const horizontalStep = nodeWidth + columnGap;
  const positions = {};
  let leafRow = 0;

  const placeNode = (nodeId) => {
    const node = getNarrativeNode(graph, nodeId);
    if (!node) return 0;

    const children = getNarrativeChildren(graph, nodeId);

    if (children.length === 0) {
      const y = leafRow * verticalStep;
      positions[nodeId] = {
        x: node.depth * horizontalStep,
        y
      };
      leafRow += 1;
      return y;
    }

    const childYPositions = children.map((child) => placeNode(child.id));
    const y = average(childYPositions);
    positions[nodeId] = {
      x: node.depth * horizontalStep,
      y
    };
    return y;
  };

  sortRoots(graph, graph?.rootNodeIds ?? []).forEach((rootId, index) => {
    if (index > 0) {
      leafRow += rootGap;
    }
    placeNode(rootId);
  });

  const nodes = Object.values(graph?.nodes ?? {}).map((node) => ({
    ...node,
    position: positions[node.id] ?? { x: 0, y: 0 }
  }));

  const edges = Object.values(graph?.edges ?? {}).map((edge) => {
    const parent = getNarrativeNode(graph, edge.parentId);
    const child = getNarrativeNode(graph, edge.childId);
    const source = positions[edge.parentId] ?? { x: 0, y: 0 };
    const target = positions[edge.childId] ?? { x: 0, y: 0 };

    return {
      ...edge,
      sourceX: source.x + nodeWidth,
      sourceY: source.y + nodeHeight / 2,
      targetX: target.x,
      targetY: target.y + nodeHeight / 2,
      sourceDepth: parent?.depth ?? 0,
      targetDepth: child?.depth ?? 0
    };
  });

  const maxNodeX = nodes.reduce((max, node) => Math.max(max, node.position.x), 0);
  const maxNodeY = nodes.reduce((max, node) => Math.max(max, node.position.y), 0);
  const outgoingMax = Object.values(graph?.nodes ?? {}).reduce((max, node) => {
    return Math.max(max, getNarrativeOutgoingEdges(graph, node.id).length);
  }, 0);

  return {
    nodes,
    edges,
    bounds: {
      minX: 0,
      minY: 0,
      width: Math.max(nodeWidth, maxNodeX + nodeWidth),
      height: Math.max(nodeHeight, maxNodeY + nodeHeight),
      outgoingMax
    },
    metrics: {
      nodeWidth,
      nodeHeight,
      verticalStep,
      horizontalStep
    }
  };
}
