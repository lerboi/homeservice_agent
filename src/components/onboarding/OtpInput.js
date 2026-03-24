'use client';

import { useRef, useEffect } from 'react';

export function OtpInput({ onComplete, disabled }) {
  const inputsRef = useRef([]);

  useEffect(() => {
    if (inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, []);

  function getCode() {
    return inputsRef.current.map((el) => (el ? el.value : '')).join('');
  }

  function handleChange(e, index) {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(-1);

    if (val && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    const code = getCode();
    if (code.length === 6) {
      onComplete(code);
    }
  }

  function handleKeyDown(e, index) {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((char, i) => {
      if (inputsRef.current[i]) {
        inputsRef.current[i].value = char;
      }
    });
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    inputsRef.current[nextEmpty]?.focus();
    if (pasted.length === 6) {
      onComplete(pasted);
    }
  }

  return (
    <div
      role="group"
      aria-label="Email verification code"
      className="flex gap-2 justify-center"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of 6`}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className="size-11 text-center text-xl font-semibold border border-white/[0.12] rounded-lg focus:outline-none focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]/30 disabled:opacity-50 disabled:cursor-not-allowed bg-[#0F172A] text-[#F1F5F9]"
        />
      ))}
    </div>
  );
}
