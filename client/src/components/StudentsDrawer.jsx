import React, { useState } from 'react';
import { CheckCircle2, Edit3 } from 'lucide-react';

export default function StudentsDrawer({ students, onTogglePermission, isLecturer }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="bg-white/95 backdrop-blur-md rounded-full shadow-panel border border-slate-200/80 px-4 py-2 flex items-center gap-3 text-xs font-semibold text-slate-700 hover:bg-white transition cursor-pointer"
      >
        <div className="flex -space-x-2 overflow-hidden">
          {students.slice(0, 3).map((s) => (
            <img key={s.id} className="inline-block h-5 w-5 rounded-full ring-2 ring-white object-cover" src={s.avatar} alt={s.name} />
          ))}
        </div>
        <span><strong>{students.length}</strong> students Connected</span>
        <span className="text-slate-300">|</span>
        <span className="text-brand-purple hover:underline">Show students</span>
      </button>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-panel border border-slate-200/80 p-4 w-[600px] max-w-[90vw] transition-all">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Students</span>
          <span className="px-1.5 py-0.5 rounded-full bg-brand-purple-light text-brand-purple font-mono font-bold text-[10px]">
            {students.length}
          </span>
          <span className="text-[11px] text-slate-400">Everyone is watching your board</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          Hide students
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {students.map((student) => {
          const canWrite = student.canWrite;
          return (
            <div
              key={student.id}
              className={`p-2.5 rounded-2xl border ${
                canWrite ? 'border-2 border-brand-purple bg-brand-purple-50' : 'border-slate-200 bg-white'
              } hover:border-brand-purple/50 transition flex items-center justify-between gap-2`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                  <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-800 truncate">{student.name}</p>
                  <span className={`text-[10px] ${canWrite ? 'text-brand-purple font-bold' : 'text-emerald-600 font-medium'}`}>
                    {canWrite ? 'Can write' : 'Watching'}
                  </span>
                </div>
              </div>

              {isLecturer && (
                <button
                  onClick={() => onTogglePermission(student.id)}
                  className="p-1 rounded text-slate-400 hover:text-brand-purple transition cursor-pointer"
                  title={canWrite ? 'Cabut izin tulis' : 'Beri izin tulis'}
                >
                  {canWrite ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-purple" /> : <Edit3 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
