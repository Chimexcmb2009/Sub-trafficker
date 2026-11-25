import * as THREE from 'three';
import { FpsWeapon, FpsMelee } from '../../types';

// First-Person Viewmodel Rig: Realistic Tactical Arms & Hands holding Weapons/Knives
export class FpsViewmodel3D {
  public root: THREE.Group;
  public armLeft: THREE.Group;
  public armRight: THREE.Group;
  public handLeft: THREE.Group;
  public handRight: THREE.Group;
  public weaponRoot: THREE.Group;
  public knifeRoot: THREE.Group;
  public muzzleFlash: THREE.Mesh;
  public gunMesh?: THREE.Group;
  public knifeMesh?: THREE.Group;

  private currentWeaponId: string = 'm4a1_cyber';
  private swayOffset = new THREE.Vector3();
  private basePosition = new THREE.Vector3(0.18, -0.22, -0.42);
  private adsPosition = new THREE.Vector3(0.0, -0.155, -0.32);

  constructor() {
    this.root = new THREE.Group();
    this.root.position.copy(this.basePosition);

    // Realistic Tactical Glove & Sleeve Materials
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Tactical Navy / Camo
      roughness: 0.8,
      metalness: 0.1
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd49b73,
      roughness: 0.65,
      metalness: 0.05
    });

    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // Carbon Fiber Tactical Glove
      roughness: 0.5,
      metalness: 0.35
    });

    const knuckleMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.3,
      metalness: 0.7
    });

    // 1. LEFT ARM & HAND (Supporting Foregrip)
    this.armLeft = new THREE.Group();
    this.armLeft.position.set(-0.28, -0.12, 0.15);
    this.armLeft.rotation.set(0.3, 0.4, -0.2);
    this.root.add(this.armLeft);

    // Left Forearm Sleeve
    const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.32, 12), sleeveMat);
    forearmL.position.set(0, -0.12, -0.1);
    forearmL.rotation.x = Math.PI / 3;
    this.armLeft.add(forearmL);

    // Left Glove & Palm
    this.handLeft = new THREE.Group();
    this.handLeft.position.set(0.08, -0.02, -0.25);
    this.handLeft.rotation.set(-0.2, 0.6, 0.4);
    this.armLeft.add(this.handLeft);

    const palmL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.08), gloveMat);
    this.handLeft.add(palmL);

    // Left Fingers wrapping foregrip
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 6), gloveMat);
      finger.position.set(-0.025 + f * 0.016, 0.02, -0.035);
      finger.rotation.x = Math.PI / 2.2;
      this.handLeft.add(finger);
    }
    // Thumb
    const thumbL = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 6), gloveMat);
    thumbL.position.set(-0.04, 0.01, 0.01);
    thumbL.rotation.set(0.2, 0.5, -0.4);
    this.handLeft.add(thumbL);

    // 2. RIGHT ARM & HAND (Main Trigger Grip)
    this.armRight = new THREE.Group();
    this.armRight.position.set(0.2, -0.14, 0.2);
    this.armRight.rotation.set(0.2, -0.15, 0.1);
    this.root.add(this.armRight);

    // Right Forearm Sleeve
    const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.34, 12), sleeveMat);
    forearmR.position.set(0, -0.14, -0.1);
    forearmR.rotation.x = Math.PI / 3.2;
    this.armRight.add(forearmR);

    // Tactical Watch on Right Wrist
    const watchBand = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.03, 12), knuckleMat);
    watchBand.position.set(0, -0.06, -0.05);
    watchBand.rotation.x = Math.PI / 3.2;
    this.armRight.add(watchBand);

    const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.035), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
    watchFace.position.set(0, -0.04, -0.03);
    this.armRight.add(watchFace);

    // Right Glove & Palm
    this.handRight = new THREE.Group();
    this.handRight.position.set(-0.06, 0.02, -0.28);
    this.handRight.rotation.set(0.1, -0.2, -0.1);
    this.armRight.add(this.handRight);

    const palmR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.08), gloveMat);
    this.handRight.add(palmR);

    // Carbon Knuckle Protector
    const knuckleR = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.015, 0.03), knuckleMat);
    knuckleR.position.set(0, 0.022, 0.01);
    this.handRight.add(knuckleR);

    // Trigger Finger
    const triggerFinger = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 6), gloveMat);
    triggerFinger.position.set(-0.025, 0.01, -0.045);
    triggerFinger.rotation.x = Math.PI / 3;
    this.handRight.add(triggerFinger);

    // Grip Fingers
    for (let f = 1; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.042, 6), gloveMat);
      finger.position.set(-0.025 + f * 0.016, -0.015, -0.035);
      finger.rotation.x = Math.PI / 1.8;
      this.handRight.add(finger);
    }

    // 3. WEAPON & KNIFE GROUPS
    this.weaponRoot = new THREE.Group();
    this.weaponRoot.position.set(0, 0, -0.12);
    this.root.add(this.weaponRoot);

    this.knifeRoot = new THREE.Group();
    this.knifeRoot.position.set(0.05, -0.08, -0.2);
    this.knifeRoot.visible = false;
    this.root.add(this.knifeRoot);

    // Muzzle Flash
    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0 })
    );
    this.muzzleFlash.position.set(0, 0.04, -0.65);
    this.weaponRoot.add(this.muzzleFlash);

    this.buildFirearmModel('m4a1_cyber');
    this.buildTacticalKnife();
  }

  public setWeapon(weaponId: string) {
    this.currentWeaponId = weaponId;
    this.buildFirearmModel(weaponId);
  }

  public setMeleeActive(active: boolean) {
    this.weaponRoot.visible = !active;
    this.knifeRoot.visible = active;
    this.armLeft.visible = !active;
  }

  // Assemble Detailed 3D Firearm Viewmodel
  private buildFirearmModel(weaponId: string) {
    if (this.gunMesh) {
      this.weaponRoot.remove(this.gunMesh);
    }

    const group = new THREE.Group();
    this.gunMesh = group;

    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.4 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.2 });
    const opticLensMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    if (weaponId.includes('sniper') || weaponId.includes('awm')) {
      // Sniper Rifle
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.55), gunMat);
      group.add(body);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.52, 10), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.45);
      group.add(barrel);

      const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.08), barrelMat);
      muzzleBrake.position.set(0, 0.02, -0.72);
      group.add(muzzleBrake);

      // High-Powered Scope
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 12), gunMat);
      scopeBody.rotation.x = Math.PI / 2;
      scopeBody.position.set(0, 0.075, -0.05);
      group.add(scopeBody);

      const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), opticLensMat);
      scopeLens.position.set(0, 0.075, 0.062);
      group.add(scopeLens);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.26), accentMat);
      stock.position.set(0, -0.02, 0.24);
      group.add(stock);

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.09), barrelMat);
      mag.position.set(0, -0.1, -0.05);
      mag.rotation.x = 0.2;
      group.add(mag);

      this.muzzleFlash.position.set(0, 0.02, -0.78);
    } else if (weaponId.includes('ak47') || weaponId.includes('kall')) {
      // AK-47 Assault Rifle
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, metalness: 0.1 });
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.085, 0.42), gunMat);
      group.add(receiver);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.38, 10), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025, -0.36);
      group.add(barrel);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.18), woodMat);
      handguard.position.set(0, 0.02, -0.24);
      group.add(handguard);

      const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.18, 0.09), barrelMat);
      curvedMag.position.set(0, -0.1, -0.08);
      curvedMag.rotation.x = 0.35;
      group.add(curvedMag);

      const woodStock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.1, 0.22), woodMat);
      woodStock.position.set(0, -0.02, 0.2);
      group.add(woodStock);

      this.muzzleFlash.position.set(0, 0.025, -0.58);
    } else {
      // M4A1 Cyber Tactical Assault Rifle
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.085, 0.38), gunMat);
      group.add(receiver);

      // Picatinny Rail System
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.32), barrelMat);
      topRail.position.set(0, 0.05, -0.04);
      group.add(topRail);

      // Holographic Red Dot Sight
      const holoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.042, 0.06), barrelMat);
      holoFrame.position.set(0, 0.075, -0.06);
      group.add(holoFrame);

      const redDot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), opticLensMat);
      redDot.position.set(0, 0.075, -0.03);
      group.add(redDot);

      // Fluted Tactical Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.32, 10), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.32);
      group.add(barrel);

      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), barrelMat);
      suppressor.rotation.x = Math.PI / 2;
      suppressor.position.set(0, 0.02, -0.48);
      group.add(suppressor);

      // Tactical Magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.08), accentMat);
      mag.position.set(0, -0.1, -0.06);
      mag.rotation.x = 0.2;
      group.add(mag);

      // Retractable Stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.18), gunMat);
      stock.position.set(0, -0.01, 0.18);
      group.add(stock);

      this.muzzleFlash.position.set(0, 0.02, -0.56);
    }

    this.weaponRoot.add(group);
  }

  // Assemble High-Detail Tactical Combat Knife
  private buildTacticalKnife() {
    const knifeGroup = new THREE.Group();
    this.knifeMesh = knifeGroup;

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.3 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Ergonomic Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.14, 8), handleMat);
    handle.rotation.x = Math.PI / 2;
    knifeGroup.add(handle);

    // Crossguard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), bladeMat);
    guard.position.set(0, 0, -0.08);
    knifeGroup.add(guard);

    // Tanto Steel Blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.042, 0.22), bladeMat);
    blade.position.set(0, 0.015, -0.19);
    knifeGroup.add(blade);

    // Glowing Cyber Edge Line
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.006, 0.2), edgeMat);
    edge.position.set(0, -0.005, -0.19);
    knifeGroup.add(edge);

    this.knifeRoot.add(knifeGroup);
  }

  // Real-Time Procedural Animation Loop: Sway, ADS, Recoil & Slash
  public update(delta: number, state: {
    isMoving: boolean;
    isSprinting: boolean;
    isAiming: boolean;
    isFiring: boolean;
    isReloading: boolean;
    isMelee: boolean;
    recoil: number;
    mouseDeltaX: number;
    mouseDeltaY: number;
    time: number;
  }) {
    // 1. Mouse Sway & Inertia
    const targetSwayX = -state.mouseDeltaX * 0.0004;
    const targetSwayY = state.mouseDeltaY * 0.0004;
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, targetSwayX, delta * 12);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, targetSwayY, delta * 12);

    // 2. Weapon Bobbing (Walking / Sprinting)
    let bobX = 0;
    let bobY = 0;
    if (state.isMoving && !state.isAiming) {
      const freq = state.isSprinting ? 14 : 9;
      const amp = state.isSprinting ? 0.022 : 0.012;
      bobX = Math.cos(state.time * freq * 0.5) * amp * 0.8;
      bobY = Math.abs(Math.sin(state.time * freq)) * amp;
    }

    // 3. Aim Down Sights (ADS) Interpolation
    const targetPos = state.isAiming ? this.adsPosition : this.basePosition;
    this.root.position.x = THREE.MathUtils.lerp(this.root.position.x, targetPos.x + this.swayOffset.x + bobX, delta * 14);
    this.root.position.y = THREE.MathUtils.lerp(this.root.position.y, targetPos.y + this.swayOffset.y + bobY, delta * 14);
    this.root.position.z = THREE.MathUtils.lerp(this.root.position.z, targetPos.z, delta * 14);

    // 4. Fire Recoil Kick
    if (state.recoil > 0.01) {
      this.root.position.z += state.recoil * 0.04;
      this.root.rotation.x = -state.recoil * 0.12;
      this.root.position.y += state.recoil * 0.015;
      (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = Math.min(1, state.recoil * 2);
    } else {
      this.root.rotation.x = THREE.MathUtils.lerp(this.root.rotation.x, 0, delta * 10);
      (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // 5. Knife Slash Animation
    if (state.isMelee) {
      const slashProgress = Math.sin(state.time * 20);
      this.knifeRoot.rotation.z = slashProgress * 1.2;
      this.knifeRoot.position.x = 0.05 - slashProgress * 0.15;
    } else {
      this.knifeRoot.rotation.z = 0;
      this.knifeRoot.position.x = 0.05;
    }
  }
}
