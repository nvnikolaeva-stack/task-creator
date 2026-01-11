'use client';

import { useState } from 'react';
import ProgressBar from './ProgressBar';

interface QuestionStepProps {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
}

export default function QuestionStep({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onSkip,
}: QuestionStepProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onAnswer(answer.trim());
      setAnswer('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && answer.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text mb-2">Уточняющие вопросы</h3>
        <ProgressBar current={questionNumber} total={totalQuestions} />
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-text font-medium mb-3">{question}</p>
          <form onSubmit={handleSubmit}>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Введите ответ..."
              className="w-full min-h-[100px] px-4 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                         resize-y text-text"
              rows={4}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={!answer.trim()}
                className="flex-1 min-h-[48px] px-6 py-3 bg-accent text-white rounded-lg 
                           font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Далее →
              </button>
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="px-6 py-3 border border-gray-300 text-text rounded-lg 
                             font-medium hover:bg-gray-50 transition-colors"
                >
                  Пропустить
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Нажмите Ctrl+Enter для отправки
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

