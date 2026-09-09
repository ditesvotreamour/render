/**
 * Specterr Cloud Render Pipeline - Headless Canvas & Hardware-Accelerated FFmpeg
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
  console.log('🚀 Starting Specterr Pixel-Perfect Cloud Render Engine...');

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

  // Pre-inline any repository image assets into base64 data URIs so Puppeteer loads them instantly
  const resolveImageToDataUri = (imgUrl) => {
    if (!imgUrl || typeof imgUrl !== 'string') return imgUrl;
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      return imgUrl;
    }
    const candidatePaths = [
      path.resolve(imgUrl),
      path.resolve('dist', imgUrl),
      path.resolve(imgUrl.replace(/^\/+/, '')),
    ];
    for (const cPath of candidatePaths) {
      if (fs.existsSync(cPath) && fs.statSync(cPath).isFile()) {
        const ext = path.extname(cPath).toLowerCase();
        const mime =
          ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
            ? 'image/webp'
            : ext === '.svg'
            ? 'image/svg+xml'
            : 'image/png';
        const fileBuf = fs.readFileSync(cPath);
        console.log(`🖼️ Inlined local asset: ${imgUrl} (${(fileBuf.length / 1024).toFixed(1)} KB)`);
        return `data:${mime};base64,${fileBuf.toString('base64')}`;
      }
    }
    return imgUrl;
  };

  if (config.background) {
    if (config.background.customImageUrl) {
      config.background.customImageUrl = resolveImageToDataUri(config.background.customImageUrl);
    }
    if (Array.isArray(config.background.multiImageUrls)) {
      config.background.multiImageUrls = config.background.multiImageUrls.map(resolveImageToDataUri);
    }
    if (Array.isArray(config.background.multiImageSlides)) {
      config.background.multiImageSlides = config.background.multiImageSlides.map(slide => {
        if (slide && slide.url) {
          return { ...slide, url: resolveImageToDataUri(slide.url) };
        }
        return slide;
      });
    }
  }
  if (config.centerLogo && config.centerLogo.imageUrl) {
    config.centerLogo.imageUrl = resolveImageToDataUri(config.centerLogo.imageUrl);
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

  // Start Lightweight HTTP Server to serve /dist and repo root
  const distDir = path.resolve('dist');
  const rootDir = path.resolve('.');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '/render.html') {
      reqPath = '/render.html';
    }
    let filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.join(rootDir, reqPath);
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
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
        '.mp3': 'audio/mpeg',
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
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

  // Launch Puppeteer Headless Browser
  console.log('🤖 Launching Headless Chrome render worker...');
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    puppeteer = require('puppeteer-core');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-webgpu',
    ],
  });

  const page = await browser.newPage();

  // Set viewport matching target video aspect ratio & resolution
  console.log(`📐 Setting Headless Viewport: ${viewW}x${viewH} (Aspect: ${aspectRatio}, Res: ${resolution})`);
  await page.setViewport({ width: viewW, height: viewH, deviceScaleFactor: 1 });

  console.log(`📄 Loading render harness from http://127.0.0.1:${port}/render.html...`);
  await page.goto(`http://127.0.0.1:${port}/render.html`, { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('🔤 Waiting for Google Fonts & typography to be fully ready in browser context...');
  await page.evaluate(async () => {
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
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
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
