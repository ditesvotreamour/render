export type VisualizerStyle =
  | 'radial_bars'
  | 'radial_wave'
  | 'linear_bars'
  | 'oscilloscope'
  | 'hexagon_pulse'
  | 'particle_tunnel'
  | 'monstercat_bars'
  | 'minimal_halo'
  | 'double_orbit'
  | 'floating_dots'
  | 'liquid_ribbon'
  | 'cyber_matrix'
  | 'trap_nation_pulse'
  | 'cyber_tunnel_3d'
  | 'neon_infinity_ribbon'
  | 'audio_aura_sphere';

export type ColorMode = 'solid' | 'gradient_linear' | 'gradient_radial' | 'rainbow' | 'neon_dual';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type PreviewResolution = '1080p' | '720p' | '480p' | '360p';

export interface PreviewResolutionOption {
  id: PreviewResolution;
  label: string;
  badge: string;
  tag: string;
  description: string;
  speed: string;
  loadPercent: string;
}

export const PREVIEW_RESOLUTIONS: PreviewResolutionOption[] = [
  {
    id: '360p',
    label: '360p (Ultra Cepat)',
    badge: '360p',
    tag: 'Anti Lag',
    description: 'Paling ringan & lancar, hemat CPU & baterai laptop',
    speed: 'Ultra Lancar',
    loadPercent: '~10% Beban',
  },
  {
    id: '480p',
    label: '480p (Cepat & Halus)',
    badge: '480p',
    tag: 'Rekomendasi',
    description: 'Sangat lancar 60 FPS untuk proses editing',
    speed: 'Sangat Cepat',
    loadPercent: '~20% Beban',
  },
  {
    id: '720p',
    label: '720p (Seimbang)',
    badge: '720p',
    tag: 'Standar',
    description: 'Optimal antara ketajaman gambar dan performa',
    speed: 'Seimbang',
    loadPercent: '~45% Beban',
  },
  {
    id: '1080p',
    label: '1080p (Full HD)',
    badge: '1080p',
    tag: 'Tajam',
    description: 'Ketajaman penuh (memerlukan GPU bertenaga)',
    speed: 'Kualitas Penuh',
    loadPercent: '100% Beban',
  },
];

export const getBaseDimensions = (aspectRatio: AspectRatio) => {
  switch (aspectRatio) {
    case '9:16':
      return { baseW: 1080, baseH: 1920 };
    case '1:1':
      return { baseW: 1080, baseH: 1080 };
    case '4:5':
      return { baseW: 1080, baseH: 1350 };
    case '16:9':
    default:
      return { baseW: 1920, baseH: 1080 };
  }
};

export const getPreviewDimensions = (aspectRatio: AspectRatio, resolution: PreviewResolution) => {
  switch (aspectRatio) {
    case '9:16':
      switch (resolution) {
        case '360p':
          return { width: 360, height: 640 };
        case '480p':
          return { width: 480, height: 854 };
        case '720p':
          return { width: 720, height: 1280 };
        case '1080p':
        default:
          return { width: 1080, height: 1920 };
      }
    case '1:1':
      switch (resolution) {
        case '360p':
          return { width: 360, height: 360 };
        case '480p':
          return { width: 480, height: 480 };
        case '720p':
          return { width: 720, height: 720 };
        case '1080p':
        default:
          return { width: 1080, height: 1080 };
      }
    case '4:5':
      switch (resolution) {
        case '360p':
          return { width: 360, height: 450 };
        case '480p':
          return { width: 480, height: 600 };
        case '720p':
          return { width: 720, height: 900 };
        case '1080p':
        default:
          return { width: 1080, height: 1350 };
      }
    case '16:9':
    default:
      switch (resolution) {
        case '360p':
          return { width: 640, height: 360 };
        case '480p':
          return { width: 854, height: 480 };
        case '720p':
          return { width: 1280, height: 720 };
        case '1080p':
        default:
          return { width: 1920, height: 1080 };
      }
  }
};

export interface VisualizerConfig {
  enabled?: boolean;
  style: VisualizerStyle;
  barCount: number;
  barWidth: number;
  innerRadius: number;
  maxBarHeight: number;
  smoothing: number; // 0.6 to 0.95
  bassBoost: number; // 1.0 to 3.0
  mirror: boolean;
  roundCaps: boolean;
  glow: number; // 0 to 40
  colorMode: ColorMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pulseWithBass?: boolean;
  peakDots?: boolean;
  invertDirection?: boolean;
}

export type LogoShape = 'circle' | 'rounded_rect' | 'hexagon' | 'shield' | 'star';

