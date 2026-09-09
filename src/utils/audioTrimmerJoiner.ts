/**
 * Audio Trimmer & Joiner Utility
 * High-performance client-side audio slicing, concatenating, crossfading, and WAV encoding
 * using the Web Audio API.
 */

import { Mp3Encoder } from '@breezystack/lamejs';
import type { AudioTrack, LyricSegment } from '../types/visualizer';

export interface TrackSegment {
  title: string;
  start: number;
  end: number;
}

export interface TrimOptions {
  fadeInDuration?: number; // seconds
  fadeOutDuration?: number; // seconds
  volumeGain?: number; // multiplier e.g. 1.0 = 100%
  format?: 'mp3' | 'wav';
  mp3Bitrate?: 128 | 192 | 320;
  onProgress?: (percent: number) => void;
}

export interface TrimResult {
  file: File;
  blob: Blob;
  duration: number;
  format: 'mp3' | 'wav';
}

export interface JoinResult {
  file: File;
  blob: Blob;
  totalDuration: number;
  segments: TrackSegment[];
  format: 'mp3' | 'wav';
}

export class AudioTrimmerJoiner {
  /**
   * Fast pure-JavaScript 16-bit PCM Stereo WAV Encoder
   */
  public static audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const numSamples = buffer.length;
    const dataByteLength = numSamples * blockAlign;
    const headerByteLength = 44;
    const totalByteLength = headerByteLength + dataByteLength;

    const arrayBuffer = new ArrayBuffer(totalByteLength);
    const view = new DataView(arrayBuffer);

    // 1. RIFF Identifier
    this.writeString(view, 0, 'RIFF');
    // 2. File Length (total - 8)
    view.setUint32(4, totalByteLength - 8, true);
    // 3. RIFF Type
    this.writeString(view, 8, 'WAVE');
    // 4. Format Chunk Identifier
    this.writeString(view, 12, 'fmt ');
    // 5. Format Chunk Length
    view.setUint32(16, 16, true);
    // 6. Audio Format (1 = PCM)
    view.setUint16(20, format, true);
    // 7. Number of Channels
    view.setUint16(22, numChannels, true);
    // 8. Sample Rate
    view.setUint32(24, sampleRate, true);
    // 9. Byte Rate (SampleRate * BlockAlign)
    view.setUint32(28, sampleRate * blockAlign, true);
    // 10. Block Align
    view.setUint16(32, blockAlign, true);
    // 11. Bits per Sample
    view.setUint16(34, bitDepth, true);
    // 12. Data Chunk Identifier
    this.writeString(view, 36, 'data');
    // 13. Data Chunk Length
    view.setUint32(40, dataByteLength, true);

    // 14. Interleave & Write 16-bit PCM Audio Samples
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        // Clamp sample between -1.0 and 1.0
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        // Convert to 16-bit signed integer (-32768 to 32767)
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, Math.floor(intSample), true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Fast pure-JavaScript MP3 Encoder using LAME (supports 128, 192, 320 kbps)
   */
  public static audioBufferToMp3(
    buffer: AudioBuffer,
    bitrateKbps: 128 | 192 | 320 = 320,
    onProgress?: (percent: number) => void
  ): Blob {
    const channels = Math.min(2, buffer.numberOfChannels);
    const sampleRate = buffer.sampleRate;
    const encoder = new Mp3Encoder(channels, sampleRate, bitrateKbps);
    const mp3Chunks: Uint8Array[] = [];

    const numSamples = buffer.length;
    const leftFloat = buffer.getChannelData(0);
    const rightFloat = channels > 1 ? buffer.getChannelData(1) : leftFloat;

    const CHUNK_SIZE = 1152;
    const leftInt = new Int16Array(CHUNK_SIZE);
    const rightInt = channels > 1 ? new Int16Array(CHUNK_SIZE) : undefined;

    for (let i = 0; i < numSamples; i += CHUNK_SIZE) {
      const blockLength = Math.min(CHUNK_SIZE, numSamples - i);

      for (let j = 0; j < blockLength; j++) {
        const sL = Math.max(-1, Math.min(1, leftFloat[i + j]));
        leftInt[j] = sL < 0 ? sL * 0x8000 : sL * 0x7fff;

        if (rightInt) {
          const sR = Math.max(-1, Math.min(1, rightFloat[i + j]));
          rightInt[j] = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
        }
      }

      const curLeft = blockLength === CHUNK_SIZE ? leftInt : leftInt.subarray(0, blockLength);
      const curRight = rightInt ? (blockLength === CHUNK_SIZE ? rightInt : rightInt.subarray(0, blockLength)) : undefined;

      const mp3buf = encoder.encodeBuffer(curLeft, curRight);
      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf);
      }

