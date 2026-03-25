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
 * @typedef {{
 *   prose: string[],
 *   paths: string[],
 *   summary: string[],
 *   companions: Companion[],
 *   sceneIndex: number,
 *   world: WorldState,
 *   arc: {
 *     chapter: number,
 *     beat: number,
 *     tension: number,
 *     coreQuestion: string,
 *     activeThreads: string[]
 *   }
 * }} GameMemory
 */

export {};
