import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Lock, Delete, X, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { UserRole } from '../../types';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedPin: string;
  onLoginSuccess: (user: { username: string; fullName: string; role: UserRole; data?: any }) => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  expectedPin,
  onLoginSuccess,
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setIsSuccess(false);
      setIsShaking(false);
    }
  }, [isOpen]);

  const handleVerify = useCallback(
    (enteredPin: string) => {
      const targetPin = (expectedPin || '000000').trim();
      if (enteredPin === targetPin) {
        setIsSuccess(true);
        setError(null);
        setTimeout(() => {
          onLoginSuccess({
            username: 'admin',
            fullName: 'ผู้ดูแลระบบ',
            role: 'admin',
            data: { username: 'admin', fullName: 'ผู้ดูแลระบบ', role: 'admin' },
          });
          onClose();
        }, 500);
      } else {
        setIsShaking(true);
        setError('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        setTimeout(() => {
          setPin('');
          setIsShaking(false);
        }, 800);
      }
    },
    [expectedPin, onLoginSuccess, onClose]
  );

  const handleDigitClick = (digit: string) => {
    if (isSuccess || pin.length >= 6) return;
    setError(null);
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 6) {
      handleVerify(nextPin);
    }
  };

  const handleBackspace = () => {
    if (isSuccess) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isSuccess) return;
    setError(null);
    setPin('');
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, isSuccess, handleVerify]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          title="ปิด"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center pt-2 pb-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shadow-lg shadow-[#0C7C82]/25 mb-3">
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-white animate-bounce" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-white" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-800">เข้าสู่ระบบผู้ดูแลระบบ</h3>
          <p className="text-xs text-slate-500 mt-1">
            กรอกรหัส PIN 6 หลัก เพื่อเข้าสู่ระบบ
          </p>
        </div>

        {/* PIN Dots Display */}
        <div className="my-4">
          <div
            className={`flex items-center justify-center gap-3.5 py-3 transition-transform ${
              isShaking ? 'animate-bounce text-red-500' : ''
            }`}
          >
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = index < pin.length;
              return (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isSuccess
                      ? 'bg-emerald-500 scale-110 shadow-xs shadow-emerald-400'
                      : isFilled
                      ? 'bg-[#0C7C82] scale-110 shadow-xs shadow-[#0C7C82]/30'
                      : 'border-2 border-slate-300 bg-slate-50'
                  }`}
                />
              );
            })}
          </div>

          {/* Feedback error / success message */}
          {error && (
            <div className="mt-2 text-center text-xs text-red-600 font-medium flex items-center justify-center gap-1.5 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {isSuccess && (
            <div className="mt-2 text-center text-xs text-emerald-600 font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>รหัสถูกต้อง กำลังเข้าสู่ระบบ...</span>
            </div>
          )}
        </div>

        {/* Numpad 0-9 Buttons */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitClick(digit)}
              disabled={isSuccess || pin.length >= 6}
              className="h-12 rounded-2xl bg-slate-50 hover:bg-teal-50 hover:text-[#0C7C82] text-slate-700 text-lg font-bold border border-slate-200/80 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isSuccess || pin.length === 0}
            className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold border border-slate-200/80 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-40"
          >
            ล้าง
          </button>

          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            disabled={isSuccess || pin.length >= 6}
            className="h-12 rounded-2xl bg-slate-50 hover:bg-teal-50 hover:text-[#0C7C82] text-slate-700 text-lg font-bold border border-slate-200/80 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-50"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isSuccess || pin.length === 0}
            className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-40"
            title="ลบตัวเลข"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Hint footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            สามารถกดปุ่มตัวเลขบนแป้นพิมพ์เพื่อป้อน PIN ได้โดยตรง
          </p>
        </div>
      </div>
    </div>
  );
};

interface FloatingAdminLoginButtonProps {
  onClick: () => void;
}

export const FloatingAdminLoginButton: React.FC<FloatingAdminLoginButtonProps> = ({ onClick }) => {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        type="button"
        onClick={onClick}
        className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white shadow-xl shadow-[#0C7C82]/35 hover:shadow-[#0C7C82]/55 hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center border-2 border-white ring-4 ring-[#0C7C82]/20 group"
        title="เข้าสู่ระบบผู้ดูแลระบบ (Admin PIN)"
        aria-label="เข้าสู่ระบบผู้ดูแลระบบด้วย PIN"
      >
        <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-white transition-transform group-hover:scale-110 group-hover:rotate-6" />
      </button>
    </div>
  );
};
