import React from 'react'
import { Icon } from './Icon'

interface CompletionViewProps {
  reviewedCount: number
  totalWords: number
  masteredCount: number
  remainingNewCount: number
  dailyLimit: number
  canUndo?: boolean
  undoCount?: number
  onUndo?: () => void
  onNextBatch: () => void
  onResetProgress: () => void
  onPracticeAll: () => void
}

export const CompletionView: React.FC<CompletionViewProps> = ({
  reviewedCount,
  totalWords,
  masteredCount,
  remainingNewCount,
  dailyLimit,
  canUndo = false,
  undoCount = 0,
  onUndo,
  onNextBatch,
  onResetProgress,
  onPracticeAll,
}) => {
  const nextBatchCount = Math.min(remainingNewCount, dailyLimit)

  return (
    <div className="w-full min-h-[420px] rounded-2xl bg-card p-8 flex flex-col items-center justify-center text-center shadow-md border border-border-subtle animate-fade-in my-auto transition-colors">
      <div className="w-18 h-18 rounded-full bg-success-container text-success-text flex items-center justify-center mb-5 shadow-sm">
        <Icon name="task_alt" size={40} />
      </div>

      <h3 className="text-2xl font-bold text-main tracking-tight">
        Klaar voor vandaag! 🎉
      </h3>

      <p className="text-sm text-muted mt-2 max-w-xs leading-relaxed">
        {remainingNewCount > 0
          ? `Sessie voltooid! Je hebt ${reviewedCount} woorden geoefend. Er staan nog ${remainingNewCount} nieuwe woorden klaar.`
          : 'Geen woorden meer te herhalen vandaag. Kom morgen terug voor de volgende sessie.'}
      </p>

      {/* Mini Progress Card */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-6 p-3 rounded-xl bg-subtle border border-border-subtle">
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">
            Sessie voltooid
          </span>
          <span className="text-lg font-bold text-main">
            {reviewedCount} woorden
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">
            Beheerst
          </span>
          <span className="text-lg font-bold text-success-text">
            {masteredCount} / {totalWords}
          </span>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2.5 mt-6">
        {/* Next batch button if more new cards exist */}
        {nextBatchCount > 0 && (
          <button
            onClick={onNextBatch}
            className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-brand-contrast text-sm font-bold shadow-sm active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
          >
            <Icon name="add_circle" size={18} />
            <span>Volgende batch ({nextBatchCount} nieuwe woorden)</span>
          </button>
        )}

        <button
          onClick={onPracticeAll}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold active:scale-95 transition-all text-center ${
            nextBatchCount > 0
              ? 'bg-subtle hover:bg-subtle-hover text-main'
              : 'bg-brand hover:bg-brand-hover text-brand-contrast text-sm py-3'
          }`}
        >
          Oefen alle woorden opnieuw
        </button>

        {/* Undo button */}
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="w-full py-2.5 px-4 rounded-xl bg-subtle hover:bg-subtle-hover text-main text-xs font-semibold active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 border border-border-subtle"
          >
            <Icon name="undo" size={16} />
            <span>Herstel laatste kaart ({undoCount})</span>
          </button>
        )}

        <button
          onClick={onResetProgress}
          className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-danger-container text-muted hover:text-danger-text text-xs font-semibold active:scale-95 transition-all text-center"
        >
          Wis alle voortgang & begin opnieuw
        </button>
      </div>
    </div>
  )
}
