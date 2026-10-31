import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';

export const SettingsView: React.FC = () => {
  const {
    tournament,
    updateTournament,
    generateNewFixture,
    resetAllData,
    currentUser,
    openAuthModal,
    logout,
    isBackendOnline,
    syncWithDatabase,
    showToast,
  } = useTournament();

  const [name, setName] = useState(tournament.name);
  const [subtitle, setSubtitle] = useState(tournament.subtitle);
  const [season, setSeason] = useState(tournament.season);
  const [organizer, setOrganizer] = useState(tournament.organizer);
  const [location, setLocation] = useState(tournament.location);
  const [duration, setDuration] = useState(tournament.matchDurationMinutes);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateTournament({
      name: name.trim(),
      subtitle: subtitle.trim(),
      season: season.trim(),
      organizer: organizer.trim(),
      location: location.trim(),
      matchDurationMinutes: Number(duration) || 90,
    });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithDatabase();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-[#0d2347]/80 p-5 rounded-2xl border border-blue-500/20">
        <h2 className="font-syne font-extrabold text-xl text-white">Configuración del Torneo & SaaS</h2>
        <p className="text-xs text-blue-200/70 mt-1">
          Ajusta los parámetros de tu liga y la conexión con la nube Apolodigital.lat
        </p>
      </div>

      {/* SaaS Cloud & Multi-Tenant Section */}
      <div className="bg-[#0d2347]/80 rounded-2xl border border-blue-500/30 p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-500/20 pb-4">
          <div>
            <h3 className="font-syne font-bold text-sm text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">cloud_done</span>
              <span>Infraestructura SaaS Multi-Tenant & PostgreSQL</span>
            </h3>
            <p className="text-xs text-blue-200/70 mt-0.5">
              Arquitectura escalable para federaciones, ligas provinciales y municipios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                isBackendOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{isBackendOnline ? 'FastAPI 2.0 Conectado' : 'Modo Offline / Local'}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#0a1628] p-3.5 rounded-xl border border-blue-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
              Base de Datos
            </span>
            <p className="font-bold text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-400 text-sm">database</span>
              <span>PostgreSQL 16 (Port 5435)</span>
            </p>
            <p className="text-[10px] text-emerald-400 mt-1">Esquema Multi-Tenant Aislado</p>
          </div>

          <div className="bg-[#0a1628] p-3.5 rounded-xl border border-blue-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
              Caché & WebSockets
            </span>
            <p className="font-bold text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-rose-400 text-sm">memory</span>
              <span>Redis 7 (Port 6379)</span>
            </p>
            <p className="text-[10px] text-emerald-400 mt-1">Pub/Sub Marcador en Vivo</p>
          </div>

          <div className="bg-[#0a1628] p-3.5 rounded-xl border border-blue-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
              Organización Activa (Tenant)
            </span>
            <p className="font-bold text-amber-400 truncate">
              {currentUser?.orgName || 'Asociación Deportiva Apolo'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              slug: {currentUser?.orgSlug || 'asociacion-apolo'}
            </p>
          </div>
        </div>

        {/* User Session Info & Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Sesión iniciada como:</span>
                <span className="font-bold text-white">{currentUser.fullName}</span>
                <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                  {currentUser.role}
                </span>
              </div>
            ) : (
              <span className="text-slate-400">
                No has iniciado sesión como administrador SaaS oficial.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <button
                type="button"
                onClick={logout}
                className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-xl transition-all"
              >
                Cerrar Sesión
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                <span>Acceder con Cuenta</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !isBackendOnline}
              className="bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar con PostgreSQL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form
        onSubmit={handleSave}
        className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 p-6 space-y-4 shadow-xl"
      >
        <h3 className="font-syne font-bold text-sm text-amber-400 uppercase tracking-wider">
          Información del Torneo
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre del Torneo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white font-medium focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Subtítulo / Lema</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white font-medium focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Temporada</label>
            <input
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white font-medium focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Ubicación / Sede</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white font-medium focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Organizador</label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white font-medium focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Duración de Partidos (Minutos)
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-[#0a1628] border border-blue-500/30 rounded-xl p-3 text-white font-medium focus:border-blue-400 focus:outline-none"
            >
              <option value={90}>90 Minutos (Fútbol 11 Profesional / Amateur)</option>
              <option value={70}>70 Minutos (Fútbol Juvenil / Sub-17)</option>
              <option value={50}>50 Minutos (Fútbol 7 u 8 / Cancha Sintética)</option>
              <option value={40}>40 Minutos (Futsal / Fútbol de Salón)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>Guardar Ajustes</span>
          </button>
        </div>
      </form>

      {/* Advanced Tools & Data Management */}
      <div className="bg-[#0d2347]/70 rounded-2xl border border-blue-500/20 p-6 space-y-4">
        <h3 className="font-syne font-bold text-sm text-white uppercase tracking-wider">
          Herramientas de Fixture & Datos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Berger Algorithm Generator */}
          <div className="bg-[#0a1628] p-4 rounded-xl border border-blue-500/20 space-y-2">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">auto_mode</span>
              <span>Generador de Fixture Berger (Solo Ida)</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Crea todas las jornadas del campeonato todos contra todos de manera matemáticamente equitativa.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Reemplazar los partidos actuales con un nuevo fixture Berger (Ida)?')) {
                  generateNewFixture(false);
                }
              }}
              className="bg-blue-600/80 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg transition-all"
            >
              Generar Fixture (Ida)
            </button>
          </div>

          {/* Berger Algorithm Generator Return Leg */}
          <div className="bg-[#0a1628] p-4 rounded-xl border border-blue-500/20 space-y-2">
            <h4 className="font-bold text-blue-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">autorenew</span>
              <span>Generador Berger (Ida y Vuelta)</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Genera la primera y segunda rueda completa invirtiendo las localías para un torneo largo.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Reemplazar los partidos actuales con un fixture completo de Ida y Vuelta?')) {
                  generateNewFixture(true);
                }
              }}
              className="bg-blue-700/80 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-all"
            >
              Generar Fixture (Ida y Vuelta)
            </button>
          </div>
        </div>

        {/* Reset */}
        <div className="pt-4 border-t border-blue-500/15 flex items-center justify-between">
          <div>
            <p className="font-bold text-rose-300 text-xs">Restablecer a Valores Oficiales</p>
            <p className="text-[11px] text-slate-400">
              Restaura los 8 clubes de Apolo, partidos de muestra y la tabla inicial.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('¿Confirmas reiniciar todos los datos a los valores oficiales de Apolo League?')) {
                resetAllData();
              }
            }}
            className="bg-rose-900/40 hover:bg-rose-800/60 text-rose-200 border border-rose-500/30 text-xs font-bold px-4 py-2 rounded-xl transition-all"
          >
            Reiniciar Datos
          </button>
        </div>
      </div>
    </div>
  );
};
