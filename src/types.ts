/**
 * Vlaams Woorden - Types
 * Minimal 3-field data structure as defined in specification:
 * - word: Headword, base verb, ID, and audio filename (audio/${word}.mp3)
 * - en: English translation / meaning
 * - ex: Flemish example sentence with target conjugated form wrapped in asterisks (*target*)
 */

export interface WordCard {
  word: string
  en: string
  ex: string
}

export interface WordProgress {
  streak: number // 0, 1, 2, 3, 4 (Mastered)
  nextDue: string // YYYY-MM-DD
  lastReviewed: string | null // YYYY-MM-DD
}

export type ProgressData = Record<string, WordProgress>

export interface ParsedCard {
  word: string
  en: string
  ex: string
  frontSentence: string
  answerForm: string
  fullSentence: string
  currentStreak: number
  nextIntervalLabel: string
}
