/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  Activity,
  Award,
  Bell,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Gamepad2,
  HardDrive,
  Landmark,
  LogOut,
  Menu,
  MessageSquare,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Users,
  Video,
  Wallet,
  X,
} from 'lucide-react';
import { auth, db } from './firebase';
import { AVATAR_TEMPLATES } from './data';
import { apiRequest, clearSessionToken, getSessionToken, setSessionToken } from './lib/apiClient';
import { Transaction, UserProfile } from './types';
import { requestNotificationPermission, sendDeviceNotification } from './utils/notifications';

import { AuthScreen } from './components/AuthScreen';
import { VerificationCenter } from './components/VerificationCenter';
import { AssetCacheModal } from './components/AssetCacheModal';
import ProfileModal from './components/ProfileModal';
import AirtimeConverter from './components/AirtimeConverter';
import TrafficStreamer from './components/TrafficStreamer';
import WithdrawalForm from './components/WithdrawalForm';
import TransactionHistory from './components/TransactionHistory';
import ChimexBot from './components/ChimexBot';
import SimSynchronizer from './components/SimSynchronizer';
import AdWatcher from './components/AdWatcher';
import AdminPanel from './components/AdminPanel';
import ChatMenu from './components/ChatMenu';
import FriendsMenu from './components/FriendsMenu';
import GamingMenu from './components/GamingMenu';
import BloodStrikePortal from './components/BloodStrikePortal';

type AppTab =
  | 'overview'
  | 'verification'
  | 'rewards'
  | 'airtime'
  | 'withdrawal'
  | 'arena'
  | 'arcade'
  | 'social'
  | 'admin';

const ADMIN_OWNER_EMAIL = 'anifranciscaomeje@gmail.com';

function buildProfileFromBackend(backendUser: any, existing?: Partial<UserProfile>): UserProfile {
  const uid = backendUser.uid || existing?.uid || '';
  const email = backendUser.email || existing?.email || '';
  const isOwner = email.toLowerCase() === ADMIN_OWNER_EMAIL || backendUser.role === 'admin';

  return {
    uid,
    name: backendUser.name || existing?.name || email.split('@')[0] || 'Member',
    email,
    phone: backendUser.phone || existing?.phone || '',
    profilePic: existing?.profilePic || AVATAR_TEMPLATES[0],
    username: existing?.username || (email ? email.split('@')[0] : 'operative'),
    status: existing?.status || 'Online & Active',
    nationality: existing?.nationality || 'NG',
    bio: existing?.bio || '',
    cashBalance: Number(backendUser.cashBalanceNgn ?? existing?.cashBalance ?? 0),
    airtimeBalance: Number(backendUser.airtimeBalanceNgn ?? existing?.airtimeBalance ?? 0),
    accumulatedTrafficCash: Number(existing?.accumulatedTrafficCash ?? backendUser.cashBalanceNgn ?? 0),
    totalDataStreamedMB: Number(existing?.totalDataStreamedMB ?? 0),
    isp: (backendUser.isp || existing?.isp || '') as any,
    bankDetails: {
      bankCode: backendUser.bankDetails?.bankCode || existing?.bankDetails?.bankCode || '',
      bankName: backendUser.bankDetails?.bankName || existing?.bankDetails?.bankName || '',
      accountNumber: backendUser.bankDetails?.accountNumber || existing?.bankDetails?.accountNumber || '',
      accountName: backendUser.bankDetails?.accountName || existing?.bankDetails?.accountName || '',
    },
    biometrics: {
      face: backendUser.faceStatus === 'verified',
      fingerprint: (backendUser.passkeyCount || 0) > 0,
      passkey: (backendUser.passkeyCount || 0) > 0,
    },
    emailVerified: Boolean(backendUser.emailVerified),
    phoneVerified: Boolean(backendUser.phoneVerified),
    phoneCarrierVerified: Boolean(backendUser.phoneCarrierVerified),
    faceStatus: backendUser.faceStatus || existing?.faceStatus || 'pending',
    faceProvider: backendUser.faceProvider || existing?.faceProvider || '',
    faceConfidence: backendUser.faceConfidence ?? existing?.faceConfidence ?? null,
    faceReason: backendUser.faceReason || existing?.faceReason || '',
    bankVerified: Boolean(backendUser.bankVerified),
    bankConfirmed: Boolean(backendUser.bankConfirmed),
    passkeyCount: Number(backendUser.passkeyCount ?? existing?.passkeyCount ?? 0),
    role: isOwner ? 'admin' : 'user',
    createdAt: existing?.createdAt || new Date().toISOString(),
    isOnline: existing?.isOnline ?? true,
    lastSeen: new Date().toISOString(),
    showOnlineStatus: existing?.showOnlineStatus !== false,
  };
}

