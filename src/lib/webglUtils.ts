import * as THREE from 'three';

export interface WebGLCheckResult {
  supported: boolean;
  version: 'webgl2' | 'webgl1' | 'none';
  reason?: string;
}

let cachedCheckResult: WebGLCheckResult | null = null;

/**
 * Safely checks if WebGL is supported and usable in the current browser/GPU environment.
 * Caches the result to avoid repeated failed context creation attempts.
 */
export function checkWebGLSupport(forceRecheck = false): WebGLCheckResult {
  if (typeof window === 'undefined') {
    return { supported: false, version: 'none', reason: 'Server-Side Rendering environment' };
  }

  if (cachedCheckResult && !forceRecheck) {
    return cachedCheckResult;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    // First try WebGL2 with low-overhead parameters
    let gl: RenderingContext | null = null;
    let version: 'webgl2' | 'webgl1' | 'none' = 'none';

    try {
      gl = canvas.getContext('webgl2', {
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      });
      if (gl) {
        version = 'webgl2';
      }
    } catch (_) {
      gl = null;
    }

    // If WebGL2 is not available, try WebGL1
    if (!gl) {
      try {
        gl = canvas.getContext('webgl', {
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false
        }) || canvas.getContext('experimental-webgl', {
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false
        });
        if (gl) {
          version = 'webgl1';
        }
      } catch (_) {
        gl = null;
      }
    }

    if (gl) {
      // Cleanly lose the test context to avoid holding onto GPU context slots
      const loseContextExt = (gl as any).getExtension?.('WEBGL_lose_context');
      if (loseContextExt) {
        loseContextExt.loseContext();
      }

      cachedCheckResult = {
        supported: true,
        version
      };
      return cachedCheckResult;
    }

    cachedCheckResult = {
      supported: false,
      version: 'none',
      reason: 'WebGL context creation is not supported or disabled by the graphics driver.'
    };
    return cachedCheckResult;
  } catch (err: any) {
    cachedCheckResult = {
      supported: false,
      version: 'none',
      reason: err?.message || 'WebGL check encountered an unexpected error.'
    };
    return cachedCheckResult;
  }
}

/**
 * Creates a THREE.WebGLRenderer with multi-tier fallback configuration.
 * Returns null gracefully if WebGL cannot be initialized without throwing uncaught errors.
 */
export function createSafeWebGLRenderer(
  options: THREE.WebGLRendererParameters = {}
): THREE.WebGLRenderer | null {
  // Pre-check WebGL support first
  const support = checkWebGLSupport();
  if (!support.supported) {
    return null;
  }

  // Tier 1: Try with user requested options
  try {
    const renderer = new THREE.WebGLRenderer({
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
      ...options
    });
    return renderer;
  } catch (err1) {
    console.warn('Initial WebGLRenderer initialization failed. Trying low-spec compatibility configuration...', err1);
  }

  // Tier 2: Low-spec fallback configuration (mediump precision, no antialias, default power)
  try {
    const fallbackRenderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: options.alpha ?? true,
      powerPreference: 'default',
      precision: 'mediump',
      failIfMajorPerformanceCaveat: false
    });
    return fallbackRenderer;
  } catch (err2) {
    console.warn('Low-spec WebGLRenderer fallback also failed. Disabling WebGL acceleration.', err2);
    // Mark cached result as unsupported so subsequent calls don't keep attempting
    cachedCheckResult = {
      supported: false,
      version: 'none',
      reason: 'WebGL context initialization failed.'
    };
    return null;
  }
}

/**
 * Safely disposes a THREE.WebGLRenderer and frees its WebGL context
 */
export function safelyDisposeRenderer(
  renderer: THREE.WebGLRenderer | null,
  container?: HTMLElement | null
) {
  if (!renderer) return;

  try {
    if (renderer.domElement && container && container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer.forceContextLoss();
  } catch (_) {
    // Ignore disposal cleanup errors
  }
}
