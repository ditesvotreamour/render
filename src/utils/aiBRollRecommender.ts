/**
 * AI Subtitle B-Roll Recommender Service
 * Analyzes audio lyrics / subtitles with sentiment, rhythm, and poetic keyword analysis
 * (or Groq LLM if API key is provided) to identify cinematic moments, generate visual search
 * prompts, query Pexels & Pixabay for real HD footage, and recommend B-roll cutaways, PiP,
 * split screen, and atmospheric blend overlays.
 */

import type { LyricSegment, BRollDisplayMode, BRollPipPosition, BRollClip } from '../types/visualizer';
import { searchUnifiedStockMedia, type StockMediaItem } from './stockMediaService';
import { registerMediaUrl } from './zipImageExtractor';

export interface BRollRecommendation {
  id: string;
  lyricIndex?: number;
  matchedLyricText?: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  searchQuery: string;
  mood: string;
  reasoning: string;
  recommendedMode: BRollDisplayMode;
  recommendedPipPosition?: BRollPipPosition;
  recommendedBlendMode?: string;
  recommendedOpacity?: number;
  suggestedMedia?: StockMediaItem;
  alternativeMedia?: StockMediaItem[];
  selected: boolean;
}

export interface AnalyzeOptions {
  groqApiKey?: string;
  maxClips?: number;
  includeInstrumentalGaps?: boolean;
  density?: 'minimal' | 'balanced' | 'cinematic';
  preferredMode?: 'auto' | 'cutaway' | 'pip' | 'blend_overlay';
}

interface ThematicCategory {
  name: string;
  keywords: string[];
  englishQuery: string;
  defaultMode: BRollDisplayMode;
  blendMode?: string;
  pipPos?: BRollPipPosition;
  reasoning: string;
}

const THEMES: ThematicCategory[] = [
  {
    name: 'Hujan & Melankolis',
    keywords: ['hujan', 'gerimis', 'air mata', 'menangis', 'dingin', 'kelabu', 'sedih', 'terluka', 'hancur', 'sepi', 'sunyi', 'rain', 'tears', 'crying', 'lonely', 'cold', 'sorrow'],
    englishQuery: 'rain drops on window night moody',
    defaultMode: 'blend_overlay',
    blendMode: 'screen',
    reasoning: 'Lirik bernuansa melankolis & dingin sangat cocok dengan efek hamparan hujan (Blend Overlay Screen).',
  },
  {
    name: 'Malam & Bintang Kosmik',
    keywords: ['malam', 'bintang', 'bulan', 'langit', 'gelap', 'mimpi', 'tidur', 'angan', 'senyap', 'night', 'stars', 'moon', 'sky', 'dark', 'dream', 'galaxy'],
    englishQuery: 'night stars sky cosmic galaxy timelapse',
    defaultMode: 'cutaway',
    reasoning: 'Nuansa langit malam & angan kosmik dramatis dengan cutaway layar penuh pemandangan bintang.',
  },
  {
    name: 'Romantis & Hangat',
    keywords: ['cinta', 'sayang', 'kasih', 'hati', 'peluk', 'ciuman', 'bersamamu', 'kamu', 'indah', 'manis', 'rindu', 'love', 'heart', 'kiss', 'hug', 'together', 'sweet', 'forever'],
    englishQuery: 'romantic sunset golden hour aesthetic warmth',
    defaultMode: 'pip',
    pipPos: 'top_right',
    reasoning: 'Momen romantis hangat sangat pas disorot dengan jendela Picture-in-Picture (PiP) berbingkai neon lembut.',
  },
  {
    name: 'Panggung Konser & Pesta',
    keywords: ['pesta', 'dansa', 'joget', 'menari', 'musik', 'goyang', 'lampu', 'semangat', 'teriak', 'irama', 'party', 'dance', 'club', 'concert', 'music', 'jump', 'energy', 'crowd'],
    englishQuery: 'concert stage crowd laser lights edm party',
    defaultMode: 'split_screen',
    reasoning: 'Beat menghentak & semangat lagu cocok dipadukan dengan Split Screen 50/50 laser konser panggung.',
  },
  {
    name: 'Nostalgia & Kenangan Vintage',
    keywords: ['dulu', 'kenangan', 'masa lalu', 'ingat', 'foto', 'waktu', 'pernah', 'bayang', 'nostalgia', 'remember', 'memory', 'past', 'miss you', 'vintage', 'old'],
    englishQuery: 'retro vhs glitch film grain scanlines nostalgia',
    defaultMode: 'blend_overlay',
    blendMode: 'screen',
    reasoning: 'Lirik tentang memori & kenangan masa lalu tampil autentik dengan tekstur Retro VHS & Film Grain.',
  },
  {
    name: 'Api Membara & Gelora',
    keywords: ['api', 'terbakar', 'membara', 'panas', 'jiwa', 'bangkit', 'kuat', 'berjuang', 'menang', 'marah', 'bara', 'fire', 'flame', 'burning', 'fight', 'power', 'rise'],
    englishQuery: 'fire embers sparks flame dark rising',
    defaultMode: 'blend_overlay',
    blendMode: 'lighten',
    reasoning: 'Emosi menggebu atau kata-kata kuat dipertegas dengan hamparan percikan api & embers menyala.',
  },
  {
    name: 'Alam, Pantai & Senja',
    keywords: ['laut', 'pantai', 'ombak', 'gunung', 'senja', 'sunset', 'angin', 'terbang', 'bebas', 'alam', 'pagi', 'ocean', 'beach', 'waves', 'sunset', 'wind', 'fly', 'nature'],
    englishQuery: 'ocean sunset beach drone waves golden hour',
    defaultMode: 'cutaway',
    reasoning: 'Lirik bertema kebebasan & ketenangan divisualisasikan dengan cutaway pemandangan pantai & ombak senja.',
  },
  {
    name: 'Metropolis & Perjalanan',
    keywords: ['jalan', 'kota', 'melangkah', 'perjalanan', 'pergi', 'pulang', 'arah', 'tujuan', 'jauh', 'menunggu', 'city', 'street', 'walk', 'journey', 'lights', 'traffic'],
    englishQuery: 'city traffic night lights urban highway timelapse',
    defaultMode: 'cutaway',
    reasoning: 'Alur perjalanan hidup divisualisasikan dengan timelapse metropolis lampu lalu lintas malam.',
  },
];

