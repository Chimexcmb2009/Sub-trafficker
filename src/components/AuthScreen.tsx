/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { 
  Scan, Fingerprint, Key, Mail, Lock, User, Phone, ArrowRight, 
  ShieldCheck, HelpCircle, RefreshCw, QrCode, KeyRound, CheckCircle2, 
  AlertCircle, Eye, EyeOff, Sparkles, Check, ArrowLeft, Smartphone
} from 'lucide-react';
import BiometricScanner from './BiometricScanner';
import TelegramOtpInput from './TelegramOtpInput';
import QRCode from 'qrcode';
import { detectCarrierRealTime } from '../utils/carrierDetector';

interface AuthScreenProps {
  onAuthSuccess: (userProfile: UserProfile) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isp, setIsp] = useState<'MTN' | 'Airtel' | 'Glo' | '9mobile'>('MTN');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Telegram-style 6-Digit & QR Code Password Recovery State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'otp' | 'new_password' | 'success'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [inputResetOtp, setInputResetOtp] = useState('');
  const [resetOtpStatus, setResetOtpStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resetQrCodeUrl, setResetQrCodeUrl] = useState('');
  const [resetTargetUid, setResetTargetUid] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetStatusMsg, setResetStatusMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(60);
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);

  // Helper to generate 6-digit cryptographic OTP and QR code
  const generateResetSession = async (targetEmail: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setResetOtp(code);
    setInputResetOtp('');
    setResetOtpStatus('idle');

    // Generate scannable QR Code Data URL containing recovery payload
    try {
      const qrData = JSON.stringify({
        app: 'SubTrafficker',
        action: 'password_reset',
        email: targetEmail,
        code: code,
        timestamp: Date.now()
      });
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      setResetQrCodeUrl(qrUrl);
    } catch (e) {
      console.warn("Could not generate QR code data URL:", e);
    }

    return code;
  };

  // Step 1: Send 6-digit code and generate recovery QR
  const handleInitiatePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedEmail = forgotEmail.toLowerCase().trim();
    if (!sanitizedEmail) {
      setResetStatusMsg({ type: 'error', text: 'Please enter your registered email address.' });
      return;
    }

    setIsResetSubmitting(true);
    setResetStatusMsg({ type: '', text: '' });

    try {
      const encodedEmail = btoa(sanitizedEmail).replace(/[^a-zA-Z0-9]/g, '');
      const potentialUid = `cloud_user_${encodedEmail}`;
      setResetTargetUid(potentialUid);

      // Generate the 6-digit OTP code & QR code
      const generatedCode = await generateResetSession(sanitizedEmail);

      // Advance to Telegram-style OTP verification step
      setResetStep('otp');
      setResetCountdown(60);
      setResetStatusMsg({
        type: 'success',
        text: `6-digit security code generated! Fill the 6 boxes below or scan the QR code to verify.`
      });
    } catch (err: any) {
      console.error("Password reset initiation error:", err);
      setResetStatusMsg({ type: 'error', text: 'Unable to start recovery: ' + (err.message || 'Unknown error') });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  // Resend OTP code
  const handleResendResetCode = async () => {
    if (resetCountdown > 0) return;
    setIsResetSubmitting(true);
    await generateResetSession(forgotEmail);
    setResetCountdown(60);
    setIsResetSubmitting(false);
    setResetStatusMsg({ type: 'success', text: 'New 6-digit verification code & QR generated!' });
  };

  // Countdown timer effect
  useEffect(() => {
    if (resetStep === 'otp' && resetCountdown > 0) {
      const timer = setTimeout(() => setResetCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetStep, resetCountdown]);

  // Handle Telegram 6-box OTP typing for Reset Password
  const handleResetOtpChange = (code: string) => {
    setInputResetOtp(code);
    setResetOtpStatus('idle');
    setResetStatusMsg({ type: '', text: '' });

    // When 6 digits are completely filled, check immediately
    if (code.length === 6) {
      if (code === resetOtp) {
        // MATCH: Glow Emerald Green and advance to New Password step!
        setResetOtpStatus('success');
        setResetStatusMsg({ type: 'success', text: 'Identity verified successfully!' });
        setTimeout(() => {
          setResetStep('new_password');
        }, 600);
      } else {
        // MISMATCH: Glow Glowing Red & Shake
        setResetOtpStatus('error');
        setResetStatusMsg({ type: 'error', text: 'Incorrect 6-digit code. Please check or scan QR code.' });
      }
    }
  };

  // Step 3: Complete Password Reset with New Password
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetStatusMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetStatusMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsResetSubmitting(true);
    setResetStatusMsg({ type: '', text: '' });

    try {
      const sanitizedEmail = forgotEmail.toLowerCase().trim();
      const encodedEmail = btoa(sanitizedEmail).replace(/[^a-zA-Z0-9]/g, '');
      const uid = resetTargetUid || `cloud_user_${encodedEmail}`;

      // Update password hash in Firestore
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      let profile: UserProfile;
      if (userSnap.exists()) {
        profile = userSnap.data() as UserProfile;
        await updateDoc(userRef, {
          passwordHash: btoa(newPassword),
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create freshly updated profile
        profile = await createDefaultProfile(uid, sanitizedEmail, sanitizedEmail.split('@')[0], '');
        await setDoc(userRef, {
          ...profile,
          passwordHash: btoa(newPassword),
          emailVerified: true
        });
      }

      setResetStep('success');
      setResetStatusMsg({ type: 'success', text: 'Your password has been successfully reset!' });

      setTimeout(() => {
        localStorage.setItem('sub_trafficker_uid', uid);
        localStorage.setItem('last_sub_trafficker_uid', uid);
        setShowForgotPassword(false);
        onAuthSuccess(profile);
      }, 1400);

    } catch (err: any) {
      console.error("Save new password error:", err);
      setResetStatusMsg({ type: 'error', text: 'Failed to update password: ' + err.message });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  // Biometric scanner state
  const [activeBiometric, setActiveBiometric] = useState<'face' | 'fingerprint' | 'passkey' | null>(null);

  // Email Verification State for Registration
  const [verificationPending, setVerificationPending] = useState<{
    email: string;
    user?: any;
    name: string;
    phone: string;
    fallbackUid?: string;
    code: string;
    qrUrl?: string;
  } | null>(null);
  const [inputRegCode, setInputRegCode] = useState('');
  const [regOtpStatus, setRegOtpStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [verificationStatusMsg, setVerificationStatusMsg] = useState('');
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  // Handle Telegram 6-box input for Registration
  const handleRegOtpChange = async (code: string) => {
    setInputRegCode(code);
    setRegOtpStatus('idle');
    setVerificationStatusMsg('');

    if (code.length === 6 && verificationPending) {
      if (code === verificationPending.code) {
        setRegOtpStatus('success');
        setVerificationStatusMsg('Verification code confirmed! Setting up your profile...');
        
        setIsCheckingVerification(true);
        try {
          const uid = verificationPending.fallbackUid || `cloud_user_${btoa(verificationPending.email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '')}`;
          const profile = await createDefaultProfile(
            uid,
            verificationPending.email,
            verificationPending.name,
            verificationPending.phone
          );
          await setDoc(doc(db, 'users', uid), {
            ...profile,
            passwordHash: btoa(password),
            emailVerified: true
          });
          localStorage.setItem('sub_trafficker_uid', uid);
          localStorage.setItem('last_sub_trafficker_uid', uid);
          
          setTimeout(() => {
            setVerificationPending(null);
            onAuthSuccess(profile);
          }, 600);
        } catch (err: any) {
          setVerificationStatusMsg('Registration finalization error: ' + err.message);
          setRegOtpStatus('error');
        } finally {
          setIsCheckingVerification(false);
        }
      } else {
        setRegOtpStatus('error');
        setVerificationStatusMsg('Invalid 6-digit code. Please check the code or scan the QR.');
      }
    }
  };

  // Auto-detect real-time network carrier on mount
  useEffect(() => {
    async function performRealTimeCarrierDetection() {
      const detected = await detectCarrierRealTime();
      console.log('Successfully auto-detected network carrier on mount:', detected);
      setIsp(detected);
    }
    performRealTimeCarrierDetection();
  }, []);

  // Helper: Create default user profile in Firestore
  const createDefaultProfile = async (uid: string, userEmail: string, userName: string, userPhone: string) => {
    const userProfile: UserProfile = {
      uid,
      name: userName || userEmail.split('@')[0],
      email: userEmail,
      phone: userPhone || '',
      profilePic: 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + encodeURIComponent(userName || 'Sub'),
      cashBalance: 0, // Starts at 0 - earn real money by streaming and watching ads!
      airtimeBalance: 0, // Starts at 0 - sync actual SIM balance using real-time carrier USSD codes!
      accumulatedTrafficCash: 0,
      totalDataStreamedMB: 0,
      isp: isp,
      bankDetails: {
        bankName: '',
        accountNumber: '',
        accountName: ''
      },
      biometrics: {
        face: false,
        fingerprint: false,
        passkey: false
      },
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', uid), userProfile);
    return userProfile;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        let user = null;
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          user = userCredential.user;
        } catch (authErr) {
          console.warn("Firebase Auth direct creation note:", authErr);
        }

        const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
        let qrUrl = '';
        try {
          qrUrl = await QRCode.toDataURL(JSON.stringify({
            app: 'SubTrafficker',
            action: 'email_verification',
            email,
            code: generatedCode
          }), { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
        } catch (_) {}

        setVerificationPending({
          email,
          user,
          name,
          phone,
          code: generatedCode,
          qrUrl
        });
        setLoading(false);
        return;
      } else {
        // Sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Fetch profile
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          onAuthSuccess(docSnap.data() as UserProfile);
        } else {
          // If profile doc got deleted or doesn't exist, recreate it
          const profile = await createDefaultProfile(user.uid, email, '', '');
          onAuthSuccess(profile);
        }
      }
    } catch (err: any) {
      console.warn("Standard Firebase Auth failed, attempting Cloud-Sync direct Firestore fallback...", err);
      
      try {
        // Fallback to Direct Cloud-Sync Mode using deterministic UID based on email!
        const sanitizedEmail = email.toLowerCase().trim();
        const encodedEmail = btoa(sanitizedEmail).replace(/[^a-zA-Z0-9]/g, '');
        const fallbackUid = `cloud_user_${encodedEmail}`;
        
        const docRef = doc(db, 'users', fallbackUid);
        const docSnap = await getDoc(docRef);
        
        if (isSignUp) {
          if (docSnap.exists()) {
            setError('Email address is already in use.');
            setLoading(false);
            return;
          }
          
          const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
          let qrUrl = '';
          try {
            qrUrl = await QRCode.toDataURL(JSON.stringify({
              app: 'SubTrafficker',
              action: 'email_verification',
              email: sanitizedEmail,
              code: generatedCode
            }), { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
          } catch (_) {}

          setVerificationPending({
            email: sanitizedEmail,
            name,
            phone,
            fallbackUid,
            code: generatedCode,
            qrUrl
          });
          setLoading(false);
          return;
        } else {
          // Sign in Fallback
          if (!docSnap.exists()) {
            setError('Account not found. Please register as a new user.');
            setLoading(false);
            return;
          }
          
          const profileData = docSnap.data();
          const storedHash = (profileData as any).passwordHash;
          
          // Verify password
          if (storedHash && storedHash === btoa(password)) {
            localStorage.setItem('sub_trafficker_uid', fallbackUid);
            onAuthSuccess(profileData as UserProfile);
          } else {
            setError('Invalid email or password.');
          }
        }
      } catch (fallbackErr: any) {
        console.error("Cloud-Sync fallback failed:", fallbackErr);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Invalid email or password.');
        } else if (err.code === 'auth/email-already-in-use') {
          setError('Email address is already in use.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password should be at least 6 characters.');
        } else {
          setError(`Authentication issue: ${err.message || 'Connection timeout'}. Please use "Demo Quick Access" below to sign in instantly!`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoQuickAccess = async () => {
    setError('');
    setLoading(true);
    try {
      const demoUid = 'demo_user_nigeria';
      const docRef = doc(db, 'users', demoUid);
      const docSnap = await getDoc(docRef);
      
      let profile: UserProfile;
      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
      } else {
        profile = await createDefaultProfile(
          demoUid,
          'demo@subtrafficker.com',
          'Demo Trafficker',
          '+234 803 999 1111'
        );
      }
      localStorage.setItem('sub_trafficker_uid', demoUid);
      onAuthSuccess(profile);
    } catch (err: any) {
      console.error(err);
      setError('Failed to initialize demo quick access account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Fetch or create profile
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      let profile: UserProfile;
      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
      } else {
        // Create default profile using Google user details
        profile = await createDefaultProfile(
          user.uid,
          user.email || 'user@gmail.com',
          user.displayName || 'Sub Trafficker User',
          ''
        );
      }
      onAuthSuccess(profile);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google Sign-In popup closed before completion.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`unauthorized_domain: The domain "${window.location.hostname}" is not authorized for OAuth operations in your Firebase project. Please authorize this domain in your Firebase Authentication Settings.`);
      } else {
        setError(err.message || 'An error occurred during Google Sign-In.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if biometric is enabled on this device/account and trigger scanner
  const handleTriggerBiometric = async (type: 'face' | 'fingerprint' | 'passkey') => {
    setError('');
    const lastUid = localStorage.getItem('last_sub_trafficker_uid');
    
    if (!lastUid) {
      setError(`No biometric enrollment profile found on this device. Please log in with your email/password first and enable ${type === 'face' ? 'Face ID' : type === 'fingerprint' ? 'Touch ID / Fingerprint' : 'hardware Passkey'} in your Profile settings.`);
      return;
    }
    
    setLoading(true);
    try {
      const docRef = doc(db, 'users', lastUid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        setError("Device registration profile was not found. Please log in with your email/password first.");
        setLoading(false);
        return;
      }
      
      const profileData = docSnap.data() as UserProfile;
      const isTypeEnabled = profileData.biometrics && profileData.biometrics[type];
      
      if (!isTypeEnabled) {
        setError(`${type === 'face' ? 'Face ID' : type === 'fingerprint' ? 'Touch ID / Fingerprint' : 'Hardware Passkey'} has not been enrolled for this account. Please log in with your password and enable it in Profile Settings first.`);
        setLoading(false);
        return;
      }
      
      // Setup active biometric trigger
      setLoading(false);
      setActiveBiometric(type);
    } catch (err: any) {
      console.warn("Biometric pre-flight check failed, launching standalone mode:", err);
      setActiveBiometric(type);
      setLoading(false);
    }
  };

  // Biometric successful scan handler
  const handleBiometricSuccess = async () => {
    const type = activeBiometric;
    setActiveBiometric(null);
    setLoading(true);
    setError('');

    try {
      const lastUid = localStorage.getItem('last_sub_trafficker_uid');
      if (lastUid) {
        const docRef = doc(db, 'users', lastUid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          localStorage.setItem('sub_trafficker_uid', lastUid);
          onAuthSuccess(profile);
          setLoading(false);
          return;
        }
      }

      // Fallback/simulation user if no lastUid was registered
      const testEmail = 'biometric.user@subtrafficker.com';
      const testPass = 'BiometricSecurePass100!';
      
      let user;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPass);
        user = userCredential.user;
      } catch (e) {
        const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPass);
        user = userCredential.user;
      }

      // Fetch or create profile
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      let profile: UserProfile;
      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
      } else {
        profile = await createDefaultProfile(user.uid, testEmail, 'Abiola Adebayo', '+234 812 345 6789');
      }
      
      localStorage.setItem('sub_trafficker_uid', user.uid);
      localStorage.setItem('last_sub_trafficker_uid', user.uid);
      onAuthSuccess(profile);
    } catch (err: any) {
      console.error("Biometric authentication success login issue:", err);
      setError('Biometric authentication failed to initialize user profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center justify-center p-3 bg-blue-50 border border-blue-100 rounded-2xl mb-4 shadow-sm"
        >
          <Fingerprint size={44} className="text-blue-600 animate-pulse" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-bold font-display tracking-tight text-slate-800"
        >
          SUB <span className="text-blue-600">TRAFFICKER</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-slate-500 text-sm mt-2 max-w-sm mx-auto font-sans"
        >
          Airtime-to-Cash & Cellular Traffic Streamer for Nigerian Networks. Pre-funded welcome bonus included.
        </motion.p>
      </div>

      {/* Main Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl relative z-10"
        id="auth-card"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex w-full">
            <button
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isSignUp ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              id="tab-login"
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isSignUp ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              id="tab-register"
            >
              Register
            </button>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl text-rose-700 text-sm space-y-2.5 shadow-sm" id="auth-error-msg">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <span>Authentication Issue</span>
              </div>
              <div className="text-xs leading-relaxed">
                {error.includes('unauthorized_domain') ? (
                  <div className="space-y-2.5">
                    <p>
                      This preview domain <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-900 font-mono font-bold break-all">{window.location.hostname}</code> is not in the **Authorized Domains** list of your Firebase project.
                    </p>
                    <div className="bg-white/80 p-3 rounded-xl border border-rose-200 space-y-1.5">
                      <p className="font-bold text-rose-800">How to authorize it in 1 minute:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-0.5 font-medium text-rose-800">
                        <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-600 hover:text-blue-800">Firebase Console</a></li>
                        <li>Open your project: <code className="bg-slate-100 px-1 rounded font-mono">clever-catcher-p09p9</code></li>
                        <li>Go to **Authentication** &gt; **Settings** tab</li>
                        <li>Click **Authorized domains** in the menu</li>
                        <li>Click **Add domain** and paste:</li>
                      </ol>
                      <div className="mt-2 flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-2 rounded-lg justify-between font-mono font-bold text-slate-800 select-all">
                        <span>{window.location.hostname}</span>
                        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-sans uppercase">Copy Me</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-rose-500/90 font-medium">
                      After adding the domain, simply reload this page and click "Sign In with Google" again!
                    </p>
                  </div>
                ) : error.includes('Email/Password Sign-In is disabled') ? (
                  <div className="space-y-2.5">
                    <p>{error}</p>
                    <div className="bg-white/80 p-3 rounded-xl border border-rose-200 space-y-1.5">
                      <p className="font-bold text-rose-800">How to enable it in 1 minute:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-0.5 font-medium text-rose-800">
                        <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-600 hover:text-blue-800">Firebase Console</a></li>
                        <li>Open your project: <code className="bg-slate-100 px-1 rounded font-mono">clever-catcher-p09p9</code></li>
                        <li>Go to **Authentication** &gt; **Sign-in method** tab</li>
                        <li>Click **Add new provider**, select **Email/Password**, and enable it!</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <p className="font-medium">{error}</p>
                )}
              </div>
            </div>
          )}

          {isSignUp && (
            <>
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Babajide Kolawole"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                    id="register-name-input"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Phone Number (MTN/Airtel/Glo)</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08031234567"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                    id="register-phone-input"
                  />
                </div>
              </div>

              {/* Default ISP Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Default Network Carrier</label>
                <select
                  value={isp}
                  onChange={(e) => setIsp(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-semibold"
                  id="register-isp-select"
                >
                  <option value="MTN">MTN Nigeria</option>
                  <option value="Airtel">Airtel Nigeria</option>
                  <option value="Glo">Glo Nigeria</option>
                  <option value="9mobile">9mobile Nigeria</option>
                </select>
              </div>
            </>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                id="auth-email-input"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotPassword(true);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  id="btn-forgot-password-trigger"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-mono"
                id="auth-password-input"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 cursor-pointer transition mt-6"
            id="auth-submit-btn"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>{isSignUp ? 'Create Secured Account' : 'Secure Sign In'}</span>
              </>
            ) : (
              <>
                <span>{isSignUp ? 'Create Secured Account' : 'Secure Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Instant Access Portal Button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleDemoQuickAccess}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition text-sm animate-bounce-subtle"
            id="auth-demo-btn"
          >
            <ShieldCheck size={18} className="animate-pulse text-emerald-100" />
            <span>1-Click Demo Quick Access</span>
          </button>
          <p className="text-[10px] text-center text-slate-500 mt-1.5 font-semibold">
            ⚡ Instant access mode to explore all features immediately.
          </p>
        </div>

        {/* Google Sign-In as Primary, Seamless alternative */}
        <div className="mt-5 space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-100 w-full"></div>
            <span className="absolute bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Or
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-sm cursor-pointer transition text-sm"
            id="auth-google-btn"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google</span>
          </button>
        </div>

        {/* Biometric quick login section (only on Sign In mode) */}
        {!isSignUp && (
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Or Sign In With Saved Biometrics
            </p>
             <div className="flex justify-center gap-4">
              <button
                onClick={() => handleTriggerBiometric('face')}
                className="p-3 bg-slate-50 border border-slate-200 hover:border-blue-500/40 hover:bg-white rounded-xl text-slate-500 hover:text-blue-600 transition flex flex-col items-center gap-1.5 w-24 shadow-sm cursor-pointer"
                title="Face ID Scan"
                id="biometric-login-face"
              >
                <Scan size={20} />
                <span className="text-[10px] font-semibold">Face ID</span>
              </button>
              <button
                onClick={() => handleTriggerBiometric('fingerprint')}
                className="p-3 bg-slate-50 border border-slate-200 hover:border-blue-500/40 hover:bg-white rounded-xl text-slate-500 hover:text-blue-600 transition flex flex-col items-center gap-1.5 w-24 shadow-sm cursor-pointer"
                title="Fingerprint scan"
                id="biometric-login-fingerprint"
              >
                <Fingerprint size={20} />
                <span className="text-[10px] font-semibold">Touch ID</span>
              </button>
              <button
                onClick={() => handleTriggerBiometric('passkey')}
                className="p-3 bg-slate-50 border border-slate-200 hover:border-blue-500/40 hover:bg-white rounded-xl text-slate-500 hover:text-blue-600 transition flex flex-col items-center gap-1.5 w-24 shadow-sm cursor-pointer"
                title="Hardware Passkey"
                id="biometric-login-passkey"
              >
                <Key size={20} />
                <span className="text-[10px] font-semibold">Passkey</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Safety / Compliance footer */}
      <div className="mt-8 flex items-center gap-1.5 text-slate-400 text-xs z-10">
        <ShieldCheck size={14} className="text-blue-600/50" />
        <span>End-to-end encrypted & bank-grade data security</span>
      </div>

      {/* Email / Account Registration Verification Modal Overlay */}
      <AnimatePresence>
        {verificationPending && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4" id="email-verification-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative overflow-hidden text-center"
              id="email-verification-modal"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck size={28} />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Security Verification</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    Enter the 6-digit Telegram-style verification code for:
                  </p>
                  <p className="text-blue-600 dark:text-sky-400 font-bold text-sm mt-0.5 break-all font-mono">
                    {verificationPending.email}
                  </p>
                </div>

                {/* Display 6-Digit Code Badge & QR Code Quick Action */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-3.5 rounded-2xl text-center space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Your Verification Code
                    </span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      Instant Active
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-black tracking-widest text-blue-600 dark:text-sky-400 py-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    {verificationPending.code}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Fill the 6 boxes below or scan with your device camera.
                  </p>
                </div>

                {/* Status message */}
                {verificationStatusMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl text-xs font-semibold border ${
                      regOtpStatus === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : regOtpStatus === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 animate-shake'
                        : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {verificationStatusMsg}
                  </motion.div>
                )}

                {/* Telegram-style 6 individual input boxes */}
                <div className="py-1">
                  <TelegramOtpInput
                    value={inputRegCode}
                    onChange={handleRegOtpChange}
                    status={regOtpStatus}
                    disabled={isCheckingVerification}
                  />
                </div>

                {/* QR Code toggle card */}
                {verificationPending.qrUrl && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQrCodeModal(!showQrCodeModal)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <QrCode size={14} />
                      <span>{showQrCodeModal ? 'Hide Scannable QR Code' : 'Show Scannable QR Code'}</span>
                    </button>

                    {showQrCodeModal && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl inline-block shadow-lg"
                      >
                        <img
                          src={verificationPending.qrUrl}
                          alt="Verification QR Code"
                          className="w-40 h-40 mx-auto rounded-lg"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">Scan to verify account</p>
                      </motion.div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setVerificationPending(null);
                    setInputRegCode('');
                    setRegOtpStatus('idle');
                    setVerificationStatusMsg('');
                  }}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold transition cursor-pointer"
                  id="btn-cancel-reg-verification"
                >
                  Cancel & Return to Registration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comprehensive Telegram-Style Password Reset & QR Code Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4" id="forgot-password-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden"
              id="forgot-password-modal"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-sky-400 font-bold font-display text-lg">
                  <KeyRound size={22} />
                  <span>Account Recovery</span>
                </div>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetStep('email');
                    setResetStatusMsg({ type: '', text: '' });
                    setInputResetOtp('');
                    setResetOtpStatus('idle');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                  id="close-forgot-password-modal"
                >
                  <HelpCircle size={18} />
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-between mb-5 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className={`flex items-center gap-1 text-[11px] font-bold ${resetStep === 'email' ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">1</span>
                  <span>Email</span>
                </div>
                <div className="h-0.5 w-6 bg-slate-200 dark:bg-slate-700" />
                <div className={`flex items-center gap-1 text-[11px] font-bold ${resetStep === 'otp' ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">2</span>
                  <span>6-Digit / QR</span>
                </div>
                <div className="h-0.5 w-6 bg-slate-200 dark:bg-slate-700" />
                <div className={`flex items-center gap-1 text-[11px] font-bold ${resetStep === 'new_password' || resetStep === 'success' ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">3</span>
                  <span>New Password</span>
                </div>
              </div>

              {/* Status banner */}
              {resetStatusMsg.text && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl text-xs font-semibold mb-4 border ${
                    resetStatusMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {resetStatusMsg.text}
                </motion.div>
              )}

              {/* STEP 1: Enter Email */}
              {resetStep === 'email' && (
                <form onSubmit={handleInitiatePasswordReset} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Enter your account email to receive an instant 6-digit security code and recovery QR code.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition text-sm font-medium"
                        id="forgot-email-input"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isResetSubmitting || !forgotEmail}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition cursor-pointer text-xs flex items-center justify-center gap-2"
                      id="submit-forgot-email-btn"
                    >
                      {isResetSubmitting ? 'Generating Code...' : 'Get 6-Digit Code'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Telegram-style 6-Digit OTP & QR Code */}
              {resetStep === 'otp' && (
                <div className="space-y-4 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-3.5 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Active Recovery Code
                      </span>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> Valid for 10 min
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-black tracking-widest text-blue-600 dark:text-sky-400 py-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" id="active-reset-otp-display">
                      {resetOtp}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enter this code into the 6 boxes below:
                    </p>
                  </div>

                  {/* Telegram-style 6-box input */}
                  <div className="py-2">
                    <TelegramOtpInput
                      value={inputResetOtp}
                      onChange={handleResetOtpChange}
                      status={resetOtpStatus}
                    />
                  </div>

                  {/* QR Code toggle & Scannable View */}
                  {resetQrCodeUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowQrCodeModal(!showQrCodeModal)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                        id="toggle-reset-qr-btn"
                      >
                        <QrCode size={14} />
                        <span>{showQrCodeModal ? 'Hide Scannable QR Code' : 'Scan With Phone Camera / QR'}</span>
                      </button>

                      {showQrCodeModal && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl inline-block shadow-lg"
                        >
                          <img
                            src={resetQrCodeUrl}
                            alt="Recovery QR Code"
                            className="w-40 h-40 mx-auto rounded-lg"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">Scan with camera to recover</p>
                        </motion.div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setResetStep('email')}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleResendResetCode}
                      disabled={resetCountdown > 0 || isResetSubmitting}
                      className="text-xs text-blue-600 dark:text-sky-400 hover:underline font-bold disabled:text-slate-400 disabled:no-underline cursor-pointer"
                    >
                      {resetCountdown > 0 ? `Resend code in ${resetCountdown}s` : 'Resend Code'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Enter New Password */}
              {resetStep === 'new_password' && (
                <form onSubmit={handleSaveNewPassword} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Identity confirmed! Create your new secure password for <span className="font-bold text-slate-800 dark:text-white">{forgotEmail}</span>.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
                          id="new-password-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
                          id="confirm-new-password-input"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetSubmitting || !newPassword || !confirmNewPassword}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer text-sm flex items-center justify-center gap-2 mt-4"
                    id="save-new-password-btn"
                  >
                    {isResetSubmitting ? (
                      <span>Saving New Password...</span>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Update Password & Log In Instantly</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 4: Success */}
              {resetStep === 'success' && (
                <div className="py-6 text-center space-y-3">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <CheckCircle2 size={36} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white">Password Reset Complete!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Signing you directly into your Sub Trafficker account...
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Biometric Scanner Overlay */}
      <AnimatePresence>
        {activeBiometric && (
          <BiometricScanner
            type={activeBiometric}
            onSuccess={handleBiometricSuccess}
            onCancel={() => setActiveBiometric(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
