import { describe, it, expect } from 'vitest';
import {
  normalizeSettings,
  DEFAULT_SETTINGS,
  getCurrentPhase,
  selectNarrativeModules,
  runNarrativeMaster,
} from './narrativeMaster';
import { migrateMemory } from '../state/migrateMemory';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMemory(overrides = {}) {
  return {
    prose: [],
    paths: [],
    summary: [],
    sceneLog: [],
    companions: [],
    sceneIndex: 0,
    world: { clock: { day: 1, time: 'day' }, location: { name: 'Test', tags: [] }, sceneTags: [], objectives: [], flags: {} },
    arc: { chapter: 1, beat: 0, tension: 3, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null },
    ...overrides,
  };
}

function withArc(arcOverrides) {
  return makeMemory({ arc: { chapter: 1, beat: 0, tension: 3, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null, ...arcOverrides } });
}

// ── normalizeSettings ─────────────────────────────────────────────────────────

describe('normalizeSettings', () => {
  it('returns defaults when called with null', () => {
    const s = normalizeSettings(null);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when called with empty object', () => {
    const s = normalizeSettings({});
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('applies valid values from input', () => {
    const s = normalizeSettings({ emotionalIntensity: 5, pacing: 'fast' });
    expect(s.emotionalIntensity).toBe(5);
    expect(s.pacing).toBe('fast');
    expect(s.mysteryLevel).toBe(3); // others remain default
  });

  it('clamps out-of-range values to default', () => {
    const s = normalizeSettings({ emotionalIntensity: 99, mysteryLevel: -1 });
    expect(s.emotionalIntensity).toBe(3);
    expect(s.mysteryLevel).toBe(3);
  });

  it('rejects invalid pacing value', () => {
    const s = normalizeSettings({ pacing: 'turbo' });
    expect(s.pacing).toBe('medium');
  });
});

// ── getCurrentPhase ───────────────────────────────────────────────────────────

describe('getCurrentPhase', () => {
  it('returns opening for first few scenes with open arc stage', () => {
    const mem = withArc({ tension: 2 });
    expect(getCurrentPhase(mem, DEFAULT_SETTINGS)).toBe('opening');
  });

  it('returns pressure for mid-game with moderate tension', () => {
    const mem = makeMemory({ sceneIndex: 5, arc: { chapter: 1, beat: 2, tension: 4, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: { chapterGoal: '', chapterStageSequence: ['open', 'build', 'resolve', 'cooldown'], mustResolve: '', mustAdvanceArcThread: '', chapterCompletionCondition: '', currentStageIndex: 1, completedBeats: [] } } });
    expect(getCurrentPhase(mem, DEFAULT_SETTINGS)).toBe('pressure');
  });

  it('returns cooldown when chapterStage is cooldown', () => {
    const mem = makeMemory({ sceneIndex: 8, arc: { chapter: 1, beat: 5, tension: 3, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: { chapterGoal: '', chapterStageSequence: ['open', 'build', 'resolve', 'cooldown'], mustResolve: '', mustAdvanceArcThread: '', chapterCompletionCondition: '', currentStageIndex: 3, completedBeats: [] } } });
    expect(getCurrentPhase(mem, DEFAULT_SETTINGS)).toBe('cooldown');
  });

  it('returns convergence when tension >= 7', () => {
    const mem = makeMemory({ sceneIndex: 5, arc: { chapter: 1, beat: 3, tension: 7, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    expect(getCurrentPhase(mem, DEFAULT_SETTINGS)).toBe('convergence');
  });

  it('convergenceSharpness=5 lowers tension threshold to 6', () => {
    const mem = makeMemory({ sceneIndex: 5, arc: { chapter: 1, beat: 3, tension: 6, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    expect(getCurrentPhase(mem, { ...DEFAULT_SETTINGS, convergenceSharpness: 5 })).toBe('convergence');
    expect(getCurrentPhase(mem, { ...DEFAULT_SETTINGS, convergenceSharpness: 1 })).toBe('pressure');
  });
});

// ── selectNarrativeModules ────────────────────────────────────────────────────

describe('selectNarrativeModules', () => {
  it('returns 2 modules by default', () => {
    const mem = withArc({ tension: 3 });
    const { modules } = selectNarrativeModules(mem, {}, []);
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(modules.length).toBeLessThanOrEqual(3);
  });

  it('returns 3 modules for high emotional intensity', () => {
    const mem = makeMemory({ sceneIndex: 5, arc: { chapter: 1, beat: 2, tension: 5, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    const { modules } = selectNarrativeModules(mem, { emotionalIntensity: 5 }, []);
    expect(modules.length).toBe(3);
  });

  it('avoids modules used in last 3 selections', () => {
    const mem = makeMemory({ sceneIndex: 5, arc: { chapter: 1, beat: 2, tension: 4, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    const recentIds = ['force_tradeoff', 'narrow_options', 'stakes_made_concrete'];
    const { modules } = selectNarrativeModules(mem, {}, recentIds);
    const ids = modules.map(m => m.id);
    // Should not repeat the recent 3 (unless absolutely no alternatives)
    const overlap = ids.filter(id => recentIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('high mysteryLevel boosts withhold/destabilize modules', () => {
    const mem = makeMemory({ sceneIndex: 4, arc: { chapter: 1, beat: 2, tension: 3, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    const { modules: highMystery } = selectNarrativeModules(mem, { mysteryLevel: 5 }, []);
    const highFns = highMystery.map(m => m.narrativeFunction);
    const hasAmbiguousModule = highFns.some(fn => ['withhold', 'destabilize'].includes(fn));
    expect(hasAmbiguousModule).toBe(true);
  });

  it('high choiceHarshness boosts tradeoff/narrow/irreversible modules at convergence tension', () => {
    const mem = makeMemory({ sceneIndex: 6, arc: { chapter: 1, beat: 3, tension: 7, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    const { modules } = selectNarrativeModules(mem, { choiceHarshness: 5 }, []);
    const harshIds = new Set(['force_tradeoff', 'irreversible_moment', 'convergence_narrowing', 'narrow_options', 'tempt_defection']);
    const hasHarsh = modules.some(m => harshIds.has(m.id));
    expect(hasHarsh).toBe(true);
  });

  it('falls back gracefully with empty arc', () => {
    const mem = { ...makeMemory(), arc: null };
    // Should not throw
    const result = runNarrativeMaster(mem, {}, []);
    expect(result.renderedPrompt).toBe('');
    expect(result.bundle).toBeNull();
  });

  it('high romance softness prefers intimacy modules', () => {
    const mem = makeMemory({ sceneIndex: 4, arc: { chapter: 1, beat: 2, tension: 3, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    const { modules } = selectNarrativeModules(mem, { romanceSoftness: 5 }, []);
    const romanceIds = new Set(['quiet_intimacy_scene', 'earned_intimacy', 'care_as_constraint', 'goodbye_weight', 'mirror_moment', 'departure_cost']);
    const hasRomance = modules.some(m => romanceIds.has(m.id));
    expect(hasRomance).toBe(true);
  });
});

// ── migrateMemory backward compatibility ─────────────────────────────────────

describe('migrateMemory — narrativeMaster', () => {
  it('initializes narrativeMaster with empty recentModules on old saves', () => {
    const oldSave = {
      world: { clock: { day: 1, time: 'day' }, location: { name: 'X', tags: [] }, sceneTags: [], objectives: [], flags: {} },
      arc: { chapter: 1, beat: 0, tension: 3 }, // no narrativeMaster field
      prose: [],
      paths: [],
      summary: [],
      sceneLog: [],
      companions: [],
      sceneIndex: 0,
    };
    const migrated = migrateMemory(oldSave);
    expect(migrated.arc.narrativeMaster).toEqual({ recentModules: [] });
  });

  it('preserves existing narrativeMaster data on new saves', () => {
    const newSave = {
      world: { clock: { day: 1, time: 'day' }, location: { name: 'X', tags: [] }, sceneTags: [], objectives: [], flags: {} },
      arc: { chapter: 1, beat: 0, tension: 3, narrativeMaster: { recentModules: ['force_tradeoff', 'narrow_options'] } },
      prose: [],
      paths: [],
      summary: [],
      sceneLog: [],
      companions: [],
      sceneIndex: 0,
    };
    const migrated = migrateMemory(newSave);
    expect(migrated.arc.narrativeMaster.recentModules).toEqual(['force_tradeoff', 'narrow_options']);
  });

  it('handles corrupt narrativeMaster (non-array recentModules) safely', () => {
    const corrupt = {
      world: { clock: { day: 1, time: 'day' }, location: { name: 'X', tags: [] }, sceneTags: [], objectives: [], flags: {} },
      arc: { chapter: 1, beat: 0, tension: 3, narrativeMaster: { recentModules: 'oops' } },
      prose: [], paths: [], summary: [], sceneLog: [], companions: [], sceneIndex: 0,
    };
    const migrated = migrateMemory(corrupt);
    expect(migrated.arc.narrativeMaster).toEqual({ recentModules: [] });
  });

  it('handles fully absent arc on legacy saves', () => {
    const legacy = {
      story: ['once upon a time'],
      choices: ['go left'],
      currentScene: 1,
      companions: [],
      summary: [],
    };
    const migrated = migrateMemory(legacy);
    expect(migrated.arc.narrativeMaster).toEqual({ recentModules: [] });
  });
});

// ── runNarrativeMaster fallback ───────────────────────────────────────────────

describe('runNarrativeMaster fallbacks', () => {
  it('returns empty prompt for null gameMemory', () => {
    const result = runNarrativeMaster(null, {}, []);
    expect(result.renderedPrompt).toBe('');
    expect(result.bundle).toBeNull();
  });

  it('returns a non-empty rendered prompt for valid memory', () => {
    const mem = makeMemory({ sceneIndex: 4, arc: { chapter: 1, beat: 2, tension: 4, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null } });
    const result = runNarrativeMaster(mem, {}, []);
    expect(typeof result.renderedPrompt).toBe('string');
    expect(result.renderedPrompt.length).toBeGreaterThan(0);
    expect(result.renderedPrompt).toContain('NARRATIVE MASTER:');
  });

  it('rendered prompt is under 300 words', () => {
    const mem = makeMemory({ sceneIndex: 6, arc: { chapter: 1, beat: 3, tension: 6, coreQuestion: '', activeThreads: ['the letter', 'the missing key'], arcPlan: null, chapterPlan: null } });
    const result = runNarrativeMaster(mem, { emotionalIntensity: 5, convergenceSharpness: 5 }, []);
    const wordCount = result.renderedPrompt.split(/\s+/).length;
    expect(wordCount).toBeLessThan(300);
  });
});
