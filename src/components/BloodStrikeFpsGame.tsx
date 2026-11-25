import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Check,
  Copy,
  Cpu,
  Crosshair,
  Eye,
  Gauge,
  HardDrive,
  MessageSquare,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  Skull,
  Sliders,
  Target,
  Trophy,
  Wind,
  Zap,
} from 'lucide-react';
import { FpsWeapon, UserProfile } from '../types';
import { PRESET_WEAPONS } from './fps/fpsData';
import { checkWebGLSupport, createSafeWebGLRenderer, safelyDisposeRenderer } from '../lib/webglUtils';
import { Real3dEnvironmentBuilder, ObstacleCollider } from './fps/Real3dEnvironment';
import { OperativeAnimationState, RealOperativeRig3D } from './fps/RealOperatives3D';
import { FpsViewmodel3D } from './fps/FpsViewmodel3D';
import { BattleRoyaleManager } from './fps/BattleRoyaleManager';
import {
  detectRecommendedGraphicsPreset,
  FpsOptimizer,
  GRAPHICS_PRESETS,
  GraphicsPreset,
  isTouchCapableDevice,
  loadTouchConfig,
  saveTouchConfig,
  TouchControlsConfig,
} from './fps/PerformanceSettings';
import { useFpsMultiplayer } from './fps/MultiplayerSync';
import { AssetCacheModal } from './AssetCacheModal';

interface BloodStrikeFpsGameProps {
  profile: UserProfile;
  roomId?: string | null;
  onClose?: () => void;
  theme?: string;
  selectedMapId?: string;
  selectedWeaponId?: string;
  selectedCharacterId?: string;
}

class SoundEngine {
  ctx: AudioContext | null = null;
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playGunshot(category: string) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = category === 'sniper' ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(category === 'sniper' ? 140 : 260, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + (category === 'sniper' ? 0.35 : 0.12));
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (category === 'sniper' ? 0.35 : 0.12));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (category === 'sniper' ? 0.35 : 0.12));
  }

  playMeleeSlash() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playHitmarker(isHeadshot = false) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = isHeadshot ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isHeadshot ? 1600 : 1200, now);
    osc.frequency.setValueAtTime(isHeadshot ? 2400 : 1800, now + 0.04);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playJump() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playLanding() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

const sounds = new SoundEngine();

// Pre-allocated scratch math objects (zero allocations in RAF or shoot)
const _lookDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _rayOrigin = new THREE.Vector3();
const _peerPos = new THREE.Vector3();
const _botCenter = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0.4, 170);

const BULLET_POOL_SIZE = 24;

interface PooledBullet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  active: boolean;
}

