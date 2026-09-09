import React, { useRef, useState } from 'react';
import {
  Mic2,
  Sparkles,
  Upload,
  Download,
  Plus,
  Trash2,
  Play,
  Layers,
  Clock,
  Crosshair,
  FastForward,
  Rewind,
  Zap,
  Flame,
  Check,
  Save,
  RotateCcw,
  X,
  Type,
} from 'lucide-react';
import type {
  SubtitleConfig,
  LyricSegment,
  SubtitleStyle,
  SubtitlePosition,
  HighlightAnimation,
  AudioTrack,
} from '../../types/visualizer';
import { DEFAULT_POWER_WORDS } from '../../types/visualizer';
import { VIRAL_SUBTITLE_PRESETS } from '../../data/viralSubtitlePresets';
import { WhisperAIService } from '../../utils/whisperAi';
import { globalAudioEngine } from '../../utils/audioEngine';

interface LyricsTabProps {
  config: SubtitleConfig;
  onChange: (newConfig: SubtitleConfig) => void;
  onOpenWhisperModal: () => void;
  onOpenSubtitleEditor?: () => void;
  currentTime: number;
  currentTrack?: AudioTrack;
}

const STYLES: { id: SubtitleStyle; label: string; desc: string }[] = [
  { id: 'text_bounce_pop', label: '💥 Text Bounce / Text Pop', desc: 'Membesar & mengecil cepat elastis mengikuti ketukan bass musik' },
  { id: 'wave_warp_displace', label: '🌊 Wave Warp / Turbulent Displace', desc: 'Efek bergelombang & turbulensi cair membuat teks bergetar & bergoyang' },
  { id: 'random_scale_jitter', label: '⚡ Random Scale / Position Jitter', desc: 'Acak posisi atas-bawah, kiri-kanan & ukuran font spontan di tiap beat' },
  { id: 'kinetic_typography', label: '🌪️ Kinetic Typography', desc: 'Font tradisional & eksperimental acak dinamis mengikuti emosi & ritme' },
  { id: 'ransom_note', label: '📰 Ransom Note (Surat Tebusan)', desc: 'Potongan majalah/koran beda font, warna & miring ala 90s punk/grunge' },
  { id: 'brutalism_y2k', label: '👾 Brutalism / Y2K Aesthetic', desc: 'Tipografi brutalist cyber, shadow kotak hitam pekat, aksen bRuTaL' },
  { id: 'mrbeast_viral', label: '⚡ MrBeast Viral', desc: 'Impact tebal, outline hitam 8px & pop bounce agresif' },
  { id: 'hormozi_kinetic', label: '🔥 Hormozi Kinetic', desc: 'Chunk 2-3 kata kapital, tilt pop & sticker pill' },
  { id: 'karaoke_glow', label: '🌊 Karaoke Wave', desc: 'Sapuan ombak pendar cyan dengan glow halus' },
  { id: 'comic_pop', label: '💥 Comic Pop', desc: 'Tipografi komik elastis rubber band & pill oranye' },
  { id: 'cinematic_film', label: '🎬 Film Sinematik', desc: 'Font Cinzel/Inter elegan dengan bar letterbox' },
  { id: 'color_pill', label: '🏷️ Sticker Pill', desc: 'Kotak stiker kontras tinggi di belakang kata aktif' },
  { id: 'viral_pop', label: '⭐ Viral Pop', desc: 'Tipografi kuning kontras tinggi video pendek' },
  { id: 'neon_outline', label: '🌆 Holo Outline', desc: 'Gaya hologram magenta & cyan cyberpunk' },
  { id: 'classic_box', label: '📦 Classic Box', desc: 'Latar kotak transparan kaca minimalis' },
];

const POSITIONS: { id: SubtitlePosition; label: string; defaultY: number }[] = [
  { id: 'center_bottom', label: 'Center Bottom (74%)', defaultY: 74 },
  { id: 'bottom', label: 'Bottom (86%)', defaultY: 86 },
  { id: 'center', label: 'Center Stage (50%)', defaultY: 50 },
  { id: 'top', label: 'Top Header (16%)', defaultY: 16 },
  { id: 'custom', label: 'Custom (Manual Sliders)', defaultY: 74 },
];

