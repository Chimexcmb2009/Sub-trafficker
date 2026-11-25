import { FpsWeapon, FpsMelee, FpsChopper, FpsSkin, FpsMapDef, FpsCharacter } from '../../types';

// Asset Images
import bannerImg from '../../assets/images/fps_blood_strike_banner_1786500808933.jpg';
import bloodStrikeArtImg from '../../assets/images/blood_strike_art_1786755989840.jpg';
import vanguardImg from '../../assets/images/character_vanguard_1786500819721.jpg';
import sniperCharImg from '../../assets/images/character_sniper_1786739213692.jpg';
import m4a1Img from '../../assets/images/gun_m4a1_cyber_1786500830901.jpg';
import ak47Img from '../../assets/images/gun_ak47_skin_1786739199418.jpg';
import brAirplaneImg from '../../assets/images/br_airplane_map_1786739187599.jpg';
import knifeArtImg from '../../assets/images/tactical_knife_art_1786755999249.jpg';
import chopperArtImg from '../../assets/images/military_chopper_art_1786756009421.jpg';
import mapShutterIslandImg from '../../assets/images/map_shutter_island_1786756023237.jpg';

export {
  bannerImg,
  bloodStrikeArtImg,
  vanguardImg,
  sniperCharImg,
  m4a1Img,
  ak47Img,
  brAirplaneImg,
  knifeArtImg,
  chopperArtImg,
  mapShutterIslandImg
};

// Preset Weapons
export const PRESET_WEAPONS: FpsWeapon[] = [
  {
    id: 'm4a1_cyber',
    name: 'M4A1 Cyber-Vect',
    category: 'assault',
    damage: 34,
    fireRate: 110,
    reloadTime: 2.1,
    magazineSize: 30,
    unlocked: true,
    skin: 'Neon Cyan',
    image: m4a1Img,
    description: 'Precision tactical assault rifle with holographic optics & zero recoil mitigation.'
  },
  {
    id: 'ak47_blood',
    name: 'AK-47 Blood Strike',
    category: 'assault',
    damage: 48,
    fireRate: 140,
    reloadTime: 2.6,
    magazineSize: 30,
    unlocked: true,
    skin: 'Crimson Fury',
    image: ak47Img,
    description: 'Heavy armor-piercing round assault rifle. Devastating close-to-mid range power.'
  },
  {
    id: 'scar_apex',
    name: 'SCAR-H Apex Predator',
    category: 'assault',
    damage: 42,
    fireRate: 125,
    reloadTime: 2.3,
    magazineSize: 30,
    unlocked: false,
    skin: 'Gold Vanguard',
    image: m4a1Img,
    description: 'Elite heavy caliber battle rifle with thermal signature detection.'
  },
  {
    id: 'spectre_50cal',
    name: 'Spectre .50 BMG Sniper',
    category: 'sniper',
    damage: 115,
    fireRate: 850,
    reloadTime: 3.2,
    magazineSize: 5,
    unlocked: false,
    skin: 'Arctic Camo',
    image: sniperCharImg,
    description: 'One-shot precision anti-material rifle with 12x variable tactical scope.'
  },
  {
    id: 'vector_viper',
    name: 'Vector Viper 9mm',
    category: 'smg',
    damage: 24,
    fireRate: 75,
    reloadTime: 1.8,
    magazineSize: 40,
    unlocked: true,
    skin: 'Cyberpunk Neon',
    image: m4a1Img,
    description: 'Hyper fast-fire submachine gun engineered for extreme close-quarters sliding combat.'
  },
  {
    id: 'origin12_carnage',
    name: 'Origin-12 Carnage Shotgun',
    category: 'shotgun',
    damage: 92,
    fireRate: 280,
    reloadTime: 2.8,
    magazineSize: 8,
    unlocked: false,
    skin: 'Blood Splatter',
    image: ak47Img,
    description: 'Semi-automatic tactical drum shotgun that shreds shields in close range.'
  }
];

// Preset Melee Knives & Blades
export const PRESET_MELEE: FpsMelee[] = [
  {
    id: 'karambit_blood',
    name: 'Karambit Blood Blade',
    type: 'karambit',
    damage: 85,
    attackSpeed: 0.4,
    range: 2.2,
    unlocked: true,
    skin: 'Crimson Glow',
    image: knifeArtImg,
    description: 'Curved spec-ops blade with glowing plasma edge. Swift tactical slash animation.'
  },
  {
    id: 'butterfly_neon',
    name: 'Butterfly Knife Cyber-Flip',
    type: 'butterfly',
    damage: 75,
    attackSpeed: 0.35,
    range: 2.0,
    unlocked: true,
    skin: 'Cyber Neon',
    image: knifeArtImg,
    description: 'Dual-handle flippable combat knife with smooth inspect flip tricks.'
  },
  {
    id: 'shadow_katana',
    name: 'Shadow Strike Katana',
    type: 'katana',
    damage: 100,
    attackSpeed: 0.6,
    range: 3.2,
    unlocked: false,
    skin: 'Obsidian Damascus',
    image: knifeArtImg,
    description: 'High-frequency carbon katana with extended melee execution range.'
  },
  {
    id: 'tactical_machete',
    name: 'Spec-Ops Heavy Machete',
    type: 'machete',
    damage: 90,
    attackSpeed: 0.5,
    range: 2.5,
    unlocked: true,
    skin: 'Military Camo',
    image: knifeArtImg,
    description: 'Rugged military machete built for clearing brush and silent takedowns.'
  }
];

