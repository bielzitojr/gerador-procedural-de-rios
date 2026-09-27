import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateSpecialEnvironment, SPECIAL_ENVIRONMENTS } from '../src/procedural/specialEnvironments';
import type { RiverConfig } from '../src/types';
const material = new THREE.ShaderMaterial();
for (const mode of Object.keys(SPECIAL_ENVIRONMENTS)) {
  for (const scale of [12, 32]) {
    const config = { waterMode: mode, seed: 1337, environment: { scale, height: scale === 12 ? 6 : 28, depth: 26, density: 48, intensity: 2.5, rainbow: true }, riverWidth: 8.5, flowSpeed: 1, currentStrength: 1.2, waterDensity: 1, waterViscosity: 0.8 } as RiverConfig;
    const scene = generateSpecialEnvironment(config, material);
    const positions = scene.terrainMesh.geometry.attributes.position.array;
    assert.ok(Array.from(positions).every(Number.isFinite), mode + ': finite terrain');
    assert.ok(scene.rocksGroup.children.length > 0, mode + ': has distinct geometry');
    const repeat = generateSpecialEnvironment(config, material);
    assert.deepEqual(repeat.terrainMesh.geometry.attributes.position.array, positions, mode + ': reproducible seed');
    repeat.dispose();
    let ripples = 0;
    for (let frame = 0; frame < 120; frame++) scene.update(frame / 30, 1 / 30, () => ripples++);
    if (mode !== 'trench') assert.ok(ripples > 0, mode + ': water impacts animate');
    let disposed = 0;
    scene.terrainMesh.geometry.addEventListener('dispose', () => disposed++);
    scene.dispose(); assert.equal(disposed, 1);
  }
  console.log('PASS', mode, 'extreme controls, deterministic terrain, animation, disposal');
}
material.dispose();
