import type { LyricSegment, LyricWord } from '../types/visualizer';

export type WhisperSTTProvider = 'groq' | 'openai' | 'koboillm' | 'custom';

export class WhisperAIService {
  public static readonly GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
  public static readonly OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
  public static readonly KOBOILLM_API_ENDPOINT = 'https://api.koboillm.com/v1/audio/transcriptions';
  public static readonly DEFAULT_MODEL = 'whisper-large-v3-turbo';
  public static readonly DEFAULT_GROQ_MODEL = 'whisper-large-v3-turbo';
  public static readonly DEFAULT_OPENAI_MODEL = 'whisper-1';

  /**
   * Parse verbose_json response from OpenAI, Groq, or custom Whisper API
   */
  public static parseWhisperVerboseJson(result: any, idPrefix: string = 'whisper'): LyricSegment[] {
    if (!result) return [];

    // 1. Process verbose_json with segments array
    if (result.segments && Array.isArray(result.segments) && result.segments.length > 0) {
      const segments: LyricSegment[] = [];
      const globalWords: any[] = Array.isArray(result.words) ? result.words : [];

      result.segments.forEach((seg: any, idx: number) => {
        const text = (seg.text || '').trim();
        // Skip pure instrumental / music symbols
        const clean = text
          .replace(/^[♪♫🎶\s]+$/g, '')
          .replace(/^(\[music\]|\(music\)|\(instrumental\)|\(applause\))$/i, '')
          .trim();

        if (!clean) return;

        let words: LyricWord[] = [];
        if (seg.words && Array.isArray(seg.words) && seg.words.length > 0) {
          words = seg.words
            .map((w: any) => ({
              word: (w.word || '').trim(),
              start: Math.round((Number(w.start) || 0) * 100) / 100,
              end: Math.round((Number(w.end) || 0) * 100) / 100,
            }))
            .filter((w: LyricWord) => Boolean(w.word));
        } else if (globalWords.length > 0) {
          const matched = globalWords.filter(
            (w) => w.start >= seg.start - 0.15 && w.end <= seg.end + 0.15
          );
          if (matched.length > 0) {
            words = matched
              .map((w: any) => ({
                word: (w.word || '').trim(),
                start: Math.round((Number(w.start) || 0) * 100) / 100,
                end: Math.round((Number(w.end) || 0) * 100) / 100,
              }))
              .filter((w: LyricWord) => Boolean(w.word));
          }
        }

        // Fallback: If no word-level timestamps returned, generate smooth word-by-word steps
        if (words.length === 0) {
          const rawWords = clean.split(/\s+/).filter(Boolean);
          const dur = Math.max(0.1, seg.end - seg.start);
          const wDur = dur / Math.max(1, rawWords.length);
          words = rawWords.map((w: string, i: number) => ({
            word: w,
            start: Math.round((seg.start + i * wDur) * 100) / 100,
            end: Math.round((seg.start + (i + 1) * wDur) * 100) / 100,
          }));
        }

        segments.push({
          id: `${idPrefix}-seg-${idx}-${Date.now()}`,
          start: Math.round((Number(seg.start) || 0) * 100) / 100,
          end: Math.round((Number(seg.end) || 0) * 100) / 100,
          text: clean,
          words,
        });
      });

      if (segments.length > 0) {
        return this.reconstructSubtitlesBySentence(segments, idPrefix);
      }
    }

    // 2. Fallback: Process root words array only
    if (result.words && Array.isArray(result.words) && result.words.length > 0) {
      const segments: LyricSegment[] = [];
      let curWords: LyricWord[] = [];
      let curStart = 0;

      result.words.forEach((w: any, wIdx: number) => {
        const wordText = (w.word || '').trim();
        if (!wordText || /^[♪♫🎶\s]+$/.test(wordText)) return;

        const wStart = Math.round((Number(w.start) || 0) * 100) / 100;
        const wEnd = Math.round((Number(w.end) || 0) * 100) / 100;

        if (curWords.length === 0) {
          curStart = wStart;
        }

        curWords.push({ word: wordText, start: wStart, end: wEnd });

        const isLast = wIdx === result.words.length - 1;
        const nextWord = result.words[wIdx + 1];
        const hasPause = nextWord && Number(nextWord.start) - wEnd > 0.65;
        const hasPunctuation = /[.?!,]$/.test(wordText);
        const reachedMaxWords = curWords.length >= 7;

        if (isLast || hasPause || (curWords.length >= 4 && hasPunctuation) || reachedMaxWords) {
          const segEnd = wEnd;
          const segText = curWords.map((cw) => cw.word).join(' ');
          segments.push({
            id: `${idPrefix}-words-${segments.length}-${Date.now()}`,
            start: curStart,
            end: segEnd,
            text: segText,
            words: [...curWords],
          });
          curWords = [];
        }
      });

      if (segments.length > 0) return segments;
    }

    // 3. Fallback: Plain text output evenly timed
    if (result.text && typeof result.text === 'string') {
      const textLines = result.text
        .split(/(?<=[.?!,\n])\s+/)
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0);

      if (textLines.length > 0) {
        const count = textLines.length;
        const segmentDuration = Math.min(5.0, Math.max(2.5, 60 / count));
        return textLines.map((lineText: string, idx: number) => {
          const start = idx * segmentDuration;
          const end = start + segmentDuration;
          const rawWords = lineText.split(/\s+/).filter(Boolean);
          const wDur = (end - start) / Math.max(1, rawWords.length);
          return {
            id: `${idPrefix}-text-${idx}-${Date.now()}`,
            start: Math.round(start * 100) / 100,
            end: Math.round(end * 100) / 100,
            text: lineText,
            words: rawWords.map((w, i) => ({
              word: w,
              start: Math.round((start + i * wDur) * 100) / 100,
              end: Math.round((start + (i + 1) * wDur) * 100) / 100,
            })),
          };
        });
      }
    }

