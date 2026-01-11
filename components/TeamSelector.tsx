'use client';

import { loadTemplates } from '@/lib/templates';
import type { SelectedTeam } from '@/types';

interface TeamSelectorProps {
  selectedTeam: SelectedTeam | null;
  onSelect: (team: SelectedTeam) => void;
}

export default function TeamSelector({ selectedTeam, onSelect }: TeamSelectorProps) {
  const teams = loadTemplates();

  const handleTeamChange = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (team.subtypes.length > 0) {
      // Если есть подтипы, выбираем первый по умолчанию
      onSelect({ teamId, subtypeId: team.subtypes[0].id });
    } else {
      onSelect({ teamId });
    }
  };

  const handleSubtypeChange = (subtypeId: string) => {
    if (!selectedTeam) return;
    onSelect({ ...selectedTeam, subtypeId });
  };

  const currentTeam = selectedTeam ? teams.find(t => t.id === selectedTeam.teamId) : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          Команда
        </label>
        <select
          value={selectedTeam?.teamId || ''}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                     text-text bg-white"
        >
          <option value="">Выберите команду...</option>
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
            value={selectedTeam?.subtypeId || ''}
            onChange={(e) => handleSubtypeChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                       text-text bg-white"
          >
            {currentTeam.subtypes.map((subtype) => (
              <option key={subtype.id} value={subtype.id}>
                {subtype.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

