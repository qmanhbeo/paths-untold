// src/narrative/narrativeMaster.js
//
// Narrative Master — the orchestrator that selects prompt modules and composes
// them into a compact planner instruction bundle for the downstream scene generator.
//
// V1: fully deterministic / rule-based. No additional LLM calls.

import { PROMPT_MODULES } from './moduleRegistry';
import { createDebugLogger } from '../utils/debugLog';

const debug = createDebugLogger('NarrativeMaster');

// ── Player settings ───────────────────────────────────────────────────────────

/**
 * Player-facing narrative preferences.
 * These come from storyOptions (set during onboarding or defaults).
 *
 * @typedef {{
 *   pacing: 'slow' | 'medium' | 'fast',
 *   emotionalIntensity: number,   // 1–5
 *   mysteryLevel: number,         // 1–5
 *   romanceSoftness: number,      // 1–5
 *   choiceHarshness: number,      // 1–5
 *   introspectionLevel: number,   // 1–5
 *   ambiguityTolerance: number,   // 1–5
 *   convergenceSharpness: number  // 1–5
 * }} NarrativeSettings
 */

const DEFAULT_SETTINGS = {
  pacing: 'medium',
  emotionalIntensity: 3,
  mysteryLevel: 3,
  romanceSoftness: 3,
  choiceHarshness: 3,
  introspectionLevel: 3,
  ambiguityTolerance: 3,
  convergenceSharpness: 3,
};

/** @param {object} playerSettings @returns {NarrativeSettings} */
function normalizeSettings(playerSettings) {
  return { ...DEFAULT_SETTINGS, ...(playerSettings ?? {}) };
}

// ── Phase detection ───────────────────────────────────────────────────────────

/**
 * Map arc/chapter stage + tension to a simple module-routing phase.
 * @param {object} gameMemory
 * @returns {'opening' | 'pressure' | 'convergence' | 'cooldown'}
 */
function getCurrentPhase(gameMemory) {
  const arcPlan = gameMemory.arc?.arcPlan;
  const arcStage = arcPlan
    ? (arcPlan.arcStageSequence?.[arcPlan.currentStageIndex] ?? 'open')
    : 'open';

  const chapterPlan = gameMemory.arc?.chapterPlan;
  const chapterStage = chapterPlan
    ? (chapterPlan.chapterStageSequence?.[chapterPlan.currentStageIndex] ?? 'open')
    : 'open';

  const tension = gameMemory.arc?.tension ?? 3;
  const sceneIndex = gameMemory.sceneIndex ?? 0;

  if (chapterStage === 'cooldown') return 'cooldown';
  if (arcStage === 'open' && sceneIndex < 3) return 'opening';
  if (
    chapterStage === 'resolve' ||
    arcStage === 'peak' ||
    arcStage === 'resolve' ||
    tension >= 7
  ) return 'convergence';
  return 'pressure';
}

// ── Rhythm detection ──────────────────────────────────────────────────────────

const HIGH_TENSION_IDS = new Set([
  'force_tradeoff', 'irreversible_moment', 'convergence_narrowing',
  'stakes_made_concrete', 'pressure_on_relationship', 'tempt_defection', 'narrow_options',
]);

const LOW_TENSION_IDS = new Set([
  'quiet_intimacy_scene', 'introspection_beat', 'open_mystery_hook',
  'plant_warm_constraint', 'cost_lands_quietly', 'earned_intimacy',
]);

/** True if recent modules have been uniformly low-tension and current tension is rising. */
function needsEscalation(gameMemory, recentModuleIds) {
  const recentLow = recentModuleIds.slice(-3).filter(id => LOW_TENSION_IDS.has(id));
  const tension = gameMemory.arc?.tension ?? 3;
  return recentLow.length >= 2 && tension >= 4;
}

/** True if recent modules have been uniformly high-tension — player needs a beat to breathe. */
function needsRelief(recentModuleIds) {
  const recentHigh = recentModuleIds.slice(-3).filter(id => HIGH_TENSION_IDS.has(id));
  return recentHigh.length >= 2;
}

// ── Module scoring ────────────────────────────────────────────────────────────

/**
 * Score one module against player settings.
 * @param {import('./moduleRegistry').PromptModule} module
 * @param {NarrativeSettings} settings
 * @returns {number}
 */
