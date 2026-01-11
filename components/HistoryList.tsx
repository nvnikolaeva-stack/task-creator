'use client';

import { useState, useEffect } from 'react';
import { loadTaskHistory, deleteTaskFromHistory } from '@/lib/storage';
import type { TaskHistoryItem } from '@/types';

export default function HistoryList() {
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskHistoryItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(loadTaskHistory());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Удалить задачу из истории?')) {
      deleteTaskFromHistory(id);
      setHistory(loadTaskHistory());
      if (selectedTask?.id === id) {
        setSelectedTask(null);
      }
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Ошибка при копировании:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        История пуста. Создайте первую задачу на главной странице.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-text mb-4">
          История задач ({history.length})
        </h2>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {history.map((item) => (
            <div
              key={item.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedTask?.id === item.id
                  ? 'border-accent bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedTask(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-text">{item.team}</p>
                  {item.subtype && (
                    <p className="text-sm text-gray-600">{item.subtype}</p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500">{formatDate(item.createdAt)}</p>
              <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                {item.text.substring(0, 100)}...
              </p>
            </div>
          ))}
        </div>
      </div>

      {selectedTask && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-text">Задача</h3>
            <button
              onClick={() => handleCopy(selectedTask.text)}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
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
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-text font-sans">
                {selectedTask.text}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

