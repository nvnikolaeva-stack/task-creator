// Типы для команд и подтипов
export interface TeamSubtype {
  id: string;
  name: string;
  template: string;
}

export interface Team {
  id: string;
  name: string;
  subtypes: TeamSubtype[];
  template?: string; // Для команд без подтипов
}

export interface SelectedTeam {
  teamId: string;
  subtypeId?: string;
}

// Типы для истории задач
export interface TaskHistoryItem {
  id: string;
  text: string;
  team: string;
  subtype?: string;
  createdAt: number;
}

// Типы для работы с LLM
export interface LLMResponse {
  content: string;
  questions?: string[];
  team?: SelectedTeam;
}

// Типы для состояния приложения
export type ProcessingState = 'idle' | 'recording' | 'processing' | 'ready' | 'error';

