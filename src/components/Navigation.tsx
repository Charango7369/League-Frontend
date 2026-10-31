import React from 'react';
import { useTournament } from '../context/TournamentContext';
import { ActiveTab } from '../types/tournament';

export const Navigation: React.FC = () => {
  const { currentTab, setCurrentTab, matches, sanctions, notifications } = useTournament();

  const liveMatchesCount = matches.filter((m) => m.status === 'en_juego').length;
  const activeSanctionsCount = sanctions.filter((s) => s.status === 'activa').length;
  const unreadBulletinsCount = notifications.filter((n) => !n.isRead && n.category === 'boletin').length;

  const tabs: { id: ActiveTab; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Resumen', icon: 'grid_view' },
    {
      id: 'partidos',
      label: 'Partidos',
      icon: 'sports_soccer',
      badge: liveMatchesCount > 0 ? liveMatchesCount : undefined,
    },
    { id: 'tabla', label: 'Posiciones', icon: 'format_list_numbered' },
    { id: 'equipos', label: 'Equipos', icon: 'shield' },
    { id: 'goleadores', label: 'Goleadores', icon: 'military_tech' },
    { id: 'arbitros', label: 'Árbitros', icon: 'sports' },
    {
      id: 'disciplina',
      label: 'Tribunal & Penas',
      icon: 'gavel',
      badge: activeSanctionsCount > 0 ? activeSanctionsCount : undefined,
    },
    {
      id: 'prensa',
      label: 'Prensa & Boletines',
      icon: 'podcasts',
      badge: unreadBulletinsCount > 0 ? unreadBulletinsCount : undefined,
    },
    { id: 'cronicas', label: 'Crónicas IA', icon: 'auto_stories' },
    { id: 'playoffs', label: 'Playoffs', icon: 'account_tree' },
    { id: 'configuracion', label: 'Ajustes', icon: 'tune' },
  ];

  return (
    <nav className="bg-[#0d2347]/60 backdrop-blur-md border-b border-blue-500/15 sticky top-[69px] z-30 px-2 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/30 border border-blue-400/40'
                  : 'text-blue-100/70 hover:text-white hover:bg-blue-900/40 border border-transparent'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isActive ? 'fill' : ''}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>

              {tab.id === 'cronicas' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 tracking-wider">
                  NUEVO
                </span>
              )}

              {tab.badge !== undefined && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse shadow-sm shadow-red-500/50">
                  {tab.badge}
                </span>
              )}

              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
