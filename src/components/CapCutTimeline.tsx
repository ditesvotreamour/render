import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Scissors,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  RotateCcw,
  Flame,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Layers,
  Music,
  Type,
  Activity,
  ListMusic,
  Check,
  Download,
  Upload,
  Image as ImageIcon,
  Trash2,
  X,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import type { AudioTrack, SubtitleConfig, BackgroundConfig, CenterLogoConfig, SlideItem } from '../types/visualizer';
import { SAMPLE_TRACKS } from '../data/sampleTracks';
import { globalAudioEngine } from '../utils/audioEngine';
import { AudioTrimmerJoiner, sliceLyrics } from '../utils/audioTrimmerJoiner';
import { AiLyricImageModal } from './AiLyricImageModal';
import { heuristicMatchImagesToLyrics } from '../utils/aiLyricImageMatcher';

interface CapCutTimelineProps {
  currentTrack: AudioTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  subtitleConfig: SubtitleConfig;
  backgroundConfig: BackgroundConfig;
  centerLogoConfig: CenterLogoConfig;
  onBackgroundChange: (bg: BackgroundConfig) => void;
  onCenterLogoChange: (logo: CenterLogoConfig) => void;
  onTogglePlay: () => void;
  onSelectTrack: (track: AudioTrack) => void;
  onUploadAudio: (file: File) => void;
  onTrackChanged: (file: File, newLyrics?: SubtitleConfig['lyrics']) => Promise<void>;
  onOpenAudioLab?: () => void;
  onOpenCutterJoinerModal?: () => void;
  onOpenWhisperModal?: () => void;
  onOpenSubtitleEditor?: () => void;
  onOpenLibrary?: () => void;
}

