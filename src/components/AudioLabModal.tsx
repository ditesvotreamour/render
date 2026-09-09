import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Flame,
  Music,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  Disc3,
  Scissors,
} from 'lucide-react';
import type { AudioTrack, VisualizerConfig, ParticlesConfig } from '../types/visualizer';
import { globalAudioEngine } from '../utils/audioEngine';
import type { SongAnalysisResult, AudioSectionMarker, StemIsolationMode } from '../utils/audioAnalyzerAi';

interface AudioLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrack;
  visualizer: VisualizerConfig;
  particles: ParticlesConfig;
  onVisualizerChange: (val: VisualizerConfig) => void;
  onParticlesChange: (val: ParticlesConfig) => void;
  onSelectReffSegment?: (start: number, end: number) => void;
}

export const AudioLabModal: React.FC<AudioLabModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  visualizer,
  particles,
  onVisualizerChange,
  onParticlesChange,
  onSelectReffSegment,
}) => {
  const [analysis, setAnalysis] = useState<SongAnalysisResult | null>(globalAudioEngine.lastAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [stemMode, setStemMode] = useState<StemIsolationMode>('full');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);
  const [syncApplied, setSyncApplied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    globalAudioEngine.analyzeCurrentTrack().then((res) => {
      if (isMounted && res) {
        setAnalysis(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentTrack]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await globalAudioEngine.analyzeCurrentTrack();
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  if (!isOpen) return null;

  const handleStemChange = (mode: StemIsolationMode) => {
    setStemMode(mode);
    globalAudioEngine.setStemMode(mode);
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const newTaps = [...tapTimes, now].filter((t) => now - t < 3000); // keep taps within 3s
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);
      if (bpm >= 60 && bpm <= 200) {
        setTappedBpm(bpm);
      }
    }
  };

  const handleApplyBpmSync = () => {
    const targetBpm = tappedBpm || analysis?.bpm || 128;
    // Mathematically scale rotation speed and particle speeds
    const speedFactor = targetBpm / 128;
    onVisualizerChange({
      ...visualizer,
      smoothing: 0.82,
      bassBoost: Math.min(2.5, Math.max(1.4, 1.8 * speedFactor)),
    });
    onParticlesChange({
      ...particles,
      speed: Math.min(2.0, Math.max(0.6, 1.2 * speedFactor)),
    });
    setSyncApplied(true);
    setTimeout(() => setSyncApplied(false), 2500);
  };

  const handleSeekSection = (section: AudioSectionMarker) => {
    globalAudioEngine.seek(section.start);
    if (!globalAudioEngine.isPlaying) {
      globalAudioEngine.play();
    }
  };

  const handleUseForExport = (section: AudioSectionMarker) => {
    if (onSelectReffSegment) {
      onSelectReffSegment(section.start, section.end);
      onClose();
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeBpm = tappedBpm || analysis?.bpm || 128;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-white/15 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md">
              <Activity className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Audio Lab & AI Analyzer</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  v2.0
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                AI BPM detection, key signature, drop markers & stem isolation
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
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto scrollbar-thin">
          {/* 1. BPM & Musical Key Intelligence */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-indigo-500/10 to-pink-500/10 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Disc3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Tempo & Musical Key</span>
              </span>
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* BPM Card */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Tempo (BPM)</span>
                <div className="flex items-baseline gap-1.5 my-1">
                  <span className="text-2xl font-black font-mono text-cyan-300 tracking-tight">
                    {activeBpm}
                  </span>
                  <span className="text-xs font-bold text-slate-400">BPM</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>Confidence</span>
                  <span className="text-emerald-400 font-bold">
                    {Math.round((analysis?.confidence || 0.9) * 100)}%
                  </span>
                </div>
              </div>

              {/* Musical Key Card */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Tangga Nada (Key)</span>
                <div className="flex items-baseline gap-1.5 my-1">
                  <span className="text-xl font-black font-mono text-pink-300 tracking-tight">
                    {analysis?.musicalKey || 'C Major'}
                  </span>
                </div>
                <div className="text-[9px] text-slate-400">
                  <span>Pitch Chroma Analysis</span>
                </div>
              </div>
            </div>

            {/* Tap Tempo & Sync Visualizer Action */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleTapTempo}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span>🥁 Tap Tempo ({tapTimes.length})</span>
              </button>

              <button
                onClick={handleApplyBpmSync}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  syncApplied
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20'
                }`}
              >
                {syncApplied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tempo Synced!</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Sync Visualizer to BPM</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. AI DROP & CHORUS / REFF MARKERS */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Beat Drop & Reff Sections ({analysis?.sections.length || 0})</span>
              </span>
              <span className="text-[10px] text-slate-400">Audio Energy Curve</span>
            </div>

            {/* Energy Curve SVG Mini Chart */}
            {analysis?.energyCurve && analysis.energyCurve.length > 0 && (
              <div className="p-2 rounded-xl bg-black/50 border border-white/10">
                <div className="h-14 w-full flex items-end gap-[1px]">
                  {analysis.energyCurve.map((val, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-gradient-to-t from-cyan-500 to-pink-500 rounded-t-sm opacity-75 hover:opacity-100 transition-opacity"
                      style={{ height: `${Math.max(4, val * 100)}%` }}
                      title={`Detik ${idx}s - Energy: ${Math.round(val * 100)}%`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sections List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {analysis?.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 flex items-center justify-between gap-2 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSeekSection(sec)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
                      title="Putar dari bagian ini"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{sec.name}</span>
                        {sec.type === 'drop' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                            HIGH ENERGY
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatSeconds(sec.start)} → {formatSeconds(sec.end)} ({Math.round(sec.end - sec.start)}s)
                      </span>
                    </div>
                  </div>

                  {onSelectReffSegment && (
                    <button
                      onClick={() => handleUseForExport(sec)}
                      className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-[10px] font-bold text-pink-300 flex items-center gap-1 transition-all"
                      title="Gunakan bagian ini untuk ekspor video TikTok/Shorts"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Pakai untuk Export</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. STEM ISOLATION EQ FILTER MODES */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Stem Isolation & Frequency EQ Focus</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                {stemMode.replace('_', ' ')}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-tight">
              Pilih fokus frekuensi audio agar visualizer spektrum bereaksi khusus ke instrumen tertentu:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStemChange('full')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  stemMode === 'full'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  <span>Full Range Master</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">20Hz - 20kHz Studio balance</div>
              </button>

              <button
                onClick={() => handleStemChange('bass_focus')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  stemMode === 'bass_focus'
                    ? 'bg-pink-500/20 border-pink-400 text-pink-200 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-pink-400" />
                  <span>Drum & 808 Bass</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Low-Pass 240Hz Kick isolation</div>
              </button>

              <button
                onClick={() => handleStemChange('vocal_focus')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  stemMode === 'vocal_focus'
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Music className="w-3 h-3 text-indigo-400" />
                  <span>Vocal & Lead Melody</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Band-Pass 1.2kHz Human voice</div>
              </button>

              <button
                onClick={() => handleStemChange('treble_focus')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  stemMode === 'treble_focus'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Crisp Treble & Hats</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">High-Pass 3.2kHz Hi-hats & air</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-black/20 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Current: <strong className="text-white">{currentTrack.title}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
