import express from 'express';
import cors from 'cors';
import { z } from 'zod';

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '1mb' }));

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';

// ---- OpenAI Config ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const MAX_COMPLETION_TOKENS = Number(process.env.MAX_COMPLETION_TOKENS || (MODEL.startsWith('gpt-5') ? 2400 : 1600));
const REASONING_EFFORT =
  process.env.REASONING_EFFORT || (MODEL.startsWith('gpt-5') ? 'minimal' : '');

// ---- Google Config ----
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.5-flash-lite';
const GOOGLE_MODEL_FALLBACKS = (process.env.GOOGLE_MODEL_FALLBACKS || '').split(',').filter(Boolean);
const GOOGLE_MODEL_LAST_RESORTS = (process.env.GOOGLE_MODEL_LAST_RESORTS || '').split(',').filter(Boolean);
const GOOGLE_MAX_TOKENS = Number(process.env.GOOGLE_MAX_TOKENS || 1600);
const GOOGLE_TIMEOUT = Number(process.env.GOOGLE_TIMEOUT || 30000);
const GOOGLE_LAST_RESORT_TIMEOUT = Number(process.env.GOOGLE_LAST_RESORT_TIMEOUT || 60000);

const RETRYABLE_HTTP_CODES = new Set([429, 500, 502, 503, 504]);

// ---- Cohere Config ----
const COHERE_API_KEY = process.env.COHERE_API;  // Note: .env uses COHERE_API
// Primary scene model: command-a-03-2025 (faster than command-r-plus)
const COHERE_MODEL = process.env.COHERE_MODEL || 'command-a-03-2025';
const COHERE_MODEL_FALLBACKS = (process.env.COHERE_MODEL_FALLBACKS || 'command-r-plus-08-2024').split(',').filter(Boolean);
const COHERE_MODEL_LAST_RESORTS = (process.env.COHERE_MODEL_LAST_RESORTS || '').split(',').filter(Boolean);
const COHERE_MAX_TOKENS = Number(process.env.COHERE_MAX_TOKENS || 1600);
const COHERE_TIMEOUT = Number(process.env.COHERE_TIMEOUT || 30000);
const ENABLE_PROVIDER_FALLBACK = process.env.ENABLE_PROVIDER_FALLBACK === 'true';

// ---- Unified Config for Health ----
const ACTIVE_MODEL =
  LLM_PROVIDER === 'google'
    ? GOOGLE_MODEL
    : LLM_PROVIDER === 'cohere'
      ? COHERE_MODEL
      : MODEL;

// ---- simple health check
app.get('/health', (req, res) => {
  if (LLM_PROVIDER === 'cohere') {
    res.json({
      ok: true,
      provider: LLM_PROVIDER,
      model: COHERE_MODEL,
      fallbacks: COHERE_MODEL_FALLBACKS,
      lastResorts: COHERE_MODEL_LAST_RESORTS,
      googleFallback: ENABLE_PROVIDER_FALLBACK
    });
  } else if (LLM_PROVIDER === 'google') {
    res.json({
      ok: true,
      provider: LLM_PROVIDER,
      model: GOOGLE_MODEL,
      fallbacks: GOOGLE_MODEL_FALLBACKS,
      lastResorts: GOOGLE_MODEL_LAST_RESORTS
    });
  } else {
    res.json({ ok: true, provider: LLM_PROVIDER, model: ACTIVE_MODEL });
  }
});

// ---- input validation
const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system','user','assistant']),
    content: z.string().min(1)
  })).min(1),
  model: z.string().optional(),
  stream: z.boolean().optional(),
  isPlanner: z.boolean().optional(),  // Planner requests need longer timeout/tokens
  isEvaluator: z.boolean().optional()  // Evaluator requests need shorter timeout/tokens
});

const DebugLogSchema = z.object({
  source: z.string().optional(),
  level: z.enum(['log', 'warn', 'error']).default('log'),
  args: z.array(z.any()).max(20).default([])
});

