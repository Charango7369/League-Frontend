import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';
import { NotificationCategory } from '../types/tournament';

export const Header: React.FC = () => {
  const {
    tournament,
    viewMode,
    setViewMode,
    setIsShareModalOpen,
    generateNewFixture,
    resetAllData,
    currentUser,
    openAuthModal,
    logout,
    isBackendOnline,
    syncWithDatabase,
    notifications,
    isNotificationsDrawerOpen,
    setIsNotificationsDrawerOpen,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    setCurrentTab,
  } = useTournament();

  const [filterCategory, setFilterCategory] = useState<string>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterCategory === 'all') return true;
    return n.category === filterCategory;
  });

  const getCategoryMeta = (cat: NotificationCategory) => {
    switch (cat) {
      case 'boletin':
        return { icon: 'podcasts', label: 'Boletín Radial / Prensa', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' };
      case 'sancion':
        return { icon: 'gavel', label: 'Tribunal & Disciplina', color: 'text-red-400 bg-red-400/10 border-red-400/30' };
      case 'arbitraje':
        return { icon: 'sports', label: 'Colegio Arbitral', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' };
      case 'partido':
        return { icon: 'sports_soccer', label: 'Acta / Partido', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' };
      case 'comunicado':
        return { icon: 'campaign', label: 'Comunicado Oficial', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' };
      default:
        return { icon: 'info', label: 'Aviso Sistema', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' };
    }
  };

  const handleNotificationClick = (id: string, actionUrl?: string) => {
    markNotificationAsRead(id);
    if (actionUrl) {
      if (actionUrl.includes('disciplina') || actionUrl.includes('tribunal')) {
        setCurrentTab('disciplina');
      } else if (actionUrl.includes('prensa') || actionUrl.includes('boletin')) {
        setCurrentTab('prensa');
      } else if (actionUrl.includes('arbitro')) {
        setCurrentTab('arbitros');
      } else if (actionUrl.includes('partido') || actionUrl.includes('fixture')) {
        setCurrentTab('partidos');
      }
    }
    setIsNotificationsDrawerOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a1628]/95 backdrop-blur-xl border-b border-blue-500/20 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 border border-blue-400/40 shadow-lg shadow-blue-600/30">
            <span className="material-symbols-outlined text-amber-400 text-2xl">sports_soccer</span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-[#0a1628] flex items-center justify-center text-[9px] font-black text-slate-900">
              4L
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-syne font-extrabold text-xl tracking-tight text-white">
                Apolo<span className="text-blue-400">Digital</span>
              </span>
              <span className="text-amber-400 font-black text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 tracking-wider">
                LEAGUE
              </span>
            </div>
            <p className="text-xs text-blue-200/70 flex items-center gap-1.5 font-medium">
              <span>{tournament.name}</span>
              <span className="text-blue-400">•</span>
              <span className="text-amber-300/90 font-semibold">Bolivia 🇧🇴</span>
            </p>
          </div>
        </div>

        {/* Status Indicators & SaaS Session */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Backend Connectivity Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              isBackendOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
            title={
              isBackendOnline
                ? 'Servidor FastAPI & Base de Datos PostgreSQL 16 Conectados'
                : 'Modo Local / Servidor Backend en espera'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="hidden sm:inline">
              {isBackendOnline ? 'FastAPI Online' : 'Modo Offline'}
            </span>
          </div>

          {/* Sync with PostgreSQL Button (if online) */}
          {isBackendOnline && (
            <button
              onClick={() => syncWithDatabase()}
              className="flex items-center gap-1 bg-blue-950/70 hover:bg-blue-900/90 text-blue-300 hover:text-white border border-blue-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95"
              title="Sincronizar y recargar datos oficiales desde PostgreSQL"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              <span className="hidden md:inline">Sincronizar BD</span>
            </button>
          )}

          {/* Auth Session Button / Pill */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#0d2347] border border-blue-500/30 rounded-xl px-2.5 py-1">
              <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[110px]">
                  {currentUser.fullName}
                </p>
                <p className="text-[10px] text-amber-400 font-semibold leading-tight">
                  {currentUser.role === 'ORGANIZATION_ADMIN' ? 'Admin Liga' : currentUser.role}
                </p>
              </div>
              <button
                onClick={openAuthModal}
                className="text-slate-400 hover:text-white p-1"
                title="Ver perfil de organización"
              >
                <span className="material-symbols-outlined text-base">manage_accounts</span>
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-400/40 shadow-md shadow-blue-900/40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base text-amber-400">login</span>
              <span>Iniciar Sesión / SaaS</span>
            </button>
          )}

          {/* Notification Bell Button & Dropdown Drawer */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsDrawerOpen(!isNotificationsDrawerOpen)}
              className={`relative p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
                unreadCount > 0
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-400 hover:bg-amber-500/25 shadow-sm shadow-amber-500/20'
                  : 'bg-[#0d2347] border-blue-500/30 text-blue-200 hover:text-white hover:bg-blue-900/40'
              }`}
              title={`Centro de Notificaciones (${unreadCount} no leídas)`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {unreadCount > 0 ? 'notifications_active' : 'notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 animate-pulse shadow-md shadow-red-500/50">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Flyout Drawer */}
            {isNotificationsDrawerOpen && (
              <>
                {/* Backdrop overlay */}
                <div
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
                  onClick={() => setIsNotificationsDrawerOpen(false)}
                />

                {/* Flyout panel */}
                <div className="absolute right-0 top-12 z-50 w-[350px] sm:w-[420px] max-h-[580px] bg-[#0d2347] border border-blue-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {/* Panel Header */}
                  <div className="p-3.5 bg-[#091833] border-b border-blue-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400 text-xl">
                        notifications
                      </span>
                      <div>
                        <h4 className="font-syne font-bold text-sm text-white">Notificaciones</h4>
                        <p className="text-[10px] text-blue-300">
                          {unreadCount > 0
                            ? `${unreadCount} aviso${unreadCount > 1 ? 's' : ''} pendiente${unreadCount > 1 ? 's' : ''}`
                            : 'Bandeja al día'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllNotificationsAsRead}
                          className="text-[11px] text-blue-300 hover:text-amber-300 font-semibold px-2 py-1 rounded-lg hover:bg-blue-900/50 transition-all flex items-center gap-1"
                          title="Marcar todas como leídas"
                        >
                          <span className="material-symbols-outlined text-sm">done_all</span>
                          <span>Marcar leídas</span>
                        </button>
                      )}
                      <button
                        onClick={() => setIsNotificationsDrawerOpen(false)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-blue-900/50"
                        title="Cerrar"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter chips */}
                  <div className="px-3 py-2 bg-[#0a1b38] border-b border-blue-500/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'boletin', label: 'Boletines' },
                      { id: 'sancion', label: 'Tribunal' },
                      { id: 'arbitraje', label: 'Árbitros' },
                      { id: 'partido', label: 'Partidos' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterCategory(f.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                          filterCategory === f.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-blue-200/70 hover:text-white hover:bg-blue-900/40 bg-[#071326]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Notifications list */}
                  <div className="flex-1 overflow-y-auto max-h-[380px] p-2 space-y-2">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-10 text-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl text-slate-500 mb-2">
                          mark_email_read
                        </span>
                        <p className="text-xs">No hay notificaciones en este filtro</p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => {
                        const meta = getCategoryMeta(notif.category);
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif.id, notif.actionUrl)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all hover:bg-blue-900/30 flex items-start gap-3 relative ${
                              !notif.isRead
                                ? 'bg-blue-950/40 border border-blue-500/30'
                                : 'bg-[#091932]/40 opacity-80'
                            }`}
                          >
                            {/* Icon badge */}
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.color}`}
                            >
                              <span className="material-symbols-outlined text-base">
                                {meta.icon}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span
                                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${meta.color}`}
                                >
                                  {meta.label}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {notif.timestamp}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-white line-clamp-1 mb-0.5">
                                {notif.title}
                              </h5>
                              <p className="text-[11px] text-blue-200/70 line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>

                              {notif.sender && (
                                <p className="text-[9px] text-amber-400/80 font-semibold mt-1 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">
                                    verified
                                  </span>
                                  <span>{notif.sender}</span>
                                </p>
                              )}
                            </div>

                            {/* Unread indicator */}
                            {!notif.isRead && (
                              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 self-center" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="p-2.5 bg-[#091833] border-t border-blue-500/20 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setCurrentTab('prensa');
                        setIsNotificationsDrawerOpen(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition-all shadow-md shadow-blue-900/50"
                    >
                      <span className="material-symbols-outlined text-sm">podcasts</span>
                      <span>Centro de Prensa & Medios</span>
                    </button>

                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all text-xs"
                        title="Limpiar todas las notificaciones"
                      >
                        <span className="material-symbols-outlined text-base">delete_sweep</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Share via WhatsApp button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-md shadow-emerald-950/40 border border-emerald-400/30 active:scale-95"
            title="Compartir tabla y resultados a WhatsApp con formato Apolodigital"
          >
            <span className="material-symbols-outlined text-base">share</span>
            <span className="hidden lg:inline">WhatsApp</span>
          </button>

          {/* Mode Switcher: Desktop vs Mobile 4League App */}
          <div className="bg-[#0d2347] border border-blue-500/20 rounded-lg p-0.5 flex items-center">
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                viewMode === 'desktop'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista de escritorio"
            >
              <span className="material-symbols-outlined text-sm">desktop_windows</span>
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                viewMode === 'mobile'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Simulador App Móvil 4League"
            >
              <span className="material-symbols-outlined text-sm">smartphone</span>
            </button>
            <button
              onClick={() => setViewMode('tv')}
              className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === 'tv'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-amber-400 hover:text-white hover:bg-amber-400/10'
              }`}
              title="Modo Pantalla Gigante / TV Estadio (Fase 7)"
            >
              <span className="material-symbols-outlined text-sm">tv</span>
              <span className="hidden xl:inline text-[11px]">Modo TV</span>
            </button>
          </div>

          {/* Reset Demo Data Button */}
          <button
            onClick={() => {
              if (window.confirm('¿Reiniciar a los datos oficiales de Apolo League?')) {
                resetAllData();
              }
            }}
            className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
            title="Reiniciar datos demo"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
          </button>
        </div>
      </div>
    </header>
  );
};
