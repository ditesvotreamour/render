import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Clock,
  Music,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Repeat,
} from 'lucide-react';
import type { LyricSegment, SlideItem } from '../types/visualizer';
import {
  heuristicMatchImagesToLyrics,
  groqLlmMatchImagesToLyrics,
} from '../utils/aiLyricImageMatcher';
import type { MatchResult } from '../utils/aiLyricImageMatcher';

interface AiLyricImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{ url: string; name: string }>;
  lyrics: LyricSegment[];
  duration: number;
  onApplySlides: (slides: SlideItem[]) => void;
}

export const AiLyricImageModal: React.FC<AiLyricImageModalProps> = ({
  isOpen,
  onClose,
  images,
  lyrics,
  duration,
  onApplySlides
}) => {
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isLoadingGroq, setIsLoadingGroq] = useState<boolean>(false);
  const [groqError, setGroqError] = useState<string | null>(null);
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    return localStorage.getItem('groq_api_key') || '';
  });
  const [allowReffReuse, setAllowReffReuse] = useState<boolean>(true);

  // Run initial matching whenever modal opens or images/lyrics/allowReffReuse change
  useEffect(() => {
    if (isOpen && images.length > 0) {
      setGroqError(null);
      const results = heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse);
      setMatchResults(results);
    }
  }, [isOpen, images, lyrics, duration, allowReffReuse]);

  if (!isOpen) return null;

  // Run offline heuristic match
  const handleRunHeuristic = () => {
    setGroqError(null);
    const results = heuristicMatchImagesToLyrics(images, lyrics, duration, allowReffReuse);
    setMatchResults(results);
  };

  // Run Groq LLM semantic match
  const handleRunGroq = async () => {
    const key = groqApiKey.trim() || localStorage.getItem('groq_api_key') || '';
    if (!key) {
      setGroqError('Groq API Key belum diisi. Silakan masukkan Groq API Key Anda (diawali dengan gsk_).');
      return;
    }
    localStorage.setItem('groq_api_key', key);
    setIsLoadingGroq(true);
    setGroqError(null);

    try {
      const results = await groqLlmMatchImagesToLyrics(key, images, lyrics, duration, allowReffReuse);
      setMatchResults(results);
    } catch (err: any) {
      setGroqError(err?.message || 'Gagal menjalankan analisis Groq AI');
    } finally {
      setIsLoadingGroq(false);
    }
  };

  // User manual timing update
  const handleTimingChange = (index: number, field: 'startSec' | 'endSec', value: number) => {
    setMatchResults((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const slide = { ...item.slide, [field]: Math.max(0, Math.min(duration, value)) };
      item.slide = slide;
      next[index] = item;
      return next;
    });
  };

  const handleApply = () => {
    const slides = matchResults.map((r) => r.slide);
    onApplySlides(slides);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0d1117] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/60 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>AI Pencocokan Gambar ke Lirik</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Smart Timing
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                AI menganalisis nama file gambar & menjadwalkannya tepat di timestamp lirik lagu yang cocok
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="px-5 py-3 bg-slate-900/80 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">
              Foto terdeteksi: <strong className="text-white">{images.length}</strong> | Lirik:{' '}
              <strong className="text-white">{lyrics.length} baris</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAllowReffReuse(!allowReffReuse)}
              className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                allowReffReuse
                  ? 'bg-indigo-500/25 hover:bg-indigo-500/35 border-indigo-500/50 text-indigo-200 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
              }`}
              title="Saat Reff lagu berulang, foto yang cocok dengan bait Reff akan dimunculkan kembali otomatis"
            >
              <Repeat className={`w-3.5 h-3.5 ${allowReffReuse ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span>Ulang di Reff: <strong className={allowReffReuse ? 'text-white' : 'text-slate-400'}>{allowReffReuse ? 'ON' : 'OFF'}</strong></span>
            </button>

            <button
              onClick={handleRunHeuristic}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 font-semibold flex items-center gap-1.5 transition-all"
              title="Gunakan algoritma heuristik & kamus sinonim internal (100% offline dan instan)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pencocokan Heuristik (Offline)</span>
            </button>

            <button
              onClick={handleRunGroq}
              disabled={isLoadingGroq}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-cyan-900/30 transition-all disabled:opacity-50"
              title="Kirim ke Groq AI Llama 3 untuk analisis semantik mendalam"
            >
              {isLoadingGroq ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{isLoadingGroq ? 'Menganalisis...' : 'Analisis Groq AI (Llama 3)'}</span>
            </button>
          </div>
        </div>

        {/* Optional Groq API Key Input if Error or Missing */}
        {groqError && (
          <div className="px-5 py-2.5 bg-rose-950/40 border-b border-rose-500/30 flex items-center gap-3 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1">{groqError}</span>
            <input
              type="password"
              placeholder="Masukkan gsk_..."
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              className="px-2 py-1 rounded bg-black/40 border border-rose-500/40 text-white font-mono text-[11px] w-48"
            />
            <button
              onClick={handleRunGroq}
              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
          {images.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ImageIcon className="w-10 h-10 mx-auto opacity-40 text-cyan-400" />
              <p className="text-sm">Belum ada foto slideshow yang ditambahkan.</p>
              <p className="text-xs text-slate-500">
                Tambahkan foto di timeline atau tab Background terlebih dahulu.
              </p>
            </div>
          ) : matchResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-2" />
              <p className="text-sm">Sedang menganalisis nama file dan lirik lagu...</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {matchResults.map((res, idx) => {
                const durationSlide = Math.max(0.1, res.slide.endSec - res.slide.startSec);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-3.5"
                  >
                    {/* Thumbnail & Image Info */}
                    <div className="flex items-center gap-3 w-full sm:w-56 shrink-0">
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-slate-800">
                        <img
                          src={res.slide.url}
                          alt={res.cleanName}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 px-1 py-0.5 bg-black/70 text-[9px] font-mono text-cyan-300 rounded-tl">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate" title={res.cleanName}>
                          {res.cleanName}
                        </p>
                        <p
                          className="text-[10px] text-slate-400 truncate font-mono"
                          title={res.slide.name}
                        >
                          {res.slide.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              res.confidence >= 80
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : res.confidence >= 65
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                            }`}
                          >
                            {Math.round(res.confidence)}% Match
                          </span>

                          {res.isReffRepeat && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>Reff #{res.repeatOccurrence || 2}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Matched Lyric & Reason */}
                    <div className="flex-1 min-w-0 border-l border-white/10 pl-0 sm:pl-3 w-full">
                      <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 mb-0.5">
                        <Music className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-semibold truncate">
                          Lirik:{' '}
                          <span className="text-white italic">
                            "{res.matchedLineText || '(Instrumen/Intro)'}"
                          </span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        Alasan: <span className="text-slate-300">{res.reason}</span>
                      </p>
                    </div>

                    {/* Timestamps & Custom Adjuster */}
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                      <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/10">
                        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <div className="flex items-center gap-1 text-xs font-mono">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={duration}
                            value={res.slide.startSec}
                            onChange={(e) =>
                              handleTimingChange(idx, 'startSec', parseFloat(e.target.value) || 0)
                            }
                            className="w-14 px-1 py-0.5 bg-slate-900 border border-white/20 rounded text-center text-cyan-300 focus:border-cyan-400 outline-none"
                          />
                          <span className="text-slate-500">➔</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={duration}
                            value={res.slide.endSec}
                            onChange={(e) =>
                              handleTimingChange(idx, 'endSec', parseFloat(e.target.value) || 0)
                            }
                            className="w-14 px-1 py-0.5 bg-slate-900 border border-white/20 rounded text-center text-indigo-300 focus:border-indigo-400 outline-none"
                          />
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({durationSlide.toFixed(1)}s)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-white/10 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {lyrics.length === 0 ? (
              <span className="text-amber-400">
                ⚠️ Tips: Generate lirik dengan tombol Groq Whisper terlebih dahulu agar AI bisa mencocokkan kata.
              </span>
            ) : (
              <span>
                ✨ Background slideshow akan berganti otomatis tepat saat lirik bersangkutan dinyanyikan.
              </span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleApply}
              disabled={matchResults.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan ke Timeline ({matchResults.length} Foto)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
