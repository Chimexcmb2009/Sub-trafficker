/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { AVATAR_TEMPLATES } from '../data';
import { UserProfile } from '../types';
import { registerPasskey } from '../utils/webauthn';

interface ProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
  onOpenVerificationCenter?: () => void;
}

const STATUS_PRESETS = [
  'Ready for Battle Royale',
  'Verified Payout Member',
  'Online & Active',
  'Competing in West Africa Arena',
];

export default function ProfileModal({ profile, onClose, onUpdate, onOpenVerificationCenter }: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [status, setStatus] = useState(profile.status || STATUS_PRESETS[0]);
  const [nationality, setNationality] = useState(profile.nationality || 'NG');
  const [profilePic, setProfilePic] = useState(profile.profilePic || AVATAR_TEMPLATES[0]);
  const [showOnlineStatus, setShowOnlineStatus] = useState(profile.showOnlineStatus !== false);
  const [saving, setSaving] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const updated: UserProfile = {
      ...profile,
      name: name.trim() || profile.name,
      username: username.trim().replace(/^@/, '').toLowerCase(),
      bio: bio.trim(),
      status,
      nationality,
      profilePic,
      showOnlineStatus,
    };

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: updated.name,
        username: updated.username,
        bio: updated.bio,
        status: updated.status,
        nationality: updated.nationality,
        profilePic: updated.profilePic,
        showOnlineStatus: updated.showOnlineStatus,
      }).catch(() => {});

      await setDoc(
        doc(db, 'users_public', profile.uid),
        {
          uid: profile.uid,
          name: updated.name,
          username: updated.username || '',
          profilePic: updated.profilePic,
          bio: updated.bio || '',
          status: updated.status || '',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          showOnlineStatus: updated.showOnlineStatus,
        },
        { merge: true }
      ).catch(() => {});

      onUpdate(updated);
      setFeedback({ ok: true, text: 'Profile updated cleanly.' });
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message || 'Could not update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEnrollPasskey = async () => {
    setPasskeyBusy(true);
    setFeedback(null);
    const res = await registerPasskey('Sub Trafficker Passkey');
    setPasskeyBusy(false);
    if (res.success) {
      const updated = { ...profile, biometrics: { ...profile.biometrics, passkey: true } };
      onUpdate(updated);
      setFeedback({ ok: true, text: 'Passkey registered for your account.' });
    } else {
      setFeedback({ ok: false, text: res.error || 'Passkey enrollment failed.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Account Profile &amp; Preferences</h2>
              <p className="text-xs text-slate-400">
                Bank account holder names and phone/identity statuses are read-only here and verified inside Verification Center.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
              feedback.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Avatar</label>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setProfilePic(tpl)}
                  className={`w-12 h-12 rounded-xl border-2 overflow-hidden transition ${
                    profilePic === tpl ? 'border-amber-500 scale-105' : 'border-slate-800 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={tpl} alt="Avatar choice" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Handle (@username)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tactical_nigeria"
                className="w-full min-h-[44px] rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status Preset</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white"
              >
                {STATUS_PRESETS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" /> Region
              </label>
              <select
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white"
              >
                <option value="NG">Nigeria</option>
                <option value="GH">Ghana</option>
                <option value="KE">Kenya</option>
                <option value="ZA">South Africa</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell teammates about your gaming loadout or trading hours..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white"
            />
          </div>

          {/* Read-only Verified Bank & Phone Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verified Payout &amp; Identity Snapshot
              </span>
              {onOpenVerificationCenter && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVerificationCenter();
                  }}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                >
                  Open Verification Center →
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Bank: <span className="text-white">{profile.bankDetails?.bankName || 'Not verified'}</span> •{' '}
              <span className="font-mono">{profile.bankDetails?.accountNumber || '—'}</span> ({profile.bankDetails?.accountName || 'Unverified'})
            </p>
            <p className="text-xs text-slate-400">
              Mobile Line: <span className="font-mono text-white">{profile.phone || 'Not linked'}</span> ({profile.isp || 'Unknown'})
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
              className="rounded border-slate-700"
            />
            Show online presence to squadmates and friends
          </label>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleEnrollPasskey}
              disabled={passkeyBusy}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 inline-flex items-center justify-center gap-2"
            >
              {passkeyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 text-amber-400" />}
              Register OS Passkey
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
