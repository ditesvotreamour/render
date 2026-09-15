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
    name: 🎬 Render BeatFlow Video
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

      - name: 🎞️ Setup FFmpeg & Browser Video Codecs
        run: |
          which ffmpeg || (sudo apt-get update -qq && sudo apt-get install -y ffmpeg)
          ffmpeg -version
          which google-chrome || which google-chrome-stable || which chromium-browser || which chromium || true

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
   * Uploads large files (up to 100 MB) directly to GitHub repository using the official Git Data API (Blobs API).
   * This completely bypasses the 25 MB payload limit of GitHub's Contents API (/contents/{path}).
   */
  public static async uploadFileViaGitData(
    cleanRepo: string,
    token: string,
    filePath: string,
    cleanBase64: string,
    commitMessage: string
  ): Promise<string> {
    const authHeaders = {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // 1. Create Git Blob (supports up to 100 MB!)
    const blobRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/blobs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        content: cleanBase64,
        encoding: 'base64',
      }),
    });

    if (!blobRes.ok) {
      const err = await blobRes.json().catch(() => ({}));
      if (blobRes.status === 401) {
        throw new Error(
          `GitHub API menolak request (HTTP 401 Bad credentials). Ini terjadi jika token tidak memiliki akses ke ${cleanRepo} ATAU ukuran file melebihi batas request GitHub API Gateway (~25 MB). Harap gunakan audio MP3 yang dikompres.`
        );
      }
      throw new Error(
        err.message || `Gagal membuat Git Blob (HTTP ${blobRes.status}). Periksa kuota/ukuran file.`
      );
    }
    const blobData = await blobRes.json();
    const blobSha = blobData.sha;

    // 2. Identify default branch (e.g. 'main' or 'master')
    let defaultBranch = 'main';
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
        headers: authHeaders,
      });
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        if (repoData.default_branch) {
          defaultBranch = repoData.default_branch;
        }
      }
    } catch {
      // fallback to 'main'
    }

    // 3. Get latest commit SHA on default branch
    let refRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/ref/heads/${defaultBranch}`, {
      headers: authHeaders,
    });
    if (!refRes.ok && defaultBranch === 'main') {
      // Fallback check for 'master' branch
      const masterRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/ref/heads/master`, {
        headers: authHeaders,
      });
      if (masterRes.ok) {
        refRes = masterRes;
        defaultBranch = 'master';
      }
    }

    if (!refRes.ok) {
      const err = await refRes.json().catch(() => ({}));
      throw new Error(
        err.message || `Gagal membaca branch ${defaultBranch} (HTTP ${refRes.status}). Pastikan repository sudah memiliki branch utama.`
      );
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object?.sha || refData.sha;

    // 4. Get base tree SHA from latest commit
    const commitRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/commits/${latestCommitSha}`, {
      headers: authHeaders,
    });
    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}));
      throw new Error(err.message || `Gagal membaca commit tree (HTTP ${commitRes.status}).`);
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree?.sha || commitData.sha;

    // 5. Create new tree containing the uploaded blob
    const treeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          {
            path: filePath,
            mode: '100644',
            type: 'blob',
            sha: blobSha,
          },
        ],
      }),
    });
    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({}));
      throw new Error(err.message || `Gagal membuat Git Tree (HTTP ${treeRes.status}).`);
    }
    const treeData = await treeRes.json();
    const newTreeSha = treeData.sha;

    // 6. Create new commit
    const newCommitRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/commits`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [latestCommitSha],
      }),
    });
    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(err.message || `Gagal membuat Git Commit (HTTP ${newCommitRes.status}).`);
    }
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // 7. Update branch reference (points branch to new commit)
    const updateRefRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/refs/heads/${defaultBranch}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        sha: newCommitSha,
        force: false,
      }),
    });
    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(err.message || `Gagal memperbarui branch ref ${defaultBranch} (HTTP ${updateRefRes.status}).`);
    }

    return filePath;
  }

  /**
   * Upload file to GitHub repository with automatic payload optimization:
   * Uses fast Contents API for small files (< 4 MB), and seamlessly switches to
   * official Git Data Blobs API (supports up to 100 MB) for audio, video, or files that exceed 4 MB.
   */
  public static async uploadFileToRepo(
    repo: string,
    token: string,
    filePath: string,
    base64Data: string,
    commitMessage: string
  ): Promise<string> {
    const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
    const approxBytes = Math.round((cleanBase64.length * 3) / 4);

    // If file is 4MB or larger, skip Contents API and use Git Data Blobs API directly to prevent 422 "too large" errors
    if (approxBytes >= 4 * 1024 * 1024) {
      console.log(`📦 File ${filePath} berukuran besar (~${(approxBytes / 1024 / 1024).toFixed(1)} MB). Mengunggah via Git Data Blobs API (hingga 100 MB)...`);
      return this.uploadFileViaGitData(cleanRepo, token, filePath, cleanBase64, commitMessage);
    }

    // For smaller files, try fast Contents API first
    const url = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage,
          content: cleanBase64,
          branch: 'main',
        }),
      });

      if (res.ok) {
        return filePath;
      }

      const err = await res.json().catch(() => ({}));
      const errMsg = (err.message || '').toLowerCase();
      // If error indicates file is too large or status 422, automatically fallback to Git Data API!
      if (res.status === 422 || errMsg.includes('too large') || errMsg.includes('processed')) {
        console.warn(`Contents API menolak file karena melebihi batas 25MB (${err.message}). Beralih otomatis ke Git Data Blobs API (100 MB)...`);
        return this.uploadFileViaGitData(cleanRepo, token, filePath, cleanBase64, commitMessage);
      }

      throw new Error(err.message || `Gagal mengunggah ${filePath} (HTTP ${res.status}).`);
    } catch (e: any) {
      if ((e.message || '').toLowerCase().includes('too large') || (e.message || '').toLowerCase().includes('processed')) {
        return this.uploadFileViaGitData(cleanRepo, token, filePath, cleanBase64, commitMessage);
      }
      throw e;
    }
  }

  /**
   * Upload audio file directly to GitHub repository (supports up to 100 MB via Git Blobs API)
   */
  public static async uploadAudioToRepo(
    repo: string,
    token: string,
    filename: string,
    base64Data: string
  ): Promise<string> {
    let ext = 'mp3';
    if (base64Data.startsWith('data:audio/wav') || base64Data.startsWith('data:audio/x-wav')) ext = 'wav';
    else if (base64Data.startsWith('data:audio/flac')) ext = 'flac';
    else if (base64Data.startsWith('data:audio/ogg')) ext = 'ogg';
    else if (base64Data.startsWith('data:audio/mp4') || base64Data.startsWith('data:audio/m4a') || base64Data.startsWith('data:audio/x-m4a')) ext = 'm4a';
    else if (base64Data.startsWith('data:audio/aac')) ext = 'aac';
    else if (base64Data.startsWith('data:audio/webm')) ext = 'webm';

    const safeName = (filename || 'custom_audio')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
    const filePath = `audio-uploads/${safeName}-${Date.now()}.${ext}`;

    return this.uploadFileToRepo(
      repo,
      token,
      filePath,
      base64Data,
      `Upload audio for cloud visualizer render: ${filename}`
    );
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
   * Upload image or video file directly to GitHub repository (under image-uploads/ or video-uploads/)
   * Supports up to 100 MB files via Git Blobs API.
   */
  public static async uploadMediaToRepo(
    repo: string,
    token: string,
    prefix: string,
    base64Data: string,
    forcedExt?: string
  ): Promise<string> {
    let ext = forcedExt || 'png';
    let isVideo = false;

    const lowerPrefix = (prefix || '').toLowerCase();
    const isVideoHint =
      forcedExt === 'mp4' ||
      forcedExt === 'webm' ||
      forcedExt === 'mov' ||
      lowerPrefix.includes('video') ||
      lowerPrefix.includes('clip') ||
      lowerPrefix.startsWith('vid_') ||
      lowerPrefix.startsWith('bg_video');

    if (base64Data.startsWith('data:video/mp4') || forcedExt === 'mp4') {
      ext = 'mp4';
      isVideo = true;
    } else if (base64Data.startsWith('data:video/webm') || forcedExt === 'webm') {
      ext = 'webm';
      isVideo = true;
    } else if (base64Data.startsWith('data:video/quicktime') || forcedExt === 'mov') {
      ext = 'mov';
      isVideo = true;
    } else if (base64Data.startsWith('data:video/')) {
      ext = 'mp4';
      isVideo = true;
    } else if (isVideoHint) {
      ext = forcedExt || 'mp4';
      isVideo = true;
    } else if (base64Data.startsWith('data:image/jpeg') || base64Data.startsWith('data:image/jpg') || forcedExt === 'jpg') {
      ext = 'jpg';
    } else if (base64Data.startsWith('data:image/webp') || forcedExt === 'webp') {
      ext = 'webp';
    } else if (base64Data.startsWith('data:image/svg') || forcedExt === 'svg') {
      ext = 'svg';
    } else if (base64Data.startsWith('data:image/gif') || forcedExt === 'gif') {
      ext = 'gif';
    }

    const folder = isVideo ? 'video-uploads' : 'image-uploads';
    const safePrefix = (prefix || (isVideo ? 'vid' : 'img'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const filePath = `${folder}/${safePrefix}-${Date.now()}.${ext}`;

    return this.uploadFileToRepo(
      repo,
      token,
      filePath,
      base64Data,
      `Upload ${safePrefix} asset for cloud visualizer render`
    );
  }

  public static async uploadImageToRepo(
    repo: string,
    token: string,
    prefix: string,
    base64Data: string
  ): Promise<string> {
    return this.uploadMediaToRepo(repo, token, prefix, base64Data);
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
        if (!run.display_title || run.display_title === 'Specterr Online Cloud Visualizer Render' || run.display_title === 'BeatFlow Online Cloud Visualizer Render') {
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
