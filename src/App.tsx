import { useState, useEffect, useCallback } from 'react';
import { Sliders } from 'lucide-react';
import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  AspectRatio,
  PreviewResolution,
  AudioTrack,
  SpecterrPreset,
  EffectsConfig,
} from './types/visualizer';
import { SPECTERR_PRESETS } from './data/presets';
import { SAMPLE_TRACKS } from './data/sampleTracks';
import { DEFAULT_EFFECTS_CONFIG } from './constants/defaultEffects';
import { globalAudioEngine } from './utils/audioEngine';
import { Navbar } from './components/Navbar';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { TabNavigation } from './components/Sidebar/TabNavigation';
import { ExportModal } from './components/ExportModal';
import { PresetGalleryModal } from './components/PresetGalleryModal';
import { WhisperModal } from './components/WhisperModal';
import { AudioLabModal } from './components/AudioLabModal';
import { AudioCutterJoinerModal } from './components/AudioCutterJoinerModal';
import { CapCutTimeline } from './components/CapCutTimeline';
import { SubtitleEditorModal } from './components/SubtitleEditorModal';
import { TrackLibraryModal } from './components/TrackLibraryModal';
import { WhisperAIService } from './utils/whisperAi';
import { saveProjectLocally, loadProjectLocally } from './utils/projectStorage';
import type { StoredTrackItem } from './utils/idb';

