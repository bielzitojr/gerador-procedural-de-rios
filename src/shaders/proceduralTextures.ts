import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';

/**
 * Procedural texture generators for the Godot water shader port.
 * Creates tileable textures in memory without external image dependencies.
 */

const simplex = new SimplexNoise(1337);

// Seamless periodic FBM noise using quadrant cross-fading
function sampleSeamlessNoise(x: number, y: number, size: number, scale = 0.035, octaves = 3): number {
  const u = x / size;
  const v = y / size;

  const n00 = simplex.fbm(x * scale, y * scale, octaves, 0.5);
  const n10 = simplex.fbm((x - size) * scale, y * scale, octaves, 0.5);
  const n01 = simplex.fbm(x * scale, (y - size) * scale, octaves, 0.5);
  const n11 = simplex.fbm((x - size) * scale, (y - size) * scale, octaves, 0.5);

  // Cubic smoothstep weights
  const su = u * u * (3.0 - 2.0 * u);
  const sv = v * v * (3.0 - 2.0 * v);

  return (
    n00 * (1.0 - su) * (1.0 - sv) +
    n10 * su * (1.0 - sv) +
    n01 * (1.0 - su) * sv +
    n11 * su * sv
  );
}

// Generate tileable Voronoi / Cellular noise for caustics
export function generateCausticsTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Grid points for periodic tileable Voronoi
  const gridCells = 16;
  const cellSize = size / gridCells;
  const points: { x: number; y: number }[] = [];

  // Deterministic seedable pseudo-random
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let gy = 0; gy < gridCells; gy++) {
    for (let gx = 0; gx < gridCells; gx++) {
      points.push({
        x: (gx + 0.15 + rand() * 0.7) * cellSize,
        y: (gy + 0.15 + rand() * 0.7) * cellSize,
      });
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = 999999;
      let d2 = 999999;

      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);

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

          const distSq = (x - px) * (x - px) + (y - py) * (y - py);
          if (distSq < d1) {
            d2 = d1;
            d1 = distSq;
          } else if (distSq < d2) {
            d2 = distSq;
          }
        }
      }

      const dist1 = Math.sqrt(d1);
      const dist2 = Math.sqrt(d2);

      // Cell borders: (d2 - d1) gives sharp web-like caustic lines
      const border = dist2 - dist1;
      const val = Math.max(0, Math.min(255, Math.floor(Math.pow(Math.max(0, 1.0 - border / (cellSize * 0.28)), 1.8) * 255)));

      const idx = (y * size + x) * 4;
      data[idx] = val;     // R
      data[idx + 1] = val; // G
      data[idx + 2] = val; // B
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

// Generate tileable wave height texture (Perlin / FBM noise)
export function generateWaveTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sample smooth continuous organic noise matching Godot OpenSimplexNoise
      const n = sampleSeamlessNoise(x, y, size, 0.032, 3);
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

// Generate wave normal map in true standard tangent-space
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

      const hL = sampleSeamlessNoise(xL, y, size, 0.032, 3);
      const hR = sampleSeamlessNoise(xR, y, size, 0.032, 3);
      const hD = sampleSeamlessNoise(x, yD, size, 0.032, 3);
      const hU = sampleSeamlessNoise(x, yU, size, 0.032, 3);

      const dx = (hR - hL) * 3.5;
      const dy = (hU - hD) * 3.5;

      // Standard tangent-space normal: (-dx, -dy, 1.0)
      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1.0 / len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);     // Red = Tangent X
      data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255); // Green = Bitangent Y (along depth Z)
      data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255); // Blue = Normal Z (upwards)
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

// Generate foam organic noise texture for breaking the foam boundaries
export function generateFoamTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Porous organic bubble pattern with multi-octave simplex
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = sampleSeamlessNoise(x, y, size, 0.075, 4);
      const n2 = sampleSeamlessNoise(x + 50, y + 50, size, 0.15, 2) * 0.3;
      const val = Math.floor(Math.max(0, Math.min(1, (n1 + n2) * 0.5 + 0.5)) * 255);

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
