import type { LyricSegment, SlideItem } from '../types/visualizer';

export interface CleanedImageInfo {
  id: string;
  url: string;
  originalName: string;
  cleanName: string;
  keywords: string[];
}

export interface MatchResult {
  slide: SlideItem;
  cleanName: string;
  matchedLineText: string;
  confidence: number;
  reason: string;
  isReffRepeat?: boolean;
  repeatOccurrence?: number;
}

// Stop words to strip from filenames
const STOP_WORDS = new Set([
  'img', 'dsc', 'pxl', 'photo', 'foto', 'picture', 'pic', 'screenshot', 'image',
  'wp', 'wallpaper', 'background', 'bg', 'final', 'edit', 'copy', 'new',
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for',
  'dan', 'atau', 'di', 'ke', 'dari', 'yang', 'ini', 'itu', 'untuk', 'dengan'
]);

// Semantic keyword clusters (Indonesian & English)
const THEME_CLUSTERS: Record<string, string[]> = {
  rain: ['hujan', 'gerimis', 'rintik', 'badai', 'petir', 'air', 'dingin', 'basah', 'rain', 'storm', 'drizzle', 'thunder', 'wet', 'cold'],
  sunset: ['senja', 'sore', 'matahari', 'mentari', 'ufuk', 'jingga', 'merah', 'sunset', 'dusk', 'evening', 'sundown', 'golden', 'horizon'],
  night: ['malam', 'bintang', 'bulan', 'gelap', 'sunyi', 'sepi', 'kelam', 'tidur', 'night', 'stars', 'moon', 'dark', 'midnight', 'sleep'],
  morning: ['pagi', 'fajar', 'subuh', 'terbit', 'embun', 'siang', 'morning', 'dawn', 'sunrise', 'daybreak'],
  sea: ['pantai', 'laut', 'ombak', 'pasir', 'samudra', 'pulau', 'perahu', 'kapal', 'beach', 'sea', 'ocean', 'wave', 'sand', 'shore', 'island'],
  love: ['cinta', 'sayang', 'kasih', 'rindu', 'hati', 'kangen', 'romantis', 'peluk', 'cium', 'bersama', 'kekasih', 'pacar', 'love', 'heart', 'kiss', 'hug', 'miss', 'romantic', 'together', 'sweetheart'],
  sad: ['sedih', 'tangis', 'menangis', 'air mata', 'luka', 'duka', 'patah', 'kecewa', 'sendiri', 'sepi', 'hilang', 'pergi', 'goodbye', 'pisah', 'sad', 'cry', 'tears', 'broken', 'hurt', 'pain', 'alone', 'lonely', 'lost', 'sorrow'],
  happy: ['bahagia', 'senyum', 'tawa', 'ceria', 'gembira', 'menari', 'pesta', 'joget', 'semangat', 'happy', 'smile', 'laugh', 'joy', 'dance', 'party', 'celebrate', 'cheerful'],
  road: ['jalan', 'perjalanan', 'melangkah', 'berlari', 'lorong', 'arah', 'pulang', 'road', 'street', 'way', 'walk', 'run', 'journey', 'travel', 'home'],
  nature: ['gunung', 'hutan', 'pohon', 'bunga', 'taman', 'rumput', 'langit', 'alam', 'mountain', 'forest', 'tree', 'flower', 'garden', 'sky', 'nature'],
  music: ['musik', 'lagu', 'nada', 'melodi', 'gitar', 'piano', 'nyanyi', 'suara', 'music', 'song', 'guitar', 'piano', 'sing', 'voice', 'sound'],
  city: ['kota', 'gedung', 'lampu', 'malam', 'jalanan', 'ramai', 'city', 'building', 'lights', 'urban', 'traffic'],
  memory: ['kenangan', 'dulu', 'ingat', 'masa', 'lalu', 'foto', 'nostalgia', 'memory', 'remember', 'past', 'time', 'nostalgia', 'forever']
};

/**
 * Clean image filename into human readable text and semantic keyword tokens
 */
