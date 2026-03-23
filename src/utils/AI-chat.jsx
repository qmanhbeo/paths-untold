// src/utils/AI-chat.js
import React, { useEffect, useRef, useState } from 'react';
import { LLM_MODEL } from '../config/env';
import { chat as llmChat } from '../services/llmClient';
import { createDebugLogger } from './debugLog';
import { extractAndNormalizeAiResponse } from '../utils/storyParser';

const debug = createDebugLogger('AI-chat');

/** Public API used by components */
export async function generateStory(prompt, callback) {
  try {
    // Call proxy → upstream completion JSON
    const upstream = await llmChat(prompt, { model: LLM_MODEL });
    if (callback) callback(upstream);
    return upstream;
  } catch (e) {
    debug.error('[generateStory] error', e);
    if (callback) callback(null, e);
    throw e;
  }
}

/** Optional helper component you were using */
const GameStart = ({ onStoryGenerated, prompt }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const ranOnceRef = useRef(false);

  useEffect(() => {
    if (!prompt) return;
    if (ranOnceRef.current) return; // avoid double fire in React 18 dev StrictMode
    ranOnceRef.current = true;

    setLoading(true);
    setErr(null);
    generateStory(prompt, (upstream) => {
      const payload = extractAndNormalizeAiResponse(upstream);
      if (payload) onStoryGenerated && onStoryGenerated(payload);
      setLoading(false);
    }).catch(e => {
      setErr(e.message || String(e));
      setLoading(false);
    });
  }, [prompt, onStoryGenerated]);

  return (
    <div>
      {loading && <p>Loading story...</p>}
      {err && <p style={{ color: 'red' }}>Error: {err}</p>}
    </div>
  );
};

export default GameStart;
