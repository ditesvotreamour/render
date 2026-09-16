/**
 * KoboiLLM LiteLLM Service
 * Base URL: https://api.koboillm.com/v1
 * Managed Multi-Model AI Gateway (OpenAI, Gemini, DeepSeek, Claude, Whisper) via LiteLLM
 */

export interface KoboiModelItem {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  type?: 'audio' | 'chat' | 'reasoning' | 'general';
}

export const KOBOILLM_DIRECT_BASE_URL = 'https://api.koboillm.com/v1';

/**
 * Normalizes any KoboiLLM endpoint URL so that in browser environments,
 * it routes through the local Vite proxy (/api-koboillm/...) to eliminate CORS blocks.
 */
export function normalizeKoboiEndpoint(url: string): string {
  if (!url) return url;
  if (typeof window !== 'undefined' && url.includes('api.koboillm.com')) {
    return url.replace(/^https?:\/\/api\.koboillm\.com/, '/api-koboillm');
  }
  return url;
}

export const KOBOILLM_BASE_URL =
  typeof window !== 'undefined' ? '/api-koboillm/v1' : KOBOILLM_DIRECT_BASE_URL;
export const KOBOILLM_MODELS_ENDPOINT = `${KOBOILLM_BASE_URL}/models`;
export const KOBOILLM_CHAT_ENDPOINT = `${KOBOILLM_BASE_URL}/chat/completions`;
export const KOBOILLM_AUDIO_ENDPOINT = `${KOBOILLM_BASE_URL}/audio/transcriptions`;

export const DEFAULT_KOBOILLM_API_KEY = 'sk-nFQbVzLgzWLRY-rKf_ZIPQ';
export const DEFAULT_KOBOILLM_WHISPER_MODEL = 'openai/whisper-1';
export const DEFAULT_KOBOILLM_CHAT_MODEL = 'gpt-4o-mini';

/**
 * Fetch all available models from LiteLLM endpoint: https://api.koboillm.com/v1/models
 */
export async function fetchKoboiLLMModels(apiKey: string): Promise<KoboiModelItem[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('API Key KoboiLLM diperlukan untuk memuat daftar model dari https://api.koboillm.com/v1/models.');
  }

  const endpoint = normalizeKoboiEndpoint(KOBOILLM_MODELS_ENDPOINT);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err: any) {
    throw new Error(`Gagal menghubungi KoboiLLM (${endpoint}): ${err.message || 'CORS / Network Error'}`);
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || errJson?.message || `HTTP ${response.status} ${response.statusText}`;

    if (response.status === 401) {
      throw new Error(`KoboiLLM API Key tidak valid (401 Unauthorized): ${msg}. Pastikan Virtual Key diawali sk-... dari https://koboillm.com`);
    }
    throw new Error(`Gagal mengambil model dari LiteLLM (${response.status}): ${msg}`);
  }

  const json = await response.json();
  const rawList: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

  const models: KoboiModelItem[] = rawList
    .map((m) => {
      const id = typeof m === 'string' ? m : m.id || '';
      const lower = id.toLowerCase();
      const isAudio = lower.includes('whisper') || lower.includes('audio') || lower.includes('stt') || lower.includes('transcri');
      const isReasoning = lower.includes('reasoner') || lower.includes('r1') || lower.includes('o1') || lower.includes('o3');

      return {
        id,
        object: m.object || 'model',
        created: m.created,
        owned_by: m.owned_by || '',
        type: isAudio ? ('audio' as const) : isReasoning ? ('reasoning' as const) : ('chat' as const),
      };
    })
    .filter((m) => Boolean(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Persist in localStorage cache
  try {
    localStorage.setItem('koboillm_cached_models', JSON.stringify(models));
    localStorage.setItem('koboillm_cached_models_time', String(Date.now()));
  } catch (e) {
    console.warn('Failed to cache KoboiLLM models in localStorage:', e);
  }

  return models;
}

/**
 * Get cached models from localStorage with sensible defaults
 */
export function getCachedKoboiModels(): KoboiModelItem[] {
  try {
    const cached = localStorage.getItem('koboillm_cached_models');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  // Sensible default starter list of models commonly available in KoboiLLM LiteLLM
  return [
    { id: 'openai/whisper-1', type: 'audio', owned_by: 'openai' },
    { id: 'whisper-1', type: 'audio', owned_by: 'openai' },
    { id: 'gpt-4o-mini', type: 'chat', owned_by: 'openai' },
    { id: 'gpt-4o', type: 'chat', owned_by: 'openai' },
    { id: 'gemini-2.0-flash', type: 'chat', owned_by: 'google' },
    { id: 'gemini-1.5-flash', type: 'chat', owned_by: 'google' },
    { id: 'gemini-1.5-pro', type: 'chat', owned_by: 'google' },
    { id: 'deepseek-chat', type: 'chat', owned_by: 'deepseek' },
    { id: 'deepseek-reasoner', type: 'reasoning', owned_by: 'deepseek' },
    { id: 'claude-3-5-sonnet-20241022', type: 'chat', owned_by: 'anthropic' },
    { id: 'llama-3.3-70b-versatile', type: 'chat', owned_by: 'meta' },
  ];
}

/**
 * Send LiteLLM Chat Completion via POST https://api.koboillm.com/v1/chat/completions
 */
export async function createKoboiChatCompletion(
  apiKey: string,
  params: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' | 'text' };
  }
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('KoboiLLM API Key diperlukan. Masukkan API Key Anda dari koboillm.com.');
  }

  const model = params.model || localStorage.getItem('koboillm_chat_model') || DEFAULT_KOBOILLM_CHAT_MODEL;

  const endpoint = normalizeKoboiEndpoint(KOBOILLM_CHAT_ENDPOINT);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens ?? 1500,
        ...(params.response_format ? { response_format: params.response_format } : {}),
      }),
    });
  } catch (err: any) {
    throw new Error(`Gagal terhubung ke LiteLLM KoboiLLM (${endpoint}): ${err.message || 'CORS / Network Error'}`);
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || errJson?.message || `HTTP ${response.status} ${response.statusText}`;

    if (response.status === 401) {
      if (msg.includes('key not allowed to access model') || errJson?.error?.type === 'key_model_access_denied') {
        throw new Error(`Model '${model}' tidak diizinkan untuk API Key ini (${msg}). Virtual key ini dikhususkan untuk model tertentu (misal: openai/whisper-1).`);
      }
      throw new Error(`KoboiLLM API Key tidak valid (401 Unauthorized): ${msg}. Periksa di https://koboillm.com`);
    }
    if (response.status === 429) {
      throw new Error(`KoboiLLM Kuota / Saldo habis (429): ${msg}. Silakan isi saldo di https://koboillm.com`);
    }
    throw new Error(`KoboiLLM LiteLLM Error (${response.status}): ${msg}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}
