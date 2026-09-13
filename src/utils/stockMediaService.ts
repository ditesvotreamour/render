/**
 * Stock Media Service
 * Integrates Pexels API, Pixabay API, Wikimedia Commons API, and curated royalty-free video loops.
 * Provides unified video and photo search with client-side caching and API key management.
 */

import { registerMediaUrl } from './zipImageExtractor';

export type StockProvider = 'all' | 'pexels' | 'pixabay' | 'wikimedia' | 'curated';
export type StockMediaType = 'all' | 'video' | 'image';
export type StockOrientation = 'all' | 'landscape' | 'portrait' | 'square';

export interface StockMediaItem {
  id: string;
  source: 'pexels' | 'pixabay' | 'wikimedia' | 'curated';
  type: 'video' | 'image';
  title: string;
  thumbnail: string;
  previewUrl: string;
  downloadUrl: string;
  duration?: number;
  width?: number;
  height?: number;
  author?: string;
  authorUrl?: string;
  tags?: string[];
}

export interface StockSearchParams {
  query?: string;
  provider?: StockProvider;
  mediaType?: StockMediaType;
  orientation?: StockOrientation;
  page?: number;
  perPage?: number;
  category?: string;
}

export interface StockSearchResult {
  items: StockMediaItem[];
  totalResults: number;
  page: number;
  hasMore: boolean;
  providerNotice?: {
    pexelsNeedsKey?: boolean;
    pixabayNeedsKey?: boolean;
  };
}

// LocalStorage Keys & Default API Keys
const PEXELS_KEY_STORAGE = 'pexels_api_key';
const PIXABAY_KEY_STORAGE = 'pixabay_api_key';

export const DEFAULT_PEXELS_KEY = 'sm7Qbau9NkY4LwQj21S8N5tp1Bz52pJc1vcTStziWFyiJDqip6K0dMri';
export const DEFAULT_PIXABAY_KEY = '57322801-eb42bbdcd7f45e6f85eb63eaa';

export function getPexelsApiKey(): string {
  if (typeof window === 'undefined') return DEFAULT_PEXELS_KEY;
  return localStorage.getItem(PEXELS_KEY_STORAGE) || DEFAULT_PEXELS_KEY;
}

export function setPexelsApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(PEXELS_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(PEXELS_KEY_STORAGE);
  }
}

export function getPixabayApiKey(): string {
  if (typeof window === 'undefined') return DEFAULT_PIXABAY_KEY;
  return localStorage.getItem(PIXABAY_KEY_STORAGE) || DEFAULT_PIXABAY_KEY;
}

export function setPixabayApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(PIXABAY_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(PIXABAY_KEY_STORAGE);
  }
}

