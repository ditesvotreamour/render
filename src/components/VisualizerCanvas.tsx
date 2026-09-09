import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Maximize2,
  Minimize2,
  Zap,
  Activity,
  Smartphone,
  SlidersHorizontal,
  Check,
  ChevronDown,
} from 'lucide-react';
import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  EffectsConfig,
  AspectRatio,
  SafeZonePlatform,
  PreviewResolution,
} from '../types/visualizer';
import {
  PREVIEW_RESOLUTIONS,
  getBaseDimensions,
  getPreviewDimensions,
} from '../types/visualizer';
import { CanvasRenderer } from '../utils/canvasRenderer';
import { globalAudioEngine } from '../utils/audioEngine';
import { SafeZoneOverlay } from './SafeZoneOverlay';

interface VisualizerCanvasProps {
  visualizer: VisualizerConfig;
  centerLogo: CenterLogoConfig;
  background: BackgroundConfig;
  particles: ParticlesConfig;
  typography: TypographyConfig;
  subtitle?: SubtitleConfig;
  effects?: EffectsConfig;
  aspectRatio: AspectRatio;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  canvasRefCallback?: (canvas: HTMLCanvasElement | null) => void;
  onTogglePlay?: () => void;
  previewResolution?: PreviewResolution;
  onPreviewResolutionChange?: (res: PreviewResolution) => void;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  visualizer,
  centerLogo,
  background,
  particles,
  typography,
  subtitle,
  effects,
  aspectRatio,
  isPlaying,
  currentTime,
  duration,
  canvasRefCallback,
  onTogglePlay,
  previewResolution,
  onPreviewResolutionChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderer = useMemo(() => new CanvasRenderer(), []);