/**
 * Identify theme from lyric line text
 */
function identifyThemeFromText(text: string): ThematicCategory | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  let bestMatch: ThematicCategory | null = null;
  let maxScore = 0;

  for (const theme of THEMES) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) {
        score += kw.length;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = theme;
    }
  }

  return bestMatch;
}

/**
 * Built-in Smart Subtitle & Gap Analyzer (Zero API Key required)
 */
export function analyzeSubtitlesHeuristic(
  lyrics: LyricSegment[],
  totalDuration: number,
  options: AnalyzeOptions = {}
): Omit<BRollRecommendation, 'suggestedMedia' | 'alternativeMedia'>[] {
  const recommendations: Omit<BRollRecommendation, 'suggestedMedia' | 'alternativeMedia'>[] = [];
  const duration = Math.max(10, totalDuration || 60);
  const maxClips = options.maxClips || (options.density === 'minimal' ? 4 : options.density === 'cinematic' ? 10 : 6);
  const includeGaps = options.includeInstrumentalGaps !== false;

  // 1. Check for Intro Instrumental Gap (before first vocal)
  if (includeGaps && lyrics.length > 0 && lyrics[0].start > 3.0) {
    const gapEnd = Math.min(lyrics[0].start, 12);
    recommendations.push({
      id: `broll_rec_intro_${Date.now()}`,
      startSec: 0,
      endSec: Math.round(gapEnd * 10) / 10,
      durationSec: Math.round(gapEnd * 10) / 10,
      searchQuery: 'cinematic atmospheric slow motion intro opening',
      mood: 'Intro Instrumental',
      reasoning: `Bagian pembuka (${lyrics[0].start.toFixed(1)} detik pertama) belum ada vokal. Sangat ideal untuk B-Roll atmosferik sinematik.`,
      recommendedMode: 'cutaway',
      selected: true,
    });
  }

  // 2. Scan lyric lines for thematic matches
  const sortedLyrics = [...lyrics].sort((a, b) => a.start - b.start);
  const scoredMoments: Array<{
    lyric: LyricSegment;
    index: number;
    theme: ThematicCategory;
  }> = [];

  sortedLyrics.forEach((line, idx) => {
    const theme = identifyThemeFromText(line.text);
    if (theme) {
      scoredMoments.push({ lyric: line, index: idx, theme });
    }
  });

  // Pick diverse moments spaced out across timeline
  let lastAssignedSec = -10;
  for (const m of scoredMoments) {
    if (recommendations.length >= maxClips) break;

    // Ensure minimum spacing between clips (at least 8 seconds)
    if (m.lyric.start - lastAssignedSec < 8) continue;

    const clipStart = Math.max(0, Math.round(m.lyric.start * 10) / 10);
    const clipDur = Math.max(3.5, Math.min(10, (m.lyric.end - m.lyric.start) + 1.5));
    const clipEnd = Math.min(duration, Math.round((clipStart + clipDur) * 10) / 10);

    const mode = options.preferredMode && options.preferredMode !== 'auto'
      ? options.preferredMode
      : m.theme.defaultMode;

    recommendations.push({
      id: `broll_rec_lyric_${m.index}_${Date.now()}`,
      lyricIndex: m.index,
      matchedLyricText: m.lyric.text,
      startSec: clipStart,
      endSec: clipEnd,
      durationSec: Math.round((clipEnd - clipStart) * 10) / 10,
      searchQuery: m.theme.englishQuery,
      mood: m.theme.name,
      reasoning: `Lirik: "${m.lyric.text}" → ${m.theme.reasoning}`,
      recommendedMode: mode,
      recommendedPipPosition: m.theme.pipPos || 'top_right',
      recommendedBlendMode: m.theme.blendMode || 'screen',
      recommendedOpacity: 1,
      selected: true,
    });

    lastAssignedSec = clipEnd;
  }

  // 3. Scan for Interlude Gaps between lyrics (> 4.5 seconds)
  if (includeGaps && recommendations.length < maxClips) {
    for (let i = 0; i < sortedLyrics.length - 1; i++) {
      if (recommendations.length >= maxClips) break;
      const currentEnd = sortedLyrics[i].end;
      const nextStart = sortedLyrics[i + 1].start;
      const gap = nextStart - currentEnd;

      if (gap >= 4.5 && currentEnd - lastAssignedSec >= 6) {
        const gapStart = Math.round(currentEnd * 10) / 10;
        const gapDur = Math.min(10, gap);
        const gapEnd = Math.round((gapStart + gapDur) * 10) / 10;

        recommendations.push({
          id: `broll_rec_gap_${i}_${Date.now()}`,
          startSec: gapStart,
          endSec: gapEnd,
          durationSec: Math.round(gapDur * 10) / 10,
          searchQuery: 'music interlude lights concert stage particles motion',
          mood: 'Jeda Musik (Interlude)',
          reasoning: `Terdapat jeda melodi sepanjang ${gap.toFixed(1)} detik tanpa vokal. Cocok diisi cutaway atau visual panggung.`,
          recommendedMode: 'cutaway',
          selected: true,
        });

        lastAssignedSec = gapEnd;
      }
    }
  }

  // 4. Outro Gap (after last vocal)
  if (includeGaps && sortedLyrics.length > 0 && recommendations.length < maxClips) {
    const lastLyricEnd = sortedLyrics[sortedLyrics.length - 1].end;
    if (duration - lastLyricEnd >= 4.0 && lastLyricEnd - lastAssignedSec >= 6) {
      const outroStart = Math.round(lastLyricEnd * 10) / 10;
      const outroEnd = Math.round(duration * 10) / 10;

      recommendations.push({
        id: `broll_rec_outro_${Date.now()}`,
        startSec: outroStart,
        endSec: outroEnd,
        durationSec: Math.round((outroEnd - outroStart) * 10) / 10,
        searchQuery: 'sunset dusk horizon fade out slow motion peaceful',
        mood: 'Outro Penutup',
        reasoning: `Bagian outro setelah vokal selesai (${(outroEnd - outroStart).toFixed(1)} detik). Cocok untuk penutup visual yang menenangkan.`,
        recommendedMode: 'blend_overlay',
        recommendedBlendMode: 'screen',
        selected: true,
      });
    }
  }

  return recommendations.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Groq LLM Subtitle B-Roll Analyzer
 * Analyzes deep poetic nuance and generates custom search prompts per timestamp
 */
export async function analyzeSubtitlesWithGroq(
  apiKey: string,
  lyrics: LyricSegment[],
  totalDuration: number,
  options: AnalyzeOptions = {}
): Promise<Omit<BRollRecommendation, 'suggestedMedia' | 'alternativeMedia'>[]> {
  const duration = Math.max(10, totalDuration || 60);
  const maxClips = options.maxClips || 6;

  const condensedLyrics = lyrics.slice(0, 50).map((l, i) => ({
    id: i,
    start: Math.round(l.start * 10) / 10,
    end: Math.round(l.end * 10) / 10,
    text: l.text,
  }));

  const systemPrompt = `You are an elite music video director and visual editor.
Your task is to analyze Indonesian/English song lyrics with timestamps and select exactly ${maxClips} moments to insert B-Roll video footage (cutaways, picture-in-picture, split-screen, or atmospheric blend overlays).

For each selected moment, specify:
1. startSec (number, seconds)
2. endSec (number, seconds, clip duration 4-9s)
3. matchedLyricText (exact snippet of the line)
4. searchQuery (concise English keywords for Pexels/Pixabay stock video search, e.g. "rain drops on window", "neon city traffic night", "concert lasers stage smoke", "golden sunset ocean waves")
5. mood (short Indonesian label e.g. "Melankolis", "Romantis", "Energetik")
6. reasoning (1 short Indonesian sentence explaining why this B-roll fits the lyric)
7. recommendedMode ("cutaway", "pip", "split_screen", or "blend_overlay")

Return ONLY a valid JSON array matching this schema:
[
  {
    "startSec": 10.5,
    "endSec": 16.0,
    "matchedLyricText": "...",
    "searchQuery": "...",
    "mood": "...",
    "reasoning": "...",
    "recommendedMode": "cutaway"
  }
]`;

  const cleanKey = apiKey.trim();
  const isKoboi = cleanKey.startsWith('sk-') && !cleanKey.startsWith('gsk_');
  const endpoint = isKoboi
    ? 'https://api.koboillm.com/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';

  const modelsToTry = isKoboi
    ? ['gpt-4o-mini', 'gpt-4o', 'qwen/qwen3.6-27b']
    : ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'groq/compound-mini'];
  let parsed: any = null;
  let lastErr: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Song Duration: ${duration} seconds.\nLyrics with timestamps:\n${JSON.stringify(condensedLyrics, null, 2)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `Groq API Error: ${response.status} ${response.statusText}`;
        if (model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`Model "${model}" gagal (${errMsg}), mencoba model alternatif...`);
          lastErr = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '{}';
      parsed = JSON.parse(rawContent);
      break;
    } catch (err: any) {
      lastErr = err;
      if (model === modelsToTry[modelsToTry.length - 1]) throw err;
    }
  }

  if (!parsed) {
    throw lastErr || new Error('Gagal mendapatkan rekomendasi B-Roll dari Groq.');
  }

  const list: any[] = Array.isArray(parsed) ? parsed : parsed.recommendations || parsed.broll || parsed.moments || [];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Groq returned empty recommendation list.');
  }

  return list.map((item, idx) => {
    const startSec = Math.max(0, Math.min(duration - 2, Number(item.startSec) || 0));
    const endSec = Math.min(duration, Math.max(startSec + 2, Number(item.endSec) || (startSec + 5)));

    return {
      id: `broll_groq_${idx}_${Date.now()}`,
      matchedLyricText: item.matchedLyricText || '',
      startSec: Math.round(startSec * 10) / 10,
      endSec: Math.round(endSec * 10) / 10,
      durationSec: Math.round((endSec - startSec) * 10) / 10,
      searchQuery: item.searchQuery || 'cinematic motion background',
      mood: item.mood || 'Sinematik',
      reasoning: item.reasoning || 'Rekomendasi visual AI Groq sesuai emosi lagu.',
      recommendedMode: ['cutaway', 'pip', 'split_screen', 'blend_overlay'].includes(item.recommendedMode)
        ? item.recommendedMode
        : 'cutaway',
      recommendedPipPosition: 'top_right',
      recommendedBlendMode: 'screen',
      selected: true,
    };
  });
}

