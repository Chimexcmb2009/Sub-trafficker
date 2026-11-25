import * as THREE from 'three';
import { RealOperativeRig3D } from './RealOperatives3D';

export interface ParachuteDropEntity {
  id: string;
  name: string;
  rig: RealOperativeRig3D;
  parachuteMesh: THREE.Group;
  pos: THREE.Vector3;
  targetLandingPos: THREE.Vector3;
  hasLanded: boolean;
  isAlive: boolean;
  health: number;
  shield: number;
  shootCooldown: number;
  patrolAngle: number;
  isBot: boolean;
}

// Module-level scratch vectors to guarantee zero allocations inside update()
const _targetPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();

// Shared parachute geometry/material for fast instantiation
let sharedCanopyGeo: THREE.SphereGeometry | null = null;
let sharedCordGeo: THREE.CylinderGeometry | null = null;

export class BattleRoyaleManager {
  public entities: ParachuteDropEntity[] = [];
  public aliveCount = 24;
  public totalOperatives = 24;
  public currentStormRadius = 175;
  public targetStormRadius = 24;
  public stormShrinkSpeed = 0.7;
  public stormMesh: THREE.Mesh | null = null;
  private stormDmgAccum = 0;

  constructor(scene: THREE.Scene, _playerStartPos: THREE.Vector3, botCount = 23) {
    this.totalOperatives = botCount + 1;
    this.aliveCount = this.totalOperatives;
    this.initStormRing(scene);
    this.spawnAirborneBots(scene, botCount);
  }

  private initStormRing(scene: THREE.Scene) {
    const stormGeo = new THREE.CylinderGeometry(175, 175, 42, 36, 1, true);
    const stormMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.stormMesh = new THREE.Mesh(stormGeo, stormMat);
    this.stormMesh.position.set(0, 18, 0);
    scene.add(this.stormMesh);
  }

  public static createParachuteMesh(color = 0x1e293b, accentColor = 0xf59e0b): THREE.Group {
    const group = new THREE.Group();

    if (!sharedCanopyGeo) {
      sharedCanopyGeo = new THREE.SphereGeometry(2.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    }
    const canopyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const canopy = new THREE.Mesh(sharedCanopyGeo, canopyMat);
    canopy.position.y = 2.6;
    canopy.scale.set(1.2, 0.75, 0.9);
    group.add(canopy);

    if (!sharedCordGeo) {
      sharedCordGeo = new THREE.CylinderGeometry(0.015, 0.015, 2.7, 4);
    }
    const cordMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const offsets: [number, number][] = [
      [-1.1, -0.5],
      [1.1, -0.5],
      [-1.1, 0.5],
      [1.1, 0.5],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const [ox, oz] = offsets[i];
      const cord = new THREE.Mesh(sharedCordGeo, cordMat);
      cord.position.set(ox * 0.5, 1.35, oz * 0.5);
      cord.rotation.z = -ox * 0.28;
      cord.rotation.x = oz * 0.28;
      group.add(cord);
    }

    return group;
  }

  private spawnAirborneBots(scene: THREE.Scene, count: number) {
    const botNames = [
      'LAGOS_GHOST', 'ABUJA_SNIPER', 'KANO_VIPER', 'PORT_APEX', 'ENUGU_REAPER',
      'IBADAN_PHANTOM', 'DELTA_SHADOW', 'ZULU_RAIDER', 'VANGUARD_ALPHA', 'NOVA_STRIKER',
      'ECHO_BLADE', 'IRON_HAWK', 'COBRA_WEST', 'SPECTRE_NG', 'FROST_BYTE',
      'CYBER_FANG', 'VALKYRIE_X', 'PULSE_ZERO', 'TITAN_RECON', 'DRIFT_KING',
      'RAPTOR_99', 'BLAZE_OPS', 'ORYX_SIX',
    ];

    const camos = ['#334155', '#1e293b', '#3f4f38', '#52525b', '#78350f'];
    const accents = [0xf43f5e, 0xf59e0b, 0x38bdf8, 0x10b981];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 28 + Math.random() * 82;
      const startY = 85 + Math.random() * 35;

      const startPos = new THREE.Vector3(Math.cos(angle) * dist, startY, Math.sin(angle) * dist);
      const targetPos = new THREE.Vector3(
        Math.cos(angle) * (dist * 0.65) + (Math.random() - 0.5) * 18,
        0.9,
        Math.sin(angle) * (dist * 0.65) + (Math.random() - 0.5) * 18
      );

      const camo = camos[i % camos.length];
      const accent = accents[i % accents.length];
      const rig = new RealOperativeRig3D('char_vanguard', true, camo, `#${accent.toString(16).padStart(6, '0')}`);
      rig.root.position.copy(startPos);
      scene.add(rig.root);

      const parachute = BattleRoyaleManager.createParachuteMesh(0x0f172a, accent);
      parachute.position.set(0, 3.0, 0);
      rig.root.add(parachute);

      this.entities.push({
        id: `bot_${i}`,
        name: botNames[i % botNames.length],
        rig,
        parachuteMesh: parachute,
        pos: startPos,
        targetLandingPos: targetPos,
        hasLanded: false,
        isAlive: true,
        health: 100,
        shield: 50,
        shootCooldown: 1.5 + Math.random() * 2.5,
        patrolAngle: Math.random() * Math.PI * 2,
        isBot: true,
      });
    }
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    callbacks?: {
      onBotKill?: (killer: string, victim: string) => void;
      onPlayerHit?: (damage: number) => void;
    }
  ) {
    // 1. Shrink Storm Ring
    if (this.currentStormRadius > this.targetStormRadius) {
      this.currentStormRadius = Math.max(this.targetStormRadius, this.currentStormRadius - this.stormShrinkSpeed * delta);
      if (this.stormMesh) {
        const s = this.currentStormRadius / 175;
        this.stormMesh.scale.set(s, 1, s);
      }
    }

    // Apply periodic storm damage if player is outside safe ring on the ground
    const playerDistFromOrigin = Math.hypot(playerPos.x, playerPos.z);
    if (playerPos.y <= 3 && playerDistFromOrigin > this.currentStormRadius) {
      this.stormDmgAccum += delta;
      if (this.stormDmgAccum >= 1.0) {
        this.stormDmgAccum = 0;
        callbacks?.onPlayerHit?.(4);
      }
    }

    const timeSec = performance.now() * 0.001;
    let currentAlive = 1;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.isAlive) continue;
      currentAlive++;

