// utils/emotionCalculator.js

/**
 * Converts a character's relationship history into derived emotional states.
 * Each emotion is calculated by summing the impact of relevant fields.
 */

export const getComputedEmotions = (companion) => {
    const base = {
      trust: 0,
      affection: 0,
      fear: 0,
      curiosity: 0,
      anger: 0,
      respect: 0,
      shame: 0,
      hope: 0,
      jealousy: 0
    };
  
    if (!companion.relationshipHistory || !Array.isArray(companion.relationshipHistory)) {
      return base;
    }
  
    for (const { impact } of companion.relationshipHistory) {
      if (impact && typeof impact === 'object') {
        for (const key of Object.keys(impact)) {
          if (base.hasOwnProperty(key)) {
            base[key] += impact[key];
          }
        }
      }
    }
  
    // Clamp values to 0–100 range
    for (const key of Object.keys(base)) {
      base[key] = Math.max(0, Math.min(100, base[key]));
    }
  
    return base;
  };
  