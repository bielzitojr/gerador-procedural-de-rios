import assert from 'node:assert/strict';
import * as THREE from 'three';
import { waterVertexShader, waterFragmentShader } from '../src/shaders/waterShader';
import { createWaterfallMaterial, createWaterfallGeometry } from '../src/procedural/waterfallSurface';
const source = new THREE.ShaderMaterial({vertexShader: waterVertexShader, fragmentShader: waterFragmentShader, uniforms: {uTime: {value: 0}}});
const sheet = createWaterfallMaterial(source, true);
assert.equal(sheet.uniforms, source.uniforms);
source.uniforms.uTime.value = 4;
assert.equal(sheet.uniforms.uTime.value, 4);
assert.ok(sheet.fragmentShader.includes('vCascadeCoord'));
assert.ok(sheet.fragmentShader.includes('vec2 rippleUv = (vWorldPosition.xz'));
for (const height of [6, 16, 28]) {
 const geo = createWaterfallGeometry(12, height, 22, 1337);
 assert.ok(Array.from(geo.attributes.position.array).every(Number.isFinite));
 assert.ok(Array.from(geo.attributes.normal.array).every(Number.isFinite));
 assert.equal(geo.attributes.position.count, geo.attributes.cascadeCoord.count);
 geo.dispose();
}
sheet.dispose(); source.dispose();
console.log('PASS original shader, shared uniforms, real ripple coordinates, curved geometry');
const volume = createWaterfallGeometry(12, 16, 22, 1337);
const points = volume.attributes.position;
// Opposing faces at mid-fall must retain real thickness, even in profile.
const front = new THREE.Vector3().fromBufferAttribute(points, 60 * 81 + 20);
const back = new THREE.Vector3().fromBufferAttribute(points, 60 * 81 + 60);
assert.ok(front.distanceTo(back) > 1, 'waterfall must have volume, not a single sheet');
volume.dispose();
console.log('PASS waterfall side thickness');
