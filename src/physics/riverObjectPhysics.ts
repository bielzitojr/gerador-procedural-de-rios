import * as THREE from 'three';
import { PhysicalObjectType, PHYSICAL_OBJECT_DEFS, createPhysicalMesh } from '../components/RiverObjects';
import { RiverConfig } from '../types';

export interface RiverPhysicsObjectTelemetry {
  id: string;
  type: PhysicalObjectType;
  name: string;
  icon: string;
  density: number;
  mass: number;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  speed: number;
  submersion: number;
  contactRadius: number;
  contactArea: number; // m²
  boxDimensions: { x: number; y: number; z: number };
  gravityForce: number; // N
  buoyancyForce: number; // N
  dragForce: number; // N
  netAccelY: number; // m/s²
  state: 'ar' | 'flutuando' | 'leito_rio';
  waterElevation: number;
}

export interface RiverPhysicsObject {
  id: string;
  type: PhysicalObjectType;
  name: string;
  group: THREE.Group;
  density: number;
  radius: number;
  mass: number;
  restitution: number;
  friction: number;

  // Estado dinâmico 3D
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;

  // Estado de contato hidrodinâmico
  submersion: number; // 0.0 (no ar) a 1.0 (totalmente submerso)
  isInRiver: boolean;
  isOnRiverBed: boolean;
  wakeId: number;
  lastSplashTime: number;
  bobPhase: number;

  // Telemetria para logs de debug
  telemetry: RiverPhysicsObjectTelemetry;

  // Auxiliares visuais de debug 3D
  debugGroup?: THREE.Group;
  boxHelper?: THREE.Box3Helper;
  contactDisc?: THREE.Mesh;
  arrowGravity?: THREE.ArrowHelper;
  arrowBuoyancy?: THREE.ArrowHelper;
  arrowDrag?: THREE.ArrowHelper;
}

export class RiverPhysicsManager {
  public objects: RiverPhysicsObject[] = [];
  public container: THREE.Group = new THREE.Group();
  public debugContainer: THREE.Group = new THREE.Group();
  public showDebug: boolean = false;
  private nextWakeId = 1;

  constructor() {
    this.container.name = 'PhysicalRiverObjectsGroup';
    this.debugContainer.name = 'PhysicalRiverDebugGroup';
    this.debugContainer.visible = false;
  }

  public setShowDebug(show: boolean) {
    this.showDebug = show;
    this.debugContainer.visible = show;
  }

  public getTelemetry(): RiverPhysicsObjectTelemetry[] {
    return this.objects.map((o) => o.telemetry);
  }

  /**
   * Spawns a new physical object in the 3D world
   */
  public spawnObject(
    type: PhysicalObjectType,
    pos: THREE.Vector3,
    initialVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  ): RiverPhysicsObject {
    const def = PHYSICAL_OBJECT_DEFS[type];
    const group = createPhysicalMesh(type);

    group.position.copy(pos);
    this.container.add(group);

    const initialTelemetry: RiverPhysicsObjectTelemetry = {
      id: '',
      type,
      name: def.name,
      icon: def.icon ?? '📦',
      density: def.density,
      mass: def.mass,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      vel: { x: initialVel.x, y: initialVel.y, z: initialVel.z },
      speed: initialVel.length(),
      submersion: 0,
      contactRadius: 0,
      contactArea: 0,
      boxDimensions: { x: def.radius * 2, y: def.radius * 2, z: def.radius * 2 },
      gravityForce: def.mass * 9.81,
      buoyancyForce: 0,
      dragForce: 0,
      netAccelY: -9.81,
      state: 'ar',
      waterElevation: 0,
    };

    const obj: RiverPhysicsObject = {
      id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type,
      name: def.name,
      group,
      density: def.density,
      radius: def.radius,
      mass: def.mass,
      restitution: def.restitution,
      friction: def.friction,
      pos: pos.clone(),
      vel: initialVel.clone(),
      rot: new THREE.Euler(0, 0, 0),
      rotVel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5),
      submersion: 0,
      isInRiver: false,
      isOnRiverBed: false,
      wakeId: this.nextWakeId++,
      lastSplashTime: 0,
      bobPhase: Math.random() * Math.PI * 2,
      telemetry: initialTelemetry,
    };
    initialTelemetry.id = obj.id;

