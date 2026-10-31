import React from 'react';
import { TournamentProvider, useTournament } from './context/TournamentContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { MatchesView } from './components/MatchesView';
import { StandingsView } from './components/StandingsView';
import { TeamsView } from './components/TeamsView';
import { StatsView } from './components/StatsView';
import { ChroniclesView } from './components/ChroniclesView';
import { BracketView } from './components/BracketView';
import { SettingsView } from './components/SettingsView';
import { MatchLiveModal } from './components/MatchLiveModal';
import { TeamModal } from './components/TeamModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { AuthModal } from './components/AuthModal';
import { ApoloFooter } from './components/ApoloFooter';
import { MobileBottomNav } from './components/MobileBottomNav';
import { StadiumTVView } from './components/StadiumTVView';
import { RefereesView } from './components/RefereesView';
import { DisciplinaryView } from './components/DisciplinaryView';
import { PressMediaHubView } from './components/PressMediaHubView';
import { RefereeAssignmentModal } from './components/RefereeAssignmentModal';
import { MatchOfficialSheetModal } from './components/MatchOfficialSheetModal';

const AppContent: React.FC = () => {
  const {
    currentTab,
    viewMode,
    setViewMode,
    toast,
    activeRefereeAssignmentModal,
    setActiveRefereeAssignmentModal,
    activeOfficialSheetModal,
    setActiveOfficialSheetModal,
  } = useTournament();

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'partidos':
        return <MatchesView />;
      case 'tabla':
        return <StandingsView />;
      case 'equipos':
        return <TeamsView />;
      case 'goleadores':
        return <StatsView />;
      case 'arbitros':
        return <RefereesView />;
      case 'disciplina':
        return <DisciplinaryView />;
      case 'prensa':
        return <PressMediaHubView />;
      case 'cronicas':
        return <ChroniclesView />;
      case 'playoffs':
        return <BracketView />;
      case 'configuracion':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white flex flex-col font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 max-w-sm">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold ${
              toast.type === 'warning'
                ? 'bg-amber-600/90 text-white border-amber-400/50'
                : toast.type === 'info'
                ? 'bg-blue-700/90 text-white border-blue-400/50'
                : 'bg-emerald-600/95 text-white border-emerald-400/50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'warning'
                ? 'warning'
                : toast.type === 'info'
                ? 'info'
                : 'check_circle'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* View Mode Switching: TV Stadium Broadcast vs Mobile Simulator vs Standard Web Desktop */}
      {viewMode === 'tv' ? (
        <StadiumTVView />
      ) : viewMode === 'mobile' ? (
        <div className="flex-1 bg-[#060d19] py-8 px-4 flex flex-col items-center justify-center">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-blue-300 font-semibold">
              Simulador de App Móvil 4League
            </span>
            <button
              onClick={() => setViewMode('desktop')}
              className="text-xs bg-blue-600/50 hover:bg-blue-600 text-white px-3 py-1 rounded-lg border border-blue-400/30 transition-all"
            >
              Volver a vista Web
            </button>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[430px] bg-[#0a1628] rounded-[48px] shadow-2xl overflow-hidden border-[8px] border-slate-700/80 flex flex-col h-[860px] relative">
            {/* Notch */}
            <div className="h-6 bg-slate-900 flex items-center justify-center relative">
              <div className="w-20 h-4 bg-slate-950 rounded-b-xl" />
            </div>

            {/* Mobile Header */}
            <Header />

            {/* Scrollable View Area */}
            <main className="flex-1 overflow-y-auto p-4 pb-20 scrollbar-none">
              {renderActiveView()}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <MobileBottomNav />
          </div>
        </div>
      ) : (
        /* Standard Web Desktop Layout */
        <>
          <Header />
          <Navigation />

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
            {renderActiveView()}
          </main>

          <ApoloFooter />
        </>
      )}

      {/* Global Modals */}
      <MatchLiveModal />
      <TeamModal />
      <WhatsAppShareModal />
      <AuthModal />
      {activeRefereeAssignmentModal && (
        <RefereeAssignmentModal
          match={activeRefereeAssignmentModal}
          onClose={() => setActiveRefereeAssignmentModal(null)}
        />
      )}
      {activeOfficialSheetModal && (
        <MatchOfficialSheetModal
          match={activeOfficialSheetModal}
          onClose={() => setActiveOfficialSheetModal(null)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TournamentProvider>
      <AppContent />
    </TournamentProvider>
  );
};

export default App;
