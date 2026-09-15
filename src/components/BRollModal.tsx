import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Play,
  Sparkles,
  Layers,
  Film,
  Upload,
  Clock,
  Sliders,
  Check,
  Maximize2,
  Tv,
  Columns,
  Flame,
  RotateCcw,
  CheckCircle2,
  Key,
  Zap,
} from 'lucide-react';
import type {
  BackgroundConfig,
  BRollClip,
  BRollConfig,
  BRollDisplayMode,
  BRollPipPosition,
  LyricSegment,
  VisualEffectType,
} from '../types/visualizer';
import { VISUAL_EFFECT_OPTIONS } from '../types/visualizer';
import { BROLL_PRESETS, createBRollClipFromPreset, type BRollPresetItem } from '../data/bRollPresets';
import { registerMediaUrl } from '../utils/zipImageExtractor';
import { StockMediaBrowser } from './StockMediaBrowser';
import type { StockMediaItem } from '../utils/stockMediaService';
import {
  getAiBRollRecommendations,
  convertRecommendationsToBRollClips,
  type BRollRecommendation,
  type AnalyzeOptions,
} from '../utils/aiBRollRecommender';

interface BRollModalProps {
  isOpen: boolean;
  onClose: () => void;
  backgroundConfig: BackgroundConfig;
  onBackgroundChange: (bg: BackgroundConfig) => void;
  currentTime: number;
  duration: number;
  lyrics?: LyricSegment[];
  onSeek?: (sec: number) => void;
  initialTab?: 'clips' | 'presets' | 'stock' | 'ai';
}

