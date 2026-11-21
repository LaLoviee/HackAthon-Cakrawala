import React from 'react';
import { Home, Clock, Play, ChevronRight } from 'lucide-react';

export default function Sidebar({ activeMenu, setActiveMenu }) {
  const recentRecordings = [
    { id: 1, title: 'Rec 1', desc: 'Kalkulus Dasar · 45m' },
    { id: 2, title: 'Rec 2', desc: 'Algoritma & Pemrograman' },
    { id: 3, title: 'Rec 3', desc: 'Struktur Data Graf' }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 transition-all duration-300">
      <div>
        {/* Logo */}
        <div className="h-20 px-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-purple text-white flex items-center justify-center font-bold text-lg shadow-md shadow-brand-purple/20">
            C
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">CakraBoard</span>
        </div>

        {/* Menu Utama */}
        <nav className="px-4 space-y-1.5 mt-2">
          <button
            onClick={() => setActiveMenu('beranda')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeMenu === 'beranda'
                ? 'text-brand-purple bg-brand-purple-light'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Beranda</span>
          </button>
          <button
            onClick={() => setActiveMenu('history')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeMenu === 'history'
                ? 'text-brand-purple bg-brand-purple-light font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>History</span>
          </button>
        </nav>

        {/* Rekaman Sesi */}
        <div className="mt-8 px-4">
          <p className="px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rekaman Sesi</p>
          <div className="space-y-1">
            {recentRecordings.map((rec) => (
              <div
                key={rec.id}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <p className="font-medium text-slate-700 group-hover:text-brand-purple">{rec.title}</p>
                  <p className="text-[10px] text-slate-400">{rec.desc}</p>
                </div>
                <Play className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-purple transition" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Help Card & Footer */}
      <div className="p-4 space-y-4">
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold">?</div>
            <span className="text-xs font-bold text-slate-800">Butuh bantuan?</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-2.5">
            Temukan panduan untuk memulai sesi pertamamu.
          </p>
          <a href="#" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-purple hover:underline">
            Pusat bantuan <ChevronRight className="w-3 h-3" />
          </a>
        </div>

        <p className="text-[10px] text-center text-slate-400 font-medium">
          CakraBoard / Learn. Connect. Grow.
        </p>
      </div>
    </aside>
  );
}
