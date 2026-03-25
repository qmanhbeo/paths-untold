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

export {};
