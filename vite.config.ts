import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import https from 'https';

const currentDir = import.meta.dirname || process.cwd();

function githubDownloadProxyPlugin(): Plugin {
  return {
    name: 'github-download-proxy',
    configureServer(server) {
      const getRedirect = (
        targetUrl: string,
        accept = 'application/vnd.github.v3+json',
        token: string
      ): Promise<{ location?: string; status: number; body?: string }> => {
        return new Promise((resolveReq) => {
          const r = https.request(
            targetUrl,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token.trim()}`,
                Accept: accept,
                'User-Agent': 'Specterr-Visualizer-App',
              },
            },
            (response) => {
              let data = '';
              response.on('data', (chunk) => (data += chunk));
              response.on('end', () => {
                resolveReq({
                  location: response.headers.location,
                  status: response.statusCode || 200,
                  body: data,
                });
              });
            }
          );
          r.on('error', (err) => resolveReq({ status: 500, body: err.message }));
          r.end();
        });
      };

      // 1. Direct signed URL resolver endpoint for IDM / external downloaders
      server.middlewares.use('/api/get-direct-download-url', async (req, res) => {
        try {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const url = new URL(req.url || '', 'http://localhost');
          const repo = url.searchParams.get('repo');
          const runId = url.searchParams.get('runId');
          const token = url.searchParams.get('token');
          const title = url.searchParams.get('title') || 'visualizer';

          if (!repo || !runId || !token) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing repo, runId, or token' }));
            return;
          }

          const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
          const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'visualizer';

          // Step 1: Check release tag
          const relRes = await getRedirect(
            `https://api.github.com/repos/${cleanRepo}/releases/tags/render-${runId}`,
            'application/vnd.github.v3+json',
            token
          );
          if (relRes.status === 200 && relRes.body) {
            try {
              const relData = JSON.parse(relRes.body);
              const mp4Asset = relData.assets?.find((a: any) => a.name?.endsWith('.mp4'));
              if (mp4Asset) {
                const assetRes = await getRedirect(
                  `https://api.github.com/repos/${cleanRepo}/releases/assets/${mp4Asset.id}`,
                  'application/octet-stream',
                  token
                );
                if (assetRes.location) {
                  res.end(
                    JSON.stringify({
                      directUrl: assetRes.location,
                      filename: mp4Asset.name || `${cleanTitle}.mp4`,
                      isMp4: true,
                    })
                  );
                  return;
                }
              }
            } catch {}
          }

          // Step 2: Fallback to artifact zip
          const artListRes = await getRedirect(
            `https://api.github.com/repos/${cleanRepo}/actions/runs/${runId}/artifacts`,
            'application/vnd.github.v3+json',
            token
          );
          if (artListRes.status === 200 && artListRes.body) {
            try {
              const artData = JSON.parse(artListRes.body);
              const art = artData.artifacts?.[0];
              if (art) {
                const artZipRes = await getRedirect(
                  `https://api.github.com/repos/${cleanRepo}/actions/artifacts/${art.id}/zip`,
                  'application/vnd.github.v3+json',
                  token
                );
                if (artZipRes.location) {
                  res.end(
                    JSON.stringify({
                      directUrl: artZipRes.location,
                      filename: `${cleanTitle}.zip`,
                      isMp4: false,
                    })
                  );
                  return;
                }
              }
            } catch {}
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Direct URL not found' }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message || String(e) }));
        }
      });

      // 2. Direct streaming / redirect download endpoint
      server.middlewares.use('/api/download-render-video', async (req, res) => {
        try {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const url = new URL(req.url || '', 'http://localhost');
          const repo = url.searchParams.get('repo');
          const runId = url.searchParams.get('runId');
          const token = url.searchParams.get('token');
          const title = url.searchParams.get('title') || 'visualizer';

          if (!repo || !runId || !token) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing repo, runId, or token' }));
            return;
          }

          const cleanRepo = repo.trim().replace(/^https:\/\/github\.com\//, '');
          const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'visualizer';

          // Step 1: Check release tag render-{runId}
          const relRes = await getRedirect(
            `https://api.github.com/repos/${cleanRepo}/releases/tags/render-${runId}`,
            'application/vnd.github.v3+json',
            token
          );
          let assetId: number | null = null;
          let assetName: string | null = null;
          if (relRes.status === 200 && relRes.body) {
            try {
              const relData = JSON.parse(relRes.body);
              const mp4Asset = relData.assets?.find((a: any) => a.name?.endsWith('.mp4'));
              if (mp4Asset) {
                assetId = mp4Asset.id;
                assetName = mp4Asset.name;
              }
            } catch {}
          }

          // If found release asset, request its direct signed binary URL
          if (assetId) {
            const assetRes = await getRedirect(
              `https://api.github.com/repos/${cleanRepo}/releases/assets/${assetId}`,
              'application/octet-stream',
              token
            );
            if (assetRes.location) {
              res.setHeader(
                'Content-Disposition',
                `attachment; filename="${encodeURIComponent(assetName || `${cleanTitle}.mp4`)}"`
              );
              res.writeHead(302, { Location: assetRes.location });
              res.end();
              return;
            }
          }

          // Step 2: Fallback to artifact download redirect
          const artListRes = await getRedirect(
            `https://api.github.com/repos/${cleanRepo}/actions/runs/${runId}/artifacts`,
            'application/vnd.github.v3+json',
            token
          );
          if (artListRes.status === 200 && artListRes.body) {
            try {
              const artData = JSON.parse(artListRes.body);
              const art = artData.artifacts?.[0];
              if (art) {
                const artZipRes = await getRedirect(
                  `https://api.github.com/repos/${cleanRepo}/actions/artifacts/${art.id}/zip`,
                  'application/vnd.github.v3+json',
                  token
                );
                if (artZipRes.location) {
                  res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${encodeURIComponent(`${cleanTitle}.zip`)}"`
                  );
                  res.writeHead(302, { Location: artZipRes.location });
                  res.end();
                  return;
                }
              }
            } catch {}
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Video render file not found on GitHub for run ' + runId }));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message || String(e) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), githubDownloadProxyPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(currentDir, 'index.html'),
        render: resolve(currentDir, 'render.html'),
      },
    },
  },
});

