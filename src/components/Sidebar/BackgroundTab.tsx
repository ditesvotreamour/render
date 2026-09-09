import React, { useRef, useState, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  Camera,
  Image,
  Flame,
  Star,
  Zap,
} from 'lucide-react';
import type { BackgroundConfig, ParticlesConfig, BackgroundType, ParticleType, LyricSegment, SlideItem } from '../../types/visualizer';
import { AiLyricImageModal } from '../AiLyricImageModal';

interface BackgroundTabProps {
  bgConfig: BackgroundConfig;
  particlesConfig: ParticlesConfig;
  onBgChange: (newConfig: BackgroundConfig) => void;
  onParticlesChange: (newConfig: ParticlesConfig) => void;
  lyrics?: LyricSegment[];
  duration?: number;
}

const BG_PRESETS: { id: BackgroundType; label: string; desc: string }[] = [
  { id: 'preset_nebula', label: 'Cosmic Nebula', desc: 'Deep galactic space with swirling gradient clouds' },
  { id: 'preset_grid', label: 'Cyberpunk Grid', desc: '3D perspective wireframe horizon with moving gridlines' },
  { id: 'preset_synthwave', label: '80s Synthwave Sun', desc: 'Retro-futuristic neon striped sun with purple horizon' },
  { id: 'preset_cyber_tunnel', label: 'Matrix Tunnel', desc: 'Expanding concentric green wireframe rings' },
  { id: 'preset_aurora', label: 'Aurora Shockwave', desc: 'Fiery crimson & amber audio-reactive glow curtains' },
  { id: 'preset_dark_studio', label: 'Dark Studio', desc: 'Luxury dark vignette with subtle lighting' },
  { id: 'custom_image', label: 'Custom Image', desc: 'Upload your own wallpaper, banner or cover art' },
  { id: 'multi_image', label: 'Slideshow Multi-Background', desc: 'Add multiple images that transition during the music' },
];

