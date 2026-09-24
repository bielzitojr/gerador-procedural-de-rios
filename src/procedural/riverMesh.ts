import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';
import { RiverConfig } from '../types';
import { RiverPhysicsManager, RiverPhysicsObject } from '../physics/riverObjectPhysics';

export interface RiverData {
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  rocksGroup: THREE.Group;
  physicsManager: RiverPhysicsManager;
  objectsGroup: THREE.Group;
  ducks: { group: THREE.Group }[];
  curve: THREE.CatmullRomCurve3;
  getTerrainHeight: (x: number, z: number) => number;
  getDistanceToRiver: (x: number, z: number) => { distance: number; riverY: number; t: number };
  update: (
    time: number,
    delta: number,
    addRipple?: (x: number, z: number, radius: number, strength: number) => void,
    addWake?: (x: number, z: number, dirX: number, dirZ: number, speed: number, strength: number, objectId?: number) => void
  ) => void;
  dispose: () => void;
}

export function generateProceduralRiver(
  config: RiverConfig,
  waterMaterial: THREE.ShaderMaterial
): RiverData {
  const noise = new SimplexNoise(config.seed);
  const terrainSize = 120;
  const segments = 128;
  const halfSize = terrainSize / 2;

  // 1. Generate river spline points across terrain (Z from -halfSize to +halfSize)
  const numSplinePoints = 16;
  const points: THREE.Vector3[] = [];
  const zStep = terrainSize / (numSplinePoints - 1);

  for (let i = 0; i < numSplinePoints; i++) {
    const z = -halfSize + i * zStep;
    const norm = (i / (numSplinePoints - 1)) * 4.0;
    // Curvature controlled by meander and seeded noise
    const xNoise = noise.noise2D(norm * 0.8, config.seed * 0.1);
    const xHarmonic = Math.sin(norm * 1.5 + config.seed) * 0.6;
    const x = (xNoise * 18.0 + xHarmonic * 10.0) * config.meander;

    // Gentle downstream slope (water flows downward along Y)
    const y = -0.5 - (i / numSplinePoints) * 2.0;
    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

  // Pre-sample points along curve for fast continuous distance checks
  const sampleSteps = 250;
  const curvePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= sampleSteps; i++) {
    curvePoints.push(curve.getPoint(i / sampleSteps));
  }

  function getDistanceToRiver(x: number, z: number): { distance: number; riverY: number; t: number } {
    let minSqDist = Infinity;
    let closestY = curvePoints[0].y;
    let closestT = 0;

    for (let i = 0; i < sampleSteps; i++) {
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];

      const segX = p2.x - p1.x;
      const segZ = p2.z - p1.z;
      const segLenSq = segX * segX + segZ * segZ;

      let segT = 0;
      if (segLenSq > 0.000001) {
        const vx = x - p1.x;
        const vz = z - p1.z;
        segT = Math.max(0, Math.min(1, (vx * segX + vz * segZ) / segLenSq));
      }

      const projX = p1.x + segT * segX;
      const projZ = p1.z + segT * segZ;
      const dx = x - projX;
      const dz = z - projZ;
      const sqDist = dx * dx + dz * dz;

      if (sqDist < minSqDist) {
        minSqDist = sqDist;
        closestY = p1.y + segT * (p2.y - p1.y);
        closestT = (i + segT) / sampleSteps;
      }
    }

    return {
      distance: Math.sqrt(minSqDist),
      riverY: closestY,
      t: closestT,
    };
  }

  // 2. Generate Terrain Geometry with carved riverbed
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors: number[] = [];
  const colorAttr = new Float32Array(posAttr.count * 3);

  const grassColor = new THREE.Color('#67b864');
  const grassHighColor = new THREE.Color('#78c872');
  const sandColor = new THREE.Color('#dfd0ae');
  const rockColor = new THREE.Color('#8b95a0');
  const riverbedColor = new THREE.Color('#556b78');

  const halfRiverWidth = config.riverWidth * 0.5;
  const bankWidth = 4.0;
  const riverTrench = Math.max(1.2, config.depth);

  const getTerrainHeight = (x: number, z: number): number => {
    const baseElevation = (noise.fbm(x * 0.025, z * 0.025, 4, 0.45) * 4.0 + 1.2) * config.terrainRoughness;
    const smallBumps = noise.noise2D(x * 0.1, z * 0.1) * 0.4;
    const elevation = Math.max(0.6, baseElevation + smallBumps);

    const riverInfo = getDistanceToRiver(x, z);
    const dist = riverInfo.distance;
    const waterY = riverInfo.riverY;

    if (dist < halfRiverWidth - 0.6) {
      const centerFactor = 1.0 - (dist / Math.max(0.1, halfRiverWidth - 0.6));
      return waterY - (riverTrench * (0.35 + centerFactor * 0.65));
    } else if (dist < halfRiverWidth + bankWidth) {
      const bankT = (dist - (halfRiverWidth - 0.6)) / (bankWidth + 0.6);
      const smoothBank = bankT * bankT * (3.0 - 2.0 * bankT);
      const bedEdgeY = waterY - 0.25;
      const bankTopY = Math.max(waterY + 1.4, elevation);
      return THREE.MathUtils.lerp(bedEdgeY, bankTopY, smoothBank);
    } else {
      return elevation;
    }
  };

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);

    const baseElevation = (noise.fbm(vx * 0.025, vz * 0.025, 4, 0.45) * 4.0 + 1.2) * config.terrainRoughness;
    const smallBumps = noise.noise2D(vx * 0.1, vz * 0.1) * 0.4;
    const elevation = Math.max(0.6, baseElevation + smallBumps);

    const riverInfo = getDistanceToRiver(vx, vz);
    const dist = riverInfo.distance;
    const waterY = riverInfo.riverY;

    // Carve river valley & bed
    let finalY = elevation;
    let vColor = grassColor;

    if (dist < halfRiverWidth - 0.6) {
      // Deep riverbed clearly below waterY
      const centerFactor = 1.0 - (dist / Math.max(0.1, halfRiverWidth - 0.6));
      finalY = waterY - (riverTrench * (0.35 + centerFactor * 0.65));
      vColor = riverbedColor.clone().lerp(sandColor, 0.25);
    } else if (dist < halfRiverWidth + bankWidth) {
      // River bank slope rising from below water up to land
      const bankT = (dist - (halfRiverWidth - 0.6)) / (bankWidth + 0.6);
      const smoothBank = bankT * bankT * (3.0 - 2.0 * bankT); // smoothstep
      const bedEdgeY = waterY - 0.25; // slightly submerged for foam
      const bankTopY = Math.max(waterY + 1.4, elevation);
      finalY = THREE.MathUtils.lerp(bedEdgeY, bankTopY, smoothBank);

      // Blend from sand/wet shore to lush grass
      vColor = sandColor.clone().lerp(grassColor, smoothBank);
    } else {
      // Regular terrain
      finalY = elevation;
      const heightFactor = THREE.MathUtils.clamp((elevation - 1.0) / 4.0, 0, 1);
      vColor = grassColor.clone().lerp(grassHighColor, heightFactor);

      // Steep slopes get rocky color
      if (Math.abs(smallBumps) > 0.35) {
        vColor.lerp(rockColor, 0.4);
      }
    }

    posAttr.setY(i, finalY);

    colorAttr[i * 3] = vColor.r;
    colorAttr[i * 3 + 1] = vColor.g;
    colorAttr[i * 3 + 2] = vColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;

  // 3. Generate River Ribbon Mesh following the curve
  const riverSteps = 180;
  const riverWidthSegs = 24;
  const riverGeo = new THREE.BufferGeometry();

  const rPositions: number[] = [];
  const rNormals: number[] = [];
  const rUvs: number[] = [];
  const rIndices: number[] = [];

  const effectiveRiverWidth = config.riverWidth + 1.2; // slight margin into banks

  for (let i = 0; i <= riverSteps; i++) {
    const t = i / riverSteps;
    const centerPoint = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    // Normal vector perpendicular to tangent on XZ plane
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    for (let j = 0; j <= riverWidthSegs; j++) {
      const u = j / riverWidthSegs; // 0 = left bank, 1 = right bank
      const offset = (u - 0.5) * effectiveRiverWidth;

      const vertexPos = centerPoint.clone().add(side.clone().multiplyScalar(offset));
      // Water sits smoothly in the carved river valley
      vertexPos.y = centerPoint.y;

      rPositions.push(vertexPos.x, vertexPos.y, vertexPos.z);
      rNormals.push(0, 1, 0);

      // UV coordinates: u is lateral (0 to 1 across river), v is downstream along river
      rUvs.push(u, t * (terrainSize / config.riverWidth));
    }
  }

  for (let i = 0; i < riverSteps; i++) {
    for (let j = 0; j < riverWidthSegs; j++) {
      const row1 = i * (riverWidthSegs + 1);
      const row2 = (i + 1) * (riverWidthSegs + 1);

      const a = row1 + j;
      const b = row2 + j;
      const c = row2 + j + 1;
      const d = row1 + j + 1;

      // Correct counter-clockwise winding order so normals point UP (+Y)
      rIndices.push(a, d, b);
      rIndices.push(d, c, b);
    }
  }

  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPositions, 3));
  riverGeo.setAttribute('normal', new THREE.Float32BufferAttribute(rNormals, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
  riverGeo.setIndex(rIndices);

  const waterMesh = new THREE.Mesh(riverGeo, waterMaterial);
  waterMesh.receiveShadow = true;
  waterMesh.renderOrder = 1;

  // 4. Generate Procedural River Rocks and Stones
  const rocksGroup = new THREE.Group();
  const rockColors = [0x9aa0a6, 0x80868b, 0xbdc1c6, 0x6e7681, 0xa39d91];

  const rockGeo1 = new THREE.DodecahedronGeometry(1, 1);
  const rockGeo2 = new THREE.IcosahedronGeometry(1, 1);

  // Deform rocks slightly for organic pebble appearance
  const deformGeometry = (geo: THREE.BufferGeometry) => {
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k);
      const vy = p.getY(k);
      const vz = p.getZ(k);
      const d = 1.0 + Math.sin(vx * 3 + vy * 2) * 0.15;
      p.setXYZ(k, vx * d, vy * (0.6 + Math.cos(vz * 2) * 0.1), vz * d);
    }
    geo.computeVertexNormals();
  };
  deformGeometry(rockGeo1);
  deformGeometry(rockGeo2);

  const numRocks = Math.floor(config.rockDensity);
  for (let r = 0; r < numRocks; r++) {
    const t = 0.08 + (r / numRocks) * 0.84 + (Math.sin(r * 12.3 + config.seed) * 0.04);
    const clampedT = THREE.MathUtils.clamp(t, 0.05, 0.95);
    const centerPoint = curve.getPoint(clampedT);
    const tangent = curve.getTangent(clampedT).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Place rocks partly inside river (causing foam rings!) and along banks
    const lateralFactor = Math.sin(r * 37.1 + config.seed) * 0.9;
    const lateralOffset = lateralFactor * (config.riverWidth * 0.52);

    const rockPos = centerPoint.clone().add(side.clone().multiplyScalar(lateralOffset));
    const rockScale = 0.6 + Math.abs(Math.sin(r * 4.9)) * 1.4;

    const rockMat = new THREE.MeshStandardMaterial({
      color: rockColors[r % rockColors.length],
      roughness: 0.75,
      metalness: 0.08,
      flatShading: true,
    });

    const geo = r % 2 === 0 ? rockGeo1 : rockGeo2;
    const rockMesh = new THREE.Mesh(geo, rockMat);
    rockMesh.scale.set(rockScale, rockScale * 0.85, rockScale * (0.8 + Math.sin(r) * 0.4));
    rockMesh.position.set(rockPos.x, centerPoint.y + rockScale * 0.35 - 0.2, rockPos.z);
    rockMesh.rotation.set(r * 0.6, r * 1.2, r * 0.3);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    rocksGroup.add(rockMesh);
  }

  // Identify rocks in the river current to generate organic ripples across the whole river
  const submergedRocks: { x: number; z: number; scale: number }[] = [];
  for (let r = 0; r < numRocks; r++) {
    const lateralFactor = Math.sin(r * 37.1 + config.seed) * 0.9;
    const lateralOffset = lateralFactor * (config.riverWidth * 0.52);
    if (Math.abs(lateralOffset) < config.riverWidth * 0.42) {
      const t = THREE.MathUtils.clamp(0.08 + (r / numRocks) * 0.84 + (Math.sin(r * 12.3 + config.seed) * 0.04), 0.05, 0.95);
      const cp = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      const sVec = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const pos = cp.clone().add(sVec.clone().multiplyScalar(lateralOffset));
      const s = 0.6 + Math.abs(Math.sin(r * 4.9)) * 1.4;
      submergedRocks.push({ x: pos.x, z: pos.z, scale: s });
    }
  }

  // 5. Instantiated Physical Objects & Rubber Ducks in the river
  const physicsManager = new RiverPhysicsManager();
  const duckCount = Math.max(0, config.duckCount); // Se 0, ZERO patinhos!

  for (let d = 0; d < duckCount; d++) {
    const lateral = (d === 0) ? 0.0 : (Math.sin(d * 5.7) * 0.45);
    const initialT = 0.12 + (d / Math.max(1, duckCount)) * 0.72;
    const point = curve.getPoint(initialT);
    const tangent = curve.getTangent(initialT).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const lateralDist = lateral * (config.riverWidth * 0.38);

    const spawnPos = point.clone().add(side.multiplyScalar(lateralDist));
    spawnPos.y = point.y + 0.12; // Repousa na linha da água
    const currentMultiplier = Math.max(0.2, config.currentStrength ?? 1.2);
    const initialVel = tangent.clone().multiplyScalar(config.flowSpeed * 1.5 * currentMultiplier);

    const duck = physicsManager.spawnObject('duck', spawnPos, initialVel);
    duck.id = `slider_duck_${d}_${Date.now()}`;
  }

  let lastRockTime = 0;

  // Animation update loop for physical objects & river
  const update = (
    time: number,
    delta: number,
    addRipple?: (x: number, z: number, radius: number, strength: number) => void,
    addWake?: (x: number, z: number, dirX: number, dirZ: number, speed: number, strength: number, objectId?: number) => void
  ) => {
    // 1. Atualizar simulação de física de corpos e fluidos
    physicsManager.update(
      time,
      delta,
      config,
      curve,
      getDistanceToRiver,
      getTerrainHeight,
      addRipple,
      addWake
    );

    // 2. Subtle natural ripples around rocks in the river current across the whole river
    if (addRipple && config.flowSpeed > 0.1 && submergedRocks.length > 0) {
      if (time - lastRockTime > 0.38) {
        lastRockTime = time;
        const count = Math.min(2, submergedRocks.length);
        const start = Math.floor(time * 1.5) % submergedRocks.length;
        for (let k = 0; k < count; k++) {
          const rk = submergedRocks[(start + k) % submergedRocks.length];
          if (rk) {
            addRipple(rk.x, rk.z, 1.4 * rk.scale, 0.22 * config.flowSpeed * config.rippleIntensity);
          }
        }
      }
    }
  };

  const dispose = () => {
    physicsManager.dispose();
    terrainGeo.dispose();
    terrainMat.dispose();
    riverGeo.dispose();
    rockGeo1.dispose();
    rockGeo2.dispose();
  };

  return {
    terrainMesh,
    waterMesh,
    rocksGroup,
    physicsManager,
    objectsGroup: physicsManager.container,
    ducks: physicsManager.objects.filter((o) => o.type === 'duck'),
    curve,
    getTerrainHeight,
    getDistanceToRiver,
    update,
    dispose,
  };
}