// Curated royalty-free stock loops that work out of the box with zero API key
export const CURATED_STOCK_MEDIA: StockMediaItem[] = [
  {
    id: 'curated_cyber_grid',
    source: 'curated',
    type: 'video',
    title: 'Cyberpunk Synthwave Grid & Neon Horizon',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-futuristic-tunnel-with-lights-41584-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-futuristic-tunnel-with-lights-41584-large.mp4',
    duration: 12,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['cyberpunk', 'neon', 'grid', 'synthwave', 'futuristic'],
  },
  {
    id: 'curated_lofi_rain',
    source: 'curated',
    type: 'video',
    title: 'Lo-Fi Rain on Window Glass with City Lights',
    thumbnail: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-raindrops-on-a-window-at-night-42646-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-raindrops-on-a-window-at-night-42646-large.mp4',
    duration: 14,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['rain', 'lofi', 'window', 'night', 'water', 'city'],
  },
  {
    id: 'curated_golden_waves',
    source: 'curated',
    type: 'video',
    title: 'Golden Sunset Ocean Waves & Beach Horizon',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-coming-to-the-beach-5016-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-coming-to-the-beach-5016-large.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['sunset', 'ocean', 'waves', 'beach', 'nature', 'golden'],
  },
  {
    id: 'curated_concert_lasers',
    source: 'curated',
    type: 'video',
    title: 'EDM Stage Laser Beams & Crowd Smoke',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-colored-lights-at-a-music-concert-40282-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-colored-lights-at-a-music-concert-40282-large.mp4',
    duration: 12,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['concert', 'stage', 'lasers', 'edm', 'lights', 'party'],
  },
  {
    id: 'curated_cosmic_nebula',
    source: 'curated',
    type: 'video',
    title: 'Cosmic Nebula Stars Drift in Deep Space',
    thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-starfield-in-space-41581-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-starfield-in-space-41581-large.mp4',
    duration: 15,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['space', 'cosmic', 'nebula', 'stars', 'galaxy'],
  },
  {
    id: 'curated_golden_particles',
    source: 'curated',
    type: 'video',
    title: 'Golden Floating Particle Bokeh Sparkles',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-golden-particles-in-motion-41804-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-golden-particles-in-motion-41804-large.mp4',
    duration: 11,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['particles', 'bokeh', 'gold', 'sparkle', 'light', 'overlay'],
  },
  {
    id: 'curated_abstract_smoke',
    source: 'curated',
    type: 'video',
    title: 'Atmospheric Colored Smoke Flow Slow Motion',
    thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-colored-smoke-floating-slowly-41805-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-colored-smoke-floating-slowly-41805-large.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['smoke', 'abstract', 'colors', 'flow', 'atmospheric'],
  },
  {
    id: 'curated_city_timelapse',
    source: 'curated',
    type: 'video',
    title: 'Night Metropolis City Traffic & Lights Timelapse',
    thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-traffic-in-a-busy-avenue-at-night-42645-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-traffic-in-a-busy-avenue-at-night-42645-large.mp4',
    duration: 12,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['city', 'traffic', 'timelapse', 'urban', 'night', 'lights'],
  },
  {
    id: 'curated_fire_embers',
    source: 'curated',
    type: 'video',
    title: 'Fiery Embers & Sparks Rising in Dark',
    thumbnail: 'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-bright-fire-embers-floating-41807-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-bright-fire-embers-floating-41807-large.mp4',
    duration: 8,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['fire', 'embers', 'sparks', 'flame', 'energy', 'dark'],
  },
  {
    id: 'curated_water_ripples',
    source: 'curated',
    type: 'video',
    title: 'Crystal Clear Water Droplets & Ripples Macro',
    thumbnail: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=640&auto=format&fit=crop',
    previewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-water-droplets-falling-into-a-puddle-42647-large.mp4',
    downloadUrl: 'https://assets.mixkit.co/videos/preview/mixkit-water-droplets-falling-into-a-puddle-42647-large.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    author: 'Mixkit Free License',
    tags: ['water', 'ripples', 'liquid', 'clean', 'nature', 'droplets'],
  },
];

// Register curated videos globally
for (const item of CURATED_STOCK_MEDIA) {
  registerMediaUrl(item.downloadUrl, item.type);
  registerMediaUrl(item.previewUrl, item.type);
}

/**
 * Search Pexels Videos API
 */
