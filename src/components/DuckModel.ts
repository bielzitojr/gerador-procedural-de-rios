import * as THREE from 'three';

export interface DuckInstance {
  group: THREE.Group;
  progress: number; // 0 to 1 along river curve
  speed: number;
  lateralOffset: number; // -1 to 1 across river width
  bobPhase: number;
}

export function createDuckMesh(): THREE.Group {
  const duck = new THREE.Group();

  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd000,
    roughness: 0.35,
    metalness: 0.05,
  });

  const beakMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6a00,
    roughness: 0.4,
    metalness: 0.05,
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.2,
  });

  const eyeReflectionMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  // Body (stretched sphere)
  const bodyGeo = new THREE.SphereGeometry(0.7, 24, 20);
  bodyGeo.scale(1, 0.8, 1.25);
  const body = new THREE.Mesh(bodyGeo, bodyMaterial);
  body.position.y = 0.25;
  body.castShadow = true;
  duck.add(body);

  // Tail (cone at back)
  const tailGeo = new THREE.ConeGeometry(0.28, 0.5, 16);
  const tail = new THREE.Mesh(tailGeo, bodyMaterial);
  tail.rotation.x = -Math.PI / 3;
  tail.position.set(0, 0.4, -0.85);
  duck.add(tail);

  // Chest / Neck
  const neckGeo = new THREE.CylinderGeometry(0.38, 0.52, 0.45, 20);
  const neck = new THREE.Mesh(neckGeo, bodyMaterial);
  neck.position.set(0, 0.65, 0.4);
  neck.rotation.x = 0.15;
  duck.add(neck);

  // Head
  const headGeo = new THREE.SphereGeometry(0.48, 24, 20);
  headGeo.scale(0.95, 0.9, 0.95);
  const head = new THREE.Mesh(headGeo, bodyMaterial);
  head.position.set(0, 1.05, 0.45);
  head.castShadow = true;
  duck.add(head);

  // Beak
  const beakGeo = new THREE.CylinderGeometry(0.12, 0.24, 0.35, 16);
  beakGeo.scale(1.2, 0.45, 1.0);
  const beak = new THREE.Mesh(beakGeo, beakMaterial);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.98, 0.92);
  duck.add(beak);

  // Lower beak lip
  const lowerBeakGeo = new THREE.CylinderGeometry(0.08, 0.18, 0.25, 16);
  lowerBeakGeo.scale(1.0, 0.3, 0.8);
  const lowerBeak = new THREE.Mesh(lowerBeakGeo, beakMaterial);
  lowerBeak.rotation.x = Math.PI / 2;
  lowerBeak.position.set(0, 0.91, 0.88);
  duck.add(lowerBeak);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.07, 12, 12);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  leftEye.position.set(0.26, 1.15, 0.72);
  duck.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  rightEye.position.set(-0.26, 1.15, 0.72);
  duck.add(rightEye);

  // Eye highlight
  const glintGeo = new THREE.SphereGeometry(0.022, 8, 8);
  const leftGlint = new THREE.Mesh(glintGeo, eyeReflectionMaterial);
  leftGlint.position.set(0.28, 1.18, 0.76);
  duck.add(leftGlint);

  const rightGlint = new THREE.Mesh(glintGeo, eyeReflectionMaterial);
  rightGlint.position.set(-0.24, 1.18, 0.76);
  duck.add(rightGlint);

  // Wings
  const wingGeo = new THREE.SphereGeometry(0.35, 16, 14);
  wingGeo.scale(0.3, 0.6, 1.1);

  const leftWing = new THREE.Mesh(wingGeo, bodyMaterial);
  leftWing.position.set(0.68, 0.42, 0.05);
  leftWing.rotation.z = -0.15;
  duck.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, bodyMaterial);
  rightWing.position.set(-0.68, 0.42, 0.05);
  rightWing.rotation.z = 0.15;
  duck.add(rightWing);

  // Overall scale
  duck.scale.set(1.1, 1.1, 1.1);

  return duck;
}
