import type { BRollClip, BRollDisplayMode, BRollPipPosition } from '../types/visualizer';

export interface BRollPresetItem {
  id: string;
  name: string;
  category: 'cinematic' | 'atmosphere' | 'retro' | 'abstract';
  description: string;
  url: string;
  thumbnailUrl: string;
  mediaType: 'image' | 'video';
  defaultMode: BRollDisplayMode;
  defaultPosition?: BRollPipPosition;
  defaultBlendMode?: string;
  durationSec: number;
}

export const BROLL_PRESETS: BRollPresetItem[] = [
  {
    id: 'preset_cyberpunk_neon',
    name: 'Cyberpunk Neon City',
    category: 'cinematic',
    description: 'Pemandangan malam kota futuristik penuh lampu neon bergerak sinematik.',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'cutaway',
    durationSec: 5,
  },
  {
    id: 'preset_lofi_rain',
    name: 'Lo-Fi Rainy Window',
    category: 'atmosphere',
    description: 'Tetesan air hujan di kaca jendela dengan latar lampu malam hangat yang syahdu.',
    url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'blend_overlay',
    defaultBlendMode: 'screen',
    durationSec: 6,
  },
  {
    id: 'preset_retro_vhs',
    name: 'Retro VHS Glitch',
    category: 'retro',
    description: 'Tekstur pita kaset VHS jadul 90an dengan scanlines dan glitch magnetik.',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'blend_overlay',
    defaultBlendMode: 'lighten',
    durationSec: 4.5,
  },
  {
    id: 'preset_golden_sunset',
    name: 'Golden Sunset Horizon',
    category: 'cinematic',
    description: 'Cahaya keemasan matahari terbenam menyinari siluet cakrawala yang megah.',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'cutaway',
    durationSec: 5.5,
  },
  {
    id: 'preset_concert_lasers',
    name: 'Concert Stage Lasers',
    category: 'cinematic',
    description: 'Sorotan laser panggung konser EDM spektakuler membelah asap dan penonton.',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'pip',
    defaultPosition: 'top_right',
    durationSec: 5,
  },
  {
    id: 'preset_light_leaks',
    name: 'Cinematic Light Leaks',
    category: 'atmosphere',
    description: 'Pendaran cahaya film burn oranye keemasan hangat untuk nuansa nostalgia.',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'blend_overlay',
    defaultBlendMode: 'screen',
    durationSec: 4,
  },
  {
    id: 'preset_cosmic_nebula',
    name: 'Cosmic Galaxy & Nebula',
    category: 'abstract',
    description: 'Bintang-bintang luar angkasa dan gas nebula violet ungu berkilau magis.',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'split_screen',
    durationSec: 6,
  },
  {
    id: 'preset_liquid_energy',
    name: 'Liquid Abstract Glow',
    category: 'abstract',
    description: 'Gelombang cairan neon 3D dinamis yang berdenyut mengikuti getaran nada.',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=360&auto=format&fit=crop',
    mediaType: 'image',
    defaultMode: 'pip',
    defaultPosition: 'bottom_right',
    durationSec: 5,
  },
];

export function createBRollClipFromPreset(preset: BRollPresetItem, startSec: number): BRollClip {
  return {
    id: `broll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    url: preset.url,
    name: preset.name,
    startSec,
    endSec: startSec + preset.durationSec,
    mediaType: preset.mediaType,
    displayMode: preset.defaultMode,
    pipPosition: preset.defaultPosition || 'top_right',
    pipScale: 0.32,
    opacity: 1,
    blendMode: preset.defaultBlendMode || 'screen',
    transition: 'fade',
    kenBurns: true,
  };
}