// Preset Choppers & Extraction Aircraft
export const PRESET_CHOPPERS: FpsChopper[] = [
  {
    id: 'black_hawk_apex',
    name: 'UH-60 Apex Black Hawk',
    type: 'black_hawk',
    speed: 180,
    armor: 500,
    skin: 'Matte Stealth Black',
    unlocked: true,
    image: chopperArtImg,
    description: 'Armored multi-mission tactical transport helicopter with heavy rotor blades.'
  },
  {
    id: 'cyber_gunship_mk2',
    name: 'AH-64 Cyber Gunship Mk II',
    type: 'gunship',
    speed: 210,
    armor: 650,
    skin: 'Dragon Fire Camo',
    unlocked: false,
    image: chopperArtImg,
    description: 'Futuristic combat gunship equipped with dual searchlights and flares.'
  },
  {
    id: 'stealth_drone_x1',
    name: 'Stealth Recon Chopper X-1',
    type: 'stealth_drone',
    speed: 240,
    armor: 400,
    skin: 'Ghost White',
    unlocked: false,
    image: chopperArtImg,
    description: 'Ultra-quiet stealth aircraft engineered for rapid insertion behind enemy lines.'
  }
];

// Preset Weapon / Armor Skins
export const PRESET_SKINS: FpsSkin[] = [
  {
    id: 'skin_damascus',
    name: 'Damascus Steel',
    tier: 'Epic',
    colorHex: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    textureEffect: 'damascus_swirls',
    unlocked: true
  },
  {
    id: 'skin_blood_crimson',
    name: 'Blood Crimson Fury',
    tier: 'Legendary',
    colorHex: '#e11d48',
    glowColor: 'rgba(225, 29, 72, 0.8)',
    textureEffect: 'crimson_embers',
    unlocked: true
  },
  {
    id: 'skin_cyber_gold',
    name: 'Cyberpunk Gold Master',
    tier: 'Mythic',
    colorHex: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.8)',
    textureEffect: 'gold_matrix',
    unlocked: false
  },
  {
    id: 'skin_obsidian_void',
    name: 'Obsidian Void Ghost',
    tier: 'Legendary',
    colorHex: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.7)',
    textureEffect: 'void_nebula',
    unlocked: false
  },
  {
    id: 'skin_arctic_ice',
    name: 'Arctic Glacier Camo',
    tier: 'Rare',
    colorHex: '#e2e8f0',
    glowColor: 'rgba(226, 232, 240, 0.5)',
    textureEffect: 'frost_shards',
    unlocked: true
  }
];

// Preset Maps & Game Modes
export const PRESET_MAPS: FpsMapDef[] = [
  {
    id: 'map_shutter_island',
    name: 'Shutter Island Warzone',
    category: 'battle_royale',
    description: 'Drop from aircraft into a massive tropical warzone with military airbases, radio towers, and shrinking storm radiation.',
    maxPlayers: 50,
    image: mapShutterIslandImg,
    badge: 'BATTLE ROYALE'
  },
  {
    id: 'map_desert_outpost',
    name: 'Desert Canyon Outpost',
    category: 'multiplayer',
    description: 'High-speed tactical slide, jetpack leap, and close quarters bunker firefights.',
    maxPlayers: 10,
    image: brAirplaneImg,
    badge: 'TDM 5v5'
  },
  {
    id: 'map_cyber_city',
    name: 'Cyber City Rooftops',
    category: 'multiplayer',
    description: 'Vertical neon skyscraper firefights with zipline jumps and rooftop sniper nests.',
    maxPlayers: 12,
    image: bannerImg,
    badge: 'GUN GAME'
  },
  {
    id: 'map_zombie_siege',
    name: 'Zombie Bio-Lab Siege',
    category: 'special_ops',
    description: 'Survive endless waves of mutated cyborg zombies with continuous weapon upgrades.',
    maxPlayers: 4,
    image: bloodStrikeArtImg,
    badge: 'ZOMBIES'
  },
  {
    id: 'map_training_range',
    name: 'Tactical Firing Range',
    category: 'special_ops',
    description: 'Zero-pressure test grounds to practice recoil control, 360 aiming, jetpack jumps, and slide turns.',
    maxPlayers: 1,
    image: mapShutterIslandImg,
    badge: 'TRAINING'
  }
];