export function App() {
  const initialPreset = SPECTERR_PRESETS[0];

  // Studio State
  const [currentPresetId, setCurrentPresetId] = useState<string>(initialPreset.id);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [previewResolution, setPreviewResolution] = useState<PreviewResolution>(() => {
    const saved = localStorage.getItem('specterr_preview_resolution');
    if (saved === '1080p' || saved === '720p' || saved === '480p' || saved === '360p') {
      return saved as PreviewResolution;
    }
    const legacy = localStorage.getItem('specterr_preview_quality');
    if (legacy === 'high') return '1080p';
    return '720p';
  });

  const handlePreviewResolutionChange = (res: PreviewResolution) => {
    setPreviewResolution(res);
    localStorage.setItem('specterr_preview_resolution', res);
  };

  // Customization Configurations (Default: completely blank canvas on new start, all effects OFF)
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>({
    ...initialPreset.visualizer,
    enabled: false,
  });
  const [centerLogoConfig, setCenterLogoConfig] = useState<CenterLogoConfig>({
    ...initialPreset.centerLogo,
    enabled: false,
  });
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({
    ...initialPreset.background,
    type: 'solid_color',
    solidColor: '#050508',
    customImageUrl: '',
    multiImageUrls: [],
    dimOpacity: 0,
    blur: 0,
    vignette: 0,
    bassShake: 0,
    bassZoom: 0,
  });
  const [particlesConfig, setParticlesConfig] = useState<ParticlesConfig>({
    ...initialPreset.particles,
    enabled: false,
  });
  const [typographyConfig, setTypographyConfig] = useState<TypographyConfig>({
    ...initialPreset.typography,
    showTitle: false,
    showArtist: false,
    showSubtitle: false,
    showTimeProgress: false,
    socialBadges: initialPreset.typography.socialBadges
      ? { ...initialPreset.typography.socialBadges, enabled: false }
      : undefined,
  });
  const [effectsConfig, setEffectsConfig] = useState<EffectsConfig>({
    ...DEFAULT_EFFECTS_CONFIG,
    chromaticAberration: { ...DEFAULT_EFFECTS_CONFIG.chromaticAberration, enabled: false },
    vhsOverlay: { ...DEFAULT_EFFECTS_CONFIG.vhsOverlay, enabled: false },
    camera3D: { ...DEFAULT_EFFECTS_CONFIG.camera3D, enabled: false },
    waveformScrubber: { ...DEFAULT_EFFECTS_CONFIG.waveformScrubber, enabled: false },
    videoBackground: { ...DEFAULT_EFFECTS_CONFIG.videoBackground, enabled: false },
    cinematicLighting: { enabled: false, ambientFlares: false, lightLeaks: false, intensity: 0.5 },
    cinematicCamera: { enabled: false, type: 'none', pulseOnBeat: false, intensity: 0.5 },
  });
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(
    initialPreset.subtitle
      ? { ...initialPreset.subtitle, enabled: false }
      : {
          enabled: false,
          fontFamily: 'Montserrat',
          fontSize: 28,
          textColor: '#FFFFFF',
          highlightColor: '#00F0FF',
          strokeColor: '#000000',
          strokeWidth: 4,
          position: 'center_bottom',
          style: 'karaoke_glow',
          showBox: true,
          boxColor: 'rgba(0, 0, 0, 0.65)',
          reactToBeat: true,
          lyrics: [],
        }
  );

  // Audio Playback State
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(SAMPLE_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isWhisperOpen, setIsWhisperOpen] = useState<boolean>(false);
  const [isAudioLabOpen, setIsAudioLabOpen] = useState<boolean>(false);
  const [isCutterJoinerOpen, setIsCutterJoinerOpen] = useState<boolean>(false);
  const [isSubtitleEditorOpen, setIsSubtitleEditorOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isMobileCustomizeOpen, setIsMobileCustomizeOpen] = useState<boolean>(false);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);

  // Initialize and Bind Audio Engine Listeners
  useEffect(() => {
    const initAudio = async () => {
      // 0. Try to restore full saved project state (all edits, effects, subtitles) from local storage
      let savedProject: any = null;
      try {
        savedProject = await loadProjectLocally();
      } catch (e) {
        console.error('Failed to restore saved local project:', e);
      }

      // 1. Try to load custom track from IndexedDB
      try {
        const { loadCustomTrack, getAllTracksFromLibrary, saveTrackToLibrary } = await import('./utils/idb');
        const customTrackData = await loadCustomTrack();
        if (customTrackData) {
          const track = await globalAudioEngine.loadAudioFile(customTrackData.file);
          // Restore previous name/artist if it was customized
          track.title = customTrackData.trackMeta?.title || track.title;
          track.artist = customTrackData.trackMeta?.artist || track.artist;
          setCurrentTrack(track);

          // Seed into persistent library if empty
          try {
            const libraryItems = await getAllTracksFromLibrary();
            if (libraryItems.length === 0) {
              await saveTrackToLibrary({
                id: 'custom_initial_' + Date.now(),
                title: track.title,
                artist: track.artist,
                duration: track.duration || 0,
                file: customTrackData.file,
                lyrics: customTrackData.lyrics || [],
                createdAt: Date.now(),
                isCut: false,
              });
            }
          } catch (seedErr) {
            console.error('Failed to seed custom track to library:', seedErr);
          }

          // Sync typography with custom track unless user has saved typography
          setTypographyConfig((prev) => savedProject?.typography || ({
            ...prev,
            title: track.title,
            artist: track.artist || '',
            subtitle: '',
            showTitle: false,
            showArtist: false,
            showSubtitle: false,
            showTimeProgress: false,
          }));

          // Multi-tier robust lyrics recovery:
          // 1. Check customTrackData.lyrics
          // 2. Check localStorage by track id or title
          // 3. Check active song backup ONLY IF matching this track
          // 4. Check savedProject?.subtitle?.lyrics ONLY IF matching this track
          let recoveredLyrics: any[] = [];
          if (customTrackData.lyrics && customTrackData.lyrics.length > 0) {
            recoveredLyrics = customTrackData.lyrics;
          } else {
            const byId = localStorage.getItem(`specterr_lyrics_${track.id}`);
            const byTitle = localStorage.getItem(`specterr_lyrics_${track.title}`);
            const activeBackupStr = localStorage.getItem('specterr_active_song_lyrics');
            if (byId) {
              try { recoveredLyrics = JSON.parse(byId); } catch {}
            } else if (byTitle) {
              try { recoveredLyrics = JSON.parse(byTitle); } catch {}
            } else if (activeBackupStr) {
              try {
                const parsed = JSON.parse(activeBackupStr);
                if (
                  parsed.lyrics &&
                  parsed.lyrics.length > 0 &&
                  (parsed.trackId === track.id ||
                    (parsed.trackTitle && parsed.trackTitle.trim().toLowerCase() === track.title.trim().toLowerCase()))
                ) {
                  recoveredLyrics = parsed.lyrics;
                }
              } catch {}
            } else if (
              savedProject?.subtitle?.lyrics &&
              savedProject.subtitle.lyrics.length > 0 &&
              savedProject.typography?.title &&
              savedProject.typography.title.trim().toLowerCase() === track.title.trim().toLowerCase()
            ) {
              recoveredLyrics = savedProject.subtitle.lyrics;
            }
          }

          // Restore saved lyrics for custom track, but default enabled to false unless saved as true
          setSubtitleConfig((prev) => ({
            ...(savedProject?.subtitle || prev),
            enabled: savedProject?.subtitle ? savedProject.subtitle.enabled : false,
            lyrics: recoveredLyrics,
          }));

          if (savedProject) {
            if (savedProject.visualizer) setVisualizerConfig(savedProject.visualizer);
            if (savedProject.centerLogo) setCenterLogoConfig(savedProject.centerLogo);
            if (savedProject.background) setBackgroundConfig(savedProject.background);
            if (savedProject.particles) setParticlesConfig(savedProject.particles);
            if (savedProject.effects) setEffectsConfig(savedProject.effects);
            if (savedProject.aspectRatio) setAspectRatio(savedProject.aspectRatio);
            if (savedProject.currentPresetId) setCurrentPresetId(savedProject.currentPresetId);
          } else {
            setVisualizerConfig((prev) => ({ ...prev, enabled: false }));
            setCenterLogoConfig((prev) => ({ ...prev, enabled: false }));
            setBackgroundConfig((prev) => ({
              ...prev,
              type: 'solid_color',
              solidColor: '#050508',
              customImageUrl: '',
              multiImageUrls: [],
              dimOpacity: 0,
              blur: 0,
              vignette: 0,
              bassShake: 0,
              bassZoom: 0,
            }));
            setParticlesConfig((prev) => ({ ...prev, enabled: false }));
          }
          return;
        }
      } catch (e) {
        console.error('Failed to restore custom track', e);
      }

      // 2. Try to load saved sample track ID from localStorage
      const savedId = localStorage.getItem('specterr_saved_track_id');
      const savedTrack = SAMPLE_TRACKS.find(t => t.id === savedId) || SAMPLE_TRACKS[0];
      setCurrentTrack(savedTrack);
      globalAudioEngine.loadTrack(savedTrack);



      setTypographyConfig((prev) => savedProject?.typography || ({
        ...prev,
        title: savedTrack.title,
        artist: savedTrack.artist,
        subtitle: '',
        showTitle: false,
        showArtist: false,
        showSubtitle: false,
        showTimeProgress: false,
      }));

      // Restore saved lyrics if available (by id, title, or matching active backup), otherwise generate demo lyrics
      const savedLyricsById = localStorage.getItem(`specterr_lyrics_${savedTrack.id}`);
      const savedLyricsByTitle = localStorage.getItem(`specterr_lyrics_${savedTrack.title}`);
      const activeBackupStr = localStorage.getItem('specterr_active_song_lyrics');

      let trackLyrics: any[] = [];
      if (savedLyricsById) {
        try { trackLyrics = JSON.parse(savedLyricsById); } catch {}
      } else if (savedLyricsByTitle) {
        try { trackLyrics = JSON.parse(savedLyricsByTitle); } catch {}
      } else if (activeBackupStr) {
        try {
          const parsed = JSON.parse(activeBackupStr);
          if (
            parsed.lyrics &&
            parsed.lyrics.length > 0 &&
            (parsed.trackId === savedTrack.id ||
              (parsed.trackTitle && parsed.trackTitle.trim().toLowerCase() === savedTrack.title.trim().toLowerCase()))
          ) {
            trackLyrics = parsed.lyrics;
          }
        } catch {}
      } else if (
        savedProject?.subtitle?.lyrics &&
        savedProject.subtitle.lyrics.length > 0 &&
        savedProject.typography?.title &&
        savedProject.typography.title.trim().toLowerCase() === savedTrack.title.trim().toLowerCase()
      ) {
        trackLyrics = savedProject.subtitle.lyrics;
      }

      if (!trackLyrics || trackLyrics.length === 0) {
        trackLyrics = WhisperAIService.generateDemoLyrics(savedTrack.title, savedTrack.genre);
      }

      setSubtitleConfig((prev) => ({
        ...(savedProject?.subtitle || prev),
        enabled: savedProject?.subtitle ? savedProject.subtitle.enabled : false,
        lyrics: trackLyrics,
      }));

      if (savedProject?.centerLogo) {
        setCenterLogoConfig(savedProject.centerLogo);
      } else {
        setCenterLogoConfig((prev) => ({
          ...prev,
          enabled: false,
          imageUrl: savedTrack.coverArt || prev.imageUrl,
        }));
      }

      if (savedProject) {
        if (savedProject.visualizer) setVisualizerConfig(savedProject.visualizer);
        if (savedProject.background) setBackgroundConfig(savedProject.background);
        if (savedProject.particles) setParticlesConfig(savedProject.particles);
        if (savedProject.effects) setEffectsConfig(savedProject.effects);
        if (savedProject.aspectRatio) setAspectRatio(savedProject.aspectRatio);
        if (savedProject.currentPresetId) setCurrentPresetId(savedProject.currentPresetId);
      } else {
        setVisualizerConfig((prev) => ({ ...prev, enabled: false }));
        setBackgroundConfig((prev) => ({
          ...prev,
          type: 'solid_color',
          solidColor: '#050508',
          customImageUrl: '',
          multiImageUrls: [],
          dimOpacity: 0,
          blur: 0,
          vignette: 0,
          bassShake: 0,
          bassZoom: 0,
        }));
        setParticlesConfig((prev) => ({ ...prev, enabled: false }));
      }
    };

    initAudio();

    globalAudioEngine.onTimeUpdate = (cur, dur) => {
      setCurrentTime(cur);
      setDuration(dur || 180);
    };

    globalAudioEngine.onEnded = () => {
      setIsPlaying(false);
    };

    return () => {
      globalAudioEngine.pause();
    };
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      globalAudioEngine.pause();
      setIsPlaying(false);
    } else {
      await globalAudioEngine.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Keyboard Shortcuts (Space to play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        globalAudioEngine.seek(currentTime + 5);
      } else if (e.code === 'ArrowLeft') {
        globalAudioEngine.seek(currentTime - 5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, currentTime]);
  // Helper to reset everything to a completely blank empty canvas on new start:
  // spectrum, artwork, background, visual fx, text info, lyrics -> ALL OFF
  const resetAllToBlankCanvas = (track?: AudioTrack) => {
    // 1. Spectrum Equalizer OFF
    setVisualizerConfig((prev) => ({ ...prev, enabled: false }));
    // 2. Artwork / Center Logo OFF
    setCenterLogoConfig((prev) => ({
      ...prev,
      enabled: false,
      imageUrl: track?.coverArt || prev.imageUrl,
    }));
    // 3. Background: Solid blank dark canvas
    setBackgroundConfig((prev) => ({
      ...prev,
      type: 'solid_color',
      solidColor: '#050508',
      customImageUrl: '',
      multiImageUrls: [],
      dimOpacity: 0,
      blur: 0,
      vignette: 0,
      bassShake: 0,
      bassZoom: 0,
    }));
    // 4. Particles OFF
    setParticlesConfig((prev) => ({ ...prev, enabled: false }));
    // 5. Visual FX: All OFF
    setEffectsConfig((prev) => ({
      ...prev,
      chromaticAberration: { ...prev.chromaticAberration, enabled: false },
      vhsOverlay: { ...prev.vhsOverlay, enabled: false },
      camera3D: { ...prev.camera3D, enabled: false },
      waveformScrubber: { ...prev.waveformScrubber, enabled: false },
      videoBackground: { ...prev.videoBackground, enabled: false },
      cinematicLighting: prev.cinematicLighting
        ? { ...prev.cinematicLighting, enabled: false }
        : { enabled: false, ambientFlares: false, lightLeaks: false, intensity: 0.5 },
      cinematicCamera: prev.cinematicCamera
        ? { ...prev.cinematicCamera, enabled: false }
        : { enabled: false, type: 'none', pulseOnBeat: false, intensity: 0.5 },
    }));
    // 6. Text Info (Typography): All OFF
    setTypographyConfig((prev) => ({
      ...prev,
      showTitle: false,
      showArtist: false,
      showSubtitle: false,
      showTimeProgress: false,
      title: track?.title || prev.title,
      artist: track?.artist || prev.artist,
      subtitle: '',
      socialBadges: prev.socialBadges ? { ...prev.socialBadges, enabled: false } : undefined,
    }));
    // 7. Lirik (Subtitle): OFF
    setSubtitleConfig((prev) => ({
      ...prev,
      enabled: false,
    }));
  };

  const handleSelectTrack = async (track: AudioTrack) => {
    setCurrentTrack(track);
    await globalAudioEngine.loadTrack(track);
    if (isPlaying) {
      await globalAudioEngine.play();
    }

    // 1. Reset ALL to completely blank canvas on new start (spectrum, artwork, background, visual fx, text info, lirik OFF)
    resetAllToBlankCanvas(track);

    // 2. Load lyrics for this track but keep enabled: false
    const savedLyricsById = localStorage.getItem(`specterr_lyrics_${track.id}`);
    const savedLyricsByTitle = localStorage.getItem(`specterr_lyrics_${track.title}`);
    const activeBackupStr = localStorage.getItem('specterr_active_song_lyrics');

    let trackLyrics = [];
    if (savedLyricsById) {
      try {
        trackLyrics = JSON.parse(savedLyricsById);
      } catch {}
    } else if (savedLyricsByTitle) {
      try {
        trackLyrics = JSON.parse(savedLyricsByTitle);
      } catch {}
    } else if (activeBackupStr) {
      try {
        const parsed = JSON.parse(activeBackupStr);
        if (
          parsed.lyrics &&
          parsed.lyrics.length > 0 &&
          (parsed.trackId === track.id ||
            (parsed.trackTitle && parsed.trackTitle.trim().toLowerCase() === track.title.trim().toLowerCase()))
        ) {
          trackLyrics = parsed.lyrics;
        }
      } catch {}
    }

    if (!trackLyrics || trackLyrics.length === 0) {
      trackLyrics = WhisperAIService.generateDemoLyrics(track.title, track.genre);
    }

    setSubtitleConfig((prev) => ({
      ...prev,
      enabled: false, // Lirik OFF on new start
      lyrics: trackLyrics,
    }));

    if (track.coverArt) {
      setCenterLogoConfig((prev) => ({
        ...prev,
        enabled: false, // Artwork OFF on new start
        imageUrl: track.coverArt,
      }));
    }
    
    // Save to localStorage (do NOT delete custom track from IDB)
    localStorage.setItem('specterr_saved_track_id', track.id);
  };

  const handleUploadAudio = async (file: File) => {
    try {
      const track = await globalAudioEngine.loadAudioFile(file);
      setCurrentTrack(track);
      setIsPlaying(true);
      await globalAudioEngine.play();

      // Reset ALL to completely blank canvas on new start (spectrum, artwork, background, visual fx, text info, lirik OFF)
      resetAllToBlankCanvas(track);

      // Bind active song backup to this newly uploaded track (empty lyrics)
      localStorage.setItem(
        'specterr_active_song_lyrics',
        JSON.stringify({
          trackId: track.id,
          trackTitle: track.title,
          lyrics: [],
          timestamp: Date.now(),
        })
      );
      
      // Save to IndexedDB and clear localStorage
      import('./utils/idb').then((m) => {
        m.saveCustomTrack(file, { title: track.title, artist: track.artist }, []);
        m.saveTrackToLibrary({
          id: 'upload_' + Date.now(),
          title: track.title,
          artist: track.artist,
          duration: track.duration || 0,
          file: file,
          lyrics: [],
          createdAt: Date.now(),
          isCut: false,
        });
      });
      localStorage.removeItem('specterr_saved_track_id');
    } catch (err) {
      console.error('Failed to load uploaded audio file:', err);
    }
  };

  const handleTrackChanged = async (file: File, newLyrics?: SubtitleConfig['lyrics']) => {
    try {
      const track = await globalAudioEngine.loadAudioFile(file);
      setCurrentTrack(track);
      setIsPlaying(true);
      await globalAudioEngine.play();

      // Update track info
      setTypographyConfig((prev) => ({
        ...prev,
        title: track.title,
        artist: track.artist || '',
        subtitle: '',
        showSubtitle: false,
      }));

      // Synchronously update and retain cut lyrics
      const lyricsToApply = newLyrics !== undefined ? newLyrics : subtitleConfig.lyrics;
      setSubtitleConfig((prev) => ({
        ...prev,
        lyrics: lyricsToApply,
      }));

      // Bind active backup to this cut track
      if (lyricsToApply && lyricsToApply.length > 0) {
        localStorage.setItem(`specterr_lyrics_${track.id}`, JSON.stringify(lyricsToApply));
        localStorage.setItem(`specterr_lyrics_${track.title}`, JSON.stringify(lyricsToApply));
      }
      localStorage.setItem(
        'specterr_active_song_lyrics',
        JSON.stringify({
          trackId: track.id,
          trackTitle: track.title,
          lyrics: lyricsToApply || [],
          timestamp: Date.now(),
        })
      );

      // Save to IndexedDB with cut lyrics and clear localStorage
      import('./utils/idb').then((m) => {
        m.saveCustomTrack(file, { title: track.title, artist: track.artist }, lyricsToApply);
        m.saveTrackToLibrary({
          id: 'cut_' + Date.now(),
          title: track.title,
          artist: track.artist,
          duration: track.duration || 0,
          file: file,
          lyrics: lyricsToApply || [],
          createdAt: Date.now(),
          isCut: true,
        });
      });
      localStorage.removeItem('specterr_saved_track_id');
    } catch (err) {
      console.error('Failed to update track after cut/join:', err);
    }
  };

  const handleSelectStoredTrack = async (item: StoredTrackItem) => {
    try {
      const fileToLoad =
        item.file instanceof File
            ? item.file
          : new File([item.file], `${item.title}.wav`, { type: 'audio/wav' });

      const track = await globalAudioEngine.loadAudioFile(fileToLoad);
      track.title = item.title;
      track.artist = item.artist;
      setCurrentTrack(track);
      setIsPlaying(true);
      await globalAudioEngine.play();

      // Reset ALL to completely blank canvas on new start (spectrum, artwork, background, visual fx, text info, lirik OFF)
      resetAllToBlankCanvas(track);

      // Multi-tier robust recovery for stored track lyrics
      let restoredLyrics = item.lyrics || [];
      if (!restoredLyrics || restoredLyrics.length === 0) {
        const byId = localStorage.getItem(`specterr_lyrics_${item.id}`);
        const byTitle = localStorage.getItem(`specterr_lyrics_${item.title}`);
        const activeBackupStr = localStorage.getItem('specterr_active_song_lyrics');
        if (byId) {
          try { restoredLyrics = JSON.parse(byId); } catch {}
        } else if (byTitle) {
          try { restoredLyrics = JSON.parse(byTitle); } catch {}
        } else if (activeBackupStr) {
          try {
            const parsed = JSON.parse(activeBackupStr);
            if (
              parsed.lyrics &&
              parsed.lyrics.length > 0 &&
              (parsed.trackId === item.id ||
                (parsed.trackTitle && parsed.trackTitle.trim().toLowerCase() === item.title.trim().toLowerCase()))
            ) {
              restoredLyrics = parsed.lyrics;
            }
          } catch {}
        }
      }

      setSubtitleConfig((prev) => ({
        ...prev,
        enabled: false, // Lirik OFF on new start
        lyrics: restoredLyrics,
      }));

      // Bind active backup to this selected stored track
      localStorage.setItem(
        'specterr_active_song_lyrics',
        JSON.stringify({
          trackId: item.id,
          trackTitle: item.title,
          lyrics: restoredLyrics || [],
          timestamp: Date.now(),
        })
      );

      // Save as current_custom_track in IDB so it persists on reload
      const { saveCustomTrack, updateLibraryTrackLyrics } = await import('./utils/idb');
      await saveCustomTrack(fileToLoad, { title: item.title, artist: item.artist }, restoredLyrics);
      if (restoredLyrics.length > 0) {
        await updateLibraryTrackLyrics(item.id, restoredLyrics);
      }
      localStorage.removeItem('specterr_saved_track_id');

      setSaveToast(`🎵 Lagu "${item.title}" berhasil dimuat dari Pustaka!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error('Failed to load track from library:', err);
    }
  };

  // Handler for subtitle changes to ensure lyrics stay attached to current song
  const handleSubtitleChange = (newSub: SubtitleConfig) => {
    setSubtitleConfig(newSub);
    const lyricsToSave = newSub.lyrics || [];
    if (lyricsToSave.length > 0) {
      if (currentTrack?.id) {
        localStorage.setItem(`specterr_lyrics_${currentTrack.id}`, JSON.stringify(lyricsToSave));
      }
      if (currentTrack?.title) {
        localStorage.setItem(`specterr_lyrics_${currentTrack.title}`, JSON.stringify(lyricsToSave));
      }
      localStorage.setItem(
        'specterr_active_song_lyrics',
        JSON.stringify({
          trackId: currentTrack?.id || '',
          trackTitle: currentTrack?.title || '',
          lyrics: lyricsToSave,
          timestamp: Date.now(),
        })
      );

      import('./utils/idb').then((m) =>
        m.updateCustomTrackLyrics(lyricsToSave, currentTrack?.title, currentTrack?.id)
      );
    }
  };

  const handleApplyPreset = (preset: SpecterrPreset) => {
    setCurrentPresetId(preset.id);
    setVisualizerConfig(preset.visualizer);
    setCenterLogoConfig((prev) => ({
      ...preset.centerLogo,
      // Retain current song artwork if available
      imageUrl: currentTrack.coverArt || prev.imageUrl || preset.centerLogo.imageUrl,
    }));
    setBackgroundConfig(preset.background);
    setParticlesConfig(preset.particles);
    setTypographyConfig((prev) => ({
      ...preset.typography,
      // Retain current song title, artist, and subtitle
      title: currentTrack.title || prev.title,
      artist: currentTrack.artist || prev.artist,
      subtitle: prev.subtitle || preset.typography.subtitle,
    }));
    if (preset.subtitle) {
      setSubtitleConfig((prev) => ({
        ...preset.subtitle!,
        // Retain current song lyrics if available
        lyrics: prev.lyrics && prev.lyrics.length > 0 ? prev.lyrics : preset.subtitle!.lyrics,
      }));
    }
    if (preset.effects) {
      setEffectsConfig(preset.effects);
    }
  };

  const handleResetToPreset = () => {
    resetAllToBlankCanvas(currentTrack);
    setSaveToast('✨ Layar telah di-reset ke layar kosong (semua efek & elemen OFF)!');
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Auto-Save all edits and effects locally to IndexedDB & localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjectLocally({
        aspectRatio,
        currentPresetId,
        visualizer: visualizerConfig,
        centerLogo: centerLogoConfig,
        background: backgroundConfig,
        particles: particlesConfig,
        typography: typographyConfig,
        subtitle: subtitleConfig,
        effects: effectsConfig,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    aspectRatio,
    currentPresetId,
    visualizerConfig,
    centerLogoConfig,
    backgroundConfig,
    particlesConfig,
    typographyConfig,
    subtitleConfig,
    effectsConfig,
  ]);

  const handleManualSave = async (overrideSubtitle?: SubtitleConfig) => {
    const subToSave = overrideSubtitle || subtitleConfig;
    await saveProjectLocally({
      aspectRatio,
      currentPresetId,
      visualizer: visualizerConfig,
      centerLogo: centerLogoConfig,
      background: backgroundConfig,
      particles: particlesConfig,
      typography: typographyConfig,
      subtitle: subToSave,
      effects: effectsConfig,
    });
    if (subToSave.lyrics && subToSave.lyrics.length > 0) {
      if (currentTrack?.id) {
        localStorage.setItem(`specterr_lyrics_${currentTrack.id}`, JSON.stringify(subToSave.lyrics));
      }
      if (currentTrack?.title) {
        localStorage.setItem(`specterr_lyrics_${currentTrack.title}`, JSON.stringify(subToSave.lyrics));
      }
      localStorage.setItem(
        'specterr_active_song_lyrics',
        JSON.stringify({
          trackId: currentTrack?.id || '',
          trackTitle: currentTrack?.title || '',
          lyrics: subToSave.lyrics,
          timestamp: Date.now(),
        })
      );
      import('./utils/idb').then((m) =>
        m.updateCustomTrackLyrics(subToSave.lyrics, currentTrack?.title, currentTrack?.id)
      );
    }
    setSaveToast('💾 Semua editan, efek & subtitle berhasil disimpan di lokal!');
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    setCanvasElement(canvas);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#08090D] text-slate-100 overflow-hidden select-none font-sans">
      {/* Studio Header */}
      <Navbar
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        previewResolution={previewResolution}
        onPreviewResolutionChange={handlePreviewResolutionChange}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onUploadAudio={handleUploadAudio}
        onReset={handleResetToPreset}
        onSaveProject={handleManualSave}
        trackTitle={`${currentTrack.artist} - ${currentTrack.title}`}
      />

      {/* Main Workspace (Canvas + CapCut Timeline + Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center/Left: Preview Monitor & CapCut/Clipchamp Timeline */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          {/* Visualizer Canvas Area */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <VisualizerCanvas
              visualizer={visualizerConfig}
              centerLogo={centerLogoConfig}
              background={backgroundConfig}
              particles={particlesConfig}
              typography={typographyConfig}
              subtitle={subtitleConfig}
              effects={effectsConfig}
              aspectRatio={aspectRatio}
              previewResolution={previewResolution}
              onPreviewResolutionChange={handlePreviewResolutionChange}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              canvasRefCallback={handleCanvasRef}
              onTogglePlay={handleTogglePlay}
            />
          </div>

          {/* Floating Mobile Customize Studio Button */}
          {!isMobileCustomizeOpen && (
            <div className="lg:hidden absolute bottom-44 right-3 z-30 pointer-events-auto">
              <button
                onClick={() => setIsMobileCustomizeOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-pink-500 text-white text-xs font-bold shadow-2xl shadow-cyan-500/40 border border-white/20 active:scale-95 transition-all"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize</span>
              </button>
            </div>
          )}

          {/* CapCut / Clipchamp Style Timeline Editor (Directly Underneath Preview Screen) */}
          <CapCutTimeline
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            subtitleConfig={subtitleConfig}
            backgroundConfig={backgroundConfig}
            centerLogoConfig={centerLogoConfig}
            onBackgroundChange={setBackgroundConfig}
            onCenterLogoChange={setCenterLogoConfig}
            onTogglePlay={handleTogglePlay}
            onSelectTrack={handleSelectTrack}
            onUploadAudio={handleUploadAudio}
            onTrackChanged={handleTrackChanged}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onOpenAudioLab={() => setIsAudioLabOpen(true)}
            onOpenCutterJoinerModal={() => setIsCutterJoinerOpen(true)}
            onOpenWhisperModal={() => setIsWhisperOpen(true)}
            onOpenSubtitleEditor={() => setIsSubtitleEditorOpen(true)}
          />
        </div>

        {/* Sidebar Controls & Customization */}
        <TabNavigation
          visualizer={visualizerConfig}
          centerLogo={centerLogoConfig}
          background={backgroundConfig}
          particles={particlesConfig}
          typography={typographyConfig}
          subtitle={subtitleConfig}
          effects={effectsConfig}
          currentTime={currentTime}
          duration={duration}
          currentPresetId={currentPresetId}
          currentTrack={currentTrack}
          isOpenMobile={isMobileCustomizeOpen}
          onCloseMobile={() => setIsMobileCustomizeOpen(false)}
          onVisualizerChange={setVisualizerConfig}
          onCenterLogoChange={setCenterLogoConfig}
          onBackgroundChange={setBackgroundConfig}
          onParticlesChange={setParticlesConfig}
          onTypographyChange={setTypographyConfig}
          onSubtitleChange={handleSubtitleChange}
          onEffectsChange={setEffectsConfig}
          onOpenWhisperModal={() => setIsWhisperOpen(true)}
          onOpenSubtitleEditor={() => setIsSubtitleEditorOpen(true)}
          onSelectPreset={(preset) => {
            handleApplyPreset(preset);
            setIsMobileCustomizeOpen(false);
          }}
        />
      </div>

      {/* Video Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        canvas={canvasElement}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        trackDuration={duration}
        trackTitle={`${currentTrack.artist} - ${currentTrack.title}`}
        visualizer={visualizerConfig}
        centerLogo={centerLogoConfig}
        background={backgroundConfig}
        particles={particlesConfig}
        typography={typographyConfig}
        subtitle={subtitleConfig}
        effects={effectsConfig}
        currentTrack={currentTrack}
      />

      {/* Preset Gallery Modal */}
      <PresetGalleryModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        currentPresetId={currentPresetId}
        onSelectPreset={handleApplyPreset}
      />

      {/* Whisper AI Transcriber Modal */}
      <WhisperModal
        isOpen={isWhisperOpen}
        onClose={() => setIsWhisperOpen(false)}
        currentTrack={currentTrack}
        onLyricsGenerated={(lyrics) => {
          setSubtitleConfig((prev) => ({
            ...prev,
            lyrics,
            enabled: true,
          }));
          if (currentTrack.isCustom) {
            import('./utils/idb').then((m) =>
              m.updateCustomTrackLyrics(lyrics, currentTrack.title, currentTrack.id)
            );
          } else {
            localStorage.setItem(`specterr_lyrics_${currentTrack.id}`, JSON.stringify(lyrics));
          }
          if (currentTrack.title) {
            localStorage.setItem(`specterr_lyrics_${currentTrack.title}`, JSON.stringify(lyrics));
          }
          localStorage.setItem(
            'specterr_active_song_lyrics',
            JSON.stringify({
              trackId: currentTrack.id,
              trackTitle: currentTrack.title,
              lyrics,
              timestamp: Date.now(),
            })
          );
        }}
      />

      {/* Audio Lab & AI Analyzer Modal */}
      <AudioLabModal
        isOpen={isAudioLabOpen}
        onClose={() => setIsAudioLabOpen(false)}
        currentTrack={currentTrack}
        visualizer={visualizerConfig}
        particles={particlesConfig}
        onVisualizerChange={setVisualizerConfig}
        onParticlesChange={setParticlesConfig}
        onSelectReffSegment={(start, _end) => {
          globalAudioEngine.seek(start);
          setIsCutterJoinerOpen(true);
        }}
      />

      {/* Audio Cutter & Joiner Modal */}
      <AudioCutterJoinerModal
        isOpen={isCutterJoinerOpen}
        onClose={() => setIsCutterJoinerOpen(false)}
        currentTrack={currentTrack}
        subtitleConfig={subtitleConfig}
        onTrackChanged={handleTrackChanged}
      />

      {/* Subtitle Text Studio Modal */}
      <SubtitleEditorModal
        isOpen={isSubtitleEditorOpen}
        onClose={() => setIsSubtitleEditorOpen(false)}
        subtitle={subtitleConfig}
        duration={duration}
        currentTime={currentTime}
        currentTrack={currentTrack}
        onSubtitleChange={handleSubtitleChange}
        onSeek={(time) => globalAudioEngine.seek(time)}
        onSave={handleManualSave}
      />

      {/* Track & Audio Cut Library Modal */}
      <TrackLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        currentTrack={currentTrack}
        onSelectStoredTrack={handleSelectStoredTrack}
        onSelectSampleTrack={(track) => {
          handleSelectTrack(track);
        }}
        onUploadNewAudio={handleUploadAudio}
      />

      {/* Save Notification Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-500/90 text-white font-medium rounded-xl shadow-2xl backdrop-blur-md border border-emerald-400/30 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
}

export default App;
