import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wand2,
  Sparkles,
  Zap,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  Trash2,
  Music,
} from 'lucide-react';
import type { LyricSegment, SlideItem, VisualEffectType } from '../types/visualizer';
import { VISUAL_EFFECT_OPTIONS } from '../types/visualizer';
import {
  recommendSlideEffectsHeuristic,
  recommendSlideEffectsWithGroq,
  GROQ_DIRECTOR_MODELS,
  type VisualEffectStylePreset,
  type VisualEffectDensity,
  type SlideEffectPlanItem,
} from '../utils/aiVisualEffectDirector';

interface AiVisualEffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: SlideItem[];
  lyrics: LyricSegment[];
  duration: number;
  onApplyEffects: (updatedSlides: SlideItem[]) => void;
  onClearAllEffects?: () => void;
}

export const AiVisualEffectsModal: React.FC<AiVisualEffectsModalProps> = ({
  isOpen,
  onClose,
  slides,
  lyrics,
  duration,
  onApplyEffects,
  onClearAllEffects,
}) => {
  const [stylePreset, setStylePreset] = useState<VisualEffectStylePreset>('cinematic_smart');
  const [density, setDensity] = useState<VisualEffectDensity>('balanced');
  const [plan, setPlan] = useState<SlideEffectPlanItem[]>([]);
  const [aiMode, setAiMode] = useState<'heuristic' | 'groq'>('heuristic');
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    return localStorage.getItem('groq_api_key') || '';
  });
  const [groqModel, setGroqModel] = useState<string>(() => {
    const saved = localStorage.getItem('groq_director_model');
    if (saved && GROQ_DIRECTOR_MODELS.some((m) => m.id === saved)) {
      return saved;
    }
    return 'llama-3.3-70b-versatile';
  });
  const [isLoadingGroq, setIsLoadingGroq] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Generate initial plan when modal opens or style/density changes
  useEffect(() => {
    if (isOpen && slides.length > 0) {
      setErrorMessage(null);
      const generated = recommendSlideEffectsHeuristic(slides, lyrics, duration, {
        stylePreset,
        density,
      });
      setPlan(generated);
    }
  }, [isOpen, slides, lyrics, duration, stylePreset, density]);

  // Count active effects
  const stats = useMemo(() => {
    let distortion = 0;
    let vintage = 0;
    let worms = 0;
    let vintageWorms = 0;
    let none = 0;

    plan.forEach((p) => {
      if (p.recommendedEffect === 'distortion') distortion++;
      else if (p.recommendedEffect === 'vintage_camera') vintage++;
      else if (p.recommendedEffect === 'film_worms') worms++;
      else if (p.recommendedEffect === 'vintage_worms') vintageWorms++;
      else none++;
    });

    const totalActive = plan.length - none;
    return { distortion, vintage, worms, vintageWorms, none, totalActive, total: plan.length };
  }, [plan]);

  if (!isOpen) return null;

  // Run Groq AI Director
  const handleRunGroq = async () => {
    const key = groqApiKey.trim() || localStorage.getItem('groq_api_key') || '';
    if (!key) {
      setErrorMessage('Groq API Key belum diisi. Masukkan API Key Groq Anda (diawali dengan gsk_).');
      return;
    }
    localStorage.setItem('groq_api_key', key);
    localStorage.setItem('groq_director_model', groqModel);
    setIsLoadingGroq(true);
    setErrorMessage(null);

    try {
      const results = await recommendSlideEffectsWithGroq(key, slides, lyrics, duration, {
        stylePreset,
        density,
        model: groqModel,
      });
      setPlan(results);
      setSuccessNotice('✨ Berhasil menganalisis dan menyusun arahan efek dengan Groq AI!');
      setTimeout(() => setSuccessNotice(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menghubungi Groq AI.');
    } finally {
      setIsLoadingGroq(false);
    }
  };

  // Re-run instant heuristic
  const handleRunHeuristic = () => {
    setErrorMessage(null);
    const results = recommendSlideEffectsHeuristic(slides, lyrics, duration, {
      stylePreset,
      density,
    });
    setPlan(results);
    setSuccessNotice('⚡ Rekomendasi efek instan diperbarui!');
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  // User manually edits effect for a specific slide row
  const handleEffectChangeForRow = (slideIndex: number, newEffect: VisualEffectType) => {
    setPlan((prev) =>
      prev.map((item) => {
        if (item.slideIndex === slideIndex) {
          const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === newEffect);
          return {
            ...item,
            recommendedEffect: newEffect,
            reason: newEffect === 'none'
              ? 'Diatur manual: Frame bersih alami.'
              : `Diatur manual: Efek ${opt?.shortLabel || newEffect}.`,
          };
        }
        return item;
      })
    );
  };

  // Apply plan to slides
  const handleApply = () => {
    const updatedSlides: SlideItem[] = slides.map((slide, idx) => {
      const planItem = plan[idx];
      return {
        ...slide,
        visualEffect: planItem ? planItem.recommendedEffect : 'none',
        visualEffectIntensity: planItem ? planItem.intensity : 0.8,
      };
    });

    onApplyEffects(updatedSlides);
    onClose();
  };

  // Reset all to none
  const handleClearAll = () => {
    setPlan((prev) =>
      prev.map((item) => ({
        ...item,
        recommendedEffect: 'none',
        reason: 'Efek direset ke normal (bersih).',
      }))
    );
    if (onClearAllEffects) {
      onClearAllEffects();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-amber-950/30 via-slate-900 to-fuchsia-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Director: Rekomendasi Efek Kamera</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Smart Auto
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Otomatis memilih dan menyematkan efek (Distorsi, Jadul, Cacing) ke frame pilihan agar video lebih dinamis tanpa membuat pusing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Options Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/40 border border-white/10">
            
            {/* 1. Style Preset */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                1. Gaya Visual Sutradara
              </label>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value as VisualEffectStylePreset)}
                className="w-full bg-slate-800 text-white text-xs rounded-xl px-2.5 py-2 border border-white/10 outline-none cursor-pointer hover:border-amber-500/50"
              >
                <option value="cinematic_smart">⚡ Sinematik Cerdas (Paduan Seimbang)</option>
                <option value="vintage_retro">🎞️ Vintage & Nostalgia (Kamera Jadul)</option>
                <option value="glitch_energy">⚡ Glitch & Beat Hype (Distorsi)</option>
                <option value="grunge_8mm">🪱 8mm Reel Grunge (Cacing & Goresan)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                {stylePreset === 'cinematic_smart' && 'Distorsi di klimaks/beat, Jadul di lirik memori, Cacing di intro/transisi.'}
                {stylePreset === 'vintage_retro' && 'Fokus pada nuansa hangat 8mm, warna sepia retro, dan flicker proyektor.'}
                {stylePreset === 'glitch_energy' && 'Fokus pada hentakan distorsi RGB split untuk beat musik intens.'}
                {stylePreset === 'grunge_8mm' && 'Fokus pada rambut cacing seluloid dan goresan film reel proyektor.'}
              </p>
            </div>

            {/* 2. Density / Frequency */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                2. Frekuensi Efek
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDensity('minimal')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    density === 'minimal'
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500/60'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Minimalis (~18%)
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('balanced')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    density === 'balanced'
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500/60'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Seimbang (~35%)
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('heavy')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    density === 'heavy'
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500/60'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Intensif (~65%)
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Disarankan: <strong>Seimbang</strong> agar ada jeda frame bersih alami di antara efek.
              </p>
            </div>

            {/* 3. AI Mode Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                3. Mesin Analisis
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAiMode('heuristic');
                    handleRunHeuristic();
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    aiMode === 'heuristic'
                      ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Instan (Cerdas)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('groq')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    aiMode === 'groq'
                      ? 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Groq AI (LLM)</span>
                </button>
              </div>

              {aiMode === 'groq' && (
                <div className="mt-2 space-y-2">
                  <input
                    type="password"
                    placeholder="Groq API Key (gsk_...) atau KoboiLLM Key (sk-...)"
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                    className="w-full bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-1.5 border border-white/15 outline-none font-mono focus:border-fuchsia-400"
                  />

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-medium">
                      Pilihan Model Groq / KoboiLLM:
                    </label>
                    <select
                      value={groqModel}
                      onChange={(e) => {
                        setGroqModel(e.target.value);
                        localStorage.setItem('groq_director_model', e.target.value);
                      }}
                      className="w-full bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1.5 border border-white/15 outline-none focus:border-fuchsia-400"
                    >
                      {GROQ_DIRECTOR_MODELS.map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunGroq}
                    disabled={isLoadingGroq}
                    className="w-full py-1.5 px-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-fuchsia-600/20"
                  >
                    {isLoadingGroq ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menganalisis dengan AI (Groq/Koboi)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Analisis dengan Groq LLM</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Rencana Efek:</span>
              <span className="font-bold text-amber-300">
                {stats.totalActive} dari {stats.total} frame dipasangi efek
              </span>
              <span className="text-slate-500">({stats.none} frame bersih alami)</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
              {stats.distortion > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  ⚡ {stats.distortion} Distorsi
                </span>
              )}
              {stats.vintage > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  🎞️ {stats.vintage} Kamera Jadul
                </span>
              )}
              {stats.worms > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  🪱 {stats.worms} Cacing-cacing
                </span>
              )}
              {stats.vintageWorms > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  🎬 {stats.vintageWorms} Jadul + Cacing
                </span>
              )}
            </div>
          </div>

          {/* Slide Table / Cards List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {plan.map((item) => {
              const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === item.recommendedEffect);
              const isClean = item.recommendedEffect === 'none';

              return (
                <div
                  key={item.slideId}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                    !isClean
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                      : 'bg-black/30 border-white/10 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-white/15 bg-black shrink-0"
                    />
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          #{item.slideIndex + 1} {item.slideName}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {item.startSec.toFixed(1)}s - {item.endSec.toFixed(1)}s
                        </span>
                      </div>

                      {/* Lyric or Reason */}
                      <div className="flex items-center gap-1.5 mt-1 text-[10.5px]">
                        {item.matchedLyricText ? (
                          <span className="text-amber-200/90 truncate flex items-center gap-1">
                            <Music className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                            <span className="italic">"{item.matchedLyricText}"</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 truncate">{item.reason}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Effect Dropdown Selector for override */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.recommendedEffect}
                      onChange={(e) =>
                        handleEffectChangeForRow(item.slideIndex, e.target.value as VisualEffectType)
                      }
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer transition-all ${
                        !isClean
                          ? opt?.badgeClass || 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                          : 'bg-black/50 text-slate-400 border-white/15 hover:text-white'
                      }`}
                    >
                      {VISUAL_EFFECT_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id} className="bg-slate-900 text-white">
                          {o.icon} {o.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-xs text-slate-400 transition-all flex items-center gap-1.5"
              title="Kembalikan semua frame menjadi bersih (tanpa efek)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Efek</span>
            </button>
            <button
              type="button"
              onClick={handleRunHeuristic}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-slate-300 transition-all flex items-center gap-1.5"
              title="Kocok ulang rekomendasi penempatan efek"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Acak Ulang</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Terapkan Efek ke {stats.totalActive} Frame</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
