const GRAPH_VERSION = 2;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateText(text = '', length = 160) {
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 3)).trimEnd()}...`;
}

function normalizePaths(paths) {
  if (!Array.isArray(paths)) return [];
  return paths
    .map((p) => (typeof p === 'string' ? p : p?.text ?? ''))
    .map((p) => p.trim())
    .filter(Boolean);
}

function makeNodeId() {
  return `scene_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeChoiceKey(choiceText = '', choiceIndex = null) {
  if (Number.isInteger(choiceIndex)) return `idx:${choiceIndex}`;
  return `txt:${normalizeString(choiceText)}`;
}

function buildChoiceKeys(choiceText = '', choiceIndex = null) {
  const keys = [];

  if (Number.isInteger(choiceIndex)) {
    keys.push(makeChoiceKey(choiceText, choiceIndex));
  }

  const textKey = makeChoiceKey(choiceText, null);
  if (!keys.includes(textKey)) {
    keys.push(textKey);
  }

  return keys;
}

function createChoiceLookup(choiceText = '', choiceIndex = null, edgeId) {
  return buildChoiceKeys(choiceText, choiceIndex).reduce((lookup, key) => {
    if (key === 'txt:' && !normalizeString(choiceText)) return lookup;
    return {
      ...lookup,
      [key]: edgeId
    };
  }, {});
}

function sortByCreatedAt(left, right) {
  return finiteNumber(left?.createdAt, 0) - finiteNumber(right?.createdAt, 0);
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />');
}

export function createMemorySnapshot(memory = {}) {
  return cloneJson({
    summary: Array.isArray(memory.summary) ? memory.summary : [],
    // Accept both new (paths) and old (choices) field names
    paths: Array.isArray(memory.paths) ? memory.paths
      : Array.isArray(memory.choices) ? memory.choices
      : [],
    companions: Array.isArray(memory.companions) ? memory.companions : [],
    // Accept both new (prose) and old (story) field names
    prose: Array.isArray(memory.prose) ? memory.prose
      : Array.isArray(memory.story) ? memory.story
      : [],
    // Accept both new (sceneIndex) and old (currentScene) field names
    sceneIndex: Number.isFinite(memory.sceneIndex) ? memory.sceneIndex
      : Number.isFinite(memory.currentScene) ? memory.currentScene
      : 0,
    world: memory.world ?? {
      clock: { day: 1, time: 'day' },
      location: { name: 'Unknown Place', tags: [] },
      sceneTags: [],
      objectives: [],
      flags: {}
    },
    arc: memory.arc ?? { chapter: 1, beat: 0, tension: 3 }
  });
}

function createBaseNode(rawNode = {}) {
  // Accept new field names (prose/proseHtml/paths) and fall back to old (story/storyHtml/choices)
  const prose = typeof rawNode.prose === 'string' ? rawNode.prose
    : typeof rawNode.story === 'string' ? rawNode.story
    : '';

  return {
    id: rawNode.id || makeNodeId(),
    parentId: rawNode.parentId ?? null,
    incomingEdgeId: rawNode.incomingEdgeId ?? null,
    choiceFromParent: normalizeString(rawNode.choiceFromParent),
    choiceIndexFromParent: Number.isInteger(rawNode.choiceIndexFromParent)
      ? rawNode.choiceIndexFromParent
      : null,
    choiceKeyFromParent: normalizeString(rawNode.choiceKeyFromParent),
    prompt: typeof rawNode.prompt === 'string' ? rawNode.prompt : '',
    rawOutput: typeof rawNode.rawOutput === 'string' ? rawNode.rawOutput : '',
    title: typeof rawNode.title === 'string' ? rawNode.title : '',
    prose,
    proseHtml:
      typeof rawNode.proseHtml === 'string' && rawNode.proseHtml
        ? rawNode.proseHtml
        : typeof rawNode.storyHtml === 'string' && rawNode.storyHtml
          ? rawNode.storyHtml
          : escapeHtml(prose),
    summary: typeof rawNode.summary === 'string' ? rawNode.summary : '',
    excerpt:
      typeof rawNode.excerpt === 'string' && rawNode.excerpt
        ? rawNode.excerpt
        : truncateText(prose.replace(/\s+/g, ' ').trim(), 150),
    paths: normalizePaths(rawNode.paths ?? rawNode.choices),
    choiceDirector: rawNode.choiceDirector ?? null,
    packet: cloneJson(rawNode.packet ?? {}),
    memorySnapshot: createMemorySnapshot(rawNode.memorySnapshot),
    childEdgeIds: Array.isArray(rawNode.childEdgeIds) ? rawNode.childEdgeIds : [],
    choiceEdgeIdsByKey:
      rawNode.choiceEdgeIdsByKey && typeof rawNode.choiceEdgeIdsByKey === 'object'
        ? { ...rawNode.choiceEdgeIdsByKey }
        : {},
    createdAt: finiteNumber(rawNode.createdAt, Date.now()),
    depth: finiteNumber(rawNode.depth, 0)
  };
}

