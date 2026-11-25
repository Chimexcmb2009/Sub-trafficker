/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { apiRequest } from '../lib/apiClient';
import { Transaction, UserProfile } from '../types';

interface Campaign {
  id: string;
  title: string;
  sponsor_name: string;
  category: string;
  description: string;
  revenue_model: string;
  reward_ngn: number;
  min_dwell_seconds: number;
  daily_limit: number;
  claimedToday: boolean;
}

interface TrafficStreamerProps {
  profile: UserProfile;
  onSuccess: (updatedProfile: UserProfile, tx: Transaction) => void;
}

export default function TrafficStreamer({ profile, onSuccess }: TrafficStreamerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [verifiedCash, setVerifiedCash] = useState<number>(profile.cashBalance || 0);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    campaign: Campaign;
    remainingSec: number;
  } | null>(null);
  const [attestation, setAttestation] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    const res = await apiRequest<{ campaigns: Campaign[]; verifiedCashBalanceNgn: number }>('/api/rewards/campaigns');
    setLoading(false);
    if (res.ok && res.data?.status) {
      setCampaigns(res.data.campaigns || []);
      if (typeof res.data.verifiedCashBalanceNgn === 'number') {
        setVerifiedCash(res.data.verifiedCashBalanceNgn);
      }
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (!activeSession || activeSession.remainingSec <= 0) return;
    const timer = setInterval(() => {
      setActiveSession((prev) =>
        prev ? { ...prev, remainingSec: Math.max(0, prev.remainingSec - 1) } : null
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession?.sessionId, activeSession?.remainingSec]);

  const handleStartCampaign = async (campaign: Campaign) => {
    setFeedback(null);
    setAttestation('');
    const res = await apiRequest<{ sessionId: string; minDwellSeconds: number }>('/api/rewards/start-session', {
      method: 'POST',
      body: JSON.stringify({ campaignId: campaign.id }),
    });
    if (!res.ok || !res.data?.status) {
      setFeedback({ ok: false, text: res.data?.message || 'Could not start sponsored campaign session.' });
      return;
    }
    setActiveSession({
      sessionId: res.data.sessionId,
      campaign,
      remainingSec: res.data.minDwellSeconds,
    });
  };

  const handleClaimReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || activeSession.remainingSec > 0) return;
    setClaiming(true);
    setFeedback(null);

    const res = await apiRequest<{ rewardNgn: number; claimId: string; user: any }>('/api/rewards/claim', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: activeSession.sessionId,
        attestation,
      }),
    });

    setClaiming(false);

    if (!res.ok || !res.data?.status) {
      setFeedback({ ok: false, text: res.data?.message || 'Reward claim validation failed.' });
      return;
    }

    const rewardNgn = Number(res.data.rewardNgn || 0);
    const nextBalance = Number(res.data.user?.cashBalanceNgn ?? profile.cashBalance + rewardNgn);
    const tx: Transaction = {
      id: res.data.claimId || `rc_${Date.now()}`,
      userId: profile.uid,
      type: 'traffic_cashout',
      amount: rewardNgn,
      receivedAmount: rewardNgn,
      networkOrIsp: activeSession.campaign.sponsor_name,
      referenceDetails: activeSession.campaign.title,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        cashBalance: nextBalance,
        accumulatedTrafficCash: (profile.accumulatedTrafficCash || 0) + rewardNgn,
      }).catch(() => {});
    } catch {
      // Server SQLite ledger already recorded reward atomically
    }

    setVerifiedCash(nextBalance);
    setActiveSession(null);
    setAttestation('');
    setFeedback({ ok: true, text: res.data.message || `Credited ₦${rewardNgn.toFixed(2)}.` });
    onSuccess({ ...profile, cashBalance: nextBalance }, tx);
    await loadCampaigns();
  };

  return (
    <div className="space-y-6" id="traffic-streamer-panel">
      {/* Business & Technical Disclosure Banner */}
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 space-y-2">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white">
              Sponsored Traffic &amp; Engagement Rewards (Rebuilt Model)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Raw background browser downloads do not generate real cash—no advertiser pays for wasted mobile data, web browsers cannot legally act as hidden proxy exit nodes, and carrier NATs/ISP terms prohibit unauthorized traffic resale. Instead, this hub pays transparent, backend-validated NGN rewards funded strictly by verified sponsor campaigns, compliance briefings, and telecom surveys.
            </p>
          </div>
        </div>
      </div>

      {/* Wallet & Rules Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs text-slate-400">Server-Verified Cash Wallet</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            ₦{verifiedCash.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs text-slate-400">Anti-Fraud Protection</p>
          <p className="text-sm font-semibold text-white mt-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Unique Daily Claim Locks
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs text-slate-400">Available Sponsored Tasks</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
            {campaigns.filter((c) => !c.claimedToday).length} / {campaigns.length}
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-center gap-2.5 ${
            feedback.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Active Verified Dwell Session */}
      {activeSession && (
        <form
          onSubmit={handleClaimReward}
          className="rounded-2xl border border-amber-500/40 bg-slate-900 p-5 space-y-4 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Active Sponsored Session • {activeSession.campaign.sponsor_name}
              </span>
              <h4 className="text-base font-bold text-white mt-0.5">{activeSession.campaign.title}</h4>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-amber-300">
              <Clock className="w-4 h-4" />
              {activeSession.remainingSec > 0 ? `${activeSession.remainingSec}s remaining` : 'Ready to Claim'}
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{activeSession.campaign.description}</p>
          <p className="text-[11px] text-slate-400">Revenue Source: {activeSession.campaign.revenue_model}</p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Verification Summary (type a brief takeaway, min 3 chars)
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={attestation}
              onChange={(e) => setAttestation(e.target.value)}
              placeholder="e.g. Confirmed NUBAN verification & sponsor rules"
              className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveSession(null)}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={claiming || activeSession.remainingSec > 0 || attestation.trim().length < 3}
              className="min-h-[44px] flex-1 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              Claim Verified ₦{activeSession.campaign.reward_ngn.toFixed(2)} Reward
            </button>
          </div>
        </form>
      )}

      {/* Sponsored Campaigns List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 rounded-2xl skeleton-shimmer border border-slate-800" />
          <div className="h-44 rounded-2xl skeleton-shimmer border border-slate-800" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-amber-400">{c.sponsor_name}</span>
                  <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                    +₦{c.reward_ngn.toFixed(2)}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{c.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{c.description}</p>
                <p className="text-[11px] text-slate-500">{c.revenue_model}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-slate-400">Min dwell: {c.min_dwell_seconds}s • 1/day</span>
                <button
                  type="button"
                  disabled={c.claimedToday || Boolean(activeSession)}
                  onClick={() => handleStartCampaign(c)}
                  className={`min-h-[44px] rounded-xl px-4 text-xs font-bold inline-flex items-center gap-1.5 transition ${
                    c.claimedToday
                      ? 'border border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50'
                  }`}
                >
                  {c.claimedToday ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Claimed Today
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Start Task
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
