'use client';

import { useState } from 'react';
import VoiceRecorder from './VoiceRecorder';

interface TaskResultProps {
  task: string;
  onCopy: () => void;
  onRegenerate?: () => void;
  selectedTeam?: { teamId: string; subtypeId?: string };
  onTaskUpdate?: (updatedTask: string) => void;
  onNewTask?: () => void;
}

export default function TaskResult({ task, onCopy, onRegenerate, selectedTeam, onTaskUpdate, onNewTask }: TaskResultProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentTask, setCurrentTask] = useState(task);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentTask);
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Ошибка при копировании:', error);
    }
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/edit-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTask,
          editInstructions: editText,
          teamId: selectedTeam?.teamId || '',
          subtypeId: selectedTeam?.subtypeId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Ошибка редактирования задачи');
      }
      
      const result = await response.json();
      setCurrentTask(result.editedTask);
      setEditText('');
      setIsEditing(false);
      
      if (onTaskUpdate) {
        onTaskUpdate(result.editedTask);
      }
    } catch (error: any) {
      console.error('Ошибка редактирования:', error);
      alert(`Ошибка: ${error.message}`);
    }
    setIsLoading(false);
  };

  const handleVoiceTranscript = (text: string) => {
    setEditText(text);
    setIsRecording(false);
  };

  const toggleVoiceRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-text font-sans">
            {currentTask}
          </pre>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">Опишите изменения:</p>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Например: Добавь в критерии приёмки пункт про тестирование"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y text-text"
            rows={3}
          />
          {isRecording && (
            <VoiceRecorder
              onTranscript={handleVoiceTranscript}
              onError={(error) => {
                console.error('Ошибка записи:', error);
                setIsRecording(false);
              }}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              disabled={!editText.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Применяю...' : 'Применить'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditText('');
                setIsRecording(false);
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={toggleVoiceRecording}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              🎤 {isRecording ? 'Остановить' : 'Голосом'}
            </button>
          </div>
        </div>
      ) : (
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

          <button
            onClick={() => setIsEditing(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg 
                       font-medium hover:bg-blue-600 transition-colors"
          >
            ✏️ Редактировать
          </button>

          {onNewTask && (
            <button
              onClick={onNewTask}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg 
                         font-medium hover:bg-gray-600 transition-colors"
            >
              🆕 Новая задача
            </button>
          )}

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
      )}
    </div>
  );
}

