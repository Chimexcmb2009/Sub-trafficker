import * as THREE from 'three';

export class TextureFactory {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  static getTerrainTexture(biome: 'grass' | 'sand' | 'snow' | 'rock' | 'concrete'): THREE.CanvasTexture {
    const key = `terrain_${biome}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const baseColors: Record<string, [string, string, string]> = {
      grass: ['#2f5a29', '#3b6e33', '#23451e'],
      sand: ['#b99b66', '#cab07b', '#9f834f'],
      snow: ['#dde5ee', '#edf2f7', '#c5d1df'],
      rock: ['#475569', '#5a6a80', '#334155'],
      concrete: ['#586475', '#687689', '#475569'],
    };

    const [bg, hi, lo] = baseColors[biome] || baseColors.grass;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Deterministic fast grit pattern (4500 strokes instead of 40000 slow fillRects)
    for (let i = 0; i < 4500; i++) {
      const x = ((i * 73) % size);
      const y = ((i * 139 + Math.floor(i / 4)) % size);
      ctx.fillStyle = i % 2 === 0 ? hi : lo;
      ctx.fillRect(x, y, 2, 2);
    }

    if (biome === 'concrete') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 128, 128);
      ctx.strokeRect(128, 0, 128, 128);
      ctx.strokeRect(0, 128, 128, 128);
      ctx.strokeRect(128, 128, 128, 128);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    this.cache.set(key, tex);
    return tex;
  }

  static getMetalTexture(color = '#1e293b'): THREE.CanvasTexture {
    const key = `metal_${color}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);

    for (let x = 0; x < 128; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, 0, 4, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 6, 0, 6, 128);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }

  static getBrickTexture(): THREE.CanvasTexture {
    const key = 'brick';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 128, 128);

    for (let y = 2; y < 128; y += 16) {
      const offset = ((y / 16) % 2) * 16;
      for (let x = -16 + offset; x < 128; x += 32) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#9f1239' : '#881337';
        ctx.fillRect(x, y, 28, 12);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache.set(key, tex);
    return tex;
  }

  static getWoodTexture(): THREE.CanvasTexture {
    const key = 'wood';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 128, 128);

    for (let y = 0; y < 128; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#92400e' : '#b45309';
      ctx.fillRect(0, y + 2, 128, 28);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }

  static getCautionTexture(): THREE.CanvasTexture {
    const key = 'caution';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#0f172a';
    for (let x = -64; x < 128; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x + 76, 64);
      ctx.lineTo(x + 64, 64);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }
}

export interface ObstacleCollider {
  box: THREE.Box3;
  type: 'building' | 'wall' | 'crate' | 'barrel' | 'vehicle' | 'tree';
  mesh: THREE.Object3D;
  health?: number;
  isExplosive?: boolean;
}

export class Real3dEnvironmentBuilder {
  colliders: ObstacleCollider[] = [];
  explosiveBarrels: { mesh: THREE.Mesh; pos: THREE.Vector3; health: number; destroyed: boolean }[] = [];

