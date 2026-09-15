import React, { useRef, useState, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  Camera,
  Image,
  Flame,
  Star,
  Zap,
  FolderArchive,
  Video,
  Film,
  Wand2,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { BackgroundConfig, ParticlesConfig, BackgroundType, ParticleType, LyricSegment, SlideItem, VisualEffectType } from '../../types/visualizer';
import { VISUAL_EFFECT_OPTIONS } from '../../types/visualizer';
import { AiLyricImageModal } from '../AiLyricImageModal';
import { BRollModal } from '../BRollModal';
import { StockMediaModal } from '../StockMediaModal';
import { AiVisualEffectsModal } from '../AiVisualEffectsModal';
import type { StockMediaItem } from '../../utils/stockMediaService';
import {
  isZipFile,
  isZipBlob,
  processFilesWithZipExtraction,
  isVideoMedia,
  registerMediaUrl,
  isVideoFile,
  getMediaUrlType,
} from '../../utils/zipImageExtractor';
import { heuristicMatchImagesToLyrics } from '../../utils/aiLyricImageMatcher';

interface BackgroundTabProps {
  bgConfig: BackgroundConfig;
  particlesConfig: ParticlesConfig;
  onBgChange: (newConfig: BackgroundConfig) => void;
  onParticlesChange: (newConfig: ParticlesConfig) => void;
  lyrics?: LyricSegment[];
  duration?: number;
}

const BG_PRESETS: { id: BackgroundType; label: string; desc: string }[] = [
  { id: 'preset_nebula', label: 'Cosmic Nebula', desc: 'Deep galactic space with swirling gradient clouds' },
  { id: 'preset_grid', label: 'Cyberpunk Grid', desc: '3D perspective wireframe horizon with moving gridlines' },
  { id: 'preset_synthwave', label: '80s Synthwave Sun', desc: 'Retro-futuristic neon striped sun with purple horizon' },
  { id: 'preset_cyber_tunnel', label: 'Matrix Tunnel', desc: 'Expanding concentric green wireframe rings' },
  { id: 'preset_aurora', label: 'Aurora Shockwave', desc: 'Fiery crimson & amber audio-reactive glow curtains' },
  { id: 'preset_dark_studio', label: 'Dark Studio', desc: 'Luxury dark vignette with subtle lighting' },
  { id: 'custom_image', label: 'Custom Media', desc: 'Upload wallpaper, video, banner or cover art' },
  { id: 'multi_image', label: 'Slideshow Multi-Media', desc: 'Add multiple photos & videos that transition during music' },
];

const PARTICLE_TYPES: { id: ParticleType; label: string; icon: React.ReactNode }[] = [
  { id: 'sparks', label: 'Sparks', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'embers', label: 'Embers', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'stars', label: 'Stars', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'dust', label: 'Dust Motes', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

export const BackgroundTab: React.FC<BackgroundTabProps> = ({
  bgConfig,
  particlesConfig,
  onBgChange,
  onParticlesChange,
  lyrics = [],
  duration = 180,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const [isBRollModalOpen, setIsBRollModalOpen] = useState<boolean>(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [isAiEffectModalOpen, setIsAiEffectModalOpen] = useState<boolean>(false);
  const [storedImages, setStoredImages] = useState<Array<{ url: string; name: string; mediaType?: 'image' | 'video' }>>([]);
  const [isExtractingZip, setIsExtractingZip] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; message: string }>({ percent: 0, message: '' });
  const [isClearMediaModalOpen, setIsClearMediaModalOpen] = useState<boolean>(false);
  const [clearOption, setClearOption] = useState<'all' | 'slideshow' | 'custom'>('all');
  const [includeBRollInClear, setIncludeBRollInClear] = useState<boolean>(false);
  const [confirmDeleteSlideshow, setConfirmDeleteSlideshow] = useState<boolean>(false);

  const slideshowCount = bgConfig.multiImageUrls?.length || bgConfig.multiImageSlides?.length || 0;
  const hasCustomMedia = Boolean(bgConfig.customImageUrl);
  const bRollCount = bgConfig.bRoll?.clips?.length || 0;
  const hasAnyBackgroundMedia = slideshowCount > 0 || hasCustomMedia || bRollCount > 0;

  const handleClearCustomMedia = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    updateBg({
      customImageUrl: '',
      customImageMediaType: undefined,
      customImageVisualEffect: 'none',
      type: bgConfig.type === 'custom_image' ? 'preset_nebula' : bgConfig.type,
    });
  };

  const handleClearSlideshowMedia = () => {
    if (multiFileInputRef.current) multiFileInputRef.current.value = '';
    if (zipFileInputRef.current) zipFileInputRef.current.value = '';
    setStoredImages([]);
    updateBg({
      multiImageUrls: [],
      multiImageSlides: [],
      type: bgConfig.type === 'multi_image' ? 'preset_nebula' : bgConfig.type,
    });
  };

  const handleRemoveSingleSlideMedia = (index: number) => {
    const targetUrl = bgConfig.multiImageUrls?.[index];
    const newUrls = (bgConfig.multiImageUrls || []).filter((_, i) => i !== index);
    const newSlides = (bgConfig.multiImageSlides || []).filter((s, i) => {
      if (targetUrl) return s.url !== targetUrl;
      return i !== index;
    });
    setStoredImages((prev) =>
      prev.filter((item, i) => {
        if (targetUrl) return item.url !== targetUrl;
        return i !== index;
      })
    );
    updateBg({
      multiImageUrls: newUrls,
      multiImageSlides: newSlides,
      type: newUrls.length === 0 && bgConfig.type === 'multi_image' ? 'preset_nebula' : bgConfig.type,
    });
  };

  const handleExecuteClearMedia = (target: 'all' | 'slideshow' | 'custom', clearBRoll: boolean) => {
    if (target === 'custom') {
      handleClearCustomMedia();
      setIsClearMediaModalOpen(false);
      return;
    }
    if (target === 'slideshow') {
      handleClearSlideshowMedia();
      setIsClearMediaModalOpen(false);
      return;
    }
    // 'all'
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (multiFileInputRef.current) multiFileInputRef.current.value = '';
    if (zipFileInputRef.current) zipFileInputRef.current.value = '';
    setStoredImages([]);

    const partial: Partial<BackgroundConfig> = {
      customImageUrl: '',
      customImageMediaType: undefined,
      customImageVisualEffect: 'none',
      multiImageUrls: [],
      multiImageSlides: [],
      videoFrameSequence: undefined,
      type: 'preset_nebula',
    };

    if (clearBRoll && bgConfig.bRoll) {
      partial.bRoll = {
        ...bgConfig.bRoll,
        clips: [],
      };
    }

    updateBg(partial);
    setIsClearMediaModalOpen(false);
  };

  const updateBg = (partial: Partial<BackgroundConfig>) => {
    onBgChange({ ...bgConfig, ...partial });
  };

  const updateParticles = (partial: Partial<ParticlesConfig>) => {
    onParticlesChange({ ...particlesConfig, ...partial });
  };

  const handleSelectStockForBackground = (item: StockMediaItem) => {
    registerMediaUrl(item.downloadUrl, item.type);
    updateBg({
      customImageUrl: item.downloadUrl,
      type: 'custom_image',
    });
    setIsStockModalOpen(false);
  };

  const handleSelectStockForSlide = (item: StockMediaItem) => {
    registerMediaUrl(item.downloadUrl, item.type);
    const existingSlides = bgConfig.multiImageSlides || [];
    const lastEnd = existingSlides.length > 0 ? existingSlides[existingSlides.length - 1].endSec : 0;
    const dur = item.duration && item.duration > 0 ? item.duration : 5;
    const newSlide: SlideItem = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: item.title,
      url: item.downloadUrl,
      mediaType: item.type,
      startSec: lastEnd,
      endSec: Math.min(duration, lastEnd + dur),
    };
    updateBg({
      type: 'multi_image',
      multiImageSlides: [...existingSlides, newSlide],
      multiImageUrls: [...(bgConfig.multiImageUrls || []), item.downloadUrl],
    });
  };

  const handleCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const mediaType = isVideoFile(file) ? 'video' : 'image';
      registerMediaUrl(url, mediaType);
      updateBg({ customImageUrl: url, customImageMediaType: mediaType, type: 'custom_image' });
    }
  };

  const processImageFiles = async (files: File[]) => {
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
      setZipProgress({ percent: 5, message: 'Membaca file zip...' });
    }

    try {
      const { mediaFiles } = await processFilesWithZipExtraction(files, (pct, msg) => {
        setZipProgress({ percent: pct, message: msg });
      });

      if (mediaFiles.length === 0) return;

      const newItems: Array<{ url: string; name: string; mediaType: 'image' | 'video' }> = mediaFiles.map((file) => {
        const url = URL.createObjectURL(file);
        const mediaType: 'image' | 'video' = isVideoFile(file) ? 'video' : 'image';
        registerMediaUrl(url, mediaType);
        return {
          url,
          name: file.name,
          mediaType,
        };
      });
      const updatedAllItems = [...storedImages, ...newItems];
      setStoredImages(updatedAllItems);
      const matched = heuristicMatchImagesToLyrics(updatedAllItems, lyrics || [], duration);
      const slidesWithMedia: SlideItem[] = matched.map((m) => {
        const found = updatedAllItems.find((item) => item.url === m.slide.url);
        return {
          ...m.slide,
          mediaType: found?.mediaType || getMediaUrlType(m.slide.url, m.slide.name),
        };
      });
      updateBg({
        type: 'multi_image',
        multiImageUrls: slidesWithMedia.map((s) => s.url),
        multiImageSlides: slidesWithMedia,
      });
    } catch (err) {
      console.error('ZIP extraction error:', err);
    } finally {
      if (hasZip) {
        setIsExtractingZip(false);
      }
    }
  };

  const handleMultiImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFiles(Array.from(e.target.files));
    }
    if (e.target) e.target.value = '';
  };

  const availableImagesForModal = useMemo(() => {
    if (bgConfig.multiImageSlides && bgConfig.multiImageSlides.length > 0) {
      return bgConfig.multiImageSlides.map((s) => ({ url: s.url, name: s.name || 'Foto' }));
    }
    if (bgConfig.multiImageUrls && bgConfig.multiImageUrls.length > 0) {
      return bgConfig.multiImageUrls.map((url, idx) => {
        const found = storedImages.find((item) => item.url === url);
        return { url, name: found?.name || `Foto_${idx + 1}.jpg` };
      });
    }
    return [];
  }, [bgConfig.multiImageSlides, bgConfig.multiImageUrls, storedImages]);

  const handleApplyAiSlides = (slides: SlideItem[]) => {
    updateBg({
      type: 'multi_image',
      multiImageUrls: slides.map((s) => s.url),
      multiImageSlides: slides
    });
  };

  return (
    <div className="space-y-6">
      {/* Menu Pembersihan / Hapus Media Background */}
      {hasAnyBackgroundMedia && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-red-950/30 border border-rose-500/35 flex items-center justify-between gap-3 shadow-lg shadow-rose-950/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                Media Background Aktif
              </span>
              <span className="text-[10px] text-rose-300 font-mono block truncate">
                {[
                  slideshowCount > 0 ? `${slideshowCount} media slideshow` : null,
                  hasCustomMedia ? '1 media kustom' : null,
                  bRollCount > 0 ? `${bRollCount} klip B-roll` : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setClearOption('all');
              setIsClearMediaModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/50 text-xs font-bold text-rose-200 hover:text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
            title="Buka menu untuk menghapus semua media di background"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Hapus Semua Media</span>
          </button>
        </div>
      )}

      {/* 1. Background Theme Selection */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5 text-cyan-400" />
          <span>Background Theme</span>
        </label>

        <div className="grid grid-cols-1 gap-2">
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateBg({ type: preset.id })}
              className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                bgConfig.type === preset.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-500/50 shadow-md'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div>
                <span className={`text-xs font-bold ${bgConfig.type === preset.id ? 'text-white' : 'text-slate-200'}`}>
                  {preset.label}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</p>
              </div>
              <div
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  bgConfig.type === preset.id ? 'border-cyan-400 bg-cyan-400/20' : 'border-slate-600'
                }`}
              >
                {bgConfig.type === preset.id && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Media Upload if selected */}
        {bgConfig.type === 'custom_image' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-cyan-500/30 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleCustomImage}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                onClick={() => setIsStockModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-xs font-semibold text-violet-300 flex items-center justify-center gap-1.5 transition-all"
                title="Cari video atau foto dari Pexels, Pixabay, dan koleksi bebas royalti"
              >
                <Film className="w-3.5 h-3.5 text-violet-400" />
                <span>🌐 Cari Stok Online</span>
              </button>
            </div>
            {bgConfig.customImageUrl && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10">
                <p className="text-[10px] text-emerald-400 flex items-center gap-1.5 truncate">
                  {isVideoMedia(bgConfig.customImageUrl) ? <Video className="w-3 h-3 text-cyan-400 shrink-0" /> : null}
                  <span className="truncate">✓ Custom {isVideoMedia(bgConfig.customImageUrl) ? 'video' : 'image'} aktif</span>
                </p>
                <button
                  type="button"
                  onClick={handleClearCustomMedia}
                  className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                  title="Hapus media kustom ini"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Media</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Multi-Image / Video Upload if selected */}
        {bgConfig.type === 'multi_image' && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-indigo-500/30 space-y-3">
            <input
              ref={multiFileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.zip,.zipx,application/zip,application/x-zip-compressed,multipart/x-zip,application/octet-stream,*/*"
              className="hidden"
              onChange={handleMultiImages}
            />
            <input
              ref={zipFileInputRef}
              type="file"
              accept=".zip,.zipx,application/zip,application/x-zip-compressed,multipart/x-zip,application/octet-stream,*/*"
              multiple
              className="hidden"
              onChange={handleMultiImages}
            />

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => multiFileInputRef.current?.click()}
                className="w-full py-2 px-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300 flex items-center justify-center gap-1 transition-all"
                title="Pilih beberapa file foto atau video langsung dari folder komputer"
              >
                <Upload className="w-3 h-3" />
                <span>Foto/Video</span>
              </button>
              <button
                onClick={() => zipFileInputRef.current?.click()}
                className="w-full py-2 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-semibold text-amber-300 flex items-center justify-center gap-1 transition-all"
                title="Upload arsip ZIP dan otomatis ekstrak semua foto dan video di dalamnya"
              >
                <FolderArchive className="w-3 h-3 text-amber-400" />
                <span>Upload ZIP</span>
              </button>
              <button
                onClick={() => setIsStockModalOpen(true)}
                className="w-full py-2 px-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-[11px] font-semibold text-violet-300 flex items-center justify-center gap-1 transition-all"
                title="Cari stok video atau foto dari Pexels, Pixabay, & Wikimedia"
              >
                <Film className="w-3 h-3 text-violet-400" />
                <span>🌐 Stok Online</span>
              </button>
            </div>

            {/* ZIP extraction progress indicator */}
            {isExtractingZip && (
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-1.5 animate-pulse">
                <div className="flex items-center justify-between text-[11px] text-amber-300 font-medium">
                  <span className="flex items-center gap-1.5">
                    <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mengekstrak file ZIP...</span>
                  </span>
                  <span>{zipProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full transition-all duration-200"
                    style={{ width: `${zipProgress.percent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 truncate">{zipProgress.message}</p>
              </div>
            )}
            
            {(bgConfig.multiImageUrls || []).length > 0 && (
              <div className="flex items-center justify-between pt-1 px-0.5 text-xs">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Koleksi Media ({bgConfig.multiImageUrls!.length} item)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDeleteSlideshow) {
                      handleClearSlideshowMedia();
                      setConfirmDeleteSlideshow(false);
                    } else {
                      setConfirmDeleteSlideshow(true);
                      setTimeout(() => setConfirmDeleteSlideshow(false), 4000);
                    }
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    confirmDeleteSlideshow
                      ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                      : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                  }`}
                  title="Hapus semua foto dan video dari slideshow ini"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{confirmDeleteSlideshow ? 'Yakin Hapus Semua? Klik Lagi' : 'Hapus Semua Media'}</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(bgConfig.multiImageUrls || []).map((url, i) => {
                const isVid = isVideoMedia(url);
                return (
                  <div
                    key={i}
                    className={`relative group w-12 h-12 rounded-md overflow-hidden border ${
                      isVid ? 'border-cyan-400/50 bg-black' : 'border-white/20'
                    }`}
                  >
                    {isVid ? (
                      <video src={url} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                    ) : (
                      <img src={url} alt={`bg-${i}`} className="w-full h-full object-cover pointer-events-none" />
                    )}
                    {isVid && (
                      <div className="absolute top-0.5 left-0.5 bg-black/75 px-1 py-0.5 rounded text-[8px] text-cyan-300 pointer-events-none flex items-center">
                        <Video className="w-2.5 h-2.5" />
                      </div>
                    )}
                    <button 
                      onClick={() => handleRemoveSingleSlideMedia(i)}
                      className="absolute inset-0 bg-rose-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                      title="Hapus media ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* AI Lyric Match Card */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>AI Pencocokan Lirik</span>
                </span>
                {bgConfig.multiImageSlides && bgConfig.multiImageSlides.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40">
                    {bgConfig.multiImageSlides.length} Slide Aktif
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                AI mencocokkan nama file gambar ke timestamp lirik lagu agar gambar berganti tepat waktu.
              </p>
              <button
                onClick={() => setShowAiModal(true)}
                disabled={(bgConfig.multiImageUrls || []).length === 0}
                className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>✨ Cocokkan Foto ke Lirik (AI)</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Ganti Tiap (Interval)</span>
                  <span className="text-indigo-400">{bgConfig.multiImageInterval || 5} detik</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={bgConfig.multiImageInterval || 5}
                  onChange={(e) => updateBg({ multiImageInterval: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Gaya Transisi Gambar
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'fade', label: '🌫️ Smooth Fade' },
                    { id: 'fade_black', label: '🎬 Dip Black' },
                    { id: 'zoom', label: '🔍 Zoom Push' },
                    { id: 'slide', label: '↔️ Slide' },
                    { id: 'cut', label: '✂️ Hard Cut' },
                  ].map((item) => {
                    const isSelected = (!bgConfig.multiImageTransition && item.id === 'fade') || bgConfig.multiImageTransition === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => updateBg({ multiImageTransition: item.id as any })}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border text-center transition-all ${
                          isSelected
                            ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200 shadow-sm ring-1 ring-indigo-400/30'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => updateBg({ multiImageKenBurns: bgConfig.multiImageKenBurns === false ? true : false })}
                className={`w-full py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  bgConfig.multiImageKenBurns !== false
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>Cinematic Ken Burns Effect</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Audio-Reactive Camera Shake & Bass Zoom */}
      <div className="space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-pink-400" />
            <span>Bass Reactive FX</span>
          </label>
          {(bgConfig.bassShake > 0 || bgConfig.bassZoom > 0) ? (
            <button
              type="button"
              onClick={() => updateBg({ bassShake: 0, bassZoom: 0 })}
              className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
              title="Set Camera Bass Shake dan Bass Zoom ke 0%"
            >
              Matikan Efek Beat (0%)
            </button>
          ) : (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
              ✓ Beat Mati (Statis)
            </span>
          )}
        </div>

        {/* Camera Shake */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Camera Bass Shake</span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {Math.round(bgConfig.bassShake * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={bgConfig.bassShake}
            onChange={(e) => updateBg({ bassShake: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Bass Zoom */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">Reactive Bass Zoom</span>
            <span className="font-mono text-cyan-400 text-[11px]">
              {Math.round(bgConfig.bassZoom * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={bgConfig.bassZoom}
            onChange={(e) => updateBg({ bassZoom: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Dimming & Vignette */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Dimming</span>
              <span className="font-mono text-cyan-400 text-[11px]">
                {Math.round(bgConfig.dimOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={bgConfig.dimOpacity}
              onChange={(e) => updateBg({ dimOpacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Vignette</span>
              <span className="font-mono text-cyan-400 text-[11px]">
                {Math.round(bgConfig.vignette * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.05"
              value={bgConfig.vignette}
              onChange={(e) => updateBg({ vignette: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* 2.5 B-Roll Quick Control Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-950/30 to-purple-950/20 border border-violet-500/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-violet-400" />
            <span>B-Roll Cutaways & PiP</span>
          </label>
          <button
            onClick={() =>
              updateBg({
                bRoll: {
                  enabled: bgConfig.bRoll?.enabled === false ? true : false,
                  clips: bgConfig.bRoll?.clips || [],
                  defaultDisplayMode: bgConfig.bRoll?.defaultDisplayMode || 'cutaway',
                  defaultPipPosition: bgConfig.bRoll?.defaultPipPosition || 'top_right',
                  globalOpacity: bgConfig.bRoll?.globalOpacity ?? 1,
                },
              })
            }
            className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
              bgConfig.bRoll?.enabled !== false && (bgConfig.bRoll?.clips || []).length > 0
                ? 'bg-violet-600'
                : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                bgConfig.bRoll?.enabled !== false && (bgConfig.bRoll?.clips || []).length > 0
                  ? 'translate-x-5'
                  : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          {(bgConfig.bRoll?.clips || []).length > 0
            ? `${bgConfig.bRoll?.clips.length} klip B-roll aktif di timeline (Cutaway, PiP, Blend).`
            : 'Sisipkan cuplikan video/foto sekunder atau picture-in-picture di timeline CapCut.'}
        </p>

        <button
          onClick={() => setIsBRollModalOpen(true)}
          className="w-full py-2 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-xs font-bold text-violet-200 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Film className="w-3.5 h-3.5" />
          <span>Buka Studio & Pustaka B-Roll</span>
        </button>
      </div>

      {/* 2.8 EFEK KAMERA VISUAL FRAME TERPILIH (Distorsi, Kamera Jadul, Cacing-cacing) */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/25 via-slate-900/50 to-orange-950/20 border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Efek Kamera Frame Terpilih</span>
          </label>
          <span className="text-[10px] text-amber-300/80 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
            Bukan Sepanjang Video
          </span>
        </div>
        <p className="text-[10.5px] text-slate-400 leading-relaxed">
          Pilih efek kamera visual yang hanya akan aktif saat frame/slide tertentu sedang tampil di layar:
        </p>

        {/* AI Recommendation Action Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiEffectModalOpen(true)}
            disabled={
              (!bgConfig.multiImageSlides || bgConfig.multiImageSlides.length === 0) &&
              !(bgConfig.type === 'custom_image' && bgConfig.customImageUrl)
            }
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-amber-600/20 hover:from-amber-500/35 hover:to-orange-500/35 border border-amber-500/40 text-xs font-bold text-amber-200 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            title="Buka AI Director untuk merekomendasikan dan memasang efek otomatis ke frame"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>✨ Rekomendasi Efek AI</span>
          </button>
          {((bgConfig.type === 'custom_image' && bgConfig.customImageVisualEffect && bgConfig.customImageVisualEffect !== 'none') ||
            (bgConfig.multiImageSlides && bgConfig.multiImageSlides.some((s) => s.visualEffect && s.visualEffect !== 'none'))) && (
            <button
              onClick={() => {
                if (bgConfig.type === 'custom_image') {
                  updateBg({ customImageVisualEffect: 'none' });
                } else {
                  const cleared = (bgConfig.multiImageSlides || []).map((s) => ({
                    ...s,
                    visualEffect: 'none' as VisualEffectType,
                  }));
                  updateBg({ multiImageSlides: cleared });
                }
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition-all text-xs"
              title="Reset semua efek frame ke normal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Visual Effect Selector for Custom Media (Video/Image) OR Multi-Image Slides */}
        {bgConfig.type === 'custom_image' && bgConfig.customImageUrl ? (
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0 truncate">
              {isVideoMedia(bgConfig.customImageUrl) ? (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-cyan-300" />
                </div>
              ) : (
                <img
                  src={bgConfig.customImageUrl}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover border border-white/15 shrink-0 bg-black"
                />
              )}
              <div className="truncate">
                <span className="font-bold text-white block truncate text-[11px]">
                  {isVideoMedia(bgConfig.customImageUrl) ? 'Background Video' : 'Background Image'}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  Efek Visual Aktif
                </span>
              </div>
            </div>

            <select
              value={bgConfig.customImageVisualEffect || 'none'}
              onChange={(e) => {
                updateBg({
                  customImageVisualEffect: e.target.value as VisualEffectType,
                  customImageVisualEffectIntensity: 0.8,
                });
              }}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer shrink-0 transition-all ${
                bgConfig.customImageVisualEffect && bgConfig.customImageVisualEffect !== 'none'
                  ? VISUAL_EFFECT_OPTIONS.find((o) => o.id === bgConfig.customImageVisualEffect)?.badgeClass || 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                  : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {VISUAL_EFFECT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                  {opt.icon} {opt.shortLabel}
                </option>
              ))}
            </select>
          </div>
        ) : bgConfig.type === 'multi_image' && bgConfig.multiImageSlides && bgConfig.multiImageSlides.length > 0 ? (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {bgConfig.multiImageSlides.map((slide, idx) => (
              <div
                key={slide.id || idx}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-all text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <img
                    src={slide.url}
                    alt=""
                    className="w-7 h-7 rounded-lg object-cover border border-white/15 shrink-0 bg-black"
                  />
                  <div className="truncate">
                    <span className="font-bold text-white block truncate text-[11px]">
                      #{idx + 1} {slide.name || `Foto ${idx + 1}`}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {slide.startSec}s - {slide.endSec}s
                    </span>
                  </div>
                </div>

                <select
                  value={slide.visualEffect || 'none'}
                  onChange={(e) => {
                    const updated = [...(bgConfig.multiImageSlides || [])];
                    updated[idx] = {
                      ...updated[idx],
                      visualEffect: e.target.value as VisualEffectType,
                    };
                    updateBg({ multiImageSlides: updated });
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer shrink-0 transition-all ${
                    slide.visualEffect && slide.visualEffect !== 'none'
                      ? VISUAL_EFFECT_OPTIONS.find((o) => o.id === slide.visualEffect)?.badgeClass || 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                      : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {VISUAL_EFFECT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                      {opt.icon} {opt.shortLabel}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-center space-y-2">
            <p className="text-[11px] text-slate-400">
              {bgConfig.type === 'multi_image'
                ? 'Klik "+ Foto" di Timeline untuk membuat slide, lalu pilih efek visual untuk tiap slide.'
                : 'Pilih foto atau video latar belakang untuk memasang efek kamera visual.'}
            </p>
          </div>
        )}
      </div>

      {/* 3. Floating Particles & Fireworks Engine */}
      <div className="space-y-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Particle FX & Sparks</span>
          </label>
          <button
            onClick={() => updateParticles({ enabled: !particlesConfig.enabled })}
            className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
              particlesConfig.enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                particlesConfig.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {particlesConfig.enabled && (
          <>
            {/* Particle Types */}
            <div className="grid grid-cols-4 gap-1.5">
              {PARTICLE_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => updateParticles({ type: pt.id })}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
                    particlesConfig.type === pt.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pt.icon}
                  <span>{pt.label}</span>
                </button>
              ))}
            </div>

            {/* Particle Count */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Particle Density</span>
                <span className="font-mono text-cyan-400 text-[11px]">{particlesConfig.count}</span>
              </div>
              <input
                type="range"
                min="20"
                max="180"
                step="5"
                value={particlesConfig.count}
                onChange={(e) => updateParticles({ count: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Particle Color & Reactive Explosions */}
            <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-white/10">
              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Color</span>
                <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <input
                    type="color"
                    value={particlesConfig.color}
                    onChange={(e) => updateParticles({ color: e.target.value })}
                    className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                    {particlesConfig.color}
                  </span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => updateParticles({ reactToBass: !particlesConfig.reactToBass })}
                  className={`w-full p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                    particlesConfig.reactToBass
                      ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Beat Explosions</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI Lyric Image Matcher Modal */}
      <AiLyricImageModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        images={availableImagesForModal}
        lyrics={lyrics}
        duration={duration}
        onApplySlides={handleApplyAiSlides}
      />

      {/* B-Roll Modal */}
      <BRollModal
        isOpen={isBRollModalOpen}
        onClose={() => setIsBRollModalOpen(false)}
        backgroundConfig={bgConfig}
        onBackgroundChange={onBgChange}
        currentTime={0}
        duration={duration}
        lyrics={lyrics}
      />

      {/* Stock Media Modal */}
      <StockMediaModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        onSelectForBackground={handleSelectStockForBackground}
        onSelectForSlide={handleSelectStockForSlide}
      />

      {/* AI Visual Effects Recommendation Modal */}
      <AiVisualEffectsModal
        isOpen={isAiEffectModalOpen}
        onClose={() => setIsAiEffectModalOpen(false)}
        slides={
          bgConfig.type === 'custom_image' && bgConfig.customImageUrl
            ? [
                {
                  id: 'bg-custom',
                  url: bgConfig.customImageUrl,
                  name: isVideoMedia(bgConfig.customImageUrl) ? 'Background Video' : 'Background Image',
                  startSec: 0,
                  endSec: duration || 180,
                  mediaType: isVideoMedia(bgConfig.customImageUrl) ? 'video' : 'image',
                  visualEffect: bgConfig.customImageVisualEffect || 'none',
                  visualEffectIntensity: bgConfig.customImageVisualEffectIntensity,
                },
              ]
            : bgConfig.multiImageSlides || []
        }
        lyrics={lyrics || []}
        duration={duration || 0}
        onApplyEffects={(updatedSlides) => {
          if (bgConfig.type === 'custom_image') {
            const firstActive = updatedSlides.find((s) => s.visualEffect && s.visualEffect !== 'none');
            updateBg({
              customImageVisualEffect: firstActive ? firstActive.visualEffect : 'none',
              customImageVisualEffectIntensity: firstActive ? firstActive.visualEffectIntensity : 0.8,
            });
          } else {
            updateBg({ multiImageSlides: updatedSlides });
          }
        }}
        onClearAllEffects={() => {
          if (bgConfig.type === 'custom_image') {
            updateBg({ customImageVisualEffect: 'none' });
          } else {
            const cleared = (bgConfig.multiImageSlides || []).map((s) => ({
              ...s,
              visualEffect: 'none' as VisualEffectType,
            }));
            updateBg({ multiImageSlides: cleared });
          }
        }}
      />

      {/* Modal Dialog: Hapus Media di Background */}
      {isClearMediaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d121f] border border-rose-500/40 rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Hapus Media di Background
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pilih media background yang ingin dibersihkan atau dikosongkan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearMediaModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Media Stats Card */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Media Terdeteksi Saat Ini:
              </span>
              <div className="flex flex-col gap-1.5 text-[11px] text-slate-300">
                {slideshowCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Slideshow Multi-Media:</span>
                    </span>
                    <span className="font-mono text-cyan-300 font-bold">{slideshowCount} item</span>
                  </div>
                )}
                {hasCustomMedia && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Media Kustom:</span>
                    </span>
                    <span className="font-mono text-emerald-300 font-bold">1 file wallpaper/video</span>
                  </div>
                )}
                {bRollCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-violet-400" />
                      <span>Klip B-Roll:</span>
                    </span>
                    <span className="font-mono text-violet-300 font-bold">{bRollCount} klip timeline</span>
                  </div>
                )}
                {slideshowCount === 0 && !hasCustomMedia && bRollCount === 0 && (
                  <p className="text-slate-400 text-[11px] py-1">Tidak ada media kustom yang aktif.</p>
                )}
              </div>
            </div>

            {/* Options Selector */}
            <div className="space-y-2 text-xs">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Pilih Aksi Pembersihan:
              </label>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setClearOption('all')}
                  className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    clearOption === 'all'
                      ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-sm ring-1 ring-rose-500/30'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      clearOption === 'all' ? 'border-rose-400 bg-rose-400/20' : 'border-slate-600'
                    }`}
                  >
                    {clearOption === 'all' && <div className="w-2 h-2 rounded-full bg-rose-400" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block">
                      Hapus Semua Media & Reset ke Nebula (Direkomendasikan)
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block leading-relaxed">
                      Membersihkan seluruh foto slideshow dan media kustom, serta mengembalikan visualizer ke background Nebula yang bersih.
                    </span>
                  </div>
                </button>

                {slideshowCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setClearOption('slideshow')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      clearOption === 'slideshow'
                        ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-sm ring-1 ring-rose-500/30'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        clearOption === 'slideshow' ? 'border-rose-400 bg-rose-400/20' : 'border-slate-600'
                      }`}
                    >
                      {clearOption === 'slideshow' && <div className="w-2 h-2 rounded-full bg-rose-400" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold block">
                        Hapus Media Slideshow Saja ({slideshowCount} Item)
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Hanya mengosongkan slide foto dan video tanpa mengubah media kustom.
                      </span>
                    </div>
                  </button>
                )}

                {hasCustomMedia && (
                  <button
                    type="button"
                    onClick={() => setClearOption('custom')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      clearOption === 'custom'
                        ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-sm ring-1 ring-rose-500/30'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        clearOption === 'custom' ? 'border-rose-400 bg-rose-400/20' : 'border-slate-600'
                      }`}
                    >
                      {clearOption === 'custom' && <div className="w-2 h-2 rounded-full bg-rose-400" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold block">
                        Hapus Media Kustom Saja (1 File)
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Hanya menghapus wallpaper/video kustom.
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Checkbox B-Roll */}
            {bRollCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                <input
                  type="checkbox"
                  checked={includeBRollInClear}
                  onChange={(e) => setIncludeBRollInClear(e.target.checked)}
                  className="rounded border-white/20 text-rose-500 focus:ring-rose-500 bg-black/60 cursor-pointer"
                />
                <span>Sertakan juga menghapus {bRollCount} klip B-Roll di timeline</span>
              </label>
            )}

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsClearMediaModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleExecuteClearMedia(clearOption, includeBRollInClear)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/40 transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Konfirmasi Hapus Media</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
