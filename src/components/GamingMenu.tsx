import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, Trophy, Users, User, Play, RefreshCw, Zap, ShieldAlert, 
  Sparkles, Send, CheckCircle2, XCircle, Flame, Award, Radio, Signal, Target, Crosshair
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GameRoom, GameInvite } from '../types';
import { sendDeviceNotification } from '../utils/notifications';
import BloodStrikeFpsGame from './BloodStrikeFpsGame';
import BloodStrikePortal from './BloodStrikePortal';

interface GamingMenuProps {
  profile: UserProfile;
  invitedRoomId?: string | null;
  onSendChatMessage?: (content: string, gameInviteObj?: any) => void;
  theme?: string;
}

export default function GamingMenu({ profile, invitedRoomId, onSendChatMessage, theme = 'light' }: GamingMenuProps) {
  const [activeGame, setActiveGame] = useState<'blood_strike_fps' | 'tic_tac_toe' | 'traffic_racer'>('blood_strike_fps');
  const [gameMode, setGameMode] = useState<'single' | 'multi'>('single');

  // Tic-Tac-Toe State
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [scores, setScores] = useState({ user: 0, ai: 0, draws: 0 });

  // Multiplayer Room State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(invitedRoomId || null);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);

  // Friends & Invites Modal
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState<GameInvite[]>([]);

  // Sub Traffic Racer Arcade Game State
  const [racerScore, setRacerScore] = useState(0);
  const [racerHighscore, setRacerHighscore] = useState(0);
  const [racerPlaying, setRacerPlaying] = useState(false);
  const [racerLane, setRacerLane] = useState<number>(1); // 0 = Left, 1 = Center, 2 = Right
  const [obstacles, setObstacles] = useState<{ id: number; lane: number; y: number }[]>([]);
  const [tokens, setTokens] = useState<{ id: number; lane: number; y: number }[]>([]);
  const [racerGameOver, setRacerGameOver] = useState(false);

  // 1. Listen to Incoming Game Invites
  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'game_invites'),
      where('toUid', '==', profile.uid),
      where('status', '==', 'pending')
    );

    const unSub = onSnapshot(q, (snap) => {
      const list: GameInvite[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as GameInvite));
      setIncomingInvites(list);

      if (list.length > 0) {
        sendDeviceNotification("🎮 Game Invite Received!", {
          body: `${list[0].fromName} invited you to play ${list[0].gameType === 'tic_tac_toe' ? 'Network Tic-Tac-Toe' : 'Traffic Cyber Racer'}!`
        });
      }
    }, (err) => console.warn("Game invites snapshot notice:", err));

    // Fetch user friends list for invitations
    const q1 = query(collection(db, 'friendships'), where('userA', '==', profile.uid));
    const q2 = query(collection(db, 'friendships'), where('userB', '==', profile.uid));

    const fetchFriends = async (uids: string[]) => {
      const fList: UserProfile[] = [];
      for (const id of uids) {
        if (id === profile.uid) continue;
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) fList.push({ uid: uDoc.id, ...uDoc.data() } as UserProfile);
      }
      setFriendsList(fList);
    };

    let uids: string[] = [];
    const unSub1 = onSnapshot(q1, snap => {
      uids = Array.from(new Set([...uids, ...snap.docs.map(d => d.data().userB)]));
      fetchFriends(uids);
    }, (err) => console.warn("Gaming friendships q1 snapshot notice:", err));
    const unSub2 = onSnapshot(q2, snap => {
      uids = Array.from(new Set([...uids, ...snap.docs.map(d => d.data().userA)]));
      fetchFriends(uids);
    }, (err) => console.warn("Gaming friendships q2 snapshot notice:", err));

    return () => {
      unSub();
      unSub1();
      unSub2();
    };
  }, [profile.uid]);

  // 2. Real-time Multiplayer Room Sync
  useEffect(() => {
    if (!activeRoomId) return;

    const unSubRoom = onSnapshot(doc(db, 'game_rooms', activeRoomId), (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
        setActiveRoom(roomData);
        if (roomData.boardState) setBoard(roomData.boardState);
        if (roomData.winnerUid) setWinner(roomData.winnerUid);
      }
    }, (err) => console.warn("Game room snapshot notice:", err));

    return () => unSubRoom();
  }, [activeRoomId]);

  // Single-Player Tic-Tac-Toe logic
  const checkWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
      [0, 4, 8], [2, 4, 6]            // Diagonals
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every(s => s !== null)) return 'draw';
    return null;
  };

  const handleCellClick = async (index: number) => {
    if (board[index] || winner || aiThinking) return;

    if (gameMode === 'single') {
      const newBoard = [...board];
      newBoard[index] = 'X'; // User is X
      setBoard(newBoard);

      const w = checkWinner(newBoard);
      if (w) {
        setWinner(w);
        if (w === 'X') setScores(s => ({ ...s, user: s.user + 1 }));
        else if (w === 'draw') setScores(s => ({ ...s, draws: s.draws + 1 }));
        return;
      }

      // AI Bot Turn
      setAiThinking(true);
      setTimeout(() => {
        const emptyIndices = newBoard.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
        if (emptyIndices.length > 0) {
          const aiChoice = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          newBoard[aiChoice] = 'O';
          setBoard(newBoard);
          const aiW = checkWinner(newBoard);
          if (aiW) {
            setWinner(aiW);
            if (aiW === 'O') setScores(s => ({ ...s, ai: s.ai + 1 }));
            else if (aiW === 'draw') setScores(s => ({ ...s, draws: s.draws + 1 }));
          }
        }
        setAiThinking(false);
      }, 600);
    } else if (gameMode === 'multi' && activeRoomId && activeRoom) {
      // Multiplayer Online Turn
      const isMyTurn = activeRoom.currentTurnUid === profile.uid;
      if (!isMyTurn) return;

      const mySymbol = activeRoom.hostUid === profile.uid ? 'X' : 'O';
      const newBoard = [...board];
      newBoard[index] = mySymbol;

      const wSymbol = checkWinner(newBoard);
      let winnerUidVal: string | null = null;
      if (wSymbol) {
        if (wSymbol === 'X') winnerUidVal = activeRoom.hostUid;
        else if (wSymbol === 'O') winnerUidVal = activeRoom.guestUid || 'guest';
        else if (wSymbol === 'draw') winnerUidVal = 'draw';
      }

      const nextTurn = activeRoom.hostUid === profile.uid 
        ? (activeRoom.guestUid || activeRoom.hostUid) 
        : activeRoom.hostUid;

      await updateDoc(doc(db, 'game_rooms', activeRoomId), {
        boardState: newBoard,
        currentTurnUid: nextTurn,
        winnerUid: winnerUidVal,
        updatedAt: new Date().toISOString()
      });
    }
  };

  const resetTicTacToe = async () => {
    const emptyBoard = Array(9).fill(null);
    setBoard(emptyBoard);
    setWinner(null);
    setIsXNext(true);

    if (gameMode === 'multi' && activeRoomId) {
      await updateDoc(doc(db, 'game_rooms', activeRoomId), {
        boardState: emptyBoard,
        winnerUid: null,
        currentTurnUid: profile.uid,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // Create Online Multiplayer Room & Dispatch Invite
  const handleCreateMultiplayerRoom = async (friend: UserProfile) => {
    try {
      const roomId = `room_${Date.now()}`;
      const newRoom: GameRoom = {
        id: roomId,
        gameType: activeGame,
        hostUid: profile.uid,
        hostName: profile.name,
        hostPic: profile.profilePic,
        guestUid: friend.uid,
        guestName: friend.name,
        guestPic: friend.profilePic,
        status: 'waiting',
        boardState: Array(9).fill(null),
        currentTurnUid: profile.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'game_rooms', roomId), newRoom);

      // Create invite document
      const inviteId = `invite_${Date.now()}`;
      await setDoc(doc(db, 'game_invites', inviteId), {
        id: inviteId,
        fromUid: profile.uid,
        fromName: profile.name,
        fromPic: profile.profilePic,
        toUid: friend.uid,
        gameType: activeGame,
        roomId: roomId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Dispatch invite message directly to chat thread!
      if (onSendChatMessage) {
        onSendChatMessage(`🎮 Invited you to play ${activeGame === 'tic_tac_toe' ? 'Network Tic-Tac-Toe' : 'Traffic Cyber Racer'}!`, {
          roomId,
          gameType: activeGame,
          status: 'pending'
        });
      }

      setActiveRoomId(roomId);
      setGameMode('multi');
      setShowInviteModal(false);
      alert(`Game room created! Invitation sent to ${friend.name}.`);
    } catch (e: any) {
      console.error(e);
      alert("Could not create room: " + e.message);
    }
  };

  // Accept Game Invite
  const handleAcceptInvite = async (invite: GameInvite) => {
    try {
      await updateDoc(doc(db, 'game_invites', invite.id), { status: 'accepted' });
      
      // Update room guest status
      await updateDoc(doc(db, 'game_rooms', invite.roomId), {
        status: 'in_progress',
        guestUid: profile.uid,
        guestName: profile.name,
        guestPic: profile.profilePic
      });

      setActiveGame(invite.gameType as any);
      setGameMode('multi');
      setActiveRoomId(invite.roomId);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Sub Traffic Cyber Racer Arcade Loop
  useEffect(() => {
    if (!racerPlaying || racerGameOver) return;

    const interval = setInterval(() => {
      // Move obstacles and tokens down
      setObstacles(prev => {
        const moved = prev.map(o => ({ ...o, y: o.y + 8 })).filter(o => o.y < 350);
        // Collision detection
        moved.forEach(o => {
          if (o.y > 270 && o.y < 330 && o.lane === racerLane) {
            setRacerGameOver(true);
            setRacerPlaying(false);
          }
        });
        return moved;
      });

      setTokens(prev => {
        const moved = prev.map(t => ({ ...t, y: t.y + 8 }));
        // Collect tokens
        const remaining: typeof moved = [];
        moved.forEach(t => {
          if (t.y > 270 && t.y < 330 && t.lane === racerLane) {
            setRacerScore(s => s + 50);
          } else if (t.y < 350) {
            remaining.push(t);
          }
        });
        return remaining;
      });

      // Increase score over time
      setRacerScore(s => {
        const ns = s + 1;
        if (ns > racerHighscore) setRacerHighscore(ns);
        return ns;
      });

      // Spawn random obstacles and tokens
      if (Math.random() < 0.1) {
        setObstacles(prev => [...prev, { id: Date.now(), lane: Math.floor(Math.random() * 3), y: 0 }]);
      }
      if (Math.random() < 0.08) {
        setTokens(prev => [...prev, { id: Date.now() + 1, lane: Math.floor(Math.random() * 3), y: 0 }]);
      }

    }, 50);

    return () => clearInterval(interval);
  }, [racerPlaying, racerGameOver, racerLane, racerHighscore]);

  const startRacerGame = () => {
    setRacerScore(0);
    setRacerPlaying(true);
    setRacerGameOver(false);
    setRacerLane(1);
    setObstacles([]);
    setTokens([]);
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-slate-800 dark:text-white flex items-center gap-2">
            <Gamepad2 className="text-purple-600 dark:text-purple-400" size={26} />
            Sub Trafficker Gaming Arcade
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Play real-time single-player and online multiplayer games with your network friends!
          </p>
        </div>

        {/* Game Mode Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
          <button
            onClick={() => { setGameMode('single'); setActiveRoomId(null); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              gameMode === 'single' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <User size={14} /> Single Player
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              gameMode === 'multi' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Users size={14} /> Invite Friend (Multiplayer)
          </button>
        </div>
      </div>

      {/* INCOMING GAME INVITES BANNER */}
      {incomingInvites.length > 0 && (
        <div className="space-y-2">
          {incomingInvites.map((inv) => (
            <div
              key={inv.id}
              className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl flex items-center justify-between gap-4 shadow-lg animate-pulse"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <h4 className="font-bold text-xs">{inv.fromName} Invited You to a Game!</h4>
                  <p className="text-[10px] opacity-90 font-mono">
                    Game: {inv.gameType === 'tic_tac_toe' ? 'Network Tic-Tac-Toe' : 'Sub Traffic Cyber Racer'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleAcceptInvite(inv)}
                className="px-4 py-2 bg-white text-purple-900 font-bold text-xs rounded-xl hover:bg-purple-100 transition shadow-md cursor-pointer"
              >
                Accept & Join Match ⚡
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GAME SELECTOR TABS */}
      <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl gap-2 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => setActiveGame('blood_strike_fps')}
          className={`flex-1 min-w-[160px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeGame === 'blood_strike_fps' ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/30' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Target size={16} />
          Blood Strike Ops (3D FPS)
        </button>

        <button
          onClick={() => setActiveGame('tic_tac_toe')}
          className={`flex-1 min-w-[140px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeGame === 'tic_tac_toe' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Radio size={16} />
          Tic-Tac-Toe Grid
        </button>

        <button
          onClick={() => setActiveGame('traffic_racer')}
          className={`flex-1 min-w-[140px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeGame === 'traffic_racer' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Zap size={16} />
          Cyber Racer Arcade
        </button>
      </div>

      {/* GAME 1: BLOOD STRIKE OPS 3D FPS PORTAL */}
      {activeGame === 'blood_strike_fps' && (
        <BloodStrikePortal
          profile={profile}
          roomId={activeRoomId}
          onExit={() => setActiveGame('tic_tac_toe')}
          theme={theme}
        />
      )}

      {/* GAME 1: NETWORK TIC-TAC-TOE */}
      {activeGame === 'tic_tac_toe' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">You (X)</span>
                <span className="text-xl font-extrabold text-blue-600 dark:text-sky-400">{scores.user} Wins</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Draws</span>
                <span className="text-xl font-extrabold text-slate-500">{scores.draws}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {gameMode === 'multi' ? (activeRoom?.guestName || 'Opponent (O)') : 'Chimex AI (O)'}
                </span>
                <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">{scores.ai} Wins</span>
              </div>
            </div>

            <button
              onClick={resetTicTacToe}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} /> Reset Grid
            </button>
          </div>

          {/* 3x3 Grid Canvas */}
          <div className="max-w-xs mx-auto grid grid-cols-3 gap-3 p-4 bg-slate-900 rounded-3xl shadow-2xl border border-purple-500/30">
            {board.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                className={`h-24 rounded-2xl text-3xl font-black flex items-center justify-center transition cursor-pointer ${
                  cell === 'X'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : cell === 'O'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-500'
                }`}
              >
                {cell === 'X' ? '📡' : cell === 'O' ? '⚡' : ''}
              </button>
            ))}
          </div>

          {/* Winner Banner */}
          {winner && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-center space-y-2 shadow-xl"
            >
              <h4 className="font-extrabold text-lg flex items-center justify-center gap-2">
                <Trophy size={20} className="text-yellow-300" />
                {winner === 'X' ? 'Victory! Network Signal Captured!' : winner === 'O' ? 'Opponent / AI Won!' : 'Match Drawn! Equal Bandwidth!'}
              </h4>
              <button
                onClick={resetTicTacToe}
                className="px-5 py-2 bg-white text-purple-900 font-bold text-xs rounded-xl shadow-md hover:bg-purple-100 transition"
              >
                Play Next Round ⚡
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* GAME 2: SUB TRAFFIC CYBER RACER ARCADE */}
      {activeGame === 'traffic_racer' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono font-bold text-emerald-400">
                Data Score: {racerScore} MB
              </span>
              <span className="text-xs font-mono font-bold text-purple-400">
                High Score: {racerHighscore} MB
              </span>
            </div>

            {!racerPlaying && (
              <button
                onClick={startRacerGame}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
              >
                <Play size={16} /> Start Cyber Race
              </button>
            )}
          </div>

          {/* 3-Lane Highway Canvas */}
          <div className="relative h-80 bg-slate-950 rounded-3xl border-2 border-purple-500/40 overflow-hidden select-none">
            {/* Lane Dividers */}
            <div className="absolute inset-y-0 left-1/3 w-0.5 border-r border-dashed border-slate-700" />
            <div className="absolute inset-y-0 right-1/3 w-0.5 border-r border-dashed border-slate-700" />

            {/* Obstacles (Firewall Blocks) */}
            {obstacles.map(o => (
              <div
                key={o.id}
                style={{
                  top: `${o.y}px`,
                  left: o.lane === 0 ? '16%' : o.lane === 1 ? '50%' : '83%',
                  transform: 'translateX(-50%)'
                }}
                className="absolute w-12 h-10 bg-rose-600 rounded-xl border border-rose-400 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-rose-500/50 animate-pulse"
              >
                🚫 FIREWALL
              </div>
            ))}

            {/* Tokens (Airtime Data Packs) */}
            {tokens.map(t => (
              <div
                key={t.id}
                style={{
                  top: `${t.y}px`,
                  left: t.lane === 0 ? '16%' : t.lane === 1 ? '50%' : '83%',
                  transform: 'translateX(-50%)'
                }}
                className="absolute w-8 h-8 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-sm shadow-lg shadow-emerald-500/50"
              >
                ⚡
              </div>
            ))}

            {/* User Data Packet Car */}
            <div
              style={{
                left: racerLane === 0 ? '16%' : racerLane === 1 ? '50%' : '83%',
                transform: 'translateX(-50%)'
              }}
              className="absolute bottom-6 w-12 h-14 bg-gradient-to-t from-blue-600 to-sky-400 rounded-2xl border-2 border-white flex items-center justify-center text-xl shadow-2xl shadow-sky-400/80 transition-all duration-150"
            >
              🚀
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-2 inset-x-0 flex items-center justify-between px-4">
              <button
                onClick={() => setRacerLane(l => Math.max(0, l - 1))}
                className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-2xl text-white font-black text-xs"
              >
                ⬅️ LEFT
              </button>
              <span className="text-[10px] text-slate-400 font-mono">Dodge Firewalls • Collect ⚡ Tokens</span>
              <button
                onClick={() => setRacerLane(l => Math.min(2, l + 1))}
                className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-2xl text-white font-black text-xs"
              >
                RIGHT ➡️
              </button>
            </div>

            {/* Game Over Modal Overlay */}
            {racerGameOver && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 p-6 text-center">
                <ShieldAlert size={48} className="text-rose-500 animate-bounce" />
                <h4 className="font-extrabold text-xl text-white">Data Connection Interrupted!</h4>
                <p className="text-xs text-slate-300 font-mono">
                  Final Score: <span className="text-emerald-400 font-bold">{racerScore} MB</span>
                </p>
                <button
                  onClick={startRacerGame}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-2xl shadow-lg hover:scale-105 transition"
                >
                  Race Again 🚀
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVITE FRIENDS MODAL */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="text-purple-600" size={20} />
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">Invite Friend to Play</h4>
                </div>
                <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {friendsList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No connected friends found. Add friends first!</p>
                ) : (
                  friendsList.map((f) => (
                    <div
                      key={f.uid}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img src={f.profilePic} alt={f.name} className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <h5 className="font-bold text-xs text-slate-800 dark:text-white">{f.name}</h5>
                          <p className="text-[10px] text-slate-400 font-mono">{f.isp}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCreateMultiplayerRoom(f)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
                      >
                        Send Invite 🎮
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
