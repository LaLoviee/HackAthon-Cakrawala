import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function Header({ role, onSwitchRole, currentUser }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isDosen = role === 'dosen';

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold text-slate-800">
          {isDosen ? 'Dashboard dosen' : 'Papan Tulis'}
        </h1>
      </div>

      <div className="relative w-80 max-w-md hidden sm:block">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={isDosen ? 'Cari papan atau rekaman' : 'Search Bar'}
          className="w-full pl-9 pr-12 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:border-brand-purple transition"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
          ⌘ K
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white transition cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-brand-purple-light text-brand-purple flex items-center justify-center font-bold text-xs">
            {isDosen ? 'MC' : 'SD'}
          </div>
          <div className="text-left leading-none pr-1">
            <span className="text-xs font-semibold text-slate-800 block">
              {isDosen ? 'Dr. Maya Chen' : 'Sinta Dewi'}
            </span>
            <span className="text-[10px] text-slate-400 capitalize block">
              {isDosen ? 'Dosen' : 'Profile'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ganti Akun Demo</p>
            <button
              onClick={() => {
                onSwitchRole('dosen');
                setDropdownOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-50 flex items-center justify-between transition cursor-pointer"
            >
              <div>
                <p className="font-semibold text-slate-800">Dr. Maya Chen</p>
                <p className="text-[10px] text-slate-400">Lecturer</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-purple-light text-brand-purple font-semibold">Dosen</span>
            </button>
            <button
              onClick={() => {
                onSwitchRole('mahasiswa');
                setDropdownOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-50 flex items-center justify-between transition cursor-pointer mt-1"
            >
              <div>
                <p className="font-semibold text-slate-800">Sinta Dewi</p>
                <p className="text-[10px] text-slate-400">Mahasiswa</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-teal-light text-brand-teal font-semibold">Mhs</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
