import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { NIGERIAN_BANKS, NIGERIAN_BANK_CODES, NIGERIAN_ISPS } from '../data';
import { apiRequest } from '../lib/apiClient';
import { FaceVerificationStatus, ISPName, UserProfile } from '../types';
import { lookupPhoneCarrier } from '../utils/carrierDetector';
import { normalizePhoneNumber } from '../utils/phoneValidator';
import { registerPasskey } from '../utils/webauthn';
import { BiometricScanner } from './BiometricScanner';

interface VerificationCenterProps {
  profile: UserProfile;
  onProfileUpdate: (updates: Partial<UserProfile>) => Promise<void>;
}

export const VerificationCenter: React.FC<VerificationCenterProps> = ({ profile, onProfileUpdate }) => {
  const [statusLoading, setStatusLoading] = useState(true);
  const [serverUser, setServerUser] = useState<any>(null);
  const [hasFaceRef, setHasFaceRef] = useState(false);
  const [passkeys, setPasskeys] = useState<Array<{ credential_id: string; device_name: string; created_at: string }>>([]);

  // Email OTP
  const [emailOtp, setEmailOtp] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Phone + MNP + SMS OTP
  const [phoneInput, setPhoneInput] = useState(profile.phone || '');
  const [selectedCarrier, setSelectedCarrier] = useState<ISPName | ''>(profile.isp || '');
  const [carrierNotice, setCarrierNotice] = useState<string | null>(null);
  const [carrierMethod, setCarrierMethod] = useState<string>('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Bank Resolution + Holder Confirmation
  const [bankName, setBankName] = useState(profile.bankDetails?.bankName || NIGERIAN_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState(profile.bankDetails?.accountNumber || '');
  const [resolvedName, setResolvedName] = useState(profile.bankDetails?.accountName || '');
  const [resolvedProvider, setResolvedProvider] = useState('');
  const [holderConfirmed, setHolderConfirmed] = useState(Boolean(profile.bankConfirmed));
  const [bankBusy, setBankBusy] = useState(false);
  const [bankMsg, setBankMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Face & Passkey Modal
  const [scannerMode, setScannerMode] = useState<'face' | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadVerificationStatus = async () => {
    setStatusLoading(true);
    const [statusRes, credRes] = await Promise.all([
      apiRequest('/api/verification/status'),
      apiRequest<{ credentials: Array<{ credential_id: string; device_name: string; created_at: string }> }>(
        '/api/webauthn/credentials'
      ),
    ]);
    if (statusRes.ok && statusRes.data?.user) {
      setServerUser(statusRes.data.user);
      setHasFaceRef(Boolean(statusRes.data.hasFaceReference));
    }
    if (credRes.ok && Array.isArray(credRes.data?.credentials)) {
      setPasskeys(credRes.data.credentials);
    }
    setStatusLoading(false);
  };

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const handleSendEmailCode = async () => {
    setEmailBusy(true);
    setEmailMsg(null);
    const res = await apiRequest('/api/auth/email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: profile.email }),
    });
    setEmailBusy(false);
    setEmailMsg({ ok: res.ok && Boolean(res.data?.status), text: res.data?.message || 'Unable to send code.' });
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailMsg(null);
    const res = await apiRequest('/api/auth/email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: profile.email, code: emailOtp }),
    });
    setEmailBusy(false);
    if (res.ok && res.data?.status) {
      setEmailMsg({ ok: true, text: 'Email successfully verified.' });
      setEmailOtp('');
      await onProfileUpdate({ emailVerified: true });
      await loadVerificationStatus();
    } else {
      setEmailMsg({ ok: false, text: res.data?.message || 'Invalid verification code.' });
    }
  };

  const handleDetectCarrier = async () => {
    setPhoneBusy(true);
    setPhoneMsg(null);
    const normalized = normalizePhoneNumber(phoneInput);
    setPhoneInput(normalized || phoneInput);
    const lookup = await lookupPhoneCarrier(normalized || phoneInput);
    setPhoneBusy(false);
    if (lookup.carrier) {
      setSelectedCarrier(lookup.carrier);
    }
    setCarrierMethod(lookup.provider);
    setCarrierNotice(lookup.mnpNotice);
  };

  const handleSendSmsOtp = async () => {
    setPhoneBusy(true);
    setPhoneMsg(null);
    const res = await apiRequest<{ carrier?: ISPName; normalizedLocal?: string; mnpNotice?: string }>(
      '/api/phone/send-otp',
      {
        method: 'POST',
        body: JSON.stringify({ phone: phoneInput, carrier: selectedCarrier }),
      }
    );
    setPhoneBusy(false);
    if (res.ok && res.data?.status) {
      setSmsSent(true);
      if (res.data.normalizedLocal) setPhoneInput(res.data.normalizedLocal);
      if (res.data.carrier) setSelectedCarrier(res.data.carrier);
      if (res.data.mnpNotice) setCarrierNotice(res.data.mnpNotice);
      setPhoneMsg({ ok: true, text: res.data.message || 'SMS code dispatched.' });
    } else {
      setPhoneMsg({ ok: false, text: res.data?.message || 'Could not send SMS OTP.' });
    }
  };

  const handleVerifySmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneBusy(true);
    setPhoneMsg(null);
    const res = await apiRequest<{ user?: any }>('/api/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneInput, code: smsCode }),
    });
    setPhoneBusy(false);
    if (res.ok && res.data?.status && res.data?.user) {
      setSmsSent(false);
      setSmsCode('');
      setPhoneMsg({ ok: true, text: res.data.message || 'Phone verified via SMS OTP.' });
      await onProfileUpdate({
        phone: res.data.user.phone,
        isp: (res.data.user.isp || selectedCarrier || profile.isp) as ISPName,
        phoneVerified: true,
        phoneCarrierVerified: Boolean(res.data.user.phoneCarrierVerified),
      });
      await loadVerificationStatus();
    } else {
      setPhoneMsg({ ok: false, text: res.data?.message || 'SMS verification failed.' });
    }
  };

  const handleResolveBank = async () => {
    setBankBusy(true);
    setBankMsg(null);
    setResolvedName('');
    setHolderConfirmed(false);

    const bankCode = NIGERIAN_BANK_CODES[bankName] || '';
    const res = await apiRequest<{ accountName?: string; provider?: string }>('/api/bank/resolve', {
      method: 'POST',
      body: JSON.stringify({ accountNumber, bankCode }),
    });
    setBankBusy(false);

    if (!res.ok || !res.data?.status || !res.data?.accountName) {
      setBankMsg({ ok: false, text: res.data?.message || 'Bank account could not be verified.' });
      return;
    }

    setResolvedName(res.data.accountName);
    setResolvedProvider(res.data.provider || 'Provider');
    setBankMsg({
      ok: true,
      text: `Account holder resolved via ${res.data.provider}: ${res.data.accountName}. Confirm ownership below.`,
    });
  };

  const handleConfirmBank = async () => {
    if (!holderConfirmed || !resolvedName) return;
    setBankBusy(true);
    setBankMsg(null);
    const bankCode = NIGERIAN_BANK_CODES[bankName] || '';

    const res = await apiRequest<{ accountName?: string }>('/api/bank/confirm', {
      method: 'POST',
      body: JSON.stringify({ accountNumber, bankCode, bankName, confirmed: true }),
    });
    setBankBusy(false);

    if (!res.ok || !res.data?.status) {
      setBankMsg({ ok: false, text: res.data?.message || 'Could not confirm bank account.' });
      return;
    }

    await onProfileUpdate({
      bankDetails: {
        bankCode,
        bankName,
        accountNumber,
        accountName: res.data.accountName || resolvedName,
      },
      bankVerified: true,
      bankConfirmed: true,
    });
    setBankMsg({ ok: true, text: 'Bank account verified and locked for NGN withdrawals.' });
    await loadVerificationStatus();
  };

  const handleRegisterPasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyMsg(null);
    const res = await registerPasskey('Sub Trafficker Device Passkey');
    setPasskeyBusy(false);
    if (res.success) {
      setPasskeyMsg({ ok: true, text: 'Passkey registered via your device authenticator.' });
      await onProfileUpdate({ biometrics: { ...profile.biometrics, passkey: true } });
      await loadVerificationStatus();
    } else {
      setPasskeyMsg({ ok: false, text: res.error || 'Passkey enrollment failed.' });
    }
  };

  const handleDeletePasskey = async (id: string) => {
    await apiRequest(`/api/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadVerificationStatus();
  };

  const faceStatus: FaceVerificationStatus = serverUser?.faceStatus || profile.faceStatus || 'pending';
  const emailVerified = Boolean(serverUser?.emailVerified ?? profile.emailVerified);
  const phoneVerified = Boolean(serverUser?.phoneVerified ?? profile.phoneVerified);
  const bankVerified = Boolean(serverUser?.bankVerified ?? profile.bankVerified);

  if (statusLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl skeleton-shimmer border border-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56 rounded-2xl skeleton-shimmer border border-slate-800" />
          <div className="h-56 rounded-2xl skeleton-shimmer border border-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            Verification Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete real server-backed verifications across Email, Phone/MNP Carrier, Identity Face Match, WebAuthn Passkeys, and Nigerian Bank NUBAN.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${emailVerified ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            Email: {emailVerified ? 'Verified' : 'Pending'}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${phoneVerified ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            Phone: {phoneVerified ? 'Verified' : 'Pending'}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${faceStatus === 'verified' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
            Face: {faceStatus}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${bankVerified ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            Bank: {bankVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Email Verification */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" /> Email Verification
            </h3>
            {emailVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Verified
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-400">Action Required</span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Account Email: <span className="text-white font-medium">{profile.email}</span>
          </p>
          {!emailVerified && (
            <form onSubmit={handleVerifyEmailCode} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit email OTP"
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-white"
                />
                <button
                  type="button"
                  onClick={handleSendEmailCode}
                  disabled={emailBusy}
                  className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Send Code
                </button>
              </div>
              <button
                type="submit"
                disabled={emailBusy || emailOtp.length !== 6}
                className="w-full min-h-[44px] rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
              >
                {emailBusy ? 'Verifying...' : 'Confirm Email Code'}
              </button>
            </form>
          )}
          {emailMsg && (
            <p className={`text-xs ${emailMsg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{emailMsg.text}</p>
          )}
        </div>

        {/* 2. Identity & Biometric Face Verification */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" /> Identity &amp; Face Matching
            </h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{faceStatus.replace('_', ' ')}</span>
          </div>
          <p className="text-xs text-slate-400">
            Compares a live camera capture against your stored reference identity portrait via Dojah / Face++ verification APIs. Never auto-approved on timers.
          </p>
          {serverUser?.faceReason && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              {serverUser.faceReason}
            </div>
          )}
          <button
            type="button"
            onClick={() => setScannerMode('face')}
            className="w-full min-h-[44px] rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white hover:bg-slate-700 inline-flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4 text-amber-400" />
            {faceStatus === 'verified' ? 'Re-verify Face Identity' : 'Open Face Verification Camera'}
          </button>
        </div>

        {/* 3. Phone Number, MNP Carrier Detection & SMS OTP */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400" /> Phone &amp; Nigerian Carrier OTP
            </h3>
            {phoneVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Verified ({serverUser?.isp || profile.isp})
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">SMS OTP Required</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0803... or +234..."
              className="sm:col-span-2 min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-mono text-white"
            />
            <button
              type="button"
              onClick={handleDetectCarrier}
              disabled={phoneBusy}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Detect Carrier
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {NIGERIAN_ISPS.map((isp) => (
              <button
                key={isp.name}
                type="button"
                onClick={() => setSelectedCarrier(isp.name)}
                className={`min-h-[44px] rounded-xl border text-xs font-bold transition ${
                  selectedCarrier === isp.name
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {isp.name}
              </button>
            ))}
          </div>

          {carrierNotice && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-300">
              <span className="font-semibold text-amber-400">{carrierMethod}: </span>
              {carrierNotice}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleSendSmsOtp}
              disabled={phoneBusy || !phoneInput}
              className="min-h-[44px] flex-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {phoneBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              Send SMS Verification Code
            </button>
          </div>

          {smsSent && (
            <form onSubmit={handleVerifySmsOtp} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit SMS code"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-white"
              />
              <button
                type="submit"
                disabled={phoneBusy || smsCode.length !== 6}
                className="min-h-[44px] rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Confirm OTP
              </button>
            </form>
          )}

          {phoneMsg && (
            <p className={`text-xs ${phoneMsg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{phoneMsg.text}</p>
          )}
        </div>

        {/* 4. Nigerian Bank Account Verification (Paystack / Flutterwave / Monnify) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" /> Nigerian Bank Account (NUBAN)
            </h3>
            {bankVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Confirmed
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">Provider Lookup</span>
            )}
          </div>

          <div className="space-y-3">
            <select
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                setResolvedName('');
                setHolderConfirmed(false);
              }}
              className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              {NIGERIAN_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setResolvedName('');
                  setHolderConfirmed(false);
                }}
                placeholder="10-digit NUBAN number"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-white"
              />
              <button
                type="button"
                onClick={handleResolveBank}
                disabled={bankBusy || accountNumber.length !== 10}
                className="min-h-[44px] rounded-xl bg-slate-800 border border-slate-700 px-4 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {bankBusy ? 'Resolving...' : 'Verify Account'}
              </button>
            </div>

            {resolvedName && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Account Holder ({resolvedProvider}):</span>
                  <span className="font-bold text-emerald-300">{resolvedName}</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holderConfirmed}
                    onChange={(e) => setHolderConfirmed(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  I confirm that <strong className="text-white">{resolvedName}</strong> belongs to me.
                </label>
                <button
                  type="button"
                  onClick={handleConfirmBank}
                  disabled={!holderConfirmed || bankBusy}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                >
                  Save &amp; Lock Verified Bank Account
                </button>
              </div>
            )}

            {bankMsg && (
              <p className={`text-xs ${bankMsg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{bankMsg.text}</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. WebAuthn Passkeys Management */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" /> Registered WebAuthn Passkeys
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enroll Touch ID, Face ID, Windows Hello, or Android BiometricPrompt for passwordless sign-in.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRegisterPasskey}
            disabled={passkeyBusy}
            className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {passkeyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Register New Passkey
          </button>
        </div>

        {passkeyMsg && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
              passkeyMsg.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            {passkeyMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{passkeyMsg.text}</span>
          </div>
        )}

        {passkeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-4 text-xs text-slate-500 text-center">
            No passkeys registered yet. Click &ldquo;Register New Passkey&rdquo; to bind this device&apos;s OS biometric prompt.
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.credential_id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
              >
                <div>
                  <p className="text-xs font-bold text-white">{pk.device_name}</p>
                  <p className="text-[11px] font-mono text-slate-500">
                    ID: {pk.credential_id.slice(0, 18)}... • Added {new Date(pk.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePasskey(pk.credential_id)}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30"
                  aria-label="Remove passkey"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {scannerMode === 'face' && (
        <BiometricScanner
          mode="face"
          userEmail={profile.email}
          hasFaceReference={hasFaceRef}
          initialFaceStatus={faceStatus}
          onSuccess={async (payload) => {
            await onProfileUpdate({
              faceStatus: payload?.faceStatus || 'verified',
              faceProvider: payload?.provider,
              faceConfidence: payload?.confidence ?? null,
              biometrics: { ...profile.biometrics, face: true },
            });
            setScannerMode(null);
            await loadVerificationStatus();
          }}
          onCancel={() => {
            setScannerMode(null);
            loadVerificationStatus();
          }}
        />
      )}
    </div>
  );
};
