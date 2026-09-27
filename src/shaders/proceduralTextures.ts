import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';

/**
 * Procedural texture generators for the Stylized Toon Water Shader.
 * Generates seamless, artistic, organic textures in memory without external assets:
 * - Smooth pool caustics (soft rounded sunlight ribbons & light pools, no cracked lines)
 * - Buttery smooth wave displacement & tangent-space normal maps
 * - Soft puffy cartoon foam clusters
 */

const simplex = new SimplexNoise(1337);

/**
 * Quintic smootherstep interpolation (C2 continuous)
 * Completely eliminates any derivative discontinuities or visible seams.
 */
function quintic(t: number): number {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Seamless periodic FBM noise using quadrant cross-fading with quintic smoothing
 */
function sampleSeamlessNoise(x: number, y: number, size: number, scale = 0.035, octaves = 3): number {
  const u = x / size;
  const v = y / size;

  const n00 = simplex.fbm(x * scale, y * scale, octaves, 0.5);
  const n10 = simplex.fbm((x - size) * scale, y * scale, octaves, 0.5);
  const n01 = simplex.fbm(x * scale, (y - size) * scale, octaves, 0.5);
  const n11 = simplex.fbm((x - size) * scale, (y - size) * scale, octaves, 0.5);

  const su = quintic(u);
  const sv = quintic(v);

  return (
    n00 * (1.0 - su) * (1.0 - sv) +
    n10 * su * (1.0 - sv) +
    n01 * (1.0 - su) * sv +
    n11 * su * sv
  );
}

/**
 * Generate soft, artistic pool caustics for anime / toon stylized water.
 * Creates smooth, undulating light ribbons and rounded sunlit pools.
 * Avoids any sharp wireframe Voronoi cracks, spiderwebs or dry mud patterns.
 */
export function generateCausticsTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Grid points for soft rounded cellular light pools
  const gridCells = 10;
  const cellSize = size / gridCells;
  const points: { x: number; y: number }[] = [];

  let seed = 77;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let gy = 0; gy < gridCells; gy++) {
    for (let gx = 0; gx < gridCells; gx++) {
      points.push({
        x: (gx + 0.25 + rand() * 0.5) * cellSize,
        y: (gy + 0.25 + rand() * 0.5) * cellSize,
      });
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 1. Smooth domain warping for fluid organic curves
      const warpX = sampleSeamlessNoise(x, y, size, 0.02, 2) * 28.0;
      const warpY = sampleSeamlessNoise(x + 128, y + 128, size, 0.02, 2) * 28.0;

      const wx = (x + warpX + size) % size;
      const wy = (y + warpY + size) % size;

      // 2. Soft rounded Voronoi light pools (soft blob centers, NOT cell borders!)
      let minD = 999999;
      const cellX = Math.floor(wx / cellSize);
      const cellY = Math.floor(wy / cellSize);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (cellX + dx + gridCells) % gridCells;
          const ny = (cellY + dy + gridCells) % gridCells;
          const p = points[ny * gridCells + nx];

          let px = p.x;
          let py = p.y;
          if (cellX + dx < 0) px -= size;
          if (cellX + dx >= gridCells) px += size;
          if (cellY + dy < 0) py -= size;
          if (cellY + dy >= gridCells) py += size;

          const distSq = (wx - px) * (wx - px) + (wy - py) * (wy - py);
          if (distSq < minD) {
            minD = distSq;
          }
        }
      }

      const dist = Math.sqrt(minD);
      // Soft rounded pillowy pool: bright center gently fading outwards
      const poolRadius = cellSize * 0.85;
      const pool = Math.max(0, 1.0 - dist / poolRadius);
      const softPool = pool * pool * (3.0 - 2.0 * pool); // Smooth Hermite falloff

      // 3. Smooth continuous undulating liquid light ribbons
      const wave1 = sampleSeamlessNoise(wx, wy, size, 0.038, 3);
      const wave2 = sampleSeamlessNoise(wx + 90, wy - 90, size, 0.045, 2);
      // Gentle sinusoidal ribbons
      const ribbon1 = Math.abs(Math.cos(wave1 * Math.PI * 2.2));
      const ribbon2 = Math.abs(Math.sin(wave2 * Math.PI * 1.8));
      const ribbonMix = Math.pow((ribbon1 * 0.6 + ribbon2 * 0.4), 1.6);

      // 4. Combine into soft, artistic anime water caustics
      const combined = softPool * 0.45 + ribbonMix * 0.55;
      const val = Math.max(0, Math.min(255, Math.floor(combined * 255)));

      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Generate tileable wave height texture (Smooth continuous Perlin / FBM noise)
 */
export function generateWaveTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = sampleSeamlessNoise(x, y, size, 0.024, 3);
      const normalized = Math.max(0, Math.min(1, n * 0.5 + 0.5));
      const val = Math.floor(normalized * 255);

      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Generate wave normal map in standard tangent-space with buttery smooth slopes
 * Lower slope multiplier (1.0 instead of 3.5) prevents faceted specular artifacts.
 */
export function generateWaveNormalTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xL = (x - 1 + size) % size;
      const xR = (x + 1) % size;
      const yD = (y - 1 + size) % size;
      const yU = (y + 1) % size;

      const hL = sampleSeamlessNoise(xL, y, size, 0.024, 3);
      const hR = sampleSeamlessNoise(xR, y, size, 0.024, 3);
      const hD = sampleSeamlessNoise(x, yD, size, 0.024, 3);
      const hU = sampleSeamlessNoise(x, yU, size, 0.024, 3);

      // Gentle slope for soft, silky stylized water surfaces
      const dx = (hR - hL) * 0.70;
      const dy = (hU - hD) * 0.70;

      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1.0 / len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Generate soft, puffy cartoon foam texture with gentle billowing clusters.
 * Avoids any harsh perforated holes or ragged edges.
 */
export function generateFoamTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Gentle billowing clusters with soft falloff
      const n1 = sampleSeamlessNoise(x, y, size, 0.045, 3);
      const n2 = sampleSeamlessNoise(x + 64, y + 64, size, 0.09, 2) * 0.35;
      const raw = (n1 + n2) * 0.5 + 0.5;
      
      // Soft S-curve for cloud-like fluffy foam islands
      const smoothed = raw * raw * (3.0 - 2.0 * raw);
      const val = Math.floor(Math.max(0, Math.min(1, smoothed)) * 255);

      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}
