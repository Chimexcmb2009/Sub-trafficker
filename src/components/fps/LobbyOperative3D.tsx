import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FpsCharacter, FpsWeapon, FpsMelee } from '../../types';
import { Shield, Crosshair, User, RefreshCw, Eye, Sparkles, Globe } from 'lucide-react';
import { RealisticHumanOperativeRig, HumanCustomizationOptions } from './RealisticHumanCharacter3D';
import { createSafeWebGLRenderer, safelyDisposeRenderer, checkWebGLSupport } from '../../lib/webglUtils';

interface LobbyOperative3DProps {
  character: FpsCharacter;
  weapon: FpsWeapon;
  melee?: FpsMelee;
  height?: string;
  onOpenCustomizer?: () => void;
  hairStyle?: string;
  outfitCamo?: string;
  visorGlow?: string;
  skinTone?: 'fair' | 'tan' | 'bronze' | 'dark' | 'ebony';
  eyeColor?: 'brown' | 'blue' | 'green' | 'hazel' | 'amber';
  warpaint?: 'none' | 'shadow_stripes' | 'blood_slash' | 'skull_mask' | 'cross_camo';
  gender?: 'male' | 'female';
  webModelUrl?: string;
  emoteTrigger?: string; // 'wave' | 'inspect' | 'ready'
  onEmoteComplete?: () => void;
}

