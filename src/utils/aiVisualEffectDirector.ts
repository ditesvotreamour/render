/**
 * AI Visual Effect Director Service
 * Analyzes audio duration, slide intervals, and lyric subtitles using either:
 * 1) Groq LLM (llama-3.3-70b-versatile) for deep poetic and mood analysis, or
 * 2) Smart Rhythm & Semantic Heuristic for instant, zero-latency offline direction.
 * 
 * Recommends and distributes visual effects (Distorsi, Kamera Jadul, Cacing-cacing)
 * across multi-image frames intelligently without overwhelming the viewer.
 */

import type { LyricSegment, SlideItem, VisualEffectType } from '../types/visualizer';
import { VISUAL_EFFECT_OPTIONS } from '../types/visualizer';

export type VisualEffectStylePreset =
  | 'cinematic_smart' // Balanced mix of distortion at drops, vintage on emotional parts, worms at intro/transitions
  | 'vintage_retro'    // Prioritize vintage_camera & vintage_worms on nostalgic/warm scenes
  | 'glitch_energy'    // Prioritize distortion on heavy beats, drops, and high intensity lyrics
  | 'grunge_8mm';      // Prioritize film_worms (celluloid hairs & vertical film scratches)

export type VisualEffectDensity =
  | 'minimal'   // ~15-20% frames have effects (subtle, high impact only)
  | 'balanced'  // ~35-40% frames have effects (recommended, professional pacing)
  | 'heavy';    // ~60-70% frames have effects (fast-paced, high energy)

export interface SlideEffectPlanItem {
  slideId: string;
  slideIndex: number;
  slideName: string;
  startSec: number;
  endSec: number;
  imageUrl: string;
  matchedLyricText?: string;
  recommendedEffect: VisualEffectType;
  intensity: number;
  reason: string;
}

export interface DirectorOptions {
  stylePreset?: VisualEffectStylePreset;
  density?: VisualEffectDensity;
  groqApiKey?: string;
  model?: string;
}

export const GROQ_DIRECTOR_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: '🧠 Llama 3.3 70B Versatile (Flagship Groq: Penalaran Mendalam & Direkomendasikan)' },
  { id: 'llama-3.1-8b-instant', label: '⚡ Llama 3.1 8B Instant (Super Cepat ~1000 t/s & Sangat Stabil)' },
  { id: 'gemma2-9b-it', label: '🎯 Gemma 2 9B IT (Presisi & Cerdas)' },
  { id: 'openai/gpt-oss-20b', label: '🤖 GPT OSS 20B (Kompatibilitas Eksperimental)' },
];

/** Keyword dictionary for semantic mood detection */
const KEYWORDS = {
  distortion: [
    'hancur', 'teriak', 'api', 'darah', 'pecah', 'gila', 'mati', 'pesta', 'dansa',
    'beat', 'drop', 'bass', 'jump', 'power', 'rage', 'run', 'fast', 'terbakar',
    'teriakan', 'ledakan', 'bangkit', 'menang', 'marah', 'bara', 'fire', 'flame',
    'fight', 'power', 'burn', 'screaming', 'electric', 'glitch', 'shock', 'loud',
    'rusak', 'racun', 'panas', 'getar', 'hentak'
  ],
  vintage: [
    'dulu', 'kenangan', 'ingat', 'foto', 'waktu', 'masa lalu', 'nostalgia', 'bayang',
    'rindu', 'pernah', 'tangis', 'air mata', 'sepi', 'sunyi', 'dingin', 'kelabu',
    'old', 'memory', 'past', 'remind', 'love', 'cinta', 'sayang', 'kasih', 'peluk',
    'ciuman', 'senja', 'sunset', 'manis', 'hangat', 'abadi', 'forever', 'tears',
    'luka', 'hilang', 'sedih'
  ],
  worms: [
    'jalan', 'malam', 'senyap', 'langit', 'bintang', 'angin', 'hujan', 'gerimis',
    'debu', 'daun', 'sepi', 'mimpi', 'dream', 'fade', 'alone', 'night', 'dark',
    'lost', 'bayangan', 'kosong', 'sunyi', 'jejak', 'detik', 'jam', 'waktu', 'kabur',
    'samar', 'remang', 'embun'
  ],
};

/**
 * Format seconds to mm:ss
 */
function formatTimeMinSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Find lyrics matching a slide's time range
 */
function findLyricForSlide(slide: SlideItem, lyrics: LyricSegment[]): string {
  if (!lyrics || lyrics.length === 0) return '';
  const mid = (slide.startSec + slide.endSec) / 2;
  // Match any lyric overlapping with the middle of the slide
  const match = lyrics.find((l) => mid >= l.start && mid <= l.end);
  if (match) return match.text;

  // Otherwise find any lyric overlapping with the slide duration
  const overlap = lyrics.find((l) => l.start < slide.endSec && l.end > slide.startSec);
  return overlap ? overlap.text : '';
}

