import React from 'react';
import { StockMediaBrowser } from './StockMediaBrowser';
import type { StockMediaItem } from '../utils/stockMediaService';
import type { BRollDisplayMode } from '../types/visualizer';

interface StockMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForBRoll?: (item: StockMediaItem, mode: BRollDisplayMode) => void;
  onSelectForBackground?: (item: StockMediaItem) => void;
  onSelectForSlide?: (item: StockMediaItem) => void;
}

export const StockMediaModal: React.FC<StockMediaModalProps> = ({
  isOpen,
  onClose,
  onSelectForBRoll,
  onSelectForBackground,
  onSelectForSlide,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] max-h-[850px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <StockMediaBrowser
          onSelectForBRoll={onSelectForBRoll}
          onSelectForBackground={onSelectForBackground}
          onSelectForSlide={onSelectForSlide}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
