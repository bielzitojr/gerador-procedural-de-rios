import * as THREE from 'three';

/**
 * Port of Godot Water Shader (/shader/water.gdshader & /shader/water_toon.gdshader)
 * Features:
 * - Chromatic Aberration Voronoi Caustics
 * - Depth-reconstructed contact foam & volumetric depth absorption
 * - Screen UV Refraction with depth occlusion testing
 * - Organic foam erosion via noise texture
 * - Dual-layer wave sampling with flow displacement
 * - Cel-shaded toon diffuse and specular steps
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

// Godot sample_wave port
vec4 sample_wave(sampler2D tex, vec2 uv, vec2 velocity, float lod) {
  vec2 base_uv = uv * uWaveScale;
  float totalSpeed = uFlowSpeed * max(0.1, uCurrentStrength);
  vec2 wave_uv1 = (base_uv * uWaveLayerScale) + (uTime * -velocity * totalSpeed);
  float wave1 = texture2D(tex, wave_uv1).r;

  vec2 wave_uv2 = base_uv + (uTime * velocity * totalSpeed);
  vec4 wave2 = texture2D(tex, wave_uv2 - (wave1 * 0.1));

  return wave2;
}

void main() {
  vUv = uv;
  vec3 pos = position;

  vec4 initialWorldPos = modelMatrix * vec4(pos, 1.0);
  
  // Vertex displacement using wave texture
  float wave = sample_wave(uWaveTexture, initialWorldPos.xz, uWaveVelocity, uWaveSoftness).r;
  pos.y += (wave - 0.5) * uDisplacementAmount;

  // Dynamic physical ripple displacement
  vec2 rippleUv = (initialWorldPos.xz - (uRippleWorldCenter - uRippleWorldSize * 0.5)) / uRippleWorldSize;
  if (rippleUv.x >= 0.0 && rippleUv.x <= 1.0 && rippleUv.y >= 0.0 && rippleUv.y <= 1.0) {
    float rippleH = (texture2D(uRippleTexture, rippleUv).r - 0.5019) * 2.0;
    pos.y += rippleH * 0.35 * uRippleIntensity;
  }

  vWave = wave;

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

// Color uniforms from Godot
uniform vec3 uSurfaceColor;
uniform vec3 uDepthColor;
uniform vec3 uFoamColor;
uniform float uDepthSize;

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

// Toon Lighting uniforms (water_toon.gdshader)
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
uniform float uAmbientBoost;

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

// Godot sample_wave port
vec4 sample_wave(sampler2D tex, vec2 uv, vec2 velocity, float lod) {
  vec2 base_uv = uv * uWaveScale;
  float totalSpeed = uFlowSpeed * max(0.1, uCurrentStrength);
  vec2 wave_uv1 = (base_uv * uWaveLayerScale) + (uTime * -velocity * totalSpeed);
  float wave1 = texture2D(tex, wave_uv1).r;

  vec2 wave_uv2 = base_uv + (uTime * velocity * totalSpeed);
  vec4 wave2 = texture2D(tex, wave_uv2 - (wave1 * 0.1));

  return wave2;
}

// Structure for reconstructed scene depth
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
  // If depth is sky or invalid clear value
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

void main() {
  vec2 screen_uv = clamp(gl_FragCoord.xy / max(vec2(1.0), uResolution), vec2(0.001), vec2(0.999));
  float water_view_z = vViewPosition.z;

  float wave = sample_wave(uWaveTexture, vWorldPosition.xz, uWaveVelocity, uWaveSoftness).r;
  wave = smoothstep(0.0, 1.0, wave);

  // 1. Two-layer animated wave normal with visible downstream current flow velocity
  float flowRate = uFlowSpeed * max(0.1, uCurrentStrength);
  vec2 base_uv = vWorldPosition.xz * uWaveScale;
  // Direction of flow along the river (+Z axis, with subtle lateral wave dynamics)
  vec2 flowDir = normalize(vec2(uWaveVelocity.x * 0.4, max(0.3, uWaveVelocity.y * 3.5)));
  vec2 wave_uv1 = (base_uv * uWaveLayerScale) + (uTime * -flowDir * flowRate * 0.55);
  vec3 n1 = texture2D(uWaveNormalTexture, wave_uv1).rgb * 2.0 - 1.0;

  vec2 wave_uv2 = base_uv + (uTime * flowDir * flowRate * 0.85);
  vec3 n2 = texture2D(uWaveNormalTexture, wave_uv2 - (n1.xy * 0.1)).rgb * 2.0 - 1.0;

  vec3 waveNormalMap = normalize(n1 + n2);
  // Tangent-space normal mapped onto horizontal plane (+Y up):
  vec3 fragNormal = normalize(vec3(waveNormalMap.x * 0.28, waveNormalMap.z, waveNormalMap.y * 0.28));

  // Dynamic physical ripple sampling (surface normal disturbance and crest foam)
  vec2 rippleUv = (vWorldPosition.xz - (uRippleWorldCenter - uRippleWorldSize * 0.5)) / uRippleWorldSize;
  float rippleFoam = 0.0;
  vec3 ripplePerturb = vec3(0.0);
  if (rippleUv.x >= 0.0 && rippleUv.x <= 1.0 && rippleUv.y >= 0.0 && rippleUv.y <= 1.0) {
    vec4 rSample = texture2D(uRippleTexture, rippleUv);
    vec2 rNorm = (rSample.gb - 0.5019) * 2.0;
    ripplePerturb = vec3(rNorm.x * 0.65 * uRippleIntensity, 0.0, rNorm.y * 0.65 * uRippleIntensity);
    fragNormal = normalize(fragNormal + ripplePerturb);
    // Trailing wake slipstream behind moving objects (clean aeration)
    rippleFoam = smoothstep(0.40, 0.95, rSample.a) * 0.35 * uRippleIntensity;
  }

  // 2. Optical Refraction Distortion
  vec2 wakeDistortion = vec2(ripplePerturb.x, ripplePerturb.z) * 0.04;
  vec2 waveDistortion = vec2(waveNormalMap.x, waveNormalMap.y) * 0.012;
  vec2 refracted_uv = clamp(screen_uv + (waveDistortion + wakeDistortion) * uRefractionAmount, vec2(0.001), vec2(0.999));

  // Reconstruct depth safely
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

  // 3. Physical Water Depth & Godot Depth Gradient
  float depth = 0.6;
  if (!dinfo.isSky && !dinfo.isInFront) {
    float vert_depth = max(0.0, vWorldPosition.y - dinfo.worldPos.y);
    depth = pow(clamp(vert_depth / max(0.01, uDepthSize), 0.0, 1.0), 3.0);
  }

  // 4. Robust Contact Edge Foam (Multi-device rock & river bank foam)
  // Procedural bank foam along river ribbon edges (vUv.x is 0 at left bank, 1 at right bank)
  float bankDist = min(vUv.x, 1.0 - vUv.x);
  float bankFoamThreshold = clamp(uEdgeFoamDepthSize * 0.16, 0.02, 0.22);
  float bankFoam = smoothstep(bankFoamThreshold, 0.0, bankDist);

  // Contact foam around submerged rocks via depth buffer
  float depthEdgeFoam = 0.0;
  if (!dinfo.isSky && !dinfo.isInFront && dinfo.worldPos.y <= vWorldPosition.y + 0.1) {
    float eye_depth = max(0.0, dinfo.eyeWaterDepth);
    float vert_depth = max(0.0, vWorldPosition.y - dinfo.worldPos.y);
    float shore_dist = min(eye_depth, vert_depth * 2.0);
    float maxFoamDist = max(0.05, uEdgeFoamDepthSize);
    
    if (shore_dist < maxFoamDist && shore_dist >= 0.001) {
      depthEdgeFoam = clamp(1.0 - (shore_dist / maxFoamDist), 0.0, 1.0);
      depthEdgeFoam = smoothstep(0.08, 0.95, depthEdgeFoam);
    }
  }
  float edge_foam = max(bankFoam, depthEdgeFoam);

  // 5. Correnteza Dinâmica Visível (Filamentos de fluxo rápido descendo o rio)
  float flowSpeedFactor = uFlowSpeed * max(0.35, uCurrentStrength);
  // Filamentos de correnteza esticados no eixo longitudinal do rio (+Z)
  vec2 curUv1 = vec2(vWorldPosition.x * 0.45, vWorldPosition.z * 0.10 - uTime * flowSpeedFactor * 0.95);
  vec2 curUv2 = vec2(vWorldPosition.x * 0.75 + 1.8, vWorldPosition.z * 0.18 - uTime * flowSpeedFactor * 1.55);
  vec2 curUv3 = vec2(vWorldPosition.x * 1.10 - 2.5, vWorldPosition.z * 0.32 - uTime * flowSpeedFactor * 2.20);

  float curNoise1 = texture2D(uFoamTexture, curUv1).r;
  float curNoise2 = texture2D(uFoamTexture, curUv2).r;
  float curNoise3 = texture2D(uFoamTexture, curUv3).r;

  // Linhas e filamentos visíveis de correnteza
  float streamRibbons = smoothstep(0.60, 0.86, curNoise1 * 0.55 + curNoise2 * 0.45);
  // Marolas e bolhas de espuma sendo arrastadas rapidamente
  float streamBubbles = smoothstep(0.70, 0.92, curNoise3) * 0.45;
  float visibleCurrent = (streamRibbons * 0.65 + streamBubbles) * clamp(uCurrentStrength * 0.75, 0.1, 1.6);

  // Combinação da espuma de margem, crista de ondas, rastro físico e filamentos de correnteza
  float wave_foam = wave * uWaveFoamAmount;
  float foam = max(edge_foam, max(max(wave_foam, rippleFoam), visibleCurrent));

  // Erosão orgânica da espuma para aspecto natural não-chapado
  float foam_shape = 1.0 - texture2D(uFoamTexture, vWorldPosition.xz * 0.35).r;
  foam = clamp((foam - uFoamStart) / max(0.001, uFoamEnd - uFoamStart), 0.0, 1.0);
  foam = clamp((foam - foam_shape * 0.5) / max(0.001, 1.0 - foam_shape * 0.5), 0.0, 1.0);
  foam = pow(foam, uFoamExponent);

  // Se for borda de contato (edge_foam), manter visibilidade limpa e definida
  foam = max(foam, edge_foam * 0.85);

  // 6. Stylized Toon Water Base Color (Always vibrant cyan/blue toon water across all devices)
  vec3 flat_color = mix(uDepthColor, uSurfaceColor, depth).rgb;

  // Riverbed optical transmission subtly blended
  vec3 waterTint = mix(uDepthColor, uSurfaceColor, 0.65);
  vec3 tintedBottom = screenSample.rgb * (waterTint * 1.25 + vec3(0.18, 0.28, 0.32));
  
  // Safe bottom blend: Only where underwater terrain is actually valid, never on sky/errors
  float bottomBlend = (!dinfo.isSky && !dinfo.isInFront) ? clamp(0.30 * (1.0 - depth), 0.0, 0.35) : 0.0;
  vec3 color = mix(flat_color, tintedBottom, bottomBlend);

  // Realce das cristas e filamentos velozes da correnteza
  color = mix(color, uSurfaceColor * 1.15, wave * uWaveHighlight * 0.45 + visibleCurrent * 0.25);
  color = mix(color, uFoamColor, foam);

  // 6. Stylized Toon Cel-Shaded Lighting (Dynamic sun/moon light from day/night cycle)
  vec3 lightDir = normalize(uSunLightDir);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // Cel-shaded diffuse
  float ndotl = max(dot(fragNormal, lightDir), 0.0);
  float light_mult = ndotl * uDiffuseSteps;
  float light_step_base = floor(light_mult);
  float light_factor = light_mult - light_step_base;
  light_factor = smoothstep(0.5 - uDiffuseSmoothness * 0.5, 0.5 + uDiffuseSmoothness * 0.5, light_factor);
  float toonDiffuse = (light_step_base + light_factor) / uDiffuseSteps;

  color = color * (0.80 + 0.32 * toonDiffuse);

  // Cel-shaded specular (glistening rounded spots on wave crests and ripples)
  vec3 h = normalize(viewDir + lightDir);
  float ndoth = clamp(dot(fragNormal, h), 0.0, 1.0);
  float rawSpec = pow(ndoth, 28.0);
  
  float spec_mult = rawSpec * uSpecularSteps;
  float spec_step = floor(spec_mult);
  float spec_factor = smoothstep(0.5 - uSpecularSmoothness * 0.5, 0.5 + uSpecularSmoothness * 0.5, spec_mult - spec_step);
  float toonSpecular = (spec_step + spec_factor) / uSpecularSteps;

  // Distinct sun/moon glints and water specular highlight
  float glints = smoothstep(0.38, 0.72, rawSpec) * 1.35;
  color += uSunLightColor * (glints + toonSpecular * 0.45);

  // 7. Realistic Fresnel Sky & Celestial Reflection on Water Surface
  // When looking at grazing angles, the water acts as a natural mirror reflecting the sky and horizon
  float fresnel = clamp(pow(1.0 - max(dot(viewDir, fragNormal), 0.0), 3.8), 0.0, 1.0);
  vec3 reflectDir = reflect(-viewDir, fragNormal);
  float skyGradient = clamp(reflectDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 reflectedSky = mix(uSkyHorizonColor, uSkyZenithColor, skyGradient);
  color = mix(color, reflectedSky, fresnel * 0.48);

  // 8. Dynamic NPC Torch Light & Vivid Water Reflection
  if (uTorchIntensity > 0.01) {
    vec3 toTorch = uTorchPos - vWorldPosition;
    float torchDist = length(toTorch);
    if (torchDist < 35.0) {
      vec3 torchDir = normalize(toTorch);
      // Inverse-square law attenuation with soft cutoff
      float torchAtten = 1.0 / (1.0 + 0.15 * torchDist + 0.07 * torchDist * torchDist);
      torchAtten *= smoothstep(35.0, 5.0, torchDist);

      // Diffuse torch warm illumination on water surface
      float torchNdotL = max(dot(fragNormal, torchDir), 0.0);
      color += uTorchColor * (torchNdotL * 0.6) * torchAtten * uTorchIntensity;

      // Vivid specular reflection of torch flame on water ripples
      vec3 torchHalf = normalize(viewDir + torchDir);
      float torchNdotH = max(dot(fragNormal, torchHalf), 0.0);
      float torchSpec = pow(torchNdotH, 36.0);
      float torchGlint = smoothstep(0.36, 0.75, torchSpec);
      color += uTorchColor * (torchSpec * 2.2 + torchGlint * 2.5) * torchAtten * uTorchIntensity;
    }
  }

  // Full crystalline surface rendering
  gl_FragColor = vec4(color, 1.0);
}
`;

export const WATER_PALETTES = [
  {
    id: 'godot_cyan',
    name: 'Godot Toon (Referência da Imagem)',
    shallowColor: '#33f0e0', // Ciano caribenho brilhante idêntico ao Godot
    deepColor: '#1c88cf',    // Azul límpido iluminado
    foamColor: '#ffffff',
    causticColor: '#e0faff',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'crystal_cyan',
    name: 'Turquesa Tropical',
    shallowColor: '#4cf0ff',
    deepColor: '#126ea8',
    foamColor: '#ffffff',
    causticColor: '#d6ffff',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'vibrant_azure',
    name: 'Azul Vivo & Profundo',
    shallowColor: '#62f4f8',
    deepColor: '#0b5687',
    foamColor: '#ffffff',
    causticColor: '#b8fbff',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'emerald_moss',
    name: 'Lagoa Esmeralda / Musgo',
    shallowColor: '#66e8b4',
    deepColor: '#176b53',
    foamColor: '#ffffff',
    causticColor: '#b6ffdf',
    sunGlintColor: '#ffffff',
  },
  {
    id: 'sunset_tropical',
    name: 'Rio Tropical Dourado',
    shallowColor: '#38e4df',
    deepColor: '#0e5573',
    foamColor: '#fff5e6',
    causticColor: '#c8fff9',
    sunGlintColor: '#fffaf0',
  },
];
