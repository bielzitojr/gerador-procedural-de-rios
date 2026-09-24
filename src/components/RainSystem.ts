import * as THREE from 'three';
import { ViewMode } from '../types';

export class RainSystem {
  public group: THREE.Group;
  private lineSegments: THREE.LineSegments;
  private positions: Float32Array;
  private velocities: Float32Array;
  private dropLengths: Float32Array;
  private dropCount: number;
  private material: THREE.LineBasicMaterial;
  private splashParticles: THREE.Points;
  private splashPositions: Float32Array;
  private splashOpacities: Float32Array;
  private splashScales: Float32Array;
  private splashMax = 64;
  private nextSplashIdx = 0;

  private currentViewMode: ViewMode = 'river';
  private intensity: number = 1.0;
  private isRaining: boolean = false;
  private currentOpacity: number = 0.0;

  // Bounds for dropping rain
  private areaWidth = 90;
  private areaHeight = 90;
  private topY = 32;
  private bottomY = 0;

  private lastRippleTime = 0;

  constructor(dropCount: number = 2500) {
    this.dropCount = dropCount;
    this.group = new THREE.Group();
    this.group.name = 'rain-system';

    // 1. Rain Drops Geometry (2 vertices per drop: top and bottom)
    const posArray = new Float32Array(dropCount * 2 * 3);
    this.positions = posArray;
    this.velocities = new Float32Array(dropCount);
    this.dropLengths = new Float32Array(dropCount);

    for (let i = 0; i < dropCount; i++) {
      const x = (Math.random() - 0.5) * this.areaWidth;
      const z = (Math.random() - 0.5) * this.areaHeight;
      const y = Math.random() * this.topY;
      const len = 0.4 + Math.random() * 0.45;
      const vel = 18 + Math.random() * 12;

      this.velocities[i] = vel;
      this.dropLengths[i] = len;

      const idx = i * 6;
      // Vertex 0: Top
      posArray[idx] = x;
      posArray[idx + 1] = y + len;
      posArray[idx + 2] = z;

      // Vertex 1: Bottom (slightly tilted by wind)
      posArray[idx + 3] = x + 0.04;
      posArray[idx + 4] = y;
      posArray[idx + 5] = z + 0.03;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.LineBasicMaterial({
      color: 0xbbd8f8,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.lineSegments = new THREE.LineSegments(geometry, this.material);
    this.lineSegments.frustumCulled = false;
    this.group.add(this.lineSegments);

    // 2. Water Surface Splashes (little droplet circles/bursts when hitting water)
    const splashGeom = new THREE.BufferGeometry();
    this.splashPositions = new Float32Array(this.splashMax * 3);
    this.splashOpacities = new Float32Array(this.splashMax);
    this.splashScales = new Float32Array(this.splashMax);

    for (let s = 0; s < this.splashMax; s++) {
      this.splashPositions[s * 3] = 0;
      this.splashPositions[s * 3 + 1] = -100; // hidden initially
      this.splashPositions[s * 3 + 2] = 0;
      this.splashOpacities[s] = 0;
      this.splashScales[s] = 0;
    }

    splashGeom.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));

    // Simple canvas texture for circular splash droplet
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    grad.addColorStop(0, 'rgba(230, 245, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(180, 220, 255, 0.5)');
    grad.addColorStop(1, 'rgba(180, 220, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fill();

    const splashTex = new THREE.CanvasTexture(canvas);

    const splashMat = new THREE.PointsMaterial({
      size: 0.6,
      map: splashTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.splashParticles = new THREE.Points(splashGeom, splashMat);
    this.splashParticles.frustumCulled = false;
    this.group.add(this.splashParticles);
  }

  public setConfig(isRaining: boolean, intensity: number, viewMode: ViewMode) {
    this.isRaining = isRaining;
    this.intensity = THREE.MathUtils.clamp(intensity, 0.1, 2.5);

    if (this.currentViewMode !== viewMode) {
      this.currentViewMode = viewMode;
      this.resetRainBounds();
    }
  }

  private resetRainBounds() {
    if (this.currentViewMode === 'reference_pool') {
      this.areaWidth = 8.5;
      this.areaHeight = 8.5;
      this.topY = 12;
    } else {
      this.areaWidth = 95;
      this.areaHeight = 95;
      this.topY = 32;
    }

    // Redistribute rain drops within the new bounds
    for (let i = 0; i < this.dropCount; i++) {
      const x = (Math.random() - 0.5) * this.areaWidth;
      const z = (Math.random() - 0.5) * this.areaHeight;
      const y = Math.random() * this.topY;
      const len = (this.currentViewMode === 'reference_pool' ? 0.25 : 0.45) + Math.random() * 0.35;

      const idx = i * 6;
      this.positions[idx] = x;
      this.positions[idx + 1] = y + len;
      this.positions[idx + 2] = z;

      this.positions[idx + 3] = x + 0.04;
      this.positions[idx + 4] = y;
      this.positions[idx + 5] = z + 0.03;
    }
    this.lineSegments.geometry.attributes.position.needsUpdate = true;
  }

  private spawnSplash(x: number, z: number) {
    const idx = this.nextSplashIdx;
    this.splashPositions[idx * 3] = x;
    this.splashPositions[idx * 3 + 1] = 0.03;
    this.splashPositions[idx * 3 + 2] = z;
    this.splashOpacities[idx] = 0.8;
    this.splashScales[idx] = 0.2;

    this.nextSplashIdx = (this.nextSplashIdx + 1) % this.splashMax;
  }

  public update(
    delta: number,
    time: number,
    addRipple?: (x: number, z: number, radius: number, strength: number) => void
  ) {
    // Fade in or out based on rain state
    const targetOpacity = this.isRaining ? 0.65 * Math.min(1.0, this.intensity) : 0.0;
    this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, targetOpacity, delta * 3.5);
    this.material.opacity = this.currentOpacity;

    if (this.currentOpacity <= 0.005) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // Number of active drops scales with intensity
    const activeCount = Math.floor(this.dropCount * Math.min(1.0, 0.3 + this.intensity * 0.7));
    const isPool = this.currentViewMode === 'reference_pool';
    const halfW = this.areaWidth * 0.5;
    const halfH = this.areaHeight * 0.5;

    let rippleBudget = Math.floor((isPool ? 1 : 4) * this.intensity);
    const now = time;
    const canSpawnRipple = addRipple && (now - this.lastRippleTime > 0.045);

    const pos = this.positions;

    for (let i = 0; i < activeCount; i++) {
      const vel = this.velocities[i] * (0.8 + this.intensity * 0.3);
      const len = this.dropLengths[i];
      const idx = i * 6;

      let topY = pos[idx + 1] - vel * delta;
      let botY = pos[idx + 4] - vel * delta;

      // Check collision with water plane (Y = 0)
      if (botY <= this.bottomY) {
        const hitX = pos[idx + 3];
        const hitZ = pos[idx + 5];

        // Trigger surface splash particle
        if (Math.random() < 0.25) {
          this.spawnSplash(hitX, hitZ);
        }

        // Trigger physical ripple simulation on the water surface
        if (canSpawnRipple && rippleBudget > 0 && Math.random() < 0.35) {
          this.lastRippleTime = now;
          rippleBudget--;
          const radius = isPool ? 0.22 : 0.95;
          const strength = (isPool ? 0.12 : 0.22) * this.intensity;
          addRipple(hitX, hitZ, radius, strength);
        }

        // Recycle drop back to top with new random position
        const nx = (Math.random() - 0.5) * this.areaWidth;
        const nz = (Math.random() - 0.5) * this.areaHeight;
        botY = this.topY + Math.random() * 4.0;
        topY = botY + len;

        pos[idx] = nx;
        pos[idx + 1] = topY;
        pos[idx + 2] = nz;

        pos[idx + 3] = nx + 0.04;
        pos[idx + 4] = botY;
        pos[idx + 5] = nz + 0.03;
      } else {
        pos[idx + 1] = topY;
        pos[idx + 4] = botY;
      }
    }

    this.lineSegments.geometry.attributes.position.needsUpdate = true;

    // Update splash particles
    const sPos = this.splashPositions;
    for (let s = 0; s < this.splashMax; s++) {
      if (this.splashOpacities[s] > 0) {
        this.splashOpacities[s] -= delta * 3.5;
        if (this.splashOpacities[s] <= 0) {
          this.splashOpacities[s] = 0;
          sPos[s * 3 + 1] = -100; // hide
        }
      }
    }
    this.splashParticles.geometry.attributes.position.needsUpdate = true;
  }

  public dispose() {
    this.lineSegments.geometry.dispose();
    this.material.dispose();
    this.splashParticles.geometry.dispose();
    if (this.splashParticles.material instanceof THREE.Material) {
      this.splashParticles.material.dispose();
    }
  }
}
