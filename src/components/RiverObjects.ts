import * as THREE from 'three';
import { createDuckMesh } from './DuckModel';

export type PhysicalObjectType =
  | 'duck'
  | 'log'
  | 'boat'
  | 'rock'
  | 'metal'
  | 'apple'
  | 'bottle'
  | 'leaf'
  | 'ball'
  | 'gold';

export interface PhysicalObjectDef {
  type: PhysicalObjectType;
  name: string;
  density: number; // g/cm³ (água = 1.0)
  radius: number; // Raio colisor aproximado
  mass: number; // kg
  restitution: number;
  friction: number;
  description: string;
  badge: string;
  icon: string;
}

export const PHYSICAL_OBJECT_DEFS: Record<PhysicalObjectType, PhysicalObjectDef> = {
  duck: {
    type: 'duck',
    name: 'Patinho de Borracha',
    density: 0.24, // Flutua com ~24% submerso (muito leve)
    radius: 0.48,
    mass: 0.12,
    restitution: 0.35,
    friction: 0.45,
    description: 'Borracha oca: flutua alto, balança nas ondas e é arrastado com agilidade pela correnteza.',
    badge: 'Flutua Alto (0.24 g/cm³)',
    icon: '🦆',
  },
  boat: {
    type: 'boat',
    name: 'Barquinho de Papel',
    density: 0.12, // Super leve, boia na flor d’água
    radius: 0.42,
    mass: 0.05,
    restitution: 0.2,
    friction: 0.3,
    description: 'Origami leve: flutua no topo da água e acompanha instantaneamente a linha do fluxo.',
    badge: 'Super Leve (0.12 g/cm³)',
    icon: '⛵',
  },
  apple: {
    type: 'apple',
    name: 'Maçã Vermelha Fresca',
    density: 0.82, // Fruta fresca flutua com ~82% de submersão
    radius: 0.28,
    mass: 0.18,
    restitution: 0.42,
    friction: 0.5,
    description: 'Bolsas de ar celulares: flutua com ~80% submersa, quica suave na queda e balança no fluxo.',
    badge: 'Flutua ~82% (0.82 g/cm³)',
    icon: '🍎',
  },
  bottle: {
    type: 'bottle',
    name: 'Garrafa com Mensagem',
    density: 0.48, // Vidro verde selado com ar e pergaminho
    radius: 0.36,
    mass: 0.38,
    restitution: 0.22,
    friction: 0.42,
    description: 'Vidro selado com ar: boia inclinada no fluxo com o gargalo para cima e rola nas curvas.',
    badge: 'Boia Inclinada (0.48 g/cm³)',
    icon: '🍾',
  },
  log: {
    type: 'log',
    name: 'Tronco de Madeira',
    density: 0.65, // Flutua parcialmente submerso (~65%)
    radius: 0.45,
    mass: 2.2,
    restitution: 0.25,
    friction: 0.6,
    description: 'Madeira maciça: flutua meio submerso, tem inércia estável e segue o leito do rio.',
    badge: 'Meio Submerso (0.65 g/cm³)',
    icon: '🪵',
  },
  leaf: {
    type: 'leaf',
    name: 'Folha Outonal',
    density: 0.06, // Ultraleve na película superficial
    radius: 0.32,
    mass: 0.006,
    restitution: 0.05,
    friction: 0.25,
    description: 'Ultraleve e plana: navega na película da água, gira em redemoinhos e reflete marolas.',
    badge: 'Película da Água (0.06 g/cm³)',
    icon: '🍁',
  },
  ball: {
    type: 'ball',
    name: 'Bola de Praia Inflável',
    density: 0.08, // Cheia de ar, alta restituição / quica muito
    radius: 0.44,
    mass: 0.22,
    restitution: 0.80,
    friction: 0.32,
    description: 'Elástica e pressurizada com ar: quica na queda d’água e corre veloz sobre a crista do rio.',
    badge: 'Super Elástica (0.08 g/cm³)',
    icon: '⚽',
  },
  rock: {
    type: 'rock',
    name: 'Pedra de Rio (Granito)',
    density: 2.65, // Mais denso que a água -> afunda até o fundo
    radius: 0.40,
    mass: 4.2,
    restitution: 0.15,
    friction: 0.85,
    description: 'Mais pesada que a água: afunda até o leito rochoso e resiste à correnteza pelo atrito com o fundo.',
    badge: 'Afunda no Leito (2.65 g/cm³)',
    icon: '🪨',
  },
  metal: {
    type: 'metal',
    name: 'Esfera / Peso de Metal',
    density: 7.85, // Metal denso -> afunda reto
    radius: 0.36,
    mass: 9.5,
    restitution: 0.1,
    friction: 0.95,
    description: 'Aço/ferro maciço: afunda rapidamente como uma âncora até o fundo do leito do rio e não é levado pela correnteza.',
    badge: 'Âncora Pesada (7.85 g/cm³)',
    icon: '⚓',
  },
  gold: {
    type: 'gold',
    name: 'Barra de Ouro Maciço 24k',
    density: 19.3, // Densidade extrema do ouro puro (19.3 g/cm³)
    radius: 0.32,
    mass: 14.2,
    restitution: 0.04,
    friction: 0.98,
    description: 'Densidade extrema (19.3 g/cm³): cai a pique no rio sem hesitação e permanece estático no leito.',
    badge: 'Densidade Extrema (19.3 g/cm³)',
    icon: '🧈',
  },
};

