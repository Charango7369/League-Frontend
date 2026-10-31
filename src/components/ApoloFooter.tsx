import React from 'react';

export const ApoloFooter: React.FC = () => {
  return (
    <footer className="mt-16 bg-[#07101e] border-t border-blue-500/20 py-10 px-4 lg:px-8 text-blue-200/80">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Brand & Slogan */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-syne font-extrabold text-xl text-white">
              Apolo<span className="text-blue-400">Digital</span>
              <span className="text-amber-400">.lat</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
              LEAGUE
            </span>
          </div>
          <p className="text-xs text-blue-300/70">
            Tecnología deportiva desde la Bolivia Real 🇧🇴 · Impulsando la digitalización de ligas y torneos locales.
          </p>
          <p className="text-[11px] text-slate-400">
            📍 Apolo, Franz Tamayo · La Paz, Bolivia
          </p>
        </div>

        {/* Contact Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-4">
          <a
            href="https://wa.me/59176509789?text=Hola%20Apolodigital%2C%20estoy%20utilizando%20Apolodigital-League%20para%20organizar%20un%20campeonato"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 p-2.5 rounded-xl transition-all text-emerald-300 hover:text-emerald-200 text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-lg text-emerald-400">chat</span>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">WhatsApp Directo</p>
              <p className="font-bold text-white">+591 765 09789</p>
            </div>
          </a>

          <a
            href="https://apolodigital.lat"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 p-2.5 rounded-xl transition-all text-blue-300 hover:text-blue-200 text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-lg text-blue-400">language</span>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Sitio Web Oficial</p>
              <p className="font-bold text-white">apolodigital.lat</p>
            </div>
          </a>
        </div>

        {/* Copyright */}
        <div className="text-left md:text-right text-xs space-y-1 text-slate-400">
          <p>© 2026 Apolodigital League. Versión Final.</p>
          <p className="text-[11px] text-blue-300/60">
            Diseñado y optimizado con arquitectura reactiva estilo 4League.
          </p>
        </div>
      </div>
    </footer>
  );
};
