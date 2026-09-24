import React from 'react';
import { Icon } from './Icon';

interface HeaderProps {
  onOpenStats: () => void;
  onResetSession: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenStats, onResetSession, title = 'Study' }) => {
  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#fbf8ff]/85 backdrop-blur-xl border-b border-[#eeedf7] pt-safe transition-colors">
      <div className="max-w-md mx-auto h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResetSession}
            title="Herstart huidige sessie"
            aria-label="Herstart sessie"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#1a1b22] hover:bg-[#eeedf7] active:scale-95 transition-all"
          >
            <Icon name="arrow_back" size={24} />
          </button>
          <div>
            <h1 className="text-[18px] font-semibold text-[#1a1b22] leading-tight truncate">
              {title}
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e3900]">
              Vlaams B1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenStats}
            title="Woordenlijst & Voortgang"
            aria-label="Bekijk statistieken en woordenlijst"
            className="w-8 h-8 rounded-full bg-[#8d4b00] hover:bg-[#6e3900] flex items-center justify-center text-white shadow-sm active:scale-95 transition-transform"
          >
            <Icon name="person" size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
