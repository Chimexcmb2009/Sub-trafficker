import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crosshair, Shield, Zap, RefreshCw, Trophy, Skull, Target, 
  Sparkles, Lock, CheckCircle2, User, Play, Radio, Volume2, VolumeX,
  Flame, Award, Eye, Maximize2, Minimize2, ChevronRight, Settings,
  Compass, Plane, Wind, ShieldAlert, Cpu, Check, Sliders,
  ArrowUp, FastForward, RotateCcw, RotateCw, ArrowLeft,
  Scissors, Palette, MapPin
} from 'lucide-react';
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  UserProfile, FpsProfile, FpsWeapon, FpsCharacter, FpsMelee, 
  FpsChopper, FpsSkin, FpsMapDef, GameMatchMode, GamePhase 
} from '../types';

// Static Data & Audio
import { 
  PRESET_WEAPONS, PRESET_MELEE, PRESET_CHOPPERS, PRESET_SKINS, 
  PRESET_MAPS, PRESET_CHARACTERS, HAIR_STYLES, OUTFIT_CAMOS,
  bannerImg, bloodStrikeArtImg, vanguardImg, sniperCharImg,
  m4a1Img, ak47Img, brAirplaneImg, knifeArtImg, chopperArtImg, mapShutterIslandImg
} from './fps/fpsData';
import { fpsAudio } from './fps/fpsAudio';

// Subcomponents
import BootSplashScreen from './fps/BootSplashScreen';
import OperativeLoginModal from './fps/OperativeLoginModal';
import LobbyOperative3D from './fps/LobbyOperative3D';
import MobileGameModePrompt from './fps/MobileGameModePrompt';
import BloodStrikeFpsGame from './BloodStrikeFpsGame';

interface BloodStrikePortalProps {
  profile: UserProfile;
  roomId?: string | null;
  onExit: () => void;
  theme?: string;
}

