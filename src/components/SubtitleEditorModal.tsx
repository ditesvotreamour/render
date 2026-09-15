import React, { useState } from 'react';
import {
  X,
  Type,
  Play,
  Plus,
  Trash2,
  Search,
  Check,
  Save,
  FileText,
  List,
  FastForward,
  Rewind,
  Crosshair,
  Download,
  Sparkles,
  Scissors,
  Combine,
  ArrowRight,
  ArrowLeft,
  Target,
} from 'lucide-react';
import type { LyricSegment, SubtitleConfig, AudioTrack } from '../types/visualizer';
import { globalAudioEngine } from '../utils/audioEngine';
import { WhisperAIService } from '../utils/whisperAi';

interface SubtitleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtitle: SubtitleConfig;
  duration: number;
  currentTime: number;
  currentTrack?: AudioTrack;
  onSubtitleChange: (newSubtitle: SubtitleConfig) => void;
  onSeek?: (time: number) => void;
  onSave?: (overrideSubtitle?: SubtitleConfig) => void;
}

export const SubtitleEditorModal: React.FC<SubtitleEditorModalProps> = ({
  isOpen,
  onClose,
  subtitle,
  duration,
  currentTime,
  currentTrack,
  onSubtitleChange,
  onSeek,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'lines' | 'bulk'>('lines');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);

  const lyrics = subtitle.lyrics || [];

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const updateLyrics = (newLyrics: LyricSegment[]) => {
    const cleanLyrics = newLyrics.map((l) => {
      const copy = { ...l };
      delete (copy as any).__wmCache;
      delete (copy as any).__wmCacheKey;
      return copy;
    });

    onSubtitleChange({
      ...subtitle,
      enabled: true, // Always keep subtitles enabled when editing lyrics
      lyrics: cleanLyrics,
    });
  };

  const handleSaveSubtitle = async () => {
    // Strip stale render cache keys so the canvas immediately re-measures words
    const cleanLyrics = lyrics.map((l) => {
      const copy = { ...l };
      delete (copy as any).__wmCache;
      delete (copy as any).__wmCacheKey;
      return copy;
    });

    const updatedConfig: SubtitleConfig = {
      ...subtitle,
      enabled: true, // CRITICAL: Always ensure subtitle is ON so it renders in preview & exported video!
      lyrics: cleanLyrics,
    };

    // 1. Immediately apply latest lyrics and enabled state to parent state
    onSubtitleChange(updatedConfig);

    // 2. Trigger parent manual project save with FRESH config (avoids React closure race condition)
    if (onSave) {
      onSave(updatedConfig);
    }

    // 3. Save to localStorage immediately as active backup bound to this song
    if (cleanLyrics.length > 0) {
      try {
        if (currentTrack?.id) {
          localStorage.setItem(`specterr_lyrics_${currentTrack.id}`, JSON.stringify(cleanLyrics));
        }
        if (currentTrack?.title) {
          localStorage.setItem(`specterr_lyrics_${currentTrack.title}`, JSON.stringify(cleanLyrics));
        }
        localStorage.setItem(
          'specterr_active_song_lyrics',
          JSON.stringify({
            trackId: currentTrack?.id || '',
            trackTitle: currentTrack?.title || '',
            lyrics: cleanLyrics,
            timestamp: Date.now(),
          })
        );
      } catch {}
    }

    // 4. Directly update IDB for custom track
    try {
      const { updateCustomTrackLyrics } = await import('../utils/idb');
      await updateCustomTrackLyrics(cleanLyrics, currentTrack?.title, currentTrack?.id);
    } catch (err) {
      console.warn('Direct IDB update failed:', err);
    }

    setIsSavedRecently(true);
    showNotification('💾 Subtitle & Lirik tersimpan & aktif di preview/video!');
    setTimeout(() => setIsSavedRecently(false), 3000);
  };

  const handleExportSrt = () => {
    if (lyrics.length === 0) {
      showNotification('⚠️ Tidak ada baris lirik untuk disimpan ke format .SRT!');
      return;
    }
    const srt = WhisperAIService.exportToSrt(lyrics);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (currentTrack?.title || 'lirik')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    a.download = `${safeTitle || 'lirik'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`💾 File lirik .SRT (${lyrics.length} baris) berhasil disimpan!`);
  };

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const parseTimeInput = (str: string): number => {
    const clean = str.trim().replace(',', '.');
    if (clean.includes(':')) {
      const parts = clean.split(':');
      if (parts.length === 2) {
        return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
      }
      if (parts.length === 3) {
        return (
          (parseFloat(parts[0]) || 0) * 3600 +
          (parseFloat(parts[1]) || 0) * 60 +
          (parseFloat(parts[2]) || 0)
        );
      }
    }
    return parseFloat(clean) || 0;
  };

  const handleUpdateLine = (index: number, updates: Partial<LyricSegment>) => {
    const updated = [...lyrics];
    if (!updated[index]) return;

    const currentLine = updated[index];
    const finalStart = updates.start !== undefined ? updates.start : currentLine.start;
    const finalEnd = updates.end !== undefined ? updates.end : currentLine.end;
    const finalText = updates.text !== undefined ? updates.text : currentLine.text;

    // ALWAYS recalculate words timestamps whenever start, end, or text changes to maintain 100% synchronization!
    if (updates.text !== undefined || updates.start !== undefined || updates.end !== undefined) {
      const words = (finalText || '').trim().split(/\s+/).filter(Boolean);
      const segDur = Math.max(0.1, finalEnd - finalStart);
      const wordDur = segDur / Math.max(1, words.length);

      updates.words = words.map((w, wIdx) => ({
        word: w,
        start: Number((finalStart + wIdx * wordDur).toFixed(3)),
        end: Number((finalStart + (wIdx + 1) * wordDur).toFixed(3)),
      }));
    }

    updated[index] = {
      ...currentLine,
      ...updates,
      start: finalStart,
      end: finalEnd,
      text: finalText,
    };
    updateLyrics(updated);
  };

  const handleAddLine = () => {
    const lastSeg = lyrics[lyrics.length - 1];
    const newStart = lastSeg ? Number((lastSeg.end + 0.3).toFixed(2)) : Number(currentTime.toFixed(2));
    const newEnd = Number((newStart + 3.0).toFixed(2));

    const newSeg: LyricSegment = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      start: newStart,
      end: newEnd,
      text: 'Teks baris lirik baru...',
      words: [
        { word: 'Teks', start: newStart, end: newStart + 0.7 },
        { word: 'baris', start: newStart + 0.7, end: newStart + 1.4 },
        { word: 'lirik', start: newStart + 1.4, end: newStart + 2.1 },
        { word: 'baru...', start: newStart + 2.1, end: newEnd },
      ],
    };

    updateLyrics([...lyrics, newSeg]);
    showNotification('➕ Baris lirik baru ditambahkan');
  };

  const handleDeleteLine = (index: number) => {
    const updated = lyrics.filter((_, idx) => idx !== index);
    updateLyrics(updated);
    showNotification('🗑️ 1 baris lirik dihapus');
  };

  const handleSnapToPlayhead = (index: number) => {
    const seg = lyrics[index];
    if (!seg) return;
    const cur = Number(currentTime.toFixed(2));
    const segDur = Math.max(0.5, seg.end - seg.start);
    handleUpdateLine(index, {
      start: cur,
      end: Number((cur + segDur).toFixed(2)),
    });
    showNotification(`🎯 Baris #${index + 1} disinkronkan ke jarum (${formatTime(cur)})`);
  };

  const handleShiftAll = (seconds: number) => {
    if (lyrics.length === 0) return;
    const shifted = WhisperAIService.shiftLyricTimestamps(lyrics, seconds);
    updateLyrics(shifted);
    showNotification(`⏱️ Semua timestamp digeser ${seconds > 0 ? '+' : ''}${seconds}s`);
  };

  const handleReconstructBySentence = () => {
    if (lyrics.length === 0) return;
    const reconstructed = WhisperAIService.reconstructSubtitlesBySentence(lyrics);
    updateLyrics(reconstructed);
    showNotification(`✨ ${reconstructed.length} baris lirik berhasil disusun menjadi 3-4 kata yang terhubung rapi!`);
  };

  // Split line at a given word index (or halfway)
  const handleSplitLine = (index: number, atWordIndex?: number) => {
    const target = lyrics[index];
    if (!target) return;
    const rawWords = target.words && target.words.length > 0
      ? target.words
      : target.text.trim().split(/\s+/).filter(Boolean).map((w, wi, arr) => {
          const dur = Math.max(0.1, target.end - target.start);
          const wDur = dur / Math.max(1, arr.length);
          return {
            word: w,
            start: Number((target.start + wi * wDur).toFixed(2)),
            end: Number((target.start + (wi + 1) * wDur).toFixed(2)),
          };
        });

    if (rawWords.length <= 1) {
      showNotification('⚠️ Baris hanya berisi 1 kata, tidak dapat dibagi.');
      return;
    }

    const splitAt = atWordIndex !== undefined ? atWordIndex : Math.ceil(rawWords.length / 2);
    const firstWords = rawWords.slice(0, splitAt);
    const secondWords = rawWords.slice(splitAt);

    const firstText = firstWords.map((w) => w.word).join(' ').trim();
    const secondText = secondWords.map((w) => w.word).join(' ').trim();

    const firstStart = target.start;
    const firstEnd = secondWords[0]?.start ?? Number(((target.start + target.end) / 2).toFixed(2));
    const secondStart = firstEnd;
    const secondEnd = target.end;

    const line1: LyricSegment = {
      id: `${target.id}-pt1-${Date.now()}`,
      start: firstStart,
      end: firstEnd,
      text: firstText,
      words: firstWords,
    };
    const line2: LyricSegment = {
      id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      start: secondStart,
      end: secondEnd,
      text: secondText,
      words: secondWords,
    };

    const updated = [...lyrics.slice(0, index), line1, line2, ...lyrics.slice(index + 1)];
    updateLyrics(updated);
    showNotification(`✂️ Baris #${index + 1} berhasil dibagi menjadi 2 baris!`);
  };

  // Merge line with next line
  const handleMergeWithNext = (index: number) => {
    if (index >= lyrics.length - 1) return;
    const curr = lyrics[index];
    const next = lyrics[index + 1];
    if (!curr || !next) return;

    const mergedWords = [
      ...(curr.words || curr.text.split(/\s+/).filter(Boolean).map((w, i, a) => ({
        word: w,
        start: curr.start + (i / Math.max(1, a.length)) * (curr.end - curr.start),
        end: curr.start + ((i + 1) / Math.max(1, a.length)) * (curr.end - curr.start),
      }))),
      ...(next.words || next.text.split(/\s+/).filter(Boolean).map((w, i, a) => ({
        word: w,
        start: next.start + (i / Math.max(1, a.length)) * (next.end - next.start),
        end: next.start + ((i + 1) / Math.max(1, a.length)) * (next.end - next.start),
      }))),
    ];

    const mergedLine: LyricSegment = {
      id: curr.id,
      start: curr.start,
      end: Math.max(curr.end, next.end),
      text: `${curr.text.trim()} ${next.text.trim()}`.trim(),
      words: mergedWords,
    };

    const updated = [...lyrics.slice(0, index), mergedLine, ...lyrics.slice(index + 2)];
    updateLyrics(updated);
    showNotification(`🔗 Baris #${index + 1} dan #${index + 2} berhasil digabungkan!`);
  };

  // Move the last word of line to the beginning of next line
  const handleMoveLastWordToNext = (index: number) => {
    if (index >= lyrics.length - 1) return;
    const curr = lyrics[index];
    const next = lyrics[index + 1];
    if (!curr || !next) return;

    const currWords = curr.text.trim().split(/\s+/).filter(Boolean);
    if (currWords.length <= 1) {
      showNotification('⚠️ Baris ini hanya memiliki 1 kata.');
      return;
    }

    const movedWord = currWords.pop()!;
    const nextWords = [movedWord, ...next.text.trim().split(/\s+/).filter(Boolean)];

    let newCurrEnd = curr.end;
    if (curr.words && curr.words.length > 1) {
      newCurrEnd = curr.words[curr.words.length - 2].end;
    } else {
      newCurrEnd = Number((curr.start + (curr.end - curr.start) * (currWords.length / (currWords.length + 1))).toFixed(2));
    }

    const updatedCurr: LyricSegment = {
      ...curr,
      text: currWords.join(' '),
      end: newCurrEnd,
      words: curr.words && curr.words.length > 1 ? curr.words.slice(0, -1) : undefined,
    };

    const updatedNext: LyricSegment = {
      ...next,
      text: nextWords.join(' '),
      start: Math.min(newCurrEnd, next.start),
      words: nextWords.map((w, wi, a) => {
        const segDur = Math.max(0.1, next.end - Math.min(newCurrEnd, next.start));
        const wDur = segDur / Math.max(1, a.length);
        return {
          word: w,
          start: Number((Math.min(newCurrEnd, next.start) + wi * wDur).toFixed(2)),
          end: Number((Math.min(newCurrEnd, next.start) + (wi + 1) * wDur).toFixed(2)),
        };
      }),
    };

    const updated = [...lyrics];
    updated[index] = updatedCurr;
    updated[index + 1] = updatedNext;
    updateLyrics(updated);
    showNotification(`➡️ Kata "${movedWord}" dipindahkan ke baris #${index + 2}`);
  };

  // Pull the first word of next line to the end of current line
  const handlePullFirstWordFromNext = (index: number) => {
    if (index >= lyrics.length - 1) return;
    const curr = lyrics[index];
    const next = lyrics[index + 1];
    if (!curr || !next) return;

    const nextWords = next.text.trim().split(/\s+/).filter(Boolean);
    if (nextWords.length <= 1) {
      showNotification('⚠️ Baris berikutnya hanya memiliki 1 kata.');
      return;
    }

    const pulledWord = nextWords.shift()!;
    const currWords = [...curr.text.trim().split(/\s+/).filter(Boolean), pulledWord];

    let newNextStart = next.start;
    if (next.words && next.words.length > 1) {
      newNextStart = next.words[1].start;
    } else {
      newNextStart = Number((next.start + (next.end - next.start) * (1 / (nextWords.length + 1))).toFixed(2));
    }

    const updatedCurr: LyricSegment = {
      ...curr,
      text: currWords.join(' '),
      end: Math.max(curr.end, newNextStart),
      words: currWords.map((w, wi, a) => {
        const segDur = Math.max(0.1, Math.max(curr.end, newNextStart) - curr.start);
        const wDur = segDur / Math.max(1, a.length);
        return {
          word: w,
          start: Number((curr.start + wi * wDur).toFixed(2)),
          end: Number((curr.start + (wi + 1) * wDur).toFixed(2)),
        };
      }),
    };

    const updatedNext: LyricSegment = {
      ...next,
      text: nextWords.join(' '),
      start: newNextStart,
      words: next.words && next.words.length > 1 ? next.words.slice(1) : undefined,
    };

    const updated = [...lyrics];
    updated[index] = updatedCurr;
    updated[index + 1] = updatedNext;
    updateLyrics(updated);
    showNotification(`⬅️ Kata "${pulledWord}" ditarik ke baris #${index + 1}`);
  };

  // Align bulk plain text lyrics with audio words
  const handleSmartAlignBulkText = () => {
    if (!bulkText.trim()) {
      showNotification('⚠️ Teks lirik kosong. Silakan paste lirik lagu Anda terlebih dahulu.');
      return;
    }
    if (lyrics.length === 0) {
      handleApplyBulkText();
      return;
    }
    const aligned = WhisperAIService.alignLyricsWithPlainText(lyrics, bulkText);
    updateLyrics(aligned);
    setActiveTab('lines');
    showNotification(`🎯 Berhasil mencocokkan ${aligned.length} baris lirik sesuai naskah & ketukan audio!`);
  };

  const handleSearchReplace = () => {
    if (!searchQuery.trim()) return;
    let count = 0;
    const updated = lyrics.map((seg) => {
      if (seg.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        const regex = new RegExp(searchQuery, 'gi');
        const newText = seg.text.replace(regex, replaceQuery);
        count++;

        const words = newText.trim().split(/\s+/).filter(Boolean);
        const segDur = Math.max(0.1, seg.end - seg.start);
        const wordDur = segDur / Math.max(1, words.length);

        return {
          ...seg,
          text: newText,
          words: words.map((w, wIdx) => ({
            word: w,
            start: Number((seg.start + wIdx * wordDur).toFixed(3)),
            end: Number((seg.start + (wIdx + 1) * wordDur).toFixed(3)),
          })),
        };
      }
      return seg;
    });

    if (count > 0) {
      updateLyrics(updated);
      showNotification(`✅ Berhasil mengganti ${count} kemunculan "${searchQuery}"!`);
      setSearchQuery('');
      setReplaceQuery('');
    } else {
      showNotification(`⚠️ Kata "${searchQuery}" tidak ditemukan.`);
    }
  };

  // Bulk Edit setup
  const handleOpenBulkTab = () => {
    setActiveTab('bulk');
    const textLines = lyrics.map(
      (l) => `[${formatTime(l.start)} - ${formatTime(l.end)}] ${l.text}`
    );
    setBulkText(textLines.join('\n'));
  };

  const handleApplyBulkText = () => {
    const rawLines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      showNotification('⚠️ Teks kosong. Tidak ada yang diterapkan.');
      return;
    }

    const timestampRegex = /^\[(\d{1,2}:\d{2}(?:\.\d+)?)\s*-\s*(\d{1,2}:\d{2}(?:\.\d+)?)\]\s*(.*)$/;
    const lrcRegex = /^\[(\d{1,2}:\d{2}(?:\.\d+)?)\]\s*(.*)$/;

    const parsed: LyricSegment[] = [];
    const hasTimestamps = rawLines.some((l) => timestampRegex.test(l) || lrcRegex.test(l));

    if (hasTimestamps) {
      rawLines.forEach((line, idx) => {
        const matchRange = line.match(timestampRegex);
        if (matchRange) {
          const start = parseTimeInput(matchRange[1]);
          const end = parseTimeInput(matchRange[2]);
          const text = matchRange[3].trim();
          const words = text.split(/\s+/).filter(Boolean);
          const segDur = Math.max(0.1, end - start);
          const wordDur = segDur / Math.max(1, words.length);

          parsed.push({
            id: `bulk-${idx}-${Date.now()}`,
            start,
            end,
            text,
            words: words.map((w, wIdx) => ({
              word: w,
              start: Number((start + wIdx * wordDur).toFixed(3)),
              end: Number((start + (wIdx + 1) * wordDur).toFixed(3)),
            })),
          });
          return;
        }

        const matchLrc = line.match(lrcRegex);
        if (matchLrc) {
          const start = parseTimeInput(matchLrc[1]);
          const text = matchLrc[2].trim();
          const nextLine = rawLines[idx + 1];
          let end = start + 3.0;
          if (nextLine) {
            const nextMatch = nextLine.match(lrcRegex) || nextLine.match(timestampRegex);
            if (nextMatch) {
              end = parseTimeInput(nextMatch[1]);
            }
          }
          const words = text.split(/\s+/).filter(Boolean);
          const segDur = Math.max(0.1, end - start);
          const wordDur = segDur / Math.max(1, words.length);

          parsed.push({
            id: `bulk-${idx}-${Date.now()}`,
            start,
            end,
            text,
            words: words.map((w, wIdx) => ({
              word: w,
              start: Number((start + wIdx * wordDur).toFixed(3)),
              end: Number((start + (wIdx + 1) * wordDur).toFixed(3)),
            })),
          });
          return;
        }

        const prevEnd = parsed[parsed.length - 1]?.end ?? 0;
        parsed.push({
          id: `bulk-${idx}-${Date.now()}`,
          start: prevEnd,
          end: prevEnd + 3.0,
          text: line,
        });
      });
    } else {
      const totalDur = duration || 180;
      const count = rawLines.length;
      const segDur = Math.min(6.0, Math.max(2.0, totalDur / count));

      rawLines.forEach((line, idx) => {
        const start = Number((idx * segDur).toFixed(2));
        const end = Number((start + segDur).toFixed(2));
        const words = line.split(/\s+/).filter(Boolean);
        const wordDur = segDur / Math.max(1, words.length);

        parsed.push({
          id: `bulk-plain-${idx}-${Date.now()}`,
          start,
          end,
          text: line,
          words: words.map((w, wIdx) => ({
            word: w,
            start: Number((start + wIdx * wordDur).toFixed(3)),
            end: Number((start + (wIdx + 1) * wordDur).toFixed(3)),
          })),
        });
      });
    }

    updateLyrics(parsed);
    setActiveTab('lines');
    showNotification(`✅ Berhasil menerapkan ${parsed.length} baris lirik!`);
  };

  const handleSeekTo = (time: number) => {
    if (onSeek) {
      onSeek(time);
    } else {
      globalAudioEngine.seek(time);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[88vh] flex flex-col bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Type className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Studio Editor Teks Subtitle
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {lyrics.length} Baris
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Edit teks, sinkronkan ke posisi jarum audio ({formatTime(currentTime)}), atau ganti kata sekaligus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('lines')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'lines'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Per Baris</span>
              </button>
              <button
                onClick={handleOpenBulkTab}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'bulk'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Teks Lengkap (Bulk / LRC)</span>
              </button>
            </div>

            {/* Master Subtitle Visibility Toggle */}
            <button
              onClick={() => {
                const nextState = !subtitle.enabled;
                onSubtitleChange({ ...subtitle, enabled: nextState });
                showNotification(nextState ? '👁️ Subtitle DIAKTIFKAN di layar preview & video!' : '🙈 Subtitle DIMATIKAN dari layar!');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all active:scale-95 ${
                subtitle.enabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-sm'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
              }`}
              title="Aktifkan atau matikan penayangan lirik di layar visualizer dan hasil render video"
            >
              <span className={`w-2 h-2 rounded-full ${subtitle.enabled ? 'bg-cyan-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{subtitle.enabled ? 'Tampil di Video: ON' : 'Tampil di Video: OFF'}</span>
            </button>

            {/* Tombol Susun Per Kalimat (Satu Baris) */}
            <button
              onClick={handleReconstructBySentence}
              disabled={lyrics.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 transition-all shadow-sm active:scale-95 disabled:opacity-40"
              title="Susun subtitle menjadi 3-4 kata per baris yang tetap terhubung rapi, ideal untuk video vertikal (Shorts/TikTok/Reels) maupun horisontal agar tidak terpotong"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">✨ Rapikan 3-4 Kata (Vertikal & Horisontal)</span>
              <span className="md:hidden">✨ 3-4 Kata</span>
            </button>

            {/* Tombol Simpan Lirik .SRT */}
            <button
              onClick={handleExportSrt}
              disabled={lyrics.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 transition-all shadow-sm active:scale-95 disabled:opacity-40"
              title="Simpan / Download Lirik dalam Format SubRip (.SRT)"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simpan .SRT</span>
            </button>

            {/* Tombol Simpan Subtitle di Header */}
            <button
              onClick={handleSaveSubtitle}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-lg active:scale-95 ${
                isSavedRecently
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
              }`}
              title="Simpan subtitle ke proyek visualizer & database"
            >
              {isSavedRecently ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-white" />
                  <span>Simpan Subtitle</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toolbar (Visible in 'lines' mode) */}
        {activeTab === 'lines' && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-950/40 border-b border-white/5 text-xs">
            {/* Search and Replace */}
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari kata..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <input
                type="text"
                placeholder="Ganti dengan..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="w-full max-w-[140px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleSearchReplace}
                disabled={!searchQuery.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-cyan-600 disabled:opacity-40 disabled:hover:bg-white/10 text-white font-medium transition-all whitespace-nowrap"
              >
                Ganti Semua
              </button>
            </div>

            {/* Global Timestamp Shifter & Add Line */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                <span className="text-[10px] text-slate-400 px-1 font-mono">Geser:</span>
                <button
                  onClick={() => handleShiftAll(-0.5)}
                  title="Geser semua subtitle mundur 0.5 detik"
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-white text-[11px] font-mono transition-all"
                >
                  <Rewind className="w-3 h-3" />
                  <span>-0.5s</span>
                </button>
                <button
                  onClick={() => handleShiftAll(0.5)}
                  title="Geser semua subtitle maju 0.5 detik"
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-white text-[11px] font-mono transition-all"
                >
                  <span>+0.5s</span>
                  <FastForward className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold transition-all shadow-md shadow-cyan-500/20 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Baris</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'lines' ? (
            <div className="space-y-2.5">
              {lyrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <Type className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="font-semibold text-slate-300">Belum ada lirik subtitle pada lagu ini</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Klik tombol "+ Baris" untuk menambahkan manual, atau buka tab "Teks Lengkap" untuk paste lirik secara massal.
                  </p>
                  <button
                    onClick={handleAddLine}
                    className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-500/20"
                  >
                    + Tambah Baris Pertama
                  </button>
                </div>
              ) : (
                lyrics.map((line, idx) => {
                  const isCurrent = currentTime >= line.start && currentTime <= line.end;
                  const dur = Math.max(0, line.end - line.start);

                  return (
                    <div
                      key={line.id || idx}
                      className={`p-3 rounded-xl border transition-all duration-200 ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {/* Line index */}
                        <span className="w-6 text-center text-xs font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>

                        {/* Seek / Play button */}
                        <button
                          onClick={() => handleSeekTo(line.start)}
                          title="Dengarkan bagian ini di audio"
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-cyan-600 text-white text-[11px] font-medium transition-all"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Dengar</span>
                        </button>

                        {/* Snap start to playhead */}
                        <button
                          onClick={() => handleSnapToPlayhead(idx)}
                          title="Kunci titik mulai ke jarum penunjuk audio saat ini"
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-medium transition-all"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Kunci Jarum ({formatTime(currentTime)})</span>
                        </button>

                        <div className="ml-auto flex items-center gap-2">
                          {/* Timestamps */}
                          <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5 font-mono text-xs">
                            <span className="text-[10px] text-slate-400">Mulai:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={line.start}
                              onChange={(e) =>
                                handleUpdateLine(idx, {
                                  start: Number(parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-14 bg-transparent text-right font-bold text-cyan-300 focus:outline-none focus:underline"
                            />
                            <span className="text-slate-500">s</span>

                            <span className="text-slate-600 mx-1">→</span>

                            <span className="text-[10px] text-slate-400">Selesai:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={line.end}
                              onChange={(e) =>
                                handleUpdateLine(idx, {
                                  end: Number(parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-14 bg-transparent text-right font-bold text-pink-300 focus:outline-none focus:underline"
                            />
                            <span className="text-slate-500">s</span>

                            <span className="text-[10px] text-slate-500 font-sans ml-1">
                              ({dur.toFixed(1)}s)
                            </span>
                          </div>

                          {/* Delete line */}
                          <button
                            onClick={() => handleDeleteLine(idx)}
                            title="Hapus baris lirik ini"
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Line text input with Quick Split / Merge / Shift Word Actions */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) => handleUpdateLine(idx, { text: e.target.value })}
                          placeholder="Teks lirik pada baris ini..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                        />

                        {/* Quick Word & Line Utilities */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSplitLine(idx)}
                            title="Bagi baris ini menjadi 2 baris terpisah di tengah kalimat"
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 text-xs transition-all"
                          >
                            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="hidden sm:inline text-[11px]">Bagi</span>
                          </button>

                          {idx < lyrics.length - 1 && (
                            <>
                              <button
                                onClick={() => handleMergeWithNext(idx)}
                                title={`Gabungkan baris #${idx + 1} dengan baris #${idx + 2}`}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 border border-white/10 hover:border-indigo-500/30 text-xs transition-all"
                              >
                                <Combine className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="hidden sm:inline text-[11px]">Gabung #{idx + 2}</span>
                              </button>

                              <button
                                onClick={() => handleMoveLastWordToNext(idx)}
                                title="Pindahkan kata terakhir baris ini ke awal baris berikutnya"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 transition-all"
                              >
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                              </button>

                              <button
                                onClick={() => handlePullFirstWordFromNext(idx)}
                                title="Tarik kata pertama dari baris berikutnya ke akhir baris ini"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-teal-500/20 text-slate-400 hover:text-teal-300 border border-white/10 hover:border-teal-500/30 transition-all"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 text-teal-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Optional translation input if segment has translation */}
                      {line.translation !== undefined && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Arti:</span>
                          <input
                            type="text"
                            value={line.translation || ''}
                            onChange={(e) => handleUpdateLine(idx, { translation: e.target.value })}
                            placeholder="Terjemahan baris ini..."
                            className="flex-1 px-3 py-1 rounded-lg bg-black/20 border border-white/5 text-slate-300 text-xs focus:outline-none focus:border-cyan-500 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Editor Lirik Massal (Bulk / LRC)</h3>
                  <p className="text-xs text-slate-400">
                    Paste lirik lengkap format [mm:ss.xx - mm:ss.xx] Teks, atau paste teks polos biasa untuk dibagi rata otomatis
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const sample = `[00:02.00 - 00:07.50] Cruising down the grid into the endless night\n[00:08.00 - 00:13.50] Retrowave skyline shining neon bright\n[00:14.00 - 00:19.50] Synthetic echoes pulsing in our veins\n[00:20.00 - 00:26.00] Breaking away from all the digital chains`;
                      setBulkText(sample);
                    }}
                    className="text-[11px] text-cyan-400 hover:underline px-2 py-1"
                  >
                    Contoh Format
                  </button>
                </div>
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Paste lirik lagu di sini...\nContoh:\n[00:12.50 - 00:16.80] Baris lirik pertama...\n[00:17.00 - 00:22.00] Baris lirik kedua..."
                className="flex-1 min-h-[360px] p-4 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-500 custom-scrollbar resize-none"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {bulkText.split('\n').filter((l) => l.trim()).length} baris terdeteksi
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('lines')}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSmartAlignBulkText}
                    title="Cocokkan baris-baris lirik tertulis ini (Verse/Chorus) dengan timestamp audio yang ada secara otomatis"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    <Target className="w-4 h-4" />
                    <span>🎯 Cocokkan Teks Lirik ke Audio</span>
                  </button>
                  <button
                    onClick={handleApplyBulkText}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Terapkan Semua Teks Lirik</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-white/10 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isSavedRecently ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'}`} />
            <span className={isSavedRecently ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
              {isSavedRecently
                ? '✅ Semua perubahan subtitle berhasil disimpan ke proyek & database!'
                : 'Perubahan disinkronkan real-time. Klik "Simpan Subtitle" untuk mengunci permanen.'}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleExportSrt}
              disabled={lyrics.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-40"
              title="Simpan / Download Lirik dalam Format SubRip (.SRT)"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Simpan .SRT</span>
            </button>

            <button
              onClick={handleSaveSubtitle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 ${
                isSavedRecently
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSavedRecently ? '✅ Tersimpan!' : '💾 Simpan Subtitle'}</span>
            </button>

            <button
              onClick={() => {
                handleSaveSubtitle();
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Simpan & Tutup</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-semibold text-xs transition-all"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Temporary Notification Banner */}
        {notification && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-cyan-400/40 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {notification}
          </div>
        )}
      </div>
    </div>
  );
};
