import * as THREE from 'three';
import { createDuckMesh } from './DuckModel';

export interface DioramaSceneResult {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  duck: THREE.Group;
  pill1: THREE.Mesh;
  pill2: THREE.Mesh;
  applyDuckImpulse: (strength?: number) => void;
  update: (
    time: number,
    delta: number,
    physics: {
      waterDensity: number;
      buoyancy: number;
      waterViscosity: number;
      rippleIntensity: number;
      duckCount?: number;
    },
    addRipple?: (x: number, z: number, radius: number, strength: number) => void
  ) => void;
}

export function createDioramaPool(waterMaterial: THREE.ShaderMaterial): DioramaSceneResult {
  const group = new THREE.Group();

  // Create checkered prototype grid texture matching Godot reference image
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const tileSize = 64; // 2x2 tiles in texture
  for (let y = 0; y < 128; y += tileSize) {
    for (let x = 0; x < 128; x += tileSize) {
      const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isEven ? '#ffffff' : '#ced5e0';
      ctx.fillRect(x, y, tileSize, tileSize);
      // Clean border lines between prototype tiles
      ctx.strokeStyle = '#9ca9b8';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, tileSize - 3, tileSize - 3);
    }
  }
  const checkTexture = new THREE.CanvasTexture(canvas);
  checkTexture.wrapS = THREE.RepeatWrapping;
  checkTexture.wrapT = THREE.RepeatWrapping;
  checkTexture.repeat.set(8, 8);
  checkTexture.magFilter = THREE.NearestFilter;
  checkTexture.minFilter = THREE.LinearMipmapLinearFilter;

  const poolMaterial = new THREE.MeshStandardMaterial({
    map: checkTexture,
    roughness: 0.5,
    metalness: 0.05,
  });

  const poolSize = 7.6;
  const poolHeight = 4.8;
  const wallThickness = 0.95;
  const halfS = poolSize / 2;
  const wallY = -1.25; // Top rim at +1.15, bottom at -3.65

  // Interior Pool Floor
  const floorGeo = new THREE.BoxGeometry(poolSize, 0.4, poolSize);
  const floor = new THREE.Mesh(floorGeo, poolMaterial);
  floor.position.y = -0.45;
  floor.receiveShadow = true;
  group.add(floor);

  // Bottom plate for the tall floating block in the sky
  const bottomGeo = new THREE.BoxGeometry(poolSize + wallThickness * 2, 0.3, poolSize + wallThickness * 2);
  const bottomPlate = new THREE.Mesh(bottomGeo, poolMaterial);
  bottomPlate.position.y = -3.65;
  bottomPlate.receiveShadow = true;
  group.add(bottomPlate);

  // 4 Outer Walls (tall floating cube)
  const hH = poolHeight;

  // North wall
  const nGeo = new THREE.BoxGeometry(poolSize + wallThickness * 2, hH, wallThickness);
  const nWall = new THREE.Mesh(nGeo, poolMaterial);
  nWall.position.set(0, wallY, -halfS - wallThickness / 2);
  nWall.receiveShadow = true;
  nWall.castShadow = true;
  group.add(nWall);

  // South wall
  const sGeo = new THREE.BoxGeometry(poolSize + wallThickness * 2, hH, wallThickness);
  const sWall = new THREE.Mesh(sGeo, poolMaterial);
  sWall.position.set(0, wallY, halfS + wallThickness / 2);
  sWall.receiveShadow = true;
  sWall.castShadow = true;
  group.add(sWall);

  // West wall
  const wGeo = new THREE.BoxGeometry(wallThickness, hH, poolSize);
  const wWall = new THREE.Mesh(wGeo, poolMaterial);
  wWall.position.set(-halfS - wallThickness / 2, wallY, 0);
  wWall.receiveShadow = true;
  wWall.castShadow = true;
  group.add(wWall);

  // East wall
  const eGeo = new THREE.BoxGeometry(wallThickness, hH, poolSize);
  const eWall = new THREE.Mesh(eGeo, poolMaterial);
  eWall.position.set(halfS + wallThickness / 2, wallY, 0);
  eWall.receiveShadow = true;
  eWall.castShadow = true;
  group.add(eWall);

  // Water Mesh (level at 0.70, exactly 0.45 below pool rim)
  const waterGeo = new THREE.PlaneGeometry(poolSize, poolSize, 96, 96);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
  waterMesh.position.y = 0.70;
  waterMesh.renderOrder = 1;
  group.add(waterMesh);

  // Rubber Duck (positioned in upper right like in the reference, looking toward camera)
  const duck = createDuckMesh();
  duck.scale.set(0.92, 0.92, 0.92);
  duck.position.set(0.6, 0.72, -1.6);
  duck.rotation.y = Math.PI * 0.9; // Facing camera
  group.add(duck);

  // Obstacle 1: Rounded White/Gray Capsule (floating half-submerged on right)
  const pillMat1 = new THREE.MeshStandardMaterial({
    color: 0xedeef2,
    roughness: 0.28,
    metalness: 0.08,
  });
  const pillGeo1 = new THREE.CapsuleGeometry(0.48, 0.8, 16, 24);
  const pill1 = new THREE.Mesh(pillGeo1, pillMat1);
  pill1.rotation.z = Math.PI / 3.2;
  pill1.rotation.x = 0.25;
  pill1.position.set(0.9, 0.62, 0.5);
  pill1.castShadow = true;
  pill1.receiveShadow = true;
  group.add(pill1);

  // Obstacle 2: Solid cyan submerged capsule on bottom-left, fully visible through crystal water
  const pillMat2 = new THREE.MeshStandardMaterial({
    color: 0x4ee2f5,
    roughness: 0.3,
    metalness: 0.05,
  });
  const pillGeo2 = new THREE.CapsuleGeometry(0.42, 0.95, 16, 24);
  const pill2 = new THREE.Mesh(pillGeo2, pillMat2);
  pill2.rotation.z = -0.45;
  pill2.rotation.x = -0.25;
  pill2.position.set(-1.25, 0.22, 0.2);
  pill2.castShadow = true;
  pill2.receiveShadow = true;
  group.add(pill2);

  // Physical state for the Duck (buoyancy, drag, vertical velocity)
  const duckPhysics = {
    y: 0.70,
    vy: 0.0,
    rotX: 0.0,
    rotZ: 0.0,
    vRotX: 0.0,
    vRotZ: 0.0,
    baseX: 0.6,
    baseZ: -1.6,
    lastRippleTime: 0,
  };

  const pill1Physics = {
    y: 0.62,
    vy: 0.0,
  };

  const applyDuckImpulse = (strength: number = -0.55) => {
    duckPhysics.vy += strength;
  };

  // Animation update function with full fluid physics simulation
  const update = (
    time: number,
    delta: number,
    physics: {
      waterDensity: number;
      buoyancy: number;
      waterViscosity: number;
      rippleIntensity: number;
      duckCount?: number;
    },
    addRipple?: (x: number, z: number, radius: number, strength: number) => void
  ) => {
    const isDuckEnabled = (physics.duckCount ?? 1) > 0;
    duck.visible = isDuckEnabled;

    const dt = Math.min(delta, 0.05);
    const waterSurfaceY = 0.70;

    // 1. Duck Buoyancy Physics (Archimedes principle & fluid damping)
    if (isDuckEnabled) {
      // Equilibrium position shifts with water density
      const equilibriumY = waterSurfaceY - 0.08 + (physics.waterDensity - 1.0) * 0.12;
      const submersion = equilibriumY - duckPhysics.y;

      // Buoyant restoring force when submerged
      const kBuoyancy = 24.0 * physics.buoyancy * physics.waterDensity;
      const fBuoyancy = submersion * kBuoyancy;

      // Viscous fluid drag damping
      const fDrag = -duckPhysics.vy * (3.5 * physics.waterViscosity);

      // Natural wave oscillation
      const waveDisplacement = Math.sin(time * 2.6) * 0.03 * (1.0 / physics.waterViscosity);

      duckPhysics.vy += (fBuoyancy + fDrag) * dt;
      duckPhysics.y += duckPhysics.vy * dt;

      duck.position.y = duckPhysics.y + waveDisplacement;

      // Pitch and roll tilt from surface wave motion
      duckPhysics.rotZ = Math.sin(time * 2.2) * 0.04 - duckPhysics.vy * 0.12;
      duckPhysics.rotX = Math.cos(time * 2.0) * 0.03;
      duck.rotation.z = duckPhysics.rotZ;
      duck.rotation.x = duckPhysics.rotX;

      // 2. Ripple generation only on heavy plunge impact (never on gentle idle floating)
      if (addRipple && Math.abs(duckPhysics.vy) > 0.95) {
        if (time - duckPhysics.lastRippleTime > 0.25) {
          duckPhysics.lastRippleTime = time;
          const rippleStrength = Math.min(2.0, Math.abs(duckPhysics.vy) * 1.5) * physics.rippleIntensity;
          addRipple(duck.position.x, duck.position.z, 0.5, rippleStrength);
        }
      }
    }

    // 3. Floating Capsule (pill1) Buoyancy
    const pillEquilibrium = 0.60 + (physics.waterDensity - 1.0) * 0.08;
    const pillSubmersion = pillEquilibrium - pill1Physics.y;
    pill1Physics.vy += (pillSubmersion * 18.0 * physics.buoyancy - pill1Physics.vy * 3.0 * physics.waterViscosity) * dt;
    pill1Physics.y += pill1Physics.vy * dt;
    pill1.position.y = pill1Physics.y + Math.sin(time * 2.1 + 1.0) * 0.025;

    // 4. Submerged Capsule (pill2) gentle underwater flow response
    pill2.position.y = 0.22 + Math.sin(time * 1.3 + 2.0) * 0.015 * (1.0 / Math.max(0.5, physics.waterViscosity));
  };

  return { group, waterMesh, duck, pill1, pill2, applyDuckImpulse, update };
}
