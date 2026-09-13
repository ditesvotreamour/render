import type { LyricSegment, SlideItem } from '../types/visualizer';
import { isVideoMedia } from './zipImageExtractor';

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
  isFilenameTimestamp?: boolean;
}

export interface FilenameTimestamp {
  startSec: number;
  endSec?: number;
  frameIndex?: number;
  extractedTitle: string;
  rawMatched: string;
}

/**
 * Parse any time string into total seconds.
 * Supports:
 * - "00-00-09,640" / "00:00:09.640" / "00_00_09_640" -> 9.64s
 * - "01_23" / "01:23" / "01-23" -> 83s
 * - "00-45" / "00:45" / "00_45" -> 45s
 */
export function parseTimestampStringToSeconds(tStr: string): number | null {
  if (!tStr) return null;
  const clean = tStr.trim();
  let ms = 0;
  let mainPart = clean;

  // Check for milliseconds at the end (,mmm or .mmm)
  const msMatch = clean.match(/[,.](\d{1,3})$/);
  if (msMatch) {
    ms = parseInt(msMatch[1].padEnd(3, '0'), 10) / 1000;
    mainPart = clean.slice(0, msMatch.index);
  }

  const parts = mainPart.split(/[-_:]+/).filter(Boolean);
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && m < 60 && s < 60) {
      return Math.round((h * 3600 + m * 60 + s + ms) * 1000) / 1000;
    }
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && s < 60) {
      return Math.round((m * 60 + s + ms) * 1000) / 1000;
    }
  } else if (parts.length === 4) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    const msec = parseInt(parts[3].padEnd(3, '0'), 10) / 1000;
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && m < 60 && s < 60) {
      return Math.round((h * 3600 + m * 60 + s + msec) * 1000) / 1000;
    }
  }
  return null;
}

/**
 * Format seconds into mm:ss
 */
export function formatMinSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parse timestamp directly from image/video filename.
 * Supports:
 * - Frame prefix with SRT range: 04_[00-00-09,640_to_00-00-12,720]_Padahal_dompet_tipis_cicilan_m.mp4 -> Frame 4, 9.64s to 12.72s
 * - Standalone range: [00-00-09,640_to_00-00-12,720].mp4, 01_15-01_30.jpg, 00_15_00_30.mp4
 * - Single timestamp: 01_23.jpg, 00_45.mp4, reff_01_23.jpg, 01_23_reff.png, [01_23].mp4
 * - Direct seconds: 45s.mp4, 45_detik.mp4, 120s_solo.jpg
 * Excludes auto-generated camera dates (IMG_2024..., DSC_..., Screenshot_...)
 */
