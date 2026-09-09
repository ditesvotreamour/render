import { CanvasRenderer } from './utils/canvasRenderer';
import { OfflineAudioAnalyzer } from './utils/offlineAudioAnalyzer';
import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
} from './types/visualizer';

declare global {
  interface Window {
    __INIT_RENDER__: (config: any, audioBase64: string) => Promise<boolean>;
    __RENDER_FRAME__: (frameIndex: number, fps: number, startTime: number) => string;
    __RENDER_READY__: boolean;
  }
}

const canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
const renderer = new CanvasRenderer();
const analyzer = new OfflineAudioAnalyzer(2048);

let visualizerConfig: VisualizerConfig;
let logoConfig: CenterLogoConfig;
let bgConfig: BackgroundConfig;
let particlesConfig: ParticlesConfig;
let typographyConfig: TypographyConfig;
let subtitleConfig: SubtitleConfig | undefined;
let effectsConfig: any | undefined;
let durationSeconds: number = 180;
let renderWidth = 1920;
let renderHeight = 1080;

window.__INIT_RENDER__ = async (config: any, audioBase64: string) => {
  try {
    visualizerConfig = config.visualizer;
    logoConfig = config.centerLogo;
    bgConfig = config.background;
    particlesConfig = config.particles;
    typographyConfig = config.typography;
    subtitleConfig = config.subtitle;
    effectsConfig = config.effects;
    const exportOpts = config.exportOptions || config.options || {};
    durationSeconds = exportOpts.duration || config.duration || 180;

    const res = exportOpts.resolution || '1080p';
    const aspect = config.aspectRatio || exportOpts.aspectRatio || '16:9';

    if (res === '4k') {
      if (aspect === '9:16') {
        renderWidth = 2160;
        renderHeight = 3840;
      } else if (aspect === '1:1') {
        renderWidth = 2160;
        renderHeight = 2160;
      } else if (aspect === '4:5') {
        renderWidth = 2160;
        renderHeight = 2700;
      } else {
        renderWidth = 3840;
        renderHeight = 2160;
      }
    } else if (res === '720p') {
      if (aspect === '9:16') {
        renderWidth = 720;
        renderHeight = 1280;
      } else if (aspect === '1:1') {
        renderWidth = 720;
        renderHeight = 720;
      } else if (aspect === '4:5') {
        renderWidth = 864;
        renderHeight = 1080;
      } else {
        renderWidth = 1280;
        renderHeight = 720;
      }
    } else {
      // 1080p Default
      if (aspect === '9:16') {
        renderWidth = 1080;
        renderHeight = 1920;
      } else if (aspect === '1:1') {
        renderWidth = 1080;
        renderHeight = 1080;
      } else if (aspect === '4:5') {
        renderWidth = 1080;
        renderHeight = 1350;
      } else {
        renderWidth = 1920;
        renderHeight = 1080;
      }
    }

    canvas.width = renderWidth;
    canvas.height = renderHeight;

    // Decode Audio Buffer
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let audioBuffer: AudioBuffer;

    if (audioBase64.startsWith('data:')) {
      const response = await fetch(audioBase64);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } else {
      // Fetch URL
      const response = await fetch(audioBase64);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    }

    analyzer.setAudioBuffer(audioBuffer);

    // Preload and decode Logo & Background assets completely before starting frame render
    const imagePreloads: Promise<any>[] = [];
    if (logoConfig?.imageUrl) {
      imagePreloads.push(renderer.preloadImageAsync(logoConfig.imageUrl));
    }
    if (bgConfig?.customImageUrl) {
      imagePreloads.push(renderer.preloadImageAsync(bgConfig.customImageUrl));
    }
    if (Array.isArray(bgConfig?.multiImageUrls) && bgConfig.multiImageUrls.length > 0) {
      bgConfig.multiImageUrls.forEach((url) => {
        if (url) imagePreloads.push(renderer.preloadImageAsync(url));
      });
    }
    await Promise.all(imagePreloads);

    window.__RENDER_READY__ = true;
    return true;
  } catch (err) {
    console.error('Failed to init renderer:', err);
    throw err;
  }
};

window.__RENDER_FRAME__ = (frameIndex: number, fps: number, startTime: number): string => {
  const currentTime = startTime + frameIndex / fps;
  const audioData = analyzer.getFrequencyDataAtTime(currentTime);

  renderer.render(
    ctx,
    renderWidth,
    renderHeight,
    visualizerConfig,
    logoConfig,
    bgConfig,
    particlesConfig,
    typographyConfig,
    audioData,
    currentTime,
    durationSeconds,
    true,
    subtitleConfig,
    effectsConfig
  );

  return canvas.toDataURL('image/png');
};
