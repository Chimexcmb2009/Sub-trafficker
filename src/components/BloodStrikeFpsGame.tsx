import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crosshair, Shield, Zap, RefreshCw, Trophy, Skull, Target, 
  Sparkles, Lock, CheckCircle2, User, Play, Radio, Volume2, 
  Flame, Award, Eye, Maximize2, Minimize2, ChevronRight, Settings,
  Compass, Plane, Wind, ShieldAlert, Cpu, Check, Sliders,
  ArrowUp, FastForward, RotateCcw, RotateCw, Copy, MessageSquare, Send, Users,
  Activity, Gauge, ZapOff
} from 'lucide-react';
import { UserProfile, FpsWeapon, FpsCharacter } from '../types';
import { PRESET_WEAPONS, PRESET_CHARACTERS, PRESET_MAPS } from './fps/fpsData';
import { checkWebGLSupport, createSafeWebGLRenderer, safelyDisposeRenderer } from '../lib/webglUtils';
import { Real3dEnvironmentBuilder, ObstacleCollider } from './fps/Real3dEnvironment';
import { RealOperativeRig3D, OperativeAnimationState } from './fps/RealOperatives3D';
import { FpsViewmodel3D } from './fps/FpsViewmodel3D';
import { BattleRoyaleManager, ParachuteDropEntity } from './fps/BattleRoyaleManager';
import { GRAPHICS_PRESETS, GraphicsPreset, FpsOptimizer } from './fps/PerformanceSettings';
import { useFpsMultiplayer, LivePeerPlayer } from './fps/MultiplayerSync';

interface BloodStrikeFpsGameProps {
  profile: UserProfile;
  roomId?: string | null;
  onClose?: () => void;
  theme?: string;
  selectedMapId?: string;
  selectedWeaponId?: string;
  selectedCharacterId?: string;
}

// Sound Synthesizer
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
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (category === 'sniper' ? 0.35 : 0.12));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (category === 'sniper' ? 0.35 : 0.12));
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
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playExplosion() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.6);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
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
    gain.gain.setValueAtTime(0.3, now);
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
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

const sounds = new SoundEngine();

