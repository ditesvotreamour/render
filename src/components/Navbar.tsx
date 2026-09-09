import React, { useRef } from 'react';
import {
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  Monitor,
  Smartphone,
  Square,
  Music2,
  Tv,
  Save,
  FolderOpen,
  SlidersHorizontal,
  Check,
  ChevronDown,
} from 'lucide-react';
import type { AspectRatio, PreviewResolution } from '../types/visualizer';
import { PREVIEW_RESOLUTIONS } from '../types/visualizer';

interface NavbarProps {
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  previewResolution?: PreviewResolution;
  onPreviewResolutionChange?: (res: PreviewResolution) => void;
  onOpenPresets: () => void;
  onOpenExport: () => void;
  onUploadAudio: (file: File) => void;
  onReset: () => void;
  onSaveProject?: () => void;
  onOpenLibrary?: () => void;
  trackTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  aspectRatio,
  onAspectRatioChange,
  previewResolution = '720p',
  onPreviewResolutionChange,
  onOpenPresets,
  onOpenExport,
  onUploadAudio,
  onReset,
  onSaveProject,
  onOpenLibrary,
  trackTitle,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadAudio(e.target.files[0]);
    }
  };

  const [showAspectMenu, setShowAspectMenu] = React.useState(false);
  const [showResolutionMenu, setShowResolutionMenu] = React.useState(false);

  return (
    <header className="h-14 sm:h-16 border-b border-white/10 bg-[#0A0D14]/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30 sticky top-0 shrink-0">
      {/* Left: Brand & Track */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 cursor-pointer group shrink-0" onClick={onOpenPresets}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0A0D14] rounded-[10px] flex items-center justify-center">
              <Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div
            className="hidden sm:block cursor-pointer group"
            onClick={onOpenLibrary || onOpenPresets}
            title="Klik untuk membuka Pustaka & Riwayat Lagu"
          >
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 font-['Orbitron']">
                SPECTERR
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-xs group-hover:text-cyan-300 transition-colors flex items-center gap-1">
              <span className="truncate">{trackTitle || 'No Track Selected'}</span>
              <FolderOpen className="w-2.5 h-2.5 text-cyan-400/70 shrink-0" />
            </p>
          </div>
        </div>

        {/* Presets Button */}
        <button
          onClick={onOpenPresets}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] sm:text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
        >
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span className="hidden xs:inline">Presets</span>
        </button>

        {/* Track Library Button */}
        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] sm:text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-all shadow-sm shrink-0"
            title="Buka Pustaka & Riwayat Lagu/Potongan Tersimpan"
          >
            <FolderOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Pustaka Lagu</span>
            <span className="sm:hidden">Pustaka</span>
          </button>
        )}

        {/* Mobile Aspect Ratio Dropdown Button */}
        <div className="relative lg:hidden">
          <button
            onClick={() => setShowAspectMenu(!showAspectMenu)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-[11px] font-mono text-cyan-300"
            title="Switch Aspect Ratio"
          >
            {aspectRatio === '9:16' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
            <span>{aspectRatio}</span>
          </button>

          {showAspectMenu && (
            <div className="absolute top-full mt-2 left-0 w-32 bg-[#0E131F] border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onAspectRatioChange(r);
                    setShowAspectMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    aspectRatio === r ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{r}</span>
                  {r === '9:16' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Mobile Preview Resolution Button */}
        <div className="relative md:hidden">
          <button
            onClick={() => setShowResolutionMenu(!showResolutionMenu)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-mono font-bold transition-colors ${
              previewResolution === '360p'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : previewResolution === '480p'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : previewResolution === '720p'
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
            }`}
            title="Ubah Resolusi Preview"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{previewResolution}</span>
          </button>
        </div>
      </div>

      {/* Desktop Center: Aspect Ratio & Preview Resolution Controls */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Aspect Ratio Switcher */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
          {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map((r) => (
            <button
              key={r}
              onClick={() => onAspectRatioChange(r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                aspectRatio === r
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {r === '9:16' ? <Smartphone className="w-3.5 h-3.5" /> : r === '1:1' ? <Square className="w-3.5 h-3.5" /> : r === '4:5' ? <Tv className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              <span>{r}</span>
            </button>
          ))}
        </div>

        {/* Preview Resolution Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowResolutionMenu(!showResolutionMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
              previewResolution === '360p'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                : previewResolution === '480p'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                : previewResolution === '720p'
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25'
            }`}
            title="Turunkan resolusi canvas preview agar pemutaran lebih lancar & anti-lag. Hasil export video tetap 1080p / 4K jernih."
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-mono">
              Preview: <strong className="font-bold">{previewResolution}</strong>
            </span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showResolutionMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Shared Resolution Dropdown Modal/Popover */}
      {showResolutionMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowResolutionMenu(false)} />
          <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-[320px] lg:right-auto lg:left-[55%] w-80 bg-[#0C101A]/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-1 text-left">
            <div className="px-2 py-1.5 border-b border-white/10 mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                Resolusi Preview Layar
              </span>
              <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                Playback Anti-Lag
              </span>
            </div>

            <div className="space-y-1">
              {PREVIEW_RESOLUTIONS.map((opt) => {
                const isSelected = previewResolution === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onPreviewResolutionChange?.(opt.id);
                      setShowResolutionMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-white'
                        : 'hover:bg-white/10 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                          {opt.badge}
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-normal ${
                              opt.id === '360p'
                                ? 'bg-amber-500/20 text-amber-300'
                                : opt.id === '480p'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : opt.id === '720p'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}
                          >
                            {opt.tag}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">{opt.loadPercent}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/10 px-1 text-[9.5px] text-slate-400 leading-normal">
              <span className="text-cyan-400 font-bold">💡 Tips:</span> Menurunkan resolusi membuat pemutaran di layar sangat lancar & hemat CPU. Hasil <strong className="text-slate-200">Export Video Final</strong> tetap selalu 1080p / 4K tajam.
            </div>
          </div>
        </>
      )}

      {/* Right: Actions (Upload Audio & Export) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 hover:text-white transition-all shadow-sm active:scale-95"
          title="Upload MP3 or WAV"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          <span className="hidden md:inline">Upload Audio</span>
          <span className="md:hidden text-[11px]">Audio</span>
        </button>

        {/* Save Project to Local Storage */}
        {onSaveProject && (
          <button
            onClick={onSaveProject}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-300 transition-all shadow-sm active:scale-95 shrink-0"
            title="Simpan semua editan, efek, dan subtitle ke penyimpanan lokal browser"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span className="hidden sm:inline">Simpan</span>
            <span className="sm:hidden text-[11px]">Save</span>
          </button>
        )}

        <button
          onClick={onReset}
          className="hidden sm:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 transition-all"
          title="Reset to Template Default"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-pink-500 hover:from-cyan-400 hover:via-indigo-500 hover:to-pink-400 text-white text-[11px] sm:text-sm font-bold shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95"
        >
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
