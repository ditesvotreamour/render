import React, { useState } from 'react';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';
import type { SpecterrPreset } from '../types/visualizer';
import { SPECTERR_PRESETS } from '../data/presets';

interface PresetGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPresetId: string;
  onSelectPreset: (preset: SpecterrPreset) => void;
}

export const PresetGalleryModal: React.FC<PresetGalleryModalProps> = ({
  isOpen,
  onClose,
  currentPresetId,
  onSelectPreset,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = [
    'All',
    'Electronic & EDM',
    'Trap & Bass',
    'Synthwave & Cyber',
    'Lo-Fi & Chill',
    'Minimalist & Studio',
  ];

  const filtered =
    activeCategory === 'All'
      ? SPECTERR_PRESETS
      : SPECTERR_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-white/20 rounded-3xl w-full max-w-4xl h-[90dvh] max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                Specterr Visualizer Presets
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Pilih template visualizer untuk YouTube, TikTok & Reels
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-white/10 bg-black/40 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20 scale-105'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto overscroll-contain grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-16 scrollbar-thin">
          {filtered.map((preset) => {
            const isSelected = currentPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
                className={`group rounded-2xl border p-3.5 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border-cyan-400 shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400'
                    : 'bg-white/[0.04] border-white/10 hover:border-cyan-400/50 hover:bg-white/[0.08]'
                }`}
              >
                <div>
                  {/* Thumbnail Image */}
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-3 border border-white/15 bg-black/50">
                    <img
                      src={preset.thumbnail}
                      alt={preset.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Style Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/20 text-[10px] font-mono text-cyan-300 font-bold">
                      {preset.visualizer.style.replace('_', ' ')}
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-cyan-400 text-black text-[10px] font-extrabold flex items-center gap-1 shadow-lg shadow-cyan-400/30">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>ACTIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Preset Title & Category */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-white tracking-wide group-hover:text-cyan-300 transition-colors truncate">
                        {preset.name}
                      </h4>
                      <span className="text-[10px] font-mono text-indigo-400 shrink-0">
                        {preset.category}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                {/* Apply Button */}
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-slate-500">
                    {preset.visualizer.barCount} Bars • {preset.visualizer.barWidth}px
                  </span>
                  <div className={`font-bold flex items-center gap-1 transition-all ${
                    isSelected ? 'text-cyan-300' : 'text-cyan-400 group-hover:text-cyan-200'
                  }`}>
                    <span>{isSelected ? 'Selected' : 'Use Preset'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
