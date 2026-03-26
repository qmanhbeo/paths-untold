// src/narrative/narrativeMaster.js
//
// Narrative Master — selects prompt modules and composes them into a compact
// planner instruction bundle for the downstream scene generator.
//
// V1: fully deterministic / rule-based. No additional LLM calls.

import { PROMPT_MODULES } from './moduleRegistry';
import { createDebugLogger } from '../utils/debugLog';

const debug = createDebugLogger('NarrativeMaster');

// ── Player settings ───────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   pacing: 'slow' | 'medium' | 'fast',
 *   emotionalIntensity: number,   // 1–5
 *   mysteryLevel: number,         // 1–5
 *   romanceSoftness: number,      // 1–5  (1=minimal romance, 5=romance-forward)
 *   choiceHarshness: number,      // 1–5
 *   introspectionLevel: number,   // 1–5
 *   ambiguityTolerance: number,   // 1–5
 *   convergenceSharpness: number  // 1–5
 * }} NarrativeSettings
 */

export const DEFAULT_SETTINGS = {
  pacing: 'medium',
  emotionalIntensity: 3,
  mysteryLevel: 3,
  romanceSoftness: 3,
  choiceHarshness: 3,
  introspectionLevel: 3,
  ambiguityTolerance: 3,
  convergenceSharpness: 3,
};

/** @param {object|null} playerSettings @returns {NarrativeSettings} */
export function normalizeSettings(playerSettings) {
  if (!playerSettings || typeof playerSettings !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    pacing: ['slow', 'medium', 'fast'].includes(playerSettings.pacing) ? playerSettings.pacing : DEFAULT_SETTINGS.pacing,
    emotionalIntensity: clampSetting(playerSettings.emotionalIntensity, 3),
    mysteryLevel: clampSetting(playerSettings.mysteryLevel, 3),
    romanceSoftness: clampSetting(playerSettings.romanceSoftness, 3),
    choiceHarshness: clampSetting(playerSettings.choiceHarshness, 3),
    introspectionLevel: clampSetting(playerSettings.introspectionLevel, 3),
    ambiguityTolerance: clampSetting(playerSettings.ambiguityTolerance, 3),
    convergenceSharpness: clampSetting(playerSettings.convergenceSharpness, 3),
  };
}

function clampSetting(val, fallback) {
  const n = Number(val);
  return (Number.isFinite(n) && n >= 1 && n <= 5) ? n : fallback;
}

// ── Phase detection ───────────────────────────────────────────────────────────

/**
 * Map arc/chapter stage + tension + settings to a module-routing phase.
 * Takes settings so convergenceSharpness can pull convergence threshold down.
 *
 * @param {object} gameMemory
 * @param {NarrativeSettings} settings
 * @returns {'opening' | 'pressure' | 'convergence' | 'cooldown'}
 */
