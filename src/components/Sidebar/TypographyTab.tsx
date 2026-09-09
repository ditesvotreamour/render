import React from 'react';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Zap,
  Sliders,
  Share2,
  Tag,
  Trash2,
} from 'lucide-react';
import type { TypographyConfig, TextPosition, SocialBadgeConfig } from '../../types/visualizer';

interface TypographyTabProps {
  config: TypographyConfig;
  onChange: (newConfig: TypographyConfig) => void;
}

const FONTS = [
  'Orbitron',
  'Montserrat',
  'Outfit',
  'Bebas Neue',
  'Anton',
  'Syncopate',
  'Rajdhani',
  'Cinzel',
  'Poppins',
  'Inter',
];

const POSITIONS: { id: TextPosition; label: string; icon: React.ReactNode }[] = [
  { id: 'center_bottom', label: 'Center Bottom', icon: <AlignCenter className="w-3.5 h-3.5" /> },
  { id: 'top_center', label: 'Top Center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
  { id: 'top_left', label: 'Top Left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { id: 'bottom_center', label: 'Bottom Center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
  { id: 'bottom_left', label: 'Bottom Left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { id: 'bottom_right', label: 'Bottom Right', icon: <AlignRight className="w-3.5 h-3.5" /> },
];

const DEFAULT_SOCIAL_BADGE: SocialBadgeConfig = {
  enabled: false,
  streamingPlatform: 'spotify',
  customStreamingText: '🎵 Listen on Spotify',
  handleInstagram: 'your_artist',
  handleTikTok: 'your_artist',
  handleYouTube: '',
  position: 'below_title',
  style: 'glass_pill',
  badgeColor: '#00F0FF',
};

export const TypographyTab: React.FC<TypographyTabProps> = ({ config, onChange }) => {
  const update = (partial: Partial<TypographyConfig>) => {
    onChange({ ...config, ...partial });
  };

  const socialBadges: SocialBadgeConfig = config.socialBadges || DEFAULT_SOCIAL_BADGE;

  const updateSocial = (partial: Partial<SocialBadgeConfig>) => {
    update({
      socialBadges: {
        ...socialBadges,
        ...partial,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Track Title */}
      <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-cyan-400" />
            <span>Track Title</span>
          </label>
          <button
            onClick={() => update({ showTitle: !config.showTitle })}
            className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
              config.showTitle ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                config.showTitle ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.showTitle && (
          <>
            <input
              type="text"
              value={config.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="e.g. NEON HORIZON"
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Font</span>
                <select
                  value={config.titleFont}
                  onChange={(e) => update({ titleFont: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f} className="bg-slate-900 text-white">
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Color</span>
                <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <input
                    type="color"
                    value={config.titleColor}
                    onChange={(e) => update({ titleColor: e.target.value })}
                    className="w-5 h-5 rounded-md cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                    {config.titleColor}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 text-[11px]">Size</span>
                <span className="font-mono text-cyan-400 text-[11px]">{config.titleSize}px</span>
              </div>
              <input
                type="range"
                min="18"
                max="60"
                step="1"
                value={config.titleSize}
                onChange={(e) => update({ titleSize: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </>
        )}
      </div>

      {/* 2. Artist Name */}
      <div className="space-y-3 p-3.5 bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Nama Artis / Singer</span>
          </label>
          <button
            onClick={() => update({ showArtist: !config.showArtist })}
            className={`w-10 h-5 transition-colors relative p-0.5 ${
              config.showArtist ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white transition-transform ${
                config.showArtist ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config.showArtist && (
          <>
            <div className="relative">
              <input
                type="text"
                value={config.artist}
                onChange={(e) => update({ artist: e.target.value })}
                placeholder="e.g. CYBERPUNK COLLECTIVE (kosongkan jika tidak ada)"
                className="w-full px-3 py-2 pr-8 bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              {config.artist && (
                <button
                  type="button"
                  onClick={() => update({ artist: '', showArtist: false })}
                  title="Hapus Nama Artis"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Font</span>
                <select
                  value={config.artistFont}
                  onChange={(e) => update({ artistFont: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f} className="bg-slate-900 text-white">
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[10px] font-medium text-slate-400 mb-1">Color</span>
                <div className="flex items-center gap-1.5 bg-black/40 p-1.5 border border-white/10">
                  <input
                    type="color"
                    value={config.artistColor}
                    onChange={(e) => update({ artistColor: e.target.value })}
                    className="w-5 h-5 cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                    {config.artistColor}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 text-[11px]">Size</span>
                <span className="font-mono text-pink-400 text-[11px]">{config.artistSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="36"
                step="1"
                value={config.artistSize}
                onChange={(e) => update({ artistSize: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 appearance-none cursor-pointer accent-pink-400"
              />
            </div>
          </>
        )}
      </div>

      {/* 3. Subtitle / Tagline Video (ORIGINAL AUDIO • CUSTOM TRACK, etc) */}
      <div className="space-y-3 p-3.5 bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Subtitle / Tagline Video</span>
          </label>
          <button
            onClick={() => update({ showSubtitle: !config.showSubtitle })}
            className={`w-10 h-5 transition-colors relative p-0.5 ${
              config.showSubtitle ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white transition-transform ${
                config.showSubtitle ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Teks kecil di bawah nama artis (misal: <span className="text-amber-300 font-mono">ORIGINAL AUDIO • CUSTOM TRACK</span>). Matikan sakelar di atas atau klik tombol hapus jika ingin menghilangkannya dari video.
        </p>

        {config.showSubtitle && (
          <div className="space-y-2.5 pt-1">
            <div className="relative">
              <input
                type="text"
                value={config.subtitle || ''}
                onChange={(e) => update({ subtitle: e.target.value })}
                placeholder="Kosongkan jika tidak ingin ada tulisan tagline..."
                className="w-full px-3 py-2 pr-8 bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              {config.subtitle && (
                <button
                  type="button"
                  onClick={() => update({ subtitle: '', showSubtitle: false })}
                  title="Hapus Tagline"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update({ subtitle: '', showSubtitle: false })}
                className="flex-1 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus & Hilangkan dari Video
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. DYNAMIC SOCIAL HANDLES & STREAMING BADGES HUD */}
      <div className="space-y-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-cyan-400" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Social Handles & Badges</h4>
              <p className="text-[10px] text-slate-400">Display Spotify, Instagram & TikTok HUD</p>
            </div>
          </div>
          <button
            onClick={() => updateSocial({ enabled: !socialBadges.enabled })}
            className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
              socialBadges.enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                socialBadges.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {socialBadges.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Streaming Platform Picker */}
            <div>
              <span className="block text-[10px] font-medium text-slate-300 mb-1">Platform Streaming</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'spotify', label: 'Spotify', icon: '🟢' },
                  { id: 'apple_music', label: 'Apple', icon: '🍎' },
                  { id: 'youtube', label: 'YouTube', icon: '▶' },
                  { id: 'soundcloud', label: 'SoundCloud', icon: '☁' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateSocial({ streamingPlatform: item.id as any })}
                    className={`p-1.5 rounded-xl border text-center text-[10px] font-bold transition-all ${
                      socialBadges.streamingPlatform === item.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    <span>{item.icon} {item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Social Usernames */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">📸 Instagram Handle</label>
                <input
                  type="text"
                  value={socialBadges.handleInstagram || ''}
                  onChange={(e) => updateSocial({ handleInstagram: e.target.value })}
                  placeholder="@your_instagram"
                  className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">🎬 TikTok Handle</label>
                <input
                  type="text"
                  value={socialBadges.handleTikTok || ''}
                  onChange={(e) => updateSocial({ handleTikTok: e.target.value })}
                  placeholder="@your_tiktok"
                  className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Position & Badge Color */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Posisi Badge</label>
                <select
                  value={socialBadges.position}
                  onChange={(e) => updateSocial({ position: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none"
                >
                  <option value="below_title" className="bg-slate-900 text-white">Di Bawah Judul Lagu</option>
                  <option value="top_left" className="bg-slate-900 text-white">Pojok Kiri Atas</option>
                  <option value="top_right" className="bg-slate-900 text-white">Pojok Kanan Atas</option>
                  <option value="bottom_left" className="bg-slate-900 text-white">Pojok Kiri Bawah</option>
                  <option value="bottom_right" className="bg-slate-900 text-white">Pojok Kanan Bawah</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Badge Glow Color</label>
                <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-lg border border-white/10">
                  <input
                    type="color"
                    value={socialBadges.badgeColor}
                    onChange={(e) => updateSocial({ badgeColor: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-slate-300 uppercase">
                    {socialBadges.badgeColor}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Position & HUD Layout */}
      <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>HUD Position & Dynamics</span>
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => update({ position: pos.id })}
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
                config.position === pos.id
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pos.icon}
              <span className="truncate">{pos.label}</span>
            </button>
          ))}
        </div>

        {/* Toggles: Beat bounce & Time progress bar */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <button
            onClick={() => update({ reactToBeat: !config.reactToBeat })}
            className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
              config.reactToBeat
                ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              <span>Reactive Beat Bounce</span>
            </div>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.reactToBeat ? '#EC4899' : '#475569' }} />
          </button>

          <button
            onClick={() => update({ showTimeProgress: !config.showTimeProgress })}
            className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
              config.showTimeProgress
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Time Progress Bar HUD</span>
            </div>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.showTimeProgress ? '#00F0FF' : '#475569' }} />
          </button>
        </div>
      </div>
    </div>
  );
};
