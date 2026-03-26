// src/state/migrateMemory.js

/**
 * Bring older saves up to date with the current GameMemory shape.
 * Old saves used: story[], choices[], currentScene
 * New shape uses: prose[], paths[], sceneIndex
 */

export function migrateMemory(raw) {
    const isNew = raw && raw.world && raw.arc;

    // Defaults for new fields
    const world = isNew ? raw.world : {
      clock: { day: 1, time: "day" },
      location: { name: "Unknown Place", tags: [] },
      sceneTags: [],
      objectives: [],
      flags: {}
    };

    const rawArc = isNew ? raw.arc : {};
    const arc = {
      chapter: rawArc.chapter ?? 1,
      beat: rawArc.beat ?? 0,
      tension: rawArc.tension ?? 3,
      coreQuestion: rawArc.coreQuestion ?? '',
      activeThreads: Array.isArray(rawArc.activeThreads) ? rawArc.activeThreads : [],
      arcPlan: rawArc.arcPlan ?? null,
      chapterPlan: rawArc.chapterPlan ?? null,
      // Narrative Master runtime state — initialize safely from old saves
      narrativeMaster: rawArc.narrativeMaster && Array.isArray(rawArc.narrativeMaster.recentModules)
        ? rawArc.narrativeMaster
        : { recentModules: [] }
    };

    // Handle both old field names (story/choices/currentScene) and new (prose/paths/sceneIndex)
    const prose = Array.isArray(raw?.prose) ? raw.prose
      : Array.isArray(raw?.story) ? raw.story
      : [];

    const paths = Array.isArray(raw?.paths) ? raw.paths
      : Array.isArray(raw?.choices) ? raw.choices
      : [];

    const sceneIndex = Number.isFinite(raw?.sceneIndex) ? raw.sceneIndex
      : Number.isFinite(raw?.currentScene) ? raw.currentScene
      : 0;

    return {
      prose,
      paths,
      summary: raw?.summary || [],
      sceneLog: Array.isArray(raw?.sceneLog) ? raw.sceneLog : [],
      storyBlueprint: raw?.storyBlueprint ?? null,
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
      sceneIndex,
      world,
      arc
    };
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  }
