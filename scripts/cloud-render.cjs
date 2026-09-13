/**
 * BeatFlow Cloud Render Pipeline - Headless Canvas & Hardware-Accelerated FFmpeg
 * Renders 100% pixel-perfect visualizer matching the browser studio canvas.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

function getArg(name, defaultValue = '') {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

async function main() {
  console.log('🚀 Starting BeatFlow Pixel-Perfect Cloud Render Engine...');

  let configJson = getArg('--config-json', '');
  const configFile = getArg('--config-file', '');
  if (!configJson && configFile && fs.existsSync(configFile)) {
    configJson = fs.readFileSync(configFile, 'utf8');
  }

  let config = {};
  try {
    config = JSON.parse(configJson);
  } catch (e) {
    console.warn('⚠️ Could not parse JSON config, using defaults:', e.message);
  }

  const audioUrl = getArg('--audio-url', getArg('--audio', 'sample'));
  const trackTitle = getArg('--track-title', getArg('--title', 'visualizer-export'));
  const aspectRatio = getArg('--aspect-ratio', '') || config.aspectRatio || config.exportOptions?.aspectRatio || '16:9';
  const resolution = getArg('--resolution', '') || config.exportOptions?.resolution || config.options?.resolution || '1080p';
  const fps = parseInt(getArg('--fps', config.exportOptions?.fps || '60'), 10) || 60;
  const durationSeconds = parseInt(getArg('--duration', '30'), 10) || 30;
  const startTime = Math.max(0, parseInt(getArg('--start-time', '0'), 10) || 0);

  // Calculate pixel-perfect viewport & canvas dimensions
  let viewW = 1920;
  let viewH = 1080;

  if (aspectRatio === '9:16') {
    if (resolution === '4k') {
      viewW = 2160;
      viewH = 3840;
    } else if (resolution === '720p') {
      viewW = 720;
      viewH = 1280;
    } else {
      // 1080p Full HD Portrait
      viewW = 1080;
      viewH = 1920;
    }
  } else if (aspectRatio === '1:1') {
    if (resolution === '4k') {
      viewW = 2160;
      viewH = 2160;
    } else if (resolution === '720p') {
      viewW = 720;
      viewH = 720;
    } else {
      viewW = 1080;
      viewH = 1080;
    }
  } else if (aspectRatio === '4:5') {
    if (resolution === '4k') {
      viewW = 2160;
      viewH = 2700;
    } else if (resolution === '720p') {
      viewW = 864;
      viewH = 1080;
    } else {
      viewW = 1080;
      viewH = 1350;
    }
  } else {
    // 16:9 Landscape
    if (resolution === '4k') {
      viewW = 3840;
      viewH = 2160;
    } else if (resolution === '720p') {
      viewW = 1280;
      viewH = 720;
    } else {
      viewW = 1920;
      viewH = 1080;
    }
  }

  const outputDir = path.resolve('dist-render');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeTitle = trackTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const outputPath = path.join(outputDir, `${safeTitle}-visualizer.mp4`);

  // Start Lightweight HTTP Server to serve /dist and repo root with Range request support for videos
  const distDir = path.resolve('dist');
  const rootDir = path.resolve('.');
  const mimeMap = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.ogv': 'video/ogg',
    '.mkv': 'video/x-matroska',
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '/render.html') {
      reqPath = '/render.html';
    }
    let filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.join(rootDir, reqPath);
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const stat = fs.statSync(filePath);
      const contentType = mimeMap[ext] || 'application/octet-stream';
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const port = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });

  console.log(`🌐 Local render server started on http://127.0.0.1:${port}`);

  const isVideoExt = (ext) => ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.mkv'].includes(ext);

  // Materialize or resolve media assets (images as base64 or HTTP, videos served via HTTP with Range support)
  let inlineVidCounter = 0;
  const localVideoMap = new Map(); // url -> local disk path

  const resolveMediaAsset = (mediaUrl, forceVideo = false) => {
    if (!mediaUrl || typeof mediaUrl !== 'string') return mediaUrl;

    // If data:video/... is embedded, write it to dist-render/ and serve via HTTP so Chrome decodes it natively
    if (mediaUrl.startsWith('data:video/') || (forceVideo && mediaUrl.startsWith('data:'))) {
      const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1].toLowerCase();
        const ext = mime.includes('webm') ? 'webm' : mime.includes('mov') || mime.includes('quicktime') ? 'mov' : 'mp4';
        const fileName = `dist-render/inline_video_${++inlineVidCounter}.${ext}`;
        const filePath = path.resolve(fileName);
        fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
        const httpUrl = `http://127.0.0.1:${port}/${fileName}`;
        localVideoMap.set(httpUrl, filePath);
        console.log(`🎥 Materialized inline video to HTTP asset: ${httpUrl}`);
        return httpUrl;
      }
    }

    // Already HTTP URL
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      return mediaUrl;
    }

    // Candidate relative disk paths
    const candidatePaths = [
      path.resolve(mediaUrl),
      path.resolve('dist', mediaUrl),
      path.resolve(mediaUrl.replace(/^\/+/, '')),
    ];

    for (const cPath of candidatePaths) {
      if (fs.existsSync(cPath) && fs.statSync(cPath).isFile()) {
        const ext = path.extname(cPath).toLowerCase();
        if (isVideoExt(ext) || forceVideo) {
          const relPath = path.relative(rootDir, cPath).replace(/\\/g, '/');
          const httpUrl = `http://127.0.0.1:${port}/${relPath}`;
          localVideoMap.set(httpUrl, cPath);
          console.log(`🎥 Serving local video via HTTP: ${httpUrl}`);
          return httpUrl;
        }
        const mime = mimeMap[ext] || 'image/png';
        const fileBuf = fs.readFileSync(cPath);
        console.log(`🖼️ Inlined local image asset: ${mediaUrl} (${(fileBuf.length / 1024).toFixed(1)} KB)`);
        return `data:${mime};base64,${fileBuf.toString('base64')}`;
      }
    }
    return mediaUrl;
  };

  const ensureLocalVideoFile = async (vidUrl) => {
    if (localVideoMap.has(vidUrl)) return localVideoMap.get(vidUrl);
    if (vidUrl.startsWith('http://') || vidUrl.startsWith('https://')) {
      try {
        const vidFileName = `dist-render/remote_vid_${++inlineVidCounter}.mp4`;
        const vidFilePath = path.resolve(vidFileName);
        console.log(`⬇️ Downloading video asset for frame extraction: ${vidUrl}`);
        const fetch = (await import('node-fetch')).default || global.fetch;
        const res = await fetch(vidUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(vidFilePath, buffer);
        localVideoMap.set(vidUrl, vidFilePath);
        return vidFilePath;
      } catch (err) {
        console.warn('⚠️ Failed to download video for frame extraction:', err.message);
        return null;
      }
    }
    return null;
  };

  const extractVideoFrames = async (videoPath, targetFps) => {
    try {
      const hash = path.basename(videoPath, path.extname(videoPath)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const framesDirRel = `dist-render/frames_${hash}_${targetFps}fps`;
      const framesDir = path.resolve(framesDirRel);
      if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
      }

      const existingFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
      if (existingFiles.length > 0) {
        console.log(`🎞️ Reusing ${existingFiles.length} extracted frames for ${path.basename(videoPath)}`);
        return {
          urlPattern: `http://127.0.0.1:${port}/${framesDirRel.replace(/\\/g, '/')}/frame_%06d.jpg`,
          fps: targetFps,
          frameCount: existingFiles.length,
        };
      }

      console.log(`🎞️ Extracting frames with FFmpeg for ${path.basename(videoPath)} @ ${targetFps} FPS...`);
      await new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
          '-y',
          '-i', videoPath,
          '-vf', `fps=${targetFps}`,
          '-q:v', '2',
          path.join(framesDir, 'frame_%06d.jpg'),
        ], { stdio: ['ignore', 'ignore', 'inherit'] });
        proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg frame extraction exited with code ${code}`))));
        proc.on('error', reject);
      });

      const count = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).length;
      console.log(`✅ Successfully extracted ${count} frames for ${path.basename(videoPath)}`);
      return {
        urlPattern: `http://127.0.0.1:${port}/${framesDirRel.replace(/\\/g, '/')}/frame_%06d.jpg`,
        fps: targetFps,
        frameCount: count,
      };
    } catch (e) {
      console.warn(`⚠️ FFmpeg frame extraction failed for ${videoPath}, falling back to direct video:`, e.message);
      return null;
    }
  };

  if (config.background) {
    if (config.background.customImageUrl) {
      const isVid = isVideoExt(path.extname(config.background.customImageUrl.split('?')[0]).toLowerCase());
      config.background.customImageUrl = resolveMediaAsset(config.background.customImageUrl, isVid);
      if (isVid) {
        const diskPath = await ensureLocalVideoFile(config.background.customImageUrl);
        if (diskPath) {
          const frameSeq = await extractVideoFrames(diskPath, fps);
          if (frameSeq) {
            config.background.videoFrameSequence = frameSeq;
          }
        }
      }
    }
    if (Array.isArray(config.background.multiImageUrls)) {
      config.background.multiImageUrls = config.background.multiImageUrls.map(u => resolveMediaAsset(u));
    }
    if (Array.isArray(config.background.multiImageSlides)) {
      for (const slide of config.background.multiImageSlides) {
        if (slide && slide.url) {
          const isVid = slide.mediaType === 'video' || isVideoExt(path.extname(slide.url.split('?')[0]).toLowerCase());
          slide.url = resolveMediaAsset(slide.url, isVid);
          if (isVid) {
            slide.mediaType = 'video';
            const diskPath = await ensureLocalVideoFile(slide.url);
            if (diskPath) {
              const frameSeq = await extractVideoFrames(diskPath, fps);
              if (frameSeq) {
                slide.frameSequence = frameSeq;
              }
            }
          }
        }
      }
    }
    if (config.background.bRoll && Array.isArray(config.background.bRoll.clips)) {
      for (const clip of config.background.bRoll.clips) {
        if (clip && clip.url) {
          const isVid = clip.mediaType === 'video' || isVideoExt(path.extname(clip.url.split('?')[0]).toLowerCase());
          clip.url = resolveMediaAsset(clip.url, isVid);
          if (isVid) {
            clip.mediaType = 'video';
            const diskPath = await ensureLocalVideoFile(clip.url);
            if (diskPath) {
              const frameSeq = await extractVideoFrames(diskPath, fps);
              if (frameSeq) {
                clip.frameSequence = frameSeq;
              }
            }
          }
        }
      }
    }
  }
  if (config.centerLogo && config.centerLogo.imageUrl) {
    config.centerLogo.imageUrl = resolveMediaAsset(config.centerLogo.imageUrl);
  }
  if (config.effects && config.effects.videoBackground && config.effects.videoBackground.customVideoUrl) {
    config.effects.videoBackground.customVideoUrl = resolveMediaAsset(config.effects.videoBackground.customVideoUrl, true);
  }

  // Determine Audio File
  let tempAudioPath = path.resolve('public/sample-audio.mp3');
  if (audioUrl && audioUrl !== 'sample' && !audioUrl.startsWith('blob:')) {
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      console.log(`⬇️ Downloading audio from URL: ${audioUrl}`);
      tempAudioPath = path.join(outputDir, 'input_audio.mp3');
      const fetch = (await import('node-fetch')).default || global.fetch;
      const res = await fetch(audioUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(tempAudioPath, buffer);
    } else if (fs.existsSync(audioUrl)) {
      tempAudioPath = path.resolve(audioUrl);
    }
  }

  if (!fs.existsSync(tempAudioPath)) {
    console.log('⚠️ Sample audio not found, generating tone placeholder...');
    tempAudioPath = path.join(outputDir, 'tone.mp3');
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', 'sine=frequency=440:duration=60',
        '-c:a', 'aac',
        '-b:a', '192k',
        tempAudioPath,
      ]);
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg sine failed: ${code}`))));
    });
  }

  console.log(`🎵 Using Audio Source: ${tempAudioPath}`);
  const audioBuffer = fs.readFileSync(tempAudioPath);
  const audioBase64 = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

  // Launch Puppeteer Headless Browser with native H.264 video codec detection
  console.log('🤖 Launching Headless Chrome render worker...');
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    puppeteer = require('puppeteer-core');
  }

  let executablePath;
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
  }

  if (executablePath) {
    console.log(`🚀 Using browser executable with full H.264/AAC video codec support: ${executablePath}`);
  }

  const isGpu = process.argv.includes('--gpu') || process.env.RENDER_GPU === '1';
  const chromeArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--allow-file-access-from-files',
    '--enable-features=NetworkService,NetworkServiceInProcess',
  ];

  if (isGpu) {
    console.log('⚡ GPU Acceleration enabled for Chrome renderer (Colab / GPU Runner)');
    chromeArgs.push(
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--use-gl=angle',
      '--use-angle=gl-egl'
    );
  } else {
    chromeArgs.push(
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-webgpu'
    );
  }

  const launchOptions = {
    headless: 'new',
    args: chromeArgs,
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await puppeteer.launch(launchOptions);

  const page = await browser.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('Download the React DevTools')) {
      console.log('🖥️ [BROWSER]:', text);
    }
  });
  page.on('pageerror', (err) => {
    console.error('❌ [BROWSER ERROR]:', err.message);
  });
  page.on('requestfailed', (req) => {
    console.warn('⚠️ [BROWSER REQ FAILED]:', req.url(), req.failure()?.errorText);
  });

  // Set viewport matching target video aspect ratio & resolution
  console.log(`📐 Setting Headless Viewport: ${viewW}x${viewH} (Aspect: ${aspectRatio}, Res: ${resolution})`);
  await page.setViewport({ width: viewW, height: viewH, deviceScaleFactor: 1 });

  console.log(`📄 Loading render harness from http://127.0.0.1:${port}/render.html...`);
  await page.goto(`http://127.0.0.1:${port}/render.html`, { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('🔤 Waiting for Google Fonts & typography to be fully ready in browser context...');
  await page.evaluate(async () => {
    const fontPreloads = [
      'bold 46px "Playfair Display"',
      'italic bold 46px "Playfair Display"',
      'bold 46px "Anton"',
      'bold 46px "Bebas Neue"',
      'bold 46px "Courier Prime"',
      'italic bold 46px "Courier Prime"',
      'bold 46px "Special Elite"',
      'bold 46px "Montserrat"',
      'bold 46px "Kanit"',
      'italic bold 46px "Kanit"',
      'bold 46px "Rubik"',
      'bold 46px "Impact"',
      'bold 46px "Inter"',
      'bold 46px "Cinzel"',
      'bold 46px "Black Ops One"',
      'bold 46px "Orbitron"',
      'bold 46px "Poppins"',
      'bold 46px "Syne"',
      'bold 46px "Syncopate"',
    ];
    if (document.fonts && document.fonts.load) {
      await Promise.allSettled(fontPreloads.map((f) => document.fonts.load(f)));
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });

  console.log('⚡ Initializing audio FFT analyzer and visualizer canvas in browser context...');
  const initSuccess = await page.evaluate(
    async (cfg, audioDataUri) => {
      return await window.__INIT_RENDER__(cfg, audioDataUri);
    },
    config,
    audioBase64
  );

  if (!initSuccess) {
    throw new Error('Canvas render initialization failed in browser context.');
  }

  const totalFrames = Math.max(1, Math.floor(durationSeconds * fps));
  console.log(`🎬 Total Frames to Render: ${totalFrames} (${durationSeconds}s @ ${fps} FPS, Start: ${startTime}s, Target: ${viewW}x${viewH} ${aspectRatio})`);

  // Start FFmpeg Subprocess for Pipe Ingestion with explicit dimension scaling
  console.log('🎥 Spawning FFmpeg video encoder...');
  let videoEncoderArgs = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18'];
  if (isGpu || process.argv.includes('--nvenc')) {
    try {
      const { execSync } = require('child_process');
      const encoders = execSync('ffmpeg -encoders', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (encoders.includes('h264_nvenc')) {
        console.log('🚀 NVIDIA NVENC Hardware Video Encoder detected & enabled!');
        videoEncoderArgs = ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '20', '-b:v', '0'];
      }
    } catch {
      // fallback to libx264
    }
  }

  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', `${fps}`,
    '-s', `${viewW}x${viewH}`,
    '-i', '-', // standard input
    ...(startTime > 0 ? ['-ss', `${startTime}`] : []),
    '-t', `${durationSeconds}`,
    '-i', tempAudioPath,
    '-map', '0:v',
    '-map', '1:a',
    ...videoEncoderArgs,
    '-vf', `scale=${viewW}:${viewH}:force_original_aspect_ratio=decrease,pad=${viewW}:${viewH}:(ow-iw)/2:(oh-ih)/2`,
    '-c:a', 'aac',
    '-b:a', '320k',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ];

  const ffmpegProc = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

  ffmpegProc.on('error', (err) => {
    console.error('❌ FFmpeg process error:', err);
  });

  const startTimeRender = Date.now();

  for (let frame = 0; frame < totalFrames; frame++) {
    const dataUrl = await page.evaluate(
      (fIdx, fRate, sTime) => window.__RENDER_FRAME__(fIdx, fRate, sTime),
      frame,
      fps,
      startTime
    );

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuf = Buffer.from(base64Data, 'base64');

    const canWrite = ffmpegProc.stdin.write(imgBuf);
    if (!canWrite) {
      await new Promise((res) => ffmpegProc.stdin.once('drain', res));
    }

    if (frame % 60 === 0 || frame === totalFrames - 1) {
      const pct = Math.round(((frame + 1) / totalFrames) * 100);
      const elapsed = ((Date.now() - startTimeRender) / 1000).toFixed(1);
      const fpsReal = ((frame + 1) / ((Date.now() - startTimeRender) / 1000)).toFixed(1);
      console.log(`[${pct}%] Rendered Frame ${frame + 1}/${totalFrames} (${elapsed}s elapsed, ~${fpsReal} FPS)`);
    }
  }

  ffmpegProc.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpegProc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });

  await browser.close();
  server.close();

  const totalSec = ((Date.now() - startTimeRender) / 1000).toFixed(1);
  const stats = fs.statSync(outputPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('====================================================');
  console.log(`✅ VISUALIZER VIDEO RENDER COMPLETED SUCCESSFULLY!`);
  console.log(`📁 Output File: ${outputPath}`);
  console.log(`📦 File Size: ${sizeMb} MB`);
  console.log(`⏱️ Total Render Time: ${totalSec}s`);
  console.log('====================================================');
}

main().catch((err) => {
  console.error('❌ Render Pipeline Failed:', err);
  process.exit(1);
});
