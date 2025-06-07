// saveSystem.js

export const saveGameToSlot = (slotKey, gameData) => {
  if (!gameData.memory || !gameData.ui) {
    console.warn("⚠️ Trying to save incomplete data:", gameData);
  }
  const save = {
    timestamp: Date.now(),
    options: gameData.options,
    memory: gameData.memory,
    ui: gameData.ui
  };
  localStorage.setItem(`savedGame_${slotKey}`, JSON.stringify(save));
};

export const loadGameFromSlot = (slotKey) => {
  const data = localStorage.getItem(`savedGame_${slotKey}`);
  if (!data) return null;

  try {
    const parsed = JSON.parse(data);
    if (!parsed.memory || !parsed.ui) {
      console.warn("⚠️ Save file incomplete:", parsed);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error("❌ Failed to parse save file:", e);
    return null;
  }
};

export const deleteGameSlot = (slotKey) => {
  localStorage.removeItem(`savedGame_${slotKey}`);
};

export const getAllSaveSlots = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('savedGame_'));
  return keys.map(key => {
    const data = localStorage.getItem(key);
    try {
      const parsed = JSON.parse(data);
      return {
        key,
        ...parsed
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
};