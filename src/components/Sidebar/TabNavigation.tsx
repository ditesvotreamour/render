import { useState } from 'react';
import {
  Sparkles,
  Sliders,
  Shield,
  Image,
  Type,
  Mic2,
  X,
  ChevronDown,
  Wand2,
} from 'lucide-react';
import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  SpecterrPreset,
  EffectsConfig,
  AudioTrack,
} from '../../types/visualizer';
import { VisualizerTab } from './VisualizerTab';
import { CenterLogoTab } from './CenterLogoTab';
import { BackgroundTab } from './BackgroundTab';
import { TypographyTab } from './TypographyTab';
import { LyricsTab } from './LyricsTab';
import { PresetsTab } from './PresetsTab';
import { EffectsTab } from './EffectsTab';

type TabType =
  | 'visualizer'
  | 'centerLogo'
  | 'background'
  | 'effects'
  | 'typography'
  | 'lyrics'
  | 'presets';

interface TabNavigationProps {
  visualizer: VisualizerConfig;
  centerLogo: CenterLogoConfig;
  background: BackgroundConfig;
  particles: ParticlesConfig;
  typography: TypographyConfig;
  subtitle: SubtitleConfig;
  effects: EffectsConfig;
  currentTime: number;
  duration?: number;
  currentPresetId: string;
  currentTrack?: AudioTrack;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onVisualizerChange: (val: VisualizerConfig) => void;
  onCenterLogoChange: (val: CenterLogoConfig) => void;
  onBackgroundChange: (val: BackgroundConfig) => void;
  onParticlesChange: (val: ParticlesConfig) => void;
  onTypographyChange: (val: TypographyConfig) => void;
  onSubtitleChange: (val: SubtitleConfig) => void;
  onEffectsChange: (val: EffectsConfig) => void;
  onOpenWhisperModal: () => void;
  onOpenSubtitleEditor?: () => void;
  onSelectPreset: (preset: SpecterrPreset) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  visualizer,
  centerLogo,
  background,
  particles,
  typography,
  subtitle,
  effects,
  currentTime,
  duration,
  currentPresetId,
  currentTrack,
  isOpenMobile = false,
  onCloseMobile,
  onVisualizerChange,
  onCenterLogoChange,
  onBackgroundChange,
  onParticlesChange,
  onTypographyChange,
  onSubtitleChange,
  onEffectsChange,
  onOpenWhisperModal,
  onOpenSubtitleEditor,
  onSelectPreset,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('visualizer');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'visualizer', label: 'Spectrum', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'centerLogo', label: 'Artwork', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'background', label: 'Background', icon: <Image className="w-3.5 h-3.5" /> },
    { id: 'effects', label: 'Visual FX', icon: <Wand2 className="w-3.5 h-3.5" /> },
    { id: 'typography', label: 'Text Info', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'lyrics', label: 'Lyrics & AI', icon: <Mic2 className="w-3.5 h-3.5" /> },
    { id: 'presets', label: 'Presets', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  const contentPanel = (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-28 sm:pb-20 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      {activeTab === 'visualizer' && (
        <VisualizerTab config={visualizer} onChange={onVisualizerChange} />
      )}
      {activeTab === 'centerLogo' && (
        <CenterLogoTab config={centerLogo} onChange={onCenterLogoChange} />
      )}
      {activeTab === 'background' && (
        <BackgroundTab
          bgConfig={background}
          particlesConfig={particles}
          onBgChange={onBackgroundChange}
          onParticlesChange={onParticlesChange}
          lyrics={subtitle.lyrics}
          duration={duration}
        />
      )}
      {activeTab === 'effects' && (
        <EffectsTab config={effects} onChange={onEffectsChange} />
      )}
      {activeTab === 'typography' && (
        <TypographyTab config={typography} onChange={onTypographyChange} />
      )}
      {activeTab === 'lyrics' && (
        <LyricsTab
          config={subtitle}
          onChange={onSubtitleChange}
          onOpenWhisperModal={onOpenWhisperModal}
          onOpenSubtitleEditor={onOpenSubtitleEditor}
          currentTime={currentTime}
          currentTrack={currentTrack}
        />
      )}
      {activeTab === 'presets' && (
        <PresetsTab currentPresetId={currentPresetId} onSelectPreset={onSelectPreset} />
      )}
    </div>
  );

  return (
    <>
      {/* 1. Desktop Sidebar Mode */}
      <aside className="hidden lg:flex w-80 xl:w-96 bg-[#0B0E17] border-l border-white/10 flex-col h-full z-20 overflow-hidden shrink-0">
        {/* Top Tab Switcher */}
        <div className="flex items-center border-b border-white/10 p-2 gap-1 bg-black/30 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {t.icon}
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        {contentPanel}
      </aside>

      {/* 2. Mobile Slide-Up Bottom Sheet Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0D111A] border-t border-white/20 rounded-t-3xl max-h-[82vh] h-[78vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Drawer Drag Header */}
            <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-white/20 rounded-full mx-auto" />
                <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Studio Customizer</span>
                </span>
              </div>

              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-full bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex items-center border-b border-white/10 p-1.5 gap-1 bg-black/30 shrink-0 overflow-x-auto scrollbar-none">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 min-w-[55px] py-1.5 px-1 rounded-xl flex flex-col items-center gap-1 text-[9px] font-bold transition-all shrink-0 ${
                    activeTab === t.id
                      ? 'bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {t.icon}
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Mobile Content Panel */}
            {contentPanel}

            {/* Mobile Bottom Dismiss Bar */}
            <div className="p-2 border-t border-white/10 bg-black/50 text-center shrink-0">
              <button
                onClick={onCloseMobile}
                className="w-full py-2 rounded-xl bg-white/10 text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-all"
              >
                <ChevronDown className="w-4 h-4 text-cyan-400" />
                <span>Minimize Controls to Canvas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
