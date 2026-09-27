import * as THREE from 'three';

/**
 * Stylized Toon River & Pool Water Shader (Água Cartoon Viva e Natural)
 * 
 * Aesthetic: Stylized Cartoon / Anime Clear Water (inspired by Ghibli, The Witness & Zelda Wind Waker).
 * Key Features:
 * - Fluid, delicate surface texture with soft watery nuances between cyan, turquoise, and light blue
 * - Rich depth gradient with smooth, organic transitions from crystalline shallows to calm deep cerulean
 * - Large, spaced-out nebulous pool caustics with generous regions of clean, serene water
 * - Organic, irregular and subtle shoreline/rock foam contours hugging the river boundaries
 * - Compact, soft, semi-transparent duck wake with gradual dissipation (no harsh "V" prongs)
 * - Gentle, continuous movement with living surface reflections without glitter or procedural noise
 */

export const waterVertexShader = `
uniform float uTime;
uniform float uFlowSpeed;
uniform float uCurrentStrength;
uniform vec2 uWaveVelocity;
uniform vec2 uWaveScale;
uniform vec2 uWaveLayerScale;
uniform float uWaveSoftness;
uniform float uDisplacementAmount;

// Águas Calmas & Ondas para Praias e Mares
uniform int uIsCalmWater;
uniform float uCalmWaterIntensity;
uniform int uIsOcean;
uniform int uWaveVariant; // 0 = leve, 1 = agitado, 2 = tempestade
uniform float uOceanSwellHeight;
uniform float uOceanWaveLength;
uniform float uOceanChoppiness;
uniform float uOceanSpeed;
uniform float uOceanFoamCrests;

uniform sampler2D uWaveTexture;
uniform sampler2D uWaveNormalTexture;

// Ripple simulation uniforms
uniform sampler2D uRippleTexture;
uniform vec2 uRippleWorldCenter;
uniform vec2 uRippleWorldSize;
uniform float uRippleIntensity;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vWave;

// Multi-layer wave displacement sampler
vec4 sample_wave(sampler2D tex, vec2 uv, vec2 velocity, float lod) {
  vec2 base_uv = uv * uWaveScale;
  float totalSpeed = uFlowSpeed * max(0.1, uCurrentStrength);
  vec2 wave_uv1 = (base_uv * uWaveLayerScale) + (uTime * -velocity * totalSpeed);
  float wave1 = texture2D(tex, wave_uv1).r;

  vec2 wave_uv2 = base_uv + (uTime * velocity * totalSpeed);
  vec4 wave2 = texture2D(tex, wave_uv2 - (wave1 * 0.05));

  return wave2;
}

void main() {
  vUv = uv;
  vec3 pos = position;

  vec4 initialWorldPos = modelMatrix * vec4(pos, 1.0);
  float totalSpeed = uFlowSpeed * max(0.10, uCurrentStrength);
  
  if (uIsCalmWater == 1) {
    // Águas Calmas: água parada (sem correnteza), superfície perfeitamente lisa e espelhada
    float glassyMicro = (sin(uTime * 0.40 + initialWorldPos.x * 0.20) * cos(uTime * 0.35 + initialWorldPos.z * 0.20)) * 0.012 * (1.0 - uCalmWaterIntensity * 0.85);
    pos.y += glassyMicro;
    vWave = 0.0;
  } else if (uIsOcean == 1) {
    // Ondas para Praias e Mares: trens de ondas Gerstner direcionais do mar aberto em direção à praia
    // Variantes: 0 = Leve, 1 = Agitado, 2 = Tempestade
    float baseAmp = 0.65;
    float baseLen = 22.0;
    float baseChop = 0.45;
    float baseSpeed = 0.85;

    if (uWaveVariant == 1) {
      // Agitado: ondas íngremes com carneirinhos e arrebentação vigorosa
      baseAmp = 1.45;
      baseLen = 16.0;
      baseChop = 1.15;
      baseSpeed = 1.40;
    } else if (uWaveVariant == 2) {
      // Tempestade: vagalhões altos, mar revolto e turbulento
      baseAmp = 2.85;
      baseLen = 20.0;
      baseChop = 1.65;
      baseSpeed = 2.20;
    }

    float effAmp = baseAmp * (uOceanSwellHeight > 0.0 ? (uOceanSwellHeight / 1.6) : 1.0);
    float effLen = baseLen * (uOceanWaveLength > 0.0 ? (uOceanWaveLength / 22.0) : 1.0);
    float effSpeed = baseSpeed * (uOceanSpeed > 0.0 ? (uOceanSpeed / 1.2) : 1.0);
    float effChop = baseChop * (uOceanChoppiness > 0.0 ? uOceanChoppiness : 1.0);

    // Gerstner Wave 1 (Onda Primária frontal em direção à praia, -Z)
    float k1 = 6.28318 / max(4.0, effLen);
    float c1 = sqrt(9.81 / k1) * 0.40 * effSpeed;
    vec2 d1 = normalize(vec2(0.08, -0.99));
    float phase1 = k1 * (d1.x * initialWorldPos.x + d1.y * initialWorldPos.z) - uTime * c1;
    float cosP1 = cos(phase1);
    float sinP1 = sin(phase1);

    // Gerstner Wave 2 (Onda Secundária diagonal / cruzada natural do mar)
    float k2 = 6.28318 / max(3.0, effLen * 0.68);
    float c2 = sqrt(9.81 / k2) * 0.40 * effSpeed;
    vec2 d2 = normalize(vec2(-0.25, -0.97));
    float phase2 = k2 * (d2.x * initialWorldPos.x + d2.y * initialWorldPos.z) - uTime * c2 * 1.22;
    float cosP2 = cos(phase2);
    float sinP2 = sin(phase2);

    // Gerstner Wave 3 (Micro-ondulações de vento na superfície)
    float k3 = 6.28318 / max(2.0, effLen * 0.35);
    float c3 = sqrt(9.81 / k3) * 0.40 * effSpeed;
    vec2 d3 = normalize(vec2(0.32, -0.94));
    float phase3 = k3 * (d3.x * initialWorldPos.x + d3.y * initialWorldPos.z) - uTime * c3 * 1.35;
    float sinP3 = sin(phase3);

    float a1 = effAmp * 0.65;
    float a2 = effAmp * 0.25;
    float a3 = effAmp * 0.10;

    // Deslocamento horizontal trochoidal (Gerstner) que afina as cristas
    pos.x += -(d1.x * effChop * a1 * cosP1 + d2.x * effChop * a2 * cosP2);
    pos.z += -(d1.y * effChop * a1 * cosP1 + d2.y * effChop * a2 * cosP2);
    pos.y += (sinP1 * a1 + sinP2 * a2 + sinP3 * a3);

    // Na praia (z próximo da costa z=-30), as ondas quebram suavemente e avançam na areia
    float coastDist = initialWorldPos.z - (-30.0 + sin(initialWorldPos.x * 0.045) * 6.0 + sin(initialWorldPos.x * 0.105 + 1.3) * 2.5);
    if (coastDist < 14.0 && coastDist > -12.0) {
      float shoreRunup = sin(uTime * c1 * 0.85 + initialWorldPos.x * 0.12) * 0.5 + 0.5;
      pos.y += shoreRunup * effAmp * 0.20;
    }

    vWave = (sinP1 * a1 + sinP2 * a2) / max(0.1, effAmp);
  } else {
    // Ondulação vertical suave, contínua e orgânica para Rio e Água Padrão
    float calmSwell = sin(uTime * 0.48 * totalSpeed + initialWorldPos.z * 0.07) * 0.55 +
                      cos(uTime * 0.38 * totalSpeed + initialWorldPos.x * 0.06) * 0.45;
    float wave = sample_wave(uWaveTexture, initialWorldPos.xz, uWaveVelocity, uWaveSoftness).r;
    pos.y += (wave * 0.32 + calmSwell * 0.68 - 0.50) * (uDisplacementAmount * 0.72);
    vWave = calmSwell;
  }

  // Ondulações físicas da simulação hidrodinâmica
  vec2 rippleUv = (initialWorldPos.xz - (uRippleWorldCenter - uRippleWorldSize * 0.5)) / uRippleWorldSize;
  if (rippleUv.x >= 0.0 && rippleUv.x <= 1.0 && rippleUv.y >= 0.0 && rippleUv.y <= 1.0) {
    float rippleH = (texture2D(uRippleTexture, rippleUv).r - 0.5019) * 2.0;
    pos.y += rippleH * 0.20 * uRippleIntensity;
  }

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);

  vec4 mvPosition = viewMatrix * worldPos;
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const waterFragmentShader = `
uniform float uTime;
uniform float uFlowSpeed;
uniform float uCurrentStrength;
uniform vec2 uWaveVelocity;
uniform vec2 uWaveScale;
uniform vec2 uWaveLayerScale;
uniform float uWaveSoftness;
uniform float uWaveHighlight;

