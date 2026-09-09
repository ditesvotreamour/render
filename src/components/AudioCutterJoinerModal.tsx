import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Scissors,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Flame,
  Clock,
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Music2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  TrendingUp,
  TrendingDown,
  Disc,
} from 'lucide-react';
import type { AudioTrack, SubtitleConfig } from '../types/visualizer';
import { globalAudioEngine } from '../utils/audioEngine';
import { AudioTrimmerJoiner, sliceLyrics } from '../utils/audioTrimmerJoiner';
import { AudioWaveformCanvas } from './AudioWaveformCanvas';

interface AudioCutterJoinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrack;
  subtitleConfig: SubtitleConfig;
  onTrackChanged: (file: File, newLyrics?: SubtitleConfig['lyrics']) => Promise<void>;
}

type ActiveTab = 'cutter' | 'joiner';

export const AudioCutterJoinerModal: React.FC<AudioCutterJoinerModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  subtitleConfig,
  onTrackChanged,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cutter');

  // --- TAB 1: CUTTER & EDITOR STATES ---
  const [trackDuration, setTrackDuration] = useState<number>(180);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(60);
  const [fadeInSec, setFadeInSec] = useState<number>(0);
  const [fadeOutSec, setFadeOutSec] = useState<number>(0);
  const [volumeGain, setVolumeGain] = useState<number>(1.0);
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav'>('mp3');
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 320>(320);
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isPreviewLooping, setIsPreviewLooping] = useState<boolean>(false);
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [trimSuccessMessage, setTrimSuccessMessage] = useState<string | null>(null);

  // --- TAB 2: JOINER STATES ---
  const [joinFiles, setJoinFiles] = useState<{ file: File; duration: number }[]>([]);
  const [crossfadeSec, setCrossfadeSec] = useState<number>(2);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinProgress, setJoinProgress] = useState<number>(0);
  const [joinStatusText, setJoinStatusText] = useState<string>('');
  const [joinResultFile, setJoinResultFile] = useState<File | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  // Sync duration when modal opens or track changes
  useEffect(() => {
    if (!isOpen) return;

    const dur = globalAudioEngine.duration || 180;
    setTrackDuration(dur);

    // Default trim range: start at 0, end at min(60, dur)
    const initialEnd = Math.min(60, Math.floor(dur));
    setTrimStart(0);
    setTrimEnd(initialEnd);
    setTrimSuccessMessage(null);
    setJoinResultFile(null);
    setJoinError(null);
  }, [isOpen, currentTrack]);

  // Handle trim loop preview
  useEffect(() => {
    if (!isPreviewLooping) {
      globalAudioEngine.setTrimRange(null);
      return;
    }

    globalAudioEngine.setTrimRange({ start: trimStart, end: trimEnd });
    globalAudioEngine.seek(trimStart);
    globalAudioEngine.play();

    return () => {
      // Don't auto reset trimRange if modal closes while previewing unless user closed
    };
  }, [isPreviewLooping, trimStart, trimEnd]);

  // Keep playhead cursor in sync with AudioEngine
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;
    const updatePlayhead = () => {
      setPlayheadTime(globalAudioEngine.currentTime);
      animId = requestAnimationFrame(updatePlayhead);
    };
    animId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  const formatSecOnly = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- CUTTER ACTIONS ---
  const handleTogglePreview = () => {
    if (isPreviewLooping) {
      globalAudioEngine.pause();
      setIsPreviewLooping(false);
      globalAudioEngine.setTrimRange(null);
    } else {
      setIsPreviewLooping(true);
    }
  };

  // Preset: AI Reff Drop Finder
  const handlePresetAiReff = async () => {
    let analysis = globalAudioEngine.lastAnalysis;
    if (!analysis) {
      analysis = await globalAudioEngine.analyzeCurrentTrack();
    }

    if (analysis && analysis.sections.length > 0) {
      // Find highest energy section or drop/chorus
      const dropSection =
        analysis.sections.find((s) => s.type === 'drop' || s.type === 'chorus') ||
        analysis.sections.reduce((max, s) => (s.energy > max.energy ? s : max), analysis.sections[0]);

      if (dropSection) {
        const start = Math.max(0, Math.floor(dropSection.start));
        const end = Math.min(trackDuration, Math.ceil(dropSection.end));
        setTrimStart(start);
        setTrimEnd(end);
        if (isPreviewLooping) {
          globalAudioEngine.seek(start);
        }
        return;
      }
    }

    // Fallback: take middle 45s of the track
    const mid = trackDuration / 2;
    const s = Math.max(0, Math.floor(mid - 20));
    const e = Math.min(trackDuration, Math.floor(mid + 25));
    setTrimStart(s);
    setTrimEnd(e);
  };

  const handlePresetHook = (durationSec: number) => {
    const s = trimStart;
    const e = Math.min(trackDuration, s + durationSec);
    setTrimEnd(e);
    if (isPreviewLooping) {
      globalAudioEngine.seek(s);
    }
  };

  const handleResetFull = () => {
    setTrimStart(0);
    setTrimEnd(Math.floor(trackDuration));
    if (isPreviewLooping) {
      globalAudioEngine.seek(0);
    }
  };

  // Execute Trim
  const handleApplyTrim = async (andDownload: boolean = false) => {
    try {
      setIsTrimming(true);
      setTrimSuccessMessage(null);

      // 1. Fetch current track audio blob (supports custom & synthesized sample tracks)
      const audioBlob = await AudioTrimmerJoiner.getTrackAudioBlob(currentTrack);

      const ext = exportFormat === 'wav' ? 'wav' : 'mp3';
      const safeTitle = (currentTrack.title || 'Audio')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 35);
      const trimmedName = `${safeTitle}_Edit_${Math.round(trimStart)}-${Math.round(trimEnd)}s.${ext}`;

      const trimResult = await AudioTrimmerJoiner.trimAudioFile(
        audioBlob,
        trimStart,
        trimEnd,
        trimmedName,
        {
          fadeInDuration: fadeInSec,
          fadeOutDuration: fadeOutSec,
          volumeGain: volumeGain,
          format: exportFormat,
          mp3Bitrate: mp3Bitrate,
        }
      );

      if (andDownload) {
        const url = URL.createObjectURL(trimResult.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = trimmedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setTrimSuccessMessage(
          `✅ File berhasil diunduh (${exportFormat.toUpperCase()} ${
            exportFormat === 'mp3' ? `${mp3Bitrate}kbps` : 'Lossless'
          }): ${trimmedName}`
        );
        setIsTrimming(false);
        return;
      }

      // 2. Synchronously adjust and slice subtitle timestamps so they stay perfectly in sync
      const adjustedLyrics = sliceLyrics(subtitleConfig.lyrics, trimStart, trimEnd);

      // 3. Stop preview loop and clear trimRange
      setIsPreviewLooping(false);
      globalAudioEngine.setTrimRange(null);

      // 4. Update track in parent & AudioEngine
      await onTrackChanged(trimResult.file, adjustedLyrics);

      setTrimSuccessMessage(`Berhasil memotong lagu (${Math.round(trimResult.duration)}s) & memperbarui visualizer!`);
    } catch (err: any) {
      console.error('Trim error:', err);
      alert(err.message || 'Gagal memotong audio.');
    } finally {
      setIsTrimming(false);
    }
  };

  // --- JOINER ACTIONS ---
  const handleAddFilesToJoin = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setJoinError(null);
    const newItems: { file: File; duration: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await AudioTrimmerJoiner.decodeAudio(file);
        newItems.push({ file, duration: buffer.duration });
      } catch (err) {
        console.warn('Failed to decode file:', file.name, err);
      }
    }

    setJoinFiles((prev) => [...prev, ...newItems]);
  };

  const handleAddCurrentTrackToJoin = async () => {
    try {
      if (currentTrack.url.startsWith('blob:') || currentTrack.url.startsWith('http')) {
        const res = await fetch(currentTrack.url);
        const blob = await res.blob();
        const file = new File([blob], `${currentTrack.title || 'Current Track'}.mp3`, { type: blob.type || 'audio/mp3' });
        const buffer = await AudioTrimmerJoiner.decodeAudio(file);
        setJoinFiles((prev) => [...prev, { file, duration: buffer.duration }]);
      } else {
        alert('Trek saat ini adalah trek demo sintetis. Silakan pilih file audio dari perangkat Anda.');
      }
    } catch (err) {
      console.error('Failed to add current track:', err);
    }
  };

  const handleRemoveJoinItem = (index: number) => {
    setJoinFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveJoinItem = (index: number, direction: 'up' | 'down') => {
    setJoinFiles((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Estimate total duration
  const estimatedTotalDuration = joinFiles.reduce((total, item, idx) => {
    if (idx === 0) return item.duration;
    return total + item.duration - crossfadeSec;
  }, 0);

  const handleExecuteJoin = async () => {
    if (joinFiles.length < 2) {
      setJoinError('Silakan tambahkan minimal 2 file audio untuk disambungkan.');
      return;
    }

    try {
      setIsJoining(true);
      setJoinProgress(0);
      setJoinStatusText('Menyiapkan audio engine...');
      setJoinError(null);
      setJoinResultFile(null);

      const rawFiles = joinFiles.map((item) => item.file);
      const result = await AudioTrimmerJoiner.joinAudioFiles(
        rawFiles,
        crossfadeSec,
        (pct, msg) => {
          setJoinProgress(pct);
          setJoinStatusText(msg);
        }
      );

      setJoinResultFile(result.file);
      setJoinProgress(100);
      setJoinStatusText('Penggabungan selesai!');
    } catch (err: any) {
      console.error('Join error:', err);
      setJoinError(err.message || 'Gagal menyambung file audio.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleApplyJoinedTrack = async () => {
    if (!joinResultFile) return;
    try {
      await onTrackChanged(joinResultFile);
      onClose();
    } catch (err: any) {
      setJoinError(err.message || 'Gagal memuat lagu gabungan ke player.');
    }
  };

  const handleDownloadJoinedTrack = () => {
    if (!joinResultFile) return;
    const url = URL.createObjectURL(joinResultFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = joinResultFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-5 animate-in fade-in">
      <div className="bg-[#0D121F] border border-white/15 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#090D17]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white flex items-center gap-2">
                Studio Editor Audio & MP3
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Waveform interaktif, Fade In/Out, Volume Gain, dan Ekspor MP3 320k / WAV.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isPreviewLooping) {
                globalAudioEngine.pause();
                globalAudioEngine.setTrimRange(null);
              }
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#0A0E1A] shrink-0">
          <button
            onClick={() => setActiveTab('cutter')}
            className={`flex-1 py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'cutter'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>1. Potong & Edit MP3 (Waveform)</span>
          </button>

          <button
            onClick={() => {
              if (isPreviewLooping) {
                setIsPreviewLooping(false);
                globalAudioEngine.setTrimRange(null);
              }
              setActiveTab('joiner');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'joiner'
                ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Sambung Lagu (Joiner / Megamix)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* ======================================================== */}
          {/* TAB 1: CUTTER / REFF SLICER */}
          {/* ======================================================== */}
          {activeTab === 'cutter' && (
            <div className="space-y-5">
              {/* Current Track Info */}
              <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Music2 className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {currentTrack.artist} • Durasi Total: <strong className="text-cyan-300 font-mono">{formatSecOnly(trackDuration)}</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleTogglePreview}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                    isPreviewLooping
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-rose-500/20'
                      : 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-cyan-500/20'
                  }`}
                >
                  {isPreviewLooping ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Preview</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Putar Potongan</span>
                    </>
                  )}
                </button>
              </div>

              {/* Range Selector & Sliders */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#080B14] border border-cyan-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Rentang Potongan Audio</span>
                  </span>
                  <div className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                    Hasil Potongan: {Math.max(0, trimEnd - trimStart).toFixed(1)}s ({formatSecOnly(trimEnd - trimStart)})
                  </div>
                </div>

                {/* Interactive Audio Waveform Canvas */}
                <AudioWaveformCanvas
                  currentTrack={currentTrack}
                  duration={trackDuration}
                  currentTime={playheadTime}
                  isPlaying={isPreviewLooping}
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  fadeInSec={fadeInSec}
                  fadeOutSec={fadeOutSec}
                  onChangeRange={(start, end) => {
                    setTrimStart(start);
                    setTrimEnd(end);
                    if (isPreviewLooping) {
                      globalAudioEngine.setTrimRange({ start, end });
                    }
                  }}
                  onSeek={(sec) => {
                    globalAudioEngine.seek(sec);
                    setPlayheadTime(sec);
                  }}
                />

                {/* Dual Precision Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Start Slider */}
                  <div className="space-y-1.5 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                        <span>Titik Mulai (Start):</span>
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">{formatTime(trimStart)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, trimEnd - 0.5)}
                      step="0.1"
                      value={trimStart}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTrimStart(val);
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* End Slider */}
                  <div className="space-y-1.5 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                        <span>Titik Berhenti (End):</span>
                      </span>
                      <span className="font-mono text-pink-300 font-bold">{formatTime(trimEnd)}</span>
                    </div>
                    <input
                      type="range"
                      min={trimStart + 0.5}
                      max={trackDuration}
                      step="0.1"
                      value={trimEnd}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTrimEnd(val);
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
                    />
                  </div>
                </div>

                {/* Audio Effects: Fade In/Out & Volume Gain Booster */}
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Efek Transisi & Mastering Output</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Fade In */}
                    <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-cyan-400" />
                          <span>Fade In:</span>
                        </span>
                        <span className="font-mono text-cyan-300 font-bold">{fadeInSec.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5.0"
                        step="0.5"
                        value={fadeInSec}
                        onChange={(e) => setFadeInSec(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <div className="text-[10px] text-slate-500">Transisi lembut awal lagu</div>
                    </div>

                    {/* Fade Out */}
                    <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-pink-400" />
                          <span>Fade Out:</span>
                        </span>
                        <span className="font-mono text-pink-300 font-bold">{fadeOutSec.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5.0"
                        step="0.5"
                        value={fadeOutSec}
                        onChange={(e) => setFadeOutSec(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
                      />
                      <div className="text-[10px] text-slate-500">Peredupan halus akhir lagu</div>
                    </div>

                    {/* Volume Gain Booster */}
                    <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-amber-400" />
                          <span>Volume Gain:</span>
                        </span>
                        <span className="font-mono text-amber-300 font-bold">{Math.round(volumeGain * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={volumeGain}
                        onChange={(e) => setVolumeGain(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                      <div className="text-[10px] text-slate-500">Anti-clipping soft limiter</div>
                    </div>
                  </div>

                  {/* Format & Bitrate Selection */}
                  <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Format File Download:</span>
                      </span>

                      <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10 text-xs">
                        <button
                          onClick={() => setExportFormat('mp3')}
                          className={`px-3 py-1 rounded font-bold transition-all ${
                            exportFormat === 'mp3'
                              ? 'bg-cyan-500 text-black shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          MP3 (Audio Ringan & Kompatibel)
                        </button>
                        <button
                          onClick={() => setExportFormat('wav')}
                          className={`px-3 py-1 rounded font-bold transition-all ${
                            exportFormat === 'wav'
                              ? 'bg-cyan-500 text-black shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          WAV (Lossless 16-bit)
                        </button>
                      </div>
                    </div>

                    {exportFormat === 'mp3' && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">Kualitas Bitrate MP3:</span>
                        <div className="flex gap-1.5">
                          {([320, 192, 128] as const).map((rate) => (
                            <button
                              key={rate}
                              onClick={() => setMp3Bitrate(rate)}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border transition-all ${
                                mp3Bitrate === rate
                                  ? 'bg-indigo-500/30 border-indigo-500 text-indigo-300 shadow-sm'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {rate} kbps {rate === 320 ? '🔥 Studio Master' : rate === 192 ? 'Standar' : 'Hemat'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Preset Cepat Potong Audio:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={handlePresetAiReff}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 border border-pink-500/40 text-pink-300 flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm group"
                  >
                    <Flame className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                    <span>🔥 Ambil Reff (AI)</span>
                  </button>

                  <button
                    onClick={() => handlePresetHook(15)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>15s Hook (Reels)</span>
                  </button>

                  <button
                    onClick={() => handlePresetHook(30)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>30s Viral Hook</span>
                  </button>

                  <button
                    onClick={handleResetFull}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Penuh</span>
                  </button>
                </div>
              </div>

              {/* Success Notification */}
              {trimSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{trimSuccessMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleApplyTrim(false)}
                  disabled={isTrimming}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isTrimming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sedang Memproses Audio...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" />
                      <span>Terapkan Potongan ke Visualizer</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleApplyTrim(true)}
                  disabled={isTrimming}
                  className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  title={`Simpan potongan ke file .${exportFormat} di komputermu`}
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>
                    Download {exportFormat.toUpperCase()}{' '}
                    {exportFormat === 'mp3' ? `(${mp3Bitrate}k)` : ''}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: MULTI-TRACK AUDIO JOINER */}
          {/* ======================================================== */}
          {activeTab === 'joiner' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Daftar Lagu yang Akan Disambungkan</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Urutkan trek sesuai urutan putar yang diinginkan.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddCurrentTrackToJoin}
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Lagu Saat Ini</span>
                  </button>

                  <button
                    onClick={() => fileUploadInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Upload File</span>
                  </button>
                  <input
                    ref={fileUploadInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddFilesToJoin(e.target.files);
                      if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Track List */}
              <div className="space-y-2 min-h-[140px] max-h-56 overflow-y-auto pr-1">
                {joinFiles.length === 0 ? (
                  <div className="h-36 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center p-4">
                    <Layers className="w-8 h-8 text-slate-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-300">Belum ada file audio yang dipilih</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Klik "+ Upload File" atau "+ Lagu Saat Ini" untuk menambahkan 2, 3, atau 4 lagu.
                    </p>
                  </div>
                ) : (
                  joinFiles.map((item, index) => (
                    <div
                      key={index}
                      className="p-2.5 sm:p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 flex items-center justify-between gap-2 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-white truncate">{item.file.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Durasi: <span className="text-cyan-300">{formatSecOnly(item.duration)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Controls: Up, Down, Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveJoinItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                          title="Pindah ke Atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveJoinItem(index, 'down')}
                          disabled={index === joinFiles.length - 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                          title="Pindah ke Bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveJoinItem(index)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all"
                          title="Hapus Lagu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Crossfade Selector & Summary */}
              <div className="p-3 sm:p-4 rounded-2xl bg-[#080B14] border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Efek Transisi Antar Lagu (Crossfade):</span>
                  </span>

                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                    {[0, 1, 2, 3].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setCrossfadeSec(sec)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          crossfadeSec === sec
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec === 0 ? '0s (Gapless)' : `${sec}s (DJ Blend)`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Trek: <strong className="text-white">{joinFiles.length} Lagu</strong></span>
                  <span className="text-slate-400">
                    Estimasi Durasi Gabungan: <strong className="text-cyan-300 font-mono">{formatSecOnly(estimatedTotalDuration)}</strong>
                  </span>
                </div>
              </div>

              {/* Progress or Error */}
              {isJoining && (
                <div className="space-y-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                  <div className="flex justify-between text-xs font-bold text-indigo-300">
                    <span>{joinStatusText}</span>
                    <span>{joinProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300"
                      style={{ width: `${joinProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {joinError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{joinError}</span>
                </div>
              )}

              {/* Result Actions */}
              {joinResultFile ? (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sukses! {joinResultFile.name} siap digunakan.</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={handleApplyJoinedTrack}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Muat & Putar Lagu Gabungan Sekarang</span>
                    </button>

                    <button
                      onClick={handleDownloadJoinedTrack}
                      className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Download className="w-4 h-4 text-cyan-400" />
                      <span>Download File WAV</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleExecuteJoin}
                  disabled={isJoining || joinFiles.length < 2}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyambung Lagu ({joinProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Sambungkan Jadi 1 Lagu Panjang</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#080B14] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Audio diproses 100% instan di browser Anda (tanpa upload ke server).
          </span>
          <button
            onClick={() => {
              if (isPreviewLooping) {
                globalAudioEngine.pause();
                globalAudioEngine.setTrimRange(null);
              }
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 hover:text-white transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