export const BRollModal: React.FC<BRollModalProps> = ({
  isOpen,
  onClose,
  backgroundConfig,
  onBackgroundChange,
  currentTime,
  duration,
  lyrics = [],
  onSeek,
  initialTab = 'clips',
}) => {
  const [activeTab, setActiveTab] = useState<'clips' | 'presets' | 'stock' | 'ai'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [presetCategory, setPresetCategory] = useState<string>('all');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Subtitle B-Roll Recommender States
  const [aiRecommendations, setAiRecommendations] = useState<BRollRecommendation[]>([]);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiProgressText, setAiProgressText] = useState<string>('');
  const [aiProgressPercent, setAiProgressPercent] = useState<number>(0);
  const [aiDensity, setAiDensity] = useState<'minimal' | 'balanced' | 'cinematic'>('balanced');
  const [aiPreferredMode, setAiPreferredMode] = useState<'auto' | 'cutaway' | 'pip' | 'blend_overlay'>('auto');
  const [useGroqLlM, setUseGroqLlM] = useState<boolean>(false);
  const [groqKeyInput, setGroqKeyInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('groq_api_key') || '';
  });
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  if (!isOpen) return null;

  const bRoll = backgroundConfig.bRoll || {
    enabled: true,
    clips: [],
    defaultDisplayMode: 'cutaway',
    defaultPipPosition: 'top_right',
    globalOpacity: 1,
  };

  const clips = [...(bRoll.clips || [])].sort((a, b) => a.startSec - b.startSec);

  const updateBRoll = (newBRoll: Partial<BRollConfig>) => {
    onBackgroundChange({
      ...backgroundConfig,
      bRoll: {
        ...bRoll,
        ...newBRoll,
      },
    });
  };

  const handleToggleEnabled = () => {
    updateBRoll({ enabled: !bRoll.enabled });
  };

  const handleAddClipFromPreset = (preset: BRollPresetItem) => {
    const startSec = Math.max(0, Math.min(duration - 2, currentTime));
    const newClip = createBRollClipFromPreset(preset, startSec);
    // Ensure end doesn't exceed total duration
    newClip.endSec = Math.min(duration, newClip.endSec);
    updateBRoll({
      enabled: true,
      clips: [...bRoll.clips, newClip],
    });
    setSelectedClipId(newClip.id);
    setActiveTab('clips');
  };

  const handleAddClipFromStock = (item: StockMediaItem, mode: BRollDisplayMode = 'cutaway') => {
    const startSec = Math.max(0, Math.min(duration - 2, currentTime));
    const clipDur = item.duration && item.duration > 0 ? Math.min(15, item.duration) : 5;
    const endSec = Math.min(duration, startSec + clipDur);

    const newClip: BRollClip = {
      id: `broll_stock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.title,
      url: item.downloadUrl || item.previewUrl,
      mediaType: item.type,
      startSec,
      endSec,
      displayMode: mode,
      pipPosition: bRoll.defaultPipPosition || 'top_right',
      pipScale: 0.38,
      blendMode: mode === 'blend_overlay' ? 'screen' : 'source-over',
      opacity: 1,
      kenBurns: true,
    };

    registerMediaUrl(newClip.url, newClip.mediaType || 'image');

    updateBRoll({
      enabled: true,
      clips: [...bRoll.clips, newClip],
    });
    setSelectedClipId(newClip.id);
    setActiveTab('clips');
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const url = URL.createObjectURL(file);
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    registerMediaUrl(url, mediaType);

    const startSec = Math.max(0, Math.min(duration - 2, currentTime));
    const clipDur = mediaType === 'video' ? 5 : 4.5;
    const newClip: BRollClip = {
      id: `broll-upload-${Date.now()}`,
      url,
      name: file.name.replace(/\.[^/.]+$/, ''),
      startSec,
      endSec: Math.min(duration, startSec + clipDur),
      mediaType,
      displayMode: 'cutaway',
      pipPosition: 'top_right',
      pipScale: 0.32,
      opacity: 1,
      blendMode: 'screen',
      transition: 'fade',
      kenBurns: true,
    };

    updateBRoll({
      enabled: true,
      clips: [...bRoll.clips, newClip],
    });
    setSelectedClipId(newClip.id);
    setActiveTab('clips');
    e.target.value = '';
  };

  const handleUpdateClip = (clipId: string, updates: Partial<BRollClip>) => {
    const updated = bRoll.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
    updateBRoll({ clips: updated });
  };

  const handleDeleteClip = (clipId: string) => {
    const updated = bRoll.clips.filter((c) => c.id !== clipId);
    updateBRoll({ clips: updated });
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  // ⚡ AI Auto-Fill B-Roll on Instrumental Breaks or Chorus
  const handleAutoGenerateBRoll = (mode: 'instrumental' | 'chorus' | 'beat_interval') => {
    const existingClips = [...bRoll.clips];
    const presetPool = [...BROLL_PRESETS];
    let poolIdx = 0;

    const getPreset = () => {
      const p = presetPool[poolIdx % presetPool.length];
      poolIdx++;
      return p;
    };

    const newClips: BRollClip[] = [];

    if (mode === 'instrumental') {
      // 1. Long Intro before first lyric
      if (lyrics.length > 0 && lyrics[0].start > 4.5) {
        const introDur = lyrics[0].start;
        const p = getPreset();
        newClips.push({
          ...createBRollClipFromPreset(p, 0),
          endSec: Math.min(introDur, 6),
          displayMode: 'cutaway',
        });
      }

      // 2. Interludes / Gaps between lyrics (> 6s)
      for (let i = 0; i < lyrics.length - 1; i++) {
        const gapStart = lyrics[i].end;
        const gapEnd = lyrics[i + 1].start;
        if (gapEnd - gapStart > 6.0) {
          const p = getPreset();
          newClips.push({
            ...createBRollClipFromPreset(p, gapStart + 0.5),
            endSec: Math.min(gapEnd - 0.5, gapStart + 5.5),
            displayMode: 'cutaway',
          });
        }
      }

      // 3. Outro after last lyric
      if (lyrics.length > 0) {
        const lastEnd = lyrics[lyrics.length - 1].end;
        if (duration - lastEnd > 5.0) {
          const p = getPreset();
          newClips.push({
            ...createBRollClipFromPreset(p, lastEnd + 1.0),
            endSec: Math.min(duration, lastEnd + 7.0),
            displayMode: 'cutaway',
          });
        }
      }
    } else if (mode === 'chorus') {
      // Find reff / chorus lines or loud energy peaks
      lyrics.forEach((line) => {
        const txt = (line.text || '').toLowerCase();
        if (txt.includes('reff') || txt.includes('chorus') || txt.includes('hook')) {
          const p = getPreset();
          newClips.push({
            ...createBRollClipFromPreset(p, line.start),
            endSec: line.end,
            displayMode: 'pip',
          });
        }
      });
    } else if (mode === 'beat_interval') {
      // Uniform aesthetic B-roll cuts every 18 seconds
      const step = 18;
      for (let t = 8; t < duration - 10; t += step) {
        const p = getPreset();
        newClips.push({
          ...createBRollClipFromPreset(p, t),
          endSec: Math.min(duration, t + 4.5),
          displayMode: (['cutaway', 'pip', 'blend_overlay'] as BRollDisplayMode[])[poolIdx % 3],
        });
      }
    }

    if (newClips.length > 0) {
      updateBRoll({
        enabled: true,
        clips: [...existingClips, ...newClips],
      });
      setActiveTab('clips');
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsAiAnalyzing(true);
    setAiProgressText('Menganalisis makna & kata kunci subtitle...');
    setAiProgressPercent(10);
    try {
      const opts: AnalyzeOptions = {
        density: aiDensity,
        preferredMode: aiPreferredMode,
        includeInstrumentalGaps: true,
        groqApiKey: useGroqLlM ? groqKeyInput.trim() : undefined,
      };
      if (useGroqLlM && groqKeyInput.trim()) {
        localStorage.setItem('groq_api_key', groqKeyInput.trim());
      }
      const results = await getAiBRollRecommendations(
        lyrics,
        duration,
        opts,
        (step, pct) => {
          setAiProgressText(step);
          setAiProgressPercent(pct);
        }
      );
      setAiRecommendations(results);
    } catch (err: any) {
      console.error('AI Subtitle B-Roll analysis failed:', err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleApplyAiRecommendations = () => {
    const newClips = convertRecommendationsToBRollClips(aiRecommendations);
    if (newClips.length === 0) return;

    updateBRoll({
      enabled: true,
      clips: [...bRoll.clips, ...newClips],
    });
    setActiveTab('clips');
  };

  const handleToggleRecSelected = (recId: string) => {
    setAiRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleChangeRecMode = (recId: string, mode: BRollDisplayMode) => {
    setAiRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, recommendedMode: mode } : r))
    );
  };

  const handleCycleRecMedia = (recId: string) => {
    setAiRecommendations((prev) =>
      prev.map((r) => {
        if (r.id !== recId || !r.alternativeMedia || r.alternativeMedia.length === 0) return r;
        const current = r.suggestedMedia;
        const allCandidates = [current, ...r.alternativeMedia].filter(Boolean) as StockMediaItem[];
        const currIdx = allCandidates.findIndex((c) => c.id === current?.id);
        const nextIdx = (currIdx + 1) % allCandidates.length;
        const nextMedia = allCandidates[nextIdx];
        const nextAlternatives = allCandidates.filter((c) => c.id !== nextMedia.id);
        return {
          ...r,
          suggestedMedia: nextMedia,
          alternativeMedia: nextAlternatives,
        };
      })
    );
  };

  const selectedClip = clips.find((c) => c.id === selectedClipId);

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = (s % 60).toFixed(1);
    return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
  };

  const filteredPresets = BROLL_PRESETS.filter(
    (p) => presetCategory === 'all' || p.category === presetCategory
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-[#0B0F19] border border-violet-500/30 w-full max-w-4xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-950/40 via-purple-950/30 to-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shadow-sm shadow-violet-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Studio B-Roll & Visual Cutaways
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {clips.length} Klip
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sisipkan cuplikan video/foto sekunder, Picture-in-Picture (PiP), dan efek atmosferik di atas background
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Enable Switch */}
            <button
              onClick={handleToggleEnabled}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                bRoll.enabled
                  ? 'bg-violet-600/25 border-violet-500/50 text-violet-200 shadow-sm shadow-violet-500/30'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  bRoll.enabled ? 'bg-violet-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span>{bRoll.enabled ? 'B-Roll Aktif' : 'B-Roll Nonaktif'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL TABS NAVIGATION */}
        <div className="flex items-center justify-between px-5 border-b border-white/5 bg-[#080C14] text-xs font-semibold">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('clips')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'clips'
                  ? 'border-violet-500 text-violet-300 font-bold bg-violet-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Daftar Klip ({clips.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'presets'
                  ? 'border-violet-500 text-violet-300 font-bold bg-violet-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Pustaka Preset B-Roll</span>
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'stock'
                  ? 'border-violet-500 text-violet-300 font-bold bg-violet-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-emerald-400" />
              <span>🌐 Stok Video & Foto</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'ai'
                  ? 'border-violet-500 text-violet-300 font-bold bg-violet-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>⚡ AI Auto B-Roll</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-sm active:scale-95"
            >
              <Upload className="w-3 h-3" />
              <span>Upload Video / Foto</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              className="hidden"
              onChange={handleCustomUpload}
            />
          </div>
        </div>

        {/* MODAL MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {/* TAB 1: CLIPS LIST & DETAILED INSPECTOR */}
          {activeTab === 'clips' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: Clips List (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-2.5 max-h-[62vh] overflow-y-auto pr-1 custom-scrollbar">
                {clips.length === 0 ? (
                  <div className="p-8 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center gap-3 text-slate-400">
                    <Film className="w-10 h-10 text-violet-500/40" />
                    <div>
                      <p className="font-bold text-white text-sm">Belum Ada Klip B-Roll</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">
                        Tambahkan cuplikan dari Pustaka Preset, upload video sendiri, atau gunakan AI Auto B-Roll.
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setActiveTab('presets')}
                        className="px-3 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/40 text-violet-200 border border-violet-500/40 text-xs font-bold transition-all"
                      >
                        Pilih Preset B-Roll
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all"
                      >
                        Upload Video
                      </button>
                    </div>
                  </div>
                ) : (
                  clips.map((clip, idx) => {
                    const isSelected = clip.id === selectedClipId;
                    return (
                      <div
                        key={clip.id}
                        onClick={() => setSelectedClipId(clip.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-violet-950/40 border-violet-500/60 shadow-md shadow-violet-950/50'
                            : 'bg-[#0E1322] border-white/5 hover:border-white/20 hover:bg-[#12182c]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Thumbnail */}
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-black/60 relative shrink-0 border border-white/10">
                            {clip.mediaType === 'video' ? (
                              <div className="w-full h-full flex items-center justify-center bg-violet-950/50 text-violet-300 text-xs font-bold">
                                🎥 MP4
                              </div>
                            ) : (
                              <img
                                src={clip.url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 font-mono text-[8px] text-white">
                              {(clip.endSec - clip.startSec).toFixed(1)}s
                            </span>
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-white truncate">
                              {idx + 1}. {clip.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                              <span className="text-violet-300">
                                {formatSec(clip.startSec)} - {formatSec(clip.endSec)}
                              </span>
                              <span>•</span>
                              <span className="capitalize px-1 py-0.2 rounded bg-white/5 text-slate-300 font-sans text-[9px]">
                                {clip.displayMode === 'pip'
                                  ? 'PiP'
                                  : clip.displayMode === 'split_screen'
                                  ? 'Split'
                                  : clip.displayMode === 'blend_overlay'
                                  ? 'Blend'
                                  : 'Cutaway'}
                              </span>
                              {clip.visualEffect && clip.visualEffect !== 'none' && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans text-[9px] border border-amber-500/30">
                                    <Zap className="w-2.5 h-2.5" />
                                    {VISUAL_EFFECT_OPTIONS.find((o) => o.id === clip.visualEffect)?.shortLabel || clip.visualEffect}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {onSeek && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSeek(clip.startSec);
                              }}
                              className="p-1 rounded-lg hover:bg-violet-500/20 text-slate-400 hover:text-violet-300 transition-colors"
                              title="Lompat ke klip ini di player"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClip(clip.id);
                            }}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Hapus klip ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Selected Clip Inspector / Settings (7 cols) */}
              <div className="lg:col-span-7 bg-[#0E1322] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
                {selectedClip ? (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div>
                        <h3 className="font-bold text-sm text-white flex items-center gap-2">
                          <span>⚙️ Pengaturan Klip:</span>
                          <span className="text-violet-300">{selectedClip.name}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Atur waktu tampil, mode tampilan, posisi, dan transisi untuk klip ini
                        </p>
                      </div>

                      {onSeek && (
                        <button
                          onClick={() => onSeek(selectedClip.startSec)}
                          className="px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/40 text-violet-200 border border-violet-500/40 text-xs font-bold flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Lihat Preview</span>
                        </button>
                      )}
                    </div>

                    {/* 1. DISPLAY MODE SELECTOR */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
                        <Layers className="w-3.5 h-3.5 text-violet-400" />
                        <span>Mode Tampilan B-Roll:</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          {
                            mode: 'cutaway',
                            label: 'Cutaway',
                            desc: 'Layar Penuh',
                            icon: Maximize2,
                          },
                          {
                            mode: 'pip',
                            label: 'PiP (Floating)',
                            desc: 'Jendela Melayang',
                            icon: Tv,
                          },
                          {
                            mode: 'split_screen',
                            label: 'Split Screen',
                            desc: 'Belah 50:50',
                            icon: Columns,
                          },
                          {
                            mode: 'blend_overlay',
                            label: 'Blend Overlay',
                            desc: 'Tekstur & Cahaya',
                            icon: Flame,
                          },
                        ].map(({ mode, label, desc, icon: IconComp }) => (
                          <button
                            key={mode}
                            onClick={() =>
                              handleUpdateClip(selectedClip.id, {
                                displayMode: mode as BRollDisplayMode,
                              })
                            }
                            className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                              selectedClip.displayMode === mode
                                ? 'bg-violet-600/25 border-violet-500 text-white shadow-sm shadow-violet-500/30'
                                : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/15 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <IconComp className="w-4 h-4 text-violet-400" />
                              {selectedClip.displayMode === mode && (
                                <Check className="w-3.5 h-3.5 text-violet-300" />
                              )}
                            </div>
                            <span className="font-bold text-xs">{label}</span>
                            <span className="text-[10px] text-slate-400">{desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. SPECIFIC SETTINGS FOR MODES */}
                    {selectedClip.displayMode === 'pip' && (
                      <div className="p-3 bg-black/40 border border-violet-500/20 rounded-xl space-y-3">
                        <label className="text-xs font-bold text-violet-300">
                          Posisi Picture-in-Picture:
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                          {[
                            { pos: 'top_right', label: '↗️ Kanan Atas' },
                            { pos: 'top_left', label: '↖️ Kiri Atas' },
                            { pos: 'bottom_right', label: '↘️ Kanan Bawah' },
                            { pos: 'bottom_left', label: '↙️ Kiri Bawah' },
                            { pos: 'center', label: '🎯 Tengah' },
                          ].map(({ pos, label }) => (
                            <button
                              key={pos}
                              onClick={() =>
                                handleUpdateClip(selectedClip.id, {
                                  pipPosition: pos as BRollPipPosition,
                                })
                              }
                              className={`py-1.5 px-2 rounded-lg border text-center font-medium text-[11px] transition-all ${
                                (selectedClip.pipPosition || 'top_right') === pos
                                  ? 'bg-violet-600 text-white border-violet-400 font-bold'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* PiP Window Scale */}
                        <div className="flex items-center justify-between gap-3 text-xs pt-1">
                          <span className="text-slate-400">Ukuran Jendela PiP:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.2"
                              max="0.55"
                              step="0.02"
                              value={selectedClip.pipScale || 0.32}
                              onChange={(e) =>
                                handleUpdateClip(selectedClip.id, {
                                  pipScale: parseFloat(e.target.value),
                                })
                              }
                              className="w-28 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-violet-500"
                            />
                            <span className="font-mono text-violet-300 font-bold w-10 text-right">
                              {Math.round((selectedClip.pipScale || 0.32) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedClip.displayMode === 'blend_overlay' && (
                      <div className="p-3 bg-black/40 border border-violet-500/20 rounded-xl space-y-3">
                        <label className="text-xs font-bold text-violet-300">
                          Mode Blending Atmosfer:
                        </label>
                        <div className="grid grid-cols-4 gap-1.5 text-xs">
                          {['screen', 'lighten', 'overlay', 'color-dodge'].map((bMode) => (
                            <button
                              key={bMode}
                              onClick={() => handleUpdateClip(selectedClip.id, { blendMode: bMode })}
                              className={`py-1.5 px-2 rounded-lg border text-center font-medium capitalize text-[11px] transition-all ${
                                (selectedClip.blendMode || 'screen') === bMode
                                  ? 'bg-violet-600 text-white border-violet-400 font-bold'
                                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              {bMode}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. TIMESTAMPS & DURATION */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Mulai Tampil (Detik):</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={duration}
                            value={selectedClip.startSec}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              handleUpdateClip(selectedClip.id, {
                                startSec: val,
                                endSec: Math.max(val + 0.5, selectedClip.endSec),
                              });
                            }}
                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-cyan-300 w-full focus:outline-none focus:border-violet-500"
                          />
                          <button
                            onClick={() =>
                              handleUpdateClip(selectedClip.id, {
                                startSec: parseFloat(currentTime.toFixed(1)),
                                endSec: Math.max(
                                  currentTime + 0.5,
                                  selectedClip.endSec
                                ),
                              })
                            }
                            className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] whitespace-nowrap"
                            title="Set waktu mulai ke posisi player saat ini"
                          >
                            Posisi Player
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-1">
                          <Clock className="w-3.5 h-3.5 text-violet-400" />
                          <span>Selesai Tampil (Detik):</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min={selectedClip.startSec + 0.1}
                            max={duration}
                            value={selectedClip.endSec}
                            onChange={(e) => {
                              const val = Math.max(
                                selectedClip.startSec + 0.2,
                                parseFloat(e.target.value) || selectedClip.startSec + 1
                              );
                              handleUpdateClip(selectedClip.id, { endSec: val });
                            }}
                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-violet-300 w-full focus:outline-none focus:border-violet-500"
                          />
                          <button
                            onClick={() =>
                              handleUpdateClip(selectedClip.id, {
                                endSec: Math.max(selectedClip.startSec + 0.5, parseFloat(currentTime.toFixed(1))),
                              })
                            }
                            className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] whitespace-nowrap"
                            title="Set waktu selesai ke posisi player saat ini"
                          >
                            Posisi Player
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 4. OPACITY & KEN BURNS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Transparansi:</span>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={selectedClip.opacity ?? 1}
                          onChange={(e) =>
                            handleUpdateClip(selectedClip.id, {
                              opacity: parseFloat(e.target.value),
                            })
                          }
                          className="w-24 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-violet-500"
                        />
                        <span className="font-mono text-white text-[11px]">
                          {Math.round((selectedClip.opacity ?? 1) * 100)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedClip.kenBurns !== false}
                            onChange={(e) =>
                              handleUpdateClip(selectedClip.id, {
                                kenBurns: e.target.checked,
                              })
                            }
                            className="rounded accent-violet-500"
                          />
                          <span>Zoom Ken Burns Halus</span>
                        </label>
                      </div>
                    </div>

                    {/* 5. EFEK KAMERA VISUAL */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          Efek Kamera Visual B-Roll
                        </label>
                        {selectedClip.visualEffect && selectedClip.visualEffect !== 'none' && (
                          <span className="text-[10px] text-amber-400 font-medium">
                            Intensitas: {Math.round((selectedClip.visualEffectIntensity ?? 1) * 100)}%
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {VISUAL_EFFECT_OPTIONS.map((opt) => {
                          const isSelected = (selectedClip.visualEffect || 'none') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                handleUpdateClip(selectedClip.id, {
                                  visualEffect: opt.id as VisualEffectType,
                                  visualEffectIntensity: selectedClip.visualEffectIntensity ?? 1,
                                })
                              }
                              className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col gap-0.5 ${
                                isSelected
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                              }`}
                            >
                              <span className="font-semibold text-[11px] truncate flex items-center gap-1">
                                <span>{opt.icon}</span>
                                <span>{opt.shortLabel}</span>
                              </span>
                              <span className="text-[9px] opacity-70 line-clamp-1">{opt.desc}</span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedClip.visualEffect && selectedClip.visualEffect !== 'none' && (
                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-[11px] text-slate-400">Intensitas Efek:</span>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={selectedClip.visualEffectIntensity ?? 1}
                            onChange={(e) =>
                              handleUpdateClip(selectedClip.id, {
                                visualEffectIntensity: parseFloat(e.target.value),
                              })
                            }
                            className="flex-1 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                          />
                          <span className="font-mono text-white text-[11px] w-10 text-right">
                            {Math.round((selectedClip.visualEffectIntensity ?? 1) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 gap-2">
                    <Sliders className="w-8 h-8 text-slate-600" />
                    <p className="text-xs">
                      Pilih salah satu klip B-roll di kolom kiri untuk mengatur mode tampilan, ukuran PiP, dan waktu tampilnya.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRESET B-ROLL LIBRARY */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'Semua Kategori' },
                  { id: 'cinematic', label: '🎬 Sinematik' },
                  { id: 'atmosphere', label: '🌧️ Atmosfer & Hujan' },
                  { id: 'retro', label: '📼 Retro & VHS' },
                  { id: 'abstract', label: '🔮 Abstrak & Kosmik' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPresetCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      presetCategory === cat.id
                        ? 'bg-violet-600 text-white font-bold shadow-sm shadow-violet-500/30'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="bg-[#0E1322] border border-white/10 rounded-2xl overflow-hidden hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-950/40 transition-all flex flex-col group"
                  >
                    {/* Image Preview */}
                    <div className="h-32 w-full relative overflow-hidden bg-black/50">
                      <img
                        src={preset.thumbnailUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[9px] font-bold text-violet-300 border border-violet-500/30 uppercase tracking-wider">
                        {preset.defaultMode}
                      </span>
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-slate-300">
                        {preset.durationSec}s
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-white group-hover:text-violet-300 transition-colors">
                          {preset.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {preset.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleAddClipFromPreset(preset)}
                        className="w-full py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Pasang di {formatSec(currentTime)}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: STOCK MEDIA SEARCH (PEXELS, PIXABAY, WIKIMEDIA, CURATED) */}
          {activeTab === 'stock' && (
            <div className="h-full">
              <StockMediaBrowser
                compact
                onSelectForBRoll={(item, mode) => handleAddClipFromStock(item, mode)}
              />
            </div>
          )}

          {/* TAB 4: AI SUBTITLE B-ROLL ANALYZER & RECOMMENDER */}
          {activeTab === 'ai' && (
            <div className="h-full overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto">
              {/* HEADER BANNER */}
              <div className="p-4 bg-gradient-to-br from-violet-950/50 via-purple-900/30 to-slate-900/50 border border-violet-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Kecerdasan Buatan (AI) Analisis Subtitle & B-Roll
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-xl leading-relaxed">
                      AI menganalisis makna, kata kunci emosional, dan timestamp subtitle lagu untuk mencari footage video terbaik di Pexels & Pixabay secara otomatis.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {lyrics.length > 0 ? `✓ ${lyrics.length} Baris Subtitle` : '⚠️ Subtitle Belum Dimuat'}
                  </span>
                </div>
              </div>

              {/* LOADING STATE */}
              {isAiAnalyzing && (
                <div className="p-8 bg-[#0E1322] border border-violet-500/40 rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-violet-500/30 border-t-violet-400 animate-spin" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">{aiProgressText}</h4>
                    <p className="text-xs text-slate-400">
                      Mengekstrak visual query dan mengambil stok video HD dari Pexels & Pixabay...
                    </p>
                  </div>
                  <div className="w-full max-w-md bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full transition-all duration-300"
                      style={{ width: `${aiProgressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-cyan-300">{aiProgressPercent}% Selesai</span>
                </div>
              )}

              {/* CONFIGURATION & TRIGGER (When no recommendations yet and not analyzing) */}
              {!isAiAnalyzing && aiRecommendations.length === 0 && (
                <div className="space-y-5">
                  <div className="p-5 bg-[#0E1322] border border-white/10 rounded-2xl space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-violet-400" />
                      <span>Pengaturan Analisis AI</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Density Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Kepadatan Klip B-Roll
                        </label>
                        <select
                          value={aiDensity}
                          onChange={(e) => setAiDensity(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-200 outline-none focus:border-violet-500"
                        >
                          <option value="minimal">Minimal (3 - 4 Klip: Hanya Jeda & Momen Kunci)</option>
                          <option value="balanced">Seimbang (5 - 7 Klip: Rekomendasi Standar Sinematik)</option>
                          <option value="cinematic">Sinematik Kaya (8 - 10 Klip: Banyak Variasi Cutaway)</option>
                        </select>
                      </div>

                      {/* Display Mode Preference */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Gaya Tampilan Favorit
                        </label>
                        <select
                          value={aiPreferredMode}
                          onChange={(e) => setAiPreferredMode(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-200 outline-none focus:border-violet-500"
                        >
                          <option value="auto">Otomatis (Menyesuaikan Makna & Karakter Tiap Baris)</option>
                          <option value="cutaway">Utamakan Cutaway (Layar Penuh Sinematik)</option>
                          <option value="pip">Utamakan Picture-in-Picture (PiP Neon Window)</option>
                          <option value="blend_overlay">Utamakan Blend Overlay (Hamparan Efek Cuaca/Atmosfer)</option>
                        </select>
                      </div>
                    </div>

                    {/* Groq LLM Toggle & Key Input */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useGroqLlM}
                            onChange={(e) => setUseGroqLlM(e.target.checked)}
                            className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-slate-900 border-slate-700"
                          />
                          <span className="text-xs font-semibold text-slate-200">
                            Gunakan Deep Reasoning AI (Groq Llama 3.3 Versatile / Llama 3.1)
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400">Opsional</span>
                      </div>

                      {useGroqLlM && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400" />
                              <input
                                type="password"
                                value={groqKeyInput}
                                onChange={(e) => setGroqKeyInput(e.target.value)}
                                placeholder="Masukkan Groq API Key (gsk_...)"
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white font-mono outline-none focus:border-violet-500"
                              />
                            </div>
                            <a
                              href="https://console.groq.com/keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-amber-400 hover:text-amber-300 underline shrink-0"
                            >
                              Dapatkan Kunci Gratis
                            </a>
                          </div>
                          {groqKeyInput.trim().startsWith('sk-') && !groqKeyInput.trim().startsWith('gsk_') && (
                            <p className="text-[10px] text-amber-300">
                              ℹ️ Kunci diawali &quot;sk-&quot; (KoboiLLM hanya untuk Whisper STT). Untuk Deep Reasoning LLM, gunakan API Key dari console.groq.com (gsk_...).
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={handleRunAiAnalysis}
                      disabled={isAiAnalyzing}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 active:scale-[0.99] transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-cyan-300" />
                      <span>Analisis Subtitle & Cari Stok B-Roll Sekarang</span>
                    </button>
                  </div>

                  {/* QUICK PRESET GENERATORS */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Atau Gunakan Generator Pola Cepat:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-[#0E1322] border border-white/5 flex flex-col justify-between gap-2 hover:border-violet-500/40 transition-all">
                        <div>
                          <span className="text-lg">🎸</span>
                          <h5 className="font-bold text-white text-xs mt-1">Jeda Instrumental</h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Pasang B-roll di intro sebelum vokal mulai dan jeda melodi.
                          </p>
                        </div>
                        <button
                          onClick={() => handleAutoGenerateBRoll('instrumental')}
                          className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                        >
                          ⚡ Isi Jeda Musik
                        </button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0E1322] border border-white/5 flex flex-col justify-between gap-2 hover:border-violet-500/40 transition-all">
                        <div>
                          <span className="text-lg">🔥</span>
                          <h5 className="font-bold text-white text-xs mt-1">Reff / Chorus Boost</h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Pasang B-roll PiP pada baris lirik reff/chorus lagu.
                          </p>
                        </div>
                        <button
                          onClick={() => handleAutoGenerateBRoll('chorus')}
                          className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                        >
                          ⚡ Reff / Chorus B-Roll
                        </button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0E1322] border border-white/5 flex flex-col justify-between gap-2 hover:border-violet-500/40 transition-all">
                        <div>
                          <span className="text-lg">⏱️</span>
                          <h5 className="font-bold text-white text-xs mt-1">Interval Dinamis (18s)</h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Sebar cuplikan B-roll secara periodik di sepanjang lagu.
                          </p>
                        </div>
                        <button
                          onClick={() => handleAutoGenerateBRoll('beat_interval')}
                          className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                        >
                          ⚡ Sebar Periodik
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* RECOMMENDATION RESULTS REVIEW LIST */}
              {!isAiAnalyzing && aiRecommendations.length > 0 && (
                <div className="space-y-3 pb-8">
                  {/* Action Bar */}
                  <div className="p-3 bg-[#0E1322] border border-violet-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {aiRecommendations.filter((r) => r.selected).length} dari {aiRecommendations.length} Klip Dipilih
                      </span>
                      <button
                        onClick={() => {
                          const allSelected = aiRecommendations.every((r) => r.selected);
                          setAiRecommendations((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
                        }}
                        className="text-[11px] text-violet-300 hover:text-white underline ml-1"
                      >
                        {aiRecommendations.every((r) => r.selected) ? 'Batal Pilih Semua' : 'Pilih Semua'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAiRecommendations([])}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Analisis Baru</span>
                      </button>

                      <button
                        onClick={handleApplyAiRecommendations}
                        className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-violet-600/30 active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                        <span>Terapkan ({aiRecommendations.filter((r) => r.selected).length}) ke Timeline</span>
                      </button>
                    </div>
                  </div>

                  {/* Recommendation Cards */}
                  <div className="space-y-3">
                    {aiRecommendations.map((rec) => {
                      const media = rec.suggestedMedia;
                      const isPlaying = playingVideoId === rec.id;

                      return (
                        <div
                          key={rec.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row gap-3.5 items-start md:items-center justify-between ${
                            rec.selected
                              ? 'bg-[#0E1322] border-violet-500/50 shadow-sm'
                              : 'bg-black/30 border-white/5 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={rec.selected}
                              onChange={() => handleToggleRecSelected(rec.id)}
                              className="mt-1 w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                            />

                            {/* Video / Thumbnail Area */}
                            <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10 group">
                              {media ? (
                                <>
                                  {isPlaying ? (
                                    <video
                                      src={media.downloadUrl || media.previewUrl}
                                      autoPlay
                                      loop
                                      muted
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <img
                                      src={media.thumbnail || media.previewUrl}
                                      alt={media.title}
                                      className="w-full h-full object-cover"
                                    />
                                  )}

                                  <button
                                    onClick={() => setPlayingVideoId(isPlaying ? null : rec.id)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 text-white transition-opacity"
                                  >
                                    <Play className={`w-5 h-5 ${isPlaying ? 'opacity-0' : 'opacity-90'}`} />
                                  </button>

                                  <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[8px] text-white">
                                    {rec.durationSec}s
                                  </span>

                                  <span
                                    className={`absolute top-1 left-1 px-1 py-0.2 rounded text-[7px] font-bold uppercase text-white ${
                                      media.source === 'pexels'
                                        ? 'bg-emerald-600'
                                        : media.source === 'pixabay'
                                        ? 'bg-blue-600'
                                        : 'bg-violet-600'
                                    }`}
                                  >
                                    {media.source}
                                  </span>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-violet-950/40 text-[10px] text-slate-400 p-1 text-center">
                                  Preset Visual
                                </div>
                              )}
                            </div>

                            {/* Subtitle & AI Reasoning Info */}
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 font-mono text-[10px] font-bold">
                                  {formatSec(rec.startSec)} - {formatSec(rec.endSec)}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-300 text-[10px] font-semibold">
                                  {rec.mood}
                                </span>
                              </div>

                              {rec.matchedLyricText && (
                                <p className="text-xs font-bold text-white truncate">
                                  "{rec.matchedLyricText}"
                                </p>
                              )}

                              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                                {rec.reasoning}
                              </p>

                              {media && (
                                <p className="text-[10px] text-slate-500 truncate">
                                  Footage: <span className="text-slate-300">{media.title}</span> (oleh {media.author || 'Pexels/Pixabay'})
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Mode Selector & Alternative Swapper */}
                          <div className="flex sm:flex-col items-end gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                            <div className="flex items-center gap-1.5 w-full justify-between md:justify-end">
                              <span className="text-[10px] text-slate-400 md:hidden">Mode:</span>
                              <select
                                value={rec.recommendedMode}
                                onChange={(e) => handleChangeRecMode(rec.id, e.target.value as BRollDisplayMode)}
                                className="px-2 py-1 bg-slate-900 border border-white/15 rounded-lg text-xs font-semibold text-violet-200 outline-none focus:border-violet-500"
                              >
                                <option value="cutaway">Layar Penuh (Cutaway)</option>
                                <option value="pip">Jendela (PiP)</option>
                                <option value="split_screen">Belah Layar (Split 50/50)</option>
                                <option value="blend_overlay">Hamparan Efek (Blend)</option>
                              </select>
                            </div>

                            {rec.alternativeMedia && rec.alternativeMedia.length > 0 && (
                              <button
                                onClick={() => handleCycleRecMedia(rec.id)}
                                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-all"
                                title="Ganti ke kandidat video lain dari Pexels/Pixabay"
                              >
                                <RotateCcw className="w-3 h-3 text-cyan-400" />
                                <span>Ganti Video Lain ({rec.alternativeMedia.length})</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#070A12] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span>Total Klip: <strong className="text-violet-300">{clips.length}</strong></span>
            <span>•</span>
            <span>Waktu Player: <strong className="font-mono text-cyan-300">{formatSec(currentTime)}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-md shadow-violet-600/30 transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