export interface CenterLogoConfig {
  enabled: boolean;
  imageUrl: string;
  shape: LogoShape;
  size: number; // in pixels
  bounceIntensity: number; // 0 to 2
  borderWidth: number;
  borderColor: string;
  borderGlow: number;
  rotationSpeed: number; // -5 to 5
}

export type BackgroundType =
  | 'preset_grid'
  | 'preset_nebula'
  | 'preset_synthwave'
  | 'preset_dark_studio'
  | 'preset_aurora'
  | 'preset_cyber_tunnel'
  | 'custom_image'
  | 'multi_image'
  | 'solid_color';

export interface SlideItem {
  id: string;
  url: string;
  name: string; // original filename e.g. "hujan_malam"
  startSec: number;
  endSec: number;
  matchedLyricId?: string;
  matchedLyricText?: string;
  confidence?: number;
}

export interface BackgroundConfig {
  type: BackgroundType;
  customImageUrl: string;
  multiImageUrls?: string[];
  multiImageSlides?: SlideItem[];
  multiImageInterval?: number; // seconds between images (fallback when slides not explicitly timed)
  multiImageTransition?: 'fade' | 'fade_black' | 'zoom' | 'slide' | 'cut';
  multiImageKenBurns?: boolean;
  solidColor: string;
  dimOpacity: number; // 0 to 1
  blur: number; // 0 to 20
  vignette: number; // 0 to 1
  bassShake: number; // 0 to 1.5
  bassZoom: number; // 0 to 1.5
}

export type ParticleType = 'dust' | 'embers' | 'sparks' | 'stars' | 'bubbles';

export interface ParticlesConfig {
  enabled: boolean;
  count: number;
  type: ParticleType;
  color: string;
  speed: number;
  reactToBass: boolean;
  burstIntensity: number;
}

export type TextPosition =
  | 'center_bottom'
  | 'top_left'
  | 'top_center'
  | 'bottom_center'
  | 'bottom_left'
  | 'bottom_right';

export type SafeZonePlatform =
  | 'none'
  | 'tiktok'
  | 'reels'
  | 'shorts'
  | 'spotify'
  | 'youtube';

export interface SocialBadgeConfig {
  enabled: boolean;
  streamingPlatform: 'spotify' | 'apple_music' | 'youtube' | 'soundcloud' | 'none';
  customStreamingText?: string;
  handleInstagram?: string;
  handleTikTok?: string;
  handleYouTube?: string;
  position: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'below_title';
  style: 'glass_pill' | 'neon_box' | 'minimal';
  badgeColor: string;
}

export interface TypographyConfig {
  showTitle: boolean;
  title: string;
  titleFont: string;
  titleSize: number;
  titleColor: string;
  showArtist: boolean;
  artist: string;
  artistFont: string;
  artistSize: number;
  artistColor: string;
  showSubtitle: boolean;
  subtitle: string;
  position: TextPosition;
  reactToBeat: boolean;
  showTimeProgress: boolean;
  progressColor: string;
  socialBadges?: SocialBadgeConfig;
}

export interface LyricWord {
  word: string;
  start: number;
  end: number;
}

export interface LyricSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  translation?: string;
  words?: LyricWord[];
}

export type SubtitlePosition = 'bottom' | 'center_bottom' | 'center' | 'top' | 'custom';
export type SubtitleStyle =
  | 'hormozi_kinetic'
  | 'karaoke_glow'
  | 'viral_pop'
  | 'classic_box'
  | 'neon_outline'
  | 'color_pill'
  | 'mrbeast_viral'
  | 'comic_pop'
  | 'cinematic_film'
  | 'kinetic_typography'
  | 'ransom_note'
  | 'brutalism_y2k'
  | 'text_bounce_pop'
  | 'wave_warp_displace'
  | 'random_scale_jitter';

export type HighlightAnimation =
  | 'bounce_pop'
  | 'slide_up'
  | 'zoom_pulse'
  | 'shake_wobble'
  | 'rubber_band'
  | 'karaoke_wave'
  | 'glow_pulse'
  | 'box_sticker'
  | 'color_fill'
  | 'beat_bounce_pop'
  | 'wave_warp'
  | 'position_scale_jitter';