function getSettingsScore(module, settings) {
  let score = 0;

  // Emotional intensity
  if (settings.emotionalIntensity >= 4) {
    if (['tense', 'mournful'].includes(module.emotionalMode)) score += 2;
  } else if (settings.emotionalIntensity <= 2) {
    if (['tender', 'reflective'].includes(module.emotionalMode)) score += 2;
  }

  // Mystery level
  if (settings.mysteryLevel >= 4) {
    if (['withhold', 'destabilize'].includes(module.narrativeFunction)) score += 2;
    if (module.affectedDimensions.includes('mystery')) score += 1;
  } else if (settings.mysteryLevel <= 2) {
    if (module.narrativeFunction === 'reveal') score += 1;
  }

  // Introspection level
  if (settings.introspectionLevel >= 4) {
    if (['mirror', 'echo'].includes(module.narrativeFunction)) score += 2;
    if (module.emotionalMode === 'reflective') score += 1;
  }

  // Choice harshness
  if (settings.choiceHarshness >= 4) {
    if (['force_tradeoff', 'irreversible_moment', 'convergence_narrowing', 'narrow_options', 'tempt_defection'].includes(module.id)) score += 2;
  } else if (settings.choiceHarshness <= 2) {
    if (['quiet_intimacy_scene', 'care_as_constraint', 'earned_intimacy', 'introspection_beat'].includes(module.id)) score += 2;
  }

  // Convergence sharpness
  if (settings.convergenceSharpness >= 4) {
    if (['narrow', 'echo'].includes(module.narrativeFunction)) score += 1;
    if (['memory_echo', 'close_thread', 'convergence_narrowing'].includes(module.id)) score += 1;
  }

  // Ambiguity tolerance
  if (settings.ambiguityTolerance >= 4) {
    if (['withhold', 'mirror'].includes(module.narrativeFunction)) score += 1;
    if (['quiet_wrongness', 'silence_as_information', 'false_relief'].includes(module.id)) score += 1;
  } else if (settings.ambiguityTolerance <= 2) {
    if (module.narrativeFunction === 'reveal') score += 1;
    if (['close_thread', 'cost_lands_quietly', 'trust_test_result'].includes(module.id)) score += 1;
  }

  // Pacing
  if (settings.pacing === 'fast' && module.pace === 'abrupt') score += 1;
  if (settings.pacing === 'slow' && module.pace === 'slow') score += 1;

  return score;
}

// ── Selection ─────────────────────────────────────────────────────────────────

/**
 * Select 2–3 narrative modules for the next scene.
 *
 * @param {object} gameMemory
 * @param {object} playerSettings - raw storyOptions (uses NarrativeSettings fields if present)
 * @param {string[]} recentModuleIds - last N module IDs used (tracks rhythm)
 * @returns {{ modules: import('./moduleRegistry').PromptModule[], selectionReasons: object[], phase: string, tension: number }}
 */
