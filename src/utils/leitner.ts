import { WordCard, ProgressData, ParsedCard } from '../types';
import { DEFAULT_WORDS } from '../data/defaultWords';

export const PROGRESS_STORAGE_KEY = 'vlaams_progress';
export const CUSTOM_WORDS_KEY = 'vlaams_custom_words';
export const DAILY_LIMIT_STORAGE_KEY = 'vlaams_daily_limit';
export const DEFAULT_DAILY_NEW_LIMIT = 15;

export const INTERVALS: Record<number, number> = {
  0: 1,  // Streak 0 -> 1 day
  1: 3,  // Streak 1 -> 3 days
  2: 7,  // Streak 2 -> 7 days
  3: 30  // Streak 3 -> 30 days (Streak 4 is Mastered)
};

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyNewLimit(): number {
  try {
    const val = localStorage.getItem(DAILY_LIMIT_STORAGE_KEY);
    if (val) {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  return DEFAULT_DAILY_NEW_LIMIT;
}

export function setDailyNewLimit(limit: number): void {
  try {
    localStorage.setItem(DAILY_LIMIT_STORAGE_KEY, String(limit));
  } catch (err) {
    console.error('Failed to save daily limit:', err);
  }
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse progress from localStorage:', err);
    return {};
  }
}

export function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save progress to localStorage:', err);
  }
}

export function clearProgress(): void {
  localStorage.removeItem(PROGRESS_STORAGE_KEY);
}

export function loadStoredWords(): WordCard[] {
  try {
    const custom = localStorage.getItem(CUSTOM_WORDS_KEY);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load custom words from storage', err);
  }
  return DEFAULT_WORDS;
}

export function saveStoredWords(words: WordCard[]): void {
  try {
    localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(words));
  } catch (err) {
    console.error('Failed to save words to localStorage:', err);
  }
}

export function resetStoredWordsToDefault(): void {
  localStorage.removeItem(CUSTOM_WORDS_KEY);
}

/**
 * Single place to construct audio URLs for words and sentences.
 * Format: audio/${cleanKey}.opus
 * Decoupled, consistent slug generation.
 */
