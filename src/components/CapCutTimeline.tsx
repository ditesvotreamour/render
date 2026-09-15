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
  FolderArchive,
  Sparkles,
  ArrowLeftRight,
  ChevronsLeft,
  ChevronsRight,
  Video,
  Film,
  Sliders,
  Eye,
  EyeOff,
  Zap,
  Wand2,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import type {
  AudioTrack,
  SubtitleConfig,
  BackgroundConfig,
  CenterLogoConfig,
  SlideItem,
  BRollClip,
  BRollConfig,
  BRollDisplayMode,
  VisualEffectType,
  TimelineFxClip,
} from '../types/visualizer';
import { VISUAL_EFFECT_OPTIONS } from '../types/visualizer';
import { SAMPLE_TRACKS } from '../data/sampleTracks';
import { globalAudioEngine } from '../utils/audioEngine';
import { AudioTrimmerJoiner, sliceLyricsMultiSegments } from '../utils/audioTrimmerJoiner';
import { WhisperAIService } from '../utils/whisperAi';
import { AiLyricImageModal } from './AiLyricImageModal';
import { BRollModal } from './BRollModal';
import { AiVisualEffectsModal } from './AiVisualEffectsModal';
import {
  heuristicMatchImagesToLyrics,
  fillTimelineSlideGaps,
  parseTimestampFromFilename,
} from '../utils/aiLyricImageMatcher';
import {
  isZipFile,
  isZipBlob,
  processFilesWithZipExtraction,
  isVideoMedia,
  registerMediaUrl,
  getMediaUrlType,
  isVideoFile,
} from '../utils/zipImageExtractor';

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

  // In-Timeline Trim & Audio Clips state (CapCut Multi-Clip Splitter)
  const [trimRange, setTrimRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedClip, setSelectedClip] = useState<'audio' | 'subtitle' | 'image' | 'broll' | null>('audio');
  const [isBRollModalOpen, setIsBRollModalOpen] = useState<boolean>(false);
  const [bRollModalTab, setBRollModalTab] = useState<'clips' | 'presets' | 'stock' | 'ai'>('clips');
  const [selectedBRollId, setSelectedBRollId] = useState<string | null>(null);
  const [isAiEffectModalOpen, setIsAiEffectModalOpen] = useState<boolean>(false);
  const [isApplyingTrim, setIsApplyingTrim] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Timeline Track Rows Visibility State (Sembunyikan / Tampilkan Baris Media)
  const [trackVisibility, setTrackVisibility] = useState<{
    audio: boolean;
    media: boolean;
    broll: boolean;
    subtitle: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('capcut_timeline_track_visibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          audio: parsed.audio ?? true,
          media: parsed.media ?? true,
          broll: parsed.broll ?? true,
          subtitle: parsed.subtitle ?? true,
        };
      }
    } catch {
      // Ignore JSON parse errors
    }
    return {
      audio: true,
      media: true,
      broll: true,
      subtitle: true,
    };
  });
  const [showTrackVisibilityMenu, setShowTrackVisibilityMenu] = useState<boolean>(false);

  // Mode Ukuran Baris Ramping vs Normal (Compact Timeline Mode)
  const [isCompactHeight, setIsCompactHeight] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('capcut_timeline_compact_mode');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Custom Dragged Height untuk baris timeline (null = otomatis pas baris / auto-fit)
  const [customTracksHeight, setCustomTracksHeight] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('capcut_timeline_custom_height');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [, setIsResizingHeight] = useState<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);

  // Audio Clips for CapCut track splitting & dragging
  const [audioClips, setAudioClips] = useState<
    Array<{
      id: string;
      start: number;
      end: number;
      name: string;
      sourceStart?: number;
      sourceEnd?: number;
    }>
  >([
    { id: 'clip-1', start: 0, end: duration > 0 ? duration : 180, name: 'Trek 1', sourceStart: 0, sourceEnd: duration > 0 ? duration : 180 },
  ]);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>('clip-1');

  // Dragging & Moving Audio Clip state (Geser MP3 CapCut)
  const [draggingAudioClipId, setDraggingAudioClipId] = useState<string | null>(null);
  const [draggingAudioEdge, setDraggingAudioEdge] = useState<'left' | 'right' | null>(null);
  const dragAudioRef = useRef<{
    startX: number;
    origStart: number;
    origEnd: number;
    clipDuration: number;
    clipId: string;
    edge: 'body' | 'left' | 'right';
  } | null>(null);

  // Image Track state
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState<boolean>(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingMediaOver, setIsDraggingMediaOver] = useState<boolean>(false);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [showAiMatchModal, setShowAiMatchModal] = useState<boolean>(false);
  const [imageFileStore, setImageFileStore] = useState<Array<{ url: string; name: string; mediaType?: 'image' | 'video' }>>([]);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingZip, setIsExtractingZip] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; message: string }>({ percent: 0, message: '' });

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingPlayheadRef = useRef<boolean>(false);
  const isDraggingTrimHandleRef = useRef<'start' | 'end' | null>(null);

  const effectiveDuration = duration > 0 ? duration : 180;

  const prevTrackIdRef = useRef<string>(currentTrack.id);

  // Sync audio clips when current track changes
  useEffect(() => {
    if (prevTrackIdRef.current !== currentTrack.id) {
      prevTrackIdRef.current = currentTrack.id;
      setAudioClips([
        {
          id: 'clip-1',
          start: 0,
          end: effectiveDuration,
          name: 'Trek 1',
          sourceStart: 0,
          sourceEnd: effectiveDuration,
        },
      ]);
      setSelectedAudioClipId('clip-1');
      setTrimRange(null);
      globalAudioEngine.setTrimRange(null);
      globalAudioEngine.setActiveSegments(null);
    } else {
      // If track is the same, but duration just resolved from fallback to actual track duration on first load
      setAudioClips((prev) => {
        if (
          prev.length === 1 &&
          prev[0].start === 0 &&
          (prev[0].end === 180 || prev[0].end === 0) &&
          (prev[0].sourceStart === 0 || prev[0].sourceStart === undefined)
        ) {
          return [
            {
              ...prev[0],
              end: effectiveDuration,
              sourceEnd: effectiveDuration,
            },
          ];
        }
        return prev;
      });
    }
  }, [currentTrack.id, effectiveDuration]);

  // Synchronize active playback segments with globalAudioEngine so deleted parts are skipped live
  useEffect(() => {
    if (trimRange) {
      globalAudioEngine.setActiveSegments([
        { start: trimRange.start, end: trimRange.end },
      ]);
    } else if (audioClips.length > 0) {
      const activeSegs = audioClips.map((c) => ({
        start: c.sourceStart ?? c.start,
        end: c.sourceEnd ?? c.end,
      }));
      // Check if segments actually cut any part of original track
      const isModified =
        audioClips.length > 1 ||
        (audioClips.length === 1 &&
          ((audioClips[0].sourceStart ?? audioClips[0].start) > 0.3 ||
            (audioClips[0].sourceEnd ?? audioClips[0].end) < effectiveDuration - 0.3));

      if (isModified) {
        globalAudioEngine.setActiveSegments(activeSegs);
      } else {
        globalAudioEngine.setActiveSegments(null);
      }
    } else {
      globalAudioEngine.setActiveSegments(null);
    }
  }, [audioClips, trimRange, effectiveDuration]);

  const totalAudioClipsDuration = useMemo(
    () => audioClips.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0),
    [audioClips]
  );

  const isAudioClipsModified = useMemo(
    () =>
      audioClips.length > 1 ||
      (audioClips.length === 1 &&
        ((audioClips[0].sourceStart ?? audioClips[0].start) > 0.5 ||
          (audioClips[0].sourceEnd ?? audioClips[0].end) < effectiveDuration - 0.5)),
    [audioClips, effectiveDuration]
  );

  // Gaps (Ruang Kosong) calculation between audio clips
  const audioGaps = useMemo(() => {
    if (audioClips.length === 0) return [];
    const sorted = [...audioClips].sort((a, b) => a.start - b.start);
    const gaps: Array<{
      id: string;
      start: number;
      end: number;
      duration: number;
      isBeforeFirst: boolean;
      afterClipIndex: number;
    }> = [];

    // 1. Gap before the first clip
    if (sorted[0].start > 0.15) {
      gaps.push({
        id: 'gap-start',
        start: 0,
        end: sorted[0].start,
        duration: sorted[0].start,
        isBeforeFirst: true,
        afterClipIndex: -1,
      });
    }

    // 2. Gaps between consecutive clips
    for (let i = 0; i < sorted.length - 1; i++) {
      const curEnd = sorted[i].end;
      const nextStart = sorted[i + 1].start;
      const gapDur = nextStart - curEnd;
      if (gapDur > 0.15) {
        gaps.push({
          id: `gap-${sorted[i].id}-${sorted[i + 1].id}`,
          start: curEnd,
          end: nextStart,
          duration: gapDur,
          isBeforeFirst: false,
          afterClipIndex: i,
        });
      }
    }

    return gaps;
  }, [audioClips]);

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

  // Compute image/video clips for the timeline
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
      mediaType?: 'image' | 'video';
      visualEffect?: VisualEffectType;
      visualEffectIntensity?: number;
    }[] = [];

    // 1. Multi-image/video slides
    if (backgroundConfig.type === 'multi_image') {
      if (backgroundConfig.multiImageSlides && backgroundConfig.multiImageSlides.length > 0) {
        backgroundConfig.multiImageSlides.forEach((slide, idx) => {
          const mediaType = slide.mediaType || getMediaUrlType(slide.url, slide.name);
          const isVid = mediaType === 'video';
          clips.push({
            id: slide.id || `slide-${idx}`,
            type: 'slide',
            url: slide.url,
            title: slide.name || (isVid ? `Video ${idx + 1}` : `Foto ${idx + 1}`),
            startSec: slide.startSec,
            endSec: slide.endSec,
            startPct: (slide.startSec / effectiveDuration) * 100,
            widthPct: Math.max(0.5, ((slide.endSec - slide.startSec) / effectiveDuration) * 100),
            slideIndex: idx + 1,
            originalIndex: idx,
            duration: slide.endSec - slide.startSec,
            mediaType,
            visualEffect: slide.visualEffect || 'none',
            visualEffectIntensity: slide.visualEffectIntensity,
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
          const url = urls[originalIndex];
          const stored = imageFileStore.find((item) => item.url === url);
          const mediaType = getMediaUrlType(url, stored?.name);
          const isVid = mediaType === 'video';
          clips.push({
            id: `slide-${i}-${originalIndex}`,
            type: 'slide',
            url,
            title: stored?.name || (isVid ? `Video ${originalIndex + 1}` : `Foto ${originalIndex + 1}`),
            startSec: start,
            endSec: end,
            startPct: (start / effectiveDuration) * 100,
            widthPct: Math.max(0.5, ((end - start) / effectiveDuration) * 100),
            slideIndex: originalIndex + 1,
            originalIndex,
            duration: end - start,
            mediaType,
            visualEffect: 'none',
          });
        }
      }
    } else if (backgroundConfig.customImageUrl) {
      // 2. Custom background single image or video
      const mediaType = getMediaUrlType(backgroundConfig.customImageUrl);
      clips.push({
        id: 'bg-single',
        type: 'background',
        url: backgroundConfig.customImageUrl,
        title: mediaType === 'video' ? 'Background Video' : 'Background Wallpaper',
        startSec: 0,
        endSec: effectiveDuration,
        startPct: 0,
        widthPct: 100,
        duration: effectiveDuration,
        mediaType,
        visualEffect: backgroundConfig.customImageVisualEffect || 'none',
        visualEffectIntensity: backgroundConfig.customImageVisualEffectIntensity,
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

  // Handle picked or dropped media files (supports photos, videos, and ZIP archives)
  const handleImageFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;

    let hasZip = files.some((f) => isZipFile(f));
    if (!hasZip) {
      for (const f of files) {
        if (await isZipBlob(f)) {
          hasZip = true;
          break;
        }
      }
    }
    if (hasZip) {
      setIsExtractingZip(true);
      setZipProgress({ percent: 5, message: 'Membaca file arsip ZIP...' });
    }

    try {
      const { mediaFiles, imageFiles, videoFiles, zipCount } = await processFilesWithZipExtraction(files, (percent, message) => {
        setZipProgress({ percent, message });
      });

      if (mediaFiles.length === 0) {
        if (zipCount > 0) {
          setStatusMessage('⚠️ File ZIP tidak berisi foto (JPG, PNG, WEBP) maupun video (MP4, WEBM, MOV) yang didukung.');
        } else {
          setStatusMessage('⚠️ Tidak ada file media (foto/video) yang valid.');
        }
        return;
      }

      const totalPhotos = imageFiles.length;
      const totalVideos = videoFiles.length;
      const summaryText = totalVideos > 0 && totalPhotos > 0
        ? `${mediaFiles.length} media (${totalPhotos} foto, ${totalVideos} video)`
        : totalVideos > 0
        ? `${totalVideos} video`
        : `${totalPhotos} foto`;

      const newItems = mediaFiles.map((f) => {
        const url = URL.createObjectURL(f);
        const mediaType: 'image' | 'video' = isVideoFile(f) ? 'video' : 'image';
        registerMediaUrl(url, mediaType);
        return {
          url,
          name: f.name,
          mediaType,
        };
      });

      setImageFileStore((prev) => [...prev, ...newItems]);
      const newUrls = newItems.map((item) => item.url);
      const hasTimestamp = newItems.some((i) => parseTimestampFromFilename(i.name, effectiveDuration) !== null);

      // If currently already multi_image slideshow mode:
      if (backgroundConfig.type === 'multi_image') {
        const current = backgroundConfig.multiImageUrls || [];
        const updated = [...current, ...newUrls];
        const allItems = [...imageFileStore, ...newItems];
        const matched = heuristicMatchImagesToLyrics(allItems, subtitleConfig.lyrics || [], effectiveDuration);
        const slidesWithMedia = matched.map((m) => {
          const found = allItems.find((item) => item.url === m.slide.url);
          return {
            ...m.slide,
            mediaType: found?.mediaType || getMediaUrlType(m.slide.url, m.slide.name),
          };
        });
        onBackgroundChange({
          ...backgroundConfig,
          multiImageUrls: updated,
          multiImageSlides: slidesWithMedia,
        });

        setStatusMessage(
          hasTimestamp
            ? `⏱️ ${summaryText} disinkronkan tepat ke timestamp nama file!`
            : zipCount > 0
            ? `📦 Berhasil mengekstrak ${summaryText} dari ZIP & dicocokkan otomatis!`
            : `✨ ${summaryText} ditambahkan & dicocokkan otomatis!`
        );
        setSelectedClip('image');
      } else if (mediaFiles.length > 1 || zipCount > 0 || hasTimestamp) {
        // Picked multiple media files, a ZIP, or media with timestamp: start slideshow immediately
        const matched = heuristicMatchImagesToLyrics(newItems, subtitleConfig.lyrics || [], effectiveDuration);
        const slidesWithMedia = matched.map((m) => {
          const found = newItems.find((item) => item.url === m.slide.url);
          return {
            ...m.slide,
            mediaType: found?.mediaType || getMediaUrlType(m.slide.url, m.slide.name),
          };
        });
        onBackgroundChange({
          ...backgroundConfig,
          type: 'multi_image',
          multiImageUrls: newUrls,
          multiImageSlides: slidesWithMedia,
        });

        setStatusMessage(
          hasTimestamp
            ? `⏱️ ${summaryText} disinkronkan tepat ke timestamp nama file!`
            : zipCount > 0
            ? `📦 ${summaryText} diekstrak dari ZIP & dicocokkan otomatis!`
            : `✨ Slideshow dibuat & nama media dicocokkan otomatis!`
        );
        setSelectedClip('image');
      } else {
        // 1 media and not slideshow
        const singleItem = newItems[0];
        if (singleItem?.mediaType === 'video') {
          // Video: directly set as background
          onBackgroundChange({
            ...backgroundConfig,
            type: 'custom_image',
            customImageUrl: singleItem.url,
          });
          setStatusMessage(`🎥 Video background (${singleItem.name}) berhasil dipasang!`);
          setSelectedClip('image');
        } else {
          // Photo: show choice modal
          setPendingImageUrl(newUrls[0]);
          setShowImageDialog(true);
        }
      }
    } catch (err: any) {
      console.error('Error processing files or zip:', err);
      setStatusMessage(`❌ Gagal membaca file: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      if (hasZip) {
        setIsExtractingZip(false);
      }
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

  const handleAutoFillGaps = () => {
    const currentSlides = backgroundConfig.multiImageSlides || [];
    const urls = backgroundConfig.multiImageUrls || [];
    let allAvailableImages =
      imageFileStore.length > 0
        ? imageFileStore
        : urls.map((u, i) => ({ url: u, name: `Foto ${i + 1}` }));
    if (allAvailableImages.length === 0 && currentSlides.length > 0) {
      allAvailableImages = currentSlides.map((s, i) => ({ url: s.url, name: s.name || `Foto ${i + 1}` }));
    }
    if (allAvailableImages.length === 0) {
      setStatusMessage('⚠️ Tambahkan foto atau upload ZIP terlebih dahulu.');
      return;
    }

    let slidesToProcess: SlideItem[] = currentSlides.length > 0 ? [...currentSlides] : [];
    if (slidesToProcess.length === 0 && urls.length > 0) {
      const interval = backgroundConfig.multiImageInterval || 5;
      const total = Math.ceil(effectiveDuration / interval);
      for (let i = 0; i < total; i++) {
        const start = i * interval;
        const end = Math.min(effectiveDuration, (i + 1) * interval);
        slidesToProcess.push({
          id: `slide-auto-${i}-${Date.now()}`,
          url: urls[i % urls.length],
          name: `Foto ${(i % urls.length) + 1}`,
          startSec: start,
          endSec: end,
        });
      }
    }

    if (slidesToProcess.length === 0) {
      setStatusMessage('⚠️ Belum ada slide foto untuk diproses jedanya.');
      return;
    }

    const filledSlides = fillTimelineSlideGaps(slidesToProcess, allAvailableImages, effectiveDuration, {
      maxGapSec: 7.0,
      slideIntervalSec: 4.5,
    });

    onBackgroundChange({
      ...backgroundConfig,
      type: 'multi_image',
      multiImageSlides: filledSlides,
    });
    setStatusMessage(`✨ Berhasil mengisi jeda musik dengan ${filledSlides.length} foto bergantian dinamis!`);
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

  // --- Targeted Frame Visual Effects (Distorsi, Kamera Jadul, Cacing-cacing) ---
  const handleSetSlideVisualEffect = (
    slideIdOrIndex: string | number,
    effect: VisualEffectType,
    intensity: number = 0.75
  ) => {
    let slides = backgroundConfig.multiImageSlides ? [...backgroundConfig.multiImageSlides] : [];

    // If multiImageSlides is empty but multiImageUrls exists, materialize slides first
    if (slides.length === 0 && backgroundConfig.multiImageUrls && backgroundConfig.multiImageUrls.length > 0) {
      const urls = backgroundConfig.multiImageUrls;
      const interval = backgroundConfig.multiImageInterval || 5;
      const total = Math.ceil(effectiveDuration / interval);
      for (let i = 0; i < total; i++) {
        const start = i * interval;
        const end = Math.min(effectiveDuration, (i + 1) * interval);
        slides.push({
          id: `slide-auto-${i}-${Date.now()}`,
          url: urls[i % urls.length],
          name: `Foto ${(i % urls.length) + 1}`,
          startSec: start,
          endSec: end,
          visualEffect: 'none',
        });
      }
    }

    let targetIndex = -1;
    if (typeof slideIdOrIndex === 'number') {
      targetIndex = slideIdOrIndex;
    } else {
      targetIndex = slides.findIndex((s, idx) => s.id === slideIdOrIndex || `slide-${idx}` === slideIdOrIndex);
    }

    if (targetIndex >= 0 && targetIndex < slides.length) {
      slides[targetIndex] = {
        ...slides[targetIndex],
        visualEffect: effect,
        visualEffectIntensity: intensity,
      };

      onBackgroundChange({
        ...backgroundConfig,
        type: 'multi_image',
        multiImageSlides: slides,
      });

      const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === effect);
      setStatusMessage(
        effect === 'none'
          ? `⚪ Efek visual slide #${targetIndex + 1} dinonaktifkan.`
          : `✨ Efek ${opt?.shortLabel || effect} aktif pada slide #${targetIndex + 1} (${formatSec(slides[targetIndex].startSec)} - ${formatSec(slides[targetIndex].endSec)})!`
      );
    }
  };

  const handleSetBRollVisualEffect = (
    clipId: string,
    effect: VisualEffectType,
    intensity: number = 0.8
  ) => {
    const currentClips = backgroundConfig.bRoll?.clips || [];
    const targetIdx = currentClips.findIndex((c) => c.id === clipId);
    if (targetIdx === -1) return;

    const updatedClips = currentClips.map((c) =>
      c.id === clipId
        ? {
            ...c,
            visualEffect: effect,
            visualEffectIntensity: intensity,
          }
        : c
    );

    onBackgroundChange({
      ...backgroundConfig,
      bRoll: {
        ...backgroundConfig.bRoll,
        enabled: true,
        clips: updatedClips,
      },
    });

    const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === effect);
    setStatusMessage(
      effect === 'none'
        ? `⚪ Efek visual klip B-Roll "${currentClips[targetIdx].name}" dinonaktifkan.`
        : `✨ Efek ${opt?.shortLabel || effect} aktif pada klip B-Roll "${currentClips[targetIdx].name}"!`
    );
  };

  const handleAddTimelineFxAtPlayhead = (effect: VisualEffectType) => {
    const cur = Number(currentTime.toFixed(2));
    const end = Math.min(effectiveDuration, Number((cur + 3.0).toFixed(2)));
    const existing = backgroundConfig.timelineFxClips || [];
    const newFx: TimelineFxClip = {
      id: `fx-${Date.now()}`,
      name: `Efek ${formatSec(cur)}`,
      startSec: cur,
      endSec: end,
      effect,
      intensity: 0.8,
    };
    onBackgroundChange({
      ...backgroundConfig,
      timelineFxClips: [...existing, newFx],
    });
    const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === effect);
    setStatusMessage(`✨ Efek ${opt?.shortLabel || effect} ditambahkan (${formatSec(cur)} - ${formatSec(end)})!`);
  };

  const handleRemoveTimelineFx = (fxId: string) => {
    const existing = backgroundConfig.timelineFxClips || [];
    onBackgroundChange({
      ...backgroundConfig,
      timelineFxClips: existing.filter((f) => f.id !== fxId),
    });
    setStatusMessage('🗑️ Efek timeline dihapus.');
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

  // Map timeline coordinate to source audio file position for seeking
  const seekTimeline = useCallback(
    (timelineSec: number) => {
      if (audioClips.length === 0) {
        globalAudioEngine.seek(timelineSec);
        return;
      }
      const sorted = [...audioClips].sort((a, b) => a.start - b.start);
      const clip = sorted.find((c) => timelineSec >= c.start && timelineSec <= c.end);
      if (clip) {
        const offset = Math.max(0, timelineSec - clip.start);
        const sourceSec = (clip.sourceStart ?? clip.start) + offset;
        globalAudioEngine.seek(sourceSec);
      } else {
        const nextClip = sorted.find((c) => c.start >= timelineSec);
        if (nextClip) {
          globalAudioEngine.seek(nextClip.sourceStart ?? nextClip.start);
        } else if (sorted.length > 0) {
          globalAudioEngine.seek(sorted[0].sourceStart ?? sorted[0].start);
        } else {
          globalAudioEngine.seek(timelineSec);
        }
      }
    },
    [audioClips]
  );

  // Seek handler from clicking or dragging timeline
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.trim-handle') ||
      (e.target as HTMLElement).closest('.audio-clip-element') ||
      (e.target as HTMLElement).closest('.timeline-gap-element') ||
      (e.target as HTMLElement).closest('.audio-trim-handle')
    )
      return;

    isDraggingPlayheadRef.current = true;
    const targetSec = getSecondsFromMouseEvent(e.clientX);
    seekTimeline(targetSec);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingPlayheadRef.current) return;
      const sec = getSecondsFromMouseEvent(moveEvent.clientX);
      seekTimeline(sec);
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
    const cur = Number(currentTime.toFixed(2));
    if (cur <= 0.5 || cur >= effectiveDuration - 0.5) {
      setStatusMessage('⚠️ Pindahkan jarum penunjuk ke tengah audio/slide untuk memotong.');
      return;
    }

    // 1. Check if B-Roll clip is targeted for split
    const isBRollTarget = selectedClip === 'broll' || selectedBRollId !== null;
    const bRollClips = backgroundConfig.bRoll?.clips || [];
    if (isBRollTarget && bRollClips.length > 0) {
      const bIdx = bRollClips.findIndex((b) => cur > b.startSec + 0.2 && cur < b.endSec - 0.2);
      if (bIdx !== -1) {
        const targetB = bRollClips[bIdx];
        const clipA: BRollClip = {
          ...targetB,
          id: `broll-${Date.now()}-1`,
          endSec: cur,
        };
        const clipB: BRollClip = {
          ...targetB,
          id: `broll-${Date.now()}-2`,
          startSec: cur,
          name: `${targetB.name} (B)`,
        };
        const updated = [...bRollClips];
        updated.splice(bIdx, 1, clipA, clipB);
        onBackgroundChange({
          ...backgroundConfig,
          bRoll: {
            ...backgroundConfig.bRoll,
            enabled: true,
            clips: updated,
          },
        });
        setSelectedBRollId(clipB.id);
        setSelectedClip('broll');
        setStatusMessage(`✂️ Klip B-Roll #${bIdx + 1} berhasil dibagi 2 di ${formatSec(cur)}!`);
        return;
      }
    }

    const isImageTarget = selectedClip === 'image' || selectedImageId !== null;
    const currentSlides = backgroundConfig.multiImageSlides || [];
    const urls = backgroundConfig.multiImageUrls || [];

    if (isImageTarget && (currentSlides.length > 0 || urls.length > 0)) {
      // Materialize slides if uniform interval
      let slides = currentSlides.length > 0 ? [...currentSlides] : [];
      if (slides.length === 0 && urls.length > 0) {
        const interval = backgroundConfig.multiImageInterval || 5;
        const total = Math.ceil(effectiveDuration / interval);
        for (let i = 0; i < total; i++) {
          const start = i * interval;
          const end = Math.min(effectiveDuration, (i + 1) * interval);
          slides.push({
            id: `slide-auto-${i}-${Date.now()}`,
            url: urls[i % urls.length],
            name: `Foto ${(i % urls.length) + 1}`,
            startSec: start,
            endSec: end,
          });
        }
      }

      const slideIdx = slides.findIndex((s) => cur > s.startSec + 0.2 && cur < s.endSec - 0.2);
      if (slideIdx !== -1) {
        const targetSlide = slides[slideIdx];
        const slideA: SlideItem = {
          ...targetSlide,
          id: `slide-${Date.now()}-1`,
          endSec: cur,
        };
        const slideB: SlideItem = {
          ...targetSlide,
          id: `slide-${Date.now()}-2`,
          startSec: cur,
          name: `${targetSlide.name || 'Foto'} (B)`,
        };

        const updatedSlides = [...slides];
        updatedSlides.splice(slideIdx, 1, slideA, slideB);
        onBackgroundChange({
          ...backgroundConfig,
          type: 'multi_image',
          multiImageSlides: updatedSlides,
        });
        setSelectedImageId(slideB.id || null);
        setSelectedClip('image');
        setStatusMessage(`✂️ Slide foto #${slideIdx + 1} berhasil dibagi 2 di ${formatSec(cur)}!`);
        return;
      }
    }

    // Find which clip contains cur
    const targetIdx = audioClips.findIndex(
      (c) => cur > c.start + 0.3 && cur < c.end - 0.3
    );

    if (targetIdx === -1) {
      if (isImageTarget && (currentSlides.length > 0 || urls.length > 0)) {
        setStatusMessage(`⚠️ Arahkan jarum ke dalam slide foto untuk membagi slide (posisi saat ini: ${formatSec(cur)}).`);
      } else {
        setStatusMessage(`⚠️ Arahkan jarum ke dalam klip audio untuk memotong (posisi saat ini: ${formatSec(cur)}).`);
      }
      return;
    }

    const targetClip = audioClips[targetIdx];
    const sStart = targetClip.sourceStart ?? targetClip.start;
    const sEnd = targetClip.sourceEnd ?? targetClip.end;
    const splitRatio = (cur - targetClip.start) / Math.max(0.01, targetClip.end - targetClip.start);
    const sourceSplit = Number((sStart + splitRatio * (sEnd - sStart)).toFixed(2));

    const newClipA = {
      id: `audio-clip-${Date.now()}-1`,
      start: targetClip.start,
      end: cur,
      sourceStart: sStart,
      sourceEnd: sourceSplit,
      name: `Trek ${targetIdx + 1}A`,
    };
    const newClipB = {
      id: `audio-clip-${Date.now()}-2`,
      start: cur,
      end: targetClip.end,
      sourceStart: sourceSplit,
      sourceEnd: sEnd,
      name: `Trek ${targetIdx + 1}B`,
    };

    const copy = [...audioClips];
    copy.splice(targetIdx, 1, newClipA, newClipB);
    const renamed = copy.map((c, idx) => ({ ...c, name: `Trek ${idx + 1}` }));

    setAudioClips(renamed);
    setSelectedAudioClipId(newClipB.id);
    setSelectedClip('audio');
    setStatusMessage(`✂️ Audio berhasil dibagi 2 di ${formatSec(cur)}! Klik & geser klip atau hapus bagian yang tak diinginkan.`);
  };

  // --- B-Roll Clip Management Handlers ---
  const handleDeleteBRollClip = (clipId: string) => {
    const current = backgroundConfig.bRoll?.clips || [];
    const updated = current.filter((c) => c.id !== clipId);
    onBackgroundChange({
      ...backgroundConfig,
      bRoll: {
        ...backgroundConfig.bRoll,
        enabled: true,
        clips: updated,
      },
    });
    if (selectedBRollId === clipId) setSelectedBRollId(null);
    setStatusMessage('🗑️ Klip B-Roll dihapus dari timeline.');
  };

  const handleSplitBRollClip = (clipId: string) => {
    const current = backgroundConfig.bRoll?.clips || [];
    const bIdx = current.findIndex((c) => c.id === clipId);
    if (bIdx === -1) return;
    const targetB = current[bIdx];
    const cur = Number(currentTime.toFixed(2));
    if (cur <= targetB.startSec + 0.2 || cur >= targetB.endSec - 0.2) {
      setStatusMessage(`⚠️ Arahkan playhead ke dalam durasi klip (${formatSec(targetB.startSec)} - ${formatSec(targetB.endSec)}) untuk membagi.`);
      return;
    }
    const clipA: BRollClip = { ...targetB, id: `broll-${Date.now()}-1`, endSec: cur };
    const clipB: BRollClip = { ...targetB, id: `broll-${Date.now()}-2`, startSec: cur, name: `${targetB.name} (B)` };
    const updated = [...current];
    updated.splice(bIdx, 1, clipA, clipB);
    onBackgroundChange({
      ...backgroundConfig,
      bRoll: {
        ...backgroundConfig.bRoll,
        enabled: true,
        clips: updated,
      },
    });
    setSelectedBRollId(clipB.id);
    setSelectedClip('broll');
    setStatusMessage(`✂️ Klip B-roll berhasil dibagi 2 di ${formatSec(cur)}!`);
  };

  const handleCycleBRollMode = (clipId: string) => {
    const current = backgroundConfig.bRoll?.clips || [];
    const cycle: BRollDisplayMode[] = ['cutaway', 'pip', 'split_screen', 'blend_overlay'];
    const updated = current.map((c) => {
      if (c.id === clipId) {
        const nextIdx = (cycle.indexOf(c.displayMode || 'cutaway') + 1) % cycle.length;
        return { ...c, displayMode: cycle[nextIdx] };
      }
      return c;
    });
    onBackgroundChange({
      ...backgroundConfig,
      bRoll: {
        ...backgroundConfig.bRoll,
        enabled: true,
        clips: updated,
      },
    });
  };

  // Hapus Klip Audio Terpilih (Delete Clip Ala CapCut)
  const handleDeleteAudioClip = (clipId: string) => {
    if (audioClips.length <= 1) {
      setStatusMessage('Tidak bisa menghapus satu-satunya klip. Gunakan tombol Reset untuk kembali ke awal.');
      return;
    }
    const updated = audioClips.filter((c) => c.id !== clipId);
    const renamed = updated.map((c, idx) => ({ ...c, name: `Trek ${idx + 1}` }));
    setAudioClips(renamed);
    setSelectedAudioClipId(renamed[0]?.id || null);
    const remainingSec = renamed.reduce((sum, c) => sum + (c.end - c.start), 0);
    setStatusMessage(`🗑️ 1 klip audio dihapus. Sisa durasi: ${remainingSec.toFixed(1)}s. Klik "Tutup Ruang Kosong" jika ingin merapatkan klip.`);
  };

  // Hapus Ruang Kosong Tertentu (Tutup Gap Antar Klip / Awal)
  const handleDeleteGap = (gap: { start: number; end: number; duration: number; isBeforeFirst: boolean }) => {
    const shift = gap.duration;
    let newFirstClipStart = 0;
    setAudioClips((prev) => {
      const sorted = [...prev].sort((a, b) => a.start - b.start);
      const updated = sorted.map((c) => {
        if (c.start >= gap.start - 0.05) {
          const newStart = Math.max(0, Number((c.start - shift).toFixed(2)));
          const dur = c.end - c.start;
          const newEnd = Number((newStart + dur).toFixed(2));
          return {
            ...c,
            start: newStart,
            end: newEnd,
            sourceStart: c.sourceStart ?? c.start,
            sourceEnd: c.sourceEnd ?? c.end,
          };
        }
        return c;
      });
      if (updated.length > 0) {
        newFirstClipStart = updated[0].sourceStart ?? updated[0].start;
      }
      return updated;
    });
    globalAudioEngine.seek(newFirstClipStart);
    setStatusMessage(`⚡ Ruang kosong (${gap.duration.toFixed(1)}s) berhasil dihapus! Klip audio otomatis dirapatkan.`);
  };

  // Hapus Semua Ruang Kosong (Tutup Semua Gap / Ripple Delete All)
  const handleCloseAllGaps = () => {
    if (audioClips.length === 0) return;
    let newFirstClipStart = 0;
    setAudioClips((prev) => {
      const sorted = [...prev].sort((a, b) => a.start - b.start);
      let cur = 0;
      const updated = sorted.map((c, idx) => {
        const dur = Math.max(0.2, c.end - c.start);
        const sStart = c.sourceStart ?? c.start;
        const sEnd = c.sourceEnd ?? (sStart + dur);
        const newClip = {
          ...c,
          start: Number(cur.toFixed(2)),
          end: Number((cur + dur).toFixed(2)),
          sourceStart: sStart,
          sourceEnd: sEnd,
          name: `Trek ${idx + 1}`,
        };
        cur += dur;
        return newClip;
      });
      if (updated.length > 0) {
        newFirstClipStart = updated[0].sourceStart ?? updated[0].start;
      }
      return updated;
    });
    globalAudioEngine.seek(newFirstClipStart);
    setStatusMessage(`⚡ Semua ruang kosong (${audioGaps.length} gap) berhasil dihapus! Semua klip tersambung rapat.`);
  };

  // Geser Klip Audio (Nudge Left / Right)
  const handleShiftClip = (clipId: string, deltaSec: number) => {
    setAudioClips((prev) => {
      return prev.map((c) => {
        if (c.id !== clipId) return c;
        const dur = c.end - c.start;
        let newStart = Math.max(0, c.start + deltaSec);
        let newEnd = newStart + dur;
        if (newEnd > effectiveDuration) {
          newEnd = effectiveDuration;
          newStart = Math.max(0, newEnd - dur);
        }
        return {
          ...c,
          start: Number(newStart.toFixed(2)),
          end: Number(newEnd.toFixed(2)),
        };
      });
    });
    setStatusMessage(`↔️ Klip digeser ${deltaSec > 0 ? `+${deltaSec}s` : `${deltaSec}s`}.`);
  };

  // Rapatkan Klip Terpilih ke Kiri (Menghapus ruang kosong di sebelah kiri klip)
  const handleSnapClipToLeft = (clipId: string) => {
    setAudioClips((prev) => {
      const sorted = [...prev].sort((a, b) => a.start - b.start);
      const idx = sorted.findIndex((c) => c.id === clipId);
      if (idx === -1) return prev;
      const targetClip = sorted[idx];
      const dur = targetClip.end - targetClip.start;
      const prevClip = idx > 0 ? sorted[idx - 1] : null;
      const newStart = prevClip ? prevClip.end : 0;
      const newEnd = Number((newStart + dur).toFixed(2));
      return sorted.map((c) =>
        c.id === clipId ? { ...c, start: newStart, end: newEnd } : c
      );
    });
    setStatusMessage(`⏮ Klip berhasil dirapatkan ke kiri.`);
  };

  // Check if any clip is currently selected on timeline
  const hasSelectedClip = useMemo(() => {
    return Boolean(
      selectedBRollId ||
      selectedImageId ||
      (selectedAudioClipId && audioClips.length > 1)
    );
  }, [selectedBRollId, selectedImageId, selectedAudioClipId, audioClips.length]);

  // Selected clip deletion logic (B-Roll, Media Slideshow, Audio Clip)
  const handleDeleteSelectedClip = useCallback(() => {
    // 1. If B-Roll clip is selected
    if (selectedBRollId) {
      handleDeleteBRollClip(selectedBRollId);
      return;
    }

    // 2. If Media / Image clip is selected
    if (selectedImageId) {
      const targetClip = imageClips.find((c) => c.id === selectedImageId);
      if (targetClip) {
        handleRemoveImageClip(targetClip);
        setSelectedImageId(null);
        return;
      }
    }

    // 3. If Audio clip is selected
    if (selectedAudioClipId) {
      if (audioClips.length > 1) {
        handleDeleteAudioClip(selectedAudioClipId);
        return;
      } else {
        setStatusMessage('⚠️ Tidak bisa menghapus satu-satunya klip audio utama.');
        return;
      }
    }

    // 4. Fallback if user clicked a track category and playhead is on a clip
    if (selectedClip === 'broll') {
      const bRollClips = backgroundConfig.bRoll?.clips || [];
      const currentAtPlayhead = bRollClips.find(
        (c) => currentTime >= c.startSec && currentTime <= c.endSec
      );
      if (currentAtPlayhead) {
        handleDeleteBRollClip(currentAtPlayhead.id);
        return;
      }
    }

    if (selectedClip === 'image' && imageClips.length > 0) {
      const currentAtPlayhead = imageClips.find(
        (c) => currentTime >= c.startSec && currentTime <= c.endSec
      );
      if (currentAtPlayhead) {
        handleRemoveImageClip(currentAtPlayhead);
        return;
      }
    }

    setStatusMessage('ℹ️ Pilih klip B-roll, media foto/video, atau potongan audio terlebih dahulu untuk dihapus.');
  }, [
    selectedBRollId,
    selectedImageId,
    selectedAudioClipId,
    selectedClip,
    imageClips,
    audioClips,
    backgroundConfig.bRoll?.clips,
    currentTime,
  ]);

  // Global Keyboard listener for Delete / Backspace key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isTyping) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSelection = Boolean(
          selectedBRollId ||
          selectedImageId ||
          (selectedAudioClipId && audioClips.length > 1)
        );

        if (hasSelection) {
          e.preventDefault();
          handleDeleteSelectedClip();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelectedClip, selectedBRollId, selectedImageId, selectedAudioClipId, audioClips.length]);

  // Track Visibility Helpers
  const toggleTrackVisibility = useCallback((trackKey: 'audio' | 'media' | 'broll' | 'subtitle') => {
    setTrackVisibility((prev) => {
      const updated = { ...prev, [trackKey]: !prev[trackKey] };
      try {
        localStorage.setItem('capcut_timeline_track_visibility', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const showAllTracks = useCallback(() => {
    const allOn = { audio: true, media: true, broll: true, subtitle: true };
    setTrackVisibility(allOn);
    try {
      localStorage.setItem('capcut_timeline_track_visibility', JSON.stringify(allOn));
    } catch {
      // ignore
    }
    setStatusMessage('👁️ Semua baris trek ditampilkan.');
  }, []);

  const hiddenTracksCount = useMemo(() => {
    let count = 0;
    if (!trackVisibility.audio) count++;
    if (!trackVisibility.media) count++;
    if (!trackVisibility.broll) count++;
    if (!trackVisibility.subtitle) count++;
    return count;
  }, [trackVisibility]);

  // Mode Ukuran Baris (Ramping / Compact vs Normal)
  const trackHeights = useMemo(() => {
    if (isCompactHeight) {
      return {
        ruler: 20,
        rulerClass: 'h-5',
        audio: 40,
        audioClass: 'h-10',
        media: 40,
        mediaClass: 'h-10',
        broll: 34,
        brollClass: 'h-[34px]',
        subtitle: 32,
        subtitleClass: 'h-8',
      };
    }
    return {
      ruler: 24,
      rulerClass: 'h-6',
      audio: 58,
      audioClass: 'h-14 sm:h-[58px]',
      media: 58,
      mediaClass: 'h-14 sm:h-[58px]',
      broll: 50,
      brollClass: 'h-12 sm:h-[50px]',
      subtitle: 44,
      subtitleClass: 'h-11 sm:h-[44px]',
    };
  }, [isCompactHeight]);

  // Kalkulasi tinggi optimal area baris timeline berdasarkan baris yang sedang aktif
  const effectiveTracksHeight = useMemo(() => {
    if (hiddenTracksCount === 4) return 36;
    let total = trackHeights.ruler;
    if (trackVisibility.audio) total += trackHeights.audio;
    if (trackVisibility.media) total += trackHeights.media;
    if (trackVisibility.broll) total += trackHeights.broll;
    if (trackVisibility.subtitle) total += trackHeights.subtitle;
    return total;
  }, [trackVisibility, trackHeights, hiddenTracksCount]);

  // Pastikan tinggi timeline tidak melebihi tinggi baris aktif agar TIDAK ADA ruang kosong di bawah
  const appliedTracksHeight = useMemo(() => {
    if (hiddenTracksCount === 4) return 36;
    if (customTracksHeight !== null) {
      return Math.min(customTracksHeight, effectiveTracksHeight);
    }
    return effectiveTracksHeight;
  }, [customTracksHeight, effectiveTracksHeight, hiddenTracksCount]);

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeight(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = appliedTracksHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const newHeight = Math.max(36, Math.min(500, dragStartHeightRef.current - deltaY));
      setCustomTracksHeight(newHeight);
      try {
        localStorage.setItem('capcut_timeline_custom_height', JSON.stringify(newHeight));
      } catch {}
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetTimelineHeight = () => {
    setCustomTracksHeight(null);
    try {
      localStorage.removeItem('capcut_timeline_custom_height');
    } catch {}
    setStatusMessage('↕️ Tinggi timeline otomatis pas dengan baris yang aktif.');
  };

  const toggleCompactMode = () => {
    setIsCompactHeight((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('capcut_timeline_compact_mode', JSON.stringify(next));
      } catch {}
      setCustomTracksHeight(null);
      try {
        localStorage.removeItem('capcut_timeline_custom_height');
      } catch {}
      setStatusMessage(next ? '📐 Mode Ramping aktif: ruang layar preview kini lebih luas!' : '↕️ Mode Normal aktif.');
      return next;
    });
  };

  // Dragging & Sliding Audio Clip (Geser Klip Bebas Horizontal & Trim Tepi)
  const handleAudioClipMouseDown = (
    e: React.MouseEvent,
    clip: { id: string; start: number; end: number; name: string; sourceStart?: number; sourceEnd?: number },
    edge: 'body' | 'left' | 'right' = 'body'
  ) => {
    e.stopPropagation();
    setSelectedClip('audio');
    setSelectedAudioClipId(clip.id);

    dragAudioRef.current = {
      startX: e.clientX,
      origStart: clip.start,
      origEnd: clip.end,
      clipDuration: clip.end - clip.start,
      clipId: clip.id,
      edge,
    };
    setDraggingAudioClipId(clip.id);
    setDraggingAudioEdge(edge === 'body' ? null : edge);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragAudioRef.current || !timelineContainerRef.current) return;
      const totalWidth = timelineContainerRef.current.clientWidth;
      if (totalWidth <= 0) return;

      const deltaX = moveEvent.clientX - dragAudioRef.current.startX;
      const deltaSec = (deltaX / totalWidth) * effectiveDuration;
      const { origStart, origEnd, clipDuration, clipId, edge: currentEdge } = dragAudioRef.current;

      setAudioClips((prev) => {
        return prev.map((c) => {
          if (c.id !== clipId) return c;

          if (currentEdge === 'body') {
            let newStart = origStart + deltaSec;
            let newEnd = newStart + clipDuration;

            // Clamping
            if (newStart < 0) {
              newStart = 0;
              newEnd = clipDuration;
            }
            if (newEnd > effectiveDuration) {
              newEnd = effectiveDuration;
              newStart = Math.max(0, effectiveDuration - clipDuration);
            }

            // Magnetic snap to 0
            if (newStart < 0.35) {
              newStart = 0;
              newEnd = clipDuration;
            }

            // Magnetic snap to other clips
            const otherClips = prev.filter((o) => o.id !== clipId);
            for (const other of otherClips) {
              if (Math.abs(newStart - other.end) < 0.4) {
                newStart = other.end;
                newEnd = newStart + clipDuration;
                break;
              }
              if (Math.abs(newEnd - other.start) < 0.4) {
                newEnd = other.start;
                newStart = Math.max(0, newEnd - clipDuration);
                break;
              }
            }

            return {
              ...c,
              start: Number(newStart.toFixed(2)),
              end: Number(newEnd.toFixed(2)),
            };
          } else if (currentEdge === 'left') {
            let newStart = origStart + deltaSec;
            newStart = Math.max(0, Math.min(origEnd - 0.3, newStart));

            if (newStart < 0.35) newStart = 0;
            const otherClips = prev.filter((o) => o.id !== clipId);
            for (const other of otherClips) {
              if (Math.abs(newStart - other.end) < 0.4) {
                newStart = other.end;
                break;
              }
            }

            const srcStart = c.sourceStart ?? origStart;
            const deltaSrc = newStart - origStart;
            return {
              ...c,
              start: Number(newStart.toFixed(2)),
              sourceStart: Number((srcStart + deltaSrc).toFixed(2)),
            };
          } else if (currentEdge === 'right') {
            let newEnd = origEnd + deltaSec;
            newEnd = Math.min(effectiveDuration, Math.max(origStart + 0.3, newEnd));

            if (Math.abs(newEnd - effectiveDuration) < 0.35) newEnd = effectiveDuration;
            const otherClips = prev.filter((o) => o.id !== clipId);
            for (const other of otherClips) {
              if (Math.abs(newEnd - other.start) < 0.4) {
                newEnd = other.start;
                break;
              }
            }

            const srcEnd = c.sourceEnd ?? origEnd;
            const deltaSrc = newEnd - origEnd;
            return {
              ...c,
              end: Number(newEnd.toFixed(2)),
              sourceEnd: Number((srcEnd + deltaSrc).toFixed(2)),
            };
          }
          return c;
        });
      });
    };

    const onMouseUp = () => {
      setDraggingAudioClipId(null);
      setDraggingAudioEdge(null);
      dragAudioRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setAudioClips((prev) => [...prev].sort((a, b) => a.start - b.start));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Potong Awal (Hapus sebelum jarum, simpan dari jarum ke akhir)
  const handleTrimBeforePlayhead = () => {
    const cur = Number(currentTime.toFixed(2));
    if (cur <= 0.5) return;
    const newClip = {
      id: `clip-${Date.now()}`,
      start: cur,
      end: effectiveDuration,
      sourceStart: cur,
      sourceEnd: effectiveDuration,
      name: 'Trek 1',
    };
    setAudioClips([newClip]);
    setSelectedAudioClipId(newClip.id);
    setTrimRange({ start: cur, end: effectiveDuration });
    globalAudioEngine.setTrimRange({ start: cur, end: effectiveDuration });
    setStatusMessage(`✂️ Potong awal: simpan dari ${formatSec(cur)} hingga selesai.`);
  };

  // Potong Akhir (Hapus setelah jarum, simpan awal hingga jarum)
  const handleTrimAfterPlayhead = () => {
    const cur = Number(currentTime.toFixed(2));
    if (cur >= effectiveDuration - 0.5) return;
    const newClip = {
      id: `clip-${Date.now()}`,
      start: 0,
      end: cur,
      sourceStart: 0,
      sourceEnd: cur,
      name: 'Trek 1',
    };
    setAudioClips([newClip]);
    setSelectedAudioClipId(newClip.id);
    setTrimRange({ start: 0, end: cur });
    globalAudioEngine.setTrimRange({ start: 0, end: cur });
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
        setAudioClips([{ id: 'clip-reff', start, end, sourceStart: start, sourceEnd: end, name: 'Reff (AI)' }]);
        setSelectedAudioClipId('clip-reff');
        globalAudioEngine.setTrimRange(newRange);
        globalAudioEngine.seek(start);
        setStatusMessage(`🔥 AI mendeteksi ${dropSection.name} (${formatSec(start)} - ${formatSec(end)})`);
        return;
      }
    }

    // Fallback: take middle 40 seconds
    const mid = effectiveDuration / 2;
    const s = Math.max(0, Math.floor(mid - 15));
    const e = Math.min(effectiveDuration, Math.floor(mid + 25));
    const newRange = { start: s, end: e };
    setTrimRange(newRange);
    setAudioClips([{ id: 'clip-reff', start: s, end: e, sourceStart: s, sourceEnd: e, name: 'Trek Tengah' }]);
    setSelectedAudioClipId('clip-reff');
    globalAudioEngine.setTrimRange(newRange);
    globalAudioEngine.seek(s);
    setStatusMessage(`🔥 Bagian tengah lagu dipilih (${formatSec(s)} - ${formatSec(e)})`);
  };

  // Reset Trim
  const handleResetTrim = () => {
    setAudioClips([
      { id: 'clip-1', start: 0, end: effectiveDuration, sourceStart: 0, sourceEnd: effectiveDuration, name: 'Trek 1' },
    ]);
    setSelectedAudioClipId('clip-1');
    setTrimRange(null);
    globalAudioEngine.setTrimRange(null);
    globalAudioEngine.setActiveSegments(null);
    setStatusMessage('↺ Rentang potongan di-reset ke lagu penuh.');
  };

  // Commit and apply cut permanently to visualizer
  const handleApplyTrimPermanently = async () => {
    if (!isAudioClipsModified && !trimRange) {
      setStatusMessage('Belum ada bagian audio yang dipotong.');
      return;
    }

    try {
      setIsApplyingTrim(true);
      const audioBlob = await AudioTrimmerJoiner.getTrackAudioBlob(currentTrack);

      const sortedClips = [...audioClips].sort((a, b) => a.start - b.start);
      const segments =
        trimRange
          ? [{ start: trimRange.start, end: trimRange.end }]
          : sortedClips.map((c) => ({
              start: c.sourceStart ?? c.start,
              end: c.sourceEnd ?? c.end,
            }));

      const totalDur = segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
      const cutTitle = `${currentTrack.title}_Cut_${Math.round(totalDur)}s.wav`;

      const trimResult = await AudioTrimmerJoiner.sliceAndJoinSegments(
        audioBlob,
        segments,
        cutTitle,
        { format: 'wav' }
      );

      // Synchronously slice subtitle timestamps so they remain 100% matched to the cut audio
      const adjustedLyrics = sliceLyricsMultiSegments(subtitleConfig.lyrics, segments);

      setTrimRange(null);
      globalAudioEngine.setTrimRange(null);
      globalAudioEngine.setActiveSegments(null);
      setAudioClips([
        { id: 'clip-1', start: 0, end: trimResult.duration, name: 'Trek 1', sourceStart: 0, sourceEnd: trimResult.duration },
      ]);
      setSelectedAudioClipId('clip-1');

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
    if (!isAudioClipsModified && !trimRange) return;
    try {
      setIsApplyingTrim(true);
      const audioBlob = await AudioTrimmerJoiner.getTrackAudioBlob(currentTrack);

      const sortedClips = [...audioClips].sort((a, b) => a.start - b.start);
      const segments =
        trimRange
          ? [{ start: trimRange.start, end: trimRange.end }]
          : sortedClips.map((c) => ({
              start: c.sourceStart ?? c.start,
              end: c.sourceEnd ?? c.end,
            }));

      const totalDur = segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
      const cutTitle = `${currentTrack.title}_Cut_${Math.round(totalDur)}s.wav`;

      const trimResult = await AudioTrimmerJoiner.sliceAndJoinSegments(
        audioBlob,
        segments,
        cutTitle,
        { format: 'wav' }
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

  // Export Subtitle / Lyrics to .SRT
  const handleExportSrt = () => {
    if (!subtitleConfig.lyrics || subtitleConfig.lyrics.length === 0) {
      setStatusMessage('⚠️ Tidak ada lirik subtitle untuk disimpan!');
      return;
    }
    const srt = WhisperAIService.exportToSrt(subtitleConfig.lyrics);
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
    setStatusMessage(`💾 File lirik .SRT (${subtitleConfig.lyrics.length} baris) berhasil disimpan!`);
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

  // Map raw audio currentTime to timeline coordinate
  const currentTimelineTime = useMemo(() => {
    if (audioClips.length === 0 || !isAudioClipsModified) return currentTime;
    const sorted = [...audioClips].sort((a, b) => a.start - b.start);
    const clip = sorted.find((c) => {
      const sStart = c.sourceStart ?? c.start;
      const sEnd = c.sourceEnd ?? c.end;
      return currentTime >= sStart - 0.05 && currentTime <= sEnd + 0.05;
    });
    if (clip) {
      const sStart = clip.sourceStart ?? clip.start;
      const offset = Math.max(0, currentTime - sStart);
      return Math.min(clip.end, clip.start + offset);
    }
    const nextClip = sorted.find((c) => (c.sourceStart ?? c.start) >= currentTime);
    if (nextClip) {
      return nextClip.start;
    }
    return currentTime;
  }, [currentTime, audioClips, isAudioClipsModified]);

  // Current playhead percentage
  const playheadPercent = (currentTimelineTime / effectiveDuration) * 100;

  // Active trim coordinates
  const trimStartPercent = trimRange ? (trimRange.start / effectiveDuration) * 100 : 0;
  const trimEndPercent = trimRange ? (trimRange.end / effectiveDuration) * 100 : 100;
  const trimWidthPercent = trimEndPercent - trimStartPercent;

  return (
    <div className="w-full bg-[#07090F] border-t border-white/10 flex flex-col select-none shrink-0 z-20 shadow-2xl transition-all duration-300">
      {/* Draggable Divider Handle between Preview Canvas & Timeline */}
      <div
        onMouseDown={handleResizerMouseDown}
        onDoubleClick={handleResetTimelineHeight}
        className="h-2 w-full bg-[#07090F] hover:bg-cyan-500/25 active:bg-cyan-500/40 cursor-row-resize flex items-center justify-center group relative z-30 transition-colors select-none"
        title="Tarik ke atas/bawah untuk atur tinggi timeline & preview (Double-klik untuk otomatis pas baris aktif)"
      >
        <div className="w-12 h-1 rounded-full bg-slate-600 group-hover:bg-cyan-400 group-active:bg-cyan-300 transition-colors shadow-sm flex items-center justify-center">
          <div className="w-3 h-0.5 bg-white/40 rounded-full" />
        </div>
      </div>

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

          {/* Hapus Klip Terpilih (Delete Key / Toolbar Button) */}
          <button
            onClick={handleDeleteSelectedClip}
            disabled={!hasSelectedClip}
            className={`px-2 sm:px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0 ${
              hasSelectedClip
                ? 'bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-rose-100 border-rose-500/50 shadow-sm cursor-pointer'
                : 'bg-white/[0.02] text-slate-500 border-white/5 opacity-40 cursor-not-allowed'
            }`}
            title={
              hasSelectedClip
                ? selectedBRollId
                  ? 'Hapus klip B-Roll yang sedang dipilih (Tekan tombol Delete / Backspace)'
                  : selectedImageId
                  ? 'Hapus slide foto/video yang sedang dipilih (Tekan tombol Delete / Backspace)'
                  : 'Hapus klip yang sedang dipilih (Tekan tombol Delete / Backspace)'
                : 'Pilih klip B-roll, media foto, atau potongan audio terlebih dahulu untuk menghapus'
            }
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Hapus</span>
            <span className="text-[9px] font-mono px-1 py-0.2 bg-black/40 rounded border border-white/10 hidden sm:inline">
              Del
            </span>
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

          {/* Tutup Ruang Kosong (Tutup Semua Gap) */}
          {audioGaps.length > 0 && (
            <button
              onClick={handleCloseAllGaps}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0 animate-pulse shadow-sm"
              title="Hapus semua ruang kosong (gap) di timeline dan rapatkan klip audio"
            >
              <Scissors className="w-3.5 h-3.5 text-rose-400 rotate-90" />
              <span>Tutup {audioGaps.length} Ruang Kosong</span>
            </button>
          )}

          {/* Prominent Apply Cut & Subtitles Button */}
          {(trimRange || isAudioClipsModified) && (
            <button
              onClick={handleApplyTrimPermanently}
              disabled={isApplyingTrim}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 shrink-0 disabled:opacity-50 border border-emerald-300/60"
              title="Terapkan potongan audio dan sinkronkan subtitle secara permanen ke visualizer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span className="text-[11px] font-black tracking-tight">
                💾 Simpan Cut & Subtitle ({formatSec(trimRange ? trimRange.end - trimRange.start : totalAudioClipsDuration)})
              </span>
            </button>
          )}

          {/* Quick Nudge / Shift Buttons for Selected Audio Clip */}
          {selectedAudioClipId && audioClips.length > 0 && (
            <div className="flex items-center gap-0.5 bg-white/[0.05] px-1 py-0.5 rounded-lg border border-white/10 shrink-0 text-[11px]">
              <span className="text-slate-400 text-[10px] mr-1 hidden md:inline font-mono">
                Geser:
              </span>
              <button
                onClick={() => handleShiftClip(selectedAudioClipId, -1)}
                className="px-1.5 py-0.5 text-slate-300 hover:text-cyan-300 hover:bg-white/10 rounded transition-colors flex items-center gap-0.5 font-mono text-[10px]"
                title="Geser klip ke kiri 1 detik"
              >
                <ChevronsLeft className="w-3 h-3 text-cyan-400" />
                <span>-1s</span>
              </button>
              <button
                onClick={() => handleSnapClipToLeft(selectedAudioClipId)}
                className="px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors font-bold text-[10px]"
                title="Rapatkan klip ke kiri (tutup ruang kosong di kiri klip)"
              >
                ⏮ Rapatkan
              </button>
              <button
                onClick={() => handleShiftClip(selectedAudioClipId, 1)}
                className="px-1.5 py-0.5 text-slate-300 hover:text-cyan-300 hover:bg-white/10 rounded transition-colors flex items-center gap-0.5 font-mono text-[10px]"
                title="Geser klip ke kanan 1 detik"
              >
                <span>+1s</span>
                <ChevronsRight className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          )}

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

          {/* Tambah Media (Foto / Video) ke Timeline */}
          <button
            onClick={() => imageFileInputRef.current?.click()}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
            title="Tambah Foto atau Video ke Timeline Visualizer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">+ Foto/Video</span>
            <span className="md:hidden">+ Media</span>
          </button>

          {/* Ekstrak Foto & Video dari File ZIP */}
          <button
            onClick={() => zipFileInputRef.current?.click()}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-bold transition-all active:scale-95 shrink-0"
            title="Ekstrak Foto dan Video dari File ZIP ke Timeline Slideshow"
          >
            <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">+ Dari ZIP</span>
            <span className="md:hidden">+ ZIP</span>
          </button>

          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*,video/*,.zip,.zipx,application/zip,application/x-zip-compressed,multipart/x-zip,application/octet-stream,*/*"
            multiple
            className="hidden"
            onChange={handleImageFilePicked}
          />
          <input
            ref={zipFileInputRef}
            type="file"
            accept=".zip,.zipx,application/zip,application/x-zip-compressed,multipart/x-zip,application/octet-stream,*/*"
            multiple
            className="hidden"
            onChange={handleImageFilePicked}
          />

          {/* If trim is active or clips are split/modified, show Apply and Download options */}
          {(trimRange || isAudioClipsModified) && (
            <>
              <div className="h-4 w-[1px] bg-white/15 mx-0.5" />

              <button
                onClick={handleApplyTrimPermanently}
                disabled={isApplyingTrim}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-black font-black flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0 disabled:opacity-50"
                title="Terapkan potongan audio ini secara permanen ke visualizer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span className="text-[11px]">
                  Terapkan Cut ({formatSec(trimRange ? trimRange.end - trimRange.start : totalAudioClipsDuration)})
                </span>
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

          {/* Menu Sembunyikan / Tampilkan Baris Media */}
          <div className="relative">
            <button
              onClick={() => setShowTrackVisibilityMenu(!showTrackVisibilityMenu)}
              className={`p-1 sm:px-2 sm:py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                hiddenTracksCount > 0
                  ? 'bg-indigo-500/20 border-indigo-400/60 text-indigo-200 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
              }`}
              title="Atur visibilitas baris media di timeline (Sembunyikan/Tampilkan baris)"
            >
              {hiddenTracksCount > 0 ? (
                <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="hidden lg:inline font-medium">Baris Trek</span>
              {hiddenTracksCount > 0 && (
                <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  {4 - hiddenTracksCount}/4
                </span>
              )}
            </button>

            {showTrackVisibilityMenu && (
              <div className="absolute bottom-full mb-2 right-0 w-64 bg-[#0E1322] border border-white/20 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tampilan Baris Media</span>
                  </div>
                  {hiddenTracksCount > 0 && (
                    <button
                      onClick={showAllTracks}
                      className="text-[9px] text-cyan-300 hover:text-cyan-200 font-bold underline"
                    >
                      Tampilkan Semua
                    </button>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  {/* Audio Track Toggle */}
                  <button
                    onClick={() => toggleTrackVisibility('audio')}
                    className={`w-full p-2 rounded-xl flex items-center justify-between transition-colors ${
                      trackVisibility.audio
                        ? 'bg-cyan-950/40 text-cyan-200 border border-cyan-500/30'
                        : 'text-slate-400 hover:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-semibold">Audio Master</span>
                    </div>
                    {trackVisibility.audio ? (
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>

                  {/* Media / Slideshow Track Toggle */}
                  <button
                    onClick={() => toggleTrackVisibility('media')}
                    className={`w-full p-2 rounded-xl flex items-center justify-between transition-colors ${
                      trackVisibility.media
                        ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/30'
                        : 'text-slate-400 hover:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold">Media / Foto Slide</span>
                    </div>
                    {trackVisibility.media ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>

                  {/* B-Roll Track Toggle */}
                  <button
                    onClick={() => toggleTrackVisibility('broll')}
                    className={`w-full p-2 rounded-xl flex items-center justify-between transition-colors ${
                      trackVisibility.broll
                        ? 'bg-violet-950/40 text-violet-200 border border-violet-500/30'
                        : 'text-slate-400 hover:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-violet-400" />
                      <span className="font-semibold">B-Roll Cutaway</span>
                    </div>
                    {trackVisibility.broll ? (
                      <Eye className="w-3.5 h-3.5 text-violet-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>

                  {/* Subtitles Track Toggle */}
                  <button
                    onClick={() => toggleTrackVisibility('subtitle')}
                    className={`w-full p-2 rounded-xl flex items-center justify-between transition-colors ${
                      trackVisibility.subtitle
                        ? 'bg-amber-950/40 text-amber-200 border border-amber-500/30'
                        : 'text-slate-400 hover:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Type className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold">Subtitles & Lirik</span>
                    </div>
                    {trackVisibility.subtitle ? (
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 text-center">
                  Klik ikon mata pada tiap baris untuk sembunyikan baris.
                </div>
              </div>
            )}
          </div>

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

          {/* Mode Ramping / Normal Toggle Button */}
          <button
            onClick={toggleCompactMode}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
              isCompactHeight
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title={
              isCompactHeight
                ? 'Mode Ramping aktif (Klik untuk beralih ke Mode Normal)'
                : 'Beralih ke Mode Ramping (Mengecilkan tinggi baris agar layar preview lebih luas)'
            }
          >
            {isCompactHeight ? <Minimize2 className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isCompactHeight ? 'Ramping' : 'Normal'}</span>
          </button>

          {/* Reset Auto-Fit button if custom height is active */}
          {customTracksHeight !== null && (
            <button
              onClick={handleResetTimelineHeight}
              className="px-1.5 py-1 rounded-lg text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-400/30 flex items-center gap-1 transition-all"
              title="Kembalikan tinggi timeline otomatis pas dengan baris yang tampil"
            >
              <ArrowLeftRight className="w-3 h-3 rotate-90" />
              <span className="hidden md:inline">Auto-Fit</span>
            </button>
          )}

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
                  onClick={() => zipFileInputRef.current?.click()}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                  title="Ekstrak foto langsung dari file ZIP ke slideshow"
                >
                  <FolderArchive className="w-3 h-3 text-amber-400" />
                  <span>Upload ZIP</span>
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

                {/* AI Camera Effects Director Button */}
                <button
                  onClick={() => {
                    // If multiImageSlides is empty but multiImageUrls exists, materialize first
                    if (backgroundConfig.type !== 'custom_image' && (!backgroundConfig.multiImageSlides || backgroundConfig.multiImageSlides.length === 0)) {
                      handleSetSlideVisualEffect(0, 'none');
                    }
                    setIsAiEffectModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-600/20 hover:from-amber-500/35 hover:to-orange-500/35 border border-amber-500/40 text-amber-200 text-[10.5px] font-bold transition-all shadow-sm active:scale-95 shrink-0"
                  title="AI Director: Analisis frame dan pasang efek kamera secara otomatis dan seimbang"
                >
                  <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                  <span className="hidden md:inline">✨ Rekomendasi Efek AI</span>
                  <span className="md:hidden">✨ Efek AI</span>
                </button>

                {/* Quick Add Visual Effect at Playhead */}
                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-lg">
                  <Wand2 className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-amber-300 font-bold hidden md:inline">Efek Frame:</span>
                  <select
                    onChange={(e) => {
                      const val = e.target.value as VisualEffectType;
                      if (val !== 'none') {
                        const cur = Number(currentTime.toFixed(2));
                        const currentSlides = backgroundConfig.multiImageSlides || [];
                        const activeIdx = currentSlides.findIndex((s) => cur >= s.startSec && cur < s.endSec);
                        if (activeIdx !== -1) {
                          handleSetSlideVisualEffect(activeIdx, val);
                        } else {
                          handleAddTimelineFxAtPlayhead(val);
                        }
                      }
                      e.target.value = 'none';
                    }}
                    defaultValue="none"
                    className="bg-transparent text-amber-200 text-[10px] font-bold outline-none cursor-pointer"
                    title="Pasang Efek Kamera (Distorsi, Kamera Jadul, Cacing-cacing) pada slide/frame di posisi jarum playhead saat ini"
                  >
                    <option value="none" className="bg-slate-900 text-slate-400">+ Efek di Posisi Jarum...</option>
                    {VISUAL_EFFECT_OPTIONS.filter((o) => o.id !== 'none').map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {backgroundConfig.timelineFxClips && backgroundConfig.timelineFxClips.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {backgroundConfig.timelineFxClips.map((fx) => {
                      const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === fx.effect);
                      return (
                        <div
                          key={fx.id}
                          className="flex items-center gap-1 bg-amber-500/20 text-amber-200 border border-amber-500/40 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          title={`Efek ${opt?.label || fx.effect}: ${formatSec(fx.startSec)} - ${formatSec(fx.endSec)}`}
                        >
                          <span>{opt?.icon} {opt?.shortLabel} ({formatSec(fx.startSec)}-{formatSec(fx.endSec)})</span>
                          <button
                            onClick={() => handleRemoveTimelineFx(fx.id)}
                            className="text-white/60 hover:text-rose-400 ml-0.5 font-bold text-[11px] leading-none"
                            title="Hapus efek ini"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
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

                {/* "Isi Jeda Musik" Button */}
                <button
                  onClick={handleAutoFillGaps}
                  className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-cyan-500/25 to-blue-500/25 hover:from-cyan-500/40 hover:to-blue-500/40 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                  title="Otomatis pecah jeda instrumental (intro panjang/solo musik) menjadi foto-foto bergantian dinamis agar tidak monoton"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>⚡ Isi Jeda Musik</span>
                </button>
              </div>

              {/* Right: Transitions, Ken Burns & Reset */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  onClick={() => {
                    const cycle: ('fade' | 'fade_black' | 'zoom' | 'slide' | 'cut')[] = [
                      'fade',
                      'fade_black',
                      'zoom',
                      'slide',
                      'cut',
                    ];
                    const current = backgroundConfig.multiImageTransition || 'fade';
                    const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
                    const nextTransition = cycle[nextIdx];
                    onBackgroundChange({
                      ...backgroundConfig,
                      multiImageTransition: nextTransition,
                    });
                    setStatusMessage(`🎬 Transisi diubah: ${
                      nextTransition === 'cut'
                        ? '✂️ Cut Langsung'
                        : nextTransition === 'fade_black'
                        ? '🎬 Dip to Black'
                        : nextTransition === 'zoom'
                        ? '🔍 Zoom Push'
                        : nextTransition === 'slide'
                        ? '↔️ Slide Kiri'
                        : '🌫️ Fade Halus'
                    }`);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                  title="Klik untuk mengganti gaya transisi foto (Fade Halus, Dip Black, Zoom Push, Slide, Cut)"
                >
                  Transisi:{' '}
                  <span className="text-cyan-300 font-bold">
                    {backgroundConfig.multiImageTransition === 'cut'
                      ? '✂️ Cut'
                      : backgroundConfig.multiImageTransition === 'fade_black'
                      ? '🎬 Dip Black'
                      : backgroundConfig.multiImageTransition === 'zoom'
                      ? '🔍 Zoom Push'
                      : backgroundConfig.multiImageTransition === 'slide'
                      ? '↔️ Slide'
                      : '🌫️ Fade'}
                  </span>
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
                    onBackgroundChange({ ...backgroundConfig, type: 'preset_grid', multiImageUrls: [], multiImageSlides: [] });
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

          <div
            className="flex flex-col relative overflow-hidden transition-[height] duration-150 select-none"
            style={{ height: `${appliedTracksHeight}px` }}
          >
            {/* Left Track Headers (CapCut Track Sidebar) */}
            <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-32 bg-[#090D17] border-r border-white/10 z-20 flex flex-col text-[10px] font-bold text-slate-400">
              {/* Ruler Header Corner */}
              <div className={`${trackHeights.rulerClass} border-b border-white/10 px-2 flex items-center justify-between text-slate-500 font-mono text-[9px] bg-black/40`}>
                <span>TRACKS</span>
                {hiddenTracksCount > 0 ? (
                  <button
                    onClick={showAllTracks}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 text-[8px]"
                    title={`${hiddenTracksCount} baris disembunyikan. Klik untuk tampilkan semua.`}
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                    <span>+{hiddenTracksCount}</span>
                  </button>
                ) : (
                  <span className="text-cyan-400">TIME</span>
                )}
              </div>

              {/* Track 1: Audio Header */}
              {trackVisibility.audio && (
                <div className={`${trackHeights.audioClass} border-b border-white/5 px-2 flex flex-col justify-center gap-0.5 bg-cyan-950/20 text-cyan-300 group/th`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 truncate">
                      <Music className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">Audio Master</span>
                    </div>
                    <button
                      onClick={() => toggleTrackVisibility('audio')}
                      className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-cyan-300 transition-colors opacity-70 group-hover/th:opacity-100"
                      title="Sembunyikan baris Audio Master"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 truncate">
                    {currentTrack.genre || 'Original WAV'}
                  </span>
                </div>
              )}

              {/* Track 2: Image / Media Header */}
              {trackVisibility.media && (
                <div
                  onDragOver={handleMediaDragOver}
                  onDragEnter={handleMediaDragOver}
                  onDragLeave={handleMediaDragLeave}
                  onDrop={handleMediaDrop}
                  className={`${trackHeights.mediaClass} border-b border-white/5 px-2 flex flex-col justify-center gap-0.5 transition-colors group/th ${
                    isDraggingMediaOver ? 'bg-emerald-800/40 text-emerald-200' : 'bg-emerald-950/20 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 truncate">
                      <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">Media / Foto</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => zipFileInputRef.current?.click()}
                        className="text-[8px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-1 py-0.5 rounded font-bold transition-colors flex items-center gap-0.5"
                        title="Ekstrak foto langsung dari file ZIP"
                      >
                        <FolderArchive className="w-2.5 h-2.5" />
                        ZIP
                      </button>
                      <button
                        onClick={() => imageFileInputRef.current?.click()}
                        className="text-[8px] bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 px-1 py-0.5 rounded font-bold transition-colors"
                        title="Tambah Gambar Baru ke Visualizer (Bisa pilih banyak foto)"
                      >
                        + Foto
                      </button>
                      <button
                        onClick={() => toggleTrackVisibility('media')}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-emerald-300 transition-colors opacity-70 group-hover/th:opacity-100 ml-0.5"
                        title="Sembunyikan baris Media / Foto"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 truncate">
                    {backgroundConfig.type === 'multi_image' && backgroundConfig.multiImageUrls?.length
                      ? `${backgroundConfig.multiImageUrls.length} Slideshow`
                      : imageClips.length > 0
                      ? `${imageClips.length} Gambar`
                      : 'Drag & Drop Foto'}
                  </span>
                </div>
              )}

              {/* Track 2.5: B-Roll / Cutaway Header */}
              {trackVisibility.broll && (
                <div className={`${trackHeights.brollClass} border-b border-white/5 px-2 flex flex-col justify-center gap-0.5 bg-violet-950/25 text-violet-300 group/th`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 truncate">
                      <Film className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="truncate">B-Roll Cutaway</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => {
                          setBRollModalTab('stock');
                          setIsBRollModalOpen(true);
                        }}
                        className="text-[8px] bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200 px-1 py-0.5 rounded font-bold transition-colors flex items-center gap-0.5"
                        title="Cari Stok Video & Foto Bebas Royalti (Pexels, Pixabay, Wikimedia, dsb.)"
                      >
                        <Film className="w-2.5 h-2.5 text-emerald-300" />
                        <span>Stok</span>
                      </button>
                      <button
                        onClick={() => {
                          setBRollModalTab('ai');
                          setIsBRollModalOpen(true);
                        }}
                        className="text-[8px] bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 px-1 py-0.5 rounded font-bold transition-colors flex items-center gap-0.5"
                        title="Analisis Subtitle & Rekomendasikan B-Roll dengan AI"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                        <span>AI</span>
                      </button>
                      <button
                        onClick={() => {
                          setBRollModalTab('presets');
                          setIsBRollModalOpen(true);
                        }}
                        className="text-[8px] bg-violet-500/20 hover:bg-violet-500/40 text-violet-200 px-1 py-0.5 rounded font-bold transition-colors flex items-center gap-0.5"
                        title="Buka Pustaka Preset B-Roll"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-violet-300" />
                      </button>
                      <button
                        onClick={() => toggleTrackVisibility('broll')}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-violet-300 transition-colors opacity-70 group-hover/th:opacity-100 ml-0.5"
                        title="Sembunyikan baris B-Roll Cutaway"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 truncate">
                    {(backgroundConfig.bRoll?.clips || []).length > 0
                      ? `${backgroundConfig.bRoll?.clips.length} Klip Aktif`
                      : 'Klip / PiP / Overlay'}
                  </span>
                </div>
              )}

              {/* Track 3: Subtitle / Lyric Header */}
              {trackVisibility.subtitle && (
                <div className={`${trackHeights.subtitleClass} px-2 flex flex-col justify-center gap-0.5 bg-amber-950/20 text-amber-300 group/th`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 truncate">
                      <Type className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">Subtitles</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {onOpenSubtitleEditor && (
                        <button
                          onClick={onOpenSubtitleEditor}
                          className="text-[8px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-1 py-0.5 rounded transition-colors font-bold"
                          title="Buka Editor Teks Subtitle"
                        >
                          Edit
                        </button>
                      )}
                      {onOpenWhisperModal && (
                        <button
                          onClick={onOpenWhisperModal}
                          className="text-[8px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-1 py-0.5 rounded transition-colors font-bold flex items-center gap-0.5"
                          title="Generate Subtitle Otomatis dengan Groq / OpenAI / KoboiLLM Whisper AI"
                        >
                          <Zap className="w-2.5 h-2.5" />
                          <span>Whisper AI</span>
                        </button>
                      )}
                      <button
                        onClick={handleExportSrt}
                        disabled={!subtitleConfig.lyrics || subtitleConfig.lyrics.length === 0}
                        className="text-[8px] bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 px-1 py-0.5 rounded transition-colors font-bold flex items-center gap-0.5 disabled:opacity-40"
                        title="Simpan / Download Lirik dalam Format .SRT"
                      >
                        <Download className="w-2.5 h-2.5" />
                        <span>SRT</span>
                      </button>
                      <button
                        onClick={() => toggleTrackVisibility('subtitle')}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-amber-300 transition-colors opacity-70 group-hover/th:opacity-100 ml-0.5"
                        title="Sembunyikan baris Subtitles"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 truncate">
                    {subtitleConfig.lyrics.length} Segmen
                  </span>
                </div>
              )}
            </div>

          {/* Main Scrollable Timeline Track Workspace */}
          <div
            ref={timelineContainerRef}
            onMouseDown={handleTimelineMouseDown}
            className="flex-1 ml-24 sm:ml-32 overflow-x-auto overflow-y-hidden relative custom-scrollbar cursor-crosshair bg-[#060810]"
            style={{ height: `${appliedTracksHeight}px` }}
          >
            {/* Inner Content Sized According to Zoom Level */}
            <div
              className="h-full relative min-w-full"
              style={{ width: `${zoomLevel * 100}%` }}
            >
              {/* ---------------------------------------------------- */}
              {/* A. TIME RULER (Top Bar with Second Ticks)             */}
              {/* ---------------------------------------------------- */}
              <div className={`${trackHeights.rulerClass} bg-[#0B0F1B] border-b border-white/10 relative text-[9px] font-mono text-slate-400`}>
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
              {/* ---------------------------------------------------- */}
              {/* B. TRACK 1: AUDIO WAVEFORM TRACK (CapCut Multi-Clip) */}
              {/* ---------------------------------------------------- */}
              {trackVisibility.audio && (
                <div className={`${trackHeights.audioClass} border-b border-white/5 relative p-1 flex items-center bg-[#070A14]`}>
                {/* Ruang Kosong (Gaps Antar Klip Ala CapCut) */}
                {audioGaps.map((gap) => {
                  const gapStartPct = (gap.start / effectiveDuration) * 100;
                  const gapWidthPct = Math.max(0.5, (gap.duration / effectiveDuration) * 100);

                  return (
                    <div
                      key={gap.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGap(gap);
                      }}
                      className="timeline-gap-element absolute top-1 bottom-1 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer transition-all border border-dashed border-rose-500/40 hover:border-rose-400 hover:bg-rose-500/20 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02)_6px,rgba(244,63,94,0.08)_6px,rgba(244,63,94,0.08)_12px)] group z-10 shadow-inner"
                      style={{
                        left: `${gapStartPct}%`,
                        width: `${gapWidthPct}%`,
                      }}
                      title={`Ruang Kosong (${gap.duration.toFixed(1)}s) - Klik untuk hapus ruang kosong ini`}
                    >
                      <div className="flex items-center gap-1 text-[9px] font-bold text-rose-300 group-hover:text-white px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs shadow-sm border border-rose-500/30 transition-transform group-hover:scale-105 select-none pointer-events-none">
                        <Scissors className="w-2.5 h-2.5 text-rose-400 rotate-90" />
                        <span className="truncate">
                          {gap.duration >= 1.5 ? `Tutup Gap (${gap.duration.toFixed(1)}s)` : 'Tutup'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {audioClips.map((clip) => {
                  const isSelected = selectedAudioClipId === clip.id;
                  const isDraggingThis = draggingAudioClipId === clip.id;
                  const clipStartPct = (clip.start / effectiveDuration) * 100;
                  const clipWidthPct = Math.max(0.5, ((clip.end - clip.start) / effectiveDuration) * 100);
                  const startBarIdx = Math.floor(((clip.sourceStart ?? clip.start) / effectiveDuration) * waveformBars.length);
                  const endBarIdx = Math.ceil(((clip.sourceEnd ?? clip.end) / effectiveDuration) * waveformBars.length);
                  const clipBars = waveformBars.slice(startBarIdx, Math.max(startBarIdx + 1, endBarIdx));

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClip('audio');
                        setSelectedAudioClipId(clip.id);
                        setSelectedBRollId(null);
                        setSelectedImageId(null);
                      }}
                      onMouseDown={(e) => handleAudioClipMouseDown(e, clip, 'body')}
                      className={`audio-clip-element absolute top-1 bottom-1 rounded-xl overflow-hidden flex items-center transition-all select-none group ${
                        isDraggingThis
                          ? `${draggingAudioEdge ? 'cursor-ew-resize' : 'cursor-grabbing'} ring-2 ring-yellow-400 bg-cyan-950/95 border-2 border-yellow-400 z-30 shadow-2xl scale-[1.01]`
                          : isSelected
                          ? 'cursor-grab bg-gradient-to-r from-cyan-950/90 via-indigo-950/80 to-blue-950/90 border-2 border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/20 z-20'
                          : 'cursor-grab bg-white/[0.04] border border-white/10 hover:border-cyan-400/40 hover:bg-white/[0.08] z-10'
                      }`}
                      style={{
                        left: `${clipStartPct}%`,
                        width: `${clipWidthPct}%`,
                      }}
                      title={`${clip.name} (${formatSec(clip.start)} - ${formatSec(clip.end)}) - Klik & geser untuk memindahkan`}
                    >
                      {/* Left Trim Handle (Tarik Ujung Kiri) */}
                      <div
                        onMouseDown={(e) => handleAudioClipMouseDown(e, clip, 'left')}
                        className={`audio-trim-handle absolute left-0 top-0 bottom-0 w-2 sm:w-2.5 hover:w-3 cursor-ew-resize z-30 flex items-center justify-center transition-all rounded-l-xl ${
                          isDraggingThis && draggingAudioEdge === 'left'
                            ? 'bg-yellow-400 w-3 opacity-100'
                            : 'bg-cyan-400/80 hover:bg-cyan-300 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Tarik ujung kiri untuk memotong/memperpanjang klip"
                      >
                        <div className="w-[1.5px] h-3.5 bg-black/60 rounded-full" />
                      </div>

                      {/* Right Trim Handle (Tarik Ujung Kanan) */}
                      <div
                        onMouseDown={(e) => handleAudioClipMouseDown(e, clip, 'right')}
                        className={`audio-trim-handle absolute right-0 top-0 bottom-0 w-2 sm:w-2.5 hover:w-3 cursor-ew-resize z-30 flex items-center justify-center transition-all rounded-r-xl ${
                          isDraggingThis && draggingAudioEdge === 'right'
                            ? 'bg-yellow-400 w-3 opacity-100'
                            : 'bg-cyan-400/80 hover:bg-cyan-300 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Tarik ujung kanan untuk memotong/memperpanjang klip"
                      >
                        <div className="w-[1.5px] h-3.5 bg-black/60 rounded-full" />
                      </div>

                      {/* Live Dragging Tooltip */}
                      {isDraggingThis && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-[9px] px-2 py-0.5 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap flex items-center gap-1">
                          <ArrowLeftRight className="w-2.5 h-2.5" />
                          <span>{formatSec(clip.start)} - {formatSec(clip.end)}</span>
                        </div>
                      )}

                      {/* Waveform Bars for this clip */}
                      <div className="absolute inset-0 flex items-center justify-between px-2 gap-[1px] opacity-75 pointer-events-none">
                        {clipBars.map((heightFactor, idx) => {
                          const barGlobalSec = clip.start + (idx / Math.max(1, clipBars.length)) * (clip.end - clip.start);
                          const isPast = currentTimelineTime >= barGlobalSec;
                          return (
                            <div
                              key={idx}
                              className={`w-1 rounded-full transition-all ${
                                isPast
                                  ? 'bg-cyan-400 shadow-sm shadow-cyan-400'
                                  : 'bg-indigo-400/40'
                              }`}
                              style={{ height: `${heightFactor * 75}%` }}
                            />
                          );
                        })}
                      </div>

                      {/* Clip Title & Duration Overlay */}
                      <div className="absolute top-1 left-3 z-10 pointer-events-none flex items-center gap-1.5 text-white text-[10px] font-bold drop-shadow-md">
                        <Music className="w-3 h-3 text-cyan-300" />
                        <span>{clip.name}</span>
                        <span className="text-slate-400 font-mono text-[9px]">
                          ({(clip.end - clip.start).toFixed(1)}s)
                        </span>
                      </div>

                      {/* Hover Action Controls (Putar Klip, Rapatkan, Hapus Klip) */}
                      <div className="hidden group-hover:flex items-center gap-1 absolute right-2 top-1 bottom-1 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            globalAudioEngine.seek(clip.sourceStart ?? clip.start);
                            if (!isPlaying) onTogglePlay();
                          }}
                          className="p-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors"
                          title="Putar dari awal klip ini"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSnapClipToLeft(clip.id);
                          }}
                          className="p-1 rounded-md bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors"
                          title="Rapatkan klip ini ke kiri (tutup ruang kosong sebelah kiri)"
                        >
                          <ChevronsLeft className="w-3 h-3" />
                        </button>
                        {audioClips.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAudioClip(clip.id);
                            }}
                            className="p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors"
                            title="Hapus klip ini (buang bagian ini)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* If trimRange is active on timeline, show trim handles */}
                {trimRange && (
                  <>
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-black/75 backdrop-blur-[1px] pointer-events-none z-10"
                      style={{ width: `${trimStartPercent}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-black/75 backdrop-blur-[1px] pointer-events-none z-10"
                      style={{ width: `${100 - trimEndPercent}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 border-y-2 border-pink-400 bg-pink-500/10 pointer-events-none z-10"
                      style={{
                        left: `${trimStartPercent}%`,
                        width: `${trimWidthPercent}%`,
                      }}
                    >
                      <div className="absolute top-1 right-2 text-[9px] font-mono text-pink-300 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                        Reff: {formatSec(trimRange.end - trimRange.start)}
                      </div>
                    </div>
                    <div
                      onMouseDown={(e) => handleTrimHandleMouseDown(e, 'start')}
                      className="trim-handle absolute top-0 bottom-0 w-3.5 bg-pink-500 hover:bg-pink-400 cursor-ew-resize z-20 flex items-center justify-center rounded-l-md shadow-lg group"
                      style={{ left: `${trimStartPercent}%` }}
                      title="Geser batas awal potongan audio"
                    >
                      <div className="w-1 h-4 bg-black/60 rounded-full" />
                    </div>
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
            )}

            {/* ---------------------------------------------------- */}
            {/* C. TRACK 2: IMAGE / MEDIA TRACK                      */}
            {/* ---------------------------------------------------- */}
            {trackVisibility.media && (
              <div className={`${trackHeights.mediaClass} border-b border-white/5 relative p-1 flex items-center`}>
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
                      <FolderArchive className="w-5 h-5 animate-bounce text-amber-400" />
                      <span>Lepaskan file foto atau file ZIP di sini untuk otomatis mengekstrak ke Slideshow!</span>
                    </div>
                  )}

                  {imageClips.length === 0 ? (
                    <div className="w-full h-full flex items-center gap-2">
                      <button
                        onClick={() => imageFileInputRef.current?.click()}
                        className="flex-1 h-full border border-dashed border-emerald-500/30 hover:border-emerald-400/60 rounded-lg flex items-center justify-center gap-2 text-[10px] text-emerald-300/80 hover:text-emerald-300 transition-all cursor-pointer bg-emerald-950/10"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>+ Drag & Drop / Klik untuk tambah foto</span>
                      </button>
                      <button
                        onClick={() => zipFileInputRef.current?.click()}
                        className="h-full px-3 border border-dashed border-amber-500/40 hover:border-amber-400/70 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-300/90 hover:text-amber-300 transition-all cursor-pointer bg-amber-950/15 shrink-0"
                        title="Ekstrak foto langsung dari arsip file ZIP"
                      >
                        <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                        <span>📦 Ekstrak dari ZIP</span>
                      </button>
                    </div>
                  ) : (
                    imageClips.map((clip) => {
                      const isVideoClip = clip.mediaType === 'video' || isVideoMedia(clip.url);
                      return (
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
                              setSelectedClip('image');
                              setSelectedBRollId(null);
                              setSelectedAudioClipId(null);
                            }}
                            className={`h-full rounded-lg border p-1 flex items-center gap-2 relative group cursor-pointer transition-all select-none ${
                              isVideoClip
                                ? selectedImageId === clip.id
                                  ? 'bg-cyan-950/70 border-cyan-400 shadow-md shadow-cyan-500/30'
                                  : 'bg-cyan-950/35 border-cyan-500/30 hover:border-cyan-400/50'
                                : selectedImageId === clip.id
                                ? 'bg-emerald-900/50 border-emerald-400 shadow-md shadow-emerald-500/30'
                                : clip.visualEffect && clip.visualEffect !== 'none'
                                ? 'bg-amber-950/40 border-amber-400/60 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/40'
                                : 'bg-emerald-900/30 border-emerald-500/30 hover:border-emerald-400/50'
                            }`}
                            style={{
                              left: `${clip.startPct}%`,
                              width: `${clip.widthPct}%`,
                              position: 'absolute',
                            }}
                            title={
                              clip.type === 'slide'
                                ? `Slide ${isVideoClip ? 'Video' : 'Foto'} #${clip.slideIndex} (${(clip.duration || (backgroundConfig.multiImageInterval || 5)).toFixed(1)}s) - Klik untuk pilih, drag untuk atur urutan`
                                : clip.title
                            }
                          >
                            {isVideoClip ? (
                              <div className="h-full w-9 sm:w-11 rounded border border-cyan-400/40 shrink-0 bg-black relative overflow-hidden flex items-center justify-center pointer-events-none shadow-sm">
                                <video src={clip.url} className="h-full w-full object-cover" muted playsInline />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 flex items-end justify-center pb-0.5">
                                  <Video className="w-3 h-3 text-cyan-300 drop-shadow" />
                                </div>
                              </div>
                            ) : (
                              <img
                                src={clip.url}
                                alt=""
                                className="h-full w-9 sm:w-11 object-cover rounded border border-white/15 shrink-0 bg-black pointer-events-none"
                              />
                            )}
                            <div className="truncate flex-1 min-w-0 pr-1">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-[8px] font-bold uppercase px-1 rounded border shrink-0 flex items-center gap-0.5 ${
                                    isVideoClip
                                      ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/50'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  }`}
                                >
                                  {isVideoClip ? (
                                    <Video className="w-2.5 h-2.5 text-cyan-300" />
                                  ) : (
                                    <ImageIcon className="w-2.5 h-2.5 text-emerald-300" />
                                  )}
                                  <span>
                                    {clip.type === 'background'
                                      ? 'BG'
                                      : clip.type === 'center_logo'
                                      ? 'LOGO'
                                      : isVideoClip
                                      ? `VIDEO ${clip.slideIndex || 1}`
                                      : `FOTO ${clip.slideIndex || 1}`}
                                  </span>
                                </span>
                                <span className="text-[10px] font-bold text-white truncate">{clip.title}</span>
                              </div>
                              <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mt-0.5">
                                <div className="truncate">
                                  <span>{formatSec(clip.startSec)} - {formatSec(clip.endSec)}</span>
                                  {clip.duration && (
                                    <span className="text-cyan-400 font-bold ml-1">({clip.duration.toFixed(1)}s)</span>
                                  )}
                                </div>
                                {(clip.type === 'slide' || clip.id === 'bg-single') && (
                                  <div className="flex items-center ml-1" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={clip.visualEffect || 'none'}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (clip.id === 'bg-single') {
                                          onBackgroundChange({
                                            ...backgroundConfig,
                                            customImageVisualEffect: e.target.value as VisualEffectType,
                                            customImageVisualEffectIntensity: 0.8,
                                          });
                                          const opt = VISUAL_EFFECT_OPTIONS.find((o) => o.id === e.target.value);
                                          setStatusMessage(
                                            e.target.value === 'none'
                                              ? '⚪ Efek visual Background dinonaktifkan.'
                                              : `✨ Efek ${opt?.shortLabel || e.target.value} aktif pada Background Video!`
                                          );
                                        } else {
                                          handleSetSlideVisualEffect(clip.originalIndex ?? clip.id, e.target.value as VisualEffectType);
                                        }
                                      }}
                                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded border outline-none cursor-pointer ${
                                        clip.visualEffect && clip.visualEffect !== 'none'
                                          ? VISUAL_EFFECT_OPTIONS.find((o) => o.id === clip.visualEffect)?.badgeClass || 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                                          : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
                                      }`}
                                      title="Pilih Efek Kamera Visual untuk frame/video ini"
                                    >
                                      {VISUAL_EFFECT_OPTIONS.map((opt) => (
                                        <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                                          {opt.icon} {opt.shortLabel}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
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
                    );
                  })
                )}
                </div>
              </div>
            )}

              {/* ---------------------------------------------------- */}
              {/* D. TRACK 2.5: B-ROLL / CUTAWAY OVERLAYS TRACK         */}
              {/* ---------------------------------------------------- */}
              {trackVisibility.broll && (
                <div className={`${trackHeights.brollClass} border-b border-white/5 relative p-1 flex items-center`}>
                <div
                  onClick={() => {
                    setSelectedClip('broll');
                    setSelectedBRollId(null);
                  }}
                  className={`w-full h-full rounded-xl relative overflow-hidden flex items-center px-1 transition-all ${
                    selectedClip === 'broll'
                      ? 'bg-violet-950/40 border border-violet-500/50 shadow-inner'
                      : 'bg-violet-950/15 border border-violet-500/20'
                  }`}
                >
                  {(!backgroundConfig.bRoll?.clips || backgroundConfig.bRoll.clips.length === 0) ? (
                    <div
                      onClick={() => setIsBRollModalOpen(true)}
                      className="h-full flex items-center justify-center text-[10px] text-violet-300/60 gap-1.5 cursor-pointer hover:text-violet-200 transition-colors w-full"
                      title="Klik untuk membuka Studio B-Roll & Pustaka Preset"
                    >
                      <Film className="w-3 h-3 text-violet-400" />
                      <span>Belum ada klip B-Roll. Klik di sini untuk menambah cutaway / PiP / overlay.</span>
                    </div>
                  ) : (
                    backgroundConfig.bRoll.clips.map((bClip, bIdx) => {
                      const startPct = (bClip.startSec / effectiveDuration) * 100;
                      const widthPct = Math.max(1.5, ((bClip.endSec - bClip.startSec) / effectiveDuration) * 100);
                      const isCurrent = currentTime >= bClip.startSec && currentTime <= bClip.endSec;
                      const isSelected = selectedBRollId === bClip.id;

                      return (
                        <div
                          key={bClip.id || bIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClip('broll');
                            setSelectedBRollId(bClip.id);
                            setSelectedImageId(null);
                            setSelectedAudioClipId(null);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsBRollModalOpen(true);
                          }}
                          className={`absolute top-0.5 bottom-0.5 rounded-lg px-2 text-[9px] font-semibold flex items-center justify-between truncate cursor-pointer transition-all border group ${
                            isSelected
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white border-violet-300 shadow-md shadow-violet-600/40 z-20 ring-1 ring-violet-400'
                              : isCurrent
                              ? 'bg-gradient-to-r from-violet-700/80 to-purple-800/80 text-violet-100 border-violet-500/70 z-10'
                              : 'bg-violet-900/60 text-violet-200 border-violet-700/40 hover:border-violet-400/50'
                          }`}
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                          }}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px]">
                              {bClip.displayMode === 'pip'
                                ? '📺'
                                : bClip.displayMode === 'split_screen'
                                ? '🌗'
                                : bClip.displayMode === 'blend_overlay'
                                ? '✨'
                                : '🎬'}
                            </span>
                            <span className="truncate font-bold text-[10px]">
                              {bClip.name}
                            </span>
                            <span className="text-[8px] opacity-75 font-mono">
                              ({(bClip.endSec - bClip.startSec).toFixed(1)}s)
                            </span>
                          </div>

                          {/* Visual Effect Selector for B-Roll */}
                          <div className="flex items-center ml-auto mr-1" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={bClip.visualEffect || 'none'}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSetBRollVisualEffect(bClip.id, e.target.value as VisualEffectType);
                              }}
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded border outline-none cursor-pointer ${
                                bClip.visualEffect && bClip.visualEffect !== 'none'
                                  ? VISUAL_EFFECT_OPTIONS.find((o) => o.id === bClip.visualEffect)?.badgeClass || 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                                  : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="Pilih Efek Kamera Visual untuk klip B-Roll ini"
                            >
                              {VISUAL_EFFECT_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                                  {opt.icon} {opt.shortLabel}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quick Actions on Selected B-Roll clip */}
                          {isSelected && (
                            <div className="flex items-center gap-1 shrink-0 ml-1 z-30">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCycleBRollMode(bClip.id);
                                }}
                                className="px-1 py-0.5 rounded bg-black/50 hover:bg-black/70 text-[8px] font-bold text-violet-200 uppercase"
                                title="Ganti Mode Tampilan (Cutaway, PiP, Split, Blend)"
                              >
                                {bClip.displayMode || 'Cut'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSplitBRollClip(bClip.id);
                                }}
                                className="p-0.5 rounded bg-black/50 hover:bg-violet-500/40 text-violet-200 text-[8px]"
                                title="Bagi klip B-roll ini di posisi jarum saat ini"
                              >
                                <Scissors className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsBRollModalOpen(true);
                                }}
                                className="p-0.5 rounded bg-black/50 hover:bg-violet-500/40 text-violet-200 text-[8px]"
                                title="Buka Pengaturan Lengkap Klip"
                              >
                                <Sliders className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBRollClip(bClip.id);
                                }}
                                className="p-0.5 rounded bg-black/50 hover:bg-rose-500/40 text-rose-300 text-[8px]"
                                title="Hapus Klip B-Roll ini"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* E. TRACK 3: SUBTITLE / LYRIC BLOCKS TRACK             */}
            {/* ---------------------------------------------------- */}
            {trackVisibility.subtitle && (
              <div className={`${trackHeights.subtitleClass} relative p-1 flex items-center`}>
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
            )}

            {/* If all tracks are hidden: sleek minimal strip */}
            {hiddenTracksCount === 4 && (
              <div className="h-full flex items-center justify-center gap-2.5 text-slate-400 select-none px-3 bg-[#080B14]">
                <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-300 truncate">Semua baris timeline disembunyikan</span>
                <button
                  onClick={showAllTracks}
                  className="px-2.5 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0"
                >
                  Tampilkan Semua Baris
                </button>
              </div>
            )}

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

      {/* B-Roll Modal */}
      <BRollModal
        isOpen={isBRollModalOpen}
        onClose={() => setIsBRollModalOpen(false)}
        backgroundConfig={backgroundConfig}
        onBackgroundChange={onBackgroundChange}
        currentTime={currentTime}
        duration={effectiveDuration}
        lyrics={subtitleConfig.lyrics || []}
        initialTab={bRollModalTab}
        onSeek={(sec) => {
          globalAudioEngine.seek(sec);
        }}
      />

      {/* AI Camera Effects Director Modal */}
      <AiVisualEffectsModal
        isOpen={isAiEffectModalOpen}
        onClose={() => setIsAiEffectModalOpen(false)}
        slides={[
          ...(backgroundConfig.type === 'custom_image' && backgroundConfig.customImageUrl
            ? [
                {
                  id: 'bg-custom',
                  url: backgroundConfig.customImageUrl,
                  name: getMediaUrlType(backgroundConfig.customImageUrl) === 'video' ? 'Background Video' : 'Background Image',
                  startSec: 0,
                  endSec: effectiveDuration,
                  mediaType: getMediaUrlType(backgroundConfig.customImageUrl) === 'video' ? ('video' as const) : ('image' as const),
                  visualEffect: backgroundConfig.customImageVisualEffect || 'none',
                  visualEffectIntensity: backgroundConfig.customImageVisualEffectIntensity,
                },
              ]
            : backgroundConfig.multiImageSlides || []),
          ...(backgroundConfig.bRoll?.clips || []).map((b) => ({
            id: b.id,
            url: b.url,
            name: `B-Roll: ${b.name}`,
            startSec: b.startSec,
            endSec: b.endSec,
            mediaType: b.mediaType || 'video',
            visualEffect: b.visualEffect || 'none',
            visualEffectIntensity: b.visualEffectIntensity,
          })),
        ]}
        lyrics={subtitleConfig.lyrics || []}
        duration={effectiveDuration}
        onApplyEffects={(updatedSlides) => {
          const currentBRollClips = backgroundConfig.bRoll?.clips || [];
          const bRollMap = new Map(
            updatedSlides
              .filter((s) => currentBRollClips.some((b) => b.id === s.id))
              .map((s) => [s.id, s])
          );

          let updatedBRollClips: BRollClip[] | undefined = undefined;
          if (bRollMap.size > 0 && currentBRollClips.length > 0) {
            updatedBRollClips = currentBRollClips.map((b) => {
              const matched = bRollMap.get(b.id);
              if (matched) {
                return {
                  ...b,
                  visualEffect: matched.visualEffect,
                  visualEffectIntensity: matched.visualEffectIntensity,
                };
              }
              return b;
            });
          }

          const newBRollConfig: BRollConfig | undefined = updatedBRollClips
            ? {
                enabled: backgroundConfig.bRoll?.enabled ?? true,
                defaultDisplayMode: backgroundConfig.bRoll?.defaultDisplayMode,
                defaultPipPosition: backgroundConfig.bRoll?.defaultPipPosition,
                globalOpacity: backgroundConfig.bRoll?.globalOpacity,
                clips: updatedBRollClips,
              }
            : backgroundConfig.bRoll;

          if (backgroundConfig.type === 'custom_image') {
            const bgCustomSlide = updatedSlides.find((s) => s.id === 'bg-custom');
            onBackgroundChange({
              ...backgroundConfig,
              customImageVisualEffect: bgCustomSlide ? bgCustomSlide.visualEffect : 'none',
              customImageVisualEffectIntensity: bgCustomSlide ? bgCustomSlide.visualEffectIntensity : 0.8,
              bRoll: newBRollConfig,
            });
            const activeCount = updatedSlides.filter((s) => s.visualEffect && s.visualEffect !== 'none').length;
            setStatusMessage(`✨ Berhasil memasang efek visual AI ke background & B-roll (${activeCount} aktif)!`);
          } else {
            const nonBRollSlides = updatedSlides.filter(
              (s) => !currentBRollClips.some((b) => b.id === s.id)
            );
            onBackgroundChange({
              ...backgroundConfig,
              type: 'multi_image',
              multiImageSlides: nonBRollSlides,
              bRoll: newBRollConfig,
            });
            const activeCount = updatedSlides.filter((s) => s.visualEffect && s.visualEffect !== 'none').length;
            setStatusMessage(`✨ Berhasil memasang efek kamera AI ke ${activeCount} frame & B-roll!`);
          }
        }}
        onClearAllEffects={() => {
          const clearedBRoll = backgroundConfig.bRoll?.clips?.map((b) => ({
            ...b,
            visualEffect: 'none' as VisualEffectType,
          }));

          const clearedBRollConfig: BRollConfig | undefined = clearedBRoll
            ? {
                enabled: backgroundConfig.bRoll?.enabled ?? true,
                defaultDisplayMode: backgroundConfig.bRoll?.defaultDisplayMode,
                defaultPipPosition: backgroundConfig.bRoll?.defaultPipPosition,
                globalOpacity: backgroundConfig.bRoll?.globalOpacity,
                clips: clearedBRoll,
              }
            : backgroundConfig.bRoll;

          if (backgroundConfig.type === 'custom_image') {
            onBackgroundChange({
              ...backgroundConfig,
              customImageVisualEffect: 'none',
              bRoll: clearedBRollConfig,
            });
          } else if (backgroundConfig.multiImageSlides) {
            const cleared = backgroundConfig.multiImageSlides.map((s) => ({
              ...s,
              visualEffect: 'none' as VisualEffectType,
            }));
            onBackgroundChange({
              ...backgroundConfig,
              multiImageSlides: cleared,
              bRoll: clearedBRollConfig,
            });
          }
          setStatusMessage('🗑️ Semua efek kamera frame & B-roll dihapus.');
        }}
      />

      {/* ZIP Extraction Progress Modal */}
      {isExtractingZip && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <FolderArchive className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <h4 className="text-white font-bold text-base">Mengekstrak Media dari ZIP</h4>
              <p className="text-xs text-slate-300 mt-1 min-h-[1.5rem] truncate">
                {zipProgress.message || 'Mempersiapkan ekstraksi...'}
              </p>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-white/10">
              <div
                className="bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 h-full transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(5, zipProgress.percent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Status: Ekstrak arsip</span>
              <span className="text-amber-400 font-bold">{zipProgress.percent}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
