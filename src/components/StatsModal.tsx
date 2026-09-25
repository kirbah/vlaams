import React, { useState } from 'react'
import { WordCard, ProgressData } from '../types'
import {
  playWordAudio,
  playSentenceAudio,
  getTodayString,
  getSessionBatchSize,
  setSessionBatchSize,
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
  onBatchSizeChange?: (newSize: number) => void
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  words,
  progress,
  onImportWords,
  onResetToDefault,
  onWipeProgress,
  onBatchSizeChange,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'dictionary' | 'import'>(
    'stats'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [batchSize, setLocalBatchSize] = useState<number>(() =>
    getSessionBatchSize()
  )

  if (!isOpen) return null

  const today = getTodayString()

  let masteredCount = 0
  let dueReviewsCount = 0
  let unstudiedNewCount = 0
  const boxCounts = [0, 0, 0, 0, 0]

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

  const handleBatchSizeSelect = (size: number) => {
    setLocalBatchSize(size)
    setSessionBatchSize(size)
    if (onBatchSizeChange) {
      onBatchSizeChange(size)
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

  const renderSentenceWithBold = (sentence: string) => {
    const tokens = sentence.split(/(\*.*?\*)/g)
    return (
      <span>
        {tokens.map((token, idx) => {
          if (token.startsWith('*') && token.endsWith('*')) {
            return (
              <strong key={idx} className="text-brand-text font-bold">
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
      <div className="bg-card w-full sm:max-w-lg max-h-[88vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl border border-border-subtle overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-main">
              Vlaams Woordenboek & Voortgang
            </h2>
            <p className="text-xs text-muted">
              Woordenschat B1 (Leitner Systeem)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-subtle hover:bg-subtle-hover flex items-center justify-center text-main transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle px-6 bg-app">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-brand-text text-brand-text'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Overzicht & Dozen
          </button>
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'dictionary'
                ? 'border-brand-text text-brand-text'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Woordenlijst ({words.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-brand-text text-brand-text'
                : 'border-transparent text-muted hover:text-main'
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
              <div className="p-4 rounded-xl bg-subtle border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">
                  Dagelijkse Routine
                </span>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="p-2.5 rounded-lg bg-card border border-border-subtle text-center">
                    <span className="text-xl font-extrabold text-main block">
                      {dueReviewsCount}
                    </span>
                    <span className="text-[10px] text-muted font-medium">
                      Herhalingen
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border-subtle text-center">
                    <span className="text-xl font-extrabold text-brand-text block">
                      {Math.min(unstudiedNewCount, batchSize)}
                    </span>
                    <span className="text-[10px] text-muted font-medium">
                      Nieuw Beschikbaar
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border-subtle text-center">
                    <span className="text-xl font-extrabold text-success-text block">
                      {masteredCount}
                    </span>
                    <span className="text-[10px] text-muted font-medium">
                      Beheerst
                    </span>
                  </div>
                </div>

                {/* Batch Size Selector */}
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-muted font-medium">
                    Woorden per sessie:
                  </span>
                  <div className="flex gap-1.5">
                    {[10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleBatchSizeSelect(n)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          batchSize === n
                            ? 'bg-brand text-brand-contrast shadow-xs'
                            : 'bg-card text-muted hover:bg-subtle border border-border-subtle'
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
                <h4 className="font-bold text-main text-sm mb-2">
                  Leitner Dozen Verdeling
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-subtle">
                    <span className="font-semibold text-main">
                      Doos 0 (Nieuw / Vandaag gemist)
                    </span>
                    <span className="font-bold text-main">
                      {boxCounts[0]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-subtle">
                    <span className="font-semibold text-main">
                      Doos 1 (+1 dag interval)
                    </span>
                    <span className="font-bold text-main">
                      {boxCounts[1]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-subtle">
                    <span className="font-semibold text-main">
                      Doos 2 (+3 dagen interval)
                    </span>
                    <span className="font-bold text-main">
                      {boxCounts[2]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-subtle">
                    <span className="font-semibold text-main">
                      Doos 3 (+7 dagen interval)
                    </span>
                    <span className="font-bold text-main">
                      {boxCounts[3]} woorden
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-success-container/30">
                    <span className="font-semibold text-success-text">
                      Doos 4 (+30 dagen / Beheerst 🎉)
                    </span>
                    <span className="font-bold text-success-text">
                      {boxCounts[4]} woorden
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-border-subtle">
                <button
                  onClick={onWipeProgress}
                  className="w-full py-2.5 px-4 rounded-xl bg-danger-container text-danger-text text-xs font-bold hover:bg-danger-hover transition-colors text-center"
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
                <div className="absolute left-3 top-2.5 text-muted pointer-events-none">
                  <Icon name="search" size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Zoek woord, betekenis of zin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-subtle border border-border-subtle text-xs text-main placeholder-muted focus:outline-none focus:border-border-accent"
                />
              </div>

              {/* Word List with Bold Targets */}
              <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1">
                {filteredWords.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted">
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
                        className="p-3 rounded-xl bg-card border border-border-subtle hover:border-border-accent transition-colors flex items-start justify-between gap-2"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-main tracking-tight">
                              {item.word}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-subtle text-muted">
                              Doos {streak}
                            </span>
                            {streak >= 4 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-container text-success-text">
                                Beheerst
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-brand-text font-medium">
                            {item.en}
                          </p>
                          <p className="text-xs text-muted leading-relaxed">
                            {renderSentenceWithBold(item.ex)}
                          </p>
                        </div>

                        {/* Dual audio buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-center">
                          <button
                            onClick={() => handlePlayWord(item.word)}
                            title={`Beluister woord: "${item.word}"`}
                            aria-label={`Beluister woord ${item.word}`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              isWordPlaying
                                ? 'bg-brand-subtle text-brand-subtle-text shadow-xs'
                                : 'bg-subtle hover:bg-subtle-hover text-brand-text'
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
                                ? 'bg-brand-subtle text-brand-subtle-text shadow-xs'
                                : 'bg-subtle hover:bg-subtle-hover text-muted'
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
              <p className="text-xs text-muted leading-relaxed">
                Plak hieronder je eigen 3-veld JSON woordenlijst (bijv. voor
                verdere B1 hoofdstukken). Elk item moet exact de velden{' '}
                <code className="bg-subtle px-1 rounded">word</code>,{' '}
                <code className="bg-subtle px-1 rounded">en</code>, en{' '}
                <code className="bg-subtle px-1 rounded">ex</code> (met{' '}
                <code className="bg-subtle px-1 rounded">*doelwoord*</code>)
                bevatten.
              </p>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`[\n  {\n    "word": "aankondigen",\n    "en": "To announce",\n    "ex": "We zullen het nieuwe project morgen *aankondigen*."\n  }\n]`}
                rows={8}
                className="w-full p-3 font-mono text-xs rounded-xl bg-subtle border border-border-subtle focus:outline-none focus:border-border-accent text-main"
              />

              {importError && (
                <div className="p-3 rounded-lg bg-danger-container text-danger-text text-xs font-semibold">
                  {importError}
                </div>
              )}
              {importSuccess && (
                <div className="p-3 rounded-lg bg-success-container text-success-text text-xs font-semibold">
                  {importSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleJsonSubmit}
                  disabled={!jsonInput.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-brand-contrast text-xs font-bold shadow-sm transition-colors"
                >
                  Importeer Woorden
                </button>
                <button
                  onClick={onResetToDefault}
                  className="py-2.5 px-4 rounded-xl bg-subtle text-main text-xs font-semibold hover:bg-subtle-hover transition-colors"
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
