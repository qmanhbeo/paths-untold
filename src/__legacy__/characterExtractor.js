// __legacy__/characterExtractor.js

import { generateStory } from '../utils/AI-chat';
import { getComputedEmotions } from '../utils/emotionCalculator';

export const extractCharacters = async (storyText, existingCharacters = []) => {
  const contextString = existingCharacters.length > 0
    ? `The following characters are already known in the story:
${existingCharacters.map(c => `- ${c.name}: ${c.personality}, role: ${c.role || 'unknown'}, known facts: ${c.knownFacts?.join('; ') || 'none'}, last spoken: ${c.lastSpoken?.line || 'N/A'}, relationshipHistory: ${JSON.stringify(c.relationshipHistory || [])}`).join('\n')}

Use this context to avoid duplication or renaming.`
    : '';

  const prompt = `
You are a character extractor for an interactive story.
From the story below, extract all named characters that have appeared so far (except the main character, referred to as "you").

For each character, return:
- name
- a brief personality summary
- role or how they appear in the story
- known facts about the player or world they may have learned
- the last thing they said, formatted as: { "line": "..." }
- relationshipHistory (only new events and their specific emotional impact from THIS scene)
Here are emotions TOWARDS PLAYER you can choose from: trust, affection, fear, curiosity, anger, respect, shame, hope, jealousy, disappointment, concern

⚠️ ONLY return a valid JSON array like this:
[
  {
    "name": "Lyra",
    "personality": "Curious and loyal",
    "role": "Trusted crewmate",
    "knownFacts": ["player has seen the flower", "station reacts to emotion"],
    "lastSpoken": { "line": "You really believe it can change you?" },
    "relationshipHistory": [
      { "event": "You shared secret", "impact": { "trust": 15, "affection": 10 } },
      { "event": "You ignored her", "impact": { "hope": -10, "anger": 20, "trust": -10 } }
    ]
  }
]

❌ DO NOT explain or add anything else. JUST return the JSON array.

${contextString}

STORY:
${storyText}
`;

  return new Promise((resolve) => {
    generateStory(prompt, (response) => {
      console.log('[CHARACTER RAW RESPONSE]', response);
      try {
        const start = response.indexOf('[');
        const end = response.lastIndexOf(']') + 1;
        if (start === -1 || end === -1) throw new Error("No JSON array found");
        const jsonString = response.substring(start, end);
        const parsed = JSON.parse(jsonString);

        parsed.forEach(c => {
          if (typeof c.lastSpoken === 'string') {
            c.lastSpoken = { line: c.lastSpoken };
          }
        });

        resolve(parsed);
      } catch (e) {
        console.error("Failed to extract characters:", e);
        console.warn("Raw character response was:", response);
        resolve([]);
      }
    });
  });
};

export const updateCharacterTraits = (existing, incoming) => {
  const mergedHistory = mergeHistory(existing.relationshipHistory, incoming.relationshipHistory);
  const computedEmotions = getComputedEmotions({ relationshipHistory: mergedHistory });

  return {
    ...existing,
    personality: incoming.personality || existing.personality,
    role: incoming.role || existing.role,
    knownFacts: Array.from(new Set([...(existing.knownFacts || []), ...(incoming.knownFacts || [])])),
    lastSpoken: typeof incoming.lastSpoken === 'string' ? { line: incoming.lastSpoken } : incoming.lastSpoken || existing.lastSpoken,
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