// ---- Shared helper ----
function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.text?.value === 'string') return part.text.value;
        if (typeof part?.value === 'string') return part.value;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.text?.value === 'string') return content.text.value;
    if (typeof content.value === 'string') return content.value;
  }
  return '';
}

// ---- OpenAI builders ----
function buildOpenAIBody(messages, stream = false, maxTokens = null) {
  const body = {
    model: MODEL,
    messages,
    max_completion_tokens: maxTokens || MAX_COMPLETION_TOKENS,
    response_format: { type: 'json_object' }
  };

  if (stream) body.stream = true;
  if (REASONING_EFFORT) body.reasoning_effort = REASONING_EFFORT;

  return body;
}

function extractOpenAIResponse(data) {
  return extractTextContent(data?.choices?.[0]?.message?.content);
}

// ---- Google builders ----
function buildGoogleBody(messages, stream = false, maxTokens = null) {
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  let contents = nonSystemMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  if (contents.length === 0 && systemMessages.length > 0) {
    return {
      contents: [{ role: 'user', parts: [{ text: systemMessages[0].content }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: maxTokens || GOOGLE_MAX_TOKENS,
        temperature: 0.7,
        topP: 0.95,
        topK: 40
      }
    };
  }

  const firstUserIdx = contents.findIndex(c => c.role === 'user');
  if (firstUserIdx !== -1 && systemMessages.length > 0) {
    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
    contents[firstUserIdx] = {
      role: 'user',
      parts: [{ text: systemPrompt + '\n\n' + contents[firstUserIdx].parts[0].text }]
    };
  }

  const body = {
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: GOOGLE_MAX_TOKENS,
      temperature: 0.7,
      topP: 0.95,
      topK: 40
    }
  };

  return body;
}

function extractGoogleResponse(data) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : '';
}

