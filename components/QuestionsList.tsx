'use client';

import { useState } from 'react';
import VoiceRecorder from './VoiceRecorder';

interface QuestionsListProps {
  questions: string[];
  onAnswer: (answers: string) => void;
  onError: (error: string) => void;
}

export default function QuestionsList({ questions, onAnswer, onError }: QuestionsListProps) {
  const [textMode, setTextMode] = useState(false);
  const [textAnswers, setTextAnswers] = useState('');

  const handleVoiceTranscript = (text: string) => {
    onAnswer(text);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textAnswers.trim()) {
      onAnswer(textAnswers.trim());
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text mb-2">
          Нужны уточнения ({questions.length} {questions.length === 1 ? 'вопрос' : questions.length < 5 ? 'вопроса' : 'вопросов'}):
        </h3>
      </div>

      <div className="space-y-3">
        <ol className="list-decimal list-inside space-y-2 text-text">
          {questions.map((question, index) => (
            <li key={index} className="pl-2">
              {question}
            </li>
          ))}
        </ol>
      </div>

      {!textMode ? (
        <div className="space-y-4">
          <VoiceRecorder onTranscript={handleVoiceTranscript} onError={onError} />
          <p className="text-sm text-gray-600 text-center">
            Ответьте на все вопросы по порядку в одном сообщении
          </p>
          <button
            onClick={() => setTextMode(true)}
            className="w-full px-4 py-2 border border-gray-300 text-text rounded-lg 
                       font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            Ввести текстом
          </button>
        </div>
      ) : (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <textarea
            value={textAnswers}
            onChange={(e) => setTextAnswers(e.target.value)}
            placeholder="Ответьте на все вопросы по порядку..."
            className="w-full min-h-[150px] px-4 py-3 border border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                       resize-y text-text"
            rows={6}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!textAnswers.trim()}
              className="flex-1 min-h-[48px] px-6 py-3 bg-accent text-white rounded-lg 
                         font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отправить ответы
            </button>
            <button
              type="button"
              onClick={() => {
                setTextMode(false);
                setTextAnswers('');
              }}
              className="px-6 py-3 border border-gray-300 text-text rounded-lg 
                         font-medium hover:bg-gray-50 transition-colors"
            >
              Голосом
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