export function cleanImageFilename(filename: string): { cleanName: string; keywords: string[] } {
  if (!filename) return { cleanName: 'Foto', keywords: [] };

  // 1. Remove extension (.jpg, .png, etc.)
  let base = filename.replace(/\.[a-zA-Z0-9]+$/, '');

  // 2. Remove numeric camera prefixes like IMG_20240909_..., DSC_0012, Screenshot_2024-...
  base = base.replace(/^(img|dsc|pxl|screenshot|photo|foto|pic|image)[_\-\s0-9]+/i, '');

  // 3. Remove leading track/order numbers like "01 - ", "01_", "1. "
  base = base.replace(/^[0-9]+[\s\._\-]+/, '');

  // 4. Replace separators with space
  base = base.replace(/[_.\-+~/]+/g, ' ');

  // 5. Remove trailing digits
  base = base.replace(/[\s_\-]+[0-9]+$/, '');

  // 6. Tokenize
  const rawTokens = base
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));

  const cleanName = base.trim() ? base.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Foto Slide';

  return {
    cleanName,
    keywords: rawTokens
  };
}

/**
 * Calculate semantic keyword overlap score between image keywords and lyric text
 */
function scoreSegmentMatch(keywords: string[], lyricText: string): { score: number; matchedReason: string } {
  const normLyric = lyricText.toLowerCase();
  let score = 0;
  const matchedWords: string[] = [];

  for (const kw of keywords) {
    // 1. Exact full word match
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normLyric)) {
      score += 10;
      matchedWords.push(kw);
      continue;
    }

    // 2. Substring match (min 3 chars)
    if (kw.length >= 3 && normLyric.includes(kw)) {
      score += 6;
      matchedWords.push(`~${kw}`);
      continue;
    }

    // 3. Semantic cluster match
    for (const synonyms of Object.values(THEME_CLUSTERS)) {
      if (synonyms.includes(kw)) {
        // Check if lyric contains any synonym from this cluster
        for (const syn of synonyms) {
          if (normLyric.includes(syn)) {
            score += 4;
            matchedWords.push(`${kw}↔${syn}`);
            break;
          }
        }
      }
    }
  }

  return {
    score,
    matchedReason: matchedWords.length > 0 ? `Cocok kata: ${matchedWords.join(', ')}` : ''
  };
}

function normalizeLyricText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function areLyricsSimilar(textA: string, textB: string): boolean {
  const normA = normalizeLyricText(textA);
  const normB = normalizeLyricText(textB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length >= 8 && normB.length >= 8) {
    if (normA.includes(normB) || normB.includes(normA)) {
      const minLen = Math.min(normA.length, normB.length);
      const maxLen = Math.max(normA.length, normB.length);
      if (minLen / maxLen >= 0.6) return true;
    }
  }
  return false;
}

/**
 * Heuristic Offline AI Matcher:
 * Analyzes image filenames, matches them to lyric segments, and builds seamlessly distributed timeline slides.
 * Supports repeating matching images across repeated Reffs / Choruses.
 */