export async function searchPexelsVideos(params: StockSearchParams): Promise<StockSearchResult> {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    return {
      items: [],
      totalResults: 0,
      page: params.page || 1,
      hasMore: false,
      providerNotice: { pexelsNeedsKey: true },
    };
  }

  const query = (params.query || '').trim();
  const page = params.page || 1;
  const perPage = params.perPage || 15;

  let url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query || 'abstract motion')}&page=${page}&per_page=${perPage}`;
  if (!query) {
    url = `https://api.pexels.com/videos/popular?page=${page}&per_page=${perPage}`;
  }

  if (params.orientation && params.orientation !== 'all') {
    url += `&orientation=${params.orientation}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return {
          items: [],
          totalResults: 0,
          page,
          hasMore: false,
          providerNotice: { pexelsNeedsKey: true },
        };
      }
      throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const items: StockMediaItem[] = (data.videos || []).map((v: any) => {
      // Pick best MP4 video file (prefer HD around 1280-1920)
      const mp4Files = (v.video_files || []).filter((f: any) => f.file_type === 'video/mp4');
      mp4Files.sort((a: any, b: any) => {
        const aWidth = a.width || 0;
        const bWidth = b.width || 0;
        const aScore = Math.abs(aWidth - 1920);
        const bScore = Math.abs(bWidth - 1920);
        return aScore - bScore;
      });

      const selectedFile = mp4Files[0] || v.video_files?.[0] || {};
      const downloadUrl = selectedFile.link || '';
      const previewUrl = selectedFile.link || '';

      if (downloadUrl) {
        registerMediaUrl(downloadUrl, 'video');
      }

      return {
        id: `pexels_vid_${v.id}`,
        source: 'pexels',
        type: 'video',
        title: v.url ? v.url.split('/').filter(Boolean).pop().replace(/-/g, ' ') : `Pexels Video ${v.id}`,
        thumbnail: v.image || '',
        previewUrl,
        downloadUrl,
        duration: v.duration || 10,
        width: v.width,
        height: v.height,
        author: v.user?.name || 'Pexels Creator',
        authorUrl: v.user?.url || 'https://www.pexels.com',
        tags: ['pexels', 'video', query].filter(Boolean),
      };
    });

    return {
      items,
      totalResults: data.total_results || items.length,
      page,
      hasMore: (data.page * data.per_page) < (data.total_results || 0),
    };
  } catch (err: any) {
    console.warn('Failed to fetch from Pexels Videos:', err);
    return {
      items: [],
      totalResults: 0,
      page,
      hasMore: false,
    };
  }
}

/**
 * Search Pexels Photos API
 */
export async function searchPexelsPhotos(params: StockSearchParams): Promise<StockSearchResult> {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    return {
      items: [],
      totalResults: 0,
      page: params.page || 1,
      hasMore: false,
      providerNotice: { pexelsNeedsKey: true },
    };
  }

  const query = (params.query || '').trim();
  const page = params.page || 1;
  const perPage = params.perPage || 15;

  let url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query || 'wallpaper scenery')}&page=${page}&per_page=${perPage}`;
  if (!query) {
    url = `https://api.pexels.com/v1/curated?page=${page}&per_page=${perPage}`;
  }

  if (params.orientation && params.orientation !== 'all') {
    url += `&orientation=${params.orientation}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return {
          items: [],
          totalResults: 0,
          page,
          hasMore: false,
          providerNotice: { pexelsNeedsKey: true },
        };
      }
      throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const items: StockMediaItem[] = (data.photos || []).map((p: any) => {
      const downloadUrl = p.src?.large2x || p.src?.large || p.src?.original || '';
      const previewUrl = p.src?.large || p.src?.medium || '';

      if (downloadUrl) {
        registerMediaUrl(downloadUrl, 'image');
      }

      return {
        id: `pexels_img_${p.id}`,
        source: 'pexels',
        type: 'image',
        title: p.alt || `Pexels Photo ${p.id}`,
        thumbnail: p.src?.medium || p.src?.small || '',
        previewUrl,
        downloadUrl,
        width: p.width,
        height: p.height,
        author: p.photographer || 'Pexels Creator',
        authorUrl: p.photographer_url || 'https://www.pexels.com',
        tags: ['pexels', 'photo', query].filter(Boolean),
      };
    });

    return {
      items,
      totalResults: data.total_results || items.length,
      page,
      hasMore: (data.page * data.per_page) < (data.total_results || 0),
    };
  } catch (err: any) {
    console.warn('Failed to fetch from Pexels Photos:', err);
    return {
      items: [],
      totalResults: 0,
      page,
      hasMore: false,
    };
  }
}

/**
 * Search Pixabay Videos API
 */
export async function searchPixabayVideos(params: StockSearchParams): Promise<StockSearchResult> {
  const apiKey = getPixabayApiKey();
  if (!apiKey) {
    return {
      items: [],
      totalResults: 0,
      page: params.page || 1,
      hasMore: false,
      providerNotice: { pixabayNeedsKey: true },
    };
  }

  const query = (params.query || '').trim();
  const page = params.page || 1;
  const perPage = params.perPage || 15;

  let url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&page=${page}&per_page=${perPage}&safesearch=true`;
  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  } else {
    url += `&editors_choice=true`;
  }

  if (params.category) {
    url += `&category=${encodeURIComponent(params.category)}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        return {
          items: [],
          totalResults: 0,
          page,
          hasMore: false,
          providerNotice: { pixabayNeedsKey: true },
        };
      }
      throw new Error(`Pixabay API error: ${res.status}`);
    }

    const data = await res.json();
    const items: StockMediaItem[] = (data.hits || []).map((h: any) => {
      // Pick best video size: medium or large
      const vidObj = h.videos || {};
      const chosen = vidObj.medium?.url ? vidObj.medium : vidObj.large?.url ? vidObj.large : vidObj.small || {};
      const downloadUrl = chosen.url || '';
      const previewUrl = vidObj.small?.url || chosen.url || '';

      const thumbnail = h.picture_id
        ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg`
        : h.userImageURL || '';

      if (downloadUrl) {
        registerMediaUrl(downloadUrl, 'video');
      }

      return {
        id: `pixabay_vid_${h.id}`,
        source: 'pixabay',
        type: 'video',
        title: h.tags ? h.tags.split(',').map((t: string) => t.trim()).join(' • ') : `Pixabay Video ${h.id}`,
        thumbnail: thumbnail || previewUrl,
        previewUrl,
        downloadUrl,
        duration: h.duration || 10,
        width: chosen.width || 1280,
        height: chosen.height || 720,
        author: h.user || 'Pixabay Contributor',
        authorUrl: h.pageURL || 'https://pixabay.com',
        tags: h.tags ? h.tags.split(',').map((t: string) => t.trim()) : ['pixabay', 'video'],
      };
    });

    return {
      items,
      totalResults: data.totalHits || data.total || items.length,
      page,
      hasMore: (page * perPage) < (data.totalHits || 0),
    };
  } catch (err: any) {
    console.warn('Failed to fetch from Pixabay Videos:', err);
    return {
      items: [],
      totalResults: 0,
      page,
      hasMore: false,
    };
  }
}

