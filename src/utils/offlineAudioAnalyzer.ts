import type { AudioFrequencyData } from '../types/visualizer';

/**
 * Ultra-fast Cooley-Tukey in-place Radix-2 FFT for offline video rendering
 */
export class OfflineAudioAnalyzer {
  private sampleRate: number = 44100;
  private channelData: Float32Array = new Float32Array(0);
  private fftSize: number = 2048;
  private cosTable: Float32Array;
  private sinTable: Float32Array;
  private hannWindow: Float32Array;

  constructor(fftSize: number = 2048) {
    this.fftSize = fftSize;
    const n = this.fftSize;
    this.cosTable = new Float32Array(n / 2);
    this.sinTable = new Float32Array(n / 2);
    this.hannWindow = new Float32Array(n);

    for (let i = 0; i < n / 2; i++) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / n);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / n);
    }

    for (let i = 0; i < n; i++) {
      this.hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    }
  }

  public setAudioBuffer(audioBuffer: AudioBuffer): void {
    this.sampleRate = audioBuffer.sampleRate;
    // Mix to mono if stereo
    if (audioBuffer.numberOfChannels > 1) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      const mono = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i] + right[i]) * 0.5;
      }
      this.channelData = mono;
    } else {
      this.channelData = audioBuffer.getChannelData(0);
    }
  }

  /**
   * Compute exact FFT and AudioFrequencyData for a given timestamp in seconds
   */
  public getFrequencyDataAtTime(timeSeconds: number): AudioFrequencyData {
    const n = this.fftSize;
    const sampleIdx = Math.floor(timeSeconds * this.sampleRate);
    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    // Extract windowed PCM samples
    for (let i = 0; i < n; i++) {
      const idx = sampleIdx - Math.floor(n / 2) + i;
      const sample = idx >= 0 && idx < this.channelData.length ? this.channelData[idx] : 0;
      real[i] = sample * this.hannWindow[i];
      imag[i] = 0;
    }

    // Run in-place Radix-2 FFT
    this.transform(real, imag);

    // Compute magnitudes
    const halfN = n / 2;
    const magnitudes = new Float32Array(halfN);
    for (let i = 0; i < halfN; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / (n / 4);
    }

    // 1. Generate 64-band frequency data (0-255)
    const numBands = 64;
    const frequencyData = new Uint8Array(numBands);
    for (let i = 0; i < numBands; i++) {
      // Logarithmic bin distribution (more resolution in bass/mids)
      const lowBin = Math.floor(Math.pow(i / numBands, 2) * (halfN * 0.85));
      const highBin = Math.max(
        lowBin + 1,
        Math.floor(Math.pow((i + 1) / numBands, 2) * (halfN * 0.85))
      );

      let sum = 0;
      let count = 0;
      for (let b = lowBin; b < highBin && b < halfN; b++) {
        sum += magnitudes[b];
        count++;
      }
      const avgMag = count > 0 ? sum / count : 0;
      // Convert to dB scale / visualizer range
      const val = Math.min(255, Math.max(0, Math.floor(Math.pow(avgMag * 3.5, 0.75) * 255)));
      frequencyData[i] = val;
    }

    // 2. Generate 128-point waveform data (0-255, center 128)
    const waveformData = new Uint8Array(128);
    const waveStep = Math.floor(n / 128);
    for (let i = 0; i < 128; i++) {
      const idx = sampleIdx - Math.floor(n / 2) + i * waveStep;
      const sample = idx >= 0 && idx < this.channelData.length ? this.channelData[idx] : 0;
      waveformData[i] = Math.min(255, Math.max(0, Math.floor((sample + 1) * 127.5)));
    }

    // 3. Compute Energy Bands
    // Bass: 20Hz - 250Hz (approx bins 1 to 12 at 44.1k/2048)
    let bassSum = 0;
    const bassBins = Math.min(12, halfN);
    for (let i = 1; i <= bassBins; i++) {
      bassSum += magnitudes[i];
    }
    const bassEnergy = Math.min(1, Math.max(0, Math.pow((bassSum / bassBins) * 4.2, 0.85)));

    // Mid: 250Hz - 2000Hz (approx bins 13 to 93)
    let midSum = 0;
    const midStart = 13;
    const midEnd = Math.min(93, halfN);
    for (let i = midStart; i < midEnd; i++) {
      midSum += magnitudes[i];
    }
    const midEnergy = Math.min(1, Math.max(0, (midSum / (midEnd - midStart)) * 4.5));

    // Treble: 2000Hz - 10000Hz
    let trebleSum = 0;
    const trebleStart = 94;
    const trebleEnd = Math.min(465, halfN);
    for (let i = trebleStart; i < trebleEnd; i++) {
      trebleSum += magnitudes[i];
    }
    const trebleEnergy = Math.min(1, Math.max(0, (trebleSum / (trebleEnd - trebleStart)) * 6.0));

    const overallEnergy = Math.min(1, bassEnergy * 0.5 + midEnergy * 0.3 + trebleEnergy * 0.2);
    const isBeat = bassEnergy > 0.62;

    return {
      frequencyData,
      timeData: waveformData,
      bassEnergy,
      midEnergy,
      trebleEnergy,
      overallEnergy,
      isBeat,
    };
  }

  /**
   * Cooley-Tukey Radix-2 in-place FFT
   */
  private transform(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        let temp = real[i];
        real[i] = real[j];
        real[j] = temp;
        temp = imag[i];
        imag[i] = imag[j];
        imag[j] = temp;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < halfLen; k++) {
          const tableIdx = k * step;
          const cos = this.cosTable[tableIdx];
          const sin = this.sinTable[tableIdx];
          const uReal = real[i + k];
          const uImag = imag[i + k];
          const vReal = real[i + k + halfLen] * cos + imag[i + k + halfLen] * sin;
          const vImag = imag[i + k + halfLen] * cos - real[i + k + halfLen] * sin;
          real[i + k] = uReal + vReal;
          imag[i + k] = uImag + vImag;
          real[i + k + halfLen] = uReal - vReal;
          imag[i + k + halfLen] = uImag - vImag;
        }
      }
    }
  }
}
