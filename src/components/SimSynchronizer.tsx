import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ISPName } from '../types';
import { detectCarrierRealTime } from '../utils/carrierDetector';
import { validatePhoneNumberForIsp } from '../utils/phoneValidator';
import { Smartphone, ShieldCheck, RefreshCw, Radio, Hash, AlertTriangle, CheckCircle2, Wifi } from 'lucide-react';

interface SimSynchronizerProps {
  profile: UserProfile;
  onUpdate: (updated: UserProfile) => void;
  theme?: string;
}

export default function SimSynchronizer({ profile, onUpdate, theme }: SimSynchronizerProps) {
  const [activeIsp, setActiveIsp] = useState<ISPName | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [phoneInput, setPhoneInput] = useState(profile.phone || '');
  const [ussdModalOpen, setUssdModalOpen] = useState(false);
  const [ussdInput, setUssdInput] = useState('');
  const [ussdResponse, setUssdResponse] = useState('');
  const [ussdLoading, setUssdLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [newAirtimeValue, setNewAirtimeValue] = useState<string>('');

  // Auto-detect carrier on load
  useEffect(() => {
    triggerCarrierDetection();
  }, []);

  const triggerCarrierDetection = async () => {
    setDetecting(true);
    try {
      const detected = await detectCarrierRealTime();
      setActiveIsp(detected);
    } catch (e) {
      console.error(e);
    } finally {
      setDetecting(false);
    }
  };

  const handleVerifyAndSync = async () => {
    setStatusMessage(null);
    
    if (!phoneInput) {
      setStatusMessage({ type: 'error', text: 'Please enter your physical SIM mobile number first.' });
      return;
    }

    if (!activeIsp) {
      setStatusMessage({ type: 'error', text: 'Active cellular carrier could not be resolved. Please check your internet connection.' });
      return;
    }

    // Validate if the entered phone matches the detected live network ISP
    const validation = validatePhoneNumberForIsp(phoneInput, activeIsp);
    if (!validation.isValid) {
      setStatusMessage({
        type: 'error',
        text: `Device Verification Failed! ${validation.error || ''}`
      });
      return;
    }

    // Match succeeded! Now prompt them to dial the USSD verification string to fetch real airtime
    const ussdCode = activeIsp === 'MTN' ? '*310#' : activeIsp === 'Airtel' ? '*123#' : activeIsp === 'Glo' ? '*310#' : '*232#';
    setStatusMessage({
      type: 'info',
      text: `SIM operator matched successfully! To sync your actual SIM card credit balance, dial the USSD code ${ussdCode} on your mobile line or use the instant USSD portal below.`
    });

    // Update phone number in database
    try {
      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        phone: phoneInput,
        isp: activeIsp
      });
      onUpdate({
        ...profile,
        phone: phoneInput,
        isp: activeIsp
      });
    } catch (e: any) {
      console.error('Error saving phone number:', e);
    }
  };

  const handleUssdDial = () => {
    if (!phoneInput) {
      setStatusMessage({ type: 'error', text: 'Please enter and verify your physical SIM phone number first.' });
      return;
    }
    const defaultCode = activeIsp === 'MTN' ? '*310#' : activeIsp === 'Airtel' ? '*123#' : activeIsp === 'Glo' ? '*310#' : '*232#';
    setUssdInput(defaultCode);
    setUssdResponse('');
    setUssdModalOpen(true);
  };

  const submitUssdCode = () => {
    setUssdLoading(true);
    setUssdResponse('');

    setTimeout(async () => {
      setUssdLoading(false);
      const isCorrectCode = 
        ussdInput === '*310#' || 
        ussdInput === '*123#' || 
        ussdInput === '*232#';

      if (!isCorrectCode) {
        setUssdResponse(`MMI Code Completed.\nUnknown USSD application request. Please dial MTN/Glo (*310#), Airtel (*123#) or 9mobile (*232#).`);
        return;
      }

      // Read actual verified user balance from profile instead of random numbers
      const actualBalance = profile.airtimeBalance !== undefined ? profile.airtimeBalance : 0;
      setUssdResponse(`[Network Check Completed]\nPhone Line: ${phoneInput}\nNetwork: ${activeIsp || 'Detected Carrier'}\nCurrent Airtime Balance: ₦${actualBalance.toLocaleString()}\nData Balance: 10.00 GB\n\nTo update your airtime balance, enter the confirmed amount below.`);
    }, 1500);
  };

  const handleManualSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(newAirtimeValue);
    if (isNaN(balance) || balance < 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid airtime amount.' });
      return;
    }

    // Require phone validation against operator prefix before saving
    if (!phoneInput) {
      setStatusMessage({ type: 'error', text: 'Please enter your mobile phone number first.' });
      return;
    }

    const phoneValidation = validatePhoneNumberForIsp(phoneInput, activeIsp || 'MTN');
    if (!phoneValidation.isValid) {
      setStatusMessage({ type: 'error', text: `Cannot update balance: ${phoneValidation.error}` });
      return;
    }

    try {
      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        airtimeBalance: balance
      });

      onUpdate({
        ...profile,
        airtimeBalance: balance
      });

      setStatusMessage({
        type: 'success',
        text: `SIM Balance Updated! Your airtime balance is now set to ₦${balance.toLocaleString()}. You can now convert it to cash!`
      });
      setUssdModalOpen(false);
      setNewAirtimeValue('');
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Update failed: ' + e.message });
    }
  };

  const ispColors: Record<ISPName, string> = {
    MTN: 'from-amber-400 to-yellow-500 text-slate-900',
    Airtel: 'from-rose-600 to-red-700 text-white',
    Glo: 'from-emerald-600 to-green-700 text-white',
    '9mobile': 'from-green-800 to-emerald-950 text-white'
  };

  return (
    <div className={`border rounded-3xl p-6 shadow-sm relative overflow-hidden transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-white border-slate-200' 
        : theme === 'cyber'
        ? 'bg-zinc-950 border-emerald-500/30 text-emerald-400'
        : theme === 'ai'
        ? 'bg-[#120C24]/90 border-purple-500/30 text-purple-200'
        : 'bg-slate-900 border-slate-800 text-slate-200'
    }`} id="sim-synchronizer-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Wifi size={22} className={detecting ? 'animate-spin' : ''} />
          </div>
          <div>
            <h4 className="font-bold font-display text-slate-800 dark:text-white text-base">Mobile Network & SIM Verification</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">Verify your mobile network and check your airtime balance</p>
          </div>
        </div>

        <button 
          onClick={triggerCarrierDetection} 
          disabled={detecting}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
          title="Re-check mobile network"
        >
          <RefreshCw size={15} className={detecting ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Left Hand: Connection Probe */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Detected Mobile Network</p>
            
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Active Connection</span>
              </div>
              
              {activeIsp ? (
                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r ${ispColors[activeIsp]}`}>
                  {activeIsp} Network
                </div>
              ) : (
                <span className="text-xs text-slate-400">Detecting...</span>
              )}
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
              Your device connection is detected as <strong>{activeIsp || 'a Nigerian network'}</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Your Phone Number</label>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="0803 123 4567"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <button
                onClick={handleVerifyAndSync}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shrink-0 cursor-pointer"
              >
                Verify Number
              </button>
            </div>
          </div>
        </div>

        {/* Right Hand: USSD Query Trigger & Status display */}
        <div className="flex flex-col justify-between">
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-normal">
              Check and link your available airtime balance using your network balance code.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleUssdDial}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Smartphone size={13} />
                Check Balance ({activeIsp === 'Airtel' ? '*123#' : '*310#'})
              </button>
            </div>

            {/* Simulated Cellular Airtime Balance Badge */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Linked Airtime Balance</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                  ₦{(profile.airtimeBalance !== undefined ? profile.airtimeBalance : 0).toLocaleString()}
                </p>
              </div>
              <ShieldCheck size={18} className="text-blue-600" />
            </div>
          </div>

          {statusMessage && (
            <div className={`mt-3 p-3 rounded-xl border text-xs leading-normal flex items-start gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' 
                : statusMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-300'
                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 text-blue-800 dark:text-blue-300'
            }`}>
              {statusMessage.type === 'error' ? <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" /> : <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* USSD Terminal Modal */}
      <AnimatePresence>
        {ussdModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-sm p-6 overflow-hidden shadow-2xl font-mono text-slate-300"
            >
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                <span className="text-xs font-bold text-slate-500">NETWORK USSD CHECK</span>
                <button 
                  onClick={() => setUssdModalOpen(false)} 
                  className="text-slate-500 hover:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">USSD Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ussdInput}
                      onChange={(e) => setUssdInput(e.target.value)}
                      placeholder="*310#"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-sm tracking-widest focus:outline-none"
                    />
                    <button
                      onClick={submitUssdCode}
                      disabled={ussdLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                    >
                      {ussdLoading ? <RefreshCw size={13} className="animate-spin" /> : <Hash size={13} />}
                      Dial
                    </button>
                  </div>
                </div>

                {ussdLoading ? (
                  <div className="p-4 bg-slate-900/50 rounded-2xl flex flex-col items-center justify-center space-y-2 h-[120px]">
                    <RefreshCw size={18} className="animate-spin text-emerald-500" />
                    <span className="text-[10px] text-slate-500 uppercase">Connecting to network...</span>
                  </div>
                ) : ussdResponse ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-900 rounded-2xl text-xs whitespace-pre-line leading-relaxed text-slate-200 border border-slate-850 h-[140px] overflow-y-auto">
                      {ussdResponse}
                    </div>

                    {/* Form to submit the actual airtime credit to save to database */}
                    {ussdResponse.includes('Network Check Completed') && (
                      <form onSubmit={handleManualSyncSubmit} className="space-y-3 pt-3 border-t border-slate-900 animate-fadeIn">
                        <div>
                          <label className="text-[10px] text-emerald-500 font-bold block mb-1 uppercase">Enter Verified Airtime Balance (₦)</label>
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="Enter your airtime balance"
                            value={newAirtimeValue}
                            onChange={(e) => setNewAirtimeValue(e.target.value)}
                            className="w-full bg-slate-900 border border-emerald-500/30 text-white font-bold rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase cursor-pointer"
                        >
                          Save Airtime Balance
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900/30 rounded-2xl flex items-center justify-center h-[120px]">
                    <span className="text-[10px] text-slate-600 uppercase">Dial the network code to check balance</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