/**
 * Search Pixabay Photos API
 */
export async function searchPixabayPhotos(params: StockSearchParams): Promise<StockSearchResult> {
  const apiKey = getPixabayApiKey();
  if (!apiKey) {
    return {
      items: [],
      totalResults: 0,
      page: params.page || 1,
      hasMore: false,
      providerNotice: { pixabayNeedsKey: true },
    };
  }

  const query = (params.query || '').trim();
  const page = params.page || 1;
  const perPage = params.perPage || 15;

  let url = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&image_type=photo&page=${page}&per_page=${perPage}&safesearch=true`;
  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  } else {
    url += `&editors_choice=true`;
  }

  if (params.category) {
    url += `&category=${encodeURIComponent(params.category)}`;
  }

  if (params.orientation && params.orientation !== 'all') {
    url += `&orientation=${params.orientation === 'portrait' ? 'vertical' : 'horizontal'}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        return {
          items: [],
          totalResults: 0,
          page,
          hasMore: false,
          providerNotice: { pixabayNeedsKey: true },
        };
      }
      throw new Error(`Pixabay API error: ${res.status}`);
    }

    const data = await res.json();
    const items: StockMediaItem[] = (data.hits || []).map((h: any) => {
      const downloadUrl = h.largeImageURL || h.webformatURL || '';
      const previewUrl = h.webformatURL || '';

      if (downloadUrl) {
        registerMediaUrl(downloadUrl, 'image');
      }

      return {
        id: `pixabay_img_${h.id}`,
        source: 'pixabay',
        type: 'image',
        title: h.tags ? h.tags.split(',').map((t: string) => t.trim()).join(' • ') : `Pixabay Photo ${h.id}`,
        thumbnail: h.webformatURL || h.previewURL || '',
        previewUrl,
        downloadUrl,
        width: h.imageWidth || 1920,
        height: h.imageHeight || 1080,
        author: h.user || 'Pixabay Contributor',
        authorUrl: h.pageURL || 'https://pixabay.com',
        tags: h.tags ? h.tags.split(',').map((t: string) => t.trim()) : ['pixabay', 'photo'],
      };
    });

    return {
      items,
      totalResults: data.totalHits || data.total || items.length,
      page,
      hasMore: (page * perPage) < (data.totalHits || 0),
    };
  } catch (err: any) {
    console.warn('Failed to fetch from Pixabay Photos:', err);
    return {
      items: [],
      totalResults: 0,
      page,
      hasMore: false,
    };
  }
}

/**
 * Search Wikimedia Commons Videos (Public Domain / Creative Commons, Zero API Key needed)
 */
