import React from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Disc3,
  ThumbsUp,
  ThumbsDown,
  Repeat2,
  Music2,
} from 'lucide-react';
import type { SafeZonePlatform, AspectRatio } from '../types/visualizer';

interface SafeZoneOverlayProps {
  platform: SafeZonePlatform;
  aspectRatio?: AspectRatio;
  opacity?: number;
}

export const SafeZoneOverlay: React.FC<SafeZoneOverlayProps> = ({
  platform,
  aspectRatio: _aspectRatio,
  opacity = 0.85,
}) => {
  if (platform === 'none') return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden transition-opacity duration-200"
      style={{ opacity }}
    >
      {/* 1. TIKTOK OVERLAY (9:16) */}
      {platform === 'tiktok' && (
        <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5 font-sans">
          {/* Top Bar */}
          <div className="flex items-center justify-center gap-4 pt-2 text-[11px] font-bold text-white/80 drop-shadow">
            <span className="opacity-60">Following</span>
            <span className="border-b-2 border-white pb-0.5">For You</span>
          </div>

          {/* Center Safe Zone Bounding Box */}
          <div className="absolute inset-x-8 top-[14%] bottom-[22%] rounded-2xl border-2 border-dashed border-cyan-400/60 bg-cyan-500/[0.04] flex flex-col items-center justify-between p-2">
            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-black/60 px-2 py-0.5 rounded-full border border-cyan-400/40">
              ✓ TikTok Safe Creative Area (Spectrum & Lyrics)
            </span>
            <span className="text-[9px] font-mono text-cyan-300/80 bg-black/40 px-2 py-0.5 rounded">
              Tidak akan tertutup tombol TikTok
            </span>
          </div>

          {/* Right Action Rail */}
          <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-3.5 text-white drop-shadow-md">
            {/* Avatar */}
            <div className="relative w-9 h-9 rounded-full border-2 border-white bg-slate-700 overflow-hidden flex items-center justify-center shadow-lg">
              <span className="text-xs font-bold">🎵</span>
              <div className="absolute -bottom-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                +
              </div>
            </div>

            {/* Like */}
            <div className="flex flex-col items-center">
              <Heart className="w-6 h-6 fill-white text-white drop-shadow" />
              <span className="text-[9px] font-bold mt-0.5">142K</span>
            </div>

            {/* Comment */}
            <div className="flex flex-col items-center">
              <MessageCircle className="w-6 h-6 fill-white text-white drop-shadow" />
              <span className="text-[9px] font-bold mt-0.5">1.2K</span>
            </div>

            {/* Bookmark */}
            <div className="flex flex-col items-center">
              <Bookmark className="w-6 h-6 fill-white text-white drop-shadow" />
              <span className="text-[9px] font-bold mt-0.5">24K</span>
            </div>

            {/* Share */}
            <div className="flex flex-col items-center">
              <Share2 className="w-6 h-6 fill-white text-white drop-shadow" />
              <span className="text-[9px] font-bold mt-0.5">Share</span>
            </div>

            {/* Spinning Disc */}
            <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center animate-spin">
              <Disc3 className="w-5 h-5 text-slate-300" />
            </div>
          </div>

          {/* Bottom Caption & Audio Info */}
          <div className="pr-14 pb-2 space-y-1.5 text-white drop-shadow">
            <div className="text-xs font-bold">@musicproducer</div>
            <p className="text-[10px] text-white/90 line-clamp-2 leading-tight">
              New track out now! 🔥🎧 Visualizer rendered with Specterr Studio #music #producer #beats
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-white/80">
              <Music2 className="w-3 h-3" />
              <span className="truncate">Original Sound - Artist Official</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. INSTAGRAM REELS OVERLAY (9:16) */}
      {platform === 'reels' && (
        <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5 font-sans">
          {/* Top Bar */}
          <div className="flex items-center justify-between pt-1 px-1 text-xs font-bold text-white drop-shadow">
            <span className="text-sm tracking-tight">Reels</span>
          </div>

          {/* Center Safe Area Box */}
          <div className="absolute inset-x-8 top-[12%] bottom-[20%] rounded-2xl border-2 border-dashed border-pink-400/60 bg-pink-500/[0.04] flex flex-col items-center justify-between p-2">
            <span className="text-[10px] font-mono font-bold text-pink-300 bg-black/60 px-2 py-0.5 rounded-full border border-pink-400/40">
              ✓ Instagram Reels Safe Area
            </span>
            <span className="text-[9px] font-mono text-pink-300/80 bg-black/40 px-2 py-0.5 rounded">
              Aman dari tombol like, caption & header
            </span>
          </div>

          {/* Right Rail */}
          <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 text-white drop-shadow">
            <div className="flex flex-col items-center">
              <Heart className="w-6 h-6 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">85.4K</span>
            </div>
            <div className="flex flex-col items-center">
              <MessageCircle className="w-6 h-6 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">820</span>
            </div>
            <div className="flex flex-col items-center">
              <Share2 className="w-6 h-6 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">Share</span>
            </div>
          </div>

          {/* Bottom User info */}
          <div className="pr-14 pb-2 space-y-1.5 text-white drop-shadow">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-600 p-0.5">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px]">
                  🎵
                </div>
              </div>
              <span className="text-xs font-bold">artist_official</span>
              <span className="text-[10px] px-2 py-0.5 rounded border border-white/40 font-semibold">Follow</span>
            </div>
            <p className="text-[10px] text-white/90 line-clamp-1">
              Visualizer drop vibes ⚡ Link in bio for full stream!
            </p>
          </div>
        </div>
      )}

      {/* 3. YOUTUBE SHORTS OVERLAY (9:16) */}
      {platform === 'shorts' && (
        <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5 font-sans">
          {/* Safe Area Box */}
          <div className="absolute inset-x-8 top-[10%] bottom-[18%] rounded-2xl border-2 border-dashed border-rose-400/60 bg-rose-500/[0.04] flex flex-col items-center justify-between p-2">
            <span className="text-[10px] font-mono font-bold text-rose-300 bg-black/60 px-2 py-0.5 rounded-full border border-rose-400/40">
              ✓ YouTube Shorts Safe Area
            </span>
            <span className="text-[9px] font-mono text-rose-300/80 bg-black/40 px-2 py-0.5 rounded">
              Area bebas tombol Shorts
            </span>
          </div>

          {/* Right Rail */}
          <div className="absolute right-3 bottom-14 flex flex-col items-center gap-3.5 text-white drop-shadow">
            <div className="flex flex-col items-center">
              <ThumbsUp className="w-5 h-5 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">Like</span>
            </div>
            <div className="flex flex-col items-center">
              <ThumbsDown className="w-5 h-5 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">Dislike</span>
            </div>
            <div className="flex flex-col items-center">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">450</span>
            </div>
            <div className="flex flex-col items-center">
              <Share2 className="w-5 h-5 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">Share</span>
            </div>
            <div className="flex flex-col items-center">
              <Repeat2 className="w-5 h-5 text-white" />
              <span className="text-[9px] font-semibold mt-0.5">Remix</span>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="pr-14 pb-1 space-y-1 text-white drop-shadow">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-[9px] font-bold">
                ▶
              </div>
              <span className="text-xs font-bold">Channel Name</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-white text-black font-bold">Subscribe</span>
            </div>
            <p className="text-[10px] text-white/90 line-clamp-1">Track Visualizer Full HD #Shorts</p>
          </div>
        </div>
      )}

      {/* 4. SPOTIFY CANVAS (9:16) */}
      {platform === 'spotify' && (
        <div className="relative w-full h-full flex flex-col justify-between p-4 sm:p-6 font-sans">
          {/* Top Spotify Header */}
          <div className="pt-2 text-center text-white/80 drop-shadow">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">
              PLAYING FROM ARTIST
            </span>
            <span className="text-xs font-bold text-white">Album / Single Title</span>
          </div>

          {/* Safe Canvas Box */}
          <div className="absolute inset-x-6 top-[15%] bottom-[24%] rounded-2xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/[0.04] flex flex-col items-center justify-between p-2">
            <span className="text-[10px] font-mono font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full border border-emerald-400/40">
              ✓ Spotify Canvas 8s Loop Area
            </span>
            <span className="text-[9px] font-mono text-emerald-300/80 bg-black/40 px-2 py-0.5 rounded">
              Bebas dari header dan bottom controls Spotify
            </span>
          </div>

          {/* Bottom Playback Controls Mock */}
          <div className="space-y-2 pb-2 text-white/80 drop-shadow">
            <div className="flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-white">Song Title</div>
                <div className="text-[10px] text-slate-300">Artist Name</div>
              </div>
              <Heart className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            </div>
            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
              <div className="w-1/3 h-full bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* 5. YOUTUBE LANDSCAPE (16:9) */}
      {platform === 'youtube' && (
        <div className="relative w-full h-full p-6 sm:p-10 font-sans">
          {/* 90% Title Safe Area */}
          <div className="w-full h-full rounded-2xl border-2 border-dashed border-cyan-400/50 bg-cyan-500/[0.02] flex flex-col justify-between p-3">
            <div className="flex justify-between items-center text-[10px] font-mono text-cyan-300">
              <span className="bg-black/60 px-2 py-0.5 rounded border border-cyan-400/30">
                90% Title Safe (1080p / 4K)
              </span>
              <span className="bg-black/60 px-2 py-0.5 rounded border border-cyan-400/30">
                16:9 Landscape Widescreen
              </span>
            </div>

            {/* 80% Action Safe Inner Box */}
            <div className="m-auto w-[90%] h-[80%] rounded-xl border border-dashed border-pink-400/50 bg-pink-500/[0.02] flex items-center justify-center">
              <span className="text-[10px] font-mono text-pink-300 bg-black/60 px-2 py-0.5 rounded border border-pink-400/30">
                80% Core Visualizer Safe Zone
              </span>
            </div>

            <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
              <span>Bebas dari YouTube End Screen Cards</span>
              <span>Bebas dari Player Controls</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
