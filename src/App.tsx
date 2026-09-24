/**
 * src/App.tsx
 */

import React, { useState, useEffect } from 'react'
import { useStudyDeck } from './hooks/useStudyDeck'
import { useTheme } from './hooks/useTheme'
import { Header } from './components/Header'
import { FlashcardDeck } from './components/FlashcardDeck'
import { CompletionView } from './components/CompletionView'
import { StatsModal } from './components/StatsModal'
import { ResetConfirmModal } from './components/ResetConfirmModal'

export default function App() {
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false)
  const { isDark, toggleTheme } = useTheme()

  const {
    words,
    progress,
    queue,
    currentCard,
    initialDueCount,
    sessionReviewedCount,
    dailyLimit,
    masteredCount,
    remainingNewCount,
    canUndo,
    undoCount,
    undo,
    handleAnswer,
    restartSession,
    nextBatch,
    practiceAll,
    wipeAllProgress,
    importWords,
    resetToDefault,
    changeDailyLimit,
  } = useStudyDeck()

  // Global keyboard shortcut for Undo (Z or Ctrl+Z / Cmd+Z)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }
      if (
        (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) ||
        e.key.toLowerCase() === 'z'
      ) {
        if (canUndo && !isStatsOpen && !isResetConfirmOpen) {
          e.preventDefault()
          undo()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [canUndo, undo, isStatsOpen, isResetConfirmOpen])

  return (
    <div className="bg-app text-main min-h-screen flex flex-col font-sans transition-colors duration-200">
      {/* Top Header with Dark/Light Switch & Undo */}
      <Header
        title="Study"
        onOpenStats={() => setIsStatsOpen(true)}
        onResetSession={() => setIsResetConfirmOpen(true)}
        onUndo={undo}
        canUndo={canUndo}
        undoCount={undoCount}
        isDarkMode={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 pt-16 pb-6 max-w-md mx-auto">
        {queue.length > 0 && currentCard ? (
          <FlashcardDeck
            card={currentCard}
            progress={progress}
            dueCount={initialDueCount}
            remCount={queue.length}
            onAnswer={handleAnswer}
          />
        ) : (
          <CompletionView
            reviewedCount={sessionReviewedCount}
            totalWords={words.length}
            masteredCount={masteredCount}
            remainingNewCount={remainingNewCount}
            dailyLimit={dailyLimit}
            canUndo={canUndo}
            undoCount={undoCount}
            onUndo={undo}
            onNextBatch={nextBatch}
            onResetProgress={wipeAllProgress}
            onPracticeAll={practiceAll}
          />
        )}
      </main>

      {/* Stats & Word List Modal */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        words={words}
        progress={progress}
        onImportWords={importWords}
        onResetToDefault={resetToDefault}
        onWipeProgress={wipeAllProgress}
        onDailyLimitChange={changeDailyLimit}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onRestartSession={restartSession}
        onWipeAllProgress={wipeAllProgress}
      />
    </div>
  )
}
