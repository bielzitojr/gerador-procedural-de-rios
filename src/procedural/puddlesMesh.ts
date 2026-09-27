import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';
import { RiverConfig, PuddleConfig } from '../types';
import { RiverPhysicsManager, RiverRockObstacle } from '../physics/riverObjectPhysics';

export interface PuddlesData {
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

interface PuddleCavity {
  x: number;
  z: number;
  radius: number;
  depth: number;
  waterLevel: number;
  deformA: number;
  deformB: number;
}

/**
 * Geração Procedural de Terreno com Poções de Água (Poças d'água Paradas no Terreno)
 * Cria relevo de terra, grama e lama com depressões naturais onde a água se acumula e repousa parada.
 */
export function generateProceduralPuddles(
  config: RiverConfig,
  waterMaterial: THREE.ShaderMaterial
): PuddlesData {
  const puddleParams: PuddleConfig = config.puddles ?? {
    puddleCount: 14,
    puddleRadius: 3.2,
    puddleDepth: 0.65,
    mudRimWidth: 1.1,
    puddleSeed: 5555,
    puddleWetness: 1.2,
    isCalmWater: true,
  };

  const seed = puddleParams.puddleSeed ?? config.seed ?? 5555;
  const count = Math.max(3, puddleParams.puddleCount ?? 14);
  const baseRadius = puddleParams.puddleRadius ?? 3.2;
  const puddleDepth = puddleParams.puddleDepth ?? 0.65;
  const mudWidth = puddleParams.mudRimWidth ?? 1.1;

  const noise = new SimplexNoise(seed);
  const terrainSize = 110;
  const segments = 128;
  const baseGroundLevel = 0.5;

  // 1. Distribuição procedural das poças/depressões pelo terreno
  const cavities: PuddleCavity[] = [];
  const minSpread = Math.min(42, terrainSize * 0.38);

  for (let i = 0; i < count; i++) {
    // Espalhar uniformemente com distribuição de Poisson simplificada por quadrantes
    const angle = (i / count) * Math.PI * 2 + (noise.noise2D(i * 1.7, seed * 0.1) * 0.5);
    const dist = (0.2 + (0.75 * ((i * 7) % count)) / count) * minSpread;
    const px = Math.cos(angle) * dist + (noise.noise2D(i * 3.3, 14.2) * 4.0);
    const pz = Math.sin(angle) * dist + (noise.noise2D(31.5, i * 3.3) * 4.0);

    const radVar = 0.75 + Math.abs(noise.noise2D(px * 0.2, pz * 0.2)) * 0.6;
    const depthVar = 0.7 + Math.abs(noise.noise2D(pz * 0.15, px * 0.15)) * 0.6;

    cavities.push({
      x: px,
      z: pz,
      radius: baseRadius * radVar,
      depth: puddleDepth * depthVar,
      waterLevel: baseGroundLevel - (puddleDepth * depthVar * 0.28), // água preenche a depressão
      deformA: noise.noise2D(px * 0.4, pz * 0.4) * 0.25,
      deformB: noise.noise2D(pz * 0.4, px * 0.4) * 0.20,
    });
  }

  // Função que calcula a elevação do terreno (incluindo as depressões esculpidas das poças)
  function getRawTerrainHeight(x: number, z: number): number {
    // Relevo suave ondulado de prado / solo
    const macro = noise.noise2D(x * 0.025, z * 0.025) * 1.4;
    const micro = noise.noise2D(x * 0.09, z * 0.09) * 0.45;
    let y = baseGroundLevel + macro + micro;

    // Esculpir cada poça / bacia de depressão
    for (let k = 0; k < cavities.length; k++) {
      const cav = cavities[k];
      const dx = x - cav.x;
      const dz = z - cav.z;
      const dist = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);

      // Borda orgânica e irregular da poça
      const shapeDeform = 1.0 + Math.sin(angle * 3.0) * cav.deformA + Math.cos(angle * 4.0) * cav.deformB;
      const effectiveRadius = cav.radius * shapeDeform;

      if (dist < effectiveRadius * 1.6) {
        const normDist = dist / effectiveRadius;
        if (normDist < 1.0) {
          // Fundo suave em tigela (côncavo)
          const bowl = Math.cos(normDist * (Math.PI / 2));
          y -= cav.depth * (bowl * bowl);
        } else {
          // Borda de transição da margem
          const rimDist = (normDist - 1.0) / 0.6;
          const rimFactor = Math.pow(Math.max(0.0, 1.0 - rimDist), 2.0);
          y -= cav.depth * 0.08 * rimFactor;
        }
      }
    }

    return y;
  }

