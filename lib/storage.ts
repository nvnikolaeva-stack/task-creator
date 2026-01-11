import type { TaskHistoryItem } from '@/types';

const HISTORY_KEY = 'jira_task_history';
const MAX_HISTORY_ITEMS = 30;

// Сохранить задачу в историю
export function saveTaskToHistory(
  text: string,
  team: string,
  subtype?: string
): void {
  if (typeof window === 'undefined') return;
  
  const history = loadTaskHistory();
  const newItem: TaskHistoryItem = {
    id: Date.now().toString(),
    text,
    team,
    subtype,
    createdAt: Date.now(),
  };
  
  // Добавляем в начало и ограничиваем количество
  const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
}

// Загрузить историю задач
export function loadTaskHistory(): TaskHistoryItem[] {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem(HISTORY_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// Удалить задачу из истории
export function deleteTaskFromHistory(id: string): void {
  if (typeof window === 'undefined') return;
  
  const history = loadTaskHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
}

// Очистить всю историю
export function clearTaskHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_KEY);
}

