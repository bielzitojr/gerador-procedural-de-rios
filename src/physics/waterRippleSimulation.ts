import * as THREE from 'three';

export interface WakePoint {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  speed: number;
  strength: number;
  age: number; // seconds
}

export class WaterRippleSimulation {
  private size: number;
  private buffer1: Float32Array;
  private buffer2: Float32Array;
  private wakeNormX: Float32Array;
  private wakeNormZ: Float32Array;
  private wakeAlpha: Float32Array;
  private textureData: Uint8Array;
  public texture: THREE.DataTexture;

  public worldCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  public worldSize: THREE.Vector2 = new THREE.Vector2(8, 8);

  private isBuffer1Current: boolean = true;

  // Polyline wake trail history for moving objects (ducks)
  private wakePoints: WakePoint[] = [];
  private lastSamplePosMap: Map<number, THREE.Vector2> = new Map();

  constructor(size: number = 256, worldWidth: number = 130, worldHeight: number = 130) {
    this.size = size;
    this.worldSize.set(worldWidth, worldHeight);

    const totalCells = size * size;
    this.buffer1 = new Float32Array(totalCells);
    this.buffer2 = new Float32Array(totalCells);
    this.wakeNormX = new Float32Array(totalCells);
    this.wakeNormZ = new Float32Array(totalCells);
    this.wakeAlpha = new Float32Array(totalCells);
    this.textureData = new Uint8Array(totalCells * 4);

    // Initialize neutral texture (128 = 0 displacement, 128 = neutral normal)
    for (let i = 0; i < totalCells; i++) {
      const idx = i * 4;
      this.textureData[idx] = 128; // Height
      this.textureData[idx + 1] = 128; // Normal X
      this.textureData[idx + 2] = 128; // Normal Z
      this.textureData[idx + 3] = 0; // Wake / crest intensity
    }

    this.texture = new THREE.DataTexture(
      this.textureData,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  public setBounds(centerX: number, centerZ: number, width: number, depth: number) {
    this.worldCenter.set(centerX, centerZ);
    this.worldSize.set(width, depth);
  }

  /**
   * Generates interactive 360° circular splash ripples (mouse click/touch or vertical plunge).
   */
  public addRipple(worldX: number, worldZ: number, radiusWorld: number = 0.35, strength: number = 1.0) {
    const halfW = this.worldSize.x / 2;
    const halfH = this.worldSize.y / 2;

    const u = (worldX - (this.worldCenter.x - halfW)) / this.worldSize.x;
    const v = (worldZ - (this.worldCenter.y - halfH)) / this.worldSize.y;

    if (u < 0.005 || u > 0.995 || v < 0.005 || v > 0.995) return;

    const centerX = Math.floor(u * this.size);
    const centerY = Math.floor(v * this.size);
    const radiusGrid = Math.max(2, Math.floor((radiusWorld / this.worldSize.x) * this.size));

    const currentBuf = this.isBuffer1Current ? this.buffer1 : this.buffer2;

    const r2 = radiusGrid * radiusGrid;
    const minX = Math.max(1, centerX - radiusGrid);
    const maxX = Math.min(this.size - 2, centerX + radiusGrid);
    const minY = Math.max(1, centerY - radiusGrid);
    const maxY = Math.min(this.size - 2, centerY + radiusGrid);

    for (let y = minY; y <= maxY; y++) {
      const dy = y - centerY;
      const dy2 = dy * dy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const d2 = dx * dx + dy2;
        if (d2 <= r2) {
          const factor = Math.cos((Math.sqrt(d2) / radiusGrid) * (Math.PI / 2));
          const idx = y * this.size + x;
          currentBuf[idx] += strength * factor * 0.9;
          if (currentBuf[idx] > 3.0) currentBuf[idx] = 3.0;
          if (currentBuf[idx] < -3.0) currentBuf[idx] = -3.0;
        }
      }
    }
  }

  /**
   * Registers moving object (duck) movement for a smooth directional wake trail ("rastro").
   * STRICTLY avoids calling addRipple or triggering 360° circular waves.
   * Only deposits wake BEHIND the moving body along its trajectory.
   */
  public addWake(
    worldX: number,
    worldZ: number,
    dirX: number,
    dirZ: number,
    speed: number,
    strength: number = 1.0,
    objectId: number = 0
  ) {
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.0001) return;
    const nx = dirX / len;
    const nz = dirZ / len;

    const isRiver = this.worldSize.x > 25;
    const minStepDist = isRiver ? 0.35 : 0.06;
    const offsetBack = isRiver ? 0.75 : 0.28;

    let lastPos = this.lastSamplePosMap.get(objectId);
    if (!lastPos) {
      lastPos = new THREE.Vector2(-9999, -9999);
      this.lastSamplePosMap.set(objectId, lastPos);
    }

    // Minimum movement step to sample a new trail point
    const distSq = Math.hypot(worldX - lastPos.x, worldZ - lastPos.y);
    if (distSq < minStepDist && this.wakePoints.length > 0) {
      // Update the newest point with the latest direction and position
      const head = this.wakePoints[0];
      head.x = worldX - nx * offsetBack;
      head.z = worldZ - nz * offsetBack;
      head.dirX = nx;
      head.dirZ = nz;
      head.speed = speed;
      head.strength = strength;
      return;
    }

    lastPos.set(worldX, worldZ);

    // Add point strictly at the duck stern (rear), not in front or center
    this.wakePoints.unshift({
      x: worldX - nx * offsetBack,
      z: worldZ - nz * offsetBack,
      dirX: nx,
      dirZ: nz,
      speed,
      strength,
      age: 0.0,
    });

    // Limit maximum trail point count for performance
    const maxPoints = isRiver ? 60 : 35;
    if (this.wakePoints.length > maxPoints) {
      this.wakePoints.pop();
    }
  }

