/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Landmark,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { apiRequest } from '../lib/apiClient';
import { NIGERIAN_BANK_CODES } from '../data';
import { Transaction, UserProfile } from '../types';

interface WithdrawalFormProps {
  profile: UserProfile;
  onSuccess: (updatedProfile: UserProfile, tx: Transaction) => void;
  openProfile: () => void;
}

export default function WithdrawalForm({ profile, onSuccess, openProfile }: WithdrawalFormProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ reference: string; provider: string; amount: number } | null>(null);

  const hasBank = Boolean(
    profile.bankDetails?.accountNumber &&
      profile.bankDetails?.bankName &&
      profile.bankDetails?.accountName &&
      profile.bankConfirmed
  );

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setReceipt(null);

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 100) {
      setError('Minimum withdrawal is ₦100.');
      return;
    }
    if (amt > profile.cashBalance) {
      setError('Insufficient wallet balance.');
      return;
    }
    if (!hasBank) {
      setError('Verify and confirm your Nigerian bank account in Verification Center first.');
      return;
    }

    setLoading(true);
    const bankCode = profile.bankDetails.bankCode || NIGERIAN_BANK_CODES[profile.bankDetails.bankName] || '';
    const res = await apiRequest<{ reference?: string; provider?: string }>('/api/bank/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount: amt,
        accountNumber: profile.bankDetails.accountNumber,
        bankCode,
      }),
    });
    setLoading(false);

    if (!res.ok || !res.data?.status) {
      setError(res.data?.message || 'Bank payout provider declined or is not configured.');
      return;
    }

    const nextBalance = Math.max(0, profile.cashBalance - amt);
    const newTx: Transaction = {
      id: res.data.reference || `WD-${Date.now()}`,
      userId: profile.uid,
      type: 'withdrawal',
      amount: amt,
      receivedAmount: amt,
      networkOrIsp: res.data.provider || profile.bankDetails.bankName,
      referenceDetails: `${profile.bankDetails.accountName} • ${profile.bankDetails.accountNumber}`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'users', profile.uid), { cashBalance: nextBalance }).catch(() => {});
      await addDoc(collection(db, 'transactions'), newTx).catch(() => {});
    } catch {
      // Backend SQLite ledger already completed payout
    }

    setReceipt({
      reference: newTx.id,
      provider: res.data.provider || 'Bank Transfer',
      amount: amt,
    });
    setAmount('');
    onSuccess({ ...profile, cashBalance: nextBalance }, newTx);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6" id="withdrawal-form-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Verified Bank Payout</h3>
            <p className="text-xs text-slate-400">
              Live NUBAN transfers routed through Paystack or Flutterwave APIs — zero fake payouts.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400 block">Available Balance</span>
          <span className="text-lg font-bold font-mono tabular-nums text-emerald-400">
            ₦{profile.cashBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {!hasBank ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              No verified and confirmed Nigerian bank account linked yet. Verify your NUBAN account holder name first.
            </span>
          </div>
          <button
            type="button"
            onClick={openProfile}
            className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 shrink-0"
          >
            Verify Bank Account
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-white">{profile.bankDetails.accountName}</p>
              <p className="text-[11px] font-mono text-slate-400">
                {profile.bankDetails.bankName} • {profile.bankDetails.accountNumber}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {receipt && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> Payout Dispatched via {receipt.provider}
          </p>
          <p className="font-mono">
            Amount: ₦{receipt.amount.toLocaleString()} • Ref: {receipt.reference}
          </p>
        </div>
      )}

      <form onSubmit={handleWithdraw} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Withdrawal Amount (₦)</label>
          <input
            type="number"
            min={100}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Minimum ₦100"
            className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-4 font-mono text-base text-white focus:border-amber-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !hasBank}
          className="w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Initiate Live Bank Transfer
        </button>
      </form>
    </div>
  );
}
