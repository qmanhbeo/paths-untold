///utils/memoryManager.js
export const updateGameMemory = (prevMemory, newProse, newSummary, choice) => {
  const updatedProse = [...prevMemory.prose, newProse];
  const updatedPaths = [...prevMemory.paths, choice];
  const updatedSummaries = [...prevMemory.summary, newSummary];

  return {
    ...prevMemory,
    prose: updatedProse,
    paths: updatedPaths,
    summary: updatedSummaries,
  };
};