export default function BloodStrikePortal({
  profile,
  roomId,
  onExit,
  theme = 'dark'
}: BloodStrikePortalProps) {
  // Splash & Boot State
  const [hasBooted, setHasBooted] = useState<boolean>(() => {
    return sessionStorage.getItem('bloodstrike_booted') === 'true';
  });

  // Operative Profile State
  const [fpsProfile, setFpsProfile] = useState<FpsProfile | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active Lobby View
  const [lobbyView, setLobbyView] = useState<'lobby' | 'guns' | 'knives' | 'choppers' | 'wardrobe' | 'maps' | 'multiplayer' | 'stats'>('lobby');
  const [selectedMap, setSelectedMap] = useState<FpsMapDef>(PRESET_MAPS[0]);
  const [selectedMode, setSelectedMode] = useState<GameMatchMode>('battle_royale');

  // Custom Match / Squad Room Code
  const [activeRoomCode, setActiveRoomCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('fpsRoom') || roomId || 'warzone_alpha';
  });
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [copiedSquadLink, setCopiedSquadLink] = useState(false);

  // Equipped Gear
  const [equippedCharacter, setEquippedCharacter] = useState<FpsCharacter>(PRESET_CHARACTERS[0]);
  const [equippedWeapon, setEquippedWeapon] = useState<FpsWeapon>(PRESET_WEAPONS[0]);
  const [equippedMelee, setEquippedMelee] = useState<FpsMelee>(PRESET_MELEE[0]);
  const [equippedChopper, setEquippedChopper] = useState<FpsChopper>(PRESET_CHOPPERS[0]);
  const [equippedSkin, setEquippedSkin] = useState<FpsSkin>(PRESET_SKINS[0]);
  const [selectedHair, setSelectedHair] = useState<string>('tactical_helmet');
  const [selectedCamo, setSelectedCamo] = useState<string>('camo_urban');
  const [selectedVisorGlow, setSelectedVisorGlow] = useState<string>('#38bdf8');

  // Emote Trigger for 3D Character
  const [emoteTrigger, setEmoteTrigger] = useState<string>('');

  // Active 3D Combat Match State
  const [inActiveMatch, setInActiveMatch] = useState(false);

  // Matchmaking Queue Countdown
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingTimer, setMatchmakingTimer] = useState(3);

  // 1. Fetch / Sync Operative Profile from Firestore
  useEffect(() => {
    if (!profile?.uid) return;

    const profileRef = doc(db, 'fps_profiles', profile.uid);
    const unSub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FpsProfile;
        setFpsProfile(data);

        // Sync gear
        const foundWeapon = PRESET_WEAPONS.find(w => w.id === data.equippedWeaponId);
        if (foundWeapon) setEquippedWeapon(foundWeapon);

        const foundMelee = PRESET_MELEE.find(m => m.id === data.equippedMeleeId);
        if (foundMelee) setEquippedMelee(foundMelee);

        const foundChopper = PRESET_CHOPPERS.find(c => c.id === data.equippedChopperId);
        if (foundChopper) setEquippedChopper(foundChopper);

        const foundChar = PRESET_CHARACTERS.find(c => c.id === data.equippedCharacterId);
        if (foundChar) setEquippedCharacter(foundChar);

        if (data.hairStyle) setSelectedHair(data.hairStyle);
        if (data.outfitCamo) setSelectedCamo(data.outfitCamo);
        if (data.visorGlow) setSelectedVisorGlow(data.visorGlow);
      } else {
        // First time playing: open Operative Login modal
        setShowLoginModal(true);
      }
    }, (err) => {
      console.warn("FPS profile snapshot notice:", err);
      // Fallback local profile if offline
      const local = localStorage.getItem('fps_guest_profile');
      if (local) {
        try {
          setFpsProfile(JSON.parse(local));
        } catch (e) {
          setShowLoginModal(true);
        }
      } else {
        setShowLoginModal(true);
      }
    });

    return () => unSub();
  }, [profile?.uid]);

  // Handle Boot Sequence Finish
  const handleBootComplete = () => {
    setHasBooted(true);
    sessionStorage.setItem('bloodstrike_booted', 'true');
    fpsAudio.playVictorySound();
  };

  // Handle Operative Profile Save (Guest or Cloud User)
  const handleSaveProfile = async (nickname: string, isGuest: boolean) => {
    const newProfile: FpsProfile = {
      uid: profile?.uid || `guest_${Date.now()}`,
      username: nickname,
      level: 1,
      xp: 150,
      kills: 0,
      deaths: 0,
      headshots: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      credits: 1500,
      bloodGold: 250,
      equippedCharacterId: equippedCharacter.id,
      equippedWeaponId: equippedWeapon.id,
      equippedMeleeId: equippedMelee.id,
      equippedChopperId: equippedChopper.id,
      equippedSkin: equippedSkin.id,
      hairStyle: selectedHair,
      outfitCamo: selectedCamo,
      visorGlow: selectedVisorGlow,
      unlockedWeapons: ['m4a1_cyber', 'ak47_blood', 'vector_viper'],
      unlockedCharacters: ['char_vanguard', 'char_spectre'],
      unlockedMelee: ['karambit_blood', 'butterfly_neon', 'tactical_machete'],
      unlockedChoppers: ['black_hawk_apex']
    };

    setFpsProfile(newProfile);
    setShowLoginModal(false);

    // Save to local storage
    localStorage.setItem('fps_guest_profile', JSON.stringify(newProfile));

    // Save to Firestore if user is authenticated and not guest only
    if (profile?.uid) {
      try {
        await setDoc(doc(db, 'fps_profiles', profile.uid), newProfile, { merge: true });
      } catch (err) {
        console.warn("Could not save fps profile to Firestore:", err);
      }
    }
  };

  // Trigger Matchmaking Countdown
  const handleStartMatch = () => {
    setIsMatchmaking(true);
    setMatchmakingTimer(3);
    fpsAudio.playHitmarker(true);

    const countdown = setInterval(() => {
      setMatchmakingTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          setIsMatchmaking(false);
          setInActiveMatch(true);
          fpsAudio.playVictorySound();
          return 0;
        }
        fpsAudio.playHitmarker();
        return prev - 1;
      });
    }, 1000);
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // IF NOT YET BOOTED, DISPLAY CHIMEXXVERSE -> BLOOD STRIKE -> ASSET DOWNLOAD PROGRESS
  if (!hasBooted) {
    return <BootSplashScreen onComplete={handleBootComplete} />;
  }

  // IF IN COMBAT MATCH, RENDER 3D COMBAT ENGINE
  if (inActiveMatch) {
    return (
      <div className="fixed inset-0 z-50 bg-black w-screen h-screen overflow-hidden flex flex-col">
        {/* Top Minimal In-Match Exit Header */}
        <div className="absolute top-2 left-3 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInActiveMatch(false)}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 backdrop-blur-md cursor-pointer shadow-lg transition active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>EXIT MATCH TO LOBBY</span>
          </button>
        </div>

        <BloodStrikeFpsGame
          profile={profile}
          roomId={activeRoomCode || roomId || 'warzone_alpha'}
          selectedMapId={selectedMap.id}
          selectedWeaponId={equippedWeapon.id}
          selectedCharacterId={equippedCharacter.id}
          onClose={() => setInActiveMatch(false)}
          theme={theme}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 text-white flex flex-col justify-between select-none overflow-hidden font-sans z-40">
      
      {/* Mobile Landscape Game Mode Prompt */}
      <MobileGameModePrompt onFullscreenRequest={toggleFullscreen} />

      {/* Operative Registration / Nickname Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <OperativeLoginModal
            currentProfile={fpsProfile}
            defaultName={profile?.name || profile?.username || 'Apex_Operative'}
            onSaveProfile={handleSaveProfile}
          />
        )}
      </AnimatePresence>

      {/* TOP MILITARY HUD BAR */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md shadow-2xl">
        {/* Left: Exit & Operative Rank Badge */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
            title="Return to Main Chimexx App"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">BACK TO APP</span>
          </button>

          {/* Operative Identity Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-800">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center font-black text-[10px] text-white shadow-sm">
              L{fpsProfile?.level || 1}
            </div>
            <div>
              <div className="font-bold text-xs text-white leading-none flex items-center gap-1">
                <span>{fpsProfile?.username || 'Vanguard_Operative'}</span>
                <span className="text-[9px] px-1 bg-rose-950 text-rose-400 rounded border border-rose-800 font-mono">PRO</span>
              </div>
              <div className="text-[9px] font-mono text-slate-400 leading-none mt-0.5">
                Vanguard Syndicate • {selectedMap.name}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Blood Strike Esports Emblem */}
        <div className="hidden md:flex items-center gap-2">
          <Flame size={16} className="text-rose-500 animate-pulse" />
          <span className="font-black text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-rose-500 uppercase">
            BLOOD STRIKE: WARZONE
          </span>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80">
            PING: 14ms
          </span>
        </div>

        {/* Right: Currencies & Quick Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Blood Gold */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-mono font-bold text-amber-400 shadow-sm">
            <span>💎</span>
            <span>{fpsProfile?.bloodGold ?? 250}</span>
          </div>

          {/* Strike Credits */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-mono font-bold text-emerald-400 shadow-sm">
            <span>🪙</span>
            <span>{fpsProfile?.credits ?? 1500}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted(prev => !prev)}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* MAIN LOBBY STAGE & 3D OPERATIVE VIEWER */}
      <main className="relative flex-1 w-full h-full flex flex-col justify-between overflow-hidden">
        
        {/* Background Key Art Ambience */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={bloodStrikeArtImg}
            alt="Warzone Background"
            className="w-full h-full object-cover opacity-15 filter blur-[2px]"
          />
          <div className="absolute inset-0 bg-radial from-transparent via-slate-950/80 to-slate-950" />
        </div>

        {/* Center Stage: Interactive 3D Operative on Pedestal */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
          <LobbyOperative3D
            character={equippedCharacter}
            weapon={equippedWeapon}
            melee={equippedMelee}
            hairStyle={selectedHair}
            outfitCamo={selectedCamo}
            visorGlow={selectedVisorGlow}
            emoteTrigger={emoteTrigger}
            onEmoteComplete={() => setEmoteTrigger('')}
          />
        </div>

        {/* Left Side: Operative Emotes & Gestures Panel */}
        <div className="relative z-20 p-4 sm:p-6 flex flex-col gap-2 pointer-events-none max-w-xs">
          <div className="pointer-events-auto flex flex-col gap-1.5 bg-slate-950/80 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-xl w-fit">
            <span className="text-[9px] font-mono text-slate-400 font-bold px-2 py-0.5 uppercase tracking-wider">
              GESTURES & EMOTES
            </span>
            
            <button
              type="button"
              onClick={() => {
                setEmoteTrigger('wave');
                fpsAudio.playEmoteSound();
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <span>🖐️</span>
              <span>Tactical Wave</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmoteTrigger('inspect');
                fpsAudio.playKnifeSlash();
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <span>🔍</span>
              <span>Inspect Weapon</span>
            </button>
          </div>
        </div>

        {/* Right Side: Selected Weapon & Loadout Info Cards */}
        <div className="relative z-20 p-4 sm:p-6 self-end flex flex-col items-end gap-2 pointer-events-none max-w-xs">
          <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-xl space-y-2 text-right w-64">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-rose-400 font-bold uppercase tracking-wider">EQUIPPED ARSENAL</span>
              <span className="text-slate-400">{equippedWeapon.category.toUpperCase()}</span>
            </div>

            <div className="font-extrabold text-sm text-white flex items-center justify-end gap-2">
              <span>{equippedWeapon.name}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-left">
              <div>
                <span className="text-slate-400">Damage: </span>
                <span className="text-rose-400 font-bold">{equippedWeapon.damage}</span>
              </div>
              <div>
                <span className="text-slate-400">Fire Rate: </span>
                <span className="text-sky-400 font-bold">{equippedWeapon.fireRate}ms</span>
              </div>
              <div>
                <span className="text-slate-400">Knife: </span>
                <span className="text-amber-400 font-bold">{equippedMelee.name.split(' ')[0]}</span>
              </div>
              <div>
                <span className="text-slate-400">Chopper: </span>
                <span className="text-emerald-400 font-bold">{equippedChopper.name.split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* BOTTOM AAA WARZONE ACTION BAR (GUNS, KNIVES, CHOPPERS, SKINS, MAPS, MATCH BUTTON) */}
      <footer className="relative z-30 px-4 sm:px-6 py-3.5 bg-slate-950/95 border-t border-slate-800 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Tools & Arsenal Customizer Navigation Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* Guns & Weapons Tab */}
          <button
            type="button"
            onClick={() => setLobbyView('guns')}
            className={`px-3 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              lobbyView === 'guns' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            <Crosshair size={14} className="text-rose-400" />
            <span>GUNS</span>
          </button>

          {/* Knives & Melee Blades Tab */}
          <button
            type="button"
            onClick={() => setLobbyView('knives')}
            className={`px-3 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              lobbyView === 'knives' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            <span className="text-xs">🔪</span>
            <span>KNIVES</span>
          </button>

          {/* Choppers & Aircraft Tab */}
          <button
            type="button"
            onClick={() => setLobbyView('choppers')}
            className={`px-3 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              lobbyView === 'choppers' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            <Plane size={14} className="text-amber-400" />
            <span>CHOPPERS</span>
          </button>

          {/* Operative Hair & Clothes Customizer */}
          <button
            type="button"
            onClick={() => setLobbyView('wardrobe')}
            className={`px-3 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              lobbyView === 'wardrobe' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            <Palette size={14} className="text-cyan-400" />
            <span>WARDROBE</span>
          </button>

          {/* Maps & Modes Hub */}
          <button
            type="button"
            onClick={() => setLobbyView('maps')}
            className={`px-3 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              lobbyView === 'maps' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            <MapPin size={14} className="text-emerald-400" />
            <span>MAPS: {selectedMap.name.split(' ')[0]}</span>
          </button>

          {/* Multiplayer Squads & Custom Room Code */}
          <button
            type="button"
            onClick={() => setLobbyView('multiplayer')}
            className={`px-3 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              lobbyView === 'multiplayer' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            <Radio size={14} className="text-rose-400 animate-pulse" />
            <span>SQUADS: {activeRoomCode}</span>
          </button>
        </div>

        {/* Right: Big Call of Duty / Free Fire Style "START MATCH" Button */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[10px] font-mono text-slate-400 uppercase">{selectedMap.badge}</span>
            <span className="text-xs font-bold text-white">{selectedMap.name}</span>
          </div>

          <button
            type="button"
            disabled={isMatchmaking}
            onClick={handleStartMatch}
            className={`px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest transition transform active:scale-95 flex items-center gap-2 cursor-pointer shadow-2xl ${
              isMatchmaking
                ? 'bg-amber-600 text-white animate-pulse shadow-amber-600/40'
                : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/40'
            }`}
          >
            {isMatchmaking ? (
              <>
                <RefreshCw size={18} className="animate-spin text-white" />
                <span>DEPLOYING IN {matchmakingTimer}s...</span>
              </>
            ) : (
              <>
                <Play size={18} className="fill-white" />
                <span>START MATCH</span>
              </>
            )}
          </button>
        </div>

      </footer>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER 1: GUNS & WEAPONS CUSTOMIZER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lobbyView === 'guns' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Crosshair size={20} className="text-rose-500" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    ARSENAL: WEAPONS & FIREARMS
                  </h3>
                </div>
                <button onClick={() => setLobbyView('lobby')} className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer">✕ CLOSE</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {PRESET_WEAPONS.map((w) => {
                  const isSelected = equippedWeapon.id === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => {
                        setEquippedWeapon(w);
                        fpsAudio.playHitmarker();
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-rose-950/70 border-rose-500 shadow-xl shadow-rose-950/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-24 w-full rounded-xl bg-slate-900 overflow-hidden relative">
                        <img src={w.image} alt={w.name} className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/70 text-[9px] font-mono text-rose-400 font-bold rounded">
                          {w.category.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white">{w.name}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{w.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Dmg: <b className="text-rose-400">{w.damage}</b></span>
                        <span>Rate: <b className="text-sky-400">{w.fireRate}ms</b></span>
                        <span>Mag: <b className="text-emerald-400">{w.magazineSize}</b></span>
                      </div>

                      {isSelected && (
                        <div className="py-1 bg-rose-600 text-white text-[10px] font-bold font-mono text-center rounded-lg">
                          ✓ EQUIPPED
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER 2: KNIVES & MELEE WEAPONS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lobbyView === 'knives' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔪</span>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    MELEE: TACTICAL KNIVES & BLADES
                  </h3>
                </div>
                <button onClick={() => setLobbyView('lobby')} className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer">✕ CLOSE</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_MELEE.map((m) => {
                  const isSelected = equippedMelee.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setEquippedMelee(m);
                        fpsAudio.playKnifeSlash();
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-rose-950/70 border-rose-500 shadow-xl shadow-rose-950/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-28 w-full rounded-xl bg-slate-900 overflow-hidden relative">
                        <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/70 text-[9px] font-mono text-amber-400 font-bold rounded">
                          {m.type.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white">{m.name}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{m.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Slash Dmg: <b className="text-rose-400">{m.damage}</b></span>
                        <span>Speed: <b className="text-sky-400">{m.attackSpeed}s</b></span>
                        <span>Range: <b className="text-emerald-400">{m.range}m</b></span>
                      </div>

                      {isSelected && (
                        <div className="py-1 bg-rose-600 text-white text-[10px] font-bold font-mono text-center rounded-lg">
                          ✓ EQUIPPED BLADE
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER 3: CHOPPERS & EXTRACTION AIRCRAFT */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lobbyView === 'choppers' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Plane size={20} className="text-amber-500" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    CHOPPERS: TACTICAL FLIGHT & EXTRACTION
                  </h3>
                </div>
                <button onClick={() => setLobbyView('lobby')} className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer">✕ CLOSE</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_CHOPPERS.map((c) => {
                  const isSelected = equippedChopper.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setEquippedChopper(c);
                        fpsAudio.playHitmarker();
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-amber-950/70 border-amber-500 shadow-xl shadow-amber-950/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-28 w-full rounded-xl bg-slate-900 overflow-hidden relative">
                        <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/70 text-[9px] font-mono text-amber-400 font-bold rounded">
                          {c.type.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white">{c.name}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{c.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Speed: <b className="text-sky-400">{c.speed} km/h</b></span>
                        <span>Armor: <b className="text-emerald-400">{c.armor} HP</b></span>
                      </div>

                      {isSelected && (
                        <div className="py-1 bg-amber-600 text-white text-[10px] font-bold font-mono text-center rounded-lg">
                          ✓ EQUIPPED CHOPPER
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER 4: WARDROBE (HAIR, CAMO CLOTHES, VISOR GLOW) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lobbyView === 'wardrobe' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Palette size={20} className="text-cyan-400" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    OPERATIVE CUSTOMIZATION: HAIR & CLOTHES
                  </h3>
                </div>
                <button onClick={() => setLobbyView('lobby')} className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer">✕ CLOSE</button>
              </div>

              {/* Hairstyle / Headgear Selection */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  1. Tactical Headgear & Hairstyle
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HAIR_STYLES.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setSelectedHair(h.id);
                        fpsAudio.playHitmarker();
                      }}
                      className={`p-3 rounded-2xl border text-left text-xs font-bold transition flex items-center gap-2.5 cursor-pointer ${
                        selectedHair === h.id 
                          ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 shadow-md' 
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-base">{h.icon}</span>
                      <span>{h.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Camo Outfit & Uniform Colors */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  2. Tactical Combat Uniform & Camo Rig
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OUTFIT_CAMOS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCamo(c.id);
                        setSelectedVisorGlow(c.accent);
                        fpsAudio.playHitmarker();
                      }}
                      className={`p-3 rounded-2xl border text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        selectedCamo === c.id 
                          ? 'bg-rose-950/70 border-rose-500 text-white shadow-md' 
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c.accent }} />
                        <span>{c.name}</span>
                      </div>
                      {selectedCamo === c.id && <Check size={14} className="text-rose-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER 5: MAPS & MATCH MODES SELECTOR */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lobbyView === 'maps' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-emerald-500" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    WARZONE MAPS & GAME MODES
                  </h3>
                </div>
                <button onClick={() => setLobbyView('lobby')} className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer">✕ CLOSE</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRESET_MAPS.map((mapItem) => {
                  const isSelected = selectedMap.id === mapItem.id;
                  return (
                    <div
                      key={mapItem.id}
                      onClick={() => {
                        setSelectedMap(mapItem);
                        if (mapItem.category === 'battle_royale') setSelectedMode('battle_royale');
                        else if (mapItem.id === 'map_desert_outpost') setSelectedMode('team_deathmatch');
                        else if (mapItem.id === 'map_cyber_city') setSelectedMode('gun_game');
                        else if (mapItem.id === 'map_zombie_siege') setSelectedMode('zombie_siege');
                        else setSelectedMode('training_range');
                        fpsAudio.playHitmarker();
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-emerald-950/70 border-emerald-500 shadow-xl shadow-emerald-950/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-28 w-full rounded-xl bg-slate-900 overflow-hidden relative">
                        <img src={mapItem.image} alt={mapItem.name} className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/70 text-[9px] font-mono text-emerald-400 font-bold rounded">
                          {mapItem.badge}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white">{mapItem.name}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{mapItem.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Max Players: <b className="text-white">{mapItem.maxPlayers}</b></span>
                        <span className="text-emerald-400">{mapItem.category.toUpperCase()}</span>
                      </div>

                      {isSelected && (
                        <div className="py-1 bg-emerald-600 text-white text-[10px] font-bold font-mono text-center rounded-lg">
                          ✓ ACTIVE BATTLEFIELD
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER 6: SQUAD MATCH & MULTIPLAYER ROOM CODE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lobbyView === 'multiplayer' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Radio size={20} className="text-rose-500 animate-pulse" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    REAL-TIME SQUAD MULTIPLAYER
                  </h3>
                </div>
                <button onClick={() => setLobbyView('lobby')} className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer">✕ CLOSE</button>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase">CURRENT ACTIVE MATCH CODE</span>
                  <span className="px-2.5 py-1 bg-rose-950 text-rose-400 rounded-lg text-xs font-mono font-black border border-rose-800">
                    {activeRoomCode}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Share this match code or copy your direct squad invite link below. When friends join, they spawn directly into the 3D battlefield with you in real-time!
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}?fpsRoom=${activeRoomCode}`;
                      navigator.clipboard.writeText(url).catch(() => {});
                      fpsAudio.playHitmarker();
                      setCopiedSquadLink(true);
                      setTimeout(() => setCopiedSquadLink(false), 2500);
                    }}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    {copiedSquadLink ? '✓ Squad Link Copied!' : '📋 Copy Squad Invite Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const randCode = `SQUAD-${Math.floor(100 + Math.random() * 900)}`;
                      setActiveRoomCode(randCode);
                      fpsAudio.playHitmarker();
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer"
                  >
                    🎲 New Code
                  </button>
                </div>
              </div>

              {/* Join Existing Friend Room */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">JOIN SQUAD BY CODE</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customRoomInput}
                    onChange={(e) => setCustomRoomInput(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE (e.g. SQUAD-77)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customRoomInput.trim()) {
                        setActiveRoomCode(customRoomInput.trim());
                        setCustomRoomInput('');
                        setLobbyView('lobby');
                        fpsAudio.playHitmarker();
                      }
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer"
                  >
                    CONNECT
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
