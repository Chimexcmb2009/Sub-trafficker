import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Phone,
  Radio,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { NIGERIAN_ISPS } from '../data';
import { apiRequest } from '../lib/apiClient';
import { ISPName, UserProfile } from '../types';
import { lookupPhoneCarrier } from '../utils/carrierDetector';
import { normalizePhoneNumber } from '../utils/phoneValidator';

interface SimSynchronizerProps {
  profile: UserProfile;
  onUpdate: (updated: UserProfile) => void;
  theme?: string;
}

export default function SimSynchronizer({ profile, onUpdate }: SimSynchronizerProps) {
  const [phoneInput, setPhoneInput] = useState(profile.phone || '');
  const [selectedIsp, setSelectedIsp] = useState<ISPName | ''>(profile.isp || '');
  const [lookupInfo, setLookupInfo] = useState<{
    carrier: ISPName | null;
    provider: string;
    method: string;
    mnpNotice: string;
  } | null>(null);
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleNormalizeAndDetect = async () => {
    setBusy(true);
    setStatusMessage(null);
    const normalized = normalizePhoneNumber(phoneInput);
    if (normalized) setPhoneInput(normalized);

    const res = await lookupPhoneCarrier(normalized || phoneInput);
    setBusy(false);
    setLookupInfo({
      carrier: res.carrier,
      provider: res.provider,
      method: res.method,
      mnpNotice: res.mnpNotice,
    });
    if (res.carrier) {
      setSelectedIsp(res.carrier);
      setStatusMessage({
        type: 'info',
        text: `Detected ${res.carrier} (${res.provider}). Confirm carrier or verify via SMS OTP below.`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Could not identify a valid Nigerian mobile prefix. Enter an 11-digit Nigerian number (e.g. 0803..., 0802..., 0805..., 0809...).',
      });
    }
  };

  const handleSendOtp = async () => {
    setBusy(true);
    setStatusMessage(null);
    const res = await apiRequest<{ normalizedLocal?: string; carrier?: ISPName; mnpNotice?: string }>(
      '/api/phone/send-otp',
      {
        method: 'POST',
        body: JSON.stringify({ phone: phoneInput, carrier: selectedIsp }),
      }
    );
    setBusy(false);

    if (!res.ok || !res.data?.status) {
      setStatusMessage({ type: 'error', text: res.data?.message || 'Failed to send SMS OTP.' });
      return;
    }

    setSmsSent(true);
    if (res.data.normalizedLocal) setPhoneInput(res.data.normalizedLocal);
    if (res.data.carrier) setSelectedIsp(res.data.carrier);
    setStatusMessage({ type: 'success', text: res.data.message || 'SMS OTP sent.' });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    const res = await apiRequest<{ user?: any }>('/api/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneInput, code: smsCode }),
    });
    setBusy(false);

    if (!res.ok || !res.data?.status || !res.data?.user) {
      setStatusMessage({ type: 'error', text: res.data?.message || 'Invalid or expired SMS OTP.' });
      return;
    }

    setSmsSent(false);
    setSmsCode('');
    setStatusMessage({ type: 'success', text: res.data.message || 'Line verified via SMS OTP.' });
    onUpdate({
      ...profile,
      phone: res.data.user.phone,
      isp: (res.data.user.isp || selectedIsp || profile.isp) as ISPName,
      phoneVerified: true,
      phoneCarrierVerified: Boolean(res.data.user.phoneCarrierVerified),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5" id="sim-synchronizer-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nigerian SIM &amp; MNP Carrier Verification</h3>
            <p className="text-xs text-slate-400">
              Prefix detection is only an estimate due to Mobile Number Portability (MNP). Verify ownership via SMS OTP.
            </p>
          </div>
        </div>
        {profile.phoneVerified && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified ({profile.isp})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="0803..., 0802..., 0805..., or +234..."
            className="w-full min-h-[46px] rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 font-mono text-sm text-white"
          />
        </div>
        <button
          type="button"
          onClick={handleNormalizeAndDetect}
          disabled={busy || !phoneInput}
          className="min-h-[46px] rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Checking...' : 'Check Network'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {NIGERIAN_ISPS.map((isp) => (
          <button
            key={isp.name}
            type="button"
            onClick={() => setSelectedIsp(isp.name)}
            className={`min-h-[48px] rounded-xl border px-3 flex items-center justify-center gap-2 text-xs font-bold transition ${
              selectedIsp === isp.name
                ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <img src={isp.logo} alt={isp.name} className="w-5 h-5 rounded" />
            <span>{isp.name}</span>
          </button>
        ))}
      </div>

      {lookupInfo && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-white">
            Lookup Result: <span className="text-amber-400">{lookupInfo.carrier || 'Unknown'}</span> ({lookupInfo.provider})
          </p>
          <p className="text-[11px] text-slate-400">{lookupInfo.mnpNotice}</p>
        </div>
      )}

      {statusMessage && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-start gap-2 ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : statusMessage.type === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-slate-700 bg-slate-950 text-slate-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleSendOtp}
          disabled={busy || !phoneInput || !selectedIsp}
          className="min-h-[46px] flex-1 rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
          Send SMS OTP to Verify Line
        </button>
      </div>

      {smsSent && (
        <form onSubmit={handleVerifyOtp} className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            inputMode="numeric"
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit SMS code"
            className="flex-1 min-h-[46px] rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-white"
          />
          <button
            type="submit"
            disabled={busy || smsCode.length !== 6}
            className="min-h-[46px] rounded-xl bg-emerald-500 px-5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Confirm OTP
          </button>
        </form>
      )}
    </div>
  );
}
