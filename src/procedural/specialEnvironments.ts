import { createWaterfallMaterial, createWaterfallGeometry } from './waterfallSurface';
import * as THREE from 'three';
import { RiverConfig, WaterBodyType } from '../types';
import { RiverData } from './riverMesh';
import { RiverPhysicsManager } from '../physics/riverObjectPhysics';
import { SimplexNoise } from '../utils/noise';

export const SPECIAL_ENVIRONMENTS = {
  waterfall: { label: 'Cachoeiras', description: 'Queda d’água, espuma e névoa' },
  aquatic_cave: { label: 'Cavernas aquáticas', description: 'Salão inundado com arcos rochosos' },
  rainbow: { label: 'Arco-íris', description: 'Espectro colorido sobre uma cascata' },
  grotto: { label: 'Grutas', description: 'Lago abrigado e formações minerais' },
  trench: { label: 'Fossa submarina', description: 'Cânion submerso em corte aberto' },
  underground_river: { label: 'Rios subterrâneos', description: 'Canal sinuoso entre galerias' },
  drips: { label: 'Goteiras', description: 'Estalactites e gotas com ondulações' },
} as const;
export type SpecialMode = keyof typeof SPECIAL_ENVIRONMENTS;
export const isSpecialEnvironment = (mode: WaterBodyType): mode is SpecialMode => mode in SPECIAL_ENVIRONMENTS;

