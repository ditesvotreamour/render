import React, { useState } from 'react';
import {
  X,
  Zap,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
} from 'lucide-react';
import type { LyricSegment, AudioTrack } from '../types/visualizer';
import { WhisperAIService } from '../utils/whisperAi';

interface WhisperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrack;
  onLyricsGenerated: (lyrics: LyricSegment[]) => void;
}

const GROQ_MODELS = [
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo (Rekomendasi)',
    speed: 'Ultra Cepat (~2-3s)',
    desc: 'Optimal untuk kecepatan & sinkronisasi kata',
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large v3 (Multibahasa)',
    speed: 'Akurasi Tinggi',
    desc: 'Model terlengkap untuk aksen dan nada kompleks',
  },
  {
    id: 'distil-whisper-large-v3-en',
    name: 'Distil-Whisper Large v3 (English Only)',
    speed: 'Kilat',
    desc: 'Khusus vokal bahasa Inggris berkecepatan tinggi',
  },
];

const LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect Language (Otomatis)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
];

export const WhisperModal: React.FC<WhisperModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  onLyricsGenerated,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('groq_api_key') || localStorage.getItem('openai_api_key') || '';
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiModel, setApiModel] = useState<string>(() => {
    return localStorage.getItem('groq_api_model') || 'whisper-large-v3-turbo';
  });
  const [language, setLanguage] = useState<string>('auto');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedSegments, setGeneratedSegments] = useState<LyricSegment[] | null>(null);

  if (!isOpen) return null;

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('groq_api_key', val);
  };

  const handleApiModelChange = (val: string) => {
    setApiModel(val);
    localStorage.setItem('groq_api_model', val);
  };

  const handleTranscribeGroq = async () => {
    if (!apiKey.trim()) {
      setErrorMessage(
        'Groq API Key belum diisi. Masukkan API Key Anda (biasanya diawali dengan gsk_...) atau klik tautan di bawah untuk mendapatkannya secara gratis.'
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setGeneratedSegments(null);
    setStatusMessage('Mengambil dan menyiapkan file audio...');

    try {
      let audioBlob: Blob;
      if (currentTrack.url.startsWith('blob:') || currentTrack.url.startsWith('http')) {
        const res = await fetch(currentTrack.url);
        audioBlob = await res.blob();
      } else {
        // Fallback for demo synth track
        setStatusMessage('Menghasilkan lirik demo otomatis untuk lagu synth built-in...');
        const demo = WhisperAIService.generateDemoLyrics(currentTrack.title, currentTrack.genre);
        setGeneratedSegments(demo);
        setIsProcessing(false);
        return;
      }

      const segments = await WhisperAIService.transcribeWithGroq(
        audioBlob,
        apiKey.trim(),
        {
          model: apiModel,
          language,
        },
        (status) => setStatusMessage(status)
      );

      setGeneratedSegments(segments);
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Gagal melakukan transkripsi audio dengan Groq Whisper API.');
    }
  };

  const handleGenerateDemoLyrics = () => {
    setIsProcessing(true);
    setStatusMessage('Menganalisis aransemen lagu & struktur ketukan...');
    setTimeout(() => {
      setStatusMessage('Menyusun sinkronisasi lirik beat-drop...');
      setTimeout(() => {
        const demo = WhisperAIService.generateDemoLyrics(currentTrack.title, currentTrack.genre);
        setGeneratedSegments(demo);
        setIsProcessing(false);
      }, 500);
    }, 400);
  };

  const handleApply = () => {
    if (generatedSegments && generatedSegments.length > 0) {
      onLyricsGenerated(generatedSegments);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-white/15 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20">
              <Zap className="w-5 h-5 text-yellow-200 fill-yellow-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Groq Whisper STT
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Sole STT Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Transkripsi vokal instan bertenaga Groq Cloud LPU berakurasi tinggi
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 space-y-2 text-xs text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline inline-flex items-center gap-1"
                >
                  <span>Dapatkan API Key di console.groq.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {!isProcessing && !generatedSegments ? (
            <div className="space-y-4">
              {/* Groq Settings Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-indigo-500/10 border border-amber-500/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Groq Cloud API Key</span>
                  </span>
                  {apiKey ? (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Tersimpan di Browser</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-medium">Wajib diisi</span>
                  )}
                </div>

                {/* API Key Input */}
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full pl-3 pr-10 py-2.5 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* API Key Helper Link */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Belum memiliki Groq API Key?</span>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 hover:text-amber-200 font-bold inline-flex items-center gap-1 hover:underline"
                  >
                    <span>Dapatkan Gratis di Groq Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Model Selection */}
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1.5 font-medium">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>Model Whisper Groq</span>
                  </label>
                  <select
                    value={apiModel}
                    onChange={(e) => handleApiModelChange(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    {GROQ_MODELS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                        {m.name} — {m.speed}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {GROQ_MODELS.find((m) => m.id === apiModel)?.desc}
                  </p>
                </div>

                {/* Audio Language */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1.5 font-medium">
                    <Globe className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bahasa Vokal Lagu</span>
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transcribe Action Button */}
                <button
                  onClick={handleTranscribeGroq}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-black text-xs font-black shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer mt-2"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>⚡ Mulai Transkripsi dengan Groq API</span>
                </button>
              </div>

              {/* Demo Track Fallback Option */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Ingin mencoba lirik contoh tanpa API?</span>
                <button
                  type="button"
                  onClick={handleGenerateDemoLyrics}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-[11px] font-bold transition-all"
                >
                  🎵 Buat Lirik Demo Otomatis
                </button>
              </div>
            </div>
          ) : isProcessing ? (
            /* Loading State */
            <div className="py-10 space-y-4 text-center">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
                <div className="absolute inset-0 rounded-full border-4 border-t-amber-400 border-r-orange-500 animate-spin" />
                <Zap className="w-7 h-7 text-amber-300 fill-amber-300" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-white tracking-wide flex items-center justify-center gap-1.5">
                  <span>Mentranskrip dengan Groq Whisper...</span>
                </h4>
                <p className="text-xs text-slate-300 mt-1">{statusMessage}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium">
                  <Zap className="w-3 h-3 fill-amber-300" />
                  <span>Didukung Groq LPU Inference (Transkripsi selesai dalam hitungan detik)</span>
                </div>
              </div>
            </div>
          ) : (
            /* Result Preview State */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">
                    Berhasil mentranskrip {generatedSegments?.length} baris subtitle!
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-mono">
                  Word Timestamps Ready
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs">
                {generatedSegments?.map((seg) => (
                  <div
                    key={seg.id}
                    className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <span className="text-slate-200 block">{seg.text}</span>
                      {seg.words && seg.words.length > 0 && (
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {seg.words.length} kata tersinkronisasi
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-amber-400 shrink-0 font-bold">
                      {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-black/20 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              if (generatedSegments) {
                setGeneratedSegments(null);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            {generatedSegments ? 'Kembali' : 'Tutup'}
          </button>

          {generatedSegments && (
            <button
              onClick={handleApply}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Terapkan ke Studio Subtitle</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