    // Criar nós de debug 3D
    this.setupDebugVisuals(obj);

    this.objects.push(obj);
    return obj;
  }

  private setupDebugVisuals(obj: RiverPhysicsObject) {
    const debugGroup = new THREE.Group();
    debugGroup.name = `Debug_${obj.id}`;

    // 1. Bounding Box Helper (caixa delimitadora 3D com cor viva)
    const box = new THREE.Box3();
    box.setFromObject(obj.group);
    const boxHelper = new THREE.Box3Helper(box, new THREE.Color(0x00f0ff));
    debugGroup.add(boxHelper);
    obj.boxHelper = boxHelper;

    // 2. Anel indicador da Área de Contato na Linha d'Água (Waterline Contact Area)
    const ringGeo = new THREE.RingGeometry(0.04, Math.max(0.1, obj.radius * 0.95), 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthTest: true,
    });
    const contactDisc = new THREE.Mesh(ringGeo, ringMat);
    contactDisc.visible = false;
    debugGroup.add(contactDisc);
    obj.contactDisc = contactDisc;

    // 3. Vetores de Força 3D (Arrow Helpers)
    // a) Gravidade (Vermelho apontando para baixo)
    const arrowGravity = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      obj.pos,
      1.0,
      0xef4444,
      0.2,
      0.12
    );
    debugGroup.add(arrowGravity);
    obj.arrowGravity = arrowGravity;

    // b) Empuxo de Arquimedes (Ciano apontando para cima)
    const arrowBuoyancy = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      obj.pos,
      1.0,
      0x06b6d4,
      0.2,
      0.12
    );
    debugGroup.add(arrowBuoyancy);
    obj.arrowBuoyancy = arrowBuoyancy;

    // c) Força de Arrasto da Correnteza (Esmeralda na direção do fluxo)
    const arrowDrag = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      obj.pos,
      1.0,
      0x10b981,
      0.2,
      0.12
    );
    debugGroup.add(arrowDrag);
    obj.arrowDrag = arrowDrag;

    obj.debugGroup = debugGroup;
    this.debugContainer.add(debugGroup);
  }


  /**
   * Sincroniza a quantidade de patos do slider 'duckCount'
   */
  public syncDuckCount(
    duckCount: number,
    curve: THREE.CatmullRomCurve3,
    riverWidth: number,
    flowSpeed: number
  ) {
    // 1. Filtrar patos existentes criados pelo slider
    const currentSliderDucks = this.objects.filter((o) => o.type === 'duck' && o.id.startsWith('slider_duck_'));

    // Se a meta é 0, remover TODOS os patos do slider
    if (duckCount <= 0) {
      currentSliderDucks.forEach((d) => this.removeObject(d.id));
      return;
    }

    // Se já temos a quantidade certa, não faz nada
    if (currentSliderDucks.length === duckCount) {
      return;
    }

    // Se temos mais do que o desejado, remover excedentes
    if (currentSliderDucks.length > duckCount) {
      const toRemove = currentSliderDucks.slice(duckCount);
      toRemove.forEach((d) => this.removeObject(d.id));
      return;
    }

    // Se temos menos, adicionar os que faltam distribuídos ao longo do rio
    const toAdd = duckCount - currentSliderDucks.length;
    for (let i = 0; i < toAdd; i++) {
      const idx = currentSliderDucks.length + i;
      const t = 0.12 + (idx / Math.max(1, duckCount)) * 0.72;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const lateral = (idx === 0) ? 0 : (Math.sin(idx * 3.7) * 0.45);
      const lateralDist = lateral * (riverWidth * 0.38);
      const spawnPos = point.clone().add(side.clone().multiplyScalar(lateralDist));
      spawnPos.y = point.y + 0.15; // repousa na linha d'água

      const duck = this.spawnObject('duck', spawnPos, tangent.clone().multiplyScalar(flowSpeed * 0.8));
      duck.id = `slider_duck_${idx}_${Date.now()}`;
    }
  }

  /**
   * Remove um objeto pelo ID
   */
  public removeObject(id: string) {
    const idx = this.objects.findIndex((o) => o.id === id);
    if (idx !== -1) {
      const obj = this.objects[idx];
      this.container.remove(obj.group);
      if (obj.debugGroup) {
        this.debugContainer.remove(obj.debugGroup);
      }
      this.objects.splice(idx, 1);
    }
  }

  /**
   * Limpa todos os objetos soltos pelo usuário (mantendo os patos do slider se houver)
   */
  public clearUserSpawnedObjects() {
    const toRemove = this.objects.filter((o) => !o.id.startsWith('slider_duck_'));
    toRemove.forEach((o) => this.removeObject(o.id));
  }

  /**
   * Aplica um impulso físico (ex: empurrar com a mão ou clique)
   */
  public applyImpulseToFirst(impulse: THREE.Vector3) {
    if (this.objects.length > 0) {
      this.objects[0].vel.add(impulse);
    }
  }

  /**
   * Passo de Simulação Física em Tempo Real (Física de Fluidos & Corpos Rígidos)
   */
  public update(
    time: number,
    delta: number,
    config: RiverConfig,
    curve: THREE.CatmullRomCurve3,
    getDistanceToRiver: (x: number, z: number) => { distance: number; riverY: number; t: number },
    getTerrainHeight: (x: number, z: number) => number,
    addRipple?: (x: number, z: number, radius: number, strength: number) => void,
    addWake?: (x: number, z: number, dirX: number, dirZ: number, speed: number, strength: number, objectId?: number) => void
  ) {
    const dt = Math.min(delta, 0.04); // sub-passo estável
    const g = 9.81; // Aceleração da gravidade real (m/s²)
    const waterDensity = config.waterDensity ?? 1.0;
    const buoyancyMult = config.buoyancy ?? 1.4;
    const viscosity = config.waterViscosity ?? 0.8;
    const halfRiverWidth = (config.riverWidth ?? 6.0) * 0.5;
    const flowSpeed = config.flowSpeed ?? 1.0;
    const currentStrength = config.currentStrength ?? 1.2;
    const surfaceCurrentSpeed = flowSpeed * Math.max(0.1, currentStrength) * 3.4;

    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];

      // 1. Obter posição em relação ao rio e leito
      const riverInfo = getDistanceToRiver(obj.pos.x, obj.pos.z);
      const isOverRiverChannel = riverInfo.distance <= halfRiverWidth;
      const waterSurfaceY = riverInfo.riverY;
      const terrainY = getTerrainHeight(obj.pos.x, obj.pos.z);

      // 2. Cálculo do Volume Submerso (Princípio de Arquimedes)
      const bottomY = obj.pos.y - obj.radius;
      const topY = obj.pos.y + obj.radius;

      let subFraction = 0.0;
      if (isOverRiverChannel && bottomY < waterSurfaceY) {
        if (topY <= waterSurfaceY) {
          subFraction = 1.0; // Totalmente submerso
        } else {
          subFraction = THREE.MathUtils.clamp((waterSurfaceY - bottomY) / (obj.radius * 2.0), 0.0, 1.0);
        }
      }

      obj.submersion = subFraction;
      obj.isInRiver = isOverRiverChannel && subFraction > 0.0;

      // 3. Forças Verticais:
      // a) Gravidade (sempre atua para baixo)
      let netAccelY = -g;

      // b) Empuxo de Arquimedes:
      // F_empuxo = densidade_água * volume_submerso * g
      // Aceleração = F_empuxo / massa = (densidade_água / densidade_objeto) * subFraction * g * buoyancyMult
      if (subFraction > 0.0) {
        const buoyantAccel = (waterDensity / Math.max(0.08, obj.density)) * subFraction * g * buoyancyMult;
        netAccelY += buoyantAccel;

        // c) Arrasto hidrodinâmico vertical na água (resistência viscosa)
        const verticalDrag = -obj.vel.y * (3.8 * viscosity + 1.2 * subFraction);
        netAccelY += verticalDrag;

        // Efeito de respingo (splash) no impacto com a água
        if (obj.vel.y < -1.8 && time - obj.lastSplashTime > 0.35 && addRipple) {
          obj.lastSplashTime = time;
          const splashForce = Math.min(3.0, Math.abs(obj.vel.y) * 0.6) * (config.rippleIntensity ?? 1.2);
          addRipple(obj.pos.x, obj.pos.z, obj.radius * 2.6, splashForce);
        }
      } else {
        // Arrasto do ar leve quando fora da água
        netAccelY += -obj.vel.y * 0.05;
      }

      // 4. Forças Horizontais & Correnteza do Rio:
      let netAccelX = 0;
      let netAccelZ = 0;

      if (obj.isInRiver && subFraction > 0.05) {
        // Obter vetor tangente do rio no ponto
        const tangent = curve.getTangent(riverInfo.t).normalize();

        // Perfil de velocidade da correnteza com atrito do leito:
        // Na superfície, a água corre veloz. Perto do fundo (leito de pedras), a velocidade cai
        const depthFactor = THREE.MathUtils.clamp((obj.pos.y - terrainY) / Math.max(0.4, waterSurfaceY - terrainY), 0.15, 1.0);
        const surfaceCurrentSpeed = flowSpeed * Math.max(0.1, currentStrength) * 3.4;
        const currentSpeed = surfaceCurrentSpeed * (0.35 + 0.65 * depthFactor);

        const riverVelX = tangent.x * currentSpeed;
        const riverVelZ = tangent.z * currentSpeed;

        // A correnteza exerce força de arraste hidrodinâmico:
        // Objetos de baixa densidade (ex: patinho com densidade 0.24) são levados muito mais facilmente
        // Objetos densos (ex: pedra 2.65, metal 7.85) sofrem pouco arraste em relação à sua alta inércia
        const dragCoeff = (subFraction / Math.max(0.12, obj.density)) * 2.8 * viscosity;
        const dragAccX = (riverVelX - obj.vel.x) * dragCoeff;
        const dragAccZ = (riverVelZ - obj.vel.z) * dragCoeff;
        netAccelX += dragAccX;
        netAccelZ += dragAccZ;

        // Se estiver muito perto da margem, suave centralização na calha
        const bankCentering = (riverInfo.distance / halfRiverWidth);
        if (bankCentering > 0.72) {
          const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
          const toCenter = curve.getPoint(riverInfo.t).sub(obj.pos);
          toCenter.y = 0;
          toCenter.normalize();
          netAccelX += toCenter.x * 2.2;
          netAccelZ += toCenter.z * 2.2;
        }

        // Emissão de esteira hidrodinâmica suave ao longo do fluxo
        if (addWake && obj.vel.length() > 0.25) {
          addWake(
            obj.pos.x,
            obj.pos.z,
            tangent.x,
            tangent.z,
            obj.vel.length(),
            (config.rippleIntensity ?? 1.2) * (obj.radius * 1.5),
            obj.wakeId
          );
        }
      } else {
        // Fora da água: desaceleração por atrito com o ar
        netAccelX += -obj.vel.x * 0.1;
        netAccelZ += -obj.vel.z * 0.1;
      }

      // 5. Integração Euler Semi-Implícita (estável e robusta)
      obj.vel.x += netAccelX * dt;
      obj.vel.y += netAccelY * dt;
      obj.vel.z += netAccelZ * dt;

      obj.pos.x += obj.vel.x * dt;
      obj.pos.y += obj.vel.y * dt;
      obj.pos.z += obj.vel.z * dt;

      // 6. Colisão com o Solo / Leito do Rio:
      const groundLimit = terrainY + obj.radius * 0.85;
      if (obj.pos.y < groundLimit) {
        obj.pos.y = groundLimit;
        obj.isOnRiverBed = true;

        // Impacto no solo
        if (obj.vel.y < 0) {
          obj.vel.y = -obj.vel.y * obj.restitution;
        }

        // Atrito estático / dinâmico com o leito (impede que pedras pesadas deslizem)
        const groundFriction = Math.min(1.0, obj.friction * (1.0 + (obj.density > 1.5 ? 2.5 : 0.5)) * dt * 14.0);
        obj.vel.x *= (1.0 - groundFriction);
        obj.vel.z *= (1.0 - groundFriction);
      } else {
        obj.isOnRiverBed = false;
      }

      // 7. Rotação Física, Equilíbrio Hidrostático e Balanço Orgânico:
      if (obj.isInRiver && subFraction > 0.2) {
        // Torque restaurador hidrostático (metacentro):
        // Objetos flutuantes (pato, barco) buscam orientação vertical (+Y)
        const tangent = curve.getTangent(riverInfo.t).normalize();
        const targetYaw = Math.atan2(tangent.x, tangent.z);

        // Suave alinhamento com a correnteza
        obj.rot.y = THREE.MathUtils.lerp(obj.rot.y, targetYaw, 0.06);

        // Balanço orgânico pelas ondas
        const waveTiltX = Math.sin(time * 2.1 + obj.bobPhase) * 0.035 * (1.0 / viscosity);
        const waveTiltZ = Math.cos(time * 1.9 + obj.bobPhase) * 0.045 * (1.0 / viscosity);
        obj.rot.x = THREE.MathUtils.lerp(obj.rot.x, waveTiltX, 0.1);
        obj.rot.z = THREE.MathUtils.lerp(obj.rot.z, waveTiltZ, 0.1);
      } else {
        // Rotação livre no ar ou rolando no chão
        obj.rot.x += obj.rotVel.x * dt;
        obj.rot.y += obj.rotVel.y * dt;
        obj.rot.z += obj.rotVel.z * dt;
        obj.rotVel.multiplyScalar(0.98);
      }

      // 8. Atualizar Transform da Malha 3D
      obj.group.position.copy(obj.pos);
      obj.group.rotation.copy(obj.rot);

      // 9. Cálculo de Telemetria e Logs Visuais de Debug
      const gravityForceN = obj.mass * g;
      const buoyancyForceN =
        subFraction > 0
          ? (waterDensity / Math.max(0.08, obj.density)) * subFraction * obj.mass * g * buoyancyMult
          : 0;
      const dragForceN =
        obj.isInRiver && subFraction > 0.05
          ? Math.sqrt(netAccelX * netAccelX + netAccelZ * netAccelZ) * obj.mass
          : 0;

      let contactRadius = 0;
      let contactArea = 0;
      if (subFraction > 0 && subFraction < 1.0) {
        const distToWater = Math.abs(waterSurfaceY - obj.pos.y);
        contactRadius = Math.sqrt(Math.max(0.001, obj.radius * obj.radius - distToWater * distToWater));
        contactArea = Math.PI * contactRadius * contactRadius;
      } else if (subFraction >= 1.0) {
        contactRadius = obj.radius;
        contactArea = Math.PI * obj.radius * obj.radius;
      }

      const objBox = new THREE.Box3().setFromObject(obj.group);
      const boxSize = objBox.getSize(new THREE.Vector3());

      let state: 'ar' | 'flutuando' | 'leito_rio' = 'ar';
      if (obj.isOnRiverBed) {
        state = 'leito_rio';
      } else if (subFraction > 0.05) {
        state = 'flutuando';
      }

      obj.telemetry = {
        id: obj.id,
        type: obj.type,
        name: obj.name,
        icon: PHYSICAL_OBJECT_DEFS[obj.type]?.icon ?? '📦',
        density: obj.density,
        mass: obj.mass,
        pos: { x: obj.pos.x, y: obj.pos.y, z: obj.pos.z },
        vel: { x: obj.vel.x, y: obj.vel.y, z: obj.vel.z },
        speed: obj.vel.length(),
        submersion: subFraction,
        contactRadius,
        contactArea,
        boxDimensions: { x: boxSize.x, y: boxSize.y, z: boxSize.z },
        gravityForce: gravityForceN,
        buoyancyForce: buoyancyForceN,
        dragForce: dragForceN,
        netAccelY,
        state,
        waterElevation: waterSurfaceY,
      };

      // 10. Atualizar Auxiliares Visuais 3D
      if (this.showDebug && obj.debugGroup) {
        if (obj.boxHelper) {
          obj.boxHelper.box.copy(objBox);
          const boxColor =
            state === 'flutuando' ? 0x00f0ff : state === 'leito_rio' ? 0xf97316 : 0xfacc15;
          (obj.boxHelper.material as THREE.LineBasicMaterial).color.setHex(boxColor);
        }

        if (obj.contactDisc) {
          if (subFraction > 0.02) {
            obj.contactDisc.visible = true;
            obj.contactDisc.position.set(obj.pos.x, waterSurfaceY + 0.015, obj.pos.z);
            const discScale = Math.max(0.15, contactRadius / Math.max(0.1, obj.radius));
            obj.contactDisc.scale.set(discScale, discScale, 1.0);
          } else {
            obj.contactDisc.visible = false;
          }
        }

        const arrowScale = 0.12;
        if (obj.arrowGravity) {
          obj.arrowGravity.position.copy(obj.pos);
          const gLen = Math.min(3.0, Math.max(0.2, gravityForceN * arrowScale));
          obj.arrowGravity.setLength(gLen, gLen * 0.25, gLen * 0.15);
        }
        if (obj.arrowBuoyancy) {
          obj.arrowBuoyancy.position.copy(obj.pos);
          if (buoyancyForceN > 0.05) {
            obj.arrowBuoyancy.visible = true;
            const bLen = Math.min(3.0, Math.max(0.2, buoyancyForceN * arrowScale));
            obj.arrowBuoyancy.setLength(bLen, bLen * 0.25, bLen * 0.15);
          } else {
            obj.arrowBuoyancy.visible = false;
          }
        }
        if (obj.arrowDrag) {
          obj.arrowDrag.position.copy(obj.pos);
          if (dragForceN > 0.05) {
            obj.arrowDrag.visible = true;
            const dLen = Math.min(3.0, Math.max(0.2, dragForceN * arrowScale));
            const dragDir = new THREE.Vector3(netAccelX, 0, netAccelZ);
            if (dragDir.lengthSq() > 0.001) {
              obj.arrowDrag.setDirection(dragDir.normalize());
            }
            obj.arrowDrag.setLength(dLen, dLen * 0.25, dLen * 0.15);
          } else {
            obj.arrowDrag.visible = false;
          }
        }
      }

      // 11. Recirculação Contínua Rio Abaixo (quando atinge o fim do rio, reaparece suavemente no início)
      if (riverInfo.t > 0.96 || obj.pos.z > 58) {
        const startPoint = curve.getPoint(0.04);
        const startTan = curve.getTangent(0.04).normalize();
        const startSide = new THREE.Vector3(-startTan.z, 0, startTan.x).normalize();
        const lateralJitter = (Math.sin(i * 4.3) * 0.35) * (config.riverWidth * 0.3);

        obj.pos.copy(startPoint).add(startSide.multiplyScalar(lateralJitter));
        obj.pos.y = startPoint.y + 0.15;
        obj.vel.copy(startTan).multiplyScalar(surfaceCurrentSpeed * 0.75);
      }
    }
  }

  public dispose() {
    while (this.container.children.length > 0) {
      this.container.remove(this.container.children[0]);
    }
    while (this.debugContainer.children.length > 0) {
      this.debugContainer.remove(this.debugContainer.children[0]);
    }
    this.objects = [];
  }
}