export function getAudioUrl(text: string, type: 'word' | 'sentence' = 'word'): string {
  // Strip parentheses/annotations like "De berg (-en)" -> "De berg"
  const cleaned = text.replace(/\s*\([^)]*\)/g, '').trim();
  const slug = cleaned
    .toLowerCase()
    .replace(/[/*_.,!?'"“”«»;:()]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  
  if (type === 'sentence') {
    return `audio/sentence_${slug}.opus`;
  }
  return `audio/${slug}.opus`;
}

/**
 * Audio playback helper with SpeechSynthesis fallback.
 * Checks audio URL (opus) first, cleanly falls back to speech synthesis if audio file not found.
 */
export async function playAudioTrack(
  audioUrl: string,
  textFallback: string,
  speechLang: string = 'nl-BE'
): Promise<void> {
  try {
    const audio = new Audio(audioUrl);
    await audio.play();
  } catch {
    // Graceful fallback to browser speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textFallback);
      
      const voices = window.speechSynthesis.getVoices();
      const beVoice = voices.find(v => v.lang === 'nl-BE' || v.lang.startsWith('nl-BE'));
      const nlVoice = voices.find(v => v.lang.startsWith('nl'));
      if (beVoice) {
        utterance.voice = beVoice;
      } else if (nlVoice) {
        utterance.voice = nlVoice;
      }
      utterance.lang = speechLang;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }
}

/**
 * Play headword audio (pronounces the base word, e.g. "stinken" or "Enerzijds / anderzijds")
 */
export async function playWordAudio(word: string): Promise<void> {
  const cleanWordForSpeech = word.replace(/\s*\([^)]*\)/g, '').trim();
  const url = getAudioUrl(word, 'word');
  await playAudioTrack(url, cleanWordForSpeech);
}

/**
 * Play full sentence audio (pronounces full sentence, e.g. "De vuilnisbak stinkt.")
 */
export async function playSentenceAudio(sentence: string): Promise<void> {
  const cleanSentence = sentence.replace(/\*/g, '').trim();
  const url = getAudioUrl(cleanSentence, 'sentence');
  await playAudioTrack(url, cleanSentence);
}

// Deprecated alias for backwards compatibility
export const playAudio = playWordAudio;

/**
 * Parses 3-field compact JSON into displayed components.
 * Handles multiple cloze markers (e.g. *enerzijds* ... *anderzijds*).
 */
export function parseCard(card: WordCard, currentStreak = 0): ParsedCard {
  // Find all matches for *(.*?)*
  const matches = [...card.ex.matchAll(/\*(.*?)\*/g)].map(m => m[1]);
  const answerForm = matches.length > 0 ? matches.join(' / ') : card.word;
  // Replace ALL asterisks wrapped words with underscores
  const frontSentence = card.ex.replace(/\*(.*?)\*/g, '__________');
  const fullSentence = card.ex.replace(/\*/g, '');

  let nextIntervalLabel = '+1 dag';
  if (currentStreak === 0) nextIntervalLabel = '+1 dag';
  else if (currentStreak === 1) nextIntervalLabel = '+3 dagen';
  else if (currentStreak === 2) nextIntervalLabel = '+7 dagen';
  else if (currentStreak === 3) nextIntervalLabel = '+30 dagen';
  else nextIntervalLabel = 'Beheerst';

  return {
    word: card.word,
    en: card.en,
    ex: card.ex,
    frontSentence,
    answerForm,
    fullSentence,
    currentStreak,
    nextIntervalLabel
  };
}

/**
 * Deck Initialization & Fisher-Yates Shuffling with Daily Batching
 * Formula for daily queue:
 * Due Today = (All reviews due from Boxes 1-4) + (Max 15 new cards from Box 0).
 */
export function initDeck(
  allWords: WordCard[],
  progressData: ProgressData,
  mode: 'due_only' | 'practice_all' = 'due_only',
  newCardsLimit: number = getDailyNewLimit(),
  offsetNew = 0
): WordCard[] {
  const today = getTodayString();

  if (mode === 'practice_all') {
    const activeDeck = [...allWords];
    for (let i = activeDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activeDeck[i], activeDeck[j]] = [activeDeck[j], activeDeck[i]];
    }
    return activeDeck;
  }

  // All reviews due from Boxes 1-3 (streak >= 1, streak < 4, nextDue <= today)
  // Plus any previously reviewed cards in streak 0 that are due today
  const reviewsDue: WordCard[] = [];
  const brandNewCards: WordCard[] = [];

  for (const card of allWords) {
    const prog = progressData[card.word];
    if (!prog || (prog.streak === 0 && !prog.lastReviewed)) {
      // Unseen card (Box 0 brand new)
      brandNewCards.push(card);
    } else if (prog.streak < 4 && prog.nextDue <= today) {
      reviewsDue.push(card);
    }
  }

  // Slice new cards according to batch limit & offset
  const selectedNew = brandNewCards.slice(offsetNew, offsetNew + newCardsLimit);
  const activeDeck = [...reviewsDue, ...selectedNew];

  // Fisher-Yates Shuffle
  for (let i = activeDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [activeDeck[i], activeDeck[j]] = [activeDeck[j], activeDeck[i]];
  }

  return activeDeck;
}

/**
 * Counts how many unreviewed Box 0 cards remain available
 */
export function getRemainingNewCardsCount(allWords: WordCard[], progressData: ProgressData): number {
  return allWords.filter(card => {
    const prog = progressData[card.word];
    return !prog || (prog.streak === 0 && !prog.lastReviewed);
  }).length;
}

/**
 * Review Evaluation (Mini-Leitner)
 */
export function processAnswer(
  card: WordCard,
  isCorrect: boolean,
  progressData: ProgressData,
  activeDeck: WordCard[]
): { updatedDeck: WordCard[]; updatedProgress: ProgressData } {
  const today = getTodayString();
  const current = progressData[card.word] || { streak: 0, nextDue: today, lastReviewed: null };
  const newProgress = { ...progressData };
  const newDeck = [...activeDeck];

  if (isCorrect) {
    // Only increment streak once per calendar day
    const isNewDay = current.lastReviewed !== today;
    const nextStreak = isNewDay ? Math.min(current.streak + 1, 4) : current.streak;

    const daysToAdd = INTERVALS[current.streak] || 1;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    newProgress[card.word] = {
      streak: nextStreak,
      nextDue: `${year}-${month}-${day}`,
      lastReviewed: today
    };

    // Remove from today's running session
    newDeck.shift();
  } else {
    // Failure: Reset streak
    newProgress[card.word] = {
      streak: 0,
      nextDue: today,
      lastReviewed: today
    };

    // Move to end of current session queue to repeat today
    const failedCard = newDeck.shift();
    if (failedCard) {
      newDeck.push(failedCard);
    }
  }

  saveProgress(newProgress);
  return { updatedDeck: newDeck, updatedProgress: newProgress };
}
