import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';
import { RiverConfig } from '../types';
import { RiverPhysicsManager, RiverRockObstacle } from '../physics/riverObjectPhysics';

export interface OceanData {
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  rocksGroup: THREE.Group;
  physicsManager: RiverPhysicsManager;
  objectsGroup: THREE.Group;
  ducks: { group: THREE.Group }[];
  curve?: THREE.CatmullRomCurve3;
  getTerrainHeight: (x: number, z: number) => number;
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
 * Geração Procedural de Oceano Aberto (Swell Marítimo, Costa de Areia & Horizonte Infinito)
 */
export function generateProceduralOcean(
  config: RiverConfig,
  waterMaterial: THREE.ShaderMaterial
): OceanData {
  const oceanParams = config.ocean ?? {
    oceanSwellHeight: 1.6,
    oceanWaveLength: 22,
    oceanChoppiness: 1.0,
    oceanSpeed: 1.2,
    oceanFoamCrests: 0.8,
    oceanSeed: 8888,
  };

  const seed = oceanParams.oceanSeed ?? 8888;
  const noise = new SimplexNoise(seed);
  const terrainSize = 140;
  const segments = 128;
  const waterLevel = 0.0;

  // Linha da praia / costa: Z próximo de -35, com o oceano se abrindo para Z positivo (+Z = mar aberto infinito)
  const coastZ = -30.0;

  function getTerrainHeight(x: number, z: number): number {
    const coastDist = z - coastZ;

    // Costa / Terra firme (Z < coastZ)
    if (coastDist < 0) {
      const landDist = -coastDist;
      const dunes = noise.noise2D(x * 0.04, z * 0.04) * 2.5;
      const cliffs = Math.pow(Math.min(1.0, landDist / 35.0), 1.6) * 7.5;
      const micro = noise.noise2D(x * 0.15, z * 0.15) * 0.5;
      return 0.2 + dunes + cliffs + micro;
    } else {
      // Praia suave que mergulha no leito submarino profundo
      const slope = -Math.pow(coastDist / 45.0, 1.3) * 14.0;
      const submarineReef = noise.noise2D(x * 0.03, z * 0.03) * 1.8;
      return Math.max(-16.0, slope + submarineReef);
    }
  }

  // 1. Terreno Costeiro & Leito Marinho
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colorAttr = new Float32Array(posAttr.count * 3);

  const sandColor = new THREE.Color('#e5d4ab');
  const wetSandColor = new THREE.Color('#b89d74');
  const grassColor = new THREE.Color('#78c46c');
  const oceanBedColor = new THREE.Color('#223f54');
  const rockCliffColor = new THREE.Color('#727d88');

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);

    let vColor = sandColor.clone();
    const coastDist = z - coastZ;

