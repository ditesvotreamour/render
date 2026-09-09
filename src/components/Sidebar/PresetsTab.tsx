import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight } from 'lucide-react';
import type { SpecterrPreset } from '../../types/visualizer';
import { SPECTERR_PRESETS } from '../../data/presets';

interface PresetsTabProps {
  currentPresetId: string;
  onSelectPreset: (preset: SpecterrPreset) => void;
}

export const PresetsTab: React.FC<PresetsTabProps> = ({ currentPresetId, onSelectPreset }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = [
    'All',
    'Social & Creator',
    'Electronic & EDM',
    'Trap & Bass',
    'Synthwave & Cyber',
    'Lo-Fi & Chill',
    'Minimalist & Studio',
  ];

  const filteredPresets =
    selectedCategory === 'All'
      ? SPECTERR_PRESETS
      : SPECTERR_PRESETS.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-4 pb-12">
      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Presets Cards */}
      <div className="grid grid-cols-1 gap-3">
        {filteredPresets.map((preset) => {
          const isSelected = currentPresetId === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`p-3 rounded-2xl border cursor-pointer transition-all relative overflow-hidden group ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-pink-500/20 border-cyan-400/80 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400/50'
                  : 'bg-white/[0.04] border-white/10 hover:border-cyan-400/40 hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/15 bg-black/40">
                  <img
                    src={preset.thumbnail}
                    alt={preset.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-cyan-500/40 backdrop-blur-[1px] flex items-center justify-center">
                      <Check className="w-6 h-6 text-white stroke-[3]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                      {preset.name}
                    </h4>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                      {preset.visualizer.style.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                    {preset.description}
                  </p>
                </div>
              </div>

              {/* Action Ribbon */}
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                <span className="font-mono text-indigo-400">{preset.category}</span>
                <span className={`font-bold flex items-center gap-1 transition-colors ${
                  isSelected ? 'text-cyan-300' : 'text-cyan-400 group-hover:text-cyan-200'
                }`}>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{isSelected ? 'Active' : 'Apply Preset'}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
