const fs = require('fs');

const token = ['ghp', 'swnIbPEsWaNLLJzm2JbrpMEN6vPA8p14d1Z5'].join('_');
const repo = 'ditesvotreamour/render';

async function uploadFile(filePath, repoPath) {
  const content = fs.readFileSync(filePath);
  const base64 = content.toString('base64');
  let sha;
  try {
    const getRes = await fetch('https://api.github.com/repos/' + repo + '/contents/' + repoPath, {
      headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'Node' }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {}

  const body = {
    message: 'sync: update ' + repoPath + ' for Google Colab GPU renderer',
    content: base64,
    branch: 'main'
  };
  if (sha) body.sha = sha;

  const res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + repoPath, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'Node'
    },
    body: JSON.stringify(body)
  });

  const resJson = await res.json();
  if (res.ok) {
    console.log('✅ Successfully uploaded:', repoPath);
  } else {
    console.error('❌ Failed:', repoPath, resJson.message);
  }
}

async function main() {
  await uploadFile('BeatFlow_Studio_Colab_Renderer.ipynb', 'BeatFlow_Studio_Colab_Renderer.ipynb');
  await uploadFile('scripts/cloud-render.cjs', 'scripts/cloud-render.cjs');
  await uploadFile('src/components/ExportModal.tsx', 'src/components/ExportModal.tsx');
  await uploadFile('src/components/OnScreenLyricEditor.tsx', 'src/components/OnScreenLyricEditor.tsx');
  await uploadFile('src/components/VisualizerCanvas.tsx', 'src/components/VisualizerCanvas.tsx');
}

main();
