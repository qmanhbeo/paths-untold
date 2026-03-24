import React, { useEffect, useRef, useState } from 'react';
import { generateScene } from '../utils/AI-chat';
import { createDebugLogger } from '../utils/debugLog';
import { saveGameToSlot } from '../utils/saveSystem';
import { buildScenePrompt } from '../utils/buildUnifiedPrompt';
import { updateFromAIPacket } from '../state/updateFromAIPacket';
import { extractAndNormalizeAiResponse } from '../utils/storyParser';
import {
  buildSceneSegments,
  createEmptyNarrativeGraph,
  createGraphFromResumeState,
  createMemorySnapshot,
  createNarrativeNode,
  findChildNodeId,
  getNarrativeDisplayTitle,
  getNarrativeNode,
  getNarrativeNodePath,
  insertNarrativeNode,
  normalizeNarrativeGraph,
  setActiveNarrativeNode
} from '../state/narrativeGraph';

import SceneLog from './sceneLog';
import CharacterLog from './characterLog';
import NarrativeBranchView from './NarrativeBranchView';
import { HeaderBar, ChoiceGrid } from './GameScreenComponents';

import './styles.css';
import backgroundImage from '../images/background-black.jpg';

const debug = createDebugLogger('GameScreen');

const createFreshMemory = () => ({
  summary: [],
  paths: [],
  companions: [],
  prose: [],
  sceneIndex: 0,
  world: {
    clock: { day: 1, time: 'day' },
    location: { name: 'Unknown Place', tags: [] },
    sceneTags: [],
    objectives: [],
    flags: {}
  },
  arc: { chapter: 1, beat: 0, tension: 3 }
});

const ensureWorldArc = (mem) => ({
  ...mem,
  world: mem?.world ?? {
    clock: { day: 1, time: 'day' },
    location: { name: 'Unknown Place', tags: [] },
    sceneTags: [],
    objectives: [],
    flags: {}
  },
  arc: mem?.arc ?? { chapter: 1, beat: 0, tension: 3 }
});