function createBaseEdge(rawEdge = {}, fallbackNode = null) {
  const choiceText =
    typeof rawEdge.choiceText === 'string'
      ? rawEdge.choiceText
      : fallbackNode?.choiceFromParent ?? '';
  const choiceIndex = Number.isInteger(rawEdge.choiceIndex)
    ? rawEdge.choiceIndex
    : fallbackNode?.choiceIndexFromParent ?? null;

  return {
    id: rawEdge.id || `edge_${rawEdge.childId || fallbackNode?.id || makeEdgeId()}`,
    parentId: rawEdge.parentId ?? fallbackNode?.parentId ?? null,
    childId: rawEdge.childId ?? fallbackNode?.id ?? null,
    choiceText,
    choiceIndex,
    choiceKey: normalizeString(rawEdge.choiceKey) || makeChoiceKey(choiceText, choiceIndex),
    createdAt: finiteNumber(rawEdge.createdAt, fallbackNode?.createdAt ?? Date.now())
  };
}

function attachEdge(graph, edge) {
  const parent = graph.nodes[edge.parentId];
  const child = graph.nodes[edge.childId];

  if (!parent || !child) return;

  graph.edges[edge.id] = edge;

  parent.childEdgeIds = [...parent.childEdgeIds, edge.id].sort((leftId, rightId) => {
    const left = graph.edges[leftId];
    const right = graph.edges[rightId];
    return sortByCreatedAt(left, right);
  });

  parent.choiceEdgeIdsByKey = {
    ...parent.choiceEdgeIdsByKey,
    ...createChoiceLookup(edge.choiceText, edge.choiceIndex, edge.id)
  };

  child.parentId = edge.parentId;
  child.incomingEdgeId = edge.id;
  child.choiceFromParent = edge.choiceText;
  child.choiceIndexFromParent = edge.choiceIndex;
  child.choiceKeyFromParent = edge.choiceKey;
}

function assignDepths(graph) {
  const walk = (nodeId, depth) => {
    const node = graph.nodes[nodeId];
    if (!node) return;

    node.depth = depth;
    node.childEdgeIds.forEach((edgeId) => {
      const childId = graph.edges[edgeId]?.childId;
      if (childId) walk(childId, depth + 1);
    });
  };

  graph.rootNodeIds.forEach((rootId) => walk(rootId, 0));
}

function buildRoots(graph, suggestedRootIds = []) {
  const roots = new Set();

  suggestedRootIds.forEach((rootId) => {
    if (graph.nodes[rootId]) roots.add(rootId);
  });

  Object.values(graph.nodes)
    .filter((node) => !node.parentId || !graph.nodes[node.parentId])
    .sort(sortByCreatedAt)
    .forEach((node) => roots.add(node.id));

  return Array.from(roots);
}

function buildLegacyMemorySnapshot(memory, sceneIdx) {
  const snapshot = createMemorySnapshot(memory);

  return {
    ...snapshot,
    prose: snapshot.prose.slice(0, sceneIdx + 1),
    summary: snapshot.summary.slice(0, sceneIdx + 1),
    paths: snapshot.paths.slice(0, sceneIdx + 1),
    sceneIndex: sceneIdx
  };
}

export function createEmptyNarrativeGraph() {
  return {
    version: GRAPH_VERSION,
    activeNodeId: null,
    rootNodeIds: [],
    nodes: {},
    edges: {}
  };
}

export function normalizeNarrativeGraph(rawGraph) {
  if (!rawGraph?.nodes || typeof rawGraph.nodes !== 'object') {
    return createEmptyNarrativeGraph();
  }

  const graph = createEmptyNarrativeGraph();
  const rawNodes = Object.values(rawGraph.nodes).sort(sortByCreatedAt);

  rawNodes.forEach((rawNode) => {
    const node = createBaseNode(rawNode);
    node.childEdgeIds = [];
    node.choiceEdgeIdsByKey = {};
    graph.nodes[node.id] = node;
  });

  const explicitEdges = Array.isArray(rawGraph.edges)
    ? rawGraph.edges
    : Object.values(rawGraph.edges ?? {});

  const edges =
    explicitEdges.length > 0
      ? explicitEdges
          .map((edge) => createBaseEdge(edge))
          .filter((edge) => edge.parentId && edge.childId)
      : rawNodes
          .filter((node) => node.parentId)
          .map((node) => createBaseEdge({}, node));

  edges.sort(sortByCreatedAt).forEach((edge) => attachEdge(graph, edge));

  graph.rootNodeIds = buildRoots(graph, rawGraph.rootNodeIds);
  assignDepths(graph);

  graph.activeNodeId = graph.nodes[rawGraph.activeNodeId]
    ? rawGraph.activeNodeId
    : graph.rootNodeIds.at(-1) ?? null;

  return graph;
}

