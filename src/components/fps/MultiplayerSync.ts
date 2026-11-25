import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export interface LivePeerPlayer {
  uid: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  shield: number;
  action: 'idle' | 'walking' | 'running' | 'sprinting' | 'jumping' | 'crouching' | 'shooting' | 'reloading' | 'melee' | 'dead';
  weaponId: string;
  characterId: string;
  kills: number;
  isFiring: boolean;
  team: 'alpha' | 'bravo';
  updatedAt: number;
  // Local lerp targets
  targetX?: number;
  targetY?: number;
  targetZ?: number;
  targetYaw?: number;
  targetPitch?: number;
}

export interface MatchKillEvent {
  id: string;
  killerName: string;
  victimName: string;
  weaponName: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface MatchChatMessage {
  id: string;
  senderName: string;
  text: string;
  teamOnly: boolean;
  timestamp: number;
}

export function useFpsMultiplayer(
  matchId: string,
  localUid: string,
  localName: string,
  characterId: string,
  weaponId: string
) {
  const [remotePlayers, setRemotePlayers] = useState<Record<string, LivePeerPlayer>>({});
  const [killFeed, setKillFeed] = useState<MatchKillEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<MatchChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [pingMs, setPingMs] = useState(18);

  const lastSendTime = useRef(0);

  // 1. Join Match & Listen to other real players
  useEffect(() => {
    if (!matchId || !localUid) return;

    const matchRef = doc(db, 'fps_matches', matchId);
    const playersCol = collection(db, 'fps_matches', matchId, 'players');
    const eventsCol = collection(db, 'fps_matches', matchId, 'events');
    const chatCol = collection(db, 'fps_matches', matchId, 'chat');

    // Register local player in Firestore
    const localPlayerRef = doc(db, 'fps_matches', matchId, 'players', localUid);
    const initialPlayerState: LivePeerPlayer = {
      uid: localUid,
      name: localName || 'Apex_Operative',
      x: 0,
      y: 1.0,
      z: 10,
      yaw: 0,
      pitch: 0,
      health: 100,
      shield: 100,
      action: 'idle',
      weaponId: weaponId || 'm4a1_cyber',
      characterId: characterId || 'char_vanguard',
      kills: 0,
      isFiring: false,
      team: 'alpha',
      updatedAt: Date.now()
    };

    setDoc(localPlayerRef, initialPlayerState, { merge: true }).catch((err) => {
      console.warn("Could not register local player in match:", err);
    });

    setIsConnected(true);

    // Listen to all players in match
    const unSubPlayers = onSnapshot(playersCol, (snapshot) => {
      const peers: Record<string, LivePeerPlayer> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LivePeerPlayer;
        if (data.uid !== localUid) {
          peers[data.uid] = {
            ...data,
            targetX: data.x,
            targetY: data.y,
            targetZ: data.z,
            targetYaw: data.yaw,
            targetPitch: data.pitch
          };
        }
      });
      setRemotePlayers(peers);
    });

    // Listen to real-time events / killfeed
    const unSubEvents = onSnapshot(eventsCol, (snapshot) => {
      const events: MatchKillEvent[] = [];
      snapshot.forEach((docSnap) => {
        events.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      events.sort((a, b) => b.timestamp - a.timestamp);
      setKillFeed(events.slice(0, 5));
    });

    // Listen to live chat
    const unSubChat = onSnapshot(chatCol, (snapshot) => {
      const msgs: MatchChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setChatMessages(msgs.slice(-8));
    });

    // Cleanup on exit
    return () => {
      unSubPlayers();
      unSubEvents();
      unSubChat();
      deleteDoc(localPlayerRef).catch(() => {});
    };
  }, [matchId, localUid]);

  // 2. Broadcast local player transform & state throttled (~16Hz / 60ms)
  const broadcastLocalState = useCallback((state: Partial<LivePeerPlayer>) => {
    const now = Date.now();
    if (now - lastSendTime.current < 55) return;
    lastSendTime.current = now;

    if (!matchId || !localUid) return;

    const localPlayerRef = doc(db, 'fps_matches', matchId, 'players', localUid);
    updateDoc(localPlayerRef, {
      ...state,
      updatedAt: now
    }).catch(() => {});
  }, [matchId, localUid]);

  // 3. Send Hit / Combat Damage to another real player
  const reportDamageToPeer = useCallback(async (targetUid: string, damageAmount: number, isHeadshot: boolean, weaponName: string) => {
    if (!matchId || !targetUid) return;

    try {
      const targetRef = doc(db, 'fps_matches', matchId, 'players', targetUid);
      const snap = await getDoc(targetRef);
      if (snap.exists()) {
        const targetData = snap.data() as LivePeerPlayer;
        const newShield = Math.max(0, targetData.shield - damageAmount);
        const leftoverDmg = Math.max(0, damageAmount - targetData.shield);
        const newHealth = Math.max(0, targetData.health - leftoverDmg);

        await updateDoc(targetRef, {
          shield: newShield,
          health: newHealth,
          action: newHealth <= 0 ? 'dead' : targetData.action
        });

        // If lethal, broadcast killfeed event
        if (newHealth <= 0 && targetData.health > 0) {
          const eventsCol = collection(db, 'fps_matches', matchId, 'events');
          const killDoc = doc(eventsCol);
          await setDoc(killDoc, {
            killerName: localName || 'Operative',
            victimName: targetData.name || 'Target',
            weaponName: weaponName || 'M4A1 Cyber',
            isHeadshot,
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      console.warn("Could not sync peer damage:", err);
    }
  }, [matchId, localName]);

  // 4. Send Match Chat message
  const sendMatchChat = useCallback(async (text: string) => {
    if (!matchId || !text.trim()) return;
    try {
      const chatCol = collection(db, 'fps_matches', matchId, 'chat');
      const chatDoc = doc(chatCol);
      await setDoc(chatDoc, {
        senderName: localName || 'Operative',
        text: text.trim(),
        teamOnly: false,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn("Could not broadcast chat:", err);
    }
  }, [matchId, localName]);

  return {
    remotePlayers,
    killFeed,
    chatMessages,
    isConnected,
    pingMs,
    broadcastLocalState,
    reportDamageToPeer,
    sendMatchChat
  };
}