// Stylized Color Uniforms
uniform vec3 uSurfaceColor;
uniform vec3 uDepthColor;
uniform vec3 uFoamColor;
uniform float uDepthSize;

// Visual Styling & Controls
uniform float uTranslucency;
uniform float uStylizedFoamAmount;
uniform float uHighlightIntensity;
uniform float uWakeSoftness;

// Águas Calmas & Ondas para Praias e Mares
uniform int uIsCalmWater;
uniform float uCalmWaterIntensity;
uniform int uIsOcean;
uniform int uWaveVariant; // 0 = leve, 1 = agitado, 2 = tempestade
uniform float uOceanSwellHeight;
uniform float uOceanWaveLength;
uniform float uOceanChoppiness;
uniform float uOceanSpeed;
uniform float uOceanFoamCrests;

// Roughness
uniform float uSurfaceRoughness;
uniform float uFoamRoughness;

// Caustics uniforms
uniform float uCausticsStrength;
uniform vec2 uCausticsScale;

// Foam uniforms
uniform float uEdgeFoamDepthSize;
uniform float uWaveFoamAmount;
uniform float uFoamStart;
uniform float uFoamEnd;
uniform float uFoamExponent;

// Refraction uniforms
uniform float uRefractionAmount;
uniform float uRefractionExponent;

// Toon Lighting uniforms
uniform float uDiffuseSteps;
uniform float uDiffuseSmoothness;
uniform float uSpecularSteps;
uniform float uSpecularSmoothness;

// Ripple simulation uniforms
uniform sampler2D uRippleTexture;
uniform vec2 uRippleWorldCenter;
uniform vec2 uRippleWorldSize;
uniform float uRippleIntensity;

// Day / Night & Sun Lighting uniforms
uniform vec3 uSunLightDir;
uniform vec3 uSunLightColor;
uniform float uSunIntensity;
uniform vec3 uAmbientLightColor;
uniform float uAmbientIntensity;
uniform float uDayFactor;
uniform float uAmbientBoost;

// Rain & Weather uniforms
uniform float uRainIntensity;

// Sky & Celestial Reflection uniforms
uniform vec3 uSkyHorizonColor;
uniform vec3 uSkyZenithColor;

// Dynamic NPC Torch uniforms
uniform vec3 uTorchPos;
uniform vec3 uTorchColor;
uniform float uTorchIntensity;

// Samplers
uniform sampler2D uDepthTexture;
uniform sampler2D uScreenTexture;
uniform sampler2D uWaveTexture;
uniform sampler2D uWaveNormalTexture;
uniform sampler2D uCausticsTexture;
uniform sampler2D uFoamTexture;

uniform mat4 uInvProjectionMatrix;
uniform mat4 uInvViewMatrix;
uniform vec2 uResolution;
uniform int uHasDepth;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vWave;

// Estrutura para reconstrução de profundidade da cena
struct DepthInfo {
  vec4 worldPos;
  float eyeWaterDepth;
  bool isSky;
  bool isInFront;
};

DepthInfo get_depth_info(vec2 screen_uv, mat4 inv_proj_mat, mat4 inv_view_mat, float water_view_z) {
  DepthInfo info;
  info.isSky = true;
  info.isInFront = false;
  info.eyeWaterDepth = 0.0;
  info.worldPos = vec4(0.0);

  if (screen_uv.x < 0.001 || screen_uv.x > 0.999 || screen_uv.y < 0.001 || screen_uv.y > 0.999) {
    return info;
  }

  float raw_depth = texture2D(uDepthTexture, screen_uv).r;
  if (raw_depth >= 0.9999 || raw_depth <= 0.0001) {
    info.isSky = true;
    return info;
  }
  info.isSky = false;

  vec4 clip_pos = vec4(screen_uv * 2.0 - 1.0, raw_depth * 2.0 - 1.0, 1.0);
  vec4 view_pos = inv_proj_mat * clip_pos;
  if (abs(view_pos.w) < 0.00001) {
    info.isSky = true;
    return info;
  }
  view_pos /= view_pos.w;

  info.worldPos = inv_view_mat * view_pos;

  float scene_view_z = -view_pos.z;
  info.eyeWaterDepth = scene_view_z - water_view_z;
  info.isInFront = (info.eyeWaterDepth < 0.0);
  return info;
}

