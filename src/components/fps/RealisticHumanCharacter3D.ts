import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FpsCharacter, FpsWeapon } from '../../types';

// Cache for loaded web GLTF models and textures to prevent re-fetching
const gltfModelCache = new Map<string, THREE.Group>();
const textureCache = new Map<string, THREE.Texture>();

export interface HumanCustomizationOptions {
  gender?: 'male' | 'female';
  skinTone?: 'fair' | 'tan' | 'bronze' | 'dark' | 'ebony';
  eyeColor?: 'brown' | 'blue' | 'green' | 'hazel' | 'amber';
  hairStyle?: 'taper_fade' | 'tactical_undercut' | 'spec_ops_braids' | 'infiltrator_ponytail' | 'tactical_cap' | 'kevlar_nvg_helmet' | 'stealth_hood' | string;
  hairColor?: string;
  warpaint?: 'none' | 'shadow_stripes' | 'blood_slash' | 'skull_mask' | 'cross_camo';
  outfitCamo?: 'camo_urban' | 'camo_crimson' | 'camo_arctic' | 'camo_desert' | 'camo_gold' | string;
  visorGlow?: string;
  webModelUrl?: string;
}

// Generates an ultra-detailed procedural face canvas texture with eyes, eyebrows, lips, skin pores, and warpaint
export function generateRealisticFaceTexture(options: HumanCustomizationOptions): THREE.CanvasTexture {
  const cacheKey = `face_${options.skinTone || 'tan'}_${options.eyeColor || 'brown'}_${options.warpaint || 'shadow_stripes'}_${options.gender || 'male'}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey) as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const dummy = new THREE.CanvasTexture(canvas);
    return dummy;
  }

  // Base Skin Tones
  let baseSkin = '#d49b73';
  let highlightSkin = '#e4ab85';
  let shadowSkin = '#ad724c';
  let lipColor = '#b86b62';

  if (options.skinTone === 'fair') {
    baseSkin = '#f2c8b0';
    highlightSkin = '#fce2d2';
    shadowSkin = '#d69e84';
    lipColor = '#cc7a7a';
  } else if (options.skinTone === 'bronze') {
    baseSkin = '#b97a48';
    highlightSkin = '#cf8f5a';
    shadowSkin = '#8f572d';
    lipColor = '#944b41';
  } else if (options.skinTone === 'dark') {
    baseSkin = '#7d4a2d';
    highlightSkin = '#915938';
    shadowSkin = '#572f1a';
    lipColor = '#6b3628';
  } else if (options.skinTone === 'ebony') {
    baseSkin = '#452618';
    highlightSkin = '#573322';
    shadowSkin = '#2d160c';
    lipColor = '#3b1c14';
  }

  // Fill base skin gradient
  const grad = ctx.createRadialGradient(512, 480, 100, 512, 512, 500);
  grad.addColorStop(0, highlightSkin);
  grad.addColorStop(0.6, baseSkin);
  grad.addColorStop(1, shadowSkin);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle skin pore noise
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let i = 0; i < 8000; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    ctx.fillRect(rx, ry, 1.5, 1.5);
  }

  // Eye Sockets Shadowing
  ctx.fillStyle = shadowSkin;
  ctx.beginPath();
  ctx.ellipse(360, 420, 95, 60, 0, 0, Math.PI * 2);
  ctx.ellipse(664, 420, 95, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyeball Sclera (White with natural depth)
  const drawEye = (cx: number, cy: number, isRight: boolean) => {
    // Sclera
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 65, 34, isRight ? -0.05 : 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    let irisHex = '#5c3a21'; // Brown
    if (options.eyeColor === 'blue') irisHex = '#2563eb';
    if (options.eyeColor === 'green') irisHex = '#15803d';
    if (options.eyeColor === 'hazel') irisHex = '#854d0e';
    if (options.eyeColor === 'amber') irisHex = '#d97706';

    const irisGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    irisGrad.addColorStop(0, '#0f172a');
    irisGrad.addColorStop(0.4, irisHex);
    irisGrad.addColorStop(0.9, '#020617');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();

    // Specular Light Glint (Life & Realism)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 7, 5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy + 6, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyelids & Eyelashes
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 62, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 62, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  };

  drawEye(360, 420, false);
  drawEye(664, 420, true);

  // Eyebrows (Realistic tactical feathered strokes)
  ctx.fillStyle = '#1c1917';
  const drawEyebrow = (startX: number, startY: number, endX: number, endY: number, isRight: boolean) => {
    ctx.save();
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#18181b';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo((startX + endX) / 2, startY - 24, endX, endY);
    ctx.stroke();

    // Fine hair strokes
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#27272a';
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t - (Math.sin(t * Math.PI) * 16);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (isRight ? 6 : -6), y - 10);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawEyebrow(270, 350, 450, 360, false);
  drawEyebrow(754, 350, 574, 360, true);

  // Nose Shading & Nostrils
  const noseGrad = ctx.createLinearGradient(480, 400, 544, 560);
  noseGrad.addColorStop(0, 'rgba(0,0,0,0)');
  noseGrad.addColorStop(0.7, shadowSkin);
  noseGrad.addColorStop(1, shadowSkin);
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(500, 380);
  ctx.lineTo(524, 380);
  ctx.lineTo(545, 560);
  ctx.lineTo(479, 560);
  ctx.closePath();
  ctx.fill();

  // Nostrils
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(475, 565, 14, 8, -0.3, 0, Math.PI * 2);
  ctx.ellipse(549, 565, 14, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Lips
  ctx.fillStyle = lipColor;
  ctx.beginPath();
  ctx.moveTo(400, 680);
  ctx.quadraticCurveTo(512, 650, 624, 680); // upper lip
  ctx.quadraticCurveTo(512, 730, 400, 680); // lower lip
  ctx.fill();

  // Lip center divider
  ctx.strokeStyle = '#3f1813';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(410, 680);
  ctx.quadraticCurveTo(512, 684, 614, 680);
  ctx.stroke();

  // Tactical Camo Warpaint
  if (options.warpaint && options.warpaint !== 'none') {
    ctx.save();
    if (options.warpaint === 'shadow_stripes') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      // 3 tactical angle slashes across cheeks
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(200, 460 + i * 40);
        ctx.lineTo(440, 520 + i * 40);
        ctx.lineTo(420, 545 + i * 40);
        ctx.lineTo(180, 485 + i * 40);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(824, 460 + i * 40);
        ctx.lineTo(584, 520 + i * 40);
        ctx.lineTo(604, 545 + i * 40);
        ctx.lineTo(844, 485 + i * 40);
        ctx.fill();
      }
    } else if (options.warpaint === 'blood_slash') {
      ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
      ctx.beginPath();
      ctx.moveTo(340, 310);
      ctx.lineTo(400, 620);
      ctx.lineTo(365, 630);
      ctx.lineTo(310, 320);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(684, 310);
      ctx.lineTo(624, 620);
      ctx.lineTo(659, 630);
      ctx.lineTo(714, 320);
      ctx.fill();
    } else if (options.warpaint === 'skull_mask') {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.82)';
      ctx.beginPath();
      ctx.arc(512, 680, 160, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      // teeth lines
      for (let x = 400; x <= 624; x += 28) {
        ctx.fillRect(x, 660, 8, 45);
      }
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set(cacheKey, texture);
  return texture;
}

// Generates high-resolution camouflage fabric texture for tactical uniform & vests
export function generateCamoTexture(camoId: string = 'camo_urban'): THREE.CanvasTexture {
  const cacheKey = `camo_${camoId}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey) as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  let bg = '#1e293b';
  let patch1 = '#334155';
  let patch2 = '#0f172a';
  let patch3 = '#0284c7';

  if (camoId === 'camo_crimson') {
    bg = '#4c0519';
    patch1 = '#881337';
    patch2 = '#1c1917';
    patch3 = '#e11d48';
  } else if (camoId === 'camo_arctic') {
    bg = '#475569';
    patch1 = '#64748b';
    patch2 = '#94a3b8';
    patch3 = '#e2e8f0';
  } else if (camoId === 'camo_desert') {
    bg = '#451a03';
    patch1 = '#78350f';
    patch2 = '#92400e';
    patch3 = '#d97706';
  } else if (camoId === 'camo_gold') {
    bg = '#1c1917';
    patch1 = '#44403c';
    patch2 = '#78350f';
    patch3 = '#eab308';
  }

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Organic Camo Blobs
  const drawBlobs = (color: string, count: number, maxRad: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      ctx.beginPath();
      const numPts = 6;
      for (let j = 0; j < numPts; j++) {
        const angle = (j / numPts) * Math.PI * 2;
        const rad = (maxRad * 0.5) + Math.random() * (maxRad * 0.5);
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  };

  drawBlobs(patch1, 16, 80);
  drawBlobs(patch2, 14, 60);
  drawBlobs(patch3, 8, 40);

  // Digital pixel weave overlay
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < 512; y += 4) {
    ctx.fillRect(0, y, 512, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  textureCache.set(cacheKey, texture);
  return texture;
}

// Real-Time Human Character Skeleton & Mesh Rig
export class RealisticHumanOperativeRig {
  public rootGroup: THREE.Group;
  public headGroup: THREE.Group;
  public leftArmGroup: THREE.Group;
  public rightArmGroup: THREE.Group;
  public leftLegGroup: THREE.Group;
  public rightLegGroup: THREE.Group;
  public weaponMeshGroup: THREE.Group;
  public jetpackGroup: THREE.Group;
  public muzzleFlashMesh?: THREE.Mesh;

  private clock: THREE.Clock;
  private isAiming: boolean = false;
  private isRunning: boolean = false;
  private isFiring: boolean = false;
  private fireTimer: number = 0;
  private options: HumanCustomizationOptions;

  constructor(
    character: FpsCharacter,
    weapon: FpsWeapon,
    customOptions: HumanCustomizationOptions = {}
  ) {
    this.options = {
      gender: customOptions.gender || 'male',
      skinTone: customOptions.skinTone || 'tan',
      eyeColor: customOptions.eyeColor || 'brown',
      hairStyle: customOptions.hairStyle || character.hairStyle || 'tactical_undercut',
      hairColor: customOptions.hairColor || '#1c1917',
      warpaint: customOptions.warpaint || 'shadow_stripes',
      outfitCamo: customOptions.outfitCamo || character.outfitCamo || 'camo_urban',
      visorGlow: customOptions.visorGlow || character.visorGlow || '#38bdf8',
      webModelUrl: customOptions.webModelUrl
    };

    this.clock = new THREE.Clock();
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = `realistic_human_${character.id}`;

    // Sub-joint groups for skeletal animation
    this.headGroup = new THREE.Group();
    this.leftArmGroup = new THREE.Group();
    this.rightArmGroup = new THREE.Group();
    this.leftLegGroup = new THREE.Group();
    this.rightLegGroup = new THREE.Group();
    this.weaponMeshGroup = new THREE.Group();
    this.jetpackGroup = new THREE.Group();

    this.buildHumanoidModel(character, weapon);
  }

  private buildHumanoidModel(character: FpsCharacter, weapon: FpsWeapon) {
    const faceTex = generateRealisticFaceTexture(this.options);
    const camoTex = generateCamoTexture(this.options.outfitCamo);

    // Human Skin Material (Anatomical PBR)
    const skinMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.65,
      metalness: 0.05,
      bumpScale: 0.02
    });

    // Body Skin Material for neck, arms, hands
    let skinColorHex = 0xd49b73;
    if (this.options.skinTone === 'fair') skinColorHex = 0xf2c8b0;
    if (this.options.skinTone === 'bronze') skinColorHex = 0xb97a48;
    if (this.options.skinTone === 'dark') skinColorHex = 0x7d4a2d;
    if (this.options.skinTone === 'ebony') skinColorHex = 0x452618;

    const bodySkinMat = new THREE.MeshStandardMaterial({
      color: skinColorHex,
      roughness: 0.65,
      metalness: 0.05
    });

    // Uniform & Vest Materials
    const uniformMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.75,
      metalness: 0.15
    });

    const tacticalBlackMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.65
    });

    const armorPlateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.8
    });

    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
      metalness: 0.4
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.4,
      metalness: 0.3
    });

    // 1. PELVIS & ATHLETIC TORSO
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.22, 12), uniformMat);
    pelvis.position.set(0, 0.84, 0);
    pelvis.castShadow = true;
    this.rootGroup.add(pelvis);

    // Muscular Upper Torso / Ribcage
    const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.28), uniformMat);
    upperTorso.position.set(0, 1.15, 0);
    upperTorso.castShadow = true;
    this.rootGroup.add(upperTorso);

    // Heavy Tactical Ballistic Plate Carrier Vest
    const plateCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.34), armorPlateMat);
    plateCarrier.position.set(0, 1.18, 0.01);
    plateCarrier.castShadow = true;
    this.rootGroup.add(plateCarrier);

    // Front Chest Ceramic Armor Plate
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.08), tacticalBlackMat);
    frontPlate.position.set(0, 1.22, 0.19);
    this.rootGroup.add(frontPlate);

    // MOLLE Mag Pouches on Chest (3 AR-15 / AK Magazine holders)
    [-0.14, 0, 0.14].forEach((px) => {
      const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.09), tacticalBlackMat);
      magPouch.position.set(px, 1.05, 0.2);
      this.rootGroup.add(magPouch);

      // Visible Mag Top
      const magTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.07), armorPlateMat);
      magTop.position.set(px, 1.14, 0.2);
      this.rootGroup.add(magTop);
    });

    // Tactical Knife Sheathed on Vest
    const knifeSheath = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.04), tacticalBlackMat);
    knifeSheath.position.set(-0.22, 1.25, 0.18);
    knifeSheath.rotation.z = -0.3;
    this.rootGroup.add(knifeSheath);

    // Tactical Radio / Comms Unit with Antenna on left shoulder
    const radioUnit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.07), tacticalBlackMat);
    radioUnit.position.set(-0.22, 1.38, -0.05);
    this.rootGroup.add(radioUnit);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 6), tacticalBlackMat);
    antenna.position.set(-0.22, 1.52, -0.05);
    this.rootGroup.add(antenna);

    // 2. MUSCULAR NECK & REALISTIC HUMAN HEAD
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 12), bodySkinMat);
    neck.position.set(0, 1.44, 0);
    this.rootGroup.add(neck);

    this.headGroup.position.set(0, 1.62, 0);

    // Realistic Anatomical Human Skull & Face Mesh
    const headGeo = new THREE.SphereGeometry(0.18, 24, 24);
    // Scale slightly to make natural jaw/chin shape
    headGeo.scale(0.92, 1.08, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // 3D Nose Bridge & Tip Sculpt
    const noseGeo = new THREE.ConeGeometry(0.035, 0.08, 8);
    const noseMesh = new THREE.Mesh(noseGeo, bodySkinMat);
    noseMesh.position.set(0, -0.02, 0.18);
    noseMesh.rotation.x = Math.PI / 2.3;
    this.headGroup.add(noseMesh);

    // 3D Ears
    [-0.17, 0.17].forEach((ex) => {
      const earGeo = new THREE.BoxGeometry(0.03, 0.07, 0.05);
      const earMesh = new THREE.Mesh(earGeo, bodySkinMat);
      earMesh.position.set(ex, 0, -0.02);
      earMesh.rotation.y = ex > 0 ? 0.3 : -0.3;
      this.headGroup.add(earMesh);
    });

    // 3D HAIRSTYLES & TACTICAL HEADGEAR
    this.buildHairAndHeadgear(this.headGroup, tacticalBlackMat, armorPlateMat);

    this.rootGroup.add(this.headGroup);

    // 3. ARTICULATED ARMS & COMBAT GLOVES
    this.buildArms(this.leftArmGroup, this.rightArmGroup, uniformMat, bodySkinMat, gloveMat);
    this.rootGroup.add(this.leftArmGroup);
    this.rootGroup.add(this.rightArmGroup);

    // 4. WEAPON RIG (M4A1 / AK-47 / Sniper)
    this.buildWeaponMesh(weapon, armorPlateMat, tacticalBlackMat);
    this.rootGroup.add(this.weaponMeshGroup);

    // 5. LEGS, CARGO PANTS, KNEE PADS & BOOTS
    this.buildLegs(this.leftLegGroup, this.rightLegGroup, uniformMat, armorPlateMat, bootMat);
    this.rootGroup.add(this.leftLegGroup);
    this.rootGroup.add(this.rightLegGroup);

    // 6. BACKPACK / JETPACK FLIGHT UNIT
    this.buildJetpack(this.jetpackGroup, tacticalBlackMat, armorPlateMat);
    this.rootGroup.add(this.jetpackGroup);

    // Attempt web 3D model loading if custom URL provided
    if (this.options.webModelUrl) {
      this.loadWeb3DModel(this.options.webModelUrl);
    }
  }

  // Builds realistic 3D hair styles or tactical helmets
  private buildHairAndHeadgear(parent: THREE.Group, blackMat: THREE.Material, armorMat: THREE.Material) {
    const hairColor = this.options.hairColor || '#1c1917';
    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hairColor),
      roughness: 0.85,
      metalness: 0.1
    });

    const style = this.options.hairStyle || 'tactical_undercut';

    if (style === 'taper_fade' || style === 'combat_crewcut') {
      // Modern High-Fade Military Hair
      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.26), hairMat);
      hairTop.position.set(0, 0.16, -0.01);
      parent.add(hairTop);

      // Textured hair strands
      for (let i = -3; i <= 3; i++) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), hairMat);
        tuft.position.set(i * 0.03, 0.2, 0.04 - Math.abs(i) * 0.01);
        tuft.rotation.x = 0.3;
        parent.add(tuft);
      }
    } else if (style === 'tactical_undercut') {
      // Sweep-back tactical undercut
      const topVolume = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
      topVolume.position.set(0, 0.09, -0.03);
      topVolume.scale.set(1.02, 0.8, 1.15);
      parent.add(topVolume);

      // Swept front fringe
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), hairMat);
      fringe.position.set(0, 0.16, 0.06);
      fringe.rotation.x = -0.3;
      parent.add(fringe);
    } else if (style === 'infiltrator_ponytail') {
      // Female / Infiltrator Hair with high tactical ponytail
      const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
      baseHair.position.set(0, 0.05, -0.02);
      parent.add(baseHair);

      // High ponytail lock trailing back
      const ponytail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.32, 8), hairMat);
      ponytail.position.set(0, 0.1, -0.24);
      ponytail.rotation.x = -Math.PI / 3;
      parent.add(ponytail);
    } else if (style === 'spec_ops_braids') {
      // Braided locks
      for (let x = -0.12; x <= 0.12; x += 0.06) {
        const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.28, 6), hairMat);
        braid.position.set(x, 0.06, -0.12);
        braid.rotation.x = -0.4;
        parent.add(braid);
      }
    } else if (style === 'tactical_cap') {
      // Tactical Spec-Ops Ballcap
      const capMat = blackMat;
      const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.195, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
      capCrown.position.set(0, 0.07, -0.01);
      parent.add(capCrown);

      // Cap Visor / Brim
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.14), capMat);
      brim.position.set(0, 0.06, 0.18);
      brim.rotation.x = 0.12;
      parent.add(brim);
    } else {
      // Kevlar Ops Helmet with glowing Night Vision Goggles (NVG)
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65), armorMat);
      helmet.position.set(0, 0.06, -0.01);
      parent.add(helmet);

      // Dual Night Vision Tubes (glowing visor/NVG)
      const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.options.visorGlow || '#38bdf8') });
      [-0.06, 0.06].forEach((nx) => {
        const nvgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 10), blackMat);
        nvgTube.position.set(nx, 0.08, 0.22);
        nvgTube.rotation.x = Math.PI / 2;
        parent.add(nvgTube);

        // Glowing Lens
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), glowMat);
        lens.position.set(nx, 0.08, 0.285);
        parent.add(lens);
      });
    }
  }

  // Articulated Arms holding rifle with combat gloves
  private buildArms(
    leftArm: THREE.Group,
    rightArm: THREE.Group,
    uniformMat: THREE.Material,
    skinMat: THREE.Material,
    gloveMat: THREE.Material
  ) {
    // LEFT ARM (Support arm gripping handguard)
    leftArm.position.set(-0.32, 1.36, 0.02);

    const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), uniformMat);
    leftArm.add(leftShoulder);

    // Bicep (Rolled uniform sleeve)
    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.28, 10), uniformMat);
    leftUpperArm.position.set(-0.04, -0.14, 0.04);
    leftUpperArm.rotation.z = -0.2;
    leftArm.add(leftUpperArm);

    // Forearm (Skin / Tactical arm band)
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.26, 10), skinMat);
    leftForearm.position.set(0.04, -0.32, 0.22);
    leftForearm.rotation.x = -Math.PI / 3;
    leftForearm.rotation.y = 0.4;
    leftArm.add(leftForearm);

    // Tactical Combat Glove & 5-finger articulated grip
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.11), gloveMat);
    leftHand.position.set(0.12, -0.42, 0.38);
    leftArm.add(leftHand);

    // RIGHT ARM (Trigger arm)
    rightArm.position.set(0.32, 1.36, 0.02);

    const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), uniformMat);
    rightArm.add(rightShoulder);

    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.28, 10), uniformMat);
    rightUpperArm.position.set(0.04, -0.14, 0.04);
    rightUpperArm.rotation.z = 0.2;
    rightArm.add(rightUpperArm);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.26, 10), skinMat);
    rightForearm.position.set(-0.02, -0.32, 0.2);
    rightForearm.rotation.x = -Math.PI / 3.2;
    rightForearm.rotation.y = -0.3;
    rightArm.add(rightForearm);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.11), gloveMat);
    rightHand.position.set(-0.08, -0.42, 0.36);
    rightArm.add(rightHand);
  }

  // Realistic 3D Firearm mounted to operative hands
  private buildWeaponMesh(weapon: FpsWeapon, metalMat: THREE.Material, darkMat: THREE.Material) {
    this.weaponMeshGroup.position.set(0.08, 1.08, 0.42);

    // Weapon Receiver & Barrel
    const barrelLength = weapon.category === 'sniper' ? 0.95 : 0.68;
    const bodyMat = weapon.id.includes('blood') || weapon.id.includes('ak47')
      ? new THREE.MeshStandardMaterial({ color: 0xbe123c, metalness: 0.8, roughness: 0.2 })
      : metalMat;

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, barrelLength), bodyMat);
    receiver.castShadow = true;
    this.weaponMeshGroup.add(receiver);

    // Barrel Extension & Muzzle Brake
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, barrelLength / 2 + 0.16);
    this.weaponMeshGroup.add(barrel);

    // Curved Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), darkMat);
    mag.position.set(0, -0.15, 0.05);
    mag.rotation.x = 0.2;
    this.weaponMeshGroup.add(mag);

    // Tactical Holographic Optic Sight
    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.16), darkMat);
    optic.position.set(0, 0.09, -0.05);
    this.weaponMeshGroup.add(optic);

    const opticReticle = new THREE.Mesh(
      new THREE.CircleGeometry(0.02, 12),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    opticReticle.position.set(0, 0.09, -0.135);
    this.weaponMeshGroup.add(opticReticle);

    // Muzzle Flash Particle Mesh (Visible only when firing)
    const flashGeo = new THREE.ConeGeometry(0.09, 0.35, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.9
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.02, barrelLength / 2 + 0.42);
    this.muzzleFlashMesh.rotation.x = -Math.PI / 2;
    this.muzzleFlashMesh.visible = false;
    this.weaponMeshGroup.add(this.muzzleFlashMesh);
  }

  // Legs, Tactical Cargo Pants, Armor Knee Pads, and Heavy Combat Boots
  private buildLegs(
    leftLeg: THREE.Group,
    rightLeg: THREE.Group,
    uniformMat: THREE.Material,
    armorMat: THREE.Material,
    bootMat: THREE.Material
  ) {
    // LEFT LEG
    leftLeg.position.set(-0.16, 0.76, 0);

    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.38, 10), uniformMat);
    leftThigh.position.set(0, -0.18, 0.02);
    leftLeg.add(leftThigh);

    // Cargo Pocket
    const leftPocket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.12), uniformMat);
    leftPocket.position.set(-0.08, -0.18, 0.02);
    leftLeg.add(leftPocket);

    // Reinforced Knee Armor Plate
    const leftKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.08), armorMat);
    leftKneePad.position.set(0, -0.38, 0.07);
    leftLeg.add(leftKneePad);

    // Shin & Calf
    const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.34, 10), uniformMat);
    leftShin.position.set(0, -0.52, 0);
    leftLeg.add(leftShin);

    // High-Traction Combat Boot
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), bootMat);
    leftBoot.position.set(0, -0.7, 0.05);
    leftBoot.castShadow = true;
    leftLeg.add(leftBoot);

    // RIGHT LEG
    rightLeg.position.set(0.16, 0.76, 0);

    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.38, 10), uniformMat);
    rightThigh.position.set(0, -0.18, 0.02);
    rightLeg.add(rightThigh);

    // Sidearm Pistol Holster on Right Thigh
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.11), armorMat);
    holster.position.set(0.09, -0.18, 0.03);
    rightLeg.add(holster);

    const rightKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.08), armorMat);
    rightKneePad.position.set(0, -0.38, 0.07);
    rightLeg.add(rightKneePad);

    const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.34, 10), uniformMat);
    rightShin.position.set(0, -0.52, 0);
    rightLeg.add(rightShin);

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), bootMat);
    rightBoot.position.set(0, -0.7, 0.05);
    rightBoot.castShadow = true;
    rightLeg.add(rightBoot);
  }

  // Tactical Flight Jetpack with Dual Thrusters
  private buildJetpack(parent: THREE.Group, darkMat: THREE.Material, metalMat: THREE.Material) {
    parent.position.set(0, 1.18, -0.22);

    const jetpackBody = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.16), darkMat);
    parent.add(jetpackBody);

    // Dual Thruster Cylinders
    [-0.12, 0.12].forEach((tx) => {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.34, 10), metalMat);
      thruster.position.set(tx, -0.08, -0.04);
      parent.add(thruster);

      // Glowing Thruster Exhaust Cone
      const exhaust = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.12, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(this.options.visorGlow || '#38bdf8') })
      );
      exhaust.position.set(tx, -0.28, -0.04);
      exhaust.rotation.x = Math.PI;
      parent.add(exhaust);
    });
  }

  // Load a real 3D model (GLTF / GLB) directly from the web
  public async loadWeb3DModel(url: string) {
    if (gltfModelCache.has(url)) {
      const cached = gltfModelCache.get(url)!.clone();
      this.attachLoadedModel(cached);
      return;
    }

    try {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          gltfModelCache.set(url, model);
          this.attachLoadedModel(model.clone());
        },
        undefined,
        (err) => {
          console.warn(`Could not load web 3D model from ${url}, retaining high-detail anatomical human rig:`, err);
        }
      );
    } catch (e) {
      console.warn("Web GLTF loader execution note:", e);
    }
  }

  private attachLoadedModel(model: THREE.Group) {
    // Auto-normalize bounding box and scale to standard 1.8m operative height
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetHeight = 1.8;
    const scaleFactor = targetHeight / (size.y || 1);
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    model.position.set(0, 0, 0);

    // Hide procedural body meshes while keeping animation bones
    this.rootGroup.children.forEach(child => {
      if (child !== this.weaponMeshGroup) {
        child.visible = false;
      }
    });

    this.rootGroup.add(model);
  }

  // Real-Time Frame Animation Loop (Breathing, Aiming, Walking, Muzzle Recoil)
  public update(delta: number = 0.016, isMoving: boolean = false, isShooting: boolean = false) {
    const elapsed = this.clock.getElapsedTime();

    // 1. Natural Human Idle Breathing
    const breath = Math.sin(elapsed * 2.8) * 0.015;
    this.headGroup.position.y = 1.62 + breath * 0.5;
    this.headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.04;
    this.weaponMeshGroup.position.y = 1.08 + breath;

    // 2. Walking / Sprinting Leg & Arm Swing
    if (isMoving) {
      const walkSpeed = elapsed * 10;
      this.leftLegGroup.rotation.x = Math.sin(walkSpeed) * 0.65;
      this.rightLegGroup.rotation.x = -Math.sin(walkSpeed) * 0.65;

      // Arms counter-swing
      this.leftArmGroup.rotation.x = Math.sin(walkSpeed) * 0.35;
      this.rightArmGroup.rotation.x = -Math.sin(walkSpeed) * 0.25;

      // Hip sway
      this.rootGroup.position.y = Math.abs(Math.sin(walkSpeed * 2)) * 0.04;
    } else {
      // Return legs to stable stance
      this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0, 0.1);
      this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0, 0.1);
      this.rootGroup.position.y = THREE.MathUtils.lerp(this.rootGroup.position.y, 0, 0.1);
    }

    // 3. Firing Recoil & Muzzle Flash
    if (isShooting) {
      this.fireTimer += delta;
      const kick = Math.sin(this.fireTimer * 40) * 0.05;
      this.weaponMeshGroup.position.z = 0.42 - Math.abs(kick);
      this.weaponMeshGroup.rotation.x = kick * 0.6;
      if (this.muzzleFlashMesh) {
        this.muzzleFlashMesh.visible = Math.random() > 0.4;
        this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
      }
    } else {
      this.fireTimer = 0;
      this.weaponMeshGroup.position.z = THREE.MathUtils.lerp(this.weaponMeshGroup.position.z, 0.42, 0.2);
      this.weaponMeshGroup.rotation.x = THREE.MathUtils.lerp(this.weaponMeshGroup.rotation.x, 0, 0.2);
      if (this.muzzleFlashMesh) {
        this.muzzleFlashMesh.visible = false;
      }
    }
  }

  // Trigger expressive emotes (Inspect Weapon, Wave, Combat Ready)
  public triggerEmote(emote: 'wave' | 'inspect' | 'ready', onComplete?: () => void) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        clearInterval(interval);
        this.leftArmGroup.rotation.set(0, 0, 0);
        this.rightArmGroup.rotation.set(0, 0, 0);
        onComplete?.();
        return;
      }

      if (emote === 'wave') {
        this.leftArmGroup.rotation.z = Math.PI / 2 + Math.sin(progress * Math.PI * 6) * 0.3;
        this.leftArmGroup.rotation.x = -Math.PI / 4;
      } else if (emote === 'inspect') {
        this.weaponMeshGroup.rotation.y = Math.sin(progress * Math.PI) * 0.8;
        this.weaponMeshGroup.rotation.z = Math.sin(progress * Math.PI) * 0.4;
      } else if (emote === 'ready') {
        this.headGroup.rotation.y = Math.sin(progress * Math.PI * 2) * 0.3;
      }
    }, 30);
  }
}