    return [];
  }

  /**
   * Transcribe audio using Groq Whisper API (Ultra-Fast LPU)
   */
  public static async transcribeWithGroq(
    audioBlob: Blob | File,
    apiKey: string,
    options: {
      model?: string;
      language?: string;
      prompt?: string;
    } = {},
    onStatus?: (status: string) => void
  ): Promise<LyricSegment[]> {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      throw new Error(
        'Groq API Key diperlukan. Silakan masukkan API Key Anda (diawali dengan gsk_...). Dapatkan gratis di console.groq.com/keys.'
      );
    }

    const model = options.model || this.DEFAULT_GROQ_MODEL;
    const language = options.language;

    if (onStatus) onStatus('Memeriksa dan menyiapkan file audio...');

    let uploadBlob: Blob = audioBlob;
    let fileName = audioBlob instanceof File ? audioBlob.name : 'audio.wav';

    if (audioBlob.size > 20 * 1024 * 1024) {
      if (onStatus) onStatus('Mengompresi audio ke 16kHz mono untuk mengoptimalkan kuota 25MB Groq...');
      try {
        const floatData = await this.decodeAudioTo16kHz(audioBlob);
        uploadBlob = this.audioBufferToWavBlob(floatData, 16000);
        fileName = 'audio_16khz.wav';
      } catch (downsampleErr) {
        console.warn('Gagal melakukan downsample audio, mengunggah file asli:', downsampleErr);
      }
    }

    if (onStatus) onStatus(`Mengirim audio ke Groq LPU Cloud (${model})...`);

    const formData = new FormData();
    formData.append('file', uploadBlob, fileName);
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('timestamp_granularities[]', 'word');

    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    let response: Response;
    try {
      response = await fetch(this.GROQ_API_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
        body: formData,
      });
    } catch (netErr: any) {
      throw new Error(
        `Gagal terhubung ke Groq API: ${netErr.message || 'Network / CORS Error'}. Periksa koneksi internet Anda.`
      );
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || errJson?.message || `HTTP ${response.status} ${response.statusText}`;

      if (response.status === 401) {
        throw new Error(
          `Groq API Key tidak valid (401 Unauthorized): ${msg}. Pastikan API Key benar dan aktif dari https://console.groq.com/keys`
        );
      }
      if (response.status === 413) {
        throw new Error(
          'Ukuran file audio melebihi batas 25MB Groq API. Silakan gunakan potongan lagu atau file berdurasi lebih pendek.'
        );
      }
      if (response.status === 429) {
        throw new Error(
          'Groq API Rate Limit tercapai (429). Mohon tunggu beberapa saat sebelum mencoba transkripsi kembali.'
        );
      }
      throw new Error(`Groq Whisper Error (${response.status}): ${msg}`);
    }

    if (onStatus) onStatus('Memproses hasil transkripsi dan menyusun sinkronisasi kata...');

    const result = await response.json().catch(() => null);
    if (!result) {
      throw new Error('Groq API tidak mengembalikan respon JSON yang valid.');
    }

    const segments = this.parseWhisperVerboseJson(result, 'groq');
    if (segments.length === 0) {
      throw new Error('Groq Whisper tidak mendeteksi vokal atau kata yang jelas pada audio.');
    }

    return segments;
  }

  /**
   * Transcribe audio using OpenAI Official Whisper API (High Precision Whisper AI)
   */
  public static async transcribeWithOpenAI(
    audioBlob: Blob | File,
    apiKey: string,
    options: {
      model?: string;
      language?: string;
      prompt?: string;
      endpoint?: string;
    } = {},
    onStatus?: (status: string) => void
  ): Promise<LyricSegment[]> {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      throw new Error(
        'OpenAI API Key diperlukan. Silakan masukkan API Key Anda (diawali dengan sk-...). Dapatkan di platform.openai.com/api-keys.'
      );
    }

    const endpoint = (options.endpoint || '').trim() || this.OPENAI_API_ENDPOINT;
    const isKoboiLLM = endpoint.includes('koboillm');
    let model = options.model || (isKoboiLLM ? 'openai/whisper-1' : this.DEFAULT_OPENAI_MODEL);
    if (isKoboiLLM && model === 'whisper-1') {
      model = 'openai/whisper-1';
    }
    const language = options.language;

    if (onStatus) onStatus(`Memeriksa dan menyiapkan file audio untuk ${isKoboiLLM ? 'KoboiLLM' : 'OpenAI'} Whisper...`);

    let uploadBlob: Blob = audioBlob;
    let fileName = audioBlob instanceof File ? audioBlob.name : 'audio.wav';

    // OpenAI limits to 25MB
    if (audioBlob.size > 20 * 1024 * 1024) {
      if (onStatus) onStatus('Mengompresi audio ke 16kHz mono untuk mengoptimalkan kuota upload 25MB...');
      try {
        const floatData = await this.decodeAudioTo16kHz(audioBlob);
        uploadBlob = this.audioBufferToWavBlob(floatData, 16000);
        fileName = 'audio_16khz.wav';
      } catch (downsampleErr) {
        console.warn('Gagal melakukan downsample audio, mengunggah file asli:', downsampleErr);
      }
    }

    if (onStatus) onStatus(`Mengirim audio ke ${isKoboiLLM ? 'KoboiLLM Gateway' : 'OpenAI Whisper API'} (${model})...`);

    const formData = new FormData();
    formData.append('file', uploadBlob, fileName);
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('timestamp_granularities[]', 'word');

    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
        body: formData,
      });
    } catch (netErr: any) {
      throw new Error(
        `Gagal terhubung ke API Whisper (${endpoint}): ${netErr.message || 'Network / CORS Error'}. Periksa koneksi internet Anda.`
      );
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || errJson?.message || `HTTP ${response.status} ${response.statusText}`;

      if (response.status === 401) {
        if (isKoboiLLM) {
          throw new Error(
            `KoboiLLM API Key tidak valid (401 Unauthorized): ${msg}. Pastikan API Key benar dari https://koboillm.com`
          );
        }
        throw new Error(
          `OpenAI API Key tidak valid (401 Unauthorized): ${msg}. Pastikan API Key benar dari https://platform.openai.com/api-keys`
        );
      }
      if (response.status === 429) {
        if (isKoboiLLM) {
          throw new Error(
            `KoboiLLM Kuota / Saldo tercapai (429): ${msg}. Pastikan saldo akun KoboiLLM Anda mencukupi di https://koboillm.com.`
          );
        }
        throw new Error(
          `OpenAI API Quota / Rate limit tercapai (429): ${msg}. Pastikan akun OpenAI Anda memiliki credit/saldo aktif.`
        );
      }
      if (response.status === 413) {
        throw new Error(
          'Ukuran file audio melebihi batas 25MB. Silakan gunakan potongan lagu atau file berdurasi lebih pendek.'
        );
      }
      throw new Error(`Whisper API Error (${response.status}): ${msg}`);
    }

    if (onStatus) onStatus('Memproses hasil transkripsi dan menyusun sinkronisasi kata...');

    const result = await response.json().catch(() => null);
    if (!result) {
      throw new Error('API tidak mengembalikan respon JSON yang valid.');
    }

    const segments = this.parseWhisperVerboseJson(result, isKoboiLLM ? 'koboillm' : 'openai');
    if (segments.length === 0) {
      throw new Error('Whisper tidak mendeteksi teks vokal yang jelas pada audio.');
    }

    return segments;
  }

  /**
   * Transcribe audio using KoboiLLM AI Gateway (koboillm.com - OpenAI Whisper whisper-1)
   */
  public static async transcribeWithKoboiLLM(
    audioBlob: Blob | File,
    apiKey: string,
    options: {
      model?: string;
      language?: string;
      prompt?: string;
    } = {},
    onStatus?: (status: string) => void
  ): Promise<LyricSegment[]> {
    return this.transcribeWithOpenAI(
      audioBlob,
      apiKey,
      {
        ...options,
        endpoint: this.KOBOILLM_API_ENDPOINT,
      },
      onStatus
    );
  }

  /**
   * Transcribe audio using a Custom or Local Whisper Endpoint (faster-whisper, whisper.cpp, Cloudflare, etc.)
   */
  public static async transcribeWithCustomEndpoint(
    audioBlob: Blob | File,
    endpointUrl: string,
    apiKey?: string,
    options: {
      model?: string;
      language?: string;
      prompt?: string;
    } = {},
    onStatus?: (status: string) => void
  ): Promise<LyricSegment[]> {
    const cleanEndpoint = (endpointUrl || '').trim();
    if (!cleanEndpoint) {
      throw new Error('Endpoint URL Whisper server lokal/custom belum diisi.');
    }

    const model = options.model || 'whisper-1';
    const language = options.language;

    if (onStatus) onStatus('Menyiapkan audio untuk Custom Whisper Server...');

    let uploadBlob: Blob = audioBlob;
    let fileName = audioBlob instanceof File ? audioBlob.name : 'audio.wav';

    if (audioBlob.size > 20 * 1024 * 1024) {
      try {
        const floatData = await this.decodeAudioTo16kHz(audioBlob);
        uploadBlob = this.audioBufferToWavBlob(floatData, 16000);
        fileName = 'audio_16khz.wav';
      } catch (e) {
        // ignore
      }
    }

    if (onStatus) onStatus(`Mengirim audio ke ${cleanEndpoint}...`);

    const formData = new FormData();
    formData.append('file', uploadBlob, fileName);
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('timestamp_granularities[]', 'word');

    if (language && language !== 'auto') {
      formData.append('language', language);
    }
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    const headers: Record<string, string> = {};
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    let response: Response;
    try {
      response = await fetch(cleanEndpoint, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (netErr: any) {
      throw new Error(`Gagal menghubungi Whisper endpoint: ${netErr.message || 'CORS / Network Error'}`);
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || errJson?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`Whisper Server Error (${response.status}): ${msg}`);
    }

    if (onStatus) onStatus('Memproses hasil transkripsi...');
    const result = await response.json().catch(() => null);
    if (!result) throw new Error('Respon server bukan format JSON yang valid.');

    const segments = this.parseWhisperVerboseJson(result, 'custom');
    if (segments.length === 0) {
      throw new Error('Whisper Server tidak mendeteksi teks vokal yang jelas pada audio.');
    }

    return segments;
  }

  /**
   * Unified transcription entry point across Groq, OpenAI, and Custom STT providers
   */
  public static async transcribe(
    audioBlob: Blob | File,
    provider: WhisperSTTProvider,
    apiKey: string,
    options: {
      model?: string;
      language?: string;
      prompt?: string;
      customEndpoint?: string;
    } = {},
    onStatus?: (status: string) => void
  ): Promise<LyricSegment[]> {
    if (provider === 'openai') {
      return this.transcribeWithOpenAI(audioBlob, apiKey, options, onStatus);
    }
    if (provider === 'koboillm') {
      return this.transcribeWithKoboiLLM(audioBlob, apiKey, options, onStatus);
    }
    if (provider === 'custom') {
      return this.transcribeWithCustomEndpoint(
        audioBlob,
        options.customEndpoint || 'http://localhost:8000/v1/audio/transcriptions',
        apiKey,
        options,
        onStatus
      );
    }
    return this.transcribeWithGroq(audioBlob, apiKey, options, onStatus);
  }

  /**
   * Backward-compatible alias for transcribeWithGroq
   */
  public static async transcribeAudio(
    audioBlob: Blob | File,
    apiKey: string,
    language?: string,
    onStatus?: (status: string) => void,
    _baseUrl?: string,
    model?: string
  ): Promise<LyricSegment[]> {
    return this.transcribeWithGroq(
      audioBlob,
      apiKey,
      { model: model || this.DEFAULT_MODEL, language },
      onStatus
    );
  }

  /**
   * Resample any Audio Blob to 16kHz mono Float32Array
   */
  public static async decodeAudioTo16kHz(audioBlob: Blob | File): Promise<Float32Array> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioCtxClass();

    const decoded = await tempCtx.decodeAudioData(arrayBuffer);
    await tempCtx.close();

    if (decoded.sampleRate === 16000 && decoded.numberOfChannels === 1) {
      return decoded.getChannelData(0);
    }

    // Resample to 16,000 Hz single-channel mono
    const targetLength = Math.ceil(decoded.duration * 16000);
    const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampled = await offlineCtx.startRendering();
    return resampled.getChannelData(0);
  }

  /**
   * Convert 16kHz mono Float32Array to standard 16-bit PCM WAV Blob
   */
  public static audioBufferToWavBlob(channelData: Float32Array, sampleRate: number = 16000): Blob {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = channelData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Helper to write string bytes
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bitsPerSample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < channelData.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  /**
   * Shift all lyric timestamps forward or backward by deltaSeconds
   */
  public static shiftLyricTimestamps(lyrics: LyricSegment[], deltaSeconds: number): LyricSegment[] {
    return lyrics.map((seg) => {
      const newStart = Math.max(0, Math.round((seg.start + deltaSeconds) * 100) / 100);
      const newEnd = Math.max(newStart + 0.5, Math.round((seg.end + deltaSeconds) * 100) / 100);
      const newWords = seg.words?.map((w) => ({
        ...w,
        start: Math.max(0, Math.round((w.start + deltaSeconds) * 100) / 100),
        end: Math.max(0, Math.round((w.end + deltaSeconds) * 100) / 100),
      }));
      return {
        ...seg,
        start: newStart,
        end: newEnd,
        words: newWords,
      };
    });
  }

  /**
   * Parse WebVTT subtitle content with millisecond-exact timestamps
   */
  public static parseVtt(vttContent: string): LyricSegment[] {
    const cleanContent = vttContent.replace(/^WEBVTT[^\n]*\n+/i, '').trim();
    const blocks = cleanContent.split(/\r?\n\r?\n/);
    const segments: LyricSegment[] = [];

    blocks.forEach((block, idx) => {
      const bLines = block.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      const timeLineIdx = bLines.findIndex((l) => l.includes('-->'));
      if (timeLineIdx !== -1) {
        const timeLine = bLines[timeLineIdx];
        const textLines = bLines.slice(timeLineIdx + 1).join(' ').trim();
        const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);
        const start = this.timeStringToSeconds(startStr);
        const end = this.timeStringToSeconds(endStr);

        // Filter out pure instrumental / music symbols: ♪, ♫, 🎶, [Music], (Music)
        const stripped = textLines
          .replace(/^[♪♫🎶\s]+$/g, '')
          .replace(/^(\[music\]|\(music\)|\(instrumental\)|\(applause\))$/i, '')
          .trim();

        if (stripped && !isNaN(start) && !isNaN(end)) {
          const rawWords = stripped.split(/\s+/).filter(Boolean);
          const dur = Math.max(0.1, end - start);
          const wDur = dur / Math.max(1, rawWords.length);
          const words: LyricWord[] = rawWords.map((w, i) => ({
            word: w,
            start: Math.round((start + i * wDur) * 100) / 100,
            end: Math.round((start + (i + 1) * wDur) * 100) / 100,
          }));

          segments.push({
            id: `vtt-${idx}-${Date.now()}`,
            start: Math.round(start * 100) / 100,
            end: Math.round(end * 100) / 100,
            text: stripped,
            words: words.length > 0 ? words : undefined,
          });
        }
      }
    });

    return segments;
  }

  /**
   * Parse SRT subtitle file content
   */
  public static parseSrt(srtContent: string): LyricSegment[] {
    const segments: LyricSegment[] = [];
    const blocks = srtContent.trim().split(/\r?\n\r?\n/);

    blocks.forEach((block, idx) => {
      const lines = block.trim().split(/\r?\n/);
      if (lines.length >= 2) {
        // Line with timestamps: 00:00:01,000 --> 00:00:04,500
        const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
        const timeLine = lines[timeLineIndex];
        const textLines = lines.slice(timeLineIndex + 1).join(' ');

        if (timeLine && timeLine.includes('-->')) {
          const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
          const start = this.timeStringToSeconds(startStr);
          const end = this.timeStringToSeconds(endStr);

          const stripped = textLines
            .replace(/^[♪♫🎶\s]+$/g, '')
            .replace(/^(\[music\]|\(music\)|\(instrumental\)|\(applause\))$/i, '')
            .trim();

          if (!isNaN(start) && !isNaN(end) && stripped) {
            const rawWords = stripped.split(/\s+/).filter(Boolean);
            const dur = Math.max(0.1, end - start);
            const wDur = dur / Math.max(1, rawWords.length);
            const words: LyricWord[] = rawWords.map((w, i) => ({
              word: w,
              start: Math.round((start + i * wDur) * 100) / 100,
              end: Math.round((start + (i + 1) * wDur) * 100) / 100,
            }));

            segments.push({
              id: `srt-${idx}-${Date.now()}`,
              start: Math.round(start * 100) / 100,
              end: Math.round(end * 100) / 100,
              text: stripped,
              words: words.length > 0 ? words : undefined,
            });
          }
        }
      }
    });

    return segments;
  }

  /**
   * Parse LRC (Karaoke Lyrics) format: [00:12.50] Lyric line text
   */
  public static parseLrc(lrcContent: string): LyricSegment[] {
    const segments: LyricSegment[] = [];
    const lines = lrcContent.split(/\r?\n/);
    const rawItems: { time: number; text: string }[] = [];

    const lrcRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

    lines.forEach((line) => {
      const match = line.match(lrcRegex);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseFloat(match[2]);
        const text = match[3].trim();
        const time = min * 60 + sec;

        if (text) {
          rawItems.push({ time, text });
        }
      }
    });

    rawItems.sort((a, b) => a.time - b.time);

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const nextTime = i < rawItems.length - 1 ? rawItems[i + 1].time : item.time + 4.5;
      segments.push({
        id: `lrc-${i}-${Date.now()}`,
        start: item.time,
        end: nextTime,
        text: item.text,
      });
    }

    return segments;
  }

  /**
   * Export LyricSegments to SRT string
   */
  public static exportToSrt(lyrics: LyricSegment[]): string {
    return lyrics
      .map((seg, idx) => {
        const startStr = this.secondsToSrtTime(seg.start);
        const endStr = this.secondsToSrtTime(seg.end);
        return `${idx + 1}\n${startStr} --> ${endStr}\n${seg.text}\n`;
      })
      .join('\n');
  }

  /**
   * Export LyricSegments to LRC string
   */
  public static exportToLrc(lyrics: LyricSegment[]): string {
    return lyrics
      .map((seg) => {
        const min = Math.floor(seg.start / 60);
        const sec = (seg.start % 60).toFixed(2);
        const minStr = String(min).padStart(2, '0');
        const secStr = String(sec).padStart(5, '0');
        return `[${minStr}:${secStr}] ${seg.text}`;
      })
      .join('\n');
  }

  /**
   * Generate demo contextual synced lyrics
   */
  public static generateDemoLyrics(_trackTitle: string, genre: string): LyricSegment[] {
    const isEdmOrTrap = genre.toLowerCase().includes('edm') || genre.toLowerCase().includes('trap');
    const isLofi = genre.toLowerCase().includes('lo-fi') || genre.toLowerCase().includes('chill');

    if (isLofi) {
      return [
        { id: 'demo-1', start: 2, end: 7, text: 'Rain drops falling gently on the window sill' },
        { id: 'demo-2', start: 8, end: 14, text: 'Late night memories drifting through the quiet chill' },
        { id: 'demo-3', start: 15, end: 21, text: 'Sip the coffee slow, let the world just fade away' },
        { id: 'demo-4', start: 22, end: 28, text: 'Finding peace right here before another day' },
        { id: 'demo-5', start: 30, end: 38, text: '♪ (Instrumental Warm Melodies) ♪' },
        { id: 'demo-6', start: 40, end: 47, text: 'Lost in the soft glow of the midnight moon' },
        { id: 'demo-7', start: 48, end: 55, text: 'Whispering a mellow lo-fi tune' },
      ];
    }

    if (isEdmOrTrap) {
      return [
        { id: 'demo-1', start: 1.5, end: 6.5, text: 'Feel the rhythm building in the atmosphere' },
        { id: 'demo-2', start: 7.0, end: 12.5, text: 'Light up the horizon, making everything clear' },
        { id: 'demo-3', start: 13.0, end: 18.0, text: 'Turn the bass up loud, ignite the neon flame!' },
        { id: 'demo-4', start: 18.5, end: 22.0, text: '3... 2... 1... DROP THE BASS!' },
        { id: 'demo-5', start: 22.5, end: 32.0, text: '🔥 [HEAVY BASS DROP • FESTIVAL ENERGY] 🔥' },
        { id: 'demo-6', start: 33.0, end: 38.5, text: 'Unstoppable frequencies through the night' },
        { id: 'demo-7', start: 39.0, end: 45.0, text: 'We are boundless in the cyber light!' },
      ];
    }

    // Default Synthwave / Cyberpunk
    return [
      { id: 'demo-1', start: 2.0, end: 7.5, text: 'Cruising down the grid into the endless night' },
      { id: 'demo-2', start: 8.0, end: 13.5, text: 'Retrowave skyline shining neon bright' },
      { id: 'demo-3', start: 14.0, end: 19.5, text: 'Synthetic echoes pulsing in our veins' },
      { id: 'demo-4', start: 20.0, end: 26.0, text: 'Breaking away from all the digital chains' },
      { id: 'demo-5', start: 27.0, end: 35.0, text: '⚡ [SYNTHWAVE ARPEGGIO SOLO] ⚡' },
      { id: 'demo-6', start: 36.0, end: 42.0, text: 'Drive into tomorrow, never look behind' },
      { id: 'demo-7', start: 43.0, end: 50.0, text: 'A future melody forever intertwined' },
    ];
  }

  private static timeStringToSeconds(timeStr: string): number {
    // Format: 00:01:23,456 or 00:01:23.456
    const clean = timeStr.replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      return m * 60 + s;
    }
    return parseFloat(clean) || 0;
  }

  private static secondsToSrtTime(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    const ms = Math.floor((totalSec % 1) * 1000);

    const hStr = String(h).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    const msStr = String(ms).padStart(3, '0');

    return `${hStr}:${mStr}:${sStr},${msStr}`;
  }

  /**
   * Reconstructs lyric segments into complete, grammatical sentences ending with punctuation,
   * formatted for clean single-line display with strictly non-colliding continuous flow.
   */
  public static reconstructSubtitlesBySentence(
    rawSegments: LyricSegment[],
    idPrefix: string = 'sentence'
  ): LyricSegment[] {
    if (!rawSegments || rawSegments.length === 0) return [];

    interface WordEntry {
      word: string;
      start: number;
      end: number;
    }
    const allWords: WordEntry[] = [];

    for (const seg of rawSegments) {
      if (!seg.text || !seg.text.trim()) continue;
      const cleanText = seg.text.trim();
      if (seg.words && seg.words.length > 0) {
        for (const w of seg.words) {
          const wt = (w.word || '').trim();
          if (wt) {
            allWords.push({
              word: wt,
              start: Number(w.start) || seg.start,
              end: Number(w.end) || seg.end,
            });
          }
        }
      } else {
        const splitWords = cleanText.split(/\s+/).filter(Boolean);
        const segDur = Math.max(0.2, seg.end - seg.start);
        const wDur = segDur / Math.max(1, splitWords.length);
        splitWords.forEach((sw, i) => {
          allWords.push({
            word: sw,
            start: Number((seg.start + i * wDur).toFixed(3)),
            end: Number((seg.start + (i + 1) * wDur).toFixed(3)),
          });
        });
      }
    }

    if (allWords.length === 0) return rawSegments;

    // Ensure words are chronologically sorted
    allWords.sort((a, b) => a.start - b.start);

    // Group words into sentences ending with punctuation or speech pauses
    const reconstructed: LyricSegment[] = [];
    let currentWords: WordEntry[] = [];
    let currentStart = allWords[0].start;

    for (let i = 0; i < allWords.length; i++) {
      const w = allWords[i];
      if (currentWords.length === 0) {
        currentStart = w.start;
      }
      currentWords.push(w);

      const isLastWord = i === allWords.length - 1;
      const nextWord = allWords[i + 1];

      // Terminal punctuation (. ? ! ; :) or clause comma
      const endsWithTerminal = /[.?!;:]$/.test(w.word);
      const endsWithComma = /[,—–]$/.test(w.word);

      // Audio pause to next word
      const pauseToNext = nextWord ? nextWord.start - w.end : 0;
      const hasLongPause = pauseToNext >= 0.55;
      const hasMediumPause = pauseToNext >= 0.35;

      const wordCount = currentWords.length;

      // Break condition:
      // 1. Terminal punctuation (. ? ! ; :)
      // 2. Significant pause in speech
      // 3. Comma followed by a breath pause or after at least 4 words
      // 4. Maximum comfortable words for a single horizontal line (>= 9 words)
      // 5. Final word
      const shouldBreak =
        isLastWord ||
        endsWithTerminal ||
        hasLongPause ||
        (endsWithComma && (hasMediumPause || wordCount >= 4)) ||
        wordCount >= 9;

      if (shouldBreak) {
        const segEnd = Math.max(w.end, currentStart + 0.4);
        const sentenceText = currentWords.map((cw) => cw.word).join(' ').trim();

        reconstructed.push({
          id: `${idPrefix}-${reconstructed.length}-${Date.now()}`,
          start: Number(currentStart.toFixed(2)),
          end: Number(segEnd.toFixed(2)),
          text: sentenceText,
          words: currentWords.map((cw) => ({
            word: cw.word,
            start: Number(cw.start.toFixed(2)),
            end: Number(cw.end.toFixed(2)),
          })),
        });

        currentWords = [];
      }
    }

    // STRICT NON-COLLISION POST-PROCESSING:
    // Ensure every sentence connects seamlessly without overlapping the next
    for (let i = 0; i < reconstructed.length; i++) {
      const curr = reconstructed[i];
      const next = reconstructed[i + 1];

      if (next) {
        if (curr.end > next.start) {
          curr.end = Math.max(curr.start + 0.2, next.start);
        } else if (next.start - curr.end < 0.15) {
          // Seamless bridging if gap is negligible
          curr.end = next.start;
        }
      }
    }

    return reconstructed;
  }
}
