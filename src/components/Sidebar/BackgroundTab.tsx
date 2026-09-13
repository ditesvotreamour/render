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
      updateBg({ customImageUrl: url, type: 'custom_image' });
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
              <p className="text-[10px] text-emerald-400 text-center flex items-center justify-center gap-1">
                {isVideoMedia(bgConfig.customImageUrl) ? <Video className="w-3 h-3 text-cyan-400" /> : null}
                <span>✓ Custom {isVideoMedia(bgConfig.customImageUrl) ? 'video' : 'image'} loaded</span>
              </p>
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
                      onClick={() => {
                        const newUrls = [...(bgConfig.multiImageUrls || [])];
                        newUrls.splice(i, 1);
                        updateBg({ multiImageUrls: newUrls });
                      }}
                      className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                    >
                      X
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
            disabled={!bgConfig.multiImageSlides || bgConfig.multiImageSlides.length === 0}
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-amber-600/20 hover:from-amber-500/35 hover:to-orange-500/35 border border-amber-500/40 text-xs font-bold text-amber-200 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            title="Buka AI Director untuk merekomendasikan dan memasang efek otomatis ke frame"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>✨ Rekomendasi Efek AI</span>
          </button>
          {bgConfig.multiImageSlides && bgConfig.multiImageSlides.some((s) => s.visualEffect && s.visualEffect !== 'none') && (
            <button
              onClick={() => {
                const cleared = (bgConfig.multiImageSlides || []).map((s) => ({
                  ...s,
                  visualEffect: 'none' as VisualEffectType,
                }));
                updateBg({ multiImageSlides: cleared });
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition-all text-xs"
              title="Reset semua efek frame ke normal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Multi-Image Slides List with Effect Selectors */}
        {bgConfig.type === 'multi_image' && bgConfig.multiImageSlides && bgConfig.multiImageSlides.length > 0 ? (
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
                : 'Efek kamera frame juga dapat dipasang langsung pada Timeline di posisi jarum playhead.'}
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
        slides={bgConfig.multiImageSlides || []}
        lyrics={lyrics || []}
        duration={duration || 0}
        onApplyEffects={(updatedSlides) => {
          updateBg({ multiImageSlides: updatedSlides });
        }}
        onClearAllEffects={() => {
          const cleared = (bgConfig.multiImageSlides || []).map((s) => ({
            ...s,
            visualEffect: 'none' as VisualEffectType,
          }));
          updateBg({ multiImageSlides: cleared });
        }}
      />
    </div>
  );
};
