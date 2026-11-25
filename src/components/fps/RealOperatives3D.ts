import * as THREE from 'three';
import { FpsWeapon, FpsMelee } from '../../types';

export interface OperativeAnimationState {
  action: 'idle' | 'walking' | 'running' | 'sprinting' | 'jumping' | 'crouching' | 'shooting' | 'reloading' | 'melee' | 'dead';
  time: number;
  recoil: number;
  aimProgress: number; // 0 to 1 (ADS)
  reloadProgress: number;
  meleeProgress: number;
}

// Global Material & Texture Cache to maximize FPS on 6GB RAM devices
class OperativeMaterialCache {
  private static textures = new Map<string, THREE.CanvasTexture>();
  private static materials = new Map<string, THREE.Material>();

  static getFaceTexture(skinTone: string, warpaint: string): THREE.CanvasTexture {
    const key = `face_${skinTone}_${warpaint}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    let baseSkin = '#d49b73';
    let shadowSkin = '#ad724c';
    if (skinTone === 'fair') { baseSkin = '#f2c8b0'; shadowSkin = '#d69e84'; }
    if (skinTone === 'bronze') { baseSkin = '#b97a48'; shadowSkin = '#8f572d'; }
    if (skinTone === 'dark') { baseSkin = '#7d4a2d'; shadowSkin = '#572f1a'; }

    // Gradient Skin
    const grad = ctx.createRadialGradient(256, 240, 50, 256, 256, 250);
    grad.addColorStop(0, '#fce2d2');
    grad.addColorStop(0.6, baseSkin);
    grad.addColorStop(1, shadowSkin);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Eyes
    const drawEye = (cx: number, cy: number) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 32, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      const irisGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
      irisGrad.addColorStop(0, '#0f172a');
      irisGrad.addColorStop(0.5, '#2563eb');
      irisGrad.addColorStop(1, '#020617');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2);
      ctx.fill();

      // Eyelid stroke
      ctx.strokeStyle = '#1e1e1e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 30, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    };

    drawEye(180, 210);
    drawEye(332, 210);

    // Eyebrows
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(135, 175);
    ctx.quadraticCurveTo(180, 160, 225, 175);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(377, 175);
    ctx.quadraticCurveTo(332, 160, 287, 175);
    ctx.stroke();

    // Lips
    ctx.fillStyle = '#b86b62';
    ctx.beginPath();
    ctx.moveTo(200, 340);
    ctx.quadraticCurveTo(256, 325, 312, 340);
    ctx.quadraticCurveTo(256, 365, 200, 340);
    ctx.fill();

    // Tactical Warpaint Stripes
    if (warpaint !== 'none') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(100, 230 + i * 20);
        ctx.lineTo(220, 260 + i * 20);
        ctx.lineTo(210, 275 + i * 20);
        ctx.lineTo(90, 245 + i * 20);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(412, 230 + i * 20);
        ctx.lineTo(292, 260 + i * 20);
        ctx.lineTo(302, 275 + i * 20);
        ctx.lineTo(422, 245 + i * 20);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.textures.set(key, tex);
    return tex;
  }
}

export class RealOperativeRig3D {
  root: THREE.Group;
  
  // Anatomical Joints & Limbs
  head: THREE.Group;
  chest: THREE.Group;
  pelvis: THREE.Group;
  armLeft: THREE.Group;
  armRight: THREE.Group;
  forearmLeft: THREE.Group;
  forearmRight: THREE.Group;
  legLeft: THREE.Group;
  legRight: THREE.Group;
  shinLeft: THREE.Group;
  shinRight: THREE.Group;
  
  // Attachments
  weaponGroup: THREE.Group;
  meleeGroup: THREE.Group;
  muzzleFlash: THREE.Mesh;
  visorMesh: THREE.Mesh;

  // Character Archetype
  characterArchetype: string;
  isEnemy: boolean;

  constructor(
    archetype: string = 'char_vanguard', 
    isEnemy: boolean = false, 
    camoColor: string = '#1e293b', 
    visorGlow: string = '#38bdf8'
  ) {
    this.characterArchetype = archetype;
    this.isEnemy = isEnemy;
    this.root = new THREE.Group();

    // Archetype-specific color palettes
    let uniformHex = 0x334155;
    let armorHex = 0x0f172a;
    let skinTone = 'tan';
    let visorHex = 0x38bdf8;
    let warpaint = 'shadow_stripes';

    if (archetype === 'char_vanguard' || archetype === 'default_male') {
      uniformHex = 0x3f4f38; // Military Olive
      armorHex = 0x1c1917;
      visorHex = 0x38bdf8;
    } else if (archetype === 'char_spectre' || archetype === 'default_female') {
      uniformHex = 0x1e293b; // Spec-Ops Navy
      armorHex = 0x0f172a;
      visorHex = 0xec4899;
      skinTone = 'fair';
    } else if (archetype === 'heavy_assault') {
      uniformHex = 0x713f12; // Exoskeleton Gold
      armorHex = 0x451a03;
      visorHex = 0xf59e0b;
      skinTone = 'bronze';
    } else if (archetype === 'cyber_scout') {
      uniformHex = 0x0284c7;
      armorHex = 0x082f49;
      visorHex = 0x06b6d4;
    } else if (isEnemy) {
      if (archetype === 'mutant_berserker') {
        uniformHex = 0x881337;
        armorHex = 0x4c0519;
        visorHex = 0xff0000;
        skinTone = 'dark';
      } else if (archetype === 'sniper_ghillie') {
        uniformHex = 0x14532d;
        armorHex = 0x052e16;
        visorHex = 0x22c55e;
      } else {
        uniformHex = 0x78350f;
        armorHex = 0x1c1917;
        visorHex = 0xef4444;
      }
    }

    // PBR Anatomical Materials
    const faceTex = OperativeMaterialCache.getFaceTexture(skinTone, warpaint);
    const skinMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.65,
      metalness: 0.05
    });

    const bodySkinMat = new THREE.MeshStandardMaterial({
      color: skinTone === 'fair' ? 0xf2c8b0 : skinTone === 'bronze' ? 0xb97a48 : 0xd49b73,
      roughness: 0.65,
      metalness: 0.05
    });

    const uniformMat = new THREE.MeshStandardMaterial({ color: uniformHex, roughness: 0.75, metalness: 0.1 });
    const armorMat = new THREE.MeshStandardMaterial({ color: armorHex, roughness: 0.4, metalness: 0.6 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.4 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5, metalness: 0.3 });
    const visorMat = new THREE.MeshBasicMaterial({ color: visorHex });

    // 1. PELVIS & LOWER TORSO (Anatomical Curved Geometry)
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.88;
    this.root.add(this.pelvis);

    const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.22, 12), uniformMat);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);

    // Tactical Web Belt
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 12), armorMat);
    belt.position.y = 0.08;
    this.pelvis.add(belt);

    // 2. CHEST & UPPER TORSO (Muscular contoured shape)
    this.chest = new THREE.Group();
    this.chest.position.y = 0.22;
    this.pelvis.add(this.chest);

    const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.42, 12), uniformMat);
    chestMesh.position.y = 0.21;
    chestMesh.castShadow = true;
    this.chest.add(chestMesh);

    // Ballistic Plate Carrier Vest
    const plateCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.32), armorMat);
    plateCarrier.position.set(0, 0.22, 0.02);
    plateCarrier.castShadow = true;
    this.chest.add(plateCarrier);

    // MOLLE Mag Pouches on Chest
    [-0.12, 0, 0.12].forEach((px) => {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.08), armorMat);
      mag.position.set(px, 0.16, 0.19);
      this.chest.add(mag);
    });

    // 3. ANATOMICAL HEAD & FACIAL FEATURES
    this.head = new THREE.Group();
    this.head.position.y = 0.46;
    this.chest.add(this.head);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 10), bodySkinMat);
    neck.position.y = 0.07;
    this.head.add(neck);

    // Anatomical Skull
    const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
    headGeo.scale(0.92, 1.08, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 0.22;
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // 3D Sculpted Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 6), bodySkinMat);
    nose.position.set(0, 0.2, 0.18);
    nose.rotation.x = Math.PI / 2.3;
    this.head.add(nose);

    // Tactical Fast-Ops Combat Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), armorMat);
    helmet.position.set(0, 0.23, 0);
    this.head.add(helmet);

    // Glowing Tactical Visor / Goggles
    this.visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.09), visorMat);
    this.visorMesh.position.set(0, 0.22, 0.15);
    this.head.add(this.visorMesh);

    // Tactical Headset / Ear Protection
    [-0.19, 0.19].forEach((ex) => {
      const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), armorMat);
      earCup.position.set(ex, 0.22, 0);
      earCup.rotation.z = Math.PI / 2;
      this.head.add(earCup);
    });

    // 4. ARTICULATED LEFT ARM (Shoulder, Deltoid, Bicep, Forearm, Gloved Hand)
    this.armLeft = new THREE.Group();
    this.armLeft.position.set(-0.3, 0.38, 0);
    this.chest.add(this.armLeft);

    // Shoulder Pad / Deltoid
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), armorMat);
    this.armLeft.add(shoulderL);

    // Bicep
    const bicepL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.24, 10), uniformMat);
    bicepL.position.y = -0.14;
    this.armLeft.add(bicepL);

    // Left Forearm
    this.forearmLeft = new THREE.Group();
    this.forearmLeft.position.y = -0.26;
    this.armLeft.add(this.forearmLeft);

    const forearmLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.22, 10), uniformMat);
    forearmLMesh.position.y = -0.11;
    this.forearmLeft.add(forearmLMesh);

    // Tactical Gloved Hand with fingers
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.09), gloveMat);
    handL.position.y = -0.24;
    this.forearmLeft.add(handL);

    // 5. ARTICULATED RIGHT ARM (Shoulder, Deltoid, Bicep, Forearm, Gloved Hand, Gun)
    this.armRight = new THREE.Group();
    this.armRight.position.set(0.3, 0.38, 0);
    this.chest.add(this.armRight);

    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), armorMat);
    this.armRight.add(shoulderR);

    const bicepR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.24, 10), uniformMat);
    bicepR.position.y = -0.14;
    this.armRight.add(bicepR);

    this.forearmRight = new THREE.Group();
    this.forearmRight.position.y = -0.26;
    this.armRight.add(this.forearmRight);

    const forearmRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.22, 10), uniformMat);
    forearmRMesh.position.y = -0.11;
    this.forearmRight.add(forearmRMesh);

    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.09), gloveMat);
    handR.position.y = -0.24;
    this.forearmRight.add(handR);

    // WEAPON HOLDER
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0, -0.24, 0.1);
    this.weaponGroup.rotation.x = -Math.PI / 2;
    this.forearmRight.add(this.weaponGroup);

    this.buildWeaponMesh('m4a1_cyber');

    // Muzzle Flash
    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0 })
    );
    this.muzzleFlash.position.set(0, 0.85, 0);
    this.weaponGroup.add(this.muzzleFlash);

    // MELEE KNIFE ATTACHMENT
    this.meleeGroup = new THREE.Group();
    this.meleeGroup.position.set(0, -0.24, 0.05);
    this.meleeGroup.visible = false;
    this.forearmRight.add(this.meleeGroup);

    const knifeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.06), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 }));
    knifeBlade.position.y = 0.18;
    this.meleeGroup.add(knifeBlade);

    // 6. ARTICULATED LEGS & COMBAT BOOTS
    // Left Leg
    this.legLeft = new THREE.Group();
    this.legLeft.position.set(-0.14, -0.08, 0);
    this.pelvis.add(this.legLeft);

    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.42, 10), uniformMat);
    thighL.position.y = -0.21;
    thighL.castShadow = true;
    this.legLeft.add(thighL);

    // Knee Armor Pad
    const kneepadL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.09), armorMat);
    kneepadL.position.set(0, -0.38, 0.05);
    this.legLeft.add(kneepadL);

    this.shinLeft = new THREE.Group();
    this.shinLeft.position.y = -0.42;
    this.legLeft.add(this.shinLeft);

    const shinLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.38, 10), uniformMat);
    shinLMesh.position.y = -0.19;
    this.shinLeft.add(shinLMesh);

    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.24), bootMat);
    bootL.position.set(0, -0.38, 0.04);
    this.shinLeft.add(bootL);

    // Right Leg
    this.legRight = new THREE.Group();
    this.legRight.position.set(0.14, -0.08, 0);
    this.pelvis.add(this.legRight);

    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.42, 10), uniformMat);
    thighR.position.y = -0.21;
    thighR.castShadow = true;
    this.legRight.add(thighR);

    const kneepadR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.09), armorMat);
    kneepadR.position.set(0, -0.38, 0.05);
    this.legRight.add(kneepadR);

    this.shinRight = new THREE.Group();
    this.shinRight.position.y = -0.42;
    this.legRight.add(this.shinRight);

    const shinRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.38, 10), uniformMat);
    shinRMesh.position.y = -0.19;
    this.shinRight.add(shinRMesh);

    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.24), bootMat);
    bootR.position.set(0, -0.38, 0.04);
    this.shinRight.add(bootR);
  }

  buildWeaponMesh(weaponId: string) {
    while (this.weaponGroup.children.length > 1) {
      this.weaponGroup.remove(this.weaponGroup.children[0]);
    }

    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.2 });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.12), gunMat);
    receiver.position.y = 0.2;
    this.weaponGroup.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46, 8), barrelMat);
    barrel.position.y = 0.6;
    this.weaponGroup.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), barrelMat);
    mag.position.set(0, 0.15, -0.09);
    this.weaponGroup.add(mag);
  }

  // Animation Engine
  updateAnimation(delta: number, state: OperativeAnimationState) {
    const t = state.time;

    this.head.rotation.set(0, 0, 0);
    this.chest.rotation.set(0, 0, 0);
    this.pelvis.position.y = 0.88;
    this.armLeft.rotation.set(0, 0, 0);
    this.armRight.rotation.set(0, 0, 0);
    this.forearmLeft.rotation.set(0, 0, 0);
    this.forearmRight.rotation.set(0, 0, 0);
    this.legLeft.rotation.set(0, 0, 0);
    this.legRight.rotation.set(0, 0, 0);
    this.shinLeft.rotation.set(0, 0, 0);
    this.shinRight.rotation.set(0, 0, 0);

    if (state.action === 'dead') {
      this.pelvis.position.y = 0.15;
      this.root.rotation.x = -Math.PI / 2;
      this.armLeft.rotation.z = -1.2;
      this.armRight.rotation.z = 1.2;
      return;
    } else {
      this.root.rotation.x = 0;
    }

    if (state.action === 'crouching') {
      this.pelvis.position.y = 0.52;
      this.legLeft.rotation.x = -0.8;
      this.legRight.rotation.x = -0.8;
      this.shinLeft.rotation.x = 1.2;
      this.shinRight.rotation.x = 1.2;
    }

    if (state.action === 'idle') {
      const breath = Math.sin(t * 2) * 0.02;
      this.chest.position.y = 0.22 + breath;
      this.armRight.rotation.x = -0.6 + breath * 0.5;
      this.forearmRight.rotation.x = -0.7;
      this.armLeft.rotation.x = -0.5;
      this.armLeft.rotation.y = 0.4;
      this.forearmLeft.rotation.x = -0.8;
    } else if (state.action === 'walking' || state.action === 'running' || state.action === 'sprinting') {
      const speed = state.action === 'sprinting' ? 12 : state.action === 'running' ? 9 : 6;
      const stride = Math.sin(t * speed);
      const bob = Math.abs(Math.cos(t * speed)) * 0.06;

      this.pelvis.position.y = 0.88 + bob;
      this.legLeft.rotation.x = stride * 0.6;
      this.legRight.rotation.x = -stride * 0.6;
      this.shinLeft.rotation.x = Math.max(0, -stride * 0.8);
      this.shinRight.rotation.x = Math.max(0, stride * 0.8);
      this.chest.rotation.y = Math.cos(t * speed) * 0.08;

      if (state.action === 'sprinting') {
        this.armRight.rotation.x = -0.3 + stride * 0.3;
        this.armLeft.rotation.x = -stride * 0.8;
      } else {
        this.armRight.rotation.x = -0.7 + stride * 0.1;
        this.forearmRight.rotation.x = -0.8;
        this.armLeft.rotation.x = -0.5;
        this.armLeft.rotation.y = 0.4;
        this.forearmLeft.rotation.x = -0.8;
      }
    } else if (state.action === 'jumping') {
      this.pelvis.position.y = 1.1;
      this.legLeft.rotation.x = -0.4;
      this.legRight.rotation.x = -0.2;
      this.shinLeft.rotation.x = 0.6;
      this.shinRight.rotation.x = 0.4;
      this.armRight.rotation.x = -0.8;
    }

    if (state.aimProgress > 0) {
      const aim = state.aimProgress;
      this.armRight.rotation.x = THREE.MathUtils.lerp(this.armRight.rotation.x, -1.2, aim);
      this.forearmRight.rotation.x = THREE.MathUtils.lerp(this.forearmRight.rotation.x, -0.4, aim);
      this.armLeft.rotation.x = THREE.MathUtils.lerp(this.armLeft.rotation.x, -0.9, aim);
      this.armLeft.rotation.y = THREE.MathUtils.lerp(this.armLeft.rotation.y, 0.6, aim);
      this.forearmLeft.rotation.x = THREE.MathUtils.lerp(this.forearmLeft.rotation.x, -0.6, aim);
    }

    if (state.recoil > 0) {
      this.armRight.rotation.x -= state.recoil * 0.2;
      (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1;
    } else {
      (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    if (state.meleeProgress > 0) {
      const m = state.meleeProgress;
      this.meleeGroup.visible = true;
      this.weaponGroup.visible = false;
      this.armRight.rotation.x = -1.4 + Math.sin(m * Math.PI) * 1.8;
    } else {
      this.meleeGroup.visible = false;
      this.weaponGroup.visible = true;
    }
  }
}
