import React, { useState } from 'react';
import { Key, QrCode, ArrowRight, Lock, Camera, ShieldCheck } from 'lucide-react';

export default function StudentDashboard({ onJoinCode, onOpenCamera }) {
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    onJoinCode(code.trim());
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
          Ide besar dimulai dari satu pertemuan. Siap bergabung hari ini?
        </p>
      </div>

      {/* Dua Kartu Aksi Utama Mahasiswa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Join with Code */}
        <div className="bg-white rounded-3xl p-7 border border-slate-100 shadow-card flex flex-col justify-between hover:shadow-card-hover transition">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Key className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Join with code</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">Masuk ke ruang belajar dalam hitungan detik.</p>

            <form onSubmit={handleSubmit} className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Kode sesi</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Masukkan kode sesi"
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono uppercase tracking-wider focus:bg-white focus:outline-none focus:border-brand-purple transition"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal-hover text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-brand-teal/20 shrink-0 cursor-pointer"
                >
                  <span>Gabung</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Minta kode sesi dari pengajar atau penyelenggara.</p>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Ruang privat. Hanya untuk kamu dan peserta sesi.</span>
          </div>
        </div>

        {/* Card 2: QR Camera */}
        <div className="bg-white rounded-3xl p-7 border border-slate-100 shadow-card flex flex-col justify-between hover:shadow-card-hover transition">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-800">QR Camera</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">Punya QR sesi? Pindai di sini.</p>

            <div
              onClick={onOpenCamera}
              className="py-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl hover:border-brand-purple/40 transition p-6 text-center cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mb-2 group-hover:scale-110 transition">
                <Camera className="w-5 h-5" />
              </div>
              <button
                type="button"
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition mt-1 cursor-pointer"
              >
                Buka kamera
              </button>
              <p className="text-[11px] text-slate-400 mt-2">Izin kamera diperlukan untuk memindai.</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Koneksi aman terenkripsi Cakrawala University.</span>
          </div>
        </div>

      </div>

      {/* 3 Langkah Edukasi */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-800">Pertama kali menggunakan CakraBoard?</h4>
          <span className="text-xs font-medium text-slate-400">Mudah, dari awal.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-brand-purple font-mono block mb-2">01</span>
            <h5 className="text-xs font-bold text-slate-800 mb-1">Masuk ke sesi</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Gunakan kode atau pindai QR yang dibagikan pengajar.
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-brand-purple font-mono block mb-2">02</span>
            <h5 className="text-xs font-bold text-slate-800 mb-1">Belajar bersama</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ikuti diskusi dan tuangkan ide di papan kolaboratif.
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-brand-purple font-mono block mb-2">03</span>
            <h5 className="text-xs font-bold text-slate-800 mb-1">Lanjutkan kapan saja</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Temukan kembali rekaman sesi melalui History.
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
