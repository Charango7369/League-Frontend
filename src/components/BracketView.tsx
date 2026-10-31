import React, { useState } from 'react';
import { useTournament } from '../context/TournamentContext';

interface BracketNode {
  id: string;
  stage: 'cuartos' | 'semis' | 'final';
  team1Name: string;
  team2Name: string;
  score1: number | '';
  score2: number | '';
  winner?: string;
}

export const BracketView: React.FC = () => {
  const { standings, tournament } = useTournament();

  // Default initial bracket using top teams
  const [brackets, setBrackets] = useState<BracketNode[]>([
    // Cuartos
    {
      id: 'q1',
      stage: 'cuartos',
      team1Name: standings[0]?.team.name || 'Club 1',
      team2Name: standings[7]?.team.name || 'Club 8',
      score1: 3,
      score2: 1,
      winner: standings[0]?.team.name || 'Club 1',
    },
    {
      id: 'q2',
      stage: 'cuartos',
      team1Name: standings[3]?.team.name || 'Club 4',
      team2Name: standings[4]?.team.name || 'Club 5',
      score1: 2,
      score2: 0,
      winner: standings[3]?.team.name || 'Club 4',
    },
    {
      id: 'q3',
      stage: 'cuartos',
      team1Name: standings[1]?.team.name || 'Club 2',
      team2Name: standings[6]?.team.name || 'Club 7',
      score1: 4,
      score2: 2,
      winner: standings[1]?.team.name || 'Club 2',
    },
    {
      id: 'q4',
      stage: 'cuartos',
      team1Name: standings[2]?.team.name || 'Club 3',
      team2Name: standings[5]?.team.name || 'Club 6',
      score1: 1,
      score2: 0,
      winner: standings[2]?.team.name || 'Club 3',
    },

    // Semis
    {
      id: 's1',
      stage: 'semis',
      team1Name: standings[0]?.team.name || 'Club 1',
      team2Name: standings[3]?.team.name || 'Club 4',
      score1: 2,
      score2: 1,
      winner: standings[0]?.team.name || 'Club 1',
    },
    {
      id: 's2',
      stage: 'semis',
      team1Name: standings[1]?.team.name || 'Club 2',
      team2Name: standings[2]?.team.name || 'Club 3',
      score1: 0,
      score2: 1,
      winner: standings[2]?.team.name || 'Club 3',
    },

    // Gran Final
    {
      id: 'f1',
      stage: 'final',
      team1Name: standings[0]?.team.name || 'Club 1',
      team2Name: standings[2]?.team.name || 'Club 3',
      score1: '',
      score2: '',
      winner: undefined,
    },
  ]);

  const handleScoreUpdate = (
    id: string,
    score1Val: number | '',
    score2Val: number | ''
  ) => {
    setBrackets((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        let winner: string | undefined = undefined;
        if (score1Val !== '' && score2Val !== '') {
          if (score1Val > score2Val) winner = b.team1Name;
          else if (score2Val > score1Val) winner = b.team2Name;
        }
        return { ...b, score1: score1Val, score2: score2Val, winner };
      })
    );
  };

  const populateFromStandings = () => {
    if (standings.length < 4) return;
    setBrackets([
      {
        id: 'q1',
        stage: 'cuartos',
        team1Name: standings[0]?.team.name || '1º Clasificado',
        team2Name: standings[7]?.team.name || '8º Clasificado',
        score1: '',
        score2: '',
      },
      {
        id: 'q2',
        stage: 'cuartos',
        team1Name: standings[3]?.team.name || '4º Clasificado',
        team2Name: standings[4]?.team.name || '5º Clasificado',
        score1: '',
        score2: '',
      },
      {
        id: 'q3',
        stage: 'cuartos',
        team1Name: standings[1]?.team.name || '2º Clasificado',
        team2Name: standings[6]?.team.name || '7º Clasificado',
        score1: '',
        score2: '',
      },
      {
        id: 'q4',
        stage: 'cuartos',
        team1Name: standings[2]?.team.name || '3º Clasificado',
        team2Name: standings[5]?.team.name || '6º Clasificado',
        score1: '',
        score2: '',
      },
      {
        id: 's1',
        stage: 'semis',
        team1Name: 'Ganador Q1',
        team2Name: 'Ganador Q2',
        score1: '',
        score2: '',
      },
      {
        id: 's2',
        stage: 'semis',
        team1Name: 'Ganador Q3',
        team2Name: 'Ganador Q4',
        score1: '',
        score2: '',
      },
      {
        id: 'f1',
        stage: 'final',
        team1Name: 'Finalista 1',
        team2Name: 'Finalista 2',
        score1: '',
        score2: '',
      },
    ]);
  };

  const finalMatch = brackets.find((b) => b.id === 'f1');
  const champion = finalMatch?.winner;

  return (
    <div className="space-y-6">
      {/* Title & Populator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d2347]/80 p-5 rounded-2xl border border-blue-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-syne font-extrabold text-xl text-white">Playoffs & Eliminatorias</h2>
            <span className="text-amber-400 font-bold text-xs px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
              Copa de Oro
            </span>
          </div>
          <p className="text-xs text-blue-200/70 mt-1">
            {tournament.name} • Cuadro de eliminación directa estilo 4League
          </p>
        </div>

        <button
          onClick={populateFromStandings}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl border border-blue-400/30 transition-all shadow active:scale-95 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-sm">sync</span>
          <span>Sembrar desde la Tabla</span>
        </button>
      </div>

      {/* Champion Podium if defined */}
      {champion && (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/30 to-amber-500/20 border border-amber-400/40 rounded-2xl p-6 text-center space-y-2 animate-in zoom-in-95">
          <span className="text-4xl">🏆</span>
          <h3 className="font-syne font-black text-2xl text-amber-300">
            ¡CAMPEÓN: {champion.toUpperCase()}!
          </h3>
          <p className="text-xs text-blue-100 font-medium">
            Consagrado en la Gran Final del Torneo Apertura Apolodigital League
          </p>
        </div>
      )}

      {/* Bracket Tree Container */}
      <div className="bg-[#0d2347]/60 rounded-2xl border border-blue-500/20 p-6 overflow-x-auto">
        <div className="min-w-[850px] grid grid-cols-3 gap-8 items-center">
          {/* Column 1: Cuartos de Final */}
          <div className="space-y-6">
            <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-blue-300 text-center pb-2 border-b border-blue-500/20">
              Cuartos de Final
            </h4>
            {brackets
              .filter((b) => b.stage === 'cuartos')
              .map((b) => (
                <div
                  key={b.id}
                  className="bg-[#0a1628] rounded-xl border border-blue-500/25 p-3 shadow-md space-y-2 text-xs"
                >
                  <div
                    className={`flex items-center justify-between p-1.5 rounded ${
                      b.winner === b.team1Name ? 'bg-emerald-500/20 font-bold text-white' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[140px]">{b.team1Name}</span>
                    <input
                      type="number"
                      placeholder="-"
                      value={b.score1}
                      onChange={(e) =>
                        handleScoreUpdate(
                          b.id,
                          e.target.value === '' ? '' : Number(e.target.value),
                          b.score2
                        )
                      }
                      className="w-10 bg-[#0d2347] border border-blue-500/30 rounded text-center text-white py-0.5 text-xs font-bold"
                    />
                  </div>

                  <div
                    className={`flex items-center justify-between p-1.5 rounded ${
                      b.winner === b.team2Name ? 'bg-emerald-500/20 font-bold text-white' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[140px]">{b.team2Name}</span>
                    <input
                      type="number"
                      placeholder="-"
                      value={b.score2}
                      onChange={(e) =>
                        handleScoreUpdate(
                          b.id,
                          b.score1,
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      className="w-10 bg-[#0d2347] border border-blue-500/30 rounded text-center text-white py-0.5 text-xs font-bold"
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Column 2: Semifinales */}
          <div className="space-y-12">
            <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-amber-400 text-center pb-2 border-b border-blue-500/20">
              Semifinales
            </h4>
            {brackets
              .filter((b) => b.stage === 'semis')
              .map((b) => (
                <div
                  key={b.id}
                  className="bg-[#0a1628] rounded-xl border border-amber-500/30 p-3 shadow-lg space-y-2 text-xs"
                >
                  <div
                    className={`flex items-center justify-between p-1.5 rounded ${
                      b.winner === b.team1Name ? 'bg-emerald-500/20 font-bold text-white' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[140px]">{b.team1Name}</span>
                    <input
                      type="number"
                      placeholder="-"
                      value={b.score1}
                      onChange={(e) =>
                        handleScoreUpdate(
                          b.id,
                          e.target.value === '' ? '' : Number(e.target.value),
                          b.score2
                        )
                      }
                      className="w-10 bg-[#0d2347] border border-blue-500/30 rounded text-center text-white py-0.5 text-xs font-bold"
                    />
                  </div>

                  <div
                    className={`flex items-center justify-between p-1.5 rounded ${
                      b.winner === b.team2Name ? 'bg-emerald-500/20 font-bold text-white' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[140px]">{b.team2Name}</span>
                    <input
                      type="number"
                      placeholder="-"
                      value={b.score2}
                      onChange={(e) =>
                        handleScoreUpdate(
                          b.id,
                          b.score1,
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      className="w-10 bg-[#0d2347] border border-blue-500/30 rounded text-center text-white py-0.5 text-xs font-bold"
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Column 3: Gran Final */}
          <div className="space-y-6">
            <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-emerald-400 text-center pb-2 border-b border-blue-500/20">
              🏆 Gran Final
            </h4>
            {finalMatch && (
              <div className="bg-gradient-to-b from-[#102d5e] to-[#0a1628] rounded-2xl border-2 border-amber-400/50 p-4 shadow-2xl space-y-3 text-xs">
                <div className="text-center font-syne font-extrabold text-amber-400 text-xs">
                  POR EL TÍTULO DE CAMPEÓN
                </div>

                <div
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    finalMatch.winner === finalMatch.team1Name
                      ? 'bg-amber-400/20 font-black text-amber-300'
                      : 'text-white'
                  }`}
                >
                  <span className="truncate max-w-[150px] font-semibold">{finalMatch.team1Name}</span>
                  <input
                    type="number"
                    placeholder="-"
                    value={finalMatch.score1}
                    onChange={(e) =>
                      handleScoreUpdate(
                        finalMatch.id,
                        e.target.value === '' ? '' : Number(e.target.value),
                        finalMatch.score2
                      )
                    }
                    className="w-12 bg-[#0a1628] border border-amber-400/40 rounded text-center text-white py-1 text-sm font-black"
                  />
                </div>

                <div
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    finalMatch.winner === finalMatch.team2Name
                      ? 'bg-amber-400/20 font-black text-amber-300'
                      : 'text-white'
                  }`}
                >
                  <span className="truncate max-w-[150px] font-semibold">{finalMatch.team2Name}</span>
                  <input
                    type="number"
                    placeholder="-"
                    value={finalMatch.score2}
                    onChange={(e) =>
                      handleScoreUpdate(
                        finalMatch.id,
                        finalMatch.score1,
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-12 bg-[#0a1628] border border-amber-400/40 rounded text-center text-white py-1 text-sm font-black"
                  />
                </div>

                {finalMatch.winner && (
                  <div className="text-center pt-2 text-amber-300 font-bold text-xs flex items-center justify-center gap-1">
                    <span>👑 Campeón:</span>
                    <span className="font-syne font-black text-white">{finalMatch.winner}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