  public update(damping: number = 0.975, delta: number = 0.016) {
    const current = this.isBuffer1Current ? this.buffer1 : this.buffer2;
    const next = this.isBuffer1Current ? this.buffer2 : this.buffer1;
    const s = this.size;

    // 1. Wave equation solver for interactive splashes across full domain
    for (let y = 1; y < s - 1; y++) {
      const row = y * s;
      const rowUp = (y - 1) * s;
      const rowDown = (y + 1) * s;

      for (let x = 1; x < s - 1; x++) {
        const idx = row + x;
        const wave =
          (current[idx - 1] + current[idx + 1] + current[rowUp + x] + current[rowDown + x]) * 0.5 -
          next[idx];

        next[idx] = wave * damping;
      }
    }

    // Toggle buffers
    this.isBuffer1Current = !this.isBuffer1Current;
    const activeWave = next;

    // 2. Advance and render directional duck wake trails
    const isRiver = this.worldSize.x > 25;
    const maxAge = isRiver ? 2.6 : 1.8;
    const dt = Math.min(0.05, Math.max(0.005, delta));

    for (let i = this.wakePoints.length - 1; i >= 0; i--) {
      this.wakePoints[i].age += dt;
      if (this.wakePoints[i].age > maxAge) {
        this.wakePoints.splice(i, 1);
      }
    }

    // Clear wake normal perturbation and intensity buffers
    this.wakeNormX.fill(0);
    this.wakeNormZ.fill(0);
    this.wakeAlpha.fill(0);

    const halfW = this.worldSize.x / 2;
    const halfH = this.worldSize.y / 2;
    const minWorldX = this.worldCenter.x - halfW;
    const minWorldZ = this.worldCenter.y - halfH;

    // Stamp the V-shaped wake trail points onto the grid
    for (let i = 0; i < this.wakePoints.length; i++) {
      const pt = this.wakePoints[i];
      const age = pt.age;
      const fade = Math.max(0.0, 1.0 - age / maxAge);
      const velScale = Math.min(2.0, Math.max(0.3, pt.speed * (isRiver ? 32.0 : 24.0))) * pt.strength;

      // Hydrodynamic Kelvin wake expands laterally as age increases
      const halfWidth = isRiver ? (0.65 + age * 1.5) : (0.22 + age * 0.65);
      const vArmSigma = isRiver ? 0.42 : 0.18;
      const slipSigma = isRiver ? 0.38 : 0.16;

      const perpX = -pt.dirZ;
      const perpZ = pt.dirX;

      // Map point to grid
      const u = (pt.x - minWorldX) / this.worldSize.x;
      const v = (pt.z - minWorldZ) / this.worldSize.y;
      if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) continue;

      const ptGridX = Math.floor(u * s);
      const ptGridY = Math.floor(v * s);

      const radGrid = Math.max(2, Math.ceil((halfWidth * 1.3 / this.worldSize.x) * s));
      const minX = Math.max(1, ptGridX - radGrid);
      const maxX = Math.min(s - 2, ptGridX + radGrid);
      const minY = Math.max(1, ptGridY - radGrid);
      const maxY = Math.min(s - 2, ptGridY + radGrid);

      for (let gy = minY; gy <= maxY; gy++) {
        const cellWorldZ = minWorldZ + (gy / s) * this.worldSize.y;
        for (let gx = minX; gx <= maxX; gx++) {
          const cellWorldX = minWorldX + (gx / s) * this.worldSize.x;

          const dx = cellWorldX - pt.x;
          const dz = cellWorldZ - pt.z;

          // Projection along forward direction: MUST be behind this trail point
          const fwd = dx * pt.dirX + dz * pt.dirZ;
          if (fwd > 0.08) continue; // Zero disturbance ahead

          // Lateral distance
          const lat = dx * perpX + dz * perpZ;
          const absLat = Math.abs(lat);
          if (absLat > halfWidth) continue;

          // Kelvin V-arm crest profile + center slipstream
          const vArm = Math.exp(-Math.pow((absLat - halfWidth * 0.75) / vArmSigma, 2.0));
          const slip = Math.exp(-Math.pow(lat / slipSigma, 2.0)) * Math.max(0.0, 1.0 - age / (isRiver ? 1.0 : 0.75)) * 0.45;

          const intensity = (vArm * 0.95 + slip * 0.6) * fade * velScale;
          if (intensity <= 0.001) continue;

          const sign = lat >= 0 ? 1.0 : -1.0;
          const normDisturb = sign * (vArm * 0.85) * fade * velScale;

          const idx = gy * s + gx;
          this.wakeNormX[idx] += normDisturb * perpX;
          this.wakeNormZ[idx] += normDisturb * perpZ;
          this.wakeAlpha[idx] = Math.min(1.0, this.wakeAlpha[idx] + intensity * 0.65);
        }
      }
    }

