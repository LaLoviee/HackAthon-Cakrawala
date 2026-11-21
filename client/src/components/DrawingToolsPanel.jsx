import React, { useRef, useEffect } from 'react';
import { PenTool, Eraser, Sparkles, ChevronRight } from 'lucide-react';

export default function DrawingToolsPanel({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  opacity,
  setOpacity,
  stabilizerEnabled,
  setStabilizerEnabled,
  stabilizerAmount,
  setStabilizerAmount,
  onReset,
  isOpen,
  onToggle
}) {
  const previewCanvasRef = useRef(null);

  const savedColors = [
    '#7357E8', // Signature CakraBoard Purple
    '#2563EB',
    '#06B6D4',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#0F172A'
  ];

  // Gambar S-curve preview kuas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.min(32, size * 0.7);

    if (tool === 'eraser') {
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([4, 4]);
    } else {
      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
    }

    ctx.beginPath();
    ctx.moveTo(20, h / 2 + 5);
    ctx.bezierCurveTo(w * 0.35, -5, w * 0.65, h + 5, w - 20, h / 2 - 5);
    ctx.stroke();
    ctx.restore();
  }, [tool, color, size, opacity]);

  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col justify-between shrink-0 shadow-panel z-20 overflow-y-auto">
      <div className="p-6 space-y-6">
        
        {/* Header Panel */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Drawing tools</h3>
            <p className="text-xs text-slate-400 mt-0.5">A little control. Endless possibility.</p>
          </div>
          <button onClick={onToggle} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Toggle Paint vs Eraser */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setTool('pen')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              tool === 'pen' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Paint</span>
            <kbd className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1 rounded border border-slate-200">B</kbd>
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              tool === 'eraser' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span>Eraser</span>
            <kbd className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1 rounded border border-slate-200">E</kbd>
          </button>
        </div>

        {/* Round brush preview */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500">Round brush</span>
          <div className="w-full h-14 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center p-2 overflow-hidden">
            <canvas ref={previewCanvasRef} width={280} height={40} className="w-full h-full" />
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Size</span>
              <span className="font-mono text-slate-500 font-medium">{size} px</span>
            </div>
            <input
              type="range"
              min="2"
              max="60"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-brand-purple"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Opacity</span>
              <span className="font-mono text-slate-500 font-medium">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="w-full accent-brand-purple"
            />
          </div>
        </div>

        {/* Stabilizer Toggle */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-purple" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Stabilizer</span>
                <span className="text-[10px] text-slate-400 block">Smoother, steadier strokes</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={stabilizerEnabled}
                onChange={(e) => setStabilizerEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-purple"></div>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(stabilizerAmount * 100)}
              onChange={(e) => setStabilizerAmount(Number(e.target.value) / 100)}
              className="w-full accent-brand-purple"
            />
            <span className="text-xs font-mono font-medium text-slate-500 w-8 text-right">
              {Math.round(stabilizerAmount * 100)}%
            </span>
          </div>
        </div>

        {/* Color Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">Color</span>
            <span className="text-slate-400 font-medium">Custom</span>
          </div>

          <div className="relative h-24 rounded-2xl overflow-hidden cursor-crosshair border border-slate-200">
            <div className="w-full h-full bg-gradient-to-r from-blue-600 via-brand-purple to-pink-500" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/40" />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-brand-purple">
              <span className="text-xs font-mono text-slate-400 mr-2">#</span>
              <input
                type="text"
                value={color.replace('#', '').toUpperCase()}
                onChange={(e) => {
                  const hex = '#' + e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                  setColor(hex);
                }}
                className="w-full bg-transparent text-xs font-mono font-bold uppercase text-slate-800 focus:outline-none"
              />
              <div
                className="w-4 h-4 rounded-full border border-slate-200 shrink-0 ml-1"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="w-20 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input type="text" value="100%" className="w-full bg-transparent text-xs font-mono font-medium text-slate-600 focus:outline-none" readOnly />
            </div>
          </div>

          {/* Saved Colors */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-400">Saved colors</span>
            <div className="flex items-center gap-2.5 flex-wrap">
              {savedColors.map((col) => (
                <button
                  key={col}
                  onClick={() => setColor(col)}
                  className={`w-6 h-6 rounded-full transition ${
                    color.toUpperCase() === col.toUpperCase()
                      ? 'ring-2 ring-offset-2 ring-brand-purple scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
              <button className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-500 transition text-xs font-bold">
                +
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${tool === 'pen' ? 'bg-brand-purple' : 'bg-rose-500'}`} />
          <span>
            <strong className="font-mono">{tool === 'pen' ? 'B' : 'E'}</strong> {tool === 'pen' ? 'Paint is active' : 'Eraser is active'}
          </span>
        </span>
        <button onClick={onReset} className="text-slate-400 hover:text-slate-700 font-semibold transition">
          Reset
        </button>
      </div>
    </aside>
  );
}
