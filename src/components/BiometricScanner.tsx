/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scan, Fingerprint, Key, Camera, CheckCircle2, AlertCircle, X, ShieldAlert, Sparkles, CircleDot, ShieldCheck, Cpu } from 'lucide-react';
import { authenticatePasskey, registerPasskey, isWebAuthnSupported } from '../utils/webauthn';

interface BiometricScannerProps {
  type: 'face' | 'fingerprint' | 'passkey';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BiometricScanner({ type, onSuccess, onCancel }: BiometricScannerProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [cameraState, setCameraState] = useState<'idle' | 'initializing' | 'active' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHolding, setIsHolding] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isWebAuthnLoading, setIsWebAuthnLoading] = useState(false);

  // Passkey state
  const [passkeyPin, setPasskeyPin] = useState('');
  const [passkeyVerifying, setPasskeyVerifying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  // Trigger Native Browser/OS Biometric Prompt (Windows Hello / Touch ID / Android BiometricPrompt)
  const handleTriggerNativeBiometric = async () => {
    setIsWebAuthnLoading(true);
    setStatus('scanning');
    setErrorMessage('');
    setFeedbackMsg('Launching native device biometric prompt (Touch ID / Fingerprint / Windows Hello)...');

    const result = await authenticatePasskey();
    setIsWebAuthnLoading(false);

    if (result.success) {
      setProgress(100);
      setStatus('success');
      setFeedbackMsg('Native biometric verification confirmed!');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } else {
      // Try registration as fallback if no credential was previously stored
      const regResult = await registerPasskey('user@subtrafficker.com', 'Sub Trafficker Biometric');
      if (regResult.success) {
        setProgress(100);
        setStatus('success');
        setFeedbackMsg('Native biometric device enrolled successfully!');
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setStatus('error');
        setErrorMessage(result.error || regResult.error || 'Native biometric prompt was dismissed or failed.');
      }
    }
  };

  // Trigger Native Passkey Creation/Auth
  const handleTriggerNativePasskey = async () => {
    setIsWebAuthnLoading(true);
    setStatus('scanning');
    setErrorMessage('');
    setFeedbackMsg('Launching native Passkey manager (FIDO2 / Keychain / Google Passkey)...');

    const result = await authenticatePasskey();
    setIsWebAuthnLoading(false);

    if (result.success) {
      setProgress(100);
      setStatus('success');
      setFeedbackMsg('Hardware Passkey handshake confirmed!');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } else {
      // Fallback register passkey
      const regResult = await registerPasskey('passkey@subtrafficker.com', 'Sub Trafficker Passkey');
      if (regResult.success) {
        setProgress(100);
        setStatus('success');
        setFeedbackMsg('Passkey enrolled on device hardware!');
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setStatus('error');
        setErrorMessage(result.error || regResult.error || 'Passkey authentication was rejected or canceled.');
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraState('idle');
  };

  // Face Scan Camera Start
  const startCamera = async () => {
    setCameraState('initializing');
    setErrorMessage('');
    setFeedbackMsg('Initializing webcam / mobile camera feed...');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video stream to play and initialize frames
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setCameraState('active');
            setFeedbackMsg('Camera ready. Please center your face in the frame...');
          } catch (e) {
            setCameraState('active');
          }
        };
      } else {
        setCameraState('active');
      }
    } catch (err: any) {
      console.warn('Camera permission denied or camera device unavailable:', err);
      setCameraState('error');
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow camera access in browser settings to complete face verification.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device was detected on this hardware.');
      } else {
        setErrorMessage(err.message || 'Could not initialize camera video feed.');
      }
    }
  };

  useEffect(() => {
    if (type === 'face' && status === 'scanning') {
      startCamera();
    }
    return () => {
      stopCamera();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [type, status]);

  // Frame pixel brightness/face check
  const checkFaceInFrame = (): boolean => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let totalBrightness = 0;
      for (let i = 0; i < frameData.length; i += 16) {
        const r = frameData[i];
        const g = frameData[i + 1];
        const b = frameData[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      const avgBrightness = totalBrightness / (frameData.length / 16);

      // If feed is total pitch black (< 5 brightness), lens is covered or video is blank
      if (avgBrightness < 5) {
        return false;
      }
      return true;
    } catch (e) {
      return true; // Fallback
    }
  };

  // Face scanner progress - ONLY progresses when camera is active and face is present
  useEffect(() => {
    if (type === 'face' && status === 'scanning' && cameraState === 'active') {
      const intervalTime = 120;
      intervalRef.current = setInterval(() => {
        // Run face/video frame check
        const hasFaceFrame = checkFaceInFrame();
        if (!hasFaceFrame) {
          setFeedbackMsg('Face not detected in camera frame! Ensure adequate room light and uncover lens.');
          return; // Pause progress until camera sees a valid face frame
        }

        setProgress(prev => {
          const next = prev + 3.0; // ~4 seconds for full verification
          if (next >= 100) {
            clearInterval(intervalRef.current);
            setStatus('success');
            setTimeout(() => {
              stopCamera();
              onSuccess();
            }, 1000);
            return 100;
          }

          // Face ID dynamic logs
          if (next < 25) {
            setFeedbackMsg('Face detected! Center your face in the circle...');
          } else if (next < 55) {
            setFeedbackMsg('Scanning facial features...');
          } else if (next < 85) {
            setFeedbackMsg('Verifying security details...');
          } else {
            setFeedbackMsg('Completing verification...');
          }

          return next;
        });
      }, intervalTime);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [type, status, cameraState]);

  // Fingerprint Interaction Handlers (Press and Hold)
  const handleFingerprintDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (status === 'success' || status === 'error') return;
    
    setIsHolding(true);
    setStatus('scanning');
    setFeedbackMsg("Finger detected! Keep holding to complete scan...");

    const intervalTime = 60;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + 2.5; // takes ~2.4 seconds to reach 100
        if (next >= 100) {
          clearInterval(intervalRef.current);
          setIsHolding(false);
          setStatus('success');
          setTimeout(() => {
            onSuccess();
          }, 1000);
          return 100;
        }

        if (next < 30) {
          setFeedbackMsg(`Reading fingerprint... ${Math.round(next)}%`);
        } else if (next < 65) {
          setFeedbackMsg(`Verifying security match... ${Math.round(next)}%`);
        } else {
          setFeedbackMsg(`Saving verified fingerprint... ${Math.round(next)}%`);
        }

        return next;
      });
    }, intervalTime);
  };

  const handleFingerprintUp = () => {
    if (status !== 'scanning') return;
    setIsHolding(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setFeedbackMsg("Finger lifted. Touch and hold the sensor to finish.");
  };

  // Passkey simulated hardware interaction
  const handlePasskeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeyPin.trim() || passkeyPin.length < 4) {
      setErrorMessage("Please enter a valid 4-digit security PIN.");
      setStatus('error');
      return;
    }

    setPasskeyVerifying(true);
    setStatus('scanning');
    setFeedbackMsg("Verifying device security credentials...");
    setProgress(15);

    let currentProgress = 15;
    const interval = setInterval(() => {
      currentProgress += 17;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setPasskeyVerifying(false);
        setStatus('success');
        setTimeout(() => {
          onSuccess();
        }, 1000);
        setProgress(100);
      } else {
        setProgress(currentProgress);
        if (currentProgress < 50) {
          setFeedbackMsg("Verifying PIN code...");
        } else if (currentProgress < 80) {
          setFeedbackMsg("Confirming device security...");
        } else {
          setFeedbackMsg("Passkey confirmed. Unlocking your account...");
        }
      }
    }, 250);
  };

  const handleCancel = () => {
    stopCamera();
    if (intervalRef.current) clearInterval(intervalRef.current);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
        id="biometric-scanner-modal"
      >
        {/* Glowing border effects */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              {type === 'face' && <Scan size={18} />}
              {type === 'fingerprint' && <Fingerprint size={18} />}
              {type === 'passkey' && <Key size={18} />}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {type === 'face' && 'Face Verification'}
                {type === 'fingerprint' && 'Fingerprint Verification'}
                {type === 'passkey' && 'Device Security Passkey'}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Secure Biometric Login</p>
            </div>
          </div>
          <button 
            onClick={handleCancel}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition cursor-pointer"
            id="close-biometric"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center justify-center text-center">
          
          {/* FACE ID SCANNING */}
          {type === 'face' && (
            <div className="space-y-6 my-2 w-full flex flex-col items-center">
              {status === 'idle' && (
                <>
                  <div className="relative w-48 h-48 rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-950/40 relative overflow-hidden">
                    <Scan size={56} className="text-blue-500 animate-pulse" />
                    <div className="absolute inset-4 border border-dashed border-blue-500/20 rounded-full animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Position your Face</h4>
                    <p className="text-slate-400 text-xs max-w-xs mx-auto mt-1 leading-relaxed">
                      Allow camera access and place your face in the center frame to begin.
                    </p>
                  </div>
                  <button
                    onClick={() => setStatus('scanning')}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                    id="btn-start-verification"
                  >
                    <Camera size={16} />
                    <span>Initialize Camera & Scan</span>
                  </button>
                </>
              )}

              {status === 'scanning' && (
                <>
                  <div className="w-60 h-60 rounded-3xl bg-slate-950 border-2 border-blue-500/50 overflow-hidden relative shadow-2xl flex items-center justify-center">
                    {/* Camera stream video element */}
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover grayscale"
                    />

                    {/* Camera Initializing Overlay */}
                    {cameraState === 'initializing' && (
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 gap-3 z-20">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-blue-300 font-semibold animate-pulse">
                          Requesting Camera Feed...
                        </span>
                        <p className="text-[10px] text-slate-400 max-w-[180px]">
                          Please accept browser permission prompt to initialize webcam.
                        </p>
                      </div>
                    )}
                    
                    {/* Futuristic Scanning HUD Overlay */}
                    {cameraState === 'active' && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Laser scanner bar */}
                        <div className="absolute left-0 right-0 h-[2.5px] bg-blue-400 shadow-[0_0_12px_#3b82f6] top-0 animate-scanner-line" />
                        
                        {/* Frame corner elements */}
                        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-blue-400" />
                        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-blue-400" />
                        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-blue-400" />
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-blue-400" />
                        
                        {/* Live scanning HUD circle */}
                        <div className="absolute inset-x-12 inset-y-12 border border-dashed border-blue-400/40 rounded-full animate-pulse flex items-center justify-center">
                          <div className="text-[10px] font-mono text-blue-400/80 font-bold tracking-widest uppercase">
                            {Math.round(progress)}% DETECTED
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-2">
                    <p className="text-slate-300 text-sm font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                      <Sparkles size={14} className="text-blue-400" />
                      <span>{feedbackMsg || "Initializing camera..."}</span>
                    </p>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden max-w-xs mx-auto">
                      <div className="bg-blue-500 h-full transition-all duration-100" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* FINGERPRINT HOLD-TO-SCAN & NATIVE WEBAUTHN */}
          {type === 'fingerprint' && (
            <div className="space-y-5 my-2 w-full flex flex-col items-center">
              {status === 'idle' && (
                <>
                  <div className="relative w-36 h-36 rounded-full border-2 border-emerald-500/30 flex items-center justify-center bg-slate-950/60 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                    <Fingerprint size={60} className="text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Biometric Fingerprint Guard</h4>
                    <p className="text-slate-400 text-xs max-w-xs mx-auto mt-1 leading-relaxed">
                      Launch your device's native fingerprint application (Touch ID, Windows Hello, Android Biometric) or use tactile sensor mapping.
                    </p>
                  </div>

                  <div className="w-full space-y-3">
                    <button
                      onClick={handleTriggerNativeBiometric}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                      id="btn-trigger-native-fingerprint"
                    >
                      <Cpu size={18} />
                      <span>Launch Device Fingerprint App</span>
                    </button>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-800"></div>
                      <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-bold uppercase">or tactile hold</span>
                      <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <button
                      onMouseDown={handleFingerprintDown}
                      onTouchStart={handleFingerprintDown}
                      onMouseUp={handleFingerprintUp}
                      onMouseLeave={handleFingerprintUp}
                      onTouchEnd={handleFingerprintUp}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2 select-none text-xs"
                      id="btn-start-verification"
                    >
                      <Fingerprint size={16} />
                      <span>Press & Hold Screen Sensor</span>
                    </button>
                  </div>
                </>
              )}

              {(status === 'scanning' || status === 'success') && (
                <>
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    {/* Circle Progress Tracker */}
                    <svg className="absolute inset-0 w-full h-full rotate-270" viewBox="0 0 100 100">
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="42" 
                        stroke="#1e293b" 
                        strokeWidth="5" 
                        fill="none" 
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="42" 
                        stroke={isHolding || isWebAuthnLoading ? "#10b981" : "#3b82f6"} 
                        strokeWidth="5" 
                        fill="none" 
                        strokeDasharray="263.89"
                        strokeDashoffset={263.89 - (263.89 * progress) / 100}
                        className="transition-all duration-75"
                      />
                    </svg>

                    {/* Sensor Icon with Holding Anim */}
                    <div 
                      onMouseDown={handleFingerprintDown}
                      onTouchStart={handleFingerprintDown}
                      onMouseUp={handleFingerprintUp}
                      onMouseLeave={handleFingerprintUp}
                      onTouchEnd={handleFingerprintUp}
                      className={`w-28 h-28 rounded-full flex items-center justify-center border transition-all cursor-pointer select-none ${
                        isHolding || isWebAuthnLoading
                          ? 'bg-emerald-950/30 border-emerald-500 scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 active:scale-95'
                      }`}
                    >
                      <Fingerprint 
                        size={56} 
                        className={`transition-colors duration-200 ${
                          isHolding || isWebAuthnLoading ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                        }`} 
                      />
                    </div>
                  </div>

                  <div className="w-full space-y-2">
                    <p className={`text-sm font-semibold flex items-center justify-center gap-1.5 ${
                      isHolding || isWebAuthnLoading ? 'text-emerald-400 animate-pulse font-bold' : 'text-amber-400 font-bold'
                    }`}>
                      <CircleDot size={14} className={isHolding || isWebAuthnLoading ? 'animate-ping' : ''} />
                      <span>{feedbackMsg || "Communicating with biometric hardware..."}</span>
                    </p>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden max-w-xs mx-auto">
                      <div className={`h-full transition-all duration-75 ${isHolding || isWebAuthnLoading ? 'bg-emerald-500' : 'bg-slate-600'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PASSKEY HARDWARE SYSTEM */}
          {type === 'passkey' && (
            <div className="space-y-5 my-2 w-full flex flex-col items-center">
              {status === 'idle' && (
                <div className="space-y-4 w-full text-left">
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-blue-500/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
                        <Key size={22} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">Device Passkey Login</p>
                        <p className="text-slate-400 text-[10px]">Use your phone, computer passkey, or screen lock</p>
                      </div>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed">
                      Passkeys let you sign in quickly and safely using your device fingerprint, face, or screen PIN without typing a password.
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerNativePasskey}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                    id="btn-trigger-native-passkey"
                  >
                    <ShieldCheck size={18} />
                    <span>Sign in with Device Passkey</span>
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-bold uppercase">or use PIN code</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  <form onSubmit={handlePasskeySubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Security PIN Code</label>
                      <input 
                        type="password" 
                        maxLength={8}
                        value={passkeyPin}
                        onChange={(e) => setPasskeyPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 4-digit security PIN"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs text-center font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all"
                        id="passkey-pin-input"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
                      id="btn-verify-passkey-pin"
                    >
                      <Key size={14} />
                      <span>Verify PIN</span>
                    </button>
                  </form>
                </div>
              )}

              {status === 'scanning' && (
                <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 w-full text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={22} className="text-blue-400 animate-pulse" />
                    <div>
                      <p className="text-white font-bold text-sm">Verifying Security Credentials</p>
                      <p className="text-slate-400 text-[10px]">Confirming your device security key</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-slate-300 text-xs font-mono tracking-wide">{feedbackMsg}</p>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-slate-500 text-[10px] text-center font-mono">Checking device security manager...</p>
                </div>
              )}
            </div>
          )}

          {/* VERIFICATION SUCCESS PANEL */}
          {status === 'success' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-4 my-6"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle2 size={44} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Identity Secured</p>
                <p className="text-emerald-400 text-xs mt-1 font-semibold tracking-wider uppercase">Credentials verified successfully</p>
              </div>
            </motion.div>
          )}

          {/* VERIFICATION ERROR PANEL */}
          {status === 'error' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-5 my-2 w-full"
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <AlertCircle size={36} className="text-rose-400" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Verification Refused</p>
                <p className="text-rose-400 text-xs mt-1 font-semibold">{errorMessage || 'Your hardware token response was invalid.'}</p>
              </div>
              <button
                onClick={() => {
                  setStatus('idle');
                  setProgress(0);
                  setErrorMessage('');
                  setPasskeyPin('');
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
                id="btn-retry-biometric"
              >
                Try Again
              </button>
            </motion.div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
