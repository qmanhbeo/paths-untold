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

/* ---------- Normalization helpers ---------- */
function coerceChoices(v) {
  if (Array.isArray(v)) {
    return v
      .map((c) => (typeof c === 'string' ? c : (c && c.text) || ''))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}
function coerceCharacters(v) {
  if (!Array.isArray(v)) return [];
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
function coerceSceneTags(v) {
  if (!Array.isArray(v)) return [];
  return v.map(s => String(s).toLowerCase().trim()).filter(Boolean).slice(0, 12);
}
function coerceObjectivesDelta(v) {
  if (!Array.isArray(v)) return [];
  return v.map(d => ({
    add: typeof d?.add === 'string' ? d.add : undefined,
    complete: typeof d?.complete === 'string' ? d.complete : undefined,
    fail: typeof d?.fail === 'string' ? d.fail : undefined
  })).filter(d => d.add || d.complete || d.fail);
}
function coerceLocationDelta(v) {
  if (!v || typeof v !== 'object') return null;
  const name = typeof v.name === 'string' ? v.name : undefined;
  const addTags = Array.isArray(v.addTags) ? v.addTags.map(String) : undefined;
  const removeTags = Array.isArray(v.removeTags) ? v.removeTags.map(String) : undefined;
  if (!name && !addTags && !removeTags) return null;
  return { name, addTags, removeTags };
}
function coerceCompanionsDelta(v) {
  if (!Array.isArray(v)) return [];
  return v.map(it => {
    const idOrName = typeof it?.idOrName === 'string'
      ? it.idOrName
      : String(it?.name || '').trim();
    if (!idOrName) return null;
    const say = typeof it?.say === 'string' ? it.say : undefined;
    const ok = ['active','phased_out','rejoined','gone'];
    const status = ok.includes(it?.status) ? it.status : undefined;
    const history = Array.isArray(it?.history)
      ? it.history
          .filter(h => h && typeof h.event === 'string' && Number.isFinite(Number(h.impact)))
          .map(h => ({ event: h.event, impact: Number(h.impact) }))
      : undefined;
    return { idOrName, say, history, status };
  }).filter(Boolean);
}
function coerceArcDelta(v) {
  if (!v || typeof v !== 'object') return null;
  const t = Number.isInteger(v.tension) && [-1,0,1].includes(v.tension) ? v.tension : undefined;
  const b = Number.isInteger(v.beat) && [0,1].includes(v.beat) ? v.beat : undefined;
  const c = Number.isInteger(v.chapter) && [0,1].includes(v.chapter) ? v.chapter : undefined;
  if (t === undefined && b === undefined && c === undefined) return null;
  return { tension: t, beat: b, chapter: c };
}

/* ---------- Normalize to the shape GameScreen expects ---------- */
function normalizeStoryObject(obj, raw) {
  if (!obj || typeof obj !== 'object') {
    return { title: 'Untitled', story: raw || '', choices: [], characters: [], summary: '' };
  }
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Untitled';
  const story = typeof obj.story === 'string' ? obj.story : (raw || '');
  const choices = coerceChoices(obj.choices);
  const characters = coerceCharacters(obj.characters);
  const summary = typeof obj.summary === 'string' ? obj.summary : '';

  // NEW fields we pass through
  const sceneTags = coerceSceneTags(obj.sceneTags);
  const objectivesDelta = coerceObjectivesDelta(obj.objectivesDelta);
  const locationDelta = coerceLocationDelta(obj.locationDelta);
  const companionsDelta = coerceCompanionsDelta(obj.companionsDelta);
  const arcDelta = coerceArcDelta(obj.arcDelta);

  return { title, story, choices, characters, summary, sceneTags, objectivesDelta, locationDelta, companionsDelta, arcDelta };
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
