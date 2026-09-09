import type { EffectsConfig } from '../types/visualizer';

export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  chromaticAberration: {
    enabled: false,
    intensity: 8,
    reactToBeat: true,
  },
  vhsOverlay: {
    enabled: false,
    scanlines: true,
    grain: true,
    noiseIntensity: 0.15,
    timestampOsd: true,
  },
  camera3D: {
    enabled: false,
    tiltX: 12,
    tiltY: -8,
    depth: 0.35,
    autoOrbit: false,
  },
  waveformScrubber: {
    enabled: true,
    height: 22,
    style: 'bars',
    primaryColor: '#00F0FF',
    progressColor: '#EC4899',
    showTime: true,
  },
  videoBackground: {
    enabled: false,
    preset: 'preset_none',
    customVideoUrl: '',
    playbackRate: 1.0,
    audioReactiveSpeed: true,
    opacity: 0.85,
  },
  cinematicLighting: {
    enabled: false,
    ambientFlares: true,
    lightLeaks: true,
    intensity: 0.5,
  },
  cinematicCamera: {
    enabled: false,
    type: 'none',
    pulseOnBeat: false,
    intensity: 0.5,
  },
};

export const VIDEO_PRESETS: {
  id: string;
  name: string;
  desc: string;
  url: string;
  thumbnail: string;
}[] = [
  {
    id: 'preset_cyberpunk',
    name: 'Cyberpunk Neon City',
    desc: 'Futuristic highway night drive loop',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-futuristic-tunnel-31835-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset_tunnel',
    name: '3D Hyperspace Warp',
    desc: 'Infinite glowing neon portal',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-41484-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset_lofi',
    name: 'Lo-Fi Chill & Rain',
    desc: 'Aesthetic ambient rain reflections',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-the-water-of-a-glass-roof-41525-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset_synthwave',
    name: '1984 Retrowave Sunset',
    desc: 'Neon grid wireframe landscape',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-neon-lights-31834-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset_liquid',
    name: 'Holographic Liquid Silk',
    desc: 'Psychedelic iridescent fluid motion',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-colorful-liquid-abstract-background-40742-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&auto=format&fit=crop&q=80',
  },
];
