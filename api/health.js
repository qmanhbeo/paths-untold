const MODEL = process.env.MODEL || 'gpt-4o-mini';

export default function handler(req, res) {
  res.json({ ok: true, model: MODEL });
}
