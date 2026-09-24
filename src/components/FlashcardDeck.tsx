import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WordCard, ProgressData } from '../types';
import { parseCard, playWordAudio, playSentenceAudio } from '../utils/leitner';
import { Icon } from './Icon';

interface FlashcardDeckProps {
  card: WordCard;
  progress: ProgressData;
  dueCount: number;
  remCount: number;
  onAnswer: (isCorrect: boolean) => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  card,
  progress,
  dueCount,
  remCount,
  onAnswer
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playingAudioType, setPlayingAudioType] = useState<'word' | 'sentence' | null>(null);

  // Drag physics state
  const cardRef = useRef<HTMLDivElement>(null);
  const stampRejectRef = useRef<HTMLDivElement>(null);
  const stampAcceptRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({
    isDragging: false,
    startX: 0,
    currentX: 0
  });

  const cardProgress = progress[card.word];
  const currentStreak = cardProgress ? cardProgress.streak : 0;
  const parsed = parseCard(card, currentStreak);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateX(0px) rotate(0deg)';
      cardRef.current.style.transition = 'none';
      cardRef.current.style.opacity = '1';
    }
    if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0';
    if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0';
  }, [card.word]);

  const handlePlayWord = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlayingAudioType('word');
    try {
      await playWordAudio(card.word);
    } finally {
      setTimeout(() => setPlayingAudioType(prev => prev === 'word' ? null : prev), 700);
    }
  };

  const handlePlaySentence = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlayingAudioType('sentence');
    try {
      await playSentenceAudio(card.ex);
    } finally {
      setTimeout(() => setPlayingAudioType(prev => prev === 'sentence' ? null : prev), 1200);
    }
  };

  const handleFlip = useCallback(() => {
    if (isAnimating) return;
    setIsFlipped(prev => !prev);
  }, [isAnimating]);

  const handleRevealAnswer = () => {
    if (!isFlipped && !isAnimating) {
      setIsFlipped(true);
    }
  };

  const handleSwipeOut = useCallback(
    (direction: 'left' | 'right') => {
      // High Priority Fix: Do not allow grading before reveal!
      if (!isFlipped) {
        setIsFlipped(true);
        return;
      }

      if (isAnimating) return;
      setIsAnimating(true);

      const shiftX = direction === 'right' ? 450 : -450;
      const rotate = direction === 'right' ? 18 : -18;

      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.26s ease-out';
        cardRef.current.style.transform = `translateX(${shiftX}px) rotate(${rotate}deg)`;
        cardRef.current.style.opacity = '0';
      }

      if (direction === 'right' && stampAcceptRef.current) {
        stampAcceptRef.current.style.opacity = '1';
      } else if (direction === 'left' && stampRejectRef.current) {
        stampRejectRef.current.style.opacity = '1';
      }

      setTimeout(() => {
        onAnswer(direction === 'right');
        if (cardRef.current) {
          cardRef.current.style.transition = 'none';
          cardRef.current.style.transform = 'translateX(0px) rotate(0deg)';
          cardRef.current.style.opacity = '1';
        }
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0';
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0';
        setIsAnimating(false);
      }, 260);
    },
    [isFlipped, isAnimating, onAnswer]
  );

  // Pointer / Touch gestures for swipe
  const onPointerDown = (e: React.PointerEvent) => {
    if (isAnimating) return;
    // Don't drag if clicking audio button directly
    if ((e.target as HTMLElement).closest('[data-audio-button]')) return;
    // Don't initiate card drag if user is interacting with selectable text
    if ((e.target as HTMLElement).closest('[data-selectable-text]')) return;

    dragInfo.current.isDragging = true;
    dragInfo.current.startX = e.clientX;
    dragInfo.current.currentX = e.clientX;

    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging || isAnimating) return;
    dragInfo.current.currentX = e.clientX;
    const diffX = dragInfo.current.currentX - dragInfo.current.startX;
    const rotate = diffX * 0.05;

    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
    }

    // Only show grading stamps if card is already revealed!
    if (isFlipped) {
      if (diffX > 20) {
        const opacity = Math.min(1, (diffX - 20) / 70);
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = String(opacity);
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0';
      } else if (diffX < -20) {
        const opacity = Math.min(1, (-diffX - 20) / 70);
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = String(opacity);
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0';
      } else {
        if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0';
        if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0';
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging || isAnimating) return;
    dragInfo.current.isDragging = false;
    const diffX = dragInfo.current.currentX - dragInfo.current.startX;

    // Check if user currently has text selected (e.g. highlighted text)
    const selection = window.getSelection ? window.getSelection()?.toString() : '';
    const hasSelection = Boolean(selection && selection.trim().length > 0);

    // If clicked on selectable text and did not swipe, do NOT flip the card
    const isTargetSelectable = Boolean((e.target as HTMLElement)?.closest('[data-selectable-text]'));

    if (Math.abs(diffX) < 10) {
      // Tap detected -> flip card ONLY IF not interacting with selectable text or active selection
      if (!isTargetSelectable && !hasSelection) {
        handleFlip();
      }
    } else if (isFlipped && diffX > 80) {
      handleSwipeOut('right');
    } else if (isFlipped && diffX < -80) {
      handleSwipeOut('left');
    } else if (!isFlipped && Math.abs(diffX) > 40) {
      // Drag on front reveals answer
      handleRevealAnswer();
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        cardRef.current.style.transform = 'translateX(0px) rotate(0deg)';
      }
    } else {
      // Snap back to center
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        cardRef.current.style.transform = 'translateX(0px) rotate(0deg)';
      }
      if (stampRejectRef.current) stampRejectRef.current.style.opacity = '0';
      if (stampAcceptRef.current) stampAcceptRef.current.style.opacity = '0';
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (isFlipped) {
          handleSwipeOut('left');
        } else {
          handleRevealAnswer();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (isFlipped) {
          handleSwipeOut('right');
        } else {
          handleRevealAnswer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleSwipeOut, isFlipped]);

  // Highlighted sentence formatting for back of card (supports multiple cloze markers like *enerzijds* and *anderzijds*)
  const renderHighlightedSentence = () => {
    // Regex match to preserve split delimiters
    const tokens = card.ex.split(/(\*.*?\*)/g);
    return (
      <>
        &ldquo;
        {tokens.map((token, idx) => {
          if (token.startsWith('*') && token.endsWith('*')) {
            const inner = token.slice(1, -1);
            return (
              <strong key={idx} className="text-[#8d4b00] font-bold">
                {inner}
              </strong>
            );
          }
          return <React.Fragment key={idx}>{token}</React.Fragment>;
        })}
        &rdquo;
      </>
    );
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Session Meta Bar - Cleaned: Dangerous Reset button completely removed */}
      <div className="flex items-center justify-between py-1 px-1 mb-2 select-none">
        <div className="text-xs font-bold text-[#554336] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#8d4b00]" />
          <span>Vlaams B1</span>
        </div>

        <div className="flex items-center gap-2 bg-[#f4f2fd] px-3.5 py-1.5 rounded-full shadow-xs border border-[#eeedf7]">
          <span className="text-[11px] font-bold text-[#554336] uppercase tracking-wider">
            Due: <strong className="text-[#1a1b22] text-xs font-extrabold">{dueCount}</strong>
          </span>
          <span className="w-1 h-3 rounded-full bg-[#dbc2b0]" />
          <span className="text-[11px] font-bold text-[#554336] uppercase tracking-wider">
            Rem: <strong className="text-[#8d4b00] text-xs font-extrabold">{remCount}</strong>
          </span>
        </div>
      </div>

      {/* Study Area / Swipe Canvas */}
      <div className="relative w-full flex flex-col justify-center min-h-[380px] my-1">
        {/* Swipe Stamp Indicators (only triggered on back) */}
        <div
          ref={stampRejectRef}
          className="absolute top-6 left-6 z-30 opacity-0 pointer-events-none transition-opacity bg-[#ffdad6] text-[#93000a] px-3.5 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider -rotate-12 shadow-md border border-[#ffcdc7]"
        >
          Nog niet
        </div>

        <div
          ref={stampAcceptRef}
          className="absolute top-6 right-6 z-30 opacity-0 pointer-events-none transition-opacity bg-[#82f5c1] text-[#00714e] px-3.5 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider rotate-12 shadow-md border border-[#70efb6]"
        >
          Ken ik
        </div>

        {/* Interactive Card */}
        <div
          className="relative w-full h-[390px] touch-pan-y cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={cardRef}
            className="w-full h-full relative rounded-2xl shadow-md bg-[#ffffff] border border-[#eeedf7] flex flex-col justify-between p-6 overflow-hidden"
          >
            {/* FRONT OF CARD (Challenge) */}
            {!isFlipped ? (
              <div className="flex flex-col justify-between h-full w-full">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#554336] uppercase tracking-wider">
                      Vraag
                    </span>
                    <span className="text-[11px] font-semibold text-[#554336] flex items-center gap-1">
                      <Icon name="touch_app" size={15} />
                      Tik voor antwoord
                    </span>
                  </div>

                  {/* Top Word Block: Fixed height container to guarantee zero sentence shift */}
                  <div className="mt-4 text-center min-h-[64px] flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-[#554336] tracking-wider uppercase">
                      ENGELS
                    </span>
                    <h2
                      data-selectable-text
                      className="text-[24px] font-extrabold text-[#1a1b22] mt-0.5 tracking-tight select-text cursor-text"
                    >
                      {card.en}
                    </h2>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-[#f4f2fd] border border-[#eeedf7]/80 text-center min-h-[92px] flex flex-col justify-center">
                    <p className="text-[11px] font-bold text-[#554336] uppercase tracking-wider mb-1">
                      VUL AAN IN HET VLAAMS
                    </p>
                    <p
                      data-selectable-text
                      className="text-[16px] text-[#1a1b22] italic font-medium leading-relaxed select-text cursor-text"
                    >
                      &ldquo;{parsed.frontSentence}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <span className="text-[11px] font-bold text-[#554336] bg-[#eeedf7] px-3.5 py-1 rounded-full inline-block">
                    ( Tik buiten de tekst om te controleren )
                  </span>
                </div>
              </div>
            ) : (
              /* BACK OF CARD (Revealed - Matching Requested Clean Spec) */
              <div className="flex flex-col justify-between h-full w-full animate-fade-in">
                <div>
                  {/* Subtle top indicator */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#00714e] uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00714e]" />
                      Antwoord
                    </span>
                    <span className="text-[11px] font-semibold text-[#554336] flex items-center gap-1">
                      <Icon name="check_circle" size={14} />
                      Beoordeel hieronder
                    </span>
                  </div>

                  {/* Clean Word & Meaning: Matching min-h-[64px] flex container */}
                  <div className="mt-4 text-center min-h-[64px] flex flex-col justify-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <h2
                        data-selectable-text
                        className="text-[24px] font-bold text-[#1a1b22] tracking-tight select-text cursor-text"
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
                            ? 'bg-[#ffdcc3] text-[#2f1500] shadow-sm'
                            : 'bg-[#eeedf7] hover:bg-[#e8e7f1] text-[#8d4b00]'
                        }`}
                      >
                        <Icon name={playingAudioType === 'word' ? 'graphic_eq' : 'volume_up'} size={19} />
                      </button>
                    </div>

                    <p
                      data-selectable-text
                      className="text-xs text-[#554336] mt-0.5 font-medium select-text cursor-text"
                    >
                      Meaning: {card.en}
                    </p>
                  </div>

                  {/* Middle Box: VOLLEDIGE ZIN (Selectable) - Matching min-h-[92px] and text-[16px] */}
                  <div className="mt-4 p-4 rounded-xl bg-[#f4f2fd] border border-[#eeedf7]/80 text-center min-h-[92px] flex flex-col justify-center relative group">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <p className="text-[11px] font-bold text-[#554336] uppercase tracking-wider">
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
                            ? 'bg-[#ffdcc3] text-[#2f1500] shadow-xs'
                            : 'bg-[#eeedf7] hover:bg-[#e3e1ec] text-[#8d4b00]'
                        }`}
                      >
                        <Icon name={playingAudioType === 'sentence' ? 'graphic_eq' : 'volume_up'} size={15} />
                      </button>
                    </div>
                    <p
                      data-selectable-text
                      className="text-[16px] text-[#1a1b22] leading-relaxed select-text cursor-text"
                    >
                      {renderHighlightedSentence()}
                    </p>
                  </div>
                </div>

                {/* Bottom: Interval na succes */}
                <div className="flex items-center justify-center gap-1.5 pt-2 text-center">
                  <Icon name="schedule" size={16} className="text-[#00714e]" />
                  <span className="text-xs font-semibold text-[#00714e]">
                    Interval na succes: {parsed.nextIntervalLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Actions Area (Fixed height container to prevent card jumping) */}
      <div className="w-full mt-3 min-h-[82px] flex flex-col justify-start">
        {!isFlipped ? (
          /* Front Action: Single Reveal Button to prevent false positives */
          <div className="w-full">
            <button
              onClick={handleRevealAnswer}
              className="w-full min-h-[58px] rounded-xl bg-[#8d4b00] hover:bg-[#6e3900] text-white flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm font-bold text-base"
            >
              <Icon name="visibility" size={22} />
              <span>Toon antwoord</span>
            </button>
            <div className="h-5" /> {/* Matches sublabel height of back buttons */}
          </div>
        ) : (
          /* Back Actions: Revealed only after flipping */
          <div className="grid grid-cols-2 gap-3 animate-fade-in">
            {/* Nog Niet Action */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleSwipeOut('left')}
                className="w-full min-h-[58px] rounded-xl bg-[#ffdad6] text-[#93000a] flex items-center justify-center gap-2 active:scale-95 hover:bg-[#ffcdc7] transition-all shadow-xs"
              >
                <Icon name="close" size={22} />
                <span className="text-base font-bold">Nog niet</span>
              </button>
              <span className="text-[11px] font-semibold text-[#554336] mt-1.5 flex items-center gap-1 h-3.5">
                <Icon name="arrow_back" size={13} />
                (Swipe links)
              </span>
            </div>

            {/* Ken Ik Action */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleSwipeOut('right')}
                className="w-full min-h-[58px] rounded-xl bg-[#82f5c1] text-[#00714e] flex items-center justify-center gap-2 active:scale-95 hover:bg-[#70efb6] transition-all shadow-xs"
              >
                <Icon name="check" size={22} />
                <span className="text-base font-bold">Ken ik</span>
              </button>
              <span className="text-[11px] font-semibold text-[#554336] mt-1.5 flex items-center gap-1 h-3.5">
                (Swipe rechts)
                <Icon name="arrow_forward" size={13} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Keyboard & Accessibility Helper - Hidden on mobile/touch screens via CSS */}
      <div className="keyboard-shortcuts flex items-center justify-center gap-4 mt-4 text-[#554336] text-[11px] font-medium">
        <span className="flex items-center gap-1">
          <kbd className="bg-[#eeedf7] px-1.5 py-0.5 rounded text-[#1a1b22] font-semibold font-mono text-[10px]">
            Spatie
          </kbd>{' '}
          {isFlipped ? 'Omdraaien' : 'Toon antwoord'}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-[#eeedf7] px-1.5 py-0.5 rounded text-[#1a1b22] font-semibold font-mono text-[10px]">
            ←
          </kbd>{' '}
          Nog niet
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-[#eeedf7] px-1.5 py-0.5 rounded text-[#1a1b22] font-semibold font-mono text-[10px]">
            →
          </kbd>{' '}
          Ken ik
        </span>
      </div>
    </div>
  );
};
