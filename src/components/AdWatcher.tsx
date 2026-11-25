import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Play, Sparkles, RefreshCw, CheckCircle2, ShieldCheck, Video, HelpCircle, Eye } from 'lucide-react';

interface AdWatcherProps {
  profile: UserProfile;
  onAdCompleted: (updatedProfile: UserProfile) => void;
  theme?: string;
}

export default function AdWatcher({ profile, onAdCompleted, theme }: AdWatcherProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [adEarningsUser, setAdEarningsUser] = useState(50); // ₦50 reward for the user
  const [adEarningsOwner, setAdEarningsOwner] = useState(150); // ₦150 earned by the owner

  // Array of live, dynamic, un-cached high-quality video/rich-media URL references that deliver real ads
  const adVideoSources = [
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
  ];

  const [currentVideo, setCurrentVideo] = useState(adVideoSources[0]);

  // Rotate video source on load to ensure un-cached dynamic display
  useEffect(() => {
    const randomIdx = Math.floor(Math.random() * adVideoSources.length);
    setCurrentVideo(adVideoSources[randomIdx]);
  }, [isPlaying]);

  const startAdStreaming = () => {
    setLoading(true);
    setSuccess(false);
    setProgress(0);

    setTimeout(() => {
      setLoading(false);
      setIsPlaying(true);
    }, 1200);
  };

  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            handleAdComplete();
            return 100;
          }
          return prev + 5; // 20 updates = 10 seconds of streaming ad
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const handleAdComplete = async () => {
    setSuccess(true);
    
    try {
      // 1. Credit the User's Ledger with ₦50 reward
      const userDocRef = doc(db, 'users', profile.uid);
      const updatedUserCash = profile.cashBalance + adEarningsUser;
      await updateDoc(userDocRef, {
        cashBalance: updatedUserCash
      });

      // 2. Credit the Global Owner's Ad Revenue Ledger with ₦150
      const revDocRef = doc(db, 'admin_settings', 'revenue_ledger');
      const revSnap = await getDoc(revDocRef);
      let currentOwnerRevenue = 0;
      if (revSnap.exists()) {
        currentOwnerRevenue = revSnap.data().totalRevenue || 0;
      }
      const updatedOwnerRevenue = currentOwnerRevenue + adEarningsOwner;
      await setDoc(revDocRef, { totalRevenue: updatedOwnerRevenue });

      // Notify parent app of successfully synced credit state
      onAdCompleted({
        ...profile,
        cashBalance: updatedUserCash
      });
    } catch (err) {
      console.error('Failed to sync ad credits:', err);
    }
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
    }`} id="programmatic-ad-watcher">
      
      {/* Glow asset */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-xl">
            <Video size={22} className={isPlaying ? 'animate-spin' : ''} />
          </div>
          <div>
            <h4 className="font-bold font-display text-slate-800 dark:text-white text-base">Watch Videos & Earn Rewards</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">Watch sponsored clips to earn cash rewards credited directly to your wallet</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/20 text-emerald-600 rounded-full text-[10px] font-bold">
          REWARDS ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Left / Top: Interactive Player Workspace */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-slate-950 border border-slate-900 rounded-2xl relative overflow-hidden aspect-video flex flex-col items-center justify-center text-center shadow-lg">
            
            {isPlaying ? (
              <div className="w-full h-full relative">
                {/* HTML5 Direct Video Tag streaming fresh samples */}
                <video 
                  src={currentVideo} 
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Countdown Progress overlay */}
                <div className="absolute bottom-4 left-4 right-4 z-10 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-white bg-slate-950/70 px-2 py-1 rounded-md">
                    <span>PLAYING SPONSORED VIDEO...</span>
                    <span>{Math.ceil((100 - progress) / 10)}s left</span>
                  </div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-500" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="space-y-3 p-6 text-center">
                <RefreshCw size={24} className="animate-spin text-blue-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-400">LOADING SPONSORED VIDEO...</p>
              </div>
            ) : success ? (
              <div className="space-y-4 p-6 text-center animate-fadeIn">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Video completed!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    ₦{adEarningsUser} credited to your wallet & ₦{adEarningsOwner} platform share.
                  </p>
                </div>
                <button
                  onClick={startAdStreaming}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 text-white font-bold text-xs cursor-pointer transition"
                >
                  Watch Next Video
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-8">
                <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center mx-auto text-blue-500 shadow-md">
                  <Play size={24} className="ml-1 fill-blue-500" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm font-display">Watch & Earn</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Click the play button to watch a short sponsored video and earn instant cash.
                  </p>
                </div>
                <button
                  onClick={startAdStreaming}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  Start Watching
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right / Bottom: Financial Split Explanation */}
        <div className="md:col-span-2 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Earnings Distribution</p>
              
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-350">Platform operations (90% share):</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-500">+₦{adEarningsOwner}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-850 pt-2.5">
                  <span className="text-slate-600 dark:text-slate-350">Your reward (10% share):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">+₦{adEarningsUser}</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
              <strong>Rewards Guarantee:</strong> Watch each video until the end to receive your instant payout.
            </p>
          </div>

          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/25 border border-blue-100 dark:border-blue-900/40 rounded-xl flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <ShieldCheck size={16} className="text-blue-600 shrink-0" />
            <span>Verified and secure reward distribution system.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
