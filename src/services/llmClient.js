// src/services/llmClient.js
import { API_BASE, LLM_MODEL } from '../config/env';

// Client timeout must exceed server per-attempt timeout because server may retry fallback models.
// Scene timeout: 75s allows server fallback attempt (2) to complete.
// Planner timeout: 90s for longer generation.
// Evaluator timeout: 20s for quick scoring.
const PLANNER_TIMEOUT = 90000;
const SCENE_TIMEOUT = 75000;
const EVALUATOR_TIMEOUT = 20000;

function withTimeout(ms = SCENE_TIMEOUT, label = 'request') {
  const ctrl = new AbortController();
  const id = setTimeout(() => {
    ctrl.abort();
    console.log(`[llmClient] ${label} timeout after ${ms}ms`);
  }, ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

/**
 * Low-level chat call to the proxy; returns the upstream JSON as-is.
 * Accepts either a prompt string (wrapped as user message) or a messages array.
 * Options:
 *   - model: override model name
 *   - isPlanner: true for Story Blueprint planner (uses longer timeout)
 *   - isEvaluator: true for narrative evaluator (uses shorter timeout)
 */
export async function chat(messagesOrPrompt, options = {}) {
  const model = options.model || LLM_MODEL;
  const isPlanner = options.isPlanner === true;
  const isEvaluator = options.isEvaluator === true;

  // Determine timeout based on request type
  const timeout = isPlanner ? PLANNER_TIMEOUT : (isEvaluator ? EVALUATOR_TIMEOUT : SCENE_TIMEOUT);
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: 'user', content: messagesOrPrompt }];
  const { signal, clear } = withTimeout(timeout, isEvaluator ? 'evaluator' : (isPlanner ? 'planner' : 'scene'));

  if (import.meta.env.DEV) {
    console.log('[llmClient]', isEvaluator ? 'evaluator' : (isPlanner ? 'planner' : 'scene'), 'timeout:', timeout);
  }

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ model, messages, isPlanner, isEvaluator }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Proxy error ${res.status}${errText ? `: ${errText}` : ''}`);
    }
    return await res.json();
  } finally {
    clear();
  }
}

/**
 * Extracts the visible story text from a partial JSON buffer being streamed.
 * Returns { text, done } once the "story" field is found, or null if not yet present.
 */
export function extractStoryFromBuffer(buffer) {
  const match = buffer.match(/"story"\s*:\s*"/);
  if (!match) return null;
  const start = match.index + match[0].length;
  let text = '';
  for (let i = start; i < buffer.length; i++) {
    if (buffer[i] === '\\' && i + 1 < buffer.length) {
      const esc = buffer[++i];
      if (esc === '"') text += '"';
      else if (esc === 'n') text += '\n';
      else if (esc === '\\') text += '\\';
      else text += esc;
    } else if (buffer[i] === '"') {
      return { text, done: true };
    } else {
      text += buffer[i];
    }
  }
  return { text, done: false };
}

/**
 * Streaming chat call. Calls onDelta(delta, accumulated) for each token chunk.
 * Returns the full accumulated text when the stream ends.
 */
export async function chatStream(messages, onDelta) {
  const { signal, clear } = withTimeout(60000);
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ messages, stream: true }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Proxy error ${res.status}${errText ? `: ${errText}` : ''}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              accumulated += delta;
              onDelta(delta, accumulated);
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return accumulated;
  } finally {
    clear();
  }
}
