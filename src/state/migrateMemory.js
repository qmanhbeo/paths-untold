// src/state/migrateMemory.js

/**
 * Bring older saves (summary/choices/story/companions/currentScene) up to date.
 * Returns a fully shaped GameMemory.
 * Old shape is documented in game-logic.md. 
 */

export function migrateMemory(raw) {
    const isNew = raw && raw.world && raw.arc;
    if (isNew) return raw;
  
    // Defaults for new fields
    const world = {
      clock: { day: 1, time: "day" },
      location: { name: "Unknown Place", tags: [] },
      sceneTags: [],
      objectives: [],
      flags: {}
    };
  
    const arc = { chapter: 1, beat: 0, tension: 3 };
  
    return {
      story: raw?.story || [],
      choices: raw?.choices || [],
      summary: raw?.summary || [],
      companions: (raw?.companions || []).map(c => ({
        id: c.id || slug(c.name || "npc"),
        name: c.name || "Unknown",
        role: c.role || "",
        personality: c.personality || "",
        knownFacts: c.knownFacts || [],
        lastSpoken: c.lastSpoken || "",
        relationshipHistory: (c.relationshipHistory || []).map(e => ({
          event: e.event, impact: e.impact, scene: e.scene ?? 0
        })),
        scores: c.scores || { trust: 0, affection: 0, fear: 0, curiosity: 0, anger: 0 },
        status: c.status || "active",
        lastUpdatedScene: Number.isFinite(c.lastUpdatedScene) ? c.lastUpdatedScene : 0
      })),
      currentScene: Number.isFinite(raw?.currentScene) ? raw.currentScene : 0,
      world,
      arc
    };
  }
  
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  }
  