export function heuristicMatchImagesToLyrics(
  images: Array<{ url: string; name: string }>,
  lyrics: LyricSegment[],
  totalDuration: number,
  allowReffReuse: boolean = true
): MatchResult[] {
  if (!images || images.length === 0) return [];
  const duration = Math.max(10, totalDuration || 60);

  // If no lyrics, distribute evenly
  if (!lyrics || lyrics.length === 0) {
    const interval = duration / images.length;
    return images.map((img, idx) => {
      const { cleanName } = cleanImageFilename(img.name);
      const start = idx * interval;
      const end = idx === images.length - 1 ? duration : (idx + 1) * interval;
      return {
        slide: {
          id: `slide-heuristic-${idx}-${Date.now()}`,
          url: img.url,
          name: cleanName,
          startSec: Math.round(start * 10) / 10,
          endSec: Math.round(end * 10) / 10,
          confidence: 50,
        },
        cleanName,
        matchedLineText: '(Tidak ada lirik - interval merata)',
        confidence: 50,
        reason: 'Interval waktu merata'
      };
    });
  }

  // Clean all image names
  const cleanedImages: CleanedImageInfo[] = images.map((img, idx) => {
    const { cleanName, keywords } = cleanImageFilename(img.name);
    return {
      id: `img-${idx}`,
      url: img.url,
      originalName: img.name,
      cleanName,
      keywords
    };
  });

  interface CandidateItem {
    imageIdx: number;
    lyricIdx: number;
    lyric: LyricSegment;
    score: number;
    reason: string;
    isReffRepeat?: boolean;
    repeatOccurrence?: number;
  }

  const allCandidates: CandidateItem[] = [];

  // Step 1: Compute Primary Match for each image
  cleanedImages.forEach((cImg, imgIdx) => {
    let bestScore = 0;
    let bestLIdx = -1;
    let bestReason = '';

    lyrics.forEach((lyric, lIdx) => {
      const { score, matchedReason } = scoreSegmentMatch(cImg.keywords, lyric.text);
      if (score > bestScore) {
        bestScore = score;
        bestLIdx = lIdx;
        bestReason = matchedReason;
      }
    });

    if (bestLIdx === -1) {
      // Fallback proportional target
      const propPos = (imgIdx / Math.max(1, cleanedImages.length)) * lyrics.length;
      bestLIdx = Math.min(lyrics.length - 1, Math.floor(propPos));
      bestReason = 'Distribusi urutan lagu';
    }

    allCandidates.push({
      imageIdx: imgIdx,
      lyricIdx: bestLIdx,
      lyric: lyrics[bestLIdx],
      score: bestScore,
      reason: bestReason || 'Sesuai dengan lirik',
      isReffRepeat: false,
      repeatOccurrence: 1
    });

    // Step 2: If allowReffReuse is enabled and this image has a meaningful match,
    // detect if the matching lyric repeats later in the song (Reff / Chorus)
    // or if the image keywords match later sections (at least 15 seconds apart)
    if (allowReffReuse && bestScore >= 4) {
      const primaryLyric = lyrics[bestLIdx];
      let occurrenceCount = 1;

      lyrics.forEach((otherLyric, otherLIdx) => {
        if (otherLIdx === bestLIdx) return;
        // Must be spaced at least 15 seconds away from primary match to be considered another section (e.g. Reff 2 / Reff 3)
        if (Math.abs(otherLyric.start - primaryLyric.start) < 15) return;

        // Check if otherLyric is a repeating Reff/chorus line of primaryLyric,
        // or if it strongly matches the image keywords
        const isRepeatedReffLine = areLyricsSimilar(otherLyric.text, primaryLyric.text);
        const otherScore = scoreSegmentMatch(cImg.keywords, otherLyric.text);

        if (isRepeatedReffLine || otherScore.score >= 8) {
          occurrenceCount++;
          allCandidates.push({
            imageIdx: imgIdx,
            lyricIdx: otherLIdx,
            lyric: otherLyric,
            score: isRepeatedReffLine ? Math.max(bestScore, 10) : otherScore.score,
            reason: isRepeatedReffLine
              ? `🔁 Reff Berulang: "${otherLyric.text.slice(0, 30)}..."`
              : `🔁 Reff / Tema Berulang: ${otherScore.matchedReason || 'Cocok kata'}`,
            isReffRepeat: true,
            repeatOccurrence: occurrenceCount
          });
        }
      });
    }
  });

  // Sort all candidates chronologically by lyric start time
  const sorted = [...allCandidates].sort((a, b) => a.lyric.start - b.lyric.start);

  // Filter out any candidates that start too close to an earlier candidate (< 3.5s apart)
  const filteredCandidates: CandidateItem[] = [];
  for (const c of sorted) {
    if (filteredCandidates.length === 0) {
      filteredCandidates.push(c);
      continue;
    }
    const prev = filteredCandidates[filteredCandidates.length - 1];
    if (c.lyric.start - prev.lyric.start >= 3.5) {
      filteredCandidates.push(c);
    } else if (c.score > prev.score && prev.isReffRepeat) {
      filteredCandidates[filteredCandidates.length - 1] = c;
    }
  }

  // Ensure every unique image is present in filteredCandidates
  cleanedImages.forEach((_, imgIdx) => {
    if (!filteredCandidates.find((fc) => fc.imageIdx === imgIdx)) {
      const originalPrimary = allCandidates.find((ac) => ac.imageIdx === imgIdx && !ac.isReffRepeat);
      if (originalPrimary) {
        filteredCandidates.push(originalPrimary);
      }
    }
  });

  // Re-sort chronologically
  filteredCandidates.sort((a, b) => a.lyric.start - b.lyric.start);

  // Build continuous time ranges without gaps
  const results: MatchResult[] = [];
  const count = filteredCandidates.length;

  for (let i = 0; i < count; i++) {
    const item = filteredCandidates[i];
    const cImg = cleanedImages[item.imageIdx];
    const lyric = item.lyric;

    let start = lyric.start;
    if (i === 0) {
      start = 0;
    }

    let end: number;
    if (i < count - 1) {
      const nextLyric = filteredCandidates[i + 1].lyric;
      end = Math.max(start + 2.5, nextLyric.start);
      if (end >= duration) end = duration - 1;
    } else {
      end = duration;
    }

    if (end <= start) {
      end = Math.min(duration, start + 3.5);
    }

    const confidence = item.score > 0 ? Math.min(98, 65 + item.score * 3) : 60;

    results.push({
      slide: {
        id: `slide-ai-${item.imageIdx}-${item.isReffRepeat ? `rep${item.repeatOccurrence}` : 'p'}-${i}-${Date.now()}`,
        url: cImg.url,
        name: cImg.cleanName,
        startSec: Math.round(start * 10) / 10,
        endSec: Math.round(end * 10) / 10,
        matchedLyricId: lyric.id,
        matchedLyricText: lyric.text,
        confidence
      },
      cleanName: cImg.cleanName,
      matchedLineText: lyric.text,
      confidence,
      reason: item.reason,
      isReffRepeat: item.isReffRepeat,
      repeatOccurrence: item.repeatOccurrence
    });
  }

  // Normalize any overlaps
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i].slide.endSec > results[i + 1].slide.startSec) {
      results[i].slide.endSec = results[i + 1].slide.startSec;
    }
  }

  return results;
}

