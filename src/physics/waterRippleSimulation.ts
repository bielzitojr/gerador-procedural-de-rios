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
  private smoothAlpha: Float32Array;
  private smoothNormX: Float32Array;
  private smoothNormZ: Float32Array;
  private textureData: Uint8Array;
  public texture: THREE.DataTexture;

  public worldCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  public worldSize: THREE.Vector2 = new THREE.Vector2(130, 130);

  private isBuffer1Current: boolean = true;

  // Polyline wake trail history per moving object
  private objectTrails: Map<number, WakePoint[]> = new Map();
  private lastSamplePosMap: Map<number, THREE.Vector2> = new Map();

  constructor(size: number = 384, worldWidth: number = 130, worldHeight: number = 130) {
    this.size = size;
    this.worldSize.set(worldWidth, worldHeight);

    const totalCells = size * size;
    this.buffer1 = new Float32Array(totalCells);
    this.buffer2 = new Float32Array(totalCells);
    this.wakeNormX = new Float32Array(totalCells);
    this.wakeNormZ = new Float32Array(totalCells);
    this.wakeAlpha = new Float32Array(totalCells);
    this.smoothAlpha = new Float32Array(totalCells);
    this.smoothNormX = new Float32Array(totalCells);
    this.smoothNormZ = new Float32Array(totalCells);
    this.textureData = new Uint8Array(totalCells * 4);

    // Initialize neutral texture (128 = 0 displacement, 128 = neutral normal, 0 = wake)
    for (let i = 0; i < totalCells; i++) {
      const idx = i * 4;
      this.textureData[idx] = 128; // Height
      this.textureData[idx + 1] = 128; // Normal X
      this.textureData[idx + 2] = 128; // Normal Z
      this.textureData[idx + 3] = 0; // Wake / aeration density
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
    this.texture.generateMipmaps = false;
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
   * Registers moving object movement for a continuous, smooth, hydrodynamic wake trail ("rastro").
   * Connects points into smooth ribbon segments and injects gentle physical motion impulses into the water.
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
    if (len < 0.0001 || speed < 0.12) return;
    const nx = dirX / len;
    const nz = dirZ / len;

    // Stern displacement (wake originates at rear contact of the floating body)
    const offsetBack = 0.42;
    const sternX = worldX - nx * offsetBack;
    const sternZ = worldZ - nz * offsetBack;

    let trail = this.objectTrails.get(objectId);
    if (!trail) {
      trail = [];
      this.objectTrails.set(objectId, trail);
    }

    let lastPos = this.lastSamplePosMap.get(objectId);
    if (!lastPos) {
      lastPos = new THREE.Vector2(-9999, -9999);
      this.lastSamplePosMap.set(objectId, lastPos);
    }

    const distFromLast = Math.hypot(sternX - lastPos.x, sternZ - lastPos.y);
    const minStepDist = 0.12; // High spatial sampling for ultra-smooth continuous ribbon

    // Se o objeto saltou mais de 2.5m (ex: patinho atingiu o final do percurso e recirculou para o topo do rio),
    // trata-se de um teleporte/looping! Limpar o rastro imediatamente para não traçar uma linha através do rio todo!
    if (distFromLast > 2.5 && lastPos.x !== -9999) {
      trail.length = 0;
      lastPos.set(sternX, sternZ);
    }

    if (distFromLast >= minStepDist || trail.length === 0) {
      lastPos.set(sternX, sternZ);
      trail.unshift({
        x: sternX,
        z: sternZ,
        dirX: nx,
        dirZ: nz,
        speed,
        strength,
        age: 0.0,
      });

      const maxPoints = 55;
      if (trail.length > maxPoints) {
        trail.pop();
      }
    } else if (trail.length > 0) {
      // Smoothly update head position and heading
      trail[0].x = sternX;
      trail[0].z = sternZ;
      trail[0].dirX = nx;
      trail[0].dirZ = nz;
      trail[0].speed = speed;
      trail[0].strength = strength;
    }

    // Gentle physical water displacement: moving body creates shallow-water waves
    const halfW = this.worldSize.x / 2;
    const halfH = this.worldSize.y / 2;
    const u = (worldX - (this.worldCenter.x - halfW)) / this.worldSize.x;
    const v = (worldZ - (this.worldCenter.y - halfH)) / this.worldSize.y;

    if (u > 0.01 && u < 0.99 && v > 0.01 && v < 0.99) {
      const gx = Math.floor(u * this.size);
      const gy = Math.floor(v * this.size);
      const curBuf = this.isBuffer1Current ? this.buffer1 : this.buffer2;
      const motionImpulse = Math.min(0.24, speed * 0.06) * strength;
      const idx = gy * this.size + gx;
      curBuf[idx] += motionImpulse * 0.35;
    }
  }

  public update(damping: number = 0.975, delta: number = 0.016) {
    const current = this.isBuffer1Current ? this.buffer1 : this.buffer2;
    const next = this.isBuffer1Current ? this.buffer2 : this.buffer1;
    const s = this.size;

    // 1. Wave equation solver for real propagating physical water ripples
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

    // 2. Advance and rasterize continuous hydrodynamic wake ribbons
    const maxAge = 2.2;
    const dt = Math.min(0.04, Math.max(0.005, delta));

    // Clear wake buffers
    this.wakeNormX.fill(0);
    this.wakeNormZ.fill(0);
    this.wakeAlpha.fill(0);

    const halfW = this.worldSize.x / 2;
    const halfH = this.worldSize.y / 2;
    const minWorldX = this.worldCenter.x - halfW;
    const minWorldZ = this.worldCenter.y - halfH;

    // Update trails and rasterize continuous ribbon segments
    for (const [, trail] of this.objectTrails.entries()) {
      // Age trail nodes and drift slightly downstream (+Z)
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += dt;
        trail[i].z += dt * (trail[i].speed * 0.12); // gentle current drift
        if (trail[i].age > maxAge) {
          trail.splice(i, 1);
        }
      }

      if (trail.length < 2) continue;

      // Rasterize continuous segments between consecutive points
      for (let k = 0; k < trail.length - 1; k++) {
        const p0 = trail[k];
        const p1 = trail[k + 1];

        const segDx = p1.x - p0.x;
        const segDz = p1.z - p0.z;
        const segLenSq = segDx * segDx + segDz * segDz;
        // Ignora segmentos degenerados ou maiores que 2.5m (proteção absoluta contra teleporte entre o fim e o topo do rio)
        if (segLenSq < 0.00001 || segLenSq > 6.25) continue;

        const segAvgAge = (p0.age + p1.age) * 0.5;
        // Alcance lateral suavemente expansivo que acompanha a abertura do formato em V
        const maxLateralReach = 0.42 + segAvgAge * 0.72;

        // Bounding box of segment in world coords
        const minSegX = Math.min(p0.x, p1.x) - maxLateralReach;
        const maxSegX = Math.max(p0.x, p1.x) + maxLateralReach;
        const minSegZ = Math.min(p0.z, p1.z) - maxLateralReach;
        const maxSegZ = Math.max(p0.z, p1.z) + maxLateralReach;

        // Map to grid bounds
        const minGX = Math.max(1, Math.floor(((minSegX - minWorldX) / this.worldSize.x) * s));
        const maxGX = Math.min(s - 2, Math.ceil(((maxSegX - minWorldX) / this.worldSize.x) * s));
        const minGY = Math.max(1, Math.floor(((minSegZ - minWorldZ) / this.worldSize.y) * s));
        const maxGY = Math.min(s - 2, Math.ceil(((maxSegZ - minWorldZ) / this.worldSize.y) * s));

        for (let gy = minGY; gy <= maxGY; gy++) {
          const cellZ = minWorldZ + (gy / s) * this.worldSize.y;
          for (let gx = minGX; gx <= maxGX; gx++) {
            const cellX = minWorldX + (gx / s) * this.worldSize.x;

            // Project point onto segment
            const t = THREE.MathUtils.clamp(
              ((cellX - p0.x) * segDx + (cellZ - p0.z) * segDz) / segLenSq,
              0.0,
              1.0
            );

            const projX = p0.x + segDx * t;
            const projZ = p0.z + segDz * t;

            // Interpolated attributes along segment
            const age = p0.age * (1 - t) + p1.age * t;
            const speed = p0.speed * (1 - t) + p1.speed * t;
            const strength = p0.strength * (1 - t) + p1.strength * t;

            const dirX = p0.dirX * (1 - t) + p1.dirX * t;
            const dirZ = p0.dirZ * (1 - t) + p1.dirZ * t;
            const dirLen = Math.hypot(dirX, dirZ);
            if (dirLen < 0.0001) continue;
            const ndx = dirX / dirLen;
            const ndz = dirZ / dirLen;

            const perpX = -ndz;
            const perpZ = ndx;

            const dx = cellX - projX;
            const dz = cellZ - projZ;

            // Distância lateral da linha central de deslocamento
            const lateral = dx * perpX + dz * perpZ;
            const absLat = Math.abs(lateral);

            // 1. Duas Ondas Laterais em "V" Suave (Kelvin Wake estilizado):
            // O pico de cada crista lateral se afasta do centro suavemente com a idade/distância para trás
            const vOffset = 0.20 + age * 0.48;
            const waveWidth = 0.16 + age * 0.13;
            const dFromPeak = absLat - vOffset;
            const lateralWave = Math.exp(-0.5 * Math.pow(dFromPeak / waveWidth, 2.0));

            // 2. Perturbação Central Curta (imediatamente atrás da popa do pato):
            // Ativa apenas por um curto período e decai rapidamente
            const centerDuration = 0.52;
            const centerFade = Math.max(0.0, 1.0 - age / centerDuration);
            const centerDisturb = Math.exp(-0.5 * Math.pow(absLat / 0.22, 2.0)) * Math.pow(centerFade, 1.4);

            // 3. Desaparecimento progressivo, contínuo e elegante
            const fade = Math.pow(Math.max(0.0, 1.0 - age / maxAge), 1.35);
            const combinedProfile = (lateralWave * 0.88 + centerDisturb * 0.72) * fade;

            const intensity =
              combinedProfile *
              Math.min(1.2, Math.max(0.35, speed * 0.85)) *
              strength *
              0.58;

            if (intensity > 0.003) {
              const idx = gy * s + gx;
              this.wakeAlpha[idx] = Math.max(this.wakeAlpha[idx], Math.min(1.0, intensity));

              // Perturbação física da normal: inclinação da onda em V e dispersão da perturbação central
              // Garante que a luz e o brilho peguem na onda em qualquer ângulo de câmera
              const sign = lateral >= 0 ? 1.0 : -1.0;
              const slopeLateral = -sign * (dFromPeak / waveWidth) * lateralWave * 0.28;
              const slopeCenter = -sign * (absLat / 0.22) * centerDisturb * 0.24;
              const totalSlope = (slopeLateral + slopeCenter) * fade * 0.38;

              this.wakeNormX[idx] += totalSlope * perpX;
              this.wakeNormZ[idx] += totalSlope * perpZ;
            }
          }
        }
      }
    }

    // 3. Fast 3x3 Smooth Box Blur Filter on wake buffers to eliminate any discrete grid artifacts
    for (let y = 1; y < s - 1; y++) {
      const row = y * s;
      const rowUp = (y - 1) * s;
      const rowDown = (y + 1) * s;

      for (let x = 1; x < s - 1; x++) {
        const idx = row + x;
        // Weighted 3x3 kernel
        const a =
          this.wakeAlpha[idx] * 4.0 +
          (this.wakeAlpha[idx - 1] + this.wakeAlpha[idx + 1] + this.wakeAlpha[rowUp + x] + this.wakeAlpha[rowDown + x]) * 2.0 +
          (this.wakeAlpha[rowUp + x - 1] + this.wakeAlpha[rowUp + x + 1] + this.wakeAlpha[rowDown + x - 1] + this.wakeAlpha[rowDown + x + 1]) * 1.0;
        this.smoothAlpha[idx] = a / 16.0;

        const nx =
          this.wakeNormX[idx] * 4.0 +
          (this.wakeNormX[idx - 1] + this.wakeNormX[idx + 1] + this.wakeNormX[rowUp + x] + this.wakeNormX[rowDown + x]) * 2.0 +
          (this.wakeNormX[rowUp + x - 1] + this.wakeNormX[rowUp + x + 1] + this.wakeNormX[rowDown + x - 1] + this.wakeNormX[rowDown + x + 1]) * 1.0;
        this.smoothNormX[idx] = nx / 16.0;

        const nz =
          this.wakeNormZ[idx] * 4.0 +
          (this.wakeNormZ[idx - 1] + this.wakeNormZ[idx + 1] + this.wakeNormZ[rowUp + x] + this.wakeNormZ[rowDown + x]) * 2.0 +
          (this.wakeNormZ[rowUp + x - 1] + this.wakeNormZ[rowUp + x + 1] + this.wakeNormZ[rowDown + x - 1] + this.wakeNormZ[rowDown + x + 1]) * 1.0;
        this.smoothNormZ[idx] = nz / 16.0;
      }
    }

    // 4. Pack into Texture Data
    const tex = this.textureData;
    const waveDxScale = 120.0;
    const wakeNormScale = 0.70;

    for (let y = 1; y < s - 1; y++) {
      const row = y * s;
      const rowUp = (y - 1) * s;
      const rowDown = (y + 1) * s;

      for (let x = 1; x < s - 1; x++) {
        const idx = row + x;
        const waveHeight = activeWave[idx];

        // Central difference for splash wave normal slope
        const waveDx = activeWave[idx + 1] - activeWave[idx - 1];
        const waveDz = activeWave[rowDown + x] - activeWave[rowUp + x];

        // Combine wave normal disturbance with smoothed duck wake normal
        const totalDx = waveDx + this.smoothNormX[idx] * wakeNormScale;
        const totalDz = waveDz + this.smoothNormZ[idx] * wakeNormScale;

        const pixelIdx = idx * 4;
        // Channel R: Height packed (128 = 0)
        tex[pixelIdx] = Math.min(255, Math.max(0, Math.floor(128 + waveHeight * 65)));
        // Channel G: Normal X (128 = 0)
        tex[pixelIdx + 1] = Math.min(255, Math.max(0, Math.floor(128 - totalDx * waveDxScale)));
        // Channel B: Normal Z (128 = 0)
        tex[pixelIdx + 2] = Math.min(255, Math.max(0, Math.floor(128 - totalDz * waveDxScale)));
        // Channel A: Continuous anti-aliased wake aeration density (0 to 255)
        const crest = Math.min(1.0, Math.abs(waveHeight) * 0.35);
        const wake = this.smoothAlpha[idx];
        const combinedAlpha = Math.max(crest, wake);
        tex[pixelIdx + 3] = Math.min(255, Math.max(0, Math.floor(combinedAlpha * 255)));
      }
    }

    this.texture.needsUpdate = true;
  }

  public clearWake(objectId?: number) {
    if (objectId !== undefined) {
      this.objectTrails.delete(objectId);
      this.lastSamplePosMap.delete(objectId);
    } else {
      this.objectTrails.clear();
      this.lastSamplePosMap.clear();
      this.wakeNormX.fill(0);
      this.wakeNormZ.fill(0);
      this.wakeAlpha.fill(0);
    }
  }

  public dispose() {
    this.texture.dispose();
  }
}
