import * as THREE from 'three';
import { RealOperativeRig3D } from './RealOperatives3D';

export interface ParachuteDropEntity {
  id: string;
  isPlayer: boolean;
  name: string;
  rig: RealOperativeRig3D;
  parachuteMesh: THREE.Group;
  smokeTrail: THREE.Mesh[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  targetLandingPos: THREE.Vector3;
  hasLanded: boolean;
  health: number;
  maxHealth: number;
  kills: number;
  isAlive: boolean;
  targetEnemyId: string | null;
  shootCooldown: number;
  team: 'alpha' | 'bravo' | 'solo';
}

export class BattleRoyaleManager {
  public entities: ParachuteDropEntity[] = [];
  public totalOperatives: number = 40;
  public aliveCount: number = 40;
  public matchPhase: 'airborne_drop' | 'combat' | 'game_over' = 'airborne_drop';
  
  // Safe Zone / Poison Gas Storm Ring
  public stormCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  public currentStormRadius: number = 180;
  public targetStormRadius: number = 40;
  public stormShrinkSpeed: number = 1.8;
  public stormMesh?: THREE.Mesh;

  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, initialPlayerPos: THREE.Vector3) {
    this.scene = scene;
    this.createStormMesh();
    this.spawnOperatives(initialPlayerPos);
  }

  // Create High-Altitude Poison Gas Storm Cylinder Barrier
  private createStormMesh() {
    const geo = new THREE.CylinderGeometry(this.currentStormRadius, this.currentStormRadius, 120, 32, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9333ea, // Cyber Purple Electric Storm
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    this.stormMesh = new THREE.Mesh(geo, mat);
    this.stormMesh.position.set(0, 50, 0);
    this.scene.add(this.stormMesh);
  }

  // Assemble 3D Military Parachute Canopy
  public static createParachuteMesh(colorHex: number = 0x1e293b, stripeHex: number = 0x38bdf8): THREE.Group {
    const group = new THREE.Group();

    // Canopy Dome
    const domeGeo = new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const dome = new THREE.Mesh(domeGeo, canopyMat);
    group.add(dome);

    // Accent Racing Stripes on Parachute
    const stripeGeo = new THREE.SphereGeometry(2.42, 16, 4, Math.PI * 0.4, Math.PI * 0.2, 0, Math.PI / 2.3);
    const stripeMat = new THREE.MeshBasicMaterial({ color: stripeHex, side: THREE.DoubleSide });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    group.add(stripe);

    // Parachute Suspension Lines / Ropes (Connecting canopy to soldier harness)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x64748b });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rx = Math.cos(angle) * 2.3;
      const rz = Math.sin(angle) * 2.3;

      const points = [
        new THREE.Vector3(rx, 0, rz),
        new THREE.Vector3(0, -2.8, 0)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);
    }

    return group;
  }

  // Spawn Battle Royale Operatives High In The Sky
  private spawnOperatives(playerPos: THREE.Vector3) {
    const botArchetypes = [
      'char_vanguard', 'char_spectre', 'urban_male', 'urban_female', 
      'heavy_assault', 'cyber_scout', 'basic_insurgent', 'heavy_gunner', 'sniper_ghillie'
    ];

    const botNames = [
      'Ghost_Recon', 'Viper_X', 'Shadow_Striker', 'Apex_Predator', 'Delta_9',
      'Kapkan_Pro', 'Frost_Bite', 'Havoc_Rider', 'Spectre_Ops', 'Rogue_Echo',
      'Phoenix_Wing', 'Titan_Shield', 'Silent_Hunter', 'Storm_Bringer', 'Zero_Day',
      'Cyber_Blade', 'Neon_Drifter', 'Iron_Clad', 'Wolf_Pack', 'Dead_Shot'
    ];

    for (let i = 0; i < this.totalOperatives - 1; i++) {
      const arch = botArchetypes[i % botArchetypes.length];
      const botName = botNames[i % botNames.length] + `_${Math.floor(10 + Math.random() * 90)}`;
      const rig = new RealOperativeRig3D(arch, true, '#1e293b', '#ef4444');

      // Random landing target across island (radius 20 to 120)
      const targetAngle = Math.random() * Math.PI * 2;
      const targetDist = 25 + Math.random() * 95;
      const targetX = Math.cos(targetAngle) * targetDist;
      const targetZ = Math.sin(targetAngle) * targetDist;

      // High altitude spawn (80 to 140 meters up)
      const spawnY = 70 + Math.random() * 60;
      const startX = targetX + (Math.random() - 0.5) * 40;
      const startZ = targetZ + (Math.random() - 0.5) * 40;

      const pos = new THREE.Vector3(startX, spawnY, startZ);
      rig.root.position.copy(pos);
      this.scene.add(rig.root);

      // Attach 3D Parachute to bot
      const parachuteMesh = BattleRoyaleManager.createParachuteMesh(
        Math.random() > 0.5 ? 0x1e293b : 0x78350f,
        Math.random() > 0.5 ? 0xef4444 : 0x38bdf8
      );
      parachuteMesh.position.set(0, 3.2, 0);
      rig.root.add(parachuteMesh);

      this.entities.push({
        id: `bot_${i}`,
        isPlayer: false,
        name: botName,
        rig,
        parachuteMesh,
        smokeTrail: [],
        pos,
        vel: new THREE.Vector3((targetX - startX) * 0.1, -12, (targetZ - startZ) * 0.1),
        targetLandingPos: new THREE.Vector3(targetX, 0.9, targetZ),
        hasLanded: false,
        health: 100,
        maxHealth: 100,
        kills: 0,
        isAlive: true,
        targetEnemyId: null,
        shootCooldown: 1.0 + Math.random() * 2.0,
        team: 'solo'
      });
    }

    this.aliveCount = this.totalOperatives;
  }

