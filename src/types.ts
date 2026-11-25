/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ISPName = 'MTN' | 'Airtel' | 'Glo' | '9mobile';

export interface BiometricSettings {
  face: boolean;
  fingerprint: boolean;
  passkey: boolean;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  profilePic: string;
  username?: string;
  status?: string;
  nationality?: string;
  bio?: string;
  passkeyCredentialId?: string;
  cashBalance: number; // in NGN
  airtimeBalance: number; // in NGN (the balance on the user's simulated cellular SIM)
  accumulatedTrafficCash: number; // in NGN
  totalDataStreamedMB: number; // in MB
  isp: ISPName;
  bankDetails: BankDetails;
  biometrics: BiometricSettings;
  createdAt: string;
  isOnline?: boolean;
  lastSeen?: string;
  showOnlineStatus?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'airtime_convert' | 'withdrawal' | 'traffic_cashout';
  amount: number; // For airtime, it's the airtime amount. For withdrawal, it's cash.
  receivedAmount: number; // Cash received (after transaction fee, e.g. 15% for airtime)
  networkOrIsp: string; // MTN, Airtel, etc.
  referenceDetails: string; // Phone number or Bank account
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
}

export interface ISPConfig {
  name: ISPName;
  color: string;
  badgeBg: string;
  rate: number; // Cash received per 1 NGN of airtime (e.g. 0.82 meaning 82%)
  trafficRate: number; // Cash received per 1 MB of traffic streamed (e.g. 0.15 NGN per MB)
  logo: string;
}

export interface FriendRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderPic: string;
  senderPhone?: string;
  senderUsername?: string;
  receiverUid: string;
  receiverName: string;
  receiverPic: string;
  initialMessage: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Friendship {
  id: string;
  userA: string;
  userB: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string; // direct userA_userB or community channel ID
  senderUid: string;
  senderName: string;
  senderPic: string;
  content: string;
  timestamp: string;
  attachmentUrl?: string;
  gameInvite?: {
    roomId: string;
    gameType: string;
    status: 'pending' | 'accepted' | 'expired';
  };
}

export interface FpsWeapon {
  id: string;
  name: string;
  category: 'assault' | 'sniper' | 'smg' | 'shotgun' | 'pistol';
  damage: number;
  fireRate: number; // ms delay between shots
  reloadTime: number; // seconds
  magazineSize: number;
  unlocked: boolean;
  skin: string;
  image: string;
  description: string;
}

export interface FpsMelee {
  id: string;
  name: string;
  type: 'karambit' | 'butterfly' | 'katana' | 'machete' | 'kukri';
  damage: number;
  attackSpeed: number;
  range: number;
  unlocked: boolean;
  skin: string;
  image: string;
  description: string;
}

export interface FpsChopper {
  id: string;
  name: string;
  type: 'black_hawk' | 'gunship' | 'stealth_drone' | 'heavy_transport';
  speed: number;
  armor: number;
  skin: string;
  unlocked: boolean;
  image: string;
  description: string;
}

export interface FpsSkin {
  id: string;
  name: string;
  tier: 'Legendary' | 'Mythic' | 'Epic' | 'Rare';
  colorHex: string;
  glowColor: string;
  textureEffect: string;
  unlocked: boolean;
}

export interface FpsMapDef {
  id: string;
  name: string;
  category: 'battle_royale' | 'multiplayer' | 'special_ops';
  description: string;
  maxPlayers: number;
  image: string;
  badge: string;
}

export interface FpsCharacter {
  id: string;
  name: string;
  title: string;
  speed: number;
  shield: number;
  perk: string;
  unlocked: boolean;
  avatar: string;
  gender?: 'male' | 'female';
  skinTone?: 'fair' | 'tan' | 'bronze' | 'dark' | 'ebony';
  eyeColor?: 'brown' | 'blue' | 'green' | 'hazel' | 'amber';
  hairStyle?: string;
  hairColor?: string;
  warpaint?: 'none' | 'shadow_stripes' | 'blood_slash' | 'skull_mask' | 'cross_camo';
  outfitCamo?: string;
  visorGlow?: string;
  webModelUrl?: string;
}

export interface FpsProfile {
  uid: string;
  username: string;
  level: number;
  xp: number;
  kills: number;
  deaths: number;
  headshots: number;
  matchesPlayed: number;
  matchesWon: number;
  credits: number;
  bloodGold: number;
  equippedCharacterId: string;
  equippedWeaponId: string;
  equippedMeleeId?: string;
  equippedChopperId?: string;
  equippedSkin: string;
  gender?: 'male' | 'female';
  skinTone?: 'fair' | 'tan' | 'bronze' | 'dark' | 'ebony';
  eyeColor?: 'brown' | 'blue' | 'green' | 'hazel' | 'amber';
  hairStyle?: string;
  hairColor?: string;
  warpaint?: 'none' | 'shadow_stripes' | 'blood_slash' | 'skull_mask' | 'cross_camo';
  outfitCamo?: string;
  visorGlow?: string;
  webModelUrl?: string;
  unlockedWeapons: string[];
  unlockedCharacters: string[];
  unlockedMelee?: string[];
  unlockedChoppers?: string[];
}

export interface FpsPlayerState {
  uid: string;
  username: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  health: number;
  shield: number;
  kills: number;
  deaths: number;
  isShooting: boolean;
  weaponId: string;
  characterId: string;
  isBot?: boolean;
}

export type GraphicsQuality = 'max' | 'high' | 'normal' | 'low' | 'very_low';
export type GameMatchMode = '1v1' | '2v1' | 'ffa_4' | 'battle_royale' | 'team_deathmatch' | 'gun_game' | 'zombie_siege' | 'training_range';
export type GamePhase = 'lobby' | 'warmup_aircraft' | 'aircraft_countdown' | 'skydiving' | 'combat' | 'game_over';

export interface GameRoom {
  id: string;
  gameType: 'tic_tac_toe' | 'traffic_racer' | 'blood_strike_fps';
  matchMode?: GameMatchMode;
  hostUid: string;
  hostName: string;
  hostPic?: string;
  guestUid?: string;
  guestName?: string;
  guestPic?: string;
  players?: { [uid: string]: { name: string; avatar: string; isBot?: boolean; score?: number } };
  status: 'waiting' | 'in_progress' | 'completed';
  boardState?: (string | null)[];
  currentTurnUid?: string;
  winnerUid?: string; // 'draw' or uid
  scores?: { host: number; guest: number };
  fpsMap?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameInvite {
  id: string;
  fromUid: string;
  fromName: string;
  fromPic: string;
  toUid: string;
  gameType: 'tic_tac_toe' | 'traffic_racer' | 'blood_strike_fps';
  matchMode?: GameMatchMode;
  roomId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

