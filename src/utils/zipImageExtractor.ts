/**
 * Utility for extracting images and videos from ZIP archives on the client side using JSZip.
 * Supports hybrid photo & video slideshows and timeline clips.
 * Automatically handles Windows backslashes, nested folders, clips/storyboard subfolders,
 * and extensionless media files with timestamp headers.
 */
import JSZip from 'jszip';
import { parseTimestampFromFilename } from './aiLyricImageMatcher';

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'svg',
  'avif',
  'jfif',
  'heic',
  'heif',
  'tiff',
  'tif',
  'ico',
]);

export const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'm4v',
  'ogv',
  'mkv',
  'avi',
  'flv',
  'wmv',
  '3gp',
  'ts',
  'mpg',
  'mpeg',
]);

const IGNORED_NON_MEDIA_EXTENSIONS = new Set([
  'txt',
  'srt',
  'vtt',
  'lrc',
  'json',
  'xml',
  'md',
  'doc',
  'docx',
  'pdf',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'exe',
  'bat',
  'sh',
  'py',
  'js',
  'ts',
  'css',
  'html',
]);

const MIME_TYPES: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  jfif: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  ico: 'image/x-icon',
  // Videos
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  '3gp': 'video/3gpp',
  ts: 'video/mp2t',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
};

// Global URL-to-mediaType registry so blob: URLs retain their known media type (image or video)
const urlMediaTypeRegistry = new Map<string, 'image' | 'video'>();

export function registerMediaUrl(url: string, type: 'image' | 'video'): void {
  if (url) {
    urlMediaTypeRegistry.set(url, type);
  }
}

export function getMediaUrlType(url: string, fallbackName?: string): 'image' | 'video' {
  if (url && urlMediaTypeRegistry.has(url)) {
    return urlMediaTypeRegistry.get(url)!;
  }
  const target = (fallbackName || url || '').split('?')[0].toLowerCase();
  const ext = target.split('.').pop() || '';
  if (SUPPORTED_VIDEO_EXTENSIONS.has(ext) || target.startsWith('data:video/')) {
    return 'video';
  }
  return 'image';
}

export function isVideoMedia(urlOrName: string, mediaType?: 'image' | 'video'): boolean {
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  return getMediaUrlType(urlOrName) === 'video';
}

/**
 * Check if a file is a ZIP archive by extension or MIME type.
 */
export function isZipFile(file: File): boolean {
  if (!file) return false;
  const name = (file.name || '').trim().toLowerCase();
  const type = (file.type || '').trim().toLowerCase();
  return (
    name.endsWith('.zip') ||
    name.endsWith('.zipx') ||
    type.includes('zip') ||
    type === 'application/x-zip-compressed' ||
    type === 'application/x-compressed' ||
    type === 'multipart/x-zip'
  );
}

/**
 * Check if a Blob/File is a ZIP archive by reading its magic bytes ('PK').
 */
export async function isZipBlob(blob: Blob): Promise<boolean> {
  if (!blob) return false;
  try {
    const slice = await blob.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(slice);
    return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  } catch {
    return false;
  }
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_VIDEO_EXTENSIONS.has(ext);
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Detect image or video type by checking header magic bytes.
 */
function detectMediaTypeFromBytes(
  bytes: Uint8Array
): { type: 'image' | 'video'; ext: string; mime: string } | null {
  if (!bytes || bytes.length < 4) return null;

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { type: 'image', ext: 'png', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'image', ext: 'jpg', mime: 'image/jpeg' };
  }
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { type: 'image', ext: 'gif', mime: 'image/gif' };
  }
  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { type: 'image', ext: 'webp', mime: 'image/webp' };
  }
  // MP4 / MOV / M4V / QuickTime: 'ftyp' or 'moov' at offset 4
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return { type: 'video', ext: 'mp4', mime: 'video/mp4' };
  }
  // WebM / Matroska: 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { type: 'video', ext: 'webm', mime: 'video/webm' };
  }
  // AVI: RIFF....AVI
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x41 &&
    bytes[9] === 0x56 &&
    bytes[10] === 0x49
  ) {
    return { type: 'video', ext: 'avi', mime: 'video/x-msvideo' };
  }

  return null;
}

