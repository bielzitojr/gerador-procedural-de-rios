import * as THREE from 'three';

export interface CelestialState {
  timeHour: number;
  sunPosition: THREE.Vector3;
  moonPosition: THREE.Vector3;
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  skyHorizonColor: THREE.Color;
  skyZenithColor: THREE.Color;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  exposure: number;
  isDaytime: boolean;
}

export class CelestialCycle {
  public group: THREE.Group;
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public fillLight: THREE.DirectionalLight;

  private sunMesh: THREE.Mesh;
  private sunGlow: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private starsPoints: THREE.Points;
  private starsMaterial: THREE.PointsMaterial;

  private readonly orbitRadius = 160;
  private readonly orbitalTilt = THREE.MathUtils.degToRad(23.4); // Inclinação axial realista da Terra

  constructor() {
    this.group = new THREE.Group();

    // 1. Luzes principais
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    const d = 50;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.group.add(this.sunLight);

    this.ambientLight = new THREE.AmbientLight(0xddeeff, 1.2);
    this.group.add(this.ambientLight);

    this.fillLight = new THREE.DirectionalLight(0x90c4f8, 0.5);
    this.group.add(this.fillLight);

    // 2. Sol 3D Visível no Céu
    const sunGeo = new THREE.SphereGeometry(6, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfffae0,
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);

    // Halo / Corona solar suave
    const glowGeo = new THREE.SphereGeometry(10.5, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffdd77,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    this.sunGlow = new THREE.Mesh(glowGeo, glowMat);
    this.sunMesh.add(this.sunGlow);
    this.group.add(this.sunMesh);

    // 3. Lua 3D Visível no Céu
    const moonGeo = new THREE.SphereGeometry(5.0, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xebf3ff,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);

    // Halo lunar suave
    const moonGlowGeo = new THREE.SphereGeometry(7.8, 24, 24);
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x9bc4f8,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    this.moonMesh.add(new THREE.Mesh(moonGlowGeo, moonGlowMat));
    this.group.add(this.moonMesh);

    // 4. Abóbada de Estrelas Cintilantes (aparecem à noite)
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = this.orbitRadius * 0.96;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 10; // Cúpula acima do horizonte
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.starsPoints = new THREE.Points(starGeo, this.starsMaterial);
    this.group.add(this.starsPoints);
  }

  /**
   * Atualiza a posição orbital do Sol e da Lua, luzes e gradientes celestes com base na hora do dia (0h - 24h).
   */
  public update(
    timeHour: number,
    isRaining: boolean = false,
    rainIntensity: number = 1.0
  ): CelestialState {
    // Normalização temporal: 0h a 24h mapeado em ângulo orbital
    // 06:00 = Nascente (Leste, elevação 0°)
    // 12:00 = Zênite (A pino, elevação máxima 90°)
    // 18:00 = Poente (Oeste, elevação 0°)
    // 00:00 = Meia-noite (Nadir)
    const solarAngle = ((timeHour - 6.0) / 24.0) * Math.PI * 2.0;

    // Movimento orbital celeste com inclinação axial
    const rawX = -Math.cos(solarAngle) * this.orbitRadius;
    const rawY = Math.sin(solarAngle) * this.orbitRadius;
    const rawZ = Math.cos(solarAngle) * Math.sin(this.orbitalTilt) * (this.orbitRadius * 0.65);

    const sunPos = new THREE.Vector3(rawX, rawY, rawZ);
    // A Lua fica no ponto orbital oposto (180 graus de diferença)
    const moonPos = sunPos.clone().negate();
    // Leve offset positivo para a lua ficar visível quando no horizonte
    moonPos.y = -rawY;

    this.sunMesh.position.copy(sunPos);
    this.moonMesh.position.copy(moonPos);

    // Visibilidade dos corpos celestes
    this.sunMesh.visible = sunPos.y > -15;
    this.moonMesh.visible = moonPos.y > -15;

    // Elevação normalizada do Sol (-1 a +1)
    const sunElevation = Math.sin(solarAngle);
    const isDaytime = sunElevation > -0.08;

    // Luz direcional segue o astro ativo (Sol de dia, Lua cheia de noite)
    if (isDaytime) {
      this.sunLight.position.copy(sunPos);
    } else {
      this.sunLight.position.copy(moonPos);
    }

    // Interpolação realista de fases do dia
    // Fases: Dawn (5h-7h), Noon (10h-14h), Golden Hour / Sunset (17h-19h), Dusk (19h-20.5h), Night (21h-4.5h)
    let horizonColor = new THREE.Color();
    let zenithColor = new THREE.Color();
    let sunLightColor = new THREE.Color();
    let ambientColor = new THREE.Color();
    let fogColor = new THREE.Color();
    let sunIntensity = 1.6;
    let ambientIntensity = 1.35;
    let fogNear = 80;
    let fogFar = 260;
    let exposure = 1.1;
    let starsOpacity = 0.0;

    const t = ((timeHour % 24) + 24) % 24;

    if (t >= 5.0 && t < 8.0) {
      // Amanhecer / Alvorada (Dawn & Golden Sunrise)
      const f = (t - 5.0) / 3.0;
      horizonColor.lerpColors(new THREE.Color('#e88a5e'), new THREE.Color('#b3d5f5'), f);
      zenithColor.lerpColors(new THREE.Color('#384c78'), new THREE.Color('#5ea0e8'), f);
      sunLightColor.lerpColors(new THREE.Color('#ffaa55'), new THREE.Color('#fff9ea'), f);
      ambientColor.lerpColors(new THREE.Color('#6b5b7b'), new THREE.Color('#cce2ff'), f);
      fogColor.lerpColors(new THREE.Color('#ca7e65'), new THREE.Color('#8cb6de'), f);
      sunIntensity = THREE.MathUtils.lerp(1.1, 1.7, f);
      ambientIntensity = THREE.MathUtils.lerp(0.9, 1.45, f);
      fogNear = THREE.MathUtils.lerp(60, 85, f);
      fogFar = THREE.MathUtils.lerp(210, 260, f);
      exposure = THREE.MathUtils.lerp(1.05, 1.12, f);
      starsOpacity = THREE.MathUtils.lerp(0.8, 0.0, f);
    } else if (t >= 8.0 && t < 16.5) {
      // Pleno Dia (Radiant Noon)
      horizonColor.set('#b6dbfc');
      zenithColor.set('#5299e8');
      sunLightColor.set('#ffffff');
      ambientColor.set('#ddeeff');
      fogColor.set('#8cb6de');
      sunIntensity = 1.75;
      ambientIntensity = 1.45;
      fogNear = 85;
      fogFar = 260;
      exposure = 1.1;
      starsOpacity = 0.0;
    } else if (t >= 16.5 && t < 19.5) {
      // Entardecer e Pôr do Sol (Golden Hour & Sunset)
      const f = (t - 16.5) / 3.0;
      horizonColor.lerpColors(new THREE.Color('#b6dbfc'), new THREE.Color('#ff6e38'), f);
      zenithColor.lerpColors(new THREE.Color('#5299e8'), new THREE.Color('#6d3b6a'), f);
      sunLightColor.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#ff8c3b'), f);
      ambientColor.lerpColors(new THREE.Color('#ddeeff'), new THREE.Color('#8e4d6a'), f);
      fogColor.lerpColors(new THREE.Color('#8cb6de'), new THREE.Color('#ca6140'), f);
      sunIntensity = THREE.MathUtils.lerp(1.75, 2.1, f);
      ambientIntensity = THREE.MathUtils.lerp(1.45, 1.15, f);
      fogNear = THREE.MathUtils.lerp(85, 68, f);
      fogFar = THREE.MathUtils.lerp(260, 215, f);
      exposure = THREE.MathUtils.lerp(1.1, 1.16, f);
      starsOpacity = THREE.MathUtils.lerp(0.0, 0.2, f);
    } else if (t >= 19.5 && t < 21.5) {
      // Crepúsculo / Twilight (Azul profundo e púrpura)
      const f = (t - 19.5) / 2.0;
      horizonColor.lerpColors(new THREE.Color('#ff6e38'), new THREE.Color('#1c2340'), f);
      zenithColor.lerpColors(new THREE.Color('#6d3b6a'), new THREE.Color('#0c1426'), f);
      sunLightColor.lerpColors(new THREE.Color('#ff8c3b'), new THREE.Color('#a8cbff'), f);
      ambientColor.lerpColors(new THREE.Color('#8e4d6a'), new THREE.Color('#223150'), f);
      fogColor.lerpColors(new THREE.Color('#ca6140'), new THREE.Color('#121c32'), f);
      sunIntensity = THREE.MathUtils.lerp(2.1, 1.35, f);
      ambientIntensity = THREE.MathUtils.lerp(1.15, 0.9, f);
      fogNear = THREE.MathUtils.lerp(68, 55, f);
      fogFar = THREE.MathUtils.lerp(215, 190, f);
      exposure = THREE.MathUtils.lerp(1.16, 1.22, f);
      starsOpacity = THREE.MathUtils.lerp(0.2, 0.95, f);
    } else {
      // Noite Plena (Moonlit Starry Night)
      horizonColor.set('#10192e');
      zenithColor.set('#070d19');
      // Luar prateado fresco
      sunLightColor.set('#9bc4f8');
      ambientColor.set('#18253d');
      fogColor.set('#0b1424');
      sunIntensity = 1.3;
      ambientIntensity = 0.85;
      fogNear = 55;
      fogFar = 190;
      exposure = 1.25;
      starsOpacity = 1.0;
    }

    // Modificação climática quando chove
    if (isRaining) {
      const rainMult = Math.min(1.0, rainIntensity);
      horizonColor.lerp(new THREE.Color('#586c7d'), 0.55 * rainMult);
      zenithColor.lerp(new THREE.Color('#384755'), 0.65 * rainMult);
      sunLightColor.lerp(new THREE.Color('#c5d8e8'), 0.5 * rainMult);
      ambientColor.lerp(new THREE.Color('#7a90a2'), 0.45 * rainMult);
      fogColor.lerp(new THREE.Color('#586c7d'), 0.6 * rainMult);
      sunIntensity *= 1.0 - 0.25 * rainMult;
      ambientIntensity *= 1.0 - 0.15 * rainMult;
      fogNear = Math.max(35, fogNear - 25 * rainMult);
      fogFar = Math.max(120, fogFar - 65 * rainMult);
      starsOpacity *= 1.0 - 0.85 * rainMult;
    }

    // Aplicação nas lâmpadas Three.js
    this.sunLight.color.copy(sunLightColor);
    this.sunLight.intensity = sunIntensity;

    this.ambientLight.color.copy(ambientColor);
    this.ambientLight.intensity = ambientIntensity;

    this.fillLight.color.copy(horizonColor);
    this.fillLight.intensity = ambientIntensity * 0.4;
    // O fill light vem do lado oposto ao sol para atenuar sombras duras
    this.fillLight.position.set(-this.sunLight.position.x * 0.6, 15, -this.sunLight.position.z * 0.6);

    this.starsMaterial.opacity = starsOpacity;

    const sunDir = isDaytime ? sunPos.clone().normalize() : moonPos.clone().normalize();

    return {
      timeHour,
      sunPosition: sunPos,
      moonPosition: moonPos,
      sunDirection: sunDir,
      sunColor: sunLightColor,
      sunIntensity,
      skyHorizonColor: horizonColor,
      skyZenithColor: zenithColor,
      ambientColor,
      ambientIntensity,
      fogColor,
      fogNear,
      fogFar,
      exposure,
      isDaytime,
    };
  }

  public dispose() {
    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as THREE.Material).dispose();
    this.sunGlow.geometry.dispose();
    (this.sunGlow.material as THREE.Material).dispose();
    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();
    this.starsPoints.geometry.dispose();
    this.starsMaterial.dispose();
  }
}
