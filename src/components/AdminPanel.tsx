import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaction } from '../types';
import { Landmark, Shield, RefreshCw, TrendingUp, AlertCircle, CheckCircle2, DollarSign, Building, Settings, Sparkles } from 'lucide-react';
import { NIGERIAN_BANK_CODES } from '../data';

interface AdminPanelProps {
  profile: UserProfile;
  theme?: string;
  onUpdate?: (profile: UserProfile) => void;
}

export default function AdminPanel({ profile, theme, onUpdate }: AdminPanelProps) {
  const [adminRevenue, setAdminRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawStep, setWithdrawStep] = useState<'form' | 'processing' | 'success'>('form');
  const [withdrawError, setWithdrawError] = useState('');
  const [handshakeLogs, setHandshakeLogs] = useState<string[]>([]);
  
  // Security Reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  const [bankName, setBankName] = useState(profile.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(profile.bankDetails?.accountNumber || '');
  const [accountName, setAccountName] = useState(profile.bankDetails?.accountName || '');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    fetchAdminRevenue();
  }, [profile.uid]);

  const fetchAdminRevenue = async () => {
    setLoading(true);
    try {
      const revDocRef = doc(db, 'admin_settings', 'revenue_ledger');
      const revSnap = await getDoc(revDocRef);
      if (revSnap.exists()) {
        setAdminRevenue(revSnap.data().totalRevenue || 0);
      } else {
        // Initialize at 0
        await setDoc(revDocRef, { totalRevenue: 0 });
        setAdminRevenue(0);
      }
    } catch (err) {
      console.error('Error fetching admin revenue:', err);
    } finally {
      setLoading(false);
    }
  };

  const resolveBankAccount = async () => {
    if (!accountNumber || accountNumber.length !== 10) {
      setWithdrawError('Account number must be exactly 10 digits.');
      return;
    }
    if (!bankName) {
      setWithdrawError('Please select your settlement bank.');
      return;
    }

    setIsResolving(true);
    setWithdrawError('');
    try {
      const bankCode = NIGERIAN_BANK_CODES[bankName];
      const res = await fetch('/api/paystack/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode })
      });
      const data = await res.json();
      if (data.status) {
        setAccountName(data.accountName);
      } else {
        setWithdrawError(data.message || 'Could not resolve account name. Check details.');
      }
    } catch (err: any) {
      setWithdrawError(err.message || 'Verification endpoint unavailable.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleOwnerWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawValue = parseFloat(withdrawAmount);

    if (!withdrawAmount || isNaN(withdrawValue) || withdrawValue <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount.');
      return;
    }

    if (withdrawValue > adminRevenue) {
      setWithdrawError(`Insufficient programmatic ad revenue balance! Available is ₦${adminRevenue.toLocaleString()}`);
      return;
    }

    if (!bankName || !accountNumber || !accountName) {
      setWithdrawError('Please complete your bank details and verify first.');
      return;
    }

    setWithdrawError('');
    setWithdrawStep('processing');
    setHandshakeLogs(['Initiating bank transfer for ad earnings...']);

    try {
      const bankCode = NIGERIAN_BANK_CODES[bankName];
      setHandshakeLogs(prev => [...prev, 'Connecting with payment provider...']);

      const response = await fetch('/api/paystack/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber,
          bankCode,
          amount: withdrawValue,
          accountName
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || 'Transfer was declined.');
      }

      setHandshakeLogs(prev => [
        ...prev,
        `Bank transfer approved. Reference: ${resData.data?.recipient_code || 'REF_approved'}`,
        `Transfer of ₦${withdrawValue.toLocaleString()} has been sent to ${bankName}!`,
        `Earnings balance updated successfully.`
      ]);

      // Update global owner revenue in Firestore
      const newRevenue = adminRevenue - withdrawValue;
      const revDocRef = doc(db, 'admin_settings', 'revenue_ledger');
      await updateDoc(revDocRef, { totalRevenue: newRevenue });
      setAdminRevenue(newRevenue);

      setWithdrawStep('success');
    } catch (err: any) {
      setWithdrawError(err.message || 'Transfer timed out or failed.');
      setWithdrawStep('form');
    }
  };

  const handleResetAllBalances = async () => {
    setResetting(true);
    setResetSuccess(false);
    setResetError('');
    setShowResetConfirm(false);
    try {
      const usersCol = collection(db, 'users');
      const usersSnap = await getDocs(usersCol);
      
      const batch = writeBatch(db);
      usersSnap.docs.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          cashBalance: 0,
          airtimeBalance: 0,
          accumulatedTrafficCash: 0,
          totalDataStreamedMB: 0
        });
      });
      
      await batch.commit();
      
      // If the current logged-in user is updated, let's update their local state too
      if (onUpdate) {
        const updatedProfile: UserProfile = {
          ...profile,
          cashBalance: 0,
          airtimeBalance: 0,
          accumulatedTrafficCash: 0,
          totalDataStreamedMB: 0
        };
        onUpdate(updatedProfile);
      }
      
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error resetting balances:", err);
      setResetError(err.message || "Failed to reset wallet balances.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={`border rounded-3xl p-6 shadow-sm relative overflow-hidden transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 border-slate-200' 
        : theme === 'cyber'
        ? 'bg-zinc-950 border-emerald-500/35 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
        : theme === 'ai'
        ? 'bg-[#0B061A]/95 border-purple-500/35 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
        : 'bg-slate-900 border-slate-800 text-slate-200'
    }`} id="owner-admin-panel">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl border border-amber-100 dark:border-amber-900/30">
            <Shield size={22} />
          </div>
          <div>
            <h3 className="font-bold font-display text-slate-800 dark:text-white text-lg">Admin Earnings Dashboard</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">Manage platform ad earnings and payouts</p>
          </div>
        </div>
        <button 
          onClick={fetchAdminRevenue}
          disabled={loading}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Stats Column */}
        <div className="space-y-4 md:col-span-1">
          <div className="p-5 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl text-white shadow-md relative overflow-hidden">
            <div className="absolute right-4 top-4 opacity-10">
              <TrendingUp size={64} />
            </div>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-85">Total Ad Earnings</p>
            <p className="text-2xl font-bold font-mono mt-3">
              ₦{adminRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] mt-4 opacity-90 leading-relaxed">
              Revenue generated from platform activity and sponsored partner rewards.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-2">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Account Status</p>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{profile.email} (Administrator)</span>
            </div>
          </div>
        </div>

        {/* Right Settlement Form Column */}
        <div className="md:col-span-2 bg-white dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-150 dark:border-slate-850">
          <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-4 flex items-center gap-2">
            <Landmark size={16} className="text-amber-500" /> Bank Account Withdrawal
          </h4>

          {withdrawStep === 'form' && (
            <form onSubmit={handleOwnerWithdrawal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Destination Bank</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">Select bank...</option>
                    {Object.keys(NIGERIAN_BANK_CODES).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Account Number (10 digits)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={resolveBankAccount}
                      disabled={isResolving}
                      className="px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-[10px] transition cursor-pointer"
                    >
                      {isResolving ? <RefreshCw size={12} className="animate-spin" /> : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>

              {accountName && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                    ACCOUNT NAME: {accountName}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Withdrawal Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">₦</span>
                  <input
                    type="number"
                    required
                    min="100"
                    placeholder="Enter amount to withdraw"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {withdrawError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{withdrawError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!accountName || !withdrawAmount}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-55"
              >
                <Sparkles size={14} />
                Withdraw to Bank Account
              </button>
            </form>
          )}

          {withdrawStep === 'processing' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <RefreshCw size={18} className="animate-spin text-amber-500" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Processing bank transfer...</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl text-[10px] font-mono text-emerald-400 border border-slate-850 space-y-1 h-[140px] overflow-y-auto">
                {handshakeLogs.map((log, idx) => (
                  <p key={idx}>{log}</p>
                ))}
              </div>
            </div>
          )}

          {withdrawStep === 'success' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h5 className="font-bold text-slate-800 dark:text-white text-sm">Transfer Dispatched!</h5>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 leading-normal max-w-sm mx-auto">
                  ₦{parseFloat(withdrawAmount).toLocaleString()} has been sent to your bank account.
                </p>
              </div>
              <button
                onClick={() => {
                  setWithdrawStep('form');
                  setWithdrawAmount('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Platform Security & Ledger Auditing */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-100 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Shield className="text-rose-500 animate-pulse" size={16} /> Administrative Actions
            </h4>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Reset system data and user balances. Please use with caution.
            </p>
          </div>
          
          <div className="w-full sm:w-auto relative">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full sm:w-auto px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg shadow-rose-600/10 cursor-pointer"
                id="btn-admin-reset-confirm-trigger"
              >
                Reset All Wallet Balances
              </button>
            ) : (
              <div className="flex flex-col gap-2 p-1 bg-white dark:bg-slate-900 border border-rose-500/30 rounded-xl shadow-xl max-w-xs sm:absolute sm:right-0 sm:bottom-0 sm:z-10 w-64 text-left">
                <div className="p-3 text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Are you absolutely sure?</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    This resets cash, SIM airtime, traffic rewards, and streaming logs of <strong>all registered users</strong> to ₦0.
                  </p>
                </div>
                <div className="flex border-t border-slate-150 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-bl-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={handleResetAllBalances}
                    className="flex-1 py-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-br-xl transition border-l border-slate-150 dark:border-slate-800 flex items-center justify-center gap-1"
                  >
                    {resetting ? <RefreshCw size={10} className="animate-spin" /> : null}
                    {resetting ? 'Resetting...' : 'Yes, Reset All'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {resetSuccess && (
          <p className="text-xs font-bold text-emerald-600 mt-3 flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 size={14} /> System reset completed. All user balances and sharing statistics have been reset to ₦0.00.
          </p>
        )}
        {resetError && (
          <p className="text-xs font-bold text-rose-600 mt-3 flex items-center gap-1.5 animate-fadeIn">
            <AlertCircle size={14} /> {resetError}
          </p>
        )}
      </div>
    </div>
  );
}
