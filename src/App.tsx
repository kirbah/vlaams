/**
 * src/App.tsx
 *
 * Vlaams Woorden - B1 Woordenschat in Context
 * Mobile-first with Active Recall, Spaced Repetition, and Speech/Audio playback
 */

import React, { useState } from 'react'
import { useStudyDeck } from './hooks/useStudyDeck'
import { Header } from './components/Header'
import { FlashcardDeck } from './components/FlashcardDeck'
import { CompletionView } from './components/CompletionView'
import { StatsModal } from './components/StatsModal'
import { ResetConfirmModal } from './components/ResetConfirmModal'

export default function App() {
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false)

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
    handleAnswer,
    restartSession,
    nextBatch,
    practiceAll,
    wipeAllProgress,
    importWords,
    resetToDefault,
    changeDailyLimit,
  } = useStudyDeck()

  return (
    <div className="bg-[#fbf8ff] text-[#1a1b22] min-h-screen flex flex-col font-sans">
      {/* Top Header */}
      <Header
        title="Study"
        onOpenStats={() => setIsStatsOpen(true)}
        onResetSession={() => setIsResetConfirmOpen(true)}
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