  // Shared materials to reduce WebGL shader program switches
  private concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 });
  private darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.42 });
  private wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
  private glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.6,
  });
  private barrelMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42, metalness: 0.48 });

  buildTerrain(scene: THREE.Scene, biome: 'grass' | 'sand' | 'snow' | 'rock' | 'concrete' = 'grass'): THREE.Mesh {
    const size = 320;
    const segments = 48; // Reduced vertex count with smooth hills for high FPS
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z);
      let y = 0;
      if (dist > 45) {
        y += Math.sin(x * 0.04) * Math.cos(z * 0.04) * 4.5 + Math.sin(x * 0.08) * 1.2;
      }
      if (dist > 110) {
        y += (dist - 110) * 0.25;
      }
      pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    const terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: TextureFactory.getTerrainTexture(biome),
        roughness: 0.88,
        metalness: 0.08,
      })
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    this.createRoads(scene);
    this.createWaterPerimeter(scene, size);
    return terrain;
  }

  private createRoads(scene: THREE.Scene) {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9, metalness: 0.08 });

    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(12, 220), roadMat);
    roadNS.rotateX(-Math.PI / 2);
    roadNS.position.set(0, 0.05, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(220, 12), roadMat);
    roadEW.rotateX(-Math.PI / 2);
    roadEW.position.set(0, 0.06, 0);
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // Single InstancedMesh for all road stripes (1 draw call)
    const stripeGeo = new THREE.PlaneGeometry(0.4, 6);
    stripeGeo.rotateX(-Math.PI / 2);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const count = 17;
    const instancedStripes = new THREE.InstancedMesh(stripeGeo, stripeMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0.07, -96 + i * 12);
      dummy.updateMatrix();
      instancedStripes.setMatrixAt(i, dummy.matrix);
    }
    instancedStripes.instanceMatrix.needsUpdate = true;
    scene.add(instancedStripes);
  }

  private createWaterPerimeter(scene: THREE.Scene, size: number) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.4, size * 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.15,
        metalness: 0.75,
        transparent: true,
        opacity: 0.78,
      })
    );
    water.rotateX(-Math.PI / 2);
    water.position.set(0, -1.2, 0);
    scene.add(water);
  }

  createWarehouse(scene: THREE.Scene, x: number, z: number, rotation = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const wallMat = new THREE.MeshStandardMaterial({ map: TextureFactory.getMetalTexture('#334155'), roughness: 0.7 });
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 16), wallMat);
    mainBody.position.y = 4.5;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    group.add(mainBody);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(17, 3.5, 4), this.darkMetalMat);
    roof.position.y = 10.7;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.1, 1, 0.75);
    group.add(roof);

    const garageDoor = new THREE.Mesh(
      new THREE.BoxGeometry(8, 6, 0.4),
      new THREE.MeshStandardMaterial({ map: TextureFactory.getMetalTexture('#0f172a') })
    );
    garageDoor.position.set(0, 3, 8.1);
    group.add(garageDoor);

    const hazard = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.6, 0.5),
      new THREE.MeshBasicMaterial({ map: TextureFactory.getCautionTexture() })
    );
    hazard.position.set(0, 6.3, 8.1);
    group.add(hazard);

    const base = new THREE.Mesh(new THREE.BoxGeometry(25, 0.6, 17), this.concreteMat);
    base.position.y = 0.3;
    group.add(base);

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'building', mesh: group });
    scene.add(group);
    return group;
  }

  createOfficeBuilding(scene: THREE.Scene, x: number, z: number, heightLevels = 3): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const width = 18;
    const depth = 18;
    const levelHeight = 5;
    const totalHeight = heightLevels * levelHeight;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(width, totalHeight, depth), this.concreteMat);
    frame.position.y = totalHeight / 2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    for (let lvl = 0; lvl < heightLevels; lvl++) {
      const yLvl = (lvl + 0.5) * levelHeight;
      const glassFront = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 2.5, 0.2), this.glassMat);
      glassFront.position.set(0, yLvl, depth / 2 + 0.1);
      group.add(glassFront);

      const glassBack = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 2.5, 0.2), this.glassMat);
      glassBack.position.set(0, yLvl, -depth / 2 - 0.1);
      group.add(glassBack);
    }

    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 1.2, depth + 0.4), this.concreteMat);
    parapet.position.y = totalHeight + 0.6;
    group.add(parapet);

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'building', mesh: group });
    scene.add(group);
    return group;
  }

  createFactory(scene: THREE.Scene, x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const brickMat = new THREE.MeshStandardMaterial({ map: TextureFactory.getBrickTexture(), roughness: 0.9 });
    const hall = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 20), brickMat);
    hall.position.y = 5;
    hall.castShadow = true;
    group.add(hall);

    for (let i = -1; i <= 1; i += 2) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 22, 10), brickMat);
      stack.position.set(i * 6, 11, -8);
      group.add(stack);
    }

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'building', mesh: group });
    scene.add(group);
    return group;
  }

  createHangar(scene: THREE.Scene, x: number, z: number, rotation = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const hangarMat = new THREE.MeshStandardMaterial({ map: TextureFactory.getMetalTexture('#1e293b'), roughness: 0.6 });
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 30, 16, 1, false, 0, Math.PI), hangarMat);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.scale.set(1, 0.8, 1);
    group.add(arch);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(32, 0.4, 34), this.concreteMat);
    apron.position.y = 0.2;
    group.add(apron);

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'building', mesh: group });
    scene.add(group);
    return group;
  }

  createWatchtower(scene: THREE.Scene, x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const woodMat = new THREE.MeshStandardMaterial({ map: TextureFactory.getWoodTexture(), roughness: 0.9 });
    const towerHeight = 12;

    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, towerHeight, 8), this.darkMetalMat);
        stilt.position.set(sx * 2.5, towerHeight / 2, sz * 2.5);
        group.add(stilt);
      }
    }

    const platform = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 6.5), woodMat);
    platform.position.y = towerHeight;
    group.add(platform);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2, 4), this.darkMetalMat);
    roof.position.y = towerHeight + 3.2;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Emissive beacon instead of expensive dynamic SpotLight
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    beacon.position.set(0, towerHeight - 0.5, 2.8);
    group.add(beacon);

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'building', mesh: group });
    scene.add(group);
    return group;
  }

  createMilitaryTruck(scene: THREE.Scene, x: number, z: number, rotation = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f4f38, roughness: 0.7 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 3.2), bodyMat);
    hood.position.set(0, 1.6, 2.8);
    group.add(hood);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 2.4), bodyMat);
    cab.position.set(0, 2.0, 0.4);
    group.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.1), this.glassMat);
    windshield.position.set(0, 2.4, 1.65);
    group.add(windshield);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 5.5), bodyMat);
    bed.position.set(0, 1.8, -3.2);
    group.add(bed);

    const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.6, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    [
      [-1.5, 0.7, 2.6],
      [1.5, 0.7, 2.6],
      [-1.5, 0.7, -2.0],
      [1.5, 0.7, -2.0],
      [-1.5, 0.7, -4.2],
      [1.5, 0.7, -4.2],
    ].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, this.wheelMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    });

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'vehicle', mesh: group });
    scene.add(group);
    return group;
  }

  createCombatJeep(scene: THREE.Scene, x: number, z: number, rotation = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4.2), armorMat);
    body.position.set(0, 1.2, 0);
    group.add(body);

    const cage = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.4), this.darkMetalMat);
    cage.position.set(0, 2.2, -0.4);
    group.add(cage);

    const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.5, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    [
      [-1.3, 0.65, 1.4],
      [1.3, 0.65, 1.4],
      [-1.3, 0.65, -1.4],
      [1.3, 0.65, -1.4],
    ].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, this.wheelMat);
      w.position.set(wx, wy, wz);
      group.add(w);
    });

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'vehicle', mesh: group });
    scene.add(group);
    return group;
  }

  createHelicopter(scene: THREE.Scene, x: number, z: number): { group: THREE.Group; updateRotors: (delta: number) => void } {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.4, 20), this.concreteMat);
    helipad.position.y = 0.2;
    group.add(helipad);

    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(1.8, 7.5, 12), this.darkMetalMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 2.2, 0);
    group.add(fuselage);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), this.glassMat);
    cockpit.position.set(0, 2.4, 2.2);
    cockpit.scale.set(0.9, 0.8, 1.4);
    group.add(cockpit);

    const rotorHub = new THREE.Group();
    rotorHub.position.set(0, 4.0, 0.5);
    const bladeGeo = new THREE.BoxGeometry(0.3, 0.05, 12);
    const blade1 = new THREE.Mesh(bladeGeo, this.wheelMat);
    const blade2 = new THREE.Mesh(bladeGeo, this.wheelMat);
    blade2.rotation.y = Math.PI / 2;
    rotorHub.add(blade1, blade2);
    group.add(rotorHub);

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'vehicle', mesh: group });
    scene.add(group);

    return {
      group,
      updateRotors: (delta: number) => {
        rotorHub.rotation.y += delta * 18;
      },
    };
  }

  createExplosiveBarrel(scene: THREE.Scene, x: number, z: number): THREE.Mesh {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 12), this.barrelMat);
    barrel.position.set(x, 0.7, z);
    scene.add(barrel);

    this.explosiveBarrels.push({
      mesh: barrel,
      pos: new THREE.Vector3(x, 0.7, z),
      health: 30,
      destroyed: false,
    });
    this.colliders.push({ box: new THREE.Box3().setFromObject(barrel), type: 'barrel', mesh: barrel, health: 30, isExplosive: true });
    return barrel;
  }

  createShippingContainer(scene: THREE.Scene, x: number, z: number, color = '#1d4ed8', rotation = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const mat = new THREE.MeshStandardMaterial({ map: TextureFactory.getMetalTexture(color), roughness: 0.5 });
    const container = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), mat);
    container.position.y = 1.3;
    group.add(container);

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'crate', mesh: group });
    scene.add(group);
    return group;
  }

  createWoodenCrate(scene: THREE.Scene, x: number, z: number, y = 0): THREE.Mesh {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ map: TextureFactory.getWoodTexture(), roughness: 0.9 })
    );
    crate.position.set(x, y + 0.7, z);
    scene.add(crate);

    this.colliders.push({ box: new THREE.Box3().setFromObject(crate), type: 'crate', mesh: crate });
    return crate;
  }

  createSandbagBunker(scene: THREE.Scene, x: number, z: number, rotation = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 });

    for (let row = 0; row < 3; row++) {
      const y = (row + 0.5) * 0.45;
      const bagFront = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 0.7), sandMat);
      bagFront.position.set(0, y, 1.5);
      group.add(bagFront);
    }

    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'wall', mesh: group });
    scene.add(group);
    return group;
  }

  assembleFullBattlefield(scene: THREE.Scene, biome: 'grass' | 'sand' | 'snow' | 'rock' | 'concrete' = 'grass') {
    this.buildTerrain(scene, biome);

    this.createWarehouse(scene, 35, 40, 0);
    this.createWarehouse(scene, 65, 45, Math.PI / 2);
    this.createShippingContainer(scene, 25, 25, '#1d4ed8', 0.2);
    this.createShippingContainer(scene, 25, 28, '#b91c1c', 0.2);
    this.createWoodenCrate(scene, 28, 32);
    this.createWoodenCrate(scene, 29, 32);

    this.createOfficeBuilding(scene, -30, 45, 4);
    this.createOfficeBuilding(scene, -60, 40, 3);
    this.createSandbagBunker(scene, -20, 25, 0);

    this.createFactory(scene, 50, -45);
    this.createShippingContainer(scene, 35, -30, '#b91c1c', Math.PI / 4);

    this.createHangar(scene, -45, -50, 0);
    const chopperInstance = this.createHelicopter(scene, -20, -45);

    this.createWatchtower(scene, 75, 75);
    this.createWatchtower(scene, -75, 75);
    this.createWatchtower(scene, 75, -75);
    this.createWatchtower(scene, -75, -75);

    this.createMilitaryTruck(scene, 6, 20, Math.PI / 6);
    this.createCombatJeep(scene, -15, 12, -Math.PI / 4);

    this.createExplosiveBarrel(scene, 18, 22);
    this.createExplosiveBarrel(scene, -25, 20);
    this.createExplosiveBarrel(scene, 42, -28);

    return {
      chopperInstance,
      colliders: this.colliders,
      explosiveBarrels: this.explosiveBarrels,
    };
  }
}