export const CapCutTimeline: React.FC<CapCutTimelineProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  subtitleConfig,
  backgroundConfig,
  centerLogoConfig,
  onBackgroundChange,
  onCenterLogoChange,
  onTogglePlay,
  onSelectTrack,
  onUploadAudio,
  onTrackChanged,
  onOpenAudioLab,
  onOpenCutterJoinerModal,
  onOpenWhisperModal,
  onOpenSubtitleEditor,
  onOpenLibrary,
}) => {
  // Timeline Zoom & Height state
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 4x zoom
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [showTrackDropdown, setShowTrackDropdown] = useState<boolean>(false);

  // In-Timeline Trim state
  const [trimRange, setTrimRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedClip, setSelectedClip] = useState<'audio' | 'subtitle' | 'image' | null>('audio');
  const [isApplyingTrim, setIsApplyingTrim] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Image Track state
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState<boolean>(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingMediaOver, setIsDraggingMediaOver] = useState<boolean>(false);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [showAiMatchModal, setShowAiMatchModal] = useState<boolean>(false);
  const [imageFileStore, setImageFileStore] = useState<Array<{ url: string; name: string }>>([]);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingPlayheadRef = useRef<boolean>(false);
  const isDraggingTrimHandleRef = useRef<'start' | 'end' | null>(null);

  const effectiveDuration = duration > 0 ? duration : 180;

  // Available images for AI Matcher
  const availableImagesForAi = useMemo(() => {
    if (backgroundConfig.multiImageSlides && backgroundConfig.multiImageSlides.length > 0) {
      return backgroundConfig.multiImageSlides.map((s) => ({
        url: s.url,
        name: s.name || 'Foto'
      }));
    }
    if (backgroundConfig.multiImageUrls && backgroundConfig.multiImageUrls.length > 0) {
      return backgroundConfig.multiImageUrls.map((url, idx) => {
        const stored = imageFileStore.find((item) => item.url === url);
        return {
          url,
          name: stored?.name || `Foto_${idx + 1}.jpg`
        };
      });
    }
    return [];
  }, [backgroundConfig.multiImageSlides, backgroundConfig.multiImageUrls, imageFileStore]);

  const handleApplyAiSlides = (slides: SlideItem[]) => {
    onBackgroundChange({
      ...backgroundConfig,
      type: 'multi_image',
      multiImageUrls: slides.map((s) => s.url),
      multiImageSlides: slides,
    });
    setStatusMessage(`✨ Berhasil mencocokkan ${slides.length} foto dengan lirik lagu!`);
    setSelectedClip('image');
  };

  // Compute image clips for the timeline
  const imageClips = useMemo(() => {
    const clips: {
      id: string;
      type: 'background' | 'center_logo' | 'slide';
      url: string;
      title: string;
      startSec: number;
      endSec: number;
      startPct: number;
      widthPct: number;
      slideIndex?: number;
      originalIndex?: number;
      duration?: number;
    }[] = [];

    // 1. Multi-image slides
    if (backgroundConfig.type === 'multi_image') {
      if (backgroundConfig.multiImageSlides && backgroundConfig.multiImageSlides.length > 0) {
        backgroundConfig.multiImageSlides.forEach((slide, idx) => {
          clips.push({
            id: slide.id || `slide-${idx}`,
            type: 'slide',
            url: slide.url,
            title: slide.name || `Foto ${idx + 1}`,
            startSec: slide.startSec,
            endSec: slide.endSec,
            startPct: (slide.startSec / effectiveDuration) * 100,
            widthPct: Math.max(0.5, ((slide.endSec - slide.startSec) / effectiveDuration) * 100),
            slideIndex: idx + 1,
            originalIndex: idx,
            duration: slide.endSec - slide.startSec,
          });
        });
      } else if (backgroundConfig.multiImageUrls && backgroundConfig.multiImageUrls.length > 0) {
        const urls = backgroundConfig.multiImageUrls;
        const count = urls.length;
        const interval = backgroundConfig.multiImageInterval && backgroundConfig.multiImageInterval > 0
          ? backgroundConfig.multiImageInterval
          : 5;

        const totalSlides = Math.min(80, Math.ceil(effectiveDuration / interval));
        for (let i = 0; i < totalSlides; i++) {
          const start = i * interval;
          if (start >= effectiveDuration) break;
          const end = Math.min(effectiveDuration, (i + 1) * interval);
          const originalIndex = i % count;
          clips.push({
            id: `slide-${i}-${originalIndex}`,
            type: 'slide',
            url: urls[originalIndex],
            title: `Foto ${originalIndex + 1}`,
            startSec: start,
            endSec: end,
            startPct: (start / effectiveDuration) * 100,
            widthPct: Math.max(0.5, ((end - start) / effectiveDuration) * 100),
            slideIndex: originalIndex + 1,
            originalIndex,
            duration: end - start,
          });
        }
      }
    } else if (backgroundConfig.customImageUrl) {
      // 2. Custom background single image
      clips.push({
        id: 'bg-single',
        type: 'background',
        url: backgroundConfig.customImageUrl,
        title: 'Background Wallpaper',
        startSec: 0,
        endSec: effectiveDuration,
        startPct: 0,
        widthPct: 100,
        duration: effectiveDuration,
      });
    }

    // 3. Center Logo image
    if (centerLogoConfig.enabled && centerLogoConfig.imageUrl) {
      clips.push({
        id: 'logo-single',
        type: 'center_logo',
        url: centerLogoConfig.imageUrl,
        title: 'Logo Tengah',
        startSec: 0,
        endSec: effectiveDuration,
        startPct: 0,
        widthPct: 100,
        duration: effectiveDuration,
      });
    }

    return clips;
  }, [backgroundConfig, centerLogoConfig, effectiveDuration]);

  // Handle picked or dropped image files
  const handleImageFilesSelected = (files: File[]) => {
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newItems = validFiles.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
    }));

    setImageFileStore((prev) => [...prev, ...newItems]);
    const newUrls = newItems.map((item) => item.url);

    // If currently already multi_image slideshow mode:
    if (backgroundConfig.type === 'multi_image') {
      const current = backgroundConfig.multiImageUrls || [];
      const updated = [...current, ...newUrls];

      if (subtitleConfig.lyrics && subtitleConfig.lyrics.length > 0) {
        const allItems = [...imageFileStore, ...newItems];
        const matched = heuristicMatchImagesToLyrics(allItems, subtitleConfig.lyrics, effectiveDuration);
        onBackgroundChange({
          ...backgroundConfig,
          multiImageUrls: updated,
          multiImageSlides: matched.map((m) => m.slide),
        });
        setStatusMessage(`✨ ${validFiles.length} foto ditambahkan & dicocokkan otomatis ke timestamp lirik lagu!`);
      } else {
        onBackgroundChange({
          ...backgroundConfig,
          multiImageUrls: updated,
          multiImageInterval: backgroundConfig.multiImageInterval || 5,
        });
        setStatusMessage(`📸 ${validFiles.length} foto berhasil ditambahkan ke slideshow background!`);
      }
      setSelectedClip('image');
    } else if (validFiles.length > 1) {
      // Picked multiple photos: start slideshow immediately
      if (subtitleConfig.lyrics && subtitleConfig.lyrics.length > 0) {
        const matched = heuristicMatchImagesToLyrics(newItems, subtitleConfig.lyrics, effectiveDuration);
        onBackgroundChange({
          ...backgroundConfig,
          type: 'multi_image',
          multiImageUrls: newUrls,
          multiImageSlides: matched.map((m) => m.slide),
        });
        setStatusMessage(`✨ Slideshow dibuat & nama foto otomatis dicocokkan ke lirik lagu!`);
      } else {
        onBackgroundChange({
          ...backgroundConfig,
          type: 'multi_image',
          multiImageUrls: newUrls,
          multiImageInterval: Math.max(2, Math.round(effectiveDuration / newUrls.length)),
        });
        setStatusMessage(`🎞️ Slideshow background dibuat dengan ${validFiles.length} foto!`);
      }
      setSelectedClip('image');
    } else {
      // 1 photo and not slideshow: show choice modal
      setPendingImageUrl(newUrls[0]);
      setShowImageDialog(true);
    }
  };

  const handleImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageFilesSelected(Array.from(e.target.files));
    }
    if (e.target) e.target.value = '';
  };

  // Drag & Drop event handlers on Media Track
  const handleMediaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingMediaOver) setIsDraggingMediaOver(true);
  };

  const handleMediaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingMediaOver(false);
    }
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMediaOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  // Reordering slide items
  const handleMoveSlide = (originalIndex: number, direction: 'left' | 'right') => {
    const current = backgroundConfig.multiImageUrls ? [...backgroundConfig.multiImageUrls] : [];
    if (current.length <= 1) return;
    const targetIndex = direction === 'left' ? originalIndex - 1 : originalIndex + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;

    const temp = current[originalIndex];
    current[originalIndex] = current[targetIndex];
    current[targetIndex] = temp;

    let updatedSlides = backgroundConfig.multiImageSlides ? [...backgroundConfig.multiImageSlides] : undefined;
    if (updatedSlides && updatedSlides.length > targetIndex && updatedSlides.length > originalIndex) {
      const tempSlide = updatedSlides[originalIndex];
      updatedSlides[originalIndex] = updatedSlides[targetIndex];
      updatedSlides[targetIndex] = tempSlide;
    }

    onBackgroundChange({
      ...backgroundConfig,
      multiImageUrls: current,
      multiImageSlides: updatedSlides,
    });
    setStatusMessage(`🔄 Urutan foto diubah.`);
  };

  const handleSlideReorderDrop = (sourceIndex: number, targetIndex: number) => {
    const current = backgroundConfig.multiImageUrls ? [...backgroundConfig.multiImageUrls] : [];
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= current.length || targetIndex >= current.length) return;

    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);

    let updatedSlides = backgroundConfig.multiImageSlides ? [...backgroundConfig.multiImageSlides] : undefined;
    if (updatedSlides && updatedSlides.length === current.length + 1) {
      const [movedSlide] = updatedSlides.splice(sourceIndex, 1);
      updatedSlides.splice(targetIndex, 0, movedSlide);
    }

    onBackgroundChange({
      ...backgroundConfig,
      multiImageUrls: current,
      multiImageSlides: updatedSlides,
    });
    setStatusMessage(`🔄 Foto dipindah ke posisi #${targetIndex + 1}.`);
  };

  const handleSlideDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    setDraggedSlideIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  // Duration adjustments
  const handleUpdateInterval = (newInterval: number) => {
    const clamped = Math.max(1, Math.min(60, Number(newInterval.toFixed(1))));
    onBackgroundChange({
      ...backgroundConfig,
      multiImageInterval: clamped,
      multiImageSlides: undefined, // Switch to uniform interval
    });
    setStatusMessage(`⏱️ Durasi per foto diatur: ${clamped}s (mode interval merata).`);
  };

  const handleFitSlidesToSong = () => {
    const count = backgroundConfig.multiImageUrls?.length || 1;
    const fitInterval = Number(Math.max(1, effectiveDuration / count).toFixed(1));
    onBackgroundChange({
      ...backgroundConfig,
      multiImageInterval: fitInterval,
      multiImageSlides: undefined, // Switch to fitted uniform interval
    });
    setStatusMessage(`⚡ Durasi disesuaikan pas dengan lagu: ${fitInterval}s / foto!`);
  };

  const handleSetImageAsBackground = (url: string) => {
    onBackgroundChange({
      ...backgroundConfig,
      type: 'custom_image',
      customImageUrl: url,
    });
    setStatusMessage('🖼️ Gambar latar belakang (background) visualizer berhasil dipasang!');
  };

  const handleSetImageAsLogo = (url: string) => {
    onCenterLogoChange({
      ...centerLogoConfig,
      enabled: true,
      imageUrl: url,
    });
    setStatusMessage('💿 Gambar logo tengah visualizer berhasil dipasang!');
  };

  const handleAddImageSlide = (url: string) => {
    const prev = backgroundConfig.multiImageUrls || (backgroundConfig.customImageUrl ? [backgroundConfig.customImageUrl] : []);
    const updated = [...prev, url];
    onBackgroundChange({
      ...backgroundConfig,
      type: 'multi_image',
      multiImageUrls: updated,
      multiImageInterval: backgroundConfig.multiImageInterval || Math.max(3, Math.floor(effectiveDuration / updated.length)),
    });
    setStatusMessage(`🎞️ Slide foto baru ditambahkan (${updated.length} foto di timeline)!`);
  };

  const handleRemoveImageClip = (clip: { id: string; type: string; url: string; originalIndex?: number; slideIndex?: number }) => {
    if (clip.type === 'slide') {
      const prev = backgroundConfig.multiImageUrls || [];
      const targetIdx = clip.originalIndex !== undefined ? clip.originalIndex : (clip.slideIndex ? clip.slideIndex - 1 : 0);
      const updated = prev.filter((_, idx) => idx !== targetIdx);
      const prevSlides = backgroundConfig.multiImageSlides || [];
      const updatedSlides = prevSlides.length > 0 ? prevSlides.filter((_, idx) => idx !== targetIdx) : undefined;
      if (updated.length === 0) {
        onBackgroundChange({ ...backgroundConfig, type: 'preset_grid', multiImageUrls: [], multiImageSlides: [] });
        setStatusMessage('🗑️ Slideshow dihapus.');
      } else {
        onBackgroundChange({ ...backgroundConfig, multiImageUrls: updated, multiImageSlides: updatedSlides });
        setStatusMessage('🗑️ 1 slide foto dihapus dari timeline.');
      }
    } else if (clip.type === 'background') {
      onBackgroundChange({ ...backgroundConfig, type: 'preset_grid', customImageUrl: '' });
      setStatusMessage('🗑️ Background custom dihapus.');
    } else if (clip.type === 'center_logo') {
      onCenterLogoChange({ ...centerLogoConfig, imageUrl: '' });
      setStatusMessage('🗑️ Logo tengah dihapus.');
    }
  };

  // Sync volume & loop with audioEngine
  useEffect(() => {
    globalAudioEngine.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  useEffect(() => {
    globalAudioEngine.setLoop(isLooping);
  }, [isLooping]);

  // Sync trim range from audioEngine if set externally
  useEffect(() => {
    if (globalAudioEngine.trimRange) {
      setTrimRange(globalAudioEngine.trimRange);
    }
  }, [currentTrack]);

  // Clear status message after 4s
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Auto-scroll timeline to follow playhead when zoomed in
  useEffect(() => {
    if (!timelineContainerRef.current || !isPlaying || zoomLevel === 1) return;
    const container = timelineContainerRef.current;
    const playheadPx = (currentTime / effectiveDuration) * (container.scrollWidth);
    const visibleStart = container.scrollLeft;
    const visibleEnd = visibleStart + container.clientWidth;

    if (playheadPx < visibleStart || playheadPx > visibleEnd - 80) {
      container.scrollTo({
        left: Math.max(0, playheadPx - container.clientWidth / 2),
        behavior: 'smooth',
      });
    }
  }, [currentTime, isPlaying, zoomLevel, effectiveDuration]);

  // Generate simulated waveform bars for the audio track
  const waveformBars = useMemo(() => {
    const barsCount = 140;
    const bars: number[] = [];
    for (let i = 0; i < barsCount; i++) {
      // Procedural musical waveform profile with intro, drop, breakdown, drop
      const progress = i / barsCount;
      let height = 0.25;
      if (progress > 0.15 && progress < 0.4) {
        height = 0.6 + Math.sin(i * 0.8) * 0.35; // Drop 1
      } else if (progress >= 0.4 && progress < 0.55) {
        height = 0.35 + Math.sin(i * 0.5) * 0.15; // Breakdown
      } else if (progress >= 0.55 && progress < 0.85) {
        height = 0.75 + Math.sin(i * 0.9) * 0.25; // Climax Drop 2
      } else {
        height = 0.3 + Math.sin(i * 0.6) * 0.2; // Intro / Outro
      }
      bars.push(Math.max(0.15, Math.min(1.0, height)));
    }
    return bars;
  }, [currentTrack.id]);

  // Format time utilities
  const formatTimecode = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00.00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms < 10 ? '0' : ''}${ms}`;
  };

  const formatSec = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Convert mouse X client coordinate on the timeline to seconds
  const getSecondsFromMouseEvent = useCallback(
    (clientX: number): number => {
      if (!timelineContainerRef.current) return 0;
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const scrollLeft = timelineContainerRef.current.scrollLeft;
      const clickX = clientX - rect.left + scrollLeft;
      const totalWidth = timelineContainerRef.current.scrollWidth;
      const progress = Math.max(0, Math.min(1, clickX / totalWidth));
      return progress * effectiveDuration;
    },
    [effectiveDuration]
  );

  // Seek handler from clicking or dragging timeline
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.trim-handle')) return;
    isDraggingPlayheadRef.current = true;
    const targetSec = getSecondsFromMouseEvent(e.clientX);
    globalAudioEngine.seek(targetSec);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingPlayheadRef.current) return;
      const sec = getSecondsFromMouseEvent(moveEvent.clientX);
      globalAudioEngine.seek(sec);
    };

    const onMouseUp = () => {
      isDraggingPlayheadRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Dragging CapCut Trim Handles
  const handleTrimHandleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    isDraggingTrimHandleRef.current = handle;

    const currentStart = trimRange ? trimRange.start : 0;
    const currentEnd = trimRange ? trimRange.end : effectiveDuration;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingTrimHandleRef.current) return;
      const sec = getSecondsFromMouseEvent(moveEvent.clientX);

      if (handle === 'start') {
        const newStart = Math.max(0, Math.min(sec, currentEnd - 1));
        const newRange = { start: newStart, end: currentEnd };
        setTrimRange(newRange);
        globalAudioEngine.setTrimRange(newRange);
        globalAudioEngine.seek(newStart);
      } else {
        const newEnd = Math.min(effectiveDuration, Math.max(sec, currentStart + 1));
        const newRange = { start: currentStart, end: newEnd };
        setTrimRange(newRange);
        globalAudioEngine.setTrimRange(newRange);
        globalAudioEngine.seek(newEnd);
      }
    };

    const onMouseUp = () => {
      isDraggingTrimHandleRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // --- CapCut Split Tool (Bagi pada Jarum) ---
  const handleSplitAtPlayhead = () => {
    const cur = currentTime;
    if (cur <= 1 || cur >= effectiveDuration - 1) {
      setStatusMessage('Pindahkan jarum penunjuk ke tengah audio untuk memotong.');
      return;
    }

    // Set trim range from playhead or split to end
    if (!trimRange) {
      const newRange = { start: Math.max(0, cur - 15), end: Math.min(effectiveDuration, cur + 30) };
      setTrimRange(newRange);
      globalAudioEngine.setTrimRange(newRange);
      setStatusMessage(`✂️ Split aktif: Rentang potongan diset ${formatSec(newRange.start)} - ${formatSec(newRange.end)}`);
    } else {
      // If playhead is inside trim range, adjust nearest border
      const distToStart = Math.abs(cur - trimRange.start);
      const distToEnd = Math.abs(cur - trimRange.end);
      let newRange;
      if (distToStart < distToEnd) {
        newRange = { start: cur, end: trimRange.end };
      } else {
        newRange = { start: trimRange.start, end: cur };
      }
      setTrimRange(newRange);
      globalAudioEngine.setTrimRange(newRange);
      setStatusMessage(`✂️ Potongan disesuaikan ke posisi jarum: ${formatSec(cur)}`);
    }
  };

  // Potong Awal (Hapus sebelum jarum, simpan dari jarum ke akhir)
  const handleTrimBeforePlayhead = () => {
    const cur = currentTime;
    if (cur <= 0.5) return;
    const newRange = { start: cur, end: effectiveDuration };
    setTrimRange(newRange);
    globalAudioEngine.setTrimRange(newRange);
    setStatusMessage(`✂️ Potong awal: simpan dari ${formatSec(cur)} hingga selesai.`);
  };

  // Potong Akhir (Hapus setelah jarum, simpan awal hingga jarum)
  const handleTrimAfterPlayhead = () => {
    const cur = currentTime;
    if (cur >= effectiveDuration - 0.5) return;
    const newRange = { start: 0, end: cur };
    setTrimRange(newRange);
    globalAudioEngine.setTrimRange(newRange);
    setStatusMessage(`✂️ Potong akhir: simpan dari awal hingga ${formatSec(cur)}.`);
  };

  // Preset: AI Drop / Reff Finder
  const handlePresetAiReff = async () => {
    let analysis = globalAudioEngine.lastAnalysis;
    if (!analysis) {
      analysis = await globalAudioEngine.analyzeCurrentTrack();
    }

    if (analysis && analysis.sections.length > 0) {
      const dropSection =
        analysis.sections.find((s) => s.type === 'drop' || s.type === 'chorus') ||
        analysis.sections.reduce((max, s) => (s.energy > max.energy ? s : max), analysis.sections[0]);

      if (dropSection) {
        const start = Math.max(0, Math.floor(dropSection.start));
        const end = Math.min(effectiveDuration, Math.ceil(dropSection.end));
        const newRange = { start, end };
        setTrimRange(newRange);
        globalAudioEngine.setTrimRange(newRange);
        globalAudioEngine.seek(start);
        setStatusMessage(`🔥 AI mendeteksi ${dropSection.name} (${formatSec(start)} - ${formatSec(end)})`);
        return;
      }
    }

    // Fallback: take middle 40 seconds
    const mid = effectiveDuration / 2;
    const newRange = {
      start: Math.max(0, Math.floor(mid - 15)),
      end: Math.min(effectiveDuration, Math.floor(mid + 25)),
    };
    setTrimRange(newRange);
    globalAudioEngine.setTrimRange(newRange);
    globalAudioEngine.seek(newRange.start);
    setStatusMessage(`🔥 Bagian tengah lagu dipilih (${formatSec(newRange.start)} - ${formatSec(newRange.end)})`);
  };

  // Reset Trim
  const handleResetTrim = () => {
    setTrimRange(null);
    globalAudioEngine.setTrimRange(null);
    setStatusMessage('🔄 Rentang potongan di-reset ke lagu penuh.');
  };

  // Commit and apply cut permanently to visualizer
  const handleApplyTrimPermanently = async () => {
    if (!trimRange) {
      setStatusMessage('Belum ada bagian audio yang dipotong.');
      return;
    }

    try {
      setIsApplyingTrim(true);
      const audioBlob = await AudioTrimmerJoiner.getTrackAudioBlob(currentTrack);

      const cutTitle = `${currentTrack.title}_Cut_${Math.round(trimRange.start)}-${Math.round(trimRange.end)}s.wav`;
      const trimResult = await AudioTrimmerJoiner.trimAudioFile(
        audioBlob,
        trimRange.start,
        trimRange.end,
        cutTitle
      );

      // Synchronously slice subtitle timestamps so they remain 100% matched to the cut audio
      const adjustedLyrics = sliceLyrics(subtitleConfig.lyrics, trimRange.start, trimRange.end);

      setTrimRange(null);
      globalAudioEngine.setTrimRange(null);
      await onTrackChanged(trimResult.file, adjustedLyrics);
      setStatusMessage(`✅ Potongan (${Math.round(trimResult.duration)}s) & subtitle berhasil diterapkan ke visualizer!`);
    } catch (err: any) {
      console.error('Apply trim failed:', err);
      alert(err.message || 'Gagal menerapkan potongan.');
    } finally {
      setIsApplyingTrim(false);
    }
  };

  // Download cut WAV
  const handleDownloadTrimWav = async () => {
    if (!trimRange) return;
    try {
      setIsApplyingTrim(true);
      const audioBlob = await AudioTrimmerJoiner.getTrackAudioBlob(currentTrack);

      const cutTitle = `${currentTrack.title}_Cut_${Math.round(trimRange.start)}-${Math.round(trimRange.end)}s.wav`;
      const trimResult = await AudioTrimmerJoiner.trimAudioFile(
        audioBlob,
        trimRange.start,
        trimRange.end,
        cutTitle
      );

      const url = URL.createObjectURL(trimResult.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cutTitle;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage(`💾 Berhasil mengunduh: ${cutTitle}`);
    } catch (err: any) {
      alert(err.message || 'Gagal download WAV.');
    } finally {
      setIsApplyingTrim(false);
    }
  };

  // Generate ruler tick marks
  const rulerTicks = useMemo(() => {
    const stepSeconds = zoomLevel === 1 ? 15 : zoomLevel === 2 ? 8 : zoomLevel === 3 ? 4 : 2;
    const ticks: { sec: number; label: string; percent: number }[] = [];
    for (let s = 0; s <= effectiveDuration; s += stepSeconds) {
      ticks.push({
        sec: s,
        label: formatSec(s),
        percent: (s / effectiveDuration) * 100,
      });
    }
    return ticks;
  }, [effectiveDuration, zoomLevel]);

  // Current playhead percentage
  const playheadPercent = (currentTime / effectiveDuration) * 100;

  // Active trim coordinates
  const trimStartPercent = trimRange ? (trimRange.start / effectiveDuration) * 100 : 0;
  const trimEndPercent = trimRange ? (trimRange.end / effectiveDuration) * 100 : 100;
  const trimWidthPercent = trimEndPercent - trimStartPercent;

  return (
    <div className="w-full bg-[#07090F] border-t border-white/10 flex flex-col select-none shrink-0 z-20 shadow-2xl transition-all duration-300">
      {/* ========================================================= */}
      {/* 1. CAPCUT / CLIPCHAMP EDITING TOOLBAR                      */}
      {/* ========================================================= */}
      <div className="h-10 sm:h-11 px-2 sm:px-4 bg-[#0B0F19] border-b border-white/10 flex items-center justify-between text-xs gap-2">
        {/* Left: Quick Editing Tools (Split, AI Reff, Sambung, Reset) */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
          {/* Split at Playhead */}
          <button
            onClick={handleSplitAtPlayhead}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
            title="Bagi / Potong audio pada posisi jarum putar saat ini (CapCut Split Tool)"
          >
            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">Split</span>
          </button>

          {/* Quick Trim Left / Right Shortcuts */}
          <button
            onClick={handleTrimBeforePlayhead}
            className="px-1.5 sm:px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 border border-white/10 text-[11px] font-semibold transition-all active:scale-95 shrink-0 hidden sm:inline"
            title="Potong Kiri: Hapus bagian sebelum jarum (mulai lagu dari posisi jarum)"
          >
            ◀ Kiri
          </button>

          <button
            onClick={handleTrimAfterPlayhead}
            className="px-1.5 sm:px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 border border-white/10 text-[11px] font-semibold transition-all active:scale-95 shrink-0 hidden sm:inline"
            title="Potong Kanan: Hapus bagian sesudah jarum (akhiri lagu di posisi jarum)"
          >
            Kanan ▶
          </button>

          {/* Edit Subtitle Text */}
          {onOpenSubtitleEditor && (
            <button
              onClick={onOpenSubtitleEditor}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
              title="Buka Editor Teks Subtitle (Ubah lirik, cari/ganti kata, atur timing)"
            >
              <Type className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Edit Teks</span>
              <span className="sm:hidden">Teks</span>
            </button>
          )}

          {/* Pustaka / Riwayat Lagu & Potongan */}
          {onOpenLibrary && (
            <button
              onClick={onOpenLibrary}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
              title="Buka Pustaka & Riwayat Lagu/Potongan Tersimpan"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Pustaka Lagu</span>
              <span className="sm:hidden">Pustaka</span>
            </button>
          )}

          {/* AI Reff Drop Finder */}
          <button
            onClick={handlePresetAiReff}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
            title="Otomatis deteksi dan pilih bagian Reff / Chorus dengan energi puncak"
          >
            <Flame className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Ambil Reff</span>
          </button>

          {/* Sambung Multi-Lagu (Open Joiner Modal) */}
          <button
            onClick={onOpenCutterJoinerModal}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
            title="Sambungkan 3 atau 4 lagu menjadi 1 lagu panjang (Audio Megamix Joiner)"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Sambung Lagu</span>
            <span className="md:hidden">+ Sambung</span>
          </button>

          {/* AI Audio Lab */}
          {onOpenAudioLab && (
            <button
              onClick={onOpenAudioLab}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
              title="Buka AI Audio Lab (BPM, Drop & Stem Filter)"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden lg:inline">AI Lab</span>
            </button>
          )}

          {/* Tambah Gambar ke Timeline */}
          <button
            onClick={() => imageFileInputRef.current?.click()}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
            title="Tambah Gambar / Wallpaper / Logo ke Timeline Visualizer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">+ Gambar</span>
            <span className="md:hidden">+ Foto</span>
          </button>
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFilePicked}
          />

          {/* If trim is active, show Apply and Download options */}
          {trimRange && (
            <>
              <div className="h-4 w-[1px] bg-white/15 mx-0.5" />

              <button
                onClick={handleApplyTrimPermanently}
                disabled={isApplyingTrim}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-black flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0 disabled:opacity-50"
                title="Terapkan potongan ini secara permanen ke lagu visualizer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span className="text-[11px]">Terapkan Cut ({formatSec(trimRange.end - trimRange.start)})</span>
              </button>

              <button
                onClick={handleDownloadTrimWav}
                disabled={isApplyingTrim}
                className="p-1 sm:px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 flex items-center gap-1 transition-all shrink-0"
                title="Download file potongan sebagai WAV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden lg:inline text-[11px]">WAV</span>
              </button>

              <button
                onClick={handleResetTrim}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-all shrink-0"
                title="Batalkan potongan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {statusMessage && (
            <span className="text-[10px] sm:text-[11px] text-cyan-300 font-mono animate-in fade-in truncate max-w-[200px] sm:max-w-xs">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Center: Playhead Timecode & Transport Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-300 bg-black/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-white/10">
            <span className="text-cyan-400">{formatTimecode(currentTime)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span>{formatTimecode(effectiveDuration)}</span>
          </div>

          <button
            onClick={onTogglePlay}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-md transform hover:scale-105 active:scale-95 ${
              isPlaying
                ? 'bg-rose-500 text-white shadow-rose-500/30'
                : 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-cyan-400/30'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1 sm:p-1.5 rounded-lg border transition-all ${
              isLooping
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Loop Playback"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Track Dropdown, Volume, Timeline Zoom & Expand Toggle */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Track Selector Popup Button */}
          <div className="relative">
            <button
              onClick={() => setShowTrackDropdown(!showTrackDropdown)}
              className="p-1 sm:px-2 sm:py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-all"
              title="Ganti Lagu / Upload"
            >
              <ListMusic className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline max-w-[90px] truncate">{currentTrack.title}</span>
            </button>

            {showTrackDropdown && (
              <div className="absolute bottom-full mb-2 right-0 w-64 bg-[#0E1322] border border-white/20 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in">
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 flex justify-between items-center">
                  <span>Pilih Lagu</span>
                  <div className="flex items-center gap-2">
                    {onOpenLibrary && (
                      <button
                        onClick={() => {
                          setShowTrackDropdown(false);
                          onOpenLibrary();
                        }}
                        className="text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center gap-1 font-semibold"
                        title="Lihat semua lagu & potongan tersimpan"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Pustaka</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowTrackDropdown(false);
                        fileInputRef.current?.click();
                      }}
                      className="text-cyan-400 hover:text-cyan-300 text-[10px] flex items-center gap-1 font-semibold"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                  {SAMPLE_TRACKS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelectTrack(t);
                        setShowTrackDropdown(false);
                      }}
                      className={`w-full text-left p-1.5 rounded-xl flex items-center gap-2 text-xs ${
                        currentTrack.id === t.id ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <img src={t.coverArt} alt="" className="w-6 h-6 rounded-md object-cover" />
                      <div className="truncate flex-1">
                        <div className="font-semibold truncate">{t.title}</div>
                        <div className="text-[9px] text-slate-400">{t.artist}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUploadAudio(e.target.files[0]);
              }
            }}
          />

          {/* Volume Control */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1 text-slate-400 hover:text-white transition-all hidden md:block"
            title="Mute / Unmute"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (isMuted && val > 0) setIsMuted(false);
            }}
            className="w-14 sm:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hidden md:block"
          />

          {/* Timeline Zoom Buttons */}
          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 1))}
              disabled={zoomLevel <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              title="Zoom Out Timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-cyan-300 w-5 text-center font-bold">{zoomLevel}x</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(4, z + 1))}
              disabled={zoomLevel >= 4}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              title="Zoom In Timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand/Collapse Timeline */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title={isExpanded ? 'Kecilkan Timeline' : 'Perbesar Timeline'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CAPCUT MULTI-TRACK TIMELINE BODY                       */}
      {/* ========================================================= */}
      {isExpanded && (
        <div className="flex flex-col bg-[#070A12] relative overflow-hidden border-t border-white/5">
          {/* SLIDESHOW DURATION & SETTINGS CONTROL BAR */}
          {backgroundConfig.type === 'multi_image' && (
            <div className="bg-[#0b101e] border-b border-emerald-500/20 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs z-30 shadow-md">
              {/* Left: Badge & Add Photos */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Slideshow ({backgroundConfig.multiImageUrls?.length || 0} Foto)</span>
                </span>
                <button
                  onClick={() => imageFileInputRef.current?.click()}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                  title="Tambah foto lagi dari komputer (bisa pilih banyak sekaligus)"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Foto</span>
                </button>
                <button
                  onClick={() => setShowAiMatchModal(true)}
                  className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 hover:from-cyan-500/40 hover:to-indigo-500/40 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                  title="AI Analisis Nama Gambar & Cocokkan ke Timestamp Lirik Lagu Otomatis"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>✨ Cocokkan ke Lirik (AI)</span>
                </button>
                {backgroundConfig.multiImageSlides && backgroundConfig.multiImageSlides.length > 0 && (
                  <span className="hidden sm:inline-flex text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium">
                    🎵 Mode Lirik AI Aktif
                  </span>
                )}
              </div>

              {/* Center: Duration / Interval adjustment */}
              <div className="flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded-xl border border-white/10 shadow-inner">
                <div className="flex items-center gap-1 text-[11px] text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Durasi:</span>
                </div>

                {/* Decrement */}
                <button
                  onClick={() => handleUpdateInterval((backgroundConfig.multiImageInterval || 5) - 0.5)}
                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs active:scale-95"
                  title="Kurangi 0.5 detik"
                >
                  -
                </button>

                {/* Display */}
                <span className="font-mono text-cyan-300 font-bold text-[11px] min-w-[38px] text-center">
                  {(backgroundConfig.multiImageInterval || 5).toFixed(1)}s
                </span>

                {/* Increment */}
                <button
                  onClick={() => handleUpdateInterval((backgroundConfig.multiImageInterval || 5) + 0.5)}
                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs active:scale-95"
                  title="Tambah 0.5 detik"
                >
                  +
                </button>

                {/* Slider */}
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  value={backgroundConfig.multiImageInterval || 5}
                  onChange={(e) => handleUpdateInterval(parseFloat(e.target.value))}
                  className="w-16 sm:w-24 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-cyan-400"
                  title="Geser atur durasi tiap foto"
                />

                {/* Quick Presets */}
                <div className="hidden lg:flex items-center gap-1 text-[10px]">
                  {[2, 3, 5, 8, 10].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => handleUpdateInterval(sec)}
                      className={`px-1.5 py-0.5 rounded transition-all ${
                        Math.round(backgroundConfig.multiImageInterval || 5) === sec
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-white/5 hover:bg-white/15 text-slate-300'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>

                {/* "Pas Sesuai Lagu" Button */}
                <button
                  onClick={handleFitSlidesToSong}
                  className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/25 to-orange-500/25 hover:from-amber-500/40 hover:to-orange-500/40 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                  title={`Bagi rata durasi lagu (${formatSec(effectiveDuration)}) ke ${backgroundConfig.multiImageUrls?.length || 1} foto agar pas dari awal sampai akhir`}
                >
                  <span>⚡ Pas Sesuai Lagu</span>
                </button>
              </div>

              {/* Right: Transitions, Ken Burns & Reset */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  onClick={() =>
                    onBackgroundChange({
                      ...backgroundConfig,
                      multiImageTransition: backgroundConfig.multiImageTransition === 'cut' ? 'fade' : 'cut',
                    })
                  }
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                  title="Ganti transisi antara Fade (halus) atau Cut (langsung)"
                >
                  Transisi: <span className="text-cyan-300 font-bold">{backgroundConfig.multiImageTransition === 'cut' ? 'Cut' : 'Fade'}</span>
                </button>

                <button
                  onClick={() =>
                    onBackgroundChange({
                      ...backgroundConfig,
                      multiImageKenBurns: backgroundConfig.multiImageKenBurns === false ? true : false,
                    })
                  }
                  className={`px-2 py-0.5 rounded-lg border transition-all ${
                    backgroundConfig.multiImageKenBurns !== false
                      ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                  title="Aktifkan/Nonaktifkan efek Ken Burns Zoom halus"
                >
                  Zoom Ken Burns
                </button>

                <button
                  onClick={() => {
                    onBackgroundChange({ ...backgroundConfig, type: 'preset_grid', multiImageUrls: [] });
                    setStatusMessage('🗑️ Slideshow dihapus dari timeline.');
                  }}
                  className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
                  title="Hapus Slideshow"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col h-48 sm:h-56 relative overflow-hidden">
            {/* Left Track Headers (CapCut Track Sidebar) */}
            <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-32 bg-[#090D17] border-r border-white/10 z-20 flex flex-col text-[10px] font-bold text-slate-400">
              {/* Ruler Header Corner */}
              <div className="h-6 border-b border-white/10 px-2 flex items-center justify-between text-slate-500 font-mono text-[9px] bg-black/40">
                <span>TRACKS</span>
                <span className="text-cyan-400">TIME</span>
              </div>

              {/* Track 1: Audio Header */}
              <div className="h-14 sm:h-16 border-b border-white/5 px-2 flex flex-col justify-center gap-0.5 bg-cyan-950/20 text-cyan-300">
                <div className="flex items-center gap-1 truncate">
                  <Music className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">Audio Master</span>
                </div>
                <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 truncate">
                  {currentTrack.genre || 'Original WAV'}
                </span>
              </div>

              {/* Track 2: Image / Media Header */}
              <div
                onDragOver={handleMediaDragOver}
                onDragEnter={handleMediaDragOver}
                onDragLeave={handleMediaDragLeave}
                onDrop={handleMediaDrop}
                className={`h-14 sm:h-16 border-b border-white/5 px-2 flex flex-col justify-center gap-0.5 transition-colors ${
                  isDraggingMediaOver ? 'bg-emerald-800/40 text-emerald-200' : 'bg-emerald-950/20 text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 truncate">
                    <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">Media / Foto</span>
                  </div>
                  <button
                    onClick={() => imageFileInputRef.current?.click()}
                    className="text-[8px] bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 px-1 rounded font-bold transition-colors"
                    title="Tambah Gambar Baru ke Visualizer (Bisa pilih banyak foto)"
                  >
                    + Foto
                  </button>
                </div>
                <span className="text-[8px] font-mono text-slate-500 truncate">
                  {backgroundConfig.type === 'multi_image' && backgroundConfig.multiImageUrls?.length
                    ? `${backgroundConfig.multiImageUrls.length} Slideshow`
                    : imageClips.length > 0
                    ? `${imageClips.length} Gambar`
                    : 'Drag & Drop Foto'}
                </span>
              </div>

              {/* Track 3: Subtitle / Lyric Header */}
              <div className="h-11 sm:h-12 px-2 flex flex-col justify-center gap-0.5 bg-amber-950/20 text-amber-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 truncate">
                    <Type className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">Subtitles</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {onOpenSubtitleEditor && (
                      <button
                        onClick={onOpenSubtitleEditor}
                        className="text-[8px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded transition-colors font-bold"
                        title="Buka Editor Teks Subtitle"
                      >
                        Edit
                      </button>
                    )}
                    {onOpenWhisperModal && (
                      <button
                        onClick={onOpenWhisperModal}
                        className="text-[8px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded transition-colors font-bold"
                        title="Generate Subtitle Otomatis dengan Groq STT"
                      >
                        ⚡ Groq
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-[8px] font-mono text-slate-500 truncate">
                  {subtitleConfig.lyrics.length} Segmen
                </span>
              </div>
            </div>

          {/* Main Scrollable Timeline Track Workspace */}
          <div
            ref={timelineContainerRef}
            onMouseDown={handleTimelineMouseDown}
            className="flex-1 ml-24 sm:ml-32 overflow-x-auto overflow-y-hidden relative custom-scrollbar cursor-crosshair bg-[#060810]"
          >
            {/* Inner Content Sized According to Zoom Level */}
            <div
              className="h-full relative min-w-full"
              style={{ width: `${zoomLevel * 100}%` }}
            >
              {/* ---------------------------------------------------- */}
              {/* A. TIME RULER (Top Bar with Second Ticks)             */}
              {/* ---------------------------------------------------- */}
              <div className="h-6 bg-[#0B0F1B] border-b border-white/10 relative text-[9px] font-mono text-slate-400">
                {rulerTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-white/10 pl-1 pt-1 pointer-events-none"
                    style={{ left: `${tick.percent}%` }}
                  >
                    <span>{tick.label}</span>
                  </div>
                ))}
              </div>

              {/* ---------------------------------------------------- */}
              {/* B. TRACK 1: AUDIO WAVEFORM TRACK (CapCut Clip)       */}
              {/* ---------------------------------------------------- */}
              <div className="h-14 sm:h-16 border-b border-white/5 relative p-1 flex items-center">
                {/* Audio Clip Box */}
                <div
                  onClick={() => setSelectedClip('audio')}
                  className={`w-full h-full rounded-xl relative overflow-hidden flex items-center transition-all ${
                    selectedClip === 'audio'
                      ? 'bg-gradient-to-r from-cyan-900/50 via-indigo-900/50 to-blue-900/50 border border-cyan-400/60 shadow-lg shadow-cyan-500/10'
                      : 'bg-white/[0.04] border border-white/10'
                  }`}
                >
                  {/* Waveform Visualization Bars */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 gap-[1px] opacity-75 pointer-events-none">
                    {waveformBars.map((heightFactor, idx) => (
                      <div
                        key={idx}
                        className={`w-1 rounded-full transition-all ${
                          (idx / waveformBars.length) * 100 <= playheadPercent
                            ? 'bg-cyan-400 shadow-sm shadow-cyan-400'
                            : 'bg-indigo-400/40'
                        }`}
                        style={{ height: `${heightFactor * 75}%` }}
                      />
                    ))}
                  </div>

                  {/* Clip Title Overlay */}
                  <div className="absolute top-1 left-2.5 z-10 pointer-events-none flex items-center gap-1.5 text-white text-[10px] font-bold drop-shadow-md">
                    <Music className="w-3 h-3 text-cyan-300" />
                    <span>{currentTrack.title}</span>
                    <span className="text-slate-400 font-normal text-[9px] hidden sm:inline">
                      • {currentTrack.artist}
                    </span>
                  </div>

                  {/* ------------------------------------------------ */}
                  {/* TRIM HIGHLIGHT OVERLAY & HANDLES (Kuping CapCut) */}
                  {/* ------------------------------------------------ */}
                  {trimRange && (
                    <>
                      {/* Inactive Left Dimming */}
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-black/75 backdrop-blur-[1px] pointer-events-none z-10"
                        style={{ width: `${trimStartPercent}%` }}
                      />

                      {/* Inactive Right Dimming */}
                      <div
                        className="absolute top-0 bottom-0 right-0 bg-black/75 backdrop-blur-[1px] pointer-events-none z-10"
                        style={{ width: `${100 - trimEndPercent}%` }}
                      />

                      {/* Active Trim Region Box */}
                      <div
                        className="absolute top-0 bottom-0 border-y-2 border-pink-400 bg-pink-500/10 pointer-events-none z-10"
                        style={{
                          left: `${trimStartPercent}%`,
                          width: `${trimWidthPercent}%`,
                        }}
                      >
                        <div className="absolute top-1 right-2 text-[9px] font-mono text-pink-300 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                          Reff Cut: {formatSec(trimRange.end - trimRange.start)}
                        </div>
                      </div>

                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => handleTrimHandleMouseDown(e, 'start')}
                        className="trim-handle absolute top-0 bottom-0 w-3.5 bg-pink-500 hover:bg-pink-400 cursor-ew-resize z-20 flex items-center justify-center rounded-l-md shadow-lg group"
                        style={{ left: `${trimStartPercent}%` }}
                        title="Geser batas awal potongan audio"
                      >
                        <div className="w-1 h-4 bg-black/60 rounded-full" />
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => handleTrimHandleMouseDown(e, 'end')}
                        className="trim-handle absolute top-0 bottom-0 w-3.5 bg-pink-500 hover:bg-pink-400 cursor-ew-resize z-20 flex items-center justify-center rounded-r-md shadow-lg -translate-x-full group"
                        style={{ left: `${trimEndPercent}%` }}
                        title="Geser batas akhir potongan audio"
                      >
                        <div className="w-1 h-4 bg-black/60 rounded-full" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* C. TRACK 2: IMAGE / MEDIA TRACK                      */}
              {/* ---------------------------------------------------- */}
              <div className="h-14 sm:h-16 border-b border-white/5 relative p-1 flex items-center">
                <div
                  onClick={() => setSelectedClip('image')}
                  onDragOver={handleMediaDragOver}
                  onDragEnter={handleMediaDragOver}
                  onDragLeave={handleMediaDragLeave}
                  onDrop={handleMediaDrop}
                  className={`w-full h-full rounded-xl relative overflow-hidden flex items-center px-1 transition-all ${
                    isDraggingMediaOver
                      ? 'bg-emerald-950/70 border-2 border-dashed border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20'
                      : selectedClip === 'image'
                      ? 'bg-emerald-950/25 border border-emerald-400/40'
                      : 'bg-emerald-950/15 border border-emerald-500/20'
                  }`}
                >
                  {/* Visual Dropzone Overlay when Dragging File from Desktop */}
                  {isDraggingMediaOver && (
                    <div className="absolute inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center gap-2.5 text-emerald-300 font-bold text-xs pointer-events-none animate-pulse">
                      <ImageIcon className="w-5 h-5 animate-bounce text-emerald-400" />
                      <span>Lepaskan file foto di sini untuk menambahkan ke Slideshow Timeline!</span>
                    </div>
                  )}

                  {imageClips.length === 0 ? (
                    <button
                      onClick={() => imageFileInputRef.current?.click()}
                      className="w-full h-full border border-dashed border-emerald-500/30 hover:border-emerald-400/60 rounded-lg flex items-center justify-center gap-2 text-[10px] text-emerald-300/70 hover:text-emerald-300 transition-all cursor-pointer bg-emerald-950/10"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>+ Drag & Drop atau Klik di sini untuk menambahkan foto (bisa pilih banyak foto untuk slideshow)</span>
                    </button>
                  ) : (
                    imageClips.map((clip) => (
                      <div
                        key={clip.id}
                        draggable={clip.type === 'slide'}
                        onDragStart={(e) => {
                          if (clip.originalIndex !== undefined) {
                            handleSlideDragStart(e, clip.originalIndex);
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedSlideIndex !== null && clip.originalIndex !== undefined) {
                            handleSlideReorderDrop(draggedSlideIndex, clip.originalIndex);
                            setDraggedSlideIndex(null);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImageId(clip.id);
                        }}
                        className={`h-full rounded-lg bg-emerald-900/40 border p-1 flex items-center gap-2 relative group cursor-pointer transition-all select-none ${
                          selectedImageId === clip.id
                            ? 'border-emerald-400 shadow-md shadow-emerald-500/30'
                            : 'border-emerald-500/30 hover:border-emerald-400/50'
                        }`}
                        style={{
                          left: `${clip.startPct}%`,
                          width: `${clip.widthPct}%`,
                          position: 'absolute',
                        }}
                        title={
                          clip.type === 'slide'
                            ? `Slide Foto #${clip.slideIndex} (${(clip.duration || (backgroundConfig.multiImageInterval || 5)).toFixed(1)}s) - Klik untuk pilih, drag untuk atur urutan`
                            : clip.title
                        }
                      >
                        <img
                          src={clip.url}
                          alt=""
                          className="h-full w-9 sm:w-11 object-cover rounded border border-white/15 shrink-0 bg-black pointer-events-none"
                        />
                        <div className="truncate flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold uppercase px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              {clip.type === 'background' ? 'BG' : clip.type === 'center_logo' ? 'LOGO' : `FOTO ${clip.slideIndex || 1}`}
                            </span>
                            <span className="text-[10px] font-bold text-white truncate">{clip.title}</span>
                          </div>
                          <div className="text-[8px] font-mono text-slate-400 flex items-center gap-1">
                            <span>{formatSec(clip.startSec)} - {formatSec(clip.endSec)}</span>
                            {clip.duration && (
                              <span className="text-cyan-400 font-bold">({clip.duration.toFixed(1)}s)</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Hover Actions (Reorder buttons, Set BG, Set Logo, Delete) */}
                        <div className="hidden group-hover:flex items-center gap-0.5 absolute right-1 top-1 bottom-1 bg-black/90 backdrop-blur-sm px-1 rounded-md z-20 border border-white/10 shadow-lg">
                          {clip.type === 'slide' && clip.originalIndex !== undefined && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveSlide(clip.originalIndex!, 'left');
                                }}
                                disabled={clip.originalIndex === 0}
                                className="p-0.5 rounded hover:bg-white/20 text-slate-300 disabled:opacity-20 transition-all"
                                title="Geser foto ke kiri (urutan sebelumnya)"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveSlide(clip.originalIndex!, 'right');
                                }}
                                disabled={clip.originalIndex === (backgroundConfig.multiImageUrls?.length || 1) - 1}
                                className="p-0.5 rounded hover:bg-white/20 text-slate-300 disabled:opacity-20 transition-all"
                                title="Geser foto ke kanan (urutan selanjutnya)"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetImageAsBackground(clip.url);
                            }}
                            className="px-1 py-0.5 rounded bg-white/10 hover:bg-emerald-500/20 text-emerald-300 text-[8px] font-bold"
                            title="Jadikan Background Visualizer Tunggal"
                          >
                            Set BG
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetImageAsLogo(clip.url);
                            }}
                            className="px-1 py-0.5 rounded bg-white/10 hover:bg-purple-500/20 text-purple-300 text-[8px] font-bold"
                            title="Jadikan Center Logo Artwork"
                          >
                            Set Logo
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImageClip(clip);
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400 text-[8px] transition-colors"
                            title="Hapus foto ini dari timeline"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* D. TRACK 3: SUBTITLE / LYRIC BLOCKS TRACK             */}
              {/* ---------------------------------------------------- */}
              <div className="h-11 sm:h-12 relative p-1 flex items-center">
                <div
                  onClick={() => setSelectedClip('subtitle')}
                  className="w-full h-full rounded-xl bg-amber-950/20 border border-amber-500/20 relative overflow-hidden"
                >
                  {subtitleConfig.lyrics.length === 0 ? (
                    <div
                      onClick={() => {
                        if (onOpenSubtitleEditor) onOpenSubtitleEditor();
                        else if (onOpenWhisperModal) onOpenWhisperModal();
                      }}
                      className="h-full flex items-center justify-center text-[10px] text-amber-300/60 gap-1.5 cursor-pointer hover:text-amber-200 transition-colors"
                      title="Klik untuk membuka Editor Teks Subtitle"
                    >
                      <Type className="w-3 h-3" />
                      <span>Belum ada subtitle. Klik di sini untuk ketik teks lirik atau buat dengan AI.</span>
                    </div>
                  ) : (
                    subtitleConfig.lyrics.map((lyric, index) => {
                      const startPct = (lyric.start / effectiveDuration) * 100;
                      const widthPct = Math.max(1.5, ((lyric.end - lyric.start) / effectiveDuration) * 100);
                      const isCurrent = currentTime >= lyric.start && currentTime <= lyric.end;

                      return (
                        <div
                          key={lyric.id || index}
                          onClick={(e) => {
                            e.stopPropagation();
                            globalAudioEngine.seek(lyric.start);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (onOpenSubtitleEditor) onOpenSubtitleEditor();
                          }}
                          className={`absolute top-0.5 bottom-0.5 rounded-md px-1.5 text-[9px] font-semibold flex items-center justify-start truncate cursor-pointer transition-all border ${
                            isCurrent
                              ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/30 scale-[1.02] z-10'
                              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/30'
                          }`}
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                          }}
                          title={`[${formatSec(lyric.start)} - ${formatSec(lyric.end)}] "${lyric.text}" (Double-klik untuk edit teks)`}
                        >
                          <span className="truncate">{lyric.text}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* E. CAPCUT PLAYHEAD NEEDLE (Jarum Merah/Cyan)          */}
              {/* ---------------------------------------------------- */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-30"
                style={{ left: `${playheadPercent}%` }}
              >
                {/* Playhead Needle Pin (CapCut Inverted Triangle SVG) */}
                <svg
                  className="w-3.5 h-3.5 -translate-x-1/2 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.9)]"
                  viewBox="0 0 14 12"
                  fill="currentColor"
                >
                  <polygon points="0,0 14,0 7,12" />
                </svg>

                {/* Vertical Laser Needle Line running through all tracks */}
                <div className="w-[2px] h-full -translate-x-1/2 bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================= */}
      {/* 3. IMAGE PLACEMENT DIALOG MODAL                           */}
      {/* ========================================================= */}
      {showImageDialog && pendingImageUrl && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#0D1222] border border-white/15 p-5 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>Tambahkan Gambar ke Timeline</span>
              </h4>
              <button
                onClick={() => setShowImageDialog(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-36 rounded-2xl overflow-hidden border border-white/10 bg-black/60 flex items-center justify-center">
              <img src={pendingImageUrl} alt="Preview" className="h-full w-full object-contain" />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-300 font-semibold">Pilih posisi gambar di visualizer:</div>

              <button
                onClick={() => {
                  handleSetImageAsBackground(pendingImageUrl);
                  setShowImageDialog(false);
                }}
                className="w-full p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-bold text-left flex items-center gap-2.5 transition-all active:scale-95"
              >
                <span className="text-base">🖼️</span>
                <div>
                  <div>Jadikan Background Wallpaper</div>
                  <div className="text-[10px] text-slate-400 font-normal">Tampil sebagai latar belakang penuh visualizer</div>
                </div>
              </button>

              <button
                onClick={() => {
                  handleSetImageAsLogo(pendingImageUrl);
                  setShowImageDialog(false);
                }}
                className="w-full p-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-bold text-left flex items-center gap-2.5 transition-all active:scale-95"
              >
                <span className="text-base">💿</span>
                <div>
                  <div>Jadikan Center Logo Artwork</div>
                  <div className="text-[10px] text-slate-400 font-normal">Tampil sebagai cover album/logo berputar di tengah</div>
                </div>
              </button>

              <button
                onClick={() => {
                  handleAddImageSlide(pendingImageUrl);
                  setShowImageDialog(false);
                }}
                className="w-full p-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-xs font-bold text-left flex items-center gap-2.5 transition-all active:scale-95"
              >
                <span className="text-base">🎞️</span>
                <div>
                  <div>
                    {backgroundConfig.type === 'multi_image' && backgroundConfig.multiImageUrls?.length
                      ? `Tambah ke Slideshow Background (+1 Foto, Total ${(backgroundConfig.multiImageUrls?.length || 0) + 1})`
                      : 'Mulai Slideshow Background Baru'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">Bergantian otomatis di timeline dengan durasi yang bisa diatur</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Lyric-to-Image Matching Modal */}
      <AiLyricImageModal
        isOpen={showAiMatchModal}
        onClose={() => setShowAiMatchModal(false)}
        images={availableImagesForAi}
        lyrics={subtitleConfig.lyrics || []}
        duration={effectiveDuration}
        onApplySlides={handleApplyAiSlides}
      />
    </div>
  );
};