    // 3. Update texture data with combined wave + directional wake
    const tex = this.textureData;
    const waveDxScale = isRiver ? 135.0 : 115.0;
    const wakeNormScale = isRiver ? 0.75 : 0.60;

    for (let y = 1; y < s - 1; y++) {
      const row = y * s;
      const rowUp = (y - 1) * s;
      const rowDown = (y + 1) * s;

      for (let x = 1; x < s - 1; x++) {
        const idx = row + x;
        const waveHeight = activeWave[idx];

        // Central difference for interactive splash wave slope
        const waveDx = activeWave[idx + 1] - activeWave[idx - 1];
        const waveDz = activeWave[rowDown + x] - activeWave[rowUp + x];

        // Combine wave normal disturbance with duck directional wake normal
        const totalDx = waveDx + this.wakeNormX[idx] * wakeNormScale;
        const totalDz = waveDz + this.wakeNormZ[idx] * wakeNormScale;

        const pixelIdx = idx * 4;
        // Height packed: 128 center
        tex[pixelIdx] = Math.min(255, Math.max(0, Math.floor(128 + waveHeight * 70)));
        // Normal X: 128 center
        tex[pixelIdx + 1] = Math.min(255, Math.max(0, Math.floor(128 - totalDx * waveDxScale)));
        // Normal Z: 128 center
        tex[pixelIdx + 2] = Math.min(255, Math.max(0, Math.floor(128 - totalDz * waveDxScale)));
        // Wake intensity (subtle translucent slipstream, NOT opaque white blob)
        const crest = Math.min(1.0, Math.abs(waveHeight) * 0.4);
        const wake = this.wakeAlpha[idx];
        tex[pixelIdx + 3] = Math.min(255, Math.max(0, Math.floor(Math.max(crest, wake) * 200)));
      }
    }

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
  }
}
