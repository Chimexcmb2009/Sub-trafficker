import * as THREE from 'three';

// Procedural Canvas Texture Synthesizers for PBR Realism
export class TextureFactory {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  // 1. Terrain Ground (Grass, Sand, Snow, Dirt, Rock)
  static getTerrainTexture(biome: 'grass' | 'sand' | 'snow' | 'rock' | 'concrete'): THREE.CanvasTexture {
    const key = `terrain_${biome}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    if (biome === 'grass') {
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 40000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = Math.random() > 0.5 ? '#3b7a33' : '#1e3f19';
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, 2, 3);
      }
    } else if (biome === 'sand') {
      ctx.fillStyle = '#c2a66e';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 30000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? '#d8be85' : '#a88f58';
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (biome === 'snow') {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 20000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? '#f8fafc' : '#cbd5e1';
        ctx.fillRect(x, y, 3, 3);
      }
    } else if (biome === 'rock') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 35000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? '#64748b' : '#334155';
        ctx.fillRect(x, y, 3, 2);
      }
    } else {
      // Concrete
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 256, 256);
      ctx.strokeRect(256, 0, 256, 256);
      ctx.strokeRect(0, 256, 256, 256);
      ctx.strokeRect(256, 256, 256, 256);
      for (let i = 0; i < 20000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#94a3b8' : '#475569';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    this.cache.set(key, tex);
    return tex;
  }

  // 2. Corrugated Metal (Warehouse & Shipping Containers)
  static getMetalTexture(color: string = '#1e293b'): THREE.CanvasTexture {
    const key = `metal_${color}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    // Corrugated vertical ridges
    for (let x = 0; x < 256; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.15)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 256);
    }

    // Rivets and rust spots
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.4)';
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }

  // 3. Red Brick Wall (Factory / Apartment)
  static getBrickTexture(): THREE.CanvasTexture {
    const key = 'brick';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#475569'; // Mortar
    ctx.fillRect(0, 0, 256, 256);

    const brickH = 16;
    const brickW = 32;

    for (let y = 2; y < 256; y += brickH + 2) {
      const row = Math.floor(y / (brickH + 2));
      const offset = (row % 2) * (brickW / 2);
      for (let x = -brickW + offset; x < 256; x += brickW + 2) {
        ctx.fillStyle = Math.random() > 0.3 ? '#881337' : '#9f1239';
        ctx.fillRect(x, y, brickW, brickH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache.set(key, tex);
    return tex;
  }

  // 4. Wood Plank (Crates & Barricades)
  static getWoodTexture(): THREE.CanvasTexture {
    const key = 'wood';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 256, 256);

    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#92400e' : '#b45309';
      ctx.fillRect(0, y + 2, 256, 28);
      ctx.strokeStyle = '#451a03';
      ctx.strokeRect(0, y, 256, 32);
    }

    // Wood Grain lines
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = 'rgba(69, 26, 3, 0.15)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 60, 1.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }

  // 5. Caution Hazard Stripes
  static getCautionTexture(): THREE.CanvasTexture {
    const key = 'caution';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#eab308'; // Yellow
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = '#0f172a'; // Black
    for (let x = -128; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 16 + 128, 128);
      ctx.lineTo(x + 128, 128);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
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
  lightPoles: THREE.Group[] = [];

  // =========================================================================
  // 1. Procedural 3D Battlefield Terrain (Ground + Water + Roads)
  // =========================================================================
  buildTerrain(scene: THREE.Scene, biome: 'grass' | 'sand' | 'snow' | 'rock' | 'concrete' = 'grass'): THREE.Mesh {
    const size = 320;
    const segments = 64;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Create sniper hills on perimeter, flat combat area in center
      const distFromCenter = Math.sqrt(x * x + z * z);
      let y = 0;

      if (distFromCenter > 40) {
        y += Math.sin(x * 0.04) * Math.cos(z * 0.04) * 5.0;
        y += Math.sin(x * 0.08) * 1.5;
      }
      if (distFromCenter > 110) {
        // High perimeter mountain ridges
        y += (distFromCenter - 110) * 0.25;
      }

      pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    const terrainTexture = TextureFactory.getTerrainTexture(biome);
    const material = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.85,
      metalness: 0.1
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Cross-Battlefield Paved Military Roads
    this.createRoads(scene, size);

    // Surrounding Tactical Ocean / Water at outer perimeter
    this.createWaterPerimeter(scene, size);

    return terrain;
  }

  private createRoads(scene: THREE.Scene, size: number) {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.9,
      metalness: 0.1
    });

    // Main North-South Highway
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(12, 220), roadMat);
    roadNS.rotateX(-Math.PI / 2);
    roadNS.position.set(0, 0.05, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    // East-West Cross Road
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(220, 12), roadMat);
    roadEW.rotateX(-Math.PI / 2);
    roadEW.position.set(0, 0.06, 0);
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // Road Stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let z = -100; z < 100; z += 12) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 6), stripeMat);
      stripe.rotateX(-Math.PI / 2);
      stripe.position.set(0, 0.07, z);
      scene.add(stripe);
    }
  }

  private createWaterPerimeter(scene: THREE.Scene, size: number) {
    const waterGeo = new THREE.PlaneGeometry(size * 1.5, size * 1.5);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.75
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotateX(-Math.PI / 2);
    water.position.set(0, -1.2, 0);
    scene.add(water);
  }

  // =========================================================================
  // 2. 3D Buildings from Asset Sheet (Warehouse, Office, Factory, Hangar, etc.)
  // =========================================================================

  // A. Heavy Industrial Warehouse
  createWarehouse(scene: THREE.Scene, x: number, z: number, rotation: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const metalTex = TextureFactory.getMetalTexture('#334155');
    const wallMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.7 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const cautionTex = TextureFactory.getCautionTexture();
    const cautionMat = new THREE.MeshBasicMaterial({ map: cautionTex });

    // Warehouse Main Body (24m x 16m x 10m high)
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 16), wallMat);
    mainBody.position.y = 4.5;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    group.add(mainBody);

    // Arched / Gable Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(17, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    roof.position.y = 10.7;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.1, 1, 0.75);
    roof.castShadow = true;
    group.add(roof);

    // Roll-up Cargo Garage Door
    const garageDoor = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.4), new THREE.MeshStandardMaterial({ map: TextureFactory.getMetalTexture('#0f172a') }));
    garageDoor.position.set(0, 3, 8.1);
    group.add(garageDoor);

    // Yellow Hazard Stripe above Door
    const hazard = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.6, 0.5), cautionMat);
    hazard.position.set(0, 6.3, 8.1);
    group.add(hazard);

    // Concrete Base Foundation
    const base = new THREE.Mesh(new THREE.BoxGeometry(25, 0.6, 17), concreteMat);
    base.position.y = 0.3;
    group.add(base);

    // Register Collider
    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'building', mesh: group });

    scene.add(group);
    return group;
  }

  // B. Multistory Office Building
  createOfficeBuilding(scene: THREE.Scene, x: number, z: number, heightLevels: number = 3): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.6 });

    const width = 18;
    const depth = 18;
    const levelHeight = 5;
    const totalHeight = heightLevels * levelHeight;

    // Concrete Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width, totalHeight, depth), concreteMat);
    frame.position.y = totalHeight / 2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    // Glass Windows on facades
    for (let lvl = 0; lvl < heightLevels; lvl++) {
      const yLvl = (lvl + 0.5) * levelHeight;
      const glassFront = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 2.5, 0.2), glassMat);
      glassFront.position.set(0, yLvl, depth / 2 + 0.1);
      group.add(glassFront);

      const glassBack = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 2.5, 0.2), glassMat);
      glassBack.position.set(0, yLvl, -depth / 2 - 0.1);
      group.add(glassBack);
    }

    // Sniper Rooftop Parapet
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 1.2, depth + 0.4), concreteMat);
    parapet.position.y = totalHeight + 0.6;
    group.add(parapet);

    // Rooftop Communications Antenna / Satellite
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 }));
    antenna.position.set(4, totalHeight + 4, 4);
    group.add(antenna);

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'building', mesh: group });

    scene.add(group);
    return group;
  }

  // C. Industrial Factory & Smokestacks
  createFactory(scene: THREE.Scene, x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const brickMat = new THREE.MeshStandardMaterial({ map: TextureFactory.getBrickTexture(), roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });

    // Main Factory Hall
    const hall = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 20), brickMat);
    hall.position.y = 5;
    hall.castShadow = true;
    group.add(hall);

    // Twin Brick Smokestacks
    for (let i = -1; i <= 1; i += 2) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 22, 12), brickMat);
      stack.position.set(i * 6, 11, -8);
      stack.castShadow = true;
      group.add(stack);
    }

    // Overhead Industrial Piping
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 16), metalMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 8, 10.5);
    group.add(pipe);

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'building', mesh: group });

    scene.add(group);
    return group;
  }

  // D. Military Aircraft Hangar
  createHangar(scene: THREE.Scene, x: number, z: number, rotation: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const metalTex = TextureFactory.getMetalTexture('#1e293b');
    const hangarMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.6 });

    // Arched Vaulted Hangar (Half Cylinder)
    const archGeo = new THREE.CylinderGeometry(14, 14, 30, 24, 1, false, 0, Math.PI);
    const arch = new THREE.Mesh(archGeo, hangarMat);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.y = 0;
    arch.scale.set(1, 0.8, 1);
    arch.castShadow = true;
    group.add(arch);

    // Concrete Hangar Apron
    const apron = new THREE.Mesh(new THREE.BoxGeometry(32, 0.4, 34), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    apron.position.y = 0.2;
    group.add(apron);

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'building', mesh: group });

    scene.add(group);
    return group;
  }

  // E. Military Watchtower (Sniper Post)
  createWatchtower(scene: THREE.Scene, x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const woodMat = new THREE.MeshStandardMaterial({ map: TextureFactory.getWoodTexture(), roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });

    const towerHeight = 12;

    // 4 Support Stilts
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, towerHeight), metalMat);
        stilt.position.set(sx * 2.5, towerHeight / 2, sz * 2.5);
        stilt.castShadow = true;
        group.add(stilt);
      }
    }

    // Sniper Platform Cabin at top
    const platform = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 6.5), woodMat);
    platform.position.y = towerHeight;
    group.add(platform);

    // Railings & Half-Walls
    const railing = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.2, 6.5), woodMat);
    railing.position.y = towerHeight + 0.6;
    group.add(railing);

    // Watchtower Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2, 4), metalMat);
    roof.position.y = towerHeight + 3.2;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Spotlight with Real Light Source
    const spotlightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    spotlightMesh.position.set(0, towerHeight - 0.5, 2.8);
    group.add(spotlightMesh);

    const spotlight = new THREE.SpotLight(0xfef08a, 2.5, 45, Math.PI / 4, 0.5);
    spotlight.position.set(x, towerHeight, z + 2.8);
    spotlight.target.position.set(x, 0, z + 20);
    scene.add(spotlight);
    scene.add(spotlight.target);

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'building', mesh: group });

    scene.add(group);
    return group;
  }

  // =========================================================================
  // 3. Detailed 3D Vehicles (Military Truck, Combat Jeep, Attack Chopper)
  // =========================================================================

  // A. 6x6 Heavy Military Cargo Truck
  createMilitaryTruck(scene: THREE.Scene, x: number, z: number, rotation: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f4f38, roughness: 0.7 }); // Camo Green
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x2d3a27, roughness: 0.6 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.8 });

    // Chassis & Engine Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 3.2), bodyMat);
    hood.position.set(0, 1.6, 2.8);
    hood.castShadow = true;
    group.add(hood);

    // Driver Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 2.4), cabinMat);
    cab.position.set(0, 2.0, 0.4);
    cab.castShadow = true;
    group.add(cab);

    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.1), glassMat);
    windshield.position.set(0, 2.4, 1.65);
    group.add(windshield);

    // Cargo Bed / Flatbed
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 5.5), bodyMat);
    bed.position.set(0, 1.8, -3.2);
    bed.castShadow = true;
    group.add(bed);

    // 6 Heavy Offroad Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.6, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      [-1.5, 0.7, 2.6], [1.5, 0.7, 2.6],
      [-1.5, 0.7, -2.0], [1.5, 0.7, -2.0],
      [-1.5, 0.7, -4.2], [1.5, 0.7, -4.2]
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'vehicle', mesh: group });

    scene.add(group);
    return group;
  }

  // B. Armored Recon Combat Jeep
  createCombatJeep(scene: THREE.Scene, x: number, z: number, rotation: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 }); // Desert Camo
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4.2), armorMat);
    body.position.set(0, 1.2, 0);
    body.castShadow = true;
    group.add(body);

    // Roll Cage
    const cage = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.4), metalMat);
    cage.position.set(0, 2.2, -0.4);
    group.add(cage);

    // Mounted Turret
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8), metalMat);
    turret.rotation.x = Math.PI / 2;
    turret.position.set(0, 3.0, 0.4);
    group.add(turret);

    // 4 Big Tires
    const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.5, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.3, 0.65, 1.4], [1.3, 0.65, 1.4], [-1.3, 0.65, -1.4], [1.3, 0.65, -1.4]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, wy, wz);
      group.add(w);
    });

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'vehicle', mesh: group });

    scene.add(group);
    return group;
  }

  // C. Military Attack Helicopter on Helipad
  createHelicopter(scene: THREE.Scene, x: number, z: number): { group: THREE.Group; updateRotors: (delta: number) => void } {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.7 });

    // Helipad Concrete Base with 'H' marking
    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    helipad.position.y = 0.2;
    group.add(helipad);

    const hMarking = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 4), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    hMarking.position.y = 0.42;
    group.add(hMarking);

    // Fuselage Body
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(1.8, 7.5, 16), bodyMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 2.2, 0);
    fuselage.castShadow = true;
    group.add(fuselage);

    // Cockpit Glass Canopy
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), glassMat);
    cockpit.position.set(0, 2.4, 2.2);
    cockpit.scale.set(0.9, 0.8, 1.4);
    group.add(cockpit);

    // Tail Boom
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 6), bodyMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 2.6, -4.5);
    group.add(tail);

    // Landing Skids
    const skidGeo = new THREE.CylinderGeometry(0.1, 0.1, 6);
    skidGeo.rotateX(Math.PI / 2);
    const skidL = new THREE.Mesh(skidGeo, bodyMat);
    skidL.position.set(-1.4, 0.6, 0);
    const skidR = new THREE.Mesh(skidGeo, bodyMat);
    skidR.position.set(1.4, 0.6, 0);
    group.add(skidL, skidR);

    // Main Spinning Rotor Blades
    const rotorHub = new THREE.Group();
    rotorHub.position.set(0, 4.0, 0.5);

    const bladeGeo = new THREE.BoxGeometry(0.3, 0.05, 12);
    const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
    const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
    blade2.rotation.y = Math.PI / 2;
    rotorHub.add(blade1, blade2);
    group.add(rotorHub);

    // Tail Rotor
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.4, 2.9, -7.5);
    const tailBlade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.05), bladeMat);
    tailRotor.add(tailBlade);
    group.add(tailRotor);

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'vehicle', mesh: group });

    scene.add(group);

    return {
      group,
      updateRotors: (delta: number) => {
        rotorHub.rotation.y += delta * 18;
        tailRotor.rotation.x += delta * 25;
      }
    };
  }

  // =========================================================================
  // 4. Props & Interactive Cover (Barrels, Crates, Shipping Containers, Sandbags)
  // =========================================================================

  // Red Explosive Barrel (Destructible with Area Damage!)
  createExplosiveBarrel(scene: THREE.Scene, x: number, z: number): THREE.Mesh {
    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Bright Red
      roughness: 0.4,
      metalness: 0.5
    });

    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(x, 0.7, z);
    barrel.castShadow = true;
    scene.add(barrel);

    const entry = {
      mesh: barrel,
      pos: new THREE.Vector3(x, 0.7, z),
      health: 30,
      destroyed: false
    };
    this.explosiveBarrels.push(entry);

    const box = new THREE.Box3().setFromObject(barrel);
    this.colliders.push({ box, type: 'barrel', mesh: barrel, health: 30, isExplosive: true });

    return barrel;
  }

  // Stacked Shipping Containers (Blue & Red)
  createShippingContainer(scene: THREE.Scene, x: number, z: number, color: string = '#1d4ed8', rotation: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const metalTex = TextureFactory.getMetalTexture(color);
    const mat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.5 });

    // Standard 20ft Cargo Container (6m x 2.6m x 2.4m)
    const container = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), mat);
    container.position.y = 1.3;
    container.castShadow = true;
    container.receiveShadow = true;
    group.add(container);

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'crate', mesh: group });

    scene.add(group);
    return group;
  }

  // Wooden Loot Crate
  createWoodenCrate(scene: THREE.Scene, x: number, z: number, y: number = 0): THREE.Mesh {
    const woodTex = TextureFactory.getWoodTexture();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 }));
    crate.position.set(x, y + 0.7, z);
    crate.castShadow = true;
    scene.add(crate);

    const box = new THREE.Box3().setFromObject(crate);
    this.colliders.push({ box, type: 'crate', mesh: crate });

    return crate;
  }

  // Sandbag Bunker
  createSandbagBunker(scene: THREE.Scene, x: number, z: number, rotation: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 });

    // Curved or U-shaped sandbag stack
    for (let row = 0; row < 3; row++) {
      const y = (row + 0.5) * 0.45;
      const bagFront = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 0.7), sandMat);
      bagFront.position.set(0, y, 1.5);
      group.add(bagFront);

      const bagLeft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 3.0), sandMat);
      bagLeft.position.set(-2.0, y, 0);
      group.add(bagLeft);

      const bagRight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 3.0), sandMat);
      bagRight.position.set(2.0, y, 0);
      group.add(bagRight);
    }

    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push({ box, type: 'wall', mesh: group });

    scene.add(group);
    return group;
  }

  // Street Light Pole with Spotlight
  createStreetLight(scene: THREE.Scene, x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7.5), metalMat);
    pole.position.y = 3.75;
    group.add(pole);

    // Lamp Arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 0.15), metalMat);
    arm.position.set(0.8, 7.4, 0);
    group.add(arm);

    // Glowing Bulb
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfffbeb }));
    bulb.position.set(1.6, 7.2, 0);
    group.add(bulb);

    const light = new THREE.PointLight(0xfffbeb, 1.5, 20);
    light.position.set(x + 1.6, 7.0, z);
    scene.add(light);

    this.lightPoles.push(group);
    scene.add(group);
    return group;
  }

  // Tactical Props (Generators, Medkits, Ammo Crates)
  createTacticalProp(scene: THREE.Scene, type: 'generator' | 'medkit' | 'ammobox' | 'laptop', x: number, z: number) {
    if (type === 'generator') {
      const gen = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 1.5), new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.6 }));
      gen.position.set(x, 0.8, z);
      scene.add(gen);
      this.colliders.push({ box: new THREE.Box3().setFromObject(gen), type: 'crate', mesh: gen });
    } else if (type === 'medkit') {
      const med = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      med.position.set(x, 0.2, z);
      scene.add(med);
    } else if (type === 'ammobox') {
      const ammo = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.7 }));
      ammo.position.set(x, 0.25, z);
      scene.add(ammo);
    }
  }

  // =========================================================================
  // 5. Complete Master Scene Assembler
  // =========================================================================
  assembleFullBattlefield(scene: THREE.Scene, biome: 'grass' | 'sand' | 'snow' | 'rock' | 'concrete' = 'grass') {
    // 1. Terrain Land
    this.buildTerrain(scene, biome);

    // 2. Main Outpost Warehouse District (North-East)
    this.createWarehouse(scene, 35, 40, 0);
    this.createWarehouse(scene, 65, 45, Math.PI / 2);
    this.createShippingContainer(scene, 25, 25, '#1d4ed8', 0.2);
    this.createShippingContainer(scene, 25, 28, '#b91c1c', 0.2);
    this.createWoodenCrate(scene, 28, 32);
    this.createWoodenCrate(scene, 29, 32);
    this.createWoodenCrate(scene, 28.5, 32, 1.4);

    // 3. Multistory Office City Center (Center-North)
    this.createOfficeBuilding(scene, -30, 45, 4);
    this.createOfficeBuilding(scene, -60, 40, 3);
    this.createSandbagBunker(scene, -20, 25, 0);

    // 4. Industrial Factory Zone (South-East)
    this.createFactory(scene, 50, -45);
    this.createShippingContainer(scene, 35, -30, '#b91c1c', Math.PI / 4);
    this.createShippingContainer(scene, 35, -30, '#1d4ed8', Math.PI / 4);

    // 5. Military Airbase & Hangar (South-West)
    this.createHangar(scene, -45, -50, 0);
    const chopperInstance = this.createHelicopter(scene, -20, -45);

    // 6. Perimeter Sniper Watchtowers
    this.createWatchtower(scene, 75, 75);
    this.createWatchtower(scene, -75, 75);
    this.createWatchtower(scene, 75, -75);
    this.createWatchtower(scene, -75, -75);

    // 7. Tactical Vehicles on Roadways
    this.createMilitaryTruck(scene, 6, 20, Math.PI / 6);
    this.createCombatJeep(scene, -15, 12, -Math.PI / 4);
    this.createMilitaryTruck(scene, -40, -10, Math.PI / 2);

    // 8. Red Explosive Barrels scattered in cover spots
    this.createExplosiveBarrel(scene, 18, 22);
    this.createExplosiveBarrel(scene, 19, 23);
    this.createExplosiveBarrel(scene, -25, 20);
    this.createExplosiveBarrel(scene, 42, -28);
    this.createExplosiveBarrel(scene, -38, -35);

    // 9. Streetlights along roads
    this.createStreetLight(scene, 8, 30);
    this.createStreetLight(scene, 8, -30);
    this.createStreetLight(scene, -8, 30);
    this.createStreetLight(scene, -8, -30);

    // 10. Tactical Items & Supplies
    this.createTacticalProp(scene, 'generator', 30, 52);
    this.createTacticalProp(scene, 'medkit', 32, 42);
    this.createTacticalProp(scene, 'ammobox', 34, 42);

    return {
      chopperInstance,
      colliders: this.colliders,
      explosiveBarrels: this.explosiveBarrels
    };
  }
}
