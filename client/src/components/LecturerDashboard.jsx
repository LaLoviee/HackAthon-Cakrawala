import React, { useState } from 'react';
import { Layout, Radio, ArrowRight, UserCheck, Play, History } from 'lucide-react';

export default function LecturerDashboard({ onCreateAndHost, onHostSaved }) {
  const [title, setTitle] = useState('Kalkulus Dasar');
  const [courseCode, setCourseCode] = useState('MK101');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateAndHost(title.trim(), courseCode);
  };

  return (
    <section className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Hero Title */}
      <div>
        <p className="text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase mb-2">
          R U A N G &nbsp;B E L A J A R , &nbsp;T A N P A &nbsp;B A T A S
        </p>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Selamat datang</h2>
        <p className="text-slate-500 text-sm mt-1">
          Siapkan papan, mulai kelas, dan ajak mahasiswa berkolaborasi.
        </p>
      </div>

      {/* Dua Kartu Aksi Utama Dosen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Buat Papan Baru */}
        <div className="bg-white rounded-3xl p-7 border border-slate-100 shadow-card flex flex-col justify-between hover:shadow-card-hover transition">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Layout className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Buat papan baru</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">Mulai dari papan kosong untuk ide dan materi baru.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Nama papan</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Dasar desain"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-brand-purple transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Pilih Mata Kuliah</label>
                <select
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-brand-purple transition"
                >
                  <option value="MK101">MK101 — Kalkulus Dasar</option>
                  <option value="CS204">CS204 — Algoritma & Pemrograman</option>
                </select>
              </div>

              <p className="text-[11px] text-slate-400">Buat papan dan langsung mulai sesi bersama mahasiswa.</p>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Kamu menjadi host dan mengatur akses.</span>
            </div>
            <button
              onClick={handleSubmit}
              className="px-6 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal-hover text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-brand-teal/20 cursor-pointer"
            >
              <span>Buat & host</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: Host Papan Tersimpan */}
        <div className="bg-white rounded-3xl p-7 border border-slate-100 shadow-card flex flex-col justify-between hover:shadow-card-hover transition">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Host papan</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">Gunakan papan tersimpan untuk memulai kelas berikutnya.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Papan tersimpan</label>
                <select className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-brand-purple transition">
                  <option>Dasar desain</option>
                  <option>Struktur Aljabar Linier</option>
                  <option>Pengantar Sistem Operasi</option>
                </select>
              </div>

              <button
                type="button"
                onClick={onHostSaved}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Mulai hosting</span>
              </button>
              <p className="text-[11px] text-slate-400">Bagikan undangan setelah sesi dimulai.</p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <History className="w-3.5 h-3.5" />
            <span>Riwayat coretan sebelumnya akan otomatis dimuat.</span>
          </div>
        </div>

      </div>

      {/* 3 Langkah Edukasi */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-800">Mulai mengajar dengan CakraBoard</h4>
          <span className="text-xs font-medium text-slate-400">Mudah, dari awal.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-brand-purple font-mono block mb-2">01</span>
            <h5 className="text-xs font-bold text-slate-800 mb-1">Buat papan</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Beri nama papan untuk materi perkuliahanmu.
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-brand-purple font-mono block mb-2">02</span>
            <h5 className="text-xs font-bold text-slate-800 mb-1">Mulai hosting</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Bagikan undangan kelas kepada mahasiswa.
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-brand-purple font-mono block mb-2">03</span>
            <h5 className="text-xs font-bold text-slate-800 mb-1">Lanjutkan kapan saja</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Buka kembali rekaman kelas melalui History.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
        <span>Satu ruang untuk belajar, berbagi, dan berkembang.</span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-slate-600">Panduan</a>
          <a href="#" className="hover:text-slate-600">Privasi</a>
        </div>
      </div>
    </section>
  );
}
