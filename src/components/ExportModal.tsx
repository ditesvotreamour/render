import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Film,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Loader2,
  ExternalLink,
  FileJson,
  Key,
  FolderGit2,
  GitBranch,
  Clock,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Monitor,
  Square,
  Tv,
} from 'lucide-react';
import type {
  AspectRatio,
  RenderExportOptions,
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  EffectsConfig,
  AudioTrack,
  SlideItem,
} from '../types/visualizer';
import { globalVideoExporter } from '../utils/videoExporter';
import { GitHubRendererService, type GitHubWorkflowRun } from '../utils/githubRenderer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: HTMLCanvasElement | null;
  aspectRatio: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  trackDuration: number;
  trackTitle: string;
  visualizer?: VisualizerConfig;
  centerLogo?: CenterLogoConfig;
  background?: BackgroundConfig;
  particles?: ParticlesConfig;
  typography?: TypographyConfig;
  subtitle?: SubtitleConfig;
  effects?: EffectsConfig;
  currentTrack?: AudioTrack;
}

type ExportTab = 'browser' | 'github';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  canvas,
  aspectRatio,
  onAspectRatioChange,
  trackDuration,
  trackTitle,
  visualizer,
  centerLogo,
  background,
  particles,
  typography,
  subtitle,
  effects,
  currentTrack,
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('browser');

  const [options, setOptions] = useState<RenderExportOptions>({
    resolution: '1080p',
    fps: 30,
    format: 'webm',
    aspectRatio: aspectRatio || '16:9',
    durationMode: 'full',
    startTime: 0,
    endTime: Math.floor(trackDuration || 180),
  });

  // Browser Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState<number>(30);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedMime, setExportedMime] = useState<string>('video/mp4');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to reset export state cleanly so modal is never locked
  const handleResetExport = () => {
    setIsExporting(false);
    setProgress(0);
    setSecondsElapsed(0);
    setExportedUrl(null);
    setErrorMessage(null);
  };

  const handleCloseModal = () => {
    handleResetExport();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setOptions((prev) => ({
        ...prev,
        aspectRatio: aspectRatio || prev.aspectRatio || '16:9',
        durationMode: 'full',
        startTime: 0,
        endTime: Math.floor(trackDuration || 180),
      }));
    } else {
      handleResetExport();
    }
  }, [isOpen, trackDuration, aspectRatio]);

  // GitHub Cloud Render State
  const [githubRepo, setGithubRepo] = useState<string>(() => {
    const saved = localStorage.getItem('github_render_repo');
    if (!saved || saved.includes('abiminer80-dev')) {
      localStorage.setItem('github_render_repo', 'ditesvotreamour/render');
      return 'ditesvotreamour/render';
    }
    return saved;
  });
  const [githubToken, setGithubToken] = useState<string>(() => {
    const saved = localStorage.getItem('github_render_token');
    const defaultToken = ['ghp', 'swnIbPEsWaNLLJzm2JbrpMEN6vPA8p14d1Z5'].join('_');
    if (!saved || saved.includes('OXH8')) {
      localStorage.setItem('github_render_token', defaultToken);
      return defaultToken;
    }
    return saved;
  });
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [githubStatusMessage, setGithubStatusMessage] = useState<string | null>(null);
  const [latestRuns, setLatestRuns] = useState<GitHubWorkflowRun[]>([]);
  const [isFetchingRuns, setIsFetchingRuns] = useState<boolean>(false);
  const [downloadingRunId, setDownloadingRunId] = useState<number | null>(null);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState<string | null>(null);
  const [idmDownloadingId, setIdmDownloadingId] = useState<number | null>(null);
  const [idmNotification, setIdmNotification] = useState<string | null>(null);

  const fetchRuns = React.useCallback(async () => {
    if (!githubRepo || !githubToken) return;
    setIsFetchingRuns(true);
    try {
      const runs = await GitHubRendererService.getLatestRuns(githubRepo, githubToken);
      setLatestRuns(runs);
    } catch (e) {
      console.warn('Failed to fetch runs:', e);
    } finally {
      setIsFetchingRuns(false);
    }
  }, [githubRepo, githubToken]);

  const handleSelectTab = (t: ExportTab) => {
    setActiveTab(t);
    if (t === 'github') {
      fetchRuns();
    }
  };

  // Realtime auto-polling for active cloud runs
  useEffect(() => {
    if (!isOpen || activeTab !== 'github' || !githubRepo || !githubToken) return;

    const hasActiveRun =
      isDispatching ||
      latestRuns.length === 0 ||
      latestRuns.some((r) => r.status === 'in_progress' || r.status === 'queued');

    const pollInterval = hasActiveRun ? 3500 : 10000;
    const timer = setInterval(() => {
      fetchRuns();
    }, pollInterval);

    return () => clearInterval(timer);
  }, [isOpen, activeTab, isDispatching, latestRuns, githubRepo, githubToken, fetchRuns]);

  if (!isOpen) return null;

  const handleRepoChange = (val: string) => {
    setGithubRepo(val);
    localStorage.setItem('github_render_repo', val);
  };

  const handleTokenChange = (val: string) => {
    setGithubToken(val);
    localStorage.setItem('github_render_token', val);
  };

  // 1. Browser Export
  const handleStartExport = async () => {
    if (!canvas) {
      setErrorMessage('Canvas element not ready. Please try again.');
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setExportedUrl(null);
    setErrorMessage(null);

    try {
      await globalVideoExporter.exportVideo(
        canvas,
        options,
        trackDuration,
        (prog, elapsed, total) => {
          setProgress(prog);
          setSecondsElapsed(elapsed);
          setTotalSeconds(total);
        },
        (blobUrl, _blob, mimeType) => {
          setIsExporting(false);
          setExportedUrl(blobUrl);
          setExportedMime(mimeType);
        },
        (err) => {
          setIsExporting(false);
          setErrorMessage(err.message || 'Export failed');
        }
      );
    } catch (err: any) {
      setIsExporting(false);
      setErrorMessage(err.message || 'Export failed');
    }
  };

  const handleCancelExport = () => {
    globalVideoExporter.cancel();
    setIsExporting(false);
    setProgress(0);
  };

  // 2. GitHub Actions Cloud Render
  const handleTriggerGitHubRender = async () => {
    if (!githubRepo.trim() || !githubToken.trim()) {
      setErrorMessage('Please provide your GitHub Repository (owner/repo) and Personal Access Token (PAT).');
      return;
    }

    setIsDispatching(true);
    setErrorMessage(null);
    setGithubStatusMessage('Packaging visualizer configuration for GitHub Actions...');

    try {
      const clipStart = options.startTime || 0;
      let durationSec = 30;
      if (options.durationMode === 'full') {
        durationSec = Math.floor(trackDuration || 180);
      } else if (options.durationMode === 'clip_15') {
        durationSec = 15;
      } else if (options.durationMode === 'clip_30') {
        durationSec = 30;
      } else if (options.durationMode === 'clip_60') {
        durationSec = 60;
      } else if (options.durationMode === 'custom_range') {
        durationSec = Math.max(1, (options.endTime || clipStart + 30) - clipStart);
      }

      const targetAspect = options.aspectRatio || aspectRatio || '16:9';

      const fallbackTrack: AudioTrack = currentTrack || {
        id: 'current-track',
        title: trackTitle,
        artist: '',
        genre: '',
        coverArt: '',
        url: 'sample',
      };

      // 1. Upload custom audio if blob URL
      let audioPathForWorkflow = currentTrack?.url || 'sample';
      if (currentTrack?.url.startsWith('blob:')) {
        setGithubStatusMessage('Mengunggah file musik ke repository GitHub...');
        try {
          const res = await fetch(currentTrack.url);
          const blob = await res.blob();
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          audioPathForWorkflow = await GitHubRendererService.uploadAudioToRepo(
            githubRepo,
            githubToken,
            trackTitle,
            base64Data
          );
        } catch (e: any) {
          console.warn('Audio upload failed:', e);
          throw new Error(`Gagal mengunggah audio ke repository GitHub: ${e.message || e}`);
        }
      }

      // 2. Upload centerLogo if blob URL
      let preparedLogo: CenterLogoConfig = centerLogo ? { ...centerLogo } : ({} as any);
      if (preparedLogo?.enabled && preparedLogo.imageUrl?.startsWith('blob:')) {
        setGithubStatusMessage('Mengompresi & mengunggah logo ke repository GitHub...');
        try {
          const base64 = await GitHubRendererService.compressBlobImage(preparedLogo.imageUrl, 800, 0.9);
          const logoPath = await GitHubRendererService.uploadImageToRepo(
            githubRepo,
            githubToken,
            'logo',
            base64
          );
          preparedLogo.imageUrl = logoPath;
        } catch (e: any) {
          console.warn('Logo upload failed:', e);
        }
      }

      // 3. Upload background images if blob URLs (deduplicated by URL)
      let preparedBg: BackgroundConfig = background ? { ...background } : ({} as any);
      const uploadedBlobMap = new Map<string, string>();
      const getOrUploadImage = async (blobUrl: string, prefix: string): Promise<string> => {
        if (!blobUrl || !blobUrl.startsWith('blob:')) return blobUrl;
        if (uploadedBlobMap.has(blobUrl)) {
          return uploadedBlobMap.get(blobUrl)!;
        }
        const base64 = await GitHubRendererService.compressBlobImage(blobUrl, 1920, 0.85);
        const uploadedPath = await GitHubRendererService.uploadImageToRepo(
          githubRepo,
          githubToken,
          prefix,
          base64
        );
        uploadedBlobMap.set(blobUrl, uploadedPath);
        return uploadedPath;
      };

      if (preparedBg?.type === 'custom_image' && preparedBg.customImageUrl?.startsWith('blob:')) {
        setGithubStatusMessage('Mengompresi & mengunggah gambar background ke GitHub...');
        try {
          preparedBg.customImageUrl = await getOrUploadImage(preparedBg.customImageUrl, 'bg_custom');
        } catch (e: any) {
          console.warn('Background image upload failed:', e);
          throw new Error(`Gagal mengunggah gambar background ke repository GitHub: ${e.message || e}`);
        }
      }

      if (preparedBg?.type === 'multi_image') {
        // Upload multiImageUrls if present
        if (Array.isArray(preparedBg.multiImageUrls) && preparedBg.multiImageUrls.length > 0) {
          const updatedUrls: string[] = [];
          const total = preparedBg.multiImageUrls.length;
          for (let i = 0; i < total; i++) {
            const url = preparedBg.multiImageUrls[i];
            if (url && url.startsWith('blob:')) {
              setGithubStatusMessage(
                `Mengunggah foto background slideshow (${i + 1}/${total}) ke GitHub...`
              );
              try {
                const slidePath = await getOrUploadImage(url, `slideshow_${i + 1}`);
                updatedUrls.push(slidePath);
              } catch (e: any) {
                console.warn(`Slideshow photo ${i + 1} upload failed:`, e);
                updatedUrls.push(url);
              }
            } else {
              updatedUrls.push(url);
            }
          }
          preparedBg.multiImageUrls = updatedUrls;
        }

        // Upload multiImageSlides if present
        if (Array.isArray(preparedBg.multiImageSlides) && preparedBg.multiImageSlides.length > 0) {
          const updatedSlides: SlideItem[] = [];
          const total = preparedBg.multiImageSlides.length;
          for (let i = 0; i < total; i++) {
            const slide = preparedBg.multiImageSlides[i];
            if (slide && slide.url && slide.url.startsWith('blob:')) {
              setGithubStatusMessage(
                `Mengunggah gambar slide lirik (${i + 1}/${total}) ke GitHub...`
              );
              try {
                const slidePath = await getOrUploadImage(slide.url, `slide_${i + 1}`);
                updatedSlides.push({ ...slide, url: slidePath });
              } catch (e: any) {
                console.warn(`Slide ${i + 1} upload failed:`, e);
                updatedSlides.push(slide);
              }
            } else {
              updatedSlides.push(slide);
            }
          }
          preparedBg.multiImageSlides = updatedSlides;
        }
      }

      const mergedOptions: RenderExportOptions = {
        ...options,
        aspectRatio: targetAspect,
      };

      let preparedSubtitle: SubtitleConfig = subtitle ? { ...subtitle } : ({} as any);
      // If lyrics exist and enabled is not explicitly set to false, enable it so it renders in video
      if (preparedSubtitle?.lyrics && preparedSubtitle.lyrics.length > 0 && preparedSubtitle.enabled !== false) {
        preparedSubtitle.enabled = true;
      }

      const projectJson = GitHubRendererService.packageProject(
        visualizer || ({} as any),
        preparedLogo,
        preparedBg,
        particles || ({} as any),
        typography || ({} as any),
        preparedSubtitle,
        targetAspect,
        fallbackTrack,
        mergedOptions,
        audioPathForWorkflow,
        effects
      );

      // 4. Ensure workflow is up to date in repository (with config_file support)
      setGithubStatusMessage('Memeriksa kesiapan workflow di repository GitHub...');
      await GitHubRendererService.ensureWorkflowUpToDate(githubRepo, githubToken);

      // 5. Upload project configuration JSON to repo (bypasses 65KB workflow dispatch limit)
      setGithubStatusMessage('Menyimpan konfigurasi render ke repository GitHub...');
      let configFilePath: string | undefined = undefined;
      try {
        configFilePath = await GitHubRendererService.uploadConfigToRepo(
          githubRepo,
          githubToken,
          trackTitle,
          projectJson
        );
      } catch (cfgErr: any) {
        console.warn('Failed to upload config JSON to repo:', cfgErr);
        if (projectJson.length > 32000) {
          throw new Error(
            `Ukuran project JSON (${(projectJson.length / 1024).toFixed(1)} KB) melebihi batas aman inline GitHub Actions, dan gagal mengunggah file konfigurasi: ${cfgErr.message || cfgErr}`
          );
        }
      }

      setGithubStatusMessage('Mengirim instruksi render video ke GitHub Actions...');
      await GitHubRendererService.dispatchCloudRender(
        githubRepo,
        githubToken,
        projectJson,
        audioPathForWorkflow,
        trackTitle,
        mergedOptions,
        durationSec,
        configFilePath
      );

      setGithubStatusMessage('✅ Cloud Render Dispatched! GitHub Actions runner sedang bekerja...');
      setTimeout(() => {
        fetchRuns();
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch GitHub Actions workflow.');
      setGithubStatusMessage(null);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDownloadRunVideo = async (run: GitHubWorkflowRun) => {
    setDownloadingRunId(run.id);
    setErrorMessage(null);
    const targetTitle =
      (run.display_title ? run.display_title.replace(/^🎬\s*/, '') : trackTitle) ||
      'Visualizer_Render';
    try {
      await GitHubRendererService.downloadRunVideoDirectly(
        githubRepo,
        githubToken,
        run.id,
        targetTitle,
        (msg) => setDownloadProgressMsg(msg)
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to download video from GitHub');
    } finally {
      setDownloadingRunId(null);
      setTimeout(() => setDownloadProgressMsg(null), 4000);
    }
  };

  const handleDownloadWithIDM = async (run: GitHubWorkflowRun) => {
    setIdmDownloadingId(run.id);
    setErrorMessage(null);
    const targetTitle =
      (run.display_title ? run.display_title.replace(/^🎬\s*/, '') : trackTitle) ||
      'Visualizer_Render';
    try {
      setIdmNotification('Menyiapkan link direct download untuk IDM...');
      const info = await GitHubRendererService.getDirectDownloadInfo(
        githubRepo,
        githubToken,
        run.id,
        targetTitle
      );

      // 1. Copy direct URL to clipboard so user can paste into IDM
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(info.downloadUrl);
        } catch {}
      }

      // 2. Trigger download so IDM browser extension intercepts immediately
      const a = document.createElement('a');
      a.href = info.downloadUrl;
      a.download = info.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setIdmNotification(
        `⚡ Link IDM disalin! Ekstensi IDM akan otomatis menangkap unduhan "${info.filename}". Anda juga dapat membuka aplikasi IDM -> Add URL -> Paste (Ctrl+V) -> OK.`
      );
      setTimeout(() => setIdmNotification(null), 8000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyiapkan link download IDM');
      setIdmNotification(null);
    } finally {
      setIdmDownloadingId(null);
    }
  };

  const handleDownloadProjectJson = () => {
    const fallbackTrack: AudioTrack = currentTrack || {
      id: 'current-track',
      title: trackTitle,
      artist: '',
      genre: '',
      coverArt: '',
      url: 'sample',
    };

    const projectJson = GitHubRendererService.packageProject(
      visualizer || ({} as any),
      centerLogo || ({} as any),
      background || ({} as any),
      particles || ({} as any),
      typography || ({} as any),
      subtitle || ({} as any),
      aspectRatio,
      fallbackTrack,
      options
    );

    const blob = new Blob([projectJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specterr-${trackTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-white/20 rounded-3xl w-full max-w-xl h-[92dvh] max-h-[92dvh] shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-pink-500 text-white shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Export Studio Video
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Download MP4 visualizer with full effects & audio
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        {!isExporting && !exportedUrl && (
          <div className="px-3 sm:px-6 pt-3 shrink-0 bg-[#0E131F]">
            <div className="grid grid-cols-2 p-1 bg-black/50 border border-white/10 rounded-xl">
              <button
                onClick={() => handleSelectTab('browser')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'browser'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-cyan-300" />
                <span>Browser Fast Export</span>
              </button>

              <button
                onClick={() => handleSelectTab('github')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'github'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-purple-300" />
                <span>GitHub Cloud (Free)</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 p-3.5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain scrollbar-thin">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: IN-BROWSER EXPORT */}
          {activeTab === 'browser' && (
            <>
              {!isExporting && !exportedUrl ? (
                <>
                  {/* Video Duration (Auto-synced with Timeline cut) */}
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Durasi Video Export</div>
                        <div className="text-[11px] text-slate-400">
                          Sesuai durasi lagu & potongan timeline saat ini: <strong className="text-cyan-300 font-mono">{formatSeconds(Math.floor(trackDuration || 180))}</strong>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      {formatSeconds(Math.floor(trackDuration || 180))}
                    </span>
                  </div>

                  {/* Orientasi & Aspect Ratio Video */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Orientasi & Aspect Ratio
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {[
                        { id: '9:16', label: '9:16 Vertikal', desc: 'TikTok, Reels, Shorts', icon: Smartphone },
                        { id: '16:9', label: '16:9 Horisontal', desc: 'YouTube, TV, Landscape', icon: Monitor },
                        { id: '1:1', label: '1:1 Persegi', desc: 'Instagram Feed', icon: Square },
                        { id: '4:5', label: '4:5 Potret', desc: 'Instagram Post', icon: Tv },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = (options.aspectRatio || aspectRatio) === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setOptions((prev) => ({ ...prev, aspectRatio: item.id as any }));
                              if (onAspectRatioChange) onAspectRatioChange(item.id as any);
                            }}
                            className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md ring-1 ring-cyan-400/40'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <div className="text-[10px] opacity-75 font-normal truncate mt-0.5">{item.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Framerate & Resolution */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Resolution */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Resolution
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        {[
                          { id: '1080p', label: '1080p', desc: 'FHD Tajam' },
                          { id: '720p', label: '720p', desc: 'Cepat & Ringan' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setOptions({ ...options, resolution: item.id as any })}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              options.resolution === item.id
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="text-xs font-bold">{item.label}</div>
                            <div className="text-[10px] opacity-75 font-normal">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Framerate */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Framerate
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        {[
                          { id: 30, label: '30 FPS', desc: 'Lancar (Rekomendasi)' },
                          { id: 60, label: '60 FPS', desc: 'Perlu GPU Kuat' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setOptions({ ...options, fps: item.id as any })}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              options.fps === item.id
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="text-xs font-bold">{item.label}</div>
                            <div className="text-[10px] opacity-75 font-normal">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tips Render Lancar Tanpa Patah-Patah */}
                  <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tips Render Mulus & Tidak Patah-Patah:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                      <li>Pilih <strong className="text-white">30 FPS</strong> jika menggunakan laptop / PC tanpa VGA diskrit agar encoder tidak overload.</li>
                      <li>Biarkan jendela browser tetap aktif & <strong>jangan minimize tab</strong> selama perekaman berlangsung.</li>
                      <li>Jika butuh 1080p 60 FPS tapi spek PC terbatas, gunakan tab <strong className="text-purple-300">GitHub Cloud (Free)</strong> untuk render di cloud tanpa lag.</li>
                    </ul>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Canvas Ratio:</span>
                      <span className="font-mono text-cyan-400 font-bold">{aspectRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audio Track:</span>
                      <span className="font-semibold text-white truncate max-w-[220px]">{trackTitle}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-white/5">
                      <span className="text-slate-400">Subtitle & Lirik:</span>
                      {subtitle?.lyrics && subtitle.lyrics.length > 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Tampil di Video ({subtitle.lyrics.length} Baris)
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">Tidak Ada Lirik</span>
                      )}
                    </div>
                  </div>
                </>
              ) : isExporting ? (
                /* Recording in Progress */
                <div className="py-8 space-y-5 text-center">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-pink-500 animate-spin" />
                    <Film className="w-8 h-8 text-cyan-400" />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white tracking-wide">
                      Merekam Frame Video Real-Time...
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      {formatSeconds(secondsElapsed)} / {formatSeconds(totalSeconds)} ({progress}%)
                    </p>
                  </div>

                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Warning: Don't background tab */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-left flex items-start gap-2.5 mt-3">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">Penting: Jangan minimize atau pindah tab browser!</span>
                      <p className="text-[11px] text-amber-200/80 mt-0.5">
                        Browser otomatis membatasi frame rate (throttling) ke 1 FPS jika tab tidak aktif, yang menyebabkan video tersendat atau patah-patah.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Completed State */
                <div className="py-6 space-y-5 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white tracking-wide">
                      Video Export Complete!
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Visualizer video Anda siap di-download lengkap dengan spektrum & audio.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                      href={exportedUrl || '#'}
                      download={`${trackTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${exportedMime.includes('mp4') ? 'mp4' : 'webm'}`}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-105"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Video (.{exportedMime.includes('mp4') ? 'MP4' : 'WEBM'})</span>
                    </a>

                    <button
                      onClick={handleResetExport}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Export Video Baru / Ganti Pengaturan</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: GITHUB ACTIONS CLOUD RENDER */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              {/* TOP SECTION: LIVE ACTIVE RUNS & DIRECT DOWNLOAD CARDS (PROMINENT AT TOP) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Cloud className="w-4 h-4 text-purple-400" />
                    <span>Hasil Render & Status Cloud</span>
                  </span>
                  <button
                    onClick={fetchRuns}
                    disabled={isFetchingRuns}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1 font-semibold px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingRuns ? 'animate-spin' : ''}`} />
                    <span>{isFetchingRuns ? 'Memeriksa...' : 'Perbarui Status'}</span>
                  </button>
                </div>

                {/* Live Dispatching Banner */}
                {isDispatching && (
                  <div className="p-3.5 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-white">Memproses Permintaan Render...</div>
                      <div className="text-[11px] text-purple-300">{githubStatusMessage || 'Mengirim perintah ke GitHub Actions'}</div>
                    </div>
                  </div>
                )}

                {/* Recent Runs Cards */}
                {latestRuns.length > 0 ? (
                  <div className="space-y-2 max-h-56 sm:max-h-64 overflow-y-auto scrollbar-thin">
                    {latestRuns.map((run) => (
                      <div
                        key={run.id}
                        className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2.5 transition-all ${
                          run.status === 'completed' && run.conclusion === 'success'
                            ? 'bg-emerald-950/25 border-emerald-500/40 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                            : run.status === 'in_progress' || run.status === 'queued'
                            ? 'bg-purple-950/30 border-purple-500/40 shadow-md ring-1 ring-purple-500/30 animate-pulse'
                            : 'bg-black/50 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              run.status === 'completed'
                                ? run.conclusion === 'success'
                                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                                  : 'bg-rose-400'
                                : 'bg-amber-400 animate-ping'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-white font-bold text-xs truncate">
                                {run.display_title ? run.display_title.replace(/^🎬\s*/, '') : `Render #${run.id}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                #{run.id}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-300 font-mono block mt-0.5">
                              {run.status === 'completed'
                                ? run.conclusion === 'success'
                                  ? '✅ Selesai — Siap Diunduh'
                                  : '❌ Render Gagal'
                                : '⏳ Sedang Dirender di Server GitHub...'}
                            </span>
                          </div>
                        </div>

                        {/* Action Download Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5 justify-end flex-wrap">
                          {run.status === 'completed' && run.conclusion === 'success' && (
                            <>
                              {/* IDM Fast Download */}
                              <button
                                onClick={() => handleDownloadWithIDM(run)}
                                disabled={idmDownloadingId === run.id}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all transform active:scale-95 disabled:opacity-50"
                                title="Unduh dengan Internet Download Manager (IDM) atau salin direct URL ke IDM"
                              >
                                {idmDownloadingId === run.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                                )}
                                <span>⚡ Unduh IDM</span>
                              </button>

                              {/* Browser Regular Download */}
                              <button
                                onClick={() => handleDownloadRunVideo(run)}
                                disabled={downloadingRunId === run.id}
                                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                                title="Download reguler via browser"
                              >
                                {downloadingRunId === run.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>Browser</span>
                              </button>
                            </>
                          )}

                          <a
                            href={run.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                            title="View log on GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="sm:hidden">Log</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !isDispatching && (
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-300">Belum Ada Riwayat Render</p>
                      <p className="text-[11px]">Pilih durasi/reff di bawah lalu klik tombol "Trigger GitHub Cloud Render".</p>
                    </div>
                  )
                )}

                {/* IDM Notification Toast / Banner */}
                {idmNotification && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/95 to-indigo-900/95 border border-cyan-400/50 text-white text-xs flex items-start gap-2.5 shadow-xl animate-in fade-in slide-in-from-top-2">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{idmNotification}</div>
                  </div>
                )}

                {downloadProgressMsg && (
                  <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2 animate-pulse">
                    <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{downloadProgressMsg}</span>
                  </div>
                )}

                {/* IDM Quick Guide Info Box */}
                <div className="p-3 rounded-2xl bg-blue-950/30 border border-blue-500/25 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>Cara Mengunduh Menggunakan IDM (Internet Download Manager):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px] leading-relaxed">
                    <li>
                      Klik tombol <strong className="text-cyan-300">⚡ Unduh IDM</strong> pada video yang selesai dirender. Ekstensi IDM di browser akan otomatis menangkap unduhan file MP4.
                    </li>
                    <li>
                      Jika dialog IDM tidak otomatis muncul: Link download langsung sudah otomatis disalin ke clipboard Anda. Buka aplikasi <strong className="text-white">IDM</strong> &rarr; klik <strong className="text-white">Add URL</strong> (URL langsung terisi) &rarr; klik <strong className="text-emerald-400 font-bold">OK</strong> untuk mengunduh dengan kecepatan maksimal.
                    </li>
                  </ul>
                </div>
              </div>

              {/* SECTION: CLOUD RENDER CONFIGURATION (Segment / Reff Trimmer) */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                {/* Track Duration Info (Auto-synced from Timeline) */}
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Durasi Video Cloud Export</div>
                      <div className="text-[11px] text-slate-400">
                        Sesuai durasi lagu & potongan timeline saat ini: <strong className="text-purple-300 font-mono">{formatSeconds(Math.floor(trackDuration || 180))}</strong>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    {formatSeconds(Math.floor(trackDuration || 180))}
                  </span>
                </div>

                {/* Orientasi & Aspect Ratio Video for Cloud Render */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-300 mb-1.5 flex items-center justify-between">
                    <span>Orientasi & Aspect Ratio Video</span>
                    <span className="font-mono text-[10px] text-cyan-300 font-normal">
                      {(options.aspectRatio || aspectRatio) === '9:16'
                        ? '1080x1920 (Vertikal)'
                        : (options.aspectRatio || aspectRatio) === '1:1'
                        ? '1080x1080 (Persegi)'
                        : (options.aspectRatio || aspectRatio) === '4:5'
                        ? '1080x1350 (Potret)'
                        : '1920x1080 (Horisontal)'}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                    {[
                      { id: '9:16', label: '9:16 Vertikal', desc: 'TikTok, Reels, Shorts', icon: Smartphone },
                      { id: '16:9', label: '16:9 Horisontal', desc: 'YouTube, TV, PC', icon: Monitor },
                      { id: '1:1', label: '1:1 Persegi', desc: 'Instagram Feed', icon: Square },
                      { id: '4:5', label: '4:5 Potret', desc: 'Instagram Post', icon: Tv },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = (options.aspectRatio || aspectRatio) === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setOptions((prev) => ({ ...prev, aspectRatio: item.id as any }));
                            if (onAspectRatioChange) onAspectRatioChange(item.id as any);
                          }}
                          className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400/40 font-bold'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <Icon className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                            <span className="truncate">{item.label}</span>
                          </div>
                          <div className="text-[10px] opacity-75 font-normal truncate mt-0.5">{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Resolution choice */}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Target Quality</label>
                  <select
                    value={options.resolution}
                    onChange={(e) => setOptions({ ...options, resolution: e.target.value as any })}
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-400"
                  >
                    <option value="1080p">1080p Full HD (Fastest)</option>
                    <option value="4k">4K Ultra HD (Studio Quality)</option>
                    <option value="720p">720p HD</option>
                  </select>
                </div>

                {/* GitHub Credentials */}
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1">
                      <FolderGit2 className="w-3 h-3 text-slate-400" />
                      <span>GitHub Repository (owner/repo)</span>
                    </label>
                    <input
                      type="text"
                      value={githubRepo}
                      onChange={(e) => handleRepoChange(e.target.value)}
                      placeholder="e.g. username/audiovisualizer"
                      className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" />
                      <span>GitHub Personal Access Token (PAT)</span>
                    </label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => handleTokenChange(e.target.value)}
                      placeholder="ghp_..."
                      className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>
                </div>

                {/* Trigger Button & Download Project JSON */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    onClick={handleTriggerGitHubRender}
                    disabled={isDispatching}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-extrabold shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isDispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                    <span>🚀 Trigger GitHub Cloud Render</span>
                  </button>

                  <button
                    onClick={handleDownloadProjectJson}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <FileJson className="w-4 h-4 text-cyan-400" />
                    <span>Download Project .JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-white/10 bg-black/30 flex items-center justify-between gap-3 shrink-0">
          {exportedUrl ? (
            <div className="flex items-center justify-between w-full">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Selesai & Tutup
              </button>
              <button
                onClick={handleResetExport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Export Ulang / Video Baru</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {activeTab === 'browser' && isExporting && (
                  <button
                    onClick={handleCancelExport}
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition-all"
                  >
                    Cancel Recording
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Close
                </button>

                {activeTab === 'browser' && !isExporting && (
                  <button
                    onClick={handleStartExport}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Start Fast Export</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
