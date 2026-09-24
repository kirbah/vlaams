/**
 * src/App.tsx
 *
 * Vlaams Woorden - B1 Woordenschat in Context
 * Authentic Flemish Dutch Flashcards
 * Mobile-first with Active Recall (Cloze), Mini-Leitner scheduling, and Speech/Audio playback
 */

import React, { useState, useEffect, useCallback } from 'react'
import { WordCard, ProgressData } from './types'
import { DEFAULT_WORDS } from './data/defaultWords'
import {
  loadProgress,
  clearProgress,
  loadStoredWords,
  saveStoredWords,
  resetStoredWordsToDefault,
  initDeck,
  processAnswer,
  getDailyNewLimit,
  getRemainingNewCardsCount,
} from './utils/leitner'
import { Header } from './components/Header'
import { FlashcardDeck } from './components/FlashcardDeck'
import { CompletionView } from './components/CompletionView'
import { StatsModal } from './components/StatsModal'
import { ResetConfirmModal } from './components/ResetConfirmModal'

export default function App() {
  const [words, setWords] = useState<WordCard[]>(() => loadStoredWords())
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress())
  const [dailyLimit, setDailyLimit] = useState<number>(() => getDailyNewLimit())
  const [studyMode, setStudyMode] = useState<'due_only' | 'practice_all'>(
    'due_only'
  )

  // Initialize deck directly without needing cascading useEffect calls
  const [queue, setQueue] = useState<WordCard[]>(() =>
    initDeck(
      loadStoredWords(),
      loadProgress(),
      'due_only',
      getDailyNewLimit(),
      0
    )
  )
  const [initialDueCount, setInitialDueCount] = useState<number>(
    () =>
      initDeck(
        loadStoredWords(),
        loadProgress(),
        'due_only',
        getDailyNewLimit(),
        0
      ).length
  )
  const [sessionReviewedCount, setSessionReviewedCount] = useState<number>(0)
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false)

  // Try to load /words.json on mount if custom words not in storage
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}words.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load words.json')
        return res.json()
      })
      .then((data: WordCard[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const custom = localStorage.getItem('vlaams_custom_words')
          if (!custom) {
            setWords(data)
            const currentProg = loadProgress()
            const active = initDeck(
              data,
              currentProg,
              'due_only',
              dailyLimit,
              0
            )
            setQueue(active)
            setInitialDueCount(active.length)
            setSessionReviewedCount(0)
          }
        }
      })
      .catch(() => {
        // Fallback already provided by DEFAULT_WORDS
      })
  }, [dailyLimit])

  // Initialize deck whenever words, progress, studyMode, or dailyLimit change
  const startSession = useCallback(
    (mode: 'due_only' | 'practice_all' = 'due_only', limit = dailyLimit) => {
      setStudyMode(mode)
      // Always offset 0: cards already reviewed today leave the 'brandNewCards' pool,
      // so the next slice will always accurately start from the next unstudied card.
      const active = initDeck(words, progress, mode, limit, 0)
      setQueue(active)
      setInitialDueCount(active.length)
      setSessionReviewedCount(0)
    },
    [words, progress, dailyLimit]
  )

  const handleAnswer = (isCorrect: boolean) => {
    if (queue.length === 0) return
    const currentCard = queue[0]
    const { updatedDeck, updatedProgress } = processAnswer(
      currentCard,
      isCorrect,
      progress,
      queue
    )
    setProgress(updatedProgress)
    setQueue(updatedDeck)
    if (isCorrect) {
      setSessionReviewedCount((prev) => prev + 1)
    }
  }

  const handleRestartSession = () => {
    startSession(studyMode, dailyLimit)
  }

  const handleNextBatch = () => {
    // Slices next set of unstudied words starting from 0 (preventing skipped words)
    startSession('due_only', dailyLimit)
  }

  const handleWipeAllProgress = () => {
    clearProgress()
    const emptyProgress: ProgressData = {}
    setProgress(emptyProgress)
    const active = initDeck(words, emptyProgress, 'due_only', dailyLimit, 0)
    setQueue(active)
    setInitialDueCount(active.length)
    setSessionReviewedCount(0)
  }

  const handlePracticeAll = () => {
    startSession('practice_all')
  }

  const handleImportWords = (newWords: WordCard[]) => {
    saveStoredWords(newWords)
    setWords(newWords)
    const emptyProgress: ProgressData = {}
    setProgress(emptyProgress)
    clearProgress()
    const active = initDeck(newWords, emptyProgress, 'due_only', dailyLimit, 0)
    setQueue(active)
    setInitialDueCount(active.length)
    setSessionReviewedCount(0)
  }

  const handleResetToDefault = () => {
    resetStoredWordsToDefault()
    setWords(DEFAULT_WORDS)
    const currentProg = loadProgress()
    const active = initDeck(
      DEFAULT_WORDS,
      currentProg,
      'due_only',
      dailyLimit,
      0
    )
    setQueue(active)
    setInitialDueCount(active.length)
    setSessionReviewedCount(0)
  }

  const handleDailyLimitChange = (newLimit: number) => {
    setDailyLimit(newLimit)
    startSession('due_only', newLimit)
  }

  // Mastered words count
  const masteredCount = Object.values(progress).filter(
    (p) => p.streak >= 4
  ).length
  // Remaining unstudied new words count
  const remainingNewCount = getRemainingNewCardsCount(words, progress)

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
        {queue.length > 0 ? (
          <FlashcardDeck
            card={queue[0]}
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
            onNextBatch={handleNextBatch}
            onResetProgress={handleWipeAllProgress}
            onPracticeAll={handlePracticeAll}
          />
        )}
      </main>

      {/* Stats & Word List Modal */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        words={words}
        progress={progress}
        onImportWords={handleImportWords}
        onResetToDefault={handleResetToDefault}
        onWipeProgress={handleWipeAllProgress}
        onDailyLimitChange={handleDailyLimitChange}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onRestartSession={handleRestartSession}
        onWipeAllProgress={handleWipeAllProgress}
      />
    </div>
  )
}