    if (coastDist > 0) {
      // Submerso no oceano
      const depth = -y;
      const t = Math.min(1.0, depth / 8.0);
      vColor = wetSandColor.clone().lerp(oceanBedColor, t);
    } else {
      // Terra firme
      const landDist = -coastDist;
      if (landDist < 6.0) {
        // Faixa de praia de areia
        vColor = sandColor.clone();
      } else {
        // Dunas com vegetação costeira e falésias rochosas
        const vegT = Math.min(1.0, (landDist - 6.0) / 12.0);
        vColor = sandColor.clone().lerp(grassColor, vegT);
        if (y > 4.0) {
          vColor.lerp(rockCliffColor, Math.min(1.0, (y - 4.0) / 3.5));
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
    roughness: 0.86,
    metalness: 0.05,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'ProceduralOceanCoastline';
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;

  // 2. Malha Vasta de Água Oceânica (Ampla extensão que atinge o horizonte)
  const oceanSize = 220;
  const oceanWaterGeo = new THREE.PlaneGeometry(oceanSize, oceanSize, 120, 120);
  oceanWaterGeo.rotateX(-Math.PI / 2);

  const waterMesh = new THREE.Mesh(oceanWaterGeo, waterMaterial);
  waterMesh.name = 'ProceduralOceanWater';
  waterMesh.position.set(0, waterLevel, 20); // expande em direção ao mar aberto (+Z)
  waterMesh.receiveShadow = true;

  // 3. Rochas Costeiras / Penedos Marítimos que quebram as ondas
  const rocksGroup = new THREE.Group();
  rocksGroup.name = 'OceanCoastlineRocks';

  const rockGeoBase = new THREE.DodecahedronGeometry(1.2, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#6e7982',
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });

  const rockObstacles: RiverRockObstacle[] = [];
  const reefCount = 14;

  for (let i = 0; i < reefCount; i++) {
    const rx = (i / (reefCount - 1) - 0.5) * 90.0 + (noise.noise2D(i * 2.3, seed) * 4.0);
    const rz = coastZ + 4.0 + Math.abs(noise.noise2D(i * 1.8, seed * 1.5)) * 14.0;
    const ry = getTerrainHeight(rx, rz);

    const rock = new THREE.Mesh(rockGeoBase, rockMat);
    const rScale = 1.0 + Math.abs(noise.noise2D(rx * 0.3, rz * 0.3)) * 2.2;
    rock.scale.set(
      rScale * (0.8 + Math.random() * 0.4),
      rScale * (1.1 + Math.random() * 0.6),
      rScale * (0.8 + Math.random() * 0.4)
    );
    rock.position.set(rx, ry + rScale * 0.35, rz);
    rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rocksGroup.add(rock);

    rockObstacles.push({
      x: rx,
      y: ry,
      z: rz,
      radius: rScale * 0.9,
      height: rScale * 2.0,
    });
  }

  // 4. Barquinhos ou Patinhos Flutuando no Swell Oceânico
  const physicsManager = new RiverPhysicsManager();
  physicsManager.setObstacles(rockObstacles);

  const ducks: { group: THREE.Group }[] = [];
  const duckCount = Math.max(1, config.duckCount ?? 2);

  for (let i = 0; i < duckCount; i++) {
    const px = (i - (duckCount - 1) * 0.5) * 8.0;
    const pz = coastZ + 16.0 + i * 4.0;
    const spawnPos = new THREE.Vector3(px, waterLevel + 0.15, pz);
    const initVel = new THREE.Vector3(0.3, 0, -0.2);

    const duckObj = physicsManager.spawnObject('duck', spawnPos, initVel);
    ducks.push({ group: duckObj.group });
  }

  // Linha de navegação costeira suave
  const oceanCurvePoints = [
    new THREE.Vector3(-45, waterLevel, coastZ + 20),
    new THREE.Vector3(-15, waterLevel, coastZ + 18),
    new THREE.Vector3(15, waterLevel, coastZ + 22),
    new THREE.Vector3(45, waterLevel, coastZ + 20),
  ];
  const oceanCurve = new THREE.CatmullRomCurve3(oceanCurvePoints, false);

  return {
    terrainMesh,
    waterMesh,
    rocksGroup,
    physicsManager,
    objectsGroup: physicsManager.container,
    ducks,
    curve: oceanCurve,
    getTerrainHeight,
    update: (time, delta, addRipple, addWake, clearWake) => {
      physicsManager.update(
        time,
        delta,
        config,
        oceanCurve,
        (x, z) => ({
          distance: Math.abs(z - coastZ),
          riverY: waterLevel,
          t: THREE.MathUtils.clamp((x + 45) / 90, 0, 1),
        }),
        getTerrainHeight,
        addRipple,
        addWake,
        clearWake
      );
    },
    dispose: () => {
      terrainGeo.dispose();
      terrainMat.dispose();
      oceanWaterGeo.dispose();
      rockGeoBase.dispose();
      rockMat.dispose();
      physicsManager.clearUserSpawnedObjects();
    },
  };
}
