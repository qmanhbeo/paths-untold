// utils/phaseOutManager.js

/**
 * Assigns purpose and lifecycle fields to new characters.
 * Only affects characters who are missing .purpose and are "active".
 */
export const assignPurposeIfNeeded = (companions, sceneIndex) => {
    return companions.map(char => {
      if (!char.purpose) return char;

      return {
        ...char,
        status: char.status || "active",
        purposeAssignedScene: char.purposeAssignedScene ?? sceneIndex,
        purposeFulfilled: char.purposeFulfilled ?? false,
        phaseOutIn: char.phaseOutIn ?? null,
        phasedOutScene: char.phasedOutScene ?? null,
      };
    });
  };

  /**
   * Updates countdowns for characters whose purpose is fulfilled.
   * When phaseOutIn reaches 0, marks them as phased_out.
   */
  export const updatePhaseOutCountdowns = (companions, sceneIndex) => {
    return companions.map(char => {
      if (char.status !== "active") return char;
      if (!char.purposeFulfilled) return char;

      // Countdown not started yet
      if (char.phaseOutIn == null) {
        return { ...char, phaseOutIn: 2 }; // default hardcoded countdown
      }

      // Tick down
      const nextCountdown = char.phaseOutIn - 1;

      if (nextCountdown <= 0) {
        return {
          ...char,
          status: "phased_out",
          phaseOutIn: 0,
          phasedOutScene: sceneIndex,
        };
      }

      return { ...char, phaseOutIn: nextCountdown };
    });
  };

  /**
   * Injects AI instructions into the prompt for characters with purpose.
   * This allows AI to evaluate fulfillment and begin phase-out process naturally.
   */
  export const injectPhaseOutLogicIntoPrompt = (companions, sceneIndex) => {
    const purposeChecks = companions
      .filter(c => c.purpose && c.status === "active")
      .map(c => {
        const subgoals = Array.isArray(c.purpose.subgoals)
          ? c.purpose.subgoals.map((g, i) => `    ${i + 1}. ${g}`).join('\n')
          : '    (No subgoals defined)';

        return `- ${c.name}:
    • Main Purpose: "${c.purpose.main}"
    • Progress: ${c.purpose.fulfilled}%
    • Subgoals:
  ${subgoals}`;
      })
      .join('\n\n');

    const fadeOutCues = companions
      .filter(c => c.phaseOutIn !== null && c.phaseOutIn > 0)
      .map(c => `- ${c.name} is starting to drift from the story. Consider showing detachment, silence, or environmental separation.`)
      .join('\n');

    let injection = '';

    if (purposeChecks) {
      injection += `
  📌 Evaluate these characters' narrative purpose:
  ${purposeChecks}
  For each, determine if they have fulfilled their role. If yes, begin soft removal from story context.`;
    }

    if (fadeOutCues) {
      injection += `
  🎭 Fade-out Cues:
  ${fadeOutCues}
  Do NOT abruptly remove them. Instead, write subtle signs of departure.`;
    }

    return injection;
  };

  /**
   * Updates companions with AI-confirmed purpose fulfillment flags.
   * Assumes you parsed the AI's response metadata elsewhere.
   */
  export const applyPurposeFulfillmentFlags = (companions, fulfilledNames = []) => {
    return companions.map(char => {
      if (fulfilledNames.includes(char.name)) {
        return { ...char, purposeFulfilled: true };
      }
      return char;
    });
  };