export function generateSpecialEnvironment(config: RiverConfig, waterMaterial: THREE.ShaderMaterial): RiverData {
  const mode = config.waterMode;
  const p = config.environment;
  const noise = new SimplexNoise(config.seed);
  const waterfall = mode === 'waterfall' || mode === 'rainbow';
  const channel = mode === 'underground_river';
  const trench = mode === 'trench';
  const cavern = mode === 'aquatic_cave' || mode === 'grotto' || channel || mode === 'drips';
  const radius = p.scale;
  const height = p.height;
  const random = (i: number) => (Math.sin(i * 127.1 + config.seed * 0.73) * 43758.5453) % 1;
  const unit = (i: number) => Math.abs(random(i));
  const centerX = (z: number) => channel ? Math.sin(z * 0.11 + config.seed) * radius * 0.28 : 0;
  const getTerrainHeight = (x: number, z: number) => {
    const d = channel || trench ? Math.abs(x - centerX(z)) / (radius * 0.48) : Math.hypot(x, z) / radius;
    const basin = THREE.MathUtils.smoothstep(d, 0.62, 1.2);
    let y = THREE.MathUtils.lerp(-p.depth, 3.5, basin) + noise.noise2D(x * 0.15, z * 0.15) * 0.6;
    if (waterfall && z < -radius * 0.65) y = Math.max(y, height - 0.7);
    return y;
  };
  const terrainGeo = new THREE.PlaneGeometry(100, 100, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ color: trench ? '#173b50' : cavern ? '#566675' : '#759c75', roughness: 0.96, flatShading: true });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  const waterGeo = new THREE.PlaneGeometry(100, 100, 80, 80);
  waterGeo.rotateX(-Math.PI / 2);
  const basinMaterial = waterfall ? createWaterfallMaterial(waterMaterial, false) : waterMaterial;
  const waterMesh = new THREE.Mesh(waterGeo, basinMaterial);
  waterMesh.renderOrder = 1;
  const rocksGroup = new THREE.Group();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  if (waterfall) materials.add(basinMaterial);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#647782', roughness: 0.9, flatShading: true });
  materials.add(rockMat);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geo); materials.add(mat);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; rocksGroup.add(mesh); return mesh;
  };
  // Open-front geological cutaways keep the water and interior visible from orbit.
  if (cavern) {
    const count = mode === 'grotto' ? 5 : 9;
    for (let i = 0; i < count; i++) {
      const z = (i / (count - 1) - 0.5) * radius * 1.7;
      const span = channel ? radius * 0.64 : radius * (0.65 + 0.2 * unit(i));
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 16; j++) {
        const a = j / 16 * Math.PI;
        points.push(new THREE.Vector3(centerX(z) + Math.cos(a) * span, Math.sin(a) * height + 1, z));
      }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 1.1 + unit(i + 10), 6, false), rockMat, 0, 0, 0);
    }
    for (let i = 0; i < p.density; i++) {
      const x = (unit(i + 30) - 0.5) * radius * 1.2;
      const z = (unit(i + 90) - 0.5) * radius * 1.7;
      const len = 1 + unit(i + 70) * height * 0.36;
      const roof = height * Math.sqrt(Math.max(0.1, 1 - (x / radius) ** 2)) + 1;
      const tip = add(new THREE.ConeGeometry(0.4 + unit(i + 40), len, 6), rockMat, x, roof - len / 2, z);
      tip.rotation.z = Math.PI;
    }
    const glow = new THREE.MeshStandardMaterial({ color: '#67e5dd', emissive: '#149baf', emissiveIntensity: 0.8, roughness: 0.3 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const x = Math.cos(a) * radius * 0.93, z = Math.sin(a) * radius * 0.93;
      add(new THREE.ConeGeometry(0.6, 2 + unit(i) * 2, 5), glow, x, Math.max(1, getTerrainHeight(x, z)) + 1, z);
    }
  }
  if (trench) {
    // Exposed side walls and deep spires convey depth beneath the transparent surface.
    for (let i = 0; i < p.density; i++) {
      const side = i % 2 ? -1 : 1, z = (unit(i + 10) - 0.5) * 85;
      const x = side * radius * (0.35 + unit(i + 20) * 0.22);
      add(new THREE.ConeGeometry(1.5 + unit(i) * 2, p.depth * 0.7, 5), rockMat, x, -p.depth * 0.65, z);
    }
  }
  const falling: { mesh: THREE.Mesh; x: number; z: number; top: number; phase: number }[] = [];
  const dropMat = new THREE.MeshBasicMaterial({ color: '#b1f6ff', transparent: true, opacity: 0.75 });
  const dropGeo = new THREE.SphereGeometry(0.11, 5, 4);
  geometries.add(dropGeo); materials.add(dropMat);
  if (waterfall) {
    const width = radius * 0.55;
    const curtain = createWaterfallMaterial(waterMaterial, true);
    const sheetGeometry = createWaterfallGeometry(width, height, radius, config.seed);
    materials.add(curtain); geometries.add(sheetGeometry);
    const sheet = new THREE.Mesh(sheetGeometry, curtain);
    sheet.name = 'waterfall-original-water';
    sheet.renderOrder = 2;
    // Hiding waterMesh for the depth pass also hides the entire waterfall.
    waterMesh.add(sheet);
    for (let i = 0; i < p.density * 5; i++) {
      const x = (unit(i + 4) - 0.5) * width;
      const z = -radius * 0.64 + unit(i + 500) * 1.5;
      falling.push({ mesh: add(dropGeo, dropMat, x, 0, z), x, z, top: height, phase: unit(i + 100) });
    }
  } else if (cavern) {
    for (let i = 0; i < p.density; i++) {
      const x = (unit(i + 30) - 0.5) * radius * 1.2, z = (unit(i + 90) - 0.5) * radius * 1.7;
      const top = height * Math.sqrt(Math.max(0.1, 1 - (x / radius) ** 2)) + 1 - (1 + unit(i + 70) * height * 0.36);
      falling.push({ mesh: add(dropGeo, dropMat, x, top, z), x, z, top, phase: unit(i + 100) });
    }
  }
  if (mode === 'rainbow' || (waterfall && p.rainbow)) {
    const colors = ['#ef5350','#ffa726','#ffee58','#66bb6a','#26c6da','#5c6bc0','#ab47bc'];
    colors.forEach((color, i) => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
      const arc = add(new THREE.RingGeometry(radius * 0.58 - i * 0.32, radius * 0.58 - i * 0.32 + 0.4, 96, 1, 0, Math.PI), mat, 0, 1, -radius * 0.2);
      arc.castShadow = false;
    });
  }
  const curve = new THREE.CatmullRomCurve3(Array.from({length: 21}, (_, i) => { const z = (i / 20 - 0.5) * radius * 1.4; return new THREE.Vector3(centerX(z), 0, z); }));
  const getDistanceToRiver = (x: number, z: number) => ({ distance: Math.abs(x - centerX(z)), riverY: 0, t: THREE.MathUtils.clamp(z / (radius * 1.4) + 0.5, 0, 1) });
  const physicsManager = new RiverPhysicsManager();
  const update: RiverData['update'] = (time, delta, ripple) => {
    // All water surfaces share the original live uniforms updated by RiverCanvas.
    for (const drop of falling) {
      const previous = drop.mesh.position.y;
      const phase = (time * p.intensity * (waterfall ? 0.65 : 0.24) + drop.phase) % 1;
      drop.mesh.position.y = drop.top * (1 - phase * phase);
      drop.mesh.scale.setScalar(waterfall ? 0.5 : 1);
      if (drop.mesh.position.y > previous && time > 0.1) ripple?.(drop.x, drop.z, waterfall ? 1.2 : 0.6, 0.35 * p.intensity);
    }
    physicsManager.update(time, delta, config, curve, getDistanceToRiver, getTerrainHeight, ripple);
  };
  return { terrainMesh, waterMesh, rocksGroup, objectsGroup: physicsManager.container, physicsManager, ducks: [], curve, getTerrainHeight, getDistanceToRiver, update, dispose: () => { physicsManager.dispose(); terrainGeo.dispose(); terrainMat.dispose(); waterGeo.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}
