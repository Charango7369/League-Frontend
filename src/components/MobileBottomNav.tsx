import React from 'react';
import { useTournament } from '../context/TournamentContext';
import { ActiveTab } from '../types/tournament';

export const MobileBottomNav: React.FC = () => {
  const { currentTab, setCurrentTab, matches } = useTournament();

  const liveCount = matches.filter((m) => m.status === 'en_juego').length;

  const tabs: { id: ActiveTab; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Inicio', icon: 'home' },
    { id: 'partidos', label: 'Partidos', icon: 'sports_soccer', badge: liveCount > 0 ? liveCount : undefined },
    { id: 'tabla', label: 'Posiciones', icon: 'format_list_numbered' },
    { id: 'equipos', label: 'Equipos', icon: 'shield' },
    { id: 'goleadores', label: 'Goles', icon: 'military_tech' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#07101e]/95 backdrop-blur-xl border-t border-blue-500/20 py-2 px-3 flex items-center justify-around">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 relative transition-all ${
              isActive ? 'text-amber-400 font-bold' : 'text-blue-200/60 hover:text-white font-medium'
            }`}
          >
            <div className="relative">
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'fill' : ''}`}>
                {tab.icon}
              </span>
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
