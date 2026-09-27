import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';
import { RiverConfig } from '../types';
import { RiverPhysicsManager, RiverRockObstacle } from '../physics/riverObjectPhysics';

export interface LakeData {
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  rocksGroup: THREE.Group;
  physicsManager: RiverPhysicsManager;
  objectsGroup: THREE.Group;
  ducks: { group: THREE.Group }[];
  curve?: THREE.CatmullRomCurve3;
  getTerrainHeight: (x: number, z: number) => number;
  getDistanceToLake: (x: number, z: number) => { distance: number; lakeY: number; inside: boolean };
  update: (
    time: number,
    delta: number,
    addRipple?: (x: number, z: number, radius: number, strength: number) => void,
    addWake?: (x: number, z: number, dirX: number, dirZ: number, speed: number, strength: number, objectId?: number) => void,
    clearWake?: (objectId: number) => void
  ) => void;
  dispose: () => void;
}

/**
 * Geração Procedural de Bacia Lacustre (Lago Natural com Margens Orgânicas & Ilhotas)
 */
export function generateProceduralLake(
  config: RiverConfig,
  waterMaterial: THREE.ShaderMaterial
): LakeData {
  const lakeParams = config.lake ?? {
    lakeRadius: 30,
    lakeDepth: 3.5,
    lakeIrregularity: 0.75,
    lakeIslandCount: 1,
    lakeCalmness: 1.0,
    lakeRockDensity: 18,
    lakeSeed: 4242,
  };

  const seed = lakeParams.lakeSeed ?? 4242;
  const noise = new SimplexNoise(seed);
  const terrainSize = 120;
  const segments = 128;
  const halfSize = terrainSize / 2;

  const baseRadius = lakeParams.lakeRadius;
  const lakeDepth = lakeParams.lakeDepth;
  const irregularity = lakeParams.lakeIrregularity;
  const islandCount = lakeParams.lakeIslandCount;
  const rockDensity = lakeParams.lakeRockDensity;

  // Centro do lago ligeiramente deslocado pela semente para naturalidade
  const centerX = (noise.noise2D(seed * 0.05, 12.3) - 0.5) * 6.0;
  const centerZ = (noise.noise2D(34.5, seed * 0.05) - 0.5) * 6.0;
  const waterLevel = 0.0;

  // Distância e contorno orgânico da borda do lago
  function getLakeRadiusAtAngle(angle: number): number {
    const n1 = noise.noise2D(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8) * 0.45;
    const n2 = noise.noise2D(Math.cos(angle * 2.5) * 2.2 + 5.1, Math.sin(angle * 2.5) * 2.2 + 2.7) * 0.25;
    const n3 = Math.sin(angle * 3.0 + seed) * 0.15;
    const mod = 1.0 + (n1 + n2 + n3) * irregularity;
    return Math.max(8.0, baseRadius * mod);
  }

  function getDistanceToLake(x: number, z: number): { distance: number; lakeY: number; inside: boolean } {
    const dx = x - centerX;
    const dz = z - centerZ;
    const distToCenter = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const rimRadius = getLakeRadiusAtAngle(angle);

    const inside = distToCenter < rimRadius;
    const distanceToRim = Math.abs(distToCenter - rimRadius);

    return {
      distance: distanceToRim,
      lakeY: waterLevel,
      inside,
    };
  }

  // Ilhotas dentro do lago
  interface Island {
    x: number;
    z: number;
    radius: number;
    height: number;
  }
  const islands: Island[] = [];
  if (islandCount > 0) {
    for (let i = 0; i < islandCount; i++) {
      const islAngle = (i / islandCount) * Math.PI * 2 + (seed % 10);
      const islDist = (baseRadius * 0.35) * (0.6 + 0.4 * Math.sin(i * 3.1 + seed));
      const ix = centerX + Math.cos(islAngle) * islDist;
      const iz = centerZ + Math.sin(islAngle) * islDist;
      const islRadius = 3.5 + Math.abs(noise.noise2D(i * 2.1, 7.8)) * 3.0;
      islands.push({
        x: ix,
        z: iz,
        radius: islRadius,
        height: 1.2 + Math.abs(noise.noise2D(i * 1.5, 9.4)) * 1.5,
      });
    }
  }

  // 1. Geração do Terreno com a Bacia Lacustre Escavada
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colorAttr = new Float32Array(posAttr.count * 3);

  const grassColor = new THREE.Color('#68bd65');
  const grassHighColor = new THREE.Color('#7ecf75');
  const sandColor = new THREE.Color('#dfd1af');
  const rockColor = new THREE.Color('#8b95a0');
  const lakebedColor = new THREE.Color('#465d6c');

  function getTerrainHeight(x: number, z: number): number {
    const dx = x - centerX;
    const dz = z - centerZ;
    const distToCenter = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const rimRadius = getLakeRadiusAtAngle(angle);

    // Relevo montanhoso / colinar ao redor
    const hill1 = noise.noise2D(x * 0.022, z * 0.022) * 5.5;
    const hill2 = noise.noise2D(x * 0.055 + 10.0, z * 0.055 + 10.0) * 2.0;
    const micro = noise.noise2D(x * 0.12, z * 0.12) * 0.6;
    const ambientTerrain = Math.max(0.5, (hill1 + hill2 + micro + 3.0) * 0.85);

    // Bacia do lago
    if (distToCenter < rimRadius) {
      // Dentro do lago: depressão em tigela natural
      const normDist = distToCenter / rimRadius;
      let depthProfile = -Math.cos(normDist * (Math.PI / 2)) * lakeDepth;

      // Adicionar ilhotas se houver
      for (const isl of islands) {
        const dIsl = Math.hypot(x - isl.x, z - isl.z);
        if (dIsl < isl.radius) {
          const islFactor = Math.cos((dIsl / isl.radius) * (Math.PI / 2));
          depthProfile += isl.height * Math.pow(islFactor, 1.8);
        }
      }

      return depthProfile;
    } else {
      // Margem e subida suave para as colinas
      const margin = distToCenter - rimRadius;
      const blend = Math.min(1.0, margin / 14.0);
      const shoreSlope = margin * 0.35;
      return THREE.MathUtils.lerp(0.1 + shoreSlope, ambientTerrain, blend);
    }
  }

  // Preencher alturas e coloração de vértices
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);

    const dx = x - centerX;
    const dz = z - centerZ;
    const distToCenter = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const rimRadius = getLakeRadiusAtAngle(angle);

    let vColor = grassColor.clone();

    if (distToCenter < rimRadius) {
      const depth = waterLevel - y;
      if (depth > 0.05) {
        // Leito do lago submerso
        const t = Math.min(1.0, depth / (lakeDepth * 0.8));
        vColor = sandColor.clone().lerp(lakebedColor, t);
      } else {
        // Ponto da ilhota acima da água
        vColor = sandColor.clone().lerp(grassHighColor, 0.6);
      }
    } else {
      const margin = distToCenter - rimRadius;
      if (margin < 3.2) {
        // Praia de areia e seixos na margem do lago
        const t = margin / 3.2;
        vColor = sandColor.clone().lerp(grassColor, t);
      } else {
        // Colinas gramadas com rochas nos pontos mais altos
        const hNorm = Math.max(0.0, Math.min(1.0, (y - 2.0) / 6.0));
        vColor = grassColor.clone().lerp(grassHighColor, hNorm * 0.6);
        if (y > 4.5) {
          vColor.lerp(rockColor, (y - 4.5) / 2.5);
        }
      }
    }

    colorAttr[i * 3] = vColor.r;
    colorAttr[i * 3 + 1] = vColor.g;
    colorAttr[i * 3 + 2] = vColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'ProceduralLakeTerrain';
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;

  // 2. Malha de Água do Lago (Superfície Translúcida com Shader Toon)
  const lakeWaterSize = baseRadius * 2.6;
  const lakeWaterGeo = new THREE.PlaneGeometry(lakeWaterSize, lakeWaterSize, 80, 80);
  lakeWaterGeo.rotateX(-Math.PI / 2);

  const waterMesh = new THREE.Mesh(lakeWaterGeo, waterMaterial);
  waterMesh.name = 'ProceduralLakeWater';
  waterMesh.position.set(centerX, waterLevel, centerZ);
  waterMesh.receiveShadow = true;

  // 3. Pedras Naturais nas Margens do Lago
  const rocksGroup = new THREE.Group();
  rocksGroup.name = 'LakeMarginalRocks';

  const rockGeoBase = new THREE.DodecahedronGeometry(1, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#828c94',
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });

  const rockObstacles: RiverRockObstacle[] = [];
  const rockCount = Math.floor(rockDensity * 0.9);

  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + (noise.noise2D(i * 1.7, seed) * 0.4);
    const rim = getLakeRadiusAtAngle(angle);
    // Posiciona rochas tocando a linha d'água na margem
    const dist = rim + (noise.noise2D(i * 3.4, seed * 2.1) - 0.45) * 3.0;
    const rx = centerX + Math.cos(angle) * dist;
    const rz = centerZ + Math.sin(angle) * dist;
    const ry = getTerrainHeight(rx, rz);

    const rock = new THREE.Mesh(rockGeoBase, rockMat);
    const rScale = 0.65 + Math.abs(noise.noise2D(rx * 0.5, rz * 0.5)) * 1.3;
    rock.scale.set(
      rScale * (0.8 + Math.random() * 0.4),
      rScale * (0.7 + Math.random() * 0.5),
      rScale * (0.8 + Math.random() * 0.4)
    );
    rock.position.set(rx, ry + rScale * 0.25, rz);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rocksGroup.add(rock);

    rockObstacles.push({
      x: rx,
      y: ry,
      z: rz,
      radius: rScale * 0.85,
      height: rScale * 1.4,
    });
  }

  // 4. Física e Patinhos Navegando no Lago
  const physicsManager = new RiverPhysicsManager();
  physicsManager.setObstacles(rockObstacles);

  const ducks: { group: THREE.Group }[] = [];
  const duckCount = Math.max(1, config.duckCount ?? 2);

  for (let i = 0; i < duckCount; i++) {
    const dAngle = (i / duckCount) * Math.PI * 2;
    const dDist = baseRadius * 0.42;
    const dx = centerX + Math.cos(dAngle) * dDist;
    const dz = centerZ + Math.sin(dAngle) * dDist;
    const spawnPos = new THREE.Vector3(dx, waterLevel + 0.1, dz);
    // Velocidade circular suave no lago
    const initVel = new THREE.Vector3(-Math.sin(dAngle), 0, Math.cos(dAngle)).multiplyScalar(0.7);

    const duckObj = physicsManager.spawnObject('duck', spawnPos, initVel);
    ducks.push({ group: duckObj.group });
  }

  // Curva circular de referência para navegação
  const circlePoints: THREE.Vector3[] = [];
  for (let c = 0; c < 16; c++) {
    const ca = (c / 16) * Math.PI * 2;
    circlePoints.push(
      new THREE.Vector3(
        centerX + Math.cos(ca) * (baseRadius * 0.45),
        waterLevel,
        centerZ + Math.sin(ca) * (baseRadius * 0.45)
      )
    );
  }
  const lakeCurve = new THREE.CatmullRomCurve3(circlePoints, true);

  return {
    terrainMesh,
    waterMesh,
    rocksGroup,
    physicsManager,
    objectsGroup: physicsManager.container,
    ducks,
    curve: lakeCurve,
    getTerrainHeight,
    getDistanceToLake,
    update: (time, delta, addRipple, addWake, clearWake) => {
      // Atualização da física dos patinhos no lago
      physicsManager.update(
        time,
        delta,
        config,
        lakeCurve,
        (x, z) => {
          const info = getDistanceToLake(x, z);
          return {
            distance: info.distance,
            riverY: waterLevel,
            t: (Math.atan2(z - centerZ, x - centerX) / (Math.PI * 2) + 1.0) % 1.0,
          };
        },
        getTerrainHeight,
        addRipple,
        addWake,
        clearWake
      );
    },
    dispose: () => {
      terrainGeo.dispose();
      terrainMat.dispose();
      lakeWaterGeo.dispose();
      rockGeoBase.dispose();
      rockMat.dispose();
      physicsManager.clearUserSpawnedObjects();
    },
  };
}