  function getTerrainHeight(x: number, z: number): number {
    return getRawTerrainHeight(x, z);
  }

  // 2. Malha do Terreno (com coloração de solo, grama e lama úmida nas bordas das poças)
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colorAttr = new Float32Array(posAttr.count * 3);

  const grassColor = new THREE.Color('#5ea849');
  const dryGrassColor = new THREE.Color('#78b35b');
  const earthColor = new THREE.Color('#5a483a');
  const wetMudColor = new THREE.Color('#2d221a');
  const puddleBedColor = new THREE.Color('#1c1712');

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    const y = getRawTerrainHeight(x, z);
    posAttr.setY(i, y);

    // Calcular proximidade da poça mais próxima para coloração de lama úmida
    let closestPuddleDistNorm = 999.0;
    let insidePuddle = false;

    for (let k = 0; k < cavities.length; k++) {
      const cav = cavities[k];
      const dx = x - cav.x;
      const dz = z - cav.z;
      const dist = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      const effectiveRadius = cav.radius * (1.0 + Math.sin(angle * 3.0) * cav.deformA + Math.cos(angle * 4.0) * cav.deformB);

      const dNorm = dist / effectiveRadius;
      if (dNorm < closestPuddleDistNorm) {
        closestPuddleDistNorm = dNorm;
        if (dNorm <= 1.0) {
          insidePuddle = true;
        }
      }
    }

    let vertexColor = grassColor.clone();
    // Leve variação do prado
    const nColor = noise.noise2D(x * 0.12, z * 0.12);
    if (nColor > 0.2) {
      vertexColor.lerp(dryGrassColor, (nColor - 0.2) * 1.2);
    } else if (nColor < -0.2) {
      vertexColor.lerp(earthColor, (-nColor - 0.2) * 0.8);
    }

    // Se estiver na borda ou dentro de uma depressão de poça:
    if (closestPuddleDistNorm < 1.0) {
      // Fundo submerso da poça (lama escura profunda e cascalho)
      vertexColor = puddleBedColor.clone().lerp(wetMudColor, closestPuddleDistNorm * 0.5);
    } else if (closestPuddleDistNorm < 1.0 + (mudWidth / baseRadius)) {
      // Borda de lama úmida ("lama molhada") ao redor da poça
      const mudFactor = 1.0 - (closestPuddleDistNorm - 1.0) / (mudWidth / baseRadius);
      vertexColor.lerp(wetMudColor, Math.pow(mudFactor, 0.75));
    }

    colorAttr[i * 3] = vertexColor.r;
    colorAttr[i * 3 + 1] = vertexColor.g;
    colorAttr[i * 3 + 2] = vertexColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.08,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'ProceduralPuddlesTerrain';
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;

  // 3. Malhas de Água Parada das Poças (Poções de água perfeitamente encaixadas nas depressões)
  const puddleWaterGroup = new THREE.Group();
  puddleWaterGroup.name = 'ProceduralPuddleWaters';

  // Usamos uma malha de água com o Shader Toon (com suporte a reflexos do céu, sol, águas calmas e chuva)
  // Criamos uma malha contínua ou planos orgânicos para cada depressão
  const combinedPuddleGeo = new THREE.BufferGeometry();
  const waterMeshes: THREE.Mesh[] = [];

