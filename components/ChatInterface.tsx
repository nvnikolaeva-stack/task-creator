'use client';

import { useState } from 'react';

interface ChatInterfaceProps {
  questions: string[];
  onAnswer: (answer: string) => void;
}

export default function ChatInterface({ questions, onAnswer }: ChatInterfaceProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const handleAnswer = (questionIndex: number, answer: string) => {
    const newAnswers = { ...answers, [questionIndex]: answer };
    setAnswers(newAnswers);

    if (questionIndex < questions.length - 1) {
      setCurrentQuestionIndex(questionIndex + 1);
    } else {
      // Все вопросы отвечены, отправляем все ответы
      const allAnswers = questions.map((_, idx) => newAnswers[idx] || '').join('\n\n');
      onAnswer(allAnswers);
    }
  };

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-text">
        Нужна дополнительная информация
      </h3>

      <div className="space-y-4">
        {questions.slice(0, currentQuestionIndex + 1).map((question, idx) => (
          <div key={idx} className="space-y-2">
            <p className="font-medium text-text">{question}</p>
            {idx < currentQuestionIndex ? (
              <p className="text-sm text-gray-600 bg-white p-2 rounded">
                {answers[idx] || '(не отвечено)'}
              </p>
            ) : (
              <textarea
                value={answers[idx] || ''}
                onChange={(e) => {
                  const newAnswers = { ...answers, [idx]: e.target.value };
                  setAnswers(newAnswers);
                }}
                placeholder="Введите ответ..."
                className="w-full min-h-[80px] px-4 py-2 border border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                           resize-y text-text"
                rows={3}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => handleAnswer(currentQuestionIndex, answers[currentQuestionIndex] || '')}
        disabled={!answers[currentQuestionIndex]?.trim()}
        className="w-full min-h-[48px] px-6 py-3 bg-accent text-white rounded-lg 
                   font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLastQuestion ? 'Отправить все ответы' : 'Следующий вопрос'}
      </button>
    </div>
  );
}

