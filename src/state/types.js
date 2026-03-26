// src/state/types.js

/**
 * @typedef {"dawn"|"day"|"dusk"|"night"} Daytime
 */

/**
 * @typedef {{ id: string, text: string, status: "active"|"done"|"failed" }} Objective
 */

/**
 * @typedef {{
 *   day: number,
 *   time: Daytime
 * }} Clock
 */

/**
 * @typedef {{
 *   name: string,
 *   tags: string[]
 * }} Location
 */

/**
 * @typedef {{
 *   clock: Clock,
 *   location: Location,
 *   sceneTags: string[],
 *   objectives: Objective[],
 *   flags: Record<string, boolean>
 * }} WorldState
 */

/**
 * @typedef {{
 *   event: string,
 *   impact: number,
 *   scene: number
 * }} RelEvent
 */

/**
 * @typedef {{
 *   trust: number, affection: number, fear: number, curiosity: number, anger: number
 * }} Scores
 */

/**
 * @typedef {"active"|"phased_out"|"rejoined"|"gone"} CompanionStatus
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   role: string,
 *   personality: string,
 *   knownFacts: string[],
 *   lastSpoken?: string,
 *   relationshipHistory: RelEvent[],
 *   scores: Scores,
 *   status: CompanionStatus,
 *   lastUpdatedScene: number
 * }} Companion
 */

/**
 * @typedef {"quiet"|"unease"|"pressure"|"breaking_point"|"catastrophe"} TensionMode
 */

/** @typedef {"open"|"build"|"peak"|"resolve"} ArcStage */
/** @typedef {"open"|"build"|"resolve"|"cooldown"} ChapterStage */

/**
 * Macro plan — spans multiple chapters, generated once at story start.
 * @typedef {{
 *   arcGoal: string,
 *   arcTheme: string,
 *   arcQuestion: string,
 *   arcStageSequence: ArcStage[],
 *   arcResolutionCondition: string,
 *   currentStageIndex: number
 * }} ArcPlan
 */

/**
 * Micro plan — one chapter inside the arc, generated per chapter.
 * @typedef {{
 *   chapterGoal: string,
 *   chapterStageSequence: ChapterStage[],
 *   mustResolve: string,
 *   mustAdvanceArcThread: string,
 *   chapterCompletionCondition: string,
 *   currentStageIndex: number,
 *   completedBeats: string[]
 * }} ChapterPlan
 */

/**
 * @typedef {{
 *   sceneIndex: number,
 *   playerChoice: string,
 *   event: string,
 *   stateChange: string,
 *   reveals: string[],
 *   resolvedThreads: string[]
 * }} SceneRecord
 */

/**
 * @typedef {{
 *   prose: string[],
 *   paths: string[],
 *   summary: string[],
 *   sceneLog: SceneRecord[],
 *   companions: Companion[],
 *   sceneIndex: number,
 *   world: WorldState,
 *   arc: {
 *     chapter: number,
 *     beat: number,
 *     tension: number,
 *     coreQuestion: string,
 *     activeThreads: string[],
 *     arcPlan: ArcPlan|null,
 *     chapterPlan: ChapterPlan|null
 *   }
 * }} GameMemory
 */

// ── Narrative Master types ─────────────────────────────────────────────────────

/**
 * Player-facing narrative preferences used by the Narrative Master.
 * @typedef {{
 *   pacing: 'slow' | 'medium' | 'fast',
 *   emotionalIntensity: number,
 *   mysteryLevel: number,
 *   romanceSoftness: number,
 *   choiceHarshness: number,
 *   introspectionLevel: number,
 *   ambiguityTolerance: number,
 *   convergenceSharpness: number
 * }} NarrativeSettings
 */

/**
 * One reusable narrative operation in the prompt module library.
 * @typedef {{
 *   id: string,
 *   instruction: string,
 *   purpose: 'introduce' | 'complicate' | 'escalate' | 'converge' | 'resolve',
 *   emotionalMode: 'tender' | 'eerie' | 'tense' | 'playful' | 'mournful' | 'reflective',
 *   narrativeFunction: 'reveal' | 'withhold' | 'test' | 'tempt' | 'mirror' | 'destabilize' | 'narrow' | 'echo',
 *   pace: 'slow' | 'medium' | 'abrupt',
 *   applicablePhase: Array<'opening' | 'pressure' | 'convergence' | 'cooldown'>,
 *   tensionRange: [number, number],
 *   affectedDimensions: string[]
 * }} PromptModule
 */

/**
 * Structured bundle produced by the Narrative Master for one scene.
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
 * Narrative Master runtime state — stored transiently (not in GameMemory for V1).
 * @typedef {{
 *   recentModules: string[]
 * }} NarrativeMasterState
 */

export {};
