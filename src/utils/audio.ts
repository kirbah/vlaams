/**
 * src/utils/audio.ts
 *
 * Audio playback helpers with SpeechSynthesis fallback.
 * Generates decoupled audio slugs and plays tracks or speech synthesis.
 */

/**
 * FEATURE FLAG: Set to `true` once your .opus audio files are hosted/available.
 * When `false`, the app directly uses the browser's SpeechSynthesis API,
 * avoiding 404 console errors for missing files.
 */
export const ENABLE_AUDIO_FILES = false

/**
 * Single place to construct audio URLs for words and sentences.
 * Format: audio/${cleanKey}.opus
 */
export function getAudioUrl(
  text: string,
  type: 'word' | 'sentence' = 'word'
): string {
  // Strip parentheses/annotations like "De berg (-en)" -> "De berg"
  const cleaned = text.replace(/\s*\([^)]*\)/g, '').trim()
  const slug = cleaned
    .toLowerCase()
    .replace(/[/*_.,!?'"“”«»;:()]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')

  if (type === 'sentence') {
    return `audio/sentence_${slug}.opus`
  }
  return `audio/${slug}.opus`
}

/**
 * Play an audio URL (opus) with a graceful fallback to Web Speech API.
 */
export async function playAudioTrack(
  audioUrl: string,
  textFallback: string,
  speechLang: string = 'nl-BE'
): Promise<void> {
  if (ENABLE_AUDIO_FILES) {
    try {
      const audio = new Audio(audioUrl)
      await audio.play()
      return
    } catch {
      // Fallback to browser speech synthesis if audio file fails
    }
  }

  // Fallback to browser speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(textFallback)

    const voices = window.speechSynthesis.getVoices()
    const beVoice = voices.find(
      (v) => v.lang === 'nl-BE' || v.lang.startsWith('nl-BE')
    )
    const nlVoice = voices.find((v) => v.lang.startsWith('nl'))
    if (beVoice) {
      utterance.voice = beVoice
    } else if (nlVoice) {
      utterance.voice = nlVoice
    }
    utterance.lang = speechLang
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }
}

/**
 * Pronounce headword (base form)
 */
export async function playWordAudio(word: string): Promise<void> {
  const cleanWordForSpeech = word.replace(/\s*\([^)]*\)/g, '').trim()
  const url = getAudioUrl(word, 'word')
  await playAudioTrack(url, cleanWordForSpeech)
}

/**
 * Pronounce full context sentence
 */
export async function playSentenceAudio(sentence: string): Promise<void> {
  const cleanSentence = sentence.replace(/\*/g, '').trim()
  const url = getAudioUrl(cleanSentence, 'sentence')
  await playAudioTrack(url, cleanSentence)
}

// Deprecated alias for backwards compatibility
export const playAudio = playWordAudio
