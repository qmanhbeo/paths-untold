const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.5-flash-lite';
const MODEL = process.env.MODEL || 'gpt-4o-mini';

const ACTIVE_MODEL = LLM_PROVIDER === 'google' ? GOOGLE_MODEL : MODEL;

export default function handler(req, res) {
  res.json({ ok: true, provider: LLM_PROVIDER, model: ACTIVE_MODEL, route: 'api/health.js' });
}