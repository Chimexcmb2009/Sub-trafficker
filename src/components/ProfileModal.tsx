/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ISPName } from '../types';
import { NIGERIAN_BANKS, AVATAR_TEMPLATES, NIGERIAN_BANK_CODES } from '../data';
import { X, User, Phone, Landmark, CreditCard, Shield, Camera, CheckCircle2, Fingerprint, Scan, Key, RefreshCw, Globe, MessageSquare, Image, ShieldCheck, Upload } from 'lucide-react';
import BiometricScanner from './BiometricScanner';
import { registerPasskey } from '../utils/webauthn';

interface ProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
}

const NATIONALITIES = [
  { code: 'NG', name: 'Nigeria 🇳🇬' },
  { code: 'GH', name: 'Ghana 🇬🇭' },
  { code: 'KE', name: 'Kenya 🇰🇪' },
  { code: 'ZA', name: 'South Africa 🇿🇦' },
  { code: 'GB', name: 'United Kingdom 🇬🇧' },
  { code: 'US', name: 'United States 🇺🇸' },
  { code: 'CA', name: 'Canada 🇨🇦' },
  { code: 'DE', name: 'Germany 🇩🇪' },
  { code: 'FR', name: 'France 🇫🇷' },
  { code: 'OTHER', name: 'Other International 🌍' }
];

const STATUS_PRESETS = [
  'Sharing Traffic & Earning 🚀',
  'Online & Sharing Data 📶',
  'Account Secured 🛡️',
  'High Speed Data Provider 🌐',
  'Earning Daily Rewards 💰',
  'On the Move 📱'
];

