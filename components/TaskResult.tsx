'use client';

import { useState } from 'react';

interface TaskResultProps {
  task: string;
  onCopy: () => void;
  onRegenerate?: () => void;
}

export default function TaskResult({ task, onCopy, onRegenerate }: TaskResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(task);
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Ошибка при копировании:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-text font-sans">
            {task}
          </pre>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className="flex-1 min-h-[48px] px-6 py-3 bg-accent text-white rounded-lg 
                     font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Скопировано!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              Копировать
            </>
          )}
        </button>

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="px-6 py-3 border border-gray-300 text-text rounded-lg 
                       font-medium hover:bg-gray-50 transition-colors"
          >
            Доработать
          </button>
        )}
      </div>
    </div>
  );
}

