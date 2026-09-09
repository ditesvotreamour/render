import React from 'react';
import {
  Activity,
  Sliders,
  Sparkles,
  Layers,
  CircleDot,
  Radio,
  BarChart2,
  Hexagon,
  Eye,
  Disc,
  Orbit,
  Waves,
  Grid3X3,
  Power,
  Zap,
  ArrowDownUp,
  Flame,
  Box,
  Infinity,
  Sun,
} from 'lucide-react';
import type { VisualizerConfig, VisualizerStyle, ColorMode } from '../../types/visualizer';

interface VisualizerTabProps {
  config: VisualizerConfig;
  onChange: (newConfig: VisualizerConfig) => void;
}

const VISUALIZER_STYLES: { id: VisualizerStyle; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'radial_bars', label: 'Radial Bars', icon: <CircleDot className="w-4 h-4" />, desc: 'Classic Specterr / NCS circular equalizer' },
  { id: 'trap_nation_pulse', label: 'Trap Nation', icon: <Flame className="w-4 h-4" />, desc: 'Bass shockwave rings & high-energy aura pulse' },
  { id: 'cyber_tunnel_3d', label: '3D Cyber Tunnel', icon: <Box className="w-4 h-4" />, desc: 'Perspective 3D wireframe polygon depth tunnel' },
  { id: 'neon_infinity_ribbon', label: 'Neon Infinity', icon: <Infinity className="w-4 h-4" />, desc: 'Dual intertwined DNA helix ribbon with laser rungs' },
  { id: 'audio_aura_sphere', label: 'Supernova Aura', icon: <Sun className="w-4 h-4" />, desc: 'Turbulent cosmic plasma corona with solar flares' },
  { id: 'radial_wave', label: 'Radial Wave', icon: <Radio className="w-4 h-4" />, desc: 'Smooth organic glowing fluid ring' },
  { id: 'double_orbit', label: 'Double Orbit', icon: <Orbit className="w-4 h-4" />, desc: 'Dual rotating planetary frequency rings' },
  { id: 'floating_dots', label: 'Stardust Burst', icon: <Sparkles className="w-4 h-4" />, desc: 'Explosive radial constellation of dots' },
  { id: 'liquid_ribbon', label: 'Liquid Ribbon', icon: <Waves className="w-4 h-4" />, desc: 'Silky chromatic undulating fluid waves' },
  { id: 'cyber_matrix', label: 'Cyber Matrix', icon: <Grid3X3 className="w-4 h-4" />, desc: 'Segmented LED equalizer blocks with peak hold' },
  { id: 'hexagon_pulse', label: 'Hexagon Pulse', icon: <Hexagon className="w-4 h-4" />, desc: 'Cyberpunk tech shield spectrum' },
  { id: 'linear_bars', label: 'Linear Spectrum', icon: <BarChart2 className="w-4 h-4" />, desc: 'Mirrored DJ horizontal frequency bars' },
  { id: 'monstercat_bars', label: 'Monstercat EQ', icon: <Activity className="w-4 h-4" />, desc: 'Vertical spectrum with falling peak dots' },
  { id: 'oscilloscope', label: 'Oscilloscope', icon: <Sliders className="w-4 h-4" />, desc: 'High-energy laser sine waveform ribbon' },
  { id: 'particle_tunnel', label: 'Warp Tunnel', icon: <Eye className="w-4 h-4" />, desc: '3D hyperspace audio-reactive vortex' },
  { id: 'minimal_halo', label: 'Minimal Halo', icon: <Disc className="w-4 h-4" />, desc: 'Ultra-clean luxury pulsing audio ring' },
];