  // Update Battle Royale Loop: Skydive Glide, Landing, AI Hunt, and Storm Shrink
  public update(delta: number, playerPos: THREE.Vector3, onBotKill?: (killer: string, victim: string) => void) {
    // 1. Shrink Safe Zone Storm Ring
    if (this.currentStormRadius > this.targetStormRadius) {
      this.currentStormRadius = Math.max(this.targetStormRadius, this.currentStormRadius - this.stormShrinkSpeed * delta);
      if (this.stormMesh) {
        this.stormMesh.scale.set(this.currentStormRadius / 180, 1, this.currentStormRadius / 180);
      }
    }

    // 2. Update Bots Movement & Combat
    let currentAlive = 1; // local player

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.isAlive) continue;
      currentAlive++;

      // Phase A: Airborne Parachute Descent
      if (!e.hasLanded) {
        // Glide downwards towards landing target
        e.pos.y -= 14 * delta;
        e.pos.x = THREE.MathUtils.lerp(e.pos.x, e.targetLandingPos.x, delta * 0.8);
        e.pos.z = THREE.MathUtils.lerp(e.pos.z, e.targetLandingPos.z, delta * 0.8);

        e.rig.root.position.copy(e.pos);
        e.rig.updateAnimation(delta, {
          action: 'jumping',
          time: performance.now() * 0.001,
          recoil: 0,
          aimProgress: 0,
          reloadProgress: 0,
          meleeProgress: 0
        });

        // Touchdown on terrain
        if (e.pos.y <= 0.9) {
          e.pos.y = 0.9;
          e.hasLanded = true;
          // Detach parachute canopy
          e.parachuteMesh.visible = false;
        }
        continue;
      }

      // Phase B: Ground Combat & AI Hunting Logic
      e.shootCooldown -= delta;

      // Check distance to player
      const distToPlayer = e.pos.distanceTo(playerPos);
      let targetPos = playerPos;

      // Roam or Seek Nearest Target
      if (distToPlayer < 45) {
        targetPos = playerPos;
      } else {
        // Roam inside safe zone
        targetPos = new THREE.Vector3(
          Math.sin(performance.now() * 0.0003 + i) * (this.currentStormRadius * 0.6),
          0.9,
          Math.cos(performance.now() * 0.0003 + i) * (this.currentStormRadius * 0.6)
        );
      }

      // Move toward target position
      const moveDir = new THREE.Vector3().subVectors(targetPos, e.pos);
      moveDir.y = 0;
      if (moveDir.lengthSq() > 4) {
        moveDir.normalize();
        const speed = 6.0;
        e.pos.x += moveDir.x * speed * delta;
        e.pos.z += moveDir.z * speed * delta;

        // Face movement direction
        const yaw = Math.atan2(moveDir.x, moveDir.z);
        e.rig.root.rotation.y = yaw;

        e.rig.root.position.copy(e.pos);
        e.rig.updateAnimation(delta, {
          action: 'running',
          time: performance.now() * 0.001,
          recoil: e.shootCooldown < 0.2 ? 1 : 0,
          aimProgress: distToPlayer < 35 ? 1 : 0,
          reloadProgress: 0,
          meleeProgress: 0
        });
      }

      // Bot-on-Bot or Bot-on-Player Skirmish
      if (distToPlayer < 35 && e.shootCooldown <= 0) {
        e.shootCooldown = 1.8 + Math.random() * 2.5;
        // Bot fires shot
      }

      // Random background skirmishes between distant bots to simulate lively 50-man BR
      if (Math.random() < 0.004 && this.entities.length > 5) {
        const otherIdx = Math.floor(Math.random() * this.entities.length);
        const other = this.entities[otherIdx];
        if (other && other.isAlive && other.id !== e.id) {
          other.health -= 35;
          if (other.health <= 0) {
            other.isAlive = false;
            other.rig.updateAnimation(delta, { action: 'dead', time: 0, recoil: 0, aimProgress: 0, reloadProgress: 0, meleeProgress: 0 });
            if (onBotKill) onBotKill(e.name, other.name);
          }
        }
      }
    }

    this.aliveCount = currentAlive;
  }
}