/**
 * Main Orchestrator:
 * Analyzes subtitles (via Groq LLM if key present, else smart heuristic),
 * then fetches real matching video footage from Pexels, Pixabay, and curated loops for each recommendation.
 */
export async function getAiBRollRecommendations(
  lyrics: LyricSegment[],
  totalDuration: number,
  options: AnalyzeOptions = {},
  onProgress?: (step: string, percent: number) => void
): Promise<BRollRecommendation[]> {
  onProgress?.('Menganalisis makna & struktur subtitle...', 15);

  let rawRecommendations: Omit<BRollRecommendation, 'suggestedMedia' | 'alternativeMedia'>[] = [];

  // Try Groq LLM if key is supplied
  const groqKey = options.groqApiKey || (typeof window !== 'undefined' ? localStorage.getItem('groq_api_key') || '' : '');
  if (groqKey) {
    try {
      rawRecommendations = await analyzeSubtitlesWithGroq(groqKey, lyrics, totalDuration, options);
    } catch (err) {
      console.warn('Groq Subtitle Analysis failed, using smart semantic heuristic:', err);
      rawRecommendations = analyzeSubtitlesHeuristic(lyrics, totalDuration, options);
    }
  } else {
    rawRecommendations = analyzeSubtitlesHeuristic(lyrics, totalDuration, options);
  }

  if (rawRecommendations.length === 0) {
    // Fallback if no lyrics or empty: create 3 aesthetic ambient clips
    const gap = totalDuration / 4;
    rawRecommendations = [
      {
        id: `broll_fallback_1`,
        startSec: 2,
        endSec: Math.min(totalDuration, 8),
        durationSec: 6,
        searchQuery: 'cinematic neon city lights',
        mood: 'Cyberpunk & Cahaya',
        reasoning: 'Klip visual pembuka berkesan sinematik.',
        recommendedMode: 'cutaway',
        selected: true,
      },
      {
        id: `broll_fallback_2`,
        startSec: Math.round(gap * 2),
        endSec: Math.round(gap * 2) + 6,
        durationSec: 6,
        searchQuery: 'concert stage crowd laser beams',
        mood: 'Energetik & Panggung',
        reasoning: 'Sorotan panggung konser di puncak tempo lagu.',
        recommendedMode: 'split_screen',
        selected: true,
      },
      {
        id: `broll_fallback_3`,
        startSec: Math.max(0, totalDuration - 10),
        endSec: totalDuration,
        durationSec: 8,
        searchQuery: 'golden sunset ocean waves beach',
        mood: 'Penutup Senja',
        reasoning: 'Pemandangan ombak matahari terbenam yang syahdu untuk penutup.',
        recommendedMode: 'cutaway',
        selected: true,
      },
    ];
  }

  onProgress?.('Mencari footage video HD di Pexels & Pixabay...', 45);

  // Now fetch live stock media for each recommendation
  const populatedResults: BRollRecommendation[] = [];

  for (let i = 0; i < rawRecommendations.length; i++) {
    const rec = rawRecommendations[i];
    const pct = 45 + Math.round(((i + 1) / rawRecommendations.length) * 50);
    onProgress?.(`Mengambil stok video: "${rec.searchQuery}" (${i + 1}/${rawRecommendations.length})...`, pct);

    try {
      const searchRes = await searchUnifiedStockMedia({
        query: rec.searchQuery,
        mediaType: 'video',
        perPage: 4,
        page: 1,
      });

      const videoItems = searchRes.items.filter((item) => item.type === 'video');
      const suggestedMedia = videoItems[0] || undefined;
      const alternativeMedia = videoItems.slice(1, 4);

      if (suggestedMedia) {
        registerMediaUrl(suggestedMedia.downloadUrl || suggestedMedia.previewUrl, 'video');
      }

      populatedResults.push({
        ...rec,
        suggestedMedia,
        alternativeMedia,
      });
    } catch (err) {
      console.warn(`Failed to fetch media for "${rec.searchQuery}":`, err);
      populatedResults.push({
        ...rec,
        suggestedMedia: undefined,
        alternativeMedia: [],
      });
    }
  }

  onProgress?.('Rekomendasi B-Roll siap ditinjau!', 100);
  return populatedResults;
}

/**
 * Convert selected recommendations into ready-to-use BRollClips
 */
export function convertRecommendationsToBRollClips(
  recommendations: BRollRecommendation[]
): BRollClip[] {
  return recommendations
    .filter((r) => r.selected && r.suggestedMedia)
    .map((r, idx) => {
      const media = r.suggestedMedia!;
      const url = media.downloadUrl || media.previewUrl;
      registerMediaUrl(url, 'video');

      return {
        id: `broll_ai_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `${r.mood}: ${media.title || r.searchQuery}`,
        url,
        mediaType: 'video',
        startSec: r.startSec,
        endSec: r.endSec,
        displayMode: r.recommendedMode,
        pipPosition: r.recommendedPipPosition || 'top_right',
        pipScale: 0.38,
        blendMode: r.recommendedBlendMode || (r.recommendedMode === 'blend_overlay' ? 'screen' : 'source-over'),
        opacity: r.recommendedOpacity ?? 1,
        kenBurns: true,
      };
    });
}