export default function App() {
  const [backendUser, setBackendUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [configStatus, setConfigStatus] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [socialSubTab, setSocialSubTab] = useState<'friends' | 'chat'>('friends');
  const [activeFriendForChat, setActiveFriendForChat] = useState<string | null>(null);
  const [invitedGameRoomId, setInvitedGameRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('fpsRoom');
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // If deep-linked via ?fpsRoom=..., open 3D Arena automatically upon sign-in
  useEffect(() => {
    if (invitedGameRoomId && profile) {
      setActiveTab('arena');
    }
  }, [invitedGameRoomId, profile?.uid]);

  // PWA install event listener
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Fetch provider readiness flags (never exposes secrets)
  useEffect(() => {
    fetch('/api/config-check')
      .then((r) => r.json())
      .then((d) => setConfigStatus(d))
      .catch(() => {});
  }, []);

  // Sync public directory fields cleanly so Friends / Chat work with locked-down Firestore rules
  const syncPublicProfile = useCallback(async (prof: UserProfile) => {
    if (!prof.uid) return;
    try {
      await setDoc(
        doc(db, 'users_public', prof.uid),
        {
          uid: prof.uid,
          name: prof.name,
          username: prof.username || prof.name.toLowerCase().replace(/\s+/g, '_'),
          profilePic: prof.profilePic || AVATAR_TEMPLATES[0],
          bio: prof.bio || '',
          status: prof.status || 'Online',
          isOnline: prof.showOnlineStatus !== false,
          lastSeen: new Date().toISOString(),
          showOnlineStatus: prof.showOnlineStatus !== false,
          isp: prof.isp || '',
        },
        { merge: true }
      );
      if (prof.role === 'admin' || prof.email?.toLowerCase() === ADMIN_OWNER_EMAIL) {
        await setDoc(
          doc(db, 'admins', prof.uid),
          { email: prof.email, grantedAt: new Date().toISOString() },
          { merge: true }
        );
      }
    } catch {
      // Offline or not signed into Firebase Auth (e.g., passkey/backend-only session)
    }
  }, []);

  // Restore session on mount: backend token + Firebase Auth bridge
  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const token = getSessionToken();
      if (token) {
        const res = await apiRequest('/api/auth/me');
        if (active && res.ok && res.data?.user) {
          setBackendUser(res.data.user);
          setProfile((prev) => buildProfileFromBackend(res.data.user, prev || undefined));
          setLoading(false);
          return;
        }
        clearSessionToken();
      }
      if (active) setLoading(false);
    }

    bootstrapSession();

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      if (fbUser && !getSessionToken()) {
        try {
          const idToken = await fbUser.getIdToken();
          const ex = await apiRequest('/api/auth/firebase-exchange', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
          });
          if (active && ex.ok && ex.data?.token && ex.data?.user) {
            setSessionToken(ex.data.token);
            setBackendUser(ex.data.user);
            setProfile((prev) => buildProfileFromBackend(ex.data.user, prev || undefined));
          }
        } catch {
          // Ignore silent exchange failure
        } finally {
          if (active) setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, []);

  // Firestore private profile & transactions listeners (merges authoritative backend fields)
  useEffect(() => {
    if (!backendUser?.uid) return;
    const uid = backendUser.uid;

    const userRef = doc(db, 'users', uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        const fsData = snap.exists() ? (snap.data() as Partial<UserProfile>) : undefined;
        const merged = buildProfileFromBackend(backendUser, fsData);
        setProfile(merged);
        syncPublicProfile(merged);
        if (!snap.exists() && auth.currentUser?.uid === uid) {
          setDoc(userRef, merged, { merge: true }).catch(() => {});
        }
      },
      () => {
        const fallback = buildProfileFromBackend(backendUser, profile || undefined);
        setProfile(fallback);
      }
    );

    const txQuery = query(collection(db, 'transactions'), where('userId', '==', uid));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTransactions(list);
      },
      () => {}
    );

    return () => {
      unsubUser();
      unsubTx();
    };
  }, [backendUser]);

  // Presence heartbeat on users_public
  useEffect(() => {
    if (!profile?.uid) return;
    const pubRef = doc(db, 'users_public', profile.uid);
    const sendHeartbeat = () => {
      updateDoc(pubRef, {
        isOnline: profile.showOnlineStatus !== false,
        lastSeen: new Date().toISOString(),
      }).catch(() => {});
    };
    const timer = window.setInterval(sendHeartbeat, 45000);
    return () => clearInterval(timer);
  }, [profile?.uid, profile?.showOnlineStatus]);

  const handleAuthSuccess = (loggedUser: any) => {
    setBackendUser(loggedUser);
    const built = buildProfileFromBackend(loggedUser);
    setProfile(built);
    syncPublicProfile(built);
    if (auth.currentUser?.uid === built.uid) {
      setDoc(doc(db, 'users', built.uid), built, { merge: true }).catch(() => {});
    }
  };

  const handleProfileUpdate = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const refreshedMe = await apiRequest('/api/auth/me');
    const latestBackend = refreshedMe.ok && refreshedMe.data?.user ? refreshedMe.data.user : backendUser;
    if (latestBackend) setBackendUser(latestBackend);

    const next = buildProfileFromBackend(latestBackend || {}, { ...profile, ...updates });
    setProfile(next);
    syncPublicProfile(next);
    if (auth.currentUser?.uid === next.uid) {
      await setDoc(doc(db, 'users', next.uid), next, { merge: true }).catch(() => {});
    }
  };

  const handleSuccessTransaction = (updatedProfile: UserProfile, tx: Transaction) => {
    setProfile(updatedProfile);
    setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]);
    apiRequest('/api/auth/me').then((r) => {
      if (r.ok && r.data?.user) setBackendUser(r.data.user);
    });
  };

  const handleLogOut = async () => {
    clearSessionToken();
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase sign-out if not signed into Firebase
    }
    setBackendUser(null);
    setProfile(null);
    setTransactions([]);
    setActiveTab('overview');
  };

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        setDeferredInstallPrompt(null);
        return;
      } catch {
        // Fallback modal
      }
    }
    setShowInstallModal(true);
  };

  const isAdmin = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'admin' || profile.email?.toLowerCase() === ADMIN_OWNER_EMAIL;
  }, [profile]);

  const verificationStats = useMemo(() => {
    if (!profile) return { completed: 0, total: 5, percent: 0 };
    const checks = [
      Boolean(profile.emailVerified),
      Boolean(profile.phoneVerified),
      profile.faceStatus === 'verified',
      Boolean(profile.bankVerified && profile.bankConfirmed),
      (profile.passkeyCount || 0) > 0,
    ];
    const completed = checks.filter(Boolean).length;
    return { completed, total: 5, percent: Math.round((completed / 5) * 100) };
  }, [profile]);

  const pendingAlerts = useMemo(() => {
    if (!profile) return [];
    const list: { id: string; title: string; action: () => void }[] = [];
    if (!profile.emailVerified) {
      list.push({ id: 'email', title: 'Verify your email address via OTP', action: () => setActiveTab('verification') });
    }
    if (!profile.phoneVerified) {
      list.push({ id: 'phone', title: 'Verify your phone & carrier via SMS OTP', action: () => setActiveTab('verification') });
    }
    if (profile.faceStatus !== 'verified') {
      list.push({ id: 'face', title: 'Complete Identity Face Comparison', action: () => setActiveTab('verification') });
    }
    if (!profile.bankVerified || !profile.bankConfirmed) {
      list.push({ id: 'bank', title: 'Verify & confirm your Nigerian bank account', action: () => setActiveTab('verification') });
    }
    return list;
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl border-2 border-emerald-500/30 border-t-emerald-400 animate-spin mb-4" />
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">Initializing Secure Session...</p>
      </div>
    );
  }

  if (!profile) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  if (activeTab === 'arena') {
    return (
      <BloodStrikePortal
        profile={profile}
        roomId={invitedGameRoomId}
        onExit={() => {
          setInvitedGameRoomId(null);
          setActiveTab('overview');
        }}
        theme="dark"
      />
    );
  }

  const navItems: Array<{ id: AppTab; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'overview', label: 'Overview', icon: <Activity size={18} /> },
    {
      id: 'verification',
      label: 'Verification Center',
      icon: <ShieldCheck size={18} />,
      badge: verificationStats.completed < 4 ? `${verificationStats.completed}/5` : undefined,
    },
    { id: 'rewards', label: 'Sponsored Rewards', icon: <Award size={18} /> },
    { id: 'airtime', label: 'Airtime & SIM', icon: <Smartphone size={18} /> },
    { id: 'withdrawal', label: 'Withdrawals', icon: <Landmark size={18} /> },
    { id: 'arena', label: '3D FPS Arena', icon: <Crosshair size={18} />, badge: 'LIVE' },
    { id: 'arcade', label: 'Gaming Arcade', icon: <Gamepad2 size={18} /> },
    { id: 'social', label: 'Friends & Chat', icon: <Users size={18} /> },
    ...(isAdmin ? [{ id: 'admin' as AppTab, label: 'Owner Panel', icon: <Shield size={18} /> }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-emerald-500/30">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0F1522] border-r border-slate-800/80 z-30">
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
          <img
            src="/pwa-icon.png"
            alt="Sub Trafficker"
            className="w-10 h-10 rounded-xl border border-slate-700 object-cover"
          />
          <div>
            <h1 className="font-bold text-base tracking-tight text-white">Sub Trafficker</h1>
            <p className="text-[11px] font-mono text-emerald-400">Gaming Finance OS</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition cursor-pointer ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                      item.id === 'arena'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={() => setShowAssetModal(true)}
            className="w-full min-h-[42px] px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-sky-400 flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <HardDrive size={15} /> Local 3D Assets
            </span>
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-2.5 text-left cursor-pointer"
          >
            <img
              src={profile.profilePic}
              alt={profile.name}
              className="w-9 h-9 rounded-lg object-cover border border-slate-700"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{profile.name}</p>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {profile.isp ? `${profile.isp} NG` : 'Network Unverified'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleLogOut}
            className="w-full min-h-[40px] px-3 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={15} /> Sign Out Securely
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* TOP STICKY BAR */}
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 min-h-[42px] min-w-[42px] rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-center justify-center"
              aria-label="Open Navigation"
            >
              <Menu size={18} />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <img src="/pwa-icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-bold text-sm text-white">Sub Trafficker</span>
            </div>
            <div className="hidden lg:block">
              <h2 className="text-sm font-semibold text-white capitalize">
                {navItems.find((n) => n.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Chimex Verse Fintech & 3D Esports Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallPWA}
              className="hidden sm:inline-flex min-h-[38px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 items-center gap-1.5 cursor-pointer"
            >
              <Smartphone size={14} className="text-sky-400" />
              Install App
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((p) => !p)}
                className="relative p-2 min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {pendingAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                    {pendingAlerts.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0F1522] border border-slate-800 shadow-2xl p-4 space-y-3 z-40">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-white">Security & Activity Alerts</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await requestNotificationPermission();
                        setNotificationEnabled(granted);
                        if (granted) {
                          sendDeviceNotification('Sub Trafficker Alerts Enabled', {
                            body: 'Verification updates and match invites are active.',
                          });
                        }
                      }}
                      className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      {notificationEnabled ? 'Push Enabled' : 'Enable Push'}
                    </button>
                  </div>

                  {pendingAlerts.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">All identity and payout checks are complete.</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingAlerts.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            a.action();
                            setShowNotifications(false);
                          }}
                          className="w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 flex items-center justify-between cursor-pointer"
                        >
                          <span>{a.title}</span>
                          <ChevronRight size={14} className="text-slate-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="p-1.5 pr-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <img
                src={profile.profilePic}
                alt="Avatar"
                className="w-7 h-7 rounded-lg object-cover"
              />
              <span className="hidden sm:inline text-xs font-medium text-white">{profile.name.split(' ')[0]}</span>
            </button>
          </div>
        </header>

        {/* MOBILE DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden bg-black/75 backdrop-blur-sm flex">
            <div className="w-72 bg-[#0F1522] border-r border-slate-800 h-full p-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-bold text-white">Navigation</span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full min-h-[44px] px-3 rounded-xl flex items-center justify-between text-sm font-medium ${
                        activeTab === item.id
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssetModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-sky-400 flex items-center gap-2"
                >
                  <HardDrive size={15} /> Local 3D Assets
                </button>
                <button
                  type="button"
                  onClick={handleLogOut}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* MAIN WORKSPACE */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Provider Configuration Status Notice (when optional keys aren't set yet) */}
              {configStatus &&
                (!configStatus.bankProviderConfigured ||
                  !configStatus.emailProviderConfigured ||
                  !configStatus.faceProviderConfigured ||
                  !configStatus.smsProviderConfigured) && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-300 space-y-1">
                        <p className="font-semibold text-amber-300">Provider Configuration Notice</p>
                        <p className="text-slate-400 leading-relaxed">
                          Live external verification/payouts require server environment secrets:{' '}
                          {!configStatus.emailProviderConfigured && <code className="text-amber-200 mr-2">RESEND_API_KEY/SMTP</code>}
                          {!configStatus.smsProviderConfigured && <code className="text-amber-200 mr-2">TERMII_API_KEY</code>}
                          {!configStatus.bankProviderConfigured && <code className="text-amber-200 mr-2">PAYSTACK_SECRET_KEY</code>}
                          {!configStatus.faceProviderConfigured && <code className="text-amber-200">DOJAH/FACEPP</code>}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Account Verification Progress Banner */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      size={18}
                      className={verificationStats.completed >= 4 ? 'text-emerald-400' : 'text-amber-400'}
                    />
                    <h3 className="text-sm font-semibold text-white">
                      Identity & Payout Readiness ({verificationStats.completed}/{verificationStats.total})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Complete live Email OTP, Phone/MNP SMS OTP, Face Comparison, WebAuthn Passkey, and Bank NUBAN confirmation.
                  </p>
                  <div className="w-full max-w-md h-1.5 bg-slate-800 rounded-full overflow-hidden pt-0">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300"
                      style={{ width: `${verificationStats.percent}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('verification')}
                  className="min-h-[44px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  Open Verification Center <ChevronRight size={15} />
                </button>
              </div>

              {/* KPI Grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Available Cash</span>
                    <Wallet size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold font-mono tabular-nums text-white">
                      ₦{Number(profile.cashBalance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Server-validated ledger balance</p>
                  </div>
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Withdrawals</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('withdrawal')}
                      className="text-emerald-400 font-semibold hover:underline cursor-pointer"
                    >
                      Transfer to Bank →
                    </button>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Verified Mobile Line</span>
                    <Phone size={18} className="text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold font-mono text-white">
                      {profile.phone || 'No Phone Linked'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Carrier: {profile.isp ? `${profile.isp} Nigeria` : 'Unverified'}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">SMS OTP Status</span>
                    <span className={profile.phoneVerified ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {profile.phoneVerified ? 'Verified' : 'Action Needed'}
                    </span>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Payout Bank & Face ID</span>
                    <Landmark size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white truncate">
                      {profile.bankDetails.bankName || 'No Bank Account Resolved'}
                    </p>
                    <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                      {profile.bankDetails.accountName || 'Verify NUBAN inside Verification Center'}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Face Check</span>
                    <span
                      className={
                        profile.faceStatus === 'verified'
                          ? 'text-emerald-400 font-semibold'
                          : 'text-amber-400 font-medium capitalize'
                      }
                    >
                      {(profile.faceStatus || 'pending').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </section>

              {/* Quick Actions */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('arena')}
                  className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/15 to-amber-500/10 border border-rose-500/30 hover:border-rose-400/60 text-left space-y-2 transition cursor-pointer"
                >
                  <Crosshair size={20} className="text-rose-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Blood Strike 3D</p>
                    <p className="text-[11px] text-slate-400">Battle Royale Arena</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('rewards')}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-left space-y-2 transition cursor-pointer"
                >
                  <Award size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Sponsored Rewards</p>
                    <p className="text-[11px] text-slate-400">Verified brand tasks</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('airtime')}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-left space-y-2 transition cursor-pointer"
                >
                  <Smartphone size={20} className="text-sky-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Airtime & SIM</p>
                    <p className="text-[11px] text-slate-400">Convert & MNP check</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAssetModal(true)}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 text-left space-y-2 transition cursor-pointer"
                >
                  <HardDrive size={20} className="text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Local 3D Cache</p>
                    <p className="text-[11px] text-slate-400">IndexedDB asset storage</p>
                  </div>
                </button>
              </section>

              {/* Transaction History */}
              <TransactionHistory transactions={transactions} />
            </>
          )}

          {activeTab === 'verification' && (
            <VerificationCenter profile={profile} onProfileUpdate={handleProfileUpdate} />
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-6">
              <TrafficStreamer profile={profile} onSuccess={handleSuccessTransaction} />
              <AdWatcher
                profile={profile}
                onAdCompleted={(updated) => setProfile(updated)}
                theme="dark"
              />
            </div>
          )}

          {activeTab === 'airtime' && (
            <div className="space-y-6">
              <SimSynchronizer profile={profile} onUpdate={(u) => setProfile(u)} theme="dark" />
              <AirtimeConverter profile={profile} onSuccess={handleSuccessTransaction} />
            </div>
          )}

          {activeTab === 'withdrawal' && (
            <div className="space-y-6">
              <WithdrawalForm
                profile={profile}
                onSuccess={handleSuccessTransaction}
                openProfile={() => setActiveTab('verification')}
              />
              <TransactionHistory transactions={transactions} />
            </div>
          )}

          {activeTab === 'arcade' && (
            <GamingMenu profile={profile} invitedRoomId={invitedGameRoomId} theme="dark" />
          )}

          {activeTab === 'social' && (
            <div className="space-y-4">
              <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setSocialSubTab('friends')}
                  className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                    socialSubTab === 'friends' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users size={15} /> Friends Directory
                </button>
                <button
                  type="button"
                  onClick={() => setSocialSubTab('chat')}
                  className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                    socialSubTab === 'chat' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare size={15} /> Direct Messages
                </button>
              </div>

              {socialSubTab === 'friends' ? (
                <FriendsMenu
                  profile={profile}
                  onNavigateToChat={(friendUid) => {
                    if (friendUid) setActiveFriendForChat(friendUid);
                    setSocialSubTab('chat');
                  }}
                  onInviteToGame={() => setActiveTab('arena')}
                  theme="dark"
                />
              ) : (
                <ChatMenu
                  profile={profile}
                  initialActiveFriendUid={activeFriendForChat}
                  onNavigateToGaming={(roomId) => {
                    if (roomId) setInvitedGameRoomId(roomId);
                    setActiveTab('arena');
                  }}
                  theme="dark"
                />
              )}
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminPanel profile={profile} onUpdate={(u) => setProfile(u)} theme="dark" />
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0F1522]/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 grid grid-cols-5 gap-1">
        {(
          [
            { id: 'overview', label: 'Home', icon: <Activity size={17} /> },
            { id: 'verification', label: 'Verify', icon: <ShieldCheck size={17} /> },
            { id: 'rewards', label: 'Rewards', icon: <Award size={17} /> },
            { id: 'arena', label: 'Arena', icon: <Crosshair size={17} /> },
            { id: 'social', label: 'Social', icon: <Users size={17} /> },
          ] as Array<{ id: AppTab; label: string; icon: React.ReactNode }>
        ).map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      {isProfileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setIsProfileOpen(false)}
          onUpdate={(updated) => setProfile(updated)}
          onOpenVerificationCenter={() => {
            setIsProfileOpen(false);
            setActiveTab('verification');
          }}
        />
      )}

      {showAssetModal && <AssetCacheModal onClose={() => setShowAssetModal(false)} />}

      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0F1522] border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/pwa-icon.png" alt="Icon" className="w-11 h-11 rounded-xl border border-slate-700" />
                <div>
                  <h3 className="font-bold text-white text-sm">Install Sub Trafficker</h3>
                  <p className="text-xs text-slate-400">Offline 3D Assets & Fast Launch</p>
                </div>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="font-semibold text-sky-400 mb-1">Android / Chrome</p>
                <p>Open browser menu (⋮) and select &ldquo;Install app&rdquo; or &ldquo;Add to Home Screen&rdquo;.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="font-semibold text-emerald-400 mb-1">iOS Safari</p>
                <p>Tap Share and choose &ldquo;Add to Home Screen&rdquo;.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Widget */}
      <ChimexBot userId={profile.uid} />
    </div>
  );
}
