/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaction } from '../types';
import { NIGERIAN_ISPS } from '../data';
import { Smartphone, RefreshCw, CheckCircle2, Copy, AlertCircle, Radio, Clock, ShieldCheck } from 'lucide-react';
import { validatePhoneNumberForIsp } from '../utils/phoneValidator';

interface AirtimeConverterProps {
  profile: UserProfile;
  onSuccess: (updatedProfile: UserProfile, tx: Transaction) => void;
}

export default function AirtimeConverter({ profile, onSuccess }: AirtimeConverterProps) {
  const [selectedIspName, setSelectedIspName] = useState(profile.isp);
  const [amount, setAmount] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>(profile.phone);
  const [step, setStep] = useState<'form' | 'transferring' | 'success'>('form');
  const [error, setError] = useState('');
  
  // Simulation detailed step logging
  const [simLog, setSimLog] = useState<string[]>([]);
  const [simProgress, setSimProgress] = useState(0);

  const selectedIsp = NIGERIAN_ISPS.find(i => i.name === selectedIspName) || NIGERIAN_ISPS[0];
  const ratePercent = Math.round(selectedIsp.rate * 100);
  const calculatedPayout = amount ? parseFloat(amount) * selectedIsp.rate : 0;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert("USSD Code copied: " + code);
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    const airtimeAmount = parseFloat(amount);
    
    if (!amount || isNaN(airtimeAmount) || airtimeAmount <= 0) {
      setError('Please enter a valid airtime amount.');
      return;
    }

    if (airtimeAmount < 500) {
      setError('Minimum conversion amount is ₦500.');
      return;
    }

    // Strong cellular phone number and selected carrier prefix validation
    const validation = validatePhoneNumberForIsp(senderPhone, selectedIspName);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid phone number.');
      return;
    }

    // Ensure user has sufficient real-time SIM airtime balance
    const currentAirtime = profile.airtimeBalance !== undefined ? profile.airtimeBalance : 0;
    if (airtimeAmount > currentAirtime) {
      setError(`Insufficient airtime balance on your mobile line! Your current cellular airtime balance is ₦${currentAirtime.toLocaleString()}. You cannot convert ₦${airtimeAmount.toLocaleString()} because it exceeds your available SIM card balance.`);
      return;
    }

    setError('');
    setStep('transferring');
    setSimLog([]);
    setSimProgress(0);

    // Dynamic transfer progress logs
    const logs = [
      `Connecting to ${selectedIsp.name} network...`,
      `Checking airtime balance on ${senderPhone}...`,
      `Network confirmed balance of ₦${airtimeAmount.toLocaleString()}`,
      `Applying conversion rate of ${ratePercent}% (${selectedIsp.name} Special Rate)`,
      `Transferring airtime securely...`,
      `Crediting your wallet with ₦${calculatedPayout.toLocaleString()}...`
    ];

    let currentLogIdx = 0;
    const interval = setInterval(async () => {
      if (currentLogIdx < logs.length) {
        setSimLog(prev => [...prev, logs[currentLogIdx]]);
        setSimProgress(p => p + 16.6);
        currentLogIdx++;
      } else {
        clearInterval(interval);
        
        // Update database in real-time
        try {
          const newCashBalance = profile.cashBalance + calculatedPayout;
          const newAirtimeBalance = currentAirtime - airtimeAmount;
          const userDocRef = doc(db, 'users', profile.uid);
          
          // Update user balance and deduct SIM airtime balance
          await updateDoc(userDocRef, {
            cashBalance: newCashBalance,
            airtimeBalance: newAirtimeBalance
          });

          // Create transaction document
          const txId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
          const newTx: Transaction = {
            id: txId,
            userId: profile.uid,
            type: 'airtime_convert',
            amount: airtimeAmount,
            receivedAmount: calculatedPayout,
            networkOrIsp: selectedIsp.name,
            referenceDetails: senderPhone,
            status: 'completed',
            timestamp: new Date().toISOString()
          };

          await addDoc(collection(db, 'transactions'), newTx);

          const updatedProfile: UserProfile = {
            ...profile,
            cashBalance: newCashBalance,
            airtimeBalance: newAirtimeBalance
          };

          setStep('success');
          onSuccess(updatedProfile, newTx);
        } catch (err) {
          console.error(err);
          setError('Failed to record transaction in Firestore database.');
          setStep('form');
        }
      }
    }, 700);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden" id="airtime-converter-panel">
      
      {/* Background glow lines */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

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
                <Smartphone size={22} />
              </div>
              <div>
                <h3 className="font-bold font-display text-slate-800 text-lg">Convert Airtime to Real Cash</h3>
                <p className="text-slate-500 text-xs">Transform cellular airtime deposits into instant bank-withdrawable cash</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-center gap-2 mb-4" id="convert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleConvert} className="space-y-4">
              {/* ISP Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Select Network Carrier</label>
                <div className="grid grid-cols-4 gap-2">
                  {NIGERIAN_ISPS.map((ispItem) => (
                    <button
                      key={ispItem.name}
                      type="button"
                      onClick={() => setSelectedIspName(ispItem.name)}
                      className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition ${selectedIspName === ispItem.name ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-slate-50/30 hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                    >
                      <span className="text-sm font-bold font-display" style={{ color: selectedIspName === ispItem.name ? '#2563EB' : '#64748B' }}>
                        {ispItem.name}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {Math.round(ispItem.rate * 100)}% Payout
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Airtime Deposit Amount (₦)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                    <input
                      type="text"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 5000"
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono transition text-sm"
                      id="airtime-amount-input"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Min: ₦500. Rate: {ratePercent}% payout</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Sender Phone Number</label>
                    <span className="text-[10px] font-bold text-blue-600">
                      SIM Credit: ₦{(profile.airtimeBalance !== undefined ? profile.airtimeBalance : 15000).toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="tel"
                    required
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 08031234567"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono transition text-sm"
                    id="airtime-phone-input"
                  />
                  <p className="text-[10px] text-slate-400 flex justify-between">
                    <span>The line where airtime will be debited</span>
                    <span className="text-slate-500 font-semibold">Must match {selectedIspName} prefix</span>
                  </p>
                </div>
              </div>

              {/* Conversion Preview Box */}
              {amount && (
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Net Cash Transferred to Account</p>
                    <p className="text-2xl font-bold font-display text-emerald-600">₦{calculatedPayout.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">ISP Network Fee</p>
                    <p className="text-xs font-semibold text-rose-500 font-mono">- ₦{(parseFloat(amount) - calculatedPayout).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* USSD instructions hint */}
              <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                <Radio size={14} className="text-blue-600 mt-0.5 shrink-0" />
                <p>
                  <strong>How it works:</strong> When you submit, we instantly process your airtime exchange and credit cash to your wallet within seconds. No delays or waiting.
                </p>
              </div>

              {/* Convert Trigger */}
              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition cursor-pointer text-sm"
                id="btn-convert-airtime"
              >
                <RefreshCw size={16} className="animate-spin-slow" />
                Convert Airtime Now
              </button>
            </form>
          </motion.div>
        )}

        {step === 'transferring' && (
          <motion.div
            key="transferring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-8 flex flex-col items-center justify-center text-center space-y-6"
          >
            {/* Cyber Spinner */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
              <Smartphone size={32} className="text-blue-600 animate-pulse" />
            </div>

            <div className="space-y-1 w-full max-w-sm">
              <h4 className="text-slate-800 font-semibold text-lg">Exchanging Airtime for Cash</h4>
              <p className="text-slate-500 text-xs">Please wait while your airtime transfer is processed...</p>
            </div>

            {/* Sim Logs */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full max-w-sm text-left font-mono text-[10px] space-y-2 h-44 overflow-y-auto shadow-inner">
              {simLog.map((log, index) => (
                <div key={index} className="flex gap-1.5 text-slate-300">
                  <span className="text-blue-400 shrink-0">⚡</span>
                  <span>{log}</span>
                </div>
              ))}
              <div className="animate-pulse text-slate-500 text-[9px] flex items-center gap-1.5">
                <Clock size={10} /> Connecting...
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-sm">
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${simProgress}%` }} />
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
              <h4 className="text-slate-800 font-bold text-xl font-display">Conversion Completed!</h4>
              <p className="text-slate-500 text-xs">Your cash balance has been credited instantly</p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                <span>Received Payout</span>
                <span className="font-bold text-emerald-600 font-mono">₦{calculatedPayout.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-1">
                <span>Carrier network</span>
                <span className="font-bold text-slate-700">{selectedIsp.name}</span>
              </div>
            </div>

            <button
              onClick={() => setStep('form')}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold rounded-xl transition text-sm cursor-pointer"
              id="convert-back-to-form-btn"
            >
              Convert More Airtime
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
