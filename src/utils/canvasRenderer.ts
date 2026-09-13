import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  AudioFrequencyData,
  EffectsConfig,
  SocialBadgeConfig,
  FrameSequenceConfig,
  BRollConfig,
  VisualEffectType,
} from '../types/visualizer';
import { DEFAULT_POWER_WORDS } from '../types/visualizer';
import { VIDEO_PRESETS } from '../constants/defaultEffects';
import { isVideoMedia } from './zipImageExtractor';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface PeakCap {
  value: number;
  velocity: number;
}

export class CanvasRenderer {
  private particles: Particle[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private blurredImageCache: Map<string, HTMLCanvasElement> = new Map();
  private videoCache: Map<string, HTMLVideoElement> = new Map();
  private rotationAngle: number = 0;
  private peakCaps: PeakCap[] = [];
  private gridOffset: number = 0;
  private tunnelRings: { radius: number; speed: number; alpha: number }[] = [];
  private orbitAngle1: number = 0;
  private orbitAngle2: number = 0;
  private dotsTime: number = 0;
  private ribbonPhase: number = 0;
  // Trap Nation shockwave rings
  private shockwaves: { radius: number; maxRadius: number; alpha: number; width: number; color: string }[] = [];
  private lastShockwaveSpawn: number = 0;
  // 3D Cyber Tunnel state
  private tunnel3dAngle: number = 0;
  private tunnel3dZOffset: number = 0;
  // Neon Infinity Helix state
  private helixPhase: number = 0;
  // Audio Aura Plasma state
  private auraTime: number = 0;
  private auraEmbers: { angle: number; dist: number; speed: number; size: number; alpha: number; color: string }[] = [];

  constructor() {
    this.initTunnelRings();
  }

  private initTunnelRings(): void {
    this.tunnelRings = [];
    for (let i = 0; i < 12; i++) {
      this.tunnelRings.push({
        radius: (i + 1) * 35,
        speed: 1.5 + (i * 0.2),
        alpha: 0.1 + (i * 0.06),
      });
    }
  }

  public preloadImage(url: string): HTMLImageElement | null {
    if (!url) return null;
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    this.imageCache.set(url, img);
    return img;
  }

  public preloadImageAsync(url: string): Promise<HTMLImageElement | null> {
    if (!url) return Promise.resolve(null);
    if (this.imageCache.has(url)) {
      const cached = this.imageCache.get(url)!;
      if (cached.complete && cached.naturalWidth > 0) {
        return Promise.resolve(cached);
      }
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = (err) => {
        console.warn('⚠️ Failed to preload image asset:', url, err);
        resolve(null);
      };
      img.src = url;
    });
  }