const HIGHLIGHT_ANIMS: { id: HighlightAnimation; label: string; icon: string; desc: string }[] = [
  { id: 'beat_bounce_pop', label: 'Beat Bounce & Pop', icon: '💥', desc: 'Membesar & mengecil cepat mengikuti ketukan bass musik' },
  { id: 'wave_warp', label: 'Wave Warp & Turbulent', icon: '🌊', desc: 'Efek bergelombang & turbulensi cair bergetar vertikal-horizontal' },
  { id: 'position_scale_jitter', label: 'Random Scale & Jitter', icon: '⚡', desc: 'Acak posisi & ukuran font spontan di tiap ketukan beat' },
  { id: 'bounce_pop', label: 'Bounce & Pop', icon: '🎯', desc: 'Hormozi elastic pop & bounce' },
  { id: 'slide_up', label: 'Slide-Up & Snap', icon: '🚀', desc: 'Meluncur dari bawah dengan snap punchy' },
  { id: 'zoom_pulse', label: 'Zoom Punch', icon: '🔍', desc: 'Hentakan zoom agresif mengikuti bass' },
  { id: 'shake_wobble', label: 'Jitter & Wobble', icon: '💫', desc: 'Getaran kinetik heboh retensi video' },
  { id: 'rubber_band', label: 'Rubber Band', icon: '🌀', desc: 'Efek melar membal elastis ala CapCut' },
  { id: 'karaoke_wave', label: 'Karaoke Wave', icon: '🌊', desc: 'Sapuan ombak warna pendar menyala' },
  { id: 'glow_pulse', label: 'Neon Flare', icon: '✨', desc: 'Pendar cahaya neon berpijar terang' },
  { id: 'box_sticker', label: 'Sticker Box', icon: '🏷️', desc: 'Kotak stiker kontras mengunci tiap kata' },
  { id: 'color_fill', label: 'Color Fill', icon: '🎨', desc: 'Perubahan warna transisi halus' },
];

const FONTS = [
  'Montserrat',
  'Anton',
  'Bebas Neue',
  'Black Ops One',
  'Cinzel',
  'Kanit',
  'Outfit',
  'Poppins',
  'Rubik',
  'Syne',
  'Orbitron',
  'Rajdhani',
  'Syncopate',
  'Inter',
];

