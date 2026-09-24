import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RiverConfig, CameraMode } from '../types';
import { waterVertexShader, waterFragmentShader, WATER_PALETTES } from '../shaders/waterShader';
import {
  generateCausticsTexture,
  generateWaveTexture,
  generateWaveNormalTexture,
  generateFoamTexture,
} from '../shaders/proceduralTextures';
import { generateProceduralRiver, RiverData } from '../procedural/riverMesh';
import { WaterRippleSimulation } from '../physics/waterRippleSimulation';
import { RainSystem } from './RainSystem';
import { CelestialCycle } from './CelestialCycle';
import { NPCWithTorch } from './NPCWithTorch';
import { PuddlesSystem } from './PuddlesSystem';
import { PhysicalObjectType } from './RiverObjects';

interface RiverCanvasProps {
  config: RiverConfig;
  cameraMode: CameraMode;
  onCameraModeChange?: (mode: CameraMode) => void;
  onTimeUpdate?: (timeHour: number) => void;
}

export const RiverCanvas: React.FC<RiverCanvasProps> = ({
  config,
  cameraMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const depthTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);

  const celestialCycleRef = useRef<CelestialCycle | null>(null);
  const npcRef = useRef<NPCWithTorch | null>(null);
  const puddlesRef = useRef<PuddlesSystem | null>(null);
  const timeHourRef = useRef<number>(config.timeHour ?? 11.5);

  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const riverDataRef = useRef<RiverData | null>(null);
  const rippleSimRef = useRef<WaterRippleSimulation | null>(null);
  const rainSystemRef = useRef<RainSystem | null>(null);

  const riverGroupRef = useRef<THREE.Group>(new THREE.Group());

  // Keep a stable ref of props for animation loop
  const configRef = useRef(config);
  configRef.current = config;
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Background color matching Godot 4 default sky
    scene.background = new THREE.Color('#8cb6de');
    scene.fog = new THREE.Fog('#8cb6de', 85, 260);

    // 2. Camera: Framed beautifully for procedural river exploration
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 350);
    camera.position.set(22, 26, 32);
    cameraRef.current = camera;

    // 3. Renderer with antialias and shadow map
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't clip below ground
    controls.minDistance = 4;
    controls.maxDistance = 150;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Celestial Cycle System (Realistic Day / Night celestial rotation, sun, moon, stars & lighting)
    const celestialCycle = new CelestialCycle();
    celestialCycleRef.current = celestialCycle;
    scene.add(celestialCycle.group);

    // 6. Ripple Physics Simulation (covers full 130x130 river terrain domain)
    const rippleSim = new WaterRippleSimulation(256, 130, 130);
    rippleSimRef.current = rippleSim;

    // 7. Depth Render Target for Contact Foam (Scaled to physical drawing buffer for all devices)
    const drawingBufferSize = new THREE.Vector2();
    renderer.getDrawingBufferSize(drawingBufferSize);

    const depthTexture = new THREE.DepthTexture(drawingBufferSize.x, drawingBufferSize.y);
    depthTexture.type = THREE.UnsignedIntType;
    const depthTarget = new THREE.WebGLRenderTarget(drawingBufferSize.x, drawingBufferSize.y, {
      depthTexture,
      depthBuffer: true,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    depthTargetRef.current = depthTarget;

    // Generate procedural textures corresponding to Godot shader inputs
    const causticsTex = generateCausticsTexture(512);
    const waveTex = generateWaveTexture(256);
    const waveNormalTex = generateWaveNormalTexture(256);
    const foamTex = generateFoamTexture(256);

    // 8. Water Material (Ported from /shader/water.gdshader & water_toon.gdshader)
    const activePalette = WATER_PALETTES.find((p) => p.id === config.paletteId) || WATER_PALETTES[0];
    const waterMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFlowSpeed: { value: config.flowSpeed },
        uCurrentStrength: { value: config.currentStrength ?? 1.2 },
        uWaveVelocity: { value: new THREE.Vector2(0.02, 0.02) },
        uWaveScale: { value: new THREE.Vector2(0.2, 0.2) },
        uWaveLayerScale: { value: new THREE.Vector2(1.5, 1.5) },
        uWaveSoftness: { value: 3.0 },
        uWaveHighlight: { value: 0.5 },
        uDisplacementAmount: { value: 0.25 * config.waveHeight },

        uSurfaceColor: { value: new THREE.Color(activePalette.shallowColor) },
        uDepthColor: { value: new THREE.Color(activePalette.deepColor) },
        uFoamColor: { value: new THREE.Color(activePalette.foamColor) },
        uDepthSize: { value: 12.0 },

        uSurfaceRoughness: { value: 0.05 },
        uFoamRoughness: { value: 0.05 },

        uCausticsStrength: { value: 2.2 },
        uCausticsScale: { value: new THREE.Vector2(config.causticScale * 0.35, config.causticScale * 0.35) },

        uEdgeFoamDepthSize: { value: Math.max(0.08, config.foamWidth * 0.35) },
        uWaveFoamAmount: { value: 0.0 },
        uFoamStart: { value: 0.12 },
        uFoamEnd: { value: 0.35 },
        uFoamExponent: { value: 2.0 },

        uRefractionAmount: { value: 0.5 },
        uRefractionExponent: { value: 0.5 },

        uDiffuseSteps: { value: 12.0 },
        uDiffuseSmoothness: { value: 0.2 },
        uSpecularSteps: { value: 12.0 },
        uSpecularSmoothness: { value: 0.2 },

        // Ripple simulation uniforms
        uRippleTexture: { value: rippleSim.texture },
        uRippleWorldCenter: { value: rippleSim.worldCenter },
        uRippleWorldSize: { value: rippleSim.worldSize },
        uRippleIntensity: { value: config.rippleIntensity },

        // Dynamic lighting uniforms
        uSunLightDir: { value: new THREE.Vector3(-0.4, 0.88, -0.4).normalize() },
        uSunLightColor: { value: new THREE.Color('#ffffff') },
        uAmbientBoost: { value: 1.0 },

        // Sky reflection uniforms
        uSkyHorizonColor: { value: new THREE.Color('#8cb6de') },
        uSkyZenithColor: { value: new THREE.Color('#4a8cd6') },

        // Dynamic NPC Torch uniforms
        uTorchPos: { value: new THREE.Vector3(0, -999, 0) },
        uTorchColor: { value: new THREE.Color('#ff7722') },
        uTorchIntensity: { value: 0.0 },

        uDepthTexture: { value: depthTexture },
        uScreenTexture: { value: depthTarget.texture },
        uWaveTexture: { value: waveTex },
        uWaveNormalTexture: { value: waveNormalTex },
        uCausticsTexture: { value: causticsTex },
        uFoamTexture: { value: foamTex },

        uInvProjectionMatrix: { value: new THREE.Matrix4() },
        uInvViewMatrix: { value: new THREE.Matrix4() },
        uResolution: { value: new THREE.Vector2(drawingBufferSize.x, drawingBufferSize.y) },
        uHasDepth: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    waterMaterialRef.current = waterMaterial;

    // Groups
    scene.add(riverGroupRef.current);

    // 9. Rain System
    const rainSystem = new RainSystem(3200);
    rainSystemRef.current = rainSystem;
    rainSystem.setConfig(configRef.current.isRaining, configRef.current.rainIntensity);
    scene.add(rainSystem.group);

    // 10. NPC com Tocha (Física real de chama, arrasto do ar, convecção e luz dinâmica)
    const npc = new NPCWithTorch();
    npcRef.current = npc;
    scene.add(npc.group);

    // 11. Poças pelo mapa (Reflexo especular, fresnel do céu e micro-ondulações de chuva)
    const puddles = new PuddlesSystem();
    puddlesRef.current = puddles;
    riverGroupRef.current.add(puddles.group);

    // 12. Pointer Interactions (Click / Drag on water and objects to spawn ripples)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isInteracting = false;
    let lastRippleTime = 0;

    const handlePointerAction = (e: PointerEvent, isClick = false) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Interação física direta no rio ao clicar nos objetos
      if (riverDataRef.current && isClick) {
        const physHits = raycaster.intersectObjects(riverDataRef.current.objectsGroup.children, true);
        if (physHits.length > 0) {
          let hitMesh: THREE.Object3D | null = physHits[0].object;
          while (hitMesh && hitMesh.parent && hitMesh.parent !== riverDataRef.current.objectsGroup) {
            hitMesh = hitMesh.parent;
          }
          const matchedObj = riverDataRef.current.physicsManager.objects.find((o) => o.group === hitMesh);
          if (matchedObj) {
            matchedObj.vel.y -= 4.2;
            matchedObj.vel.x += (Math.random() - 0.5) * 1.5;
            matchedObj.vel.z += 1.8;
            rippleSim.addRipple(
              matchedObj.pos.x,
              matchedObj.pos.z,
              matchedObj.radius * 2.8,
              2.5 * configRef.current.rippleIntensity
            );
            return;
          }
        }
      }

      // Check water surface intersection
      const currentWater = riverDataRef.current?.waterMesh;
      if (currentWater) {
        const hits = raycaster.intersectObject(currentWater, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const now = performance.now();
          if (now - lastRippleTime > (isClick ? 25 : 55)) {
            lastRippleTime = now;
            const radius = isClick ? 2.4 : 1.5;
            const strength = (isClick ? 2.2 : 1.3) * configRef.current.rippleIntensity;
            rippleSim.addRipple(
              hit.point.x,
              hit.point.z,
              radius,
              strength
            );
          }
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        isInteracting = true;
        handlePointerAction(e, true);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isInteracting) {
        handlePointerAction(e, false);
      }
    };

    const onPointerUp = () => {
      isInteracting = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Custom event to push duck from UI button
    const onPushDuck = () => {
      if (riverDataRef.current) {
        riverDataRef.current.physicsManager.applyImpulseToFirst(new THREE.Vector3(0, -4.5, 2.2));
        const firstObj = riverDataRef.current.physicsManager.objects[0];
        if (firstObj) {
          rippleSim.addRipple(
            firstObj.pos.x,
            firstObj.pos.z,
            firstObj.radius * 2.5,
            2.6 * configRef.current.rippleIntensity
          );
        }
      }
    };

    // Custom event to drop physical object into the river
    const onSpawnObject = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: PhysicalObjectType; dropFromHeight?: boolean; x?: number; z?: number }>;
      const type = customEvent.detail?.type || 'duck';

      if (riverDataRef.current) {
        const curve = riverDataRef.current.curve;
        let spawnPos: THREE.Vector3;

        if (customEvent.detail?.x !== undefined && customEvent.detail?.z !== undefined) {
          const x = customEvent.detail.x;
          const z = customEvent.detail.z;
          const rInfo = riverDataRef.current.getDistanceToRiver(x, z);
          spawnPos = new THREE.Vector3(x, rInfo.riverY + (customEvent.detail.dropFromHeight ? 5.5 : 0.2), z);
        } else {
          // Solta do alto do céu no rio (~5 metros acima da água) para ver a gravidade e o splash
          const t = 0.15;
          const cp = curve.getPoint(t);
          const tan = curve.getTangent(t).normalize();
          const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
          const lateral = (Math.random() - 0.5) * (configRef.current.riverWidth * 0.4);
          spawnPos = cp.clone().add(side.multiplyScalar(lateral));
          spawnPos.y = cp.y + (customEvent.detail?.dropFromHeight !== false ? 5.5 : 0.2);
        }

        const initialVel = new THREE.Vector3(0, customEvent.detail?.dropFromHeight !== false ? -1.5 : 0, 0);
        riverDataRef.current.physicsManager.spawnObject(type, spawnPos, initialVel);
      }
    };

    const onClearSpawned = () => {
      if (riverDataRef.current) {
        riverDataRef.current.physicsManager.clearUserSpawnedObjects();
      }
    };

    window.addEventListener('applet:push-duck', onPushDuck);
    window.addEventListener('applet:spawn-river-object', onSpawnObject);
    window.addEventListener('applet:clear-river-objects', onClearSpawned);

    // Animation Loop
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Update river physics and floating objects
      if (riverDataRef.current) {
        riverDataRef.current.update(
          elapsed,
          delta,
          (x, z, r, s) => {
            rippleSimRef.current?.addRipple(x, z, r, s);
          },
          (x, z, dx, dz, spd, st, objId) => {
            rippleSimRef.current?.addWake(x, z, dx, dz, spd, st, objId);
          }
        );

        // Follow Duck camera mode
        if (cameraModeRef.current === 'follow_duck' && riverDataRef.current.ducks.length > 0) {
          const leadDuck = riverDataRef.current.ducks[0].group;
          const duckPos = leadDuck.position;
          controls.target.lerp(duckPos, 0.08);

          // Position camera slightly behind and above duck
          const camOffset = new THREE.Vector3(0, 4.5, -8.5);
          camOffset.applyQuaternion(leadDuck.quaternion);
          const targetCamPos = duckPos.clone().add(camOffset);
          camera.position.lerp(targetCamPos, 0.06);
        }
      }

      // Step wave ripple simulation
      rippleSim.update(configRef.current.waveDamping, delta);

      // Rain System updates
      if (rainSystemRef.current) {
        rainSystemRef.current.update(delta, elapsed, (x, z, r, s) => {
          rippleSim.addRipple(x, z, r, s);
        });
      }

      // Ciclo Dia / Noite Astronômico Realista
      if (configRef.current.dayNightCycleEnabled) {
        timeHourRef.current =
          (timeHourRef.current + delta * (configRef.current.dayNightSpeed ?? 0.6) * 0.4) % 24.0;
      } else if (configRef.current.timeHour !== undefined) {
        timeHourRef.current = configRef.current.timeHour;
      }

      let currentCelState: any = null;
      if (celestialCycleRef.current) {
        currentCelState = celestialCycleRef.current.update(
          timeHourRef.current,
          configRef.current.isRaining,
          configRef.current.rainIntensity
        );

        scene.background = currentCelState.skyHorizonColor;
        if (scene.fog) {
          scene.fog.color.copy(currentCelState.fogColor);
          (scene.fog as THREE.Fog).near = currentCelState.fogNear;
          (scene.fog as THREE.Fog).far = currentCelState.fogFar;
        }
        renderer.toneMappingExposure = currentCelState.exposure;
      }

      // NPC com Tocha e Luz Dinâmica caminhando pelo relevo do rio
      let torchData = {
        position: new THREE.Vector3(0, -999, 0),
        color: new THREE.Color(0xff7722),
        intensity: 0.0,
      };
      if (npcRef.current) {
        npcRef.current.update(delta, elapsed);
        torchData = npcRef.current.getTorchData();
      }

      // Sistema de Poças de Água pelo Mapa
      if (puddlesRef.current && currentCelState) {
        puddlesRef.current.group.visible = true;
        puddlesRef.current.update(
          elapsed,
          currentCelState.skyHorizonColor,
          currentCelState.skyZenithColor,
          currentCelState.sunDirection,
          currentCelState.sunColor,
          torchData,
          configRef.current.isRaining,
          configRef.current.rainIntensity
        );
      }

      // Update shader uniforms and matrix transformations for 3D world reconstruction
      if (waterMaterialRef.current) {
        waterMaterialRef.current.uniforms.uTime.value = elapsed;
        waterMaterialRef.current.uniforms.uInvProjectionMatrix.value.copy(camera.projectionMatrixInverse);
        waterMaterialRef.current.uniforms.uInvViewMatrix.value.copy(camera.matrixWorld);
        waterMaterialRef.current.uniforms.uRippleIntensity.value = configRef.current.rippleIntensity;

        if (currentCelState) {
          waterMaterialRef.current.uniforms.uSunLightDir.value.copy(currentCelState.sunDirection);
          waterMaterialRef.current.uniforms.uSunLightColor.value.copy(currentCelState.sunColor);
          waterMaterialRef.current.uniforms.uSkyHorizonColor.value.copy(currentCelState.skyHorizonColor);
          waterMaterialRef.current.uniforms.uSkyZenithColor.value.copy(currentCelState.skyZenithColor);
        }

        waterMaterialRef.current.uniforms.uTorchPos.value.copy(torchData.position);
        waterMaterialRef.current.uniforms.uTorchColor.value.copy(torchData.color);
        waterMaterialRef.current.uniforms.uTorchIntensity.value = torchData.intensity;
      }

      controls.update();

      // Two-pass rendering for depth-based contact foam:
      // Pass 1: Render opaque scene into depth target (hide water surface temporarily)
      const currentWaterMesh = riverDataRef.current?.waterMesh;
      if (currentWaterMesh) {
        currentWaterMesh.visible = false;
      }

      renderer.setRenderTarget(depthTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Pass 2: Show water surface and render full scene to screen with depth buffer uniform
      if (currentWaterMesh) {
        currentWaterMesh.visible = true;
      }
      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler with DPR buffer sizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.getDrawingBufferSize(drawingBufferSize);
      depthTarget.setSize(drawingBufferSize.x, drawingBufferSize.y);
      if (waterMaterialRef.current) {
        waterMaterialRef.current.uniforms.uResolution.value.copy(drawingBufferSize);
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('applet:push-duck', onPushDuck);
      window.removeEventListener('applet:spawn-river-object', onSpawnObject);
      window.removeEventListener('applet:clear-river-objects', onClearSpawned);

      causticsTex.dispose();
      waveTex.dispose();
      waveNormalTex.dispose();
      foamTex.dispose();
      rippleSim.dispose();
      rainSystem.dispose();
      celestialCycle.dispose();
      npc.dispose();
      puddles.dispose();
      renderer.dispose();
      depthTarget.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update river generation when config changes
  useEffect(() => {
    if (!sceneRef.current || !waterMaterialRef.current) return;

    const riverGroup = riverGroupRef.current;
    // Clear old river
    while (riverGroup.children.length > 0) {
      riverGroup.remove(riverGroup.children[0]);
    }
    if (riverDataRef.current) {
      riverDataRef.current.dispose();
      riverDataRef.current = null;
    }

    // Build new procedural river
    const riverData = generateProceduralRiver(config, waterMaterialRef.current);
    riverDataRef.current = riverData;

    riverGroup.add(riverData.terrainMesh);
    riverGroup.add(riverData.waterMesh);
    riverGroup.add(riverData.rocksGroup);
    riverGroup.add(riverData.objectsGroup);

    // Conecta a rota do NPC e as poças com a nova curva e relevo do rio
    if (npcRef.current && riverData.curve) {
      npcRef.current.setupPath(riverData.curve, config.riverWidth, riverData.getTerrainHeight);
    }
    if (puddlesRef.current && riverData.curve) {
      puddlesRef.current.generate(
        riverData.curve,
        config.riverWidth,
        config.terrainRoughness,
        config.seed,
        riverData.getTerrainHeight
      );
    }
  }, [
    config.seed,
    config.meander,
    config.riverWidth,
    config.depth,
    config.rockDensity,
    config.terrainRoughness,
    config.duckCount,
    config.flowSpeed,
    config.waterDensity,
    config.waterViscosity,
    config.rippleIntensity,
  ]);

  // Sincroniza a hora do ciclo astronômico com os presets de botões
  useEffect(() => {
    if (config.timeHour !== undefined) {
      timeHourRef.current = config.timeHour;
    } else if (config.timeOfDay === 'day') {
      timeHourRef.current = 12.0;
    } else if (config.timeOfDay === 'sunset') {
      timeHourRef.current = 17.8;
    } else if (config.timeOfDay === 'night') {
      timeHourRef.current = 0.0;
    }
  }, [config.timeOfDay, config.timeHour]);

  // Update rain settings
  useEffect(() => {
    if (rainSystemRef.current) {
      rainSystemRef.current.setConfig(config.isRaining, config.rainIntensity);
    }
  }, [config.isRaining, config.rainIntensity]);

  // Update water material uniforms when shader config or palette changes
  useEffect(() => {
    if (!waterMaterialRef.current) return;

    const mat = waterMaterialRef.current;
    const palette = WATER_PALETTES.find((p) => p.id === config.paletteId) || WATER_PALETTES[0];

    mat.uniforms.uFlowSpeed.value = config.flowSpeed;
    if (mat.uniforms.uCurrentStrength) {
      mat.uniforms.uCurrentStrength.value = config.currentStrength ?? 1.2;
    }
    mat.uniforms.uDisplacementAmount.value = 0.25 * config.waveHeight;
    mat.uniforms.uEdgeFoamDepthSize.value = Math.max(0.08, config.foamWidth * 0.35);
    mat.uniforms.uCausticsScale.value.set(config.causticScale * 0.35, config.causticScale * 0.35);
    mat.uniforms.uRippleIntensity.value = config.rippleIntensity;

    mat.uniforms.uSurfaceColor.value.set(palette.shallowColor);
    mat.uniforms.uDepthColor.value.set(palette.deepColor);
    mat.uniforms.uFoamColor.value.set(palette.foamColor);
  }, [
    config.flowSpeed,
    config.currentStrength,
    config.waveHeight,
    config.foamWidth,
    config.causticScale,
    config.paletteId,
    config.rippleIntensity,
  ]);

  // Handle Camera Mode changes
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    if (cameraMode === 'top_down') {
      cameraRef.current.position.set(0, 65, 0.1);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    } else if (cameraMode === 'orbit') {
      cameraRef.current.position.set(22, 26, 32);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [cameraMode]);

  return (
    <div
      ref={containerRef}
      id="threejs-canvas-container"
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
    />
  );
};
