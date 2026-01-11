'use client';

import { useState, useEffect } from 'react';
import { loadTemplates, saveTemplates, resetTemplate } from '@/lib/templates';
import type { Team } from '@/types';

export default function TemplateEditor() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string>('');
  const [template, setTemplate] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTeams(loadTemplates());
  }, []);

  const currentTeam = teams.find(t => t.id === selectedTeamId);
  const currentSubtype = currentTeam?.subtypes.find(s => s.id === selectedSubtypeId);

  useEffect(() => {
    if (selectedSubtypeId && currentSubtype) {
      setTemplate(currentSubtype.template);
      setIsEditing(true);
    } else if (selectedTeamId && currentTeam && !currentTeam.subtypes.length) {
      setTemplate(currentTeam.template || '');
      setIsEditing(true);
    } else {
      setTemplate('');
      setIsEditing(false);
    }
  }, [selectedTeamId, selectedSubtypeId, currentTeam, currentSubtype]);

  const handleSave = () => {
    const updatedTeams = [...teams];
    const team = updatedTeams.find(t => t.id === selectedTeamId);
    if (!team) return;

    if (selectedSubtypeId) {
      const subtype = team.subtypes.find(s => s.id === selectedSubtypeId);
      if (subtype) {
        subtype.template = template;
      }
    } else {
      team.template = template;
    }

    setTeams(updatedTeams);
    saveTemplates(updatedTeams);
    alert('Шаблон сохранен!');
  };

  const handleReset = () => {
    if (!selectedTeamId) return;
    resetTemplate(selectedTeamId, selectedSubtypeId || undefined);
    setTeams(loadTemplates());
    if (selectedSubtypeId && currentSubtype) {
      setTemplate(currentSubtype.template);
    } else if (currentTeam) {
      setTemplate(currentTeam.template || '');
    }
    alert('Шаблон сброшен к значению по умолчанию!');
  };

  const handleDeleteTeam = () => {
    if (!selectedTeamId || !confirm('Удалить эту команду?')) return;
    const updatedTeams = teams.filter(t => t.id !== selectedTeamId);
    setTeams(updatedTeams);
    saveTemplates(updatedTeams);
    setSelectedTeamId('');
    setSelectedSubtypeId('');
    setTemplate('');
    setIsEditing(false);
  };

  const handleAddTeam = () => {
    const name = prompt('Введите название новой команды:');
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const newTeam: Team = {
      id,
      name,
      subtypes: [],
      template: '## Шаблон\n[Введите шаблон задачи]',
    };
    const updatedTeams = [...teams, newTeam];
    setTeams(updatedTeams);
    saveTemplates(updatedTeams);
    setSelectedTeamId(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text">Управление шаблонами</h2>
        <button
          onClick={handleAddTeam}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Добавить команду
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Команда
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setSelectedSubtypeId('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                         text-text bg-white"
            >
              <option value="">Выберите команду</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {currentTeam && currentTeam.subtypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Подтип
              </label>
              <select
                value={selectedSubtypeId}
                onChange={(e) => setSelectedSubtypeId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                           text-text bg-white"
              >
                <option value="">Выберите подтип</option>
                {currentTeam.subtypes.map((subtype) => (
                  <option key={subtype.id} value={subtype.id}>
                    {subtype.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Сохранить
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 text-text rounded-lg hover:bg-gray-50 transition-colors"
              >
                Сбросить
              </button>
              <button
                onClick={handleDeleteTeam}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Удалить
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Шаблон
          </label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            disabled={!isEditing}
            className="w-full min-h-[400px] px-4 py-3 border border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                       resize-y text-text font-mono text-sm disabled:bg-gray-100"
            placeholder="Выберите команду для редактирования шаблона"
          />
        </div>
      </div>
    </div>
  );
}

