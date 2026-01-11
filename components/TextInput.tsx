'use client';

import { useState } from 'react';

interface TextInputProps {
  onSubmit: (text: string) => void;
  initialValue?: string;
  disabled?: boolean;
}

export default function TextInput({ onSubmit, initialValue = '', disabled = false }: TextInputProps) {
  const [text, setText] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSubmit(text.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Опишите задачу текстом..."
        className="w-full min-h-[120px] px-4 py-3 border border-gray-300 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                   resize-y text-text"
        rows={4}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="mt-3 w-full min-h-[48px] px-6 py-3 bg-accent text-white rounded-lg 
                   font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Создать задачу
      </button>
    </form>
  );
}

