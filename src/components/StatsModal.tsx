import React, { useState } from 'react'
import { WordCard, ProgressData } from '../types'
import {
  playWordAudio,
  playSentenceAudio,
  getTodayString,
  getDailyNewLimit,
  setDailyNewLimit,
} from '../utils/leitner'
import { Icon } from './Icon'

interface StatsModalProps {
  isOpen: boolean
  onClose: () => void
  words: WordCard[]
  progress: ProgressData
  onImportWords: (newWords: WordCard[]) => void
  onResetToDefault: () => void
  onWipeProgress: () => void
  onDailyLimitChange?: (newLimit: number) => void
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  words,
  progress,
  onImportWords,
  onResetToDefault,
  onWipeProgress,
  onDailyLimitChange,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'dictionary' | 'import'>(
    'stats'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [dailyLimit, setLocalDailyLimit] = useState<number>(() =>
    getDailyNewLimit()
  )

  if (!isOpen) return null

  const today = getTodayString()

  // Leitner statistics calculation
  let masteredCount = 0
  let dueReviewsCount = 0
  let unstudiedNewCount = 0
  const boxCounts = [0, 0, 0, 0, 0] // 0: streak 0, 1: streak 1, 2: streak 2, 3: streak 3, 4: mastered

  words.forEach((card) => {
    const item = progress[card.word]
    const streak = item ? Math.min(item.streak, 4) : 0
    boxCounts[streak]++
    if (streak >= 4) {
      masteredCount++
    } else if (!item || (streak === 0 && !item.lastReviewed)) {
      unstudiedNewCount++
    } else if (item.nextDue <= today) {
      dueReviewsCount++
    }
  })

  const filteredWords = words.filter(
    (w) =>
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.ex.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePlayWord = async (word: string) => {
    const key = `word_${word}`
    setPlayingKey(key)
    try {
      await playWordAudio(word)
    } finally {
      setTimeout(
        () => setPlayingKey((prev) => (prev === key ? null : prev)),
        700
      )
    }
  }

  const handlePlaySentence = async (word: string, sentence: string) => {
    const key = `sentence_${word}`
    setPlayingKey(key)
    try {
      await playSentenceAudio(sentence)
    } finally {
      setTimeout(
        () => setPlayingKey((prev) => (prev === key ? null : prev)),
        1200
      )
    }
  }

  const handleLimitSelect = (limit: number) => {
    setLocalDailyLimit(limit)
    setDailyNewLimit(limit)
    if (onDailyLimitChange) {
      onDailyLimitChange(limit)
    }
  }

  const handleJsonSubmit = () => {
    setImportError(null)
    setImportSuccess(null)
    try {
      const parsed = JSON.parse(jsonInput)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('JSON moet een array van woorden bevatten.')
      }
      for (const item of parsed) {
        if (!item.word || !item.en || !item.ex) {
          throw new Error('Elk item moet "word", "en", en "ex" bevatten.')
        }
      }
      onImportWords(parsed)
      setImportSuccess(`Succesvol ${parsed.length} woorden geïmporteerd!`)
      setJsonInput('')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ongeldige JSON structuur.'
      setImportError(message)
    }
  }

  // Helper to render sentence with bold target word(s) - supports multiple like *enerzijds* and *anderzijds*
  const renderSentenceWithBold = (sentence: string) => {
    const tokens = sentence.split(/(\*.*?\*)/g)
    return (
      <span>
        {tokens.map((token, idx) => {
          if (token.startsWith('*') && token.endsWith('*')) {
            return (
              <strong key={idx} className="text-[#8d4b00] font-bold">
                {token.slice(1, -1)}
              </strong>
            )
          }
          return <React.Fragment key={idx}>{token}</React.Fragment>
        })}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#ffffff] w-full sm:max-w-lg max-h-[88vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl border border-[#eeedf7] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-[#eeedf7] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1a1b22]">
              Vlaams Woordenboek & Voortgang
            </h2>
            <p className="text-xs text-[#554336]">
              Woordenschat B1 (Leitner Systeem)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f4f2fd] hover:bg-[#eeedf7] flex items-center justify-center text-[#1a1b22] transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#eeedf7] px-6 bg-[#fbf8ff]">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-[#8d4b00] text-[#8d4b00]'
                : 'border-transparent text-[#554336] hover:text-[#1a1b22]'
            }`}
          >
            Overzicht & Dozen
          </button>
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'dictionary'
                ? 'border-[#8d4b00] text-[#8d4b00]'
                : 'border-transparent text-[#554336] hover:text-[#1a1b22]'
            }`}
          >
            Woordenlijst ({words.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-[#8d4b00] text-[#8d4b00]'
                : 'border-transparent text-[#554336] hover:text-[#1a1b22]'
            }`}
          >
            JSON Beheer
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'stats' && (
            <div className="space-y-5">
              {/* Daily Habit Card */}
              <div className="p-4 rounded-xl bg-[#f4f2fd] border border-[#eeedf7]">
                <span className="text-[10px] uppercase font-bold text-[#554336] tracking-wider block">
                  Dagelijkse Routine
                </span>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="p-2.5 rounded-lg bg-white border border-[#eeedf7] text-center">
                    <span className="text-xl font-extrabold text-[#1a1b22] block">
                      {dueReviewsCount}
                    </span>
                    <span className="text-[10px] text-[#554336] font-medium">
                      Herhalingen
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-[#eeedf7] text-center">
                    <span className="text-xl font-extrabold text-[#8d4b00] block">
                      {Math.min(unstudiedNewCount, dailyLimit)}
                    </span>
                    <span className="text-[10px] text-[#554336] font-medium">
                      Nieuw Vandaag
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-[#eeedf7] text-center">
                    <span className="text-xl font-extrabold text-[#00714e] block">
                      {masteredCount}
                    </span>
                    <span className="text-[10px] text-[#554336] font-medium">
                      Beheerst
                    </span>
                  </div>
                </div>

                {/* Batch Size Selector */}
                <div className="mt-4 pt-3 border-t border-[#eeedf7] flex items-center justify-between">
                  <span className="text-xs text-[#554336] font-medium">
                    Nieuwe woorden per sessie:
                  </span>
                  <div className="flex gap-1.5">
                    {[10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleLimitSelect(n)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          dailyLimit === n
                            ? 'bg-[#8d4b00] text-white shadow-xs'
                            : 'bg-white text-[#554336] hover:bg-[#eeedf7] border border-[#eeedf7]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leitner Box Breakdown */}
              <div>
                <h4 className="font-bold text-[#1a1b22] text-sm mb-2">
                  Leitner Dozen Verdeling
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#eeedf7]">
                    <span className="font-semibold text-[#1a1b22]">
                      Doos 0 (Nieuw / Vandaag gemist)
                    </span>
                    <span className="font-bold text-[#1a1b22]">
                      {boxCounts[0]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#eeedf7]">
                    <span className="font-semibold text-[#1a1b22]">
                      Doos 1 (+1 dag interval)
                    </span>
                    <span className="font-bold text-[#1a1b22]">
                      {boxCounts[1]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#eeedf7]">
                    <span className="font-semibold text-[#1a1b22]">
                      Doos 2 (+3 dagen interval)
                    </span>
                    <span className="font-bold text-[#1a1b22]">
                      {boxCounts[2]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#eeedf7]">
                    <span className="font-semibold text-[#1a1b22]">
                      Doos 3 (+7 dagen interval)
                    </span>
                    <span className="font-bold text-[#1a1b22]">
                      {boxCounts[3]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#82f5c1]/20">
                    <span className="font-semibold text-[#00714e]">
                      Doos 4 (+30 dagen / Beheerst 🎉)
                    </span>
                    <span className="font-bold text-[#00714e]">
                      {boxCounts[4]} woorden
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#eeedf7]">
                <button
                  onClick={onWipeProgress}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs font-bold hover:bg-[#ffcdc7] transition-colors text-center"
                >
                  Wis alle voortgang & begin opnieuw
                </button>
              </div>
            </div>
          )}

          {activeTab === 'dictionary' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-[#554336] pointer-events-none">
                  <Icon name="search" size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Zoek woord, betekenis of zin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f4f2fd] border border-[#eeedf7] text-xs text-[#1a1b22] placeholder-[#554336] focus:outline-none focus:border-[#8d4b00]"
                />
              </div>

              {/* Word List with Bold Targets */}
              <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1">
                {filteredWords.length === 0 ? (
                  <p className="text-center py-6 text-xs text-[#554336]">
                    Geen woorden gevonden.
                  </p>
                ) : (
                  filteredWords.map((item) => {
                    const prog = progress[item.word]
                    const streak = prog ? prog.streak : 0
                    const isWordPlaying = playingKey === `word_${item.word}`
                    const isSentencePlaying =
                      playingKey === `sentence_${item.word}`

                    return (
                      <div
                        key={item.word}
                        className="p-3 rounded-xl bg-[#fbf8ff] border border-[#eeedf7] hover:border-[#dbc2b0] transition-colors flex items-start justify-between gap-2"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#1a1b22] tracking-tight">
                              {item.word}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eeedf7] text-[#554336]">
                              Doos {streak}
                            </span>
                            {streak >= 4 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#82f5c1] text-[#00714e]">
                                Beheerst
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8d4b00] font-medium">
                            {item.en}
                          </p>
                          <p className="text-xs text-[#554336] leading-relaxed">
                            {renderSentenceWithBold(item.ex)}
                          </p>
                        </div>

                        {/* Dual audio buttons: Word audio and Sentence audio */}
                        <div className="flex items-center gap-1.5 shrink-0 self-center">
                          <button
                            onClick={() => handlePlayWord(item.word)}
                            title={`Beluister woord: "${item.word}"`}
                            aria-label={`Beluister woord ${item.word}`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              isWordPlaying
                                ? 'bg-[#ffdcc3] text-[#2f1500] shadow-xs'
                                : 'bg-[#eeedf7] hover:bg-[#e8e7f1] text-[#8d4b00]'
                            }`}
                          >
                            <Icon
                              name={isWordPlaying ? 'graphic_eq' : 'volume_up'}
                              size={17}
                            />
                          </button>

                          <button
                            onClick={() =>
                              handlePlaySentence(item.word, item.ex)
                            }
                            title="Beluister voorbeeldzin"
                            aria-label={`Beluister voorbeeldzin voor ${item.word}`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              isSentencePlaying
                                ? 'bg-[#ffdcc3] text-[#2f1500] shadow-xs'
                                : 'bg-[#eeedf7] hover:bg-[#e3e1ec] text-[#554336]'
                            }`}
                          >
                            <Icon
                              name={
                                isSentencePlaying
                                  ? 'graphic_eq'
                                  : 'record_voice_over'
                              }
                              size={17}
                            />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <p className="text-xs text-[#554336] leading-relaxed">
                Plak hieronder je eigen 3-veld JSON woordenlijst (bijv. voor
                verdere B1 hoofdstukken). Elk item moet exact de velden{' '}
                <code className="bg-[#eeedf7] px-1 rounded">word</code>,{' '}
                <code className="bg-[#eeedf7] px-1 rounded">en</code>, en{' '}
                <code className="bg-[#eeedf7] px-1 rounded">ex</code> (met{' '}
                <code className="bg-[#eeedf7] px-1 rounded">*doelwoord*</code>)
                bevatten.
              </p>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`[\n  {\n    "word": "aankondigen",\n    "en": "To announce",\n    "ex": "We zullen het nieuwe project morgen *aankondigen*."\n  }\n]`}
                rows={8}
                className="w-full p-3 font-mono text-xs rounded-xl bg-[#f4f2fd] border border-[#eeedf7] focus:outline-none focus:border-[#8d4b00] text-[#1a1b22]"
              />

              {importError && (
                <div className="p-3 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs font-semibold">
                  {importError}
                </div>
              )}
              {importSuccess && (
                <div className="p-3 rounded-lg bg-[#82f5c1] text-[#00714e] text-xs font-semibold">
                  {importSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleJsonSubmit}
                  disabled={!jsonInput.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#8d4b00] disabled:opacity-40 text-white text-xs font-bold shadow-sm hover:bg-[#6e3900] transition-colors"
                >
                  Importeer Woorden
                </button>
                <button
                  onClick={onResetToDefault}
                  className="py-2.5 px-4 rounded-xl bg-[#eeedf7] text-[#1a1b22] text-xs font-semibold hover:bg-[#e8e7f1] transition-colors"
                >
                  Herstel Standaard B1
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