      if (onProgress && i % (CHUNK_SIZE * 40) === 0) {
        onProgress(Math.min(99, Math.round((i / numSamples) * 100)));
      }
    }

    const endBuf = encoder.flush();
    if (endBuf.length > 0) {
      mp3Chunks.push(endBuf);
    }
    if (onProgress) onProgress(100);

    return new Blob(mp3Chunks as any, { type: 'audio/mp3' });
  }

  /**
   * Extract audio peaks for interactive waveform canvas display
   */
  public static extractWaveformPeaks(buffer: AudioBuffer, numBuckets: number = 800): Float32Array {
    const numSamples = buffer.length;
    const bucketSize = Math.max(1, Math.floor(numSamples / numBuckets));
    const peaks = new Float32Array(numBuckets);
    let globalMax = 0.01;

    const channelData = buffer.getChannelData(0);
    const hasSecondChannel = buffer.numberOfChannels > 1;
    const channelData2 = hasSecondChannel ? buffer.getChannelData(1) : null;

    for (let b = 0; b < numBuckets; b++) {
      const start = b * bucketSize;
      const end = Math.min(start + bucketSize, numSamples);
      let maxVal = 0;

      for (let i = start; i < end; i += 4) {
        const val1 = Math.abs(channelData[i]);
        if (val1 > maxVal) maxVal = val1;
        if (channelData2) {
          const val2 = Math.abs(channelData2[i]);
          if (val2 > maxVal) maxVal = val2;
        }
      }
      peaks[b] = maxVal;
      if (maxVal > globalMax) globalMax = maxVal;
    }

    // Normalize so highest peak is 1.0
    for (let b = 0; b < numBuckets; b++) {
      peaks[b] = Math.min(1.0, peaks[b] / globalMax);
    }

    return peaks;
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Decode an Audio Blob or File into an AudioBuffer
   */
  public static async decodeAudio(blobOrFile: Blob | File): Promise<AudioBuffer> {
    const arrayBuffer = await blobOrFile.arrayBuffer();
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioCtxClass();
    const decoded = await tempCtx.decodeAudioData(arrayBuffer);
    await tempCtx.close();
    return decoded;
  }

  /**
   * Trim an audio file between startSec and endSec
   * Supports fade-in, fade-out, volume gain, and output format (MP3/WAV).
   */
  public static async trimAudioFile(
    blobOrFile: Blob | File,
    startSec: number,
    endSec: number,
    outputName: string = 'trimmed_track.mp3',
    options?: TrimOptions
  ): Promise<TrimResult> {
    const originalBuffer = await this.decodeAudio(blobOrFile);
    const sampleRate = originalBuffer.sampleRate;
    const numChannels = originalBuffer.numberOfChannels;

    const actualStart = Math.max(0, Math.min(startSec, originalBuffer.duration));
    const actualEnd = Math.max(actualStart + 0.1, Math.min(endSec, originalBuffer.duration));
    const targetDuration = actualEnd - actualStart;

    const startSample = Math.floor(actualStart * sampleRate);
    const endSample = Math.floor(actualEnd * sampleRate);
    const targetLength = Math.max(1, endSample - startSample);

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtxClass();
    const trimmedBuffer = ctx.createBuffer(numChannels, targetLength, sampleRate);
    await ctx.close();

    const fadeInSec = Math.max(0, options?.fadeInDuration ?? 0);
    const fadeOutSec = Math.max(0, options?.fadeOutDuration ?? 0);
    const volumeGain = Math.max(0.2, Math.min(3.0, options?.volumeGain ?? 1.0));

    // Minimum 5ms micro-fade to avoid electrical click pops
    const minMicroFade = Math.min(Math.floor(sampleRate * 0.005), Math.floor(targetLength / 4));
    const fadeInSamples = Math.max(minMicroFade, Math.floor(fadeInSec * sampleRate));
    const fadeOutSamples = Math.max(minMicroFade, Math.floor(fadeOutSec * sampleRate));

    for (let ch = 0; ch < numChannels; ch++) {
      const srcData = originalBuffer.getChannelData(ch);
      const dstData = trimmedBuffer.getChannelData(ch);

      for (let i = 0; i < targetLength; i++) {
        let sample = srcData[startSample + i] || 0;

        // Apply Volume Gain with soft-limiter (prevents harsh digital clipping)
        if (volumeGain !== 1.0) {
          sample = sample * volumeGain;
          if (sample > 0.95 || sample < -0.95) {
            sample = Math.tanh(sample);
          }
        }

        // Fade In (Equal power curve for smooth cinematic onset)
        if (i < fadeInSamples && fadeInSamples > 0) {
          const ratio = i / fadeInSamples;
          sample *= Math.sin((ratio * Math.PI) / 2);
        }

        // Fade Out (Equal power curve for natural decay)
        const remainingSamples = targetLength - 1 - i;
        if (remainingSamples < fadeOutSamples && fadeOutSamples > 0) {
          const ratio = remainingSamples / fadeOutSamples;
          sample *= Math.sin((ratio * Math.PI) / 2);
        }

        dstData[i] = sample;
      }
    }

    const format = options?.format || (outputName.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3');
    let outBlob: Blob;
    let finalFileName = outputName;

    if (format === 'wav') {
      outBlob = this.audioBufferToWav(trimmedBuffer);
      if (!finalFileName.toLowerCase().endsWith('.wav')) {
        finalFileName = finalFileName.replace(/\.[^/.]+$/, '') + '.wav';
      }
    } else {
      outBlob = this.audioBufferToMp3(trimmedBuffer, options?.mp3Bitrate || 320, options?.onProgress);
      if (!finalFileName.toLowerCase().endsWith('.mp3')) {
        finalFileName = finalFileName.replace(/\.[^/.]+$/, '') + '.mp3';
      }
    }

    const file = new File([outBlob], finalFileName, { type: format === 'wav' ? 'audio/wav' : 'audio/mp3' });

    return {
      file,
      blob: outBlob,
      duration: targetDuration,
      format,
    };
  }

  /**
   * Join multiple audio files into a single continuous track with optional DJ crossfade
   */
  public static async joinAudioFiles(
    files: File[],
    crossfadeSec: number = 0,
    onProgress?: (progressPercent: number, statusMessage: string) => void,
    options?: { format?: 'mp3' | 'wav'; mp3Bitrate?: 128 | 192 | 320 }
  ): Promise<JoinResult> {
    if (files.length === 0) {
      throw new Error('Pilih setidaknya 1 file audio untuk digabungkan.');
    }

    const format = options?.format || 'mp3';

    if (files.length === 1) {
      const decoded = await this.decodeAudio(files[0]);
      let blob: Blob;
      let ext = format === 'wav' ? 'wav' : 'mp3';
      if (format === 'wav') {
        blob = this.audioBufferToWav(decoded);
      } else {
        blob = this.audioBufferToMp3(decoded, options?.mp3Bitrate || 320);
      }
      return {
        file: new File([blob], `${files[0].name.replace(/\.[^/.]+$/, '')}_Combined.${ext}`, {
          type: format === 'wav' ? 'audio/wav' : 'audio/mp3',
        }),
        blob,
        totalDuration: decoded.duration,
        segments: [{ title: files[0].name, start: 0, end: decoded.duration }],
        format,
      };
    }

    if (onProgress) onProgress(5, `Mendekode ${files.length} file audio...`);

    // 1. Decode all files
    const decodedBuffers: AudioBuffer[] = [];
    let commonSampleRate = 44100;

    for (let i = 0; i < files.length; i++) {
      if (onProgress) {
        const pct = Math.round(5 + (i / files.length) * 45);
        onProgress(pct, `Mendekode trek ${i + 1}/${files.length}: ${files[i].name}...`);
      }
      const buf = await this.decodeAudio(files[i]);
      decodedBuffers.push(buf);
      if (i === 0) commonSampleRate = buf.sampleRate;
    }

    if (onProgress) onProgress(55, 'Menghitung penyambungan dan transisi crossfade...');

    const numChannels = 2; // Output standard stereo
    const actualCrossfade = Math.max(0, Math.min(5, crossfadeSec));

    // 2. Calculate total sample length considering crossfade overlap
    let totalSamples = 0;
    const segments: TrackSegment[] = [];
    let currentStartTime = 0;

    decodedBuffers.forEach((buf, idx) => {
      const bufDuration = buf.duration;
      const effectiveCrossfade = idx === 0 ? 0 : Math.min(actualCrossfade, bufDuration / 2);
      const startSec = Math.max(0, currentStartTime - effectiveCrossfade);
      const endSec = startSec + bufDuration;

      segments.push({
        title: files[idx].name.replace(/\.[^/.]+$/, ''),
        start: Math.round(startSec * 100) / 100,
        end: Math.round(endSec * 100) / 100,
      });

      currentStartTime = endSec;
    });

    const totalDuration = segments[segments.length - 1].end;
    totalSamples = Math.ceil(totalDuration * commonSampleRate);

    // 3. Render combined audio via OfflineAudioContext for pristine resample and crossfade mixing
    if (onProgress) onProgress(70, 'Merender penggabungan trek dengan Web Audio API...');

    const offlineCtx = new OfflineAudioContext(numChannels, totalSamples, commonSampleRate);

    decodedBuffers.forEach((buf, idx) => {
      const source = offlineCtx.createBufferSource();
      source.buffer = buf;

      const gainNode = offlineCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      const seg = segments[idx];
      const startSec = seg.start;
      const durationSec = buf.duration;
      const crossfadeDuration = idx === 0 ? 0 : Math.min(actualCrossfade, durationSec / 3);

      // Crossfade fade-in
      if (crossfadeDuration > 0) {
        gainNode.gain.setValueAtTime(0, startSec);
        gainNode.gain.linearRampToValueAtTime(1, startSec + crossfadeDuration);
      } else {
        gainNode.gain.setValueAtTime(1, startSec);
      }

      // Crossfade fade-out for previous track if next track exists
      if (idx < decodedBuffers.length - 1 && actualCrossfade > 0) {
        const nextStart = segments[idx + 1].start;
        const nextCrossfade = Math.min(actualCrossfade, (seg.end - nextStart));
        if (nextCrossfade > 0) {
          gainNode.gain.setValueAtTime(1, nextStart);
          gainNode.gain.linearRampToValueAtTime(0, seg.end);
        }
      }

      source.start(startSec);
    });

    const renderedBuffer = await offlineCtx.startRendering();

    let outBlob: Blob;
    let ext = format === 'wav' ? 'wav' : 'mp3';
    const combinedTitle = `Megamix_${files.length}_Tracks_${Math.round(totalDuration)}s.${ext}`;

    if (format === 'wav') {
      if (onProgress) onProgress(90, 'Mengonversi trek gabungan ke format WAV HD...');
      outBlob = this.audioBufferToWav(renderedBuffer);
    } else {
      if (onProgress) onProgress(90, 'Mengonversi trek gabungan ke format MP3 320k...');
      outBlob = this.audioBufferToMp3(renderedBuffer, options?.mp3Bitrate || 320);
    }

    const finalFile = new File([outBlob], combinedTitle, { type: format === 'wav' ? 'audio/wav' : 'audio/mp3' });

    if (onProgress) onProgress(100, 'Penggabungan lagu selesai!');

    return {
      file: finalFile,
      blob: outBlob,
      totalDuration,
      segments,
      format,
    };
  }

  /**
   * Get an audio Blob from an AudioTrack.
   * Supports blob: URLs, http(s) URLs, and synthesizes an audible beat for demo synth:// tracks.
   */
  public static async getTrackAudioBlob(track: AudioTrack): Promise<Blob> {
    if (track.url.startsWith('blob:') || track.url.startsWith('http')) {
      const res = await fetch(track.url);
      return await res.blob();
    }

    // Synthesize audio buffer for demo/synth tracks
    const duration = Math.min(180, track.duration || 180);
    const sampleRate = 44100;
    const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(2, sampleRate * duration, sampleRate);

    const tempo = 128;
    const beatLen = 60 / tempo;
    const totalBeats = Math.floor(duration / beatLen);

    for (let b = 0; b < totalBeats; b++) {
      const time = b * beatLen;
      // Kick drum
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(time);
      osc.stop(time + 0.15);

      // Hi-hat
      const hatOsc = offlineCtx.createOscillator();
      const hatGain = offlineCtx.createGain();
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(8000, time + beatLen / 2);
      hatGain.gain.setValueAtTime(0.08, time + beatLen / 2);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, time + beatLen / 2 + 0.05);
      hatOsc.connect(hatGain);
      hatGain.connect(offlineCtx.destination);
      hatOsc.start(time + beatLen / 2);
      hatOsc.stop(time + beatLen / 2 + 0.05);
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWav(renderedBuffer);
  }
}

/**
 * Synchronously slice lyrics when audio is cut or trimmed.
 * Accurately shifts segment and word timestamps by -trimStart,
 * eliminates discarded sections, and prevents any timestamp drift or out-of-sync behavior.
 */
export function sliceLyrics(
  lyrics: LyricSegment[] | undefined,
  trimStart: number,
  trimEnd: number
): LyricSegment[] {
  if (!lyrics || lyrics.length === 0) return [];
  const cutDuration = Math.max(0.01, trimEnd - trimStart);
  const result: LyricSegment[] = [];

  for (const seg of lyrics) {
    // Discard segments that end before trimStart or start after trimEnd
    if (seg.end <= trimStart || seg.start >= trimEnd) {
      continue;
    }

    const newStart = Math.max(0, seg.start - trimStart);
    const newEnd = Math.min(cutDuration, seg.end - trimStart);

    if (newEnd <= newStart) {
      continue;
    }

    // Adjust word timestamps if word-level timing exists
    let words: LyricSegment['words'] = undefined;
    if (seg.words && seg.words.length > 0) {
      const validWords = seg.words.filter(
        (w) => w.end > trimStart && w.start < trimEnd
      );
      if (validWords.length > 0) {
        words = validWords.map((w) => ({
          ...w,
          start: Math.max(0, Number((w.start - trimStart).toFixed(3))),
          end: Math.min(cutDuration, Number((w.end - trimStart).toFixed(3))),
        }));
      }
    }

    // Reconstruct line text if words were partially sliced
    let text = seg.text;
    if (words && words.length > 0 && words.length < seg.words!.length) {
      text = words.map((w) => w.word).join(' ');
    }

    result.push({
      ...seg,
      id: `line-${result.length + 1}`,
      text,
      start: Number(newStart.toFixed(3)),
      end: Number(newEnd.toFixed(3)),
      words,
    });
  }

  return result;
}

