import * as THREE from 'three';

interface EmberParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  heat: number; // 1.0 (amarelo incandescente) a 0.0 (fuligem fria)
}

export class NPCWithTorch {
  public group: THREE.Group;
  public torchLight: THREE.PointLight;

  // Hierarquia visual do NPC
  private bodyMesh: THREE.Group;
  private headMesh: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group; // Segura a tocha

  // Elementos da Tocha
  private torchHandle: THREE.Mesh;
  private flameCore: THREE.Mesh;
  private flameOuter: THREE.Mesh;
  private torchTipWorldPos: THREE.Vector3 = new THREE.Vector3();

  // Partículas de brasas e faíscas físicas
  private maxEmbers = 45;
  private embers: EmberParticle[] = [];
  private emberPoints: THREE.Points;
  private emberGeo: THREE.BufferGeometry;
  private emberColors: Float32Array;
  private emberPositions: Float32Array;

  // Física de arrasto e inércia da chama
  private flameInertiaOffset = new THREE.Vector3(0, 0, 0);
  private flameInertiaVelocity = new THREE.Vector3(0, 0, 0);
  private previousPosition = new THREE.Vector3();
  private npcVelocity = new THREE.Vector3();

  // Rota e navegação contínua por spline (sem travamentos ou teleportes)
  private pathCurve: THREE.CatmullRomCurve3 | null = null;
  private pathLength = 0;
  private pathProgress = 0;
  private walkSpeed = 2.4;
  private isIdle = false;
  private idleTimer = 0;
  private pauseTimer = 22.0;
  private walkCycleTime = 0;
  private getTerrainHeightFn: ((x: number, z: number) => number) | null = null;