// Preset Human Operators (Call of Duty / Blood Strike / Free Fire Style)
export const PRESET_CHARACTERS: FpsCharacter[] = [
  {
    id: 'char_vanguard',
    name: 'Captain Vanguard',
    title: 'Tier-1 SAS Operative',
    gender: 'male',
    skinTone: 'tan',
    eyeColor: 'blue',
    speed: 1.15,
    shield: 100,
    perk: '+15% Sprint Speed & Instant Slide Recovery',
    unlocked: true,
    avatar: vanguardImg,
    hairStyle: 'tactical_undercut',
    hairColor: '#1c1917',
    warpaint: 'shadow_stripes',
    outfitCamo: 'camo_urban',
    visorGlow: '#38bdf8'
  },
  {
    id: 'char_spectre',
    name: 'Ghost Spectre',
    title: 'Shadow Recon Sniper',
    gender: 'male',
    skinTone: 'bronze',
    eyeColor: 'amber',
    speed: 1.05,
    shield: 120,
    perk: 'Silenced Footsteps & Thermal Footprint Scan',
    unlocked: true,
    avatar: sniperCharImg,
    hairStyle: 'taper_fade',
    hairColor: '#09090b',
    warpaint: 'skull_mask',
    outfitCamo: 'camo_crimson',
    visorGlow: '#e11d48'
  },
  {
    id: 'char_valkyrie',
    name: 'Valkyrie Frost',
    title: 'Spec-Ops Infiltrator',
    gender: 'female',
    skinTone: 'fair',
    eyeColor: 'green',
    speed: 1.2,
    shield: 110,
    perk: '+20% ADS Speed & Rapid Health Regeneration',
    unlocked: true,
    avatar: vanguardImg,
    hairStyle: 'infiltrator_ponytail',
    hairColor: '#451a03',
    warpaint: 'blood_slash',
    outfitCamo: 'camo_arctic',
    visorGlow: '#06b6d4'
  },
  {
    id: 'char_reaper_ebony',
    name: 'Kobe Stryker',
    title: 'Heavy Commando Breacher',
    gender: 'male',
    skinTone: 'ebony',
    eyeColor: 'brown',
    speed: 1.0,
    shield: 150,
    perk: '+50 Maximum Kinetic Shield & Overdrive Thruster',
    unlocked: true,
    avatar: vanguardImg,
    hairStyle: 'spec_ops_braids',
    hairColor: '#18181b',
    warpaint: 'shadow_stripes',
    outfitCamo: 'camo_desert',
    visorGlow: '#f59e0b'
  }
];

export const SKIN_TONES = [
  { id: 'fair', name: 'Fair Nordic Tone', hex: '#f2c8b0' },
  { id: 'tan', name: 'Desert Tan Tone', hex: '#d49b73' },
  { id: 'bronze', name: 'Bronze Olive Tone', hex: '#b97a48' },
  { id: 'dark', name: 'Deep Bronze Tone', hex: '#7d4a2d' },
  { id: 'ebony', name: 'Rich Ebony Tone', hex: '#452618' }
];

export const EYE_COLORS = [
  { id: 'brown', name: 'Deep Amber Brown', hex: '#5c3a21' },
  { id: 'blue', name: 'Ice Blue Specular', hex: '#2563eb' },
  { id: 'green', name: 'Emerald Recon', hex: '#15803d' },
  { id: 'hazel', name: 'Tactical Hazel', hex: '#854d0e' },
  { id: 'amber', name: 'Cyber Amber', hex: '#d97706' }
];

export const HAIR_STYLES = [
  { id: 'tactical_undercut', name: 'Tactical Undercut (Human Hair)', icon: '💈' },
  { id: 'taper_fade', name: 'Military High-Taper Fade', icon: '✂️' },
  { id: 'spec_ops_braids', name: 'Spec-Ops Combat Braids', icon: '🧵' },
  { id: 'infiltrator_ponytail', name: 'Infiltrator High Ponytail', icon: '👱‍♀️' },
  { id: 'tactical_cap', name: 'Covert Ops Ballcap & Hair', icon: '🧢' },
  { id: 'kevlar_nvg_helmet', name: 'Kevlar Helmet & Dual NVG Night Vision', icon: '🪖' }
];

export const WARPAINTS = [
  { id: 'none', name: 'Clean Operative (No Warpaint)', preview: '👤' },
  { id: 'shadow_stripes', name: 'Triple Cheek Shadow Slashes', preview: '⚡' },
  { id: 'blood_slash', name: 'Crimson Eye War Scar', preview: '🩸' },
  { id: 'skull_mask', name: 'Ghost Half-Skull Face Warpaint', preview: '💀' }
];

export const OUTFIT_CAMOS = [
  { id: 'camo_urban', name: 'Urban Digital Spec-Ops', color: '#334155', accent: '#38bdf8' },
  { id: 'camo_crimson', name: 'Blood Strike Crimson Plate', color: '#881337', accent: '#e11d48' },
  { id: 'camo_arctic', name: 'Arctic Ghost Ghillie', color: '#475569', accent: '#e2e8f0' },
  { id: 'camo_desert', name: 'Desert Canyon Vanguard', color: '#78350f', accent: '#f59e0b' },
  { id: 'camo_gold', name: 'Cyberpunk 2099 Gold Armor', color: '#713f12', accent: '#facc15' }
];
