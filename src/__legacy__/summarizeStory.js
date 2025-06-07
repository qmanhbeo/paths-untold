// utils/summarizeStory.js

/**
 * summarizeStory
 * Constructs a summarization prompt for the AI to generate a concise summary of the story so far.
 *
 * @param {string} summaryInput - The full HTML-rendered story so far (with <br /> tags).
 * @param {string} lastChoice - The last choice made by the player.
 * @returns {string} - A prompt asking the AI to generate a short summary.
 */
export const summarizeStory = (summaryInput) => {
    const plainTextStory = summaryInput.replace(/<br\s*\/?>/gi, '\n');
  
    return `You are a helpful storytelling AI. Summarize the following adventure so far in less than 200 words:
  
  ${plainTextStory}
  
  Return your answer in this format:
  
  **Summary:** [summary goes here]`;
  };


  export const summarizeAndStore = async ({
    storyX,
    choice,
    storyWithChoice,
    gameMemory,
    generateStory,
    summarizeStory,
    updateGameMemory,
    setStorySummary,
    setGameMemory
  }) => {
    try {
      const prevSummary = gameMemory.summary.at(-1) || '';
      const summaryInput = `${prevSummary}<br />${storyX}<br /><strong>Choice:</strong> ${choice}`;
      const summaryPrompt = summarizeStory(summaryInput);
  
      await generateStory(summaryPrompt, (summaryResponse) => {
        const summaryX = summaryResponse.replace(/\*\*Summary:\*\*/, '').trim();
        const updatedMemory = updateGameMemory(gameMemory, storyX, summaryX, choice);
  
        setStorySummary(summaryX);
        setGameMemory(prev => ({ ...updatedMemory, companions: prev.companions }));
      });
    } catch (error) {
      console.error('❌ Error in summarizeAndStore:', error);
    }
  };
  