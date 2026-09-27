import * as THREE from 'three';

/** Keep the project's water shader and live uniforms; unwrap its textures along the fall. */
export function createWaterfallMaterial(source: THREE.ShaderMaterial, vertical: boolean) {
  const material = new THREE.ShaderMaterial({
    uniforms: source.uniforms,
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader,
    side: THREE.DoubleSide,
    depthWrite: source.depthWrite,
    transparent: source.transparent,
  });
  // The same procedural texture, palette, caustics and lighting as the river.
  // Extra aeration uses the existing organic noise instead of stripes or a new texture.
  material.fragmentShader = material.fragmentShader.replace(
    'gl_FragColor = vec4(color, 1.0);',
    `float cascadeCloud = smoothstep(0.40, 0.69, organicWash);
     color = mix(color, mix(uSurfaceColor, uFoamColor, 0.38) * mix(0.18, 1.0, uDayFactor), cascadeCloud * ${vertical ? '0.62' : '0.40'});
     ${vertical ? `float fallMask = smoothstep(0.12, 0.35, vUv.y);
     vec2 filamentUv = vec2(vCascadeCoord.x * 0.38, vCascadeCoord.y * 0.065 - uTime * 0.95);
     float filament = texture2D(uWaveTexture, filamentUv + vec2(organicWash * 0.18, 0.0)).r;
     float lace = smoothstep(0.55, 0.78, filament) * fallMask;
     float impact = smoothstep(0.76, 1.0, vUv.y);
     color = mix(color, uFoamColor * mix(0.18, 1.0, uDayFactor), clamp(lace * 0.72 + impact * cascadeCloud * 0.65, 0.0, 0.88));` : ''}
     gl_FragColor = vec4(color, 1.0);`
  );
  if (vertical) {
    material.vertexShader = 'attribute vec2 cascadeCoord; varying vec2 vCascadeCoord;\n' + material.vertexShader;
    material.vertexShader = material.vertexShader.replace('vUv = uv;', 'vUv = uv; vCascadeCoord = cascadeCoord;');
    // Move waves perpendicular to the sheet, not up and down its length.
    material.vertexShader = material.vertexShader.replace('vec4 worldPos = modelMatrix * vec4(pos, 1.0);',
      'float displacement = pos.y - position.y; pos = position + normal * displacement; vec4 worldPos = modelMatrix * vec4(pos, 1.0);');
    material.fragmentShader = 'varying vec2 vCascadeCoord;\n' + material.fragmentShader;
    material.fragmentShader = material.fragmentShader.replaceAll('vWorldPosition.xz', 'vCascadeCoord');
    // Ripple simulation still samples the real horizontal basin coordinates.
    material.fragmentShader = material.fragmentShader.replace('vec2 rippleUv = (vCascadeCoord', 'vec2 rippleUv = (vWorldPosition.xz');
    material.fragmentShader = material.fragmentShader.replace('float canShowBottom =', 'vert_depth = 3.0;\n  float canShowBottom =');
    material.fragmentShader = material.fragmentShader.replace('vec3 underPos = dinfo.worldPos.xyz;', 'canShowBottom = 0.0;\n  fragNormal = normalize(vNormal + vec3(fragNormal.x, fragNormal.z, 0.0));\n  vec3 underPos = dinfo.worldPos.xyz;');
  }
  return material;
}

/** One curved strip joins the upstream water, rounded lip and submerged toe. */
export function createWaterfallGeometry(width: number, height: number, radius: number, seed: number) {
  const lipZ = -radius * 0.64;
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, height, lipZ - radius * 0.65),
    new THREE.Vector3(0, height, lipZ - 2),
    new THREE.Vector3(0, height - 0.6, lipZ + 0.3),
    new THREE.Vector3(0, height * 0.55, lipZ + 1),
    new THREE.Vector3(0, 0.9, lipZ + 2.1),
    new THREE.Vector3(0, -0.18, lipZ + 4),
  ], false, 'centripetal');
  const positions: number[] = [], uvs: number[] = [], coords: number[] = [], indices: number[] = [];
  const rows = 120, columns = 40;
  const length = path.getLength();
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, point = path.getPointAt(t);
    const widthFactor = 1 + 0.045 * Math.sin(t * 12 + seed) + 0.09 * t * t;
    for (let j = 0; j <= columns; j++) {
      const u = j / columns, x = (u - 0.5) * width * widthFactor;
      positions.push(x, point.y, point.z + Math.sin(u * 15 + t * 9 + seed) * 0.32 * Math.sin(t * Math.PI));
      uvs.push(u, t);
      coords.push(x, lipZ - radius * 0.65 + t * length);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('cascadeCoord', new THREE.Float32BufferAttribute(coords, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