      if (!e.hasLanded) {
        e.pos.y -= 16 * delta;
        e.pos.x = THREE.MathUtils.lerp(e.pos.x, e.targetLandingPos.x, delta * 0.9);
        e.pos.z = THREE.MathUtils.lerp(e.pos.z, e.targetLandingPos.z, delta * 0.9);
        e.rig.root.position.copy(e.pos);

        if (e.pos.y <= 0.9) {
          e.pos.y = 0.9;
          e.hasLanded = true;
          e.parachuteMesh.visible = false;
        }
        continue;
      }

      // Skip expensive skeletal updates on very distant bots (>130m)
      const distSqToPlayer = e.pos.distanceToSquared(playerPos);
      const distToPlayer = Math.sqrt(distSqToPlayer);

      e.shootCooldown -= delta;

      if (distToPlayer < 48) {
        _targetPos.copy(playerPos);
      } else {
        e.patrolAngle += delta * 0.18;
        const roamR = this.currentStormRadius * 0.55;
        _targetPos.set(Math.cos(e.patrolAngle + i) * roamR, 0.9, Math.sin(e.patrolAngle + i) * roamR);
      }

      _moveDir.subVectors(_targetPos, e.pos);
      _moveDir.y = 0;
      const lenSq = _moveDir.lengthSq();

      if (lenSq > 16) {
        _moveDir.multiplyScalar(1 / Math.sqrt(lenSq));
        const speed = distToPlayer < 48 ? 6.2 : 4.5;
        e.pos.x += _moveDir.x * speed * delta;
        e.pos.z += _moveDir.z * speed * delta;
        e.rig.root.rotation.y = Math.atan2(_moveDir.x, _moveDir.z);
        e.rig.root.position.copy(e.pos);
      }

      // Only animate detailed joints within 115m for crisp mobile/low-end FPS
      if (distToPlayer < 115) {
        e.rig.updateAnimation(delta, {
          action: lenSq > 16 ? 'running' : 'idle',
          time: timeSec,
          recoil: e.shootCooldown < 0.18 ? 1 : 0,
          aimProgress: distToPlayer < 38 ? 1 : 0,
          reloadProgress: 0,
          meleeProgress: 0,
        });
      }

      // Bot combat fire against player at close-medium range
      if (playerPos.y <= 4 && distToPlayer < 36 && e.shootCooldown <= 0) {
        e.shootCooldown = 2.0 + Math.random() * 2.2;
        const accuracy = Math.max(0.18, 0.65 - distToPlayer / 65);
        if (Math.random() < accuracy) {
          callbacks?.onPlayerHit?.(5 + Math.floor(Math.random() * 6));
        }
      }

      // Distant bot-vs-bot Battle Royale eliminations
      if (Math.random() < 0.0025 && this.entities.length > 4) {
        const other = this.entities[Math.floor(Math.random() * this.entities.length)];
        if (other && other.isAlive && other.id !== e.id) {
          other.health -= 40;
          if (other.health <= 0) {
            other.isAlive = false;
            other.rig.updateAnimation(delta, {
              action: 'dead',
              time: timeSec,
              recoil: 0,
              aimProgress: 0,
              reloadProgress: 0,
              meleeProgress: 0,
            });
            callbacks?.onBotKill?.(e.name, other.name);
          }
        }
      }
    }

    this.aliveCount = currentAlive;
  }
}
