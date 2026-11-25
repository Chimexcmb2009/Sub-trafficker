/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import { db } from '../firebase';
import { NIGERIAN_ISPS } from '../data';
import { ISPName, Transaction, UserProfile } from '../types';
import { validatePhoneNumberForIsp } from '../utils/phoneValidator';

interface AirtimeConverterProps {
  profile: UserProfile;
  onSuccess: (updatedProfile: UserProfile, tx: Transaction) => void;
}

export default function AirtimeConverter({ profile, onSuccess }: AirtimeConverterProps) {
  const [selectedIspName, setSelectedIspName] = useState<ISPName>(profile.isp || 'MTN');
  const [amount, setAmount] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>(profile.phone || '');
  const [allowMnpOverride, setAllowMnpOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [error, setError] = useState('');

  const selectedIsp = NIGERIAN_ISPS.find((i) => i.name === selectedIspName) || NIGERIAN_ISPS[0];
  const ratePercent = Math.round(selectedIsp.rate * 100);
  const parsedAmount = parseFloat(amount) || 0;
  const calculatedPayout = parsedAmount * selectedIsp.rate;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessTx(null);

    if (!parsedAmount || parsedAmount < 500) {
      setError('Minimum conversion amount is ₦500.');
      return;
    }

    const validation = validatePhoneNumberForIsp(senderPhone, selectedIspName, allowMnpOverride);
    if (!validation.isValid) {
      setError(validation.error || 'Enter a valid Nigerian phone number.');
      return;
    }

    const currentAirtime = Number(profile.airtimeBalance || 0);
    if (parsedAmount > currentAirtime) {
      setError(`Insufficient airtime balance (₦${currentAirtime.toLocaleString()} available).`);
      return;
    }

    setLoading(true);
    try {
      const newCashBalance = profile.cashBalance + calculatedPayout;
      const newAirtimeBalance = currentAirtime - parsedAmount;

      await updateDoc(doc(db, 'users', profile.uid), {
        cashBalance: newCashBalance,
        airtimeBalance: newAirtimeBalance,
      });

      const txId = `TXN-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: profile.uid,
        type: 'airtime_convert',
        amount: parsedAmount,
        receivedAmount: calculatedPayout,
        networkOrIsp: selectedIsp.name,
        referenceDetails: senderPhone,
        status: 'completed',
        timestamp: new Date().toISOString(),
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setSuccessTx(newTx);
      setAmount('');
      onSuccess(
        {
          ...profile,
          cashBalance: newCashBalance,
          airtimeBalance: newAirtimeBalance,
        },
        newTx
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to save conversion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5" id="airtime-converter-panel">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Airtime to Cash Exchange</h3>
          <p className="text-xs text-slate-400">Supports MTN, Airtel, Glo, and 9mobile with MNP-aware prefix validation.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successTx && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Converted ₦{successTx.amount.toLocaleString()} ({successTx.networkOrIsp}) into ₦{successTx.receivedAmount.toLocaleString()}.
          </span>
        </div>
      )}

      <form onSubmit={handleConvert} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {NIGERIAN_ISPS.map((isp) => (
            <button
              key={isp.name}
              type="button"
              onClick={() => setSelectedIspName(isp.name)}
              className={`min-h-[54px] rounded-xl border px-3 py-2 flex flex-col items-center justify-center transition ${
                selectedIspName === isp.name
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-xs font-bold">{isp.name}</span>
              <span className="text-[11px] font-mono text-slate-400">{Math.round(isp.rate * 100)}%</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Airtime Amount (₦)</label>
            <input
              type="number"
              min={500}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Minimum ₦500"
              className="w-full min-h-[46px] rounded-xl border border-slate-700 bg-slate-950 px-4 font-mono text-sm text-white"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Sender Phone Number</label>
              <span className="text-[11px] font-mono text-amber-400">
                Available: ₦{(profile.airtimeBalance || 0).toLocaleString()}
              </span>
            </div>
            <input
              type="tel"
              required
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="0803... or +234..."
              className="w-full min-h-[46px] rounded-xl border border-slate-700 bg-slate-950 px-4 font-mono text-sm text-white"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={allowMnpOverride}
            onChange={(e) => setAllowMnpOverride(e.target.checked)}
            className="rounded border-slate-700"
          />
          This number was ported via Nigerian Mobile Number Portability (MNP) to {selectedIspName}.
        </label>

        {parsedAmount > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Net Cash Payout ({ratePercent}%)</p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                ₦{calculatedPayout.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Network Fee</p>
              <p className="text-xs font-mono text-red-400">
                -₦{(parsedAmount - calculatedPayout).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Processing...' : 'Convert Airtime Now'}
        </button>
      </form>
    </div>
  );
}