// Função pseudo-aleatória rápida 2D para distribuição de círculos de impacto de chuva
float hash21_rain(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Pequenos círculos de impacto aleatórios de gotas de chuva na superfície da água
vec3 compute_rain_ripples(vec2 worldXz, float time, float intensity) {
  if (intensity < 0.01) return vec3(0.0);

  vec3 rippleResult = vec3(0.0);
  float rainDensity = 1.15;
  vec2 st = worldXz * rainDensity;

  // Duas camadas com offsets para distribuição natural e aleatória de pingos
  for (int layer = 0; layer < 2; layer++) {
    float layerShift = float(layer) * 0.47;
    vec2 layerSt = st + vec2(layerShift * 4.3, layerShift * 2.9);
    vec2 gridId = floor(layerSt);
    vec2 gridUv = fract(layerSt);

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 cellId = gridId + neighbor;
        float h = hash21_rain(cellId + float(layer) * 31.17);

        // Cada célula tem um tempo desfasado de gota
        float dropSpeed = 1.8 + h * 1.2;
        float dropTime = fract(time * dropSpeed + h * 5.71);

        // Posição interna da gota na célula
        vec2 dropPos = vec2(hash21_rain(cellId + 1.7), hash21_rain(cellId + 5.3)) * 0.6 + 0.2;
        vec2 diff = (gridUv - neighbor) - dropPos;
        float dist = length(diff);

        // Raio do anel cresce suavemente de 0.0 até ~0.28 metros
        float maxRadius = 0.28;
        float currentRadius = dropTime * maxRadius;
        float ringThickness = 0.038;

        float ringDist = abs(dist - currentRadius);
        float ringWave = smoothstep(ringThickness, 0.0, ringDist);

        // Desvanecimento suave conforme expande
        float fade = (1.0 - dropTime) * smoothstep(0.0, 0.15, dropTime);
        float weight = ringWave * fade;

        if (weight > 0.002 && dist > 0.001) {
          vec2 dir = diff / dist;
          float slope = ((dist - currentRadius) / ringThickness) * weight;
          rippleResult.xz += dir * slope * 0.26;
          rippleResult.y += weight * 0.18; // crista de elevação / brilho sutil
        }
      }
    }
  }

  return rippleResult * intensity;
}