/**
 * Smart Rhythm & Semantic Heuristic Director
 * Runs in under 5ms, 100% offline, guaranteed clean distribution without clutter
 */
export function recommendSlideEffectsHeuristic(
  slides: SlideItem[],
  lyrics: LyricSegment[] = [],
  totalDuration: number = 0,
  options: DirectorOptions = {}
): SlideEffectPlanItem[] {
  if (!slides || slides.length === 0) return [];

  const style = options.stylePreset || 'cinematic_smart';
  const density = options.density || 'balanced';

  // Target ratio of slides that should have effects
  let targetRatio = 0.35;
  if (density === 'minimal') targetRatio = 0.18;
  if (density === 'heavy') targetRatio = 0.65;

  const totalSlides = slides.length;
  const targetEffectCount = Math.max(1, Math.round(totalSlides * targetRatio));

  const duration = totalDuration > 0 ? totalDuration : (slides[totalSlides - 1]?.endSec || 60);

  // 1. Initial slide analysis with scoring
  interface ScoredSlide {
    slide: SlideItem;
    index: number;
    lyricText: string;
    distortionScore: number;
    vintageScore: number;
    wormsScore: number;
    preferredEffect: VisualEffectType;
    intensity: number;
    reason: string;
    totalInterest: number;
  }

  const scored: ScoredSlide[] = slides.map((slide, idx) => {
    const lyricText = findLyricForSlide(slide, lyrics);
    const lowerLyric = lyricText.toLowerCase();

    const progress = duration > 0 ? slide.startSec / duration : idx / totalSlides;
    const isIntro = progress < 0.12;
    const isOutro = progress > 0.88;
    const isMidClimax = progress >= 0.40 && progress <= 0.75;

    let distScore = 0;
    let vintScore = 0;
    let wormScore = 0;

    // Check keyword hits
    KEYWORDS.distortion.forEach((kw) => {
      if (lowerLyric.includes(kw)) distScore += 2.5;
    });
    KEYWORDS.vintage.forEach((kw) => {
      if (lowerLyric.includes(kw)) vintScore += 2.5;
    });
    KEYWORDS.worms.forEach((kw) => {
      if (lowerLyric.includes(kw)) wormScore += 2.5;
    });

    // Positional biases
    if (isIntro) {
      wormScore += 3.0; // Intro often starts with vintage scratches/worms
      vintScore += 2.0;
    }
    if (isMidClimax) {
      distScore += 3.0; // Song chorus/climax benefits from glitch/distortion
    }
    if (isOutro) {
      vintScore += 3.0; // Fading out with vintage film tone
      wormScore += 2.0;
    }

    // Adjust scores based on selected style preset
    if (style === 'vintage_retro') {
      vintScore *= 2.0;
      wormScore *= 1.4;
      distScore *= 0.4;
    } else if (style === 'glitch_energy') {
      distScore *= 2.2;
      wormScore *= 0.5;
      vintScore *= 0.5;
    } else if (style === 'grunge_8mm') {
      wormScore *= 2.2;
      vintScore *= 1.3;
      distScore *= 0.4;
    }

    // Determine best effect candidate for this slide
    let preferredEffect: VisualEffectType = 'none';
    let maxScore = Math.max(distScore, vintScore, wormScore);
    let reason = 'Frame bersih alami untuk memberi ritme visual santai (breathing space).';

    if (maxScore > 1.2 || isIntro || isMidClimax || isOutro) {
      if (maxScore === distScore && distScore > 0) {
        preferredEffect = 'distortion';
        reason = lyricText
          ? `⚡ Distorsi Glitch selaras dengan dinamika lirik "${lyricText.slice(0, 30)}..."`
          : '⚡ Distorsi Glitch di puncak ritme lagu untuk memberi hentakan visual.';
      } else if (maxScore === vintScore && vintScore > 0) {
        preferredEffect = style === 'vintage_retro' && Math.random() > 0.5 ? 'vintage_worms' : 'vintage_camera';
        reason = lyricText
          ? `🎞️ Kamera Jadul memberikan nuansa hangat/nostalgia pada lirik "${lyricText.slice(0, 30)}..."`
          : '🎞️ Kamera Jadul & sepia grading memberikan kesan emosional sinematik.';
      } else if (wormScore > 0) {
        preferredEffect = 'film_worms';
        reason = isIntro
          ? '🪱 Cacing-cacing seluloid di awal intro membangun atmosfer rekaman film kuno.'
          : `🪱 Efek Cacing & goresan seluloid menambah tekstur retro pada "${lyricText.slice(0, 30) || `frame #${idx + 1}`}".`;
      }
    }

    const totalInterest = maxScore + (isMidClimax ? 1.5 : 0) + (isIntro || isOutro ? 1.0 : 0);

    return {
      slide,
      index: idx,
      lyricText,
      distortionScore: distScore,
      vintageScore: vintScore,
      wormsScore: wormScore,
      preferredEffect,
      intensity: 0.8,
      reason,
      totalInterest,
    };
  });

  // 2. Select top slides to receive effects up to targetEffectCount
  // Sort candidate indices by total interest score descending
  const sortedCandidates = [...scored]
    .filter((s) => s.preferredEffect !== 'none')
    .sort((a, b) => b.totalInterest - a.totalInterest);

  const selectedIndices = new Set<number>();

  // Rhythmic spacing: Avoid putting effects on 3 consecutive slides unless density is heavy
  for (const item of sortedCandidates) {
    if (selectedIndices.size >= targetEffectCount) break;

    const idx = item.index;
    const hasPrev2 = selectedIndices.has(idx - 1) && selectedIndices.has(idx - 2);
    const hasNext2 = selectedIndices.has(idx + 1) && selectedIndices.has(idx + 2);

    if (!hasPrev2 && !hasNext2) {
      selectedIndices.add(idx);
    }
  }

  // If still below target count, fill in spaced out intervals (e.g. every 2nd or 3rd slide)
  if (selectedIndices.size < targetEffectCount) {
    const step = Math.max(2, Math.floor(totalSlides / targetEffectCount));
    for (let i = 0; i < totalSlides; i += step) {
      if (selectedIndices.size >= targetEffectCount) break;
      if (!selectedIndices.has(i)) {
        selectedIndices.add(i);
      }
    }
  }

  // 3. Compile final plan
  return scored.map((item, idx) => {
    const isSelected = selectedIndices.has(idx);
    let chosenEffect: VisualEffectType = isSelected ? item.preferredEffect : 'none';

    // If selected but preferred was none (filled by step), pick based on style
    if (isSelected && chosenEffect === 'none') {
      if (style === 'glitch_energy') {
        chosenEffect = 'distortion';
        item.reason = '⚡ Distorsi Glitch otomatis untuk menjaga tempo dinamis video.';
      } else if (style === 'grunge_8mm') {
        chosenEffect = 'film_worms';
        item.reason = '🪱 Goresan seluloid & cacing film reel untuk tekstur grunge analog.';
      } else if (style === 'vintage_retro') {
        chosenEffect = 'vintage_camera';
        item.reason = '🎞️ Warna kamera kuno & vignette film vintage.';
      } else {
        // Smart rotate
        const pool: VisualEffectType[] = ['distortion', 'vintage_camera', 'film_worms', 'vintage_worms'];
        chosenEffect = pool[idx % pool.length];
        item.reason = `✨ Efek ${VISUAL_EFFECT_OPTIONS.find((o) => o.id === chosenEffect)?.shortLabel} otomatis disematkan oleh AI Director.`;
      }
    }

    if (!isSelected) {
      chosenEffect = 'none';
      item.reason = 'Frame bersih alami (tanpa efek) agar penonton tidak lelah dan video tetap seimbang.';
    }

    return {
      slideId: item.slide.id || `slide-${idx}`,
      slideIndex: idx,
      slideName: item.slide.name || `Foto ${idx + 1}`,
      startSec: item.slide.startSec,
      endSec: item.slide.endSec,
      imageUrl: item.slide.url,
      matchedLyricText: item.lyricText,
      recommendedEffect: chosenEffect,
      intensity: 0.8,
      reason: item.reason,
    };
  });
}

