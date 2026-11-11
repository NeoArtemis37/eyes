'use client';


import { useState, useEffect } from 'react';
import { Eye, Palette } from 'lucide-react';

type VisualMode = 'default' | 'satellite' | 'flir' | 'nvg' | 'crt';

const MODES: VisualMode[] = ['default', 'satellite', 'flir', 'nvg', 'crt'];

const MODE_LABELS: Record<VisualMode, string> = {
  default: 'DEFAULT',
  satellite: 'SATELLITE',
  flir: 'FLIR',
  nvg: 'NVG',
  crt: 'CRT',
};

const MODE_COLORS: Record<VisualMode, string> = {
  default: 'text-cyan-300 border-cyan-500/50 bg-cyan-500/15',
  satellite: 'text-blue-300 border-blue-500/50 bg-blue-500/15',
  flir: 'text-orange-300 border-orange-500/50 bg-orange-500/15',
  nvg: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/15',
  crt: 'text-fuchsia-300 border-fuchsia-500/50 bg-fuchsia-500/15',
};

export default function VisualModeToggle() {
  const [mode, setMode] = useState<VisualMode>('default');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('horus-visual-mode') : null) as VisualMode | null;
    if (saved && MODES.includes(saved)) {
      setMode(saved);
      document.documentElement.setAttribute('data-visual-mode', saved);
    }
  }, []);

  const applyMode = (m: VisualMode) => {
    setMode(m);
    document.documentElement.setAttribute('data-visual-mode', m);
    if (typeof window !== 'undefined') localStorage.setItem('horus-visual-mode', m);
    setOpen(false);
  };

  useEffect(() => {
    const onCmd = (e: Event) => {
      const m = (e as CustomEvent<VisualMode>).detail;
      if (m && MODES.includes(m)) applyMode(m);
    };
    window.addEventListener('horus:set-visual-mode', onCmd);
    return () => window.removeEventListener('horus:set-visual-mode', onCmd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1 border rounded text-[9px] font-mono font-bold tracking-wider transition-all ${MODE_COLORS[mode]} hover:shadow-[0_0_8px_currentColor]`}
        title="Visual mode (DEFAULT/SATELLITE/FLIR/NVG/CRT)"
      >
        <Palette className="w-3 h-3" />
        {MODE_LABELS[mode]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 glass-panel-strong rounded p-1 min-w-[120px]">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => applyMode(m)}
              className={`w-full text-left px-2 py-1 text-[9px] font-mono tracking-wider rounded transition-colors ${
                mode === m ? `${MODE_COLORS[m]} border` : 'text-cyan-700 hover:text-cyan-300 hover:bg-cyan-950/40'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