// ---- Cohere builders ----
function buildCohereBody(messages, stream = false) {
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const msgs = nonSystemMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  if (msgs.length === 0 && systemMessages.length > 0) {
    return {
      messages: [{ role: 'user', content: systemMessages[0].content }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: COHERE_MAX_TOKENS
    };
  }

  const firstUserIdx = msgs.findIndex(c => c.role === 'user');
  if (firstUserIdx !== -1 && systemMessages.length > 0) {
    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
    msgs[firstUserIdx] = {
      role: 'user',
      content: systemPrompt + '\n\n' + msgs[firstUserIdx].content
    };
  }

  const isReasoningModel = COHERE_MODEL.includes('reasoning') || COHERE_MODEL.includes('r7b');

  const body = {
    messages: msgs,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: COHERE_MAX_TOKENS
  };

  if (isReasoningModel) {
    body.thinking = { type: 'disabled' };
  }

  return body;
}

function extractCohereResponse(data) {
  const content = data?.message?.content;
  if (Array.isArray(content)) {
    const textPart = content.find(c => c.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

// ---- Main chat endpoint ----
app.post('/api/chat', async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { messages, stream: wantsStream, isPlanner, isEvaluator } = parsed.data;

  // Dev-only: log system prompt once when WAVE DIRECTOR is present
  if (process.env.NODE_ENV !== 'production' && !global.__loggedWaveDirectorSystem) {
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    if (systemMsg.includes('WAVE DIRECTOR')) {
      console.log('[SERVER] system prompt with WAVE DIRECTOR (' + systemMsg.length + ' chars)');
      console.log(systemMsg.slice(0, 2000) + (systemMsg.length > 2000 ? '...[truncated]' : ''));
      global.__loggedWaveDirectorSystem = true;
    }
  }

  try {
    if (LLM_PROVIDER === 'cohere') {
      return await handleCohereChat(req, res, messages, wantsStream, isPlanner, isEvaluator);
    } else if (LLM_PROVIDER === 'google') {
      return await handleGoogleChat(req, res, messages, wantsStream, isPlanner, isEvaluator);
    } else {
      return await handleOpenAIChat(req, res, messages, wantsStream, isPlanner, isEvaluator);
    }
  } catch (err) {
    const m = String(err || '');
    const isAbort = m.includes('AbortError') || m.includes('The operation was aborted');
    console.error('[chat] proxy failed', m);
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? 'Upstream timeout' : 'Proxy failed',
      message: m
    });
  }
});

// Planner-specific config: longer timeout, more output tokens.
const PLANNER_TIMEOUT = 90000;
const PLANNER_MAX_TOKENS = 4000;
const EVALUATOR_TIMEOUT = 15000;

// ---- OpenAI handler ----
async function handleOpenAIChat(req, res, messages, wantsStream, isPlanner, isEvaluator) {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing OPENAI_API_KEY' });
  }

  // Planner uses longer timeout/tokens; scenes use defaults; evaluator uses shorter timeout.
  const effectiveTimeout = isPlanner ? PLANNER_TIMEOUT : (isEvaluator ? EVALUATOR_TIMEOUT : 60000);
  const effectiveMaxTokens = isPlanner ? PLANNER_MAX_TOKENS : MAX_COMPLETION_TOKENS;

  if (isPlanner) {
    console.log('[chat] OpenAI planner mode', { timeout: effectiveTimeout, maxTokens: effectiveMaxTokens });
  } else if (isEvaluator) {
    console.log('[chat] OpenAI evaluator mode', { timeout: effectiveTimeout, maxTokens: effectiveMaxTokens });
  } else {
    console.log('[chat] OpenAI provider', {
      model: MODEL,
      messages: messages.length,
      max_completion_tokens: effectiveMaxTokens,
      reasoning_effort: REASONING_EFFORT || 'default',
      stream: wantsStream ?? false
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const upstreamRes = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildOpenAIBody(messages, wantsStream, effectiveMaxTokens)),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('[chat] OpenAI upstream error', upstreamRes.status, text.slice(0, 400));
      return res.status(upstreamRes.status).json({
        error: 'Upstream error',
        status: upstreamRes.status,
        body: text
      });
    }

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
      console.log('[chat] OpenAI stream complete');
      return;
    }

    const data = await upstreamRes.json();
    const content = extractOpenAIResponse(data);
    console.log('[chat] OpenAI ok', {
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      visible_chars: content.length,
      preview: content.slice(0, 160) || null,
      usage: data?.usage ?? null
    });
    return res.json(data);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ---- Cohere handler with fallback and provider fallback ----
async function handleCohereChat(req, res, messages, wantsStream, isPlanner, isEvaluator) {
  if (!COHERE_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing COHERE_API_KEY' });
  }

  // Planner uses longer timeout and more tokens; evaluator uses shorter.
  const effectiveTimeout = isPlanner ? PLANNER_TIMEOUT : (isEvaluator ? EVALUATOR_TIMEOUT : COHERE_TIMEOUT);
  const effectiveMaxTokens = isPlanner ? PLANNER_MAX_TOKENS : COHERE_MAX_TOKENS;

  if (isPlanner) {
    console.log('[chat] Cohere planner mode', { timeout: effectiveTimeout, maxTokens: effectiveMaxTokens });
  } else if (isEvaluator) {
    console.log('[chat] Cohere evaluator mode', { timeout: effectiveTimeout, maxTokens: effectiveMaxTokens });
  }

  const allModels = [COHERE_MODEL, ...COHERE_MODEL_FALLBACKS, ...COHERE_MODEL_LAST_RESORTS];
  let lastError = null;

  for (let attempt = 0; attempt < allModels.length; attempt++) {
    const currentModel = allModels[attempt];
    const isLastResort = attempt >= COHERE_MODEL_FALLBACKS.length + 1;
    // Use effective timeout: planner gets 90s, scenes get default.
    const timeout = isPlanner ? effectiveTimeout : (isEvaluator ? EVALUATOR_TIMEOUT : (isLastResort ? 60000 : COHERE_TIMEOUT));

    if (!isPlanner) {
      console.log('[chat] Cohere provider', {
        model: currentModel,
        attempt: attempt + 1,
        total: allModels.length,
        fallback: attempt > 0,
        lastResort: isLastResort,
        messages: messages.length,
        max_tokens: effectiveMaxTokens,
        stream: wantsStream ?? false
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const isReasoningModel = currentModel.includes('reasoning') || currentModel.includes('r7b');

      const body = {
        model: currentModel,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: effectiveMaxTokens  // Planner gets 4000, scenes get 1600
      };

      if (isReasoningModel) {
        body.thinking = { type: 'disabled' };
      }

      if (wantsStream) {
        return await handleCohereStream(req, res, messages, body, COHERE_API_KEY, controller);
      }

      const upstreamRes = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!upstreamRes.ok) {
        const status = upstreamRes.status;
        const text = await upstreamRes.text().catch(() => '');

        const canRetry = RETRYABLE_HTTP_CODES.has(status) || text.includes('UNAVAILABLE');
        console.error('[chat] Cohere upstream error', status, currentModel, text.slice(0, 200));

        if (canRetry && attempt < allModels.length - 1) {
          console.log('[chat] Cohere retrying', { model: currentModel, reason: 'retryable', status });
          continue;
        }

        return res.status(status).json({
          error: 'Upstream error',
          status: status,
          body: text.slice(0, 400)
        });
      }

      const data = await upstreamRes.json();
      const content = extractCohereResponse(data);

      if (!content) {
        console.error('[chat] Cohere no content', currentModel, data);
        return res.status(500).json({
          error: 'No content in Cohere response',
          body: JSON.stringify(data).slice(0, 400)
        });
      }

      console.log('[chat] Cohere ok', {
        model: currentModel,
        visible_chars: content.length,
        preview: content.slice(0, 160) || null,
        attempt: attempt + 1
      });

      const normalized = {
        choices: [{ message: { content } }]
      };
      return res.json(normalized);
    } catch (err) {
      clearTimeout(timer);
      const errMsg = String(err || '');
      const isAbort = errMsg.includes('AbortError') || errMsg.includes('The operation was aborted');
      console.error('[chat] Cohere error', currentModel, errMsg.slice(0, 200));

      if (attempt < allModels.length - 1) {
        console.log('[chat] Cohere retrying', { model: currentModel, reason: isAbort ? 'timeout' : 'error' });
        continue;
      }

      lastError = { message: errMsg, model: currentModel };
      break;
    }
  }

  if (lastError && ENABLE_PROVIDER_FALLBACK && GOOGLE_API_KEY) {
    console.log('[chat] Cohere failed, falling back to Google');
    return await handleGoogleChat(req, res, messages, wantsStream);
  }

  return res.status(500).json({
    error: 'All Cohere models failed',
    message: lastError?.message?.slice(0, 200) || 'Unknown error',
    tried: allModels
  });
}

async function handleCohereStream(req, res, messages, body, apiKey, controller) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstreamRes = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal
    });

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
  console.log('[chat] Cohere stream complete');
}

