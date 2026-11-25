/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Transaction } from './types';
import { detectCarrierRealTime } from './utils/carrierDetector';
import AuthScreen from './components/AuthScreen';
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
import { requestNotificationPermission, sendDeviceNotification } from './utils/notifications';
import { 
  Shield, LogOut, User, DollarSign, Signal, Landmark, Radio, 
  HelpCircle, CreditCard, ChevronRight, Activity, Bell, Smartphone,
  Sun, Moon, Terminal, Cpu, Bot, Video, Sparkles, Box, RefreshCw,
  MessageSquare, Users, Gamepad2, Globe
} from 'lucide-react';

const themeStyles = {
  light: {
    bg: 'bg-slate-50 text-slate-800',
    card: 'bg-white border border-slate-200/90 text-slate-800 shadow-sm',
    title: 'text-slate-900',
    sub: 'text-slate-500',
    border: 'border-slate-200',
    tabActive: 'bg-white border border-slate-200 text-blue-600 shadow-sm',
    tabInactive: 'text-slate-600 hover:text-slate-900',
    pill: 'bg-slate-800 border border-slate-700',
    headerBg: 'bg-[#0F172A]',
    accentText: 'text-blue-600'
  },
  dark: {
    bg: 'bg-slate-950 text-slate-100',
    card: 'bg-slate-900 border border-slate-800 text-slate-100 shadow-sm',
    title: 'text-white',
    sub: 'text-slate-400',
    border: 'border-slate-800',
    tabActive: 'bg-slate-800 border border-slate-700 text-sky-400 shadow-sm',
    tabInactive: 'text-slate-400 hover:text-slate-200',
    pill: 'bg-slate-800 border border-slate-700',
    headerBg: 'bg-slate-950 border-b border-slate-900',
    accentText: 'text-sky-400'
  },
  cyber: {
    bg: 'bg-black text-emerald-400 font-mono',
    card: 'bg-zinc-950 border border-emerald-500/30 text-emerald-400',
    title: 'text-emerald-300 font-mono font-bold',
    sub: 'text-emerald-600',
    border: 'border-emerald-500/20',
    tabActive: 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 shadow-sm font-mono',
    tabInactive: 'text-emerald-700 hover:text-emerald-400 font-mono',
    pill: 'bg-zinc-950 border border-emerald-500/20',
    headerBg: 'bg-zinc-950 border-b border-emerald-500/20',
    accentText: 'text-emerald-400'
  },
  ai: {
    bg: 'bg-[#050112] text-purple-100',
    card: 'bg-purple-950/20 border border-purple-500/30 text-purple-100 backdrop-blur-md',
    title: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-300 to-indigo-300 font-bold',
    sub: 'text-purple-300/70',
    border: 'border-purple-500/20',
    tabActive: 'bg-purple-900/40 border border-purple-500/40 text-fuchsia-300 shadow-sm',
    tabInactive: 'text-purple-400 hover:text-purple-200',
    pill: 'bg-purple-950/40 border border-purple-500/30',
    headerBg: 'bg-[#0A0518] border-b border-purple-500/20',
    accentText: 'text-purple-400'
  },
  ai_3d: {
    bg: 'bg-[#03010A] text-fuchsia-100 font-sans',
    card: 'bg-[#0A051A]/90 border border-fuchsia-500/40 text-fuchsia-100 backdrop-blur-xl',
    title: 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-cyan-300 to-emerald-300 font-black tracking-tight',
    sub: 'text-fuchsia-300/80 font-semibold',
    border: 'border-fuchsia-500/30',
    tabActive: 'bg-fuchsia-950/60 border border-fuchsia-500/60 text-cyan-300 shadow-sm font-bold',
    tabInactive: 'text-fuchsia-400 hover:text-fuchsia-200 font-medium',
    pill: 'bg-fuchsia-950/60 border border-fuchsia-500/40',
    headerBg: 'bg-[#060212]/90 border-b border-fuchsia-500/30 backdrop-blur-md',
    accentText: 'text-cyan-400'
  }
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [configStatus, setConfigStatus] = useState<{
    paystackConfigured: boolean;
    geminiConfigured: boolean;
  } | null>(null);

  // Theme Switching state with AI 3D Morphing Engine
  const [theme, setTheme] = useState<'light' | 'dark' | 'cyber' | 'ai' | 'ai_3d'>(() => {
    return (localStorage.getItem('sub_trafficker_theme') as any) || 'light';
  });

  // AI 3D Theme Dynamic Parameters
  const [ai3dConfig, setAi3dConfig] = useState({
    rotateX: -2,
    rotateY: 3,
    perspective: 1200,
    canvasBg: '#03010A',
    cardBg: 'rgba(15, 10, 30, 0.85)',
    borderGlow: 'rgba(168, 85, 247, 0.5)',
    accentHex: '#c084fc',
    textColor: '#e9d5ff',
    gradientStr: 'from-fuchsia-500 via-purple-500 to-cyan-400',
    intervalMin: 1
  });

  const [aiMorphNotice, setAiMorphNotice] = useState('');

  const triggerAi3dMorph = () => {
    const rotX = (Math.random() * 12 - 6).toFixed(1);
    const rotY = (Math.random() * 14 - 7).toFixed(1);
    const pers = Math.floor(800 + Math.random() * 700);
    
    const canvasBgs = ['#03010A', '#010D08', '#0E0108', '#020412', '#0A0801'];
    const cardBgs = [
      'rgba(20, 10, 40, 0.88)',
      'rgba(8, 30, 20, 0.88)',
      'rgba(35, 10, 20, 0.88)',
      'rgba(10, 20, 45, 0.88)',
      'rgba(25, 20, 10, 0.88)'
    ];
    const textColors = ['#f5d0fe', '#a7f3d0', '#fecdd3', '#bae6fd', '#fef08a'];
    const gradients = [
      'from-fuchsia-500 via-purple-500 to-cyan-400',
      'from-emerald-400 via-teal-500 to-indigo-500',
      'from-amber-400 via-rose-500 to-purple-600',
      'from-sky-400 via-indigo-500 to-pink-500',
      'from-neon-green via-emerald-500 to-blue-600'
    ];
    const borderGlows = [
      'rgba(168, 85, 247, 0.6)',
      'rgba(16, 185, 129, 0.6)',
      'rgba(244, 63, 94, 0.6)',
      'rgba(56, 189, 248, 0.6)',
      'rgba(234, 179, 8, 0.6)'
    ];
    const accents = ['#c084fc', '#34d399', '#fb7185', '#38bdf8', '#facc15'];

    const idx = Math.floor(Math.random() * gradients.length);
    const newCanvas = canvasBgs[idx];
    const newCard = cardBgs[idx];
    const newText = textColors[idx];
    const newGrad = gradients[idx];
    const newGlow = borderGlows[idx];
    const newAcc = accents[idx];

    setAi3dConfig(prev => ({
      ...prev,
      rotateX: Number(rotX),
      rotateY: Number(rotY),
      perspective: pers,
      canvasBg: newCanvas,
      cardBg: newCard,
      textColor: newText,
      borderGlow: newGlow,
      accentHex: newAcc,
      gradientStr: newGrad
    }));

    setAiMorphNotice(`AI 3D Morph Matrix Triggered! [3D Angle: ${rotX}° / ${rotY}°]`);
    setTimeout(() => setAiMorphNotice(''), 3000);
  };

  // Timer for 1min / 2min auto AI Theme Morphing
  useEffect(() => {
    if (theme !== 'ai_3d') return;

    const intervalMs = ai3dConfig.intervalMin * 60 * 1000;
    const timer = setInterval(() => {
      triggerAi3dMorph();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [theme, ai3dConfig.intervalMin]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'cyber' | 'ai' | 'ai_3d') => {
    setTheme(newTheme);
    localStorage.setItem('sub_trafficker_theme', newTheme);
    if (newTheme === 'ai_3d') {
      triggerAi3dMorph();
    }
  };

  // Active tab inside Dashboard
  const [activeTab, setActiveTab] = useState<'airtime' | 'traffic' | 'withdrawal' | 'chat' | 'friends' | 'gaming' | 'ads'>('airtime');
  const [activeFriendForChat, setActiveFriendForChat] = useState<string | null>(null);
  const [invitedGameRoomId, setInvitedGameRoomId] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Listen for PWA Install Prompt Event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredInstallPrompt(null);
      setShowInstallModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsAppInstalled(true);
        }
        setDeferredInstallPrompt(null);
        return;
      } catch (e) {
        console.warn("Install prompt failed, showing modal guide:", e);
      }
    }
    setShowInstallModal(true);
  };

  // Online Presence Tracker Heartbeat
  useEffect(() => {
    if (!profile?.uid) return;

    const userRef = doc(db, 'users', profile.uid);

    // Set online
    updateDoc(userRef, {
      isOnline: profile.showOnlineStatus !== false ? true : false,
      lastSeen: new Date().toISOString()
    }).catch(e => console.warn("Presence set error:", e));

    const heartbeat = setInterval(() => {
      updateDoc(userRef, {
        isOnline: profile.showOnlineStatus !== false ? true : false,
        lastSeen: new Date().toISOString()
      }).catch(e => console.warn(e));
    }, 45000);

    const handleUnload = () => {
      updateDoc(userRef, {
        isOnline: false,
        lastSeen: new Date().toISOString()
      }).catch(e => console.warn(e));
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
      updateDoc(userRef, {
        isOnline: false,
        lastSeen: new Date().toISOString()
      }).catch(e => console.warn(e));
    };
  }, [profile?.uid, profile?.showOnlineStatus]);

  // Modals
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  // Fetch live API key statuses on mount
  useEffect(() => {
    async function checkConfig() {
      try {
        const res = await fetch('/api/config-check');
        const data = await res.json();
        setConfigStatus(data);
      } catch (err) {
        console.warn('Could not fetch configuration state:', err);
      }
    }
    checkConfig();
  }, []);

  // Listen to Auth State Changes
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeTx: (() => void) | null = null;

    const setupListeners = (uid: string) => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTx) unsubscribeTx();

      // Setup Firestore listener for profile details
      const profileRef = doc(db, 'users', uid);
      unsubscribeProfile = onSnapshot(profileRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          if (data.airtimeBalance === undefined) {
            // Lazy migration: Initialize existing accounts with ₦0 airtime balance
            updateDoc(profileRef, { airtimeBalance: 0 }).catch(() => {});
          }
          setProfile(data);
        }
      }, (err) => {
        console.warn("Profile snapshot offline/sync notice:", err);
      });

      // Setup Firestore listener for transactions details
      const q = query(collection(db, 'transactions'), where('userId', '==', uid));
      unsubscribeTx = onSnapshot(q, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Transaction);
        });
        setTransactions(list);
      }, (err) => {
        console.warn("Transactions snapshot offline/sync notice:", err);
      });

      setLoading(false);
    };

    // Check localStorage first for Cloud-Sync Mode user ID
    const localUid = localStorage.getItem('sub_trafficker_uid');
    if (localUid) {
      setUser({ uid: localUid });
      setupListeners(localUid);
    } else {
      setLoading(false);
    }

    // Also listen to Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        localStorage.setItem('sub_trafficker_uid', firebaseUser.uid);
        setUser(firebaseUser);
        setupListeners(firebaseUser.uid);
      } else {
        // If there's no localStorage user either, clean up
        const activeUid = localStorage.getItem('sub_trafficker_uid');
        if (!activeUid) {
          setUser(null);
          setProfile(null);
          setTransactions([]);
          setLoading(false);
        } else {
          // If a local session token exists, stay logged in
          setUser({ uid: activeUid });
          setupListeners(activeUid);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTx) unsubscribeTx();
    };
  }, []);

  const handleLogOut = async () => {
    try {
      localStorage.removeItem('sub_trafficker_uid');
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setTransactions([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  const handleSuccessTransaction = (updatedProfile: UserProfile, tx: Transaction) => {
    setProfile(updatedProfile);
    setTransactions(prev => [tx, ...prev]);
  };

  // Dynamically auto-detect carrier connection in real-time on load and update Firestore if it differs
  useEffect(() => {
    if (!profile) return;

    const autoSyncCarrier = async () => {
      try {
        const detectedCarrier = await detectCarrierRealTime();
        if (profile.isp !== detectedCarrier) {
          console.log(`[AutoSync] Detected real-time carrier: ${detectedCarrier}. Updating user's profile from ${profile.isp} to ${detectedCarrier}.`);
          const profileRef = doc(db, 'users', profile.uid);
          await updateDoc(profileRef, {
            isp: detectedCarrier
          });
        }
      } catch (err) {
        console.warn('Could not auto-sync carrier details in real-time:', err);
      }
    };

    // Run once when profile initially loads
    autoSyncCarrier();
  }, [profile?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="relative w-12 h-12 flex items-center justify-center mb-4">
          <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <p className="text-slate-500 text-sm font-semibold tracking-wide animate-pulse uppercase">Syncing Gateway...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <AuthScreen 
        onAuthSuccess={(prof) => {
          localStorage.setItem('sub_trafficker_uid', prof.uid);
          localStorage.setItem('last_sub_trafficker_uid', prof.uid);
          setUser({ uid: prof.uid });
          setProfile(prof);
        }} 
      />
    );
  }

  return (
    <div 
      className={`min-h-screen transition-all duration-700 pb-20 relative ${themeStyles[theme].bg}`}
      style={theme === 'ai_3d' ? { backgroundColor: ai3dConfig.canvasBg, color: ai3dConfig.textColor } : undefined}
    >
      {/* High-Tech Background Watermark Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.06] flex items-center justify-center select-none">
        <div className="text-center transform -rotate-12 space-y-4">
          <div className="flex items-center justify-center gap-6 text-slate-400">
            <Radio size={120} className="animate-pulse" />
            <Signal size={120} />
            <Activity size={120} />
          </div>
          <p className="text-4xl sm:text-6xl font-black font-mono tracking-[0.3em] uppercase text-slate-400 border-y-2 border-slate-400/30 py-3">
            SUB TRAFFICKER • AIRTIME & DATA REWARDS
          </p>
          <p className="text-xs font-mono tracking-widest text-slate-400 uppercase">
            Instant Airtime to Cash • Data Rewards • Direct Bank Transfers
          </p>
        </div>
      </div>

      {/* Clean Desktop Navigation Header */}
      <header className={`sticky top-0 z-30 shadow-sm border-b transition-all duration-300 ${themeStyles[theme].headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo with App Icon & Network Status Pill */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg border border-sky-500/30 flex-shrink-0 bg-slate-900">
              <img 
                src="/pwa-icon.png" 
                alt="Sub Trafficker Icon by Chimex Verse LLC" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg tracking-tight text-white flex items-center gap-1">
                  SUB <span className="text-sky-400">TRAFFICKER</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  ONLINE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                by Chimex Verse LLC • Airtime Exchange & 3D Action Games
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {/* Theme Selector Button Group */}
            <div className="flex bg-slate-900 border border-slate-750 p-1 rounded-2xl gap-1 items-center" id="theme-selector-bar">
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-1.5 rounded-xl transition ${theme === 'light' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Light Theme"
                id="theme-light-btn"
              >
                <Sun size={14} />
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-1.5 rounded-xl transition ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Dark Theme"
                id="theme-dark-btn"
              >
                <Moon size={14} />
              </button>
              <button
                onClick={() => handleThemeChange('cyber')}
                className={`p-1.5 rounded-xl transition ${theme === 'cyber' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Cyber Green"
                id="theme-cyber-btn"
              >
                <Terminal size={14} />
              </button>
              <button
                onClick={() => handleThemeChange('ai')}
                className={`p-1.5 rounded-xl transition ${theme === 'ai' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="AI Neural Theme"
                id="theme-ai-btn"
              >
                <Cpu size={14} />
              </button>
              <button
                onClick={() => handleThemeChange('ai_3d')}
                className={`px-2 py-1 rounded-xl transition flex items-center gap-1 font-bold text-[11px] ${theme === 'ai_3d' ? 'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 text-white shadow-sm' : 'text-fuchsia-400 hover:text-fuchsia-200'}`}
                title="AI 3D Dynamic Auto-Morphing Theme (Changes every 1-2 mins)"
                id="theme-ai-3d-btn"
              >
                <Box size={13} className="animate-spin-slow" />
                <span>3D AI</span>
              </button>
            </div>

            {/* AI 3D Dynamic Controls if active */}
            {theme === 'ai_3d' && (
              <div className="flex items-center gap-1.5 bg-fuchsia-950/60 border border-fuchsia-500/30 p-1 rounded-2xl animate-fadeIn">
                <button
                  onClick={triggerAi3dMorph}
                  className="px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-[10px] rounded-xl flex items-center gap-1 transition shadow-sm cursor-pointer"
                  title="Force Instant 3D Theme Morph"
                  id="force-ai-morph-btn"
                >
                  <RefreshCw size={11} className="animate-spin" />
                  <span>Morph Now</span>
                </button>
                <button
                  onClick={() => setAi3dConfig(prev => ({ ...prev, intervalMin: prev.intervalMin === 1 ? 2 : 1 }))}
                  className="px-2 py-1 bg-slate-900 border border-fuchsia-500/20 text-fuchsia-300 font-mono text-[10px] rounded-xl hover:text-white transition cursor-pointer"
                  title="Toggle Auto-Morph Interval (1 min vs 2 mins)"
                  id="toggle-morph-interval-btn"
                >
                  ⏱️ {ai3dConfig.intervalMin}m Auto
                </button>
              </div>
            )}

            {/* PWA Install App Button with Icon */}
            <button
              onClick={handleInstallPWA}
              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl transition cursor-pointer flex items-center gap-2 shadow-md border border-blue-400/30"
              title="Install Sub Trafficker App on your device"
              id="install-pwa-btn"
            >
              <Smartphone size={15} className="text-sky-300" />
              <span>{isAppInstalled ? 'Installed' : 'Install App'}</span>
            </button>

            {/* Device Push Notifications Button */}
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotificationEnabled(granted);
                if (granted) {
                  sendDeviceNotification("Sub Trafficker Push Notifications Active! 🔔", {
                    body: "You will now receive direct device notifications for chat messages, friend requests, and game invites."
                  });
                } else {
                  alert("Please allow notifications in your browser permissions to receive direct device alerts.");
                }
              }}
              className={`p-2 rounded-2xl transition cursor-pointer flex items-center gap-1 font-bold text-xs ${
                notificationEnabled 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title="Enable Device Push Notifications"
              id="device-notification-btn"
            >
              <Bell size={15} className={notificationEnabled ? 'animate-bounce' : ''} />
              <span className="hidden lg:inline">{notificationEnabled ? 'Push Active' : 'Enable Push'}</span>
            </button>

            {/* Quick Profile Pill */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2.5 p-1.5 pl-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left cursor-pointer transition"
                id="header-profile-pill"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-white flex items-center justify-end gap-1">
                    <span>{profile.name}</span>
                    {profile.nationality && <span className="text-[10px]">{profile.nationality.split(' ')[1] || ''}</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[130px]">
                    {profile.status || `${profile.isp} Carrier`}
                  </p>
                </div>
                <img 
                  src={profile.profilePic} 
                  alt="Profile Avatar" 
                  className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-750 object-cover" 
                  referrerPolicy="no-referrer"
                />
              </button>

              {/* Owner Admin Mode toggle */}
              <button
                onClick={() => setShowOwnerPanel(!showOwnerPanel)}
                className={`p-2 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                  showOwnerPanel 
                    ? 'bg-amber-500 text-slate-950 border border-amber-400 font-bold' 
                    : 'bg-slate-800 border border-slate-700 text-amber-400 hover:bg-slate-750'
                }`}
                title="Owner Revenue Admin panel"
                id="header-owner-admin-btn"
              >
                <Shield size={14} />
                <span className="hidden md:inline">Owner Panel</span>
              </button>

              {/* Logout button */}
              <button
                onClick={handleLogOut}
                className="p-2 bg-slate-800 hover:bg-slate-700 hover:text-rose-400 border border-slate-700 rounded-2xl text-slate-300 transition"
                title="Log Out Securely"
                id="header-logout-btn"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* AI 3D Dynamic Morph Notification Toast */}
      {aiMorphNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 text-white font-mono text-xs font-bold rounded-2xl shadow-2xl border border-white/30 animate-bounce flex items-center gap-2">
          <Sparkles size={14} className="animate-spin" />
          <span>{aiMorphNotice}</span>
        </div>
      )}

      {/* If gaming tab is active, render dedicated Full-Screen Blood Strike Portal */}
      {activeTab === 'gaming' && (
        <BloodStrikePortal
          profile={profile}
          roomId={invitedGameRoomId}
          onExit={() => {
            setInvitedGameRoomId(null);
            setActiveTab('airtime');
          }}
          theme={theme}
        />
      )}

      {/* Main Grid Workspace */}
      <main 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6 transition-all duration-300"
      >

        {/* Live Credentials Configuration Alert Banner */}
        {configStatus && (!configStatus.paystackConfigured || !configStatus.geminiConfigured) && (
          <div className={`p-5 border rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 text-xs transition-all duration-300 ${
            theme === 'light' 
              ? 'bg-amber-50/70 border-amber-200 text-slate-750' 
              : theme === 'cyber'
              ? 'bg-zinc-950 border-amber-500/30 text-emerald-400'
              : theme === 'ai'
              ? 'bg-[#120C24]/90 border-purple-500/30 text-purple-200'
              : 'bg-slate-900 border-amber-500/20 text-slate-300'
          }`} id="live-api-config-alert">
            <div className="space-y-1.5 max-w-xl">
              <p className={`font-bold flex items-center gap-2 ${
                theme === 'cyber' ? 'text-emerald-400' : theme === 'ai' ? 'text-purple-400' : 'text-amber-600'
              }`}>
                <Shield size={16} className="animate-pulse" /> Live Bank Payouts & Assistant Setup
              </p>
              <p className="opacity-90 font-medium leading-relaxed">
                Connect your payment and AI service keys in Settings to enable direct bank payouts and smart answers:
                {!configStatus.paystackConfigured && (
                  <span className={`ml-1.5 font-mono font-bold px-1.5 py-0.5 rounded border ${
                    theme === 'light' 
                      ? 'bg-amber-100 text-amber-800 border-amber-200' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>PAYSTACK_SECRET_KEY</span>
                )}
                {!configStatus.geminiConfigured && (
                  <span className={`ml-1.5 font-mono font-bold px-1.5 py-0.5 rounded border ${
                    theme === 'light' 
                      ? 'bg-purple-100 text-purple-800 border-purple-200' 
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>GEMINI_API_KEY</span>
                )}
              </p>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl text-[10px] font-bold text-center border shrink-0 ${
              theme === 'light' 
                ? 'bg-white border-slate-200 text-slate-600 shadow-sm' 
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              ⚙️ Add keys in <span className="text-blue-500 hover:underline">Settings</span> &rarr; Secrets
            </div>
          </div>
        )}
        
        {/* Balances Board */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5" id="balances-dashboard">
          
          {/* Main Account Cash Balance */}
          <div 
            className={`border rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${themeStyles[theme].card}`}
          >
            <div className={`absolute top-4 right-4 ${theme === 'light' ? 'text-slate-200' : 'text-white/10'}`}>
              <DollarSign size={36} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${themeStyles[theme].sub}`}>Available Cash Balance</p>
              <p className={`text-3xl font-bold font-display mt-2 ${themeStyles[theme].title}`}>₦{profile.cashBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`mt-6 flex items-center justify-between text-xs border-t pt-4 ${themeStyles[theme].border} ${themeStyles[theme].sub}`}>
              <span>Instant Payout status</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Ready
              </span>
            </div>
          </div>

          {/* Traffic Harvested MBs */}
          <div 
            className={`border rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${themeStyles[theme].card}`}
          >
            <div className={`absolute top-4 right-4 ${theme === 'light' ? 'text-slate-200' : 'text-white/10'}`}>
              <Signal size={36} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${themeStyles[theme].sub}`}>Total Data Shared</p>
              <p className={`text-3xl font-bold font-display mt-2 ${themeStyles[theme].title}`}>{profile.totalDataStreamedMB.toFixed(2)} <span className="text-lg opacity-60">MB</span></p>
            </div>
            <div className={`mt-6 flex items-center justify-between text-xs border-t pt-4 ${themeStyles[theme].border} ${themeStyles[theme].sub}`}>
              <span>Mobile Network</span>
              <span className={`font-semibold ${themeStyles[theme].accentText}`}>{profile.isp} Nigeria</span>
            </div>
          </div>

          {/* Cumulative Harvest Earnings */}
          <div 
            className={`border rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${themeStyles[theme].card}`}
          >
            <div className={`absolute top-4 right-4 ${theme === 'light' ? 'text-slate-200' : 'text-white/10'}`}>
              <Landmark size={36} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${themeStyles[theme].sub}`}>Lifetime Data Earnings</p>
              <p className={`text-3xl font-bold font-display mt-2 ${themeStyles[theme].title}`}>₦{profile.accumulatedTrafficCash.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`mt-6 flex items-center justify-between text-xs border-t pt-4 ${themeStyles[theme].border} ${themeStyles[theme].sub}`}>
              <span>Bank account link</span>
              <span className="font-semibold">
                {profile.bankDetails.bankName ? `${profile.bankDetails.bankName}` : 'Not linked'}
              </span>
            </div>
          </div>

        </section>

        {/* Live Admin Owner Panel Console */}
        {showOwnerPanel && (
          <section className="animate-fadeIn">
            <AdminPanel profile={profile} onUpdate={(updated) => setProfile(updated)} theme={theme as any} />
          </section>
        )}

        {/* Physical SIM Synchronizer and Operator Verification */}
        <section className="transition-all duration-300">
          <SimSynchronizer profile={profile} onUpdate={(updated) => setProfile(updated)} theme={theme as any} />
        </section>

        {/* Dynamic Action Tabs Navigator */}
        <section className={`border rounded-3xl shadow-sm overflow-hidden p-1 transition-all duration-300 ${themeStyles[theme].card}`}>
          <div className="flex bg-black/5 p-1.5 rounded-2xl flex-wrap gap-1 sm:gap-1">
            <button
              onClick={() => setActiveTab('airtime')}
              className={`flex-1 min-w-[120px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'airtime' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-airtime"
            >
              <Smartphone size={16} />
              Convert Airtime
            </button>
            <button
              onClick={() => setActiveTab('traffic')}
              className={`flex-1 min-w-[120px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'traffic' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-traffic"
            >
              <Radio size={16} />
              Data Rewards
            </button>
            <button
              onClick={() => setActiveTab('withdrawal')}
              className={`flex-1 min-w-[120px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'withdrawal' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-withdraw"
            >
              <Landmark size={16} />
              Withdraw to Bank
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 min-w-[110px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'chat' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-chat"
            >
              <MessageSquare size={16} />
              Chat & Messages
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 min-w-[110px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'friends' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-friends"
            >
              <Users size={16} />
              Friends
            </button>
            <button
              onClick={() => setActiveTab('gaming')}
              className={`flex-1 min-w-[110px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'gaming' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-gaming"
            >
              <Gamepad2 size={16} />
              Gaming Arcade
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              className={`flex-1 min-w-[100px] py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'ads' ? themeStyles[theme].tabActive : themeStyles[theme].tabInactive}`}
              id="btn-tab-ads"
            >
              <Video size={16} />
              Watch & Earn
            </button>
          </div>
        </section>

        {/* Dynamic Panel Content Rendering */}
        <section className="transition-all duration-300">
          {activeTab === 'airtime' && (
            <AirtimeConverter 
              profile={profile} 
              onSuccess={handleSuccessTransaction} 
            />
          )}
          {activeTab === 'traffic' && (
            <TrafficStreamer 
              profile={profile} 
              onSuccess={handleSuccessTransaction} 
            />
          )}
          {activeTab === 'withdrawal' && (
            <WithdrawalForm 
              profile={profile} 
              onSuccess={handleSuccessTransaction} 
              openProfile={() => setIsProfileOpen(true)}
            />
          )}
          {activeTab === 'chat' && (
            <ChatMenu
              profile={profile}
              initialActiveFriendUid={activeFriendForChat}
              onNavigateToGaming={(roomId) => {
                if (roomId) setInvitedGameRoomId(roomId);
                setActiveTab('gaming');
              }}
              theme={theme}
            />
          )}
          {activeTab === 'friends' && (
            <FriendsMenu
              profile={profile}
              onNavigateToChat={(friendUid) => {
                if (friendUid) setActiveFriendForChat(friendUid);
                setActiveTab('chat');
              }}
              onInviteToGame={(friendUid, friendName, friendPic) => {
                setActiveTab('gaming');
              }}
              theme={theme}
            />
          )}
          {activeTab === 'gaming' && (
            <GamingMenu
              profile={profile}
              invitedRoomId={invitedGameRoomId}
              theme={theme}
            />
          )}
          {activeTab === 'ads' && (
            <AdWatcher 
              profile={profile}
              onAdCompleted={(updatedProfile) => {
                setProfile(updatedProfile);
              }}
              theme={theme}
            />
          )}
        </section>

        {/* Real-time Transactions list */}
        <section className="transition-all duration-300">
          <TransactionHistory transactions={transactions} />
        </section>

      </main>

      {/* Footer Branding Area */}
      <footer className={`mt-12 py-8 text-center text-xs border-t ${themeStyles[theme].border} ${themeStyles[theme].sub}`}>
        <p className="font-semibold tracking-wider uppercase">Chimexverse &copy; 2026</p>
        <p className="mt-1 opacity-60">Protected by biometric security and instant Nigerian bank transfers.</p>
      </footer>

      {/* Profile Editing Modal Overlay */}
      {isProfileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setIsProfileOpen(false)}
          onUpdate={handleUpdateProfile}
        />
      )}

      {/* PWA Install Guide Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-750 rounded-3xl p-6 shadow-2xl space-y-5 text-white">
            {/* Header with App Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl border border-sky-500/40 bg-slate-950 flex-shrink-0">
                  <img 
                    src="/pwa-icon.png" 
                    alt="Sub Trafficker Icon" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-wide flex items-center gap-1.5">
                    Sub Trafficker
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      PWA App
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">by Chimex Verse LLC</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Install <strong>Sub Trafficker</strong> on your home screen or desktop for full-screen telecom streaming, fast offline loading, and 3D FPS gaming!
            </p>

            {/* Install Steps by Platform */}
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-sky-400 flex items-center gap-1.5">
                  <span>📱 Android / Chrome</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Tap the browser menu <strong>(⋮)</strong> and select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-rose-400 flex items-center gap-1.5">
                  <span>🍎 iPhone & iPad (Safari)</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Tap the <strong>Share</strong> button (box with upward arrow) and choose <strong>"Add to Home Screen"</strong>.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>💻 PC / Mac / Chrome</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Click the <strong>Install icon (⊕)</strong> on the right side of the address bar.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI chatbot assistant */}
      <ChimexBot userId={profile?.uid || user?.uid || 'guest'} />
    </div>
  );
}