const PARTICLE_TYPES: { id: ParticleType; label: string; icon: React.ReactNode }[] = [
  { id: 'sparks', label: 'Sparks', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'embers', label: 'Embers', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'stars', label: 'Stars', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'dust', label: 'Dust Motes', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

export const BackgroundTab: React.FC<BackgroundTabProps> = ({
  bgConfig,
  particlesConfig,
  onBgChange,
  onParticlesChange,
  lyrics = [],
  duration = 180,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [storedImages, setStoredImages] = useState<Array<{ url: string; name: string }>>([]);

  const updateBg = (partial: Partial<BackgroundConfig>) => {
    onBgChange({ ...bgConfig, ...partial });
  };

  const updateParticles = (partial: Partial<ParticlesConfig>) => {
    onParticlesChange({ ...particlesConfig, ...partial });
  };

  const handleCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      updateBg({ customImageUrl: url, type: 'custom_image' });
    }
  };

  const handleMultiImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems = Array.from(e.target.files).map((file) => ({
        url: URL.createObjectURL(file),
        name: file.name
      }));
      setStoredImages((prev) => [...prev, ...newItems]);
      const newUrls = newItems.map((i) => i.url);
      const currentUrls = bgConfig.multiImageUrls || [];
      updateBg({ multiImageUrls: [...currentUrls, ...newUrls], type: 'multi_image' });
    }
  };

  const availableImagesForModal = useMemo(() => {
    if (bgConfig.multiImageSlides && bgConfig.multiImageSlides.length > 0) {
      return bgConfig.multiImageSlides.map((s) => ({ url: s.url, name: s.name || 'Foto' }));
    }
    if (bgConfig.multiImageUrls && bgConfig.multiImageUrls.length > 0) {
      return bgConfig.multiImageUrls.map((url, idx) => {
        const found = storedImages.find((item) => item.url === url);
        return { url, name: found?.name || `Foto_${idx + 1}.jpg` };
      });
    }
    return [];
  }, [bgConfig.multiImageSlides, bgConfig.multiImageUrls, storedImages]);

  const handleApplyAiSlides = (slides: SlideItem[]) => {
    updateBg({
      type: 'multi_image',
      multiImageUrls: slides.map((s) => s.url),
      multiImageSlides: slides
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Background Theme Selection */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5 text-cyan-400" />
          <span>Background Theme</span>
        </label>

        <div className="grid grid-cols-1 gap-2">
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateBg({ type: preset.id })}
              className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                bgConfig.type === preset.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-500/50 shadow-md'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div>
                <span className={`text-xs font-bold ${bgConfig.type === preset.id ? 'text-white' : 'text-slate-200'}`}>
                  {preset.label}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</p>
              </div>
              <div
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  bgConfig.type === preset.id ? 'border-cyan-400 bg-cyan-400/20' : 'border-slate-600'
                }`}
              >
                {bgConfig.type === preset.id && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Image Upload if selected */}
        {bgConfig.type === 'custom_image' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-cyan-500/30 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomImage}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Wallpaper / Photo</span>
            </button>
            {bgConfig.customImageUrl && (
              <p className="text-[10px] text-emerald-400 text-center">✓ Custom image loaded</p>
            )}
          </div>
        )}

        {/* Multi-Image Upload if selected */}
        {bgConfig.type === 'multi_image' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-indigo-500/30 space-y-3">
            <input
              ref={multiFileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleMultiImages}
            />
            <button
              onClick={() => multiFileInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-semibold text-indigo-300 flex items-center justify-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Add Images (Multiple allowed)</span>
            </button>
            
            <div className="flex flex-wrap gap-2">
              {(bgConfig.multiImageUrls || []).map((url, i) => (
                <div key={i} className="relative group w-12 h-12 rounded-md overflow-hidden border border-white/20">
                  <img src={url} alt={`bg-${i}`} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => {
                      const newUrls = [...(bgConfig.multiImageUrls || [])];
                      newUrls.splice(i, 1);
                      updateBg({ multiImageUrls: newUrls });
                    }}
                    className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>

            {/* AI Lyric Match Card */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>AI Pencocokan Lirik</span>
                </span>
                {bgConfig.multiImageSlides && bgConfig.multiImageSlides.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40">
                    {bgConfig.multiImageSlides.length} Slide Aktif
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                AI mencocokkan nama file gambar ke timestamp lirik lagu agar gambar berganti tepat waktu.
              </p>
              <button
                onClick={() => setShowAiModal(true)}
                disabled={(bgConfig.multiImageUrls || []).length === 0}
                className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>✨ Cocokkan Foto ke Lirik (AI)</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Ganti Tiap (Interval)</span>
                  <span className="text-indigo-400">{bgConfig.multiImageInterval || 5} detik</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={bgConfig.multiImageInterval || 5}
                  onChange={(e) => updateBg({ multiImageInterval: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateBg({ multiImageTransition: 'fade' })}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    (!bgConfig.multiImageTransition || bgConfig.multiImageTransition === 'fade')
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  Smooth Fade
                </button>
                <button
                  onClick={() => updateBg({ multiImageTransition: 'cut' })}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    bgConfig.multiImageTransition === 'cut'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  Hard Cut
                </button>
              </div>
              <button
                onClick={() => updateBg({ multiImageKenBurns: bgConfig.multiImageKenBurns === false ? true : false })}
                className={`w-full py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  bgConfig.multiImageKenBurns !== false
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>Cinematic Ken Burns Effect</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Audio-Reactive Camera Shake & Bass Zoom */}
      <div className="space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-pink-400" />
          <span>Bass Reactive FX</span>
        </label>

        {/* Camera Shake */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Camera Bass Shake</span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {Math.round(bgConfig.bassShake * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={bgConfig.bassShake}
            onChange={(e) => updateBg({ bassShake: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Bass Zoom */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Reactive Bass Zoom</span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {Math.round(bgConfig.bassZoom * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={bgConfig.bassZoom}
            onChange={(e) => updateBg({ bassZoom: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Dimming & Vignette */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Dimming</span>
              <span className="font-mono text-cyan-400 text-[11px]">
                {Math.round(bgConfig.dimOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={bgConfig.dimOpacity}
              onChange={(e) => updateBg({ dimOpacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Vignette</span>
              <span className="font-mono text-cyan-400 text-[11px]">
                {Math.round(bgConfig.vignette * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.05"
              value={bgConfig.vignette}
              onChange={(e) => updateBg({ vignette: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* 3. Floating Particles & Fireworks Engine */}
      <div className="space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Particle FX & Sparks</span>
          </label>
          <button
            onClick={() => updateParticles({ enabled: !particlesConfig.enabled })}
            className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
              particlesConfig.enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                particlesConfig.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {particlesConfig.enabled && (
          <>
            {/* Particle Types */}
            <div className="grid grid-cols-4 gap-1.5">
              {PARTICLE_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => updateParticles({ type: pt.id })}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
                    particlesConfig.type === pt.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pt.icon}
                  <span>{pt.label}</span>
                </button>
              ))}
            </div>

            {/* Particle Count */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Particle Density</span>
                <span className="font-mono text-cyan-400 text-[11px]">{particlesConfig.count}</span>
              </div>
              <input
                type="range"
                min="20"
                max="180"
                step="5"
                value={particlesConfig.count}
                onChange={(e) => updateParticles({ count: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Particle Color & Reactive Explosions */}
            <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-white/10">
              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Color</span>
                <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <input
                    type="color"
                    value={particlesConfig.color}
                    onChange={(e) => updateParticles({ color: e.target.value })}
                    className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                    {particlesConfig.color}
                  </span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => updateParticles({ reactToBass: !particlesConfig.reactToBass })}
                  className={`w-full p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                    particlesConfig.reactToBass
                      ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Beat Explosions</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI Lyric Image Matcher Modal */}
      <AiLyricImageModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        images={availableImagesForModal}
        lyrics={lyrics}
        duration={duration}
        onApplySlides={handleApplyAiSlides}
      />
    </div>
  );
};
