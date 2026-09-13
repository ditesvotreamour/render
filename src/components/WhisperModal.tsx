import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Server,
  FileText,
  RefreshCw,
} from 'lucide-react';
import type { LyricSegment, AudioTrack } from '../types/visualizer';
import { WhisperAIService, type WhisperSTTProvider } from '../utils/whisperAi';
import {
  fetchKoboiLLMModels,
  getCachedKoboiModels,
  type KoboiModelItem,
  DEFAULT_KOBOILLM_WHISPER_MODEL,
  DEFAULT_KOBOILLM_API_KEY,
} from '../utils/koboiLLMService';

interface WhisperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrack;
  onLyricsGenerated: (lyrics: LyricSegment[]) => void;
}

const GROQ_MODELS = [
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo (Rekomendasi Cepat)',
    speed: 'Ultra Cepat (~2-3s)',
    desc: 'Optimal untuk kecepatan & kuota hemat di Groq LPU',
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large v3 (Multilingual)',
    speed: 'Akurasi Tinggi',
    desc: 'Model berparameter penuh untuk aksen dan nada kompleks',
  },
  {
    id: 'distil-whisper-large-v3-en',
    name: 'Distil-Whisper Large v3 (English Only)',
    speed: 'Kilat',
    desc: 'Khusus vokal bahasa Inggris berkecepatan tinggi',
  },
];

const LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect Language (Otomatis Deteksi)' },
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
  // Provider Selection: 'groq' | 'openai' | 'koboillm' | 'custom'
  const [provider, setProvider] = useState<WhisperSTTProvider>(() => {
    return (localStorage.getItem('whisper_stt_provider') as WhisperSTTProvider) || 'groq';
  });

  // Groq API Key & Model
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    return localStorage.getItem('groq_api_key') || '';
  });
  const [groqModel, setGroqModel] = useState<string>(() => {
    return localStorage.getItem('groq_api_model') || 'whisper-large-v3-turbo';
  });

  // OpenAI API Key & Endpoint Mode
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(() => {
    return localStorage.getItem('openai_api_key') || '';
  });
  const [openaiEndpointMode, setOpenaiEndpointMode] = useState<'official' | 'koboillm' | 'custom'>(() => {
    return (localStorage.getItem('openai_endpoint_mode') as any) || 'official';
  });

  // KoboiLLM API Key, Model & Fetched Models List
  const [koboillmApiKey, setKoboillmApiKey] = useState<string>(() => {
    return localStorage.getItem('koboillm_api_key') || DEFAULT_KOBOILLM_API_KEY;
  });
  const [koboillmModel, setKoboillmModel] = useState<string>(() => {
    return localStorage.getItem('koboillm_whisper_model') || DEFAULT_KOBOILLM_WHISPER_MODEL;
  });
  const [koboiModels, setKoboiModels] = useState<KoboiModelItem[]>(() => {
    return getCachedKoboiModels();
  });
  const [isLoadingKoboiModels, setIsLoadingKoboiModels] = useState<boolean>(false);
  const [koboiModelsMessage, setKoboiModelsMessage] = useState<string | null>(null);

  // Custom Endpoint & Key
  const [customEndpoint, setCustomEndpoint] = useState<string>(() => {
    return localStorage.getItem('custom_whisper_endpoint') || 'http://localhost:8000/v1/audio/transcriptions';
  });
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('custom_whisper_key') || '';
  });

  const [promptHint, setPromptHint] = useState<string>(() => {
    return localStorage.getItem('whisper_prompt_hint') || '';
  });

  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('whisper_language') || 'auto';
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedSegments, setGeneratedSegments] = useState<LyricSegment[] | null>(null);

  useEffect(() => {
    const key = koboillmApiKey.trim();
    if (!key) return;
    fetchKoboiLLMModels(key)
      .then((models) => {
        setKoboiModels(models);
        const exists = models.some((m) => m.id === koboillmModel);
        if (!exists) {
          const audioModel = models.find((m) => m.type === 'audio' || m.id.includes('whisper'));
          if (audioModel) {
            setKoboillmModel(audioModel.id);
            localStorage.setItem('koboillm_whisper_model', audioModel.id);
          }
        }
      })
      .catch(() => {
        // silent fail on initial background fetch
      });
  }, [koboillmApiKey]);

  if (!isOpen) return null;

  const handleProviderChange = (newProvider: WhisperSTTProvider) => {
    setProvider(newProvider);
    localStorage.setItem('whisper_stt_provider', newProvider);
    setErrorMessage(null);
  };

  const handleGroqApiKeyChange = (val: string) => {
    setGroqApiKey(val);
    localStorage.setItem('groq_api_key', val);
  };

  const handleGroqModelChange = (val: string) => {
    setGroqModel(val);
    localStorage.setItem('groq_api_model', val);
  };

  const handleOpenaiApiKeyChange = (val: string) => {
    setOpenaiApiKey(val);
    localStorage.setItem('openai_api_key', val);
  };

  const handleOpenaiEndpointModeChange = (mode: 'official' | 'koboillm' | 'custom') => {
    setOpenaiEndpointMode(mode);
    localStorage.setItem('openai_endpoint_mode', mode);
  };

  const handleKoboillmApiKeyChange = (val: string) => {
    setKoboillmApiKey(val);
    localStorage.setItem('koboillm_api_key', val);
  };

  const handleKoboillmModelChange = (val: string) => {
    setKoboillmModel(val);
    localStorage.setItem('koboillm_whisper_model', val);
  };

  const handleFetchKoboiModels = async (keyToUse?: string) => {
    const key = (keyToUse !== undefined ? keyToUse : koboillmApiKey).trim();
    if (!key) {
      setKoboiModelsMessage('Masukkan API Key KoboiLLM terlebih dahulu untuk mengambil model.');
      return;
    }
    setIsLoadingKoboiModels(true);
    setKoboiModelsMessage(null);
    try {
      const models = await fetchKoboiLLMModels(key);
      setKoboiModels(models);
      setKoboiModelsMessage(`✓ Berhasil memuat ${models.length} model dari api.koboillm.com/v1`);
      const exists = models.some((m) => m.id === koboillmModel);
      if (!exists) {
        const audioModel = models.find((m) => m.type === 'audio' || m.id.includes('whisper'));
        if (audioModel) {
          setKoboillmModel(audioModel.id);
          localStorage.setItem('koboillm_whisper_model', audioModel.id);
        }
      }
    } catch (err: any) {
      setKoboiModelsMessage(err.message || 'Gagal mengambil model dari api.koboillm.com/v1/models');
    } finally {
      setIsLoadingKoboiModels(false);
    }
  };

  const handleCustomEndpointChange = (val: string) => {
    setCustomEndpoint(val);
    localStorage.setItem('custom_whisper_endpoint', val);
  };

  const handleCustomApiKeyChange = (val: string) => {
    setCustomApiKey(val);
    localStorage.setItem('custom_whisper_key', val);
  };

  const handleLanguageChange = (val: string) => {
    setLanguage(val);
    localStorage.setItem('whisper_language', val);
  };

  const handlePromptHintChange = (val: string) => {
    setPromptHint(val);
    localStorage.setItem('whisper_prompt_hint', val);
  };

  const handleTranscribe = async () => {
    const currentKey =
      provider === 'groq'
        ? groqApiKey.trim()
        : provider === 'openai'
        ? openaiApiKey.trim()
        : provider === 'koboillm'
        ? koboillmApiKey.trim()
        : customApiKey.trim();

    if (provider === 'groq' && !currentKey) {
      setErrorMessage(
        'Groq API Key belum diisi. Masukkan API Key Anda (diawali gsk_...) atau klik tautan di bawah untuk mendapatkannya secara gratis.'
      );
      return;
    }

    if (provider === 'openai' && !currentKey) {
      setErrorMessage(
        'OpenAI API Key belum diisi. Masukkan API Key Anda (diawali sk-...) untuk menggunakan model Whisper.'
      );
      return;
    }

    if (provider === 'koboillm' && !currentKey) {
      setErrorMessage(
        'KoboiLLM API Key belum diisi. Masukkan API Key Anda dari koboillm.com untuk mengakses OpenAI Whisper.'
      );
      return;
    }

    if (provider === 'custom' && !customEndpoint.trim()) {
      setErrorMessage('Endpoint URL Whisper server lokal / custom belum diisi.');
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

      let effectiveEndpoint: string | undefined = undefined;
      let effectiveProvider: WhisperSTTProvider = provider;

      if (provider === 'custom') {
        effectiveEndpoint = customEndpoint.trim();
      } else if (provider === 'koboillm') {
        effectiveEndpoint = WhisperAIService.KOBOILLM_API_ENDPOINT;
      } else if (provider === 'openai') {
        if (openaiEndpointMode === 'koboillm') {
          effectiveEndpoint = WhisperAIService.KOBOILLM_API_ENDPOINT;
          effectiveProvider = 'koboillm';
        } else if (openaiEndpointMode === 'custom') {
          effectiveEndpoint = customEndpoint.trim();
        }
      }

      const activeModel =
        provider === 'groq'
          ? groqModel
          : provider === 'koboillm' || (provider === 'openai' && openaiEndpointMode === 'koboillm')
          ? koboillmModel
          : 'whisper-1';

      const segments = await WhisperAIService.transcribe(
        audioBlob,
        effectiveProvider,
        currentKey,
        {
          model: activeModel,
          language,
          prompt: promptHint.trim() || undefined,
          customEndpoint: effectiveEndpoint,
        },
        (status) => setStatusMessage(status)
      );

      setGeneratedSegments(segments);
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Gagal melakukan transkripsi audio dengan Whisper API.');
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

  const currentKey =
    provider === 'groq'
      ? groqApiKey
      : provider === 'openai'
      ? openaiApiKey
      : provider === 'koboillm'
      ? koboillmApiKey
      : customApiKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-white/15 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white shadow-md ${
              provider === 'openai'
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/20'
                : provider === 'koboillm'
                ? 'bg-gradient-to-tr from-orange-500 via-amber-500 to-yellow-600 shadow-orange-500/20'
                : provider === 'custom'
                ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-purple-500/20'
                : 'bg-gradient-to-tr from-amber-500 to-orange-600 shadow-orange-500/20'
            }`}>
              {provider === 'openai' ? (
                <Sparkles className="w-5 h-5 text-emerald-200 fill-emerald-200" />
              ) : provider === 'koboillm' ? (
                <span className="text-lg leading-none">🤠</span>
              ) : provider === 'custom' ? (
                <Server className="w-5 h-5 text-indigo-200" />
              ) : (
                <Zap className="w-5 h-5 text-yellow-200 fill-yellow-200" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Whisper AI Speech-to-Text
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  provider === 'openai'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : provider === 'koboillm'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                    : provider === 'custom'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {provider === 'openai' ? 'OpenAI Official' : provider === 'koboillm' ? 'KoboiLLM Gateway' : provider === 'custom' ? 'Custom Server' : 'Groq LPU'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Transkripsi vokal otomatis dengan sinkronisasi kata presisi untuk subtitle visualizer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                {provider === 'groq' && (
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline inline-flex items-center gap-1"
                  >
                    <span>Dapatkan API Key di console.groq.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {provider === 'openai' && (
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline inline-flex items-center gap-1"
                  >
                    <span>Buka OpenAI API Keys Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-[11px] text-slate-400 hover:text-white ml-auto"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {!isProcessing && !generatedSegments ? (
            <div className="space-y-4">
              {/* STT Provider Switcher Tabs */}
              <div>
                <label className="block text-[11px] text-slate-300 mb-1.5 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Pilih Mesin Transkripsi AI</span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">Bisa berganti kapan saja</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/40 p-1 rounded-2xl border border-white/10">
                  {/* Option 1: Groq */}
                  <button
                    type="button"
                    onClick={() => handleProviderChange('groq')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      provider === 'groq'
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50 shadow-md shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Groq LPU</span>
                    </div>
                    <span className="text-[9px] opacity-75 font-normal">Super Cepat (~2s)</span>
                  </button>

                  {/* Option 2: OpenAI Whisper */}
                  <button
                    type="button"
                    onClick={() => handleProviderChange('openai')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      provider === 'openai'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 shadow-md shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>OpenAI Resmi</span>
                    </div>
                    <span className="text-[9px] opacity-75 font-normal">Presisi Vokal</span>
                  </button>

                  {/* Option 3: KoboiLLM Gateway */}
                  <button
                    type="button"
                    onClick={() => handleProviderChange('koboillm')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      provider === 'koboillm'
                        ? 'bg-orange-500/20 text-orange-200 border border-orange-400/50 shadow-md shadow-orange-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs">🤠</span>
                      <span>KoboiLLM</span>
                    </div>
                    <span className="text-[9px] opacity-75 font-normal">Gateway ID (QRIS)</span>
                  </button>

                  {/* Option 4: Custom / Local */}
                  <button
                    type="button"
                    onClick={() => handleProviderChange('custom')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      provider === 'custom'
                        ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/50 shadow-md shadow-indigo-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Custom API</span>
                    </div>
                    <span className="text-[9px] opacity-75 font-normal">Self-Hosted</span>
                  </button>
                </div>
              </div>

              {/* Provider Information Callout */}
              {provider === 'openai' && (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs space-y-1 text-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Rekomendasi untuk Lagu & Vokal Musik Kompleks</span>
                    </div>
                    <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                      Jika hasil Groq kurang pas atau melewatkan bait vokal di nada tinggi, <strong>OpenAI Whisper (whisper-1)</strong> adalah model resmi dengan akurasi akustik tertinggi.
                    </p>
                  </div>

                  {/* Target Endpoint Picker inside OpenAI Tab */}
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/10 space-y-1.5">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
                      Target Endpoint / Gateway:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenaiEndpointModeChange('official')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                          openaiEndpointMode === 'official'
                            ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                            : 'text-slate-400 hover:text-white bg-white/5 border border-transparent'
                        }`}
                      >
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>OpenAI Resmi (api.openai.com)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenaiEndpointModeChange('koboillm')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                          openaiEndpointMode === 'koboillm'
                            ? 'bg-orange-500/30 text-orange-200 border border-orange-400/50'
                            : 'text-slate-400 hover:text-white bg-white/5 border border-transparent'
                        }`}
                      >
                        <span className="text-xs">🤠</span>
                        <span>KoboiLLM Gateway (koboillm.com)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {provider === 'koboillm' && (
                <div className="p-3 rounded-2xl bg-orange-950/30 border border-orange-500/30 text-xs space-y-1 text-orange-200">
                  <div className="flex items-center gap-1.5 font-bold text-orange-300">
                    <span className="text-sm">🤠</span>
                    <span>KoboiLLM — Akses OpenAI Whisper dengan Pembayaran Lokal (koboillm.com)</span>
                  </div>
                  <p className="text-[11px] text-orange-200/80 leading-relaxed">
                    KoboiLLM adalah AI Gateway Indonesia yang menyediakan akses model <strong>OpenAI Whisper (whisper-1)</strong> melalui endpoint <code>https://api.koboillm.com/v1/audio/transcriptions</code> dengan pembayaran Rupiah/QRIS di <a href="https://koboillm.com" target="_blank" rel="noopener noreferrer" className="underline font-bold text-orange-300">koboillm.com</a>.
                  </p>
                </div>
              )}

              {provider === 'groq' && (
                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/25 text-xs space-y-1 text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Kecepatan Kilat & Kuota Gratis</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Groq memproses seluruh lagu hanya dalam 2-3 detik berkat arsitektur LPU. Sangat cocok untuk pratinjau cepat tanpa biaya.
                  </p>
                </div>
              )}

              {/* Provider Settings Box */}
              <div className={`p-4 rounded-2xl border space-y-3.5 ${
                provider === 'openai'
                  ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border-emerald-500/30'
                  : provider === 'koboillm'
                  ? 'bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-yellow-500/10 border-orange-500/30'
                  : provider === 'custom'
                  ? 'bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 border-indigo-500/30'
                  : 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-indigo-500/10 border-amber-500/30'
              }`}>
                {/* 1. API Key Input Header */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    provider === 'openai'
                      ? 'text-emerald-300'
                      : provider === 'koboillm'
                      ? 'text-orange-300'
                      : provider === 'custom'
                      ? 'text-indigo-300'
                      : 'text-amber-300'
                  }`}>
                    <Key className="w-3.5 h-3.5" />
                    <span>
                      {provider === 'openai'
                        ? (openaiEndpointMode === 'koboillm' ? 'API Key KoboiLLM' : 'OpenAI API Key')
                        : provider === 'koboillm'
                        ? 'KoboiLLM API Key'
                        : provider === 'custom'
                        ? 'Custom Whisper Key (Opsional)'
                        : 'Groq Cloud API Key'}
                    </span>
                  </span>
                  {currentKey ? (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Tersimpan di Browser</span>
                    </span>
                  ) : (
                    <span className={`text-[10px] font-medium ${provider === 'custom' ? 'text-slate-400' : 'text-amber-400'}`}>
                      {provider === 'custom' ? 'Opsional untuk local server' : 'Wajib diisi'}
                    </span>
                  )}
                </div>

                {/* Custom Endpoint URL Input (if custom) */}
                {provider === 'custom' && (
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-medium">
                      Endpoint URL Whisper Server
                    </label>
                    <input
                      type="text"
                      value={customEndpoint}
                      onChange={(e) => handleCustomEndpointChange(e.target.value)}
                      placeholder="http://localhost:8000/v1/audio/transcriptions"
                      className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Mendukung server lokal (faster-whisper, whisper.cpp, LocalAI) atau endpoint server kompatibel OpenAI.
                    </p>
                  </div>
                )}

                {/* API Key Input */}
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={currentKey}
                    onChange={(e) => {
                      if (provider === 'openai') {
                        if (openaiEndpointMode === 'koboillm') {
                          handleKoboillmApiKeyChange(e.target.value);
                        } else {
                          handleOpenaiApiKeyChange(e.target.value);
                        }
                      } else if (provider === 'koboillm') {
                        handleKoboillmApiKeyChange(e.target.value);
                      } else if (provider === 'custom') {
                        handleCustomApiKeyChange(e.target.value);
                      } else {
                        handleGroqApiKeyChange(e.target.value);
                      }
                    }}
                    placeholder={
                      provider === 'openai'
                        ? (openaiEndpointMode === 'koboillm' ? 'Masukkan API Key dari koboillm.com' : 'sk-proj-... atau sk-...')
                        : provider === 'koboillm'
                        ? 'Masukkan API Key dari koboillm.com'
                        : provider === 'custom'
                        ? 'Bearer token / API key (jika server membutuhkan)'
                        : 'gsk_...'
                    }
                    className="w-full pl-3 pr-10 py-2.5 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* API Key Helper Link */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  {provider === 'groq' && (
                    <>
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
                    </>
                  )}
                  {provider === 'openai' && (
                    <>
                      <span>
                        {openaiEndpointMode === 'koboillm' ? 'Perlu API Key KoboiLLM?' : 'Perlu API Key OpenAI?'}
                      </span>
                      {openaiEndpointMode === 'koboillm' ? (
                        <a
                          href="https://koboillm.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-300 hover:text-orange-200 font-bold inline-flex items-center gap-1 hover:underline"
                        >
                          <span>Dapatkan di koboillm.com (QRIS/IDR)</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 hover:text-emerald-200 font-bold inline-flex items-center gap-1 hover:underline"
                        >
                          <span>Dapatkan di OpenAI Platform</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  )}
                  {provider === 'koboillm' && (
                    <>
                      <span>Belum memiliki API Key KoboiLLM?</span>
                      <a
                        href="https://koboillm.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-300 hover:text-orange-200 font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        <span>Dapatkan di koboillm.com (QRIS/IDR)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                  {provider === 'custom' && (
                    <span className="text-[10px] text-slate-400">
                      Gunakan format OpenAI audio transcriptions standard.
                    </span>
                  )}
                </div>

                {/* Model Selection */}
                <div className="pt-2 border-t border-white/10">
                  {provider === 'groq' ? (
                    <>
                      <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1.5 font-medium">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pilihan Model Whisper Groq</span>
                      </label>
                      <select
                        value={groqModel}
                        onChange={(e) => handleGroqModelChange(e.target.value)}
                        className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        {GROQ_MODELS.map((m) => (
                          <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                            {m.name} — {m.speed}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {GROQ_MODELS.find((m) => m.id === groqModel)?.desc}
                      </p>
                    </>
                  ) : provider === 'koboillm' || (provider === 'openai' && openaiEndpointMode === 'koboillm') ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-slate-300 flex items-center gap-1.5 font-medium">
                          <span className="text-xs">🤠</span>
                          <span>Pilihan Model (api.koboillm.com/v1/models)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleFetchKoboiModels()}
                          disabled={isLoadingKoboiModels}
                          className="text-[10px] text-orange-300 hover:text-orange-200 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                          title="Ambil model terbaru yang aktif dari akun KoboiLLM Anda"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingKoboiModels ? 'animate-spin' : ''}`} />
                          <span>{isLoadingKoboiModels ? 'Memuat...' : 'Muat Ulang Model'}</span>
                        </button>
                      </div>

                      {/* Dropdown Select */}
                      <div className="relative">
                        <select
                          value={koboillmModel}
                          onChange={(e) => handleKoboillmModelChange(e.target.value)}
                          className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-orange-400 cursor-pointer font-mono"
                        >
                          {/* Audio models */}
                          {koboiModels.some((m) => m.type === 'audio') && (
                            <optgroup label="🎙️ Model Audio / Whisper">
                              {koboiModels
                                .filter((m) => m.type === 'audio')
                                .map((m) => (
                                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                                    {m.id} {m.owned_by ? `(${m.owned_by})` : ''}
                                  </option>
                                ))}
                            </optgroup>
                          )}

                          {/* All other / LLM models */}
                          <optgroup label="💬 Model Lainnya (Multi-Model Gateway)">
                            {koboiModels
                              .filter((m) => m.type !== 'audio')
                              .map((m) => (
                                <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                                  {m.id} {m.owned_by ? `(${m.owned_by})` : ''}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Info & Status */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {koboiModelsMessage || `${koboiModels.length} model tersedia dari LiteLLM Gateway`}
                        </span>
                        <span className="text-orange-400/80 font-mono">
                          Aktif: {koboillmModel}
                        </span>
                      </div>
                    </div>
                  ) : provider === 'openai' ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold text-white">whisper-1</div>
                          <div className="text-[10px] text-slate-400">OpenAI SOTA Speech-to-Text Model</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                        Resmi OpenAI
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs text-slate-300">Model otomatis sesuai konfigurasi server</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audio Language Selection */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1.5 font-medium">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Bahasa Vokal Lagu</span>
                  </label>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Prompt Guidance */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1.5 font-medium">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Petunjuk Kata / Prompt (Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={promptHint}
                    onChange={(e) => handlePromptHintChange(e.target.value)}
                    placeholder={`Contoh: "${currentTrack.title}", lirik lagu pop Indonesia...`}
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Membantu Whisper agar tidak salah mengenali nama artis, istilah gaul, atau kata serapan.
                  </p>
                </div>

                {/* Transcribe Action Button */}
                <button
                  onClick={handleTranscribe}
                  className={`w-full py-3 rounded-xl text-black text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer mt-2 ${
                    provider === 'openai'
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-emerald-500/25'
                      : provider === 'custom'
                      ? 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 hover:from-indigo-300 hover:to-pink-300 shadow-purple-500/25'
                      : 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-400 shadow-orange-500/25'
                  }`}
                >
                  {provider === 'openai' ? (
                    <>
                      <Sparkles className="w-4 h-4 fill-black" />
                      <span>Transkrip dengan OpenAI Whisper API</span>
                    </>
                  ) : provider === 'custom' ? (
                    <>
                      <Server className="w-4 h-4" />
                      <span>Transkrip dengan Custom Whisper Server</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-black" />
                      <span>Transkrip dengan Groq LPU API</span>
                    </>
                  )}
                </button>
              </div>

              {/* Demo Track Fallback Option */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Ingin mencoba lirik contoh tanpa API?</span>
                <button
                  type="button"
                  onClick={handleGenerateDemoLyrics}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                >
                  🎵 Buat Lirik Demo Otomatis
                </button>
              </div>
            </div>
          ) : isProcessing ? (
            /* Loading State */
            <div className="py-10 space-y-4 text-center">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full border-4 animate-ping ${
                  provider === 'openai'
                    ? 'border-emerald-500/20'
                    : provider === 'custom'
                    ? 'border-purple-500/20'
                    : 'border-amber-500/20'
                }`} />
                <div className={`absolute inset-0 rounded-full border-4 animate-spin ${
                  provider === 'openai'
                    ? 'border-t-emerald-400 border-r-teal-500'
                    : provider === 'custom'
                    ? 'border-t-indigo-400 border-r-purple-500'
                    : 'border-t-amber-400 border-r-orange-500'
                }`} />
                {provider === 'openai' ? (
                  <Sparkles className="w-7 h-7 text-emerald-300 fill-emerald-300" />
                ) : provider === 'custom' ? (
                  <Server className="w-7 h-7 text-indigo-300" />
                ) : (
                  <Zap className="w-7 h-7 text-amber-300 fill-amber-300" />
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-white tracking-wide flex items-center justify-center gap-1.5">
                  <span>
                    Mentranskrip dengan{' '}
                    {provider === 'openai'
                      ? 'OpenAI Whisper API...'
                      : provider === 'custom'
                      ? 'Custom Whisper Server...'
                      : 'Groq Whisper LPU...'}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-1">{statusMessage}</p>
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                  provider === 'openai'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : provider === 'custom'
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  {provider === 'openai' ? (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>Model Whisper-1: Pemisahan vokal instrumen presisi tinggi</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 fill-current" />
                      <span>Didukung Whisper LPU Inference berkecepatan tinggi</span>
                    </>
                  )}
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
                  {provider === 'openai' ? 'OpenAI Whisper-1' : provider === 'custom' ? 'Custom Whisper' : 'Groq Whisper'}
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
                    <span className="text-[10px] text-cyan-400 shrink-0 font-bold">
                      {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-black/30 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              if (generatedSegments) {
                setGeneratedSegments(null);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
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
