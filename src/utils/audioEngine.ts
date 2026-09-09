import type { AudioFrequencyData, AudioTrack } from '../types/visualizer';
import {
  AudioAnalyzerAIService,
  type SongAnalysisResult,
  type StemIsolationMode,
} from './audioAnalyzerAi';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;

  // Synthesizer fallback for offline/instant beat generation
  private synthInterval: number | null = null;
  private synthIsPlaying: boolean = false;
  private synthTime: number = 0;
  private synthBpm: number = 128;
  private synthStep: number = 0;

  // Analysis data structures
  private freqArray: Uint8Array = new Uint8Array(0);
  private timeArray: Uint8Array = new Uint8Array(0);
  private bassHistory: number[] = [];
  private currentBassEnergy: number = 0;
  private currentMidEnergy: number = 0;
  private currentTrebleEnergy: number = 0;
  private currentOverallEnergy: number = 0;
  private beatCooldown: number = 0;

  public isPlaying: boolean = false;
  public duration: number = 0;
  private _currentTime: number = 0;

  public get currentTime(): number {
    if (this.audioElement && this.isPlaying) {
      return this.audioElement.currentTime;
    }
    return this._currentTime;
  }

  public set currentTime(val: number) {
    this._currentTime = val;
  }
  public trimRange: { start: number; end: number } | null = null;
  public stemMode: StemIsolationMode = 'full';
  public lastAnalysis: SongAnalysisResult | null = null;
  public onTimeUpdate: ((time: number, duration: number) => void) | null = null;
  public onEnded: (() => void) | null = null;
  public currentTrack: AudioTrack | null = null;

  constructor() {
    // Lazy init audio context on first user interaction
  }

  public async initAudioContext(): Promise<void> {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.72; // Snappy & responsive
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -25;

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'allpass';

      this.streamDestination = this.audioCtx.createMediaStreamDestination();

      // Audio Graph:
      // Sources (Audio Element or Synth) -> filterNode -> analyser -> gainNode -> destination & streamDestination
      // This ensures analyser always analyzes the full 0dB nominal track without volume slider attenuation!
      this.filterNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
      this.gainNode.connect(this.streamDestination);

      this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.setupAudioElement();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  private setupAudioElement(): void {
    if (!this.audioCtx || !this.filterNode) return;
    if (!this.audioElement) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';

      audio.addEventListener('loadedmetadata', () => {
        this.duration = audio.duration || 180;
        if (this.onTimeUpdate) {
          this.onTimeUpdate(audio.currentTime, this.duration);
        }
      });

      audio.addEventListener('timeupdate', () => {
        this.currentTime = audio.currentTime;
        if (this.trimRange && this.isPlaying) {
          if (this.currentTime >= this.trimRange.end) {
            audio.currentTime = this.trimRange.start;
            this.currentTime = this.trimRange.start;
          } else if (this.currentTime < this.trimRange.start) {
            audio.currentTime = this.trimRange.start;
            this.currentTime = this.trimRange.start;
          }
        }
        if (this.onTimeUpdate) {
          this.onTimeUpdate(this.currentTime, this.duration);
        }
      });

      audio.addEventListener('ended', () => {
        this.isPlaying = false;
        if (this.onEnded) {
          this.onEnded();
        }
      });

      audio.addEventListener('error', () => {
        console.warn('Audio URL load failed or CORS blocked. Switching to high-energy synth engine fallback.');
        this.setupSynthTrack('synth://edm');
      });

      try {
        this.mediaSource = this.audioCtx.createMediaElementSource(audio);
        this.mediaSource.connect(this.filterNode);
      } catch (err) {
        console.warn('Failed to create media source node:', err);
      }

      this.audioElement = audio;
    }
  }

  public setStemMode(mode: StemIsolationMode): void {
    this.stemMode = mode;
    if (!this.filterNode) return;

    if (mode === 'bass_focus') {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 240;
      this.filterNode.Q.value = 1.2;
    } else if (mode === 'vocal_focus') {
      this.filterNode.type = 'bandpass';
      this.filterNode.frequency.value = 1200;
      this.filterNode.Q.value = 0.8;
    } else if (mode === 'treble_focus') {
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.value = 3200;
      this.filterNode.Q.value = 1.0;
    } else {
      // Full range balanced
      this.filterNode.type = 'allpass';
    }
  }

  public async analyzeCurrentTrack(): Promise<SongAnalysisResult | null> {
    if (!this.currentTrack) return null;
    await this.initAudioContext();

    try {
      let arrayBuf: ArrayBuffer;
      if (this.currentTrack.url.startsWith('blob:') || this.currentTrack.url.startsWith('http')) {
        const res = await fetch(this.currentTrack.url);
        arrayBuf = await res.arrayBuffer();
      } else {
        // Fallback for synth track
        this.lastAnalysis = {
          bpm: 128,
          confidence: 0.95,
          musicalKey: 'F# Minor',
          energyCurve: Array.from({ length: 180 }, (_, i) => 0.4 + Math.sin(i / 10) * 0.35),
          sections: [
            { id: 'sec-intro', name: '✨ Intro', start: 0, end: 15, energy: 0.3, type: 'intro' },
            { id: 'sec-drop-1', name: '🔥 Beat Drop 1', start: 45, end: 75, energy: 0.95, type: 'drop' },
            { id: 'sec-drop-2', name: '🚀 Climax Drop 2', start: 105, end: 140, energy: 1.0, type: 'chorus' },
            { id: 'sec-outro', name: '🌙 Outro', start: 165, end: 180, energy: 0.2, type: 'outro' },
          ],
        };
        return this.lastAnalysis;
      }

      const decoded = await this.audioCtx!.decodeAudioData(arrayBuf);
      const analysis = AudioAnalyzerAIService.analyzeAudioBuffer(decoded);
      this.lastAnalysis = analysis;
      return analysis;
    } catch (err) {
      console.warn('AI Audio analysis failed:', err);
      return null;
    }
  }

  public setFftSize(size: number): void {
    if (this.analyser) {
      this.analyser.fftSize = size;
      this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  public setSmoothing(smoothing: number): void {
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = Math.max(0.1, Math.min(0.98, smoothing));
    }
  }

  public async loadAudioFile(file: File): Promise<AudioTrack> {
    await this.initAudioContext();
    this.stopSynth();

    const objectUrl = URL.createObjectURL(file);
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const parts = fileName.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : '';
    const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : parts[0].trim();

    const track: AudioTrack = {
      id: 'custom-' + Date.now(),
      title,
      artist,
      url: objectUrl,
      coverArt: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
      genre: 'User Audio',
      isCustom: true,
    };

    await this.loadTrack(track);
    return track;
  }

  public async loadTrack(track: AudioTrack): Promise<void> {
    await this.initAudioContext();
    this.currentTrack = track;

    this.stopSynth();

    // Check if it's a built-in synth track
    if (track.url.startsWith('synth://')) {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.src = '';
      }
      this.setupSynthTrack(track.url);
      return;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = track.url;
      this.audioElement.load();
    }
  }

  public async play(): Promise<void> {
    await this.initAudioContext();

    if (this.synthIsPlaying) {
      this.isPlaying = true;
      return;
    }

    if (this.audioElement) {
      try {
        await this.audioElement.play();
        this.isPlaying = true;
      } catch (err) {
        console.warn('Direct audio play failed, falling back to synth engine:', err);
        this.setupSynthTrack('synth://edm');
        this.playSynth();
      }
    } else {
      this.setupSynthTrack('synth://edm');
      this.playSynth();
    }
  }

  public pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.synthIsPlaying) {
      this.pauseSynth();
    }
    this.isPlaying = false;
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setTrimRange(range: { start: number; end: number } | null): void {
    this.trimRange = range;
    if (range) {
      if (this.currentTime < range.start || this.currentTime >= range.end) {
        this.seek(range.start);
      }
    }
  }

  public seek(seconds: number): void {
    if (this.audioElement && this.duration > 0) {
      this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.duration));
      this.currentTime = this.audioElement.currentTime;
    } else if (this.synthIsPlaying) {
      this.synthTime = seconds % 180;
      this.currentTime = this.synthTime;
    }
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime, this.duration);
    }
  }

  public setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  public setLoop(loop: boolean): void {
    if (this.audioElement) {
      this.audioElement.loop = loop;
    }
  }

  public getAudioStreamDestination(): MediaStreamAudioDestinationNode | null {
    return this.streamDestination;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  // Real-time Audio Frequency & Beat Extraction
  public getAnalysisData(): AudioFrequencyData {
    if (!this.analyser || !this.audioCtx) {
      const empty = new Uint8Array(64);
      return {
        frequencyData: empty,
        timeData: empty,
        bassEnergy: 0,
        midEnergy: 0,
        trebleEnergy: 0,
        overallEnergy: 0,
        isBeat: false,
      };
    }

    this.analyser.getByteFrequencyData(this.freqArray as any);
    this.analyser.getByteTimeDomainData(this.timeArray as any);

    const length = this.freqArray.length;
    if (length === 0) {
      return {
        frequencyData: this.freqArray,
        timeData: this.timeArray,
        bassEnergy: 0,
        midEnergy: 0,
        trebleEnergy: 0,
        overallEnergy: 0,
        isBeat: false,
      };
    }

    const sampleRate = this.audioCtx.sampleRate || 44100;
    const hzPerBin = sampleRate / (length * 2);

    const binAtHz = (hz: number) => Math.max(1, Math.min(length - 1, Math.round(hz / hzPerBin)));

    // Accurate frequency bands based on acoustic frequency spectrum:
    // Sub-bass & punchy bass kick: 25 Hz - 200 Hz
    const bassStart = binAtHz(25);
    const bassEnd = binAtHz(200);

    // Midrange (vocals, guitars, synth leads, snare body): 200 Hz - 3500 Hz
    const midStart = bassEnd;
    const midEnd = binAtHz(3500);

    // Treble (cymbals, hi-hats, vocal presence, sparkle): 3500 Hz - 16000 Hz
    const trebleStart = midEnd;
    const trebleEnd = binAtHz(16000);

    // Calculate Bass Energy: blend RMS & Peak with noise floor subtraction
    let bassSumSq = 0;
    let bassPeak = 0;
    for (let i = bassStart; i <= bassEnd; i++) {
      const v = Math.max(0, (this.freqArray[i] - 28) / 227); // subtract noise floor
      bassSumSq += v * v;
      if (v > bassPeak) bassPeak = v;
    }
    const bassCount = Math.max(1, bassEnd - bassStart + 1);
    const bassRms = Math.sqrt(bassSumSq / bassCount);
    // Dynamic contrast expansion on bass: emphasizes sharp kick drum transients
    const rawBass = Math.min(1.0, Math.pow(bassRms * 0.55 + bassPeak * 0.45, 1.35) * 1.35);

    // Midrange Energy
    let midSumSq = 0;
    let midPeak = 0;
    for (let i = midStart; i <= midEnd; i++) {
      const v = Math.max(0, (this.freqArray[i] - 24) / 231);
      midSumSq += v * v;
      if (v > midPeak) midPeak = v;
    }
    const midCount = Math.max(1, midEnd - midStart + 1);
    const midRms = Math.sqrt(midSumSq / midCount);
    const rawMid = Math.min(1.0, midRms * 0.6 + midPeak * 0.4);

    // Treble Energy
    let trebleSumSq = 0;
    let treblePeak = 0;
    for (let i = trebleStart; i <= trebleEnd; i++) {
      const v = Math.max(0, (this.freqArray[i] - 20) / 235);
      trebleSumSq += v * v;
      if (v > treblePeak) treblePeak = v;
    }
    const trebleCount = Math.max(1, trebleEnd - trebleStart + 1);
    const trebleRms = Math.sqrt(trebleSumSq / trebleCount);
    const rawTreble = Math.min(1.0, (trebleRms * 0.6 + treblePeak * 0.4) * 1.4); // compensate treble roll-off

    // Overall energy
    const rawOverall = rawBass * 0.5 + rawMid * 0.3 + rawTreble * 0.2;

    // Fast Attack & Natural Springy Decay (Envelope Follower)
    // When a kick hits, attack is near-instantaneous so visualizer pops on the beat!
    if (rawBass > this.currentBassEnergy) {
      this.currentBassEnergy = this.currentBassEnergy * 0.15 + rawBass * 0.85;
    } else {
      this.currentBassEnergy = this.currentBassEnergy * 0.84 + rawBass * 0.16;
    }

    if (rawMid > this.currentMidEnergy) {
      this.currentMidEnergy = this.currentMidEnergy * 0.25 + rawMid * 0.75;
    } else {
      this.currentMidEnergy = this.currentMidEnergy * 0.82 + rawMid * 0.18;
    }

    if (rawTreble > this.currentTrebleEnergy) {
      this.currentTrebleEnergy = this.currentTrebleEnergy * 0.3 + rawTreble * 0.7;
    } else {
      this.currentTrebleEnergy = this.currentTrebleEnergy * 0.85 + rawTreble * 0.15;
    }

    this.currentOverallEnergy = this.currentOverallEnergy * 0.75 + rawOverall * 0.25;

    // Accurate Beat Detection Algorithm
    this.bassHistory.push(rawBass);
    if (this.bassHistory.length > 30) {
      this.bassHistory.shift();
    }

    const avgBass = this.bassHistory.reduce((a, b) => a + b, 0) / (this.bassHistory.length || 1);
    const variance = this.bassHistory.reduce((a, b) => a + Math.pow(b - avgBass, 2), 0) / (this.bassHistory.length || 1);
    const dynamicThreshold = Math.max(1.15, 1.45 - variance * 8);

    let isBeat = false;
    this.beatCooldown--;
    if (
      this.isPlaying &&
      rawBass > 0.32 &&
      rawBass > avgBass * dynamicThreshold &&
      this.beatCooldown <= 0
    ) {
      isBeat = true;
      this.beatCooldown = 9; // ~150ms cooldown to match tempo without multi-triggering
    }

    return {
      frequencyData: this.freqArray,
      timeData: this.timeArray,
      bassEnergy: Math.min(1, Math.max(0, this.currentBassEnergy)),
      midEnergy: Math.min(1, Math.max(0, this.currentMidEnergy)),
      trebleEnergy: Math.min(1, Math.max(0, this.currentTrebleEnergy)),
      overallEnergy: Math.min(1, Math.max(0, this.currentOverallEnergy)),
      isBeat,
    };
  }

  // --- High Precision Web Audio Synthesizer Engine (Lookahead Scheduler) ---
  private setupSynthTrack(synthUrl: string): void {
    this.duration = 180; // 3 minutes simulated track
    this.currentTime = 0;

    if (synthUrl.includes('lofi')) {
      this.synthBpm = 85;
    } else if (synthUrl.includes('trap')) {
      this.synthBpm = 140;
    } else if (synthUrl.includes('synthwave')) {
      this.synthBpm = 118;
    } else {
      this.synthBpm = 128; // EDM
    }
  }

  private nextNoteTime: number = 0;

  private playSynth(): void {
    if (this.synthIsPlaying || !this.audioCtx) return;
    this.synthIsPlaying = true;
    this.isPlaying = true;
    this.synthStep = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;

    const lookaheadMs = 25;
    const scheduleAheadTime = 0.12;
    const secondsPer16th = 60 / this.synthBpm / 4;

    this.synthInterval = window.setInterval(() => {
      if (!this.synthIsPlaying || !this.audioCtx) return;

      while (this.nextNoteTime < this.audioCtx.currentTime + scheduleAheadTime) {
        this.triggerSynthStep(this.synthStep, this.nextNoteTime);
        this.synthStep = (this.synthStep + 1) % 64;
        this.nextNoteTime += secondsPer16th;
        this.synthTime += secondsPer16th;
        if (this.synthTime >= this.duration) {
          this.synthTime = 0;
        }
      }

      this.currentTime = this.synthTime;
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.currentTime, this.duration);
      }
    }, lookaheadMs);
  }

  private pauseSynth(): void {
    this.synthIsPlaying = false;
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  private stopSynth(): void {
    this.pauseSynth();
    this.synthTime = 0;
    this.synthStep = 0;
  }

  private triggerSynthStep(step: number, time: number): void {
    if (!this.audioCtx || !this.filterNode) return;

    // Kick drum on beats (step 0, 4, 8, 12, 16, 20, 24, 28...)
    const isKick = step % 4 === 0;
    if (isKick) {
      this.playKick(time);
    }

    // Snare / Clap on beats 4, 12, 20, 28 (the 2 and 4)
    if (step % 8 === 4) {
      this.playSnare(time);
    }

    // Hi-hats on off-beats (step 2, 6, 10, 14...)
    if (step % 2 === 0) {
      this.playHiHat(time, step % 4 === 2 ? 0.75 : 0.35);
    }

    // Deep 808 Bassline
    if (step % 4 === 0 || step % 4 === 3) {
      const bassNotes = [55, 55, 65.41, 48.99]; // A1, A1, C2, G1
      const note = bassNotes[Math.floor(step / 16) % bassNotes.length];
      this.playBass(time, note);
    }

    // Arpeggiated Lead Synth
    const arpHz = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 783.99];
    const freq = arpHz[(step * 3) % arpHz.length];
    this.playLead(time, freq);
  }

  private playKick(time: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    // Punchy transient click dropping to solid 808 sub-bass
    osc.frequency.setValueAtTime(190, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.06);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.32);

    gain.gain.setValueAtTime(1.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.36);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.37);
  }

  private playSnare(time: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.18);
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 850;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.filterNode);

    noise.start(time);
    noise.stop(time + 0.19);
  }

  private playHiHat(time: number, vol: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(8000, time);

    gain.gain.setValueAtTime(vol * 0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  private playBass(time: number, freq: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, time);
    filter.Q.setValueAtTime(2.2, time);

    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playLead(time: number, freq: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.16);
  }
}

export const globalAudioEngine = new AudioEngine();
