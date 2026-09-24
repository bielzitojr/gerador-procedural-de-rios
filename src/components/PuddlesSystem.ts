import * as THREE from 'three';

interface PuddleInstance {
  mesh: THREE.Mesh;
  rimMesh: THREE.Mesh;
  waterMaterial: THREE.ShaderMaterial;
  center: THREE.Vector3;
  radius: number;
}

const puddleVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const puddleFragmentShader = `
uniform float uTime;
uniform vec3 uSkyHorizonColor;
uniform vec3 uSkyZenithColor;
uniform vec3 uSunLightDir;
uniform vec3 uSunLightColor;
uniform vec3 uTorchPos;
uniform vec3 uTorchColor;
uniform float uTorchIntensity;
uniform float uRainIntensity;
uniform int uIsRaining;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float dist = length(p);

  // Borda suave da poça d'água
  float edgeAlpha = smoothstep(0.95, 0.75, dist);
  if (edgeAlpha <= 0.01) discard;

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 normal = vec3(0.0, 1.0, 0.0);

  // Micro-ondulações de chuva na poça
  if (uIsRaining == 1) {
    float ripple1 = sin(dist * 28.0 - uTime * 8.0) * 0.5 + 0.5;
    float ripple2 = sin((p.x + p.y) * 22.0 - uTime * 6.5) * 0.5 + 0.5;
    vec2 perturb = vec2(cos(uTime * 5.0 + p.x * 20.0), sin(uTime * 5.0 + p.y * 20.0)) * (ripple1 * ripple2) * 0.12 * uRainIntensity;
    normal = normalize(vec3(perturb.x, 1.0, perturb.y));
  }

  // 1. Reflexo de Fresnel realista do Céu
  float fresnel = clamp(pow(1.0 - max(dot(viewDir, normal), 0.0), 3.5), 0.0, 1.0);
  vec3 reflectDir = reflect(-viewDir, normal);
  float skyGradient = clamp(reflectDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 reflectedSky = mix(uSkyHorizonColor, uSkyZenithColor, skyGradient);

  // Cor base de fundo de água e lama limpa
  vec3 puddleBase = vec3(0.12, 0.18, 0.22);
  vec3 color = mix(puddleBase, reflectedSky, 0.55 + fresnel * 0.40);

  // 2. Reflexo Especular do Sol / Lua
  vec3 sunDir = normalize(uSunLightDir);
  vec3 sunHalf = normalize(viewDir + sunDir);
  float sunNdotH = max(dot(normal, sunHalf), 0.0);
  float sunSpec = pow(sunNdotH, 40.0);
  color += uSunLightColor * (sunSpec * 1.6);

  // 3. Reflexo Dinâmico da Tocha do NPC
  if (uTorchIntensity > 0.01) {
    vec3 toTorch = uTorchPos - vWorldPosition;
    float torchDist = length(toTorch);
    if (torchDist < 30.0) {
      vec3 torchDir = normalize(toTorch);
      float torchAtten = 1.0 / (1.0 + 0.15 * torchDist + 0.08 * torchDist * torchDist);
      torchAtten *= smoothstep(30.0, 4.0, torchDist);

      // Iluminação difusa quente na poça
      float torchDiff = max(dot(normal, torchDir), 0.0);
      color += uTorchColor * torchDiff * torchAtten * uTorchIntensity * 0.5;

      // Reflexo espelhado da chama da tocha na poça
      vec3 torchHalf = normalize(viewDir + torchDir);
      float torchSpec = pow(max(dot(normal, torchHalf), 0.0), 32.0);
      color += uTorchColor * (torchSpec * 2.8) * torchAtten * uTorchIntensity;
    }
  }

  gl_FragColor = vec4(color, edgeAlpha * 0.92);
}
`;

export class PuddlesSystem {
  public group: THREE.Group;
  private puddles: PuddleInstance[] = [];

  constructor() {
    this.group = new THREE.Group();
  }

