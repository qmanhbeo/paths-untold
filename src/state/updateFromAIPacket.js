// src/state/updateFromAIPacket.js
//
// Pure helper: take current memory + a normalized AI packet + the player's choice text,
// and return a NEW memory object with deltas applied, story/summary appended,
// companions merged (with emotions), and lifecycle updates performed.

import { applyDeltas } from './applyDeltas';
import { updateGameMemory } from '../utils/memoryManager';
import { updateCharacterTraits } from '../utils/updateCharacter';
import { getComputedEmotions } from '../utils/emotionCalculator';
import { assignPurposeIfNeeded, updatePhaseOutCountdowns } from '../utils/phaseOutManager';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function ensureWorldArc(mem) {
  return {
    ...mem,
    world: mem?.world ?? {
      clock: { day: 1, time: 'day' },
      location: { name: 'Unknown Place', tags: [] },
      sceneTags: [],
      objectives: [],
      flags: {},
    },
    arc: mem?.arc ?? { chapter: 1, beat: 0, tension: 3 },
  };
}

function keyForCompanion(c) {
  return c?.id || slug(c?.name || '');
}

function makeNewCompanion(incoming, sceneIdx) {
  const name = String(incoming?.name || '').trim() || 'Unknown';
  const id = incoming?.id || slug(name);

  const base = {
    id,
    name,
    role: incoming?.role || '',
    personality: incoming?.personality || '',
    purpose: incoming?.purpose || undefined,
    purposeFulfilled:
      incoming?.fulfilled === 1 || incoming?.fulfilled === true ? true : false,
    knownFacts: Array.isArray(incoming?.knownFacts) ? incoming.knownFacts : [],
    lastSpoken:
      typeof incoming?.lastSpoken === 'string'
        ? { line: incoming.lastSpoken }
        : incoming?.lastSpoken || undefined,
    relationshipHistory: Array.isArray(incoming?.relationshipHistory)
      ? incoming.relationshipHistory
      : [],
    status: incoming?.status || 'active',
    lastUpdatedScene: sceneIdx,
  };

  const scores = getComputedEmotions({ relationshipHistory: base.relationshipHistory });
  return {
    ...base,
    ...scores,
    prevEmotions: { ...scores },
  };
}

/**
 * @param {import('./types').GameMemory} memory
 * @param {Object} packet - normalized by storyParser.extractAndNormalizeAiResponse()
 * @param {string} playerChoiceText
 * @returns {import('./types').GameMemory}
 */
export function updateFromAIPacket(memory, packet, playerChoiceText = '') {
  // Defensive cloning (applyDeltas mutates)
  const draft = deepClone(ensureWorldArc(memory));

  // 1) Apply world/arc/objective/companion deltas (mutates draft)
  const {
    sceneTags,
    objectivesDelta,
    locationDelta,
    companionsDelta,
    arcDelta,
    story = '',
    summary = '',
    characters = [],
  } = packet || {};

  applyDeltas(draft, {
    sceneTags,
    objectivesDelta,
    locationDelta,
    companionsDelta,
    arcDelta,
  });

  // 2) Append narrative (returns a new object)
  const afterNarrative = updateGameMemory(draft, story, summary, playerChoiceText);

  // 3) Compute the new scene index
  const sceneIdx = Math.max(0, (afterNarrative.story?.length || 1) - 1);

  // 4) Merge companions (existing + incoming)
  const map = new Map(
    (afterNarrative.companions || []).map((c) => {
      const k = keyForCompanion(c);
      const withId = c.id ? c : { ...c, id: k };
      return [k, withId];
    })
  );

  (Array.isArray(characters) ? characters : []).forEach((incoming) => {
    const key = keyForCompanion(incoming);
    if (!key) return;

    const existing = map.get(key);

    if (existing) {
      // merge traits
      const merged = updateCharacterTraits(existing, incoming);
      // recompute emotions
      const prevEmo = getComputedEmotions(existing);
      const currEmo = getComputedEmotions(merged);

      map.set(key, {
        ...merged,
        lastUpdatedScene: sceneIdx,
        status: merged.status || 'active',
        ...currEmo,
        prevEmotions: prevEmo,
      });
    } else {
      // new companion with fresh emotion scores
      map.set(key, makeNewCompanion(incoming, sceneIdx));
    }
  });

  // 5) Lifecycle updates (purpose assignment & phase-out countdowns)
  const mergedCompanions = Array.from(map.values()); // <-- missing in your draft
  const withLifecycle = assignPurposeIfNeeded(mergedCompanions, sceneIdx);
  const lifecycleUpdated = updatePhaseOutCountdowns(withLifecycle, sceneIdx);

  // 6) Final result
  return {
    ...afterNarrative,
    companions: lifecycleUpdated,
    currentScene: sceneIdx,
  };
}

export default updateFromAIPacket;
