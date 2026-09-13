import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Key,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Check,
  Plus,
  Tv,
  Maximize2,
  Columns,
  Flame,
  X,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  searchUnifiedStockMedia,
  getPexelsApiKey,
  setPexelsApiKey,
  getPixabayApiKey,
  setPixabayApiKey,
  type StockMediaItem,
  type StockProvider,
  type StockMediaType,
  type StockOrientation,
} from '../utils/stockMediaService';
import type { BRollDisplayMode } from '../types/visualizer';

interface StockMediaBrowserProps {
  onSelectForBRoll?: (item: StockMediaItem, mode: BRollDisplayMode) => void;
  onSelectForBackground?: (item: StockMediaItem) => void;
  onSelectForSlide?: (item: StockMediaItem) => void;
  onClose?: () => void;
  compact?: boolean;
}

const QUICK_TAGS = [
  'Semua',
  'Cyberpunk',
  'Rain',
  'Concert',
  'Sunset',
  'Laser',
  'Smoke',
  'Lo-Fi',
  'Nebula',
  'Night City',
  'Waves',
  'Particles',
  'Fire',
];

export const StockMediaBrowser: React.FC<StockMediaBrowserProps> = ({
  onSelectForBRoll,
  onSelectForBackground,
  onSelectForSlide,
  onClose,
  compact = false,
}) => {
  const [query, setQuery] = useState<string>('');
  const [activeTag, setActiveTag] = useState<string>('Semua');
  const [provider, setProvider] = useState<StockProvider>('all');
  const [mediaType, setMediaType] = useState<StockMediaType>('all');
  const [orientation, setOrientation] = useState<StockOrientation>('all');

  const [items, setItems] = useState<StockMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<StockMediaItem | null>(null);

  // API Key Settings Modal
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [pexelsKey, setPexelsKeyInput] = useState<string>(() => getPexelsApiKey());
  const [pixabayKey, setPixabayKeyInput] = useState<string>(() => getPixabayApiKey());
  const [keySavedMessage, setKeySavedMessage] = useState<boolean>(false);

  // Provider Notice for missing keys
  const [providerNotice, setProviderNotice] = useState<{
    pexelsNeedsKey?: boolean;
    pixabayNeedsKey?: boolean;
  }>({});

  const debounceTimerRef = useRef<any>(null);

  const fetchMedia = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const q = searchQuery === 'Semua' ? '' : searchQuery;
      const res = await searchUnifiedStockMedia({
        query: q,
        provider,
        mediaType,
        orientation,
        page: 1,
        perPage: 24,
      });
      setItems(res.items);
      setProviderNotice(res.providerNotice || {});
    } catch (err) {
      console.error('Failed to search stock media:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load or filter change
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const currentQuery = query.trim() || (activeTag !== 'Semua' ? activeTag : '');
      fetchMedia(currentQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, activeTag, provider, mediaType, orientation]);

  const handleSaveKeys = () => {
    setPexelsApiKey(pexelsKey);
    setPixabayApiKey(pixabayKey);
    setKeySavedMessage(true);
    setTimeout(() => {
      setKeySavedMessage(false);
      setShowKeyModal(false);
      // Re-trigger search with updated keys
      const currentQuery = query.trim() || (activeTag !== 'Semua' ? activeTag : '');
      fetchMedia(currentQuery);
    }, 1000);
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    if (tag === 'Semua') {
      setQuery('');
    } else {
      setQuery(tag);
    }
  };

  const hasPexelsKey = Boolean(getPexelsApiKey());
  const hasPixabayKey = Boolean(getPixabayApiKey());

  return (
    <div className={`flex flex-col h-full bg-neutral-900 text-white ${compact ? 'p-2' : 'p-4'} rounded-xl`}>
      {/* Top Header & Search Controls */}
      <div className="flex flex-col gap-3 pb-3 border-b border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-violet-400" />
            <h3 className="text-base font-semibold text-neutral-100">
              Pustaka Stok Video & Foto Bebas Royalti
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Pexels • Pixabay • Wikimedia • Curated
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition"
              title="Atur Kunci API Pexels & Pixabay"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Pengaturan API</span>
              {(hasPexelsKey || hasPixabayKey) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar + Provider & Type Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveTag('');
              }}
              placeholder="Cari video atau foto (contoh: neon city, rain, concert, sunset, smoke)..."
              className="w-full pl-9 pr-8 py-2 bg-neutral-950 border border-neutral-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 outline-none transition"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setActiveTag('Semua');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Provider Select */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as StockProvider)}
            className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 outline-none focus:border-violet-500 transition"
          >
            <option value="all">🌟 Semua Sumber</option>
            <option value="pexels">🎬 Pexels HD</option>
            <option value="pixabay">🎨 Pixabay</option>
            <option value="wikimedia">🏛️ Wikimedia Commons</option>
            <option value="curated">⚡ Bebas Lisensi (Tanpa API Key)</option>
          </select>

          {/* Media Type Select */}
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as StockMediaType)}
            className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 outline-none focus:border-violet-500 transition"
          >
            <option value="all">🎬 & 📷 Semua Media</option>
            <option value="video">🎥 Video Sahaja</option>
            <option value="image">📷 Foto / Gambar</option>
          </select>

          {/* Orientation */}
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as StockOrientation)}
            className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 outline-none focus:border-violet-500 transition"
          >
            <option value="all">📐 Semua Orientasi</option>
            <option value="landscape">Horizontal (16:9)</option>
            <option value="portrait">Vertikal (9:16)</option>
            <option value="square">Persegi (1:1)</option>
          </select>

          <button
            onClick={() => fetchMedia(query || activeTag)}
            disabled={isLoading}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition"
            title="Refresh pencarian"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
          </button>
        </div>

        {/* Quick Tag Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-neutral-800">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition ${
                activeTag === tag
                  ? 'bg-violet-600 text-white font-medium shadow-sm'
                  : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              {tag === 'Semua' ? '🔥 Populer / Pilihan' : `#${tag}`}
            </button>
          ))}
        </div>

        {/* Missing API Key Notice */}
        {(providerNotice.pexelsNeedsKey || providerNotice.pixabayNeedsKey) && (
          <div className="flex items-center justify-between p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {providerNotice.pexelsNeedsKey && providerNotice.pixabayNeedsKey
                  ? 'Kunci API Pexels dan Pixabay belum diisi. Hasil saat ini menampilkan koleksi video loop langsung & Wikimedia.'
                  : providerNotice.pexelsNeedsKey
                  ? 'Kunci API Pexels belum diisi untuk mencari jutaan video HD Pexels.'
                  : 'Kunci API Pixabay belum diisi untuk mencari katalog Pixabay.'}
              </span>
            </div>
            <button
              onClick={() => setShowKeyModal(true)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded text-xs shrink-0 transition"
            >
              Masukkan Kunci API
            </button>
          </div>
        )}
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto pt-3 pr-1 min-h-[360px] max-h-[620px]">
        {isLoading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <p className="text-sm">Mencari stok video dan foto terbaik...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-400 gap-3">
            <Film className="w-10 h-10 text-neutral-600" />
            <p className="text-sm font-medium text-neutral-300">Tidak ada media yang ditemukan</p>
            <p className="text-xs text-neutral-500 text-center max-w-sm">
              Coba gunakan kata kunci dalam Bahasa Inggris (misal: "nature", "rain", "abstract", "concert") atau ganti provider.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setActiveTag('Semua');
                setProvider('all');
                setMediaType('all');
              }}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 rounded-lg transition"
            >
              Kembali ke Koleksi Pilihan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {items.map((item) => {
              const isHovered = hoveredItemId === item.id;
              const isVideo = item.type === 'video';

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  className="group relative flex flex-col bg-neutral-950 border border-neutral-800 hover:border-violet-500/60 rounded-xl overflow-hidden shadow-md transition duration-200"
                >
                  {/* Thumbnail / Video Preview Area */}
                  <div className="relative aspect-video w-full bg-neutral-900 overflow-hidden">
                    {isVideo && isHovered ? (
                      <video
                        src={item.previewUrl || item.downloadUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.thumbnail || item.previewUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    )}

                    {/* Source & Type Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                          item.source === 'pexels'
                            ? 'bg-emerald-600 text-white'
                            : item.source === 'pixabay'
                            ? 'bg-blue-600 text-white'
                            : item.source === 'wikimedia'
                            ? 'bg-amber-600 text-white'
                            : 'bg-violet-600 text-white'
                        }`}
                      >
                        {item.source}
                      </span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-black/60 backdrop-blur-sm text-neutral-200 rounded">
                        {isVideo ? <Film className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
                        {isVideo ? (item.duration ? `${Math.round(item.duration)}s` : 'Video') : 'Foto'}
                      </span>
                    </div>

                    {/* Preview Fullscreen button */}
                    <button
                      onClick={() => setPreviewModalItem(item)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                      title="Lihat Pratinjau Layar Penuh"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Hover Overlay Action Bar */}
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col gap-1.5 justify-end">
                      {onSelectForBRoll && (
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            onClick={() => onSelectForBRoll(item, 'cutaway')}
                            className="flex items-center justify-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium rounded transition"
                            title="Tambah sebagai Cutaway Layar Penuh"
                          >
                            <Maximize2 className="w-2.5 h-2.5" />
                            <span>Cutaway</span>
                          </button>
                          <button
                            onClick={() => onSelectForBRoll(item, 'pip')}
                            className="flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium rounded transition"
                            title="Tambah sebagai Picture-in-Picture (PiP)"
                          >
                            <Tv className="w-2.5 h-2.5" />
                            <span>PiP</span>
                          </button>
                          <button
                            onClick={() => onSelectForBRoll(item, 'split_screen')}
                            className="flex items-center justify-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-medium rounded transition"
                            title="Tambah sebagai Split Screen 50/50"
                          >
                            <Columns className="w-2.5 h-2.5" />
                            <span>Split</span>
                          </button>
                          <button
                            onClick={() => onSelectForBRoll(item, 'blend_overlay')}
                            className="flex items-center justify-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium rounded transition"
                            title="Tambah sebagai Blend Overlay"
                          >
                            <Flame className="w-2.5 h-2.5" />
                            <span>Blend</span>
                          </button>
                        </div>
                      )}

                      {onSelectForBackground && (
                        <button
                          onClick={() => onSelectForBackground(item)}
                          className="flex items-center justify-center gap-1.5 w-full py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium rounded border border-neutral-700 transition"
                        >
                          <ImageIcon className="w-3 h-3 text-pink-400" />
                          <span>Jadikan Background Utama</span>
                        </button>
                      )}

                      {onSelectForSlide && (
                        <button
                          onClick={() => onSelectForSlide(item)}
                          className="flex items-center justify-center gap-1.5 w-full py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium rounded border border-neutral-700 transition"
                        >
                          <Plus className="w-3 h-3 text-cyan-400" />
                          <span>Tambah ke Storyboard</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Info Footer */}
                  <div className="p-2.5 flex flex-col gap-1">
                    <p className="text-xs font-medium text-neutral-200 truncate" title={item.title}>
                      {item.title}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="truncate max-w-[130px]">
                        Oleh: {item.author || 'Pencipta Bebas'}
                      </span>
                      {item.width && item.height && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {item.width}x{item.height}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Preview Modal */}
      {previewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="relative flex flex-col w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-bold uppercase rounded ${
                    previewModalItem.source === 'pexels'
                      ? 'bg-emerald-600 text-white'
                      : previewModalItem.source === 'pixabay'
                      ? 'bg-blue-600 text-white'
                      : previewModalItem.source === 'wikimedia'
                      ? 'bg-amber-600 text-white'
                      : 'bg-violet-600 text-white'
                  }`}
                >
                  {previewModalItem.source}
                </span>
                <h4 className="text-sm font-semibold text-neutral-100 truncate max-w-md">
                  {previewModalItem.title}
                </h4>
              </div>
              <button
                onClick={() => setPreviewModalItem(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media View */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {previewModalItem.type === 'video' ? (
                <video
                  src={previewModalItem.downloadUrl || previewModalItem.previewUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewModalItem.downloadUrl || previewModalItem.previewUrl}
                  alt={previewModalItem.title}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Footer Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-neutral-950 border-t border-neutral-800">
              <div className="text-xs text-neutral-400">
                <span>Kreator: </span>
                <span className="text-neutral-200 font-medium">
                  {previewModalItem.author || 'Bebas Lisensi'}
                </span>
                {previewModalItem.duration && (
                  <span className="ml-2 font-mono text-neutral-500">
                    Durasi: {Math.round(previewModalItem.duration)}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onSelectForBRoll && (
                  <>
                    <button
                      onClick={() => {
                        onSelectForBRoll(previewModalItem, 'cutaway');
                        setPreviewModalItem(null);
                      }}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition"
                    >
                      + B-Roll (Cutaway)
                    </button>
                    <button
                      onClick={() => {
                        onSelectForBRoll(previewModalItem, 'pip');
                        setPreviewModalItem(null);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition"
                    >
                      + B-Roll (PiP)
                    </button>
                  </>
                )}

                {onSelectForBackground && (
                  <button
                    onClick={() => {
                      onSelectForBackground(previewModalItem);
                      setPreviewModalItem(null);
                    }}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700 transition"
                  >
                    Jadikan Background Utama
                  </button>
                )}

                {onSelectForSlide && (
                  <button
                    onClick={() => {
                      onSelectForSlide(previewModalItem);
                      setPreviewModalItem(null);
                    }}
                    className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition"
                  >
                    Tambah ke Storyboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Settings Dialog */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-semibold text-neutral-100">
                  Pengaturan Kunci API Stok Media
                </h4>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Dapatkan akses ke jutaan stok video HD dan foto bebas royalti langsung dari Pexels & Pixabay. Kunci API tersimpan aman di peramban Anda.
            </p>

            {/* Pexels API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Pexels API Key
                </label>
                <a
                  href="https://www.pexels.com/api/new/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline"
                >
                  Dapatkan Kunci Gratis
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={pexelsKey}
                onChange={(e) => setPexelsKeyInput(e.target.value)}
                placeholder="Masukkan Pexels API Key..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
            </div>

            {/* Pixabay API Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Pixabay API Key
                </label>
                <a
                  href="https://pixabay.com/api/docs/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 underline"
                >
                  Dapatkan Kunci Gratis
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={pixabayKey}
                onChange={(e) => setPixabayKeyInput(e.target.value)}
                placeholder="Masukkan Pixabay API Key..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
              />
            </div>

            {keySavedMessage && (
              <div className="flex items-center gap-2 p-2 bg-emerald-950/60 border border-emerald-700/60 rounded-lg text-xs text-emerald-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Kunci API berhasil disimpan! Menyegarkan pencarian...</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveKeys}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
              >
                Simpan Kunci API
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