  const [fps, setFps] = useState<number>(60);
  const [isBeatActive, setIsBeatActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [safeZone, setSafeZone] = useState<SafeZonePlatform>('none');
  const [internalResolution, setInternalResolution] = useState<PreviewResolution>(() => {
    const saved = localStorage.getItem('specterr_preview_resolution');
    if (saved === '1080p' || saved === '720p' || saved === '480p' || saved === '360p') {
      return saved as PreviewResolution;
    }
    const legacy = localStorage.getItem('specterr_preview_quality');
    if (legacy === 'high') return '1080p';
    return '720p';
  });

  const currentResolution = previewResolution || internalResolution;
  const [isResolutionMenuOpen, setIsResolutionMenuOpen] = useState<boolean>(false);

  const handleSelectResolution = (res: PreviewResolution) => {
    setInternalResolution(res);
    onPreviewResolutionChange?.(res);
    localStorage.setItem('specterr_preview_resolution', res);
  };

  const lastBeatRef = useRef<boolean>(false);

  // Maintain fresh props ref so requestAnimationFrame never gets cancelled/restarted on time updates
  const propsRef = useRef({
    visualizer,
    centerLogo,
    background,
    particles,
    typography,
    subtitle,
    effects,
    isPlaying,
    currentTime,
    duration,
  });

  useEffect(() => {
    propsRef.current = {
      visualizer,
      centerLogo,
      background,
      particles,
      typography,
      subtitle,
      effects,
      isPlaying,
      currentTime,
      duration,
    };
  });

  // Compute internal canvas resolution based on aspect ratio & currentResolution
  const { internalWidth, internalHeight, baseWidth, baseHeight, containerClass } = useMemo(() => {
    const { width: internalWidth, height: internalHeight } = getPreviewDimensions(aspectRatio, currentResolution);
    const { baseW: baseWidth, baseH: baseHeight } = getBaseDimensions(aspectRatio);

    let containerClass = 'aspect-video w-full max-w-5xl max-h-[60vh] sm:max-h-[80vh]';
    switch (aspectRatio) {
      case '9:16':
        containerClass = 'aspect-[9/16] w-auto h-full max-h-[68vh] sm:max-h-[82vh] max-w-[90vw] sm:max-w-[46vh]';
        break;
      case '1:1':
        containerClass = 'aspect-square w-auto h-full max-h-[65vh] sm:max-h-[80vh] max-w-[90vw] sm:max-w-[80vh]';
        break;
      case '4:5':
        containerClass = 'aspect-[4/5] w-auto h-full max-h-[66vh] sm:max-h-[82vh] max-w-[90vw] sm:max-w-[65vh]';
        break;
      case '16:9':
      default:
        containerClass = 'aspect-video w-full max-w-5xl max-h-[60vh] sm:max-h-[80vh]';
        break;
    }

    return { internalWidth, internalHeight, baseWidth, baseHeight, containerClass };
  }, [aspectRatio, currentResolution]);

  // Pass canvas ref up for recording
  useEffect(() => {
    if (canvasRefCallback) {
      canvasRefCallback(canvasRef.current);
    }
  }, [canvasRefCallback]);

  // Main Render Animation Loop: runs continuously at native 60fps without React teardown
  useEffect(() => {
    let animId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          const p = propsRef.current;
          const audioData = globalAudioEngine.getAnalysisData();
          const isAudioActive = p.isPlaying || globalAudioEngine.isPlaying;
          const currentAudioTime = globalAudioEngine.currentTime || p.currentTime;
          const currentAudioDuration = globalAudioEngine.duration || p.duration || 180;

          // Only trigger state update when beat boolean actually changes to avoid 60 re-renders/sec
          const isBeat = Boolean(audioData.isBeat && isAudioActive);
          if (lastBeatRef.current !== isBeat) {
            lastBeatRef.current = isBeat;
            setIsBeatActive(isBeat);
          }

          const scaleX = canvas.width / baseWidth;
          const scaleY = canvas.height / baseHeight;

          ctx.save();
          ctx.scale(scaleX, scaleY);

          renderer.render(
            ctx,
            baseWidth,
            baseHeight,
            p.visualizer,
            p.centerLogo,
            p.background,
            p.particles,
            p.typography,
            audioData,
            currentAudioTime,
            currentAudioDuration,
            isAudioActive,
            p.subtitle,
            p.effects
          );

          ctx.restore();
        }
      }

      // FPS Counter calculation (once per second)
      frameCount++;
      const now = performance.now();
      if (now - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTimer)));
        frameCount = 0;
        fpsTimer = now;
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [internalWidth, internalHeight, baseWidth, baseHeight, renderer]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative flex-1 h-full w-full bg-[#05070B] flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-black pointer-events-none" />

      {/* Main Canvas Frame */}
      <div
        ref={containerRef}
        onClick={onTogglePlay}
        className={`relative flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 group transition-all duration-300 cursor-pointer ${containerClass}`}
      >
        <canvas
          ref={canvasRef}
          width={internalWidth}
          height={internalHeight}
          className="w-full h-full object-contain block bg-black"
        />

        {/* Safe Zone Guide Visual Overlay */}
        <SafeZoneOverlay platform={safeZone} aspectRatio={aspectRatio} />

        {/* Top Floating HUD Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          {/* Status Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-mono text-slate-300">
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
              <span>{fps} FPS</span>
            </div>

            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg backdrop-blur-md border text-[10px] sm:text-[11px] font-mono font-bold transition-all ${
                isBeatActive
                  ? 'bg-pink-500/30 border-pink-500/50 text-pink-300 scale-105 shadow-lg shadow-pink-500/20'
                  : 'bg-black/60 border-white/10 text-slate-400'
              }`}
            >
              <Zap className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isBeatActive ? 'text-pink-400 animate-bounce' : 'text-slate-500'}`} />
              <span className="hidden xs:inline">BEAT DROP</span>
            </div>

            <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-mono text-slate-300">
              <span>{aspectRatio}</span>
            </div>

            {/* Performance Mode / Resolution Dropdown Menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsResolutionMenuOpen((prev) => !prev)}
                className={`px-2 py-0.5 sm:py-1 rounded-lg backdrop-blur-md border text-[10px] sm:text-[11px] font-mono font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer ${
                  currentResolution === '360p'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30'
                    : currentResolution === '480p'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 hover:bg-emerald-500/30'
                    : currentResolution === '720p'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 hover:bg-cyan-500/30'
                    : 'bg-indigo-500/20 border-indigo-400 text-indigo-300 hover:bg-indigo-500/30'
                }`}
                title="Menu Resolusi Preview: Turunkan resolusi canvas preview agar pemutaran lancar 60 FPS tanpa lag"
              >
                <SlidersHorizontal className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>{currentResolution}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isResolutionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isResolutionMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsResolutionMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#0C101A]/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-2 z-50 text-left animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 border-b border-white/10 mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Resolusi Preview</span>
                      </div>
                      <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        Anti-Lag
                      </span>
                    </div>

                    <div className="space-y-1">
                      {PREVIEW_RESOLUTIONS.map((opt) => {
                        const isSelected = opt.id === currentResolution;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleSelectResolution(opt.id);
                              setIsResolutionMenuOpen(false);
                            }}
                            className={`w-full px-2 py-1.5 rounded-lg flex items-start gap-2 transition-all text-left ${
                              isSelected
                                ? 'bg-cyan-500/20 border border-cyan-500/50 text-white'
                                : 'hover:bg-white/10 text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold font-mono tracking-tight text-white flex items-center gap-1.5">
                                  {opt.badge}
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-normal ${
                                      opt.id === '360p'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : opt.id === '480p'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : opt.id === '720p'
                                        ? 'bg-cyan-500/20 text-cyan-300'
                                        : 'bg-indigo-500/20 text-indigo-300'
                                    }`}
                                  >
                                    {opt.tag}
                                  </span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 font-semibold">{opt.loadPercent}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 pt-1 border-t border-white/10 px-1 text-[9px] text-slate-400 leading-normal">
                      <span className="text-cyan-400 font-bold">💡 Info:</span> Menurunkan resolusi memperlancar jalannya preview. Hasil <strong className="text-slate-200">Export Final</strong> tetap 1080p / 4K.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Action Controls (Safe Zone Selector + Fullscreen) */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Safe Zone Guide Selector */}
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-0.5 sm:p-1 text-[10px] sm:text-[11px]">
              <Smartphone className="w-3 h-3 text-cyan-400 ml-1 shrink-0" />
              <select
                value={safeZone}
                onChange={(e) => setSafeZone(e.target.value as SafeZonePlatform)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer pr-1"
                title="Safe Zone Guides untuk TikTok, Reels, Shorts, Spotify"
              >
                <option value="none" className="bg-slate-900 text-white">Safe Zone: OFF</option>
                <option value="tiktok" className="bg-slate-900 text-white">📱 TikTok Safe Area</option>
                <option value="reels" className="bg-slate-900 text-white">📸 Reels Safe Area</option>
                <option value="shorts" className="bg-slate-900 text-white">▶ Shorts Safe Area</option>
                <option value="spotify" className="bg-slate-900 text-white">🎵 Spotify Canvas</option>
                <option value="youtube" className="bg-slate-900 text-white">📺 YouTube 16:9 Safe</option>
              </select>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-1 sm:p-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white transition-all shadow-md"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* Live Audio Inactive Notice if not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-black/80 border border-white/15 backdrop-blur-md text-[11px] sm:text-xs font-semibold text-slate-300 flex items-center gap-2 shadow-lg">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
              <span>Tap or press Play to start visualizer</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
