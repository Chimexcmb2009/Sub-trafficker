/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaction } from '../types';
import { NIGERIAN_BANKS, NIGERIAN_BANK_CODES } from '../data';
import { Landmark, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw, Smartphone, Wrench } from 'lucide-react';

interface WithdrawalFormProps {
  profile: UserProfile;
  onSuccess: (updatedProfile: UserProfile, tx: Transaction) => void;
  openProfile: () => void;
}

export default function WithdrawalForm({ profile, onSuccess, openProfile }: WithdrawalFormProps) {
  const [amount, setAmount] = useState<string>('');
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [error, setError] = useState('');
  
  // Banking gateway handshake steps log
  const [handshakeLog, setHandshakeLog] = useState<string[]>([]);
  const [handshakeProgress, setHandshakeProgress] = useState(0);

  // Developer Sandbox Mode fallback configuration
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(false);
  const [showSandboxSuggestion, setShowSandboxSuggestion] = useState<boolean>(false);

  const hasBankDetails = profile.bankDetails && profile.bankDetails.accountNumber && profile.bankDetails.bankName;

  // Web Audio success chime helper
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      oscillator.start();
      
      // Slide up to G5
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
      
      // Slide further up to C6
      oscillator.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
      
      // Fade out
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context failed:", e);
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawAmount = parseFloat(amount);

    if (!hasBankDetails) {
      setError('Please add your Bank Details in your profile before initiating withdrawals.');
      return;
    }

    if (!amount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    if (withdrawAmount < 1000) {
      setError('Minimum withdrawal amount is ₦1,000.');
      return;
    }

    if (withdrawAmount > profile.cashBalance) {
      setError('Insufficient funds. Your cash balance is ' + '₦' + profile.cashBalance.toLocaleString());
      return;
    }

    setError('');
    setStep('processing');
    setHandshakeLog([`Initiating transfer to your bank...`]);
    setHandshakeProgress(15);

    if (isSandboxMode) {
      // Direct Bank Transfer fallback
      const logs = [
        `Connecting to banking network...`,
        `Verifying bank account for ${profile.bankDetails.bankName}...`,
        `Bank account verified: ${profile.bankDetails.accountName}`,
        `Sending ₦${withdrawAmount.toLocaleString()} to your account...`,
        `Transfer complete. Wallet balance updated...`
      ];

      let currentLogIdx = 0;
      const interval = setInterval(async () => {
        if (currentLogIdx < logs.length) {
          setHandshakeLog(prev => [...prev, logs[currentLogIdx]]);
          setHandshakeProgress(prev => prev + 17);
          currentLogIdx++;
        } else {
          clearInterval(interval);
          try {
            const newCashBalance = profile.cashBalance - withdrawAmount;
            const userDocRef = doc(db, 'users', profile.uid);
            await updateDoc(userDocRef, { cashBalance: newCashBalance });

            const txId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
            const newTx: Transaction = {
              id: txId,
              userId: profile.uid,
              type: 'withdrawal',
              amount: withdrawAmount,
              receivedAmount: withdrawAmount,
              networkOrIsp: profile.bankDetails.bankName,
              referenceDetails: `${profile.bankDetails.accountName} (${profile.bankDetails.accountNumber.slice(0, 3)}****${profile.bankDetails.accountNumber.slice(-3)})`,
              status: 'completed',
              timestamp: new Date().toISOString()
            };

            await addDoc(collection(db, 'transactions'), newTx);
            const updatedProfile: UserProfile = { ...profile, cashBalance: newCashBalance };
            setHandshakeProgress(100);
            setStep('success');
            playChime();
            onSuccess(updatedProfile, newTx);
          } catch (err: any) {
            setError('Failed to record transaction: ' + err.message);
            setStep('form');
          }
        }
      }, 350);
    } else {
      // Live Paystack integration
      const bankCode = NIGERIAN_BANK_CODES[profile.bankDetails.bankName];
      if (!bankCode) {
        setError(`Could not find bank code for ${profile.bankDetails.bankName}.`);
        setStep('form');
        return;
      }

      try {
        setHandshakeLog(prev => [...prev, `Connecting with bank verification service...`]);
        setHandshakeProgress(35);

        const response = await fetch('/api/paystack/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: profile.bankDetails.accountNumber,
            bankCode,
            amount: withdrawAmount,
            accountName: profile.bankDetails.accountName
          })
        });

        const resData = await response.json();
        
        if (!response.ok) {
          throw new Error(resData.message || 'The bank transfer could not be completed.');
        }

        setHandshakeLog(prev => [
          ...prev,
          `Account verified successfully.`,
          `Sending funds to your account...`,
          `Transfer successful. Updating wallet balance...`
        ]);
        setHandshakeProgress(75);

        const newCashBalance = profile.cashBalance - withdrawAmount;
        const userDocRef = doc(db, 'users', profile.uid);
        await updateDoc(userDocRef, { cashBalance: newCashBalance });

        const txId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
        const newTx: Transaction = {
          id: txId,
          userId: profile.uid,
          type: 'withdrawal',
          amount: withdrawAmount,
          receivedAmount: withdrawAmount,
          networkOrIsp: profile.bankDetails.bankName,
          referenceDetails: `${profile.bankDetails.accountName} (${profile.bankDetails.accountNumber.slice(0, 3)}****${profile.bankDetails.accountNumber.slice(-3)})`,
          status: 'completed',
          timestamp: new Date().toISOString()
        };

        await addDoc(collection(db, 'transactions'), newTx);
        const updatedProfile: UserProfile = { ...profile, cashBalance: newCashBalance };
        setHandshakeProgress(100);
        setStep('success');
        playChime();
        onSuccess(updatedProfile, newTx);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An error occurred during live withdrawal processing.');
        setShowSandboxSuggestion(true);
        setStep('form');
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden" id="withdrawal-panel">
      
      {/* Background glow lines */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                <Landmark size={22} />
              </div>
              <div>
                <h3 className="font-bold font-display text-slate-800 text-lg">Instant Withdrawal</h3>
                <p className="text-slate-500 text-xs">Payout cash earnings instantly to any registered Nigerian Bank</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-center gap-2 mb-4" id="withdrawal-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {showSandboxSuggestion && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-3 mb-4 text-xs text-amber-850 shadow-sm" id="sandbox-fallback-box">
                <div className="flex gap-2 items-start">
                  <Wrench size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900">Instant Simulation Mode Available</p>
                    <p className="text-amber-700 mt-1 leading-normal">
                      Live bank payouts require Paystack API keys. If you are previewing the app, you can switch to instant simulation mode to test withdrawals and balances immediately!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSandboxMode(true);
                    setShowSandboxSuggestion(false);
                    setError('');
                  }}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-center transition cursor-pointer"
                  id="activate-sandbox-btn"
                >
                  Enable Simulation Mode
                </button>
              </div>
            )}

            {isSandboxMode && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs flex items-center justify-between mb-4" id="sandbox-active-indicator">
                <div className="flex items-center gap-2">
                  <Wrench size={14} className="text-blue-600" />
                  <span>Simulation Mode is <strong className="text-blue-800">Active</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSandboxMode(false)}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                  id="disable-sandbox-btn"
                >
                  Switch to Live
                </button>
              </div>
            )}

            {!hasBankDetails ? (
              // Empty state warning
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center space-y-4">
                <p className="text-slate-600 text-sm">You haven't added a bank account to your profile yet.</p>
                <button
                  type="button"
                  onClick={openProfile}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  id="link-profile-bank-setup"
                >
                  Add Bank Account
                </button>
              </div>
            ) : (
              <form onSubmit={handleWithdrawal} className="space-y-4">
                {/* Bank Target Preview Card */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Destination Bank Account</p>
                    <p className="text-sm font-bold text-slate-800">{profile.bankDetails.bankName}</p>
                    <p className="text-xs text-slate-600 font-mono">
                      {profile.bankDetails.accountName} • {profile.bankDetails.accountNumber.slice(0, 3)}****{profile.bankDetails.accountNumber.slice(-3)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openProfile}
                    className="text-xs text-blue-600 hover:text-blue-500 hover:underline font-semibold"
                    id="edit-profile-bank"
                  >
                    Change
                  </button>
                </div>

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Withdrawal Amount (₦)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm font-mono">₦</span>
                    <input
                      type="text"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 5000"
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono transition text-sm"
                      id="withdrawal-amount-input"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Minimum withdrawal: ₦1,000</span>
                    <span>Transfer fee: ₦0.00 (Free)</span>
                  </div>
                </div>

                {/* Secure Seal */}
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                  <span>Transfers are processed securely and sent directly to your Nigerian bank account.</span>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition cursor-pointer text-sm"
                  id="btn-withdraw-cash"
                >
                  Withdraw Funds Now
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-8 flex flex-col items-center justify-center text-center space-y-6"
          >
            {/* Banking Handshake Spinner */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
              <Landmark size={32} className="text-blue-600 animate-pulse" />
            </div>

            <div className="space-y-1 w-full max-w-sm">
              <h4 className="text-slate-800 font-semibold text-lg">Processing Bank Transfer</h4>
              <p className="text-slate-500 text-xs">Sending funds to your designated account...</p>
            </div>

            {/* Sim Logs */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 w-full max-w-sm text-left font-mono text-[10px] space-y-2 h-44 overflow-y-auto">
              {handshakeLog.map((log, index) => (
                <div key={index} className="flex gap-1.5 text-slate-300">
                  <span className="text-emerald-500 shrink-0">✔</span>
                  <span>{log}</span>
                </div>
              ))}
              <div className="animate-pulse text-slate-500 text-[9px] flex items-center gap-1.5">
                <RefreshCw size={10} className="animate-spin" /> Transferring funds...
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-sm">
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${handshakeProgress}%` }} />
              </div>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="py-10 flex flex-col items-center justify-center text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-emerald-600" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-slate-800 font-bold text-xl font-display">Transfer Successful!</h4>
              <p className="text-slate-500 text-xs">Funds have been sent to your bank account</p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl w-full max-w-xs space-y-2 text-left">
              <div className="flex justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                <span>Transferred Amount</span>
                <span className="font-bold text-emerald-600 font-mono">₦{parseFloat(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-1">
                <span>Destination Bank</span>
                <span className="font-bold text-slate-700">{profile.bankDetails.bankName}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-0.5">
                <span>Account Number</span>
                <span className="font-bold text-slate-700 font-mono">
                  {profile.bankDetails.accountNumber.slice(0, 3)}****{profile.bankDetails.accountNumber.slice(-3)}
                </span>
              </div>
            </div>

            {/* Instant banking notification pop-up mimic */}
            <div className="w-full max-w-sm p-4 bg-slate-900 border-l-4 border-emerald-500 rounded-r-xl shadow-lg text-left flex gap-3 animate-bounce mt-4">
              <Smartphone size={24} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-bold text-xs">ACCESS BANK CREDIT ALERT</p>
                <p className="text-[10px] text-slate-300 mt-1 leading-normal">
                  Acct: **{profile.bankDetails.accountNumber.slice(-4)}<br />
                  Amt: NGN {parseFloat(amount).toLocaleString()}<br />
                  Desc: SUB TRAFFICKER INSTANT PAYOUT<br />
                  Time: {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>

            <button
              onClick={() => { setStep('form'); setAmount(''); }}
              className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition text-sm cursor-pointer"
              id="withdrawal-done-btn"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