export default function BloodStrikeFpsGame({
  profile,
  roomId = 'warzone_alpha',
  onClose,
  selectedMapId = 'map_shutter_island',
  selectedWeaponId = 'm4a1_cyber',
  selectedCharacterId = 'char_vanguard'
}: BloodStrikeFpsGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeMatchId = roomId || 'warzone_alpha';

  // Local Player Identity & Gear
  const localUid = profile?.uid || `user_${Date.now()}`;
  const localName = profile?.name || profile?.username || 'Apex_Operative';

  const [activeWeapon, setActiveWeapon] = useState<FpsWeapon>(
    PRESET_WEAPONS.find(w => w.id === selectedWeaponId) || PRESET_WEAPONS[0]
  );
  const [health, setHealth] = useState(100);
  const [shield, setShield] = useState(100);
  const [ammo, setAmmo] = useState(activeWeapon.magazineSize);
  const [reserveAmmo, setReserveAmmo] = useState(180);
  const [isReloading, setIsReloading] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [isMelee, setIsMelee] = useState(false);
  const [kills, setKills] = useState(0);
  const [hitmarker, setHitmarker] = useState<{ active: boolean; headshot: boolean }>({ active: false, headshot: false });
  
  // Perspective Camera Mode: 'fps' (Hands & Weapon) or 'tps' (Full 3D Character in Action)
  const [cameraMode, setCameraMode] = useState<'fps' | 'tps'>('fps');
  
  // Battle Royale States
  const [isAirborne, setIsAirborne] = useState(true);
  const [aliveCount, setAliveCount] = useState(40);
  const [isVictory, setIsVictory] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Performance & Graphics Settings (Designed for 6GB RAM HP / Low-End Laptops)
  const [graphicsPreset, setGraphicsPreset] = useState<GraphicsPreset>('potato_60fps');
  const [currentFps, setCurrentFps] = useState(60);
  const [showGraphicsModal, setShowGraphicsModal] = useState(false);

  // Multiplayer Link & Chat
  const [copiedLink, setCopiedLink] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [webglError, setWebglError] = useState<string | null>(null);

  // Real Multiplayer Sync Hook
  const {
    remotePlayers,
    killFeed,
    chatMessages,
    isConnected,
    pingMs,
    broadcastLocalState,
    reportDamageToPeer,
    sendMatchChat
  } = useFpsMultiplayer(activeMatchId, localUid, localName, selectedCharacterId, activeWeapon.id);

  // Game Engine & Input Refs
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
    remoteRigs: Map<string, { rig: RealOperativeRig3D; label: HTMLDivElement | null }>;
    bullets: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[];
    particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[];
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

  // Initialize 3D Engine, Battlefield Scene, and Viewmodels
  useEffect(() => {
    if (!mountRef.current) return;

    if (!checkWebGLSupport()) {
      setWebglError("WebGL is not supported or hardware acceleration is disabled.");
      return;
    }

    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep Military Navy
    scene.fog = new THREE.FogExp2(0x0f172a, 0.006);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 700);
    // Start high in the sky for Battle Royale Airborne Skydive Drop
    const startY = 110;
    camera.position.set(0, startY, 0);

    // 2. Ultra-Smooth Safe WebGL Renderer (Optimized for 6GB RAM HP Laptop)
    const activeConfig = GRAPHICS_PRESETS[graphicsPreset];
    const renderer = createSafeWebGLRenderer({
      antialias: activeConfig.antiAlias,
      powerPreference: 'high-performance'
    });

    if (!renderer) {
      setWebglError("Failed to initialize WebGL context.");
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(activeConfig.pixelRatio);
    renderer.shadowMap.enabled = activeConfig.shadowsEnabled;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // 3. Dynamic Battlefield Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.2);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.8);
    sunLight.position.set(60, 90, 40);
    if (activeConfig.shadowsEnabled) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = activeConfig.shadowMapSize;
      sunLight.shadow.mapSize.height = activeConfig.shadowMapSize;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 250;
      const d = 80;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
    }
    scene.add(sunLight);

    // 4. Assemble Real 3D Environment & Land
    const envBuilder = new Real3dEnvironmentBuilder();
    const envData = envBuilder.assembleFullBattlefield(scene, 'grass');

    // 5. Build Local Player 3D Rig (Realistic Anatomical Human)
    const localRig = new RealOperativeRig3D(selectedCharacterId, false, '#3f4f38', '#38bdf8');
    localRig.root.position.set(0, startY, 0);
    scene.add(localRig.root);

    // 6. Build Local Player 3D Parachute
    const playerParachute = BattleRoyaleManager.createParachuteMesh(0x1e293b, 0x38bdf8);
    playerParachute.position.set(0, 3.2, 0);
    localRig.root.add(playerParachute);

    // 7. Build First-Person Viewmodel (Realistic Tactical Hands & Weapons)
    const fpsViewmodel = new FpsViewmodel3D();
    fpsViewmodel.setWeapon(activeWeapon.id);
    camera.add(fpsViewmodel.root);
    scene.add(camera);

    // 8. Initialize Battle Royale Manager (40 Bots + Real Players dropping with parachutes)
    const initialPlayerPos = new THREE.Vector3(0, startY, 0);
    const battleRoyale = new BattleRoyaleManager(scene, initialPlayerPos);

    const fpsOptimizer = new FpsOptimizer();

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
      remoteRigs: new Map<string, { rig: RealOperativeRig3D; label: HTMLDivElement | null }>(),
      bullets: [] as { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[],
      particles: [] as { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[],
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
      fpsOptimizer
    };

    engineRef.current = engine;

    // 9. Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      engine.keys[e.code] = true;
      if (e.code === 'KeyV') {
        setCameraMode(prev => prev === 'fps' ? 'tps' : 'fps');
      }
      if (e.code === 'KeyR') {
        handleReload();
      }
      if (e.code === 'KeyF') {
        // Cut Parachute / Fast Landing
        if (engine.isAirborne) {
          engine.playerVel.y = -35;
        }
      }
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        // Toggle Melee Knife
        setIsMelee(prev => {
          const next = !prev;
          fpsViewmodel.setMeleeActive(next);
          return next;
        });
      }
      if (e.code === 'KeyT') {
        setShowChat(prev => !prev);
      }
      if (e.code === 'Space' && engine.isGrounded) {
        engine.playerVel.y = 8.5;
        engine.isGrounded = false;
        sounds.playJump();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        engine.isSprinting = true;
      }
      if (e.code === 'KeyC' || e.code === 'ControlLeft') {
        engine.isCrouching = !engine.isCrouching;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        engine.isSprinting = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        const sens = isAiming ? 0.0012 : 0.0022;
        engine.yaw -= e.movementX * sens;
        engine.pitch -= e.movementY * sens;
        engine.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, engine.pitch));
        engine.mouseDeltaX = e.movementX;
        engine.mouseDeltaY = e.movementY;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
      }
      if (e.button === 0) {
        handleShoot();
      } else if (e.button === 2) {
        setIsAiming(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        setIsAiming(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    const handleResize = () => {
      if (!mountRef.current || !renderer) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Main Animation & Combat Loop
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      engine.animationTime += delta;

      // Auto 60 FPS Optimizer
      const fps = engine.fpsOptimizer.update(time, (recommended) => {
        setGraphicsPreset(recommended);
        const config = GRAPHICS_PRESETS[recommended];
        renderer.setPixelRatio(config.pixelRatio);
        renderer.shadowMap.enabled = config.shadowsEnabled;
      });
      setCurrentFps(fps);

      // --- Airborne Drop & Glide Physics ---
      if (engine.isAirborne) {
        // Glide downwards with open parachute
        const glideSpeed = 12;
        engine.playerPos.y -= glideSpeed * delta;

        // Steer glide with WASD
        const steerSpeed = 18;
        if (engine.keys['KeyW'] || engine.keys['ArrowUp']) {
          engine.playerPos.x -= Math.sin(engine.yaw) * steerSpeed * delta;
          engine.playerPos.z -= Math.cos(engine.yaw) * steerSpeed * delta;
        }
        if (engine.keys['KeyS'] || engine.keys['ArrowDown']) {
          engine.playerPos.x += Math.sin(engine.yaw) * steerSpeed * delta;
          engine.playerPos.z += Math.cos(engine.yaw) * steerSpeed * delta;
        }
        if (engine.keys['KeyA'] || engine.keys['ArrowLeft']) {
          engine.playerPos.x -= Math.cos(engine.yaw) * steerSpeed * delta;
          engine.playerPos.z += Math.sin(engine.yaw) * steerSpeed * delta;
        }
        if (engine.keys['KeyD'] || engine.keys['ArrowRight']) {
          engine.playerPos.x += Math.cos(engine.yaw) * steerSpeed * delta;
          engine.playerPos.z -= Math.sin(engine.yaw) * steerSpeed * delta;
        }

        // Parachute Touchdown
        if (engine.playerPos.y <= 0.9) {
          engine.playerPos.y = 0.9;
          engine.isAirborne = false;
          engine.isGrounded = true;
          setIsAirborne(false);
          engine.playerParachute.visible = false;
          sounds.playLanding();
        }
      } else {
        // --- Standard Ground Movement Physics ---
        const moveSpeed = engine.isSprinting ? 12 : engine.isCrouching ? 4 : 7;
        const moveDir = new THREE.Vector3();

        if (engine.keys['KeyW'] || engine.keys['ArrowUp']) moveDir.z -= 1;
        if (engine.keys['KeyS'] || engine.keys['ArrowDown']) moveDir.z += 1;
        if (engine.keys['KeyA'] || engine.keys['ArrowLeft']) moveDir.x -= 1;
        if (engine.keys['KeyD'] || engine.keys['ArrowRight']) moveDir.x += 1;

        if (moveDir.lengthSq() > 0) {
          moveDir.normalize();
          moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), engine.yaw);
          engine.playerPos.x += moveDir.x * moveSpeed * delta;
          engine.playerPos.z += moveDir.z * moveSpeed * delta;
        }

        // Gravity & Ground Check
        engine.playerVel.y -= 22 * delta;
        engine.playerPos.y += engine.playerVel.y * delta;
        if (engine.playerPos.y <= 0.9) {
          engine.playerPos.y = 0.9;
          engine.playerVel.y = 0;
          engine.isGrounded = true;
        }
      }

      // Update Battle Royale Operatives & Safe Zone Storm
      engine.battleRoyale.update(delta, engine.playerPos, (killer, victim) => {
        // Broadcast bot kills to alive count
        setAliveCount(engine.battleRoyale.aliveCount);
        if (engine.battleRoyale.aliveCount === 1) {
          setIsVictory(true);
        }
      });
      setAliveCount(engine.battleRoyale.aliveCount);

      // Position Local 3D Human Rig
      engine.playerRig.root.position.copy(engine.playerPos);
      engine.playerRig.root.rotation.y = engine.yaw;

      const isMoving = (engine.keys['KeyW'] || engine.keys['KeyS'] || engine.keys['KeyA'] || engine.keys['KeyD']);
      let action: OperativeAnimationState['action'] = 'idle';
      if (engine.isAirborne) action = 'jumping';
      else if (!engine.isGrounded) action = 'jumping';
      else if (engine.isCrouching) action = 'crouching';
      else if (isMoving && engine.isSprinting) action = 'sprinting';
      else if (isMoving) action = 'running';

      engine.recoil = Math.max(0, engine.recoil - delta * 6);
      engine.playerRig.updateAnimation(delta, {
        action,
        time: engine.animationTime,
        recoil: engine.recoil,
        aimProgress: isAiming ? 1 : 0,
        reloadProgress: isReloading ? 1 : 0,
        meleeProgress: isMelee ? 1 : 0
      });

      // Update First-Person Viewmodel (Tactical Hands & Gun/Knife)
      fpsViewmodel.update(delta, {
        isMoving,
        isSprinting: engine.isSprinting,
        isAiming,
        isFiring: engine.recoil > 0.1,
        isReloading,
        isMelee,
        recoil: engine.recoil,
        mouseDeltaX: engine.mouseDeltaX,
        mouseDeltaY: engine.mouseDeltaY,
        time: engine.animationTime
      });
      engine.mouseDeltaX = 0;
      engine.mouseDeltaY = 0;

      // Update Camera (FPS vs TPS)
      if (cameraMode === 'fps') {
        // FPS View: Hide third-person body, show realistic arms & hands holding weapon
        engine.playerRig.root.visible = false;
        fpsViewmodel.root.visible = true;
        camera.position.set(engine.playerPos.x, engine.playerPos.y + 0.8, engine.playerPos.z);
        const lookDir = new THREE.Vector3(
          -Math.sin(engine.yaw) * Math.cos(engine.pitch),
          Math.sin(engine.pitch),
          -Math.cos(engine.yaw) * Math.cos(engine.pitch)
        );
        camera.lookAt(camera.position.clone().add(lookDir));
      } else {
        // TPS View: Show full realistic humanoid operative in action!
        engine.playerRig.root.visible = true;
        fpsViewmodel.root.visible = false;
        const camDist = 4.2;
        camera.position.set(
          engine.playerPos.x + Math.sin(engine.yaw) * camDist,
          engine.playerPos.y + 2.2,
          engine.playerPos.z + Math.cos(engine.yaw) * camDist
        );
        camera.lookAt(engine.playerPos.x, engine.playerPos.y + 1.2, engine.playerPos.z);
      }

      // Bullets Update & Raycast Hits
      for (let i = engine.bullets.length - 1; i >= 0; i--) {
        const b = engine.bullets[i];
        b.mesh.position.addScaledVector(b.vel, delta);
        b.life -= delta;

        // Check Hit against Battle Royale Bot Operatives
        for (const bot of engine.battleRoyale.entities) {
          if (bot.isAlive && b.mesh.position.distanceTo(bot.pos) < 1.6) {
            bot.health -= activeWeapon.damage;
            sounds.playHitmarker(false);
            setHitmarker({ active: true, headshot: false });
            setTimeout(() => setHitmarker({ active: false, headshot: false }), 120);

            if (bot.health <= 0) {
              bot.isAlive = false;
              bot.rig.updateAnimation(delta, { action: 'dead', time: 0, recoil: 0, aimProgress: 0, reloadProgress: 0, meleeProgress: 0 });
              setKills(prev => prev + 1);
              setAliveCount(engine.battleRoyale.aliveCount);
              if (engine.battleRoyale.aliveCount === 1) {
                setIsVictory(true);
              }
            }
            b.life = 0;
            break;
          }
        }

        if (b.life <= 0) {
          scene.remove(b.mesh);
          engine.bullets.splice(i, 1);
        }
      }

      // Sync Local Transform to Peers
      broadcastLocalState({
        x: engine.playerPos.x,
        y: engine.playerPos.y,
        z: engine.playerPos.z,
        yaw: engine.yaw,
        pitch: engine.pitch,
        health,
        shield,
        action,
        weaponId: activeWeapon.id,
        characterId: selectedCharacterId,
        kills
      });

      // Render Scene
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      safelyDisposeRenderer(renderer);
    };
  }, [selectedCharacterId, activeMatchId, graphicsPreset]);

  // Sync Remote Peer Players from Firestore into 3D World
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    Object.entries(remotePlayers).forEach(([uid, peer]) => {
      let entry = engine.remoteRigs.get(uid);
      if (!entry) {
        const rig = new RealOperativeRig3D(peer.characterId || 'char_vanguard', false, '#1e293b', '#ec4899');
        engine.scene.add(rig.root);
        entry = { rig, label: null };
        engine.remoteRigs.set(uid, entry);
      }

      entry.rig.root.position.lerp(new THREE.Vector3(peer.x, peer.y, peer.z), 0.3);
      entry.rig.root.rotation.y = THREE.MathUtils.lerp(entry.rig.root.rotation.y, peer.yaw, 0.3);

      entry.rig.updateAnimation(0.016, {
        action: peer.action || 'idle',
        time: engine.animationTime,
        recoil: peer.isFiring ? 1 : 0,
        aimProgress: 0,
        reloadProgress: 0,
        meleeProgress: 0
      });
    });

    engine.remoteRigs.forEach((val, uid) => {
      if (!remotePlayers[uid]) {
        engine.scene.remove(val.rig.root);
        engine.remoteRigs.delete(uid);
      }
    });
  }, [remotePlayers]);

  // Handle Weapon Shooting Action
  const handleShoot = () => {
    if (ammo <= 0 || isReloading) {
      handleReload();
      return;
    }

    setAmmo(prev => prev - 1);
    sounds.playGunshot(activeWeapon.category);

    const engine = engineRef.current;
    if (!engine) return;

    engine.recoil = 1.0;

    // Laser Tracer
    const bulletGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
    bulletGeo.rotateX(Math.PI / 2);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);

    const lookDir = new THREE.Vector3(
      -Math.sin(engine.yaw) * Math.cos(engine.pitch),
      Math.sin(engine.pitch),
      -Math.cos(engine.yaw) * Math.cos(engine.pitch)
    ).normalize();

    bulletMesh.position.set(
      engine.playerPos.x + lookDir.x * 0.8,
      engine.playerPos.y + 0.7 + lookDir.y * 0.8,
      engine.playerPos.z + lookDir.z * 0.8
    );
    bulletMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDir);
    engine.scene.add(bulletMesh);

    engine.bullets.push({
      mesh: bulletMesh,
      vel: lookDir.clone().multiplyScalar(130),
      life: 1.8
    });

    // Raycast hit check against real multiplayer remote peers
    const ray = new THREE.Raycaster(
      new THREE.Vector3(engine.playerPos.x, engine.playerPos.y + 0.8, engine.playerPos.z),
      lookDir,
      0.5,
      150
    );

    Object.entries(remotePlayers).forEach(([peerUid, peer]) => {
      const peerPos = new THREE.Vector3(peer.x, peer.y + 0.8, peer.z);
      if (ray.ray.distanceToPoint(peerPos) < 1.2) {
        const isHead = Math.random() > 0.6;
        const dmg = isHead ? activeWeapon.damage * 1.8 : activeWeapon.damage;
        sounds.playHitmarker(isHead);
        setHitmarker({ active: true, headshot: isHead });
        setTimeout(() => setHitmarker({ active: false, headshot: false }), 120);

        reportDamageToPeer(peerUid, dmg, isHead, activeWeapon.name);
      }
    });
  };

  const handleReload = () => {
    if (isReloading || ammo >= activeWeapon.magazineSize || reserveAmmo <= 0) return;
    setIsReloading(true);

    setTimeout(() => {
      const needed = activeWeapon.magazineSize - ammo;
      const taken = Math.min(needed, reserveAmmo);
      setAmmo(prev => prev + taken);
      setReserveAmmo(prev => prev - taken);
      setIsReloading(false);
    }, activeWeapon.reloadTime * 1000);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}?fpsRoom=${activeMatchId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="relative w-full h-full bg-black select-none overflow-hidden font-sans">
      
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* WebGL Context Error Dialog */}
      {webglError && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-900 border border-red-500/50 rounded-2xl p-6 space-y-3">
            <ShieldAlert size={32} className="text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">3D Graphic Acceleration Notice</h3>
            <p className="text-xs text-slate-300">{webglError}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
            >
              Exit to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Airborne Insertion Skydive HUD Banner */}
      {isAirborne && (
        <div className="absolute top-16 inset-x-0 flex flex-col items-center pointer-events-none z-30 animate-pulse">
          <div className="bg-slate-950/85 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-sky-500/50 shadow-2xl flex items-center gap-3">
            <Wind size={20} className="text-sky-400 animate-bounce" />
            <div>
              <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                AIRBORNE INSERTION • PARACHUTE DEPLOYED
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Steer with [W/A/S/D] • Press [F] to Cut Parachute for Fast Tactical Landing
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY ROYALE OVERLAY */}
      {isVictory && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900/90 border border-amber-500/60 rounded-3xl p-8 max-w-md shadow-2xl space-y-4"
          >
            <Trophy size={64} className="text-amber-400 mx-auto animate-bounce" />
            <h2 className="text-3xl font-black text-amber-300 font-mono tracking-wider">#1 VICTORY ROYALE</h2>
            <p className="text-sm font-mono text-slate-300">
              LAST MAN STANDING! You eliminated all competing operatives.
            </p>
            <div className="text-xs font-mono text-slate-400 pt-2">
              TOTAL KILLS: <b className="text-rose-400 text-base">{kills}</b>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-yellow-500 text-slate-950 font-black rounded-xl uppercase tracking-wider text-sm shadow-lg hover:brightness-110 cursor-pointer"
            >
              Return to Lobby
            </button>
          </motion.div>
        </div>
      )}

      {/* Center Dynamic Crosshair & Hitmarker */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {hitmarker.active ? (
          <div className="relative flex items-center justify-center animate-ping">
            <Skull size={36} className={hitmarker.headshot ? 'text-red-500' : 'text-amber-400'} />
          </div>
        ) : (
          <div className={`relative flex items-center justify-center transition-all ${isAiming ? 'scale-75' : 'scale-100'}`}>
            <Crosshair size={isAiming ? 20 : 28} className="text-rose-500 drop-shadow-md" />
            <div className="absolute w-1 h-1 bg-rose-400 rounded-full" />
          </div>
        )}
      </div>

      {/* TOP COMBAT HUD: Match Info, Alive Count, Ping, 60FPS Performance Badge */}
      <header className="absolute top-0 inset-x-0 p-3 sm:p-4 flex items-start justify-between pointer-events-none z-30">
        
        {/* Left: Operative & Match Room Badge */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono font-bold text-white uppercase">ROOM: {activeMatchId}</span>
            <button
              type="button"
              onClick={copyInviteLink}
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition cursor-pointer"
              title="Copy Match Invite Link"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 px-1">
            <span className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800">
              <Gauge size={11} className="text-emerald-400" />
              <b className={currentFps >= 50 ? 'text-emerald-400' : 'text-amber-400'}>{currentFps} FPS</b>
            </span>
            <span>PING: <b className="text-emerald-400">{pingMs}ms</b></span>
            <span>REAL PLAYERS: <b className="text-sky-400">{Object.keys(remotePlayers).length + 1}</b></span>
          </div>
        </div>

        {/* Center: Alive Operatives Battle Royale Counter */}
        <div className="flex flex-col items-center gap-1">
          <div className="bg-slate-950/90 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-amber-500/40 shadow-xl flex items-center gap-2 text-xs font-mono">
            <Skull size={15} className="text-rose-500" />
            <span className="text-slate-400 uppercase font-bold">ALIVE:</span>
            <span className="text-amber-400 font-black text-sm">{aliveCount} / 40</span>
          </div>

          {/* Killfeed Notifications */}
          <div className="flex flex-col items-center gap-1 max-w-xs pt-1">
            {killFeed.slice(0, 3).map((kf) => (
              <motion.div
                key={kf.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-[11px] font-mono flex items-center gap-1.5 text-slate-200"
              >
                <span className="font-bold text-rose-400">{kf.killerName}</span>
                <span className="text-[9px] text-slate-500">[{kf.weaponName}]</span>
                {kf.isHeadshot && <Skull size={12} className="text-red-500" />}
                <span className="text-slate-400">{kf.victimName}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Camera Mode Switch & Graphics Settings */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setCameraMode(prev => prev === 'fps' ? 'tps' : 'fps')}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer transition shadow-md"
            title="Toggle FPS (Hands View) / TPS (Full Character View)"
          >
            <Eye size={14} className="text-sky-400" />
            <span>{cameraMode === 'fps' ? 'FPS (HANDS)' : 'TPS (OPERATIVE)'} [V]</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGraphicsModal(prev => !prev)}
            className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white cursor-pointer transition shadow-md"
            title="Performance & Graphics Settings"
          >
            <Sliders size={16} />
          </button>

          <button
            type="button"
            onClick={() => setShowChat(prev => !prev)}
            className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white cursor-pointer transition shadow-md"
            title="Toggle Squad Chat"
          >
            <MessageSquare size={16} />
          </button>
        </div>

      </header>

      {/* GRAPHICS & PERFORMANCE MODAL */}
      <AnimatePresence>
        {showGraphicsModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-16 right-4 z-40 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 w-72 shadow-2xl space-y-3 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Cpu size={14} className="text-sky-400" /> GRAPHICS PRESETS
              </span>
              <button onClick={() => setShowGraphicsModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Select <b>60FPS BOOST</b> for low-end hardware (6GB RAM HP laptops / Intel Graphics).
            </p>

            <div className="space-y-1.5">
              {(['potato_60fps', 'low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((preset) => {
                const isSelected = graphicsPreset === preset;
                const labels: Record<GraphicsPreset, string> = {
                  potato_60fps: '🚀 60FPS Boost (Potato Mode)',
                  low: '⚡ Low (High Performance)',
                  medium: 'Balanced (Standard)',
                  high: 'High Fidelity',
                  ultra: 'Ultra Raytrace'
                };
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setGraphicsPreset(preset);
                      const engine = engineRef.current;
                      if (engine) {
                        const cfg = GRAPHICS_PRESETS[preset];
                        engine.renderer.setPixelRatio(cfg.pixelRatio);
                        engine.renderer.shadowMap.enabled = cfg.shadowsEnabled;
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl transition cursor-pointer flex items-center justify-between ${
                      isSelected ? 'bg-sky-600/30 border border-sky-400 text-white' : 'bg-slate-900/60 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{labels[preset]}</span>
                    {isSelected && <Check size={14} className="text-sky-400" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM COMBAT HUD: Health, Shield, Active Weapon & Controls */}
      <footer className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex items-end justify-between pointer-events-none z-30">
        
        {/* Left: Health & Armor Shield Bars */}
        <div className="space-y-2 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-xl w-60">
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300 mb-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <Shield size={13} /> HEALTH
              </span>
              <span>{health} / 100</span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                style={{ width: `${health}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300 mb-1">
              <span className="flex items-center gap-1 text-sky-400">
                <Zap size={13} /> SHIELD
              </span>
              <span>{shield} / 100</span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-300"
                style={{ width: `${shield}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Mobile Touch Combat Controls */}
        <div className="md:hidden flex items-center gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={handleShoot}
            className="w-16 h-16 rounded-full bg-rose-600/90 active:bg-rose-500 border-2 border-rose-400 flex items-center justify-center text-white shadow-2xl active:scale-95 cursor-pointer"
          >
            <Target size={28} />
          </button>

          <button
            type="button"
            onClick={() => setIsAiming(prev => !prev)}
            className={`w-12 h-12 rounded-full border flex items-center justify-center text-white shadow-xl active:scale-95 cursor-pointer ${
              isAiming ? 'bg-sky-600 border-sky-400' : 'bg-slate-900/90 border-slate-700'
            }`}
          >
            <Eye size={20} />
          </button>
        </div>

        {/* Right: Weapon Magazine, Ammo & Melee Switch */}
        <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-xl space-y-2 text-right w-64">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <button
              onClick={() => {
                setIsMelee(prev => {
                  const next = !prev;
                  engineRef.current?.fpsViewmodel.setMeleeActive(next);
                  return next;
                });
              }}
              className="text-xs px-2 py-0.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-slate-300 cursor-pointer"
            >
              {isMelee ? '🔪 KNIFE [Q]' : '🔫 WEAPON [Q]'}
            </button>
            <span className="text-rose-400 font-bold">{isMelee ? 'TACTICAL BLADE' : activeWeapon.name}</span>
          </div>

          <div className="flex items-baseline justify-end gap-1.5 font-mono">
            <span className="text-3xl font-black text-white">{isMelee ? '∞' : ammo}</span>
            {!isMelee && <span className="text-sm font-bold text-slate-500">/ {reserveAmmo}</span>}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <span className="text-[10px] font-mono text-slate-400">KILLS: <b className="text-amber-400">{kills}</b></span>
            {!isMelee && (
              <button
                type="button"
                disabled={isReloading || ammo >= activeWeapon.magazineSize}
                onClick={handleReload}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-200 flex items-center gap-1 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={isReloading ? 'animate-spin text-rose-400' : ''} />
                <span>{isReloading ? 'RELOADING' : 'RELOAD [R]'}</span>
              </button>
            )}
          </div>
        </div>

      </footer>

      {/* Live Match Chat Overlay Drawer */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute right-4 top-16 w-80 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl z-40 space-y-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Users size={14} className="text-sky-400" /> SQUAD MATCH CHAT
              </span>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white text-xs font-mono">✕</button>
            </div>

            <div className="h-44 overflow-y-auto space-y-1.5 text-xs font-mono pr-1">
              {chatMessages.map(msg => (
                <div key={msg.id} className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
                  <span className="text-sky-400 font-bold">{msg.senderName}: </span>
                  <span className="text-slate-200">{msg.text}</span>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <div className="text-center text-slate-500 text-[10px] py-8">No messages yet. Say hello to squad!</div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chatInput.trim()) {
                  sendMatchChat(chatInput);
                  setChatInput('');
                }
              }}
              className="flex items-center gap-1.5 pt-1"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type tactical message..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <button type="submit" className="p-1.5 bg-sky-600 text-white rounded-xl hover:bg-sky-500">
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
