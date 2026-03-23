const env = import.meta.env;

function pickFirstDefined(...values) {
  return values.find((value) => typeof value === 'string' && value.trim() !== '');
}

export const API_BASE =
  pickFirstDefined(env.VITE_API_BASE, env.REACT_APP_API_BASE) ||
  'http://localhost:5175/api';

export const LLM_MODEL =
  pickFirstDefined(env.VITE_LLM_MODEL, env.REACT_APP_LLM_MODEL) ||
  'gpt-4o-mini';

export const IS_DEV = env.DEV;
export const BASE_URL = env.BASE_URL || '/';
export const TERMINAL_DEBUG_LOGS =
  pickFirstDefined(env.VITE_TERMINAL_DEBUG_LOGS, env.REACT_APP_TERMINAL_DEBUG_LOGS) === 'true';

export function publicAsset(path) {
  return `${BASE_URL}${String(path).replace(/^\/+/, '')}`;
}