  public preloadVideo(url: string): HTMLVideoElement | null {
    if (!url || typeof document === 'undefined') return null;
    if (this.videoCache.has(url)) {
      const existing = this.videoCache.get(url)!;
      const harness = document.getElementById('video-harness') || document.body;
      if (harness && !existing.parentElement) {
        harness.appendChild(existing);
      }
      return existing;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    const harness = document.getElementById('video-harness') || document.body;
    if (harness && !video.parentElement) {
      harness.appendChild(video);
    }
    video.play().catch(() => {});
    this.videoCache.set(url, video);
    return video;
  }

  public preloadVideoAsync(url: string): Promise<HTMLVideoElement | null> {
    if (!url || typeof document === 'undefined') return Promise.resolve(null);
    if (this.videoCache.has(url)) {
      const cached = this.videoCache.get(url)!;
      const harness = document.getElementById('video-harness') || document.body;
      if (harness && !cached.parentElement) {
        harness.appendChild(cached);
      }
      if (cached.readyState >= 2 || cached.videoWidth > 0) {
        return Promise.resolve(cached);
      }
    }
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      const harness = document.getElementById('video-harness') || document.body;
      if (harness && !video.parentElement) {
        harness.appendChild(video);
      }
      let resolved = false;
      const onReady = () => {
        if (!resolved) {
          resolved = true;
          this.videoCache.set(url, video);
          resolve(video);
        }
      };
      video.onloadeddata = onReady;
      video.oncanplay = onReady;
      video.onerror = (err) => {
        console.warn('⚠️ Failed to preload video asset:', url, err);
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      };
      setTimeout(() => onReady(), 3500);
      video.src = url;
      video.load();
    });
  }

  public preloadMediaAsync(url: string, mediaType?: 'image' | 'video'): Promise<any> {
    if (isVideoMedia(url, mediaType)) {
      return this.preloadVideoAsync(url);
    }
    return this.preloadImageAsync(url);
  }

  public async syncVideoTime(video: HTMLVideoElement, targetTime: number): Promise<void> {
    if (!video) return;
    const harness = document.getElementById('video-harness') || document.body;
    if (harness && !video.parentElement) {
      harness.appendChild(video);
    }
    if (!video.paused) {
      video.pause();
    }
    const dur = video.duration;
    if (!dur || !Number.isFinite(dur) || dur <= 0) return;

    const clamped = Math.max(0, Math.min(dur - 0.05, targetTime % dur));
    if (Math.abs(video.currentTime - clamped) < 0.015) {
      return;
    }

    await new Promise<void>((resolve) => {
      let done = false;
      const onDone = () => {
        if (!done) {
          done = true;
          video.removeEventListener('seeked', onDone);
          resolve();
        }
      };
      video.addEventListener('seeked', onDone);
      try {
        video.currentTime = clamped;
      } catch {
        onDone();
      }
      setTimeout(onDone, 90);
    });
  }

  public async syncActiveVideosForTime(bg?: BackgroundConfig, currentTime: number = 0): Promise<void> {
    if (!bg) return;
    const syncPromises: Promise<any>[] = [];

    // 1. Custom Image / Video Background
    if (bg.type === 'custom_image' && bg.customImageUrl && isVideoMedia(bg.customImageUrl)) {
      const vid = this.preloadVideo(bg.customImageUrl);
      if (vid) {
        syncPromises.push(this.syncVideoTime(vid, currentTime));
      }
    }

    // 2. Multi-image Slideshow / Timeline Clips
    if (bg.type === 'multi_image') {
      if (bg.multiImageSlides && bg.multiImageSlides.length > 0) {
        const slides = bg.multiImageSlides;
        let currIdx = slides.findIndex((s) => currentTime >= s.startSec && currentTime < s.endSec);
        if (currIdx === -1) {
          currIdx = currentTime < slides[0].startSec ? 0 : slides.length - 1;
        }
        const curSlide = slides[currIdx];
        if (curSlide && isVideoMedia(curSlide.url, curSlide.mediaType)) {
          const vid = this.preloadVideo(curSlide.url);
          if (vid) {
            const timeInSlide = Math.max(0, currentTime - curSlide.startSec);
            syncPromises.push(this.syncVideoTime(vid, timeInSlide));
          }
        }
        const slideDur = Math.max(0.5, curSlide.endSec - curSlide.startSec);
        const timeInSlide = Math.max(0, currentTime - curSlide.startSec);
        const transitionTime = Math.min(1.8, Math.max(0.6, slideDur * 0.32));
        if (timeInSlide > (slideDur - transitionTime) && slides.length > 1) {
          const nextIdx = (currIdx + 1) % slides.length;
          const nextSlide = slides[nextIdx];
          if (nextSlide && isVideoMedia(nextSlide.url, nextSlide.mediaType)) {
            const nextVid = this.preloadVideo(nextSlide.url);
            if (nextVid) {
              syncPromises.push(this.syncVideoTime(nextVid, 0));
            }
          }
        }
      } else if (bg.multiImageUrls && bg.multiImageUrls.length > 0) {
        const interval = Math.max(1, bg.multiImageInterval || 5);
        const count = bg.multiImageUrls.length;
        const cycleIndex = Math.floor(currentTime / interval);
        const currIdx = cycleIndex % count;
        const url = bg.multiImageUrls[currIdx];
        if (url && isVideoMedia(url)) {
          const vid = this.preloadVideo(url);
          if (vid) {
            const timeInCurrent = currentTime - cycleIndex * interval;
            syncPromises.push(this.syncVideoTime(vid, timeInCurrent));
          }
        }
      }
    }

    // 3. B-Roll Overlay Videos
    if (bg.bRoll && bg.bRoll.enabled !== false && bg.bRoll.clips && bg.bRoll.clips.length > 0) {
      for (const clip of bg.bRoll.clips) {
        if (currentTime >= clip.startSec && currentTime <= clip.endSec) {
          if (isVideoMedia(clip.url, clip.mediaType)) {
            const vid = this.preloadVideo(clip.url);
            if (vid) {
              const timeInClip = Math.max(0, currentTime - clip.startSec);
              syncPromises.push(this.syncVideoTime(vid, timeInClip));
            }
          }
        }
      }
    }

    if (syncPromises.length > 0) {
      await Promise.all(syncPromises);
    }
  }

  public getBlurredImage(img: HTMLImageElement, blurRadius: number): CanvasImageSource {
    if (blurRadius <= 0) return img;
    const key = `${img.src}_${blurRadius}`;
    if (this.blurredImageCache.has(key)) {
      return this.blurredImageCache.get(key)!;
    }
    if (typeof document === 'undefined') return img;
    const offCanvas = document.createElement('canvas');
    // Scale down for ultra fast blur rasterization
    const scale = Math.min(1.0, 960 / Math.max(img.naturalWidth, 1));
    offCanvas.width = Math.max(64, Math.round(img.naturalWidth * scale));
    offCanvas.height = Math.max(64, Math.round(img.naturalHeight * scale));
    const offCtx = offCanvas.getContext('2d');
    if (offCtx) {
      offCtx.filter = `blur(${Math.max(1, blurRadius * scale)}px)`;
      offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
    }
    this.blurredImageCache.set(key, offCanvas);
    return offCanvas;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    visualizer: VisualizerConfig,
    logo: CenterLogoConfig,
    bg: BackgroundConfig,
    particlesConfig: ParticlesConfig,
    typography: TypographyConfig,
    audioData: AudioFrequencyData,
    currentTime: number = 0,
    duration: number = 180,
    isPlaying: boolean = false,
    subtitle?: SubtitleConfig,
    effects?: EffectsConfig
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const bass = audioData.bassEnergy;

    let shakeX = 0;
    let shakeY = 0;
    if (bg.bassShake > 0 && bass > 0.32 && isPlaying) {
      const shakeMagnitude = (bass - 0.32) * bg.bassShake * 22;
      shakeX = (Math.random() - 0.5) * shakeMagnitude;
      shakeY = (Math.random() - 0.5) * shakeMagnitude;
    }

    let zoom = 1 + (isPlaying ? Math.pow(bass, 1.35) * bg.bassZoom * 0.08 : 0);

    let cinemPanX = 0;
    let cinemPanY = 0;
    if (effects?.cinematicCamera?.enabled && isPlaying) {
      const cam = effects.cinematicCamera;
      const t = currentTime * 0.1;
      const intensity = cam.intensity || 0.5;
      
      if (cam.type === 'slow_zoom') {
        zoom += Math.sin(t) * 0.08 * intensity;
      } else if (cam.type === 'pan') {
        cinemPanX = Math.sin(t * 0.5) * 60 * intensity;
        cinemPanY = Math.cos(t * 0.4) * 40 * intensity;
      } else if (cam.type === 'drift') {
        cinemPanX = Math.sin(t * 0.3) * 40 * intensity;
        cinemPanY = Math.sin(t * 0.7) * 30 * intensity;
        zoom += (Math.cos(t * 0.5) - 1) * 0.04 * intensity; // slight zoom drift
      }
      
      if (cam.pulseOnBeat) {
        zoom += bass * 0.05 * intensity;
      }
    }

    const totalShakeX = shakeX + cinemPanX;
    const totalShakeY = shakeY + cinemPanY;

    ctx.save();
    ctx.translate(centerX + totalShakeX, centerY + totalShakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -centerY);

    // --- 2. Draw Background ---
    this.drawBackground(ctx, width, height, bg, bass, isPlaying, currentTime, effects);

    // --- 2.5 Draw B-Roll Layer (Cutaways, PiP, Split Screen, Blend Overlay) ---
    if (bg.bRoll && bg.bRoll.enabled !== false && bg.bRoll.clips && bg.bRoll.clips.length > 0) {
      this.drawBRollLayer(ctx, width, height, bg.bRoll, currentTime, isPlaying);
    }

    // --- 3. Draw Background Particles ---
    if (particlesConfig.enabled) {
      this.updateAndDrawParticles(ctx, width, height, particlesConfig, bass, audioData.isBeat && isPlaying);
    }

    ctx.restore(); // restore from shake & zoom for visualizer layer (which applies its own scale)

    // Apply centered transformation for Visualizer & Center Logo
    ctx.save();
    ctx.translate(centerX + totalShakeX * 0.5, centerY + totalShakeY * 0.5);

    // --- 3D Perspective & Camera Tilt ---
    if (effects?.camera3D?.enabled) {
      this.apply3DCameraTransform(ctx, effects.camera3D, currentTime, isPlaying);
    }

    // --- 4. Draw Center Logo / Artwork ---
    // Punchy speaker-cone bounce: expands dynamically on every bass drop
    const bounceFactor = logo.bounceIntensity ?? 1.0;
    const logoScale = 1 + (isPlaying && logo.enabled ? Math.pow(bass, 1.2) * bounceFactor * 0.22 : 0);
    this.drawCenterLogo(ctx, logo, logoScale, bass, isPlaying);

    // --- 5. Draw Visualizer Spectrum ---
    if (visualizer.enabled !== false) {
      this.drawVisualizer(ctx, visualizer, audioData, isPlaying);
    }

    ctx.restore(); // restore center transformation

    // --- 6. TARGETED FRAME VISUAL EFFECTS (Distorsi, Kamera Jadul, Cacing-cacing) ---
    // Dijalankan pada layer video/visual SEBELUM tipografi & subtitle, agar subtitle selalu bersih, tajam & tidak terdistorsi!
    this.drawTargetedFrameEffects(ctx, width, height, bg, currentTime, bass, isPlaying);

    // --- 7. POST PROCESSING EFFECTS (RGB Glitch & VHS CRT) ---
    if (effects?.chromaticAberration?.enabled) {
      this.drawChromaticAberration(ctx, width, height, effects.chromaticAberration, bass, audioData.isBeat && isPlaying);
    }

    if (effects?.vhsOverlay?.enabled) {
      this.drawVhsOverlay(ctx, width, height, effects.vhsOverlay, currentTime);
    }

    // --- 8. Draw Typography & Song Info HUD (Untouched by camera effects) ---
    this.drawTypography(ctx, width, height, typography, currentTime, duration, bass, isPlaying);

    // --- 9. Draw Whisper AI Subtitles / Karaoke Lyrics (Always crystal-clear on top) ---
    if (subtitle && subtitle.enabled) {
      this.drawSubtitles(ctx, width, height, subtitle, currentTime, bass, isPlaying);
    }

    // --- 10. Waveform Scrubber HUD ---
    if (effects?.waveformScrubber?.enabled) {
      this.drawWaveformScrubber(ctx, width, height, effects.waveformScrubber, audioData, currentTime, duration);
    }

    ctx.restore();
  }

  // ==========================================
  // BACKGROUND RENDERERS
  // ==========================================
  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bg: BackgroundConfig,
    bass: number,
    isPlaying: boolean,
    currentTime: number,
    effects?: EffectsConfig
  ): void {
    const centerX = width / 2;
    const centerY = height / 2;

    // Removed from here to prevent solid fills from hiding it

    if (bg.type === 'custom_image' && bg.customImageUrl) {
      if (bg.videoFrameSequence && bg.videoFrameSequence.urlPattern) {
        const seq = bg.videoFrameSequence;
        const totalFrames = Math.max(1, seq.frameCount || 1);
        const frameIdx = (Math.floor(currentTime * seq.fps) % totalFrames) + 1;
        const frameUrl = seq.urlPattern.replace('%06d', String(frameIdx).padStart(6, '0'));
        const frameImg = this.preloadImage(frameUrl);
        if (frameImg && frameImg.complete && frameImg.naturalWidth > 0) {
          ctx.save();
          const sourceToDraw = bg.blur > 0 ? this.getBlurredImage(frameImg, bg.blur) : frameImg;
          const naturalW = frameImg.naturalWidth;
          const naturalH = frameImg.naturalHeight;
          const imgRatio = naturalW / naturalH;
          const canvasRatio = width / height;
          let dw = width, dh = height, dx = 0, dy = 0;
          if (imgRatio > canvasRatio) {
            dw = height * imgRatio;
            dx = (width - dw) / 2;
          } else {
            dh = width / imgRatio;
            dy = (height - dh) / 2;
          }
          ctx.drawImage(sourceToDraw, dx, dy, dw, dh);
          ctx.restore();
          return;
        }
      }

      const isVid = isVideoMedia(bg.customImageUrl);
      if (isVid) {
        const video = this.preloadVideo(bg.customImageUrl);
        if (video) {
          video.muted = true;
          video.volume = 0;
          if (isPlaying) {
            if (video.paused) video.play().catch(() => {});
          } else {
            if (!video.paused) video.pause();
          }
          if (video.readyState >= 1 || (video.videoWidth || 0) > 0) {
            ctx.save();
            const naturalW = video.videoWidth || 1920;
            const naturalH = video.videoHeight || 1080;
            const imgRatio = naturalW / naturalH;
            const canvasRatio = width / height;
            let dw = width, dh = height, dx = 0, dy = 0;
            if (imgRatio > canvasRatio) {
              dw = height * imgRatio;
              dx = (width - dw) / 2;
            } else {
              dh = width / imgRatio;
              dy = (height - dh) / 2;
            }
            ctx.drawImage(video, dx, dy, dw, dh);
            ctx.restore();
          }
        }
      } else {
        const img = this.preloadImage(bg.customImageUrl);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.save();
          const sourceToDraw = bg.blur > 0 ? this.getBlurredImage(img, bg.blur) : img;
          // Aspect ratio cover
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const canvasRatio = width / height;
          let dw = width;
          let dh = height;
          let dx = 0;
          let dy = 0;

          if (imgRatio > canvasRatio) {
            dw = height * imgRatio;
            dx = (width - dw) / 2;
          } else {
            dh = width / imgRatio;
            dy = (height - dh) / 2;
          }
          ctx.drawImage(sourceToDraw, dx, dy, dw, dh);
          ctx.restore();
        } else {
          ctx.fillStyle = bg.solidColor || '#07080E';
          ctx.fillRect(0, 0, width, height);
        }
      }
    } else if (bg.type === 'multi_image' && ((bg.multiImageSlides && bg.multiImageSlides.length > 0) || (bg.multiImageUrls && bg.multiImageUrls.length > 0))) {
      // Draw base solid color behind images
      ctx.fillStyle = bg.solidColor || '#07080E';
      ctx.fillRect(0, 0, width, height);

      // --- CONTINUOUS CINEMATIC KEN BURNS & TRANSITIONS ENGINE ---
      const totalTime = Math.max(0, currentTime);
      const isKenBurns = bg.multiImageKenBurns !== false;
      const transType = bg.multiImageTransition || 'fade';

      // Reusable drawer for media (photo or video) with continuous global-time camera trajectory
      const renderSlideMedia = (
        url: string,
        opacity: number,
        slideIdx: number,
        startSec: number,
        slideDur: number,
        extraTransform?: { scaleMul?: number; offsetX?: number; offsetY?: number },
        mediaType?: 'image' | 'video',
        frameSeq?: FrameSequenceConfig
      ) => {
        if (opacity <= 0.001) return;
        const isVid = isVideoMedia(url, mediaType);
        let sourceToDraw: CanvasImageSource | null = null;
        let naturalW = 1920;
        let naturalH = 1080;

        // 1. Frame sequence image support (FFmpeg pre-extracted frames for 100% reliable cloud render)
        if (frameSeq && frameSeq.urlPattern) {
          const timeInSlide = Math.max(0, totalTime - startSec);
          const totalFrames = Math.max(1, frameSeq.frameCount || 1);
          const rawFrame = Math.floor(timeInSlide * frameSeq.fps);
          const frameNum = (rawFrame % totalFrames) + 1;
          const frameUrl = frameSeq.urlPattern.replace('%06d', String(frameNum).padStart(6, '0'));
          const img = this.preloadImage(frameUrl);
          if (img && img.complete && img.naturalWidth > 0) {
            naturalW = img.naturalWidth;
            naturalH = img.naturalHeight;
            sourceToDraw = bg.blur > 0 ? this.getBlurredImage(img, bg.blur) : img;
          }
        }

        // 2. Video element fallback (live studio or when frame sequence not used)
        if (!sourceToDraw && isVid) {
          const video = this.preloadVideo(url);
          if (!video) return;

          video.muted = true;
          video.volume = 0;

          // Sync video position with slide duration & looping
          const timeInSlide = Math.max(0, totalTime - startSec);
          if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
            const targetTime = timeInSlide % video.duration;
            if (Math.abs(video.currentTime - targetTime) > 0.35) {
              video.currentTime = targetTime;
            }
          }

          if (isPlaying) {
            if (video.paused) {
              video.play().catch(() => {});
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
          }

          if (video.readyState >= 1 || (video.videoWidth || 0) > 0) {
            naturalW = video.videoWidth || 1920;
            naturalH = video.videoHeight || 1080;
            sourceToDraw = video;
          }
        } else if (!sourceToDraw) {
          const img = this.preloadImage(url);
          if (!img || !img.complete || img.naturalWidth <= 0) return;
          naturalW = img.naturalWidth;
          naturalH = img.naturalHeight;
          sourceToDraw = bg.blur > 0 ? this.getBlurredImage(img, bg.blur) : img;
        }

        if (!sourceToDraw) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

        if (isKenBurns) {
          // Strictly monotonic progress across this slide's entire lifetime (including fade in and fade out)
          // Notice: (totalTime - startSec) / duration does NOT jump or rewind when slide boundary changes!
          const rawP = (totalTime - startSec) / Math.max(0.5, slideDur);
          const clampedP = Math.max(0, Math.min(1, rawP));
          // Silky S-curve easing
          const smoothP = clampedP * clampedP * (3 - 2 * clampedP);
          const effectiveP = rawP < 0 ? rawP * 0.9 : rawP > 1 ? 1 + (rawP - 1) * 0.9 : smoothP;

          // 6 distinct cinematic director choreographies
          const pattern = Math.abs(slideIdx) % 6;
          // Noticeable, dramatic zoom: 1.08x to 1.28x (20% dynamic zoom!)
          let scale = 1.08;
          // Proportional pan: responsive to resolution (e.g. 80-90px on 1080p, 160px on 4K)
          const panMaxX = width * 0.045;
          const panMaxY = height * 0.035;
          let panX = 0;
          let panY = 0;

          switch (pattern) {
            case 0:
              // 1. Slow Cinematic Zoom In + Drift Up-Right
              scale = 1.08 + effectiveP * 0.18;
              panX = (effectiveP - 0.5) * panMaxX;
              panY = (0.5 - effectiveP) * panMaxY;
              break;

            case 1:
              // 2. Slow Dramatic Zoom Out + Drift Down-Left
              scale = 1.26 - effectiveP * 0.18;
              panX = (0.5 - effectiveP) * panMaxX;
              panY = (effectiveP - 0.5) * panMaxY;
              break;

            case 2:
              // 3. Wide Panoramic Pan Left to Right (Steady majestic framing)
              scale = 1.15 + Math.sin(clampedP * Math.PI) * 0.05;
              panX = (effectiveP - 0.5) * (panMaxX * 1.5);
              panY = Math.sin(clampedP * Math.PI) * (panMaxY * 0.4);
              break;

            case 3:
              // 4. Wide Pan Right to Left + Slow Dramatic Zoom In
              scale = 1.10 + effectiveP * 0.16;
              panX = (0.5 - effectiveP) * (panMaxX * 1.5);
              panY = (effectiveP - 0.5) * (panMaxY * 0.5);
              break;

            case 4:
              // 5. Deep Center Focus Zoom In (Hero / Portrait Shot)
              scale = 1.08 + effectiveP * 0.20;
              panX = Math.sin(clampedP * Math.PI) * (panMaxX * 0.25);
              panY = -effectiveP * (panMaxY * 0.85);
              break;

            case 5:
            default:
              // 6. Pull Back Reveal (Center-Top Close-Up to Wide Atmosphere)
              scale = 1.28 - effectiveP * 0.19;
              panX = Math.cos(clampedP * Math.PI) * (panMaxX * 0.35);
              panY = (effectiveP - 0.5) * (panMaxY * 0.8);
              break;
          }

          // Audio-reactive bass breathing punch (only if bassZoom > 0 or bassShake > 0)
          if (isPlaying && bass > 0.08 && ((bg.bassZoom || 0) > 0 || (bg.bassShake || 0) > 0)) {
            const bassPulse = (bg.bassZoom || 0) > 0 ? Math.pow(bass, 1.3) * (bg.bassZoom * 0.08) : 0;
            scale += bassPulse;
            if (bg.bassShake && bg.bassShake > 0) {
              const shakeAmt = bg.bassShake * bass * 14;
              panX += Math.sin(totalTime * 38) * shakeAmt;
              panY += Math.cos(totalTime * 46) * shakeAmt;
            }
          }

          // Apply transition-specific modifiers (e.g. for zoom push / slide)
          if (extraTransform) {
            if (extraTransform.scaleMul) scale *= extraTransform.scaleMul;
            if (extraTransform.offsetX) panX += extraTransform.offsetX;
            if (extraTransform.offsetY) panY += extraTransform.offsetY;
          }

          ctx.translate(centerX + panX, centerY + panY);
          ctx.scale(scale, scale);
          ctx.translate(-centerX, -centerY);
        } else if (extraTransform) {
          if (extraTransform.offsetX || extraTransform.offsetY) {
            ctx.translate(extraTransform.offsetX || 0, extraTransform.offsetY || 0);
          }
          if (extraTransform.scaleMul && extraTransform.scaleMul !== 1) {
            ctx.translate(centerX, centerY);
            ctx.scale(extraTransform.scaleMul, extraTransform.scaleMul);
            ctx.translate(-centerX, -centerY);
          }
        }

        const imgRatio = naturalW / naturalH;
        const canvasRatio = width / height;
        let dw = width, dh = height, dx = 0, dy = 0;
        if (imgRatio > canvasRatio) {
          dw = height * imgRatio;
          dx = (width - dw) / 2;
        } else {
          dh = width / imgRatio;
          dy = (height - dh) / 2;
        }
        ctx.drawImage(sourceToDraw, dx, dy, dw, dh);
        ctx.restore();
      };

      // --- Determine Active & Next Slide based on Mode ---
      if (bg.multiImageSlides && bg.multiImageSlides.length > 0) {
        const slides = bg.multiImageSlides;
        let currIdx = slides.findIndex((s) => totalTime >= s.startSec && totalTime < s.endSec);
        if (currIdx === -1) {
          currIdx = totalTime < slides[0].startSec ? 0 : slides.length - 1;
        }

        const currentSlide = slides[currIdx];
        const slideDur = Math.max(0.5, currentSlide.endSec - currentSlide.startSec);
        const timeInSlide = Math.max(0, totalTime - currentSlide.startSec);
        const nextIdx = (currIdx + 1) % slides.length;
        const nextSlide = slides[nextIdx];
        const nextDur = Math.max(0.5, nextSlide.endSec - nextSlide.startSec);

        // Smooth cinematic transition duration (1.0s to 1.8s for standard slides, shorter for brief clips)
        const transitionTime = Math.min(1.8, Math.max(0.6, slideDur * 0.32));
        const canTransition = transType !== 'cut' && (currIdx < slides.length - 1 || slides.length > 1);
        const inTransition = canTransition && timeInSlide > (slideDur - transitionTime);

        if (inTransition) {
          const transP = (timeInSlide - (slideDur - transitionTime)) / transitionTime;
          const smoothTransP = Math.max(0, Math.min(1, transP));
          const easeT = 0.5 - 0.5 * Math.cos(smoothTransP * Math.PI); // Silky S-curve cosine

          if (transType === 'fade_black') {
            // Cinematic Dip to Black
            if (smoothTransP < 0.5) {
              const alphaOut = 1 - smoothTransP * 2;
              renderSlideMedia(currentSlide.url, alphaOut, currIdx, currentSlide.startSec, slideDur, undefined, currentSlide.mediaType, currentSlide.frameSequence);
            } else {
              const alphaIn = (smoothTransP - 0.5) * 2;
              renderSlideMedia(nextSlide.url, alphaIn, nextIdx, nextSlide.startSec, nextDur, undefined, nextSlide.mediaType, nextSlide.frameSequence);
            }
          } else if (transType === 'zoom') {
            // Zoom-Through Push Dissolve
            const outScale = 1 + easeT * 0.12;
            const inScale = 1.14 - easeT * 0.14;
            renderSlideMedia(currentSlide.url, 1 - easeT, currIdx, currentSlide.startSec, slideDur, { scaleMul: outScale }, currentSlide.mediaType, currentSlide.frameSequence);
            renderSlideMedia(nextSlide.url, easeT, nextIdx, nextSlide.startSec, nextDur, { scaleMul: inScale }, nextSlide.mediaType, nextSlide.frameSequence);
          } else if (transType === 'slide') {
            // Slide / Push Horizontal
            const outX = -easeT * width;
            const inX = (1 - easeT) * width;
            renderSlideMedia(currentSlide.url, 1, currIdx, currentSlide.startSec, slideDur, { offsetX: outX }, currentSlide.mediaType, currentSlide.frameSequence);
            renderSlideMedia(nextSlide.url, 1, nextIdx, nextSlide.startSec, nextDur, { offsetX: inX }, nextSlide.mediaType, nextSlide.frameSequence);
          } else {
            // Default: Buttery Smooth Crossfade / Dissolve
            renderSlideMedia(currentSlide.url, 1, currIdx, currentSlide.startSec, slideDur, undefined, currentSlide.mediaType, currentSlide.frameSequence);
            renderSlideMedia(nextSlide.url, easeT, nextIdx, nextSlide.startSec, nextDur, undefined, nextSlide.mediaType, nextSlide.frameSequence);
          }
        } else {
          // Normal playback without transition
          renderSlideMedia(currentSlide.url, 1.0, currIdx, currentSlide.startSec, slideDur, undefined, currentSlide.mediaType, currentSlide.frameSequence);
        }
      } else {
        // Uniform Interval Mode
        const interval = Math.max(1, bg.multiImageInterval || 5);
        const urls = bg.multiImageUrls || [];
        const count = urls.length;
        if (count > 0) {
          const cycleIndex = Math.floor(totalTime / interval);
          const currIdx = cycleIndex % count;
          const nextIdx = (cycleIndex + 1) % count;
          const currentStartSec = cycleIndex * interval;
          const nextStartSec = (cycleIndex + 1) * interval;
          const timeInCurrent = totalTime - currentStartSec;

          const transitionTime = Math.min(1.8, Math.max(0.6, interval * 0.28));
          const canTransition = transType !== 'cut' && count > 1;
          const inTransition = canTransition && timeInCurrent > (interval - transitionTime);

          if (inTransition) {
            const transP = (timeInCurrent - (interval - transitionTime)) / transitionTime;
            const smoothTransP = Math.max(0, Math.min(1, transP));
            const easeT = 0.5 - 0.5 * Math.cos(smoothTransP * Math.PI);

            if (transType === 'fade_black') {
              if (smoothTransP < 0.5) {
                const alphaOut = 1 - smoothTransP * 2;
                renderSlideMedia(urls[currIdx], alphaOut, cycleIndex, currentStartSec, interval);
              } else {
                const alphaIn = (smoothTransP - 0.5) * 2;
                renderSlideMedia(urls[nextIdx], alphaIn, cycleIndex + 1, nextStartSec, interval);
              }
            } else if (transType === 'zoom') {
              const outScale = 1 + easeT * 0.12;
              const inScale = 1.14 - easeT * 0.14;
              renderSlideMedia(urls[currIdx], 1 - easeT, cycleIndex, currentStartSec, interval, { scaleMul: outScale });
              renderSlideMedia(urls[nextIdx], easeT, cycleIndex + 1, nextStartSec, interval, { scaleMul: inScale });
            } else if (transType === 'slide') {
              const outX = -easeT * width;
              const inX = (1 - easeT) * width;
              renderSlideMedia(urls[currIdx], 1, cycleIndex, currentStartSec, interval, { offsetX: outX });
              renderSlideMedia(urls[nextIdx], 1, cycleIndex + 1, nextStartSec, interval, { offsetX: inX });
            } else {
              // Default: Buttery Smooth Crossfade
              renderSlideMedia(urls[currIdx], 1, cycleIndex, currentStartSec, interval);
              renderSlideMedia(urls[nextIdx], easeT, cycleIndex + 1, nextStartSec, interval);
            }
          } else {
            renderSlideMedia(urls[currIdx], 1.0, cycleIndex, currentStartSec, interval);
          }
        }
      }
    } else if (bg.type === 'preset_grid') {
      // Cyberpunk 3D perspective grid
      ctx.fillStyle = bg.solidColor || '#080812';
      ctx.fillRect(0, 0, width, height);

      this.gridOffset = (this.gridOffset + (isPlaying ? 1.5 + bass * 4 : 0.8)) % 40;

      ctx.save();
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + (isPlaying ? bass * 0.25 : 0)})`;
      ctx.lineWidth = 1.5;

      // Horizon line
      const horizonY = height * 0.55;
      const numLines = 20;

      // Vertical perspective lines
      for (let i = -numLines; i <= numLines; i++) {
        const xBottom = centerX + i * 70;
        ctx.beginPath();
        ctx.moveTo(centerX + (i * 8), horizonY);
        ctx.lineTo(xBottom, height);
        ctx.stroke();
      }

      // Horizontal moving depth lines
      for (let y = horizonY; y < height; y += 15) {
        const p = (y - horizonY) / (height - horizonY);
        const actualY = horizonY + Math.pow(p, 1.8) * (height - horizonY) + (this.gridOffset * p);
        if (actualY <= height) {
          ctx.beginPath();
          ctx.moveTo(0, actualY);
          ctx.lineTo(width, actualY);
          ctx.stroke();
        }
      }

      // Horizon glow
      const horizonGrad = ctx.createRadialGradient(centerX, horizonY, 10, centerX, horizonY, width * 0.6);
      horizonGrad.addColorStop(0, `rgba(255, 0, 128, ${0.35 + (isPlaying ? bass * 0.4 : 0)})`);
      horizonGrad.addColorStop(0.6, 'rgba(0, 240, 255, 0.1)');
      horizonGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, horizonY - 150, width, 300);

      ctx.restore();
    } else if (bg.type === 'preset_nebula') {
      ctx.fillStyle = '#04050E';
      ctx.fillRect(0, 0, width, height);

      const grad1 = ctx.createRadialGradient(width * 0.25, height * 0.3, 20, width * 0.25, height * 0.3, width * 0.7);
      grad1.addColorStop(0, `rgba(0, 240, 255, ${0.18 + (isPlaying ? bass * 0.2 : 0)})`);
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      const grad2 = ctx.createRadialGradient(width * 0.75, height * 0.7, 20, width * 0.75, height * 0.7, width * 0.7);
      grad2.addColorStop(0, `rgba(255, 0, 128, ${0.18 + (isPlaying ? bass * 0.2 : 0)})`);
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);
    } else if (bg.type === 'preset_synthwave') {
      // 80s Retro Synthwave
      ctx.fillStyle = '#0c0418';
      ctx.fillRect(0, 0, width, height);

      // Neon Sun
      const sunY = height * 0.42;
      const sunRadius = Math.min(width, height) * 0.18;
      const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
      sunGrad.addColorStop(0, '#FFE600');
      sunGrad.addColorStop(0.5, '#FF007F');
      sunGrad.addColorStop(1, '#7928CA');

      ctx.save();
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(centerX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sun stripes
      ctx.fillStyle = '#0c0418';
      for (let s = 0; s < 6; s++) {
        const stripeY = sunY + (s * (sunRadius / 6.5));
        const stripeHeight = 2 + (s * 1.8);
        ctx.fillRect(centerX - sunRadius - 10, stripeY, (sunRadius * 2) + 20, stripeHeight);
      }
      ctx.restore();
    } else if (bg.type === 'preset_cyber_tunnel') {
      ctx.fillStyle = '#03080A';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.2 + (isPlaying ? bass * 0.3 : 0)})`;
      ctx.lineWidth = 2;

      for (const ring of this.tunnelRings) {
        ring.radius += isPlaying ? ring.speed * (1 + bass * 3) : ring.speed;
        if (ring.radius > Math.max(width, height) * 0.8) {
          ring.radius = 20;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (bg.type === 'preset_aurora') {
      ctx.fillStyle = '#080307';
      ctx.fillRect(0, 0, width, height);

      const grad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, width * 0.7);
      grad.addColorStop(0, `rgba(255, 46, 85, ${0.25 + (isPlaying ? bass * 0.3 : 0)})`);
      grad.addColorStop(0.5, `rgba(255, 136, 0, ${0.15 + (isPlaying ? bass * 0.2 : 0)})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (bg.type === 'solid_color') {
      ctx.fillStyle = bg.solidColor || '#050508';
      ctx.fillRect(0, 0, width, height);
    } else {
      // preset_dark_studio or default
      ctx.fillStyle = bg.solidColor || '#07080E';
      ctx.fillRect(0, 0, width, height);

      const studioGlow = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, width * 0.65);
      studioGlow.addColorStop(0, `rgba(255, 255, 255, ${0.06 + (isPlaying ? bass * 0.08 : 0)})`);
      studioGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = studioGlow;
      ctx.fillRect(0, 0, width, height);
    }

    // Dimming Overlay
    if (bg.dimOpacity > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${bg.dimOpacity})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Vignette
    if (bg.vignette > 0) {
      const vGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.min(width, height) * 0.35,
        centerX,
        centerY,
        Math.max(width, height) * 0.75
      );
      vGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vGrad.addColorStop(1, `rgba(0,0,0,${bg.vignette * 0.95})`);
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // Cinematic Lighting (Ambient flares / light leaks)
    if (effects?.cinematicLighting?.enabled) {
      const light = effects.cinematicLighting;
      const t = currentTime * 0.5;
      ctx.globalCompositeOperation = 'screen';
      
      if (light.lightLeaks) {
        // Subtle moving edge lights
        const leakX1 = Math.sin(t * 0.3) * width;
        const leakY1 = Math.cos(t * 0.4) * height;
        const leakGrad1 = ctx.createRadialGradient(leakX1, leakY1, 10, leakX1, leakY1, width * 0.8);
        leakGrad1.addColorStop(0, `rgba(255, 100, 50, ${0.15 * light.intensity})`);
        leakGrad1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = leakGrad1;
        ctx.fillRect(0, 0, width, height);

        const leakX2 = Math.cos(t * 0.2) * width;
        const leakY2 = Math.sin(t * 0.5) * height;
        const leakGrad2 = ctx.createRadialGradient(leakX2, leakY2, 10, leakX2, leakY2, width * 0.8);
        leakGrad2.addColorStop(0, `rgba(50, 150, 255, ${0.1 * light.intensity})`);
        leakGrad2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = leakGrad2;
        ctx.fillRect(0, 0, width, height);
      }
      
      if (light.ambientFlares) {
        const flareScale = 1 + (isPlaying ? bass * 0.5 : 0);
        const flareGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, height * 0.6 * flareScale);
        flareGrad.addColorStop(0, `rgba(255, 255, 255, ${0.05 * light.intensity})`);
        flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flareGrad;
        ctx.fillRect(0, 0, width, height);
      }
      
      ctx.globalCompositeOperation = 'source-over';
    }

    // 0. Video Background Looper if enabled (Drawn on top of standard solid fill, blended via opacity)
    if (effects?.videoBackground?.enabled) {
      this.drawVideoBackground(ctx, width, height, effects.videoBackground, bass, isPlaying);
    }
  }

  // ==========================================
  // B-ROLL CINEMATIC CUTAWAY & OVERLAY ENGINE
  // ==========================================
  public drawBRollLayer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bRoll: BRollConfig,
    currentTime: number,
    isPlaying: boolean
  ): void {
    if (!bRoll || bRoll.enabled === false || !bRoll.clips || bRoll.clips.length === 0) {
      return;
    }

    const activeClips = bRoll.clips.filter(
      (c) => currentTime >= c.startSec && currentTime < c.endSec
    );
    if (activeClips.length === 0) return;

    for (const clip of activeClips) {
      const clipDur = Math.max(0.2, clip.endSec - clip.startSec);
      const timeInClip = Math.max(0, currentTime - clip.startSec);

      // Smooth Ease-In & Ease-Out Transitions (0.35s - 0.5s)
      const transTime = Math.min(0.5, clipDur * 0.25);
      let transAlpha = 1;
      if (clip.transition !== 'cut') {
        if (timeInClip < transTime) {
          transAlpha = Math.max(0, timeInClip / transTime);
        } else if (timeInClip > clipDur - transTime) {
          transAlpha = Math.max(0, (clipDur - timeInClip) / transTime);
        }
      }
      // Silky S-Curve
      const smoothAlpha = transAlpha * transAlpha * (3 - 2 * transAlpha);
      const effectiveAlpha = Math.max(0, Math.min(1, smoothAlpha * (clip.opacity ?? 1) * (bRoll.globalOpacity ?? 1)));
      if (effectiveAlpha <= 0.001) continue;

      let sourceToDraw: CanvasImageSource | null = null;
      let naturalW = 1920;
      let naturalH = 1080;

      // 1. Pre-extracted Frame Sequence (Cloud Render / High Perf)
      if (clip.frameSequence && clip.frameSequence.urlPattern) {
        const totalFrames = Math.max(1, clip.frameSequence.frameCount || 1);
        const rawFrame = Math.floor(timeInClip * clip.frameSequence.fps);
        const frameNum = (rawFrame % totalFrames) + 1;
        const frameUrl = clip.frameSequence.urlPattern.replace('%06d', String(frameNum).padStart(6, '0'));
        const img = this.preloadImage(frameUrl);
        if (img && img.complete && img.naturalWidth > 0) {
          naturalW = img.naturalWidth;
          naturalH = img.naturalHeight;
          sourceToDraw = img;
        }
      }

      // 2. Video Element (Live Studio playback)
      if (!sourceToDraw && isVideoMedia(clip.url, clip.mediaType)) {
        const vid = this.preloadVideo(clip.url);
        if (vid) {
          vid.muted = true;
          vid.volume = 0;
          if (vid.duration && Number.isFinite(vid.duration) && vid.duration > 0) {
            const targetTime = timeInClip % vid.duration;
            if (Math.abs(vid.currentTime - targetTime) > 0.35) {
              vid.currentTime = targetTime;
            }
          }
          if (isPlaying) {
            if (vid.paused) vid.play().catch(() => {});
          } else {
            if (!vid.paused) vid.pause();
          }
          if (vid.readyState >= 1 || (vid.videoWidth || 0) > 0) {
            naturalW = vid.videoWidth || 1920;
            naturalH = vid.videoHeight || 1080;
            sourceToDraw = vid;
          }
        }
      } else if (!sourceToDraw) {
        // 3. Image Element
        const img = this.preloadImage(clip.url);
        if (img && img.complete && img.naturalWidth > 0) {
          naturalW = img.naturalWidth;
          naturalH = img.naturalHeight;
          sourceToDraw = img;
        }
      }

      if (!sourceToDraw) continue;

      const mode = clip.displayMode || bRoll.defaultDisplayMode || 'cutaway';
      ctx.save();
      ctx.globalAlpha = effectiveAlpha;

      if (mode === 'cutaway') {
        // --- 1. CUTAWAY (Full Screen Cinematic Cover) ---
        if (clip.kenBurns !== false) {
          const rawP = timeInClip / clipDur;
          const p = Math.max(0, Math.min(1, rawP));
          const zoomScale = 1.05 + p * 0.12;
          const driftX = (p - 0.5) * (width * 0.03);
          const driftY = (0.5 - p) * (height * 0.02);
          ctx.translate(width / 2 + driftX, height / 2 + driftY);
          ctx.scale(zoomScale, zoomScale);
          ctx.translate(-width / 2, -height / 2);
        }

        // Aspect Ratio Cover
        const imgRatio = naturalW / naturalH;
        const canvasRatio = width / height;
        let dw = width, dh = height, dx = 0, dy = 0;
        if (imgRatio > canvasRatio) {
          dw = height * imgRatio;
          dx = (width - dw) / 2;
        } else {
          dh = width / imgRatio;
          dy = (height - dh) / 2;
        }
        ctx.drawImage(sourceToDraw, dx, dy, dw, dh);

      } else if (mode === 'pip') {
        // --- 2. PICTURE-IN-PICTURE (Floating Window) ---
        const scale = Math.max(0.15, Math.min(0.6, clip.pipScale || 0.32));
        const pipW = width * scale;
        const pipH = pipW * (9 / 16); // 16:9 aspect box
        const pad = Math.max(20, width * 0.025);
        let pipX = width - pipW - pad;
        let pipY = pad;

        const pos = clip.pipPosition || bRoll.defaultPipPosition || 'top_right';
        if (pos === 'top_left') {
          pipX = pad;
          pipY = pad;
        } else if (pos === 'bottom_right') {
          pipX = width - pipW - pad;
          pipY = height - pipH - pad - 60;
        } else if (pos === 'bottom_left') {
          pipX = pad;
          pipY = height - pipH - pad - 60;
        } else if (pos === 'center') {
          pipX = (width - pipW) / 2;
          pipY = (height - pipH) / 2;
        }

        // Draw Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#000';
        const radius = 14;
        this.drawRoundedRectPath(ctx, pipX, pipY, pipW, pipH, radius);
        ctx.fill();
        ctx.restore();

        // Clip rounded rect and draw media
        ctx.save();
        this.drawRoundedRectPath(ctx, pipX, pipY, pipW, pipH, radius);
        ctx.clip();

        // Aspect fill inside pip
        const imgRatio = naturalW / naturalH;
        const pipRatio = pipW / pipH;
        let dw = pipW, dh = pipH, dx = pipX, dy = pipY;
        if (imgRatio > pipRatio) {
          dw = pipH * imgRatio;
          dx = pipX + (pipW - dw) / 2;
        } else {
          dh = pipW / imgRatio;
          dy = pipY + (pipH - dh) / 2;
        }
        ctx.drawImage(sourceToDraw, dx, dy, dw, dh);
        ctx.restore();

        // Draw Modern Neon Border
        ctx.save();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.85)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
        ctx.shadowBlur = 10;
        this.drawRoundedRectPath(ctx, pipX, pipY, pipW, pipH, radius);
        ctx.stroke();

        // Mini B-ROLL Badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.drawRoundedRectPath(ctx, pipX + 8, pipY + 8, 48, 18, 5);
        ctx.fill();
        ctx.fillStyle = '#C4B5FD';
        ctx.font = 'bold 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B-ROLL', pipX + 32, pipY + 17);
        ctx.restore();

      } else if (mode === 'split_screen') {
        // --- 3. SPLIT SCREEN (Cinematic 50/50 Split) ---
        const splitX = width / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, splitX, height);
        ctx.clip();

        // Aspect fill inside right split
        const imgRatio = naturalW / naturalH;
        const halfRatio = splitX / height;
        let dw = splitX, dh = height, dx = splitX, dy = 0;
        if (imgRatio > halfRatio) {
          dw = height * imgRatio;
          dx = splitX + (splitX - dw) / 2;
        } else {
          dh = splitX / imgRatio;
          dy = (height - dh) / 2;
        }
        ctx.drawImage(sourceToDraw, dx, dy, dw, dh);
        ctx.restore();

        // Glowing divider line
        ctx.save();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.9)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, height);
        ctx.stroke();
        ctx.restore();

      } else if (mode === 'blend_overlay') {
        // --- 4. BLEND OVERLAY (Atmospheric Texture, Light Leaks, Film Grain) ---
        ctx.globalCompositeOperation = (clip.blendMode as GlobalCompositeOperation) || 'screen';

        const imgRatio = naturalW / naturalH;
        const canvasRatio = width / height;
        let dw = width, dh = height, dx = 0, dy = 0;
        if (imgRatio > canvasRatio) {
          dw = height * imgRatio;
          dx = (width - dw) / 2;
        } else {
          dh = width / imgRatio;
          dy = (height - dh) / 2;
        }
        ctx.drawImage(sourceToDraw, dx, dy, dw, dh);
      }

      ctx.restore();
    }
  }

  private drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ==========================================
  // PARTICLE SYSTEM
  // ==========================================
  private updateAndDrawParticles(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: ParticlesConfig,
    bass: number,
    isBeat: boolean
  ): void {
    const targetCount = config.count;

    // Spawn regular particles
    while (this.particles.length < targetCount) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed - (config.type === 'embers' ? 0.8 : 0),
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.7 + 0.2,
        maxAlpha: Math.random() * 0.7 + 0.3,
        color: config.color,
        life: 0,
        maxLife: Math.random() * 200 + 100,
      });
    }

    // Spawn explosive beat burst sparks
    if (isBeat && config.reactToBass && config.burstIntensity > 0) {
      const burstCount = Math.floor(15 * config.burstIntensity);
      const centerX = width / 2;
      const centerY = height / 2;
      for (let b = 0; b < burstCount; b++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 3) * config.burstIntensity;
        this.particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4 + 1.5,
          alpha: 1,
          maxAlpha: 1,
          color: config.color,
          life: 0,
          maxLife: Math.random() * 40 + 20,
        });
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx * (1 + bass * (config.reactToBass ? 1.5 : 0));
      p.y += p.vy * (1 + bass * (config.reactToBass ? 1.5 : 0));

      const lifeRatio = p.life / p.maxLife;
      const currentAlpha = p.maxAlpha * (1 - lifeRatio);

      if (p.life >= p.maxLife || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, currentAlpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (config.reactToBass ? bass * 0.5 : 0)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ==========================================
  // CENTER LOGO / ARTWORK RENDERER
  // ==========================================
  private drawCenterLogo(
    ctx: CanvasRenderingContext2D,
    logo: CenterLogoConfig,
    scale: number,
    bass: number,
    isPlaying: boolean
  ): void {
    if (!logo.enabled) return;

    if (isPlaying && logo.rotationSpeed !== 0) {
      this.rotationAngle += logo.rotationSpeed * 0.015;
    }

    const baseSize = logo.size;
    const size = baseSize * scale;
    const halfSize = size / 2;

    ctx.save();
    ctx.rotate(this.rotationAngle);

    // Path shape generator
    const applyShapePath = () => {
      ctx.beginPath();
      if (logo.shape === 'circle') {
        ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
      } else if (logo.shape === 'rounded_rect') {
        const r = halfSize * 0.25;
        ctx.roundRect(-halfSize, -halfSize, size, size, r);
      } else if (logo.shape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = halfSize * Math.cos(angle);
          const hy = halfSize * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
      } else if (logo.shape === 'star') {
        const spikes = 5;
        const outerR = halfSize;
        const innerR = halfSize * 0.5;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.moveTo(0, -outerR);
        for (let i = 0; i < spikes; i++) {
          let x = Math.cos(rot) * outerR;
          let y = Math.sin(rot) * outerR;
          ctx.lineTo(x, y);
          rot += step;
          x = Math.cos(rot) * innerR;
          y = Math.sin(rot) * innerR;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.closePath();
      } else {
        // Shield
        ctx.moveTo(0, -halfSize);
        ctx.lineTo(halfSize, -halfSize * 0.4);
        ctx.lineTo(halfSize * 0.8, halfSize * 0.5);
        ctx.lineTo(0, halfSize);
        ctx.lineTo(-halfSize * 0.8, halfSize * 0.5);
        ctx.lineTo(-halfSize, -halfSize * 0.4);
        ctx.closePath();
      }
    };

    // 1. Draw reactive border glow
    if (logo.borderGlow > 0) {
      ctx.save();
      ctx.shadowColor = logo.borderColor || '#00F0FF';
      ctx.shadowBlur = logo.borderGlow + (isPlaying ? bass * 25 : 5);
      ctx.strokeStyle = logo.borderColor || '#00F0FF';
      ctx.lineWidth = logo.borderWidth || 3;
      applyShapePath();
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Image or Placeholder Mask
    ctx.save();
    applyShapePath();
    ctx.clip();

    const img = logo.imageUrl ? this.preloadImage(logo.imageUrl) : null;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -halfSize, -halfSize, size, size);
    } else {
      // Gradient placeholder
      const grad = ctx.createLinearGradient(-halfSize, -halfSize, halfSize, halfSize);
      grad.addColorStop(0, '#3B82F6');
      grad.addColorStop(1, '#EC4899');
      ctx.fillStyle = grad;
      ctx.fillRect(-halfSize, -halfSize, size, size);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♫', 0, 0);
    }
    ctx.restore();

    // 3. Draw Sharp Border Ring
    if (logo.borderWidth > 0) {
      ctx.save();
      ctx.strokeStyle = logo.borderColor || '#FFFFFF';
      ctx.lineWidth = logo.borderWidth;
      applyShapePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================
  // VISUALIZER SPECTRUM RENDERERS
  // ==========================================
  private drawVisualizer(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    if (vis.enabled === false) return;

    ctx.save();
    if (vis.pulseWithBass && isPlaying) {
      const pulse = 1 + Math.pow(audioData.bassEnergy, 1.25) * 0.13;
      ctx.scale(pulse, pulse);
    }

    const { style } = vis;

    if (style === 'radial_bars') {
      this.drawRadialBars(ctx, vis, audioData, isPlaying);
    } else if (style === 'radial_wave') {
      this.drawRadialWave(ctx, vis, audioData, isPlaying);
    } else if (style === 'linear_bars') {
      this.drawLinearBars(ctx, vis, audioData, isPlaying);
    } else if (style === 'oscilloscope') {
      this.drawOscilloscope(ctx, vis, audioData, isPlaying);
    } else if (style === 'hexagon_pulse') {
      this.drawHexagonPulse(ctx, vis, audioData, isPlaying);
    } else if (style === 'particle_tunnel') {
      this.drawParticleTunnelVisualizer(ctx, vis, audioData, isPlaying);
    } else if (style === 'monstercat_bars') {
      this.drawMonstercatBars(ctx, vis, audioData, isPlaying);
    } else if (style === 'minimal_halo') {
      this.drawMinimalHalo(ctx, vis, audioData, isPlaying);
    } else if (style === 'double_orbit') {
      this.drawDoubleOrbit(ctx, vis, audioData, isPlaying);
    } else if (style === 'floating_dots') {
      this.drawFloatingDots(ctx, vis, audioData, isPlaying);
    } else if (style === 'liquid_ribbon') {
      this.drawLiquidRibbon(ctx, vis, audioData, isPlaying);
    } else if (style === 'cyber_matrix') {
      this.drawCyberMatrix(ctx, vis, audioData, isPlaying);
    } else if (style === 'trap_nation_pulse') {
      this.drawTrapNationPulse(ctx, vis, audioData, isPlaying);
    } else if (style === 'cyber_tunnel_3d') {
      this.drawCyberTunnel3D(ctx, vis, audioData, isPlaying);
    } else if (style === 'neon_infinity_ribbon') {
      this.drawNeonInfinityRibbon(ctx, vis, audioData, isPlaying);
    } else if (style === 'audio_aura_sphere') {
      this.drawAudioAuraSphere(ctx, vis, audioData, isPlaying);
    }

    ctx.restore();
  }

  /**
   * Process and normalize frequency bin for dynamic, musical spectrum animations.
   * Eliminates static noise floor, expands dynamic contrast (valleys drop, peaks explode),
   * and applies high-frequency tilt compensation so all instruments dance harmoniously.
   */
  private getProcessedFrequency(
    freq: Uint8Array,
    normalizedIndex: number,
    isPlaying: boolean,
    bassBoost: number = 1.0,
    idlePhase: number = 0
  ): number {
    if (!isPlaying) {
      return 0.04 + Math.sin(idlePhase) * 0.03;
    }

    const freqLen = freq.length || 1;
    // Map with logarithmic frequency curve focusing on musical range (20Hz - 15kHz)
    const binIndex = Math.min(
      freqLen - 1,
      Math.floor(Math.pow(normalizedIndex, 1.35) * (freqLen * 0.72))
    );

    const rawByte = freq[binIndex] || 0;
    // 1. Subtract ambient noise floor (~28/255) so quiet moments and valleys drop to bottom
    const cleanVal = Math.max(0, (rawByte - 28) / 227);

    // 2. Dynamic power expansion: creates dramatic contrast between musical beats and valleys
    const expanded = Math.pow(cleanVal, 1.45);

    // 3. Fletcher-Munson / pink noise frequency tilt:
    // Audio energy naturally drops at high frequencies. Boost high bins proportionally so treble dances!
    const trebleTilt = 1.0 + Math.pow(normalizedIndex, 0.6) * 1.4;

    // 4. Bass boost on lowest 16% frequency bins (kick, 808, sub-bass)
    const isBassBin = binIndex < freqLen * 0.16;
    const boost = isBassBin ? bassBoost : 1.0;

    return Math.min(1.0, expanded * trebleTilt * boost);
  }

  // 1. RADIAL BARS (Specterr / NCS Classic)
  private drawRadialBars(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, barWidth, roundCaps, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;

    ctx.save();

    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? audioData.bassEnergy * 20 : 0);
    }

    const angleStep = (Math.PI * 2) / barCount;
    const sign = vis.invertDirection ? -1 : 1;

    for (let i = 0; i < barCount; i++) {
      const normalizedIndex = vis.mirror
        ? (i < barCount / 2 ? i / (barCount / 2) : (barCount - i) / (barCount / 2))
        : i / barCount;

      const rawVal = this.getProcessedFrequency(freq, normalizedIndex, isPlaying, bassBoost, i * 0.2);
      const height = Math.max(3, rawVal * maxBarHeight);

      const angle = i * angleStep - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x1 = cos * innerRadius;
      const y1 = sin * innerRadius;
      const x2 = cos * (innerRadius + height * sign);
      const y2 = sin * (innerRadius + height * sign);

      ctx.strokeStyle = this.getColorForBar(ctx, vis, i, barCount, x1, y1, x2, y2);
      ctx.lineWidth = barWidth;
      ctx.lineCap = roundCaps ? 'round' : 'butt';

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Peak Dots Effect: pops off dynamically on loud beats
      if (vis.peakDots && rawVal > 0.12) {
        const peakDist = innerRadius + (height + 8 + (isPlaying ? audioData.bassEnergy * 10 : 0)) * sign;
        ctx.fillStyle = vis.accentColor || '#FFE600';
        ctx.beginPath();
        ctx.arc(cos * peakDist, sin * peakDist, Math.max(1.6, barWidth * 0.65), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 2. RADIAL WAVE (Smooth fluid ring)
  private drawRadialWave(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;

    ctx.save();

    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? audioData.bassEnergy * 20 : 0);
    }

    const points: { x: number; y: number }[] = [];
    const angleStep = (Math.PI * 2) / barCount;
    const sign = vis.invertDirection ? -1 : 1;

    for (let i = 0; i <= barCount; i++) {
      const idx = i % barCount;
      const normalizedIndex = vis.mirror
        ? (idx < barCount / 2 ? idx / (barCount / 2) : (barCount - idx) / (barCount / 2))
        : idx / barCount;

      const rawVal = this.getProcessedFrequency(freq, normalizedIndex, isPlaying, bassBoost, idx * 0.25);
      const r = innerRadius + (rawVal * maxBarHeight * sign);

      const angle = i * angleStep - Math.PI / 2;
      points.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      });
    }

    ctx.strokeStyle = vis.primaryColor;
    ctx.lineWidth = barWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.closePath();
    ctx.stroke();

    // Subtle inner fill
    ctx.fillStyle = `${vis.secondaryColor}22`;
    ctx.fill();

    ctx.restore();
  }

  // 3. LINEAR BARS (Symmetrical DJ Spectrum)
  private drawLinearBars(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, maxBarHeight, barWidth, roundCaps, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? audioData.bassEnergy * 20 : 0);
    }

    const totalWidth = barCount * (barWidth + 4);
    const startX = -totalWidth / 2;
    const centerYPos = 140; // placed below center

    for (let i = 0; i < barCount; i++) {
      const normalizedIndex = vis.mirror
        ? (i < barCount / 2 ? (barCount / 2 - i) / (barCount / 2) : (i - barCount / 2) / (barCount / 2))
        : i / barCount;

      const rawVal = this.getProcessedFrequency(freq, normalizedIndex, isPlaying, bassBoost, i * 0.4);
      const height = Math.max(4, rawVal * maxBarHeight);

      const x = startX + i * (barWidth + 4);

      ctx.fillStyle = this.getColorForBar(ctx, vis, i, barCount, x, centerYPos - height, x, centerYPos);
      ctx.beginPath();
      if (roundCaps) {
        ctx.roundRect(x, centerYPos - height, barWidth, height, [barWidth / 2, barWidth / 2, 0, 0]);
      } else {
        ctx.rect(x, centerYPos - height, barWidth, height);
      }
      ctx.fill();
    }

    ctx.restore();
  }

  // 4. OSCILLOSCOPE (Laser Sine Ribbon)
  private drawOscilloscope(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { innerRadius, maxBarHeight, barWidth, glow } = vis;
    const time = audioData.timeData;
    const len = time.length || 1;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + 10;
    }

    const pointsCount = 180;
    const angleStep = (Math.PI * 2) / pointsCount;

    ctx.strokeStyle = vis.primaryColor;
    ctx.lineWidth = barWidth;
    ctx.beginPath();

    for (let i = 0; i <= pointsCount; i++) {
      const sampleIdx = Math.floor((i / pointsCount) * (len - 1));
      const rawWave = isPlaying ? ((time[sampleIdx] - 128) / 128) : Math.sin(i * 0.1) * 0.2;
      const r = innerRadius + (rawWave * maxBarHeight * 0.8);

      const angle = i * angleStep;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Second cyan harmonic ribbon
    ctx.strokeStyle = vis.secondaryColor;
    ctx.lineWidth = Math.max(1, barWidth * 0.5);
    ctx.beginPath();
    for (let i = 0; i <= pointsCount; i++) {
      const sampleIdx = Math.floor(((i + 20) % pointsCount / pointsCount) * (len - 1));
      const rawWave = isPlaying ? ((time[sampleIdx] - 128) / 128) : Math.cos(i * 0.1) * 0.15;
      const r = (innerRadius * 1.1) + (rawWave * maxBarHeight * 0.6);

      const angle = i * angleStep;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.restore();
  }

  // 5. HEXAGON PULSE (Cyberpunk Tech Shield)
  private drawHexagonPulse(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? audioData.bassEnergy * 25 : 0);
    }

    const sides = 6;
    const barsPerSide = Math.floor(barCount / sides);

    for (let s = 0; s < sides; s++) {
      const sideAngleStart = (s * Math.PI) / 3;
      const sideAngleEnd = ((s + 1) * Math.PI) / 3;

      const p1x = Math.cos(sideAngleStart) * innerRadius;
      const p1y = Math.sin(sideAngleStart) * innerRadius;
      const p2x = Math.cos(sideAngleEnd) * innerRadius;
      const p2y = Math.sin(sideAngleEnd) * innerRadius;

      // Normal outward direction
      const midAngle = sideAngleStart + Math.PI / 6;
      const normX = Math.cos(midAngle);
      const normY = Math.sin(midAngle);

      for (let b = 0; b < barsPerSide; b++) {
        const t = b / barsPerSide;
        const bx = p1x + (p2x - p1x) * t;
        const by = p1y + (p2y - p1y) * t;

        const rawVal = this.getProcessedFrequency(freq, t, isPlaying, bassBoost, b * 0.4);
        const height = Math.max(2, rawVal * maxBarHeight);

        const ex = bx + normX * height;
        const ey = by + normY * height;

        ctx.strokeStyle = this.getColorForBar(ctx, vis, b, barsPerSide, bx, by, ex, ey);
        ctx.lineWidth = barWidth;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 6. PARTICLE TUNNEL VISUALIZER (3D Warp Spectrum)
  private drawParticleTunnelVisualizer(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, maxBarHeight, glow } = vis;
    const freq = audioData.frequencyData;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow;
    }

    const angleStep = (Math.PI * 2) / barCount;
    for (let i = 0; i < barCount; i++) {
      const rawVal = this.getProcessedFrequency(freq, i / barCount, isPlaying, 1.0, i * 0.2);
      const dist = 90 + rawVal * maxBarHeight * 1.5;

      const angle = i * angleStep;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;

      ctx.fillStyle = this.getColorForBar(ctx, vis, i, barCount, x, y, x + 10, y + 10);
      ctx.beginPath();
      ctx.arc(x, y, 2 + rawVal * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 7. MONSTERCAT BARS (Vertical EQ with falling peak caps)
  private drawMonstercatBars(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, maxBarHeight, barWidth, roundCaps, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow;
    }

    // Init peak caps
    while (this.peakCaps.length < barCount) {
      this.peakCaps.push({ value: 0, velocity: 0 });
    }

    const spacing = 5;
    const totalW = barCount * (barWidth + spacing);
    const startX = -totalW / 2;
    const baseLineY = 160;

    for (let i = 0; i < barCount; i++) {
      const normalizedIndex = vis.mirror
        ? (i < barCount / 2 ? (barCount / 2 - i) / (barCount / 2) : (i - barCount / 2) / (barCount / 2))
        : i / barCount;

      const rawVal = this.getProcessedFrequency(freq, normalizedIndex, isPlaying, bassBoost, i * 0.3);
      const height = Math.max(3, rawVal * maxBarHeight);

      const x = startX + i * (barWidth + spacing);

      // Peak cap physics (gravity falloff)
      const cap = this.peakCaps[i];
      if (height > cap.value) {
        cap.value = height;
        cap.velocity = 0;
      } else {
        cap.velocity += 0.35;
        cap.value = Math.max(0, cap.value - cap.velocity);
      }

      // Draw vertical bar
      ctx.fillStyle = this.getColorForBar(ctx, vis, i, barCount, x, baseLineY - height, x, baseLineY);
      ctx.beginPath();
      if (roundCaps) {
        ctx.roundRect(x, baseLineY - height, barWidth, height, [barWidth / 2, barWidth / 2, 0, 0]);
      } else {
        ctx.rect(x, baseLineY - height, barWidth, height);
      }
      ctx.fill();

      // Draw floating peak dot
      ctx.fillStyle = vis.accentColor || '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(x, baseLineY - cap.value - 6, barWidth, 3, 1.5);
      ctx.fill();
    }

    ctx.restore();
  }

  // 8. MINIMAL HALO (Clean luxury audio ring)
  private drawMinimalHalo(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { innerRadius, glow } = vis;
    const bass = audioData.bassEnergy;

    ctx.save();
    ctx.shadowColor = vis.primaryColor;
    ctx.shadowBlur = glow + (isPlaying ? bass * 35 : 10);

    const pulseRadius = innerRadius + (isPlaying ? bass * 25 : 0);

    // Primary thin ring
    ctx.strokeStyle = vis.primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Outer soft aura
    ctx.strokeStyle = vis.secondaryColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius + 14 + (isPlaying ? bass * 15 : 0), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // 9. DOUBLE ORBIT (Planetary dual counter-rotating orbital nodes & laser links)
  private drawDoubleOrbit(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;
    const bass = audioData.bassEnergy;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 25 : 5);
    }

    const orbit1Radius = innerRadius;
    const orbit2Radius = innerRadius + maxBarHeight * 0.7;
    const count = Math.min(barCount, 64);
    const angleStep = (Math.PI * 2) / count;

    // Time-based slow rotation in opposite directions
    const rotSpeed = isPlaying ? 0.008 + bass * 0.015 : 0.003;
    this.orbitAngle1 += rotSpeed;
    this.orbitAngle2 -= rotSpeed * 0.7;

    // Inner & Outer guide track rings
    ctx.strokeStyle = `${vis.primaryColor}22`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, orbit1Radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `${vis.secondaryColor}22`;
    ctx.beginPath();
    ctx.arc(0, 0, orbit2Radius, 0, Math.PI * 2);
    ctx.stroke();

    const nodes1: { x: number; y: number; val: number }[] = [];
    const nodes2: { x: number; y: number; val: number }[] = [];

    // Inner orbit nodes
    for (let i = 0; i < count; i++) {
      const val = this.getProcessedFrequency(freq, i / count, isPlaying, bassBoost, i * 0.2);

      const angle = i * angleStep + this.orbitAngle1;
      const r = orbit1Radius + (vis.invertDirection ? -val * 24 : val * 32);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      nodes1.push({ x, y, val });

      const nodeSize = 2 + val * 6;
      ctx.fillStyle = this.getColorForBar(ctx, vis, i, count, x, y, x + 5, y + 5);
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer orbit nodes
    for (let i = 0; i < count; i++) {
      const val = this.getProcessedFrequency(freq, ((i / count) + 0.35) % 1.0, isPlaying, bassBoost, i * 0.3);

      const angle = i * angleStep + this.orbitAngle2;
      const r = orbit2Radius + (vis.invertDirection ? val * 26 : -val * 22);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      nodes2.push({ x, y, val });

      const nodeSize = 1.5 + val * 5;
      ctx.fillStyle = vis.secondaryColor || '#00F0FF';
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connect nodes with dynamic laser threads when energy is high
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i += 2) {
      const n1 = nodes1[i];
      const n2 = nodes2[(i + 4) % count];
      if (n1.val > 0.28 || n2.val > 0.28) {
        ctx.strokeStyle = `${vis.accentColor || '#FFE600'}${Math.floor(Math.min(0.85, n1.val * 0.95) * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 10. FLOATING DOTS (Stardust constellation bursting with frequency peaks)
  private drawFloatingDots(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;
    const bass = audioData.bassEnergy;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 20 : 0);
    }

    const count = Math.min(barCount, 80);
    const angleStep = (Math.PI * 2) / count;
    this.dotsTime += isPlaying ? 0.02 + bass * 0.03 : 0.01;

    for (let i = 0; i < count; i++) {
      const normIdx = vis.mirror
        ? (i < count / 2 ? i / (count / 2) : (count - i) / (count / 2))
        : i / count;
      const energy = this.getProcessedFrequency(freq, normIdx, isPlaying, bassBoost, i * 0.5);

      const angle = i * angleStep + Math.sin(this.dotsTime + i * 0.3) * 0.08;
      const dist = innerRadius + (vis.invertDirection ? -energy * maxBarHeight * 0.5 : energy * maxBarHeight * 1.2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = cos * dist;
      const y = sin * dist;

      // Draw light ray connecting center ring to dot
      ctx.strokeStyle = `${vis.primaryColor}${Math.floor(Math.min(0.6, energy * 0.7) * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cos * innerRadius, sin * innerRadius);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Draw glowing dot
      const dotRadius = Math.max(2, 2.5 + energy * 7);
      ctx.fillStyle = this.getColorForBar(ctx, vis, i, count, x, y, x + 10, y + 10);
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core white sparkle on intense beats
      if (energy > 0.6) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, dotRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Optional peak indicator
      if (vis.peakDots && energy > 0.25) {
        const peakDist = dist + 16 + energy * 18;
        ctx.fillStyle = vis.accentColor || '#FFE600';
        ctx.beginPath();
        ctx.arc(cos * peakDist, sin * peakDist, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 11. LIQUID RIBBON (Smooth organic chromatic silky wave)
  private drawLiquidRibbon(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;
    const bass = audioData.bassEnergy;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 25 : 10);
    }

    const segments = 120;
    const angleStep = (Math.PI * 2) / segments;
    this.ribbonPhase += isPlaying ? 0.03 + bass * 0.04 : 0.015;

    // Draw 3 harmonic fluid ribbon waves layered
    const layers = [
      { color: vis.primaryColor, offset: 0, mult: 1.0, alpha: 0.85, width: barWidth + 1 },
      { color: vis.secondaryColor, offset: Math.PI * 0.65, mult: 0.75, alpha: 0.6, width: Math.max(1, barWidth - 1) },
      { color: vis.accentColor || '#00F0FF', offset: Math.PI * 1.3, mult: 0.5, alpha: 0.4, width: 1.5 },
    ];

    for (const layer of layers) {
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.width;
      ctx.globalAlpha = layer.alpha;
      ctx.beginPath();

      for (let i = 0; i <= segments; i++) {
        const norm = (i % segments) / segments;
        const raw = this.getProcessedFrequency(freq, norm, isPlaying, bassBoost, norm * 10);
        const wave = Math.sin(norm * Math.PI * 8 + this.ribbonPhase + layer.offset) * 12;
        const r = innerRadius + (raw * maxBarHeight * layer.mult * (vis.invertDirection ? -1 : 1)) + wave;

        const angle = i * angleStep;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  // 12. CYBER MATRIX (Segmented LED equalizer blocks with peak hold)
  private drawCyberMatrix(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow;
    }

    const count = Math.min(barCount, 60);
    const angleStep = (Math.PI * 2) / count;
    const totalBlocks = 12; // 12 discrete LED blocks per radial column
    const blockGap = 2.5;
    const totalRadialSpan = maxBarHeight * 0.9;
    const blockHeight = (totalRadialSpan - (totalBlocks - 1) * blockGap) / totalBlocks;

    for (let i = 0; i < count; i++) {
      const normIdx = vis.mirror
        ? (i < count / 2 ? i / (count / 2) : (count - i) / (count / 2))
        : i / count;
      const rawVal = this.getProcessedFrequency(freq, normIdx, isPlaying, bassBoost, i * 0.2);
      const activeBlocksCount = Math.min(
        totalBlocks,
        Math.round(rawVal * totalBlocks)
      );

      const angle = i * angleStep - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      for (let b = 0; b < totalBlocks; b++) {
        const blockR = innerRadius + b * (blockHeight + blockGap) * (vis.invertDirection ? -1 : 1);
        const bx = cos * blockR;
        const by = sin * blockR;
        const isActive = b < activeBlocksCount;
        const isPeak = b === activeBlocksCount - 1 && activeBlocksCount > 0;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angle + Math.PI / 2);

        if (isActive) {
          if (isPeak) {
            ctx.fillStyle = vis.accentColor || '#FFE600';
          } else {
            ctx.fillStyle = b > totalBlocks * 0.75 ? (vis.secondaryColor || '#FF007F') : vis.primaryColor;
          }
        } else {
          // Dim inactive matrix grid cell
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        }

        ctx.fillRect(-barWidth / 2, 0, barWidth, blockHeight);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // 13. TRAP NATION PULSE (Bass Shockwaves & High-Energy Radial Blast)
  private drawTrapNationPulse(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { barCount, innerRadius, maxBarHeight, barWidth, roundCaps, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;
    const bass = audioData.bassEnergy;

    ctx.save();

    // Spawn Bass Shockwave Rings on Beat or Heavy Bass Punch
    const now = performance.now();
    if (isPlaying && (audioData.isBeat || bass > 0.48) && now - this.lastShockwaveSpawn > 110) {
      this.lastShockwaveSpawn = now;
      this.shockwaves.push({
        radius: innerRadius,
        maxRadius: innerRadius + maxBarHeight * 1.6 + 60,
        alpha: 0.9,
        width: Math.max(2, barWidth * 0.9),
        color: vis.primaryColor,
      });

      if (bass > 0.68) {
        this.shockwaves.push({
          radius: innerRadius - 8,
          maxRadius: innerRadius + maxBarHeight * 2.0 + 90,
          alpha: 0.7,
          width: Math.max(1.5, barWidth * 0.6),
          color: vis.secondaryColor || '#FF007F',
        });
      }
    }

    // Render & Update Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 4.5 + bass * 6.5;
      sw.alpha -= 0.024;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.width * (0.4 + sw.alpha * 0.8);
      ctx.globalAlpha = Math.max(0, Math.min(1, sw.alpha));
      ctx.beginPath();
      ctx.arc(0, 0, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Inner Radiant Halo Ring
    const haloGlow = innerRadius + (isPlaying ? bass * 18 : 2);
    ctx.save();
    ctx.strokeStyle = vis.primaryColor;
    ctx.lineWidth = 2 + (isPlaying ? bass * 4 : 1);
    ctx.globalAlpha = 0.5 + (isPlaying ? bass * 0.4 : 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, haloGlow, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // High Glow for the Radial Blast
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 28 : 0);
    }

    const count = Math.max(48, Math.min(barCount, 128));
    const angleStep = (Math.PI * 2) / count;
    const sign = vis.invertDirection ? -1 : 1;

    for (let i = 0; i < count; i++) {
      const normalizedIndex = vis.mirror
        ? (i < count / 2 ? i / (count / 2) : (count - i) / (count / 2))
        : i / count;

      const rawVal = this.getProcessedFrequency(freq, normalizedIndex, isPlaying, bassBoost * 1.25, i * 0.3);
      const height = Math.max(3, rawVal * maxBarHeight);

      const angle = i * angleStep - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x1 = cos * innerRadius;
      const y1 = sin * innerRadius;
      const x2 = cos * (innerRadius + height * sign);
      const y2 = sin * (innerRadius + height * sign);

      ctx.strokeStyle = this.getColorForBar(ctx, vis, i, count, x1, y1, x2, y2);
      ctx.lineWidth = barWidth;
      ctx.lineCap = roundCaps ? 'round' : 'butt';

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Peak Dots with explosive displacement
      if (vis.peakDots && rawVal > 0.16) {
        const peakDist = innerRadius + (height + 10 + bass * 12) * sign;
        ctx.fillStyle = vis.accentColor || '#FFE600';
        ctx.beginPath();
        ctx.arc(cos * peakDist, sin * peakDist, Math.max(1.8, barWidth * 0.65), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 14. 3D CYBER TUNNEL (Perspective Polygon Depth Warp)
  private drawCyberTunnel3D(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const bass = audioData.bassEnergy;
    const mid = audioData.midEnergy;
    const treble = audioData.trebleEnergy;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 20 : 5);
    }

    const sides = 6; // Hexagonal Tron tunnel
    const totalSlices = 9;
    const sliceSpacing = 85;
    const fov = 340;

    this.tunnel3dZOffset = (this.tunnel3dZOffset + (isPlaying ? 3.8 + bass * 7 : 1.5)) % sliceSpacing;
    this.tunnel3dAngle += isPlaying ? 0.004 + treble * 0.008 : 0.0015;

    const ringVertices: { x: number; y: number }[][] = [];

    for (let s = 0; s < totalSlices; s++) {
      let rawZ = s * sliceSpacing - this.tunnel3dZOffset;
      if (rawZ < 10) rawZ += totalSlices * sliceSpacing;

      const persp = fov / (fov + rawZ);
      const normZ = s / totalSlices;

      // Distance audio distortion
      let audioReact = 0;
      if (normZ < 0.35) {
        audioReact = bass * 40 * bassBoost;
      } else if (normZ < 0.7) {
        audioReact = mid * 30;
      } else {
        audioReact = treble * 24;
      }

      const ringR = (innerRadius + maxBarHeight * 0.5) * persp * (vis.invertDirection ? 0.7 : 1.0) + audioReact * persp;
      const alpha = Math.max(0.1, Math.min(0.95, Math.pow(persp, 1.25)));
      const rot = this.tunnel3dAngle + s * 0.06;

      const verts: { x: number; y: number }[] = [];
      const angleStep = (Math.PI * 2) / sides;

      for (let k = 0; k < sides; k++) {
        const a = k * angleStep + rot;
        verts.push({
          x: Math.cos(a) * ringR,
          y: Math.sin(a) * ringR,
        });
      }
      ringVertices.push(verts);

      // Draw Polygon Ring
      ctx.strokeStyle = s % 2 === 0 ? vis.primaryColor : (vis.secondaryColor || '#00F0FF');
      ctx.lineWidth = Math.max(1, barWidth * persp * 1.2);
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      for (let k = 0; k < sides; k++) {
        const v = verts[k];
        if (k === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.stroke();

      // Glowing corner vertex nodes on nearest rings
      if (normZ < 0.4) {
        ctx.fillStyle = vis.accentColor || '#FFE600';
        for (let k = 0; k < sides; k++) {
          const v = verts[k];
          ctx.beginPath();
          ctx.arc(v.x, v.y, Math.max(1.8, 3.5 * persp), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Connect Longitudinal Perspective Beams
    ctx.lineWidth = Math.max(0.8, barWidth * 0.35);
    ctx.strokeStyle = vis.primaryColor;
    for (let k = 0; k < sides; k++) {
      ctx.beginPath();
      for (let s = 0; s < ringVertices.length; s++) {
        const v = ringVertices[s][k];
        if (s === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.globalAlpha = 0.35 + (isPlaying ? bass * 0.3 : 0.1);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 15. NEON INFINITY RIBBON (Dual DNA Helix with Harmonic Laser Rungs)
  private drawNeonInfinityRibbon(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;
    const bass = audioData.bassEnergy;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 24 : 8);
    }

    const segments = 128;
    const angleStep = (Math.PI * 2) / segments;
    this.helixPhase += isPlaying ? 0.026 + bass * 0.038 : 0.012;

    const strandAPts: { x: number; y: number; r: number; val: number }[] = [];
    const strandBPts: { x: number; y: number; r: number; val: number }[] = [];

    const waveAmp = (18 + bass * 38 * (bassBoost || 1.0)) * (vis.invertDirection ? -1 : 1);

    for (let i = 0; i <= segments; i++) {
      const norm = (i % segments) / segments;

      const rawA = this.getProcessedFrequency(freq, norm * 0.65, isPlaying, bassBoost, i * 0.3);
      const rawB = this.getProcessedFrequency(freq, ((norm + 0.5) % 1) * 0.85, isPlaying, bassBoost, i * 0.3);

      const angle = i * angleStep;
      const waveA = Math.sin(angle * 7 + this.helixPhase) * waveAmp;
      const waveB = Math.sin(angle * 7 + this.helixPhase + Math.PI) * waveAmp;

      const rA = innerRadius + waveA + rawA * maxBarHeight * 0.55;
      const rB = innerRadius + waveB + rawB * maxBarHeight * 0.55;

      strandAPts.push({
        x: Math.cos(angle) * rA,
        y: Math.sin(angle) * rA,
        r: rA,
        val: rawA,
      });

      strandBPts.push({
        x: Math.cos(angle) * rB,
        y: Math.sin(angle) * rB,
        r: rB,
        val: rawB,
      });
    }

    // Draw Strand A (Primary Helix)
    ctx.strokeStyle = vis.primaryColor;
    ctx.lineWidth = barWidth;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const p = strandAPts[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Draw Strand B (Secondary Counter-Helix)
    ctx.strokeStyle = vis.secondaryColor || '#FF007F';
    ctx.lineWidth = Math.max(1, barWidth - 0.5);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const p = strandBPts[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Harmonic Laser Rungs & Intersection Spark Nodes
    ctx.lineWidth = 1;
    for (let i = 0; i < segments; i += 4) {
      const pA = strandAPts[i];
      const pB = strandBPts[i];
      const diff = Math.abs(pA.r - pB.r);

      // Connect ladder rungs when audio is active
      if (pA.val > 0.22 || pB.val > 0.22) {
        ctx.strokeStyle = `${vis.accentColor || '#FFE600'}${Math.floor(Math.min(0.75, (pA.val + pB.val) * 0.5) * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }

      // Spark node at crossing points
      if (diff < 9 && isPlaying) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, 2.5 + bass * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 16. AUDIO AURA SPHERE (Supernova Plasma Corona with Solar Flare Ejections)
  private drawAudioAuraSphere(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    audioData: AudioFrequencyData,
    isPlaying: boolean
  ): void {
    const { innerRadius, maxBarHeight, barWidth, glow, bassBoost } = vis;
    const freq = audioData.frequencyData;
    const bass = audioData.bassEnergy;

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = vis.primaryColor;
      ctx.shadowBlur = glow + (isPlaying ? bass * 32 : 12);
    }

    const points = 180;
    const angleStep = (Math.PI * 2) / points;
    this.auraTime += isPlaying ? 0.022 + bass * 0.034 : 0.01;

    // Spawn solar embers drifting outward
    if (isPlaying && bass > 0.56 && Math.random() < 0.45) {
      const spawnAngle = Math.random() * Math.PI * 2;
      this.auraEmbers.push({
        angle: spawnAngle,
        dist: innerRadius + 15,
        speed: 2.2 + Math.random() * 4.2,
        size: 1.5 + Math.random() * 3,
        alpha: 0.9,
        color: Math.random() > 0.5 ? vis.primaryColor : (vis.accentColor || '#FFE600'),
      });
    }

    // Update & Render Drifting Solar Embers
    for (let i = this.auraEmbers.length - 1; i >= 0; i--) {
      const ember = this.auraEmbers[i];
      ember.dist += ember.speed + bass * 3.5;
      ember.alpha -= 0.018;

      if (ember.alpha <= 0 || ember.dist > innerRadius + maxBarHeight * 1.8) {
        this.auraEmbers.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = ember.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, ember.alpha));
      ctx.beginPath();
      ctx.arc(
        Math.cos(ember.angle) * ember.dist,
        Math.sin(ember.angle) * ember.dist,
        ember.size,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Multi-octave Turbulent Plasma Corona
    const coronaPoints: { x: number; y: number; flare: number; angle: number; r: number }[] = [];

    for (let i = 0; i <= points; i++) {
      const idx = i % points;
      const norm = idx / points;
      const rawVal = this.getProcessedFrequency(freq, norm, isPlaying, bassBoost, i * 0.35);

      const angle = i * angleStep;
      const turb =
        Math.sin(angle * 6 + this.auraTime * 2.8) * 0.42 +
        Math.sin(angle * 13 - this.auraTime * 3.6) * 0.35 +
        Math.cos(angle * 23 + this.auraTime * 4.2) * 0.23;

      const flareBoost = rawVal > 0.52 ? (rawVal - 0.52) * 1.5 : 0;
      const dynamicR =
        innerRadius +
        (rawVal * maxBarHeight * (0.65 + turb * 0.35) + flareBoost * maxBarHeight) *
          (vis.invertDirection ? -1 : 1);

      coronaPoints.push({
        x: Math.cos(angle) * dynamicR,
        y: Math.sin(angle) * dynamicR,
        flare: flareBoost,
        angle,
        r: dynamicR,
      });
    }

    // Layer 1: Semi-transparent hot core plasma polygon
    ctx.save();
    ctx.fillStyle = vis.primaryColor;
    ctx.globalAlpha = 0.12 + (isPlaying ? bass * 0.18 : 0.05);
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const p = coronaPoints[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Layer 2: Main glowing plasma perimeter ribbon
    ctx.strokeStyle = vis.primaryColor;
    ctx.lineWidth = barWidth;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const p = coronaPoints[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Layer 3: Solar Flare Needle Ejections on Peak Audio
    if (isPlaying) {
      for (let i = 0; i < points; i += 3) {
        const p = coronaPoints[i];
        if (p.flare > 0.08) {
          const needleLen = 14 + p.flare * 48 * bassBoost;
          const outerX = Math.cos(p.angle) * (p.r + needleLen);
          const outerY = Math.sin(p.angle) * (p.r + needleLen);

          ctx.strokeStyle = vis.accentColor || '#FFE600';
          ctx.lineWidth = Math.max(1.2, barWidth * 0.7);
          ctx.globalAlpha = Math.min(0.9, p.flare * 2);

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(outerX, outerY);
          ctx.stroke();

          // Spark dot on tip of flare needle
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(outerX, outerY, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // Color mode solver helper
  private getColorForBar(
    ctx: CanvasRenderingContext2D,
    vis: VisualizerConfig,
    index: number,
    total: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): string | CanvasGradient {
    if (vis.colorMode === 'solid') {
      return vis.primaryColor;
    }

    if (vis.colorMode === 'rainbow') {
      const hue = (index / total) * 360;
      return `hsl(${hue}, 100%, 60%)`;
    }

    if (vis.colorMode === 'neon_dual') {
      const ratio = index / total;
      return ratio < 0.5 ? vis.primaryColor : vis.secondaryColor;
    }

    // gradient_linear or gradient_radial
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, vis.primaryColor);
    grad.addColorStop(1, vis.secondaryColor);
    return grad;
  }

  // ==========================================
  // TYPOGRAPHY & SONG INFO HUD
  // ==========================================
  private drawTypography(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    typo: TypographyConfig,
    currentTime: number,
    duration: number,
    bass: number,
    isPlaying: boolean
  ): void {
    if (!typo.showTitle && !typo.showArtist && !typo.showSubtitle) return;

    ctx.save();

    const bounce = typo.reactToBeat && isPlaying ? bass * 6 : 0;

    let posX = width / 2;
    let posY = height * 0.82 + bounce;
    let align: CanvasTextAlign = 'center';

    if (typo.position === 'top_left') {
      posX = width * 0.08;
      posY = height * 0.12 + bounce;
      align = 'left';
    } else if (typo.position === 'top_center') {
      posX = width / 2;
      posY = height * 0.12 + bounce;
      align = 'center';
    } else if (typo.position === 'bottom_center') {
      posX = width / 2;
      posY = height * 0.88 + bounce;
      align = 'center';
    } else if (typo.position === 'bottom_left') {
      posX = width * 0.08;
      posY = height * 0.88 + bounce;
      align = 'left';
    } else if (typo.position === 'bottom_right') {
      posX = width * 0.92;
      posY = height * 0.88 + bounce;
      align = 'right';
    }

    ctx.textAlign = align;

    // Track Title
    if (typo.showTitle && typo.title) {
      ctx.save();
      ctx.font = `bold ${typo.titleSize}px "${typo.titleFont || 'Orbitron'}", sans-serif`;
      ctx.fillStyle = typo.titleColor || '#FFFFFF';
      ctx.shadowColor = typo.titleColor || '#00F0FF';
      ctx.shadowBlur = isPlaying ? 10 + bass * 15 : 6;
      ctx.fillText(typo.title.toUpperCase(), posX, posY);
      ctx.restore();
    }

    // Artist Name
    if (typo.showArtist && typo.artist) {
      ctx.save();
      ctx.font = `600 ${typo.artistSize}px "${typo.artistFont || 'Montserrat'}", sans-serif`;
      ctx.fillStyle = typo.artistColor || '#00F0FF';
      ctx.shadowColor = typo.artistColor || '#00F0FF';
      ctx.shadowBlur = 4;
      ctx.fillText(typo.artist.toUpperCase(), posX, posY + typo.titleSize * 0.85);
      ctx.restore();
    }

    // Subtitle / Genre
    if (typo.showSubtitle && typo.subtitle) {
      ctx.save();
      ctx.font = `400 ${Math.max(10, typo.artistSize * 0.8)}px "Inter", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(typo.subtitle, posX, posY + typo.titleSize * 0.85 + typo.artistSize * 1.3);
      ctx.restore();
    }

    // Live Time Progress Bar HUD
    if (typo.showTimeProgress && duration > 0) {
      const progress = Math.min(1, currentTime / duration);
      const barW = Math.min(320, width * 0.4);
      const barH = 4;
      const barX = align === 'center' ? posX - barW / 2 : (align === 'left' ? posX : posX - barW);
      const barY = posY + typo.titleSize * 0.85 + typo.artistSize * 1.3 + 22;

      // Track bg
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 2);
      ctx.fill();

      // Progress filled
      ctx.fillStyle = typo.progressColor || '#00F0FF';
      ctx.shadowColor = typo.progressColor || '#00F0FF';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * progress, barH, 2);
      ctx.fill();

      // Time Text
      const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };

      ctx.font = '500 11px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(currentTime), barX, barY + 16);
      ctx.textAlign = 'right';
      ctx.fillText(formatTime(duration), barX + barW, barY + 16);
    }

    // Dynamic Social Handles & Streaming Badges HUD
    if (typo.socialBadges && typo.socialBadges.enabled) {
      this.drawSocialBadges(ctx, width, height, typo.socialBadges, bass, isPlaying, posX, posY, align);
    }

    ctx.restore();
  }

  private drawSocialBadges(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    badge: SocialBadgeConfig,
    bass: number,
    isPlaying: boolean,
    titleX: number,
    titleY: number,
    titleAlign: CanvasTextAlign
  ): void {
    ctx.save();
    let badgeX = width * 0.06;
    let badgeY = height * 0.08;
    let align: CanvasTextAlign = 'left';

    if (badge.position === 'top_right') {
      badgeX = width - width * 0.06;
      badgeY = height * 0.08;
      align = 'right';
    } else if (badge.position === 'bottom_left') {
      badgeX = width * 0.06;
      badgeY = height - 55;
      align = 'left';
    } else if (badge.position === 'bottom_right') {
      badgeX = width - width * 0.06;
      badgeY = height - 55;
      align = 'right';
    } else if (badge.position === 'below_title') {
      badgeX = titleX;
      badgeY = titleY + 60;
      align = titleAlign;
    }

    const labels: string[] = [];
    if (badge.streamingPlatform === 'spotify') {
      labels.push(badge.customStreamingText || '🎵 Listen on Spotify');
    } else if (badge.streamingPlatform === 'apple_music') {
      labels.push(badge.customStreamingText || '🍎 Apple Music');
    } else if (badge.streamingPlatform === 'youtube') {
      labels.push(badge.customStreamingText || '▶ YouTube Music');
    } else if (badge.streamingPlatform === 'soundcloud') {
      labels.push(badge.customStreamingText || '☁ SoundCloud');
    }

    if (badge.handleInstagram) {
      labels.push(`📸 ${badge.handleInstagram.startsWith('@') ? '' : '@'}${badge.handleInstagram}`);
    }
    if (badge.handleTikTok) {
      labels.push(`🎬 ${badge.handleTikTok.startsWith('@') ? '' : '@'}${badge.handleTikTok}`);
    }
    if (badge.handleYouTube) {
      labels.push(`▶ ${badge.handleYouTube.startsWith('@') ? '' : '@'}${badge.handleYouTube}`);
    }

    if (labels.length === 0) {
      ctx.restore();
      return;
    }

    const fullText = labels.join('  •  ');
    ctx.font = 'bold 12px "Montserrat", sans-serif';
    const metrics = ctx.measureText(fullText);
    const boxW = metrics.width + 24;
    const boxH = 28;
    const drawBoxX = align === 'center' ? badgeX - boxW / 2 : (align === 'right' ? badgeX - boxW : badgeX);

    // Glass pill badge background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = badge.badgeColor || 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(drawBoxX, badgeY, boxW, boxH, boxH / 2);
    ctx.fill();
    ctx.stroke();

    // Text & Neon Glow
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = badge.badgeColor || '#00F0FF';
    ctx.shadowBlur = isPlaying ? 6 + bass * 8 : 4;
    ctx.fillText(fullText, drawBoxX + 12, badgeY + boxH / 2);

    ctx.restore();
  }

  // ==========================================
  // WHISPER AI SUBTITLES & KARAOKE LYRICS
  // ==========================================
  private static readonly RANSOM_PALETTES = [
    { bg: '#FFE500', text: '#000000', fontName: 'Anton', fallback: '"Impact", sans-serif', isItalic: false, tilt: -0.035, border: '#000000' },
    { bg: '#FFFFFF', text: '#0A0A0A', fontName: 'Playfair Display', fallback: '"Georgia", serif', isItalic: true, tilt: 0.03, border: 'rgba(0,0,0,0.6)' },
    { bg: '#E11D48', text: '#FFFFFF', fontName: 'Bebas Neue', fallback: '"Anton", sans-serif', isItalic: false, tilt: -0.025, border: '#000000' },
    { bg: '#18181B', text: '#FFFFFF', fontName: 'Courier Prime', fallback: '"Courier New", monospace', isItalic: false, tilt: 0.035, border: 'rgba(255,255,255,0.4)' },
    { bg: '#06B6D4', text: '#000000', fontName: 'Special Elite', fallback: '"Courier New", monospace', isItalic: false, tilt: -0.03, border: '#000000' },
    { bg: '#F43F5E', text: '#FFFFFF', fontName: 'Montserrat', fallback: 'sans-serif', isItalic: false, tilt: 0.025, border: '#000000' },
    { bg: '#22C55E', text: '#000000', fontName: 'Kanit', fallback: 'sans-serif', isItalic: true, tilt: -0.025, border: '#000000' },
  ];

  private static readonly KINETIC_FONT_VARIANTS = [
    { font: 'italic bold {size}px "Playfair Display", "Georgia", serif', isUpper: false, tilt: -0.035 },
    { font: '900 {size}px "Anton", "Impact", sans-serif', isUpper: true, tilt: 0.035 },
    { font: 'bold {size}px "Courier New", monospace', isUpper: true, tilt: -0.02 },
    { font: '800 {size}px "Montserrat", sans-serif', isUpper: true, tilt: 0.025 },
    { font: 'bold {size}px "Kanit", sans-serif', isUpper: false, tilt: 0.0 },
  ];

  private drawSubtitles(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sub: SubtitleConfig,
    currentTime: number,
    bass: number,
    isPlaying: boolean
  ): void {
    if (!sub.lyrics || sub.lyrics.length === 0) return;

    // --- Improved sync: small lead-in for perceptual alignment ---
    const LEAD_IN = 0.08;
    const t = currentTime + LEAD_IN;

    // Find active segment:
    // 1. Direct match: t is between seg.start and seg.end.
    // If multiple segments overlap, pick the latest-started one (highest start <= t)
    let activeIndex = -1;
    for (let i = 0; i < sub.lyrics.length; i++) {
      const seg = sub.lyrics[i];
      if (t >= seg.start && t <= seg.end) {
        if (activeIndex === -1 || seg.start > sub.lyrics[activeIndex].start) {
          activeIndex = i;
        }
      }
    }

    // 2. Continuous gap bridging during playback:
    // If between segments, keep showing recent segment for up to 0.45s or preview upcoming segment within 0.35s
    if (activeIndex === -1 && isPlaying) {
      for (let i = 0; i < sub.lyrics.length; i++) {
        const seg = sub.lyrics[i];
        if (t > seg.end && t - seg.end < 0.45) {
          if (activeIndex === -1 || seg.end > sub.lyrics[activeIndex].end) {
            activeIndex = i;
          }
        }
      }
      if (activeIndex === -1) {
        for (let i = 0; i < sub.lyrics.length; i++) {
          const seg = sub.lyrics[i];
          if (seg.start > t && seg.start - t < 0.35) {
            if (activeIndex === -1 || seg.start < sub.lyrics[activeIndex].start) {
              activeIndex = i;
            }
          }
        }
      }
    }

    // 3. When paused or stopped, bridge to closest segment within 4 seconds so preview screen never blanks out
    if (activeIndex === -1 && !isPlaying) {
      let minDiff = Infinity;
      for (let i = 0; i < sub.lyrics.length; i++) {
        const seg = sub.lyrics[i];
        const diff = Math.min(Math.abs(t - seg.start), Math.abs(t - seg.end));
        if (diff < minDiff && diff <= 4.0) {
          minDiff = diff;
          activeIndex = i;
        }
      }
    }
    if (activeIndex === -1) return;

    const activeSeg = sub.lyrics[activeIndex];
    if (!activeSeg || !activeSeg.text) return;

    ctx.save();

    const fontSize = sub.fontSize || 32;
    const fontFamily = sub.fontFamily || 'Montserrat';
    const bounce = sub.reactToBeat && isPlaying ? bass * 4 : 0;

    // --- Position Calculation (Presets + Custom Slider Override) ---
    let posX = width / 2;
    if (typeof sub.customPosX === 'number') {
      posX = (sub.customPosX / 100) * width;
    }

    let posY = height * 0.74 - bounce;
    if (sub.position === 'top') posY = height * 0.16 + bounce;
    else if (sub.position === 'center') posY = height * 0.5 - bounce;
    else if (sub.position === 'bottom') posY = height * 0.86 - bounce;
    else if (sub.position === 'center_bottom') posY = height * 0.74 - bounce;

    if (typeof sub.customPosY === 'number') {
      posY = (sub.customPosY / 100) * height - bounce;
    }

    // --- Seamless sentence-by-sentence fade animation ---
    const segDur = Math.max(0.2, activeSeg.end - activeSeg.start);
    const elapsed = t - activeSeg.start;
    const remaining = activeSeg.end - t;
    const fadeIn = Math.min(0.18, segDur * 0.18);
    const fadeOut = Math.min(0.18, segDur * 0.18);
    let alpha = 1.0;
    if (elapsed >= 0 && elapsed < fadeIn && fadeIn > 0) {
      alpha = Math.max(0.08, elapsed / fadeIn);
    } else if (remaining >= 0 && remaining < fadeOut && fadeOut > 0) {
      alpha = Math.max(0.08, remaining / fadeOut);
    } else if (remaining < 0) {
      alpha = Math.max(0.08, 1 - Math.abs(remaining) / 0.45);
    } else if (elapsed < 0) {
      alpha = Math.max(0.08, 1 - Math.abs(elapsed) / 0.35);
    }
    alpha = alpha * alpha * (3 - 2 * alpha); // smoothstep
    ctx.globalAlpha = alpha;

    // Slide-up entrance
    const slideOffset = elapsed < fadeIn ? (1 - elapsed / fadeIn) * 12 : 0;
    posY += slideOffset;

    const text = activeSeg.text;
    const hasTranslation = Boolean(sub.showTranslation !== false && activeSeg.translation);
    const translationText = activeSeg.translation || '';
    const isRansom = sub.style === 'ransom_note';
    const isKineticTypo = sub.style === 'kinetic_typography';
    const isBrutalism = sub.style === 'brutalism_y2k';
    const isTextBouncePop = sub.style === 'text_bounce_pop';
    const isWaveWarp = sub.style === 'wave_warp_displace';
    const isRandomJitter = sub.style === 'random_scale_jitter';
    const isHormozi =
      sub.style === 'hormozi_kinetic' ||
      sub.style === 'mrbeast_viral' ||
      sub.style === 'comic_pop' ||
      isKineticTypo ||
      isRansom ||
      isBrutalism ||
      isTextBouncePop ||
      isWaveWarp ||
      isRandomJitter;
    const isWordByWord = Boolean(sub.wordByWordSing !== false) || isHormozi;

    const isAlreadyHeavy =
      fontFamily === 'Anton' ||
      fontFamily === 'Impact' ||
      fontFamily === 'Bebas Neue';
    const baseWeight = isAlreadyHeavy ? 'normal' : 'bold';

    ctx.font = `${baseWeight} ${fontSize}px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // --- SCREEN OVERFLOW PROTECTION: Smart Multi-line Text Wrapping ---
    const maxAllowedWidth = width * (sub.autoWrapWidth ? sub.autoWrapWidth / 100 : 0.84);
    
    // Dynamic Word Spacing: In condensed fonts like Anton/Impact, ' ' advance is notoriously tiny (~0.15-0.2 * fontSize).
    // When font is enlarged or heavy stroke/pop animations are used, words severely collide if spaceW isn't proportionally expanded.
    const rawSpaceW = ctx.measureText(' ').width;
    const isCondensedFont =
      fontFamily === 'Anton' ||
      fontFamily === 'Impact' ||
      fontFamily === 'Bebas Neue' ||
      isRansom ||
      isBrutalism ||
      isTextBouncePop ||
      isRandomJitter;
    // Minimum comfortable word space based on font size:
    const minSpaceRatio = isHormozi || isCondensedFont ? 0.42 : 0.30;
    const proportionalSpace = fontSize * minSpaceRatio;
    // Stroke padding allowance: thick outlines (e.g. 8-12px) expand on both sides of each word
    const strokeMargin = Math.max(sub.strokeWidth ?? 4, 4) * 0.8;
    // Pop bounce buffer for kinetic styles so enlarged active word doesn't collide with neighbors
    const kineticBuffer = isHormozi ? Math.max(6, fontSize * 0.12) : 0;
    const extraStyleSpace = isRansom ? Math.max(22, fontSize * 0.52) : isBrutalism ? Math.max(8, fontSize * 0.22) : 0;
    const userSpacing = typeof sub.wordSpacing === 'number' ? sub.wordSpacing : 0;
    
    const spaceW = Math.max(rawSpaceW, proportionalSpace) + strokeMargin + kineticBuffer + extraStyleSpace + userSpacing;

    // Prepare Word Data: ensure words array ALWAYS matches the latest edited text!
    let words = activeSeg.words;
    const rawWords = text.trim().split(/\s+/).filter(Boolean);
    const wordsJoined = words ? words.map((w) => w.word).join(' ').trim() : '';
    if (!words || words.length === 0 || wordsJoined !== text.trim()) {
      const dur = Math.max(0.1, segDur);
      const wDur = dur / Math.max(1, rawWords.length);
      words = rawWords.map((w, i) => ({
        word: w,
        start: Number((activeSeg.start + i * wDur).toFixed(3)),
        end: Number((activeSeg.start + (i + 1) * wDur).toFixed(3)),
      }));
      // Keep segment words in sync so highlight/karaoke is accurate
      activeSeg.words = words;
    }

    // Cache measured words so ctx.measureText is NOT called repeatedly 60 times a second
    // Cache key MUST include segment text, timestamps, word count, and translation so any subtitle edit immediately invalidates cache!
    const wmKey = `${fontSize}_${fontFamily}_${sub.style}_${spaceW}_${sub.strokeWidth ?? 4}_${activeSeg.text}_${words.map((w) => w.word).join(' ')}_${activeSeg.start}_${activeSeg.end}_${activeSeg.words?.length || 0}_${activeSeg.translation || ''}`;
    let wm = (activeSeg as any).__wmCacheKey === wmKey ? (activeSeg as any).__wmCache : null;
    if (!wm) {
      wm = words.map((w, idx) => {
        let displayW = isHormozi ? w.word.toUpperCase() : w.word;
        let wordFont = `${baseWeight} ${fontSize}px "${fontFamily}", sans-serif`;
        let ransomCfg: any = undefined;
        let kineticCfg: any = undefined;

        if (isRansom) {
          const charSum = w.word.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          ransomCfg = CanvasRenderer.RANSOM_PALETTES[(charSum + idx) % CanvasRenderer.RANSOM_PALETTES.length];
          const fb = ransomCfg.fallback || 'sans-serif';
          wordFont = `${ransomCfg.isItalic ? 'italic ' : ''}bold ${fontSize}px "${ransomCfg.fontName}", ${fb}`;
          displayW = idx % 2 === 0 ? w.word.toUpperCase() : w.word;
        } else if (isKineticTypo) {
          const charSum = w.word.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          kineticCfg = CanvasRenderer.KINETIC_FONT_VARIANTS[(charSum + idx) % CanvasRenderer.KINETIC_FONT_VARIANTS.length];
          wordFont = kineticCfg.font.replace('{size}', String(fontSize));
          displayW = kineticCfg.isUpper ? w.word.toUpperCase() : w.word;
        } else if (isBrutalism) {
          displayW = w.word.split('').map((c, ci) => (ci % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join('');
          wordFont = `normal ${fontSize}px "Impact", "Anton", sans-serif`;
        } else if (isTextBouncePop) {
          displayW = w.word.toUpperCase();
          wordFont = `normal ${fontSize}px "Anton", "Impact", sans-serif`;
        } else if (isWaveWarp) {
          displayW = w.word;
          wordFont = `bold ${fontSize}px "${fontFamily || 'Montserrat'}", sans-serif`;
        } else if (isRandomJitter) {
          displayW = idx % 2 === 0 ? w.word.toUpperCase() : w.word;
          wordFont = `900 ${fontSize}px "Rubik", "Anton", sans-serif`;
        }

        ctx.font = wordFont;
        const ww = ctx.measureText(displayW).width;
        return {
          ...w,
          displayWord: displayW,
          width: ww,
          wordFont,
          ransomCfg,
          kineticCfg,
        };
      });
      (activeSeg as any).__wmCache = wm;
      (activeSeg as any).__wmCacheKey = wmKey;
    }

    // Determine words to display:
    // If singleLineSentenceMode is active (default: true), we ALWAYS display the complete sentence in 1 clean line
    const isSingleLine = sub.singleLineSentenceMode !== false;
    let displayWords = wm;
    if (!isSingleLine && isHormozi && wm.length > 4) {
      const activeWIdx = wm.findIndex((w: any) => t >= w.start && t <= w.end);
      const validIdx = activeWIdx !== -1 ? activeWIdx : 0;
      const chunkSize = Math.max(2, Math.min(6, sub.maxWordsPerLine || 3));
      const chunkStart = Math.floor(validIdx / chunkSize) * chunkSize;
      displayWords = wm.slice(chunkStart, chunkStart + chunkSize);
    }

    // Wrap words into rows, or auto-fit sentence into 1 single line
    const lines: { words: typeof displayWords; width: number; fitScale: number }[] = [];

    if (isSingleLine) {
      const totalWordsW = displayWords.reduce((sum: number, w: any) => sum + w.width, 0) + Math.max(0, displayWords.length - 1) * spaceW;
      const fitScale = totalWordsW > maxAllowedWidth ? Math.max(0.55, maxAllowedWidth / totalWordsW) : 1.0;
      lines.push({ words: displayWords, width: totalWordsW, fitScale });
    } else {
      let curLine: typeof displayWords = [];
      let curLineW = 0;

      for (const w of displayWords) {
        const wordWithSpace = w.width + spaceW;
        if (curLine.length > 0 && curLineW + w.width > maxAllowedWidth) {
          lines.push({ words: curLine, width: curLineW - spaceW, fitScale: 1.0 });
          curLine = [w];
          curLineW = wordWithSpace;
        } else {
          curLine.push(w);
          curLineW += wordWithSpace;
        }
      }
      if (curLine.length > 0) {
        lines.push({ words: curLine, width: curLineW - spaceW, fitScale: 1.0 });
      }
    }

    const lineHeight = fontSize * (isHormozi ? 1.35 : 1.25);
    const totalLinesHeight = lines.length * lineHeight;
    const startLineY = posY - totalLinesHeight / 2 + fontSize / 2;

    // --- 1. Background Box with Glass or Letterbox Strip ---
    if (sub.showBox) {
      const maxLineWidth = Math.max(...lines.map((l) => l.width * (l.fitScale || 1.0)));
      const paddingX = 26;
      const paddingY = 14;
      ctx.save();
      ctx.fillStyle = sub.boxColor || 'rgba(0, 0, 0, 0.65)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.roundRect(
        posX - maxLineWidth / 2 - paddingX,
        startLineY - fontSize / 2 - paddingY,
        maxLineWidth + paddingX * 2,
        totalLinesHeight + (hasTranslation ? fontSize * 1.2 : 0) + paddingY * 2,
        isHormozi ? 14 : sub.style === 'cinematic_film' ? 6 : 20
      );
      ctx.fill();
      ctx.restore();
    }

    // --- 2. Render Text Lines with Kinetic Animations & Power Words ---
    if (isWordByWord) {
      const powerWordsList =
        sub.powerWords && sub.powerWords.length > 0
          ? sub.powerWords
          : DEFAULT_POWER_WORDS;

      lines.forEach((line, lineIdx) => {
        const lineY = startLineY + lineIdx * lineHeight;
        const fitScale = line.fitScale || 1.0;

        ctx.save();
        if (fitScale < 1.0) {
          ctx.translate(posX, lineY);
          ctx.scale(fitScale, fitScale);
          ctx.translate(-posX, -lineY);
        }

        let curX = posX - line.width / 2;

        for (const w of line.words) {
          const wp = Math.max(0, Math.min(1, (t - w.start) / Math.max(0.05, w.end - w.start)));
          const isSung = t > w.end;
          const isActive = t >= w.start && t <= w.end;
          const wcx = curX + w.width / 2;

          const cleanWord = w.word.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const isPowerWord =
            sub.powerWordsEnabled !== false &&
            powerWordsList.some((pw) => pw.toUpperCase() === cleanWord);

          const anim = sub.highlightAnimation || 'bounce_pop';

          ctx.save();
          ctx.textAlign = 'left';

          if (isRansom) {
            // === RANSOM NOTE COLLAGE CUTOUT BADGE ===
            const cfg = (w as any).ransomCfg || CanvasRenderer.RANSOM_PALETTES[0];
            ctx.font = (w as any).wordFont || ctx.font;

            // Dynamically measure actual rendered text width to guarantee box ALWAYS encloses text with balanced padding
            const actualTextW = Math.max(w.width || 0, ctx.measureText(w.displayWord).width);
            const pillPadX = Math.max(14, Math.round(fontSize * 0.26));
            const pillH = fontSize * 1.34;
            const badgeW = actualTextW + pillPadX * 2;
            const tilt = cfg.tilt;
            const wCenter = curX + actualTextW / 2;

            ctx.textAlign = 'center';

            if (isActive) {
              const popScale = Math.min(1.28, 1.12 + Math.sin(wp * Math.PI) * 0.12 + bass * 0.12);
              ctx.translate(wCenter, lineY);
              ctx.rotate(tilt);
              ctx.scale(popScale, popScale);
              ctx.translate(-wCenter, -lineY);

              ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
              ctx.shadowBlur = 14;
              ctx.shadowOffsetY = 4;

              ctx.fillStyle = cfg.bg;
              ctx.fillRect(wCenter - badgeW / 2, lineY - pillH * 0.5, badgeW, pillH);

              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2.5;
              ctx.strokeRect(wCenter - badgeW / 2, lineY - pillH * 0.5, badgeW, pillH);

              ctx.shadowBlur = 0;
              ctx.shadowOffsetY = 0;
              ctx.fillStyle = cfg.text;
              ctx.fillText(w.displayWord, wCenter, lineY);
            } else if (isSung) {
              ctx.translate(wCenter, lineY);
              ctx.rotate(tilt);
              ctx.translate(-wCenter, -lineY);

              ctx.fillStyle = cfg.bg;
              ctx.fillRect(wCenter - badgeW / 2, lineY - pillH * 0.5, badgeW, pillH);

              ctx.strokeStyle = cfg.border;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(wCenter - badgeW / 2, lineY - pillH * 0.5, badgeW, pillH);

              ctx.fillStyle = cfg.text;
              ctx.fillText(w.displayWord, wCenter, lineY);
            } else {
              ctx.globalAlpha = alpha * 0.70;
              ctx.translate(wCenter, lineY);
              ctx.rotate(tilt);
              ctx.translate(-wCenter, -lineY);

              ctx.fillStyle = cfg.bg;
              ctx.fillRect(wCenter - badgeW / 2, lineY - pillH * 0.5, badgeW, pillH);

              ctx.strokeStyle = cfg.border;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(wCenter - badgeW / 2, lineY - pillH * 0.5, badgeW, pillH);

              ctx.fillStyle = cfg.text;
              ctx.fillText(w.displayWord, wCenter, lineY);
            }
          } else if (isBrutalism) {
            // === BRUTALISM / Y2K RAW CYBER AESTHETIC ===
            const bPadX = Math.max(8, Math.round(fontSize * 0.18));
            const bH = fontSize * 1.25;
            ctx.font = (w as any).wordFont || `900 ${fontSize}px "Impact", "Anton", sans-serif`;

            if (isActive) {
              const glitchX = bass > 0.52 ? (Math.random() - 0.5) * 6 : 0;
              const glitchY = bass > 0.52 ? (Math.random() - 0.5) * 4 : 0;
              const popScale = 1.12 + Math.sin(wp * Math.PI) * 0.1 + bass * 0.14;

              ctx.translate(wcx + glitchX, lineY + glitchY);
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx - glitchX, -lineY - glitchY);

              // Hard solid black block drop shadow (no blur, pure neo-brutalist offset)
              const shadowOff = Math.max(5, Math.round(fontSize * 0.12));
              ctx.fillStyle = '#000000';
              ctx.fillRect(curX - bPadX + shadowOff, lineY - bH * 0.5 + shadowOff, w.width + bPadX * 2, bH);

              // Acid Neon Green/Yellow/Pink fill
              ctx.fillStyle = sub.highlightColor || '#CCFF00';
              ctx.fillRect(curX - bPadX, lineY - bH * 0.5, w.width + bPadX * 2, bH);

              // Heavy 3.5px black border
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 3.5;
              ctx.strokeRect(curX - bPadX, lineY - bH * 0.5, w.width + bPadX * 2, bH);

              // Jet Black 900 text
              ctx.fillStyle = '#000000';
              ctx.fillText(w.displayWord, curX, lineY);
            } else if (isSung) {
              const shadowOff = 3;
              ctx.fillStyle = '#000000';
              ctx.fillRect(curX - bPadX + shadowOff, lineY - bH * 0.5 + shadowOff, w.width + bPadX * 2, bH);

              ctx.fillStyle = '#18181B';
              ctx.fillRect(curX - bPadX, lineY - bH * 0.5, w.width + bPadX * 2, bH);

              ctx.strokeStyle = '#52525B';
              ctx.lineWidth = 2;
              ctx.strokeRect(curX - bPadX, lineY - bH * 0.5, w.width + bPadX * 2, bH);

              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(w.displayWord, curX, lineY);
            } else {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 4;
              ctx.lineJoin = 'miter';
              ctx.strokeText(w.displayWord, curX, lineY);

              ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.fillText(w.displayWord, curX, lineY);
            }
          } else if (isKineticTypo) {
            // === KINETIC TYPOGRAPHY: CHAOS FONT-MIXING & DYNAMIC BEATS ===
            const kf = (w as any).kineticCfg;
            const tilt = kf?.tilt ?? (w.displayWord.length % 2 === 0 ? 0.04 : -0.04);
            ctx.font = (w as any).wordFont || ctx.font;

            if (isActive) {
              const popScale = Math.min(1.30, 1.12 + Math.sin(wp * Math.PI) * 0.16 + bass * 0.15);
              ctx.translate(wcx, lineY);
              ctx.rotate(tilt * (1 + bass * 0.4));
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx, -lineY);

              const hl = sub.highlightColor || '#FFE600';
              ctx.shadowColor = hl;
              ctx.shadowBlur = Math.min(8, 2 + bass * 6);

              ctx.strokeStyle = sub.strokeColor || '#000000';
              const maxStroke = Math.min(sub.strokeWidth ?? 3, Math.max(1.5, fontSize * 0.065));
              ctx.lineWidth = maxStroke;
              ctx.lineJoin = 'round';
              ctx.strokeText(w.displayWord, curX, lineY);

              ctx.fillStyle = hl;
              ctx.fillText(w.displayWord, curX, lineY);
            } else if (isSung) {
              ctx.shadowBlur = 0;
              ctx.strokeStyle = sub.strokeColor || '#000000';
              ctx.lineWidth = Math.min(sub.strokeWidth ?? 2.5, Math.max(1.2, fontSize * 0.05));
              ctx.lineJoin = 'round';
              ctx.strokeText(w.displayWord, curX, lineY);

              ctx.fillStyle = sub.textColor || '#FFFFFF';
              ctx.fillText(w.displayWord, curX, lineY);
            } else {
              ctx.shadowBlur = 0;
              ctx.strokeStyle = sub.strokeColor || '#000000';
              ctx.lineWidth = Math.min(sub.strokeWidth ?? 2, Math.max(1.0, fontSize * 0.04));
              ctx.strokeText(w.displayWord, curX, lineY);

              ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
              ctx.fillText(w.displayWord, curX, lineY);
            }
          } else if (isActive) {
            // === ACTIVE WORD: KINETIC ANIMATIONS & EMOTIVE POWER HIGHLIGHT ===
            const powerBoost = isPowerWord ? (sub.powerWordsScale || 1.25) : 1.0;

            // 1. Kinetic Transform
            if (anim === 'beat_bounce_pop' || isTextBouncePop) {
              // Text Bounce / Text Pop: Membesar & mengecil cepat mengikuti ketukan bass musik
              const bassKick = Math.pow(bass, 1.35) * 0.48;
              const elasticWp = Math.sin(wp * Math.PI) * 0.22;
              const popScale = Math.min(1.72, (1.14 + elasticWp + bassKick) * powerBoost);
              const tilt = (Math.sin(t * 14 + (w.displayWord.length % 3)) * 0.04) * (bass > 0.4 ? 1.4 : 0.7);
              ctx.translate(wcx, lineY);
              ctx.rotate(tilt);
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'wave_warp' || isWaveWarp) {
              // Wave Warp / Turbulent Displace: Bergelombang vertikal & horizontal, goyang cair
              const wavePhase = t * 7.2 + (curX / 80);
              const waveY = Math.sin(wavePhase) * (7 + bass * 14);
              const waveX = Math.cos(wavePhase * 0.85) * (5 + bass * 10);
              const turbJitterX = Math.sin(t * 26 + curX * 0.1) * (2 + bass * 4);
              const turbJitterY = Math.cos(t * 30 + curX * 0.1) * (2 + bass * 4);
              const warpTilt = Math.sin(wavePhase * 1.15) * (0.08 + bass * 0.09);
              const warpScaleX = (1.10 + Math.cos(wavePhase * 1.4) * 0.14 + bass * 0.16) * powerBoost;
              const warpScaleY = (1.10 + Math.sin(wavePhase * 1.4) * 0.16 + bass * 0.18) * powerBoost;
              const totalDispX = waveX + turbJitterX;
              const totalDispY = waveY + turbJitterY;

              ctx.translate(wcx + totalDispX, lineY + totalDispY);
              ctx.rotate(warpTilt);
              ctx.scale(warpScaleX, warpScaleY);
              ctx.translate(-wcx - totalDispX, -lineY - totalDispY);
            } else if (anim === 'position_scale_jitter' || isRandomJitter) {
              // Random Scale / Position Jitter: Mengacak posisi atas-bawah, kiri-kanan & ukuran font di tiap beat
              const beatSpeed = 6 + Math.floor(bass * 8);
              const beatStep = Math.floor(t * beatSpeed);
              const seed = Math.abs((beatStep * 7919 + w.displayWord.length * 1013) % 100000);
              const r1 = Math.abs(Math.sin(seed * 1.11));
              const r2 = Math.abs(Math.cos(seed * 1.73));
              const r3 = Math.abs(Math.sin(seed * 2.37));

              const jx = (r1 - 0.5) * (14 + bass * 26);
              const jy = (r2 - 0.5) * (12 + bass * 22);
              const randScale = Math.max(0.78, Math.min(1.68, (1.18 + (r3 - 0.5) * (0.45 + bass * 0.55)) * powerBoost));
              const randRot = (r1 - 0.5) * (0.16 + bass * 0.24);

              ctx.translate(wcx + jx, lineY + jy);
              ctx.rotate(randRot);
              ctx.scale(randScale, randScale);
              ctx.translate(-wcx - jx, -lineY - jy);
            } else if (anim === 'bounce_pop') {
              const popScale = Math.min(1.28, (1.08 + Math.sin(wp * Math.PI) * 0.12 + bass * 0.08) * powerBoost);
              const tilt = isPowerWord ? 0.03 : (w.displayWord.length % 2 === 0 ? 0.02 : -0.02);
              ctx.translate(wcx, lineY);
              ctx.rotate(tilt);
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'slide_up') {
              const slideUpDist = (1 - Math.min(1, wp * 2.8)) * (fontSize * 0.35);
              const popScale = (1.14 + Math.sin(wp * Math.PI) * 0.08 + bass * 0.1) * powerBoost;
              ctx.translate(wcx, lineY + slideUpDist);
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'zoom_pulse') {
              const zoomScale = (1.0 + (1 - wp) * 0.38 + bass * 0.22) * powerBoost;
              ctx.translate(wcx, lineY);
              ctx.scale(zoomScale, zoomScale);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'shake_wobble') {
              const wobbleAngle = Math.sin(wp * Math.PI * 10) * 0.07;
              const wobbleX = Math.cos(wp * Math.PI * 8) * 3;
              const wobbleScale = (1.14 + bass * 0.15) * powerBoost;
              ctx.translate(wcx + wobbleX, lineY);
              ctx.rotate(wobbleAngle);
              ctx.scale(wobbleScale, wobbleScale);
              ctx.translate(-wcx - wobbleX, -lineY);
            } else if (anim === 'rubber_band') {
              const stretchX = (1.24 + Math.sin(wp * Math.PI) * 0.24 + bass * 0.15) * powerBoost;
              const stretchY = (1.05 - Math.sin(wp * Math.PI) * 0.18) * powerBoost;
              ctx.translate(wcx, lineY);
              ctx.scale(stretchX, stretchY);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'karaoke_wave') {
              const lift = Math.sin(wp * Math.PI) * 4;
              ctx.translate(wcx, lineY - lift);
              ctx.scale((1.08 + bass * 0.1) * powerBoost, (1.08 + bass * 0.1) * powerBoost);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'glow_pulse') {
              const pulseScale = (1.12 + Math.sin(wp * Math.PI) * 0.1 + bass * 0.15) * powerBoost;
              ctx.translate(wcx, lineY);
              ctx.scale(pulseScale, pulseScale);
              ctx.translate(-wcx, -lineY);
            } else if (anim === 'box_sticker' || sub.style === 'color_pill') {
              const popScale = (1.15 + Math.sin(wp * Math.PI) * 0.1 + bass * 0.12) * powerBoost;
              ctx.translate(wcx, lineY);
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx, -lineY);
            } else {
              const popScale = (1.08 + Math.sin(wp * Math.PI) * 0.06) * powerBoost;
              ctx.translate(wcx, lineY);
              ctx.scale(popScale, popScale);
              ctx.translate(-wcx, -lineY);
            }

            // 2. Pill Box / Sticker Background
            const usePill =
              (isPowerWord && sub.powerWordsBox !== false) ||
              anim === 'box_sticker' ||
              sub.style === 'color_pill';

            if (usePill) {
              const pillBg = isPowerWord
                ? (sub.powerWordsBgColor || '#E11D48')
                : (sub.highlightColor || '#FFE600');
              const pillText = isPowerWord
                ? (sub.powerWordsColor || '#FFFFFF')
                : '#000000';

              const pillPadX = Math.max(5, Math.round(fontSize * 0.10));
              const pillH = fontSize * 1.18;
              const pillR = Math.max(4, Math.round(fontSize * 0.14));
              ctx.fillStyle = pillBg;
              ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.roundRect(curX - pillPadX, lineY - pillH * 0.5, w.width + pillPadX * 2, pillH, pillR);
              ctx.fill();

              // High contrast inner text
              ctx.shadowBlur = 0;
              ctx.fillStyle = pillText;
              ctx.fillText(w.displayWord, curX, lineY);
            } else {
              // Standard stroke + colored text (crisp outline)
              const strokeW = Math.min(sub.strokeWidth ?? 3, Math.max(1.5, Math.round(fontSize * 0.07)));
              ctx.strokeStyle = sub.strokeColor || '#000000';
              ctx.lineWidth = strokeW;
              ctx.lineJoin = 'round';
              ctx.miterLimit = 2;
              ctx.strokeText(w.displayWord, curX, lineY);

              if (anim === 'beat_bounce_pop' || isTextBouncePop) {
                const hl = isPowerWord ? (sub.powerWordsColor || '#FFE600') : (sub.highlightColor || '#FFE600');
                ctx.fillStyle = hl;
                ctx.shadowColor = hl;
                ctx.shadowBlur = Math.min(10, 3 + bass * 8);
              } else if (anim === 'wave_warp' || isWaveWarp) {
                const hl = isPowerWord ? (sub.powerWordsColor || '#00F0FF') : (sub.highlightColor || '#00F0FF');
                ctx.fillStyle = hl;
                ctx.shadowColor = hl;
                ctx.shadowBlur = Math.min(10, 3 + bass * 8);
              } else if (anim === 'position_scale_jitter' || isRandomJitter) {
                const hl = isPowerWord ? (sub.powerWordsColor || '#FF0055') : (sub.highlightColor || '#FF0055');
                ctx.fillStyle = hl;
                ctx.shadowColor = hl;
                ctx.shadowBlur = Math.min(8, 2 + bass * 6);
              } else if (anim === 'karaoke_wave') {
                const grad = ctx.createLinearGradient(curX, 0, curX + w.width, 0);
                const sweep = Math.max(0, Math.min(1, wp));
                const hl = isPowerWord ? (sub.powerWordsColor || '#FFE600') : (sub.highlightColor || '#00F0FF');
                grad.addColorStop(0, hl);
                grad.addColorStop(sweep, hl);
                grad.addColorStop(Math.min(1, sweep + 0.15), sub.textColor || '#FFFFFF');
                grad.addColorStop(1, sub.textColor || '#FFFFFF');
                ctx.fillStyle = grad;
                ctx.shadowColor = hl;
                ctx.shadowBlur = Math.min(8, 2 + bass * 6);
              } else if (anim === 'glow_pulse' || sub.style === 'neon_outline') {
                const hl = isPowerWord ? (sub.powerWordsColor || '#FFE600') : (sub.highlightColor || '#00F0FF');
                ctx.fillStyle = hl;
                ctx.shadowColor = hl;
                ctx.shadowBlur = Math.min(14, 4 + Math.sin(wp * Math.PI) * 6 + bass * 8);
              } else {
                const hl = isPowerWord ? (sub.powerWordsColor || '#FFE600') : (sub.highlightColor || '#FFE600');
                ctx.fillStyle = hl;
                ctx.shadowColor = hl;
                ctx.shadowBlur = Math.min(8, 2 + bass * 4);
              }
              ctx.fillText(w.displayWord, curX, lineY);
            }
          } else if (isSung) {
            // === SUNG / PAST WORDS ===
            ctx.shadowBlur = 0;

            if (isWaveWarp || anim === 'wave_warp') {
              const wavePhase = t * 7.2 + (curX / 80);
              const waveY = Math.sin(wavePhase) * (5 + bass * 9);
              const waveX = Math.cos(wavePhase * 0.85) * (3 + bass * 6);
              const warpTilt = Math.sin(wavePhase * 1.15) * 0.05;
              ctx.translate(wcx + waveX, lineY + waveY);
              ctx.rotate(warpTilt);
              ctx.translate(-wcx - waveX, -lineY - waveY);
            } else if (isTextBouncePop || anim === 'beat_bounce_pop') {
              const bScale = 1.0 + Math.pow(bass, 1.5) * 0.12;
              ctx.translate(wcx, lineY);
              ctx.scale(bScale, bScale);
              ctx.translate(-wcx, -lineY);
            } else if (isRandomJitter || anim === 'position_scale_jitter') {
              const beatSpeed = 6 + Math.floor(bass * 8);
              const beatStep = Math.floor(t * beatSpeed);
              const seed = Math.abs((beatStep * 7919 + w.displayWord.length * 1013) % 100000);
              const r1 = Math.abs(Math.sin(seed * 1.11));
              const r2 = Math.abs(Math.cos(seed * 1.73));
              const jx = (r1 - 0.5) * (5 + bass * 9);
              const jy = (r2 - 0.5) * (4 + bass * 7);
              ctx.translate(wcx + jx, lineY + jy);
              ctx.translate(-wcx - jx, -lineY - jy);
            }

            if (isPowerWord && sub.powerWordsBox !== false) {
              const pillPadX = Math.max(4, Math.round(fontSize * 0.08));
              const pillH = fontSize * 1.06;
              const pillR = Math.max(3, Math.round(fontSize * 0.12));
              ctx.fillStyle = sub.powerWordsBgColor || '#E11D48';
              ctx.beginPath();
              ctx.roundRect(curX - pillPadX, lineY - pillH * 0.5, w.width + pillPadX * 2, pillH, pillR);
              ctx.fill();
              ctx.fillStyle = sub.powerWordsColor || '#FFFFFF';
            } else {
              const strokeW = Math.min(sub.strokeWidth ?? 3, Math.max(1.5, Math.round(fontSize * 0.07)));
              ctx.strokeStyle = sub.strokeColor || '#000000';
              ctx.lineWidth = strokeW;
              ctx.lineJoin = 'round';
              ctx.strokeText(w.displayWord, curX, lineY);
              ctx.fillStyle = isPowerWord ? (sub.powerWordsColor || '#FFE600') : (sub.textColor || '#FFFFFF');
            }
            ctx.fillText(w.displayWord, curX, lineY);
          } else {
            // === UPCOMING WORDS IN CHUNK ===
            ctx.shadowBlur = 0;

            if (isWaveWarp || anim === 'wave_warp') {
              const wavePhase = t * 7.2 + (curX / 80);
              const waveY = Math.sin(wavePhase) * (4 + bass * 8);
              const waveX = Math.cos(wavePhase * 0.85) * (2.5 + bass * 5);
              const warpTilt = Math.sin(wavePhase * 1.15) * 0.04;
              ctx.translate(wcx + waveX, lineY + waveY);
              ctx.rotate(warpTilt);
              ctx.translate(-wcx - waveX, -lineY - waveY);
            } else if (isTextBouncePop || anim === 'beat_bounce_pop') {
              const bScale = 1.0 + Math.pow(bass, 1.6) * 0.08;
              ctx.translate(wcx, lineY);
              ctx.scale(bScale, bScale);
              ctx.translate(-wcx, -lineY);
            } else if (isRandomJitter || anim === 'position_scale_jitter') {
              const beatSpeed = 6 + Math.floor(bass * 8);
              const beatStep = Math.floor(t * beatSpeed);
              const seed = Math.abs((beatStep * 7919 + w.displayWord.length * 1013) % 100000);
              const r1 = Math.abs(Math.sin(seed * 1.11));
              const r2 = Math.abs(Math.cos(seed * 1.73));
              const jx = (r1 - 0.5) * (4 + bass * 8);
              const jy = (r2 - 0.5) * (3 + bass * 6);
              ctx.translate(wcx + jx, lineY + jy);
              ctx.translate(-wcx - jx, -lineY - jy);
            }

            if (isPowerWord) {
              const strokeW = Math.max(2, sub.strokeWidth || 4);
              ctx.strokeStyle = sub.strokeColor || '#000000';
              ctx.lineWidth = strokeW;
              ctx.lineJoin = 'round';
              ctx.strokeText(w.displayWord, curX, lineY);
              ctx.fillStyle = sub.powerWordsColor || 'rgba(255, 230, 0, 0.9)';
            } else {
              const strokeW = Math.max(2, sub.strokeWidth || 4);
              ctx.strokeStyle = sub.strokeColor || '#000000';
              ctx.lineWidth = strokeW;
              ctx.lineJoin = 'round';
              ctx.strokeText(w.displayWord, curX, lineY);
              ctx.fillStyle = isHormozi ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.35)';
            }
            ctx.fillText(w.displayWord, curX, lineY);
          }

          ctx.restore();
          const wordStepW = isRansom ? Math.max(w.width || 0, ctx.measureText(w.displayWord).width) : w.width;
          curX += wordStepW + spaceW;
        }

        ctx.restore();
      });
    } else {
      // Full line rendering
      lines.forEach((line, lineIdx) => {
        const lineY = startLineY + lineIdx * lineHeight;
        const lineStr = line.words.map((w: any) => w.displayWord).join(' ');
        const fitScale = line.fitScale || 1.0;

        ctx.save();
        if (fitScale < 1.0) {
          ctx.translate(posX, lineY);
          ctx.scale(fitScale, fitScale);
          ctx.translate(-posX, -lineY);
        }

        if (sub.strokeWidth > 0) {
          ctx.strokeStyle = sub.strokeColor || '#000';
          ctx.lineWidth = sub.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.strokeText(lineStr, posX, lineY);
        }

        if (sub.style === 'karaoke_glow') {
          ctx.shadowColor = sub.highlightColor || '#00F0FF';
          ctx.shadowBlur = isPlaying ? 14 + bass * 22 : 8;
          ctx.fillStyle = sub.textColor || '#FFFFFF';
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'viral_pop' || sub.style === 'mrbeast_viral') {
          ctx.fillStyle = sub.highlightColor || '#FFE600';
          ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'kinetic_typography') {
          ctx.fillStyle = sub.highlightColor || '#FFE600';
          ctx.shadowColor = sub.highlightColor || '#FFE600'; ctx.shadowBlur = 14 + bass * 16;
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'ransom_note') {
          ctx.fillStyle = '#FFE500';
          ctx.shadowColor = '#000000'; ctx.shadowBlur = 8;
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'brutalism_y2k') {
          ctx.fillStyle = sub.highlightColor || '#CCFF00';
          ctx.shadowColor = '#000000'; ctx.shadowBlur = 0;
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'comic_pop') {
          ctx.fillStyle = sub.highlightColor || '#FF7700';
          ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'cinematic_film') {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 6;
          ctx.fillStyle = sub.textColor || '#F3F4F6';
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'neon_outline') {
          ctx.shadowColor = sub.highlightColor || '#FF007F';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = sub.highlightColor || '#FF007F'; ctx.lineWidth = 3;
          ctx.strokeText(lineStr, posX, lineY);
          ctx.fillStyle = sub.textColor || '#FFFFFF';
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'text_bounce_pop') {
          const bScale = 1.0 + Math.pow(bass, 1.35) * 0.28;
          ctx.translate(posX, lineY);
          ctx.scale(bScale, bScale);
          ctx.translate(-posX, -lineY);
          ctx.fillStyle = sub.highlightColor || '#FFE600';
          ctx.shadowColor = sub.highlightColor || '#FFE600';
          ctx.shadowBlur = Math.min(10, 4 + bass * 6);
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'wave_warp_displace') {
          const wavePhase = t * 6.0;
          const waveY = Math.sin(wavePhase) * (8 + bass * 14);
          const waveTilt = Math.sin(wavePhase * 0.8) * 0.05;
          ctx.translate(posX, lineY + waveY);
          ctx.rotate(waveTilt);
          ctx.translate(-posX, -lineY - waveY);
          ctx.fillStyle = sub.highlightColor || '#00F0FF';
          ctx.shadowColor = sub.highlightColor || '#00F0FF';
          ctx.shadowBlur = Math.min(10, 4 + bass * 6);
          ctx.fillText(lineStr, posX, lineY);
        } else if (sub.style === 'random_scale_jitter') {
          const beatStep = Math.floor(t * (6 + bass * 6));
          const r1 = Math.abs(Math.sin(beatStep * 1.11));
          const r2 = Math.abs(Math.cos(beatStep * 1.73));
          const jx = (r1 - 0.5) * (14 + bass * 22);
          const jy = (r2 - 0.5) * (12 + bass * 18);
          const randScale = 0.92 + (r1 - 0.5) * (0.28 + bass * 0.35);
          ctx.translate(posX + jx, lineY + jy);
          ctx.scale(randScale, randScale);
          ctx.translate(-posX - jx, -lineY - jy);
          ctx.fillStyle = sub.highlightColor || '#FF0055';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 10;
          ctx.fillText(lineStr, posX, lineY);
        } else {
          ctx.fillStyle = sub.textColor || '#FFFFFF';
          ctx.fillText(lineStr, posX, lineY);
        }
        ctx.restore();
      });
    }

    // --- 3. Dual Subtitle / Translation Line ---
    if (hasTranslation && translationText) {
      const tfs = sub.translationFontSize || Math.round(fontSize * 0.6);
      const tpy = startLineY + totalLinesHeight + tfs * 0.4;
      ctx.save();
      ctx.font = `500 ${tfs}px "${fontFamily}", sans-serif`;
      const transW = ctx.measureText(translationText).width;
      const transFit = transW > maxAllowedWidth ? Math.max(0.6, maxAllowedWidth / transW) : 1.0;
      if (transFit < 1.0) {
        ctx.translate(posX, tpy);
        ctx.scale(transFit, transFit);
        ctx.translate(-posX, -tpy);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sub.translationColor || 'rgba(255, 255, 255, 0.78)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 4;
      if (sub.strokeWidth > 0) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(1, sub.strokeWidth - 1);
        ctx.strokeText(translationText, posX, tpy);
      }
      ctx.fillText(translationText, posX, tpy);
      ctx.restore();
    }

    // --- 4. Next Line Preview (Fades in near end of current line) ---
    const nextSeg = sub.lyrics[activeIndex + 1];
    if (nextSeg && nextSeg.text && remaining < 1.5 && !isHormozi) {
      const na = Math.max(0, ((1.5 - remaining) / 1.5) * 0.28);
      const nfs = Math.round(fontSize * 0.68);
      const npy = startLineY + totalLinesHeight + (hasTranslation ? fontSize * 1.3 : fontSize * 0.8);
      ctx.save();
      ctx.globalAlpha = na;
      ctx.font = `600 ${nfs}px "${fontFamily}", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillText(nextSeg.text, posX, npy);
      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================
  // STUDIO VISUAL FX SUITE RENDERERS
  // ==========================================

  private drawVideoBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    videoConfig: EffectsConfig['videoBackground'],
    bass: number,
    isPlaying: boolean
  ): void {
    let videoUrl = videoConfig.customVideoUrl;
    if (videoConfig.preset !== 'custom_video' && videoConfig.preset !== 'preset_none') {
      const found = VIDEO_PRESETS.find((p) => p.id === videoConfig.preset);
      if (found) videoUrl = found.url;
    }
    if (!videoUrl) return;

    const video = this.preloadVideo(videoUrl);
    if (!video || video.readyState < 2) return;

    if (isPlaying) {
      if (video.paused) video.play().catch(() => {});
      if (videoConfig.audioReactiveSpeed) {
        video.playbackRate = Math.min(2.0, Math.max(0.5, videoConfig.playbackRate * (1 + bass * 0.35)));
      }
    } else if (!video.paused) {
      video.pause();
    }

    ctx.save();
    ctx.globalAlpha = videoConfig.opacity;
    const vWidth = video.videoWidth || 1920;
    const vHeight = video.videoHeight || 1080;
    const scale = Math.max(width / vWidth, height / vHeight);
    const drawW = vWidth * scale;
    const drawH = vHeight * scale;
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;

    ctx.drawImage(video, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  private apply3DCameraTransform(
    ctx: CanvasRenderingContext2D,
    cam: EffectsConfig['camera3D'],
    currentTime: number,
    isPlaying: boolean
  ): void {
    const tiltXRad = (cam.tiltX * Math.PI) / 180;
    const tiltYRad = (cam.tiltY * Math.PI) / 180;
    const orbit = cam.autoOrbit && isPlaying ? Math.sin(currentTime * 0.5) * 0.12 : 0;

    // Pseudo-3D Perspective Projection
    ctx.scale(1, Math.max(0.2, Math.cos(tiltXRad)));
    ctx.rotate(tiltYRad + orbit);

    // Dynamic 3D depth shadow under the spectrum
    if (cam.depth > 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowOffsetY = cam.depth * 40;
      ctx.shadowBlur = cam.depth * 30;
    }
  }

  private drawWaveformScrubber(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scrubber: EffectsConfig['waveformScrubber'],
    audioData: AudioFrequencyData,
    currentTime: number,
    duration: number
  ): void {
    const margin = Math.floor(width * 0.05);
    const scrubberWidth = width - margin * 2;
    const scrubberHeight = scrubber.height || 22;
    const bottomY = height - scrubberHeight - 16;
    const progress = Math.min(1, Math.max(0, currentTime / (duration || 180)));

    ctx.save();
    // Glass background track
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(margin, bottomY, scrubberWidth, scrubberHeight, scrubberHeight / 2);
    ctx.fill();
    ctx.stroke();

    // 64 Waveform Bars
    const barCount = 64;
    const barW = Math.max(1, (scrubberWidth - barCount * 2) / barCount);
    for (let i = 0; i < barCount; i++) {
      const barProgress = i / barCount;
      const isPast = barProgress <= progress;
      const x = margin + 3 + i * (barW + 2);
      const dataIdx = Math.floor((i / barCount) * (audioData.frequencyData?.length || 64));
      const val = audioData.frequencyData ? audioData.frequencyData[dataIdx] || 40 : 40;
      const barH = Math.max(3, (val / 255) * (scrubberHeight - 6));
      const y = bottomY + (scrubberHeight - barH) / 2;

      ctx.fillStyle = isPast ? (scrubber.progressColor || '#EC4899') : 'rgba(255, 255, 255, 0.2)';
      if (isPast) {
        ctx.shadowColor = scrubber.progressColor || '#EC4899';
        ctx.shadowBlur = 4;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 1.5);
      ctx.fill();
    }

    // Glowing Playhead Needle Dot
    const cursorX = margin + progress * scrubberWidth;
    ctx.shadowColor = scrubber.progressColor || '#EC4899';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cursorX, bottomY + scrubberHeight / 2, scrubberHeight / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Time Indicator Text
    if (scrubber.showTime) {
      ctx.shadowBlur = 0;
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'right';
      const curM = Math.floor(currentTime / 60);
      const curS = Math.floor(currentTime % 60);
      const durM = Math.floor(duration / 60);
      const durS = Math.floor(duration % 60);
      const timeStr = `${curM}:${curS < 10 ? '0' : ''}${curS} / ${durM}:${durS < 10 ? '0' : ''}${durS}`;
      ctx.fillText(timeStr, width - margin, bottomY - 5);
    }

    ctx.restore();
  }

  private drawChromaticAberration(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    fx: EffectsConfig['chromaticAberration'],
    bass: number,
    isBeat: boolean
  ): void {
    if (fx.reactToBeat && !isBeat && bass < 0.4) return;
    const offset = Math.max(1, Math.floor(fx.intensity * (bass * 0.7 + (isBeat ? 0.6 : 0))));
    if (offset <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(ctx.canvas, -offset, 0, width, height);
    ctx.drawImage(ctx.canvas, offset, 0, width, height);
    ctx.restore();
  }

  private drawVhsOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    vhs: EffectsConfig['vhsOverlay'],
    currentTime: number
  ): void {
    ctx.save();
    // 1. Horizontal Scanlines
    if (vhs.scanlines) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }
    }

    // 2. Vintage Grain
    if (vhs.grain && vhs.noiseIntensity > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${vhs.noiseIntensity * 0.08})`;
      for (let i = 0; i < 35; i++) {
        const gx = Math.random() * width;
        const gy = Math.random() * height;
        const gw = Math.random() * 5 + 1;
        ctx.fillRect(gx, gy, gw, 1);
      }
    }

    // 3. Vintage Monospace OSD
    if (vhs.timestampOsd) {
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillStyle = '#00FF66';
      ctx.shadowColor = '#00FF66';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'left';
      ctx.fillText('PLAY ▶ SP', 28, 38);

      const m = Math.floor(currentTime / 60);
      const s = Math.floor(currentTime % 60);
      const ms = Math.floor((currentTime % 1) * 100);
      const timecode = `00:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}:${ms < 10 ? '0' : ''}${ms}`;
      ctx.fillText(timecode, 28, 58);
    }
    ctx.restore();
  }

  /**
   * Targeted Frame Visual Effects (Distorsi, Kamera Jadul, Cacing-cacing)
   * Hanya diaplikasikan ke frame / klip / interval terpilih, BUKAN sepanjang video!
   * Dilengkapi kurva transisi halus (Ease-in & Ease-out Crossfade) agar pergantian frame tidak terasa kasar.
   */
  private drawTargetedFrameEffects(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bg: BackgroundConfig,
    currentTime: number,
    bass: number,
    isPlaying: boolean
  ): void {
    let activeEffect: VisualEffectType = 'none';
    let effectIntensity = 0.75;
    let fadeFactor = 1.0;

    // 1. Check if current active multi-image slide has a visual effect
    if (bg.multiImageSlides && bg.multiImageSlides.length > 0) {
      const slides = bg.multiImageSlides;
      const currIdx = slides.findIndex(
        (s) => currentTime >= s.startSec && currentTime < s.endSec
      );

      if (currIdx !== -1) {
        const slide = slides[currIdx];
        if (slide.visualEffect && slide.visualEffect !== 'none') {
          activeEffect = slide.visualEffect;
          effectIntensity = slide.visualEffectIntensity ?? 0.75;

          const slideDur = Math.max(0.4, slide.endSec - slide.startSec);
          // Jeda transisi lembut (0.35s - 0.7s) selaras dengan transisi slide
          const fadeWindow = Math.min(0.7, Math.max(0.25, slideDur * 0.22));

          // Cek slide sebelumnya: jika slide sebelumnya memiliki efek yang sama, efek mengalir tanpa jeda
          const prevSlide = currIdx > 0 ? slides[currIdx - 1] : null;
          const prevHasSameEffect = prevSlide && prevSlide.visualEffect === activeEffect;

          let easeIn = 1.0;
          if (!prevHasSameEffect) {
            const timeFromStart = currentTime - slide.startSec;
            if (timeFromStart < fadeWindow) {
              const p = Math.max(0, Math.min(1, timeFromStart / fadeWindow));
              easeIn = 0.5 - 0.5 * Math.cos(p * Math.PI); // Smooth S-curve
            }
          }

          // Cek slide selanjutnya: jika slide selanjutnya memiliki efek yang sama, efek mengalir tanpa jeda
          const nextSlide = currIdx < slides.length - 1 ? slides[currIdx + 1] : null;
          const nextHasSameEffect = nextSlide && nextSlide.visualEffect === activeEffect;

          let easeOut = 1.0;
          if (!nextHasSameEffect) {
            const timeToEnd = slide.endSec - currentTime;
            if (timeToEnd < fadeWindow) {
              const p = Math.max(0, Math.min(1, timeToEnd / fadeWindow));
              easeOut = 0.5 - 0.5 * Math.cos(p * Math.PI); // Smooth S-curve
            }
          }

          fadeFactor = Math.min(easeIn, easeOut);
        }
      }
    }

    // 2. Check if active B-Roll clip has a visual effect
    if (activeEffect === 'none' && bg.bRoll?.enabled && bg.bRoll.clips) {
      const broll = bg.bRoll.clips.find(
        (c) => currentTime >= c.startSec && currentTime < c.endSec && c.visualEffect && c.visualEffect !== 'none'
      );
      if (broll) {
        activeEffect = broll.visualEffect!;
        effectIntensity = broll.visualEffectIntensity ?? 0.75;
        const brollDur = Math.max(0.4, broll.endSec - broll.startSec);
        const fadeWindow = Math.min(0.5, Math.max(0.2, brollDur * 0.2));
        const timeFromStart = currentTime - broll.startSec;
        const timeToEnd = broll.endSec - currentTime;
        const pIn = Math.max(0, Math.min(1, timeFromStart / fadeWindow));
        const pOut = Math.max(0, Math.min(1, timeToEnd / fadeWindow));
        fadeFactor = Math.min(
          0.5 - 0.5 * Math.cos(pIn * Math.PI),
          0.5 - 0.5 * Math.cos(pOut * Math.PI)
        );
      }
    }

    // 3. Check if dedicated Timeline FX clip is active at current time
    if (activeEffect === 'none' && bg.timelineFxClips && bg.timelineFxClips.length > 0) {
      const fx = bg.timelineFxClips.find(
        (clip) => currentTime >= clip.startSec && currentTime < clip.endSec && clip.effect !== 'none'
      );
      if (fx) {
        activeEffect = fx.effect;
        effectIntensity = fx.intensity ?? 0.75;
        const fxDur = Math.max(0.4, fx.endSec - fx.startSec);
        const fadeWindow = Math.min(0.5, Math.max(0.2, fxDur * 0.2));
        const timeFromStart = currentTime - fx.startSec;
        const timeToEnd = fx.endSec - currentTime;
        const pIn = Math.max(0, Math.min(1, timeFromStart / fadeWindow));
        const pOut = Math.max(0, Math.min(1, timeToEnd / fadeWindow));
        fadeFactor = Math.min(
          0.5 - 0.5 * Math.cos(pIn * Math.PI),
          0.5 - 0.5 * Math.cos(pOut * Math.PI)
        );
      }
    }

    // If no effect active for this frame/time or fully dissolved, do nothing!
    if (activeEffect === 'none' || fadeFactor <= 0.005) return;

    const blendedIntensity = effectIntensity * fadeFactor;

    // Apply the active visual effect(s) with smooth crossfade
    if (activeEffect === 'distortion' || activeEffect === 'all') {
      this.drawDistortionEffect(ctx, width, height, blendedIntensity, currentTime, bass, isPlaying, fadeFactor);
    }

    if (activeEffect === 'vintage_camera' || activeEffect === 'vintage_worms' || activeEffect === 'all') {
      this.drawVintageCameraEffect(ctx, width, height, blendedIntensity, currentTime, fadeFactor);
    }

    if (activeEffect === 'film_worms' || activeEffect === 'vintage_worms' || activeEffect === 'all') {
      this.drawFilmWormsEffect(ctx, width, height, blendedIntensity, currentTime);
    }
  }

  /**
   * ⚡ EFEK DISTORSI (Camera Glitch, Slice Displacement & Chromatic Split)
   */
  private drawDistortionEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    currentTime: number,
    bass: number,
    isPlaying: boolean,
    fadeFactor: number = 1.0
  ): void {
    if (intensity <= 0.005) return;
    ctx.save();
    const frameSeed = Math.floor(currentTime * 16);
    const pseudoRand = (n: number) => {
      const x = Math.sin(frameSeed * 997.1 + n * 133.7) * 43758.5453;
      return Math.abs(x - Math.floor(x));
    };

    const glitchPower = Math.min(1.8, intensity * (1 + (isPlaying ? bass * 0.4 : 0)));

    // A. Horizontal Slice Displacement Glitch (scaled by fadeFactor)
    const numSlices = Math.floor((3 + pseudoRand(1) * 7 * glitchPower) * fadeFactor);
    const cvsW = ctx.canvas.width;
    const cvsH = ctx.canvas.height;
    const scaleY = cvsH / height;

    for (let i = 0; i < numSlices; i++) {
      const sliceY = pseudoRand(i * 11) * height;
      const sliceH = 8 + pseudoRand(i * 17) * 40 * glitchPower;
      const maxOffset = (28 * glitchPower) * (width / 1280) * fadeFactor;
      const offsetX = (pseudoRand(i * 23) - 0.5) * 2 * maxOffset;

      if (Math.abs(offsetX) > 1) {
        try {
          const sy = Math.max(0, Math.floor(sliceY * scaleY));
          const sh = Math.min(Math.floor(sliceH * scaleY), cvsH - sy);
          if (sh > 0) {
            ctx.drawImage(
              ctx.canvas,
              0,
              sy,
              cvsW,
              sh,
              offsetX,
              Math.max(0, sliceY),
              width,
              Math.min(sliceH, height - sliceY)
            );
          }
        } catch {
          // ignore canvas self-draw edge cases
        }
      }
    }

    // B. RGB Chromatic Displacement Shifting (scaled by fadeFactor)
    const rgbOffset = Math.round(10 * glitchPower * (width / 1280) * fadeFactor);
    if (rgbOffset > 1) {
      try {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.35 * intensity;

        // Red channel shift
        ctx.fillStyle = `rgba(255, 0, 60, ${0.4 * fadeFactor})`;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(ctx.canvas, 0, 0, cvsW, cvsH, rgbOffset, 0, width, height);

        // Cyan channel shift
        ctx.fillStyle = `rgba(0, 240, 255, ${0.35 * fadeFactor})`;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(ctx.canvas, 0, 0, cvsW, cvsH, -rgbOffset, 0, width, height);
        ctx.restore();
      } catch {
        // ignore
      }
    }

    // C. Horizontal Glitch Scanline Bar (scaled by intensity)
    const scanBarY = (currentTime * 320) % height;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * intensity})`;
    ctx.fillRect(0, scanBarY, width, 5 * glitchPower);

    ctx.restore();
  }

  /**
   * 📼 EFEK KAMERA JADUL (Vintage 8mm Film, Sepia Tone, Gate Weave & Projector Flicker)
   */
  private drawVintageCameraEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    currentTime: number,
    fadeFactor: number = 1.0
  ): void {
    if (intensity <= 0.005) return;
    ctx.save();
    // Projector runs at ~16-18 fps
    const filmFrame = Math.floor(currentTime * 18);
    const frameNoise = Math.sin(filmFrame * 453.13);

    // A. Warm Sepia / Vintage Amber Color Tone (fades smoothly in and out)
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = `rgba(215, 160, 90, ${0.22 * fadeFactor})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = `rgba(180, 130, 60, ${0.14 * intensity})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    // B. Projector Brightness Flicker (fades smoothly in and out)
    const flicker = (Math.sin(filmFrame * 7.7) * 0.5 + Math.cos(filmFrame * 13.3) * 0.5) * 0.09 * intensity;
    if (flicker > 0) {
      ctx.fillStyle = `rgba(255, 245, 210, ${flicker})`;
      ctx.fillRect(0, 0, width, height);
    } else if (flicker < 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${-flicker * 1.3})`;
      ctx.fillRect(0, 0, width, height);
    }

    // C. Film Gate Flutter & Edge Jitter (kamera sedikit bergetar vertikal & horizontal khas proyektor kuno)
    const gateWeaveY = Math.round(frameNoise * 3 * intensity);
    if (Math.abs(gateWeaveY) > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.08 * intensity * fadeFactor})`;
      ctx.fillRect(0, 0, width, Math.abs(gateWeaveY) * 2);
      ctx.fillRect(0, height - Math.abs(gateWeaveY) * 2, width, Math.abs(gateWeaveY) * 2);
    }

    // D. Vintage Deep Curved Vignette (fades smoothly in and out)
    const radius = Math.max(width, height) * 0.72;
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      radius * 0.42,
      width / 2,
      height / 2,
      radius
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.65, `rgba(20, 12, 5, ${0.35 * intensity})`);
    vignette.addColorStop(1, `rgba(8, 4, 1, ${0.85 * intensity})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // E. 8mm Film Grain (mereda mulus ke 0)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.07 * intensity})`;
    const grainSeed = Math.sin(filmFrame * 719.1);
    const grainCount = Math.floor(45 * fadeFactor);
    for (let i = 0; i < grainCount; i++) {
      const gx = Math.abs((Math.sin(i * 17.3 + grainSeed) * 43758.54) % 1) * width;
      const gy = Math.abs((Math.cos(i * 23.7 + grainSeed) * 23145.12) % 1) * height;
      ctx.fillRect(gx, gy, 2, 2);
    }

    ctx.restore();
  }

  /**
   * 🐛 EFEK CACING-CACING (Old Film Worms, Squiggly Hairs & Celluloid Scratches)
   */
  private drawFilmWormsEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    currentTime: number
  ): void {
    if (intensity <= 0.005) return;
    ctx.save();
    // Step jumps every 2-3 frames like real film reel dust
    const wormStep = Math.floor(currentTime * 12);
    const rand = (n: number) => {
      const v = Math.sin(wormStep * 133.7 + n * 79.19) * 43758.5453;
      return Math.abs(v - Math.floor(v));
    };

    // A. Animated Squiggly Film Worms (serat rambut/debu proyektor meliuk-liuk)
    const numWorms = Math.floor(3 + intensity * 6); // 3 sampai 9 cacing
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let w = 0; w < numWorms; w++) {
      const startX = rand(w * 7.1) * width;
      const startY = rand(w * 13.3) * height;
      const wormLength = (35 + rand(w * 19.7) * 85) * (width / 1280);
      const wormAngle = rand(w * 23.1) * Math.PI * 2;
      
      // Dynamic wiggle animation
      const wigglePhase = (currentTime * 18 + w * 4.2);
      const wig1 = Math.sin(wigglePhase) * 14 * (width / 1280);
      const wig2 = Math.cos(wigglePhase * 1.4) * 16 * (width / 1280);

      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const cp1x = startX + Math.cos(wormAngle) * (wormLength * 0.35) + wig1;
      const cp1y = startY + Math.sin(wormAngle) * (wormLength * 0.35) + wig2;
      const cp2x = startX + Math.cos(wormAngle) * (wormLength * 0.7) - wig2;
      const cp2y = startY + Math.sin(wormAngle) * (wormLength * 0.7) + wig1;
      const endX = startX + Math.cos(wormAngle) * wormLength;
      const endY = startY + Math.sin(wormAngle) * wormLength;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);

      const wormThickness = (1.3 + rand(w * 31.3) * 2.4) * (width / 1280);
      ctx.lineWidth = wormThickness;

      const isWhiteHair = rand(w * 37.7) > 0.72;
      ctx.strokeStyle = isWhiteHair
        ? `rgba(245, 245, 235, ${0.55 * intensity})`
        : `rgba(18, 14, 10, ${0.8 * intensity})`;
      ctx.stroke();

      // Occasional curly tail loop
      if (rand(w * 43.1) > 0.4) {
        ctx.beginPath();
        ctx.arc(endX, endY, (5 + rand(w * 47) * 5) * (width / 1280), 0, Math.PI * 1.7);
        ctx.lineWidth = wormThickness * 0.75;
        ctx.stroke();
      }
    }

    // B. Film Scratches (Goresan vertikal film proyektor)
    const numScratches = Math.floor(2 + intensity * 4);
    for (let s = 0; s < numScratches; s++) {
      if (rand(s * 53.1) > 0.35) { // 65% chance aktif
        const sx = rand(s * 61.3) * width;
        const isBright = rand(s * 71.9) > 0.45;
        ctx.strokeStyle = isBright
          ? `rgba(255, 255, 255, ${0.5 * intensity})`
          : `rgba(10, 8, 6, ${0.65 * intensity})`;
        ctx.lineWidth = rand(s * 79.1) > 0.8 ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(sx + (rand(s * 83.3) - 0.5) * 5, 0);
        ctx.lineTo(sx + (rand(s * 89.7) - 0.5) * 8, height);
        ctx.stroke();
      }
    }

    // C. Film Dust Specks & Lint Blobs (Bintik debu film)
    const numDust = Math.floor(12 + intensity * 28);
    for (let d = 0; d < numDust; d++) {
      const dx = rand(d * 97.1) * width;
      const dy = rand(d * 101.3) * height;
      const dSize = (1.5 + rand(d * 103.7) * 3.5) * (width / 1280);
      const isDark = rand(d * 107.1) > 0.28;
      ctx.fillStyle = isDark
        ? `rgba(15, 12, 10, ${0.75 * intensity})`
        : `rgba(250, 245, 235, ${0.65 * intensity})`;
      ctx.beginPath();
      ctx.arc(dx, dy, dSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
