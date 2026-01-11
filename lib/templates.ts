import templatesData from '../templates.json';
import type { Team, TeamSubtype } from '@/types';

// Типы для JSON файла
interface TemplatesJson {
  teams: Array<{
    id: string;
    name: string;
    subtypes?: Array<{
      id: string;
      name: string;
      template: string;
    }>;
    template?: string;
  }>;
}

// Экспорт типов
export type { Team, TeamSubtype };

// Импортируем шаблоны из JSON файла
const typedData = templatesData as TemplatesJson;

// Дефолтные команды из JSON
export function getDefaultTeams(): Team[] {
  return typedData.teams.map((team) => ({
    id: team.id,
    name: team.name,
    subtypes: team.subtypes?.map(subtype => ({
      id: subtype.id,
      name: subtype.name,
      template: subtype.template,
    })) || [],
    template: team.template,
  }));
}

// Получить список всех команд
export function getTeams(): Team[] {
  return loadTemplates();
}

// Получить команду по ID
export function getTeamById(teamId: string): Team | undefined {
  const teams = loadTemplates();
  return teams.find(team => team.id === teamId);
}

// Получить подтип команды
export function getSubtype(teamId: string, subtypeId: string): TeamSubtype | undefined {
  const team = getTeamById(teamId);
  if (!team) return undefined;
  return team.subtypes.find(subtype => subtype.id === subtypeId);
}

// Получить шаблон для команды/подтипа
export function getTemplate(teamId: string, subtypeId?: string): string | undefined {
  if (subtypeId) {
    const subtype = getSubtype(teamId, subtypeId);
    return subtype?.template;
  }
  const team = getTeamById(teamId);
  return team?.template;
}

// Загрузить шаблоны из localStorage или вернуть дефолтные
export function loadTemplates(): Team[] {
  if (typeof window === 'undefined') return getDefaultTeams();
  
  const stored = localStorage.getItem('jira_templates');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return getDefaultTeams();
    }
  }
  
  // При первом запуске сохраняем дефолтные шаблоны
  const defaultTeams = getDefaultTeams();
  saveTemplates(defaultTeams);
  return defaultTeams;
}

// Сохранить шаблоны в localStorage
export function saveTemplates(teams: Team[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('jira_templates', JSON.stringify(teams));
}

// Сбросить шаблон к дефолтному значению
export function resetTemplate(teamId: string, subtypeId?: string): void {
  const teams = loadTemplates();
  const defaultTeam = getDefaultTeams().find(t => t.id === teamId);
  if (!defaultTeam) return;
  
  if (subtypeId) {
    const defaultSubtype = defaultTeam.subtypes.find(s => s.id === subtypeId);
    if (!defaultSubtype) return;
    
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const subtype = team.subtypes.find(s => s.id === subtypeId);
      if (subtype) {
        subtype.template = defaultSubtype.template;
        saveTemplates(teams);
      }
    }
  } else {
    const team = teams.find(t => t.id === teamId);
    if (team && defaultTeam.template) {
      team.template = defaultTeam.template;
      saveTemplates(teams);
    }
  }
}

