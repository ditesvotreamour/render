import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  ListMusic,
  Upload,
  Sliders,
  Activity,
  Scissors,
} from 'lucide-react';
import type { AudioTrack } from '../types/visualizer';
import { SAMPLE_TRACKS } from '../data/sampleTracks';
import { globalAudioEngine } from '../utils/audioEngine';

interface AudioPlayerBarProps {
  currentTrack: AudioTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSelectTrack: (track: AudioTrack) => void;
  onUploadAudio: (file: File) => void;
  onOpenAudioLab?: () => void;
  onOpenCutterJoiner?: () => void;
  onToggleCustomize?: () => void;
  isCustomizeOpen?: boolean;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSelectTrack,
  onUploadAudio,
  onOpenAudioLab,
  onOpenCutterJoiner,
  onToggleCustomize,
  isCustomizeOpen = false,
}) => {
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [showTrackDropdown, setShowTrackDropdown] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    globalAudioEngine.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  useEffect(() => {
    globalAudioEngine.setLoop(isLooping);
  }, [isLooping]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    globalAudioEngine.seek(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isMuted && val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-16 sm:h-20 bg-[#090C13]/95 backdrop-blur-lg border-t border-white/10 px-3 sm:px-6 flex items-center justify-between z-30 sticky bottom-0 shrink-0">
      {/* Left: Track Info */}
      <div className="flex items-center gap-2 sm:gap-3 max-w-[38%] sm:w-1/4 sm:min-w-[180px] min-w-0">
        <div className="relative group shrink-0">
          <img
            src={currentTrack.coverArt || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80'}
            alt="Track Artwork"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-white/10 shadow-md group-hover:scale-105 transition-transform"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
          )}
        </div>

        <div className="truncate pr-1">
          <h4 className="text-[11px] sm:text-sm font-bold text-white truncate tracking-wide">
            {currentTrack.title}
          </h4>
          <p className="text-[10px] sm:text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
            <span className="truncate">{currentTrack.artist}</span>
            <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-600 shrink-0" />
            <span className="hidden sm:inline text-[10px] text-cyan-400 font-mono shrink-0">{currentTrack.genre}</span>
          </p>
        </div>
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-xl px-1 sm:px-6">
        {/* Buttons */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Track Selector Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowTrackDropdown(!showTrackDropdown)}
              className={`p-1.5 sm:p-2 rounded-xl border text-xs flex items-center gap-1 sm:gap-1.5 transition-all ${
                showTrackDropdown
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Select Track"
            >
              <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline font-medium">Tracks</span>
            </button>

            {/* Dropdown Menu */}
            {showTrackDropdown && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 sm:w-72 bg-[#0E131F] border border-white/15 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="px-2 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Sample Tracks</span>
                  <button
                    onClick={() => {
                      setShowTrackDropdown(false);
                      fileInputRef.current?.click();
                    }}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px]"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                  </button>
                </div>

                <div className="space-y-1 mt-1 max-h-52 overflow-y-auto">
                  {SAMPLE_TRACKS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelectTrack(t);
                        setShowTrackDropdown(false);
                      }}
                      className={`w-full text-left p-1.5 sm:p-2 rounded-xl flex items-center gap-2 transition-colors ${
                        currentTrack.id === t.id
                          ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-white'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <img
                        src={t.coverArt}
                        alt=""
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                      <div className="truncate flex-1">
                        <p className="text-xs font-semibold truncate text-white">{t.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{t.artist}</p>
                      </div>
                      {currentTrack.id === t.id && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Big Neon Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
              isPlaying
                ? 'bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-pink-500/30'
                : 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-blue-600 text-white shadow-cyan-500/30'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Loop Toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all ${
              isLooping
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Audio Loop"
          >
            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Audio Lab & AI Analyzer Button */}
          {onOpenAudioLab && (
            <button
              onClick={onOpenAudioLab}
              className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-r from-cyan-500/15 via-indigo-500/15 to-pink-500/15 hover:from-cyan-500/25 hover:to-indigo-500/25 border border-cyan-400/40 text-cyan-300 flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Open AI Audio Lab (BPM, Key, Drops & Stem Filters)"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-[10px] hidden sm:inline">AI Lab</span>
            </button>
          )}

          {/* Audio Studio & MP3 Cutter Button */}
          {onOpenCutterJoiner && (
            <button
              onClick={onOpenCutterJoiner}
              className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-rose-500/15 hover:from-pink-500/25 hover:to-rose-500/25 border border-pink-400/40 text-pink-300 flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Studio Editor Audio & MP3 (Waveform Cut, Fade In/Out, Gain Booster, MP3/WAV Export)"
            >
              <Scissors className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-[10px] hidden sm:inline">Edit MP3</span>
            </button>
          )}

          {/* Mobile Customize Drawer Toggle */}
          {onToggleCustomize && (
            <button
              onClick={onToggleCustomize}
              className={`lg:hidden p-1.5 sm:p-2 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all ${
                isCustomizeOpen
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                  : 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border-cyan-500/30 text-cyan-300'
              }`}
              title="Open Studio Customizer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden xs:inline">Studio</span>
            </button>
          )}
        </div>

        {/* Timeline Scrubber */}
        <div className="w-full flex items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-[11px] font-mono text-slate-400">
          <span className="w-7 sm:w-9 text-right shrink-0">{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center group">
            {/* Trim range indicator if active */}
            {globalAudioEngine.trimRange && duration > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-pink-500/30 border-x border-pink-400 rounded-sm pointer-events-none z-10"
                style={{
                  left: `${(globalAudioEngine.trimRange.start / duration) * 100}%`,
                  width: `${Math.max(1, ((globalAudioEngine.trimRange.end - globalAudioEngine.trimRange.start) / duration) * 100)}%`,
                }}
                title={`Trim Preview: ${globalAudioEngine.trimRange.start.toFixed(1)}s - ${globalAudioEngine.trimRange.end.toFixed(1)}s`}
              />
            )}
            <input
              type="range"
              min="0"
              max={duration || 180}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 sm:h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 group-hover:h-2 transition-all"
              style={{
                background: `linear-gradient(to right, #00F0FF 0%, #00F0FF ${progressPercent}%, #1E293B ${progressPercent}%, #1E293B 100%)`,
              }}
            />
          </div>
          <span className="w-7 sm:w-9 text-left shrink-0">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Desktop Volume Slider & Action Pills */}
      <div className="hidden md:flex items-center justify-end gap-2.5 w-1/4">
        {onOpenCutterJoiner && (
          <button
            onClick={onOpenCutterJoiner}
            className="px-2.5 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Potong Lagu (Ambil Reff) / Sambung Multi-Lagu"
          >
            <Scissors className="w-3.5 h-3.5 text-pink-400" />
            <span>Cut / Sambung</span>
          </button>
        )}

        {onOpenAudioLab && (
          <button
            onClick={onOpenAudioLab}
            className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>AI Audio Lab</span>
          </button>
        )}

        <button
          onClick={toggleMute}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-slate-300" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-20 sm:w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          style={{
            background: `linear-gradient(to right, #00F0FF 0%, #00F0FF ${(isMuted ? 0 : volume) * 100}%, #1E293B ${(isMuted ? 0 : volume) * 100}%, #1E293B 100%)`,
          }}
        />

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
      </div>
    </footer>
  );
};