  constructor() {
    this.group = new THREE.Group();

    // 1. Construção do corpo do NPC em estilo Low-Poly Toon harmonioso
    this.bodyMesh = new THREE.Group();

    // Materiais estilizados
    const coatMat = new THREE.MeshStandardMaterial({
      color: 0x3d5a80, // Casaco azul de explorador
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x293241, // Calças escuras
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffd166, // Tom de pele estilizado
      roughness: 0.6,
      metalness: 0.0,
      flatShading: true,
    });
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xee6c4d, // Chapéu terracota alegre
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true,
    });
    const backpackMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b, // Mochila de couro
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });

    // Tronco / Casaco
    const torsoGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.95, 8);
    const torso = new THREE.Mesh(torsoGeo, coatMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyMesh.add(torso);

    // Mochila nas costas
    const bagGeo = new THREE.BoxGeometry(0.48, 0.6, 0.3);
    const backpack = new THREE.Mesh(bagGeo, backpackMat);
    backpack.position.set(0, 1.25, -0.32);
    backpack.castShadow = true;
    this.bodyMesh.add(backpack);

    // Cabeça
    this.headMesh = new THREE.Group();
    this.headMesh.position.set(0, 1.85, 0);

    const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    this.headMesh.add(head);

    // Chapéu de viajante
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), hatMat);
    hatBrim.position.y = 0.26;
    hatBrim.castShadow = true;
    this.headMesh.add(hatBrim);

    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.32, 10), hatMat);
    hatTop.position.y = 0.44;
    hatTop.castShadow = true;
    this.headMesh.add(hatTop);

    this.bodyMesh.add(this.headMesh);

    const bootsMat = new THREE.MeshStandardMaterial({
      color: 0x1f2421, // Botas de couro escuras para caminhada
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    // Pernas (articuladas no quadril em y = 0.72)
    // Comprimento da perna = 0.52 (da pelve até o tornozelo) + bota = 0.20 = total 0.72 até y=0 (chão)
    const legGeo = new THREE.BoxGeometry(0.2, 0.52, 0.22);
    legGeo.translate(0, -0.26, 0); // Ponto de rotação no quadril

    const bootGeo = new THREE.BoxGeometry(0.22, 0.2, 0.28);
    bootGeo.translate(0, -0.62, 0.03); // Bota na base da perna terminando exatamente em y = 0

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.2, 0.72, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);
    const leftBootMesh = new THREE.Mesh(bootGeo, bootsMat);
    leftBootMesh.castShadow = true;
    this.leftLeg.add(leftBootMesh);
    this.bodyMesh.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.2, 0.72, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.castShadow = true;
    this.rightLeg.add(rightLegMesh);
    const rightBootMesh = new THREE.Mesh(bootGeo, bootsMat);
    rightBootMesh.castShadow = true;
    this.rightLeg.add(rightBootMesh);
    this.bodyMesh.add(this.rightLeg);

    // Braço Esquerdo
    const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    armGeo.translate(0, -0.3, 0);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.52, 1.55, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, coatMat);
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.bodyMesh.add(this.leftArm);

    // Braço Direito (erguido segurando a tocha para a frente)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.52, 1.55, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, coatMat);
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);

    // 2. Construção da Tocha
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033, // Madeira rústica
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x4a4e51, // Metal escuro nas braçadeiras
      roughness: 0.5,
      metalness: 0.8,
    });

    const torchGroup = new THREE.Group();
    // Cabo de madeira da tocha
    const handleGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.9, 8);
    this.torchHandle = new THREE.Mesh(handleGeo, woodMat);
    this.torchHandle.position.set(0, -0.05, 0.35);
    this.torchHandle.rotation.x = Math.PI / 4.2; // Inclinada ergonomicamente para a frente
    this.torchHandle.castShadow = true;
    torchGroup.add(this.torchHandle);

    // Cabeça metálica da tocha
    const ironBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.22, 8), ironMat);
    ironBrace.position.y = 0.42;
    this.torchHandle.add(ironBrace);

    // Chama interna (núcleo amarelo brilhante)
    const flameCoreGeo = new THREE.ConeGeometry(0.12, 0.36, 8);
    flameCoreGeo.translate(0, 0.18, 0);
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
    });
    this.flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
    this.flameCore.position.set(0, 0.5, 0);
    this.torchHandle.add(this.flameCore);

    // Chama externa (envelope alaranjado incandescente translúcido)
    const flameOuterGeo = new THREE.ConeGeometry(0.18, 0.5, 8);
    flameOuterGeo.translate(0, 0.22, 0);
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
    this.flameOuter.position.set(0, 0.48, 0);
    this.torchHandle.add(this.flameOuter);

    // 3. Luz Dinâmica Real da Tocha (PointLight)
    this.torchLight = new THREE.PointLight(0xff7722, 2.5, 26, 2.0);
    this.torchLight.position.set(0, 0.65, 0);
    this.torchLight.castShadow = true;
    this.torchLight.shadow.bias = -0.002;
    this.torchLight.shadow.mapSize.width = 512;
    this.torchLight.shadow.mapSize.height = 512;
    this.torchHandle.add(this.torchLight);

    this.rightArm.add(torchGroup);
    this.bodyMesh.add(this.rightArm);

    this.group.add(this.bodyMesh);

    // 4. Sistema Físico de Brasas e Faíscas Incandescentes
    this.emberPositions = new Float32Array(this.maxEmbers * 3);
    this.emberColors = new Float32Array(this.maxEmbers * 3);
    this.emberGeo = new THREE.BufferGeometry();
    this.emberGeo.setAttribute('position', new THREE.BufferAttribute(this.emberPositions, 3));
    this.emberGeo.setAttribute('color', new THREE.BufferAttribute(this.emberColors, 3));

    const emberMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.emberPoints = new THREE.Points(this.emberGeo, emberMat);
    this.group.add(this.emberPoints);

    for (let i = 0; i < this.maxEmbers; i++) {
      this.embers.push({
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        size: 0.1,
        heat: 0,
      });
    }

    this.setupDefaultPath();
  }

  /**
   * Gera uma trilha fechada suave (spline contínuo) ao longo das margens do rio.
   * Evita saltos discretos, interpolações quebradas ou reversões bruscas.
   */
  public setupPath(
    curve: THREE.CatmullRomCurve3,
    riverWidth: number,
    getTerrainHeight?: (x: number, z: number) => number
  ) {
    if (getTerrainHeight) {
      this.getTerrainHeightFn = getTerrainHeight;
    }

    const trailPoints: THREE.Vector3[] = [];
    const steps = 30;
    const innerDist = riverWidth * 0.5 + 2.3;
    const outerDist = riverWidth * 0.5 + 4.4;

    // 1. Caminho de ida margeando o rio (t = 0.08 até 0.90)
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = 0.08 + u * 0.82;
      const center = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const wobble = Math.sin(u * Math.PI * 4.0) * 0.35;
      const pt = center.clone().add(side.multiplyScalar(innerDist + wobble));
      if (this.getTerrainHeightFn) {
        pt.y = this.getTerrainHeightFn(pt.x, pt.z);
      } else {
        pt.y = center.y + 1.2;
      }
      trailPoints.push(pt);
    }

    // 2. Curva suave de retorno no extremo final (U-turn arredondado)
    const farCenter = curve.getPoint(0.90);
    const farTangent = curve.getTangent(0.90).normalize();
    const farSide = new THREE.Vector3(-farTangent.z, 0, farTangent.x).normalize();
    const arcSteps = 4;
    for (let i = 1; i <= arcSteps; i++) {
      const frac = i / (arcSteps + 1);
      const angle = frac * Math.PI;
      const dist = THREE.MathUtils.lerp(innerDist, outerDist, frac) + Math.sin(angle) * 0.6;
      const fwd = Math.cos(angle) * -0.6;
      const pt = farCenter.clone()
        .add(farSide.clone().multiplyScalar(dist))
        .add(farTangent.clone().multiplyScalar(fwd));
      if (this.getTerrainHeightFn) {
        pt.y = this.getTerrainHeightFn(pt.x, pt.z);
      }
      trailPoints.push(pt);
    }

    // 3. Caminho de volta pelo campo aberto mais afastado (t = 0.90 até 0.08)
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = 0.90 - u * 0.82;
      const center = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const wobble = Math.cos(u * Math.PI * 3.5) * 0.4;
      const pt = center.clone().add(side.multiplyScalar(outerDist + wobble));
      if (this.getTerrainHeightFn) {
        pt.y = this.getTerrainHeightFn(pt.x, pt.z);
      } else {
        pt.y = center.y + 1.3;
      }
      trailPoints.push(pt);
    }

    // 4. Curva suave de retorno no extremo inicial (U-turn arredondado)
    const nearCenter = curve.getPoint(0.08);
    const nearTangent = curve.getTangent(0.08).normalize();
    const nearSide = new THREE.Vector3(-nearTangent.z, 0, nearTangent.x).normalize();
    for (let i = 1; i <= arcSteps; i++) {
      const frac = i / (arcSteps + 1);
      const angle = frac * Math.PI;
      const dist = THREE.MathUtils.lerp(outerDist, innerDist, frac) + Math.sin(angle) * 0.6;
      const fwd = Math.cos(angle) * 0.6;
      const pt = nearCenter.clone()
        .add(nearSide.clone().multiplyScalar(dist))
        .add(nearTangent.clone().multiplyScalar(fwd));
      if (this.getTerrainHeightFn) {
        pt.y = this.getTerrainHeightFn(pt.x, pt.z);
      }
      trailPoints.push(pt);
    }

    // Cria o spline fechado centripetal (totalmente contínuo e sem quinas afiadas)
    this.pathCurve = new THREE.CatmullRomCurve3(trailPoints, true, 'centripetal');
    this.pathLength = this.pathCurve.getLength();
    this.pathProgress = 0;

    const startPos = this.pathCurve.getPointAt(0);
    if (this.getTerrainHeightFn) {
      startPos.y = this.getTerrainHeightFn(startPos.x, startPos.z);
    }
    this.group.position.copy(startPos);
    this.previousPosition.copy(startPos);
    this.npcVelocity.set(0, 0, 0);
  }

  private setupDefaultPath() {
    const points = [
      new THREE.Vector3(8, 0, -25),
      new THREE.Vector3(9, 0, -10),
      new THREE.Vector3(11, 0, 8),
      new THREE.Vector3(9, 0, 25),
      new THREE.Vector3(14, 0, 15),
      new THREE.Vector3(13, 0, -5),
    ];
    this.pathCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    this.pathLength = this.pathCurve.getLength();
    this.pathProgress = 0;

    const startPt = this.pathCurve.getPointAt(0);
    this.group.position.copy(startPt);
    this.previousPosition.copy(startPt);
    this.npcVelocity.set(0, 0, 0);
  }

  /**
   * Atualização frame a frame com cinemática contínua e física real da tocha ao longo do rio
   */
  public update(delta: number, elapsedTime: number) {
    const dt = Math.min(delta, 0.08);

    // Modo Rio Procedural: Caminhada contínua, suave e sem quebras por spline
    this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) {
        if (!this.isIdle) {
          this.isIdle = true;
          this.idleTimer = 3.2; // Pequena pausa para contemplar o rio
          this.pauseTimer = 22.0 + Math.random() * 16.0;
        }
      }

      if (this.isIdle) {
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          this.isIdle = false;
        }
      }

      if (!this.isIdle && this.pathCurve && this.pathLength > 0.5) {
        const progressStep = (this.walkSpeed * dt) / this.pathLength;
        this.pathProgress = (this.pathProgress + progressStep) % 1.0;

        // Amostragem rigorosamente contínua na curva de Bezier/CatmullRom
        const currentPos = this.pathCurve.getPointAt(this.pathProgress);
        const forwardDir = this.pathCurve.getTangentAt(this.pathProgress).normalize();

        // Ajusta rigorosamente à cota do terreno procedural
        if (this.getTerrainHeightFn) {
          currentPos.y = this.getTerrainHeightFn(currentPos.x, currentPos.z);
        }

        this.group.position.copy(currentPos);

        // Alinha a rotação suavemente na direção do movimento (tangente contínua)
        if (forwardDir.lengthSq() > 0.001) {
          const targetAngle = Math.atan2(forwardDir.x, forwardDir.z);
          let diff = targetAngle - this.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.group.rotation.y += diff * Math.min(1.0, dt * 6.5);
        }
      }

      // Cálculo de velocidade real com clamp protetivo contra picos de frame rate
      this.npcVelocity.subVectors(this.group.position, this.previousPosition).divideScalar(Math.max(0.001, dt));
      if (this.npcVelocity.length() > this.walkSpeed * 1.8) {
        this.npcVelocity.normalize().multiplyScalar(this.walkSpeed);
      }
      this.previousPosition.copy(this.group.position);

      // Animação de marcha biomecânica (pernas, braços e oscilação pélvica)
      const isWalking = !this.isIdle && this.npcVelocity.lengthSq() > 0.08;
      if (isWalking) {
        this.walkCycleTime += dt * 6.8;
        const walkSwing = Math.sin(this.walkCycleTime);
        this.leftLeg.rotation.x = walkSwing * 0.52;
        this.rightLeg.rotation.x = -walkSwing * 0.52;
        this.leftArm.rotation.x = -walkSwing * 0.42;

        // Oscilação vertical harmônica do corpo (bobbing de caminhada)
        this.bodyMesh.position.y = Math.abs(Math.sin(this.walkCycleTime)) * 0.06;

        this.headMesh.rotation.y = -walkSwing * 0.04;
        this.headMesh.rotation.x = 0.04;

        this.rightArm.rotation.x = 0.28 + Math.cos(this.walkCycleTime) * 0.03;
        this.rightArm.rotation.z = -0.14;
      } else {
        // Postura estática de descanso
        const breath = Math.sin(elapsedTime * 2.2);
        this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, dt * 6);
        this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, dt * 6);
        this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, breath * 0.06, dt * 5);
        this.bodyMesh.position.y = breath * 0.025;
        this.headMesh.rotation.y = THREE.MathUtils.lerp(this.headMesh.rotation.y, 0, dt * 4);
        this.headMesh.rotation.x = 0.05;
        this.rightArm.rotation.x = 0.35 + breath * 0.04;
        this.rightArm.rotation.z = -0.12;
      }

    // 2. Física Realista da Tocha (Arrasto de ar, empuxo térmico ascendente e inércia)
    const airDrag = this.npcVelocity.clone().multiplyScalar(-0.16);
    const thermalLift = 1.35;

    // Vórtices turbulentos do ar aquecido
    const turbulentX = Math.sin(elapsedTime * 14.5) * 0.05 + Math.cos(elapsedTime * 27.2) * 0.03;
    const turbulentZ = Math.cos(elapsedTime * 12.8) * 0.05 + Math.sin(elapsedTime * 31.0) * 0.03;

    const targetFlameOffset = new THREE.Vector3(
      airDrag.x + turbulentX,
      thermalLift,
      airDrag.z + turbulentZ
    );

    // Sistema de mola amortecida para inércia da chama
    const springStrength = 16.0;
    const damping = 0.75;
    const force = new THREE.Vector3().subVectors(targetFlameOffset, this.flameInertiaOffset).multiplyScalar(springStrength);
    this.flameInertiaVelocity.add(force.multiplyScalar(dt));
    this.flameInertiaVelocity.multiplyScalar(Math.pow(damping, dt * 60));
    this.flameInertiaOffset.add(this.flameInertiaVelocity.clone().multiplyScalar(dt));

    // Limites de segurança para manter a chama unida ao bocal da tocha
    this.flameInertiaOffset.x = THREE.MathUtils.clamp(this.flameInertiaOffset.x, -0.5, 0.5);
    this.flameInertiaOffset.z = THREE.MathUtils.clamp(this.flameInertiaOffset.z, -0.5, 0.5);
    this.flameInertiaOffset.y = THREE.MathUtils.clamp(this.flameInertiaOffset.y, 0.6, 2.0);

    this.flameCore.position.x = this.flameInertiaOffset.x * 0.22;
    this.flameCore.position.z = this.flameInertiaOffset.z * 0.22;
    this.flameOuter.position.x = this.flameInertiaOffset.x * 0.35;
    this.flameOuter.position.z = this.flameInertiaOffset.z * 0.35;

    // Pulsação térmica (escala e intensidade da chama)
    const flickerPulse = 1.0 + Math.sin(elapsedTime * 22.0) * 0.12 + Math.cos(elapsedTime * 38.0) * 0.08;
    this.flameCore.scale.set(flickerPulse, flickerPulse * 1.15, flickerPulse);
    this.flameOuter.scale.set(flickerPulse * 1.08, flickerPulse * 1.25, flickerPulse * 1.08);

    // Cintilação da Luz Dinâmica (PointLight)
    const rawFlicker =
      Math.sin(elapsedTime * 19.3) * 0.32 +
      Math.sin(elapsedTime * 41.7) * 0.22 +
      (Math.random() - 0.5) * 0.18;
    this.torchLight.intensity = Math.max(1.4, 2.5 + rawFlicker);

    // Posição no espaço mundial da ponta da tocha
    this.torchHandle.getWorldPosition(this.torchTipWorldPos);
    this.torchTipWorldPos.y += 0.5;

    // 3. Emissão e Propagação de Brasas Físicas (Embers)
    const localTipPos = this.torchTipWorldPos.clone().sub(this.group.position);

    if (Math.random() < 0.65) {
      const deadEmber = this.embers.find((e) => e.life <= 0);
      if (deadEmber) {
        deadEmber.position.copy(localTipPos);
        deadEmber.velocity.set(
          this.npcVelocity.x * -0.25 + (Math.random() - 0.5) * 0.6,
          1.8 + Math.random() * 1.2,
          this.npcVelocity.z * -0.25 + (Math.random() - 0.5) * 0.6
        );
        deadEmber.life = 0.5 + Math.random() * 0.8;
        deadEmber.maxLife = deadEmber.life;
        deadEmber.heat = 1.0;
        deadEmber.size = 0.12 + Math.random() * 0.1;
      }
    }

    const posArr = this.emberPositions;
    const colArr = this.emberColors;

    for (let i = 0; i < this.maxEmbers; i++) {
      const e = this.embers[i];
      if (e.life > 0) {
        e.life -= dt;
        const lifeT = 1.0 - e.life / e.maxLife;

        e.velocity.y += 1.8 * dt;
        e.velocity.x += (Math.random() - 0.5) * 2.0 * dt;
        e.velocity.z += (Math.random() - 0.5) * 2.0 * dt;
        e.velocity.multiplyScalar(Math.pow(0.86, dt * 60));

        e.position.addScaledVector(e.velocity, dt);

        posArr[i * 3] = e.position.x;
        posArr[i * 3 + 1] = e.position.y;
        posArr[i * 3 + 2] = e.position.z;

        // Decaimento térmico de cor
        e.heat = Math.max(0, 1.0 - lifeT);
        if (e.heat > 0.6) {
          const tColor = (e.heat - 0.6) / 0.4;
          colArr[i * 3] = 1.0;
          colArr[i * 3 + 1] = 0.6 + 0.4 * tColor;
          colArr[i * 3 + 2] = 0.1 * tColor;
        } else if (e.heat > 0.2) {
          const tColor = (e.heat - 0.2) / 0.4;
          colArr[i * 3] = 0.7 + 0.3 * tColor;
          colArr[i * 3 + 1] = 0.2 * tColor;
          colArr[i * 3 + 2] = 0.0;
        } else {
          const tColor = e.heat / 0.2;
          colArr[i * 3] = 0.35 * tColor;
          colArr[i * 3 + 1] = 0.1 * tColor;
          colArr[i * 3 + 2] = 0.05 * tColor;
        }
      } else {
        posArr[i * 3 + 1] = -999;
      }
    }

    this.emberGeo.attributes.position.needsUpdate = true;
    this.emberGeo.attributes.color.needsUpdate = true;
  }

  /**
   * Fornece dados da tocha para o shader da água
   */
  public getTorchData(): { position: THREE.Vector3; color: THREE.Color; intensity: number } {
    return {
      position: this.torchTipWorldPos,
      color: this.torchLight.color,
      intensity: this.torchLight.intensity,
    };
  }

  public dispose() {
    this.emberGeo.dispose();
    (this.emberPoints.material as THREE.Material).dispose();
  }
}
