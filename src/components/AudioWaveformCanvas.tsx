import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Volume2, Scissors } from 'lucide-react';
import { AudioTrimmerJoiner } from '../utils/audioTrimmerJoiner';
import type { AudioTrack } from '../types/visualizer';

interface AudioWaveformCanvasProps {
  currentTrack: AudioTrack;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  trimStart: number;
  trimEnd: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  onChangeRange: (start: number, end: number) => void;
  onSeek: (sec: number) => void;
  splitPoints?: number[];
  onSplitAtPlayhead?: () => void;
}

export const AudioWaveformCanvas: React.FC<AudioWaveformCanvasProps> = ({
  currentTrack,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  fadeInSec = 0,
  fadeOutSec = 0,
  onChangeRange,
  onSeek,
  splitPoints = [],
  onSplitAtPlayhead,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 1x to 4x
  const [scrollOffsetSec, setScrollOffsetSec] = useState<number>(0);

  // Drag interaction state
  const [dragMode, setDragMode] = useState<'none' | 'start-handle' | 'end-handle' | 'body'>('none');
  const dragStartRef = useRef<{ mouseX: number; initStart: number; initEnd: number }>({
    mouseX: 0,
    initStart: 0,
    initEnd: 0,
  });

  const effectiveDuration = Math.max(1, duration || currentTrack.duration || 180);

  // 1. Decode Audio and extract waveform peaks
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingWaveform(true);

    const loadPeaks = async () => {
      try {
        const audioBlob = await AudioTrimmerJoiner.getTrackAudioBlob(currentTrack);
        const decoded = await AudioTrimmerJoiner.decodeAudio(audioBlob);
        if (!isCancelled) {
          const extracted = AudioTrimmerJoiner.extractWaveformPeaks(decoded, 1200);
          setPeaks(extracted);
          setIsLoadingWaveform(false);
        }
      } catch (err) {
        console.warn('Failed to extract waveform peaks:', err);
        if (!isCancelled) {
          // Generate fallback synthetic waveform peaks so UI is always visual and usable
          const synthPeaks = new Float32Array(800);
          for (let i = 0; i < 800; i++) {
            synthPeaks[i] = 0.2 + Math.abs(Math.sin(i * 0.05)) * 0.6 + Math.random() * 0.2;
          }
          setPeaks(synthPeaks);
          setIsLoadingWaveform(false);
        }
      }
    };

    loadPeaks();

    return () => {
      isCancelled = true;
    };
  }, [currentTrack]);

  // Keep scroll in bounds when zoom changes
  const visibleDuration = effectiveDuration / zoomLevel;
  const maxScroll = Math.max(0, effectiveDuration - visibleDuration);
  const currentScroll = Math.max(0, Math.min(scrollOffsetSec, maxScroll));

  // Time <-> Pixel conversion helpers
  const timeToX = useCallback(
    (time: number, width: number) => {
      const relTime = time - currentScroll;
      return (relTime / visibleDuration) * width;
    },
    [currentScroll, visibleDuration]
  );

  const xToTime = useCallback(
    (x: number, width: number) => {
      const relRatio = Math.max(0, Math.min(1, x / width));
      return Math.max(0, Math.min(effectiveDuration, currentScroll + relRatio * visibleDuration));
    },
    [currentScroll, visibleDuration, effectiveDuration]
  );

  // 2. Render Waveform on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#05070E';
    ctx.fillRect(0, 0, width, height);

    // Center baseline
    const centerY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const startX = timeToX(trimStart, width);
    const endX = timeToX(trimEnd, width);

    // Draw Peaks
    if (peaks && peaks.length > 0) {
      const totalPeaks = peaks.length;
      const numVisibleBuckets = Math.floor(width / 3.5);
      const barWidth = 2.2;
      const barGap = 1.3;

      for (let i = 0; i < numVisibleBuckets; i++) {
        const x = i * (barWidth + barGap);
        const timeAtBar = xToTime(x, width);
        const peakIdx = Math.floor((timeAtBar / effectiveDuration) * totalPeaks);
        const val = peaks[Math.min(totalPeaks - 1, Math.max(0, peakIdx))] || 0.15;
        const barHeight = Math.max(3, val * (height * 0.78) * 0.5);

        const isInSelectedRegion = timeAtBar >= trimStart && timeAtBar <= trimEnd;

        // Color based on region and fade in/out
        if (isInSelectedRegion) {
          // Inside selection: Vibrant Gradient
          const grad = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
          grad.addColorStop(0, '#22D3EE'); // Cyan
          grad.addColorStop(0.5, '#818CF8'); // Indigo
          grad.addColorStop(1, '#F43F5E'); // Rose/Pink
          ctx.fillStyle = grad;
        } else {
          // Outside selection: Subdued dark slate
          ctx.fillStyle = 'rgba(100, 116, 139, 0.28)';
        }

        // Draw symmetric top and bottom bars with rounded caps
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, barWidth, barHeight * 2, [1.5]);
        ctx.fill();
      }
    }

    // Overlay shading for excluded regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    if (startX > 0) {
      ctx.fillRect(0, 0, Math.max(0, startX), height);
    }
    if (endX < width) {
      ctx.fillRect(Math.max(0, endX), 0, width - endX, height);
    }

    // Active Selection Window Highlight Border
    const selW = Math.max(2, endX - startX);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, 0, selW, height);

    // Fade In Visual Curve overlay (if > 0)
    if (fadeInSec > 0) {
      const fadeStartX = startX;
      const fadeEndX = Math.min(endX, timeToX(trimStart + fadeInSec, width));
      const fadeW = Math.max(1, fadeEndX - fadeStartX);

      const fadeGrad = ctx.createLinearGradient(fadeStartX, 0, fadeEndX, 0);
      fadeGrad.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
      fadeGrad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');

      ctx.fillStyle = fadeGrad;
      ctx.beginPath();
      ctx.moveTo(fadeStartX, height);
      ctx.quadraticCurveTo(fadeStartX + fadeW * 0.5, centerY, fadeEndX, 0);
      ctx.lineTo(fadeStartX, 0);
      ctx.closePath();
      ctx.fill();

      // Curved Line
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fadeStartX, height);
      ctx.quadraticCurveTo(fadeStartX + fadeW * 0.5, centerY, fadeEndX, 0);
      ctx.stroke();
    }

    // Fade Out Visual Curve overlay (if > 0)
    if (fadeOutSec > 0) {
      const fadeStartX = Math.max(startX, timeToX(trimEnd - fadeOutSec, width));
      const fadeEndX = endX;
      const fadeW = Math.max(1, fadeEndX - fadeStartX);

      const fadeGrad = ctx.createLinearGradient(fadeStartX, 0, fadeEndX, 0);
      fadeGrad.addColorStop(0, 'rgba(244, 63, 94, 0.0)');
      fadeGrad.addColorStop(1, 'rgba(244, 63, 94, 0.35)');

      ctx.fillStyle = fadeGrad;
      ctx.beginPath();
      ctx.moveTo(fadeStartX, 0);
      ctx.quadraticCurveTo(fadeStartX + fadeW * 0.5, centerY, fadeEndX, height);
      ctx.lineTo(fadeStartX, 0);
      ctx.closePath();
      ctx.fill();

      // Curved Line
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fadeStartX, 0);
      ctx.quadraticCurveTo(fadeStartX + fadeW * 0.5, centerY, fadeEndX, height);
      ctx.stroke();
    }

    // Handles (Start & End draggable pill bars)
    // 1. Start Handle (Cyan)
    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(startX - 2.5, 0, 5, height);

    ctx.beginPath();
    ctx.arc(startX, 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(startX, height - 10, 7, 0, Math.PI * 2);
    ctx.fill();

    // 2. End Handle (Pink)
    ctx.fillStyle = '#F43F5E';
    ctx.fillRect(endX - 2.5, 0, 5, height);

    ctx.beginPath();
    ctx.arc(endX, 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endX, height - 10, 7, 0, Math.PI * 2);
    ctx.fill();

    // Split Cut Markers (Garis Titik Potongan CapCut)
    if (splitPoints && splitPoints.length > 0) {
      splitPoints.forEach((pt) => {
        const ptX = timeToX(pt, width);
        if (ptX >= 0 && ptX <= width) {
          ctx.save();
          ctx.strokeStyle = '#FBBF24'; // Amber / Gold
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(ptX, 0);
          ctx.lineTo(ptX, height);
          ctx.stroke();

          // Split Scissors icon dot
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(ptX, height / 2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // Playhead Scrubber Line (Garis Jarum Penanda CapCut)
    const curX = timeToX(currentTime, width);
    if (curX >= 0 && curX <= width) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(curX, 0);
      ctx.lineTo(curX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Playhead Top Pointer (CapCut Pin)
      ctx.fillStyle = '#22D3EE';
      ctx.beginPath();
      ctx.moveTo(curX - 6, 0);
      ctx.lineTo(curX + 6, 0);
      ctx.lineTo(curX, 10);
      ctx.closePath();
      ctx.fill();

      // Playhead Bottom Pointer
      ctx.beginPath();
      ctx.moveTo(curX - 6, height);
      ctx.lineTo(curX + 6, height);
      ctx.lineTo(curX, height - 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    peaks,
    trimStart,
    trimEnd,
    currentTime,
    fadeInSec,
    fadeOutSec,
    splitPoints,
    timeToX,
    xToTime,
    effectiveDuration,
    zoomLevel,
    scrollOffsetSec,
  ]);

  // Resize canvas according to device pixel ratio
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(130 * dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse / Touch Drag Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;

    const startX = timeToX(trimStart, canvas.width);
    const endX = timeToX(trimEnd, canvas.width);

    const TOLERANCE = 18; // pixels

    if (Math.abs(clickX - startX) <= TOLERANCE) {
      setDragMode('start-handle');
      dragStartRef.current = { mouseX: e.clientX, initStart: trimStart, initEnd: trimEnd };
    } else if (Math.abs(clickX - endX) <= TOLERANCE) {
      setDragMode('end-handle');
      dragStartRef.current = { mouseX: e.clientX, initStart: trimStart, initEnd: trimEnd };
    } else if (clickX > startX && clickX < endX) {
      setDragMode('body');
      dragStartRef.current = { mouseX: e.clientX, initStart: trimStart, initEnd: trimEnd };
    } else {
      // Direct click outside: seek audio playhead directly to clicked time
      const clickedTime = xToTime(clickX, canvas.width);
      onSeek(clickedTime);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragMode === 'none') {
      const rect = canvas.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const startX = timeToX(trimStart, canvas.width);
      const endX = timeToX(trimEnd, canvas.width);

      if (Math.abs(clickX - startX) <= 18 || Math.abs(clickX - endX) <= 18) {
        canvas.style.cursor = 'ew-resize';
      } else if (clickX > startX && clickX < endX) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = 'pointer';
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const deltaPx = e.clientX - dragStartRef.current.mouseX;
    const deltaTime = (deltaPx / rect.width) * visibleDuration;

    if (dragMode === 'start-handle') {
      const newStart = Math.max(0, Math.min(trimEnd - 0.5, dragStartRef.current.initStart + deltaTime));
      onChangeRange(Math.round(newStart * 10) / 10, trimEnd);
    } else if (dragMode === 'end-handle') {
      const newEnd = Math.min(effectiveDuration, Math.max(trimStart + 0.5, dragStartRef.current.initEnd + deltaTime));
      onChangeRange(trimStart, Math.round(newEnd * 10) / 10);
    } else if (dragMode === 'body') {
      const windowLen = dragStartRef.current.initEnd - dragStartRef.current.initStart;
      let newStart = dragStartRef.current.initStart + deltaTime;
      let newEnd = newStart + windowLen;

      if (newStart < 0) {
        newStart = 0;
        newEnd = windowLen;
      } else if (newEnd > effectiveDuration) {
        newEnd = effectiveDuration;
        newStart = effectiveDuration - windowLen;
      }

      onChangeRange(Math.round(newStart * 10) / 10, Math.round(newEnd * 10) / 10);
    }
  };

  const handleMouseUp = () => {
    setDragMode('none');
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(4.0, prev + 0.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(1.0, prev - 0.5));
  const handleZoomReset = () => {
    setZoomLevel(1.0);
    setScrollOffsetSec(0);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div className="space-y-2 select-none">
      {/* Waveform Header & Zoom Controls */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gelombang Suara Audio (Waveform)</span>
          </span>
          {isLoadingWaveform && (
            <span className="text-[10px] text-cyan-400 animate-pulse font-mono font-semibold">
              Menganalisis audio...
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1.0}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-300 px-1 font-bold">
            {zoomLevel.toFixed(1)}x
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 4.0}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            title="Zoom In (Pemotongan Presisi)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoomLevel > 1.0 && (
            <button
              onClick={handleZoomReset}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-all ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas Wrapper */}
      <div
        ref={containerRef}
        className="relative w-full h-[130px] rounded-xl overflow-hidden border border-white/15 shadow-inner shadow-black/80 bg-[#05070E] group"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full block cursor-pointer"
        />

        {/* Floating Playhead Needle Indicator with Scissors button (Garis Jarum CapCut) */}
        <div
          className="absolute top-1 pointer-events-auto -translate-x-1/2 flex flex-col items-center z-30"
          style={{
            left: `${Math.max(
              0,
              Math.min(
                100,
                ((currentTime - currentScroll) / visibleDuration) * 100
              )
            )}%`,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onSplitAtPlayhead) onSplitAtPlayhead();
            }}
            className="px-1.5 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-black font-mono font-black text-[9px] shadow-lg flex items-center gap-1 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Klik untuk memotong/membagi audio di posisi garis ini (CapCut Split)"
          >
            <Scissors className="w-2.5 h-2.5" />
            <span>{formatTime(currentTime)}</span>
          </button>
        </div>

        {/* Floating Range Tooltips */}
        <div
          className="absolute bottom-1 pointer-events-none px-2 py-0.5 rounded bg-cyan-500/80 text-black font-mono font-black text-[9px] shadow-md transition-all"
          style={{
            left: `${Math.max(
              0,
              Math.min(
                90,
                ((trimStart - currentScroll) / visibleDuration) * 100
              )
            )}%`,
          }}
        >
          Mulai: {formatTime(trimStart)}
        </div>

        <div
          className="absolute bottom-1 pointer-events-none px-2 py-0.5 rounded bg-pink-500/80 text-white font-mono font-black text-[9px] shadow-md transition-all -translate-x-full"
          style={{
            left: `${Math.max(
              10,
              Math.min(
                100,
                ((trimEnd - currentScroll) / visibleDuration) * 100
              )
            )}%`,
          }}
        >
          Selesai: {formatTime(trimEnd)}
        </div>
      </div>

      {/* Interactive Helper Legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-cyan-300 font-semibold">
            <Scissors className="w-3 h-3 text-cyan-400" />
            <span>Garis Jarum Penanda (Potong di Sini)</span>
          </span>
          <span className="flex items-center gap-1 hidden sm:inline-flex">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            <span>Batas Mulai</span>
          </span>
          <span className="flex items-center gap-1 hidden sm:inline-flex">
            <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
            <span>Batas Selesai</span>
          </span>
        </div>
        <span className="text-slate-400 text-[10px]">
          💡 Geser garis atau klik tombol gunting untuk membagi audio jadi 2
        </span>
      </div>
    </div>
  );
};
