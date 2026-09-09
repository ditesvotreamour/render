# 🎬 ShortsForge AI - Instant Viral Shorts & Reels Creator Studio

Aplikasi studio pembuat konten video pendek (TikTok, Instagram Reels, dan YouTube Shorts) yang dilengkapi fitur **"Aku Merasa Beruntung" (Instant 1-Click Viral Video Generator)**.

Dibuat menggunakan **React + TypeScript + Vite + Tailwind CSS + HTML5 Canvas & Web Audio API**.

---

## ✨ Fitur Utama

- 🎲 **"Aku Merasa Beruntung"**: Sekali klik langsung meracik topik viral, naskah hook 3-detik, background dinamis, efek suara, musik latar, dan animasi subtitle.
- 📱 **Live 9:16 Smartphone Preview (1080 x 1920)**: Canvas rendering 60 FPS dengan garis pemandu Safe-Zone TikTok & Reels.
- 💬 **Dynamic Subtitle Engine (Hormozi / MrBeast Style)**: Animasi kata aktif menyala (*karaoke highlight*), bounce pop, dan kustomisasi font tebal.
- 🎨 **6 Background Visual 60 FPS**: Satisfying Loop, Galaxy Warp, Retro Neon Synthwave, Minecraft Block Runner, Digital Matrix Rain, dan Kinetic Aurora, plus opsi upload file sendiri.
- 🎙️ **Audio Studio & Synthesizer**: Text-to-Speech (TTS) suara bahasa Indonesia/Inggris, Sound Effects (Whoosh, Boom, Pop, Ding, Glitch), dan Synthesizer BGM (Phonk, Lo-Fi, Suspense, Upbeat, Epic).
- 💾 **Direct Video Exporter**: Render langsung di browser ke format WebM / MP4 dan salin rekomendasi caption + hashtag viral.

---

## 🚀 Panduan Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Server Pengembangan
```bash
npm run dev
```

### 3. Build untuk Production / Hosting
```bash
npm run build
```
Hasil build siap hosting akan berada di folder `dist/`.

---

## 🌐 Panduan Deploy ke Hosting Gratis

### Opsi A: Vercel (Paling Cepat)
1. Push repository ke GitHub.
2. Buka [Vercel.com](https://vercel.com) dan impor repository Anda.
3. Vercel akan otomatis mendeteksi konfigurasi Vite dan mempublikasikan aplikasi dalam hitungan detik.

### Opsi B: GitHub Pages
1. Install `gh-pages`:
   ```bash
   npm install -D gh-pages
   ```
2. Tambahkan base URL pada `vite.config.ts` dan jalankan deploy.

### Opsi C: Firebase Hosting
```bash
npx firebase login
npx firebase init hosting
npx firebase deploy
```
