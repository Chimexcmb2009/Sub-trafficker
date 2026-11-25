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

export const GRAPHICS_PRESETS: Record<GraphicsPreset, PerformanceConfig> = {
  // Ultra optimized for low-end hardware (6GB RAM HP / Intel Integrated Graphics)
  potato_60fps: {
    preset: 'potato_60fps',
    pixelRatio: 0.75,
    shadowsEnabled: false,
    shadowMapSize: 256,
    renderDistance: 350,
    fogDensity: 0.005,
    antiAlias: false,
    autoFpsOptimizer: true,
    targetFps: 60
  },
  low: {
    preset: 'low',
    pixelRatio: 0.9,
    shadowsEnabled: false,
    shadowMapSize: 512,
    renderDistance: 450,
    fogDensity: 0.006,
    antiAlias: false,
    autoFpsOptimizer: true,
    targetFps: 60
  },
  medium: {
    preset: 'medium',
    pixelRatio: 1.0,
    shadowsEnabled: true,
    shadowMapSize: 512,
    renderDistance: 550,
    fogDensity: 0.007,
    antiAlias: true,
    autoFpsOptimizer: true,
    targetFps: 60
  },
  high: {
    preset: 'high',
    pixelRatio: 1.0,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    renderDistance: 650,
    fogDensity: 0.007,
    antiAlias: true,
    autoFpsOptimizer: true,
    targetFps: 60
  },
  ultra: {
    preset: 'ultra',
    pixelRatio: 1.25,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    renderDistance: 800,
    fogDensity: 0.007,
    antiAlias: true,
    autoFpsOptimizer: false,
    targetFps: 60
  }
};

export class FpsOptimizer {
  private frameCount = 0;
  private lastFpsCheck = performance.now();
  public currentFps = 60;
  private lowFpsStreak = 0;

  public update(now: number, onOptimize?: (recommendedPreset: GraphicsPreset) => void): number {
    this.frameCount++;
    if (now - this.lastFpsCheck >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsCheck));
      this.frameCount = 0;
      this.lastFpsCheck = now;

      // Auto-scale down if lag is detected (< 30 FPS for 2 consecutive checks)
      if (this.currentFps < 28) {
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
