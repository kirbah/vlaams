/**
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
  const [queue, setQueue] = useState<WordCard[]>([])
  const [initialDueCount, setInitialDueCount] = useState<number>(0)
  const [sessionReviewedCount, setSessionReviewedCount] = useState<number>(0)
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false)
  const [studyMode, setStudyMode] = useState<'due_only' | 'practice_all'>(
    'due_only'
  )
  const [dailyLimit, setDailyLimit] = useState<number>(() => getDailyNewLimit())
  const [batchOffset, setBatchOffset] = useState<number>(0)

  // Try to load /words.json on mount if custom words not in storage
  useEffect(() => {
    fetch('/words.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load words.json')
        return res.json()
      })
      .then((data: WordCard[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const custom = localStorage.getItem('vlaams_custom_words')
          if (!custom) {
            setWords(data)
          }
        }
      })
      .catch(() => {
        // Fallback already provided by DEFAULT_WORDS
      })
  }, [])

  // Initialize deck whenever words, progress, studyMode, or dailyLimit change
  const startSession = useCallback(
    (
      mode: 'due_only' | 'practice_all' = 'due_only',
      limit = dailyLimit,
      offset = 0
    ) => {
      setStudyMode(mode)
      setBatchOffset(offset)
      const active = initDeck(words, progress, mode, limit, offset)
      setQueue(active)
      setInitialDueCount(active.length)
      setSessionReviewedCount(0)
    },
    [words, progress, dailyLimit]
  )

  // Initial load
  useEffect(() => {
    startSession('due_only', dailyLimit, 0)
  }, [words])

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
    startSession(studyMode, dailyLimit, batchOffset)
  }

  const handleNextBatch = () => {
    // Start next batch of new words
    const nextOffset = batchOffset + dailyLimit
    startSession('due_only', dailyLimit, nextOffset)
  }

  const handleWipeAllProgress = () => {
    clearProgress()
    const emptyProgress: ProgressData = {}
    setProgress(emptyProgress)
    setBatchOffset(0)
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
    setBatchOffset(0)
    const active = initDeck(newWords, emptyProgress, 'due_only', dailyLimit, 0)
    setQueue(active)
    setInitialDueCount(active.length)
    setSessionReviewedCount(0)
  }

  const handleResetToDefault = () => {
    resetStoredWordsToDefault()
    setWords(DEFAULT_WORDS)
    const currentProg = loadProgress()
    setBatchOffset(0)
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
    startSession('due_only', newLimit, batchOffset)
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
