import React, { useRef } from 'react';
import {
  Video,
  Tv,
  Box,
  Activity,
  Zap,
  Upload,
  RotateCw,
  Camera,
} from 'lucide-react';
import type { EffectsConfig, VideoBackgroundPreset } from '../../types/visualizer';
import { VIDEO_PRESETS, DEFAULT_EFFECTS_CONFIG } from '../../constants/defaultEffects';

interface EffectsTabProps {
  config: EffectsConfig;
  onChange: (newConfig: EffectsConfig) => void;
}

export const EffectsTab: React.FC<EffectsTabProps> = ({ config, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<EffectsConfig>) => {
    onChange({ ...config, ...partial });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const blobUrl = URL.createObjectURL(file);
      update({
        videoBackground: {
          ...config.videoBackground,
          enabled: true,
          preset: 'custom_video',
          customVideoUrl: blobUrl,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. BACKGROUND VIDEO LOOPER */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Background Video Looper</h4>
              <p className="text-[11px] text-slate-400">Cinematic looping animated backgrounds</p>
            </div>
          </div>
          <button
            onClick={() =>
              update({
                videoBackground: {
                  ...config.videoBackground,
                  enabled: !config.videoBackground.enabled,
                },
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              config.videoBackground.enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                config.videoBackground.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.videoBackground.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Presets Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">Preset Video Sinematik</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_PRESETS.map((p) => {
                  const isSelected = config.videoBackground.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        update({
                          videoBackground: {
                            ...config.videoBackground,
                            preset: p.id as VideoBackgroundPreset,
                          },
                        })
                      }
                      className={`relative overflow-hidden rounded-xl border text-left p-2 transition-all flex flex-col justify-end min-h-[64px] ${
                        isSelected
                          ? 'border-cyan-400 ring-1 ring-cyan-400 shadow-md shadow-cyan-500/20'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                      style={{
                        backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.3)), url(${p.thumbnail})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <span className="text-[11px] font-bold text-white leading-tight">{p.name}</span>
                      <span className="text-[9px] text-slate-300 truncate">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Video Upload */}
            <div className="pt-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleVideoUpload}
                accept="video/mp4,video/webm"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  config.videoBackground.preset === 'custom_video'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom MP4/WebM Video</span>
              </button>
            </div>

            {/* Video Opacity & Reactive Speed Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Opacity</span>
                  <span className="font-mono text-cyan-400">
                    {Math.round(config.videoBackground.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.videoBackground.opacity}
                  onChange={(e) =>
                    update({
                      videoBackground: {
                        ...config.videoBackground,
                        opacity: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="text-[11px] text-slate-300">Bass Speed Boost</span>
                <button
                  onClick={() =>
                    update({
                      videoBackground: {
                        ...config.videoBackground,
                        audioReactiveSpeed: !config.videoBackground.audioReactiveSpeed,
                      },
                    })
                  }
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                    config.videoBackground.audioReactiveSpeed
                      ? 'bg-pink-500/20 border-pink-400 text-pink-300'
                      : 'bg-white/5 border-white/10 text-slate-500'
                  }`}
                >
                  {config.videoBackground.audioReactiveSpeed ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. RGB GLITCH & CHROMATIC ABERRATION */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">RGB Glitch & Aberration</h4>
              <p className="text-[11px] text-slate-400">Multi-channel color split on beat drops</p>
            </div>
          </div>
          <button
            onClick={() =>
              update({
                chromaticAberration: {
                  ...config.chromaticAberration,
                  enabled: !config.chromaticAberration.enabled,
                },
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              config.chromaticAberration.enabled ? 'bg-pink-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                config.chromaticAberration.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.chromaticAberration.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Glitch Intensity</span>
                <span className="font-mono text-pink-400">{config.chromaticAberration.intensity}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="24"
                step="1"
                value={config.chromaticAberration.intensity}
                onChange={(e) =>
                  update({
                    chromaticAberration: {
                      ...config.chromaticAberration,
                      intensity: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-300">Trigger Hanya Saat Beat Drop</span>
              <button
                onClick={() =>
                  update({
                    chromaticAberration: {
                      ...config.chromaticAberration,
                      reactToBeat: !config.chromaticAberration.reactToBeat,
                    },
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  config.chromaticAberration.reactToBeat
                    ? 'bg-pink-500/20 border-pink-400 text-pink-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                {config.chromaticAberration.reactToBeat ? 'AUTO ON BEAT' : 'CONTINUOUS'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. RETRO VHS & CRT SCANLINES */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Retro VHS & CRT Overlay</h4>
              <p className="text-[11px] text-slate-400">90s analog scanlines, grain & OSD tape look</p>
            </div>
          </div>
          <button
            onClick={() =>
              update({
                vhsOverlay: {
                  ...config.vhsOverlay,
                  enabled: !config.vhsOverlay.enabled,
                },
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              config.vhsOverlay.enabled ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                config.vhsOverlay.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.vhsOverlay.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  update({
                    vhsOverlay: {
                      ...config.vhsOverlay,
                      scanlines: !config.vhsOverlay.scanlines,
                    },
                  })
                }
                className={`p-2 rounded-xl border text-center text-[10px] font-bold transition-all ${
                  config.vhsOverlay.scanlines
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                Scanlines
              </button>

              <button
                onClick={() =>
                  update({
                    vhsOverlay: {
                      ...config.vhsOverlay,
                      grain: !config.vhsOverlay.grain,
                    },
                  })
                }
                className={`p-2 rounded-xl border text-center text-[10px] font-bold transition-all ${
                  config.vhsOverlay.grain
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                Film Grain
              </button>

              <button
                onClick={() =>
                  update({
                    vhsOverlay: {
                      ...config.vhsOverlay,
                      timestampOsd: !config.vhsOverlay.timestampOsd,
                    },
                  })
                }
                className={`p-2 rounded-xl border text-center text-[10px] font-bold transition-all ${
                  config.vhsOverlay.timestampOsd
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                VHS OSD
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. 3D PERSPECTIVE & CAMERA TILT */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">3D Perspective & Orbit</h4>
              <p className="text-[11px] text-slate-400">Spatial depth, tilt & floating camera</p>
            </div>
          </div>
          <button
            onClick={() =>
              update({
                camera3D: {
                  ...config.camera3D,
                  enabled: !config.camera3D.enabled,
                },
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              config.camera3D.enabled ? 'bg-indigo-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                config.camera3D.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.camera3D.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Tilt X</span>
                  <span className="font-mono text-indigo-400">{config.camera3D.tiltX}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={config.camera3D.tiltX}
                  onChange={(e) =>
                    update({
                      camera3D: {
                        ...config.camera3D,
                        tiltX: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Tilt Y</span>
                  <span className="font-mono text-indigo-400">{config.camera3D.tiltY}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={config.camera3D.tiltY}
                  onChange={(e) =>
                    update({
                      camera3D: {
                        ...config.camera3D,
                        tiltY: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auto-Orbit Floating Camera</span>
              </span>
              <button
                onClick={() =>
                  update({
                    camera3D: {
                      ...config.camera3D,
                      autoOrbit: !config.camera3D.autoOrbit,
                    },
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  config.camera3D.autoOrbit
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                {config.camera3D.autoOrbit ? 'ORBIT ON' : 'STATIC'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. WAVEFORM AUDIO SCRUBBER */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Mini Waveform Scrubber</h4>
              <p className="text-[11px] text-slate-400">Audio progress waveform bar at bottom</p>
            </div>
          </div>
          <button
            onClick={() =>
              update({
                waveformScrubber: {
                  ...config.waveformScrubber,
                  enabled: !config.waveformScrubber.enabled,
                },
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              config.waveformScrubber.enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                config.waveformScrubber.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.waveformScrubber.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] text-slate-400 mb-1">Highlight Color</span>
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <input
                    type="color"
                    value={config.waveformScrubber.progressColor}
                    onChange={(e) =>
                      update({
                        waveformScrubber: {
                          ...config.waveformScrubber,
                          progressColor: e.target.value,
                        },
                      })
                    }
                    className="w-5 h-5 rounded-md cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300">
                    {config.waveformScrubber.progressColor}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Bar Height</span>
                  <span className="font-mono text-cyan-400">{config.waveformScrubber.height}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="36"
                  step="2"
                  value={config.waveformScrubber.height}
                  onChange={(e) =>
                    update({
                      waveformScrubber: {
                        ...config.waveformScrubber,
                        height: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. CINEMATIC CAMERA & LIGHTING */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cinematic FX</h4>
              <p className="text-[11px] text-slate-400">Global camera movement & lens flares</p>
            </div>
          </div>
          <button
            onClick={() => {
              const camEnabled = !config.cinematicCamera?.enabled;
              update({
                cinematicCamera: { ...(config.cinematicCamera || DEFAULT_EFFECTS_CONFIG.cinematicCamera!), enabled: camEnabled },
                cinematicLighting: { ...(config.cinematicLighting || DEFAULT_EFFECTS_CONFIG.cinematicLighting!), enabled: camEnabled }
              });
            }}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              config.cinematicCamera?.enabled ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                config.cinematicCamera?.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.cinematicCamera?.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div>
              <span className="block text-[11px] text-slate-400 mb-2">Camera Movement</span>
              <div className="grid grid-cols-2 gap-2">
                {(['none', 'slow_zoom', 'pan', 'drift'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => update({ cinematicCamera: { ...config.cinematicCamera!, type } })}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      config.cinematicCamera?.type === type
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {type.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-300">Pulse on Beat Drop</span>
              <button
                onClick={() =>
                  update({
                    cinematicCamera: { ...config.cinematicCamera!, pulseOnBeat: !config.cinematicCamera!.pulseOnBeat },
                  })
                }
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  config.cinematicCamera?.pulseOnBeat
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-500'
                }`}
              >
                {config.cinematicCamera?.pulseOnBeat ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-300">Lens Flares & Light Leaks</span>
              <button
                onClick={() =>
                  update({
                    cinematicLighting: { ...config.cinematicLighting!, lightLeaks: !config.cinematicLighting!.lightLeaks },
                  })
                }
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  config.cinematicLighting?.lightLeaks
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-500'
                }`}
              >
                {config.cinematicLighting?.lightLeaks ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