// ---- Google handler with fallback support ----
async function handleGoogleChat(req, res, messages, wantsStream, isPlanner, isEvaluator) {
  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GOOGLE_API_KEY' });
  }

  // Planner uses longer timeout and more tokens; evaluator uses shorter.
  const effectiveTimeout = isPlanner ? PLANNER_TIMEOUT : (isEvaluator ? EVALUATOR_TIMEOUT : GOOGLE_TIMEOUT);
  const effectiveMaxTokens = isPlanner ? PLANNER_MAX_TOKENS : GOOGLE_MAX_TOKENS;

  if (isPlanner) {
    console.log('[chat] Google planner mode', { timeout: effectiveTimeout, maxTokens: effectiveMaxTokens });
  } else if (isEvaluator) {
    console.log('[chat] Google evaluator mode', { timeout: effectiveTimeout, maxTokens: effectiveMaxTokens });
  }

  const allModels = [GOOGLE_MODEL, ...GOOGLE_MODEL_FALLBACKS, ...GOOGLE_MODEL_LAST_RESORTS];
  let lastError = null;

  for (let attempt = 0; attempt < allModels.length; attempt++) {
    const currentModel = allModels[attempt];
    const isLastResort = attempt >= GOOGLE_MODEL_FALLBACKS.length + 1;
    // Use effective timeout: planner gets 90s, evaluator gets 15s, scenes get default.
    const timeout = isPlanner ? effectiveTimeout : (isEvaluator ? EVALUATOR_TIMEOUT : (isLastResort ? GOOGLE_LAST_RESORT_TIMEOUT : GOOGLE_TIMEOUT));

    const isStream = wantsStream ?? false;

if (!isPlanner) {
      console.log('[chat] Google provider', {
        model: currentModel,
        attempt: attempt + 1,
        total: allModels.length,
        fallback: attempt > 0,
      lastResort: isLastResort,
      messages: messages.length,
      max_output_tokens: effectiveMaxTokens,
      structured: true,
      stream: isStream
    });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const GOOGLE_API_URL =
        'https://generativelanguage.googleapis.com/v1beta/models/' + currentModel + ':generateContent';

      const upstreamRes = await fetch(GOOGLE_API_URL + '?key=' + GOOGLE_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGoogleBody(messages, isStream, effectiveMaxTokens)),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!upstreamRes.ok) {
        const status = upstreamRes.status;
        const text = await upstreamRes.text().catch(() => '');

        const canRetry = RETRYABLE_HTTP_CODES.has(status) || text.includes('UNAVAILABLE');
        console.error('[chat] Google upstream error', status, currentModel, text.slice(0, 200));

        if (canRetry && attempt < allModels.length - 1) {
          console.log('[chat] Google retrying', { model: currentModel, reason: 'retryable', status });
          continue;
        }

        return res.status(status).json({
          error: 'Upstream error',
          status: status,
          body: text.slice(0, 400)
        });
      }

      const data = await upstreamRes.json();
      const content = extractGoogleResponse(data);

      if (!content) {
        console.error('[chat] Google no content', currentModel, data);
        return res.status(500).json({
          error: 'No content in Google response',
          body: JSON.stringify(data).slice(0, 400)
        });
      }

      console.log('[chat] Google ok', {
        model: currentModel,
        visible_chars: content.length,
        preview: content.slice(0, 160) || null,
        attempt: attempt + 1
      });

      const normalized = {
        choices: [{ message: { content } }]
      };
      return res.json(normalized);
    } catch (err) {
      clearTimeout(timer);
      const errMsg = String(err || '');
      const isAbort = errMsg.includes('AbortError') || errMsg.includes('The operation was aborted');
      console.error('[chat] Google error', currentModel, errMsg.slice(0, 200));

      if (attempt < allModels.length - 1) {
        console.log('[chat] Google retrying', { model: currentModel, reason: isAbort ? 'timeout' : 'error' });
        continue;
      }

      lastError = { message: errMsg, model: currentModel };
      break;
    }
  }

  return res.status(500).json({
    error: 'All models failed',
    message: lastError?.message?.slice(0, 200) || 'Unknown error',
    tried: allModels
  });
}

// ---- Debug logging ----
app.post('/api/debug-log', (req, res) => {
  const parsed = DebugLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid debug log payload' });
  }

  const { source = 'web', level, args } = parsed.data;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[${source}]`, ...args);
  return res.json({ ok: true });
});

// ---- Server startup ----
const port = Number(process.env.PORT || 5175);
const server = app.listen(port, () => {
  console.log(`[api-proxy] listening on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`[api-proxy] shutting down (${signal})`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));