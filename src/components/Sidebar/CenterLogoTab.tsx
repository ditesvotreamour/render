import React, { useRef } from 'react';
import {
  Shield,
  Upload,
  Circle,
  Square,
  Hexagon,
  Star,
  Sparkles,
  RotateCw,
  Zap,
} from 'lucide-react';
import type { CenterLogoConfig, LogoShape } from '../../types/visualizer';

interface CenterLogoTabProps {
  config: CenterLogoConfig;
  onChange: (newConfig: CenterLogoConfig) => void;
}

const SHAPES: { id: LogoShape; label: string; icon: React.ReactNode }[] = [
  { id: 'circle', label: 'Circle', icon: <Circle className="w-4 h-4" /> },
  { id: 'rounded_rect', label: 'Square', icon: <Square className="w-4 h-4" /> },
  { id: 'hexagon', label: 'Hexagon', icon: <Hexagon className="w-4 h-4" /> },
  { id: 'shield', label: 'Shield', icon: <Shield className="w-4 h-4" /> },
  { id: 'star', label: 'Star', icon: <Star className="w-4 h-4" /> },
];

const SAMPLE_LOGOS = [
  { name: 'Cyber Neon', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80' },
  { name: 'Anime Synth', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80' },
  { name: 'Dark Techno', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80' },
  { name: 'Retro Sunset', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80' },
  { name: 'Chill Lo-Fi', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80' },
  { name: 'Gold Luxury', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80' },
];

export const CenterLogoTab: React.FC<CenterLogoTabProps> = ({ config, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<CenterLogoConfig>) => {
    onChange({ ...config, ...partial });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      update({ imageUrl: url, enabled: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable Center Logo Toggle */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Enable Center Artwork</h4>
          <p className="text-[11px] text-slate-400">Display pulsating cover art or logo in the center</p>
        </div>
        <button
          onClick={() => update({ enabled: !config.enabled })}
          className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
            config.enabled ? 'bg-cyan-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Image Artwork & Upload */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Artwork / Logo Image</span>
            </label>

            {/* Current Preview & Upload Button */}
            <div className="flex items-center gap-3">
              <img
                src={config.imageUrl || SAMPLE_LOGOS[0].url}
                alt="Current Logo"
                className="w-16 h-16 rounded-xl object-cover border border-white/15 shadow-md shrink-0"
              />

              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Custom Image</span>
                </button>
                <p className="text-[10px] text-slate-400 mt-1 text-center">PNG, JPG, WebP supported</p>
              </div>
            </div>

            {/* Quick Sample Artworks */}
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 mb-1.5">Preset Artworks:</span>
              <div className="grid grid-cols-6 gap-1.5">
                {SAMPLE_LOGOS.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => update({ imageUrl: sample.url })}
                    className={`aspect-square rounded-lg overflow-hidden border transition-all ${
                      config.imageUrl === sample.url
                        ? 'border-cyan-400 scale-105 shadow-md shadow-cyan-500/25'
                        : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                    }`}
                    title={sample.name}
                  >
                    <img src={sample.url} alt={sample.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mask Shape Selection */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Artwork Shape Mask
            </label>

            <div className="grid grid-cols-5 gap-1.5">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => update({ shape: s.id })}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-semibold transition-all ${
                    config.shape === s.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.icon}
                  <span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bass Bounce & Size Sliders */}
          <div className="space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span>Bass Response & Size</span>
            </label>

            {/* Size */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Artwork Size</span>
                <span className="font-mono text-cyan-400 text-[11px]">{config.size}px</span>
              </div>
              <input
                type="range"
                min="80"
                max="260"
                step="5"
                value={config.size}
                onChange={(e) => update({ size: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Bass Bounce Intensity */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Bass Pulse / Bounce</span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  {Math.round(config.bounceIntensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.05"
                value={config.bounceIntensity}
                onChange={(e) => update({ bounceIntensity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Rotation Speed */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotation Speed</span>
                </span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  {config.rotationSpeed === 0 ? 'Static' : `${config.rotationSpeed.toFixed(1)}x`}
                </span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={config.rotationSpeed}
                onChange={(e) => update({ rotationSpeed: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Border & Glow Styling */}
          <div className="space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Border Ring & Glow
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Border Color</span>
                <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <input
                    type="color"
                    value={config.borderColor}
                    onChange={(e) => update({ borderColor: e.target.value })}
                    className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                    {config.borderColor}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Border Width</span>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono text-cyan-400 text-[11px]">{config.borderWidth}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={config.borderWidth}
                  onChange={(e) => update({ borderWidth: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Border Neon Glow</span>
                <span className="font-mono text-cyan-400 text-[11px]">{config.borderGlow}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={config.borderGlow}
                onChange={(e) => update({ borderGlow: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