export function createNarrativeNode(
  graph,
  {
    parentId = null,
    choiceFromParent = '',
    choiceIndexFromParent = null,
    prompt = '',
    rawOutput = '',
    packet = {},
    memorySnapshot,
    proseHtml
  }
) {
  const parentDepth = parentId && graph?.nodes?.[parentId] ? graph.nodes[parentId].depth : -1;
  const prose = typeof packet?.prose === 'string' ? packet.prose
    : typeof packet?.story === 'string' ? packet.story
    : '';

  return createBaseNode({
    id: makeNodeId(),
    parentId,
    choiceFromParent,
    choiceIndexFromParent,
    choiceKeyFromParent: makeChoiceKey(choiceFromParent, choiceIndexFromParent),
    prompt,
    rawOutput,
    title: typeof packet?.title === 'string' ? packet.title : '',
    prose,
    proseHtml: typeof proseHtml === 'string' ? proseHtml : escapeHtml(prose),
    summary: typeof packet?.summary === 'string' ? packet.summary : '',
    paths: normalizePaths(packet?.paths ?? packet?.choices),
    choiceDirector: cloneJson(packet?.choiceDirector ?? null),
    packet: cloneJson(packet ?? {}),
    memorySnapshot: createMemorySnapshot(memorySnapshot),
    childEdgeIds: [],
    choiceEdgeIdsByKey: {},
    createdAt: Date.now(),
    depth: parentDepth + 1
  });
}

export function insertNarrativeNode(graph, node) {
  const baseGraph = normalizeNarrativeGraph(graph);
  const nextGraph = {
    ...baseGraph,
    nodes: {
      ...baseGraph.nodes,
      [node.id]: createBaseNode(node)
    },
    edges: { ...baseGraph.edges }
  };

  if (node.parentId && nextGraph.nodes[node.parentId]) {
    const edge = createBaseEdge(
      {
        id: makeEdgeId(),
        parentId: node.parentId,
        childId: node.id,
        choiceText: node.choiceFromParent,
        choiceIndex: node.choiceIndexFromParent,
        createdAt: node.createdAt
      },
      node
    );
    attachEdge(nextGraph, edge);
  } else {
    nextGraph.rootNodeIds = [...nextGraph.rootNodeIds, node.id];
  }

  nextGraph.rootNodeIds = buildRoots(nextGraph, nextGraph.rootNodeIds);
  assignDepths(nextGraph);
  nextGraph.activeNodeId = node.id;

  return nextGraph;
}

export function setActiveNarrativeNode(graph, nodeId) {
  const nextGraph = normalizeNarrativeGraph(graph);

  return {
    ...nextGraph,
    activeNodeId: nextGraph.nodes[nodeId] ? nodeId : nextGraph.activeNodeId
  };
}

export function getNarrativeNode(graph, nodeId) {
  return graph?.nodes?.[nodeId] ?? null;
}

export function getNarrativeEdge(graph, edgeId) {
  return graph?.edges?.[edgeId] ?? null;
}

export function getNarrativeOutgoingEdges(graph, nodeId) {
  const node = getNarrativeNode(graph, nodeId);
  if (!node) return [];

  return (node.childEdgeIds ?? [])
    .map((edgeId) => getNarrativeEdge(graph, edgeId))
    .filter(Boolean)
    .sort(sortByCreatedAt);
}

export function getNarrativeChildren(graph, parentId) {
  return getNarrativeOutgoingEdges(graph, parentId)
    .map((edge) => getNarrativeNode(graph, edge.childId))
    .filter(Boolean);
}

export function findChildNodeId(graph, parentId, choice, choiceIndex = null) {
  const parent = getNarrativeNode(graph, parentId);
  if (!parent) return null;

  const keys = buildChoiceKeys(choice, choiceIndex);

  for (const key of keys) {
    const edgeId = parent.choiceEdgeIdsByKey?.[key];
    const edge = edgeId ? getNarrativeEdge(graph, edgeId) : null;
    if (edge?.childId) return edge.childId;
  }

  const fallbackEdge = getNarrativeOutgoingEdges(graph, parentId).find(
    (edge) => normalizeString(edge.choiceText) === normalizeString(choice)
  );

  return fallbackEdge?.childId ?? null;
}

