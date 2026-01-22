/**
 * PinModal.tsx
 *
 * Modal para solicitar PIN de 4 dígitos antes de eliminar.
 * Aplica a usuarios nmd_00 a nmd_05 y nmd000 @verbadocpro.eu
 */

import React, { useState, useRef, useEffect } from 'react';

// Configuración del PIN
export const PIN_CONFIG = {
  pin: '1501',
  // Emails que requieren PIN para eliminar
  requiredEmails: [
    'nmd_00@verbadocpro.eu',
    'nmd_01@verbadocpro.eu',
    'nmd_02@verbadocpro.eu',
    'nmd_03@verbadocpro.eu',
    'nmd_04@verbadocpro.eu',
    'nmd_05@verbadocpro.eu',
    'nmd000@verbadocpro.eu'
  ]
};

// Función para verificar si un usuario requiere PIN
export function requiresPin(email: string | undefined): boolean {
  if (!email) return false;
  return PIN_CONFIG.requiredEmails.includes(email.toLowerCase());
}

// Función para verificar el PIN
export function verifyPin(inputPin: string): boolean {
  return inputPin === PIN_CONFIG.pin;
}

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action?: string; // Descripción de la acción a realizar
}

export default function PinModal({ isOpen, onClose, onSuccess, action = 'eliminar' }: PinModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(false);
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [isOpen]);

  const handleChange = (index: number, value: string) => {
    // Solo permitir números
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(false);

    // Auto-avanzar al siguiente campo
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Verificar PIN cuando se completan los 4 dígitos
    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (verifyPin(fullPin)) {
        onSuccess();
        onClose();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin(['', '', '', '']);
          inputRefs[0].current?.focus();
        }, 500);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Retroceder con backspace
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    // Cerrar con Escape
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedData.length === 4) {
      const newPin = pastedData.split('');
      setPin(newPin);
      if (verifyPin(pastedData)) {
        onSuccess();
        onClose();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin(['', '', '', '']);
          inputRefs[0].current?.focus();
        }, 500);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div
        className={`bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-transform ${shake ? 'animate-shake' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-10px); }
            40%, 80% { transform: translateX(10px); }
          }
        `}</style>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h3 className="text-xl font-bold text-gray-900">PIN de Seguridad</h3>
          <p className="text-sm text-gray-500 mt-1">
            Introduce el PIN de 4 dígitos para {action}
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`w-14 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-colors
                ${error
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-red-600 text-sm mb-4">
            PIN incorrecto. Inténtalo de nuevo.
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
