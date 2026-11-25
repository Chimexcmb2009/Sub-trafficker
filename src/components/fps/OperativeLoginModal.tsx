import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Shield, Zap, Sparkles, Dice5, CheckCircle2, Award, Crosshair } from 'lucide-react';
import { FpsProfile } from '../../types';
import { fpsAudio } from './fpsAudio';

interface OperativeLoginModalProps {
  currentProfile?: FpsProfile | null;
  defaultName?: string;
  onSaveProfile: (nickname: string, isGuest: boolean) => void;
}

const RANDOM_NAMES = [
  'Vanguard_Apex',
  'Ghost_Striker',
  'Shadow_Sniper_99',
  'Cyber_Reaper_X',
  'Blood_Titan_01',
  'Spectre_Ops',
  'Chimex_Falcon',
  'Nova_Warrior',
  'Delta_Havoc',
  'Raven_Fury_77'
];

export default function OperativeLoginModal({
  currentProfile,
  defaultName = '',
  onSaveProfile
}: OperativeLoginModalProps) {
  const [nickname, setNickname] = useState(
    currentProfile?.username || defaultName || RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
  );
  const [error, setError] = useState('');

  const generateRandomName = () => {
    const picked = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    setNickname(`${picked}_${num}`);
    fpsAudio.playHitmarker();
  };

  const handleConfirm = (isGuest: boolean) => {
    const clean = nickname.trim();
    if (!clean) {
      setError('Please enter a valid codename');
      return;
    }
    if (clean.length < 3) {
      setError('Codename must be at least 3 characters');
      return;
    }
    fpsAudio.playVictorySound();
    onSaveProfile(clean, isGuest);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/40 relative overflow-hidden space-y-6"
      >
        {/* Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-rose-600 to-red-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Crosshair size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-black uppercase text-white tracking-wide">
            OPERATIVE REGISTRATION
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Enter your combat codename to access the Vanguard Warzone Syndicate & Cloud Database
          </p>
        </div>

        {/* Nickname Input */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>OPERATIVE CODENAME</span>
            <span className="text-rose-400">Required</span>
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError('');
                }}
                maxLength={20}
                placeholder="e.g. Apex_Ghost_99"
                className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-2xl px-4 py-3.5 text-white font-mono font-bold text-sm tracking-wide focus:outline-none transition"
              />
            </div>

            <button
              type="button"
              onClick={generateRandomName}
              className="px-4 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-2xl text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
              title="Generate Random Tactical Codename"
            >
              <Dice5 size={18} className="text-rose-400" />
            </button>
          </div>

          {error && <p className="text-xs text-rose-500 font-mono">{error}</p>}
        </div>

        {/* Rank & Stats Preview */}
        <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <Award size={20} className="text-amber-400" />
            <div>
              <div className="font-bold text-white">RECRUIT LEVEL 1</div>
              <div className="text-[10px] text-slate-400">Vanguard Syndicate Pass</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-emerald-400 font-bold">1,000 CREDITS</div>
            <div className="text-[10px] text-slate-400">Free Bonus Starting Cache</div>
          </div>
        </div>

        {/* Dual Login Buttons: Guest vs Cloud Database Account */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-rose-600/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield size={16} />
            <span>SYNC OPERATIVE ACCOUNT (DATABASE)</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirm(true)}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <User size={15} />
            <span>PLAY AS GUEST OPERATIVE</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
