import { useState, useRef, useCallback } from 'react';

export function useVideoRecorder() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startExport = useCallback(
    async (
      canvas: HTMLCanvasElement,
      totalDurationSeconds: number,
      renderFrameCallback: (timeMs: number) => void,
      onComplete: (url: string) => void
    ) => {
      setIsExporting(true);
      setProgress(0);
      setDownloadUrl(null);
      chunksRef.current = [];

      try {
        const stream = canvas.captureStream(30); // 30 FPS
        
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8000000, // 8 Mbps high quality
        });

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setIsExporting(false);
          setProgress(100);
          onComplete(url);
        };

        recorder.start(100);

        // Frame by frame simulation loop
        const fps = 30;
        const totalFrames = Math.ceil(totalDurationSeconds * fps);
        const frameIntervalMs = 1000 / fps;
        let currentFrame = 0;

        const renderNext = () => {
          if (currentFrame >= totalFrames) {
            setTimeout(() => {
              if (recorder.state !== 'inactive') {
                recorder.stop();
              }
            }, 300);
            return;
          }

          const currentTimeMs = currentFrame * frameIntervalMs;
          renderFrameCallback(currentTimeMs);
          setProgress(Math.round((currentFrame / totalFrames) * 100));

          currentFrame++;
          setTimeout(renderNext, 1000 / (fps * 2)); // Render fast for quick export
        };

        renderNext();
      } catch (err) {
        console.error('Export video failed:', err);
        setIsExporting(false);
      }
    },
    []
  );

  const cancelExport = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsExporting(false);
    setProgress(0);
  }, []);

  return {
    isExporting,
    progress,
    downloadUrl,
    startExport,
    cancelExport,
  };
}
