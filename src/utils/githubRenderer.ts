import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  AspectRatio,
  AudioTrack,
  RenderExportOptions,
  EffectsConfig,
} from '../types/visualizer';

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  display_title?: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export const WORKFLOW_FILE_TEMPLATE = `name: Specterr Online Cloud Visualizer Render
run-name: '🎬 \${{ inputs.track_title }}'

on:
  workflow_dispatch:
    inputs:
      config_json:
        description: 'Visualizer Configuration JSON (inline, optional)'
        required: false
        default: ''
        type: string
      config_file:
        description: 'Path to config JSON file in repository (for large configs)'
        required: false
        default: ''
        type: string
      audio_url:
        description: 'Audio File URL or Sample Track ID'
        required: false
        default: 'sample'
        type: string
      resolution:
        description: 'Video Resolution'
        required: false
        default: '1080p'
        type: choice
        options:
          - '1080p'
          - '4k'
          - '720p'
      aspect_ratio:
        description: 'Video Aspect Ratio (e.g. 9:16 for TikTok/Shorts, 16:9 for YouTube)'
        required: false
        default: '16:9'
        type: choice
        options:
          - '9:16'
          - '16:9'
          - '1:1'
          - '4:5'
      fps:
        description: 'Frame Rate'
        required: false
        default: '60'
        type: choice
        options:
          - '60'
          - '30'
      track_title:
        description: 'Music Track Title'
        required: false
        default: 'Visualizer_Render'
        type: string
      duration_seconds:
        description: 'Duration in seconds (0 for full track)'
        required: false
        default: '30'
        type: string
      start_time:
        description: 'Start time in seconds (e.g. 45 for chorus/reff)'
        required: false
        default: '0'
        type: string

jobs:
  render:
    runs-on: ubuntu-latest
    name: 🎬 Render Specterr Video
    permissions:
      contents: write
      actions: write
    steps:
      - name: 📥 Checkout Repository
        uses: actions/checkout@v4

      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: 🎞️ Setup FFmpeg
        run: |
          which ffmpeg || (sudo apt-get update -qq && sudo apt-get install -y ffmpeg)
          ffmpeg -version

      - name: 📦 Install Dependencies & Build Render Harness
        run: |
          npm ci || npm install
          npm install puppeteer
          npm run build

      - name: 📝 Save Config File
        env:
          CONFIG_CONTENT: \${{ inputs.config_json }}
          CONFIG_FILE_PATH: \${{ inputs.config_file }}
        run: |
          mkdir -p dist-render
          if [ -n "$CONFIG_FILE_PATH" ] && [ -f "$CONFIG_FILE_PATH" ]; then
            echo "📄 Using config file from repository: $CONFIG_FILE_PATH"
            cp "$CONFIG_FILE_PATH" dist-render/config.json
          else
            echo "📝 Using inline config_json"
            echo "$CONFIG_CONTENT" > dist-render/config.json
          fi

      - name: 🚀 Run Headless Pixel-Perfect Cloud Renderer
        run: |
          node scripts/cloud-render.cjs \\
            --config-file dist-render/config.json \\
            --title '\${{ inputs.track_title }}' \\
            --audio '\${{ inputs.audio_url }}' \\
            --aspect-ratio '\${{ inputs.aspect_ratio }}' \\
            --resolution '\${{ inputs.resolution }}' \\
            --fps '\${{ inputs.fps }}' \\
            --duration '\${{ inputs.duration_seconds }}' \\
            --start-time '\${{ inputs.start_time }}'

      - name: 📤 Upload Rendered MP4 Video
        uses: actions/upload-artifact@v4
        with:
          name: \${{ inputs.track_title }}-\${{ github.run_id }}
          path: dist-render/*.mp4
          retention-days: 7

      - name: 🚀 Publish Direct Download Release
        uses: softprops/action-gh-release@v2
        if: success()
        with:
          tag_name: render-\${{ github.run_id }}
          name: \${{ inputs.track_title }} (Run #\${{ github.run_id }})
          files: dist-render/*.mp4
          make_latest: false
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

export interface GitHubArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
  created_at: string;
}

export class GitHubRendererService {
  /**
   * Package lightweight Specterr visualizer project configuration into JSON string (< 5KB)
   */
  public static packageProject(
    visualizer: VisualizerConfig,
    centerLogo: CenterLogoConfig,
    background: BackgroundConfig,
    particles: ParticlesConfig,
    typography: TypographyConfig,
    subtitle: SubtitleConfig,
    aspectRatio: AspectRatio,
    currentTrack: AudioTrack,
    options: RenderExportOptions,
    audioRepoPath?: string,
    effects?: EffectsConfig
  ): string {
    return JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      aspectRatio,
      track: {
        title: currentTrack.title,
        artist: currentTrack.artist,
        genre: currentTrack.genre,
        url: audioRepoPath || (currentTrack.url.startsWith('blob:') ? 'sample' : currentTrack.url),
      },
      visualizer,
      centerLogo,
      background,
      particles,
      typography,
      subtitle,
      effects,
      exportOptions: options,
    });
  }

  /**
   * Upload audio file directly to GitHub repository to avoid workflow dispatch 65KB payload limit
   */
  public static async uploadAudioToRepo(
    repo: string,
    token: string,
    filename: string,
    base64Data: string
  ): Promise<string> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const cleanBase64 = base64Data.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
    const safeName = (filename || 'custom_audio')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
    const filePath = `audio-uploads/${safeName}-${Date.now()}.mp3`;
    const url = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload audio for cloud visualizer render: ${filename}`,
        content: cleanBase64,
        branch: 'main',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message || `Failed to upload audio to repository (HTTP ${res.status}). Check token permissions.`
      );
    }

    return filePath;
  }

  /**
   * Compress and resize a local blob image into a lightweight JPEG/PNG base64 string (< 250KB)
   */
  public static async compressBlobImage(
    blobUrl: string,
    maxDim: number = 1920,
    quality: number = 0.85
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gagal memuat file gambar untuk kompresi'));
      img.src = blobUrl;
    });
  }

  /**
   * Upload image file directly to GitHub repository (under image-uploads/) to bypass 65KB payload limit
   */
  public static async uploadImageToRepo(
    repo: string,
    token: string,
    prefix: string,
    base64Data: string
  ): Promise<string> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9+]+;base64,/, '');
    const isJpeg = base64Data.startsWith('data:image/jpeg') || base64Data.startsWith('data:image/jpg');
    const ext = isJpeg ? 'jpg' : 'png';
    const safePrefix = (prefix || 'img')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const filePath = `image-uploads/${safePrefix}-${Date.now()}.${ext}`;
    const url = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload ${safePrefix} asset for cloud visualizer render`,
        content: cleanBase64,
        branch: 'main',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message || `Failed to upload image to repository (HTTP ${res.status}). Check token permissions.`
      );
    }

    return filePath;
  }

  /**
   * Automatically ensure that the repository's .github/workflows/render-visualizer.yml has support for config_file input.
   * If it doesn't exist or is an older version without config_file, updates it automatically.
   */
  public static async ensureWorkflowUpToDate(repo: string, token: string): Promise<void> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const workflowPath = '.github/workflows/render-visualizer.yml';
    const checkUrl = `https://api.github.com/repos/${cleanRepo}/contents/${workflowPath}`;

    try {
      const getRes = await fetch(checkUrl, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      let sha: string | undefined = undefined;
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        // Decode existing workflow file content
        try {
          const rawContent = atob(fileData.content.replace(/\s/g, ''));
          if (rawContent.includes('config_file:')) {
            // Workflow already supports config_file input!
            return;
          }
        } catch {}
      }

      // If file doesn't exist or doesn't have config_file, create/update it
      const base64Content = utf8ToBase64(WORKFLOW_FILE_TEMPLATE);
      const putRes = await fetch(checkUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Update render-visualizer workflow with config_file support',
          content: base64Content,
          branch: 'main',
          ...(sha ? { sha } : {}),
        }),
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        console.warn('Could not auto-update workflow in repo (may already be running or permissions restricted):', err);
      }
    } catch (e) {
      console.warn('ensureWorkflowUpToDate check skipped:', e);
    }
  }

  /**
   * Upload full project configuration JSON to repo (under render-configs/) to bypass workflow dispatch 65KB limit
   */
  public static async uploadConfigToRepo(
    repo: string,
    token: string,
    trackTitle: string,
    configJson: string
  ): Promise<string> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const safeTitle = (trackTitle || 'config')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const filePath = `render-configs/config-${safeTitle}-${Date.now()}.json`;
    const url = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}`;

    const base64Content = utf8ToBase64(configJson);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload render config for: ${trackTitle || 'visualizer'}`,
        content: base64Content,
        branch: 'main',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message || `Failed to upload config JSON to repository (HTTP ${res.status}). Check token permissions.`
      );
    }

    return filePath;
  }

  /**
   * Dispatch a cloud render workflow on GitHub Actions with custom track title
   */
  public static async dispatchCloudRender(
    repo: string,
    token: string,
    projectJson: string,
    audioUrl: string,
    trackTitle: string,
    options: RenderExportOptions,
    durationSeconds: number = 30,
    configFilePath?: string
  ): Promise<boolean> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const cleanTitle = (trackTitle || 'Visualizer_Render')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Visualizer_Render';

    const url = `https://api.github.com/repos/${cleanRepo}/actions/workflows/render-visualizer.yml/dispatches`;

    // GitHub Actions workflow_dispatch strictly enforces a max of 65,536 characters for inputs.
    // If configFilePath is provided, NEVER send inline config_json (keep it empty) to prevent 65KB payload limit errors.
    // If configFilePath is not provided, only send inline if projectJson is safely under 32,000 characters.
    const inlineConfig = configFilePath ? '' : (projectJson.length <= 32000 ? projectJson : '');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          config_json: inlineConfig,
          config_file: configFilePath || '',
          audio_url: audioUrl.startsWith('blob:') ? 'sample' : audioUrl,
          track_title: cleanTitle,
          aspect_ratio: options.aspectRatio || '16:9',
          resolution: options.resolution,
          fps: options.fps.toString(),
          duration_seconds: durationSeconds.toString(),
          start_time: (options.startTime || 0).toString(),
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message ||
          `GitHub API Error (HTTP ${res.status}): Make sure your repository exists, has .github/workflows/render-visualizer.yml, and your token has "actions:write" / "repo" permission.`
      );
    }

    return true;
  }

  /**
   * Get latest workflow runs for the visualizer workflow
   */
  public static async getLatestRuns(
    repo: string,
    token: string
  ): Promise<GitHubWorkflowRun[]> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const url = `https://api.github.com/repos/${cleanRepo}/actions/workflows/render-visualizer.yml/runs?per_page=6&_t=${Date.now()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch workflow runs (HTTP ${res.status})`);
    }

    const data = await res.json();
    const runs: GitHubWorkflowRun[] = data.workflow_runs || [];

    // Enrich runs with exact music track title from artifacts if display_title is default
    const enrichedRuns = await Promise.all(
      runs.map(async (run) => {
        if (!run.display_title || run.display_title === 'Specterr Online Cloud Visualizer Render') {
          try {
            const artifacts = await this.getRunArtifacts(repo, token, run.id);
            if (artifacts && artifacts.length > 0) {
              const cleanArtifactTitle = artifacts[0].name
                .replace(new RegExp(`-${run.id}$`), '')
                .replace(/_/g, ' ');
              return {
                ...run,
                display_title: cleanArtifactTitle,
              };
            }
          } catch {}
        }
        return run;
      })
    );

    return enrichedRuns;
  }

  /**
   * Get generated video artifacts for a run
   */
  public static async getRunArtifacts(
    repo: string,
    token: string,
    runId: number
  ): Promise<GitHubArtifact[]> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const url = `https://api.github.com/repos/${cleanRepo}/actions/runs/${runId}/artifacts?_t=${Date.now()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.artifacts || [];
  }

  /**
   * Get direct downloadable URL for IDM / external download managers
   */
  public static async getDirectDownloadInfo(
    repo: string,
    token: string,
    runId: number,
    trackTitle?: string
  ): Promise<{ downloadUrl: string; filename: string; isMp4: boolean }> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const cleanTitle = (trackTitle || 'Visualizer_Render')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Visualizer_Render';

    // 1. Try local server endpoint which resolves signed S3/Azure direct URL
    try {
      const apiUrl = `/api/get-direct-download-url?repo=${encodeURIComponent(cleanRepo)}&runId=${runId}&token=${encodeURIComponent(token.trim())}&title=${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.directUrl) {
          return {
            downloadUrl: data.directUrl,
            filename: data.filename || `${cleanTitle}.mp4`,
            isMp4: Boolean(data.isMp4),
          };
        }
      }
    } catch {}

    // 2. Direct public release check on GitHub API
    try {
      const relRes = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/tags/render-${runId}`, {
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/vnd.github.v3+json' },
      });
      if (relRes.ok) {
        const relData = await relRes.json();
        const mp4Asset = relData.assets?.find((a: any) => a.name?.endsWith('.mp4'));
        if (mp4Asset?.browser_download_url) {
          return {
            downloadUrl: mp4Asset.browser_download_url,
            filename: mp4Asset.name || `${cleanTitle}.mp4`,
            isMp4: true,
          };
        }
      }
    } catch {}

    // 3. Fallback to proxy route
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
    const proxyUrl = `${origin}/api/download-render-video?repo=${encodeURIComponent(cleanRepo)}&runId=${runId}&token=${encodeURIComponent(token.trim())}&title=${encodeURIComponent(cleanTitle)}`;
    return {
      downloadUrl: proxyUrl,
      filename: `${cleanTitle}.mp4`,
      isMp4: true,
    };
  }

  /**
   * Directly download and extract rendered MP4 video from GitHub Release or Artifact into browser
   */
  public static async downloadRunVideoDirectly(
    repo: string,
    token: string,
    runId: number,
    trackTitle: string,
    onStatus?: (status: string) => void
  ): Promise<void> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const cleanTitle = (trackTitle || 'Visualizer_Render')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Visualizer_Render';

    // --- Strategy 1: Local Vite Proxy (Direct High-Speed Browser Download, handles private repo auth) ---
    try {
      if (onStatus) onStatus('Menghubungkan ke jalur download langsung...');
      const proxyUrl = `/api/download-render-video?repo=${encodeURIComponent(cleanRepo)}&runId=${runId}&token=${encodeURIComponent(token.trim())}`;
      
      const checkRes = await fetch(proxyUrl, { method: 'HEAD' });
      if (checkRes.ok || checkRes.status === 302 || checkRes.redirected || checkRes.type === 'opaqueredirect') {
        if (onStatus) onStatus('🚀 Memulai unduhan MP4 langsung...');
        const a = document.createElement('a');
        a.href = proxyUrl;
        a.download = `${cleanTitle}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (onStatus) onStatus('✅ File MP4 sedang diunduh ke komputer Anda!');
        return;
      }
    } catch (e) {
      console.warn('Proxy download not available or failed, falling back to client artifact extraction:', e);
    }

    // --- Strategy 2: Client-side Streaming Artifact Download (100% Reliable for Private Repos) ---
    if (onStatus) onStatus('Mencari file video dari server GitHub Actions...');
    const artifacts = await this.getRunArtifacts(repo, token, runId);

    if (!artifacts || artifacts.length === 0) {
      throw new Error(
        'File video tidak ditemukan di server GitHub. Pastikan proses render selesai dengan status sukses.'
      );
    }

    const targetArtifact = artifacts[0];
    const totalBytes = targetArtifact.size_in_bytes || 1;
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

    if (onStatus) onStatus(`Menghubungi server penyimpanan (${totalMb} MB)...`);

    const downloadUrl = `https://api.github.com/repos/${cleanRepo}/actions/artifacts/${targetArtifact.id}/zip`;
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });

    if (!response.ok) {
      throw new Error(`Gagal mengunduh dari server GitHub (HTTP ${response.status}). Pastikan Token PAT Anda valid.`);
    }

    // Stream download with live progress percentage
    if (!response.body) {
      throw new Error('ReadableStream tidak didukung di browser ini.');
    }

    const reader = response.body.getReader();
    let receivedBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        if (onStatus) {
          const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
          const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
          onStatus(`Mengunduh MP4 dari GitHub (${mb} / ${totalMb} MB) • ${pct}%...`);
        }
      }
    }

    if (onStatus) onStatus('Mengekstrak file MP4 video murni...');
    const zipBlob = new Blob(chunks as any, { type: 'application/zip' });

    // Dynamically load JSZip from CDN
    const importDynamic = new Function('modulePath', 'return import(modulePath)');
    const JSZipModule = await importDynamic('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
    const JSZip = JSZipModule.default || JSZipModule;

    const zip = await JSZip.loadAsync(zipBlob);
    let mp4File: any = null;
    zip.forEach((relativePath: string, file: any) => {
      if (relativePath.endsWith('.mp4') && !file.dir) {
        mp4File = file;
      }
    });

    if (mp4File) {
      const mp4Blob = await mp4File.async('blob');
      const blobUrl = URL.createObjectURL(new Blob([mp4Blob], { type: 'video/mp4' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${cleanTitle}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      if (onStatus) onStatus('✅ MP4 video berhasil diunduh dan disimpan!');
    } else {
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `${cleanTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);
      if (onStatus) onStatus('⚠️ File ZIP berhasil diunduh.');
    }
  }
}