export default function LobbyOperative3D({
  character,
  weapon,
  melee,
  height,
  onOpenCustomizer,
  hairStyle = 'tactical_undercut',
  outfitCamo = 'camo_urban',
  visorGlow = '#38bdf8',
  skinTone = 'tan',
  eyeColor = 'brown',
  warpaint = 'shadow_stripes',
  gender = 'male',
  webModelUrl,
  emoteTrigger,
  onEmoteComplete
}: LobbyOperative3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const characterRigRef = useRef<RealisticHumanOperativeRig | null>(null);
  const isDraggingRef = useRef(false);
  const prevMouseXRef = useRef(0);
  const rotationYRef = useRef(0);
  const targetRotationYRef = useRef(0);

  const [hasWebglError, setHasWebglError] = useState(false);
  const [fallbackRotation, setFallbackRotation] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 500;

    let animationFrameId: number;

    try {
      if (rendererRef.current) {
        safelyDisposeRenderer(rendererRef.current, container);
        rendererRef.current = null;
      }
      container.innerHTML = '';

      // Check WebGL availability first without generating unhandled errors
      const support = checkWebGLSupport();
      if (!support.supported) {
        setHasWebglError(true);
        return;
      }

      // 1. Scene & Perspective Camera
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 1.25, 3.1);
      camera.lookAt(0, 1.05, 0);

      // 2. Safe High Quality PBR WebGL Renderer
      const renderer = createSafeWebGLRenderer({ 
        antialias: true, 
        alpha: true
      });

      if (!renderer) {
        setHasWebglError(true);
        return;
      }

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      try {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
      } catch (_) {}
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 3. Studio Character Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xfffaed, 1.6);
      keyLight.position.set(3.5, 5.5, 4.0);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      scene.add(keyLight);

      // Backlight / Rim light for human silhouette
      const rimLight = new THREE.PointLight(0x38bdf8, 3.0, 9);
      rimLight.position.set(-2.5, 3.2, -2.2);
      scene.add(rimLight);

      const warmFillLight = new THREE.PointLight(0xffedd5, 1.8, 8);
      warmFillLight.position.set(2.2, 1.5, 2.5);
      scene.add(warmFillLight);

      // 4. Tactical Holographic Stand
      const podiumGroup = new THREE.Group();
      const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.12, 32);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x090d16,
        metalness: 0.9,
        roughness: 0.2
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = -0.06;
      baseMesh.receiveShadow = true;
      podiumGroup.add(baseMesh);

      // Glowing Rings
      const ringGeo = new THREE.RingGeometry(1.1, 1.22, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(visorGlow || '#38bdf8'),
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.01;
      podiumGroup.add(ringMesh);

      scene.add(podiumGroup);

      // 5. Build High-Fidelity Human Operative Rig (with realistic facial textures, eyes, hair & gear)
      const customOptions: HumanCustomizationOptions = {
        gender,
        skinTone,
        eyeColor,
        hairStyle: hairStyle || character.hairStyle,
        outfitCamo: outfitCamo || character.outfitCamo,
        visorGlow: visorGlow || character.visorGlow,
        warpaint,
        webModelUrl
      };

      const humanRig = new RealisticHumanOperativeRig(character, weapon, customOptions);
      characterRigRef.current = humanRig;
      scene.add(humanRig.rootGroup);

      // 6. Animation Loop
      let clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        // Smooth 360 Rotation Damping
        rotationYRef.current += (targetRotationYRef.current - rotationYRef.current) * 0.12;
        if (humanRig.rootGroup) {
          humanRig.rootGroup.rotation.y = rotationYRef.current;
        }

        // Live skeletal update (breathing, eye blinking, look movement)
        humanRig.update(delta, false, false);

        // Holographic podium subtle spin
        ringMesh.rotation.z = elapsed * 0.35;

        renderer.render(scene, camera);
      };

      animate();

      // 7. Interactive 360 Drag Handlers
      const handleMouseDown = (e: MouseEvent) => {
        isDraggingRef.current = true;
        prevMouseXRef.current = e.clientX;
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = e.clientX - prevMouseXRef.current;
        prevMouseXRef.current = e.clientX;
        targetRotationYRef.current += deltaX * 0.016;
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          isDraggingRef.current = true;
          prevMouseXRef.current = e.touches[0].clientX;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDraggingRef.current || e.touches.length === 0) return;
        const deltaX = e.touches[0].clientX - prevMouseXRef.current;
        prevMouseXRef.current = e.touches[0].clientX;
        targetRotationYRef.current += deltaX * 0.016;
      };

      const handleTouchEnd = () => {
        isDraggingRef.current = false;
      };

      const handleResize = () => {
        if (!containerRef.current || !rendererRef.current) return;
        const newW = containerRef.current.clientWidth;
        const newH = containerRef.current.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      };

      container.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('resize', handleResize);

      setHasWebglError(false);

      return () => {
        cancelAnimationFrame(animationFrameId);
        container.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('resize', handleResize);
        if (rendererRef.current) {
          safelyDisposeRenderer(rendererRef.current, container);
          rendererRef.current = null;
        }
      };
    } catch (e) {
      console.warn("LobbyOperative3D WebGL initialization fallback to 2D card:", e);
      setHasWebglError(true);
    }
  }, [
    character.id, 
    weapon.id, 
    melee?.id, 
    hairStyle, 
    outfitCamo, 
    visorGlow, 
    skinTone, 
    eyeColor, 
    warpaint, 
    gender, 
    webModelUrl
  ]);

  // Handle Emote Triggers
  useEffect(() => {
    if (!emoteTrigger || !characterRigRef.current) return;
    characterRigRef.current.triggerEmote(emoteTrigger as any, onEmoteComplete);
  }, [emoteTrigger, onEmoteComplete]);

  // Fallback 2D View if WebGL is unavailable
  if (hasWebglError) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-xl select-none">
        <div className="relative w-64 h-72 flex flex-col items-center justify-center">
          <div 
            className="absolute inset-0 rounded-full border border-sky-500/30 animate-spin" 
            style={{ animationDuration: '8s' }} 
          />
          <div className="relative z-10 w-48 h-60 rounded-2xl bg-slate-900/90 border-2 border-sky-500/60 p-4 flex flex-col items-center justify-between shadow-[0_0_30px_rgba(56,189,248,0.25)]">
            <div className="w-full flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[10px] font-bold border border-rose-500/30">
                {(character.title || 'HUMAN OPERATIVE').toUpperCase()}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="relative my-auto flex flex-col items-center">
              <div 
                className="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-rose-600 p-1 flex items-center justify-center shadow-lg transition-transform duration-300"
                style={{ transform: `rotate(${fallbackRotation}deg)` }}
              >
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <User className="w-10 h-10 text-sky-400" />
                </div>
              </div>
              <h4 className="mt-2 text-sm font-black text-white tracking-wider">{character.name}</h4>
              <p className="text-[11px] font-mono text-slate-400">{weapon.name}</p>
            </div>

            <div className="w-full grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-300">
              <div className="bg-slate-950/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-rose-400" />
                <span>{weapon.damage} DMG</span>
              </div>
              <div className="bg-slate-950/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Shield className="w-3 h-3 text-sky-400" />
                <span>{character.shield} SHD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full select-none cursor-grab active:cursor-grabbing" id="lobby-operative-3d-stage">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* 360 Spin & Realistic Human Model Badge */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-full text-[10px] font-mono text-slate-300 flex items-center gap-2 pointer-events-none shadow-xl">
        <span className="text-sky-400 font-bold">●</span>
        <span>Realistic 3D Human Operative (Free Fire / Blood Strike Style)</span>
        <span className="text-rose-500 font-bold">↻ Drag to rotate 360°</span>
      </div>
    </div>
  );
}
