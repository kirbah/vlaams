/**
 * src/components/FlashcardDeck.tsx
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { WordCard, ProgressData } from '../types'
import { parseCard, playWordAudio, playSentenceAudio } from '../utils/leitner'
import { Icon } from './Icon'

interface FlashcardDeckProps {
  card: WordCard
  progress: ProgressData
  dueCount: number
  remCount: number
  onAnswer: (isCorrect: boolean) => void
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  card,
  progress,
  dueCount,
  remCount,
  onAnswer,
}) => {
  const [isFlipped, setIsFlipped] = useState(false)
  const [prevWord, setPrevWord] = useState(card.word)
  const [isAnimating, setIsAnimating] = useState(false)
  const [playingAudioType, setPlayingAudioType] = useState<
    'word' | 'sentence' | null
  >(null)

  if (card.word !== prevWord) {
    setPrevWord(card.word)
    setIsFlipped(false)
  }

  const cardRef = useRef<HTMLDivElement>(null)
  const stampRejectRef = useRef<HTMLDivElement>(null)
  const stampAcceptRef = useRef<HTMLDivElement>(null)
  const dragInfo = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
  })

  const cardProgress = progress[card.word]
  const currentStreak = cardProgress ? cardProgress.streak : 0
  const parsed = parseCard(card, currentStreak)

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateX(0px) rotate(0deg)'
      cardRef.current.style.transition = 'none'
      cardRef.current.style.opacity = '1'
    }
    if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0'
    if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0'
  }, [card.word])

  const handlePlayWord = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setPlayingAudioType('word')
    try {
      await playWordAudio(card.word)
    } finally {
      setTimeout(
        () => setPlayingAudioType((prev) => (prev === 'word' ? null : prev)),
        700
      )
    }
  }

  const handlePlaySentence = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setPlayingAudioType('sentence')
    try {
      await playSentenceAudio(card.ex)
    } finally {
      setTimeout(
        () =>
          setPlayingAudioType((prev) => (prev === 'sentence' ? null : prev)),
        1200
      )
    }
  }

  const handleFlip = useCallback(() => {
    if (isAnimating) return
    setIsFlipped((prev) => !prev)
  }, [isAnimating])

  const handleRevealAnswer = useCallback(() => {
    if (!isFlipped && !isAnimating) {
      setIsFlipped(true)
    }
  }, [isFlipped, isAnimating])

  const handleSwipeOut = useCallback(
    (direction: 'left' | 'right') => {
      if (!isFlipped) {
        setIsFlipped(true)
        return
      }

      if (isAnimating) return
      setIsAnimating(true)

      const shiftX = direction === 'right' ? 450 : -450
      const rotate = direction === 'right' ? 18 : -18

      if (cardRef.current) {
        cardRef.current.style.transition =
          'transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.26s ease-out'
        cardRef.current.style.transform = `translateX(${shiftX}px) rotate(${rotate}deg)`
        cardRef.current.style.opacity = '0'
      }

      if (direction === 'right' && stampAcceptRef.current) {
        stampAcceptRef.current.style.opacity = '1'
      } else if (direction === 'left' && stampRejectRef.current) {
        stampRejectRef.current.style.opacity = '1'
      }

      setTimeout(() => {
        setIsFlipped(false)
        onAnswer(direction === 'right')
        if (cardRef.current) {
          cardRef.current.style.transition = 'none'
          cardRef.current.style.transform = 'translateX(0px) rotate(0deg)'
          cardRef.current.style.opacity = '1'
        }
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0'
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0'
        setIsAnimating(false)
      }, 260)
    },
    [isFlipped, isAnimating, onAnswer]
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (isAnimating) return
    if ((e.target as HTMLElement).closest('[data-audio-button]')) return
    if ((e.target as HTMLElement).closest('[data-selectable-text]')) return

    dragInfo.current.isDragging = true
    dragInfo.current.startX = e.clientX
    dragInfo.current.startY = e.clientY
    dragInfo.current.currentX = e.clientX
    dragInfo.current.currentY = e.clientY
    dragInfo.current.startTime = Date.now()

    if (cardRef.current) {
      cardRef.current.style.transition = 'none'
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging || isAnimating) return
    dragInfo.current.currentX = e.clientX
    dragInfo.current.currentY = e.clientY

    const diffX = dragInfo.current.currentX - dragInfo.current.startX
    const diffY = dragInfo.current.currentY - dragInfo.current.startY

    if (Math.abs(diffY) > Math.abs(diffX) * 1.5 && Math.abs(diffX) < 25) {
      return
    }

    const rotate = diffX * 0.05
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`
    }

    if (isFlipped) {
      if (diffX > 20) {
        const opacity = Math.min(1, (diffX - 20) / 70)
        if (stampAcceptRef.current)
          stampAcceptRef.current.style.opacity = String(opacity)
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0'
      } else if (diffX < -20) {
        const opacity = Math.min(1, (-diffX - 20) / 70)
        if (stampRejectRef.current)
          stampRejectRef.current.style.opacity = String(opacity)
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0'
      } else {
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0'
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0'
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging || isAnimating) return
    dragInfo.current.isDragging = false

    const diffX = dragInfo.current.currentX - dragInfo.current.startX
    const diffY = dragInfo.current.currentY - dragInfo.current.startY
    const distance = Math.hypot(diffX, diffY)
    const duration = Date.now() - dragInfo.current.startTime

    const selection = window.getSelection
      ? window.getSelection()?.toString()
      : ''
    const hasSelection = Boolean(selection && selection.trim().length > 0)
    const isTargetSelectable = Boolean(
      (e.target as HTMLElement)?.closest('[data-selectable-text]')
    )

    const isIntentionalTap = distance < 12 && duration < 300

    if (isIntentionalTap) {
      if (!isTargetSelectable && !hasSelection) {
        handleFlip()
      }
    } else if (isFlipped && diffX > 80) {
      handleSwipeOut('right')
    } else if (isFlipped && diffX < -80) {
      handleSwipeOut('left')
    } else if (!isFlipped && Math.abs(diffX) > 50) {
      handleRevealAnswer()
      if (cardRef.current) {
        cardRef.current.style.transition =
          'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        cardRef.current.style.transform = 'translateX(0px) rotate(0deg)'
      }
    } else {
      if (cardRef.current) {
        cardRef.current.style.transition =
          'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        cardRef.current.style.transform = 'translateX(0px) rotate(0deg)'
      }
      if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0'
      if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0'
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName))
        return

      if (e.code === 'Space') {
        e.preventDefault()
        handleFlip()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        if (isFlipped) {
          handleSwipeOut('left')
        } else {
          handleRevealAnswer()
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        if (isFlipped) {
          handleSwipeOut('right')
        } else {
          handleRevealAnswer()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleFlip, handleSwipeOut, handleRevealAnswer, isFlipped])

  const renderHighlightedSentence = () => {
    const tokens = card.ex.split(/(\*.*?\*)/g)
    return (
      <>
        &ldquo;
        {tokens.map((token, idx) => {
          if (token.startsWith('*') && token.endsWith('*')) {
            const inner = token.slice(1, -1)
            return (
              <strong key={idx} className="text-brand-text font-bold">
                {inner}
              </strong>
            )
          }
          return <React.Fragment key={idx}>{token}</React.Fragment>
        })}
        &rdquo;
      </>
    )
  }

  return (
    <div className="flex flex-col w-full">
      {/* Top Session Meta Bar */}
      <div className="flex items-center justify-between py-1 px-1 mb-2 select-none">
        <div className="text-xs font-bold text-muted flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-text" />
          <span>Vlaams B1</span>
        </div>

        <div className="flex items-center gap-2 bg-subtle px-3.5 py-1.5 rounded-full shadow-xs border border-border-subtle">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
            Due:{' '}
            <strong className="text-main text-xs font-extrabold">
              {dueCount}
            </strong>
          </span>
          <span className="w-1 h-3 rounded-full bg-border-accent" />
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
            Rem:{' '}
            <strong className="text-brand-text text-xs font-extrabold">
              {remCount}
            </strong>
          </span>
        </div>
      </div>

      {/* Study Area / Swipe Canvas */}
      <div className="relative w-full flex flex-col justify-center min-h-[380px] my-1">
        <div
          ref={stampRejectRef}
          className="absolute top-6 left-6 z-30 opacity-0 pointer-events-none transition-opacity bg-danger-container text-danger-text px-3.5 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider -rotate-12 shadow-md border border-danger-border"
        >
          Nog niet
        </div>

        <div
          ref={stampAcceptRef}
          className="absolute top-6 right-6 z-30 opacity-0 pointer-events-none transition-opacity bg-success-container text-success-text px-3.5 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider rotate-12 shadow-md border border-success-border"
        >
          Ken ik
        </div>

        <div
          className="relative w-full h-[390px] touch-pan-y cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={cardRef}
            className="w-full h-full relative rounded-2xl shadow-md bg-card border border-border-subtle flex flex-col justify-between p-6 overflow-hidden select-none transition-colors"
          >
            {!isFlipped ? (
              <div className="flex flex-col justify-between h-full w-full">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                      Vraag
                    </span>
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      <Icon name="touch_app" size={15} />
                      Tik voor antwoord
                    </span>
                  </div>

                  <div className="mt-4 text-center min-h-[64px] flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-muted tracking-wider uppercase">
                      ENGELS
                    </span>
                    <h2
                      data-selectable-text
                      className="text-[24px] font-extrabold text-main mt-0.5 tracking-tight select-text cursor-text"
                    >
                      {card.en}
                    </h2>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-subtle border border-border-subtle/80 text-center min-h-[92px] flex flex-col justify-center">
                    <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                      VUL AAN IN HET VLAAMS
                    </p>
                    <p
                      data-selectable-text
                      className="text-[16px] text-main italic font-medium leading-relaxed select-text cursor-text"
                    >
                      &ldquo;{parsed.frontSentence}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <span className="text-[11px] font-bold text-muted bg-subtle px-3.5 py-1 rounded-full inline-block">
                    ( Tik buiten de tekst om te controleren )
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-between h-full w-full animate-fade-in">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-success-text uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success-text" />
                      Antwoord
                    </span>
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      <Icon name="check_circle" size={14} />
                      Beoordeel hieronder
                    </span>
                  </div>

                  <div className="mt-4 text-center min-h-[64px] flex flex-col justify-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <h2
                        data-selectable-text
                        className="text-[24px] font-bold text-main tracking-tight select-text cursor-text"
                      >
                        {card.word}
                      </h2>
                      <button
                        data-audio-button
                        type="button"
                        onClick={handlePlayWord}
                        title={`Beluister woord: "${card.word}"`}
                        aria-label={`Luister naar woord: ${card.word}`}
                        className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                          playingAudioType === 'word'
                            ? 'bg-brand-subtle text-brand-subtle-text shadow-sm'
                            : 'bg-subtle hover:bg-subtle-hover text-brand-text'
                        }`}
                      >
                        <Icon
                          name={
                            playingAudioType === 'word'
                              ? 'graphic_eq'
                              : 'volume_up'
                          }
                          size={19}
                        />
                      </button>
                    </div>

                    <p
                      data-selectable-text
                      className="text-xs text-muted mt-0.5 font-medium select-text cursor-text"
                    >
                      Meaning: {card.en}
                    </p>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-subtle border border-border-subtle/80 text-center min-h-[92px] flex flex-col justify-center relative group">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <p className="text-[11px] font-bold text-muted uppercase tracking-wider">
                        VOLLEDIGE ZIN
                      </p>
                      <button
                        data-audio-button
                        type="button"
                        onClick={handlePlaySentence}
                        title="Beluister volledige voorbeeldzin"
                        aria-label="Luister naar volledige zin"
                        className={`w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                          playingAudioType === 'sentence'
                            ? 'bg-brand-subtle text-brand-subtle-text shadow-xs'
                            : 'bg-subtle hover:bg-subtle-hover text-brand-text'
                        }`}
                      >
                        <Icon
                          name={
                            playingAudioType === 'sentence'
                              ? 'graphic_eq'
                              : 'volume_up'
                          }
                          size={15}
                        />
                      </button>
                    </div>
                    <p
                      data-selectable-text
                      className="text-[16px] text-main leading-relaxed select-text cursor-text"
                    >
                      {renderHighlightedSentence()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 pt-2 text-center">
                  <Icon
                    name="schedule"
                    size={16}
                    className="text-success-text"
                  />
                  <span className="text-xs font-semibold text-success-text">
                    Interval na succes: {parsed.nextIntervalLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Actions Area */}
      <div className="w-full mt-3 min-h-[82px] flex flex-col justify-start">
        {!isFlipped ? (
          <div className="w-full">
            <button
              onClick={handleRevealAnswer}
              className="w-full min-h-[58px] rounded-xl bg-brand hover:bg-brand-hover text-brand-contrast flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm font-bold text-base"
            >
              <Icon name="visibility" size={22} />
              <span>Toon antwoord</span>
            </button>
            <div className="h-5" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 animate-fade-in">
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleSwipeOut('left')}
                className="w-full min-h-[58px] rounded-xl bg-danger-container text-danger-text hover:bg-danger-hover border border-danger-border flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
              >
                <Icon name="close" size={22} />
                <span className="text-base font-bold">Nog niet</span>
              </button>
              <span className="text-[11px] font-semibold text-muted mt-1.5 flex items-center gap-1 h-3.5">
                <Icon name="arrow_back" size={13} />
                (Swipe links)
              </span>
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={() => handleSwipeOut('right')}
                className="w-full min-h-[58px] rounded-xl bg-success-container text-success-text hover:bg-success-hover border border-success-border flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
              >
                <Icon name="check" size={22} />
                <span className="text-base font-bold">Ken ik</span>
              </button>
              <span className="text-[11px] font-semibold text-muted mt-1.5 flex items-center gap-1 h-3.5">
                (Swipe rechts)
                <Icon name="arrow_forward" size={13} />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="keyboard-shortcuts flex flex-wrap items-center justify-center gap-3 mt-4 text-muted text-[11px] font-medium">
        <span className="flex items-center gap-1">
          <kbd className="bg-subtle px-1.5 py-0.5 rounded text-main font-semibold font-mono text-[10px]">
            Spatie
          </kbd>{' '}
          {isFlipped ? 'Omdraaien' : 'Toon antwoord'}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-subtle px-1.5 py-0.5 rounded text-main font-semibold font-mono text-[10px]">
            ←
          </kbd>{' '}
          Nog niet
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-subtle px-1.5 py-0.5 rounded text-main font-semibold font-mono text-[10px]">
            →
          </kbd>{' '}
          Ken ik
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-subtle px-1.5 py-0.5 rounded text-main font-semibold font-mono text-[10px]">
            Z
          </kbd>{' '}
          Herstel
        </span>
      </div>
    </div>
  )
}
