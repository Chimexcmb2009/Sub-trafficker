import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, RotateCw, Maximize2, X, ShieldAlert } from 'lucide-react';

interface MobileGameModePromptProps {
  onFullscreenRequest?: () => void;
}

export default function MobileGameModePrompt({ onFullscreenRequest }: MobileGameModePromptProps) {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 820 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsPortraitMobile(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortraitMobile || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-4 right-4 z-50 bg-slate-950/95 backdrop-blur-xl border border-rose-500/60 p-4 rounded-3xl shadow-2xl shadow-rose-950/60 flex items-center justify-between gap-4 text-white"
      >
        <div className="flex items-center gap-3.5">
          {/* Animated Phone Rotation Icon */}
          <div className="w-12 h-12 bg-rose-950/90 border border-rose-500/80 rounded-2xl flex items-center justify-center shrink-0">
            <motion.div
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            >
              <Smartphone size={24} className="text-rose-400" />
            </motion.div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-400 tracking-wider">
              <RotateCw size={13} className="animate-spin" />
              <span>GAME MODE: TILT PHONE</span>
            </div>
            <p className="text-[11px] text-slate-300 max-w-xs">
              Rotate your phone sideways to Landscape for maximum field-of-view & dual thumb trigger controls!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onFullscreenRequest && (
            <button
              type="button"
              onClick={() => {
                onFullscreenRequest();
                setDismissed(true);
              }}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1 cursor-pointer shrink-0"
              title="Fullscreen Game"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Dismiss Notice"
          >
            <X size={18} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