export default function BloodStrikeFpsGame({
  profile,
  roomId = 'warzone_alpha',
  onClose,
  selectedWeaponId = 'm4a1_cyber',
  selectedCharacterId = 'char_vanguard',
}: BloodStrikeFpsGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeMatchId = roomId || 'warzone_alpha';

  const localUid = profile?.uid || `user_${Date.now()}`;
  const localName = profile?.name || profile?.username || 'Apex_Operative';

  const initialWeapon = PRESET_WEAPONS.find((w) => w.id === selectedWeaponId) || PRESET_WEAPONS[0];
  const [activeWeapon] = useState<FpsWeapon>(initialWeapon);
  const [health, setHealth] = useState(100);
  const [shield, setShield] = useState(100);
  const [ammo, setAmmo] = useState(initialWeapon.magazineSize);
  const [reserveAmmo, setReserveAmmo] = useState(180);
  const [isReloading, setIsReloading] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [isMelee, setIsMelee] = useState(false);
  const [isCrouchingUi, setIsCrouchingUi] = useState(false);
  const [kills, setKills] = useState(0);
  const [hitmarker, setHitmarker] = useState<{ active: boolean; headshot: boolean }>({
    active: false,
    headshot: false,
  });
  const [damageFlash, setDamageFlash] = useState(false);
  const [outsideStorm, setOutsideStorm] = useState(false);

  const [cameraMode, setCameraMode] = useState<'fps' | 'tps'>('fps');
  const [isAirborne, setIsAirborne] = useState(true);
  const [aliveCount, setAliveCount] = useState(24);
  const [totalOperatives, setTotalOperatives] = useState(24);
  const [isVictory, setIsVictory] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [matchKey, setMatchKey] = useState(0);

  const [graphicsPreset, setGraphicsPreset] = useState<GraphicsPreset>(() => detectRecommendedGraphicsPreset());
  const [currentFps, setCurrentFps] = useState(60);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAssetCache, setShowAssetCache] = useState(false);
  const [touchCfg, setTouchCfg] = useState<TouchControlsConfig>(() => loadTouchConfig());
  const [isTouchDevice] = useState<boolean>(() => isTouchCapableDevice());

  const [copiedLink, setCopiedLink] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [webglError, setWebglError] = useState<string | null>(null);

  // Virtual joystick visual knob state (updated only during touch move)
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  // Authoritative Mutable Refs (eliminates stale closures in RAF & listeners)
  const cameraModeRef = useRef<'fps' | 'tps'>(cameraMode);
  const isAimingRef = useRef(isAiming);
  const isReloadingRef = useRef(isReloading);
  const isMeleeRef = useRef(isMelee);
  const activeWeaponRef = useRef(activeWeapon);
  const ammoRef = useRef(ammo);
  const reserveAmmoRef = useRef(reserveAmmo);
  const healthRef = useRef(health);
  const shieldRef = useRef(shield);
  const killsRef = useRef(kills);
  const isGameOverRef = useRef(isGameOver);
  const isVictoryRef = useRef(isVictory);
  const touchCfgRef = useRef(touchCfg);
  const showChatRef = useRef(showChat);
  const lastAliveRef = useRef(aliveCount);
  const lastStormWarnRef = useRef(false);
  const lastSyncRef = useRef(0);
  const lastShotTimeRef = useRef(0);
  const fireIntervalRef = useRef<number | null>(null);
  const reloadTimerRef = useRef<number | null>(null);

  // Multi-touch refs
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);
  useEffect(() => {
    isAimingRef.current = isAiming;
  }, [isAiming]);
  useEffect(() => {
    isReloadingRef.current = isReloading;
  }, [isReloading]);
  useEffect(() => {
    isMeleeRef.current = isMelee;
  }, [isMelee]);
  useEffect(() => {
    activeWeaponRef.current = activeWeapon;
  }, [activeWeapon]);
  useEffect(() => {
    ammoRef.current = ammo;
  }, [ammo]);
  useEffect(() => {
    reserveAmmoRef.current = reserveAmmo;
  }, [reserveAmmo]);
  useEffect(() => {
    healthRef.current = health;
  }, [health]);
  useEffect(() => {
    shieldRef.current = shield;
  }, [shield]);
  useEffect(() => {
    killsRef.current = kills;
  }, [kills]);
  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);
  useEffect(() => {
    isVictoryRef.current = isVictory;
  }, [isVictory]);
  useEffect(() => {
    touchCfgRef.current = touchCfg;
    saveTouchConfig(touchCfg);
  }, [touchCfg]);
  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  const {
    remotePlayers,
    killFeed,
    chatMessages,
    pingMs,
    broadcastLocalState,
    reportDamageToPeer,
    sendMatchChat,
  } = useFpsMultiplayer(activeMatchId, localUid, localName, selectedCharacterId, activeWeapon.id);

  const remotePlayersRef = useRef(remotePlayers);
  useEffect(() => {
    remotePlayersRef.current = remotePlayers;
  }, [remotePlayers]);

  const broadcastRef = useRef(broadcastLocalState);
  useEffect(() => {
    broadcastRef.current = broadcastLocalState;
  }, [broadcastLocalState]);

  const reportDamageRef = useRef(reportDamageToPeer);
  useEffect(() => {
    reportDamageRef.current = reportDamageToPeer;
  }, [reportDamageToPeer]);

  const engineRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    colliders: ObstacleCollider[];
    environment: Real3dEnvironmentBuilder;
    chopper?: { group: THREE.Group; updateRotors: (d: number) => void };
    playerRig: RealOperativeRig3D;
    fpsViewmodel: FpsViewmodel3D;
    playerParachute: THREE.Group;
    battleRoyale: BattleRoyaleManager;
    remoteRigs: Map<string, { rig: RealOperativeRig3D }>;
    bulletPool: PooledBullet[];
    keys: Record<string, boolean>;
    playerPos: THREE.Vector3;
    playerVel: THREE.Vector3;
    yaw: number;
    pitch: number;
    mouseDeltaX: number;
    mouseDeltaY: number;
    isGrounded: boolean;
    isAirborne: boolean;
    isSprinting: boolean;
    isCrouching: boolean;
    animationTime: number;
    recoil: number;
    fpsOptimizer: FpsOptimizer;
  } | null>(null);

  const triggerHitmarker = useCallback((isHeadshot: boolean) => {
    sounds.playHitmarker(isHeadshot);
    setHitmarker({ active: true, headshot: isHeadshot });
    window.setTimeout(() => setHitmarker({ active: false, headshot: false }), 120);
  }, []);

  const handleReload = useCallback(() => {
    const wep = activeWeaponRef.current;
    if (isReloadingRef.current || ammoRef.current >= wep.magazineSize || reserveAmmoRef.current <= 0) return;
    isReloadingRef.current = true;
    setIsReloading(true);

    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      const needed = wep.magazineSize - ammoRef.current;
      const taken = Math.min(needed, reserveAmmoRef.current);
      const nextAmmo = ammoRef.current + taken;
      const nextReserve = reserveAmmoRef.current - taken;
      ammoRef.current = nextAmmo;
      reserveAmmoRef.current = nextReserve;
      setAmmo(nextAmmo);
      setReserveAmmo(nextReserve);
      isReloadingRef.current = false;
      setIsReloading(false);
    }, Math.max(400, wep.reloadTime * 1000));
  }, []);

  const applyPlayerDamage = useCallback((dmg: number) => {
    if (isGameOverRef.current || isVictoryRef.current) return;
    setDamageFlash(true);
    window.setTimeout(() => setDamageFlash(false), 160);

    let nextShield = shieldRef.current;
    let remaining = dmg;
    if (nextShield > 0) {
      const absorbed = Math.min(nextShield, remaining);
      nextShield -= absorbed;
      remaining -= absorbed;
    }
    const nextHealth = Math.max(0, healthRef.current - remaining);
    shieldRef.current = nextShield;
    healthRef.current = nextHealth;
    setShield(nextShield);
    setHealth(nextHealth);

    if (nextHealth <= 0) {
      isGameOverRef.current = true;
      setIsGameOver(true);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, []);

  // Balanced ADS Aim Assist: nudges subtly toward live target strictly within a narrow 6-degree cone
  const applyBalancedAdsAssist = useCallback((engine: NonNullable<typeof engineRef.current>) => {
    if (!touchCfgRef.current.aimAssistEnabled || !isAimingRef.current) return;
    _lookDir
      .set(
        -Math.sin(engine.yaw) * Math.cos(engine.pitch),
        Math.sin(engine.pitch),
        -Math.cos(engine.yaw) * Math.cos(engine.pitch)
      )
      .normalize();
    _rayOrigin.set(engine.playerPos.x, engine.playerPos.y + 0.85, engine.playerPos.z);

    let bestDot = Math.cos(THREE.MathUtils.degToRad(6.0));
    let bestTarget: THREE.Vector3 | null = null;

    for (const bot of engine.battleRoyale.entities) {
      if (!bot.isAlive) continue;
      _toTarget.set(bot.pos.x - _rayOrigin.x, bot.pos.y + 0.9 - _rayOrigin.y, bot.pos.z - _rayOrigin.z);
      const dist = _toTarget.length();
      if (dist > 75 || dist < 1.5) continue;
      _toTarget.multiplyScalar(1 / dist);
      const dot = _lookDir.dot(_toTarget);
      if (dot > bestDot) {
        bestDot = dot;
        _botCenter.set(bot.pos.x, bot.pos.y + 0.9, bot.pos.z);
        bestTarget = _botCenter;
      }
    }

    if (bestTarget) {
      _toTarget.subVectors(bestTarget, _rayOrigin).normalize();
      const targetYaw = Math.atan2(-_toTarget.x, -_toTarget.z);
      const targetPitch = Math.asin(THREE.MathUtils.clamp(_toTarget.y, -0.95, 0.95));
      // Subtle 18% nudge rather than snapping
      let yawDiff = targetYaw - engine.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      engine.yaw += yawDiff * 0.18;
      engine.pitch = THREE.MathUtils.lerp(engine.pitch, targetPitch, 0.18);
    }
  }, []);

  const handleShoot = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || isGameOverRef.current || isVictoryRef.current) return;

    const now = performance.now();
    const wep = activeWeaponRef.current;

    if (isMeleeRef.current) {
      if (now - lastShotTimeRef.current < 420) return;
      lastShotTimeRef.current = now;
      engine.recoil = 0.8;
      sounds.playMeleeSlash();

      for (const bot of engine.battleRoyale.entities) {
        if (!bot.isAlive) continue;
        const d = bot.pos.distanceTo(engine.playerPos);
        if (d <= 3.4) {
          bot.health -= 75;
          triggerHitmarker(true);
          if (bot.health <= 0) {
            bot.isAlive = false;
            bot.rig.updateAnimation(0.016, {
              action: 'dead',
              time: 0,
              recoil: 0,
              aimProgress: 0,
              reloadProgress: 0,
              meleeProgress: 0,
            });
            const nextKills = killsRef.current + 1;
            killsRef.current = nextKills;
            setKills(nextKills);
          }
          break;
        }
      }
      return;
    }

    if (now - lastShotTimeRef.current < Math.max(70, wep.fireRate)) return;

    if (ammoRef.current <= 0 || isReloadingRef.current) {
      handleReload();
      return;
    }

    lastShotTimeRef.current = now;
    const nextAmmo = ammoRef.current - 1;
    ammoRef.current = nextAmmo;
    setAmmo(nextAmmo);
    sounds.playGunshot(wep.category);

    applyBalancedAdsAssist(engine);
    engine.recoil = 1.0;

    _lookDir
      .set(
        -Math.sin(engine.yaw) * Math.cos(engine.pitch),
        Math.sin(engine.pitch),
        -Math.cos(engine.yaw) * Math.cos(engine.pitch)
      )
      .normalize();

    // Reuse pooled bullet tracer (ZERO geometry/material allocation!)
    const pool = engine.bulletPool;
    let slot: PooledBullet | undefined;
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) {
        slot = pool[i];
        break;
      }
    }
    if (!slot && pool.length > 0) slot = pool[0];

    if (slot) {
      slot.active = true;
      slot.life = 1.4;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        engine.playerPos.x + _lookDir.x * 0.85,
        engine.playerPos.y + 0.75 + _lookDir.y * 0.85,
        engine.playerPos.z + _lookDir.z * 0.85
      );
      slot.mesh.quaternion.setFromUnitVectors(_zAxis, _lookDir);
      slot.vel.copy(_lookDir).multiplyScalar(145);
    }

    // Immediate raycast against remote live players
    _rayOrigin.set(engine.playerPos.x, engine.playerPos.y + 0.8, engine.playerPos.z);
    _raycaster.set(_rayOrigin, _lookDir);

    const peers = remotePlayersRef.current;
    Object.entries(peers).forEach(([peerUid, peer]) => {
      _peerPos.set(peer.x, peer.y + 0.85, peer.z);
      if (_raycaster.ray.distanceToPoint(_peerPos) < 1.25) {
        const isHead = Math.random() > 0.65;
        const dmg = isHead ? Math.round(wep.damage * 1.75) : wep.damage;
        triggerHitmarker(isHead);
        reportDamageRef.current(peerUid, dmg, isHead, wep.name);
      }
    });
  }, [applyBalancedAdsAssist, handleReload, triggerHitmarker]);

  // Main Three.js Scene & Combat Loop
  useEffect(() => {
    if (!mountRef.current) return;

    const webgl = checkWebGLSupport();
    if (!webgl.supported) {
      setWebglError(webgl.reason || 'WebGL is not supported or hardware acceleration is disabled.');
      return;
    }

    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.0055);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 650);
    const startY = 105;
    camera.position.set(0, startY, 0);

    const activeConfig = GRAPHICS_PRESETS[graphicsPreset];
    const renderer = createSafeWebGLRenderer({
      antialias: activeConfig.antiAlias,
      powerPreference: 'high-performance',
    });

    if (!renderer) {
      setWebglError('Failed to initialize WebGL context.');
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(activeConfig.pixelRatio);
    renderer.shadowMap.enabled = activeConfig.shadowsEnabled;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Subtle PBR environment reflections via RoomEnvironment
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let envTarget: THREE.WebGLRenderTarget | null = null;
    try {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      roomEnv.dispose();
    } catch {
      // Safe fallback to basic lighting
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Graphics context paused by browser/GPU. Click Redeploy to restore.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Crisp sunlight + ambient hemisphere fill
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.15);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.75);
    sunLight.position.set(60, 90, 40);
    if (activeConfig.shadowsEnabled) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = activeConfig.shadowMapSize;
      sunLight.shadow.mapSize.height = activeConfig.shadowMapSize;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 220;
      const d = 75;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
    }
    scene.add(sunLight);

    const envBuilder = new Real3dEnvironmentBuilder();
    const envData = envBuilder.assembleFullBattlefield(scene, 'grass');

    const localRig = new RealOperativeRig3D(selectedCharacterId, false, '#3f4f38', '#38bdf8');
    localRig.root.position.set(0, startY, 0);
    scene.add(localRig.root);

    const playerParachute = BattleRoyaleManager.createParachuteMesh(0x1e293b, 0x38bdf8);
    playerParachute.position.set(0, 3.2, 0);
    localRig.root.add(playerParachute);

    const fpsViewmodel = new FpsViewmodel3D();
    fpsViewmodel.setWeapon(activeWeaponRef.current.id);
    camera.add(fpsViewmodel.root);
    scene.add(camera);

    const initialPlayerPos = new THREE.Vector3(0, startY, 0);
    const battleRoyale = new BattleRoyaleManager(scene, initialPlayerPos, 23);
    setTotalOperatives(battleRoyale.totalOperatives);
    setAliveCount(battleRoyale.aliveCount);
    lastAliveRef.current = battleRoyale.aliveCount;

    // Pre-allocate tracer bullet pool (zero GC spikes during firefights)
    const bulletGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6);
    bulletGeo.rotateX(Math.PI / 2);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const bulletPool: PooledBullet[] = [];
    for (let i = 0; i < BULLET_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.visible = false;
      scene.add(mesh);
      bulletPool.push({ mesh, vel: new THREE.Vector3(), life: 0, active: false });
    }

    const engine = {
      scene,
      camera,
      renderer,
      colliders: envData.colliders,
      environment: envBuilder,
      chopper: envData.chopperInstance,
      playerRig: localRig,
      fpsViewmodel,
      playerParachute,
      battleRoyale,
      remoteRigs: new Map<string, { rig: RealOperativeRig3D }>(),
      bulletPool,
      keys: {} as Record<string, boolean>,
      playerPos: initialPlayerPos,
      playerVel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      isGrounded: false,
      isAirborne: true,
      isSprinting: false,
      isCrouching: false,
      animationTime: 0,
      recoil: 0,
      fpsOptimizer: new FpsOptimizer(),
    };
    engineRef.current = engine;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showChatRef.current && e.code !== 'Escape') return;
      engine.keys[e.code] = true;
      if (e.code === 'KeyV') setCameraMode((p) => (p === 'fps' ? 'tps' : 'fps'));
      if (e.code === 'KeyR') handleReload();
      if (e.code === 'KeyF' && engine.isAirborne) {
        engine.playerVel.y = -32;
        engine.playerPos.y = Math.max(0.9, engine.playerPos.y - 4);
      }
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        setIsMelee((prev) => {
          const next = !prev;
          fpsViewmodel.setMeleeActive(next);
          return next;
        });
      }
      if (e.code === 'KeyT') setShowChat((p) => !p);
      if (e.code === 'Space' && engine.isGrounded) {
        engine.playerVel.y = 8.5;
        engine.isGrounded = false;
        sounds.playJump();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') engine.isSprinting = true;
      if (e.code === 'KeyC' || e.code === 'ControlLeft') {
        engine.isCrouching = !engine.isCrouching;
        setIsCrouchingUi(engine.isCrouching);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') engine.isSprinting = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        const baseSens = isAimingRef.current ? 0.0012 : 0.0022;
        engine.yaw -= e.movementX * baseSens * touchCfgRef.current.sensitivityX;
        engine.pitch -= e.movementY * baseSens * touchCfgRef.current.sensitivityY;
        engine.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, engine.pitch));
        engine.mouseDeltaX = e.movementX;
        engine.mouseDeltaY = e.movementY;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isGameOverRef.current || isVictoryRef.current) return;
      if (document.pointerLockElement !== renderer.domElement && !isTouchCapableDevice()) {
        renderer.domElement.requestPointerLock?.();
      }
      if (e.button === 0) {
        handleShoot();
      } else if (e.button === 2) {
        setIsAiming(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) setIsAiming(false);
    };

    const preventCtx = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('contextmenu', preventCtx);

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth;
      const h = mountRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animId = 0;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const delta = Math.min((time - lastTime) / 1000, 0.08);
      lastTime = time;
      engine.animationTime += delta;

      // Update rotor animation smoothly if chopper present
      if (engine.chopper) {
        engine.chopper.updateRotors(delta);
      }

      // 2Hz FPS telemetry & dynamic auto-optimization
      engine.fpsOptimizer.update(
        time,
        (sampledFps) => setCurrentFps(sampledFps),
        (recommended) => {
          setGraphicsPreset((prev) => {
            if (prev === recommended) return prev;
            const cfg = GRAPHICS_PRESETS[recommended];
            renderer.setPixelRatio(cfg.pixelRatio);
            renderer.shadowMap.enabled = cfg.shadowsEnabled;
            return recommended;
          });
        }
      );

      if (!isGameOverRef.current && !isVictoryRef.current) {
        const joyX = joystickVecRef.current.x;
        const joyY = joystickVecRef.current.y;

        if (engine.isAirborne) {
          const glideSpeed = engine.playerVel.y < -15 ? Math.abs(engine.playerVel.y) : 13;
          engine.playerPos.y -= glideSpeed * delta;

          const steerX = (engine.keys['KeyD'] || engine.keys['ArrowRight'] ? 1 : 0) - (engine.keys['KeyA'] || engine.keys['ArrowLeft'] ? 1 : 0) + joyX;
          const steerZ = (engine.keys['KeyS'] || engine.keys['ArrowDown'] ? 1 : 0) - (engine.keys['KeyW'] || engine.keys['ArrowUp'] ? 1 : 0) + joyY;

          if (steerX !== 0 || steerZ !== 0) {
            _moveDir.set(steerX, 0, steerZ).normalize().applyAxisAngle(_yAxis, engine.yaw);
            engine.playerPos.x += _moveDir.x * 19 * delta;
            engine.playerPos.z += _moveDir.z * 19 * delta;
          }

          if (engine.playerPos.y <= 0.9) {
            engine.playerPos.y = 0.9;
            engine.playerVel.y = 0;
            engine.isAirborne = false;
            engine.isGrounded = true;
            setIsAirborne(false);
            engine.playerParachute.visible = false;
            sounds.playLanding();
          }
        } else {
          const moveSpeed = engine.isSprinting ? 12 : engine.isCrouching ? 4 : 7.5;
          const inputX =
            (engine.keys['KeyD'] || engine.keys['ArrowRight'] ? 1 : 0) -
            (engine.keys['KeyA'] || engine.keys['ArrowLeft'] ? 1 : 0) +
            joyX;
          const inputZ =
            (engine.keys['KeyS'] || engine.keys['ArrowDown'] ? 1 : 0) -
            (engine.keys['KeyW'] || engine.keys['ArrowUp'] ? 1 : 0) +
            joyY;

          _moveDir.set(inputX, 0, inputZ);
          if (_moveDir.lengthSq() > 0.01) {
            if (_moveDir.lengthSq() > 1) _moveDir.normalize();
            _moveDir.applyAxisAngle(_yAxis, engine.yaw);
            engine.playerPos.x += _moveDir.x * moveSpeed * delta;
            engine.playerPos.z += _moveDir.z * moveSpeed * delta;
          }

          // Arena bounds clamp
          engine.playerPos.x = THREE.MathUtils.clamp(engine.playerPos.x, -175, 175);
          engine.playerPos.z = THREE.MathUtils.clamp(engine.playerPos.z, -175, 175);

          engine.playerVel.y -= 22 * delta;
          engine.playerPos.y += engine.playerVel.y * delta;
          if (engine.playerPos.y <= 0.9) {
            engine.playerPos.y = 0.9;
            engine.playerVel.y = 0;
            engine.isGrounded = true;
          }
        }
      }

      // Battle Royale bots + storm check
      engine.battleRoyale.update(delta, engine.playerPos, {
        onBotKill: () => {
          if (engine.battleRoyale.aliveCount !== lastAliveRef.current) {
            lastAliveRef.current = engine.battleRoyale.aliveCount;
            setAliveCount(engine.battleRoyale.aliveCount);
          }
        },
        onPlayerHit: (dmg) => applyPlayerDamage(dmg),
      });

      if (engine.battleRoyale.aliveCount !== lastAliveRef.current) {
        lastAliveRef.current = engine.battleRoyale.aliveCount;
        setAliveCount(engine.battleRoyale.aliveCount);
        if (engine.battleRoyale.aliveCount === 1 && !isGameOverRef.current) {
          isVictoryRef.current = true;
          setIsVictory(true);
        }
      }

      const inStorm = Math.hypot(engine.playerPos.x, engine.playerPos.z) > engine.battleRoyale.currentStormRadius;
      if (inStorm !== lastStormWarnRef.current) {
        lastStormWarnRef.current = inStorm;
        setOutsideStorm(inStorm);
      }

      // Local human rig transform & animation
      engine.playerRig.root.position.copy(engine.playerPos);
      engine.playerRig.root.rotation.y = engine.yaw;

      const isMoving = Boolean(
        engine.keys['KeyW'] ||
          engine.keys['KeyS'] ||
          engine.keys['KeyA'] ||
          engine.keys['KeyD'] ||
          Math.abs(joystickVecRef.current.x) > 0.1 ||
          Math.abs(joystickVecRef.current.y) > 0.1
      );

      let action: OperativeAnimationState['action'] = 'idle';
      if (engine.isAirborne || !engine.isGrounded) action = 'jumping';
      else if (engine.isCrouching) action = 'crouching';
      else if (isMoving && engine.isSprinting) action = 'sprinting';
      else if (isMoving) action = 'running';

      engine.recoil = Math.max(0, engine.recoil - delta * 6);
      engine.playerRig.updateAnimation(delta, {
        action,
        time: engine.animationTime,
        recoil: engine.recoil,
        aimProgress: isAimingRef.current ? 1 : 0,
        reloadProgress: isReloadingRef.current ? 1 : 0,
        meleeProgress: isMeleeRef.current ? 1 : 0,
      });

      fpsViewmodel.update(delta, {
        isMoving,
        isSprinting: engine.isSprinting,
        isAiming: isAimingRef.current,
        isFiring: engine.recoil > 0.1,
        isReloading: isReloadingRef.current,
        isMelee: isMeleeRef.current,
        recoil: engine.recoil,
        mouseDeltaX: engine.mouseDeltaX,
        mouseDeltaY: engine.mouseDeltaY,
        time: engine.animationTime,
      });
      engine.mouseDeltaX = 0;
      engine.mouseDeltaY = 0;

      // Smooth ADS FOV zoom
      const targetFov = isAimingRef.current ? 54 : 75;
      if (Math.abs(camera.fov - targetFov) > 0.15) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 12);
        camera.updateProjectionMatrix();
      }

      const crouchOffset = engine.isCrouching ? -0.35 : 0;
      if (cameraModeRef.current === 'fps') {
        engine.playerRig.root.visible = false;
        fpsViewmodel.root.visible = true;
        camera.position.set(engine.playerPos.x, engine.playerPos.y + 0.8 + crouchOffset, engine.playerPos.z);
        _lookDir.set(
          -Math.sin(engine.yaw) * Math.cos(engine.pitch),
          Math.sin(engine.pitch),
          -Math.cos(engine.yaw) * Math.cos(engine.pitch)
        );
        _camTarget.addVectors(camera.position, _lookDir);
        camera.lookAt(_camTarget);
      } else {
        engine.playerRig.root.visible = true;
        fpsViewmodel.root.visible = false;
        const camDist = isAimingRef.current ? 2.8 : 4.2;
        camera.position.set(
          engine.playerPos.x + Math.sin(engine.yaw) * camDist,
          engine.playerPos.y + 2.1 + crouchOffset,
          engine.playerPos.z + Math.cos(engine.yaw) * camDist
        );
        camera.lookAt(engine.playerPos.x, engine.playerPos.y + 1.2 + crouchOffset, engine.playerPos.z);
      }

      // Pooled tracer updates & bot hit detection
      const pool = engine.bulletPool;
      for (let i = 0; i < pool.length; i++) {
        const b = pool[i];
        if (!b.active) continue;
        b.mesh.position.addScaledVector(b.vel, delta);
        b.life -= delta;

        for (let k = 0; k < engine.battleRoyale.entities.length; k++) {
          const bot = engine.battleRoyale.entities[k];
          if (!bot.isAlive) continue;
          _botCenter.set(bot.pos.x, bot.pos.y + 0.85, bot.pos.z);
          if (b.mesh.position.distanceToSquared(_botCenter) < 2.25) {
            const isHead = b.mesh.position.y > bot.pos.y + 1.25;
            const dmg = isHead
              ? Math.round(activeWeaponRef.current.damage * 1.6)
              : activeWeaponRef.current.damage;
            bot.health -= dmg;
            triggerHitmarker(isHead);

            if (bot.health <= 0) {
              bot.isAlive = false;
              bot.rig.updateAnimation(delta, {
                action: 'dead',
                time: 0,
                recoil: 0,
                aimProgress: 0,
                reloadProgress: 0,
                meleeProgress: 0,
              });
              const nextKills = killsRef.current + 1;
              killsRef.current = nextKills;
              setKills(nextKills);
            }
            b.life = 0;
            break;
          }
        }

        if (b.life <= 0) {
          b.active = false;
          b.mesh.visible = false;
        }
      }

      // Throttled 10Hz Firestore multiplayer broadcast
      if (time - lastSyncRef.current >= 100) {
        lastSyncRef.current = time;
        broadcastRef.current({
          x: engine.playerPos.x,
          y: engine.playerPos.y,
          z: engine.playerPos.z,
          yaw: engine.yaw,
          pitch: engine.pitch,
          health: healthRef.current,
          shield: shieldRef.current,
          action,
          weaponId: activeWeaponRef.current.id,
          characterId: selectedCharacterId,
          kills: killsRef.current,
        });
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (fireIntervalRef.current) clearInterval(fireIntervalRef.current);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('contextmenu', preventCtx);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      envTarget?.dispose();
      pmremGenerator?.dispose();
      bulletGeo.dispose();
      bulletMat.dispose();
      safelyDisposeRenderer(renderer, container);
    };
  }, [selectedCharacterId, activeMatchId, graphicsPreset, matchKey, applyPlayerDamage, handleReload, handleShoot, triggerHitmarker]);

  // Sync Remote Players into 3D Scene
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    Object.entries(remotePlayers).forEach(([uid, peer]) => {
      let entry = engine.remoteRigs.get(uid);
      if (!entry) {
        const rig = new RealOperativeRig3D(peer.characterId || 'char_vanguard', false, '#1e293b', '#ec4899');
        engine.scene.add(rig.root);
        entry = { rig };
        engine.remoteRigs.set(uid, entry);
      }

      _peerPos.set(peer.x, peer.y, peer.z);
      entry.rig.root.position.lerp(_peerPos, 0.35);
      entry.rig.root.rotation.y = THREE.MathUtils.lerp(entry.rig.root.rotation.y, peer.yaw, 0.35);
      entry.rig.updateAnimation(0.016, {
        action: peer.action || 'idle',
        time: engine.animationTime,
        recoil: peer.isFiring ? 1 : 0,
        aimProgress: 0,
        reloadProgress: 0,
        meleeProgress: 0,
      });
    });

    engine.remoteRigs.forEach((val, uid) => {
      if (!remotePlayers[uid]) {
        engine.scene.remove(val.rig.root);
        engine.remoteRigs.delete(uid);
      }
    });
  }, [remotePlayers]);

  // Touch Virtual Joystick Handlers
  const handleJoystickStart = (e: React.TouchEvent) => {
    if (joystickTouchIdRef.current !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    joystickTouchIdRef.current = t.identifier;
    joystickOriginRef.current = { x: t.clientX, y: t.clientY };
    joystickVecRef.current = { x: 0, y: 0 };
    setJoyKnob({ x: 0, y: 0, active: true });
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickTouchIdRef.current) {
        const dx = t.clientX - joystickOriginRef.current.x;
        const dy = t.clientY - joystickOriginRef.current.y;
        const maxR = 44;
        const dist = Math.hypot(dx, dy);
        const clamped = dist > maxR ? maxR / dist : 1;
        const nx = dx * clamped;
        const ny = dy * clamped;
        joystickVecRef.current = { x: nx / maxR, y: ny / maxR };
        setJoyKnob({ x: nx, y: ny, active: true });
        if (engineRef.current) {
          engineRef.current.isSprinting = dist > maxR * 0.78;
        }
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        joystickVecRef.current = { x: 0, y: 0 };
        setJoyKnob({ x: 0, y: 0, active: false });
        if (engineRef.current) engineRef.current.isSprinting = false;
        break;
      }
    }
  };

  // Right-Side Touch-Drag Look Handlers
  const handleLookStart = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    lookTouchIdRef.current = t.identifier;
    lookLastPosRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current === null || !engineRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        const dx = t.clientX - lookLastPosRef.current.x;
        const dy = t.clientY - lookLastPosRef.current.y;
        lookLastPosRef.current = { x: t.clientX, y: t.clientY };
        const aimFactor = isAimingRef.current ? 0.0028 : 0.0046;
        engineRef.current.yaw -= dx * aimFactor * touchCfgRef.current.sensitivityX;
        engineRef.current.pitch -= dy * aimFactor * touchCfgRef.current.sensitivityY;
        engineRef.current.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, engineRef.current.pitch));
        engineRef.current.mouseDeltaX = dx;
        engineRef.current.mouseDeltaY = dy;
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  const startHoldFire = () => {
    handleShoot();
    if (fireIntervalRef.current) clearInterval(fireIntervalRef.current);
    fireIntervalRef.current = window.setInterval(() => {
      handleShoot();
    }, Math.max(85, activeWeaponRef.current.fireRate));
  };

  const stopHoldFire = () => {
    if (fireIntervalRef.current) {
      clearInterval(fireIntervalRef.current);
      fireIntervalRef.current = null;
    }
  };

  const handleRedeploy = () => {
    healthRef.current = 100;
    shieldRef.current = 100;
    killsRef.current = 0;
    ammoRef.current = activeWeapon.magazineSize;
    reserveAmmoRef.current = 180;
    isGameOverRef.current = false;
    isVictoryRef.current = false;
    setHealth(100);
    setShield(100);
    setKills(0);
    setAmmo(activeWeapon.magazineSize);
    setReserveAmmo(180);
    setIsAirborne(true);
    setIsGameOver(false);
    setIsVictory(false);
    setMatchKey((k) => k + 1);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}?fpsRoom=${activeMatchId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  const showTouchControls = isTouchDevice || touchCfg.alwaysShowTouchHud;

  return (
    <div className="relative w-full h-full bg-black select-none overflow-hidden font-sans touch-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* Damage Vignette Flash */}
      {damageFlash && (
        <div className="absolute inset-0 pointer-events-none z-20 border-[12px] border-rose-500/50 bg-rose-500/15" />
      )}

      {/* Touch Zones when touch controls enabled */}
      {showTouchControls && !isGameOver && !isVictory && (
        <>
          <div
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
            className="absolute left-0 top-16 bottom-20 w-[44%] z-20 touch-none"
          />
          <div
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
            onTouchCancel={handleLookEnd}
            className="absolute right-0 top-16 bottom-20 w-[56%] z-20 touch-none"
          />
        </>
      )}

      {/* WebGL Error */}
      {webglError && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4">
            <ShieldAlert size={36} className="text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">3D Engine Context Notice</h3>
            <p className="text-xs text-slate-300">{webglError}</p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={handleRedeploy}
                className="px-4 py-2.5 bg-sky-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer"
              >
                Redeploy Arena
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Exit to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Airborne Drop Banner */}
      {isAirborne && !isGameOver && (
        <div className="absolute top-16 inset-x-0 flex flex-col items-center pointer-events-none z-30">
          <div className="bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-sky-500/40 shadow-2xl flex items-center gap-3">
            <Wind size={18} className="text-sky-400 animate-bounce" />
            <div>
              <div className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                AIRBORNE INSERTION • PARACHUTE OPEN
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Steer with WASD / Joystick • Cut Parachute [F] to drop fast
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storm Warning */}
      {outsideStorm && !isAirborne && !isGameOver && (
        <div className="absolute top-28 inset-x-0 flex justify-center pointer-events-none z-30">
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-mono font-bold">
            OUTSIDE SAFE ZONE — MOVE INWARD TO AVOID STORM DAMAGE
          </div>
        </div>
      )}

      {/* Victory Overlay */}
      {isVictory && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900/95 border border-amber-500/50 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4"
          >
            <Trophy size={56} className="text-amber-400 mx-auto" />
            <h2 className="text-2xl font-black text-amber-300 font-mono tracking-wider">#1 VICTORY ROYALE</h2>
            <p className="text-xs font-mono text-slate-300">
              Last operative standing in <span className="text-white">{activeMatchId}</span>.
            </p>
            <div className="text-sm font-mono text-slate-400">
              ELIMINATIONS: <b className="text-rose-400 text-lg tabular-nums">{kills}</b>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleRedeploy}
                className="flex-1 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl text-xs uppercase cursor-pointer"
              >
                Lobby
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Eliminated / Game Over Overlay */}
      {isGameOver && !isVictory && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
          <div className="bg-slate-900/95 border border-rose-500/50 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
            <Skull size={52} className="text-rose-500 mx-auto" />
            <h2 className="text-2xl font-black text-white font-mono tracking-wider">OPERATIVE DOWN</h2>
            <p className="text-xs font-mono text-slate-400">
              Placed #{aliveCount} / {totalOperatives} • Eliminations:{' '}
              <b className="text-white tabular-nums">{kills}</b>
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleRedeploy}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={15} /> Redeploy
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs uppercase cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Crosshair */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
        {hitmarker.active ? (
          <Skull size={34} className={hitmarker.headshot ? 'text-rose-500' : 'text-amber-400'} />
        ) : (
          <div className={`relative flex items-center justify-center transition-transform ${isAiming ? 'scale-75' : 'scale-100'}`}>
            <Crosshair size={isAiming ? 18 : 26} className="text-rose-500/90 drop-shadow" />
            <div className="absolute w-1 h-1 bg-white rounded-full" />
          </div>
        )}
      </div>

      {/* TOP HUD */}
      <header className="absolute top-0 inset-x-0 p-2.5 sm:p-4 pl-44 sm:pl-48 flex items-start justify-between pointer-events-none z-30">
        <div className="hidden md:flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono font-bold text-white uppercase">{activeMatchId}</span>
            <button
              type="button"
              onClick={copyInviteLink}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded cursor-pointer"
              title="Copy Match Link"
            >
              {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300 bg-slate-950/75 px-2.5 py-0.5 rounded-lg border border-slate-800/80">
            <Gauge size={11} className="text-emerald-400" />
            <b className={`tabular-nums ${currentFps >= 45 ? 'text-emerald-400' : 'text-amber-400'}`}>{currentFps} FPS</b>
            <span>• {pingMs}ms</span>
            <span>• SQUAD {Object.keys(remotePlayers).length + 1}</span>
          </div>
        </div>

        {/* Alive Counter & Killfeed */}
        <div className="flex flex-col items-center gap-1 mx-auto md:mx-0">
          <div className="bg-slate-950/90 backdrop-blur-md px-3.5 py-1 rounded-xl border border-amber-500/40 shadow-lg flex items-center gap-2 text-xs font-mono">
            <Skull size={14} className="text-rose-500" />
            <span className="text-slate-400 font-bold">ALIVE</span>
            <span className="text-amber-400 font-black tabular-nums">
              {aliveCount}/{totalOperatives}
            </span>
          </div>
          {killFeed.slice(0, 2).map((kf) => (
            <div
              key={kf.id}
              className="bg-slate-950/75 px-2.5 py-0.5 rounded-md border border-slate-800 text-[10px] font-mono text-slate-200"
            >
              <span className="text-rose-400 font-bold">{kf.killerName}</span> [{kf.weaponName}] {kf.victimName}
            </div>
          ))}
        </div>

        {/* Right Quick Settings */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setCameraMode((p) => (p === 'fps' ? 'tps' : 'fps'))}
            className="px-2.5 py-1.5 min-h-[38px] bg-slate-950/85 hover:bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-mono font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <Eye size={14} className="text-sky-400" />
            <span className="hidden sm:inline">{cameraMode.toUpperCase()}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal((p) => !p)}
            className="p-2 min-h-[38px] min-w-[38px] bg-slate-950/85 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-200 flex items-center justify-center cursor-pointer"
            title="Controls & Graphics Settings"
          >
            <Sliders size={16} />
          </button>

          <button
            type="button"
            onClick={() => setShowChat((p) => !p)}
            className="p-2 min-h-[38px] min-w-[38px] bg-slate-950/85 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-200 flex items-center justify-center cursor-pointer"
            title="Match Chat"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </header>

      {/* GRAPHICS & TOUCH CUSTOMIZER MODAL */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="absolute top-14 right-3 z-40 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 w-80 max-h-[78vh] overflow-y-auto shadow-2xl space-y-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Cpu size={14} className="text-sky-400" /> PERFORMANCE & CONTROLS
              </span>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white px-2 py-1">
                ✕
              </button>
            </div>

            {/* Graphics Quality */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Graphics Preset</p>
              {(['potato_60fps', 'low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((preset) => {
                const isSelected = graphicsPreset === preset;
                const labels: Record<GraphicsPreset, string> = {
                  potato_60fps: '60FPS Boost (Mobile / Low RAM)',
                  low: 'Low (High FPS)',
                  medium: 'Medium (Balanced + Shadows)',
                  high: 'High Fidelity',
                  ultra: 'Ultra Resolution',
                };
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGraphicsPreset(preset)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer border ${
                      isSelected
                        ? 'bg-sky-600/25 border-sky-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{labels[preset]}</span>
                    {isSelected && <Check size={14} className="text-sky-400" />}
                  </button>
                );
              })}
            </div>

            {/* Touch & Aiming Customizer */}
            <div className="space-y-2.5 border-t border-slate-800 pt-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Touch HUD & Aiming</p>

              <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                <span>Always Show Touch HUD</span>
                <input
                  type="checkbox"
                  checked={touchCfg.alwaysShowTouchHud}
                  onChange={(e) => setTouchCfg((p) => ({ ...p, alwaysShowTouchHud: e.target.checked }))}
                  className="accent-sky-400"
                />
              </label>

              <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                <span>Balanced ADS Aim Assist</span>
                <input
                  type="checkbox"
                  checked={touchCfg.aimAssistEnabled}
                  onChange={(e) => setTouchCfg((p) => ({ ...p, aimAssistEnabled: e.target.checked }))}
                  className="accent-emerald-400"
                />
              </label>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Horizontal Look Sensitivity</span>
                  <span className="text-white">{touchCfg.sensitivityX.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={touchCfg.sensitivityX}
                  onChange={(e) => setTouchCfg((p) => ({ ...p, sensitivityX: Number(e.target.value) }))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Vertical Look Sensitivity</span>
                  <span className="text-white">{touchCfg.sensitivityY.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={touchCfg.sensitivityY}
                  onChange={(e) => setTouchCfg((p) => ({ ...p, sensitivityY: Number(e.target.value) }))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>HUD Button Scale</span>
                  <span className="text-white">{Math.round(touchCfg.hudScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.3}
                  step={0.05}
                  value={touchCfg.hudScale}
                  onChange={(e) => setTouchCfg((p) => ({ ...p, hudScale: Number(e.target.value) }))}
                  className="w-full accent-emerald-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAssetCache(true)}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-sky-500/40 text-sky-300 font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <HardDrive size={14} /> Manage Local 3D Assets
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIRTUAL JOYSTICK INDICATOR (LEFT) */}
      {showTouchControls && !isGameOver && !isVictory && (
        <div
          className="absolute bottom-24 left-6 z-25 pointer-events-none"
          style={{ transform: `scale(${touchCfg.hudScale})` }}
        >
          <div className="w-28 h-28 rounded-full border-2 border-white/25 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center relative">
            <div
              className="w-12 h-12 rounded-full bg-sky-400/80 border-2 border-white shadow-lg transition-transform duration-75"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>
        </div>
      )}

      {/* MOBILE TOUCH ACTION CLUSTER (RIGHT) */}
      {showTouchControls && !isGameOver && !isVictory && (
        <div
          className="absolute bottom-24 right-5 z-30 flex flex-col items-end gap-2.5 pointer-events-auto"
          style={{ transform: `scale(${touchCfg.hudScale})`, transformOrigin: 'bottom right' }}
        >
          <div className="flex items-center gap-2">
            {isAirborne && (
              <button
                type="button"
                onClick={() => {
                  if (engineRef.current && engineRef.current.isAirborne) {
                    engineRef.current.playerVel.y = -32;
                    engineRef.current.playerPos.y = Math.max(0.9, engineRef.current.playerPos.y - 4);
                  }
                }}
                className="px-3 min-h-[48px] rounded-2xl bg-amber-500 text-slate-950 font-black text-xs shadow-lg"
              >
                CUT CHUTE
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!engineRef.current) return;
                engineRef.current.isCrouching = !engineRef.current.isCrouching;
                setIsCrouchingUi(engineRef.current.isCrouching);
              }}
              className={`w-12 h-12 rounded-full border text-[10px] font-mono font-bold ${
                isCrouchingUi
                  ? 'bg-amber-500 border-amber-300 text-slate-950'
                  : 'bg-slate-900/85 border-slate-700 text-white'
              }`}
            >
              CROUCH
            </button>
            <button
              type="button"
              onClick={() => {
                const e = engineRef.current;
                if (e && e.isGrounded) {
                  e.playerVel.y = 8.5;
                  e.isGrounded = false;
                  sounds.playJump();
                }
              }}
              className="w-12 h-12 rounded-full bg-slate-900/85 border border-slate-700 text-white text-[10px] font-mono font-bold"
            >
              JUMP
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAiming((p) => !p)}
              className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center text-[10px] font-bold shadow-xl ${
                isAiming ? 'bg-sky-500 border-white text-slate-950' : 'bg-slate-900/90 border-slate-600 text-white'
              }`}
            >
              <Eye size={18} />
              <span>ADS</span>
            </button>

            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                startHoldFire();
              }}
              onTouchEnd={stopHoldFire}
              onTouchCancel={stopHoldFire}
              onMouseDown={startHoldFire}
              onMouseUp={stopHoldFire}
              onMouseLeave={stopHoldFire}
              className="w-20 h-20 rounded-full bg-rose-600 active:bg-rose-500 border-2 border-rose-300 flex flex-col items-center justify-center text-white font-black text-xs shadow-2xl"
            >
              <Target size={26} />
              <span>{isMelee ? 'SLASH' : 'FIRE'}</span>
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM HUD */}
      <footer className="absolute bottom-0 inset-x-0 p-3 sm:p-4 flex items-end justify-between pointer-events-none z-30">
        {/* Health & Shield */}
        <div className="space-y-1.5 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl w-44 sm:w-56">
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-300 mb-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <Shield size={12} /> HP
              </span>
              <span className="tabular-nums">{health}</span>
            </div>
            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all duration-200" style={{ width: `${health}%` }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-300 mb-0.5">
              <span className="flex items-center gap-1 text-sky-400">
                <Zap size={12} /> ARMOR
              </span>
              <span className="tabular-nums">{shield}</span>
            </div>
            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 transition-all duration-200" style={{ width: `${shield}%` }} />
            </div>
          </div>
        </div>

        {/* Ammo & Weapon Switch */}
        <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl space-y-1.5 text-right w-48 sm:w-60">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => {
                setIsMelee((prev) => {
                  const next = !prev;
                  engineRef.current?.fpsViewmodel.setMeleeActive(next);
                  return next;
                });
              }}
              className="px-2 py-1 min-h-[30px] bg-slate-900 border border-slate-700 rounded-lg text-slate-200 cursor-pointer"
            >
              {isMelee ? 'KNIFE [Q]' : 'GUN [Q]'}
            </button>
            <span className="text-rose-400 font-bold truncate">{isMelee ? 'COMBAT BLADE' : activeWeapon.name}</span>
          </div>

          <div className="flex items-baseline justify-end gap-1.5 font-mono">
            <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">{isMelee ? '∞' : ammo}</span>
            {!isMelee && <span className="text-xs font-bold text-slate-400 tabular-nums">/ {reserveAmmo}</span>}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-[10px] font-mono">
            <span className="text-slate-400">
              KILLS: <b className="text-amber-400 tabular-nums">{kills}</b>
            </span>
            {!isMelee && (
              <button
                type="button"
                disabled={isReloading || ammo >= activeWeapon.magazineSize}
                onClick={handleReload}
                className="px-2.5 py-1 min-h-[32px] bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg font-bold text-slate-200 cursor-pointer disabled:opacity-40"
              >
                {isReloading ? 'RELOADING...' : 'RELOAD [R]'}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* MATCH CHAT OVERLAY */}
      {showChat && (
        <div className="absolute bottom-24 left-4 z-40 w-72 bg-slate-950/95 border border-slate-800 rounded-2xl p-3 space-y-2 shadow-2xl">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-white border-b border-slate-800 pb-1.5">
            <span>SQUAD COMMS</span>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono">
            {chatMessages.length === 0 && <p className="text-slate-500">No messages yet.</p>}
            {chatMessages.map((m) => (
              <div key={m.id} className="text-slate-200">
                <span className="text-sky-400 font-bold">{m.senderName}: </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              sendMatchChat(chatInput);
              setChatInput('');
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
            <button type="submit" className="p-2 bg-sky-500 text-slate-950 rounded-lg font-bold">
              <Send size={13} />
            </button>
          </form>
        </div>
      )}

      {/* Local 3D Asset Cache Inspector */}
      {showAssetCache && <AssetCacheModal onClose={() => setShowAssetCache(false)} />}
    </div>
  );
}
