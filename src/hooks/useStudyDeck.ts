/**
 * src/hooks/useStudyDeck.ts
 */

import { useState, useEffect, useCallback } from 'react'
import { WordCard, ProgressData } from '../types'
import { DEFAULT_WORDS } from '../data/defaultWords'
import {
  loadProgress,
  saveProgress,
  clearProgress,
  loadStoredWords,
  saveStoredWords,
  resetStoredWordsToDefault,
  initDeck,
  processAnswer,
  getSessionBatchSize,
  setSessionBatchSize,
  getRemainingNewCardsCount,
  getRemainingDueCardsCount,
} from '../utils/leitner'

interface DeckHistorySnapshot {
  queue: WordCard[]
  progress: ProgressData
  sessionReviewedCount: number
}

export function useStudyDeck() {
  const [words, setWords] = useState<WordCard[]>(() => loadStoredWords())
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress())
  const [batchSize, setBatchSizeState] = useState<number>(() =>
    getSessionBatchSize()
  )
  const [studyMode, setStudyMode] = useState<'due_only' | 'practice_all'>(
    'due_only'
  )

  const [queue, setQueue] = useState<WordCard[]>(() =>
    initDeck(
      loadStoredWords(),
      loadProgress(),
      'due_only',
      getSessionBatchSize(),
      0
    )
  )
  const [initialDueCount, setInitialDueCount] = useState<number>(
    () =>
      initDeck(
        loadStoredWords(),
        loadProgress(),
        'due_only',
        getSessionBatchSize(),
        0
      ).length
  )
  const [sessionReviewedCount, setSessionReviewedCount] = useState<number>(0)

  // Multi-step undo history stack
  const [history, setHistory] = useState<DeckHistorySnapshot[]>([])

  // Fetch words.json ONCE on mount if custom words not in storage
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
            const active = initDeck(
              data,
              loadProgress(),
              'due_only',
              getSessionBatchSize(),
              0
            )
            setQueue(active)
            setInitialDueCount(active.length)
            setSessionReviewedCount(0)
            setHistory([])
          }
        }
      })
      .catch(() => {
        // Fallback already handled by DEFAULT_WORDS initial state
      })
  }, [])

  const startSession = useCallback(
    (mode: 'due_only' | 'practice_all' = 'due_only', limit = batchSize) => {
      setStudyMode(mode)
      const active = initDeck(words, progress, mode, limit, 0)
      setQueue(active)
      setInitialDueCount(active.length)
      setSessionReviewedCount(0)
      setHistory([])
    },
    [words, progress, batchSize]
  )

  const handleAnswer = useCallback(
    (isCorrect: boolean) => {
      if (queue.length === 0) return

      // Save a deep snapshot before applying answer
      setHistory((prev) => [
        ...prev,
        {
          queue: [...queue],
          progress: { ...progress },
          sessionReviewedCount,
        },
      ])

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
    },
    [queue, progress, sessionReviewedCount]
  )

  const undo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory

      const newHistory = [...prevHistory]
      const lastSnapshot = newHistory.pop()!

      // Restore states
      setQueue(lastSnapshot.queue)
      setProgress(lastSnapshot.progress)
      setSessionReviewedCount(lastSnapshot.sessionReviewedCount)
      saveProgress(lastSnapshot.progress)

      return newHistory
    })
  }, [])

  const restartSession = useCallback(() => {
    startSession(studyMode, batchSize)
  }, [startSession, studyMode, batchSize])

  const nextBatch = useCallback(() => {
    startSession('due_only', batchSize)
  }, [startSession, batchSize])

  const practiceAll = useCallback(() => {
    startSession('practice_all')
  }, [startSession])

  const wipeAllProgress = useCallback(() => {
    clearProgress()
    const emptyProgress: ProgressData = {}
    setProgress(emptyProgress)
    const active = initDeck(words, emptyProgress, 'due_only', batchSize, 0)
    setQueue(active)
    setInitialDueCount(active.length)
    setSessionReviewedCount(0)
    setHistory([])
  }, [words, batchSize])

  const importWords = useCallback(
    (newWords: WordCard[]) => {
      saveStoredWords(newWords)
      setWords(newWords)
      const emptyProgress: ProgressData = {}
      setProgress(emptyProgress)
      clearProgress()
      const active = initDeck(newWords, emptyProgress, 'due_only', batchSize, 0)
      setQueue(active)
      setInitialDueCount(active.length)
      setSessionReviewedCount(0)
      setHistory([])
    },
    [batchSize]
  )

  const resetToDefault = useCallback(() => {
    resetStoredWordsToDefault()
    setWords(DEFAULT_WORDS)
    const currentProg = loadProgress()
    const active = initDeck(
      DEFAULT_WORDS,
      currentProg,
      'due_only',
      batchSize,
      0
    )
    setQueue(active)
    setInitialDueCount(active.length)
    setSessionReviewedCount(0)
    setHistory([])
  }, [batchSize])

  const changeBatchSize = useCallback(
    (newSize: number) => {
      setBatchSizeState(newSize)
      setSessionBatchSize(newSize)
      startSession('due_only', newSize)
    },
    [startSession]
  )

  const masteredCount = Object.values(progress).filter(
    (p) => p.streak >= 4
  ).length
  const remainingNewCount = getRemainingNewCardsCount(words, progress)
  const remainingDueCount = getRemainingDueCardsCount(words, progress)

  return {
    words,
    progress,
    queue,
    currentCard: queue[0] as WordCard | undefined,
    initialDueCount,
    sessionReviewedCount,
    batchSize,
    masteredCount,
    remainingNewCount,
    remainingDueCount,
    canUndo: history.length > 0,
    undoCount: history.length,
    undo,
    handleAnswer,
    restartSession,
    nextBatch,
    practiceAll,
    wipeAllProgress,
    importWords,
    resetToDefault,
    changeBatchSize,
  }
}
