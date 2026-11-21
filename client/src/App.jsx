import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StudentDashboard from './components/StudentDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import DrawingToolsPanel from './components/DrawingToolsPanel';
import StudentsDrawer from './components/StudentsDrawer';
import { ChevronLeft, Plus, QrCode, Minus, Scan, Undo2, Redo2, Trash2 } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState('mahasiswa'); // 'mahasiswa' | 'dosen'
  const [activeMenu, setActiveMenu] = useState('beranda');
  const [inWhiteboard, setInWhiteboard] = useState(false);

  // Whiteboard session state
  const [sessionInfo, setSessionInfo] = useState({
    id: 'c2263c7b-7e85-49c8-b67e-7f1199098b88',
    code: 'CKB882',
    title: 'Design fundamentals',
    hostName: 'Dr. Maya Chen',
    connectedCount: 5
  });

  // Tools state
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#7357E8');
  const [size, setSize] = useState(24);
  const [opacity, setOpacity] = useState(1.0);
  const [stabilizerEnabled, setStabilizerEnabled] = useState(true);
  const [stabilizerAmount, setStabilizerAmount] = useState(0.35);
  const [isToolsOpen, setIsToolsOpen] = useState(true);

  // Students list
  const [students, setStudents] = useState([
    { id: 'usr-1', name: 'Alex Morgan', status: 'Watching', canWrite: false, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=80' },
    { id: 'usr-2', name: 'Sofia Patel', status: 'Can write', canWrite: true, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80' },
    { id: 'usr-3', name: 'Jordan Lee', status: 'Watching', canWrite: false, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&h=80&q=80' },
    { id: 'usr-4', name: 'Emma Wilson', status: 'Watching', canWrite: false, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&h=80&q=80' }
  ]);

  const handleTogglePermission = (id) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, canWrite: !s.canWrite } : s))
    );
  };

  const handleJoinCode = (code) => {
    setSessionInfo((prev) => ({ ...prev, code }));
    setInWhiteboard(true);
  };

  const handleCreateAndHost = (title, course) => {
    setSessionInfo((prev) => ({ ...prev, title }));
    setInWhiteboard(true);
  };

  // If in Whiteboard Room (Screens 3 & 4)
  if (inWhiteboard) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col font-sans select-none overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setInWhiteboard(false)}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{sessionInfo.hostName}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">Lecturer</span>
                </div>
                <span className="text-[11px] text-slate-400 block">{sessionInfo.title}</span>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Whiteboard / Page 1</span>
              <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-purple transition cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
              <span className="text-slate-300">|</span>
              <span className="font-medium text-emerald-800">{sessionInfo.connectedCount} connected</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-semibold">
              <QrCode className="w-3.5 h-3.5 text-slate-500" />
              <span>{sessionInfo.code}</span>
            </div>

            <button
              onClick={() => setInWhiteboard(false)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Canvas & Right Tools Panel */}
        <div className="flex-1 relative flex overflow-hidden bg-slate-50/50">
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            {/* Whiteboard Interactive Canvas */}
            <div className="w-full h-full bg-white shadow-sm flex items-center justify-center">
              <p className="text-slate-300 text-sm font-medium">Kanvas interaktif aktif (Mendukung sentuhan, stylus, dan pointer)</p>
            </div>

            {/* Bottom-left zoom & actions */}
            <div className="absolute bottom-6 left-6 flex items-center gap-2 z-20">
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-panel border border-slate-200/80 p-1.5 flex items-center gap-1 text-slate-600 text-xs font-semibold">
                <button className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition cursor-pointer">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono">100%</span>
                <button className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition cursor-pointer">
                  <Scan className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-panel border border-slate-200/80 p-1.5 flex items-center gap-1">
                <button className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer">
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer">
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <button className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Dock: Students Drawer (Screens 3 & 4) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
              <StudentsDrawer
                students={students}
                onTogglePermission={handleTogglePermission}
                isLecturer={role === 'dosen'}
              />
            </div>
          </div>

          {/* Right Tools Panel */}
          <DrawingToolsPanel
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            size={size}
            setSize={setSize}
            opacity={opacity}
            setOpacity={setOpacity}
            stabilizerEnabled={stabilizerEnabled}
            setStabilizerEnabled={setStabilizerEnabled}
            stabilizerAmount={stabilizerAmount}
            setStabilizerAmount={setStabilizerAmount}
            onReset={() => {
              setColor('#7357E8');
              setSize(24);
              setOpacity(1.0);
              setTool('pen');
            }}
            isOpen={isToolsOpen}
            onToggle={() => setIsToolsOpen(!isToolsOpen)}
          />
        </div>
      </div>
    );
  }

  // Dashboard View (Screens 1 & 2)
  return (
    <div className="h-screen w-screen flex bg-brand-bg font-sans overflow-hidden">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header role={role} onSwitchRole={setRole} />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          {role === 'mahasiswa' ? (
            <StudentDashboard
              onJoinCode={handleJoinCode}
              onOpenCamera={() => alert('Kamera pemindai aktif!')}
            />
          ) : (
            <LecturerDashboard
              onCreateAndHost={handleCreateAndHost}
              onHostSaved={() => handleCreateAndHost('Dasar desain', 'MK101')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
