import React from 'react'
import { Icon } from './Icon'

interface HeaderProps {
  onOpenStats: () => void
  onResetSession: () => void
  onUndo?: () => void
  canUndo?: boolean
  undoCount?: number
  title?: string
  isDarkMode: boolean
  onToggleTheme: () => void
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStats,
  onResetSession,
  onUndo,
  canUndo = false,
  undoCount = 0,
  title = 'Study',
  isDarkMode,
  onToggleTheme,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-app/85 backdrop-blur-xl border-b border-border-subtle pt-safe transition-colors">
      <div className="max-w-md mx-auto h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResetSession}
            title="Herstart huidige sessie"
            aria-label="Herstart sessie"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-main hover:bg-subtle active:scale-95 transition-all"
          >
            <Icon name="arrow_back" size={24} />
          </button>
          <div>
            <h1 className="text-[18px] font-semibold text-main leading-tight truncate">
              {title}
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-text">
              Vlaams B1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            title={
              isDarkMode
                ? 'Schakel naar lichte modus'
                : 'Schakel naar donkere modus'
            }
            aria-label={
              isDarkMode
                ? 'Schakel naar lichte modus'
                : 'Schakel naar donkere modus'
            }
            className="w-8 h-8 rounded-full bg-subtle hover:bg-subtle-hover text-main flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} size={17} />
          </button>

          {/* Undo Action */}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title={
                canUndo
                  ? `Stap terug (${undoCount} beschikbaar) [Z of Ctrl+Z]`
                  : 'Niets om ongedaan te maken'
              }
              aria-label="Laatste actie ongedaan maken"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canUndo
                  ? 'bg-subtle hover:bg-subtle-hover text-main active:scale-95 shadow-xs cursor-pointer'
                  : 'opacity-30 text-muted cursor-not-allowed'
              }`}
            >
              <Icon name="undo" size={17} />
            </button>
          )}

          {/* Word list & Stats */}
          <button
            onClick={onOpenStats}
            title="Woordenlijst & Voortgang"
            aria-label="Bekijk statistieken en woordenlijst"
            className="w-8 h-8 rounded-full bg-brand hover:bg-brand-hover flex items-center justify-center text-brand-contrast shadow-sm active:scale-95 transition-transform"
          >
            <Icon name="person" size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