const GameScreen = ({ prompt, storyOptions, onBackToMenu }) => {
  const [displayedTitle, setDisplayedTitle] = useState('Your Adventure Awaits...');
  const [fadeInTitle, setFadeInTitle] = useState(true);
  const [segments, setSegments] = useState([]);
  const [displayedPaths, setDisplayedPaths] = useState([]);
  const [rawOutput, setRawOutput] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showNarrativeMap, setShowNarrativeMap] = useState(false);
  const [selectedNarrativeNodeId, setSelectedNarrativeNodeId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('slot1');
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  const storyBoxRef = useRef(null);
  const sceneGenerated = useRef(false);

  const [gameMemory, setGameMemory] = useState(() => {
    if (storyOptions?.resumeFromSave && storyOptions.memory) {
      return ensureWorldArc(storyOptions.memory);
    }
    sessionStorage.removeItem('gameMemory');
    return createFreshMemory();
  });

  const [narrativeGraph, setNarrativeGraph] = useState(() => {
    if (storyOptions?.resumeFromSave && storyOptions?.ui?.narrativeGraph?.nodes) {
      return normalizeNarrativeGraph(storyOptions.ui.narrativeGraph);
    }
    if (storyOptions?.resumeFromSave && storyOptions.memory) {
      return createGraphFromResumeState(ensureWorldArc(storyOptions.memory), storyOptions.ui);
    }
    return createEmptyNarrativeGraph();
  });

  const memoryRef = useRef(gameMemory);
  const graphRef = useRef(narrativeGraph);

  useEffect(() => {
    memoryRef.current = gameMemory;
  }, [gameMemory]);

  useEffect(() => {
    graphRef.current = narrativeGraph;
  }, [narrativeGraph]);

  const currentPathNodes = getNarrativeNodePath(
    narrativeGraph,
    narrativeGraph.activeNodeId
  );

  const smoothScrollToBottom = (el) => {
    if (!el) return;
    setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 60);
  };

  const restoreNode = (graph, nodeId, options = {}) => {
    const node = getNarrativeNode(graph, nodeId);
    if (!node) return;

    const nextGraph =
      graph.activeNodeId === nodeId ? graph : setActiveNarrativeNode(graph, nodeId);
    const nextTitle = getNarrativeDisplayTitle(nextGraph, nodeId);

    setNarrativeGraph(nextGraph);
    setGameMemory(ensureWorldArc(createMemorySnapshot(node.memorySnapshot)));
    setDisplayedTitle(nextTitle);
    setFadeInTitle(true);
    setRawOutput(node.rawOutput || '');
    setDisplayedPaths(node.paths || []);
    setSegments(
      buildSceneSegments(nextGraph, nodeId, options.animateNodeId ?? null)
    );
    setSelectedNarrativeNodeId(nodeId);
    setIsLoading(false);
    sceneGenerated.current = true;
  };

  useEffect(() => {
    if (!selectedNarrativeNodeId && narrativeGraph.activeNodeId) {
      setSelectedNarrativeNodeId(narrativeGraph.activeNodeId);
    }
  }, [selectedNarrativeNodeId, narrativeGraph.activeNodeId]);

  useEffect(() => {
    if (storyOptions?.resumeFromSave && storyOptions.memory) {
      const graph = graphRef.current;
      const nodeId = graph.activeNodeId || graph.rootNodeIds[0];
      if (nodeId) {
        restoreNode(graph, nodeId);
      }
      return;
    }

    if (!sceneGenerated.current && !storyOptions?.resumeFromSave && prompt) {
      const initialMemory = createFreshMemory();
      setGameMemory(initialMemory);
      memoryRef.current = initialMemory;
      setIsLoading(true);

      const { system: openingSys, user: openingUser } = buildScenePrompt(initialMemory, '', storyOptions);
      const openingMessages = [{ role: 'system', content: openingSys }, { role: 'user', content: openingUser }];
      debug.log('[PROMPT 0]', openingUser);

      generateScene(openingMessages, async (rawAI0) => {
        await handleSceneResponse(rawAI0, {
          choice: '',
          parentId: null,
          promptForNode: openingUser,
          baseMemory: initialMemory
        });
        setIsLoading(false);
      });

      sceneGenerated.current = true;
    }
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sessionStorage.setItem('gameMemory', JSON.stringify(gameMemory));
  }, [gameMemory]);

  useEffect(() => {
    const el = storyBoxRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
      setStickToBottom(atBottom);
    };

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = storyBoxRef.current;
    if (!el) return;

    // Only auto-scroll if the player is already near the bottom
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (!isAtBottom) return;

    const choiceStrongs = el.querySelectorAll('[data-segment-type="choice"] strong');
    if (choiceStrongs.length > 0) {
      const target = choiceStrongs[choiceStrongs.length - 1];
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else {
      smoothScrollToBottom(el);
    }
  }, [segments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSceneResponse = async (rawAIX, options = {}) => {
    const {
      choice = '',
      retry = false,
      parentId = null,
      choiceIndexFromParent = null,
      promptForNode = '',
      baseMemory = memoryRef.current
    } = options;

    const sceneIdx = Array.isArray(baseMemory?.prose) ? baseMemory.prose.length : 0;
    const rawOutputText =
      typeof rawAIX === 'string' ? rawAIX : JSON.stringify(rawAIX, null, 2);

    debug.log(`[RAW AI OUTPUT - Scene ${sceneIdx}]`, rawAIX);
    setDisplayedPaths([]);
    setRawOutput(rawOutputText);

    try {
      const obj = extractAndNormalizeAiResponse(rawAIX);
      if (!obj) throw new Error('Could not extract JSON payload from model output');

      const nextMem = updateFromAIPacket(baseMemory, obj, choice);
      const currentGraph = graphRef.current;
      const newNode = createNarrativeNode(currentGraph, {
        parentId,
        choiceFromParent: choice,
        choiceIndexFromParent,
        prompt: promptForNode,
        rawOutput: rawOutputText,
        packet: obj,
        memorySnapshot: nextMem
      });
      const nextGraph = insertNarrativeNode(currentGraph, newNode);

      restoreNode(nextGraph, newNode.id, { animateNodeId: newNode.id });

      return {
        prose: obj.prose,
        sceneIndex: nextMem.sceneIndex,
        paths: newNode.paths
      };
    } catch (e) {
      debug.error('Parse/update failed:', e);

      if (!retry) {
        debug.warn('Retrying generation due to malformed output...');
        setSegments((prev) => [
          ...prev,
          { html: '<i class="text-amber-300/70">The story hesitates for a moment\u2026</i>', animate: true, type: 'retry' }
        ]);
        const { system: retrySys, user: retryUser } = buildScenePrompt(baseMemory, choice, storyOptions);
        const retryMessages = [{ role: 'system', content: retrySys }, { role: 'user', content: retryUser }];
        return new Promise((resolve) => {
          generateScene(retryMessages, async (newResponse) => {
            const result = await handleSceneResponse(newResponse, {
              choice,
              retry: true,
              parentId,
              choiceIndexFromParent,
              promptForNode: retryUser,
              baseMemory
            });
            resolve(result);
          });
        });
      }

      setDisplayedPaths([]);
      setSegments((prev) => [
        ...prev,
        {
          html: '<i class="text-red-300">Failed to load story after retry. Please choose again or reload.</i>',
          animate: true,
          type: 'error'
        }
      ]);

      return {
        prose: '',
        sceneIndex: baseMemory.sceneIndex ?? 0,
        paths: []
      };
    }
  };

  const handleChoiceClick = async (choice, choiceIndex = null) => {
    if (isLoading) return;

    const currentGraph = graphRef.current;
    const activeNodeId = currentGraph.activeNodeId;

    if (activeNodeId) {
      const existingChildId = findChildNodeId(
        currentGraph,
        activeNodeId,
        choice,
        choiceIndex
      );
      if (existingChildId) {
        restoreNode(currentGraph, existingChildId);
        return;
      }
    }

    setIsLoading(true);

    const baseMemory = createMemorySnapshot(memoryRef.current);
    const nextSceneIndex = (baseMemory.sceneIndex ?? 0) + 1;
    const { system: branchSys, user: branchUser } = buildScenePrompt(baseMemory, choice, storyOptions);
    const branchMessages = [{ role: 'system', content: branchSys }, { role: 'user', content: branchUser }];

    debug.log(`[PROMPT FOR SCENE ${nextSceneIndex}]`, branchUser);

    await generateScene(branchMessages, async (nextScene) => {
      await handleSceneResponse(nextScene, {
        choice,
        parentId: activeNodeId,
        choiceIndexFromParent: choiceIndex,
        promptForNode: branchUser,
        baseMemory
      });
      setIsLoading(false);
    });
  };

  const handleSave = () => {
    if (isLoading) return;
    setShowSaveOptions(true);
  };

  const handleJumpToNode = (nodeId) => {
    restoreNode(graphRef.current, nodeId);
    setShowNarrativeMap(false);
  };

  const confirmSave = () => {
    const normalizedGraph = normalizeNarrativeGraph(narrativeGraph);

    saveGameToSlot(selectedSlot, {
      options: { ...storyOptions, prompt, resumeFromSave: true },
      memory: gameMemory,
      ui: {
        displayedStory: segments.map((segment) => segment.html).join(''),
        displayedPaths,
        displayedTitle,
        rawOutput,
        prompt: getNarrativeNode(normalizedGraph, normalizedGraph.activeNodeId)?.prompt ?? '',
        narrativeGraph: normalizedGraph
      }
    });
    setSaveMessage(`Game saved to ${selectedSlot}`);
    setTimeout(() => setSaveMessage(''), 2000);
    setShowSaveOptions(false);
  };

  return (
    <div
      className="relative flex h-screen flex-row bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {showSidebar && (
        <SceneLog scenes={currentPathNodes} onClose={() => setShowSidebar(false)} />
      )}

      {showCharacterPanel && (
        <div className="flex flex-row animate-slide-in-left">
          <CharacterLog
            companions={gameMemory.companions || []}
            sceneIndex={gameMemory.sceneIndex}
            onClose={() => setShowCharacterPanel(false)}
          />
        </div>
      )}

      {showNarrativeMap && (
        <NarrativeBranchView
          graph={narrativeGraph}
          selectedNodeId={selectedNarrativeNodeId}
          onSelectNode={setSelectedNarrativeNodeId}
          onJumpToNode={handleJumpToNode}
          onClose={() => setShowNarrativeMap(false)}
        />
      )}

      <div className="flex flex-grow flex-col p-10 pt-10 animate-fade-in-slow">
        <h1
          className={`mb-4 font-berkshire text-2xl font-bold text-white transition-opacity duration-1000 ${
            fadeInTitle ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {displayedTitle}
        </h1>

        <HeaderBar
          mem={gameMemory}
          onToggleLog={() => setShowSidebar(!showSidebar)}
          showSidebar={showSidebar}
        />

        <div className="mb-2 flex items-center justify-end gap-2 animate-fade-in-slow">
          <button
            disabled={isLoading}
            onClick={handleSave}
            className="rounded border border-yellow-300 px-4 py-1 text-white hover:bg-yellow-800 disabled:opacity-50"
          >
            Save Game
          </button>
          <button
            onClick={() => setShowNarrativeMap(true)}
            className="rounded border border-cyan-300 px-4 py-1 text-white hover:bg-cyan-900/50"
          >
            Narrative Map
          </button>
          <button
            onClick={() => setShowCharacterPanel(!showCharacterPanel)}
            className="rounded border border-green-300 px-4 py-1 text-white hover:bg-green-800"
          >
            {showCharacterPanel ? 'Hide Characters' : 'Show Characters'}
          </button>
          <button
            onClick={onBackToMenu}
            className="rounded border border-red-300 px-4 py-1 text-sm text-white hover:bg-red-800"
          >
            Back to Menu
          </button>
        </div>

        {showSaveOptions && (
          <div className="mb-4 w-fit rounded bg-yellow-800 bg-opacity-90 p-4 text-white shadow-lg animate-fade-in-slow">
            <label htmlFor="slot" className="mr-2 text-sm">
              Choose Save Slot:
            </label>
            <select
              id="slot"
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="mr-4 rounded px-2 py-1 text-black"
            >
              <option value="slot1">Slot 1</option>
              <option value="slot2">Slot 2</option>
              <option value="slot3">Slot 3</option>
            </select>
            <button
              onClick={confirmSave}
              className="rounded bg-green-600 px-4 py-1 text-sm hover:bg-green-700"
            >
              Confirm Save
            </button>
          </div>
        )}

        {saveMessage && (
          <div className="mb-2 text-sm text-green-400 animate-fade-in-slow">
            {saveMessage}
          </div>
        )}

        <div
          className="mb-4 flex-grow overflow-y-auto rounded-lg p-4 scroll-smooth"
          ref={storyBoxRef}
        >
          <div className="h-full w-full resize-none border-none outline-none">
            {segments.length === 0 ? (
              <p className="font-cardo italic text-white opacity-80 mix-blend-difference animate-pulse-slow">
                Almost There... Your World is Forming...
              </p>
            ) : (
              segments.map((segment, index) => (
                <p
                  key={`${segment.nodeId ?? 'segment'}-${index}`}
                  data-segment-type={segment.type}
                  className={`font-cardo text-white mix-blend-difference ${
                    segment.animate ? 'animate-blur-in' : ''
                  }`}
                  dangerouslySetInnerHTML={{ __html: segment.html }}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex-shrink-0 animate-fade-in-slow">
          <ChoiceGrid
            choices={displayedPaths}
            onChoice={handleChoiceClick}
            disabled={isLoading}
          />
          <p className="mt-4 text-white mix-blend-difference">
            Scene #: {gameMemory.sceneIndex}
          </p>
        </div>
      </div>

      {!stickToBottom && (
        <button
          className="fixed bottom-6 right-6 rounded bg-black/60 px-3 py-1 text-white hover:bg-black/80"
          onClick={() => {
            const el = storyBoxRef.current;
            smoothScrollToBottom(el);
            setStickToBottom(true);
          }}
        >
          Jump to latest
        </button>
      )}
    </div>
  );
};

export default GameScreen;