/**
 * Natural sort comparator so "clip_1.mp4", "clip_2.jpg", "clip_10.mp4" sort correctly.
 */
function naturalSortComparator(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extract slot keys for deduplicating clips vs storyboard images.
 * Keys include base filename, parsed frame index, and timestamp ranges.
 */
function getMediaSlotKeys(name: string): string[] {
  const keys: string[] = [];
  const base = name.replace(/\.[a-zA-Z0-9]+$/, '').trim().toLowerCase();
  keys.push(`base:${base}`);

  // Frame index prefix, e.g. "04_", "04-", "frame_4_", "frame4"
  const frameMatch = base.match(/^(?:frame[_\-\s]*)?(\d{1,4})[_\-\s]/i) || base.match(/^(\d{1,4})$/);
  if (frameMatch) {
    keys.push(`frame:${parseInt(frameMatch[1], 10)}`);
  }

  // Bracket timestamp, e.g. "[00-00-09,640_to_00-00-12,720]"
  const bracketMatch = base.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    keys.push(`ts:${bracketMatch[1].trim()}`);
  }

  // Full timestamp parsing
  const ts = parseTimestampFromFilename(name);
  if (ts) {
    if (ts.frameIndex !== undefined) {
      keys.push(`frame:${ts.frameIndex}`);
    }
    keys.push(`sec:${ts.startSec.toFixed(1)}`);
  }

  return keys;
}

export interface ExtractedMediaResult {
  mediaFiles: File[];
  imageFiles: File[];
  videoFiles: File[];
  zipCount: number;
}

/**
 * Extract all media files (both images and videos) from a ZIP file.
 * Automatically handles:
 * - Windows backslashes in paths
 * - 'clips/' (videos) and 'storyboard/' (images) subdirectories
 * - Extensionless media files (synthesizes .mp4 or .png based on directory/bytes)
 * - Automatic deduplication prioritizing video clips from clips/ over storyboard/ images
 * - Ignores macOS metadata (__MACOSX, .DS_Store), Thumbs.db, desktop.ini, and non-media files
 */
