import type { RenderExportOptions } from '../types/visualizer';
import { globalAudioEngine } from './audioEngine';

export class VideoExporter {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private exportTimer: number | null = null;
  private targetCanvas: HTMLCanvasElement | null = null;
  private prevCanvasWidth: number = 0;
  private prevCanvasHeight: number = 0;

  private restoreCanvasDimensions(): void {
    if (this.targetCanvas && this.prevCanvasWidth > 0 && this.prevCanvasHeight > 0) {
      this.targetCanvas.width = this.prevCanvasWidth;
      this.targetCanvas.height = this.prevCanvasHeight;
    }
    this.targetCanvas = null;
    this.prevCanvasWidth = 0;
    this.prevCanvasHeight = 0;
  }

  public async exportVideo(
    canvas: HTMLCanvasElement,
    options: RenderExportOptions,
    totalTrackDuration: number,
    onProgress: (progress: number, secondsElapsed: number, totalSeconds: number) => void,
    onComplete: (blobUrl: string, blob: Blob, mimeType: string) => void,
    onError?: (err: Error) => void
  ): Promise<void> {
    if (this.isRecording) {
      throw new Error('Export is already in progress');
    }

    try {
      this.recordedChunks = [];
      this.isRecording = true;

      // 1. Calculate duration and start time to record (e.g. Chorus / Reff segment)
      const startTime = Math.max(0, options.startTime || 0);
      let targetDuration = totalTrackDuration || 30;

      if (options.durationMode === 'clip_15') {
        targetDuration = Math.min(15, Math.max(1, totalTrackDuration - startTime));
      } else if (options.durationMode === 'clip_30') {
        targetDuration = Math.min(30, Math.max(1, totalTrackDuration - startTime));
      } else if (options.durationMode === 'clip_60') {
        targetDuration = Math.min(60, Math.max(1, totalTrackDuration - startTime));
      } else if (options.durationMode === 'custom_range') {
        const endTime = options.endTime !== undefined ? options.endTime : (startTime + 30);
        targetDuration = Math.max(1, endTime - startTime);
      } else {
        targetDuration = Math.max(1, totalTrackDuration - startTime);
      }

      // 2. Enforce true export canvas dimensions (not low-res preview dimensions)
      const targetAspect = options.aspectRatio || '16:9';
      const targetRes = options.resolution || '1080p';
      let targetW = 1920;
      let targetH = 1080;

      if (targetRes === '4k') {
        switch (targetAspect) {
          case '9:16': targetW = 2160; targetH = 3840; break;
          case '1:1': targetW = 2160; targetH = 2160; break;
          case '4:5': targetW = 2160; targetH = 2700; break;
          case '16:9':
          default: targetW = 3840; targetH = 2160; break;
        }
      } else if (targetRes === '720p') {
        switch (targetAspect) {
          case '9:16': targetW = 720; targetH = 1280; break;
          case '1:1': targetW = 720; targetH = 720; break;
          case '4:5': targetW = 720; targetH = 900; break;
          case '16:9':
          default: targetW = 1280; targetH = 720; break;
        }
      } else {
        // 1080p default
        switch (targetAspect) {
          case '9:16': targetW = 1080; targetH = 1920; break;
          case '1:1': targetW = 1080; targetH = 1080; break;
          case '4:5': targetW = 1080; targetH = 1350; break;
          case '16:9':
          default: targetW = 1920; targetH = 1080; break;
        }
      }

      this.targetCanvas = canvas;
      this.prevCanvasWidth = canvas.width;
      this.prevCanvasHeight = canvas.height;

      // Temporarily scale canvas buffer to true export resolution so captureStream records full sharpness
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      // 3. Prepare Audio Engine & Seek to start position
      await globalAudioEngine.initAudioContext();
      globalAudioEngine.seek(startTime);
      await globalAudioEngine.play();

      // 4. Prepare Canvas Stream (60 FPS / 30 FPS)
      const fps = options.fps || 60;
      const canvasStream = canvas.captureStream(fps);

      // 5. Prepare Audio Stream
      const audioDestination = globalAudioEngine.getAudioStreamDestination();
      const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      if (audioDestination && audioDestination.stream.getAudioTracks().length > 0) {
        combinedTracks.push(...audioDestination.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);

      // 6. Select best supported MIME type (Priority: VP9/H264 -> MP4 -> WebM)
      const candidateTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];

      let mimeType = candidateTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';

      const is60Fps = (options.fps || 30) >= 60;
      const bitrate =
        options.resolution === '4k'
          ? (is60Fps ? 35000000 : 25000000)
          : options.resolution === '1080p'
          ? (is60Fps ? 18000000 : 12000000)
          : (is60Fps ? 8000000 : 5000000);

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 320000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.restoreCanvasDimensions();
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        this.isRecording = false;
        if (this.exportTimer) {
          clearInterval(this.exportTimer);
          this.exportTimer = null;
        }
        globalAudioEngine.pause();
        onComplete(blobUrl, blob, mimeType);
      };

      // 7. Start recorder
      this.mediaRecorder.start(100);

      const recordStartTime = Date.now();
      this.exportTimer = window.setInterval(() => {
        const elapsedSec = (Date.now() - recordStartTime) / 1000;
        const progress = Math.min(100, Math.round((elapsedSec / targetDuration) * 100));

        onProgress(progress, Math.floor(elapsedSec), Math.floor(targetDuration));

        if (elapsedSec >= targetDuration) {
          this.stopExport();
        }
      }, 250);
    } catch (err) {
      this.restoreCanvasDimensions();
      this.isRecording = false;
      if (this.exportTimer) {
        clearInterval(this.exportTimer);
        this.exportTimer = null;
      }
      globalAudioEngine.pause();
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  public stopExport(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = null;
    }
    this.restoreCanvasDimensions();
    globalAudioEngine.pause();
    this.isRecording = false;
  }

  public cancel(): void {
    this.stopExport();
  }
}

export const globalVideoExporter = new VideoExporter();
