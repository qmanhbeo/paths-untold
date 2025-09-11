// src/utils/AI-chat.js
import React, { useEffect, useRef, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5174/api';
const API_MODEL = process.env.REACT_APP_LLM_MODEL || 'gpt-4o-mini';

/* ---------- Robust JSON parsing ---------- */
function robustParseJSON(raw) {
  if (raw && typeof raw === 'object') return raw;

  const tryParse = (s) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  if (typeof raw !== 'string') return null;

  // 1) direct
  let obj = tryParse(raw);
  if (obj) return obj;

  // 2) strip ```json fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    obj = tryParse(fenced[1]);
    if (obj) return obj;
  }

  // 3) extract first {...}
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const slice = raw.slice(first, last + 1);
    obj = tryParse(slice);
    if (obj) return obj;
  }

  // 4) normalize quotes + remove trailing commas and retry
  const core = fenced ? fenced[1] : (first !== -1 ? raw.slice(first, last + 1) : raw);
  const normalized = core
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');

  obj = tryParse(normalized);
  if (obj) return obj;

  return null;
}

/* ---------- Normalization to the exact shape GameScreen expects ---------- */
function coerceChoices(v) {
  if (Array.isArray(v)) {
    return v
      .map((c) => (typeof c === 'string' ? c : (c && c.text) || ''))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8); // safety cap
  }
  return [];
}
function coerceCharacters(v) {
  if (!Array.isArray(v)) return [];
  // keep only reasonable fields
  return v.map((ch) => ({
    name: String(ch?.name ?? '').trim() || 'Unknown',
    personality: String(ch?.personality ?? '').trim(),
    role: String(ch?.role ?? '').trim(),
    purpose: ch?.purpose ?? undefined,
    knownFacts: Array.isArray(ch?.knownFacts) ? ch.knownFacts : [],
    lastSpoken: ch?.lastSpoken ?? undefined,
    relationshipHistory: Array.isArray(ch?.relationshipHistory) ? ch.relationshipHistory : [],
  }));
}
function normalizeStoryObject(obj, raw) {
  if (!obj || typeof obj !== 'object') {
    return { title: 'Untitled', story: raw || '', choices: [], characters: [], summary: '' };
  }
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Untitled';
  const story = typeof obj.story === 'string' ? obj.story : (raw || '');
  const choices = coerceChoices(obj.choices);
  const characters = coerceCharacters(obj.characters);
  const summary = typeof obj.summary === 'string' ? obj.summary : '';
  return { title, story, choices, characters, summary };
}

/* ---------- Public API used by GameScreen ---------- */
export async function generateStory(prompt, callback) {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: API_MODEL,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Proxy error ${res.status}: ${errText || 'no body'}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('LLM returned no content');

    const parsed = robustParseJSON(raw);
    const normalized = normalizeStoryObject(parsed, raw);

    if (callback) callback(normalized);
    return normalized;
  } catch (e) {
    console.error('[generateStory] error', e);
    if (callback) callback(null, e);
    throw e;
  }
}

/* ---------- Optional helper component you were already using ---------- */
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
    generateStory(prompt, (payload) => {
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
