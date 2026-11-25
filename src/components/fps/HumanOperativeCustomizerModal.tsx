import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, Check, Sparkles, User, Eye, Scissors, Shield, Palette, 
  Globe, Play, RefreshCw, Upload, Crosshair, Award
} from 'lucide-react';
import { FpsCharacter, FpsWeapon, FpsMelee } from '../../types';
import { SKIN_TONES, EYE_COLORS, HAIR_STYLES, WARPAINTS, OUTFIT_CAMOS } from './fpsData';
import LobbyOperative3D from './LobbyOperative3D';

interface HumanOperativeCustomizerModalProps {
  character: FpsCharacter;
  weapon: FpsWeapon;
  melee?: FpsMelee;
  onClose: () => void;
  onSave: (customized: Partial<FpsCharacter>) => void;
}

const WEB_3D_CHARACTER_PRESETS = [
  {
    name: 'Tactical Soldier (Three.js Web Sample)',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb',
    desc: 'Official rigged military operative loaded directly over HTTPS'
  },
  {
    name: 'Robot / Cyber Infiltrator (Web GLTF)',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive.glb',
    desc: 'High-polygon animated web 3D model'
  }
];

export default function HumanOperativeCustomizerModal({
  character,
  weapon,
  melee,
  onClose,
  onSave
}: HumanOperativeCustomizerModalProps) {
  const [activeTab, setActiveTab] = useState<'face' | 'hair' | 'gear' | 'web_model'>('face');
  
  // Customization state
  const [gender, setGender] = useState<'male' | 'female'>(character.gender || 'male');
  const [skinTone, setSkinTone] = useState<'fair' | 'tan' | 'bronze' | 'dark' | 'ebony'>(character.skinTone || 'tan');
  const [eyeColor, setEyeColor] = useState<'brown' | 'blue' | 'green' | 'hazel' | 'amber'>(character.eyeColor || 'brown');
  const [hairStyle, setHairStyle] = useState<string>(character.hairStyle || 'tactical_undercut');
  const [warpaint, setWarpaint] = useState<'none' | 'shadow_stripes' | 'blood_slash' | 'skull_mask' | 'cross_camo'>(character.warpaint || 'shadow_stripes');
  const [outfitCamo, setOutfitCamo] = useState<string>(character.outfitCamo || 'camo_urban');
  const [visorGlow, setVisorGlow] = useState<string>(character.visorGlow || '#38bdf8');
  
  // Web 3D Model state
  const [webModelUrl, setWebModelUrl] = useState<string>(character.webModelUrl || '');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  
  // Interactive Emote test
  const [emoteTrigger, setEmoteTrigger] = useState<string | undefined>(undefined);

  const handleSave = () => {
    onSave({
      gender,
      skinTone,
      eyeColor,
      hairStyle,
      warpaint,
      outfitCamo,
      visorGlow,
      webModelUrl: webModelUrl.trim() || undefined
    });
    onClose();
  };

  const currentPreviewCharacter: FpsCharacter = {
    ...character,
    gender,
    skinTone,
    eyeColor,
    hairStyle,
    warpaint,
    outfitCamo,
    visorGlow,
    webModelUrl: webModelUrl.trim() || undefined
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md" id="human-customizer-modal">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-5xl h-[90vh] max-h-[780px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-sky-600 flex items-center justify-center shadow-md">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                HUMAN OPERATIVE CUSTOMIZER & 3D STUDIO
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Real-Time Human Face, Eyes, Hair & Web 3D Model Loading
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left 3D Viewport, Right Customization Controls */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          
          {/* Left: Interactive 3D Canvas Preview */}
          <div className="lg:col-span-5 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
            
            {/* 3D Operative Stage */}
            <div className="flex-1 relative w-full h-full min-h-[300px]">
              <LobbyOperative3D
                character={currentPreviewCharacter}
                weapon={weapon}
                melee={melee}
                gender={gender}
                skinTone={skinTone}
                eyeColor={eyeColor}
                hairStyle={hairStyle}
                warpaint={warpaint}
                outfitCamo={outfitCamo}
                visorGlow={visorGlow}
                webModelUrl={webModelUrl.trim() || undefined}
                emoteTrigger={emoteTrigger}
                onEmoteComplete={() => setEmoteTrigger(undefined)}
              />
            </div>

            {/* Live Animation Test Bar */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-400">Test Emote:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEmoteTrigger('wave')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 rounded-lg transition"
                >
                  👋 Wave
                </button>
                <button
                  type="button"
                  onClick={() => setEmoteTrigger('inspect')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 rounded-lg transition"
                >
                  🔍 Inspect
                </button>
                <button
                  type="button"
                  onClick={() => setEmoteTrigger('ready')}
                  className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-xs font-mono text-white rounded-lg transition"
                >
                  ⚡ Ready
                </button>
              </div>
            </div>
          </div>

          {/* Right: Customization Panels & Tabs */}
          <div className="lg:col-span-7 flex flex-col bg-slate-900/50 min-h-0 overflow-hidden">
            
            {/* Customization Navigation Tabs */}
            <div className="px-6 pt-4 flex items-center gap-2 border-b border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('face')}
                className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'face'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Face & Anatomy</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('hair')}
                className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'hair'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Hair & Headgear</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('gear')}
                className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'gear'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Tactical Armor & Camo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('web_model')}
                className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'web_model'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Web 3D Models (.GLB)</span>
              </button>
            </div>

            {/* Tab Contents Scrollable Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              {/* TAB 1: FACE & ANATOMY */}
              {activeTab === 'face' && (
                <div className="space-y-6">
                  {/* Gender / Body Frame */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Body Frame & Gender</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                          gender === 'male'
                            ? 'bg-rose-950/40 border-rose-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">Male Operative</p>
                          <p className="text-[10px] text-slate-400 font-mono">Muscular Commando Frame</p>
                        </div>
                        {gender === 'male' && <Check className="w-4 h-4 text-rose-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                          gender === 'female'
                            ? 'bg-rose-950/40 border-rose-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">Female Operative</p>
                          <p className="text-[10px] text-slate-400 font-mono">Agile Spec-Ops Infiltrator</p>
                        </div>
                        {gender === 'female' && <Check className="w-4 h-4 text-rose-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Skin Tone Palette */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Human Skin Tone</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {SKIN_TONES.map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSkinTone(st.id as any)}
                          className={`p-2.5 rounded-xl border flex items-center gap-3 transition text-left ${
                            skinTone === st.id
                              ? 'bg-slate-800 border-sky-400 text-white shadow-md'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span 
                            className="w-6 h-6 rounded-full border border-black/40 shadow-inner shrink-0" 
                            style={{ backgroundColor: st.hex }} 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{st.name}</p>
                          </div>
                          {skinTone === st.id && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Eye Color */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Human Eye Iris Color</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {EYE_COLORS.map(ec => (
                        <button
                          key={ec.id}
                          type="button"
                          onClick={() => setEyeColor(ec.id as any)}
                          className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                            eyeColor === ec.id
                              ? 'bg-slate-800 border-sky-400 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span 
                            className="w-4 h-4 rounded-full border border-black/40 shadow shrink-0" 
                            style={{ backgroundColor: ec.hex }} 
                          />
                          <span className="text-[11px] font-medium truncate">{ec.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warpaint */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Facial Warpaint & Scars</label>
                    <div className="grid grid-cols-2 gap-2">
                      {WARPAINTS.map(wp => (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => setWarpaint(wp.id as any)}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 transition text-left ${
                            warpaint === wp.id
                              ? 'bg-rose-950/40 border-rose-500 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-base">{wp.preview}</span>
                          <span className="text-xs font-medium truncate">{wp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HAIR & HEADGEAR */}
              {activeTab === 'hair' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Select authentic real-life hair cuts, braids, ponytails, or military night-vision combat helmets:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {HAIR_STYLES.map(hs => (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => setHairStyle(hs.id)}
                        className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                          hairStyle === hs.id
                            ? 'bg-rose-950/50 border-rose-500 text-white shadow-lg'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-2xl">{hs.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold">{hs.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Realistic 3D Hair Strands</p>
                        </div>
                        {hairStyle === hs.id && <Check className="w-4 h-4 text-rose-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: TACTICAL ARMOR & CAMO */}
              {activeTab === 'gear' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Combat Vest Camouflage Skin</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {OUTFIT_CAMOS.map(oc => (
                        <button
                          key={oc.id}
                          type="button"
                          onClick={() => setOutfitCamo(oc.id)}
                          className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition ${
                            outfitCamo === oc.id
                              ? 'bg-slate-800 border-sky-400 text-white shadow-lg'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span 
                            className="w-6 h-6 rounded-xl border border-white/20 shadow shrink-0" 
                            style={{ backgroundColor: oc.color }} 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold">{oc.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Ballistic Plate Carrier</p>
                          </div>
                          {outfitCamo === oc.id && <Check className="w-4 h-4 text-sky-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Cyber Visor & Hologram Glow</label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {['#38bdf8', '#e11d48', '#10b981', '#f59e0b', '#a855f7', '#ec4899'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setVisorGlow(color)}
                          className={`w-9 h-9 rounded-xl border-2 transition flex items-center justify-center ${
                            visorGlow === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {visorGlow === color && <Check className="w-4 h-4 text-black font-black" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: WEB 3D MODELS (.GLB / .GLTF) */}
              {activeTab === 'web_model' && (
                <div className="space-y-4">
                  <div className="p-4 bg-sky-950/40 border border-sky-500/40 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                      <Globe className="w-4 h-4" />
                      <span>Direct Web 3D Model Loading (.GLB / .GLTF)</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      As requested, character 3D models can be loaded directly from web URLs or cloud servers (like Sketchfab, GitHub, or CDN GLB assets) instead of procedural shapes.
                    </p>
                  </div>

                  {/* Preset Web Models */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Verified Web 3D Presets</label>
                    <div className="space-y-2">
                      {WEB_3D_CHARACTER_PRESETS.map((preset, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                            webModelUrl === preset.url
                              ? 'bg-sky-950/60 border-sky-400 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div>
                            <h4 className="text-xs font-bold text-white">{preset.name}</h4>
                            <p className="text-[10px] text-slate-400">{preset.desc}</p>
                            <p className="text-[9px] font-mono text-sky-400/80 truncate max-w-md mt-1">{preset.url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setWebModelUrl(preset.url)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition ${
                              webModelUrl === preset.url
                                ? 'bg-sky-500 text-black'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {webModelUrl === preset.url ? 'LOADED ✓' : 'USE MODEL'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom URL Input */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase">Or Enter Custom Web 3D Model URL (.glb / .gltf)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="https://your-domain.com/models/character.glb"
                        className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customUrlInput.trim()) {
                            setWebModelUrl(customUrlInput.trim());
                          }
                        }}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Load Model
                      </button>
                    </div>

                    {webModelUrl && (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-[11px] text-emerald-300 font-mono">
                        <span className="truncate">Active 3D Asset: {webModelUrl}</span>
                        <button
                          type="button"
                          onClick={() => setWebModelUrl('')}
                          className="text-rose-400 hover:text-rose-300 text-xs font-bold underline ml-2 shrink-0"
                        >
                          Clear & Reset
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Save Bar */}
            <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="text-xs text-slate-400 font-mono">
                Changes will sync to your Firestore Profile and 3D Game Engine.
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-6 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>SAVE OPERATIVE</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </motion.div>
    </div>
  );
}
