import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Play, ShieldCheck, Video } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { apiRequest } from '../lib/apiClient';
import { UserProfile } from '../types';

interface AdWatcherProps {
  profile: UserProfile;
  onAdCompleted: (updatedProfile: UserProfile) => void;
  theme?: string;
}

const AD_VIDEO_SOURCES = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
];

export default function AdWatcher({ profile, onAdCompleted }: AdWatcherProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [videoUrl, setVideoUrl] = useState(AD_VIDEO_SOURCES[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!sessionId || remainingSec <= 0) return;
    const t = setInterval(() => setRemainingSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [sessionId, remainingSec]);

  const handleStartAd = async () => {
    setBusy(true);
    setMessage(null);
    const res = await apiRequest<{ sessionId: string; minDwellSeconds: number }>('/api/rewards/start-session', {
      method: 'POST',
      body: JSON.stringify({ campaignId: 'camp_esports_showcase' }),
    });
    setBusy(false);

    if (!res.ok || !res.data?.status) {
      setMessage({ ok: false, text: res.data?.message || 'Daily sponsored video reward limit reached.' });
      return;
    }

    setVideoUrl(AD_VIDEO_SOURCES[Math.floor(Math.random() * AD_VIDEO_SOURCES.length)]);
    setSessionId(res.data.sessionId);
    setRemainingSec(res.data.minDwellSeconds);
  };

  const handleClaim = async () => {
    if (!sessionId || remainingSec > 0) return;
    setBusy(true);
    const res = await apiRequest<{ rewardNgn: number; user: any }>('/api/rewards/claim', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        attestation: 'Completed sponsored media showcase viewing',
      }),
    });
    setBusy(false);

    if (!res.ok || !res.data?.status) {
      setMessage({ ok: false, text: res.data?.message || 'Could not validate ad reward.' });
      return;
    }

    const nextCash = Number(res.data.user?.cashBalanceNgn ?? profile.cashBalance + (res.data.rewardNgn || 20));
    await updateDoc(doc(db, 'users', profile.uid), { cashBalance: nextCash }).catch(() => {});
    setSessionId(null);
    setMessage({ ok: true, text: res.data.message || 'Sponsored media reward credited.' });
    onAdCompleted({ ...profile, cashBalance: nextCash });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5" id="ad-watcher-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Sponsored Video Showcase</h3>
            <p className="text-xs text-slate-400">
              Backend-validated sponsored media viewing with duplicate-claim protection (₦20/day).
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5" /> Server Validated
        </span>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-center gap-2 ${
            message.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {sessionId ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-black aspect-video">
            <video src={videoUrl} autoPlay muted controls playsInline className="w-full h-full object-cover" />
          </div>
          <button
            type="button"
            onClick={handleClaim}
            disabled={busy || remainingSec > 0}
            className="w-full min-h-[48px] rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : remainingSec > 0 ? (
              <>
                <Clock className="w-4 h-4" /> Verify View Duration ({remainingSec}s)...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Claim Verified ₦20.00 Reward
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStartAd}
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Launch Sponsored Video Session
        </button>
      )}
    </div>
  );
}
