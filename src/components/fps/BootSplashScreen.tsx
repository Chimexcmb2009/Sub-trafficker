import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, Download, CheckCircle2, Flame, Crosshair } from 'lucide-react';
import { bloodStrikeArtImg } from './fpsData';
import { fpsAudio } from './fpsAudio';

interface BootSplashScreenProps {
  onComplete: () => void;
}

const ASSET_STEPS = [
  { text: 'Connecting to Vanguard Tactical Neural Network...', mb: '12.4 MB' },
  { text: 'Downloading High-Poly 3D Operative & Weapon Rigs...', mb: '45.8 MB' },
  { text: 'Compiling WebGL2 Shaders & Combat Physics...', mb: '78.2 MB' },
  { text: 'Caching Shutter Island & Desert Outpost NavMeshes...', mb: '112.5 MB' },
  { text: 'Streaming Soundbank & Zero-Latency Audio...', mb: '136.0 MB' },
  { text: 'Assets Verified! Launching Combat Arena...', mb: '154.2 MB' }
];

export default function BootSplashScreen({ onComplete }: BootSplashScreenProps) {
  const [phase, setPhase] = useState<'chimexxverse' | 'blood_strike_intro' | 'downloading'>('chimexxverse');
  const [progress, setProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('16.8 MB/s');

  // Sequence transitions
  useEffect(() => {
    // 1. Chimexxverse Intro
    fpsAudio.playBootChime();
    const t1 = setTimeout(() => {
      setPhase('blood_strike_intro');
    }, 1800);

    // 2. Blood Strike Intro
    const t2 = setTimeout(() => {
      setPhase('downloading');
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // 3. Asset Download Progress Simulation
  useEffect(() => {
    if (phase !== 'downloading') return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 8 + 4);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 600);
          return 100;
        }

        // Update step index based on progress
        const step = Math.min(
          ASSET_STEPS.length - 1,
          Math.floor((next / 100) * ASSET_STEPS.length)
        );
        setCurrentStepIdx(step);
        setDownloadSpeed(`${(14 + Math.random() * 6).toFixed(1)} MB/s`);
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [phase, onComplete]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center select-none overflow-hidden z-50 font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial from-rose-950/20 via-black to-black pointer-events-none" />

      {/* PHASE 1: CHIMEXXVERSE INTRO */}
      <AnimatePresence mode="wait">
        {phase === 'chimexxverse' && (
          <motion.div
            key="chimexxverse"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 0.7 }}
            className="flex flex-col items-center text-center space-y-4 px-6"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-[2px] shadow-2xl shadow-purple-600/40 animate-pulse">
              <div className="w-full h-full bg-black rounded-3xl flex items-center justify-center">
                <Sparkles size={36} className="text-cyan-400" />
              </div>
            </div>

            <div>
              <h1 className="text-4xl sm:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-cyan-400 uppercase">
                CHIMEXXVERSE
              </h1>
              <p className="text-xs sm:text-sm font-mono text-purple-300/80 tracking-widest uppercase mt-2">
                Interactive Gaming & WebGL Division
              </p>
            </div>
          </motion.div>
        )}

        {/* PHASE 2 & 3: BLOOD STRIKE LOGO & ASSET DOWNLOADER */}
        {(phase === 'blood_strike_intro' || phase === 'downloading') && (
          <motion.div
            key="blood_strike_intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full h-full flex flex-col justify-between p-6 sm:p-10"
          >
            {/* Background Key Art */}
            <div className="absolute inset-0 z-0">
              <img
                src={bloodStrikeArtImg}
                alt="Blood Strike Warzone"
                className="w-full h-full object-cover opacity-35 filter brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            </div>

            {/* Top Bar Status */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="text-[11px] font-mono tracking-wider text-rose-400 uppercase font-bold">
                  SERVER STATUS: ONLINE (REGION EU-WEST / NIGERIA 12ms)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">v4.2.0-ULTRA-HD</span>
            </div>

            {/* Center Logo & Title */}
            <div className="relative z-10 text-center space-y-3 my-auto max-w-2xl mx-auto">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-950/80 border border-rose-500/50 rounded-full text-rose-300 text-xs font-mono font-bold shadow-lg shadow-rose-900/30 uppercase tracking-widest"
              >
                <Flame size={14} className="text-rose-500 animate-bounce" />
                <span>AAA Tactical Battle Royale</span>
              </motion.div>

              <motion.h1
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl sm:text-7xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-rose-600 drop-shadow-[0_10px_20px_rgba(225,29,72,0.4)]"
              >
                BLOOD STRIKE
              </motion.h1>

              <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-md mx-auto">
                High-Octane Mobile Combat • 3D Tactical Jetpacks • Slide Firefights • Shutter Island Warzone
              </p>
            </div>

            {/* Bottom Asset Downloader Progress Bar */}
            <div className="relative z-10 w-full max-w-2xl mx-auto space-y-2.5 bg-slate-950/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <Download size={14} className="animate-bounce text-rose-500" />
                  <span>{ASSET_STEPS[currentStepIdx]?.text || 'Verifying Game Assets...'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="text-emerald-400 font-bold">{downloadSpeed}</span>
                  <span className="font-bold text-white text-sm">{progress}%</span>
                </div>
              </div>

              {/* Progress Line */}
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-[2px] border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 rounded-full transition-all duration-150 shadow-[0_0_12px_rgba(225,29,72,0.8)]"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Total Package: 154.2 MB</span>
                <span>{ASSET_STEPS[currentStepIdx]?.mb} downloaded</span>
                <span className="text-slate-400">FPS Engine: WebGL 3D 120 FPS</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
