import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ScanFace,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../firebase';
import { apiRequest, setSessionToken } from '../lib/apiClient';
import { authenticatePasskey, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '../utils/webauthn';

interface AuthScreenProps {
  onSuccess: (backendUser: any, passwordForFallback?: string) => void;
}

type AuthView = 'login' | 'register' | 'verify_email' | 'forgot_request' | 'forgot_reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [view, setView] = useState<AuthView>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [platformBioAvailable, setPlatformBioAvailable] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setPlatformBioAvailable);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const syncFirebaseBestEffort = async (mode: 'signin' | 'signup', userEmail: string, userPass: string) => {
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, userEmail, userPass).catch(async () => {
          await signInWithEmailAndPassword(auth, userEmail, userPass).catch(() => {});
        });
      } else {
        await signInWithEmailAndPassword(auth, userEmail, userPass).catch(() => {});
      }
    } catch {
      // Backend session remains authoritative if Firebase Auth sync is unavailable
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await apiRequest<{
      token?: string;
      user?: any;
      requiresVerification?: boolean;
      email?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (res.data?.requiresVerification) {
      setView('verify_email');
      setNotice(res.data.message || 'Verification email required before sign-in.');
      return;
    }

    if (!res.ok || !res.data?.token || !res.data?.user) {
      setError(res.data?.message || 'Sign in failed. Check your email and password.');
      return;
    }

    setSessionToken(res.data.token);
    await syncFirebaseBestEffort('signin', email, password);
    onSuccess(res.data.user, password);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await apiRequest<{ pendingVerification?: boolean; email?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    setLoading(false);

    if (!res.ok || !res.data?.status) {
      setError(res.data?.message || 'Could not create account.');
      return;
    }

    setResendCooldown(60);
    setOtpCode('');
    setNotice(res.data.message || 'Verification email sent. Check your inbox and enter the 6-digit code.');
    setView('verify_email');
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await apiRequest<{ token?: string; user?: any }>('/api/auth/email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code: otpCode }),
    });

    setLoading(false);

    if (!res.ok || !res.data?.status || !res.data?.token || !res.data?.user) {
      setError(res.data?.message || 'Invalid or expired verification code.');
      return;
    }

    setSessionToken(res.data.token);
    if (password) {
      await syncFirebaseBestEffort('signup', email, password);
    }
    setNotice('Email successfully verified.');
    onSuccess(res.data.user, password || undefined);
  };

  const handleResendEmailOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await apiRequest('/api/auth/email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok || !res.data?.status) {
      setError(res.data?.message || 'Could not resend verification email.');
      return;
    }
    setResendCooldown(60);
    setNotice(res.data.message || 'Verification email sent.');
  };

  const handleForgotSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await apiRequest('/api/auth/forgot-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok || !res.data?.status) {
      setError(res.data?.message || 'Could not send password reset email.');
      return;
    }
    setResendCooldown(60);
    setNotice(res.data.message || 'Verification email sent.');
    setView('forgot_reset');
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await apiRequest('/api/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code: otpCode, newPassword }),
    });

    setLoading(false);
    if (!res.ok || !res.data?.status) {
      setError(res.data?.message || 'Could not reset password.');
      return;
    }
    setPassword('');
    setOtpCode('');
    setNewPassword('');
    setNotice(res.data.message || 'Password updated. Sign in with your new password.');
    setView('login');
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    setNotice(null);
    setPasskeyLoading(true);

    const res = await authenticatePasskey(email.trim() || undefined);
    setPasskeyLoading(false);

    if (!res.success || !res.token || !res.user) {
      setError(res.error || 'Passkey sign-in failed. Use your email and password fallback.');
      return;
    }
    setSessionToken(res.token);
    onSuccess(res.user);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      const res = await apiRequest<{ token?: string; user?: any }>('/api/auth/firebase-exchange', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok || !res.data?.token || !res.data?.user) {
        setError(res.data?.message || 'Could not verify Google session.');
        setGoogleLoading(false);
        return;
      }
      setSessionToken(res.data.token);
      setGoogleLoading(false);
      onSuccess(res.data.user);
    } catch (err: any) {
      setGoogleLoading(false);
      setError(err?.message || 'Google sign-in was canceled.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-slate-800/80 bg-slate-950/90 shadow-2xl overflow-hidden">
        {/* Left Brand & Security Architecture Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-950 p-7 sm:p-9 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              Verified Gaming &amp; Telecom Finance
            </div>

            <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Sub Trafficker
            </h1>
            <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
              Manage Nigerian carrier conversions, sponsored partner rewards, NUBAN-verified bank payouts, and Blood Strike 3D tactical combat from one unified dark console.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">OS Passkeys &amp; Hardware Biometrics</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sign in using Face ID, Touch ID, Windows Hello, or Android Biometrics via standard WebAuthn FIDO2 signatures.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 flex items-start gap-3">
              <Mail className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Backend-Verified Email &amp; SMS OTPs</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Single-use, hashed, rate-limited verification codes delivered only to your inbox or mobile line.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Interactive Auth Panel */}
        <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center">
          {(view === 'login' || view === 'register') && (
            <div className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                  setNotice(null);
                }}
                className={`min-h-[44px] flex-1 rounded-lg text-xs font-bold transition ${
                  view === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('register');
                  setError(null);
                  setNotice(null);
                }}
                className={`min-h-[44px] flex-1 rounded-lg text-xs font-bold transition ${
                  view === 'register' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {view === 'login' && (
            <div className="space-y-5">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setView('forgot_request');
                      }}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-11 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Sign In with Email &amp; Password
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-800" />
                <span className="mx-3 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Passkey &amp; Biometric Options
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={passkeyLoading || !isWebAuthnSupported()}
                  className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {passkeyLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : platformBioAvailable ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Fingerprint className="w-4 h-4" />
                      <ScanFace className="w-4 h-4" />
                    </span>
                  ) : (
                    <KeyRound className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {platformBioAvailable ? 'Passkey / Face & Touch ID' : 'Sign in with Passkey'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continue with Google
                </button>
              </div>
              {!isWebAuthnSupported() && (
                <p className="text-[11px] text-slate-500 text-center">
                  Passkeys are unavailable on this browser; use Email &amp; Password or Google Sign-In above.
                </p>
              )}
            </div>
          )}

          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Chinedu Okafor"
                  className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password (min 8 characters)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                After creating your account, we send a time-limited 6-digit verification code to your email address. After verifying, you can register a passkey in Verification Center.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Create Account &amp; Send Verification Email
              </button>
            </form>
          )}

          {view === 'verify_email' && (
            <form onSubmit={handleVerifyEmailCode} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('login')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>

              <div>
                <h2 className="text-lg font-bold text-white">Verify Your Email</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the 6-digit code delivered to <span className="text-white font-semibold">{email}</span>. Codes expire in 10 minutes.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full min-h-[52px] rounded-xl border border-slate-700 bg-slate-900 px-4 text-center font-mono text-2xl tracking-[0.45em] text-emerald-400 focus:border-amber-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full min-h-[48px] rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Verify Email Code
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendEmailOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:text-slate-500"
                >
                  {resendCooldown > 0 ? `Resend code available in ${resendCooldown}s` : 'Request a new verification code'}
                </button>
              </div>
            </form>
          )}

          {view === 'forgot_request' && (
            <form onSubmit={handleForgotSend} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('login')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>

              <div>
                <h2 className="text-lg font-bold text-white">Reset Password</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your account email and we will send a single-use password reset code to your inbox.
                </p>
              </div>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-white focus:border-amber-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send Password Reset Code
              </button>
            </form>
          )}

          {view === 'forgot_reset' && (
            <form onSubmit={handleForgotReset} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('login')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>

              <div>
                <h2 className="text-lg font-bold text-white">Enter Reset Code &amp; New Password</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Check <span className="text-white font-semibold">{email}</span> for the 6-digit reset code.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-900 px-4 text-center font-mono text-xl tracking-[0.35em] text-amber-400 focus:border-amber-500 focus:outline-none"
              />

              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full min-h-[46px] rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-white focus:border-amber-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full min-h-[48px] rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Password Reset
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