  cavities.forEach((cav, idx) => {
    const puddleSegments = 36;
    const pGeo = new THREE.CircleGeometry(cav.radius * 1.04, puddleSegments);
    pGeo.rotateX(-Math.PI / 2);

    const pos = pGeo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const vx = pos.getX(j);
      const vz = pos.getZ(j);
      const angle = Math.atan2(vz, vx);
      const deform = 1.0 + Math.sin(angle * 3.0) * cav.deformA + Math.cos(angle * 4.0) * cav.deformB;
      pos.setX(j, vx * deform);
      pos.setZ(j, vz * deform);
    }
    pGeo.computeVertexNormals();

    const pMesh = new THREE.Mesh(pGeo, waterMaterial);
    pMesh.position.set(cav.x, cav.waterLevel, cav.z);
    pMesh.receiveShadow = true;
    pMesh.name = `PuddleWater_${idx}`;
    puddleWaterGroup.add(pMesh);
    waterMeshes.push(pMesh);
  });

  // 4. Pedras e Cascalhos Espalhados ao Redor das Poças
  const rocksGroup = new THREE.Group();
  rocksGroup.name = 'PuddleStones';

  const rockGeoBase = new THREE.DodecahedronGeometry(0.45, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#554c46',
    roughness: 0.94,
    metalness: 0.06,
    flatShading: true,
  });

  const rockObstacles: RiverRockObstacle[] = [];

  cavities.forEach((cav, cIdx) => {
    // 2 a 5 pedrinhas em torno da margem da poça
    const stoneCount = 2 + (cIdx % 4);
    for (let s = 0; s < stoneCount; s++) {
      const sAngle = (s / stoneCount) * Math.PI * 2 + (noise.noise2D(s * 4.1, cIdx) * 0.8);
      const sDist = cav.radius * (1.05 + Math.abs(noise.noise2D(s, cIdx * 2.2)) * 0.35);
      const rx = cav.x + Math.cos(sAngle) * sDist;
      const rz = cav.z + Math.sin(sAngle) * sDist;
      const ry = getRawTerrainHeight(rx, rz);

      const stoneMesh = new THREE.Mesh(rockGeoBase, rockMat);
      const scale = 0.5 + Math.abs(noise.noise2D(rx * 0.4, rz * 0.4)) * 0.8;
      stoneMesh.scale.set(scale * 1.2, scale * 0.7, scale * 1.0);
      stoneMesh.position.set(rx, ry + scale * 0.25, rz);
      stoneMesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      rocksGroup.add(stoneMesh);

      rockObstacles.push({
        x: rx,
        y: ry,
        z: rz,
        radius: scale * 0.5,
        height: scale * 1.0,
      });
    }
  });

  // 5. Patinhos Relaxando nas Poças d'Água Parada
  const physicsManager = new RiverPhysicsManager();
  physicsManager.setObstacles(rockObstacles);

  const ducks: { group: THREE.Group }[] = [];
  const duckCount = Math.min(cavities.length, Math.max(1, config.duckCount ?? 2));

  for (let i = 0; i < duckCount; i++) {
    const cav = cavities[i % cavities.length];
    const spawnPos = new THREE.Vector3(cav.x, cav.waterLevel + 0.12, cav.z);
    const initVel = new THREE.Vector3(0, 0, 0); // Água parada (sem correnteza)

    const duckObj = physicsManager.spawnObject('duck', spawnPos, initVel);
    ducks.push({ group: duckObj.group });
  }

  // Trajetória de visualização circular suave pelo parque de poças
  const curvePoints: THREE.Vector3[] = [];
  for (let p = 0; p < 8; p++) {
    const angle = (p / 8) * Math.PI * 2;
    const r = minSpread * 0.85;
    curvePoints.push(new THREE.Vector3(Math.cos(angle) * r, baseGroundLevel, Math.sin(angle) * r));
  }
  curvePoints.push(curvePoints[0]);
  const puddleCurve = new THREE.CatmullRomCurve3(curvePoints, true);

  return {
    terrainMesh,
    waterMesh: puddleWaterGroup as unknown as THREE.Mesh,
    rocksGroup,
    physicsManager,
    objectsGroup: physicsManager.container,
    ducks,
    curve: puddleCurve,
    getTerrainHeight,
    update: (time, delta, addRipple, addWake, clearWake) => {
      // Simulação física dos patinhos em águas paradas
      physicsManager.update(
        time,
        delta,
        {
          ...config,
          flowSpeed: 0.0, // Água parada (águas calmas)
          currentStrength: 0.0,
        },
        puddleCurve,
        (x, z) => {
          // Encontra a poça mais próxima
          let minDist = 999.0;
          let pY = baseGroundLevel;
          for (let k = 0; k < cavities.length; k++) {
            const cav = cavities[k];
            const d = Math.hypot(x - cav.x, z - cav.z);
            if (d < minDist) {
              minDist = d;
              pY = cav.waterLevel;
            }
          }
          return {
            distance: minDist,
            riverY: pY,
            t: 0.5,
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
      waterMeshes.forEach((m) => {
        m.geometry.dispose();
      });
      rockGeoBase.dispose();
      rockMat.dispose();
      physicsManager.clearUserSpawnedObjects();
    },
  };
}