export const LyricsTab: React.FC<LyricsTabProps> = ({
  config,
  onChange,
  onOpenWhisperModal,
  onOpenSubtitleEditor,
  currentTime,
  currentTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPowerWordInput, setNewPowerWordInput] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleSaveLyrics = async () => {
    onChange(config);
    if (config.lyrics && config.lyrics.length > 0) {
      if (currentTrack?.id) {
        localStorage.setItem(`specterr_lyrics_${currentTrack.id}`, JSON.stringify(config.lyrics));
      }
      if (currentTrack?.title) {
        localStorage.setItem(`specterr_lyrics_${currentTrack.title}`, JSON.stringify(config.lyrics));
      }
      try {
        localStorage.setItem(
          'specterr_active_song_lyrics',
          JSON.stringify({
            trackId: currentTrack?.id || '',
            trackTitle: currentTrack?.title || '',
            lyrics: config.lyrics,
            timestamp: Date.now(),
          })
        );
      } catch {}
      try {
        const { updateCustomTrackLyrics } = await import('../../utils/idb');
        await updateCustomTrackLyrics(config.lyrics, currentTrack?.title, currentTrack?.id);
      } catch (e) {
        console.warn('IDB update failed:', e);
      }
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const update = (partial: Partial<SubtitleConfig>) => {
    onChange({ ...config, ...partial });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          let parsed: LyricSegment[] = [];
          if (file.name.endsWith('.lrc')) {
            parsed = WhisperAIService.parseLrc(text);
          } else {
            parsed = WhisperAIService.parseSrt(text);
          }

          if (parsed.length > 0) {
            update({ lyrics: parsed, enabled: true });
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportSrt = () => {
    const srt = WhisperAIService.exportToSrt(config.lyrics);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.srt';
    a.click();
  };

  const handleExportLrc = () => {
    const lrc = WhisperAIService.exportToLrc(config.lyrics);
    const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.lrc';
    a.click();
  };

  const handleAddLine = () => {
    const newSeg: LyricSegment = {
      id: `seg-${Date.now()}`,
      start: Math.floor(currentTime),
      end: Math.floor(currentTime) + 4,
      text: 'New lyric line...',
    };
    update({ lyrics: [...config.lyrics, newSeg] });
  };

  const handleUpdateLine = (index: number, partial: Partial<LyricSegment>) => {
    const updated = [...config.lyrics];
    if (!updated[index]) return;

    const currentLine = updated[index];
    const finalStart = partial.start !== undefined ? partial.start : currentLine.start;
    const finalEnd = partial.end !== undefined ? partial.end : currentLine.end;
    const finalText = partial.text !== undefined ? partial.text : currentLine.text;

    // Recalculate words timestamps whenever timing or text changes to maintain sync!
    if (partial.text !== undefined || partial.start !== undefined || partial.end !== undefined) {
      const words = (finalText || '').trim().split(/\s+/).filter(Boolean);
      const segDur = Math.max(0.1, finalEnd - finalStart);
      const wordDur = segDur / Math.max(1, words.length);

      partial.words = words.map((w, wIdx) => ({
        word: w,
        start: Number((finalStart + wIdx * wordDur).toFixed(3)),
        end: Number((finalStart + (wIdx + 1) * wordDur).toFixed(3)),
      }));
    }

    updated[index] = {
      ...currentLine,
      ...partial,
      start: finalStart,
      end: finalEnd,
      text: finalText,
    };
    update({ lyrics: updated });
  };

  const handleDeleteLine = (index: number) => {
    const updated = config.lyrics.filter((_, idx) => idx !== index);
    update({ lyrics: updated });
  };

  const handleShiftAllLyrics = (deltaSeconds: number) => {
    if (!config.lyrics || config.lyrics.length === 0) return;
    const shifted = WhisperAIService.shiftLyricTimestamps(config.lyrics, deltaSeconds);
    update({ lyrics: shifted });
  };

  const handleApplyViralPreset = (preset: (typeof VIRAL_SUBTITLE_PRESETS)[0]) => {
    update({
      ...preset.config,
      viralPreset: preset.id,
      enabled: true,
    });
  };

  const handleAddPowerWord = () => {
    const word = newPowerWordInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!word) return;
    const currentList = config.powerWords && config.powerWords.length > 0 ? config.powerWords : DEFAULT_POWER_WORDS;
    if (!currentList.includes(word)) {
      update({
        powerWords: [...currentList, word],
        powerWordsEnabled: true,
      });
    }
    setNewPowerWordInput('');
  };

  const handleRemovePowerWord = (wordToRemove: string) => {
    const currentList = config.powerWords && config.powerWords.length > 0 ? config.powerWords : DEFAULT_POWER_WORDS;
    const updated = currentList.filter((w) => w !== wordToRemove);
    update({ powerWords: updated });
  };

  const handleResetPowerWords = () => {
    update({ powerWords: [...DEFAULT_POWER_WORDS] });
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Toggle Subtitle & AI Trigger */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Enable Lyrics & Subtitles</h4>
          <p className="text-[11px] text-slate-400">Display synchronized lyrics on the visualizer</p>
        </div>
        <button
          onClick={() => update({ enabled: !config.enabled })}
          className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
            config.enabled ? 'bg-cyan-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 2. Groq Whisper STT Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-indigo-500/15 border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
            <span className="text-xs font-extrabold text-white tracking-wide">Groq Whisper STT</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            ⚡ Groq Cloud LPU
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Transkripsi vokal audio ke lirik subtitle berketepatan tinggi secara instan bertenaga Groq Whisper API.
        </p>
        <button
          onClick={onOpenWhisperModal}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-black" />
          <span>⚡ Generate Subtitle dengan Groq API</span>
        </button>

        {onOpenSubtitleEditor && (
          <button
            onClick={onOpenSubtitleEditor}
            className="w-full py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-white text-xs font-black flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-md shadow-amber-500/10"
          >
            <Type className="w-4 h-4 text-amber-400" />
            <span>📝 Buka Editor Teks Subtitle (Cari & Ganti / Bulk Edit)</span>
          </button>
        )}

        <button
          onClick={handleSaveLyrics}
          className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg ${
            isSaved
              ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/50'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>✅ Subtitle Berhasil Disimpan!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-white" />
              <span>💾 Simpan Subtitle & Pengaturan</span>
            </>
          )}
        </button>
      </div>

      {config.enabled && (
        <>
          {/* 3. File Import / Export Toolbar */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".srt,.lrc"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import .SRT / .LRC</span>
            </button>

            <div className="flex gap-1">
              <button
                onClick={handleExportSrt}
                disabled={config.lyrics.length === 0}
                className="flex-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all disabled:opacity-40"
                title="Export as .SRT Subtitles"
              >
                <Download className="w-3.5 h-3.5 text-pink-400" />
                <span>SRT</span>
              </button>
              <button
                onClick={handleExportLrc}
                disabled={config.lyrics.length === 0}
                className="flex-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all disabled:opacity-40"
                title="Export as .LRC Karaoke"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>LRC</span>
              </button>
            </div>
          </div>

          {/* 4. Subtitle Typography, Animation & Positioning Controls */}
          <div className="space-y-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Gaya, Font & Animasi Subtitle</span>
            </label>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    const updates: Partial<SubtitleConfig> = { style: s.id };
                    if (s.id === 'hormozi_kinetic') {
                      updates.fontFamily = config.fontFamily || 'Montserrat';
                      updates.fontSize = Math.max(34, config.fontSize);
                      updates.highlightColor = config.highlightColor || '#FFE600';
                      updates.highlightAnimation = config.highlightAnimation || 'bounce_pop';
                      updates.maxWordsPerLine = config.maxWordsPerLine || 3;
                    }
                    update(updates);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    config.style === s.id
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>{s.label}</span>
                    {config.style === s.id && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{s.desc}</div>
                </button>
              ))}
            </div>

            {/* 4A. MENU PRESET GAYA SUBTITLE VIRAL (1-KLIK) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Preset Gaya Subtitle Viral</span>
                </label>
                <span className="text-[10px] font-mono text-slate-400">TikTok, Reels & Shorts</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VIRAL_SUBTITLE_PRESETS.map((preset) => {
                  const isSelected =
                    config.style === preset.config.style &&
                    (config.viralPreset === preset.id ||
                      (config.highlightAnimation === preset.config.highlightAnimation &&
                        config.fontFamily === preset.config.fontFamily));
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyViralPreset(preset)}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-98 ${
                        isSelected
                          ? 'bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-rose-500/20 border-amber-400 shadow-lg shadow-amber-500/10'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300'
                      }`}
                    >
                      {/* Top Bar with Emoji, Title & Badge */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                          <span className="text-sm">{preset.emoji}</span>
                          <span className="truncate">{preset.name}</span>
                        </div>
                        <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded-md bg-white/10 text-amber-300 border border-white/10 shrink-0 flex items-center gap-1">
                          {isSelected && <Check className="w-2.5 h-2.5 text-amber-400" />}
                          {preset.badge}
                        </span>
                      </div>

                      {/* Mini Live Preview Banner */}
                      <div
                        className="w-full py-1.5 px-2.5 rounded-lg bg-black/60 border border-white/10 flex items-center justify-between text-[11px] font-bold mb-1.5"
                        style={{ fontFamily: preset.config.fontFamily || 'Montserrat' }}
                      >
                        <span style={{ color: preset.textColor }}>LIRIK LAGU:</span>
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            color: preset.highlightColor,
                            backgroundColor: preset.config.powerWordsBgColor || 'transparent',
                          }}
                        >
                          KATA VIRAL
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                        {preset.desc}
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4B. GAYA DASAR SUBTITLE */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pilihan Gaya Tipografi</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const updates: Partial<SubtitleConfig> = { style: s.id };
                      if (s.id === 'hormozi_kinetic' || s.id === 'mrbeast_viral') {
                        updates.fontFamily = s.id === 'mrbeast_viral' ? 'Anton' : (config.fontFamily || 'Montserrat');
                        updates.fontSize = Math.max(34, config.fontSize);
                        updates.highlightColor = config.highlightColor || '#FFE600';
                        updates.highlightAnimation = config.highlightAnimation || 'bounce_pop';
                        updates.maxWordsPerLine = config.maxWordsPerLine || 3;
                      } else if (s.id === 'kinetic_typography') {
                        updates.fontFamily = 'Montserrat';
                        updates.fontSize = Math.max(36, config.fontSize);
                        updates.highlightColor = '#FFE600';
                        updates.highlightAnimation = 'bounce_pop';
                        updates.maxWordsPerLine = 3;
                        updates.wordByWordSing = true;
                      } else if (s.id === 'ransom_note') {
                        updates.fontFamily = 'Impact';
                        updates.fontSize = Math.max(34, config.fontSize);
                        updates.highlightColor = '#FFE800';
                        updates.highlightAnimation = 'box_sticker';
                        updates.maxWordsPerLine = 4;
                        updates.wordByWordSing = true;
                      } else if (s.id === 'brutalism_y2k') {
                        updates.fontFamily = 'Impact';
                        updates.fontSize = Math.max(36, config.fontSize);
                        updates.highlightColor = '#CCFF00';
                        updates.highlightAnimation = 'shake_wobble';
                        updates.maxWordsPerLine = 3;
                        updates.wordByWordSing = true;
                      } else if (s.id === 'text_bounce_pop') {
                        updates.fontFamily = 'Anton';
                        updates.fontSize = Math.max(42, config.fontSize);
                        updates.highlightColor = '#FFE600';
                        updates.strokeColor = '#000000';
                        updates.strokeWidth = 8;
                        updates.highlightAnimation = 'beat_bounce_pop';
                        updates.maxWordsPerLine = 3;
                        updates.wordByWordSing = true;
                      } else if (s.id === 'wave_warp_displace') {
                        updates.fontFamily = 'Montserrat';
                        updates.fontSize = Math.max(38, config.fontSize);
                        updates.highlightColor = '#00F0FF';
                        updates.strokeColor = '#07162C';
                        updates.strokeWidth = 5;
                        updates.highlightAnimation = 'wave_warp';
                        updates.maxWordsPerLine = 3;
                        updates.wordByWordSing = true;
                      } else if (s.id === 'random_scale_jitter') {
                        updates.fontFamily = 'Rubik';
                        updates.fontSize = Math.max(40, config.fontSize);
                        updates.highlightColor = '#FF0055';
                        updates.strokeColor = '#000000';
                        updates.strokeWidth = 7;
                        updates.highlightAnimation = 'position_scale_jitter';
                        updates.maxWordsPerLine = 3;
                        updates.wordByWordSing = true;
                      }
                      update(updates);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.style === s.id
                        ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>{s.label}</span>
                      {config.style === s.id && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4C. KOLEKSI GAYA ANIMASI TEKS KINETIK */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Koleksi Gaya Animasi Teks Kinetik</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase">
                  {config.highlightAnimation || 'bounce_pop'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Pilih gaya pergerakan kinetik tiap kata untuk memicu retensi visual maksimal di TikTok, Reels & Shorts:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {HIGHLIGHT_ANIMS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => update({ highlightAnimation: a.id })}
                    className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      (config.highlightAnimation || 'bounce_pop') === a.id
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 border-cyan-400 text-white shadow-md shadow-cyan-500/15 scale-[1.02]'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-200">
                      <span>{a.icon}</span>
                      <span className="truncate">{a.label}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate">{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4D. EMOTIVE TEXT HIGHLIGHTING / POWER WORDS */}
            <div className="pt-3 border-t border-white/10 p-3.5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>Power Words Highlighting</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                        EMOTIVE
                      </span>
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      Otomatis menonjolkan kata kunci emosional dengan warna & pill box kontras
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => update({ powerWordsEnabled: config.powerWordsEnabled === false ? true : false })}
                  className={`w-10 h-5 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    config.powerWordsEnabled !== false ? 'bg-rose-500' : 'bg-slate-700'
                  }`}
                  title="Aktifkan / Nonaktifkan Power Words"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.powerWordsEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {config.powerWordsEnabled !== false && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  {/* Colors & Pill Box Option */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-medium text-slate-300 mb-1">
                        Warna Teks Power Word
                      </span>
                      <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-xl border border-white/10">
                        <input
                          type="color"
                          value={config.powerWordsColor || '#FFFFFF'}
                          onChange={(e) => update({ powerWordsColor: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                          {config.powerWordsColor || '#FFFFFF'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-medium text-slate-300 mb-1">
                        Warna Pill Box Kontras
                      </span>
                      <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-xl border border-white/10">
                        <input
                          type="color"
                          value={config.powerWordsBgColor || '#E11D48'}
                          onChange={(e) => update({ powerWordsBgColor: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                          {config.powerWordsBgColor || '#E11D48'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Pill Box & Scale Slider */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => update({ powerWordsBox: config.powerWordsBox === false ? true : false })}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                        config.powerWordsBox !== false
                          ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                          : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                    >
                      <span className="text-[11px]">Gunakan Pill Box Kontras</span>
                      <span className="text-xs">{config.powerWordsBox !== false ? '✅' : '⚪'}</span>
                    </button>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 text-[10px]">Skala Power Word:</span>
                        <span className="font-mono text-rose-300 text-[10px] font-bold">
                          {(config.powerWordsScale || 1.25).toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="1.5"
                        step="0.05"
                        value={config.powerWordsScale || 1.25}
                        onChange={(e) => update({ powerWordsScale: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>
                  </div>

                  {/* Active Power Words Chips List */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                        <span>Daftar Kata Kunci Aktif</span>
                        <span className="text-slate-500">
                          ({(config.powerWords && config.powerWords.length > 0 ? config.powerWords : DEFAULT_POWER_WORDS).length})
                        </span>
                      </span>
                      <button
                        onClick={handleResetPowerWords}
                        className="text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                        title="Kembalikan kata kunci ke 30 kata bawaan"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Reset Standar</span>
                      </button>
                    </div>

                    {/* Chips Display */}
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 rounded-xl bg-black/40 border border-white/10 custom-scrollbar">
                      {(config.powerWords && config.powerWords.length > 0 ? config.powerWords : DEFAULT_POWER_WORDS).map((pw) => (
                        <span
                          key={pw}
                          className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10px] font-bold font-mono flex items-center gap-1 transition-all group"
                        >
                          <span>{pw}</span>
                          <button
                            onClick={() => handleRemovePowerWord(pw)}
                            className="hover:text-white p-0.5 rounded"
                            title={`Hapus kata ${pw}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add Custom Word Input */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <input
                        type="text"
                        value={newPowerWordInput}
                        onChange={(e) => setNewPowerWordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPowerWord();
                          }
                        }}
                        placeholder="Tambah kata emosional baru (misal: GOKIL, JUARA)..."
                        className="flex-1 px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                      />
                      <button
                        onClick={handleAddPowerWord}
                        className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Font Family & Colors */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="block text-[10px] font-medium text-slate-400 mb-1">Koleksi Font</span>
                  <select
                    value={config.fontFamily}
                    onChange={(e) => update({ fontFamily: e.target.value })}
                    className="w-full px-2.5 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f} className="bg-slate-900 text-white">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-[10px] font-medium text-slate-400 mb-1">Warna Highlight</span>
                  <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-xl border border-white/10">
                    <input
                      type="color"
                      value={config.highlightColor || '#FFE600'}
                      onChange={(e) => update({ highlightColor: e.target.value })}
                      className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-[11px] font-mono text-slate-300 uppercase truncate">
                      {config.highlightColor || '#FFE600'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Text Color & Outline Color */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="block text-[10px] font-medium text-slate-400 mb-1">Warna Teks Utama</span>
                  <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-xl border border-white/10">
                    <input
                      type="color"
                      value={config.textColor || '#FFFFFF'}
                      onChange={(e) => update({ textColor: e.target.value })}
                      className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-[11px] font-mono text-slate-300 uppercase truncate">
                      {config.textColor || '#FFFFFF'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-medium text-slate-400 mb-1">Warna Outline (Stroke)</span>
                  <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-xl border border-white/10">
                    <input
                      type="color"
                      value={config.strokeColor || '#000000'}
                      onChange={(e) => update({ strokeColor: e.target.value })}
                      className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-[11px] font-mono text-slate-300 uppercase truncate">
                      {config.strokeColor || '#000000'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Font Size & Outline Thickness Sliders */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium text-[11px]">Ukuran Font (Font Size)</span>
                  <span className="font-mono text-cyan-400 text-xs font-bold">{config.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="96"
                  step="2"
                  value={config.fontSize}
                  onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium text-[11px]">Ketebalan Outline (Stroke Width)</span>
                  <span className="font-mono text-cyan-400 text-xs font-bold">{config.strokeWidth ?? 4}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={config.strokeWidth ?? 4}
                  onChange={(e) => update({ strokeWidth: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium text-[11px] flex items-center gap-1.5">
                    <span>Jarak Antar Kata (Word Spacing)</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                      Anti-Tumpuk
                    </span>
                  </span>
                  <span className="font-mono text-cyan-400 text-xs font-bold">
                    {typeof config.wordSpacing === 'number' && config.wordSpacing !== 0
                      ? `${config.wordSpacing > 0 ? '+' : ''}${config.wordSpacing}px`
                      : 'Auto (Optimal)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="40"
                  step="1"
                  value={config.wordSpacing ?? 0}
                  onChange={(e) => update({ wordSpacing: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                  <span>Rapat (-6px)</span>
                  <button
                    type="button"
                    onClick={() => update({ wordSpacing: 0 })}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    Reset Auto
                  </button>
                  <span>Lebar (+40px)</span>
                </div>
              </div>
            </div>

            {/* Position Controls: Presets & Precision X/Y Sliders */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pengaturan Posisi Subtitle</span>
                </span>
                <button
                  onClick={() => update({ position: 'center_bottom', customPosY: 74, customPosX: 50 })}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                >
                  Reset Posisi
                </button>
              </div>

              {/* Preset Position Buttons */}
              <div className="grid grid-cols-4 gap-1">
                {POSITIONS.filter((p) => p.id !== 'custom').map((p) => (
                  <button
                    key={p.id}
                    onClick={() => update({ position: p.id, customPosY: p.defaultY })}
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-semibold text-center transition-all ${
                      config.position === p.id && (config.customPosY === undefined || config.customPosY === p.defaultY)
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.id === 'top' ? 'Atas' : p.id === 'center' ? 'Tengah' : p.id === 'center_bottom' ? 'Bawah-Tengah' : 'Bawah'}
                  </button>
                ))}
              </div>

              {/* Vertical Slider (Y) */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium text-[11px]">Posisi Vertikal (Tinggi Y)</span>
                  <span className="font-mono text-cyan-400 text-xs font-bold">
                    {config.customPosY ?? (config.position === 'top' ? 16 : config.position === 'center' ? 50 : config.position === 'bottom' ? 86 : 74)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="1"
                  value={config.customPosY ?? (config.position === 'top' ? 16 : config.position === 'center' ? 50 : config.position === 'bottom' ? 86 : 74)}
                  onChange={(e) => update({ customPosY: parseInt(e.target.value), position: 'custom' })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                  <span>Atas (5%)</span>
                  <span>Tengah (50%)</span>
                  <span>Bawah (95%)</span>
                </div>
              </div>

              {/* Horizontal Slider (X) */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium text-[11px]">Posisi Horizontal (Lebar X)</span>
                  <span className="font-mono text-cyan-400 text-xs font-bold">
                    {config.customPosX ?? 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="1"
                  value={config.customPosX ?? 50}
                  onChange={(e) => update({ customPosX: parseInt(e.target.value), position: 'custom' })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                  <span>Kiri (5%)</span>
                  <span className="text-cyan-400 font-bold">Tengah (50%)</span>
                  <span>Kanan (95%)</span>
                </div>
              </div>
            </div>

            {/* Anti-Overflow & Kinetic Layout Settings */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <div>
                    <span className="text-slate-300 font-medium text-[11px] block">Lebar Bungkus Teks (Auto-Wrap)</span>
                    <span className="text-[10px] text-slate-500">Mencegah teks subtitle bablas keluar layar</span>
                  </div>
                  <span className="font-mono text-emerald-400 text-xs font-bold">
                    {config.autoWrapWidth ?? 84}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  step="2"
                  value={config.autoWrapWidth ?? 84}
                  onChange={(e) => update({ autoWrapWidth: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Kinetic Words Per Chunk */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <div>
                    <span className="text-slate-300 font-medium text-[11px] block">Kata per Baris / Chunk Kinetik</span>
                    <span className="text-[10px] text-slate-500">2-4 kata untuk efek Hormozi Reels yang lincah</span>
                  </div>
                  <span className="font-mono text-amber-400 text-xs font-bold">
                    {config.maxWordsPerLine ?? 4} kata
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="1"
                  value={config.maxWordsPerLine ?? 4}
                  onChange={(e) => update({ maxWordsPerLine: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => update({ wordByWordSing: config.wordByWordSing === false ? true : false })}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  config.wordByWordSing !== false
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Word-by-Word</span>
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.wordByWordSing !== false ? '#F59E0B' : '#475569' }} />
              </button>

              <button
                onClick={() => update({ showTranslation: config.showTranslation === false ? true : false })}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  config.showTranslation !== false
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="shrink-0">🌍</span>
                  <span className="truncate">Dual Subtitle</span>
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.showTranslation !== false ? '#6366F1' : '#475569' }} />
              </button>

              <button
                onClick={() => update({ showBox: !config.showBox })}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  config.showBox
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <span>Glass / Sticker Box</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.showBox ? '#00F0FF' : '#475569' }} />
              </button>

              <button
                onClick={() => update({ reactToBeat: !config.reactToBeat })}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  config.reactToBeat
                    ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <span>Beat Pulse Bounce</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.reactToBeat ? '#EC4899' : '#475569' }} />
              </button>
            </div>
          </div>

          {/* 5. GLOBAL LYRIC TIME SYNC SHIFTER */}
          {config.lyrics.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Geser Waktu Semua Lirik (Time Shift)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                  Audio: {formatSeconds(currentTime)}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight">
                Jika lirik muncul terlalu cepat atau terlalu lambat, geser waktu seluruh lirik sekaligus:
              </p>

              <div className="grid grid-cols-6 gap-1">
                <button
                  onClick={() => handleShiftAllLyrics(-2.0)}
                  className="px-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-300 border border-white/10 hover:border-rose-500/30 text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 transition-all"
                  title="Mundurkan 2 detik"
                >
                  <Rewind className="w-3 h-3" />
                  <span>-2.0s</span>
                </button>
                <button
                  onClick={() => handleShiftAllLyrics(-0.5)}
                  className="px-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-300 border border-white/10 hover:border-rose-500/30 text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 transition-all"
                  title="Mundurkan 0.5 detik"
                >
                  -0.5s
                </button>
                <button
                  onClick={() => handleShiftAllLyrics(-0.1)}
                  className="px-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-300 border border-white/10 hover:border-rose-500/30 text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 transition-all"
                  title="Mundurkan 0.1 detik"
                >
                  -0.1s
                </button>
                <button
                  onClick={() => handleShiftAllLyrics(0.1)}
                  className="px-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 transition-all"
                  title="Majukan 0.1 detik"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => handleShiftAllLyrics(0.5)}
                  className="px-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 transition-all"
                  title="Majukan 0.5 detik"
                >
                  +0.5s
                </button>
                <button
                  onClick={() => handleShiftAllLyrics(2.0)}
                  className="px-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 transition-all"
                  title="Majukan 2 detik"
                >
                  <span>+2.0s</span>
                  <FastForward className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => {
                  if (config.lyrics.length === 0) return;
                  const delta = currentTime - config.lyrics[0].start;
                  handleShiftAllLyrics(delta);
                }}
                className="w-full py-2 px-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-xs font-bold text-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                title="Geser waktu seluruh lirik agar lirik pertama mulai tepat pada detik audio yang sedang diputar"
              >
                <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                <span>🎯 Pas-kan Lirik Pertama ke Waktu Putar Saat Ini ({formatSeconds(currentTime)})</span>
              </button>
            </div>
          )}

          {/* 6. Interactive Timeline Lyrics List */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Mic2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lyrics Lines ({config.lyrics.length})</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveLyrics}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                    isSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  }`}
                  title="Simpan perubahan baris lirik"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSaved ? 'Tersimpan!' : 'Simpan'}</span>
                </button>

                <button
                  onClick={handleAddLine}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Line</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {config.lyrics.map((seg, idx) => {
                const isActive = currentTime >= seg.start && currentTime <= seg.end;
                const dur = Math.max(0.5, seg.end - seg.start);
                return (
                  <div
                    key={seg.id || idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400'
                        : 'bg-black/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Seek button */}
                        <button
                          onClick={() => globalAudioEngine.seek(seg.start)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
                          title="Putar dari baris lirik ini"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>

                        {/* One-Click Sync to Current Audio Head */}
                        <button
                          onClick={() => {
                            const cur = Math.round(currentTime * 10) / 10;
                            handleUpdateLine(idx, {
                              start: cur,
                              end: Math.round((cur + dur) * 10) / 10,
                            });
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-[10px] font-bold text-indigo-300 flex items-center gap-1 transition-all"
                          title="Kunci titik mulai baris lirik ini tepat di detik lagu saat ini"
                        >
                          <Crosshair className="w-3 h-3 text-indigo-400" />
                          <span>📍 Kunci Detik Ini ({formatSeconds(currentTime)})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteLine(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors"
                          title="Delete line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Time Range Stepper */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="flex items-center justify-between bg-black/50 px-2 py-1 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400">Mulai:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateLine(idx, { start: Math.max(0, Math.round((seg.start - 0.5) * 10) / 10) })}
                            className="px-1 text-[10px] text-slate-400 hover:text-white"
                          >
                            -
                          </button>
                          <span className="text-[11px] font-mono text-cyan-300 font-bold">{seg.start.toFixed(1)}s</span>
                          <button
                            onClick={() => handleUpdateLine(idx, { start: Math.round((seg.start + 0.5) * 10) / 10 })}
                            className="px-1 text-[10px] text-slate-400 hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-black/50 px-2 py-1 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400">Selesai:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateLine(idx, { end: Math.max(seg.start + 0.5, Math.round((seg.end - 0.5) * 10) / 10) })}
                            className="px-1 text-[10px] text-slate-400 hover:text-white"
                          >
                            -
                          </button>
                          <span className="text-[11px] font-mono text-pink-300 font-bold">{seg.end.toFixed(1)}s</span>
                          <button
                            onClick={() => handleUpdateLine(idx, { end: Math.round((seg.end + 0.5) * 10) / 10 })}
                            className="px-1 text-[10px] text-slate-400 hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Lyric Text Inputs (Original & Translation) */}
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={seg.text}
                        onChange={(e) => handleUpdateLine(idx, { text: e.target.value })}
                        placeholder="Lirik Utama..."
                        className="w-full px-3 py-1.5 bg-black/60 border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        value={seg.translation || ''}
                        onChange={(e) => handleUpdateLine(idx, { translation: e.target.value })}
                        placeholder="🌍 Terjemahan / Romaji (opsional)..."
                        className="w-full px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-[11px] text-indigo-200 placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
