import * as THREE from 'three';

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
  private splashVelocitiesY: Float32Array;
  private splashMax = 320;
  private nextSplashIdx = 0;

  private intensity: number = 1.0;
  private isRaining: boolean = false;
  private currentOpacity: number = 0.0;

  // Bounds for dropping rain (optimized for procedural river terrain)
  private areaWidth = 110;
  private areaHeight = 110;
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

    // 2. Micro-splashes discretos na superfície da água
    const splashGeom = new THREE.BufferGeometry();
    this.splashPositions = new Float32Array(this.splashMax * 3);
    this.splashOpacities = new Float32Array(this.splashMax);
    this.splashVelocitiesY = new Float32Array(this.splashMax);

    for (let s = 0; s < this.splashMax; s++) {
      this.splashPositions[s * 3] = 0;
      this.splashPositions[s * 3 + 1] = -100; // escondido inicialmente
      this.splashPositions[s * 3 + 2] = 0;
      this.splashOpacities[s] = 0;
      this.splashVelocitiesY[s] = 0;
    }

    splashGeom.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));

    // Textura refinada para micro-splash (gotícula translúcida e anel sutil)
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Anel externo sutil
    ctx.strokeStyle = 'rgba(215, 245, 255, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(16, 16, 11, 0, Math.PI * 2);
    ctx.stroke();

    // Gotícula central suave
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 5);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.6, 'rgba(210, 240, 255, 0.55)');
    grad.addColorStop(1, 'rgba(190, 230, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 5, 0, Math.PI * 2);
    ctx.fill();

    const splashTex = new THREE.CanvasTexture(canvas);

    const splashMat = new THREE.PointsMaterial({
      size: 0.32,
      map: splashTex,
      transparent: true,
      opacity: 0.70,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.splashParticles = new THREE.Points(splashGeom, splashMat);
    this.splashParticles.frustumCulled = false;
    this.group.add(this.splashParticles);
  }

  public setConfig(isRaining: boolean, intensity: number) {
    this.isRaining = isRaining;
    this.intensity = THREE.MathUtils.clamp(intensity, 0.1, 2.5);
  }

  private spawnSplash(x: number, z: number) {
    const idx = this.nextSplashIdx;
    this.splashPositions[idx * 3] = x;
    this.splashPositions[idx * 3 + 1] = 0.02 + Math.random() * 0.03;
    this.splashPositions[idx * 3 + 2] = z;
    this.splashOpacities[idx] = 0.85;
    this.splashVelocitiesY[idx] = 0.45 + Math.random() * 0.55; // leve impulso vertical discreto

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

    // Quantidade de gotas ativas escala com a intensidade da chuva
    const activeCount = Math.floor(this.dropCount * Math.min(1.0, 0.3 + this.intensity * 0.7));
    let rippleBudget = Math.floor(10 * this.intensity);
    const now = time;
    const canSpawnRipple = addRipple && (now - this.lastRippleTime > 0.022);

    const pos = this.positions;

    for (let i = 0; i < activeCount; i++) {
      const vel = this.velocities[i] * (0.8 + this.intensity * 0.3);
      const len = this.dropLengths[i];
      const idx = i * 6;

      let topY = pos[idx + 1] - vel * delta;
      let botY = pos[idx + 4] - vel * delta;

      // Colisão com o plano da água (Y = 0)
      if (botY <= this.bottomY) {
        const hitX = pos[idx + 3];
        const hitZ = pos[idx + 5];

        // Disparo de micro-splash discreto na água
        if (Math.random() < 0.55) {
          this.spawnSplash(hitX, hitZ);
        }

        // Pequenos círculos de impacto aleatórios na superfície da água
        if (canSpawnRipple && rippleBudget > 0 && Math.random() < 0.45) {
          this.lastRippleTime = now;
          rippleBudget--;
          const radius = 0.22 + Math.random() * 0.28; // pequenos círculos de impacto aleatórios
          const strength = (0.10 + Math.random() * 0.12) * this.intensity;
          addRipple(hitX, hitZ, radius, strength);
        }

        // Recicla a gota de volta ao topo
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

    // Atualização dos micro-splashes discretos
    const sPos = this.splashPositions;
    for (let s = 0; s < this.splashMax; s++) {
      if (this.splashOpacities[s] > 0) {
        // Micro-elevação vertical que sobe suavemente e decai (gravidade leve)
        sPos[s * 3 + 1] += this.splashVelocitiesY[s] * delta;
        this.splashVelocitiesY[s] -= 2.8 * delta;

        this.splashOpacities[s] -= delta * 4.8; // rápida dissipação elegante (~0.18s)
        if (this.splashOpacities[s] <= 0 || sPos[s * 3 + 1] < 0.0) {
          this.splashOpacities[s] = 0;
          sPos[s * 3 + 1] = -100; // esconde
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
