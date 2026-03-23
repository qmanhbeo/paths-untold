import React, { useEffect, useRef, useState } from 'react';
import { generateStory } from '../utils/AI-chat';
import { createDebugLogger } from '../utils/debugLog';
import { saveGameToSlot } from '../utils/saveSystem';
import { buildUnifiedPrompt } from '../utils/buildUnifiedPrompt';
import { updateFromAIPacket } from '../state/updateFromAIPacket';
import { extractAndNormalizeAiResponse } from '../utils/storyParser';
import {
  buildStorySegmentsForNode,
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
  const [storySegments, setStorySegments] = useState([]);
  const [displayedChoices, setDisplayedChoices] = useState([]);
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
  const storyGenerated = useRef(false);

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
    setDisplayedChoices(node.choices || []);
    setStorySegments(
      buildStorySegmentsForNode(nextGraph, nodeId, options.animateNodeId ?? null)
    );
    setSelectedNarrativeNodeId(nodeId);
    setIsLoading(false);
    storyGenerated.current = true;
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

    if (!storyGenerated.current && !storyOptions?.resumeFromSave && prompt) {
      const initialMemory = createFreshMemory();
      setGameMemory(initialMemory);
      memoryRef.current = initialMemory;
      setIsLoading(true);

      const openingPrompt = buildUnifiedPrompt(initialMemory, '', storyOptions);
      debug.log('[PROMPT 0]', openingPrompt);

      generateStory(openingPrompt, async (rawAI0) => {
        await handleRawAIX(rawAI0, {
          choice: '',
          parentId: null,
          promptForNode: openingPrompt,
          baseMemory: initialMemory
        });
        setIsLoading(false);
      });

      storyGenerated.current = true;
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
    if (el && stickToBottom) {
      smoothScrollToBottom(el);
    }
  }, [storySegments.length, stickToBottom]);

  const handleRawAIX = async (rawAIX, options = {}) => {
    const {
      choice = '',
      retry = false,
      parentId = null,
      choiceIndexFromParent = null,
      promptForNode = '',
      baseMemory = memoryRef.current
    } = options;

    const sceneIndex = Array.isArray(baseMemory?.story) ? baseMemory.story.length : 0;
    const rawOutputText =
      typeof rawAIX === 'string' ? rawAIX : JSON.stringify(rawAIX, null, 2);

    debug.log(`[RAW AI OUTPUT - Scene ${sceneIndex}]`, rawAIX);
    setDisplayedChoices([]);
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
        storyX: obj.story,
        sceneIdx: nextMem.currentScene,
        fourChoicesX: newNode.choices
      };
    } catch (e) {
      debug.error('Parse/update failed:', e);

      if (!retry) {
        debug.warn('Retrying generation due to malformed output...');
        const retryPrompt = buildUnifiedPrompt(baseMemory, choice, storyOptions);
        return new Promise((resolve) => {
          generateStory(retryPrompt, async (newResponse) => {
            const result = await handleRawAIX(newResponse, {
              choice,
              retry: true,
              parentId,
              choiceIndexFromParent,
              promptForNode: retryPrompt,
              baseMemory
            });
            resolve(result);
          });
        });
      }

      setDisplayedChoices([]);
      setStorySegments((prev) => [
        ...prev,
        {
          html: '<i class="text-red-300">Failed to load story after retry. Please choose again or reload.</i>',
          animate: true,
          type: 'error'
        }
      ]);

      return {
        storyX: '',
        sceneIdx: baseMemory.currentScene,
        fourChoicesX: []
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
    const nextSceneIndex = (baseMemory.currentScene ?? 0) + 1;
    const branchPrompt = buildUnifiedPrompt(baseMemory, choice, storyOptions);

    debug.log(`[PROMPT FOR SCENE ${nextSceneIndex}]`, branchPrompt);

    await generateStory(branchPrompt, async (nextScene) => {
      await handleRawAIX(nextScene, {
        choice,
        parentId: activeNodeId,
        choiceIndexFromParent: choiceIndex,
        promptForNode: branchPrompt,
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
        displayedStory: storySegments.map((segment) => segment.html).join(''),
        displayedChoices,
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
            currentScene={gameMemory.currentScene}
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
            {storySegments.length === 0 ? (
              <p className="font-cardo italic text-white opacity-80 mix-blend-difference animate-pulse-slow">
                Almost There... Your World is Forming...
              </p>
            ) : (
              storySegments.map((segment, index) => (
                <p
                  key={`${segment.nodeId ?? 'segment'}-${index}`}
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
            choices={displayedChoices}
            onChoice={handleChoiceClick}
            disabled={isLoading}
          />
          <p className="mt-4 text-white mix-blend-difference">
            Scene #: {gameMemory.currentScene}
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