export const DEFAULT_POWER_WORDS: string[] = [
  'RAHASIA',
  'VIRAL',
  'STOP',
  'CUAN',
  'BOHONG',
  'GILA',
  'BAHAYA',
  'JANGAN',
  'WOW',
  'GRATIS',
  'SUKSES',
  'HATI-HATI',
  'KAYA',
  'PENTING',
  'TERBONGKAR',
  'UPDATE',
  'MUSTAHIL',
  'CEPAT',
  'WARNING',
  'SERIUS',
  'JUARA',
  'NOMOR 1',
  'SECRET',
  'DANGER',
  'MONEY',
  'FREE',
  'SHOCKING',
  'NEVER',
  'ALWAYS',
  'TRUTH',
];

export interface SubtitleConfig {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: SubtitlePosition;
  customPosY?: number; // 5 to 95 (% of canvas height)
  customPosX?: number; // 5 to 95 (% of canvas width)
  style: SubtitleStyle;
  highlightAnimation?: HighlightAnimation;
  showBox: boolean;
  boxColor: string;
  reactToBeat: boolean;
  wordByWordSing?: boolean;
  showTranslation?: boolean;
  translationColor?: string;
  translationFontSize?: number;
  maxWordsPerLine?: number; // 2 to 8 words per chunk for kinetic captions
  autoWrapWidth?: number; // 0.6 to 0.95 (% of canvas width)
  wordSpacing?: number; // Extra spacing between words in pixels (-10 to 60)
  // Emotive Text Highlighting / POWER WORDS
  powerWordsEnabled?: boolean;
  powerWords?: string[];
  powerWordsColor?: string;
  powerWordsBgColor?: string;
  powerWordsBox?: boolean;
  powerWordsScale?: number;
  viralPreset?: string;
  lyrics: LyricSegment[];
}

export type VideoBackgroundPreset =
  | 'preset_none'
  | 'preset_cyberpunk'
  | 'preset_tunnel'
  | 'preset_lofi'
  | 'preset_synthwave'
  | 'preset_liquid'
  | 'custom_video';

export interface EffectsConfig {
  chromaticAberration: {
    enabled: boolean;
    intensity: number; // 0 to 20 px
    reactToBeat: boolean;
  };
  vhsOverlay: {
    enabled: boolean;
    scanlines: boolean;
    grain: boolean;
    noiseIntensity: number; // 0 to 1
    timestampOsd: boolean;
  };
  camera3D: {
    enabled: boolean;
    tiltX: number; // -45 to 45 deg
    tiltY: number; // -45 to 45 deg
    depth: number; // 0 to 1
    autoOrbit: boolean;
  };
  waveformScrubber: {
    enabled: boolean;
    height: number; // 10 to 60px
    style: 'bars' | 'wave' | 'mirror';
    primaryColor: string;
    progressColor: string;
    showTime: boolean;
  };
  videoBackground: {
    enabled: boolean;
    preset: VideoBackgroundPreset;
    customVideoUrl: string;
    playbackRate: number; // 0.5 to 2.0
    audioReactiveSpeed: boolean;
    opacity: number; // 0 to 1
  };
  cinematicLighting?: {
    enabled: boolean;
    ambientFlares: boolean;
    lightLeaks: boolean;
    intensity: number;
  };
  cinematicCamera?: {
    enabled: boolean;
    type: 'none' | 'slow_zoom' | 'pan' | 'drift';
    pulseOnBeat: boolean;
    intensity: number;
  };
}

export interface SpecterrPreset {
  id: string;
  name: string;
  category:
    | 'Electronic & EDM'
    | 'Lo-Fi & Chill'
    | 'Trap & Bass'
    | 'Synthwave & Cyber'
    | 'Minimalist & Studio'
    | 'Social & Creator';
  description: string;
  thumbnail: string;
  visualizer: VisualizerConfig;
  centerLogo: CenterLogoConfig;
  background: BackgroundConfig;
  particles: ParticlesConfig;
  typography: TypographyConfig;
  subtitle?: SubtitleConfig;
  effects?: EffectsConfig;
}

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  coverArt: string;
  genre: string;
  duration?: number;
  isCustom?: boolean;
}

export interface AudioFrequencyData {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  bassEnergy: number; // 0 to 1
  midEnergy: number; // 0 to 1
  trebleEnergy: number; // 0 to 1
  overallEnergy: number; // 0 to 1
  isBeat: boolean;
}

export interface RenderExportOptions {
  resolution: '1080p' | '720p' | '4k';
  fps: 30 | 60;
  format: 'webm' | 'mp4';
  aspectRatio: AspectRatio;
  durationMode: 'full' | 'clip_15' | 'clip_30' | 'clip_60' | 'custom_range';
  startTime?: number; // Starting timestamp in seconds (e.g. 45 for chorus/reff)
  endTime?: number;   // Ending timestamp in seconds
}