export const VisualizerTab: React.FC<VisualizerTabProps> = ({ config, onChange }) => {
  const update = (partial: Partial<VisualizerConfig>) => {
    onChange({ ...config, ...partial });
  };

  const isEnabled = config.enabled !== false;

  return (
    <div className="space-y-6">
      {/* 0. Master Spectrum Disable / Enable Toggle */}
      <div className={`p-3.5 rounded-2xl border transition-all ${
        isEnabled
          ? 'bg-gradient-to-r from-cyan-950/20 to-indigo-950/20 border-cyan-500/30 shadow-md'
          : 'bg-black/40 border-white/10 opacity-80'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isEnabled
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-slate-500 border border-white/10'
              }`}
            >
              <Power className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Spectrum Equalizer</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    isEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {isEnabled ? 'Aktif' : 'Disabled'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {isEnabled ? 'Visualizer bereaksi terhadap frekuensi musik' : 'Spectrum disembunyikan (Background & Logo tetap tampil)'}
              </p>
            </div>
          </div>

          <button
            onClick={() => update({ enabled: !isEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ml-2 ${
              isEnabled ? 'bg-cyan-500 shadow-md shadow-cyan-500/30' : 'bg-slate-700'
            }`}
            title={isEnabled ? 'Klik untuk nonaktifkan spectrum' : 'Klik untuk aktifkan spectrum'}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* When disabled banner */}
      {!isEnabled && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span>Spectrum dimatikan. Hanya Background, Logo, Partikel, dan Lirik yang akan dirender.</span>
          <button
            onClick={() => update({ enabled: true })}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[10px] shrink-0 hover:bg-amber-400 transition-colors"
          >
            Nyalakan
          </button>
        </div>
      )}

      {/* 1. Visualizer Style Selection */}
      <div className={isEnabled ? '' : 'opacity-50 pointer-events-none'}>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Spectrum Style ({VISUALIZER_STYLES.length} Pilihan)</span>
        </label>

        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
          {VISUALIZER_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => update({ style: style.id })}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all group ${
                config.style === style.id
                  ? 'bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`p-1 rounded-lg ${
                    config.style === style.id ? 'bg-cyan-500 text-black' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {style.icon}
                </div>
                <span className={`text-xs font-bold ${config.style === style.id ? 'text-white' : 'text-slate-200'}`}>
                  {style.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Color Mode & Palette */}
      <div className={`space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 ${isEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-pink-400" />
          <span>Color & Neon Glow</span>
        </label>

        {/* Color Mode Buttons */}
        <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
          {(['neon_dual', 'gradient_linear', 'solid', 'rainbow'] as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ colorMode: mode })}
              className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all capitalize ${
                config.colorMode === mode
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {mode.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Color Pickers */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div>
            <span className="block text-[10px] font-medium text-slate-400 mb-1">Primary</span>
            <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                {config.primaryColor}
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[10px] font-medium text-slate-400 mb-1">Secondary</span>
            <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
              <input
                type="color"
                value={config.secondaryColor}
                onChange={(e) => update({ secondaryColor: e.target.value })}
                className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                {config.secondaryColor}
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[10px] font-medium text-slate-400 mb-1">Accent</span>
            <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
              <input
                type="color"
                value={config.accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                {config.accentColor}
              </span>
            </div>
          </div>
        </div>

        {/* Glow Bloom Slider */}
        <div className="pt-2">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Neon Glow Bloom</span>
            <span className="font-mono text-cyan-400 text-[11px]">{config.glow}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            value={config.glow}
            onChange={(e) => update({ glow: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* 3. Geometry & Sizing Sliders */}
      <div className={`space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 ${isEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Geometry & Dynamics</span>
        </label>

        {/* Bar Count */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Bar Count</span>
            <span className="font-mono text-cyan-400 text-[11px]">{config.barCount} bars</span>
          </div>
          <input
            type="range"
            min="24"
            max="192"
            step="8"
            value={config.barCount}
            onChange={(e) => update({ barCount: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Inner Radius */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Inner Radius</span>
            <span className="font-mono text-cyan-400 text-[11px]">{config.innerRadius}px</span>
          </div>
          <input
            type="range"
            min="60"
            max="220"
            step="5"
            value={config.innerRadius}
            onChange={(e) => update({ innerRadius: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Max Bar Height */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Max Height / Amplitude</span>
            <span className="font-mono text-cyan-400 text-[11px]">{config.maxBarHeight}px</span>
          </div>
          <input
            type="range"
            min="30"
            max="220"
            step="5"
            value={config.maxBarHeight}
            onChange={(e) => update({ maxBarHeight: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Bar Width */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Bar Thickness</span>
            <span className="font-mono text-cyan-400 text-[11px]">{config.barWidth}px</span>
          </div>
          <input
            type="range"
            min="1"
            max="12"
            step="0.5"
            value={config.barWidth}
            onChange={(e) => update({ barWidth: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Bass Boost */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Bass Kick Multiplier</span>
            <span className="font-mono text-cyan-400 text-[11px]">{config.bassBoost.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={config.bassBoost}
            onChange={(e) => update({ bassBoost: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* 4. Spectrum Effects Toggles */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Spectrum Visual FX
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => update({ pulseWithBass: !config.pulseWithBass })}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                config.pulseWithBass
                  ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-pink-400" />
                <span>Bass Scale Pulse</span>
              </span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.pulseWithBass ? '#EC4899' : '#475569' }} />
            </button>

            <button
              onClick={() => update({ peakDots: !config.peakDots })}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                config.peakDots
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Floating Peak Dots</span>
              </span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.peakDots ? '#F59E0B' : '#475569' }} />
            </button>

            <button
              onClick={() => update({ mirror: !config.mirror })}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                config.mirror
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Mirror Symmetry</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.mirror ? '#00F0FF' : '#475569' }} />
            </button>

            <button
              onClick={() => update({ roundCaps: !config.roundCaps })}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                config.roundCaps
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Rounded Caps</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.roundCaps ? '#00F0FF' : '#475569' }} />
            </button>

            <button
              onClick={() => update({ invertDirection: !config.invertDirection })}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all col-span-2 ${
                config.invertDirection
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ArrowDownUp className="w-3.5 h-3.5 text-purple-400" />
                <span>Invert Direction ({config.invertDirection ? 'Inward / Ke Dalam' : 'Outward / Ke Luar'})</span>
              </span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.invertDirection ? '#A855F7' : '#475569' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
