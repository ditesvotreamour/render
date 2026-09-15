import { CanvasRenderer } from './utils/canvasRenderer';
import { OfflineAudioAnalyzer } from './utils/offlineAudioAnalyzer';
import { registerMediaUrl } from './utils/zipImageExtractor';
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
    __RENDER_FRAME__: (frameIndex: number, fps: number, startTime: number) => Promise<string> | string;
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

    // Preload and decode Logo & Background assets (images and videos) completely before starting frame render
    const imagePreloads: Promise<any>[] = [];
    if (logoConfig?.imageUrl) {
      imagePreloads.push(renderer.preloadMediaAsync(logoConfig.imageUrl));
    }
    if (bgConfig?.customImageUrl) {
      imagePreloads.push(renderer.preloadMediaAsync(bgConfig.customImageUrl));
    }
    if (Array.isArray(bgConfig?.multiImageUrls) && bgConfig.multiImageUrls.length > 0) {
      bgConfig.multiImageUrls.forEach((url) => {
        if (url) imagePreloads.push(renderer.preloadMediaAsync(url));
      });
    }
    if (Array.isArray(bgConfig?.multiImageSlides) && bgConfig.multiImageSlides.length > 0) {
      bgConfig.multiImageSlides.forEach((slide) => {
        if (slide?.url) {
          if (slide.mediaType) {
            registerMediaUrl(slide.url, slide.mediaType);
          }
          imagePreloads.push(renderer.preloadMediaAsync(slide.url, slide.mediaType));
        }
      });
    }
    if (Array.isArray(bgConfig?.bRoll?.clips) && bgConfig.bRoll.clips.length > 0) {
      bgConfig.bRoll.clips.forEach((clip) => {
        if (clip?.url) {
          if (clip.mediaType) {
            registerMediaUrl(clip.url, clip.mediaType);
          }
          imagePreloads.push(renderer.preloadMediaAsync(clip.url, clip.mediaType));
        }
      });
    }
    if (effectsConfig?.videoBackground?.customVideoUrl) {
      imagePreloads.push(renderer.preloadVideoAsync(effectsConfig.videoBackground.customVideoUrl));
    }
    await Promise.all(imagePreloads);

    // Preload typography and subtitle Google & Local Fonts before starting frame capture
    const fontPreloads = [
      // 400 / Normal weights (vital for Anton, Bebas Neue, Impact, Black Ops, Special Elite)
      '400 46px "Anton"',
      'normal 46px "Anton"',
      '400 46px "Bebas Neue"',
      'normal 46px "Bebas Neue"',
      '400 46px "Impact"',
      'normal 46px "Impact"',
      '400 46px "Black Ops One"',
      '400 46px "Special Elite"',
      '400 46px "Inter"',
      // 700 / 800 / 900 Bold weights
      '700 46px "Impact"',
      'bold 46px "Impact"',
      'bold 46px "Montserrat"',
      '800 46px "Montserrat"',
      '900 46px "Montserrat"',
      'bold 46px "Inter"',
      '800 46px "Inter"',
      'bold 46px "Kanit"',
      '800 46px "Kanit"',
      '900 46px "Kanit"',
      'bold 46px "Rubik"',
      '800 46px "Rubik"',
      '900 46px "Rubik"',
      'bold 46px "Poppins"',
      '800 46px "Poppins"',
      'bold 46px "Orbitron"',
      '800 46px "Orbitron"',
      'bold 46px "Cinzel"',
      '900 46px "Cinzel"',
      'bold 46px "Syne"',
      '800 46px "Syne"',
      'bold 46px "Syncopate"',
      'bold 46px "Courier Prime"',
      'italic bold 46px "Courier Prime"',
      'bold 46px "Playfair Display"',
      'italic bold 46px "Playfair Display"',
    ];
    if (document.fonts && document.fonts.load) {
      await Promise.allSettled(fontPreloads.map((f) => document.fonts.load(f)));
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Warm up canvas 2D font cache with active subtitle font
    const activeFont = subtitleConfig?.fontFamily || 'Montserrat';
    const isHeavy = activeFont === 'Anton' || activeFont === 'Impact' || activeFont === 'Bebas Neue';
    const testWeight = isHeavy ? 'normal' : 'bold';
    ctx.font = `${testWeight} 46px "${activeFont}", "Anton", sans-serif`;
    ctx.measureText('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG');

    window.__RENDER_READY__ = true;
    return true;
  } catch (err) {
    console.error('Failed to init renderer:', err);
    throw err;
  }
};

window.__RENDER_FRAME__ = async (frameIndex: number, fps: number, startTime: number): Promise<string> => {
  const currentTime = startTime + frameIndex / fps;
  const audioData = analyzer.getFrequencyDataAtTime(currentTime);

  // Preload any active frameSequence images so they are guaranteed ready in canvas
  const framePreloads: Promise<any>[] = [];
  if (bgConfig?.videoFrameSequence?.urlPattern) {
    const seq = bgConfig.videoFrameSequence;
    const total = Math.max(1, seq.frameCount || 1);
    const fNum = (Math.floor(currentTime * seq.fps) % total) + 1;
    const fUrl = seq.urlPattern.replace('%06d', String(fNum).padStart(6, '0'));
    framePreloads.push(renderer.preloadImageAsync(fUrl));
  }
  if (Array.isArray(bgConfig?.multiImageSlides)) {
    for (const slide of bgConfig.multiImageSlides) {
      if (slide?.frameSequence?.urlPattern) {
        if (currentTime >= slide.startSec - 1.0 && currentTime <= slide.endSec + 1.0) {
          const timeInSlide = Math.max(0, currentTime - slide.startSec);
          const total = Math.max(1, slide.frameSequence.frameCount || 1);
          const fNum = (Math.floor(timeInSlide * slide.frameSequence.fps) % total) + 1;
          const fUrl = slide.frameSequence.urlPattern.replace('%06d', String(fNum).padStart(6, '0'));
          framePreloads.push(renderer.preloadImageAsync(fUrl));
        }
      }
    }
  }
  if (Array.isArray(bgConfig?.bRoll?.clips)) {
    for (const clip of bgConfig.bRoll.clips) {
      if (clip?.frameSequence?.urlPattern) {
        if (currentTime >= clip.startSec - 1.0 && currentTime <= clip.endSec + 1.0) {
          const timeInClip = Math.max(0, currentTime - clip.startSec);
          const total = Math.max(1, clip.frameSequence.frameCount || 1);
          const fNum = (Math.floor(timeInClip * clip.frameSequence.fps) % total) + 1;
          const fUrl = clip.frameSequence.urlPattern.replace('%06d', String(fNum).padStart(6, '0'));
          framePreloads.push(renderer.preloadImageAsync(fUrl));
        }
      }
    }
  }
  if (framePreloads.length > 0) {
    await Promise.all(framePreloads);
  }

  // Synchronize active video element(s) frame position to exact currentTime before snapshotting (for videos without frame sequence)
  await renderer.syncActiveVideosForTime(bgConfig, currentTime);

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
    false, // isPlaying=false during offline frame capture so videos don't drift in wall-clock time
    subtitleConfig,
    effectsConfig
  );

  return canvas.toDataURL('image/png');
};
