import * as THREE from 'three';
/** Soft procedural spray and foam; lit with the generator's existing daylight uniforms. */
export function createWaterfallImpact(width: number, radius: number, density: number, source: THREE.ShaderMaterial) {
  const group = new THREE.Group();
  const uniforms = { uTime: source.uniforms.uTime, uDayFactor: source.uniforms.uDayFactor };
  const foam = new THREE.ShaderMaterial({uniforms: {...uniforms, uWaveTexture: source.uniforms.uWaveTexture}, transparent:true, depthWrite:false, side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv; uniform float uTime; uniform float uDayFactor; uniform sampler2D uWaveTexture;
    void main(){ vec2 p=(vUv-0.5)*2.0; float r=length(p); float n=texture2D(uWaveTexture,p*0.75+vec2(0.0,-uTime*0.16)).r;
    float rings=0.5+0.5*sin(r*27.0-uTime*4.0+n*8.0);
    float mask=(1.0-smoothstep(0.50,1.0,r))*(0.28+0.72*smoothstep(0.38,0.72,n+rings*0.22));
    gl_FragColor=vec4(vec3(0.84,0.97,1.0)*mix(0.15,1.0,uDayFactor),mask*0.88);}`});
  const geo=new THREE.PlaneGeometry(width*1.65,11);
  const pad=new THREE.Mesh(geo,foam);pad.rotation.x=-Math.PI/2;pad.position.set(0,0.17,-radius*0.64+4);pad.renderOrder=4;group.add(pad);
  const count=density*10, positions=new Float32Array(count*3), phases=new Float32Array(count);
  for(let i=0;i<count;i++) phases[i]=(i*0.61803398875)%1;
  const sprayGeo=new THREE.BufferGeometry();sprayGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const sprayMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(75.0/-p.z,1.0,9.0);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform float uDayFactor;void main(){float r=length(gl_PointCoord-0.5)*2.0;gl_FragColor=vec4(vec3(0.9,0.98,1.0)*mix(0.18,1.0,uDayFactor),(1.0-smoothstep(0.2,1.0,r))*0.65);}'});
  const spray=new THREE.Points(sprayGeo,sprayMat);spray.frustumCulled=false;spray.renderOrder=5;group.add(spray);
  const mistGeo=new THREE.PlaneGeometry(5,4);
  const mistMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);p.xy+=position.xy;gl_Position=projectionMatrix*p;}',
    fragmentShader:'varying vec2 vUv;uniform float uDayFactor;void main(){float r=length((vUv-0.5)*2.0);gl_FragColor=vec4(vec3(0.85,0.95,1.0)*mix(0.15,1.0,uDayFactor),pow(max(0.0,1.0-r),2.0)*0.20);}'});
  const mist=Array.from({length:14},()=>{const m=new THREE.Mesh(mistGeo,mistMat);m.renderOrder=6;group.add(m);return m;});
  return {group,update(time:number){
    for(let i=0;i<count;i++){const t=(time*0.55+phases[i])%1; const a=i*2.39996;
      positions[i*3]=Math.sin(i*17.3)*width*0.5+Math.cos(a)*t*2;
      positions[i*3+1]=0.2+Math.sin(t*Math.PI)*(1.2+(i%7)*0.3);
      positions[i*3+2]=-radius*0.64+2.5+t*(2+i%4);}
    sprayGeo.attributes.position.needsUpdate=true;
    mist.forEach((m,i)=>{const t=(time*0.12+i/14)%1;m.position.set(Math.sin(i*19)*width*0.6+Math.sin(time*0.2+i),0.8+t*3,-radius*0.64+3+t*4);m.scale.setScalar(0.7+t);});
  },dispose(){geo.dispose();foam.dispose();sprayGeo.dispose();sprayMat.dispose();mistGeo.dispose();mistMat.dispose();}};
}