/**
 * Cria a malha 3D do objeto físico conforme seu tipo
 */
export function createPhysicalMesh(type: PhysicalObjectType): THREE.Group {
  const group = new THREE.Group();

  switch (type) {
    case 'duck': {
      const duckMesh = createDuckMesh();
      duckMesh.scale.set(0.9, 0.9, 0.9);
      group.add(duckMesh);
      break;
    }

    case 'log': {
      // Tronco de madeira cilíndrico com textura de casca e extremidades
      const barkMat = new THREE.MeshStandardMaterial({
        color: 0x5a3d28,
        roughness: 0.88,
        metalness: 0.05,
      });
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xc8a165,
        roughness: 0.75,
        metalness: 0.02,
      });

      const trunkGeo = new THREE.CylinderGeometry(0.28, 0.30, 1.7, 16);
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.rotation.z = Math.PI / 2; // deitado horizontalmente
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      group.add(trunk);

      // Anéis nas extremidades
      const capGeo = new THREE.CircleGeometry(0.28, 16);
      const cap1 = new THREE.Mesh(capGeo, ringMat);
      cap1.rotation.y = Math.PI / 2;
      cap1.position.x = 0.851;
      group.add(cap1);

      const cap2 = new THREE.Mesh(capGeo, ringMat);
      cap2.rotation.y = -Math.PI / 2;
      cap2.position.x = -0.851;
      group.add(cap2);

      // Pequeno galho saindo do tronco
      const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8);
      const branch = new THREE.Mesh(branchGeo, barkMat);
      branch.position.set(0.2, 0.28, 0.0);
      branch.rotation.z = 0.35;
      branch.rotation.x = 0.4;
      branch.castShadow = true;
      group.add(branch);

      break;
    }

    case 'boat': {
      // Barquinho de origami estilizado
      const paperMat = new THREE.MeshStandardMaterial({
        color: 0xf5f6fa,
        roughness: 0.5,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });

      // Casco do barco
      const hullGeo = new THREE.ConeGeometry(0.48, 1.1, 4);
      hullGeo.scale(1.2, 0.45, 0.75);
      const hull = new THREE.Mesh(hullGeo, paperMat);
      hull.rotation.z = Math.PI; // Base plana na água
      hull.position.y = 0.12;
      hull.castShadow = true;
      group.add(hull);

      // Vela de papel triangular central
      const sailGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.2, 0.15, 0.0,
         0.25, 0.15, 0.0,
         0.0, 0.75, 0.0,
      ]);
      sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      sailGeo.computeVertexNormals();

      const sailMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.4,
        side: THREE.DoubleSide,
      });
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.castShadow = true;
      group.add(sail);

      break;
    }

    case 'rock': {
      // Rocha de rio facetada e resistente
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x6e7681,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: true,
      });

      const rockGeo = new THREE.DodecahedronGeometry(0.38, 1);
      // Deformar vértices levemente para dar aparência natural
      const pos = rockGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const factor = 0.88 + Math.sin(vx * 7.0 + vy * 3.0) * 0.15;
        pos.setXYZ(i, vx * factor, vy * (factor * 0.75), vz * factor);
      }
      rockGeo.computeVertexNormals();

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
      break;
    }

    case 'metal': {
      // Esfera de aço / metal reflexiva e pesada
      const metalMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.18,
        metalness: 0.92,
      });

      const metalGeo = new THREE.SphereGeometry(0.34, 24, 20);
      const sphere = new THREE.Mesh(metalGeo, metalMat);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      group.add(sphere);

      // Anel superior de âncora
      const torusGeo = new THREE.TorusGeometry(0.12, 0.035, 12, 20);
      const ring = new THREE.Mesh(torusGeo, metalMat);
      ring.position.y = 0.34;
      ring.castShadow = true;
      group.add(ring);
      break;
    }

    case 'apple': {
      // Maçã vermelha fresca com formato levemente cônico, cabinho marrom e folha verde
      const appleMat = new THREE.MeshStandardMaterial({
        color: 0xdf2935,
        roughness: 0.35,
        metalness: 0.05,
      });

      const appleGeo = new THREE.SphereGeometry(0.26, 20, 16);
      const aPos = appleGeo.attributes.position;
      for (let i = 0; i < aPos.count; i++) {
        const y = aPos.getY(i);
        const x = aPos.getX(i);
        const z = aPos.getZ(i);
        // Depressão superior e cônica inferior típica de maçã
        const taper = 1.0 - (y < 0 ? y * -0.22 : 0.0);
        const topIndent = (y > 0.18) ? 0.85 : 1.0;
        aPos.setXYZ(i, x * taper * topIndent, y * 0.95, z * taper * topIndent);
      }
      appleGeo.computeVertexNormals();

      const appleMesh = new THREE.Mesh(appleGeo, appleMat);
      appleMesh.castShadow = true;
      group.add(appleMesh);

      // Cabinho marrom
      const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.16, 6);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(0.02, 0.26, 0);
      stem.rotation.z = -0.2;
      group.add(stem);

      // Folha verde pequena no cabinho
      const leafGeo = new THREE.BufferGeometry();
      const lVerts = new Float32Array([
        0, 0, 0,
        0.08, 0.05, 0.02,
        0.16, 0.04, 0,
        0.08, -0.01, -0.02,
      ]);
      leafGeo.setIndex([0, 1, 2, 0, 2, 3]);
      leafGeo.setAttribute('position', new THREE.BufferAttribute(lVerts, 3));
      leafGeo.computeVertexNormals();
      const lMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5, side: THREE.DoubleSide });
      const leaf = new THREE.Mesh(leafGeo, lMat);
      leaf.position.set(0.03, 0.28, 0);
      leaf.rotation.x = 0.3;
      group.add(leaf);
      break;
    }

    case 'bottle': {
      // Garrafa com mensagem: corpo cilíndrico de vidro verde translúcido, gargalo cônico, rolha e pergaminho
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.72,
      });

      // Corpo principal
      const bodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.65, 16);
      const body = new THREE.Mesh(bodyGeo, glassMat);
      body.castShadow = true;
      group.add(body);

      // Gargalo
      const neckGeo = new THREE.CylinderGeometry(0.07, 0.14, 0.32, 16);
      const neck = new THREE.Mesh(neckGeo, glassMat);
      neck.position.y = 0.45;
      group.add(neck);

      // Rolha de cortiça
      const corkGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.12, 12);
      const corkMat = new THREE.MeshStandardMaterial({ color: 0xb5854b, roughness: 0.85 });
      const cork = new THREE.Mesh(corkGeo, corkMat);
      cork.position.y = 0.62;
      group.add(cork);

      // Pergaminho enrolado dentro
      const parchmentGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.45, 10);
      const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 });
      const parchment = new THREE.Mesh(parchmentGeo, parchmentMat);
      parchment.position.set(0.02, 0, 0.02);
      parchment.rotation.z = 0.18;
      group.add(parchment);

      // Inclinada para flutuar organicamente
      group.rotation.z = -0.55;
      break;
    }

    case 'leaf': {
      // Folha outonal estilizada (plana, com pontas e nervura central)
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.65,
        side: THREE.DoubleSide,
        flatShading: true,
      });

      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, -0.28);
      leafShape.quadraticCurveTo(0.24, -0.05, 0.35, 0.12);
      leafShape.quadraticCurveTo(0.18, 0.18, 0.28, 0.38);
      leafShape.quadraticCurveTo(0.08, 0.32, 0, 0.52);
      leafShape.quadraticCurveTo(-0.08, 0.32, -0.28, 0.38);
      leafShape.quadraticCurveTo(-0.18, 0.18, -0.35, 0.12);
      leafShape.quadraticCurveTo(-0.24, -0.05, 0, -0.28);

      const leafGeo = new THREE.ShapeGeometry(leafShape);
      leafGeo.rotateX(-Math.PI / 2); // Deitada plana na flor d'água
      const leafMesh = new THREE.Mesh(leafGeo, leafMat);
      leafMesh.castShadow = true;
      group.add(leafMesh);

      // Haste da folha
      const petioleGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.22, 6);
      const petioleMat = new THREE.MeshStandardMaterial({ color: 0x9a3412 });
      const petiole = new THREE.Mesh(petioleGeo, petioleMat);
      petiole.position.set(0, 0, 0.38);
      petiole.rotation.x = Math.PI / 2;
      group.add(petiole);
      break;
    }

    case 'ball': {
      // Bola de praia inflável estilizada com gomos coloridos
      const ballMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.25,
        metalness: 0.08,
      });

      const ballGeo = new THREE.SphereGeometry(0.38, 24, 20);
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.castShadow = true;
      group.add(ball);

      // Faixa central contrastante
      const stripeGeo = new THREE.TorusGeometry(0.382, 0.04, 12, 32);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = Math.PI / 2;
      group.add(stripe);
      break;
    }

    case 'gold': {
      // Barra / Lingote de ouro maciço com topo chanfrado
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.22,
        metalness: 0.95,
      });

      // Formato trapezoidal de lingote de ouro
      const ingotGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.22, 4);
      ingotGeo.rotateY(Math.PI / 4);
      ingotGeo.scale(1.8, 1.0, 0.9);
      const ingot = new THREE.Mesh(ingotGeo, goldMat);
      ingot.castShadow = true;
      ingot.receiveShadow = true;
      group.add(ingot);
      break;
    }
  }

  return group;
}
