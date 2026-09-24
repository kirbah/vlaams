/**
 * src/utils/leitner.ts
 *
 * Spaced Repetition (Mini-Leitner) calculation engine, deck generators,
 * and date scheduling helpers.
 */

import { WordCard, ProgressData, ParsedCard } from '../types'
import { DEFAULT_WORDS } from '../data/defaultWords'

// Re-export audio helpers so existing component imports remain fully compatible
export * from './audio'

export const PROGRESS_STORAGE_KEY = 'vlaams_progress'
export const CUSTOM_WORDS_KEY = 'vlaams_custom_words'
export const DAILY_LIMIT_STORAGE_KEY = 'vlaams_daily_limit'
export const DEFAULT_DAILY_NEW_LIMIT = 15

export const INTERVALS: Record<number, number> = {
  0: 1, // Streak 0 -> 1 day
  1: 3, // Streak 1 -> 3 days
  2: 7, // Streak 2 -> 7 days
  3: 30, // Streak 3 -> 30 days (Streak 4 is Mastered)
}

/**
 * Returns YYYY-MM-DD with a 4:00 AM cutoff.
 * Before 04:00 AM, reviews count toward the previous calendar day.
 */
export function getTodayString(): string {
  const d = new Date()
  d.setHours(d.getHours() - 4) // 4:00 AM boundary shift
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates a future due date aligned with the 4:00 AM study anchor.
 */
export function calculateNextDueDate(daysToAdd: number): string {
  const d = new Date()
  d.setHours(d.getHours() - 4) // Align with Leitner anchor
  d.setDate(d.getDate() + daysToAdd)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/* -------------------------------------------------------------------------- */
/*                               STORAGE HELPERS                              */
/* -------------------------------------------------------------------------- */

export function getDailyNewLimit(): number {
  try {
    const val = localStorage.getItem(DAILY_LIMIT_STORAGE_KEY)
    if (val) {
      const n = parseInt(val, 10)
      if (!isNaN(n) && n > 0) return n
    }
  } catch {
    // ignore
  }
  return DEFAULT_DAILY_NEW_LIMIT
}

export function setDailyNewLimit(limit: number): void {
  try {
    localStorage.setItem(DAILY_LIMIT_STORAGE_KEY, String(limit))
  } catch (err) {
    console.error('Failed to save daily limit:', err)
  }
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse progress from localStorage:', err)
    return {}
  }
}

export function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save progress to localStorage:', err)
  }
}

export function clearProgress(): void {
  localStorage.removeItem(PROGRESS_STORAGE_KEY)
}

export function loadStoredWords(): WordCard[] {
  try {
    const custom = localStorage.getItem(CUSTOM_WORDS_KEY)
    if (custom) {
      const parsed = JSON.parse(custom)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Failed to load custom words from storage', err)
  }
  return DEFAULT_WORDS
}

export function saveStoredWords(words: WordCard[]): void {
  try {
    localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(words))
  } catch (err) {
    console.error('Failed to save words to localStorage:', err)
  }
}

export function resetStoredWordsToDefault(): void {
  localStorage.removeItem(CUSTOM_WORDS_KEY)
}

/* -------------------------------------------------------------------------- */
/*                           DECK FILTERING HELPERS                           */
/* -------------------------------------------------------------------------- */

/**
 * Filter cards due today that have not yet reached mastery (streak < 4)
 */
export function getDueReviewCards(
  allWords: WordCard[],
  progressData: ProgressData,
  today: string = getTodayString()
): WordCard[] {
  return allWords.filter((card) => {
    const prog = progressData[card.word]
    return prog && prog.streak < 4 && prog.nextDue <= today
  })
}

/**
 * Filter unstudied cards (Box 0 brand new)
 */
export function getBrandNewCards(
  allWords: WordCard[],
  progressData: ProgressData
): WordCard[] {
  return allWords.filter((card) => {
    const prog = progressData[card.word]
    return !prog || (prog.streak === 0 && !prog.lastReviewed)
  })
}

/**
 * Counts how many unreviewed Box 0 cards remain available
 */