export async function searchWikimediaVideos(params: StockSearchParams): Promise<StockSearchResult> {
  const query = (params.query || '').trim();
  const perPage = params.perPage || 10;

  const searchTerm = query ? `filetype:video ${query}` : 'filetype:video timelapse';
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=${perPage}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { items: [], totalResults: 0, page: 1, hasMore: false };

    const data = await res.json();
    const pages = data.query?.pages || {};
    const items: StockMediaItem[] = [];

    for (const key of Object.keys(pages)) {
      const p = pages[key];
      const info = p.imageinfo?.[0];
      if (!info || !info.url) continue;

      const fileUrl = info.url;
      const mime = (info.mime || '').toLowerCase();
      if (!mime.startsWith('video/') && !fileUrl.match(/\.(webm|ogv|mp4|mov)$/i)) {
        continue;
      }

      const title = (p.title || '').replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      registerMediaUrl(fileUrl, 'video');

      items.push({
        id: `wikimedia_${p.pageid || key}`,
        source: 'wikimedia',
        type: 'video',
        title: title || 'Wikimedia Commons Video',
        thumbnail: info.thumburl || fileUrl,
        previewUrl: fileUrl,
        downloadUrl: fileUrl,
        duration: 10,
        width: info.width || 1280,
        height: info.height || 720,
        author: info.extmetadata?.Artist?.value ? String(info.extmetadata.Artist.value).replace(/<[^>]*>?/gm, '') : 'Wikimedia Commons',
        authorUrl: info.descriptionurl || 'https://commons.wikimedia.org',
        tags: ['wikimedia', 'public-domain', 'free-video'],
      });
    }

    return {
      items,
      totalResults: items.length,
      page: 1,
      hasMore: false,
    };
  } catch (err: any) {
    console.warn('Failed to fetch from Wikimedia Commons:', err);
    return { items: [], totalResults: 0, page: 1, hasMore: false };
  }
}

/**
 * Filter curated stock media based on query, type, and category
 */
export function getCuratedStockMedia(query?: string, mediaType?: StockMediaType): StockMediaItem[] {
  let list = [...CURATED_STOCK_MEDIA];
  if (mediaType && mediaType !== 'all') {
    list = list.filter((i) => i.type === mediaType);
  }
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    list = list.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      (i.tags && i.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }
  return list;
}

/**
 * Unified Stock Search Function
 * Queries chosen provider or aggregates across providers (Pexels, Pixabay, Wikimedia, Curated)
 */
export async function searchUnifiedStockMedia(params: StockSearchParams): Promise<StockSearchResult> {
  const provider = params.provider || 'all';
  const mediaType = params.mediaType || 'all';
  const query = (params.query || '').trim();

  const allItems: StockMediaItem[] = [];
  let pexelsNeedsKey = false;
  let pixabayNeedsKey = false;

  // 1. Curated stock loops (always available, fast)
  if (provider === 'all' || provider === 'curated') {
    const curatedMatches = getCuratedStockMedia(query, mediaType);
    allItems.push(...curatedMatches);
  }

  const fetchPromises: Promise<StockSearchResult>[] = [];

  // 2. Pexels
  if (provider === 'all' || provider === 'pexels') {
    if (mediaType === 'all' || mediaType === 'video') {
      fetchPromises.push(searchPexelsVideos(params));
    }
    if (mediaType === 'all' || mediaType === 'image') {
      fetchPromises.push(searchPexelsPhotos(params));
    }
  }

  // 3. Pixabay
  if (provider === 'all' || provider === 'pixabay') {
    if (mediaType === 'all' || mediaType === 'video') {
      fetchPromises.push(searchPixabayVideos(params));
    }
    if (mediaType === 'all' || mediaType === 'image') {
      fetchPromises.push(searchPixabayPhotos(params));
    }
  }

  // 4. Wikimedia Commons (for videos)
  if (provider === 'all' || provider === 'wikimedia') {
    if (mediaType === 'all' || mediaType === 'video') {
      fetchPromises.push(searchWikimediaVideos(params));
    }
  }

  if (fetchPromises.length > 0) {
    const results = await Promise.allSettled(fetchPromises);
    for (const res of results) {
      if (res.status === 'fulfilled') {
        const val = res.value;
        if (val.providerNotice?.pexelsNeedsKey) pexelsNeedsKey = true;
        if (val.providerNotice?.pixabayNeedsKey) pixabayNeedsKey = true;
        allItems.push(...val.items);
      }
    }
  }

  // De-duplicate by ID
  const uniqueMap = new Map<string, StockMediaItem>();
  for (const item of allItems) {
    if (!uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }

  const items = Array.from(uniqueMap.values());

  return {
    items,
    totalResults: items.length,
    page: params.page || 1,
    hasMore: false,
    providerNotice: {
      pexelsNeedsKey,
      pixabayNeedsKey,
    },
  };
}