export default function ProfileModal({ profile, onClose, onUpdate }: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [avatar, setAvatar] = useState(profile.profilePic);
  const [status, setStatus] = useState(profile.status || STATUS_PRESETS[0]);
  const [nationality, setNationality] = useState(profile.nationality || 'Nigeria 🇳🇬');
  const [bio, setBio] = useState(profile.bio || '');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);
  const [isp, setIsp] = useState<ISPName>(profile.isp);
  
  // Bank details
  const [bankName, setBankName] = useState(profile.bankDetails.bankName || NIGERIAN_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState(profile.bankDetails.accountNumber);
  const [accountName, setAccountName] = useState(profile.bankDetails.accountName);

  // Passkey enrollment state
  const [isPasskeyRegistering, setIsPasskeyRegistering] = useState(false);

  // Paystack verification states
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [resolveSuccess, setResolveSuccess] = useState(false);

  const handleResolveAccountName = async () => {
    setResolveError('');
    setResolveSuccess(false);
    
    if (!accountNumber || accountNumber.length !== 10) {
      setResolveError('Please enter a valid 10-digit bank account number.');
      return;
    }
    
    const bankCode = NIGERIAN_BANK_CODES[bankName];
    if (!bankCode) {
      setResolveError(`Could not find routing code for selected bank.`);
      return;
    }

    setIsResolving(true);
    try {
      const response = await fetch('/api/paystack/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode })
      });
      const data = await response.json();
      if (response.ok && data.status && data.accountName) {
        setAccountName(data.accountName);
        setResolveSuccess(true);
      } else {
        setResolveError(data.message || 'Bank verification failed. Please check your account number.');
      }
    } catch (err: any) {
      setResolveError('Could not verify bank account. Please check your internet connection.');
    } finally {
      setIsResolving(false);
    }
  };

  // ISP Connection auto-detection states
  const [isDetectingIsp, setIsDetectingIsp] = useState(false);
  const [detectedIspMsg, setDetectedIspMsg] = useState('');

  const handleAutoDetectIsp = async () => {
    setIsDetectingIsp(true);
    setDetectedIspMsg('');
    try {
      const { detectCarrierRealTime } = await import('../utils/carrierDetector');
      const detected = await detectCarrierRealTime();
      setIsp(detected);
      setDetectedIspMsg(`Real-time connection identified as ${detected} Nigeria!`);
      setTimeout(() => setDetectedIspMsg(''), 4000);
    } catch (e) {
      setDetectedIspMsg('Failed to detect connection. Please select manually.');
    } finally {
      setIsDetectingIsp(false);
    }
  };

  // Biometrics settings
  const [faceEnabled, setFaceEnabled] = useState(profile.biometrics.face);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(profile.biometrics.fingerprint);
  const [passkeyEnabled, setPasskeyEnabled] = useState(profile.biometrics.passkey);

  const [activeScanner, setActiveScanner] = useState<'face' | 'fingerprint' | 'passkey' | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleToggleFace = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setActiveScanner('face');
    } else {
      setFaceEnabled(false);
    }
  };

  const handleToggleFingerprint = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setActiveScanner('fingerprint');
    } else {
      setFingerprintEnabled(false);
    }
  };

  const handleTogglePasskey = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setActiveScanner('passkey');
    } else {
      setPasskeyEnabled(false);
    }
  };

  const handleScannerSuccess = async () => {
    const scannerType = activeScanner;
    if (!scannerType) return;

    let targetFace = faceEnabled;
    let targetFingerprint = fingerprintEnabled;
    let targetPasskey = passkeyEnabled;

    if (scannerType === 'face') {
      targetFace = true;
      setFaceEnabled(true);
    } else if (scannerType === 'fingerprint') {
      targetFingerprint = true;
      setFingerprintEnabled(true);
    } else if (scannerType === 'passkey') {
      targetPasskey = true;
      setPasskeyEnabled(true);
    }

    setActiveScanner(null);
    setMessage(`Setting up ${scannerType === 'face' ? 'Face ID' : scannerType === 'fingerprint' ? 'Fingerprint' : 'PIN / Passkey'}...`);

    try {
      const updatedProfile: UserProfile = {
        ...profile,
        biometrics: {
          face: targetFace,
          fingerprint: targetFingerprint,
          passkey: targetPasskey
        }
      };

      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        biometrics: {
          face: targetFace,
          fingerprint: targetFingerprint,
          passkey: targetPasskey
        }
      });

      // Update parent state instantly
      onUpdate(updatedProfile);
      setMessage(`${scannerType === 'face' ? 'Face ID' : scannerType === 'fingerprint' ? 'Fingerprint' : 'PIN / Passkey'} security updated successfully!`);
    } catch (err: any) {
      console.error("Failed to automatically persist biometric configuration:", err);
      setMessage(`Updated ${scannerType === 'face' ? 'Face ID' : scannerType === 'fingerprint' ? 'Fingerprint' : 'Passkey'}. Please click "Save Settings" to save changes.`);
    }

    setTimeout(() => setMessage(''), 5000);
  };

  const handleEnrollPasskeyDirect = async () => {
    setIsPasskeyRegistering(true);
    setMessage('');
    const res = await registerPasskey(profile.email, name);
    setIsPasskeyRegistering(false);
    if (res.success) {
      setPasskeyEnabled(true);
      setMessage('Security Passkey registered successfully on this device!');
      if (res.credentialId) {
        try {
          await updateDoc(doc(db, 'users', profile.uid), {
            passkeyCredentialId: res.credentialId,
            'biometrics.passkey': true
          });
          onUpdate({
            ...profile,
            passkeyCredentialId: res.credentialId,
            biometrics: { ...profile.biometrics, passkey: true }
          });
        } catch (e) {
          console.warn('Could not persist passkey credentialId:', e);
        }
      }
    } else {
      setMessage(`Passkey setup notice: ${res.error}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const activeAvatar = customAvatarUrl.trim() || avatar;

      const updatedProfile: UserProfile = {
        ...profile,
        name,
        phone,
        profilePic: activeAvatar,
        status,
        nationality,
        bio,
        isp,
        bankDetails: {
          bankName,
          accountNumber,
          accountName
        },
        biometrics: {
          face: faceEnabled,
          fingerprint: fingerprintEnabled,
          passkey: passkeyEnabled
        }
      };

      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        name,
        phone,
        profilePic: activeAvatar,
        status,
        nationality,
        bio,
        isp,
        bankDetails: {
          bankName,
          accountNumber,
          accountName
        },
        biometrics: {
          face: faceEnabled,
          fingerprint: fingerprintEnabled,
          passkey: passkeyEnabled
        }
      });

      onUpdate(updatedProfile);
      setMessage('Profile settings updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to save profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-40 p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-8"
        id="profile-modal"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark size={20} className="text-blue-600" />
            <h3 className="font-bold font-display text-slate-800 text-lg">Account Profile Settings</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition"
            id="close-profile-modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-xl text-sm flex items-center gap-2 ${message.includes('successfully') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`} id="profile-success-msg">
              <CheckCircle2 size={16} />
              <span>{message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Basic Details & Avatar */}
            <div className="space-y-5">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-blue-600" /> Basic Information
              </h4>

              {/* Avatar Drag-and-Drop & File Upload Selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
                <div className="relative mb-3 group">
                  <img 
                    src={avatar} 
                    alt="Profile Avatar" 
                    className="w-20 h-20 rounded-2xl border-2 border-blue-500/30 bg-slate-100 object-cover shadow-md" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1.5 rounded-lg border-2 border-white shadow-sm">
                    <Camera size={12} />
                  </div>
                </div>

                {/* Drag and Drop Zone / Direct Upload */}
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setAvatar(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 p-3 rounded-2xl transition text-center cursor-pointer mb-3"
                  onClick={() => {
                    const el = document.getElementById('profile-file-uploader') as HTMLInputElement;
                    if (el) el.click();
                  }}
                >
                  <input
                    type="file"
                    id="profile-file-uploader"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setAvatar(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={18} className="text-blue-600 animate-bounce" />
                    <p className="text-xs font-bold text-slate-700">Drag & Drop or Click to Upload Profile Photo</p>
                    <p className="text-[10px] text-slate-400">Supports PNG, JPG, WEBP (Max 5MB)</p>
                  </div>
                </div>

                <div className="w-full space-y-2">
                  <p className="text-xs text-slate-500 font-semibold text-center">Or Select Avatar Preset</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {AVATAR_TEMPLATES.map((tpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAvatar(tpl);
                          setCustomAvatarUrl('');
                        }}
                        className={`w-8 h-8 rounded-xl overflow-hidden border transition bg-slate-100 ${avatar === tpl ? 'border-blue-600 scale-105 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <img src={tpl} alt={`Avatar ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Profile Status</label>
                <div className="space-y-2">
                  <div className="relative">
                    <MessageSquare size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder="Node Active & Harvesting 📶"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                      id="profile-status-input"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_PRESETS.map((pst, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStatus(pst)}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition ${status === pst ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {pst}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nationality */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Nationality / Region</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-semibold"
                    id="profile-nationality-select"
                  >
                    {NATIONALITIES.map((n) => (
                      <option key={n.code} value={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Short Bio / Description</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short bio about yourself..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-xs leading-relaxed"
                  id="profile-bio-input"
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Abiola Adebayo"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm"
                    id="profile-name-input"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 803 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm"
                    id="profile-phone-input"
                  />
                </div>
              </div>

              {/* ISP Network select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Mobile Network</label>
                <div className="flex gap-2">
                  <select
                    value={isp}
                    onChange={(e) => setIsp(e.target.value as any)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition text-sm font-semibold"
                    id="profile-isp-select"
                  >
                    <option value="MTN">MTN Nigeria</option>
                    <option value="Airtel">Airtel Nigeria</option>
                    <option value="Glo">Glo Nigeria</option>
                    <option value="9mobile">9mobile Nigeria</option>
                  </select>
                  <button
                    type="button"
                    disabled={isDetectingIsp}
                    onClick={handleAutoDetectIsp}
                    className="px-3 py-2.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 text-purple-700 font-bold rounded-xl transition text-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    {isDetectingIsp ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : null}
                    {isDetectingIsp ? 'Detecting...' : 'Detect SIM'}
                  </button>
                </div>
                {detectedIspMsg && (
                  <p className="text-[10px] text-purple-600 font-bold flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                    {detectedIspMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Withdrawal Bank Details & Biometrics */}
            <div className="space-y-5">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={14} className="text-blue-600" /> Payout Bank Details
              </h4>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-4">
                {/* Bank Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition text-sm font-semibold"
                    id="profile-bank-select"
                  >
                    {NIGERIAN_BANKS.map((b, idx) => (
                      <option key={idx} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                 {/* Account Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Account Number (10 digits)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      maxLength={10}
                      pattern="\d{10}"
                      value={accountNumber}
                      onChange={(e) => {
                        setAccountNumber(e.target.value.replace(/\D/g, ''));
                        setResolveSuccess(false);
                        setResolveError('');
                      }}
                      placeholder="3024827103"
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition text-sm font-mono"
                      id="profile-account-input"
                    />
                    <button
                      type="button"
                      disabled={isResolving || !accountNumber || accountNumber.length !== 10}
                      onClick={handleResolveAccountName}
                      className="px-4 py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 text-blue-700 font-bold rounded-xl transition text-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      {isResolving ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : null}
                      {isResolving ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                  {resolveError && (
                    <p className="text-[10px] text-rose-600 font-medium leading-normal mt-1">{resolveError}</p>
                  )}
                  {resolveSuccess && (
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Account Verified Successfully!
                    </p>
                  )}
                </div>

                {/* Account Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Account Holder Name</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Abiola Adebayo"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 transition text-sm font-medium"
                    id="profile-accname-input"
                  />
                  <p className="text-[9px] text-slate-400 leading-normal">
                    Must match your official bank account name.
                  </p>
                </div>
              </div>

              {/* Biometrics Toggle */}
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pt-1">
                <Shield size={14} className="text-blue-600" /> Security Settings
              </h4>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3">
                {/* Face Toggle */}
                <label className="flex items-center justify-between cursor-pointer hover:bg-slate-100/80 p-2.5 -mx-2 rounded-xl transition select-none">
                  <div className="flex items-center gap-2">
                    <Scan size={16} className="text-slate-500" />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Face Unlock</p>
                      <p className="text-[10px] text-slate-400">Use face verification to log in or withdraw</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={faceEnabled}
                    onChange={handleToggleFace}
                    className="w-4 h-4 text-blue-600 accent-blue-600 border-slate-300 bg-white rounded focus:ring-blue-500 cursor-pointer"
                    id="toggle-face-biometric"
                  />
                </label>

                {/* Fingerprint Toggle */}
                <label className="flex items-center justify-between border-t border-slate-150 pt-3 cursor-pointer hover:bg-slate-100/80 p-2.5 -mx-2 rounded-xl transition select-none">
                  <div className="flex items-center gap-2">
                    <Fingerprint size={16} className="text-slate-500" />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Fingerprint Verification</p>
                      <p className="text-[10px] text-slate-400">Use fingerprint sensor on login and payout</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={fingerprintEnabled}
                    onChange={handleToggleFingerprint}
                    className="w-4 h-4 text-blue-600 accent-blue-600 border-slate-300 bg-white rounded focus:ring-blue-500 cursor-pointer"
                    id="toggle-fingerprint-biometric"
                  />
                </label>

                {/* Passkey Toggle & Enroll */}
                <div className="border-t border-slate-150 pt-3 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer hover:bg-slate-100/80 p-2.5 -mx-2 rounded-xl transition select-none">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-slate-500" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">Device Passkey / Security Key</p>
                        <p className="text-[10px] text-slate-400">Sign in securely using your device lock</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={passkeyEnabled}
                      onChange={handleTogglePasskey}
                      className="w-4 h-4 text-blue-600 accent-blue-600 border-slate-300 bg-white rounded focus:ring-blue-500 cursor-pointer"
                      id="toggle-passkey-biometric"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleEnrollPasskeyDirect}
                    disabled={isPasskeyRegistering}
                    className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    id="btn-enroll-passkey-modal"
                  >
                    {isPasskeyRegistering ? <RefreshCw size={14} className="animate-spin text-blue-600" /> : <ShieldCheck size={14} />}
                    <span>Set Up Passkey on This Device</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-xl text-slate-600 font-semibold transition text-sm cursor-pointer"
              id="cancel-profile-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 transition text-sm cursor-pointer flex items-center justify-center gap-2"
              id="save-profile-btn"
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Save Settings</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Render Biometric Scanner Modal for Interactive Enrollment */}
      {activeScanner && (
        <BiometricScanner
          type={activeScanner}
          onSuccess={handleScannerSuccess}
          onCancel={() => setActiveScanner(null)}
        />
      )}
    </div>
  );
}