export async function extractMediaFromZip(
  zipFile: File,
  onProgress?: (percent: number, message: string) => void
): Promise<File[]> {
  if (onProgress) onProgress(5, `Membaca file zip: ${zipFile.name}...`);

  // Load via ArrayBuffer for maximum cross-browser JSZip stability
  const arrayBuffer = await zipFile.arrayBuffer();
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(arrayBuffer);

  // 1. Gather all candidate entries (normalizing Windows slashes)
  interface RawEntry {
    name: string;
    normalizedPath: string;
    zipEntry: JSZip.JSZipObject;
    isClipsFolder: boolean;
    isStoryboardFolder: boolean;
    hasKnownVideoExt: boolean;
    hasKnownImageExt: boolean;
    rawExt: string;
  }

  const candidateEntries: RawEntry[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    // Skip directories
    if (zipEntry.dir) return;

    // Normalize Windows backslashes
    const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalizedPath.endsWith('/')) return;

    // Skip system metadata
    if (
      normalizedPath.includes('__MACOSX/') ||
      normalizedPath.includes('/.DS_Store') ||
      normalizedPath.endsWith('.DS_Store') ||
      normalizedPath.toLowerCase().endsWith('thumbs.db') ||
      normalizedPath.toLowerCase().endsWith('desktop.ini')
    ) {
      return;
    }

    const filename = normalizedPath.split('/').pop()?.trim() || '';
    if (!filename || filename.startsWith('.')) return;

    // Check extension
    const hasDot = filename.includes('.');
    const rawExt = hasDot ? (filename.split('.').pop()?.toLowerCase() || '') : '';

    // Ignore known non-media documents
    if (rawExt && IGNORED_NON_MEDIA_EXTENSIONS.has(rawExt)) {
      return;
    }

    const lowerNorm = normalizedPath.toLowerCase();
    const isClipsFolder =
      lowerNorm.includes('/clips/') ||
      lowerNorm.startsWith('clips/') ||
      lowerNorm.includes('/clip/') ||
      lowerNorm.startsWith('clip/') ||
      lowerNorm.includes('/video/') ||
      lowerNorm.startsWith('video/') ||
      lowerNorm.includes('/videos/') ||
      lowerNorm.startsWith('videos/');

    const isStoryboardFolder =
      lowerNorm.includes('/storyboard/') ||
      lowerNorm.startsWith('storyboard/') ||
      lowerNorm.includes('/storyboards/') ||
      lowerNorm.startsWith('storyboards/') ||
      lowerNorm.includes('/image/') ||
      lowerNorm.startsWith('image/') ||
      lowerNorm.includes('/images/') ||
      lowerNorm.startsWith('images/') ||
      lowerNorm.includes('/photo/') ||
      lowerNorm.startsWith('photo/') ||
      lowerNorm.includes('/photos/') ||
      lowerNorm.startsWith('photos/');

    const hasKnownVideoExt = SUPPORTED_VIDEO_EXTENSIONS.has(rawExt);
    const hasKnownImageExt = SUPPORTED_IMAGE_EXTENSIONS.has(rawExt);

    candidateEntries.push({
      name: filename,
      normalizedPath,
      zipEntry,
      isClipsFolder,
      isStoryboardFolder,
      hasKnownVideoExt,
      hasKnownImageExt,
      rawExt,
    });
  });

  if (candidateEntries.length === 0) {
    throw new Error(
      `File zip "${zipFile.name}" tidak berisi file media di dalamnya.`
    );
  }

  // 2. Classify media type (video vs image) and synthesize proper extension if missing
  interface ResolvedEntry {
    name: string;
    normalizedPath: string;
    zipEntry: JSZip.JSZipObject;
    isVideo: boolean;
    mimeType: string;
    isClipsFolder: boolean;
    isStoryboardFolder: boolean;
  }

  const resolvedEntries: ResolvedEntry[] = [];

  for (const entry of candidateEntries) {
    let isVideo = false;
    let targetExt = entry.rawExt;
    let targetMime = MIME_TYPES[entry.rawExt] || '';

    if (entry.hasKnownVideoExt) {
      isVideo = true;
      targetMime = MIME_TYPES[entry.rawExt] || 'video/mp4';
    } else if (entry.hasKnownImageExt) {
      isVideo = false;
      targetMime = MIME_TYPES[entry.rawExt] || 'image/jpeg';
    } else if (entry.isClipsFolder) {
      // In clips folder: treat as video clip even if extensionless!
      isVideo = true;
      targetExt = entry.rawExt || 'mp4';
      targetMime = MIME_TYPES[targetExt] || 'video/mp4';
    } else if (entry.isStoryboardFolder) {
      // In storyboard folder: treat as storyboard image even if extensionless!
      isVideo = false;
      targetExt = entry.rawExt || 'png';
      targetMime = MIME_TYPES[targetExt] || 'image/png';
    } else {
      try {
        const rawBytes = await entry.zipEntry.async('uint8array');
        const header = rawBytes.subarray(0, 16);
        const detected = detectMediaTypeFromBytes(header);
        if (detected) {
          isVideo = detected.type === 'video';
          targetExt = detected.ext;
          targetMime = detected.mime;
        } else {
          // Fallback: check filename hints or default to image
          const lower = entry.name.toLowerCase();
          if (lower.includes('video') || lower.includes('clip')) {
            isVideo = true;
            targetExt = 'mp4';
            targetMime = 'video/mp4';
          } else {
            isVideo = false;
            targetExt = 'jpg';
            targetMime = 'image/jpeg';
          }
        }
      } catch {
        isVideo = false;
        targetExt = 'jpg';
        targetMime = 'image/jpeg';
      }
    }

    // Ensure filename has a valid media extension so downstream browsers and player elements recognize it
    let safeName = entry.name;
    if (!safeName.toLowerCase().endsWith(`.${targetExt}`)) {
      const hasAnyValidExt =
        SUPPORTED_IMAGE_EXTENSIONS.has(entry.rawExt) ||
        SUPPORTED_VIDEO_EXTENSIONS.has(entry.rawExt);
      if (!hasAnyValidExt) {
        safeName = `${entry.name}.${targetExt}`;
      }
    }

    resolvedEntries.push({
      name: safeName,
      normalizedPath: entry.normalizedPath,
      zipEntry: entry.zipEntry,
      isVideo,
      mimeType: targetMime,
      isClipsFolder: entry.isClipsFolder,
      isStoryboardFolder: entry.isStoryboardFolder,
    });
  }

  // 3. Hybrid deduplication: prioritize video clips from clips/ over storyboard/ images
  const clipEntries = resolvedEntries.filter((m) => m.isVideo && m.isClipsFolder);
  const storyboardEntries = resolvedEntries.filter((m) => !m.isVideo && m.isStoryboardFolder);

  let finalEntries = resolvedEntries;

  if (clipEntries.length > 0 && storyboardEntries.length > 0) {
    const clipKeys = new Set<string>();
    for (const c of clipEntries) {
      for (const k of getMediaSlotKeys(c.name)) {
        clipKeys.add(k);
      }
    }

    finalEntries = resolvedEntries.filter((m) => {
      // Keep all video clips from clips/
      if (m.isClipsFolder && m.isVideo) return true;

      // For storyboard images: exclude if a clip already exists for this frame slot
      if (m.isStoryboardFolder && !m.isVideo) {
        const myKeys = getMediaSlotKeys(m.name);
        const hasMatchingClip = myKeys.some((k) => clipKeys.has(k));
        return !hasMatchingClip;
      }

      return true;
    });
  }

  // Natural sort by filename / frame number
  finalEntries.sort((a, b) => naturalSortComparator(a.name, b.name));

  const totalImages = finalEntries.filter((m) => !m.isVideo).length;
  const totalVideos = finalEntries.filter((m) => m.isVideo).length;

  if (onProgress) {
    onProgress(
      15,
      `Ditemukan ${finalEntries.length} media (${totalImages} foto storyboard, ${totalVideos} video klip). Mengekstrak...`
    );
  }

  // 4. Extract blobs and create File instances
  const extractedFiles: File[] = [];

  for (let i = 0; i < finalEntries.length; i++) {
    const { name, zipEntry, isVideo, mimeType } = finalEntries[i];
    const blob = await zipEntry.async('blob');
    const file = new File([blob], name, { type: mimeType });
    extractedFiles.push(file);

    if (onProgress) {
      const pct = Math.round(15 + ((i + 1) / finalEntries.length) * 80);
      onProgress(
        pct,
        `Mengekstrak (${i + 1}/${finalEntries.length}): ${name} [${isVideo ? 'Video' : 'Foto'}]...`
      );
    }
  }

  if (onProgress) {
    onProgress(
      100,
      `Berhasil mengekstrak ${extractedFiles.length} media (${totalImages} foto, ${totalVideos} video)!`
    );
  }

  return extractedFiles;
}