/**
 * Groq LLM Semantic Matcher:
 * Calls Groq chat completion API (using llama-3.1-8b-instant) to deeply analyze
 * Indonesian and poetic context between image names and lyrics.
 */
export async function groqLlmMatchImagesToLyrics(
  apiKey: string,
  images: Array<{ url: string; name: string }>,
  lyrics: LyricSegment[],
  totalDuration: number,
  allowReffReuse: boolean = true
): Promise<MatchResult[]> {
  if (!apiKey) {
    throw new Error('Groq API Key tidak ditemukan. Silakan masukkan Groq API Key terlebih dahulu.');
  }

  if (!images || images.length === 0) return [];
  const duration = Math.max(10, totalDuration || 60);

  if (!lyrics || lyrics.length === 0) {
    return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse);
  }

  // Prepare condensed prompt payload
  const imageSummaries = images.map((img, idx) => {
    const { cleanName, keywords } = cleanImageFilename(img.name);
    return {
      index: idx,
      rawFilename: img.name,
      cleanName,
      keywords: keywords.join(', ')
    };
  });

  const lyricSummaries = lyrics.map((l, idx) => ({
    index: idx,
    id: l.id,
    start: Math.round(l.start * 10) / 10,
    end: Math.round(l.end * 10) / 10,
    text: l.text
  }));

  const systemPrompt = `You are an expert music video director. Match background slideshow images to song lyrics based on semantic meaning, mood, and keywords in Indonesian and English.
${
  allowReffReuse
    ? 'IMPORTANT: If the song has a repeating Chorus/Reff or recurring lyric theme, an image that matches the chorus CAN and SHOULD be used again for each occurrence of that chorus so the image reappears at subsequent Reffs (same imageIndex mapped to later matchedLyricIndex, spaced at least 15 seconds apart).'
    : 'Each image should only appear once.'
}
Return ONLY valid JSON with no markdown wrapping, no extra text:
[
  {
    "imageIndex": 0,
    "matchedLyricIndex": 2,
    "confidence": 92,
    "reason": "Penjelasan singkat kecocokan"
  }
]`;

  const userPrompt = `Total Song Duration: ${duration} seconds.
IMAGES:
${JSON.stringify(imageSummaries, null, 2)}

LYRIC TIMELINE:
${JSON.stringify(lyricSummaries, null, 2)}

Match each image (imageIndex 0 to ${images.length - 1}) to the most emotionally or contextually appropriate lyricIndex.${
    allowReffReuse
      ? ' When a chorus/reff repeats in the song, reuse the matching image so it appears at each repeated chorus.'
      : ''
  } Ensure chronological order where possible. Return JSON array.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Groq API Error HTTP ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip markdown code fences if present
    content = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();

    const parsed: Array<{
      imageIndex: number;
      matchedLyricIndex: number;
      confidence?: number;
      reason?: string;
    }> = JSON.parse(content);

    // Build timeline results with occurrence tracking
    const occurrenceCountMap = new Map<number, number>();

    const mappedCandidates = parsed.map((p) => {
      const imgIdx = Math.max(0, Math.min(images.length - 1, p.imageIndex));
      const lIdx = Math.max(0, Math.min(lyrics.length - 1, p.matchedLyricIndex));
      const targetLyric = lyrics[lIdx];
      const { cleanName } = cleanImageFilename(images[imgIdx].name);

      const count = (occurrenceCountMap.get(imgIdx) || 0) + 1;
      occurrenceCountMap.set(imgIdx, count);
      const isReffRepeat = count > 1;

      return {
        imageIdx: imgIdx,
        cleanName,
        url: images[imgIdx].url,
        lyric: targetLyric,
        confidence: p.confidence || 85,
        reason: isReffRepeat
          ? `🔁 Reff Berulang: "${targetLyric.text.slice(0, 30)}..."`
          : (p.reason || 'Kecocokan semantik AI Groq'),
        isReffRepeat,
        repeatOccurrence: count
      };
    });

    // Ensure all images are included at least once
    images.forEach((img, idx) => {
      if (!mappedCandidates.find((m) => m.imageIdx === idx)) {
        const { cleanName } = cleanImageFilename(img.name);
        const lIdx = Math.min(lyrics.length - 1, Math.floor((idx / images.length) * lyrics.length));
        mappedCandidates.push({
          imageIdx: idx,
          cleanName,
          url: img.url,
          lyric: lyrics[lIdx],
          confidence: 70,
          reason: 'Penataan urutan timeline otomatis',
          isReffRepeat: false,
          repeatOccurrence: 1
        });
      }
    });

    // Sort chronologically by lyric start
    mappedCandidates.sort((a, b) => a.lyric.start - b.lyric.start);

    // Build continuous time ranges
    const results: MatchResult[] = [];
    const total = mappedCandidates.length;

    for (let i = 0; i < total; i++) {
      const item = mappedCandidates[i];
      let start = item.lyric.start;
      if (i === 0) start = 0;

      let end: number;
      if (i < total - 1) {
        end = Math.max(start + 2.5, mappedCandidates[i + 1].lyric.start);
      } else {
        end = duration;
      }

      if (end <= start) {
        end = Math.min(duration, start + 3.5);
      }

      results.push({
        slide: {
          id: `slide-groq-${item.imageIdx}-${item.isReffRepeat ? `rep${item.repeatOccurrence}` : 'p'}-${i}-${Date.now()}`,
          url: item.url,
          name: item.cleanName,
          startSec: Math.round(start * 10) / 10,
          endSec: Math.round(end * 10) / 10,
          matchedLyricId: item.lyric.id,
          matchedLyricText: item.lyric.text,
          confidence: item.confidence
        },
        cleanName: item.cleanName,
        matchedLineText: item.lyric.text,
        confidence: item.confidence,
        reason: item.reason,
        isReffRepeat: item.isReffRepeat,
        repeatOccurrence: item.repeatOccurrence
      });
    }

    // Fix overlaps
    for (let i = 0; i < results.length - 1; i++) {
      if (results[i].slide.endSec > results[i + 1].slide.startSec) {
        results[i].slide.endSec = results[i + 1].slide.startSec;
      }
    }

    return results;
  } catch (err: any) {
    console.warn('Groq LLM matcher fallback to heuristic:', err?.message);
    return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse);
  }
}
