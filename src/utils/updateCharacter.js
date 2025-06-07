import { getComputedEmotions } from '../utils/emotionCalculator';

export const updateCharacterTraits = (existing, incoming) => {
  const mergedHistory = mergeHistory(existing.relationshipHistory, incoming.relationshipHistory);
  const computedEmotions = getComputedEmotions({ relationshipHistory: mergedHistory });

  return {
    ...existing,
    personality: incoming.personality || existing.personality,
    role: incoming.role || existing.role,
    purpose: incoming.purpose || existing.purpose,
    purposeFulfilled:
      incoming.fulfilled === 1 || incoming.fulfilled === true
        ? true
        : existing.purposeFulfilled ?? false,
    knownFacts: Array.from(
      new Set([...(existing.knownFacts || []), ...(incoming.knownFacts || [])])
    ),
    lastSpoken:
      typeof incoming.lastSpoken === 'string'
        ? { line: incoming.lastSpoken }
        : incoming.lastSpoken || existing.lastSpoken,
    relationshipHistory: mergedHistory,
    trust: computedEmotions.trust,
    affection: computedEmotions.affection,
    fear: computedEmotions.fear,
    curiosity: computedEmotions.curiosity,
    anger: computedEmotions.anger,
    respect: computedEmotions.respect,
    shame: computedEmotions.shame,
    hope: computedEmotions.hope,
    jealousy: computedEmotions.jealousy,
    prevEmotions: {
      trust: existing.trust ?? 0,
      affection: existing.affection ?? 0,
      fear: existing.fear ?? 0,
      curiosity: existing.curiosity ?? 0,
      anger: existing.anger ?? 0,
      respect: existing.respect ?? 0,
      shame: existing.shame ?? 0,
      hope: existing.hope ?? 0,
      jealousy: existing.jealousy ?? 0
    }
  };
};

function mergeHistory(existing = [], incoming = []) {
  const seen = new Set();
  const combined = [...existing, ...incoming].filter(entry => {
    const id = entry.event + JSON.stringify(entry.impact);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return combined;
}
