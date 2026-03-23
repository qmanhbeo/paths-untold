// src/utils/storyParser.js
//
// Central parser/normalizer for model output.
// Accepts either:
//  - full OpenAI chat completion object,
//  - a raw string containing JSON (with/without ```json fences), or
//  - an already-shaped object { title, story, choices, ... }.
//
// Exports:
//  - extractAndNormalizeAiResponse(upstream): returns { title, story, choices, characters, summary, sceneTags, objectivesDelta, locationDelta, companionsDelta, arcDelta }
//  - parseGeneratedStory(rawAIX, displayedStory, choice): (LEGACY) your old markdown-style extractor kept for compatibility.

function robustParseJSON(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if ('title' in raw || 'story' in raw || 'choices' in raw) {
      return raw;
    }
    return null;
  }

  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  if (typeof raw !== 'string') return null;

  // 1) direct parse
  let obj = tryParse(raw);
  if (obj) return obj;

  // 2) strip ```json fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    obj = tryParse(fenced[1]);
    if (obj) return obj;
  }

  // 3) extract outermost {...}
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
  return obj || null;
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.text?.value === 'string') return part.text.value;
        if (typeof part?.value === 'string') return part.value;
        return '';
      })
      .filter(Boolean)
      .join('\n');

    return joined || null;
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.text?.value === 'string') return content.text.value;
    if (typeof content.value === 'string') return content.value;
  }

  return null;
}

function extractResponsesApiText(upstream) {
  if (!upstream || typeof upstream !== 'object' || !Array.isArray(upstream.output)) {
    return null;
  }

  const parts = upstream.output.flatMap((item) => {
    if (Array.isArray(item?.content)) return item.content;
    return [];
  });

  return extractTextContent(parts);
}

// ----------------- Normalization helpers (pure) -----------------
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

function normalizeStoryObject(obj, raw) {
  if (!obj || typeof obj !== 'object') {
    return { title: 'Untitled', story: raw || '', choices: [], characters: [], summary: '' };
  }
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Untitled';
  const story = typeof obj.story === 'string' ? obj.story : (raw || '');
  const choices = coerceChoices(obj.choices);
  const characters = coerceCharacters(obj.characters);
  const summary = typeof obj.summary === 'string' ? obj.summary : '';

  const sceneTags = coerceSceneTags(obj.sceneTags);
  const objectivesDelta = coerceObjectivesDelta(obj.objectivesDelta);
  const locationDelta = coerceLocationDelta(obj.locationDelta);
  const companionsDelta = coerceCompanionsDelta(obj.companionsDelta);
  const arcDelta = coerceArcDelta(obj.arcDelta);

  return { title, story, choices, characters, summary, sceneTags, objectivesDelta, locationDelta, companionsDelta, arcDelta };
}

// ----------------- Public: central entry point -----------------
export function extractAndNormalizeAiResponse(upstream) {
  // Case A: already a final object with expected fields
  if (upstream && typeof upstream === 'object' && upstream.title && upstream.story && upstream.choices) {
    const maybeFixed = { ...upstream };
    if (Array.isArray(maybeFixed.story)) maybeFixed.story = maybeFixed.story.join('\n');
    if (Array.isArray(maybeFixed.choices)) {
      maybeFixed.choices = maybeFixed.choices.map(c => (typeof c === 'string' ? c : c?.text ?? '')).filter(Boolean);
    }
    return normalizeStoryObject(maybeFixed, '');
  }

  // Case B: OpenAI chat completion (or similar)
  let text = null;
  if (upstream && typeof upstream === 'object' && upstream.choices?.[0]?.message?.content) {
    text = extractTextContent(upstream.choices[0].message.content);
  } else if (upstream && typeof upstream === 'object' && upstream.message?.content) {
    text = extractTextContent(upstream.message.content);
  } else if (upstream && typeof upstream === 'object' && upstream.output_text) {
    text = extractTextContent(upstream.output_text);
  } else if (upstream && typeof upstream === 'object') {
    text = extractResponsesApiText(upstream);
  } else if (typeof upstream === 'string') {
    text = upstream;
  }

  if (!text) return null;

  const parsed = robustParseJSON(text);
  return normalizeStoryObject(parsed, text);
}

// ----------------- LEGACY export (kept for compatibility) -----------------
// Your previous markdown-style parser. Left intact in case anything else still uses it.
export const parseGeneratedStory = (rawAIX, displayedStory, choice = '') => {
  // Extract title
  const titleRegex = /- \*\*Title:\*\* (.*?)(?:\n|$)/;
  const titleMatch = rawAIX.match(titleRegex);
  const storyTitle = titleMatch ? titleMatch[1].trim() : 'Your Adventure Awaits...';

  // Extract story
  const storyRegex = /\*\*Story:\*\*\s*([\s\S]*?)(?=\n\*\*Choice|\n- \*\*Choice|\n$)/;
  const storyMatch = rawAIX.match(storyRegex);
  const storyX = storyMatch ? storyMatch[1].trim() : 'No story available.';

  // Build updated HTML story (with player choice if any)
  const fullStory = `${displayedStory}${displayedStory ? `<br /><br /><strong>The player chooses:</strong> ${choice}.<br /><br />` : ''}${storyX.replace(/\n/g, '<br />')}`;

  // Extract choices
  const choiceRegex = /\*\*Choice (?:A|B|C|D):\*\* (.*?)(?:\n|$)/g;
  const fourChoicesX = [];
  let match;
  while ((match = choiceRegex.exec(rawAIX)) !== null) {
    fourChoicesX.push(match[1].trim().replace(/\.$/, ''));
  }

  return { storyTitle, fullStory, storyX, fourChoicesX };
};
