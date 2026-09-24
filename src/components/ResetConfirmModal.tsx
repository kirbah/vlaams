import React from 'react';
import { Icon } from './Icon';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartSession: () => void;
  onWipeAllProgress: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onRestartSession,
  onWipeAllProgress
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#ffffff] rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#eeedf7] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ffdcc3] flex items-center justify-center text-[#8d4b00]">
            <Icon name="restart_alt" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1a1b22]">Sessie resetten?</h3>
            <p className="text-xs text-[#554336]">Kies wat je wilt herstarten</p>
          </div>
        </div>

        <p className="text-sm text-[#554336] leading-relaxed">
          Je kunt de huidige sessie opnieuw schudden, of al je behaalde Leitner-streaks en datums volledig wissen.
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => {
              onRestartSession();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#eeedf7] hover:bg-[#e8e7f1] text-[#1a1b22] font-semibold text-sm transition-colors text-center"
          >
            Alleen sessie herstarten (Behoud streaks)
          </button>

          <button
            onClick={() => {
              onWipeAllProgress();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#ffdad6] hover:bg-[#ffcdc7] text-[#93000a] font-semibold text-sm transition-colors text-center"
          >
            Volledige voortgang wissen (Leitner 0)
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 text-xs font-semibold text-[#554336] hover:text-[#1a1b22] transition-colors text-center"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
};