export function getRemainingNewCardsCount(
  allWords: WordCard[],
  progressData: ProgressData
): number {
  return getBrandNewCards(allWords, progressData).length
}

/**
 * Immutable Fisher-Yates array shuffle
 */
export function shuffleDeck<T>(items: readonly T[]): T[] {
  const deck = [...items]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/* -------------------------------------------------------------------------- */
/*                           STUDY CARD PARSING                               */
/* -------------------------------------------------------------------------- */

export function parseCard(card: WordCard, currentStreak = 0): ParsedCard {
  const matches = [...card.ex.matchAll(/\*(.*?)\*/g)].map((m) => m[1])
  const answerForm = matches.length > 0 ? matches.join(' / ') : card.word
  const frontSentence = card.ex.replace(/\*(.*?)\*/g, '__________')
  const fullSentence = card.ex.replace(/\*/g, '')

  let nextIntervalLabel: string
  if (currentStreak === 0) nextIntervalLabel = '+1 dag'
  else if (currentStreak === 1) nextIntervalLabel = '+3 dagen'
  else if (currentStreak === 2) nextIntervalLabel = '+7 dagen'
  else if (currentStreak === 3) nextIntervalLabel = '+30 dagen'
  else nextIntervalLabel = 'Beheerst'

  return {
    word: card.word,
    en: card.en,
    ex: card.ex,
    frontSentence,
    answerForm,
    fullSentence,
    currentStreak,
    nextIntervalLabel,
  }
}

/* -------------------------------------------------------------------------- */
/*                          SESSION INITIALIZATION                            */
/* -------------------------------------------------------------------------- */

/**
 * Builds the study queue:
 * Due Today = (All reviews due from Boxes 1-3) + (New cards up to daily limit).
 */
export function initDeck(
  allWords: WordCard[],
  progressData: ProgressData,
  mode: 'due_only' | 'practice_all' = 'due_only',
  newCardsLimit: number = getDailyNewLimit(),
  offsetNew = 0
): WordCard[] {
  if (mode === 'practice_all') {
    return shuffleDeck(allWords)
  }

  const today = getTodayString()
  const reviewsDue = getDueReviewCards(allWords, progressData, today)
  const brandNewCards = getBrandNewCards(allWords, progressData)

  const selectedNew = brandNewCards.slice(offsetNew, offsetNew + newCardsLimit)
  return shuffleDeck([...reviewsDue, ...selectedNew])
}

/* -------------------------------------------------------------------------- */
/*                         ANSWER PROCESSING (LEITNER)                        */
/* -------------------------------------------------------------------------- */

export function processAnswer(
  card: WordCard,
  isCorrect: boolean,
  progressData: ProgressData,
  activeDeck: WordCard[]
): { updatedDeck: WordCard[]; updatedProgress: ProgressData } {
  const today = getTodayString()
  const current = progressData[card.word] || {
    streak: 0,
    nextDue: today,
    lastReviewed: null,
  }
  const newProgress = { ...progressData }
  const newDeck = [...activeDeck]

  if (isCorrect) {
    // Only advance streak once per calendar study day
    const isNewDay = current.lastReviewed !== today
    const nextStreak = isNewDay
      ? Math.min(current.streak + 1, 4)
      : current.streak

    const daysToAdd = INTERVALS[current.streak] || 1
    const nextDueDate = calculateNextDueDate(daysToAdd)

    newProgress[card.word] = {
      streak: nextStreak,
      nextDue: nextDueDate,
      lastReviewed: today,
    }

    // Done for today: remove from session
    newDeck.shift()
  } else {
    // Failure: reset streak to 0, review again today
    newProgress[card.word] = {
      streak: 0,
      nextDue: today,
      lastReviewed: today,
    }

    // Place at the end of queue to repeat during current session
    const failedCard = newDeck.shift()
    if (failedCard) {
      newDeck.push(failedCard)
    }
  }

  saveProgress(newProgress)
  return { updatedDeck: newDeck, updatedProgress: newProgress }
}