export function selectNarrativeModules(gameMemory, playerSettings, recentModuleIds = []) {
  const phase = getCurrentPhase(gameMemory);
  const tension = gameMemory.arc?.tension ?? 3;
  const activeThreads = gameMemory.arc?.activeThreads ?? [];
  const settings = normalizeSettings(playerSettings);

  // 1. Filter by applicable phase
  let candidates = PROMPT_MODULES.filter(m => m.applicablePhase.includes(phase));

  // 2. Filter by tension range
  candidates = candidates.filter(m => tension >= m.tensionRange[0] && tension <= m.tensionRange[1]);

  // 3. Exclude recently used (last 3)
  const recentSet = new Set(recentModuleIds.slice(-3));
  let filtered = candidates.filter(m => !recentSet.has(m.id));

  // Fallback: if too few candidates after exclusion, relax recent filter
  if (filtered.length < 2) filtered = candidates;

  // Last resort: all modules in tension range regardless of phase
  if (filtered.length === 0) {
    filtered = PROMPT_MODULES.filter(m => tension >= m.tensionRange[0] && tension <= m.tensionRange[1]);
  }

  // Use all modules as absolute last resort
  if (filtered.length === 0) filtered = [...PROMPT_MODULES];

  const escalate = needsEscalation(gameMemory, recentModuleIds);
  const relief = needsRelief(recentModuleIds);

  const recentEmotionalModes = recentModuleIds.slice(-2)
    .map(id => PROMPT_MODULES.find(m => m.id === id)?.emotionalMode)
    .filter(Boolean);

  // 4. Score
  const scored = filtered.map(m => {
    let score = 0;
    const reasons = [];

    // Rhythm pressure
    if (escalate && ['escalate', 'complicate'].includes(m.purpose)) {
      score += 3; reasons.push('escalation needed');
    }
    if (relief && ['resolve', 'introduce'].includes(m.purpose)) {
      score += 3; reasons.push('relief needed');
    }

    // Thread-specific bonuses
    if (m.id === 'memory_echo' && activeThreads.length >= 2) {
      score += 2; reasons.push('active threads to echo');
    }
    if (m.id === 'close_thread' && activeThreads.length >= 1) {
      score += 1; reasons.push('open thread to close');
    }
    if (m.id === 'obligation_surfaces' && activeThreads.some(t => /promise|debt|favor|owe/i.test(t))) {
      score += 2; reasons.push('obligation thread active');
    }
    if (m.id === 'open_mystery_hook' && activeThreads.length < 2) {
      score += 1; reasons.push('few threads — good time to plant');
    }

    // Emotional variety bonus
    if (!recentEmotionalModes.includes(m.emotionalMode)) {
      score += 1; reasons.push('emotional variety');
    }

    // Player settings
    const settingsScore = getSettingsScore(m, settings);
    score += settingsScore;
    if (settingsScore >= 3) reasons.push('strong settings match');
    else if (settingsScore >= 1) reasons.push('settings match');

    return { module: m, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);

  // 5. Pick 2 normally, 3 for high-intensity or convergence
  const count = (settings.emotionalIntensity >= 4 || phase === 'convergence') ? 3 : 2;
  const selected = scored.slice(0, Math.min(count, scored.length));

  return {
    modules: selected.map(s => s.module),
    selectionReasons: selected.map(s => ({
      id: s.module.id,
      score: s.score,
      reasons: s.reasons,
    })),
    phase,
    tension,
  };
}

// ── Planner bundle composer ───────────────────────────────────────────────────

/**
 * @typedef {{
 *   selectedModuleIds: string[],
 *   moduleInstructions: string[],
 *   scenePurpose: string,
 *   emotionalShape: string,
 *   narrativePressure: string,
 *   keyContradiction: string,
 *   choiceDesignGuidance: string,
 *   threadCallbacks: string[],
 *   pacingGuidance: string,
 *   thingsToAvoid: string[],
 *   _debug: object
 * }} PlannerBundle
 */

/**
 * Compose a structured planner bundle from selected modules + current game state.
 *
 * @param {import('./moduleRegistry').PromptModule[]} selectedModules
 * @param {object} gameMemory
 * @param {object} playerSettings
 * @param {object[]} selectionReasons
 * @returns {PlannerBundle}
 */
export function composePlannerBundle(selectedModules, gameMemory, playerSettings, selectionReasons = []) {
  const settings = normalizeSettings(playerSettings);
  const activeThreads = gameMemory.arc?.activeThreads ?? [];
  const tension = gameMemory.arc?.tension ?? 3;
  const chapterPlan = gameMemory.arc?.chapterPlan;
  const phase = getCurrentPhase(gameMemory);

  // Scene purpose: derived from modules' narrative functions
  const purposeTerms = selectedModules.map(m => {
    const fnMap = {
      reveal: 'surface a concealed truth',
      withhold: 'sustain deliberate ambiguity',
      test: 'test commitment or values',
      tempt: 'offer temptation with visible cost',
      mirror: 'reflect a past player action back',
      destabilize: 'undermine established certainty',
      narrow: 'reduce available forward paths',
      echo: 'callback an earlier thread or choice',
    };
    return fnMap[m.narrativeFunction] ?? m.narrativeFunction;
  });
  const chapterConstraint = chapterPlan?.mustResolve ? ` — toward: ${chapterPlan.mustResolve}` : '';
  const scenePurpose = `${purposeTerms.join('; ')}${chapterConstraint}`;

  // Emotional shape: modes + pacing
  const emotionalModes = [...new Set(selectedModules.map(m => m.emotionalMode))];
  const dominantPace = selectedModules[0]?.pace ?? 'medium';
  const emotionalShape = `${emotionalModes.join(' → ')} (${dominantPace} build)`;

  // Narrative pressure
  const narrativePressure =
    tension >= 7 ? 'high — something must commit or break this scene' :
    tension >= 4 ? 'moderate — deepen at least one thread or relationship' :
    'low — establish and introduce without forcing confrontation';

  // Key contradiction: lead instruction from first module
  const keyContradiction = selectedModules[0]?.instruction ?? '';

  // Choice design guidance
  const hasNarrow = selectedModules.some(m => ['narrow', 'test'].includes(m.narrativeFunction));
  const choiceDesignGuidance =
    settings.choiceHarshness >= 4
      ? 'All paths carry cost. No safe option. Make consequences concrete and immediate.'
      : hasNarrow
        ? 'At least one path forecloses something. The choice must matter beyond atmosphere.'
        : 'Choices reflect values or relationships. Emotional consequences should be clear.';

  // Thread callbacks: pick up to 2 active threads
  const threadCallbacks = activeThreads.slice(0, 2).map(t => `echo thread: "${t}"`);

  // Pacing guidance
  const pacingGuidance =
    settings.pacing === 'fast' ? 'Open abruptly on consequence. Skip setup. End on the decision point.' :
    settings.pacing === 'slow' ? 'Deliberate build. Let each beat breathe before the next.' :
    'Quick grounding, meaningful middle, clean decision point.';

  // Things to avoid
  const thingsToAvoid = [];
  if (tension >= 7) thingsToAvoid.push('do not introduce new characters or unexplained mysteries');
  if (activeThreads.length > 3) thingsToAvoid.push('do not open new threads — resolve before adding');
  if (phase === 'convergence') thingsToAvoid.push('do not defer — choices must move things forward');
  if (selectedModules.some(m => m.id === 'false_relief')) {
    thingsToAvoid.push('do not fully resolve underlying tension this scene');
  }

  return {
    selectedModuleIds: selectedModules.map(m => m.id),
    moduleInstructions: selectedModules.map(m => m.instruction),
    scenePurpose,
    emotionalShape,
    narrativePressure,
    keyContradiction,
    choiceDesignGuidance,
    threadCallbacks,
    pacingGuidance,
    thingsToAvoid,
    _debug: {
      phase,
      tension,
      selectionReasons,
      settingsUsed: settings,
    },
  };
}

// ── Compact prompt renderer ───────────────────────────────────────────────────

/**
 * Render a PlannerBundle to a compact string for injection into the scene prompt.
 * Target: ≤ 160 words to keep token overhead minimal.
 *
 * @param {PlannerBundle} bundle
 * @returns {string}
 */
export function renderPlannerPrompt(bundle) {
  const lines = [
    'NARRATIVE MASTER:',
    `Purpose: ${bundle.scenePurpose}`,
    `Shape: ${bundle.emotionalShape}`,
    `Pressure: ${bundle.narrativePressure}`,
    `Choices: ${bundle.choiceDesignGuidance}`,
  ];

  if (bundle.threadCallbacks.length > 0) {
    lines.push(`Callbacks: ${bundle.threadCallbacks.join('; ')}`);
  }

  lines.push(`Pacing: ${bundle.pacingGuidance}`);

  if (bundle.thingsToAvoid.length > 0) {
    lines.push(`Avoid: ${bundle.thingsToAvoid.join('; ')}`);
  }

  lines.push('Instructions:');
  bundle.moduleInstructions.forEach(inst => lines.push(`- ${inst}`));

  return lines.join('\n');
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run the full Narrative Master pipeline for a single scene.
 *
 * Reads current game state, selects modules, composes a planner bundle,
 * and renders a compact prompt string for injection into buildScenePrompt.
 *
 * Falls back gracefully: if gameMemory is empty/null, returns empty prompt.
 *
 * @param {object} gameMemory - current GameMemory
 * @param {object} playerSettings - storyOptions (uses narrative setting fields if present)
 * @param {string[]} recentModuleIds - last N module IDs used (for rhythm tracking)
 * @returns {{ bundle: PlannerBundle, renderedPrompt: string, debugInfo: object }}
 */
export function runNarrativeMaster(gameMemory, playerSettings, recentModuleIds = []) {
  // Graceful fallback for sparse / missing state
  if (!gameMemory || !gameMemory.arc) {
    debug.warn('[NarrativeMaster] sparse state — skipping module selection');
    return { bundle: null, renderedPrompt: '', debugInfo: { skipped: true, reason: 'sparse state' } };
  }

  try {
    const { modules, selectionReasons, phase, tension } =
      selectNarrativeModules(gameMemory, playerSettings, recentModuleIds);

    const bundle = composePlannerBundle(modules, gameMemory, playerSettings, selectionReasons);
    const renderedPrompt = renderPlannerPrompt(bundle);

    const debugInfo = {
      phase,
      tension,
      selectedModules: modules.map(m => m.id),
      selectionReasons,
      bundle,
      renderedPrompt,
    };

    debug.log('[NarrativeMaster] phase:', phase, '| tension:', tension);
    debug.log('[NarrativeMaster] selected:', modules.map(m => m.id));
    debug.log('[NarrativeMaster] reasons:', selectionReasons);
    debug.log('[NarrativeMaster] rendered prompt:\n' + renderedPrompt);

    return { bundle, renderedPrompt, debugInfo };
  } catch (err) {
    debug.error('[NarrativeMaster] selection failed — returning empty prompt', err);
    return { bundle: null, renderedPrompt: '', debugInfo: { skipped: true, reason: err.message } };
  }
}
