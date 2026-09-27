import * as THREE from 'three';

/** Keep the project's water shader and live uniforms; unwrap its textures along the fall. */
export function createWaterfallMaterial(source: THREE.ShaderMaterial, vertical: boolean) {
  const material = new THREE.ShaderMaterial({
    uniforms: source.uniforms,
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader,
    side: THREE.DoubleSide,
    depthWrite: vertical ? true : source.depthWrite,
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
     float edge = 1.0 - smoothstep(0.015, 0.16, min(vUv.x, 1.0 - vUv.x));
     float edgeFoam = edge * smoothstep(0.35, 0.68, filament) * fallMask;
     color = mix(color, uFoamColor * mix(0.18, 1.0, uDayFactor), edgeFoam * 0.8);
     float impact = smoothstep(0.76, 1.0, vUv.y);
     color = mix(color, uFoamColor * mix(0.18, 1.0, uDayFactor), clamp(lace * 0.72 + impact * cascadeCloud * 0.65, 0.0, 0.88));` : ''}
     gl_FragColor = vec4(color, 1.0);`
  );
  if (vertical) {
    material.vertexShader = 'attribute vec2 cascadeCoord; varying vec2 vCascadeCoord;\n' + material.vertexShader;
    material.vertexShader = material.vertexShader.replace('vUv = uv;', 'vUv = uv; vCascadeCoord = cascadeCoord;');
    // Move waves perpendicular to the sheet, not up and down its length.
    material.vertexShader = material.vertexShader.replace('vec4 worldPos = modelMatrix * vec4(pos, 1.0);',
      'float edgeMotion = pow(abs(uv.x * 2.0 - 1.0), 6.0) * sin(uv.y * 48.0 - uTime * 7.0 + position.x) * 0.12 * sin(uv.y * 3.14159); float displacement = pos.y - position.y + edgeMotion; pos = position + normal * displacement; vec4 worldPos = modelMatrix * vec4(pos, 1.0);');
    material.fragmentShader = 'varying vec2 vCascadeCoord;\n' + material.fragmentShader;
    material.fragmentShader = material.fragmentShader.replaceAll('vWorldPosition.xz', 'vCascadeCoord');
    // Ripple simulation still samples the real horizontal basin coordinates.
    material.fragmentShader = material.fragmentShader.replace('vec2 rippleUv = (vCascadeCoord', 'vec2 rippleUv = (vWorldPosition.xz');
    material.fragmentShader = material.fragmentShader.replace('float canShowBottom =', 'vert_depth = 3.0;\n  float canShowBottom =');
    material.fragmentShader = material.fragmentShader.replace('vec3 underPos = dinfo.worldPos.xyz;', 'canShowBottom = 0.0;\n  fragNormal = normalize(vNormal + vec3(fragNormal.x, fragNormal.z, 0.0));\n  vec3 underPos = dinfo.worldPos.xyz;');
  }
  return material;
}

/** Shared flow path for the water volume and edge spray. */
export function getWaterfallPath(height: number, radius: number) {
  const z = -radius * 0.64;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,height,z-radius*0.65),
    new THREE.Vector3(0,height,z-2),
    new THREE.Vector3(0,height-0.6,z+0.3),
    new THREE.Vector3(0,height*0.55,z+1),
    new THREE.Vector3(0,0.9,z+2.1),
    new THREE.Vector3(0,-0.65,z+4),
  ],false,'centripetal');
}

/** Closed, flattened water volume: rounded edges remain visible from either side. */
export function createWaterfallGeometry(width: number, height: number, radius: number, seed: number) {
  const path=getWaterfallPath(height,radius);
  const positions:number[]=[],uvs:number[]=[],coords:number[]=[],indices:number[]=[];
  const rows=120, sides=80, length=path.getLength();
  for(let i=0;i<=rows;i++){
    const t=i/rows, point=path.getPointAt(t), tangent=path.getTangentAt(t);
    const normal=new THREE.Vector3(0,tangent.z,-tangent.y).normalize();
    const widthFactor=1+0.045*Math.sin(t*12+seed)+0.09*t*t;
    const thickness=0.45+0.42*Math.sin(t*Math.PI)+0.28*t*t;
    for(let j=0;j<=sides;j++){
      const angle=j/sides*Math.PI*2, across=Math.cos(angle);
      const edge=Math.pow(Math.abs(across),8)*Math.sin(t*Math.PI);
      const fray=edge*(Math.sin(t*57+seed+across*3)*0.16+Math.sin(t*103+seed)*0.07);
      const x=across*(width*0.5*widthFactor+fray);
      const bulge=Math.sin(angle)*thickness*(1+0.18*Math.sin(t*29+across*11+seed));
      positions.push(x,point.y+normal.y*bulge,point.z+normal.z*bulge);
      uvs.push((across+1)*0.5,t);
      coords.push(x,-radius*1.29+t*length);
      if(i<rows&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
  }
  // End caps close the upstream inlet and submerged outlet.
  for(const row of [0,rows]){
    const point=path.getPointAt(row/rows),center=positions.length/3;
    positions.push(point.x,point.y,point.z);uvs.push(0.5,row/rows);coords.push(0,-radius*1.29+row/rows*length);
    for(let j=0;j<sides;j++){const a=row*(sides+1)+j;if(row===0)indices.push(center,a+1,a);else indices.push(center,a,a+1);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('cascadeCoord',new THREE.Float32BufferAttribute(coords,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