/**
 * Backward compatibility alias for extractMediaFromZip
 */
export const extractImagesFromZip = extractMediaFromZip;

/**
 * Processes an array of uploaded files (which may include regular photos, videos, ZIPs, or a mixture).
 * Unpacks any ZIP files automatically and merges them with regular media files in natural order.
 */
export async function processFilesWithZipExtraction(
  files: File[],
  onProgress?: (percent: number, message: string) => void
): Promise<ExtractedMediaResult> {
  const allMedia: File[] = [];
  let zipCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isZip = isZipFile(file) || (await isZipBlob(file));

    if (isZip) {
      zipCount++;
      const extracted = await extractMediaFromZip(file, onProgress);
      allMedia.push(...extracted);
    } else {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (
        SUPPORTED_IMAGE_EXTENSIONS.has(ext) ||
        SUPPORTED_VIDEO_EXTENSIONS.has(ext) ||
        file.type.startsWith('image/') ||
        file.type.startsWith('video/')
      ) {
        allMedia.push(file);
      }
    }
  }

  const imageFiles = allMedia.filter((f) => !isVideoFile(f));
  const videoFiles = allMedia.filter((f) => isVideoFile(f));

  return {
    mediaFiles: allMedia,
    imageFiles,
    videoFiles,
    zipCount,
  };
}

