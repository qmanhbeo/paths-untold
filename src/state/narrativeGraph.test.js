import { describe, expect, it } from 'vitest';
import {
  createEmptyNarrativeGraph,
  createGraphFromResumeState,
  createNarrativeNode,
  findChildNodeId,
  getActiveNarrativePathIds,
  getNarrativeOutgoingEdges,
  normalizeNarrativeGraph,
  insertNarrativeNode
} from './narrativeGraph';
import { createNarrativeGraphLayout } from './narrativeGraphLayout';

const baseMemory = {
  summary: [],
  choices: [],
  companions: [],
  story: [],
  currentScene: 0,
  world: {
    clock: { day: 1, time: 'day' },
    location: { name: 'Unknown Place', tags: [] },
    sceneTags: [],
    objectives: [],
    flags: {}
  },
  arc: { chapter: 1, beat: 0, tension: 3 }
};

function makePacket(title, story, choices = [], summary = '') {
  return {
    title,
    story,
    summary,
    choices
  };
}

describe('narrativeGraph', () => {
  it('stores explicit edges and reuses an existing child for the same recorded choice', () => {
    let graph = createEmptyNarrativeGraph();

    const root = createNarrativeNode(graph, {
      packet: makePacket('Opening', 'The city wakes.', ['Knock', 'Hide']),
      memorySnapshot: {
        ...baseMemory,
        story: ['The city wakes.'],
        summary: ['The city hums awake.']
      }
    });
    graph = insertNarrativeNode(graph, root);

    const child = createNarrativeNode(graph, {
      parentId: root.id,
      choiceFromParent: 'Hide',
      choiceIndexFromParent: 1,
      packet: makePacket('Shadow Hall', 'You slip into the alley.', ['Listen']),
      memorySnapshot: {
        ...baseMemory,
        story: ['The city wakes.', 'You slip into the alley.'],
        summary: ['The city hums awake.', 'You hide from the patrol.'],
        choices: ['', 'Hide'],
        currentScene: 1
      }
    });
    graph = insertNarrativeNode(graph, child);

    const outgoingEdges = getNarrativeOutgoingEdges(graph, root.id);

    expect(outgoingEdges).toHaveLength(1);
    expect(outgoingEdges[0].choiceText).toBe('Hide');
    expect(outgoingEdges[0].choiceIndex).toBe(1);
    expect(findChildNodeId(graph, root.id, 'Hide', 1)).toBe(child.id);
    expect(findChildNodeId(graph, root.id, 'Hide')).toBe(child.id);
  });

  it('migrates the older parent/children graph format into explicit edges', () => {
    const legacyGraph = {
      activeNodeId: 'scene_1',
      rootNodeIds: ['scene_0'],
      nodes: {
        scene_0: {
          id: 'scene_0',
          parentId: null,
          title: 'Opening',
          story: 'A bell rings.',
          summary: 'A bell rings in the mist.',
          choices: ['Follow the bell'],
          childrenByChoice: { 'Follow the bell': 'scene_1' },
          memorySnapshot: {
            ...baseMemory,
            story: ['A bell rings.'],
            summary: ['A bell rings in the mist.']
          },
          createdAt: 1,
          depth: 0
        },
        scene_1: {
          id: 'scene_1',
          parentId: 'scene_0',
          choiceFromParent: 'Follow the bell',
          title: 'Courtyard',
          story: 'Lanterns sway over stone.',
          summary: 'You reach the courtyard.',
          choices: ['Call out'],
          memorySnapshot: {
            ...baseMemory,
            story: ['A bell rings.', 'Lanterns sway over stone.'],
            summary: ['A bell rings in the mist.', 'You reach the courtyard.'],
            choices: ['', 'Follow the bell'],
            currentScene: 1
          },
          createdAt: 2,
          depth: 1
        }
      }
    };

    const graph = normalizeNarrativeGraph(legacyGraph);
    const edges = Object.values(graph.edges);

    expect(edges).toHaveLength(1);
    expect(edges[0].parentId).toBe('scene_0');
    expect(edges[0].childId).toBe('scene_1');
    expect(findChildNodeId(graph, 'scene_0', 'Follow the bell')).toBe('scene_1');
  });

  it('converts a linear save into a single connected chain with the current node active', () => {
    const graph = createGraphFromResumeState(
      {
        ...baseMemory,
        story: ['The gate opens.', 'A fox watches.', 'The shrine answers.'],
        summary: ['Start.', 'A fox appears.', 'The shrine responds.'],
        choices: ['', 'Follow the fox', 'Touch the altar'],
        currentScene: 2
      },
      {
        displayedTitle: 'Foxfire',
        displayedChoices: ['Leave an offering', 'Walk away']
      }
    );

    expect(graph.activeNodeId).toBe('resume_node');
    expect(Object.keys(graph.nodes)).toHaveLength(3);
    expect(getActiveNarrativePathIds(graph)).toHaveLength(3);
    expect(graph.nodes.resume_node.paths).toEqual(['Leave an offering', 'Walk away']);
  });

  it('lays out branches left-to-right with sibling branches separated vertically', () => {
    let graph = createEmptyNarrativeGraph();

    const root = createNarrativeNode(graph, {
      packet: makePacket('Opening', 'A river splits.', ['Cross left', 'Cross right']),
      memorySnapshot: {
        ...baseMemory,
        story: ['A river splits.'],
        summary: ['A river splits.']
      }
    });
    graph = insertNarrativeNode(graph, root);

    const leftChild = createNarrativeNode(graph, {
      parentId: root.id,
      choiceFromParent: 'Cross left',
      choiceIndexFromParent: 0,
      packet: makePacket('Left Bank', 'You choose the moss bridge.', ['Continue']),
      memorySnapshot: {
        ...baseMemory,
        story: ['A river splits.', 'You choose the moss bridge.'],
        summary: ['A river splits.', 'You take the left bank.'],
        choices: ['', 'Cross left'],
        currentScene: 1
      }
    });
    graph = insertNarrativeNode(graph, leftChild);

    const rightChild = createNarrativeNode(graph, {
      parentId: root.id,
      choiceFromParent: 'Cross right',
      choiceIndexFromParent: 1,
      packet: makePacket('Right Bank', 'You follow the lantern reeds.', ['Continue']),
      memorySnapshot: {
        ...baseMemory,
        story: ['A river splits.', 'You follow the lantern reeds.'],
        summary: ['A river splits.', 'You take the right bank.'],
        choices: ['', 'Cross right'],
        currentScene: 1
      }
    });
    graph = insertNarrativeNode(graph, rightChild);

    const layout = createNarrativeGraphLayout(graph);
    const rootNode = layout.nodes.find((node) => node.id === root.id);
    const leftNode = layout.nodes.find((node) => node.id === leftChild.id);
    const rightNode = layout.nodes.find((node) => node.id === rightChild.id);

    expect(leftNode.position.x).toBeGreaterThan(rootNode.position.x);
    expect(rightNode.position.x).toBeGreaterThan(rootNode.position.x);
    expect(leftNode.position.y).not.toBe(rightNode.position.y);
  });
});
