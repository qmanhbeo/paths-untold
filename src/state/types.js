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

/** @typedef {"open"|"build"|"resolve"|"cooldown"} WaveRole */

/**
 * Target narrative values for a blueprint node.
 * @typedef {{
 *   tension: number,
 *   intimacy: number,
 *   mystery: number,
 *   choiceHarshness: number,
 *   pacing: "slow"|"medium"|"fast",
 *   revelation: number
 * }} NarrativeTargets
 */

/**
 * A tension axis that structures the story's central conflict.
 * @typedef {{ id: string, left: string, right: string }} TensionAxis
 */

/**
 * Pre-planned chapter node inside a BlueprintArc.
 * sceneWave encodes the per-scene wave roles for the chapter.
 * @typedef {{
 *   id: string,
 *   waveRole: WaveRole,
 *   purpose: string,
 *   mustResolve: string,
 *   targets: NarrativeTargets,
 *   sceneWave: WaveRole[],
 *   currentSceneIndex: number
 * }} BlueprintChapter
 */

/**
 * Pre-planned arc node inside a StoryBlueprint.
 * @typedef {{
 *   id: string,
 *   waveRole: WaveRole,
 *   purpose: string,
 *   focusAxis: string,
 *   targets: NarrativeTargets,
 *   currentChapterIndex: number,
 *   chapters: BlueprintChapter[]
 * }} BlueprintArc
 */

/**
 * The full Story Blueprint generated once at game initialization.
 * Encodes the nested wave structure: story → arcs → chapters → scenes.
 * @typedef {{
 *   coreQuestion: string,
 *   storyIdentity: string,
 *   tensionAxes: TensionAxis[],
 *   currentArcIndex: number,
 *   arcs: BlueprintArc[]
 * }} StoryBlueprint
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
 *     chapterPlan: ChapterPlan|null,
 *     storyBlueprint: StoryBlueprint|null
 *   }
 * }} GameMemory
 */

export {};
