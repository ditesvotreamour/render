import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Edit3,
  Move,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  Timer,
  Sparkles,
} from 'lucide-react';
import type { SubtitleConfig, LyricSegment } from '../types/visualizer';

interface OnScreenLyricEditorProps {
  subtitle?: SubtitleConfig;
  currentTime: number;
  isPlaying: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSubtitleChange?: (newSubtitle: SubtitleConfig) => void;
  onSeek?: (time: number) => void;
  onTogglePlay?: () => void;
  onOpenFullModal?: () => void;
  onSave?: (overrideSubtitle?: SubtitleConfig) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export const OnScreenLyricEditor: React.FC<OnScreenLyricEditorProps> = ({
  subtitle,
  currentTime,
  isPlaying,
  containerRef,
  onSubtitleChange,
  onSeek,
  onTogglePlay,
  onOpenFullModal,
  onSave,
  onEditingChange,
}) => {
  const lyrics = subtitle?.lyrics || [];
  const hasLyrics = lyrics.length > 0;
  const isEnabled = Boolean(subtitle?.enabled);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeSegIndex, setActiveSegIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState<boolean>(false);
  const [showTranslationInput, setShowTranslationInput] = useState<boolean>(false);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Helper to remove internal render cache keys
  const cleanLyrics = useCallback((rawLyrics: LyricSegment[]): LyricSegment[] => {
    return rawLyrics.map((l) => {
      const copy = { ...l };
      delete (copy as any).__wmCache;
      delete (copy as any).__wmCacheKey;
      return copy;
    });
  }, []);

  // Helper to recalculate word timestamps for word-by-word karaoke & animation sync
  const buildRecalculatedWords = useCallback((textStr: string, startSec: number, endSec: number) => {
    const rawWords = textStr.trim().split(/\s+/).filter(Boolean);
    const segDur = Math.max(0.1, endSec - startSec);
    const wDur = segDur / Math.max(1, rawWords.length);
    return rawWords.map((w, i) => ({
      word: w,
      start: Number((startSec + i * wDur).toFixed(3)),
      end: Number((startSec + (i + 1) * wDur).toFixed(3)),
    }));
  }, []);

  // Find active segment matching currentTime (matching the renderer's 0.15s lead-in)
  const LEAD_IN = 0.15;
  const t = currentTime + LEAD_IN;

  useEffect(() => {
    // Only auto-follow playback time if NOT currently actively editing text in the textarea
    if (isEditing) return;

    if (!lyrics.length) return;

    let foundIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (t >= lyrics[i].start && t <= lyrics[i].end) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx === -1) {
      // Look ahead small gap
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].start > t && lyrics[i].start - t < 0.6) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx !== -1 && foundIdx !== activeSegIndex) {
      setActiveSegIndex(foundIdx);
    }
  }, [t, isEditing, lyrics, activeSegIndex]);

  // Ensure activeSegIndex is within bounds
  const safeIndex = Math.min(Math.max(0, activeSegIndex), Math.max(0, lyrics.length - 1));
  const activeSegment = lyrics[safeIndex];

  // Calculate coordinates in percentage (0 - 100)
  const defaultYPercent =
    subtitle?.position === 'top'
      ? 16
      : subtitle?.position === 'center'
      ? 50
      : subtitle?.position === 'bottom'
      ? 86
      : 74;

  const posX = typeof subtitle?.customPosX === 'number' ? subtitle.customPosX : 50;
  const posY = typeof subtitle?.customPosY === 'number' ? subtitle.customPosY : defaultYPercent;

  // Handle Text Editing Live (always keeping word breakdown in sync)
  const handleTextChange = (newText: string) => {
    if (!subtitle || !activeSegment) return;
    const words = buildRecalculatedWords(newText, activeSegment.start, activeSegment.end);
    const updated = [...lyrics];
    updated[safeIndex] = {
      ...activeSegment,
      text: newText,
      words: words,
    };
    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });
  };

  // Handle Translation Text Editing Live
  const handleTranslationChange = (newTrans: string) => {
    if (!subtitle || !activeSegment) return;
    const updated = [...lyrics];
    updated[safeIndex] = {
      ...activeSegment,
      translation: newTrans,
    };
    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });
  };

  // Drag-and-drop repositioning
  const handleDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setShowGuidelines(true);

    const container = containerRef.current;
    if (!container) return;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      let newX = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      let newY = ((moveEvent.clientY - rect.top) / rect.height) * 100;

      // Magnetic snap to center guideline (within 2.5% tolerance)
      if (Math.abs(newX - 50) < 2.5) newX = 50;
      if (Math.abs(newY - 50) < 2.5) newY = 50;
      if (Math.abs(newY - 74) < 2.5) newY = 74;

      // Clamp to reasonable margins
      newX = Math.round(Math.min(92, Math.max(8, newX)));
      newY = Math.round(Math.min(92, Math.max(8, newY)));

      if (subtitle) {
        onSubtitleChange?.({
          ...subtitle,
          customPosX: newX,
          customPosY: newY,
          position: 'custom',
        });
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      setShowGuidelines(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Navigation: Jump to previous / next lyric segment
  const handleNavigateSegment = (delta: number) => {
    const nextIdx = safeIndex + delta;
    if (nextIdx >= 0 && nextIdx < lyrics.length) {
      setActiveSegIndex(nextIdx);
      const target = lyrics[nextIdx];
      if (target && onSeek) {
        onSeek(Number((target.start + 0.1).toFixed(2)));
      }
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 50);
    }
  };

  // Font size adjustment
  const handleAdjustFontSize = (delta: number) => {
    if (!subtitle) return;
    const currentSize = subtitle.fontSize || 32;
    const newSize = Math.max(16, Math.min(84, currentSize + delta));
    onSubtitleChange?.({
      ...subtitle,
      fontSize: newSize,
    });
  };

  // Font family change
  const handleUpdateFontFamily = (newFont: string) => {
    if (!subtitle) return;
    onSubtitleChange?.({
      ...subtitle,
      fontFamily: newFont,
      lyrics: cleanLyrics(lyrics),
    });
  };

  // Stroke width change
  const handleUpdateStrokeWidth = (sw: number) => {
    if (!subtitle) return;
    onSubtitleChange?.({
      ...subtitle,
      strokeWidth: sw,
      lyrics: cleanLyrics(lyrics),
    });
  };

  // Timing adjustment for current segment (nudge delta)
  const handleNudgeTiming = (field: 'start' | 'end', delta: number) => {
    if (!subtitle || !activeSegment) return;
    const updated = [...lyrics];
    const cur = activeSegment;
    let newStart = cur.start;
    let newEnd = cur.end;

    if (field === 'start') {
      newStart = Math.max(0, Number((cur.start + delta).toFixed(2)));
      if (newStart >= newEnd) newStart = Math.max(0, newEnd - 0.2);
    } else {
      newEnd = Math.max(newStart + 0.2, Number((cur.end + delta).toFixed(2)));
    }

    const words = buildRecalculatedWords(cur.text, newStart, newEnd);
    updated[safeIndex] = {
      ...cur,
      start: newStart,
      end: newEnd,
      words: words,
    };

    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });

    if (onSeek) {
      onSeek(Number((newStart + 0.1).toFixed(2)));
    }
  };

  // Direct timing input for start / end
  const handleUpdateTiming = (field: 'start' | 'end', valSec: number) => {
    if (!subtitle || !activeSegment) return;
    const cur = activeSegment;
    let newStart = cur.start;
    let newEnd = cur.end;

    if (field === 'start') {
      newStart = Math.max(0, Number(valSec.toFixed(2)));
      if (newStart >= newEnd) {
        newEnd = Number((newStart + 0.5).toFixed(2));
      }
    } else {
      newEnd = Math.max(newStart + 0.1, Number(valSec.toFixed(2)));
    }

    const words = buildRecalculatedWords(cur.text, newStart, newEnd);
    const updated = [...lyrics];
    updated[safeIndex] = {
      ...cur,
      start: newStart,
      end: newEnd,
      words: words,
    };

    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });

    if (onSeek) {
      onSeek(Number((newStart + 0.05).toFixed(2)));
    }
  };

  // Adjust duration by delta (shorten or lengthen segment duration)
  const handleAdjustDuration = (delta: number) => {
    if (!subtitle || !activeSegment) return;
    const cur = activeSegment;
    const curDuration = cur.end - cur.start;
    const newDuration = Math.max(0.1, Number((curDuration + delta).toFixed(2)));
    const newEnd = Number((cur.start + newDuration).toFixed(2));

    const words = buildRecalculatedWords(cur.text, cur.start, newEnd);
    const updated = [...lyrics];
    updated[safeIndex] = {
      ...cur,
      end: newEnd,
      words: words,
    };

    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });
  };

  // Set duration directly (in seconds)
  const handleSetExactDuration = (durSec: number) => {
    if (!subtitle || !activeSegment) return;
    const cur = activeSegment;
    const safeDur = Math.max(0.1, Number(durSec.toFixed(2)));
    const newEnd = Number((cur.start + safeDur).toFixed(2));

    const words = buildRecalculatedWords(cur.text, cur.start, newEnd);
    const updated = [...lyrics];
    updated[safeIndex] = {
      ...cur,
      end: newEnd,
      words: words,
    };

    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });
  };

  // Set timestamp to current playhead audio time
  const handleSetTimestampToCurrent = (field: 'start' | 'end') => {
    if (!subtitle || !activeSegment) return;
    const cur = activeSegment;
    const playheadTime = Number(currentTime.toFixed(2));
    let newStart = cur.start;
    let newEnd = cur.end;

    if (field === 'start') {
      newStart = Math.max(0, playheadTime);
      if (newStart >= newEnd) {
        newEnd = Number((newStart + 1.5).toFixed(2));
      }
    } else {
      newEnd = Math.max(newStart + 0.1, playheadTime);
    }

    const words = buildRecalculatedWords(cur.text, newStart, newEnd);
    const updated = [...lyrics];
    updated[safeIndex] = {
      ...cur,
      start: newStart,
      end: newEnd,
      words: words,
    };

    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });
  };

  // Add new line right at currentTime
  const handleAddNewLine = () => {
    if (!subtitle) return;
    const startSec = Number(currentTime.toFixed(2));
    const endSec = Number((currentTime + 3.0).toFixed(2));
    const textStr = 'Lirik baru...';
    const words = buildRecalculatedWords(textStr, startSec, endSec);

    const newSeg: LyricSegment = {
      id: 'lyric_' + Date.now(),
      start: startSec,
      end: endSec,
      text: textStr,
      words: words,
    };

    const updated = [...lyrics, newSeg].sort((a, b) => a.start - b.start);
    const newIdx = updated.findIndex((s) => s.id === newSeg.id);

    onSubtitleChange?.({
      ...subtitle,
      enabled: true,
      lyrics: cleanLyrics(updated),
    });

    setActiveSegIndex(newIdx !== -1 ? newIdx : updated.length - 1);
    setIsEditing(true);

    if (onSeek) {
      onSeek(Number((startSec + 0.1).toFixed(2)));
    }

    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 80);
  };

  // Delete current segment
  const handleDeleteLine = () => {
    if (!subtitle || !activeSegment) return;
    if (lyrics.length <= 1) {
      if (confirm('Hapus baris lirik ini?')) {
        onSubtitleChange?.({
          ...subtitle,
          lyrics: [],
        });
        setIsEditing(false);
      }
      return;
    }

    const updated = lyrics.filter((_, idx) => idx !== safeIndex);
    const nextIdx = Math.max(0, safeIndex - 1);

    onSubtitleChange?.({
      ...subtitle,
      lyrics: cleanLyrics(updated),
    });

    setActiveSegIndex(nextIdx);
    if (updated[nextIdx] && onSeek) {
      onSeek(Number((updated[nextIdx].start + 0.1).toFixed(2)));
    }
  };

  // Quick preset positioning
  const handleQuickPosition = (preset: 'top' | 'center' | 'bottom' | 'center_bottom') => {
    if (!subtitle) return;
    let y = 74;
    if (preset === 'top') y = 16;
    if (preset === 'center') y = 50;
    if (preset === 'bottom') y = 86;

    onSubtitleChange?.({
      ...subtitle,
      customPosX: 50,
      customPosY: y,
      position: preset,
    });
  };

  // Done and commit changes to canvas & project storage
  const handleDone = () => {
    if (activeSegment && subtitle) {
      const curText = textareaRef.current ? textareaRef.current.value : activeSegment.text;
      const words = buildRecalculatedWords(curText, activeSegment.start, activeSegment.end);
      const updated = [...lyrics];
      updated[safeIndex] = {
        ...activeSegment,
        text: curText,
        words: words,
      };
      const cleaned = cleanLyrics(updated);
      const finalConfig: SubtitleConfig = {
        ...subtitle,
        enabled: true,
        lyrics: cleaned,
      };

      onSubtitleChange?.(finalConfig);
      onSave?.(finalConfig);

      // CRITICAL: Seek audio to active segment start + 0.1 so it is GUARANTEED to be active and visible on the preview canvas right now!
      if (onSeek) {
        onSeek(Number((activeSegment.start + 0.1).toFixed(2)));
      }
    }

    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 2000);
    setIsEditing(false);
  };

  // Open edit mode
  const handleEnterEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      onTogglePlay?.();
    }
    // Seek to this segment immediately so the canvas and editor are perfectly aligned at this segment
    if (activeSegment && onSeek) {
      onSeek(Number((activeSegment.start + 0.1).toFixed(2)));
    }
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 60);
  };

  // Format seconds to MM:SS.s
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return m + ':' + (Number(s) < 10 ? '0' : '') + s;
  };

  // If subtitles are disabled or no lyrics, show a minimal prompt button
  if (!isEnabled || !hasLyrics) {
    return (
      <div className="absolute bottom-16 right-3 pointer-events-auto z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (subtitle) {
              const initialLyrics =
                lyrics.length > 0
                  ? lyrics
                  : [
                      {
                        id: 'lyric_' + Date.now(),
                        start: Number(currentTime.toFixed(2)),
                        end: Number((currentTime + 4).toFixed(2)),
                        text: 'Tulis lirik lagu di sini...',
                      },
                    ];
              onSubtitleChange?.({
                ...subtitle,
                enabled: true,
                lyrics: cleanLyrics(initialLyrics),
              });
              setIsEditing(true);
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/80 hover:bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold backdrop-blur-md shadow-xl transition-all hover:scale-105"
          title="Aktifkan dan Edit Lirik Langsung di Layar Preview"
        >
          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
          <span>+ Tulis Lirik di Layar</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 select-none ${isEditing ? 'overflow-visible' : 'overflow-hidden'}`}>
      {/* Center Guideline Overlay when dragging */}
      {showGuidelines && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Vertical Center Line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-cyan-400/60 border-l border-dashed border-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          {/* Horizontal Preset Lines */}
          <div className="absolute left-0 right-0 top-[16%] -translate-y-1/2 h-0.5 bg-cyan-400/30 border-t border-dashed border-cyan-300/60" />
          <div className="absolute left-0 right-0 top-[50%] -translate-y-1/2 h-0.5 bg-cyan-400/40 border-t border-dashed border-cyan-300/80" />
          <div className="absolute left-0 right-0 top-[74%] -translate-y-1/2 h-0.5 bg-cyan-400/40 border-t border-dashed border-cyan-300/80" />
          <div className="absolute left-0 right-0 top-[86%] -translate-y-1/2 h-0.5 bg-cyan-400/30 border-t border-dashed border-cyan-300/60" />
        </div>
      )}

      {/* The Subtitle Container (Positioned at posX, posY when not editing, or safely anchored when editing) */}
      <div
        className="absolute transition-all duration-150"
        style={
          !isEditing
            ? {
                left: posX + '%',
                top: posY + '%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '92%',
              }
            : {
                left: '50%',
                top: posY < 45 ? '8px' : 'auto',
                bottom: posY >= 45 ? '8px' : 'auto',
                transform: 'translateX(-50%)',
                width: 'min(530px, 95%)',
                maxHeight: 'calc(100% - 16px)',
              }
        }
      >
        {/* MODE A: HOVER / PASSIVE HIGHLIGHT (When not actively editing) */}
        {!isEditing ? (
          <div
            onClick={handleEnterEdit}
            onDoubleClick={handleEnterEdit}
            className="pointer-events-auto cursor-pointer group relative flex flex-col items-center justify-center p-2 rounded-xl transition-all"
            title="Klik atau Dobel Klik untuk Mengedit Lirik Langsung di Sini"
          >
            {/* Dashed Selection Bounding Box (Visible on hover or when paused) */}
            <div
              className={`absolute -inset-2 rounded-xl border border-dashed transition-all duration-200 pointer-events-none ${
                !isPlaying
                  ? 'border-cyan-400/60 bg-cyan-950/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'border-transparent group-hover:border-cyan-400/50 group-hover:bg-cyan-950/20'
              }`}
            >
              {/* Corner Handles like CapCut / Canva */}
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-cyan-400 rounded-full shadow" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full shadow" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-cyan-400 rounded-full shadow" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full shadow" />
            </div>

            {/* Quick Floating Action Chip */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-cyan-400/50 text-cyan-200 text-[10px] font-semibold tracking-wide shadow-xl transition-all ${
                !isPlaying
                  ? 'opacity-100 -translate-y-3'
                  : 'opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:-translate-y-3'
              }`}
            >
              <Edit3 className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Edit Lirik Layar</span>
              <span className="text-slate-400 font-mono text-[9px] border-l border-white/20 pl-1.5">
                {safeIndex + 1}/{lyrics.length}
              </span>
            </div>

            {/* Ghost text mirror so container size conforms to subtitle length */}
            <div
              className="opacity-0 select-none pointer-events-none text-center px-4 font-bold"
              style={{
                fontSize: Math.min(28, (subtitle?.fontSize || 32) * 0.7) + 'px',
                fontFamily: subtitle?.fontFamily || 'Montserrat',
              }}
            >
              {activeSegment?.text || 'Lirik Lagu'}
            </div>
          </div>
        ) : (
          /* MODE B: ACTIVE INLINE EDITOR CARD (CapCut / Canva Style) */
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto w-[94vw] sm:w-[500px] max-w-[540px] max-h-[calc(100vh-140px)] sm:max-h-[min(540px,calc(100%-16px))] bg-[#0A0E17]/95 backdrop-blur-2xl border-2 border-cyan-400/80 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(6,182,212,0.25)] flex flex-col p-2.5 sm:p-3 z-30 overflow-hidden animate-in fade-in zoom-in-95"
          >
            {/* Header: Drag Handle, Line Counter, Nav Arrows, Close (Pinned Top) */}
            <div className="shrink-0 flex items-center justify-between gap-2 pb-2 mb-1.5 border-b border-white/10">
              {/* Drag Handle to Reposition */}
              <div
                onPointerDown={handleDragStart}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold cursor-grab active:cursor-grabbing hover:bg-cyan-500/25 transition-colors ${
                  isDragging ? 'cursor-grabbing ring-2 ring-cyan-400' : ''
                }`}
                title="Tahan dan Tarik mouse untuk memindahkan posisi lirik di layar"
              >
                <Move className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
                <span>Geser Posisi</span>
                <span className="font-mono text-[9px] text-cyan-400 bg-cyan-950/60 px-1 py-0.2 rounded border border-cyan-500/30">
                  {posX}%, {posY}%
                </span>
              </div>

              {/* Navigation Arrows and Line Counter */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNavigateSegment(-1)}
                  disabled={safeIndex <= 0}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  title="Baris Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/50 border border-white/10 text-[11px] font-mono text-slate-300">
                  <span className="text-cyan-400 font-bold">{safeIndex + 1}</span>
                  <span className="text-slate-500">/</span>
                  <span>{lyrics.length}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigateSegment(1)}
                  disabled={safeIndex >= lyrics.length - 1}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  title="Baris Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Timestamp and Close Button */}
              <div className="flex items-center gap-1.5">
                {activeSegment && (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 border border-white/10 text-[10px] font-mono text-slate-300"
                    title="Waktu mulai, selesai, dan durasi baris ini"
                  >
                    <Clock className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                    <span>
                      {formatTime(activeSegment.start)} - {formatTime(activeSegment.end)}
                    </span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/70 px-1 rounded border border-emerald-500/30 text-[9px] ml-0.5">
                      {(activeSegment.end - activeSegment.start).toFixed(1)}s
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDone}
                  className="p-1 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-slate-300 transition-colors"
                  title="Selesai & Simpan Lirik Layar (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body Container (Textarea, Translation, Timing, Styles) */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-black/20 [&::-webkit-scrollbar-thumb]:bg-cyan-500/30 hover:[&::-webkit-scrollbar-thumb]:bg-cyan-500/50 [&::-webkit-scrollbar-thumb]:rounded-full">
              {/* Main Textarea: Direct On-Screen Typing */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={activeSegment?.text || ''}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={2}
                  placeholder="Ketik lirik lagu di sini..."
                  className="w-full bg-[#080D1A] text-slate-100 text-sm sm:text-base font-normal p-3 rounded-xl border border-slate-700/80 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all resize-none leading-relaxed tracking-normal shadow-sm"
                  style={{
                    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    letterSpacing: '0.015em',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (safeIndex < lyrics.length - 1) {
                        handleNavigateSegment(1);
                      } else {
                        handleDone();
                      }
                    } else if (e.key === 'Escape') {
                      handleDone();
                    }
                  }}
                />

                {/* Character and Word counter hint */}
                <div className="absolute right-2.5 bottom-2.5 text-[9px] font-mono text-slate-400 pointer-events-none bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                  {activeSegment?.text?.length || 0} chr
                </div>
              </div>

              {/* Translation Input (Optional Dual Language) */}
              {(showTranslationInput || activeSegment?.translation || subtitle?.showTranslation) && (
                <div className="relative">
                  <div className="flex items-center justify-between text-[10px] text-cyan-300 font-semibold mb-1 px-1">
                    <span>🌐 Terjemahan / Subtitle Kedua:</span>
                    <button
                      type="button"
                      onClick={() => handleTranslationChange('')}
                      className="text-slate-400 hover:text-red-400 text-[9px]"
                    >
                      Kosongkan
                    </button>
                  </div>
                  <input
                    type="text"
                    value={activeSegment?.translation || ''}
                    onChange={(e) => handleTranslationChange(e.target.value)}
                    placeholder="Ketik arti atau terjemahan lirik..."
                    className="w-full bg-[#080D1A] text-cyan-200 text-xs font-normal p-2.5 rounded-lg border border-slate-700/80 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 shadow-sm"
                    style={{
                      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                    }}
                  />
                </div>
              )}

              {/* Panel Pengaturan Waktu & Durasi Lirik */}
              {activeSegment && (
                <div className="p-2 rounded-xl bg-black/60 border border-cyan-500/20 shadow-inner flex flex-col gap-1.5">
                  {/* Baris 1: Mulai & Selesai Timestamps */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    {/* Waktu Mulai */}
                    <div className="bg-[#050811] p-1.5 rounded-lg border border-white/10 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className="text-cyan-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" /> Mulai
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSetTimestampToCurrent('start')}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all font-mono"
                          title="Set waktu mulai ke posisi audio saat ini"
                        >
                          📍 {formatTime(currentTime)}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={activeSegment.start}
                          onChange={(e) => handleUpdateTiming('start', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-black/80 border border-cyan-500/40 rounded px-1 py-0.5 text-[11px] font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 text-center font-bold"
                          title="Waktu mulai dalam detik"
                        />
                        <div className="flex items-center gap-0.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('start', -0.5)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Mulai lebih cepat -0.5s"
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('start', -0.1)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Mulai lebih cepat -0.1s"
                          >
                            -0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('start', 0.1)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Mulai lebih lambat +0.1s"
                          >
                            +0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('start', 0.5)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Mulai lebih lambat +0.5s"
                          >
                            +0.5s
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Waktu Selesai */}
                    <div className="bg-[#050811] p-1.5 rounded-lg border border-white/10 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className="text-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> Selesai
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSetTimestampToCurrent('end')}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all font-mono"
                          title="Set waktu selesai ke posisi audio saat ini"
                        >
                          📍 {formatTime(currentTime)}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.05"
                          min={activeSegment.start + 0.1}
                          value={activeSegment.end}
                          onChange={(e) => handleUpdateTiming('end', parseFloat(e.target.value) || (activeSegment.start + 0.1))}
                          className="w-16 bg-black/80 border border-amber-500/40 rounded px-1 py-0.5 text-[11px] font-mono text-amber-300 focus:outline-none focus:border-amber-400 text-center font-bold"
                          title="Waktu selesai dalam detik"
                        />
                        <div className="flex items-center gap-0.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('end', -0.5)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Selesai lebih awal -0.5s"
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('end', -0.1)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Selesai lebih awal -0.1s"
                          >
                            -0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('end', 0.1)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Selesai lebih lama +0.1s"
                          >
                            +0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudgeTiming('end', 0.5)}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[9px] font-mono"
                            title="Selesai lebih lama +0.5s"
                          >
                            +0.5s
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Baris 2: Tambah / Kurangi Durasi Tampil */}
                  <div className="bg-[#050811] px-2 py-1.5 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-semibold text-slate-300">Durasi:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={Number((activeSegment.end - activeSegment.start).toFixed(2))}
                        onChange={(e) => handleSetExactDuration(parseFloat(e.target.value) || 0.1)}
                        className="w-14 bg-black/80 border border-emerald-500/40 rounded px-1 py-0.5 text-[11px] font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 text-center"
                        title="Durasi dalam detik (bisa diedit langsung)"
                      />
                      <span className="text-[10px] font-mono text-emerald-400">detik</span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {/* Kurangi durasi */}
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px] text-red-400/80 font-mono mr-0.5">Kurang:</span>
                        <button
                          type="button"
                          onClick={() => handleAdjustDuration(-1.0)}
                          className="px-1.5 py-0.5 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[9px] font-mono font-semibold transition-colors"
                          title="Kurangi durasi 1.0 detik"
                        >
                          -1.0s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustDuration(-0.5)}
                          className="px-1.5 py-0.5 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[9px] font-mono font-semibold transition-colors"
                          title="Kurangi durasi 0.5 detik"
                        >
                          -0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustDuration(-0.1)}
                          className="px-1.5 py-0.5 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[9px] font-mono font-semibold transition-colors"
                          title="Kurangi durasi 0.1 detik"
                        >
                          -0.1s
                        </button>
                      </div>

                      {/* Tambah durasi */}
                      <div className="flex items-center gap-0.5 ml-1">
                        <span className="text-[9px] text-emerald-400/80 font-mono mr-0.5">Tambah:</span>
                        <button
                          type="button"
                          onClick={() => handleAdjustDuration(0.1)}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[9px] font-mono font-semibold transition-colors"
                          title="Tambah durasi 0.1 detik"
                        >
                          +0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustDuration(0.5)}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[9px] font-mono font-semibold transition-colors"
                          title="Tambah durasi 0.5 detik"
                        >
                          +0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustDuration(1.0)}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[9px] font-mono font-semibold transition-colors"
                          title="Tambah durasi 1.0 detik"
                        >
                          +1.0s
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Toolbar Pengaturan Gaya Teks & Posisi Cepat */}
              <div className="p-1.5 rounded-xl bg-black/40 border border-white/5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                {/* Font Size Adjuster */}
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5">
                  <span className="text-[10px] font-mono text-slate-400 pl-1.5">Size</span>
                  <button
                    type="button"
                    onClick={() => handleAdjustFontSize(-2)}
                    className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-bold"
                    title="Perkecil Font"
                  >
                    -
                  </button>
                  <span className="text-[11px] font-mono text-cyan-300 font-bold px-1">
                    {subtitle?.fontSize || 32}px
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustFontSize(2)}
                    className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-bold"
                    title="Perbesar Font"
                  >
                    +
                  </button>
                </div>

                {/* Font Family Selector */}
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-1.5 py-0.5">
                  <span className="text-[10px] font-mono text-slate-400">Font</span>
                  <select
                    value={subtitle?.fontFamily || 'Montserrat'}
                    onChange={(e) => handleUpdateFontFamily(e.target.value)}
                    className="bg-transparent text-cyan-300 text-[11px] font-medium focus:outline-none cursor-pointer max-w-[85px]"
                    title="Ganti jenis font lirik di layar visualizer"
                  >
                    <option value="Montserrat" className="bg-slate-900 text-white">Montserrat</option>
                    <option value="Inter" className="bg-slate-900 text-white">Inter (Tajam)</option>
                    <option value="Poppins" className="bg-slate-900 text-white">Poppins</option>
                    <option value="Roboto" className="bg-slate-900 text-white">Roboto</option>
                    <option value="Rubik" className="bg-slate-900 text-white">Rubik</option>
                    <option value="Anton" className="bg-slate-900 text-white">Anton</option>
                    <option value="Impact" className="bg-slate-900 text-white">Impact</option>
                    <option value="Bebas Neue" className="bg-slate-900 text-white">Bebas Neue</option>
                  </select>
                </div>

                {/* Outline / Stroke Width */}
                <div className="flex items-center gap-0.5 bg-black/40 border border-white/10 rounded-lg p-0.5">
                  <span className="text-[10px] font-mono text-slate-400 pl-1">Garis</span>
                  {[0, 2, 4].map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      onClick={() => handleUpdateStrokeWidth(sw)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        (subtitle?.strokeWidth ?? 3) === sw
                          ? 'bg-cyan-500/30 text-cyan-300 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Tebal garis tepi teks: ${sw}px`}
                    >
                      {sw === 0 ? 'Off' : `${sw}px`}
                    </button>
                  ))}
                </div>

                {/* Quick Presets for Position */}
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPosition('top')}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      posY <= 25 ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Posisi Atas (16%)"
                  >
                    Atas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPosition('center')}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      posY > 35 && posY < 65 ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Posisi Tengah (50%)"
                  >
                    Tengah
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPosition('center_bottom')}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      posY >= 65 ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Posisi Bawah Standar (74%)"
                  >
                    Bawah
                  </button>
                </div>
              </div>
            </div>

            {/* Pinned Sticky Footer (Action Buttons & Selesai) - Always Visible! */}
            <div className="shrink-0 pt-2 mt-1.5 border-t border-white/10 flex items-center justify-between gap-1.5 text-xs bg-[#0A0E17]/95">
              {/* Left Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Toggle Translation */}
                <button
                  type="button"
                  onClick={() => setShowTranslationInput((prev) => !prev)}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] transition-all flex items-center gap-1 ${
                    showTranslationInput || activeSegment?.translation
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 font-semibold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                  title="Tambah Terjemahan Bahasa Kedua"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>Arti</span>
                </button>

                {/* Add New Line */}
                <button
                  type="button"
                  onClick={handleAddNewLine}
                  className="px-2 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold transition-all flex items-center gap-1"
                  title="Tambah baris lirik baru di detik sekarang"
                >
                  <Plus className="w-3 h-3 shrink-0" />
                  <span>Baris Baru</span>
                </button>

                {/* Delete Line */}
                <button
                  type="button"
                  onClick={handleDeleteLine}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-300 transition-all flex items-center gap-1"
                  title="Hapus baris lirik ini"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline text-[11px]">Hapus</span>
                </button>

                {/* Open Full Subtitle Editor Modal */}
                {onOpenFullModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      onOpenFullModal();
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 transition-all"
                    title="Buka Editor Lirik Lengkap (SRT / Whisper AI / Penggantian Massal)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Right: Done / Save Button (Permanent & Prominent) */}
              <button
                type="button"
                onClick={handleDone}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 ${
                  showSavedFeedback
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20 active:scale-95'
                }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{showSavedFeedback ? 'Tersimpan!' : 'Selesai'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
