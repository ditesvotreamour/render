import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Music2,
  Scissors,
  Play,
  Download,
  Trash2,
  Upload,
  Clock,
  Sparkles,
  CheckCircle2,
  FileAudio,
  Search,
  FolderOpen,
} from 'lucide-react';
import type { AudioTrack } from '../types/visualizer';
import {
  getAllTracksFromLibrary,
  deleteTrackFromLibrary,
  type StoredTrackItem,
} from '../utils/idb';
import { SAMPLE_TRACKS } from '../data/sampleTracks';

interface TrackLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrack;
  onSelectStoredTrack: (item: StoredTrackItem) => Promise<void>;
  onSelectSampleTrack: (track: AudioTrack) => void;
  onUploadNewAudio: (file: File) => void;
}

type LibraryTab = 'all' | 'cuts' | 'uploads' | 'samples';

export const TrackLibraryModal: React.FC<TrackLibraryModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  onSelectStoredTrack,
  onSelectSampleTrack,
  onUploadNewAudio,
}) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storedTracks, setStoredTracks] = useState<StoredTrackItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const items = await getAllTracksFromLibrary();
      setStoredTracks(items);
    } catch (err) {
      console.error('Failed to load track library:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLibrary();
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleActivateStoredTrack = async (item: StoredTrackItem) => {
    try {
      await onSelectStoredTrack(item);
      setActionSuccessMsg(`Lagu "${item.title}" berhasil diaktifkan!`);
      setTimeout(() => {
        setActionSuccessMsg(null);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to activate track:', err);
    }
  };

  const handleActivateSampleTrack = (track: AudioTrack) => {
    onSelectSampleTrack(track);
    setActionSuccessMsg(`Sample "${track.title}" berhasil diaktifkan!`);
    setTimeout(() => {
      setActionSuccessMsg(null);
      onClose();
    }, 700);
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Hapus "${title}" dari daftar riwayat lagu tersimpan?`)) {
      await deleteTrackFromLibrary(id);
      setStoredTracks((prev) => prev.filter((t) => t.id !== id));
      setActionSuccessMsg(`"${title}" dihapus dari pustaka.`);
      setTimeout(() => setActionSuccessMsg(null), 2500);
    }
  };

  const handleDownloadItemWav = (e: React.MouseEvent, item: StoredTrackItem) => {
    e.stopPropagation();
    try {
      const url = URL.createObjectURL(item.file);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (item.title || 'audio_track').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeName}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setActionSuccessMsg(`File audio "${item.title}" berhasil diunduh.`);
      setTimeout(() => setActionSuccessMsg(null), 2500);
    } catch (err) {
      console.error('Download audio failed:', err);
    }
  };

  const formatSec = (sec: number) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter items
  const query = searchQuery.toLowerCase().trim();

  const filteredStored = storedTracks.filter((t) => {
    const matchSearch =
      t.title.toLowerCase().includes(query) || (t.artist && t.artist.toLowerCase().includes(query));
    if (!matchSearch) return false;
    if (activeTab === 'cuts') return t.isCut === true;
    if (activeTab === 'uploads') return !t.isCut;
    return true; // 'all'
  });

  const filteredSamples = (activeTab === 'all' || activeTab === 'samples')
    ? SAMPLE_TRACKS.filter(
        (t) => t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query)
      )
    : [];

  const cutCount = storedTracks.filter((t) => t.isCut).length;
  const uploadCount = storedTracks.filter((t) => !t.isCut).length;
  const sampleCount = SAMPLE_TRACKS.length;
  const allCount = storedTracks.length + sampleCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-white/20 rounded-3xl w-full max-w-3xl h-[90dvh] max-h-[90dvh] shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-pink-500 text-white shadow-md">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Pustaka & Riwayat Lagu</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {allCount} Trek
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Pilih dan buka kembali lagu utuh, potongan timeline, dan subtitle yang tersimpan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Lagu</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onUploadNewAudio(e.target.files[0]);
              onClose();
            }
          }}
        />

        {/* Toolbar (Search & Filter Tabs) */}
        <div className="p-3 sm:px-6 border-b border-white/10 bg-black/20 space-y-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul lagu, potongan, atau nama artis..."
              className="w-full pl-9 pr-4 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {[
              { id: 'all', label: `Semua (${allCount})` },
              { id: 'cuts', label: `✂️ Potongan (${cutCount})` },
              { id: 'uploads', label: `🎵 Lagu Kustom (${uploadCount})` },
              { id: 'samples', label: `✨ Sample Bawaan (${sampleCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as LibraryTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toast Notification Banner */}
        {actionSuccessMsg && (
          <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* List of Tracks */}
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-2.5 scrollbar-thin">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Music2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2 opacity-50" />
              <span>Memuat pustaka lagu tersimpan...</span>
            </div>
          ) : filteredStored.length === 0 && filteredSamples.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                <FileAudio className="w-8 h-8" />
              </div>
              <div>
                <p className="font-bold text-slate-200 text-sm">Tidak ada lagu yang cocok</p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchQuery
                    ? `Tidak ditemukan trek dengan kata kunci "${searchQuery}".`
                    : 'Belum ada potongan atau lagu kustom yang tersimpan di tab ini.'}
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold inline-flex items-center gap-1.5 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File Audio Baru</span>
              </button>
            </div>
          ) : (
            <>
              {/* Stored Custom Tracks and Cuts */}
              {filteredStored.map((item) => {
                const isActive =
                  currentTrack.isCustom &&
                  (currentTrack.title === item.title ||
                    currentTrack.title.replace(/_[0-9]+$/, '') === item.title.replace(/_[0-9]+$/, ''));
                const hasLyrics = item.lyrics && item.lyrics.length > 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleActivateStoredTrack(item)}
                    className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-cyan-950/30 border-cyan-400/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400/40'
                        : 'bg-black/40 hover:bg-white/[0.04] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                          item.isCut
                            ? 'bg-gradient-to-tr from-pink-500 to-rose-600 text-white'
                            : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white'
                        }`}
                      >
                        {item.isCut ? (
                          <Scissors className="w-5 h-5" />
                        ) : (
                          <Music2 className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-xs sm:text-sm truncate group-hover:text-cyan-300 transition-colors">
                            {item.title}
                          </h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                              🟢 Sedang Aktif
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 ${
                              item.isCut
                                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {item.isCut ? 'Potongan Timeline' : 'Lagu Utuh'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-mono text-slate-300">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatSec(item.duration)}</span>
                          </span>
                          <span>•</span>
                          <span>{item.artist || 'Custom Track'}</span>
                          <span>•</span>
                          <span>{formatDate(item.createdAt)}</span>
                          {hasLyrics && (
                            <>
                              <span>•</span>
                              <span className="text-amber-300/90 font-medium">
                                📝 {item.lyrics?.length} baris lirik tersinkron
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={(e) => handleDownloadItemWav(e, item)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                        title="Download file audio potongan (.WAV)"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteItem(e, item.id, item.title)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors"
                        title="Hapus dari riwayat lagu tersimpan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleActivateStoredTrack(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                          isActive
                            ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20 active:scale-95'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isActive ? 'Aktif' : 'Buka Lagu'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Sample Tracks Section (if in 'all' or 'samples') */}
              {filteredSamples.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lagu Sampel Bawaan Specterr</span>
                  </div>

                  {filteredSamples.map((track) => {
                    const isActive = !currentTrack.isCustom && currentTrack.id === track.id;

                    return (
                      <div
                        key={track.id}
                        onClick={() => handleActivateSampleTrack(track)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-indigo-950/30 border-indigo-400/60 shadow-md ring-1 ring-indigo-400/40'
                            : 'bg-black/30 hover:bg-white/[0.03] border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={track.coverArt}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-white/10"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-xs sm:text-sm truncate group-hover:text-indigo-300 transition-colors">
                                {track.title}
                              </h4>
                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                                  🟢 Aktif
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
                              {track.artist} • {track.genre}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleActivateSampleTrack(track)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                            isActive
                              ? 'bg-white/10 text-slate-300'
                              : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isActive ? 'Aktif' : 'Pilih'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-black/30 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Semua lagu & potongan otomatis tersimpan di memori browser (IndexedDB).</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
