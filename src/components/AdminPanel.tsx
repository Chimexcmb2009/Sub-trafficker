import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { UserProfile } from '../types';

interface AdminPanelProps {
  profile: UserProfile;
  theme?: string;
  onUpdate?: (profile: UserProfile) => void;
}

export default function AdminPanel({ profile }: AdminPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<{
    ledger?: { total_ad_revenue_ngn: number; total_payouts_ngn: number; updated_at: string };
    userStats?: {
      totalUsers: number;
      emailVerifiedUsers: number;
      faceVerifiedUsers: number;
      bankVerifiedUsers: number;
      totalUserCashNgn: number;
    };
  } | null>(null);
  const [configHealth, setConfigHealth] = useState<Record<string, boolean>>({});
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const loadAdminOverview = async () => {
    setLoading(true);
    setError('');
    const [adminRes, cfgRes] = await Promise.all([
      apiRequest<any>('/api/admin/overview'),
      apiRequest<Record<string, boolean>>('/api/config-check'),
    ]);
    setLoading(false);

    if (cfgRes.ok) {
      setConfigHealth(cfgRes.data);
    }
    if (!adminRes.ok || !adminRes.data?.status) {
      setError(adminRes.data?.message || 'Admin privileges required.');
      return;
    }
    setOverview({ ledger: adminRes.data.ledger, userStats: adminRes.data.userStats });
  };

  useEffect(() => {
    loadAdminOverview();
  }, [profile.uid]);

  const handleResetServerBalances = async () => {
    setResetting(true);
    setResetMsg('');
    const res = await apiRequest('/api/admin/reset-balances', { method: 'POST', body: JSON.stringify({}) });
    setResetting(false);
    setResetConfirm(false);
    if (res.ok && res.data?.status) {
      setResetMsg(res.data.message || 'Server balances reset.');
      await loadAdminOverview();
    } else {
      setError(res.data?.message || 'Failed to reset balances.');
    }
  };

  if (loading) {
    return <div className="h-64 rounded-2xl skeleton-shimmer border border-slate-800" />;
  }

  return (
    <div className="space-y-6" id="admin-panel">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Owner Operations Console</h2>
            <p className="text-xs text-slate-400">
              Restricted exclusively to verified owner administrator ({profile.email}).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadAdminOverview}
          className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700 inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {resetMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{resetMsg}</span>
        </div>
      )}

      {overview?.userStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Platform Ad Share</p>
            <p className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
              ₦{Number(overview.ledger?.total_ad_revenue_ngn || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Registered Users</p>
            <p className="text-xl font-bold font-mono tabular-nums text-white mt-1">
              {overview.userStats.totalUsers || 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Email / Face Verified</p>
            <p className="text-xl font-bold font-mono tabular-nums text-amber-400 mt-1">
              {overview.userStats.emailVerifiedUsers || 0} / {overview.userStats.faceVerifiedUsers || 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Liability Pool (Users)</p>
            <p className="text-xl font-bold font-mono tabular-nums text-slate-200 mt-1">
              ₦{Number(overview.userStats.totalUserCashNgn || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Provider Integration Readiness */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" /> Live Provider Secrets Readiness
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {[
            ['Email OTP (Resend/SMTP)', configHealth.emailProviderConfigured],
            ['SMS OTP & HLR (Termii/Twilio)', configHealth.smsProviderConfigured],
            ['Face Verification (Dojah/Face++)', configHealth.faceProviderConfigured],
            ['Nigerian Banks (Paystack/FLW/Monnify)', configHealth.bankProviderConfigured],
            ['Gemini AI Assistant', configHealth.geminiConfigured],
          ].map(([label, ready]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 flex items-center justify-between"
            >
              <span className="text-slate-300">{label}</span>
              <span className={`font-semibold ${ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ready ? 'Configured' : 'Missing Key'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Balance Reset */}
      <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 space-y-3">
        <h3 className="text-sm font-bold text-red-300 flex items-center gap-2">
          <Database className="w-4 h-4" /> Ledger Maintenance
        </h3>
        <p className="text-xs text-slate-400">
          Reset server-side SQLite cash and airtime balances across test accounts. Protected by server admin middleware.
        </p>
        {!resetConfirm ? (
          <button
            type="button"
            onClick={() => setResetConfirm(true)}
            className="min-h-[44px] rounded-xl border border-red-500/40 bg-red-500/15 px-4 text-xs font-bold text-red-200 hover:bg-red-500/25"
          >
            Reset Server Ledger Balances
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetServerBalances}
              disabled={resetting}
              className="min-h-[44px] rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-500 inline-flex items-center gap-2"
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setResetConfirm(false)}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