export function getCurrentPhase(gameMemory, settings) {
  const s = settings ?? DEFAULT_SETTINGS;
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
  const beat = gameMemory.arc?.beat ?? 0;
  const completedBeats = Array.isArray(chapterPlan?.completedBeats) ? chapterPlan.completedBeats.length : 0;

  if (chapterStage === 'cooldown') return 'cooldown';

  // Opening: early arc + few scenes played
  if (arcStage === 'open' && sceneIndex < 3) return 'opening';

  // Convergence threshold: sharp setting (5) lowers it to tension 6; gradual (1) raises to 8
  const tensionThreshold = s.convergenceSharpness >= 4 ? 6 : s.convergenceSharpness <= 2 ? 8 : 7;

  // mustResolve pressure: if chapter has a specific conflict to close and tension is building
  const mustResolvePressure = !!(chapterPlan?.mustResolve && tension >= 5 && completedBeats >= 1);

  // Many completed beats in current chapter → lean toward convergence
  const beatsPressure = completedBeats >= 3 && tension >= 5;

  if (
    chapterStage === 'resolve' ||
    arcStage === 'peak' ||
    arcStage === 'resolve' ||
    tension >= tensionThreshold ||
    mustResolvePressure ||
    beatsPressure
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

/** True if recent modules uniformly low-tension and tension is rising — push forward. */
function needsEscalation(gameMemory, recentModuleIds) {
  const recentLow = recentModuleIds.slice(-3).filter(id => LOW_TENSION_IDS.has(id));
  const tension = gameMemory.arc?.tension ?? 3;
  return recentLow.length >= 2 && tension >= 4;
}

/** True if recent modules uniformly high-tension — player needs a beat to breathe. */
function needsRelief(recentModuleIds) {
  const recentHigh = recentModuleIds.slice(-3).filter(id => HIGH_TENSION_IDS.has(id));
  return recentHigh.length >= 2;
}

// ── Module scoring ────────────────────────────────────────────────────────────

/**
 * Score a module against player settings.
 * Differentials: +3 for strong match, +2 for moderate, +1 for soft.
 * Low settings penalize matching ids by not rewarding them (no explicit penalty needed).
 *
 * @param {import('./moduleRegistry').PromptModule} module
 * @param {NarrativeSettings} settings
 * @returns {number}
 */
function getSettingsScore(module, settings) {
  let score = 0;

  // ── Emotional intensity ──
  if (settings.emotionalIntensity >= 4) {
    if (['tense', 'mournful'].includes(module.emotionalMode)) score += 3;
    if (module.affectedDimensions.includes('inevitability')) score += 1;
  } else if (settings.emotionalIntensity <= 2) {
    if (['tender', 'reflective'].includes(module.emotionalMode)) score += 3;
    if (['quiet_intimacy_scene', 'introspection_beat', 'cost_lands_quietly', 'earned_intimacy'].includes(module.id)) score += 1;
  }

  // ── Mystery level ──
  if (settings.mysteryLevel >= 4) {
    if (['withhold', 'destabilize'].includes(module.narrativeFunction)) score += 3;
    if (module.affectedDimensions.includes('mystery')) score += 2;
    if (['open_mystery_hook', 'quiet_wrongness', 'silence_as_information', 'false_relief', 'complicate_trust'].includes(module.id)) score += 1;
  } else if (settings.mysteryLevel <= 2) {
    if (module.narrativeFunction === 'reveal') score += 2;
    if (['close_thread', 'cost_lands_quietly', 'trust_test_result', 'reveal_hidden_cost'].includes(module.id)) score += 1;
  }

  // ── Romance softness (1=minimal, 5=romance-forward) ──
  if (settings.romanceSoftness >= 4) {
    // Romance-forward: prefer intimacy and gentle care scenes
    if (['quiet_intimacy_scene', 'earned_intimacy', 'care_as_constraint'].includes(module.id)) score += 3;
    if (module.affectedDimensions.includes('intimacy')) score += 2;
    if (['goodbye_weight', 'mirror_moment', 'departure_cost'].includes(module.id)) score += 1;
  } else if (settings.romanceSoftness <= 2) {
    // Romance minimal: steer away from intimacy-heavy scenes
    if (module.affectedDimensions.includes('intimacy') && !module.affectedDimensions.includes('trust')) {
      // slight de-prioritization — just don't boost these
    }
    // Prefer agency / plot-driven modules instead
    if (['force_tradeoff', 'stakes_made_concrete', 'narrow_options', 'tempt_defection'].includes(module.id)) score += 2;
  }

  // ── Choice harshness ──
  if (settings.choiceHarshness >= 4) {
    if (['force_tradeoff', 'irreversible_moment', 'convergence_narrowing', 'narrow_options', 'tempt_defection'].includes(module.id)) score += 3;
    if (module.narrativeFunction === 'test' && ['tense'].includes(module.emotionalMode)) score += 1;
  } else if (settings.choiceHarshness <= 2) {
    if (['quiet_intimacy_scene', 'care_as_constraint', 'earned_intimacy', 'introspection_beat', 'seed_obligation'].includes(module.id)) score += 3;
    if (module.pace === 'slow') score += 1;
  }

  // ── Introspection level ──
  if (settings.introspectionLevel >= 4) {
    if (['mirror', 'echo'].includes(module.narrativeFunction)) score += 3;
    if (module.emotionalMode === 'reflective') score += 2;
    if (['introspection_beat', 'mirror_moment', 'memory_echo', 'silence_as_information'].includes(module.id)) score += 1;
  } else if (settings.introspectionLevel <= 2) {
    if (module.pace === 'abrupt' || module.purpose === 'escalate') score += 1;
  }

  // ── Convergence sharpness ──
  if (settings.convergenceSharpness >= 4) {
    if (['narrow', 'echo'].includes(module.narrativeFunction)) score += 2;
    if (['memory_echo', 'close_thread', 'convergence_narrowing', 'obligation_surfaces', 'reveal_hidden_cost'].includes(module.id)) score += 2;
  } else if (settings.convergenceSharpness <= 2) {
    if (['introduce', 'complicate'].includes(module.purpose) && module.pace === 'slow') score += 1;
  }

  // ── Ambiguity tolerance ──
  if (settings.ambiguityTolerance >= 4) {
    if (['withhold', 'mirror'].includes(module.narrativeFunction)) score += 2;
    if (['quiet_wrongness', 'silence_as_information', 'false_relief', 'introduce_unreliable_ally'].includes(module.id)) score += 2;
  } else if (settings.ambiguityTolerance <= 2) {
    if (module.narrativeFunction === 'reveal') score += 2;
    if (['close_thread', 'cost_lands_quietly', 'trust_test_result', 'stakes_made_concrete'].includes(module.id)) score += 2;
  }

  // ── Pacing ──
  if (settings.pacing === 'fast') {
    if (module.pace === 'abrupt') score += 2;
  } else if (settings.pacing === 'slow') {
    if (module.pace === 'slow') score += 2;
  } else {
    if (module.pace === 'medium') score += 1;
  }

  return score;
}

// ── Selection ─────────────────────────────────────────────────────────────────

/**
 * Select 2–3 narrative modules for the next scene.
 *
 * @param {object} gameMemory
 * @param {object} playerSettings - raw storyOptions
 * @param {string[]} recentModuleIds - recent usage history
 * @returns {{ modules: import('./moduleRegistry').PromptModule[], selectionReasons: object[], phase: string, tension: number }}
 */
export function selectNarrativeModules(gameMemory, playerSettings, recentModuleIds = []) {
  const settings = normalizeSettings(playerSettings);
  const phase = getCurrentPhase(gameMemory, settings);
  const tension = gameMemory.arc?.tension ?? 3;
  const activeThreads = gameMemory.arc?.activeThreads ?? [];

  // 1. Filter by applicable phase
  let candidates = PROMPT_MODULES.filter(m => m.applicablePhase.includes(phase));

  // 2. Filter by tension range
  candidates = candidates.filter(m => tension >= m.tensionRange[0] && tension <= m.tensionRange[1]);

  // 3. Exclude recently used (last 3)
  const recentSet = new Set(recentModuleIds.slice(-3));
  let filtered = candidates.filter(m => !recentSet.has(m.id));

  // Relax recent-exclusion if too few candidates
  if (filtered.length < 2) filtered = candidates;

  // Fallback: all modules in tension range ignoring phase
  if (filtered.length === 0) {
    filtered = PROMPT_MODULES.filter(m => tension >= m.tensionRange[0] && tension <= m.tensionRange[1]);
  }
  // Absolute last resort
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

    // Rhythm pressure (biggest single driver, +3)
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
      score += 3; reasons.push('obligation thread active');
    }
    if (m.id === 'open_mystery_hook' && activeThreads.length < 2) {
      score += 1; reasons.push('few threads — good time to plant');
    }

    // Emotional variety (+1 for difference from recent)
    if (!recentEmotionalModes.includes(m.emotionalMode)) {
      score += 1; reasons.push('emotional variety');
    }

    // Player settings score
    const settingsScore = getSettingsScore(m, settings);
    score += settingsScore;
    if (settingsScore >= 4) reasons.push('strong settings match');
    else if (settingsScore >= 2) reasons.push('settings match');

    return { module: m, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);

  // 5. Select 2 normally; 3 for high-intensity or convergence
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
  const phase = getCurrentPhase(gameMemory, settings);

  // Scene purpose: derived from modules' narrative functions
  const fnLabels = {
    reveal: 'surface a concealed truth',
    withhold: 'sustain deliberate ambiguity',
    test: 'test commitment or values',
    tempt: 'offer temptation with visible cost',
    mirror: 'reflect a past player action back',
    destabilize: 'undermine established certainty',
    narrow: 'reduce available forward paths',
    echo: 'callback an earlier thread or choice',
  };
  const purposeTerms = selectedModules.map(m => fnLabels[m.narrativeFunction] ?? m.narrativeFunction);
  const chapterConstraint = chapterPlan?.mustResolve ? ` — toward: ${chapterPlan.mustResolve}` : '';
  const scenePurpose = `${purposeTerms.join('; ')}${chapterConstraint}`;

  // Emotional shape: modes + pacing
  const emotionalModes = [...new Set(selectedModules.map(m => m.emotionalMode))];
  const dominantPace = selectedModules[0]?.pace ?? 'medium';
  const emotionalShape = `${emotionalModes.join(' → ')} (${dominantPace} build)`;

  // Narrative pressure description
  const narrativePressure =
    tension >= 7 ? 'high — something must commit or break this scene' :
    tension >= 4 ? 'moderate — deepen at least one thread or relationship' :
    'low — establish and introduce without forcing confrontation';

  // Key contradiction: lead instruction from first module
  const keyContradiction = selectedModules[0]?.instruction ?? '';

  // Choice design guidance: informed by harshness setting + module functions
  const hasNarrow = selectedModules.some(m => ['narrow', 'test'].includes(m.narrativeFunction));
  const choiceDesignGuidance =
    settings.choiceHarshness >= 4
      ? 'All paths carry cost. No safe option. Make consequences concrete and immediate.'
      : hasNarrow
        ? 'At least one path forecloses something. The choice must matter beyond atmosphere.'
        : 'Choices reflect values or relationships. Emotional consequences should be legible.';

  // Thread callbacks: name up to 2 active threads for the LLM to echo
  const threadCallbacks = activeThreads.slice(0, 2).map(t => `echo thread: "${t}"`);

  // Pacing guidance from settings
  const pacingGuidance =
    settings.pacing === 'fast' ? 'Open abruptly on consequence. Skip setup. End on the decision point.' :
    settings.pacing === 'slow' ? 'Deliberate build. Let each beat breathe before the next.' :
    'Quick grounding, meaningful middle, clean decision point.';

  // Things to avoid
  const thingsToAvoid = [];
  if (tension >= 7) thingsToAvoid.push('do not introduce new characters or mysteries');
  if (activeThreads.length > 3) thingsToAvoid.push('do not open new threads — resolve first');
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
 * Target: ≤ 160 words to keep token overhead low.
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
 * Falls back gracefully: if gameMemory is empty/null, returns empty prompt
 * so existing scene generation behaves exactly as before.
 *
 * @param {object} gameMemory - current GameMemory
 * @param {object} playerSettings - storyOptions (narrative setting fields extracted)
 * @param {string[]} recentModuleIds - recent module usage history
 * @returns {{ bundle: PlannerBundle|null, renderedPrompt: string, debugInfo: object }}
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
    return { bundle: null, renderedPrompt: '', debugInfo: { skipped: true, reason: err?.message ?? String(err) } };
  }
}