export function parseTimestampFromFilename(filename: string, maxDuration?: number): FilenameTimestamp | null {
  if (!filename) return null;

  // 1. Remove file extension (.jpg, .mp4, .png, etc.)
  const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  // 2. Reject camera / device automatic names (e.g. IMG_20240912_143022, DSC_0001, Screenshot_2024...)
  if (/^(img|dsc|pxl|screenshot|photo|foto|pic)[_\-\s]*[0-9]{6,}/i.test(nameWithoutExt)) {
    return null;
  }
  if (/(202[0-9]{5}|201[0-9]{5})/.test(nameWithoutExt)) {
    return null;
  }

  let startSec: number | null = null;
  let endSec: number | undefined = undefined;
  let rawMatched = '';
  let titlePart = nameWithoutExt;
  let frameIndex: number | undefined = undefined;

  // Pattern 1: Range with separator (to, _to_, -, –, —, sampai, _)
  // e.g. "04_[00-00-09,640_to_00-00-12,720]_Padahal...", "01_15-01_30", "00_15_00_30", "[01_15-01_30]"
  const rangeRegex = /(?:^|[\[\(_\-\s])(\d{1,2}[-_:]\d{2}(?:[-_:]\d{2})?(?:[,.]\d{1,3})?)\s*(?:_to_|\s+to\s+|_sampai_|\s*-\s*|\s*–\s*|\s*—\s*|_)\s*(\d{1,2}[-_:]\d{2}(?:[-_:]\d{2})?(?:[,.]\d{1,3})?)(?:[\]\)_-\s]|$)/i;
  const rangeMatch = nameWithoutExt.match(rangeRegex);

  if (rangeMatch) {
    const s = parseTimestampStringToSeconds(rangeMatch[1]);
    const e = parseTimestampStringToSeconds(rangeMatch[2]);

    if (s !== null && e !== null && e > s && (maxDuration === undefined || s <= maxDuration)) {
      startSec = s;
      endSec = e;
      rawMatched = rangeMatch[0].trim();

      // Check for frame prefix before the timestamp (e.g. "04_", "frame_4_")
      const matchIdx = rangeMatch.index ?? 0;
      const prefixBefore = nameWithoutExt.slice(0, matchIdx);
      const frameMatch = prefixBefore.match(/^(?:frame[_\-\s]*)?(\d+)[_\-\s]*$/i);
      if (frameMatch) {
        frameIndex = parseInt(frameMatch[1], 10);
      }

      const afterMatch = nameWithoutExt.slice(matchIdx + rangeMatch[0].length);
      titlePart = [prefixBefore && !frameMatch ? prefixBefore : '', afterMatch].filter(Boolean).join(' ');
    }
  }

  // Pattern 2: Single timestamp with mm_ss, mm:ss or hh-mm-ss,mmm
  // e.g. "01_23", "00_45", "[01_23]", "reff_01_23", "01_23_reff", "01:23"
  if (startSec === null) {
    const singleRegex = /(?:^|[\[\(_\-\s])(\d{1,2}[-_:]\d{2}(?:[-_:]\d{2})?(?:[,.]\d{1,3})?)(?:[\]\)_-\s]|$)/i;
    const singleMatch = nameWithoutExt.match(singleRegex);

    if (singleMatch) {
      const parsed = parseTimestampStringToSeconds(singleMatch[1]);
      if (parsed !== null && (maxDuration === undefined || parsed <= maxDuration)) {
        startSec = parsed;
        rawMatched = singleMatch[0].trim();

        const singleIdx = singleMatch.index ?? 0;
        const prefixBefore = nameWithoutExt.slice(0, singleIdx);
        const frameMatch = prefixBefore.match(/^(?:frame[_\-\s]*)?(\d+)[_\-\s]*$/i);
        if (frameMatch) {
          frameIndex = parseInt(frameMatch[1], 10);
        }

        const afterMatch = nameWithoutExt.slice(singleIdx + singleMatch[0].length);
        titlePart = [prefixBefore && !frameMatch ? prefixBefore : '', afterMatch].filter(Boolean).join(' ');
      }
    }
  }

  // Pattern 3: Seconds with suffix e.g. "45s", "45_detik", "120s"
  if (startSec === null) {
    const secSuffixRegex = /(?:^|[\[\(_\-\s])(\d{1,4})\s*(?:s|sec|detik)(?:[\]\)_-\s]|$)/i;
    const secMatch = nameWithoutExt.match(secSuffixRegex);
    if (secMatch) {
      const parsedSec = parseInt(secMatch[1], 10);
      if (parsedSec >= 0 && (maxDuration === undefined || parsedSec <= maxDuration)) {
        startSec = parsedSec;
        rawMatched = secMatch[0].trim();
        titlePart = nameWithoutExt.replace(secMatch[0], ' ').trim();
      }
    }
  }

  if (startSec === null) return null;

  const cleanedTitle = titlePart
    .replace(/[\[\]\(\)_.\-+~/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    startSec,
    endSec,
    frameIndex,
    extractedTitle: cleanedTitle || '',
    rawMatched
  };
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

  const ts = parseTimestampFromFilename(filename);

  // 1. Remove extension (.jpg, .png, etc.)
  let base = filename.replace(/\.[a-zA-Z0-9]+$/, '');

  // If timestamp parsed, strip the raw matched timestamp from keywords
  if (ts && ts.rawMatched) {
    base = base.replace(ts.rawMatched, ' ');
  }

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

  let cleanName = '';
  if (ts) {
    const timeLabel = ts.endSec !== undefined
      ? `${formatMinSec(ts.startSec)} - ${formatMinSec(ts.endSec)}`
      : formatMinSec(ts.startSec);
    const title = ts.extractedTitle
      ? ts.extractedTitle.replace(/\b\w/g, (c) => c.toUpperCase())
      : '';
    const frameLabel = ts.frameIndex !== undefined ? `Frame ${ts.frameIndex}` : '';

    if (frameLabel && title) {
      cleanName = `${frameLabel}: ${title} (${timeLabel})`;
    } else if (frameLabel) {
      cleanName = `${frameLabel} (${timeLabel})`;
    } else if (title) {
      cleanName = `${title} (${timeLabel})`;
    } else {
      cleanName = `Media (${timeLabel})`;
    }
  } else {
    cleanName = base.trim() ? base.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Foto Slide';
  }

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

export interface GapFillOptions {
  enabled?: boolean;
  maxGapSec?: number; // e.g. 7.0 seconds
  slideIntervalSec?: number; // e.g. 4.5 seconds
}

/**
 * Heuristic Offline AI Matcher:
 * Analyzes image filenames, matches them to lyric segments, and builds seamlessly distributed timeline slides.
 * Supports:
 * 1. PRIORITY 1: Filename timestamps (e.g. 01_23.jpg, 00_15_00_30.mp4, reff_01_23.png)
 * 2. PRIORITY 2: Semantic keyword analysis and distribution for non-timestamp media
 * 3. Repeating matching images across repeated Reffs / Choruses.
 */
export function heuristicMatchImagesToLyrics(
  images: Array<{ url: string; name: string }>,
  lyrics: LyricSegment[],
  totalDuration: number,
  allowReffReuse: boolean = true,
  options?: GapFillOptions
): MatchResult[] {
  if (!images || images.length === 0) return [];
  const duration = Math.max(10, totalDuration || 60);

  // 1. Parse all images for filename timestamps and clean names
  const parsedImages = images.map((img, idx) => {
    const ts = parseTimestampFromFilename(img.name, duration);
    const { cleanName, keywords } = cleanImageFilename(img.name);
    return {
      index: idx,
      img,
      ts,
      cleanName,
      keywords,
    };
  });

  const tsItems = parsedImages.filter((p) => p.ts !== null);
  const nonTsItems = parsedImages.filter((p) => p.ts === null);

  // If there are files with timestamps in their filenames, process them with Priority 1
  if (tsItems.length > 0) {
    // Sort timestamp items chronologically
    tsItems.sort((a, b) => a.ts!.startSec - b.ts!.startSec);

    // Deduplicate: If multiple items share the same frameIndex or startSec (e.g. clips/ video and storyboard/ image):
    // Prioritize video clips over storyboard images!
    const deduplicatedTsItems: typeof tsItems = [];
    const seenSlots = new Map<string, typeof tsItems[0]>();

    for (const item of tsItems) {
      const isVid = isVideoMedia(item.img.name, (item.img as any).mediaType);
      const slotKey = item.ts!.frameIndex !== undefined
        ? `frame-${item.ts!.frameIndex}`
        : `sec-${item.ts!.startSec.toFixed(1)}`;

      if (!seenSlots.has(slotKey)) {
        seenSlots.set(slotKey, item);
        deduplicatedTsItems.push(item);
      } else {
        const existing = seenSlots.get(slotKey)!;
        const existingIsVid = isVideoMedia(existing.img.name, (existing.img as any).mediaType);
        // If existing is image, but current is video: replace with video!
        if (!existingIsVid && isVid) {
          const idx = deduplicatedTsItems.indexOf(existing);
          if (idx !== -1) {
            deduplicatedTsItems[idx] = item;
            seenSlots.set(slotKey, item);
          }
        }
      }
    }

    const tsResults: MatchResult[] = [];
    const claimedLyricIds = new Set<string>();

    for (let i = 0; i < deduplicatedTsItems.length; i++) {
      const item = deduplicatedTsItems[i];
      const ts = item.ts!;
      const start = Math.min(duration - 0.5, Math.max(0, ts.startSec));
      let end: number;

      if (ts.endSec !== undefined && ts.endSec > start) {
        end = Math.min(duration, ts.endSec);
      } else if (i < deduplicatedTsItems.length - 1) {
        const nextStart = deduplicatedTsItems[i + 1].ts!.startSec;
        end = Math.min(duration, Math.max(start + 2.5, nextStart));
      } else {
        end = Math.min(duration, start + 5.0);
      }

      if (end <= start) {
        end = Math.min(duration, start + 3.5);
      }

      // Find matching lyric for this timestamp
      let matchedLyric: LyricSegment | undefined;
      if (lyrics && lyrics.length > 0) {
        matchedLyric = lyrics.find((l) => l.start <= start && l.end >= start);
        if (!matchedLyric) {
          let closestDist = Infinity;
          for (const lyr of lyrics) {
            const dist = Math.abs(lyr.start - start);
            if (dist < closestDist && dist <= 4.0) {
              closestDist = dist;
              matchedLyric = lyr;
            }
          }
        }
      }

      let lyricText = '';
      let reason = '';
      if (matchedLyric) {
        claimedLyricIds.add(matchedLyric.id);
        lyricText = matchedLyric.text;
        reason = `⏱️ Timestamp file (${formatMinSec(start)}) ➔ Lirik: "${matchedLyric.text.slice(0, 32)}..."`;
      } else if (ts.extractedTitle) {
        lyricText = ts.extractedTitle;
        reason = ts.frameIndex !== undefined
          ? `⏱️ Frame ${ts.frameIndex} (${formatMinSec(start)}) ➔ "${ts.extractedTitle}"`
          : `⏱️ Timestamp file (${formatMinSec(start)}) ➔ "${ts.extractedTitle}"`;
      } else {
        lyricText = `(Posisi ${formatMinSec(start)})`;
        reason = `⏱️ Posisi tepat sesuai nama file (${formatMinSec(start)})`;
      }

      const isVid = isVideoMedia(item.img.name, (item.img as any).mediaType);

      tsResults.push({
        slide: {
          id: `slide-ts-${item.index}-${Date.now()}-${i}`,
          url: item.img.url,
          name: item.cleanName,
          startSec: Math.round(start * 100) / 100,
          endSec: Math.round(end * 100) / 100,
          matchedLyricId: matchedLyric?.id,
          matchedLyricText: lyricText,
          confidence: 100,
          mediaType: isVid ? 'video' : 'image',
        },
        cleanName: item.cleanName,
        matchedLineText: lyricText,
        confidence: 100,
        reason,
        isReffRepeat: false,
        isFilenameTimestamp: true,
      });
    }

    // Now handle non-timestamp items (Priority 2: matched to unoccupied lyrics or gaps)
    const nonTsResults: MatchResult[] = [];
    if (nonTsItems.length > 0) {
      const availableLyrics = (lyrics || []).filter((l) => !claimedLyricIds.has(l.id));

      if (availableLyrics.length > 0) {
        // Run semantic keyword matching against unoccupied lyrics
        nonTsItems.forEach((cImg) => {
          let bestScore = 0;
          let bestLyric: LyricSegment | null = null;
          let bestReason = '';

          availableLyrics.forEach((lyric) => {
            const { score, matchedReason } = scoreSegmentMatch(cImg.keywords, lyric.text);
            if (score > bestScore) {
              bestScore = score;
              bestLyric = lyric;
              bestReason = matchedReason;
            }
          });

          if (!bestLyric) {
            // Proportional assignment among available lyrics
            const propIdx = Math.min(
              availableLyrics.length - 1,
              Math.floor((cImg.index / Math.max(1, images.length)) * availableLyrics.length)
            );
            bestLyric = availableLyrics[propIdx];
            bestReason = 'Distribusi bagian lagu yang tersedia';
          }

          const start = bestLyric.start;
          const end = Math.min(duration, Math.max(start + 3.0, bestLyric.end));

          nonTsResults.push({
            slide: {
              id: `slide-nonts-${cImg.index}-${Date.now()}`,
              url: cImg.img.url,
              name: cImg.cleanName,
              startSec: Math.round(start * 10) / 10,
              endSec: Math.round(end * 10) / 10,
              matchedLyricId: bestLyric.id,
              matchedLyricText: bestLyric.text,
              confidence: bestScore > 0 ? Math.min(95, 60 + bestScore * 3) : 60,
            },
            cleanName: cImg.cleanName,
            matchedLineText: bestLyric.text,
            confidence: bestScore > 0 ? Math.min(95, 60 + bestScore * 3) : 60,
            reason: bestReason || 'Sesuai konteks lirik',
            isReffRepeat: false,
            isFilenameTimestamp: false,
          });
        });
      } else {
        // No unoccupied lyrics: distribute non-timestamp items evenly across song duration
        const interval = duration / (nonTsItems.length + 1);
        nonTsItems.forEach((cImg, nIdx) => {
          const start = (nIdx + 0.5) * interval;
          const end = Math.min(duration, start + interval);
          nonTsResults.push({
            slide: {
              id: `slide-nonts-slot-${cImg.index}-${Date.now()}`,
              url: cImg.img.url,
              name: cImg.cleanName,
              startSec: Math.round(start * 10) / 10,
              endSec: Math.round(end * 10) / 10,
              confidence: 60,
            },
            cleanName: cImg.cleanName,
            matchedLineText: '(Distribusi jeda visual)',
            confidence: 60,
            reason: 'Distribusi jeda visual merata',
            isReffRepeat: false,
            isFilenameTimestamp: false,
          });
        });
      }
    }

    // Merge timestamp and non-timestamp items, sorted chronologically
    const merged = [...tsResults, ...nonTsResults].sort((a, b) => a.slide.startSec - b.slide.startSec);

    const hasExplicitRanges = tsItems.some((t) => t.ts?.endSec !== undefined);

    if (hasExplicitRanges) {
      // With explicit timestamps (e.g. 04_[00-00-09,640_to_00-00-12,720]):
      // Preserve exact startSec and endSec for each frame.
      const framedResults: MatchResult[] = [];

      // If first slide starts after 0s, insert intro slide(s) to bridge from 0 to first slide start
      if (merged.length > 0 && merged[0].slide.startSec > 0.1) {
        const introStart = 0;
        const introEnd = merged[0].slide.startSec;
        const firstImg = images[0] || { url: merged[0].slide.url, name: merged[0].slide.name };
        const firstMediaType = (firstImg as any).mediaType || (isVideoMedia(firstImg.name) ? 'video' : 'image');
        framedResults.push({
          slide: {
            id: `slide-intro-prefix-${Date.now()}`,
            url: firstImg.url,
            name: `[Intro] ${cleanImageFilename(firstImg.name).cleanName}`,
            startSec: introStart,
            endSec: introEnd,
            confidence: 90,
            mediaType: firstMediaType,
          },
          cleanName: cleanImageFilename(firstImg.name).cleanName,
          matchedLineText: '[Intro Musik]',
          confidence: 90,
          reason: `🎸 Intro Musik (00:00 - ${formatMinSec(introEnd)})`,
          isReffRepeat: false,
          isFilenameTimestamp: false,
        });
      }

      for (let i = 0; i < merged.length; i++) {
        const cur = merged[i];
        framedResults.push(cur);

        // Check if there is an unassigned gap before next slide
        if (i < merged.length - 1) {
          const nextStart = merged[i + 1].slide.startSec;
          if (cur.slide.endSec < nextStart - 0.2) {
            // Fill gap between frames with a bridge slide
            const bridgeImg = images[(i + 1) % images.length];
            const bridgeMediaType = (bridgeImg as any).mediaType || (isVideoMedia(bridgeImg.name) ? 'video' : 'image');
            framedResults.push({
              slide: {
                id: `slide-bridge-${i}-${Date.now()}`,
                url: bridgeImg.url,
                name: `[Jeda] ${cleanImageFilename(bridgeImg.name).cleanName}`,
                startSec: cur.slide.endSec,
                endSec: nextStart,
                confidence: 80,
                mediaType: bridgeMediaType,
              },
              cleanName: cleanImageFilename(bridgeImg.name).cleanName,
              matchedLineText: '[Transisi]',
              confidence: 80,
              reason: `Visual jeda (${formatMinSec(cur.slide.endSec)} - ${formatMinSec(nextStart)})`,
              isReffRepeat: false,
              isFilenameTimestamp: false,
            });
          } else if (cur.slide.endSec > nextStart) {
            // Ensure no overlap
            cur.slide.endSec = nextStart;
          }
        }
      }

      // If last slide ends before song duration, insert outro slide
      const last = framedResults[framedResults.length - 1];
      if (last && last.slide.endSec < duration - 0.5) {
        const outroImg = images[images.length - 1] || { url: last.slide.url, name: last.slide.name };
        const outroMediaType = (outroImg as any).mediaType || (isVideoMedia(outroImg.name) ? 'video' : 'image');
        framedResults.push({
          slide: {
            id: `slide-outro-suffix-${Date.now()}`,
            url: outroImg.url,
            name: `[Outro] ${cleanImageFilename(outroImg.name).cleanName}`,
            startSec: last.slide.endSec,
            endSec: duration,
            confidence: 90,
            mediaType: outroMediaType,
          },
          cleanName: cleanImageFilename(outroImg.name).cleanName,
          matchedLineText: '[Outro Musik]',
          confidence: 90,
          reason: `🎸 Outro (${formatMinSec(last.slide.endSec)} - ${formatMinSec(duration)})`,
          isReffRepeat: false,
          isFilenameTimestamp: false,
        });
      }

      return framedResults;
    }

    // Otherwise normalize boundaries so slides flow continuously without overlapping
    if (merged.length > 0 && merged[0].slide.startSec > 0) {
      merged[0].slide.startSec = 0;
    }
    for (let i = 0; i < merged.length - 1; i++) {
      merged[i].slide.endSec = merged[i + 1].slide.startSec;
    }
    if (merged.length > 0) {
      merged[merged.length - 1].slide.endSec = duration;
    }

    if (options?.enabled !== false) {
      return fillInstrumentalGaps(merged, images, duration, options);
    }
    return merged;
  }

  // -------------------------------------------------------------
  // If NO images have filename timestamps, run standard heuristic matching:
  // -------------------------------------------------------------
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
        reason: 'Interval waktu merata',
        isFilenameTimestamp: false,
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

  // Apply Smart Gap Filler (if enabled)
  if (options?.enabled !== false) {
    return fillInstrumentalGaps(results, images, duration, options);
  }

  return results;
}

/**
 * Smart Gap Filler:
 * Detects instrumental passages (long intro before vocals, interludes/solos between lyrics, and outro)
 * that would otherwise hold a single image static for too long.
 * It dynamically splits those intervals into rotating B-roll slides from the available images collection.
 */
export function fillInstrumentalGaps(
  matchedResults: MatchResult[],
  allImages: Array<{ url: string; name: string }>,
  totalDuration: number,
  options?: GapFillOptions
): MatchResult[] {
  if (!matchedResults || matchedResults.length === 0 || !allImages || allImages.length === 0) {
    return matchedResults;
  }

  const isEnabled = options?.enabled !== false;
  if (!isEnabled) return matchedResults;

  const maxGapSec = options?.maxGapSec ?? 7.0;
  const targetInterval = options?.slideIntervalSec ?? 4.5;
  const duration = Math.max(10, totalDuration || 60);

  // Clean all image names for display
  const cleanedPool = allImages.map((img) => ({
    url: img.url,
    name: cleanImageFilename(img.name).cleanName,
  }));

  let poolIndex = 0;
  const getNextImage = (excludeUrl?: string) => {
    let attempts = 0;
    while (attempts < cleanedPool.length) {
      const candidate = cleanedPool[poolIndex % cleanedPool.length];
      poolIndex++;
      if (candidate.url !== excludeUrl || cleanedPool.length === 1) {
        return candidate;
      }
      attempts++;
    }
    return cleanedPool[0];
  };

  const finalResults: MatchResult[] = [];
  const count = matchedResults.length;

  for (let i = 0; i < count; i++) {
    const current = matchedResults[i];
    const slide = { ...current.slide };
    const effectiveSlideDur = slide.endSec - slide.startSec;

    // 1. INTRO GAP: First slide starting at 0 with long duration before vocal begins
    if (i === 0 && slide.startSec === 0 && effectiveSlideDur > maxGapSec + 1.5) {
      const keepDur = Math.min(6.0, Math.max(3.5, targetInterval));
      const gapSpan = effectiveSlideDur - keepDur;
      const numSlices = Math.max(2, Math.round(gapSpan / targetInterval));
      const sliceDur = Number((gapSpan / numSlices).toFixed(1));

      let curT = 0;
      for (let s = 0; s < numSlices; s++) {
        const sEnd = Number((curT + sliceDur).toFixed(1));
        const fillImg = getNextImage(slide.url);
        finalResults.push({
          slide: {
            id: `slide-intro-${s}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: fillImg.url,
            name: `[Intro] ${fillImg.name}`,
            startSec: curT,
            endSec: sEnd,
            confidence: 85,
          },
          cleanName: fillImg.name,
          matchedLineText: '[Intro Musik]',
          confidence: 85,
          reason: `🎸 Intro Musik (${s + 1}/${numSlices})`,
          isReffRepeat: false,
        });
        curT = sEnd;
      }

      finalResults.push({
        ...current,
        slide: {
          ...slide,
          startSec: curT,
          endSec: slide.endSec,
        },
      });
      continue;
    }

    // Push the current slide
    finalResults.push({ ...current, slide: { ...slide } });

    // 2. INTERLUDE & OUTRO: Check if the slide is excessively long
    if (effectiveSlideDur > maxGapSec + 1.5) {
      const keepDur = Math.min(6.0, Math.max(3.5, targetInterval));
      const gapSpan = effectiveSlideDur - keepDur;
      const numSlices = Math.max(2, Math.round(gapSpan / targetInterval));
      const sliceDur = Number((gapSpan / numSlices).toFixed(1));

      // Adjust the last added slide's endSec to keep only the initial duration
      const lastAdded = finalResults[finalResults.length - 1];
      const newEnd = Number((lastAdded.slide.startSec + keepDur).toFixed(1));
      const originalEnd = lastAdded.slide.endSec;
      lastAdded.slide.endSec = newEnd;

      let curT = newEnd;
      const isOutro = i === count - 1;
      const gapLabel = isOutro ? 'Outro' : 'Interlude';

      for (let s = 0; s < numSlices; s++) {
        const sEnd = s === numSlices - 1 ? originalEnd : Number((curT + sliceDur).toFixed(1));
        const fillImg = getNextImage(slide.url);
        finalResults.push({
          slide: {
            id: `slide-gap-${i}-${s}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: fillImg.url,
            name: `[${gapLabel}] ${fillImg.name}`,
            startSec: curT,
            endSec: sEnd,
            confidence: 85,
          },
          cleanName: fillImg.name,
          matchedLineText: `[${gapLabel} Musik]`,
          confidence: 85,
          reason: `🎸 ${gapLabel} (${s + 1}/${numSlices})`,
          isReffRepeat: false,
        });
        curT = sEnd;
      }
    }
  }

  // Ensure perfect contiguous boundaries
  for (let k = 0; k < finalResults.length - 1; k++) {
    finalResults[k].slide.endSec = finalResults[k + 1].slide.startSec;
  }
  if (finalResults.length > 0) {
    const last = finalResults[finalResults.length - 1];
    if (last.slide.endSec < duration) {
      last.slide.endSec = duration;
    }
  }

  return finalResults;
}

/**
 * Standalone Gap Filler for Timeline Slides:
 * Used directly on CapCut timeline to split any excessively long slides into rotating photos.
 */
export function fillTimelineSlideGaps(
  slides: SlideItem[],
  allImages: Array<{ url: string; name: string }>,
  totalDuration: number,
  options?: GapFillOptions
): SlideItem[] {
  const dummyResults: MatchResult[] = slides.map((s) => ({
    slide: { ...s },
    cleanName: s.name,
    matchedLineText: s.matchedLyricText || '',
    confidence: s.confidence || 80,
    reason: s.matchedLyricText ? 'Cocok lirik' : 'Slide foto',
  }));

  const filled = fillInstrumentalGaps(dummyResults, allImages, totalDuration, options);
  return filled.map((r) => r.slide);
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
  allowReffReuse: boolean = true,
  options?: GapFillOptions
): Promise<MatchResult[]> {
  if (!apiKey) {
    throw new Error('Groq API Key tidak ditemukan. Silakan masukkan Groq API Key terlebih dahulu.');
  }

  if (!images || images.length === 0) return [];
  const duration = Math.max(10, totalDuration || 60);

  // 1. Check if files have timestamps in filenames (Priority 1)
  const parsedImages = images.map((img, idx) => ({
    index: idx,
    img,
    ts: parseTimestampFromFilename(img.name, duration),
  }));

  const tsItems = parsedImages.filter((p) => p.ts !== null);
  const nonTsItems = parsedImages.filter((p) => p.ts === null);

  // If ALL images already have timestamps in their filenames, use timestamp matching directly
  if (nonTsItems.length === 0) {
    return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse, options);
  }

  if (!lyrics || lyrics.length === 0) {
    return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse, options);
  }

  // If SOME images have timestamps, anchor them first and only submit non-timestamp images to Groq AI
  if (tsItems.length > 0) {
    const tsOnlyImages = tsItems.map((t) => t.img);
    const tsResults = heuristicMatchImagesToLyrics(tsOnlyImages, lyrics, duration, false, { enabled: false });

    // Collect lyric IDs already occupied by timestamp images
    const occupiedLyricIds = new Set<string>();
    tsResults.forEach((r) => {
      if (r.slide.matchedLyricId) {
        occupiedLyricIds.add(r.slide.matchedLyricId);
      }
    });

    const nonTsOnlyImages = nonTsItems.map((n) => n.img);
    const availableLyrics = lyrics.filter((l) => !occupiedLyricIds.has(l.id));

    // If no lyrics left for non-timestamp items, fallback to heuristic for full set
    if (availableLyrics.length === 0) {
      return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse, options);
    }

    try {
      // Call Groq LLM ONLY for the non-timestamp images
      const nonTsGroqResults = await groqLlmMatchImagesToLyrics(
        apiKey,
        nonTsOnlyImages,
        availableLyrics,
        duration,
        allowReffReuse,
        { enabled: false }
      );

      // Merge timestamp results (confidence 100) and Groq AI results
      const combined = [...tsResults, ...nonTsGroqResults].sort(
        (a, b) => a.slide.startSec - b.slide.startSec
      );

      // Normalize boundaries
      if (combined.length > 0 && combined[0].slide.startSec > 0) {
        combined[0].slide.startSec = 0;
      }
      for (let i = 0; i < combined.length - 1; i++) {
        combined[i].slide.endSec = combined[i + 1].slide.startSec;
      }
      if (combined.length > 0) {
        combined[combined.length - 1].slide.endSec = duration;
      }

      if (options?.enabled !== false) {
        return fillInstrumentalGaps(combined, images, duration, options);
      }
      return combined;
    } catch (err) {
      console.warn('Groq partial matching failed, falling back to heuristic:', err);
      return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse, options);
    }
  }

  // -------------------------------------------------------------
  // If NO images have timestamps, query Groq AI for all images:
  // -------------------------------------------------------------
  try {
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
          Authorization: `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model,
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
        const errMsg = errJson?.error?.message || `API Error HTTP ${response.status}`;
        if (model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`Model "${model}" gagal (${errMsg}), mencoba alternatif...`);
          lastErr = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content?.trim() || '';
      // Strip markdown code fences if present
      content = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(content);
      break;
    } catch (err: any) {
      lastErr = err;
      if (model === modelsToTry[modelsToTry.length - 1]) throw err;
    }
  }

  if (!parsed || !Array.isArray(parsed)) {
    throw lastErr || new Error('Gagal mendapatkan hasil pencocokan dari AI.');
  }

  const rawParsedList: Array<{
    imageIndex: number;
    matchedLyricIndex: number;
    confidence?: number;
    reason?: string;
  }> = parsed;

  // Build timeline results with occurrence tracking
  const occurrenceCountMap = new Map<number, number>();

  const mappedCandidates = rawParsedList.map((p) => {
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

    if (options?.enabled !== false) {
      return fillInstrumentalGaps(results, images, duration, options);
    }

    return results;
  } catch (err: any) {
    console.warn('Groq LLM matcher fallback to heuristic:', err?.message);
    return heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse, options);
  }
}