void main() {
  vec2 screen_uv = clamp(gl_FragCoord.xy / max(vec2(1.0), uResolution), vec2(0.001), vec2(0.999));
  float water_view_z = vViewPosition.z;

  // 1. Movimento Orgânico, Lento e Delicado
  float flowRate = uFlowSpeed * max(0.08, uCurrentStrength * 0.85);
  
  // Amostragem de fluxo contínuo de baixa e média frequência
  vec2 flowUv1 = vWorldPosition.xz * 0.065 - vec2(sin(uTime * 0.22 + vWorldPosition.z * 0.05) * 0.03, uTime * flowRate * 0.38);
  vec2 flowUv2 = vWorldPosition.xz * 0.045 + vec2(cos(uTime * 0.18 + vWorldPosition.x * 0.05) * 0.03 + 0.35, -uTime * flowRate * 0.52);
  
  vec3 n1 = texture2D(uWaveNormalTexture, flowUv1).rgb * 2.0 - 1.0;
  vec3 n2 = texture2D(uWaveNormalTexture, flowUv2).rgb * 2.0 - 1.0;
  vec3 waveNormalMap = normalize(n1 * 0.58 + n2 * 0.42);

  // Microvariações sutis de normal/noise: amplas, lentas e orgânicas (sem linhas ou faixas)
  // Escala espacial grande (frequência baixa) e deriva lenta para que a luz não fique perfeitamente uniforme em câmera próxima
  vec2 slowNoiseUv1 = vWorldPosition.xz * 0.024 + vec2(sin(uTime * 0.07) * 0.03, -uTime * flowRate * 0.16);
  vec2 slowNoiseUv2 = vWorldPosition.xz * 0.036 + vec2(0.38 + cos(uTime * 0.06) * 0.03, -uTime * flowRate * 0.22);
  
  float dN = 0.05;
  float sCenter = texture2D(uWaveTexture, slowNoiseUv1).r * 0.62 + texture2D(uWaveTexture, slowNoiseUv2).r * 0.38;
  float sRight  = texture2D(uWaveTexture, slowNoiseUv1 + vec2(dN, 0.0)).r * 0.62 + texture2D(uWaveTexture, slowNoiseUv2 + vec2(dN, 0.0)).r * 0.38;
  float sUp     = texture2D(uWaveTexture, slowNoiseUv1 + vec2(0.0, dN)).r * 0.62 + texture2D(uWaveTexture, slowNoiseUv2 + vec2(0.0, dN)).r * 0.38;
  vec2 broadNoiseGrad = vec2(sRight - sCenter, sUp - sCenter) * (1.0 / dN);

  // Ondulações suaves de baixa frequência do corpo d'água (longas, lentas e arredondadas)
  vec2 broadSwell = vec2(
    cos(vWorldPosition.x * 0.035 + vWorldPosition.z * 0.022 + uTime * 0.11) * 0.30 +
    sin(vWorldPosition.x * 0.018 - vWorldPosition.z * 0.028 - uTime * 0.08) * 0.20,
    sin(vWorldPosition.z * 0.035 + vWorldPosition.x * 0.022 + uTime * 0.11) * 0.30 +
    cos(vWorldPosition.z * 0.018 - vWorldPosition.x * 0.028 - uTime * 0.08) * 0.20
  );

  // Perturbação da normal: sutil, ampla e harmoniosa (relevo suave e líquido sem padrão de linhas)
  vec2 microNormalOffset = (broadNoiseGrad * 0.075 + broadSwell * 0.065) * 0.55;

  // Inclinação delicada: relevo suave que reflete a luz naturalmente sem criar arestas facetadas nem linhas repetitivas
  vec3 fragNormal = normalize(vec3(
    waveNormalMap.x * 0.055 + microNormalOffset.x,
    1.0,
    waveNormalMap.y * 0.055 + microNormalOffset.y
  ));

  // Águas Calmas: água parada com normal nivelada e espelhada
  if (uIsCalmWater == 1) {
    fragNormal = normalize(mix(fragNormal, vec3(0.0, 1.0, 0.0), 0.92 * uCalmWaterIntensity));
  } else if (uIsOcean == 1) {
    // Ondas oceânicas: inclinação direcional que projeta a face da onda em direção à costa
    float waveSlope = -cos(vWorldPosition.z * (6.28318 / max(6.0, uOceanWaveLength)) + uTime * 1.4) * 0.12 * (uOceanSwellHeight / 1.6);
    fragNormal = normalize(fragNormal + vec3(0.0, 0.0, waveSlope));
  }

  // Reação à Chuva: pequenos círculos de impacto aleatórios + micro-rugosidade na superfície
  vec3 rainRipples = compute_rain_ripples(vWorldPosition.xz, uTime, uRainIntensity);
  fragNormal = normalize(fragNormal + vec3(rainRipples.x, 0.0, rainRipples.z));

  if (uRainIntensity > 0.01) {
    // Aumento leve da rugosidade da superfície enquanto chove: micro-textura rápida e difusa
    vec2 rainMicroUv = vWorldPosition.xz * 2.5 + vec2(sin(uTime * 14.0), cos(uTime * 14.0)) * 0.10;
    float rainMicroNoise = (texture2D(uWaveTexture, rainMicroUv).r - 0.5) * 0.045 * min(1.5, uRainIntensity);
    fragNormal = normalize(fragNormal + vec3(rainMicroNoise, 0.0, rainMicroNoise));
  }

  // 2. Ondulações Físicas do Rastro dos Patinhos (Duas Ondas Laterais em V + Perturbação Central Curta)
  vec2 rippleUv = (vWorldPosition.xz - (uRippleWorldCenter - uRippleWorldSize * 0.5)) / uRippleWorldSize;
  vec3 ripplePerturb = vec3(0.0);
  float rawWakeAeration = 0.0;
  if (rippleUv.x >= 0.0 && rippleUv.x <= 1.0 && rippleUv.y >= 0.0 && rippleUv.y <= 1.0) {
    vec4 rSample = texture2D(uRippleTexture, rippleUv);
    vec2 rNorm = (rSample.gb - 0.5019) * 2.0;
    // Perturbação da normal amplificada para relevo nítido e elegante em qualquer ângulo de iluminação
    ripplePerturb = vec3(rNorm.x * 0.32 * uRippleIntensity, 0.0, rNorm.y * 0.32 * uRippleIntensity);
    fragNormal = normalize(fragNormal + ripplePerturb);
    rawWakeAeration = rSample.a;
  }

  // 3. Refração Óptica Translúcida Suave
  vec2 wakeDistortion = vec2(ripplePerturb.x, ripplePerturb.z) * 0.010;
  vec2 waveDistortion = vec2(waveNormalMap.x, waveNormalMap.y) * 0.004;
  vec2 refracted_uv = clamp(screen_uv + (waveDistortion + wakeDistortion) * uRefractionAmount, vec2(0.001), vec2(0.999));

  // Reconstrução de Profundidade da Cena
  DepthInfo dinfo = get_depth_info(screen_uv, uInvProjectionMatrix, uInvViewMatrix, water_view_z);
  if (uRefractionAmount > 0.001) {
    DepthInfo refrInfo = get_depth_info(refracted_uv, uInvProjectionMatrix, uInvViewMatrix, water_view_z);
    if (!refrInfo.isSky && !refrInfo.isInFront && refrInfo.worldPos.y <= vWorldPosition.y + 0.05) {
      dinfo = refrInfo;
    } else {
      refracted_uv = screen_uv;
    }
  }

  vec4 screenSample = texture2D(uScreenTexture, refracted_uv);

  // 4. Sensação Rica e Orgânica de Profundidade com Poços e Curvas Naturais do Leito
  float vert_depth = 1.0;
  if (!dinfo.isSky && !dinfo.isInFront) {
    vert_depth = max(0.0, vWorldPosition.y - dinfo.worldPos.y);
  }
  float canShowBottom = (!dinfo.isSky && !dinfo.isInFront) ? 1.0 : 0.0;

  // Análise da geometria submersa: normal reconstruída e inclinação
  vec3 underPos = dinfo.worldPos.xyz;
  vec3 dPosDx = dFdx(underPos);
  vec3 dPosDy = dFdy(underPos);
  vec3 underGeoNormal = normalize(cross(dPosDx, dPosDy));
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  if (dot(underGeoNormal, viewDir) < 0.0) {
    underGeoNormal = -underGeoNormal;
  }

  // Detecção de contato com obstáculo íngreme (pedras no leito) vs declive suave da margem/leito
  float isSteepObstacle = smoothstep(0.85, 0.42, abs(underGeoNormal.y)) * canShowBottom;

  // Orientação em relação ao fluxo da água (rio desce no sentido +Z):
  // Lado montante (onde a água bate na pedra): underGeoNormal aponta para montante (-Z)
  // Lado jusante (trás/sotavento da pedra): underGeoNormal aponta para jusante (+Z)
  float upstreamFactor = clamp(-underGeoNormal.z * 1.5 + 0.25, 0.0, 1.0);

  // Modulação orgânica multi-frequência: poços profundos sinuosos e curvas naturais
  vec2 bedCoord1 = vWorldPosition.xz * 0.024 + vec2(sin(vWorldPosition.z * 0.04) * 0.75, -uTime * flowRate * 0.08);
  vec2 bedCoord2 = vWorldPosition.xz * 0.052 + vec2(cos(vWorldPosition.x * 0.04) * 0.55, -uTime * flowRate * 0.14);
  float bedNoise1 = texture2D(uWaveTexture, bedCoord1).r;
  float bedNoise2 = texture2D(uWaveTexture, bedCoord2).r;
  float bedPoolFeature = (bedNoise1 * 0.65 + bedNoise2 * 0.35 - 0.48);

  // Variação transversal assimétrica que quebra qualquer faixa reta central uniforme
  float lateralMeander = sin(vWorldPosition.z * 0.055 + sin(vWorldPosition.x * 0.045) * 1.6) * 0.42;

  // Profundidade perceptiva com bacias, poços e bancos rasos em curvas orgânicas
  // Em pedras íngremes, não forçamos profundidade zero para evitar o anel ciano artificial ao redor da base!
  float organicBedDepth = max(0.0, vert_depth + bedPoolFeature * 0.85 + lateralMeander * 0.38);
  float effectiveBedDepth = mix(organicBedDepth, max(organicBedDepth, 1.45 + bedPoolFeature * 0.3), isSteepObstacle * 0.88);

  float depthScale = max(0.70, uDepthSize * 0.38);
  float toonDepth = clamp(effectiveBedDepth / depthScale, 0.0, 1.0);

  // Nuances cromáticas multicamada:
  // - Áreas rasas: Turquesa suave e límpido (somente em margens e leito suave, nunca como anel em pedras)
  vec3 shallowTurquoise = mix(uSurfaceColor, vec3(0.38, 0.94, 0.90), 0.32);
  // - Meia-profundidade: Azul ciano celestial fresco e suave
  vec3 midAzure = mix(uSurfaceColor * 0.96, vec3(0.24, 0.76, 0.96), 0.46);
  // - Poços profundos: Cerúleo vivo em bacias sinuosas (não uma faixa borrada)
  vec3 deepCerulean1 = mix(uDepthColor, vec3(0.12, 0.48, 0.78), 0.30);
  vec3 deepCerulean2 = mix(uDepthColor, vec3(0.08, 0.56, 0.72), 0.34);
  vec3 livingDeep = mix(deepCerulean1, deepCerulean2, smoothstep(0.30, 0.70, bedNoise1));

  // Transição orgânica em manchas e curvas de poços do leito:
  float shallowShelf = smoothstep(0.04, 0.42, toonDepth);
  float deepPoolMask = smoothstep(0.38, 0.78, toonDepth + bedPoolFeature * 0.24);

  vec3 depthColorGrad = mix(shallowTurquoise, midAzure, shallowShelf);
  depthColorGrad = mix(depthColorGrad, livingDeep, deepPoolMask);

  // 5. Textura Suave e Discreta na Superfície (Pequenas Variações Fluidas de Brilho e Cor)
  // Amostragem de fluxo orgânico em duas escalas complementares
  vec2 surfUv1 = vWorldPosition.xz * 0.052 - vec2(sin(uTime * 0.16 + vWorldPosition.z * 0.04) * 0.02, uTime * flowRate * 0.38);
  vec2 surfUv2 = vWorldPosition.xz * 0.085 + vec2(cos(uTime * 0.14 + vWorldPosition.x * 0.04) * 0.02 + 0.5, -uTime * flowRate * 0.52);
  
  float surfNoise1 = texture2D(uWaveTexture, surfUv1).r;
  float surfNoise2 = texture2D(uWaveTexture, surfUv2).r;
  float organicWash = surfNoise1 * 0.60 + surfNoise2 * 0.40;

  // Manchas aquosas discretas (variações fluidas suaves de tom e claridade)
  float wateryPatch = smoothstep(0.38, 0.78, organicWash);
  vec3 subtleChromaShift = mix(vec3(-0.01, 0.02, 0.02), vec3(0.03, 0.05, 0.06), wateryPatch);
  
  // Modulação aveludada de brilho na superfície (evita aparência lisa sem ser ruidosa)
  float surfaceSheenMod = (organicWash - 0.5) * 0.14;
  vec3 dayWaterBase = clamp(depthColorGrad * (1.0 + surfaceSheenMod) + subtleChromaShift * 0.35, 0.0, 1.0);

  // Paleta Noturna Realista Estilizada (Água escura, límpida e repousante, sem florescência artificial)
  vec3 nightShallow = mix(vec3(0.015, 0.045, 0.085), uAmbientLightColor * 0.40, 0.45);
  vec3 nightDeep = mix(vec3(0.005, 0.018, 0.040), uAmbientLightColor * 0.20, 0.35);
  vec3 nightColorGrad = mix(nightShallow, nightDeep, smoothstep(0.05, 0.85, toonDepth));
  vec3 nightWaterBase = nightColorGrad * (1.0 + surfaceSheenMod * 0.4);

  // Transição contínua entre Dia, Entardecer e Noite
  vec3 livingWaterBase = mix(nightWaterBase, dayWaterBase, uDayFactor);

  // Translucidez com o fundo do rio
  float bottomClarity = clamp(1.0 - toonDepth * 0.58, 0.32, 0.95);
  vec3 dayBottomTint = mix(shallowTurquoise * 1.12 + vec3(0.06, 0.10, 0.12), vec3(1.0), 0.45);
  vec3 nightBottomTint = mix(uAmbientLightColor * 0.65 + vec3(0.02, 0.04, 0.07), vec3(0.25), 0.35);
  vec3 bottomTint = mix(nightBottomTint, dayBottomTint, uDayFactor);
  vec3 translucentBed = screenSample.rgb * bottomTint;
  vec3 color = mix(livingWaterBase, translucentBed, canShowBottom * bottomClarity * uTranslucency * mix(0.18, 0.48, uDayFactor));

  // 6. Grandes Caustics Nebulosas e Fluidas de Piscina (Ativas com Luz Solar Diurna, Nulas à Noite)
  vec2 caustCoord = vWorldPosition.xz * 0.018 - vec2(0.0, uTime * flowRate * 0.22);
  vec2 caustWarp = vec2(
    sin(caustCoord.y * 1.3 + uTime * 0.16),
    cos(caustCoord.x * 1.3 + uTime * 0.12)
  ) * 0.07;
  
  float caustNoise1 = texture2D(uWaveTexture, caustCoord + caustWarp).r;
  float caustNoise2 = texture2D(uWaveTexture, (caustCoord + caustWarp) * 1.35 + vec2(0.35, 0.22)).r;
  float broadPoolNoise = caustNoise1 * 0.65 + caustNoise2 * 0.35;

  float nebulousCaustic = smoothstep(0.62, 0.85, broadPoolNoise);
  vec3 causticTint = mix(vec3(0.72, 0.96, 1.0), vec3(0.98, 1.0, 1.0), smoothstep(0.72, 0.86, broadPoolNoise));
  float causticIntensity = nebulousCaustic * 0.28 * (1.0 - toonDepth * 0.35) * uTranslucency * uDayFactor;
  color = mix(color, causticTint, causticIntensity);

  // Formas difusas arredondadas e espaçadas
  vec2 patchCoord = vWorldPosition.xz * 0.024 + vec2(0.4, -uTime * flowRate * 0.30);
  vec2 patchWarp = vec2(
    cos(patchCoord.y * 1.15 - uTime * 0.14),
    sin(patchCoord.x * 1.15 + uTime * 0.16)
  ) * 0.055;
  float patchSample = texture2D(uWaveTexture, patchCoord + patchWarp).r;
  float softPatch = smoothstep(0.78, 0.90, patchSample);
  vec3 dayPatchColor = mix(vec3(0.86, 0.98, 1.0), vec3(1.0, 1.0, 1.0), smoothstep(0.83, 0.90, patchSample));
  vec3 nightPatchColor = mix(uAmbientLightColor * 0.75, uSunLightColor * 0.30, 0.35);
  vec3 litPatchColor = mix(nightPatchColor, dayPatchColor, uDayFactor);
  color = mix(color, litPatchColor, softPatch * 0.38 * uStylizedFoamAmount * mix(0.25, 1.0, uDayFactor));

  // 7. Interação com Margens e Pedras
  // a) Sombra de Contato & Oclusão Ambiental (AO) na Base das Pedras para Dar Peso Físico
  float contactOcclusionDist = smoothstep(0.24, 0.005, vert_depth) * canShowBottom;
  float rockBaseOcclusion = contactOcclusionDist * mix(0.35, 0.92, isSteepObstacle);

  vec3 lightDir = normalize(uSunLightDir);

  // Sombra direcional e oclusão na parte de trás/sotavento da pedra
  float sunShadow = clamp(1.0 - max(0.0, dot(underGeoNormal, lightDir)) * 0.60, 0.38, 1.0);
  float leeSideShade = mix(1.0, 0.70, (1.0 - upstreamFactor) * isSteepObstacle);

  // Escurecimento suave na base da pedra (sensação real de peso e ancoragem no leito)
  float rockGroundingShadow = mix(1.0, 0.44 * sunShadow * leeSideShade, rockBaseOcclusion * 0.70);
  color *= rockGroundingShadow;

  // b) Interação de Pedras: Efeito Irregular que Aparece Principalmente no Lado Onde a Água Bate (Montante)
  // Sem anel ciano concêntrico em volta da pedra!
  vec2 rockNoiseCoord = vWorldPosition.xz * 0.52 + vec2(0.25, -uTime * flowRate * 0.20);
  float rkNoiseA = texture2D(uWaveTexture, rockNoiseCoord).r;
  float rkNoiseB = texture2D(uWaveTexture, rockNoiseCoord * 2.2 + vec2(0.35, 0.18)).r;
  float rockIrregularity = rkNoiseA * 0.65 + rkNoiseB * 0.35;

  // Perturbação de contato: crista suave de impacto concentrada no lado onde a corrente atinge a rocha
  float upstreamContactDist = 0.08 * (0.35 + 1.25 * rockIrregularity);
  float rawRockImpact = smoothstep(upstreamContactDist, 0.002, vert_depth) * isSteepObstacle * upstreamFactor;
  float brokenRockImpact = rawRockImpact * smoothstep(0.30, 0.70, rockIrregularity + rawRockImpact * 0.25);

  vec3 dayRockFoamColor = mix(vec3(0.92, 0.97, 1.0), vec3(1.0, 1.0, 1.0), 0.50);
  vec3 nightRockFoamColor = mix(uAmbientLightColor * 0.80, uSunLightColor * 0.25, 0.35);
  vec3 litRockFoam = mix(nightRockFoamColor, dayRockFoamColor, uDayFactor);
  color = mix(color, litRockFoam, brokenRockImpact * 0.40 * mix(0.30, 1.0, uDayFactor));

  // c) Espuma das Margens do Terreno: fina, quebrada e descontínua ao longo do rio
  float bankDist = min(vUv.x, 1.0 - vUv.x);
  // Aplica espuma de margem somente junto às margens reais do rio (não em pedras isoladas no meio da correnteza)
  float isActualBank = smoothstep(0.24, 0.04, bankDist) * (1.0 - isSteepObstacle * 0.85);

  vec2 macroUv = vWorldPosition.xz * 0.016 + vec2(0.20, -uTime * flowRate * 0.04);
  float macroNoise = texture2D(uWaveTexture, macroUv).r;
  float bankCurveMod = sin(vWorldPosition.z * 0.14 + vWorldPosition.x * 0.09) * 0.5 + 0.5;
  float macroPresence = smoothstep(0.53, 0.79, macroNoise * 0.65 + bankCurveMod * 0.35);

  vec2 fineFoamUv1 = vWorldPosition.xz * 0.32 + vec2(0.0, -uTime * flowRate * 0.16);
  vec2 fineFoamUv2 = vWorldPosition.xz * 0.75 + vec2(uTime * flowRate * 0.12, 0.0);
  float fineNoise1 = texture2D(uWaveTexture, fineFoamUv1).r;
  float fineNoise2 = texture2D(uWaveTexture, fineFoamUv2).r;
  float foamBreakupNoise = fineNoise1 * 0.62 + fineNoise2 * 0.38;

  float fineThreshold = clamp(uEdgeFoamDepthSize * 0.065, 0.008, 0.026) * (0.35 + 1.25 * foamBreakupNoise);
  float shoreDepth = (canShowBottom > 0.5) ? min(vert_depth * 1.8, dinfo.eyeWaterDepth) : (bankDist * 1.5);
  float rawShoreFoam = smoothstep(fineThreshold, 0.001, shoreDepth);

  float airyLacing = rawShoreFoam * smoothstep(0.40, 0.78, foamBreakupNoise + rawShoreFoam * 0.30);
  float brokenFoam = airyLacing * macroPresence * isActualBank;

  vec3 dayEdgeFoamTint = mix(shallowTurquoise * 1.04 + vec3(0.08, 0.10, 0.12), vec3(0.96, 0.99, 1.0), 0.55);
  vec3 nightEdgeFoamTint = mix(uAmbientLightColor * 0.75 + uSunLightColor * 0.20, vec3(0.05, 0.09, 0.14), 0.40);
  vec3 litEdgeFoam = mix(nightEdgeFoamTint, dayEdgeFoamTint, uDayFactor);
  color = mix(color, litEdgeFoam, brokenFoam * 0.42 * mix(0.30, 1.0, uDayFactor));

  // 8. Rastro do Pato Natural (V Suave com Duas Ondas Laterais + Perturbação Central Curta)
  if (rawWakeAeration > 0.001) {
    float wakeAlpha = smoothstep(0.004, 0.40, rawWakeAeration) * 0.34;
    vec2 wakeUv = vWorldPosition.xz * 0.18 - vec2(0.0, uTime * flowRate * 0.22);
    float wakeNoise = texture2D(uWaveTexture, wakeUv).r;
    float wakeSoft = wakeAlpha * mix(0.92, 1.08, wakeNoise * 0.16);

    // Crista luminosa da onda do rastro em V visível com nitidez em todos os ângulos de visão
    float wakeGlint = smoothstep(0.08, 0.65, length(ripplePerturb.xz) * 3.8) * 0.20;

    vec3 dayWakeTint = mix(uSurfaceColor * 1.18 + vec3(0.07, 0.11, 0.14), vec3(0.97, 1.0, 1.0), 0.45);
    vec3 nightWakeTint = mix(uAmbientLightColor * 0.70, uSunLightColor * 0.30, 0.42);
    vec3 litWakeTint = mix(nightWakeTint, dayWakeTint, uDayFactor);
    float wakeVisibility = clamp((wakeSoft + wakeGlint) * clamp(uRippleIntensity, 0.5, 1.6) * uWakeSoftness, 0.0, 0.48);
    color = mix(color, litWakeTint, wakeVisibility * mix(0.38, 1.0, uDayFactor));
  }

  // Brilho discreto nas cristas dos anéis de impacto de chuva
  if (rainRipples.y > 0.002) {
    vec3 dayRingTint = vec3(0.94, 0.98, 1.0);
    vec3 nightRingTint = uAmbientLightColor * 0.65 + vec3(0.04);
    vec3 litRingTint = mix(nightRingTint, dayRingTint, uDayFactor);
    color = mix(color, litRingTint, clamp(rainRipples.y * 0.32, 0.0, 0.28) * mix(0.40, 1.0, uDayFactor));
  }

  // 8.5 Ondas em Praias e Mares: Cristas Espumosas (Whitecaps) e Arrebentação Costeira
  if (uIsOcean == 1) {
    float oceanDepth = smoothstep(0.4, 10.0, vert_depth);
    vec3 oceanTint = mix(vec3(0.05,0.85,0.78),vec3(0.015,0.23,0.53),oceanDepth);
    color = mix(color, oceanTint * (0.88 + organicWash * 0.30), 0.45 * uDayFactor);
    // a) Cristas Espumosas Oceânicas (carneirinhos que dependem da variante de onda)
    float crestCutoff = 0.55;
    float crestIntensity = 1.0;
    if (uWaveVariant == 0) {
      // Leve: mar sereno, ondulação suave, cristas discretas
      crestCutoff = 0.65;
      crestIntensity = 0.45;
    } else if (uWaveVariant == 1) {
      // Agitado: ondas moderadas/altas com carneirinhos bem visíveis
      crestCutoff = 0.32;
      crestIntensity = 1.15;
    } else if (uWaveVariant == 2) {
      // Tempestade: vagalhões massivos, mar revolto, espuma densa e rajadas de vento
      crestCutoff = 0.05;
      crestIntensity = 1.85;
    }

    float rawCrest = smoothstep(crestCutoff, crestCutoff + 0.32, vWave);
    vec2 crestNoiseUv = vWorldPosition.xz * 0.16 + vec2(0.0, -uTime * 0.28);
    float crestNoise = texture2D(uWaveTexture, crestNoiseUv).r;
    float crestFoam = rawCrest * smoothstep(0.35, 0.70, crestNoise + rawCrest * 0.3) * crestIntensity * uOceanFoamCrests;

    vec3 oceanFoamColor = mix(uFoamColor, vec3(1.0), 0.72);
    color = mix(color, oceanFoamColor, clamp(crestFoam * 0.78, 0.0, 0.88));

    // b) Arrebentação e Espraiamento da Onda na Areia da Praia (próximo de z = -30)
    float distToCoast = vWorldPosition.z - (-30.0 + sin(vWorldPosition.x * 0.045) * 6.0 + sin(vWorldPosition.x * 0.105 + 1.3) * 2.5);
    if (distToCoast < 16.0 && distToCoast > -10.0) {
      float beachCycle = sin(uTime * 1.5 + vWorldPosition.x * 0.14) * 0.5 + 0.5;
      float washZone = 1.0 - smoothstep(-2.0, 14.0, distToCoast);
      float surfWash = smoothstep(0.42, 0.85, beachCycle * 0.75 + washZone * 0.45);
      float surfNoise = texture2D(uWaveTexture, vWorldPosition.xz * 0.32).r;
      float breaker = pow(0.5 + 0.5 * sin(distToCoast * 1.2 + uTime * uOceanSpeed * 1.8 + surfNoise * 2.5), 5.0);
      float contact = (1.0 - smoothstep(0.08, 1.4, vert_depth)) * canShowBottom;
      float lacySurf = max(contact, max(surfWash * 0.6, breaker) * smoothstep(0.32,0.68,surfNoise+0.18));

      color = mix(color, oceanFoamColor, clamp(lacySurf * 0.65 * washZone, 0.0, 0.90));
    }
  }

  // 8.6 Águas Calmas: Superfície perfeitamente parada com reflexo límpido do céu (Espelho d'Água)
  if (uIsCalmWater == 1) {
    vec3 reflectDir = reflect(-viewDir, fragNormal);
    float skyGrad = clamp(reflectDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 skyMirror = mix(uSkyHorizonColor, uSkyZenithColor, skyGrad);
    float calmFresnel = pow(1.0 - max(dot(viewDir, fragNormal), 0.0), 2.2);
    color = mix(color, skyMirror, (0.32 + calmFresnel * 0.48) * uCalmWaterIntensity);
  }

  // 9. Reflexos Leves, Sheen Aveludado e Iluminação Toon Viva
  // Menisco de impacto apenas no lado onde a água bate na rocha
  float rockProximity = smoothstep(0.28, 0.02, vert_depth) * isSteepObstacle * upstreamFactor;
  vec2 meniscusWarp = vec2(sin(vWorldPosition.x * 2.2 + uTime * 0.9), cos(vWorldPosition.z * 2.2 + uTime * 0.9)) * 0.06;
  vec3 adjustedNormal = normalize(fragNormal + vec3(meniscusWarp.x, 0.0, meniscusWarp.y) * rockProximity * 0.20);

  vec3 h = normalize(viewDir + lightDir);

  // Difusa Toon Suave com resposta adaptada ao ciclo dia/noite
  float ndotl = max(dot(adjustedNormal, lightDir), 0.0);
  float toonDiffuse = smoothstep(0.10, 0.60, ndotl);
  float diffuseMod = mix(0.85 + 0.15 * toonDiffuse, 0.91 + 0.18 * toonDiffuse, uDayFactor);
  color *= diffuseMod;

  // Brilho sedoso amplo e almofada de luz delicada (com aumento leve da rugosidade da superfície na chuva)
  float rainRoughnessBoost = clamp(uRainIntensity * 0.35, 0.0, 0.55);
  float sheenExp = mix(9.0, 5.8, rainRoughnessBoost);
  float lusterExp = mix(20.0, 13.0, rainRoughnessBoost);

  float ndoth = clamp(dot(adjustedNormal, h), 0.0, 1.0);
  float broadSheen = smoothstep(0.24, 0.70, pow(ndoth, sheenExp)) * 0.26;
  float coreLuster = smoothstep(0.44, 0.78, pow(ndoth, lusterExp)) * 0.28;
  
  // Modulação sutil do brilho pelo movimento da água (reflexos vivos)
  float liveGlintMod = 0.85 + 0.30 * organicWash;
  float softHighlight = (broadSheen + coreLuster) * liveGlintMod * uHighlightIntensity;

  // De dia: brilho solar acolhedor. De noite: luar prateado fresco sobre a água escura
  vec3 daySheenTint = mix(uSunLightColor, vec3(0.95, 0.99, 1.0), 0.65);
  vec3 nightSheenTint = uSunLightColor * (0.55 * min(1.3, uSunIntensity));
  vec3 sheenTint = mix(nightSheenTint, daySheenTint, uDayFactor);
  color += sheenTint * softHighlight;

  // Reflexo Fresnel sutil na linha do horizonte (reflete o céu diurno ou noturno, sem neon artificial)
  float fresnel = pow(1.0 - max(dot(viewDir, adjustedNormal), 0.0), 3.0);
  vec3 dayHorizonRim = mix(uSurfaceColor * 1.20, uSkyHorizonColor, 0.40);
  vec3 nightHorizonRim = mix(uSkyHorizonColor, uSkyZenithColor, 0.55);
  vec3 horizonRim = mix(nightHorizonRim, dayHorizonRim, uDayFactor);
  color = mix(color, horizonRim, fresnel * mix(0.35, 0.18, uDayFactor));

  // 10. Luz Dinâmica da Tocha do NPC
  if (uTorchIntensity > 0.01) {
    vec3 toTorch = uTorchPos - vWorldPosition;
    float torchDist = length(toTorch);
    if (torchDist < 35.0) {
      vec3 torchDir = normalize(toTorch);
      float torchAtten = 1.0 / (1.0 + 0.15 * torchDist + 0.07 * torchDist * torchDist);
      torchAtten *= smoothstep(35.0, 5.0, torchDist);

      float torchNdotL = max(dot(fragNormal, torchDir), 0.0);
      color += uTorchColor * (torchNdotL * 0.45) * torchAtten * uTorchIntensity;

      vec3 torchHalf = normalize(viewDir + torchDir);
      float torchNdotH = max(dot(fragNormal, torchHalf), 0.0);
      float torchSpec = pow(torchNdotH, 16.0);
      float torchGlint = smoothstep(0.32, 0.72, torchSpec);
      color += uTorchColor * (torchSpec * 1.2 + torchGlint * 1.4) * torchAtten * uTorchIntensity;
    }
  }

  // Renderização final suave, rica e translúcida
  if (uIsOcean == 1) {
    float foamNoise = texture2D(uWaveTexture, vWorldPosition.xz * 0.42 + vec2(uTime * 0.03, -uTime * 0.14)).r;
    float edgeWash = (1.0 - smoothstep(0.12, 1.9, vert_depth)) * canShowBottom;
    float lace = smoothstep(0.40, 0.61, foamNoise) * edgeWash;
    float caps = smoothstep(0.42, 0.74, vWave) * smoothstep(0.52, 0.7, foamNoise) * uOceanFoamCrests;
    color = mix(color, uFoamColor * mix(0.15, 1.0, uDayFactor), clamp(lace * 0.88 + caps * 0.72, 0.0, 0.92));
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

export const WATER_PALETTES = [
  {
    id: 'godot_cyan',
    name: 'Piscina Cartoon Ciano (Suave)',
    shallowColor: '#5ef4ee', // Ciano luminoso cristalino
    deepColor: '#1d85c4',    // Azul cerúleo calmo e profundo
    foamColor: '#ffffff',
    causticColor: '#defaff',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'crystal_cyan',
    name: 'Turquesa Suave Translúcida',
    shallowColor: '#66f8f2',
    deepColor: '#1a7cb8',
    foamColor: '#ffffff',
    causticColor: '#e4ffff',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'vibrant_azure',
    name: 'Azul Céu Piscina Limpa',
    shallowColor: '#75ecfa',
    deepColor: '#1c7abf',
    foamColor: '#ffffff',
    causticColor: '#d6f4ff',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'emerald_moss',
    name: 'Lagoa Esmeralda Suave',
    shallowColor: '#6cf6cf',
    deepColor: '#198c6c',
    foamColor: '#ffffff',
    causticColor: '#d8fff0',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'sunset_tropical',
    name: 'Ciano Alvorecer Suave',
    shallowColor: '#62eee8',
    deepColor: '#1f7a9d',
    foamColor: '#fff8f0',
    causticColor: '#dffefa',
    sunGlintColor: '#fffdf5',
  },
];
