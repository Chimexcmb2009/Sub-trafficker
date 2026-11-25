import React, { useEffect, useState } from 'react';
import { CheckCircle2, Crosshair, Download, HardDrive, ShieldCheck } from 'lucide-react';
import { assetManager, AssetCacheProgress } from '../../lib/assetManager';
import { bloodStrikeArtImg } from './fpsData';
import { fpsAudio } from './fpsAudio';

interface BootSplashScreenProps {
  onComplete: () => void;
}

export default function BootSplashScreen({ onComplete }: BootSplashScreenProps) {
  const [phase, setPhase] = useState<'intro' | 'caching'>('intro');
  const [progressInfo, setProgressInfo] = useState<AssetCacheProgress>({
    packId: '',
    packName: 'Core Tactical Assets',
    loadedBytes: 0,
    totalBytes: 1,
    completedPacks: 0,
    totalPacks: 3,
    fromCache: false,
    phase: 'checking',
    detail: 'Inspecting local IndexedDB & Cache Storage...',
  });

  useEffect(() => {
    fpsAudio.playBootChime();
    const t = setTimeout(() => setPhase('caching'), 750);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 'caching') return;
    let active = true;

    assetManager
      .ensureBootAssets((info) => {
        if (active) setProgressInfo(info);
      })
      .then(() => {
        if (!active) return;
        setTimeout(() => {
          if (active) onComplete();
        }, 320);
      })
      .catch(() => {
        if (active) onComplete();
      });

    return () => {
      active = false;
    };
  }, [phase, onComplete]);

  const pct =
    progressInfo.totalPacks > 0
      ? Math.min(
          100,
          Math.round(
            ((progressInfo.completedPacks +
              Math.min(1, progressInfo.loadedBytes / Math.max(1, progressInfo.totalBytes)) * 0.85) /
              progressInfo.totalPacks) *
              100
          )
        )
      : 100;

  return (
    <div className="fixed inset-0 bg-[#070B12] text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden z-50">
      <div className="absolute inset-0 z-0">
        <img
          src={bloodStrikeArtImg}
          alt="Blood Strike Arena"
          className="w-full h-full object-cover opacity-25 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B12] via-[#070B12]/70 to-transparent" />
      </div>

      <div className="relative z-10 flex items-center justify-between text-xs font-mono text-slate-400">
        <span className="inline-flex items-center gap-2 text-emerald-400 font-semibold">
          <HardDrive className="w-4 h-4" />
          IndexedDB Local Asset Pipeline
        </span>
        <span>Manifest v2.4.0</span>
      </div>

      <div className="relative z-10 text-center space-y-3 my-auto max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-semibold">
          <Crosshair className="w-4 h-4" />
          Tactical 3D Combat Arena
        </div>
        <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white">
          BLOOD STRIKE
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          Hardware-adaptive WebGL2 arena with multi-touch mobile controls, pooled projectiles, and locally cached 3D packs.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto space-y-2.5 bg-slate-950/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-400 font-semibold truncate">
            {progressInfo.phase === 'ready' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{progressInfo.detail}</span>
          </div>
          <span className="font-bold text-white tabular-nums shrink-0">{pct}%</span>
        </div>

        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {progressInfo.fromCache ? 'Verified in Local Cache' : 'Caching SHA-256 Verified Assets'}
          </span>
          <span>
            Pack {Math.min(progressInfo.completedPacks + 1, progressInfo.totalPacks)} / {progressInfo.totalPacks}
          </span>
        </div>
      </div>
    </div>
  );
}