export function getNarrativeNodePathIds(graph, nodeId) {
  const path = [];
  let cursor = getNarrativeNode(graph, nodeId);

  while (cursor) {
    path.push(cursor.id);
    cursor = cursor.parentId ? getNarrativeNode(graph, cursor.parentId) : null;
  }

  return path.reverse();
}

export function getNarrativeNodePath(graph, nodeId) {
  return getNarrativeNodePathIds(graph, nodeId)
    .map((id) => getNarrativeNode(graph, id))
    .filter(Boolean);
}

export function getActiveNarrativePathIds(graph) {
  return getNarrativeNodePathIds(graph, graph?.activeNodeId);
}

export function buildSceneSegments(graph, nodeId, animateNodeId = null) {
  return getNarrativeNodePath(graph, nodeId).flatMap((node, index) => {
    const segments = [];

    if (index > 0 && node.choiceFromParent) {
      segments.push({
        html: `<br /><br /><strong>The player chooses:</strong> ${escapeHtml(node.choiceFromParent)}<br /><br />`,
        animate: false,
        nodeId: node.id,
        type: 'choice'
      });
    }

    segments.push({
      html: node.proseHtml || escapeHtml(node.prose),
      animate: animateNodeId === node.id,
      nodeId: node.id,
      type: 'scene'
    });

    return segments;
  });
}

// Backward-compat alias
export const buildStorySegmentsForNode = buildSceneSegments;

export function getNarrativeDisplayTitle(graph, nodeId, fallback = 'Your Adventure Awaits...') {
  const path = getNarrativeNodePath(graph, nodeId);
  for (const node of path) {
    if (node.title) return node.title;
  }
  return fallback;
}

export function getNarrativeNodeExcerpt(node, fallback = 'An unwritten page waits here.') {
  if (!node) return fallback;
  return node.excerpt || truncateText((node.prose || node.story || '').replace(/\s+/g, ' ').trim(), 150) || fallback;
}

export function createGraphFromResumeState(memory, ui = {}) {
  // Support both new (prose/paths) and old (story/choices) field names
  const proseList = Array.isArray(memory?.prose) ? memory.prose
    : Array.isArray(memory?.story) ? memory.story
    : [];
  const summaries = Array.isArray(memory?.summary) ? memory.summary : [];
  const storedPaths = Array.isArray(memory?.paths) ? memory.paths
    : Array.isArray(memory?.choices) ? memory.choices
    : [];
  const fallbackGraph = createEmptyNarrativeGraph();

  // Support both new (displayedPaths) and old (displayedChoices) field names in ui
  const displayedPaths = ui.displayedPaths ?? ui.displayedChoices ?? [];

  if (proseList.length === 0) {
    const node = createBaseNode({
      id: 'resume_node',
      parentId: null,
      title: typeof ui.displayedTitle === 'string' ? ui.displayedTitle : 'Your Adventure Awaits...',
      prose: '',
      proseHtml: '',
      summary: '',
      paths: normalizePaths(displayedPaths),
      prompt: typeof ui.prompt === 'string' ? ui.prompt : '',
      rawOutput: typeof ui.rawOutput === 'string' ? ui.rawOutput : '',
      packet: {},
      memorySnapshot: createMemorySnapshot(memory),
      createdAt: Date.now(),
      depth: 0
    });

    return {
      ...fallbackGraph,
      activeNodeId: node.id,
      rootNodeIds: [node.id],
      nodes: {
        [node.id]: node
      }
    };
  }

  let graph = createEmptyNarrativeGraph();
  let parentId = null;
  const now = Date.now();

  proseList.forEach((prose, index) => {
    const isCurrentNode = index === proseList.length - 1;
    const packet = {
      title:
        index === 0 && typeof ui.displayedTitle === 'string' ? ui.displayedTitle : '',
      prose,
      summary: summaries[index] ?? '',
      paths: isCurrentNode ? normalizePaths(displayedPaths) : []
    };

    const node = createNarrativeNode(graph, {
      parentId,
      choiceFromParent:
        index === 0 ? '' : storedPaths[index] ?? storedPaths[index - 1] ?? '',
      choiceIndexFromParent: null,
      prompt: isCurrentNode && typeof ui.prompt === 'string' ? ui.prompt : '',
      rawOutput: isCurrentNode && typeof ui.rawOutput === 'string' ? ui.rawOutput : '',
      packet,
      memorySnapshot: buildLegacyMemorySnapshot(memory, index),
      proseHtml: escapeHtml(prose)
    });

    node.id = isCurrentNode ? 'resume_node' : `legacy_scene_${index}`;
    node.createdAt = now + index;

    graph = insertNarrativeNode(graph, node);
    parentId = node.id;
  });

  return {
    ...graph,
    activeNodeId: parentId
  };
}
