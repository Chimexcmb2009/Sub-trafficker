import React, { useRef, useEffect } from 'react';

interface TelegramOtpInputProps {
  value: string;
  onChange: (code: string) => void;
  status: 'idle' | 'success' | 'error';
  length?: number;
  disabled?: boolean;
}

export default function TelegramOtpInput({
  value,
  onChange,
  status,
  length = 6,
  disabled = false
}: TelegramOtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto focus first input on mount
  useEffect(() => {
    if (inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      // Empty current box
      const newDigits = [...digits];
      newDigits[index] = '';
      onChange(newDigits.join(''));
      return;
    }

    if (val.length > 1) {
      // Pasted multiple digits
      const pastedDigits = val.slice(0, length).split('');
      const newDigits = [...digits];
      for (let i = 0; i < length; i++) {
        if (pastedDigits[i]) {
          newDigits[i] = pastedDigits[i];
        }
      }
      const combined = newDigits.join('');
      onChange(combined);
      const nextIndex = Math.min(pastedDigits.length, length - 1);
      inputsRef.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = val;
    const combined = newDigits.join('');
    onChange(combined);

    // Auto advance to next box
    if (index < length - 1 && val) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back to previous box and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const targetIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[targetIdx]?.focus();
  };

  // Border & Glow styling matching Telegram verification behavior
  const getBoxStyle = (index: number) => {
    const isFilled = Boolean(digits[index]);

    if (status === 'error') {
      return 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.45)] ring-2 ring-rose-500/30 animate-shake';
    }
    if (status === 'success') {
      return 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-2 ring-emerald-500/30';
    }
    if (isFilled) {
      return 'border-blue-500 dark:border-sky-400 bg-blue-50/30 dark:bg-slate-800/80 text-blue-600 dark:text-sky-300 shadow-[0_0_12px_rgba(59,130,246,0.2)]';
    }
    return 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-slate-400 focus:border-blue-500 focus:shadow-[0_0_14px_rgba(59,130,246,0.35)]';
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 py-2 select-none" id="telegram-otp-container">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-black text-center rounded-2xl border-2 transition-all duration-200 outline-none cursor-text ${getBoxStyle(i)} ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label={`Digit ${i + 1}`}
          id={`telegram-otp-box-${i + 1}`}
        />
      ))}
    </div>
  );
}