/**
 * Groq LLM Director
 * Prompts Groq llama-3.3-70b-versatile to act as music video director
 */
export async function recommendSlideEffectsWithGroq(
  groqApiKey: string,
  slides: SlideItem[],
  lyrics: LyricSegment[] = [],
  totalDuration: number = 0,
  options: DirectorOptions = {}
): Promise<SlideEffectPlanItem[]> {
  const cleanKey = (groqApiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Groq API Key diperlukan untuk menggunakan analisis LLM.');
  }

  const style = options.stylePreset || 'cinematic_smart';
  const density = options.density || 'balanced';

  // Prepare concise slide summary
  const slideSummary = slides.map((s, idx) => ({
    index: idx,
    time: `${formatTimeMinSec(s.startSec)} - ${formatTimeMinSec(s.endSec)}`,
    lyric: findLyricForSlide(s, lyrics).slice(0, 60),
  }));

  const systemPrompt = `You are an elite music video visual director.
Your job is to recommend and apply camera visual effects to individual slide frames of a music video.
Available visual effects:
- "distortion": High energy, glitch, RGB split, beat drops, screams, heavy bass, climaxes.
- "vintage_camera": Warm nostalgia, memory, retro 8mm look, slow emotional lyrics, acoustic tones.
- "film_worms": Squiggly celluloid dust hairs, vintage scratches, intro, bridge, mystery, atmospheric gaps.
- "vintage_worms": Combination of vintage warm tone + film worms scratches.
- "none": CLEAN FRAME. Very important! Never apply effects to all slides! Keep breathing space (~${density === 'minimal' ? '80%' : density === 'heavy' ? '40%' : '65%'} of slides should remain "none").

Style Preset requested: ${style} (cinematic_smart = balanced variety; vintage_retro = mostly vintage; glitch_energy = mostly distortion; grunge_8mm = mostly worms).
Density requested: ${density}.

Output MUST be a strict JSON object with this exact schema:
{
  "recommendations": [
    {
      "slideIndex": number,
      "effect": "none" | "distortion" | "vintage_camera" | "film_worms" | "vintage_worms",
      "intensity": number (between 0.6 and 1.0),
      "reason": string in Indonesian (short explanation, max 15 words)
    }
  ]
}`;

  const userPrompt = `Here are the ${slides.length} slides in timeline order (total song duration: ${Math.round(totalDuration)}s):
${JSON.stringify(slideSummary, null, 2)}

Provide the recommended camera effect assignments in valid JSON.`;

  const isKoboi = cleanKey.startsWith('sk-') && !cleanKey.startsWith('gsk_');
  const endpoint = isKoboi
    ? 'https://api.koboillm.com/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';

  const requestedModel = options.model || (isKoboi ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile');
  const modelsToTry = isKoboi
    ? [requestedModel, 'gpt-4o-mini', 'gpt-4o']
    : [
        requestedModel,
        'llama-3.3-70b-versatile',
        'llama-3.3-70b-specdec',
        'deepseek-r1-distill-llama-70b',
        'llama-3.1-70b-versatile',
        'llama3-70b-8192',
        'llama-3.1-8b-instant',
        'llama3-8b-8192',
        'llama-3.2-3b-preview',
        'llama-3.2-1b-preview',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
        'qwen-2.5-32b',
      ].filter((v, i, a) => a.indexOf(v) === i); // unique list

  let lastError: Error | null = null;
  let parsed: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2500,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `API Error (${response.status})`;

        const isModelAccessError =
          response.status === 404 ||
          response.status === 400 ||
          errMsg.toLowerCase().includes('does not exist') ||
          errMsg.toLowerCase().includes('access') ||
          errMsg.toLowerCase().includes('decommissioned') ||
          errMsg.toLowerCase().includes('model_not_found');

        if (isModelAccessError && model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`Model "${model}" tidak dapat diakses (${errMsg}). Mengalihkan ke model cadangan...`);
          lastError = new Error(errMsg);
          continue;
        }

        throw new Error(errMsg);
      }

      const json = await response.json();
      let rawContent = json.choices?.[0]?.message?.content || '{}';
      // Strip markdown code fences if present
      rawContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(rawContent);
      break;
    } catch (err: any) {
      lastError = err;
      if (model === modelsToTry[modelsToTry.length - 1]) {
        throw err;
      }
    }
  }

  if (!parsed) {
    throw lastError || new Error('Gagal mendapatkan respon dari Groq AI.');
  }

  const rawList: any[] = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations
    : Array.isArray(parsed)
    ? parsed
    : [];

  const mapByIndex = new Map<number, { effect: VisualEffectType; intensity: number; reason: string }>();
  rawList.forEach((item) => {
    const idx = Number(item.slideIndex);
    if (!isNaN(idx)) {
      mapByIndex.set(idx, {
        effect: (item.effect as VisualEffectType) || 'none',
        intensity: Math.max(0.4, Math.min(1.0, Number(item.intensity) || 0.8)),
        reason: item.reason || 'Dianalisis oleh Groq AI Director.',
      });
    }
  });

  // Fallback to heuristic defaults for any missing indices
  const heuristicDefaults = recommendSlideEffectsHeuristic(slides, lyrics, totalDuration, options);

  return slides.map((slide, idx) => {
    const aiRec = mapByIndex.get(idx);
    const heur = heuristicDefaults[idx];

    return {
      slideId: slide.id || `slide-${idx}`,
      slideIndex: idx,
      slideName: slide.name || `Foto ${idx + 1}`,
      startSec: slide.startSec,
      endSec: slide.endSec,
      imageUrl: slide.url,
      matchedLyricText: findLyricForSlide(slide, lyrics),
      recommendedEffect: aiRec ? aiRec.effect : (heur?.recommendedEffect || 'none'),
      intensity: aiRec ? aiRec.intensity : 0.8,
      reason: aiRec ? aiRec.reason : (heur?.reason || 'Frame bersih alami.'),
    };
  });
}