  /**
   * Constrói poças de água orgânicas espalhadas pelas margens e terreno
   */
  public generate(
    curve: THREE.CatmullRomCurve3,
    riverWidth: number,
    terrainRoughness: number,
    seed: number,
    getTerrainHeight?: (x: number, z: number) => number
  ) {
    this.dispose();

    // Locais ideais para poças naturais: margens planas do rio e clareiras
    const puddleConfigs = [
      { t: 0.18, lateralOffset: riverWidth * 0.5 + 4.2, scaleX: 3.2, scaleZ: 2.4, rot: 0.4 },
      { t: 0.32, lateralOffset: -(riverWidth * 0.5 + 3.8), scaleX: 2.6, scaleZ: 3.0, rot: -0.6 },
      { t: 0.48, lateralOffset: riverWidth * 0.5 + 5.5, scaleX: 3.8, scaleZ: 2.8, rot: 1.1 },
      { t: 0.62, lateralOffset: -(riverWidth * 0.5 + 4.5), scaleX: 2.8, scaleZ: 2.2, rot: -0.3 },
      { t: 0.78, lateralOffset: riverWidth * 0.5 + 3.5, scaleX: 3.4, scaleZ: 3.2, rot: 0.8 },
      { t: 0.88, lateralOffset: -(riverWidth * 0.5 + 5.0), scaleX: 2.5, scaleZ: 2.0, rot: -0.9 },
    ];

    const wetMudMaterial = new THREE.MeshStandardMaterial({
      color: 0x483c32, // Terra/lama úmida escura
      roughness: 0.4,
      metalness: 0.15,
      flatShading: true,
    });

    puddleConfigs.forEach((cfg, idx) => {
      const centerPoint = curve.getPoint(cfg.t);
      const tangent = curve.getTangent(cfg.t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const puddlePos = centerPoint.clone().add(side.multiplyScalar(cfg.lateralOffset));
      if (getTerrainHeight) {
        puddlePos.y = getTerrainHeight(puddlePos.x, puddlePos.z);
      } else {
        puddlePos.y = centerPoint.y + 0.85;
      }

      // 1. Geometria Orgânica da Poça d'Água (deformada com ruído para não parecer um disco artificial)
      const segments = 32;
      const puddleGeo = new THREE.PlaneGeometry(1, 1, segments, segments);
      puddleGeo.rotateX(-Math.PI / 2);

      const posAttr = puddleGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const angle = Math.atan2(vz, vx);
        const r = Math.sqrt(vx * vx + vz * vz);
        // Deformação harmônica orgânica das bordas
        const deform = 1.0 + Math.sin(angle * 3.0 + idx) * 0.18 + Math.cos(angle * 5.0 + seed) * 0.12;
        posAttr.setX(i, vx * deform);
        posAttr.setZ(i, vz * deform);
      }
      puddleGeo.computeVertexNormals();

      // 2. Material Shader da Poça (Reflexo de Fresnel, Sol, Lua, Céu e Tocha)
      const waterMat = new THREE.ShaderMaterial({
        vertexShader: puddleVertexShader,
        fragmentShader: puddleFragmentShader,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uSkyHorizonColor: { value: new THREE.Color('#8cb6de') },
          uSkyZenithColor: { value: new THREE.Color('#4a8cd6') },
          uSunLightDir: { value: new THREE.Vector3(0, 1, 0) },
          uSunLightColor: { value: new THREE.Color('#ffffff') },
          uTorchPos: { value: new THREE.Vector3(0, -999, 0) },
          uTorchColor: { value: new THREE.Color('#ff7722') },
          uTorchIntensity: { value: 0.0 },
          uRainIntensity: { value: 1.0 },
          uIsRaining: { value: 0 },
        },
        depthWrite: false,
      });

      const puddleMesh = new THREE.Mesh(puddleGeo, waterMat);
      puddleMesh.position.copy(puddlePos);
      puddleMesh.position.y += 0.04; // Levemente acima do chão para evitar z-fighting
      puddleMesh.scale.set(cfg.scaleX, 1, cfg.scaleZ);
      puddleMesh.rotation.y = cfg.rot;
      this.group.add(puddleMesh);

      // 3. Anel de Terra Molhada / Borda Escura em torno da poça
      const rimGeo = new THREE.RingGeometry(0.42, 0.58, 28);
      rimGeo.rotateX(-Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, wetMudMaterial);
      rimMesh.position.copy(puddlePos);
      rimMesh.position.y += 0.02;
      rimMesh.scale.set(cfg.scaleX * 1.15, 1, cfg.scaleZ * 1.15);
      rimMesh.rotation.y = cfg.rot;
      rimMesh.receiveShadow = true;
      this.group.add(rimMesh);

      this.puddles.push({
        mesh: puddleMesh,
        rimMesh,
        waterMaterial: waterMat,
        center: puddlePos,
        radius: Math.max(cfg.scaleX, cfg.scaleZ) * 0.5,
      });
    });
  }

  public update(
    time: number,
    skyHorizonColor: THREE.Color,
    skyZenithColor: THREE.Color,
    sunLightDir: THREE.Vector3,
    sunLightColor: THREE.Color,
    torchData: { position: THREE.Vector3; color: THREE.Color; intensity: number },
    isRaining: boolean,
    rainIntensity: number
  ) {
    for (const p of this.puddles) {
      const u = p.waterMaterial.uniforms;
      u.uTime.value = time;
      u.uSkyHorizonColor.value.copy(skyHorizonColor);
      u.uSkyZenithColor.value.copy(skyZenithColor);
      u.uSunLightDir.value.copy(sunLightDir);
      u.uSunLightColor.value.copy(sunLightColor);
      u.uTorchPos.value.copy(torchData.position);
      u.uTorchColor.value.copy(torchData.color);
      u.uTorchIntensity.value = torchData.intensity;
      u.uIsRaining.value = isRaining ? 1 : 0;
      u.uRainIntensity.value = rainIntensity;
    }
  }

  public dispose() {
    for (const p of this.puddles) {
      p.mesh.geometry.dispose();
      p.waterMaterial.dispose();
      p.rimMesh.geometry.dispose();
      (p.rimMesh.material as THREE.Material).dispose();
      this.group.remove(p.mesh);
      this.group.remove(p.rimMesh);
    }
    this.puddles = [];
  }
}
