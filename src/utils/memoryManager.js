///utils/memoryManager.js
export const updateGameMemory = (prevMemory, newStory, newSummary, choice) => {
  const updatedStory = [...prevMemory.story, newStory]; // fixed from 'scenes'
  const updatedChoices = [...prevMemory.choices, choice];
  const updatedSummaries = [...prevMemory.summary, newSummary];

  return {
    ...prevMemory,
    story: updatedStory,
    choices: updatedChoices,
    summary: updatedSummaries,
  };
};



