export type GraphicsPreset = 'potato_60fps' | 'low' | 'medium' | 'high' | 'ultra';

export interface PerformanceConfig {
  preset: GraphicsPreset;
  pixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  renderDistance: number;
  fogDensity: number;
  antiAlias: boolean;
  autoFpsOptimizer: boolean;
  targetFps: number;
}

export interface TouchControlsConfig {
  alwaysShowTouchHud: boolean;
  sensitivityX: number;
  sensitivityY: number;
  aimAssistEnabled: boolean;
  hudScale: number;
}

const TOUCH_CONFIG_KEY = 'subtrafficker_fps_touch_cfg_v1';

export const DEFAULT_TOUCH_CONFIG: TouchControlsConfig = {
  alwaysShowTouchHud: false,
  sensitivityX: 1.0,
  sensitivityY: 0.9,
  aimAssistEnabled: true,
  hudScale: 1.0,
};

export function loadTouchConfig(): TouchControlsConfig {
  try {
    const raw = localStorage.getItem(TOUCH_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_TOUCH_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      alwaysShowTouchHud: Boolean(parsed.alwaysShowTouchHud),
      sensitivityX: Math.min(2.5, Math.max(0.3, Number(parsed.sensitivityX) || 1.0)),
      sensitivityY: Math.min(2.5, Math.max(0.3, Number(parsed.sensitivityY) || 0.9)),
      aimAssistEnabled: parsed.aimAssistEnabled !== false,
      hudScale: Math.min(1.3, Math.max(0.8, Number(parsed.hudScale) || 1.0)),
    };
  } catch {
    return { ...DEFAULT_TOUCH_CONFIG };
  }
}

export function saveTouchConfig(cfg: TouchControlsConfig): void {
  try {
    localStorage.setItem(TOUCH_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota errors
  }
}

export function isTouchCapableDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function detectRecommendedGraphicsPreset(): GraphicsPreset {
  if (typeof navigator === 'undefined') return 'low';
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if ((mem && mem <= 6) || cores <= 4 || isMobile) {
    return 'potato_60fps';
  }
  if (mem && mem <= 8) {
    return 'low';
  }
  return 'medium';
}

export const GRAPHICS_PRESETS: Record<GraphicsPreset, PerformanceConfig> = {
  potato_60fps: {
    preset: 'potato_60fps',
    pixelRatio: 0.8,
    shadowsEnabled: false,
    shadowMapSize: 256,
    renderDistance: 320,
    fogDensity: 0.006,
    antiAlias: false,
    autoFpsOptimizer: true,
    targetFps: 60,
  },
  low: {
    preset: 'low',
    pixelRatio: 1.0,
    shadowsEnabled: false,
    shadowMapSize: 512,
    renderDistance: 420,
    fogDensity: 0.006,
    antiAlias: false,
    autoFpsOptimizer: true,
    targetFps: 60,
  },
  medium: {
    preset: 'medium',
    pixelRatio: 1.0,
    shadowsEnabled: true,
    shadowMapSize: 512,
    renderDistance: 520,
    fogDensity: 0.0065,
    antiAlias: true,
    autoFpsOptimizer: true,
    targetFps: 60,
  },
  high: {
    preset: 'high',
    pixelRatio: 1.25,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    renderDistance: 640,
    fogDensity: 0.0065,
    antiAlias: true,
    autoFpsOptimizer: true,
    targetFps: 60,
  },
  ultra: {
    preset: 'ultra',
    pixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5),
    shadowsEnabled: true,
    shadowMapSize: 2048,
    renderDistance: 780,
    fogDensity: 0.0065,
    antiAlias: true,
    autoFpsOptimizer: false,
    targetFps: 60,
  },
};

export class FpsOptimizer {
  private frameCount = 0;
  private lastFpsCheck = performance.now();
  public currentFps = 60;
  private lowFpsStreak = 0;

  public update(
    now: number,
    onSample?: (fps: number) => void,
    onOptimize?: (recommendedPreset: GraphicsPreset) => void
  ): number {
    this.frameCount++;
    const elapsed = now - this.lastFpsCheck;
    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsCheck = now;
      onSample?.(this.currentFps);

      if (this.currentFps < 26) {
        this.lowFpsStreak++;
        if (this.lowFpsStreak >= 2 && onOptimize) {
          this.lowFpsStreak = 0;
          onOptimize('potato_60fps');
        }
      } else {
        this.lowFpsStreak = 0;
      }
    }
    return this.currentFps;
  }
}
