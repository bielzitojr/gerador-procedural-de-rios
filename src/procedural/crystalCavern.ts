import * as THREE from 'three';
import { RiverConfig } from '../types';

/** Faceted flooded galleries with an open observation side and a skylight. */
export function createCrystalCavern(config: RiverConfig, water: THREE.ShaderMaterial) {
  const group = new THREE.Group();
  const {scale: radius, height, density} = config.environment;
  const grotto = config.waterMode === 'grotto';
  const random = (i: number) => { const n = Math.sin(i * 127.1 + config.seed * 0.73) * 43758.5453; return n - Math.floor(n); };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const rock = new THREE.MeshStandardMaterial({color:'#29485f',roughness:0.85,flatShading:true,emissive:'#092839',emissiveIntensity:0.32});
  // Animated reflected caustics on nearby rock, using the water generator's texture.
  rock.onBeforeCompile = shader => {
    shader.uniforms.uCaveTime = water.uniforms.uTime ?? {value:0};
    shader.uniforms.uCaveTexture = water.uniforms.uWaveTexture ?? {value:null};
    shader.vertexShader = 'varying vec3 vCaveWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCaveWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vCaveWorld; uniform float uCaveTime; uniform sampler2D uCaveTexture;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float n=texture2D(uCaveTexture,vCaveWorld.xz*0.13+vCaveWorld.y*0.03+vec2(uCaveTime*0.015,-uCaveTime*0.025)).r;
      float caustic=pow(max(0.0,1.0-abs(n-0.53)*12.0),3.0);
      totalEmissiveRadiance+=vec3(0.005,0.085,0.13)*caustic*exp(-max(0.0,vCaveWorld.y)*0.26);`);
  };
  const crystal = new THREE.MeshStandardMaterial({color:'#73dce9',emissive:'#20b7d5',emissiveIntensity:0.55,metalness:0.18,roughness:0.22,flatShading:true});
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number,y: number,z: number) => {
    geometries.add(geo);materials.add(material);const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
  };
  const boulderGeo = new THREE.IcosahedronGeometry(1,1);
  // Thick, irregular walls enclosing both sides and the rear, with a front entrance.
  for(let side=-1;side<=1;side+=2) for(let i=0;i<18;i++){
    const z=(i/17-0.5)*radius*2.25;
    for(let tier=0;tier<3;tier++){
      const m=add(boulderGeo,rock,side*radius*(0.89+random(i+side+60)*0.10),tier*height*0.58+2,z);
      m.scale.set(3.8+random(i+70)*3,height*0.47,3.2+random(i+80)*2);m.rotation.set(random(i)*0.3,random(i+50)*3,side*0.1);
    }
  }
  for(let i=0;i<12;i++){
    const m=add(boulderGeo,rock,(i/11-0.5)*radius*2,height*0.6,-radius*1.12);
    m.scale.set(3.8,height*0.9,4+random(i)*3);
  }
  const arches=grotto?4:8;
  for(let i=0;i<arches;i++){
    const z=(i/(arches-1)-0.5)*radius*1.7;
    const span=radius*(grotto?0.82:0.78)*(1+random(i)*0.04);
    const roof=height*(grotto?1.12:0.85)*(0.94+random(i+6)*0.1);
    const pts=Array.from({length:25},(_,j)=>{const a=j/24*Math.PI;return new THREE.Vector3(Math.cos(a)*span,Math.sin(a)*roof-0.3,z);});
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,1.15+radius*0.025,5,false),rock,0,0,0);
    // Attached mineral teeth under each arch rather than floating cones.
    for(let j=0;j<4;j++){
      const a=0.4+(j/3)*2.3,x=Math.cos(a)*span,y=Math.sin(a)*roof;
      const len=1.5+random(i*4+j)*height*0.25;
      const m=add(new THREE.ConeGeometry(0.7+random(j+i)*0.4,len,5),j%3===0?crystal:rock,x,y-len/2-0.5,z);m.rotation.z=Math.PI;
    }
  }
  // Rubble shelves and crystal clusters hug the waterline.
  const rings: THREE.Mesh[]=[];
  const ringMat=new THREE.MeshBasicMaterial({color:'#76f5ff',transparent:true,opacity:0.45,depthWrite:false,side:THREE.DoubleSide});
  for(let i=0;i<density*3;i++){
    const a=random(i+400)*Math.PI*2;
    const x=Math.cos(a)*radius*(0.78+random(i+401)*0.15),z=Math.sin(a)*radius*0.9;
    const m=add(boulderGeo,rock,x,0.4+random(i+402)*1.5,z);m.scale.set(1+random(i)*2,0.8+random(i+3)*2,1+random(i+4)*2);m.rotation.y=random(i)*6;
  }
  for(let i=0;i<Math.max(10,Math.floor(density*0.7));i++){
    const a=i/Math.max(10,Math.floor(density*0.7))*Math.PI*2;
    const x=Math.cos(a)*radius*0.72,z=Math.sin(a)*radius*0.79;
    const tall=1.7+random(i+900)*3.5;
    for(let j=0;j<3;j++){
      const size=j===0?1:0.45;
      const m=add(new THREE.ConeGeometry(0.65*size,tall*size,5),crystal,x+j*0.45,0.1+tall*size/2,z+j*0.25);m.rotation.z=(j-1)*0.15;
    }
    const ring=add(new THREE.RingGeometry(0.95,1.01,48),ringMat,x,0.12,z);ring.rotation.x=-Math.PI/2;ring.renderOrder=3;rings.push(ring);
  }
  group.add(new THREE.HemisphereLight('#81d9ff','#061625',2.2));
  for(const z of [-radius*0.65,0,radius*0.65]){const light=new THREE.PointLight('#40dfff',70,radius*2,1.3);light.position.set(0,4,z);group.add(light);}
  // Soft light shafts descend through gaps in the open roof.
  const shaftMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;void main(){float edge=pow(sin(vUv.x*3.14159),3.0);float fade=sin(vUv.y*3.14159);gl_FragColor=vec4(0.18,0.65,1.0,edge*fade*0.055);}'});
  for(let i=0;i<(grotto?5:3);i++){
    const m=add(new THREE.CylinderGeometry(0.4,3.0,height*1.8,24,1,true),shaftMat,(i-1)*3,height*0.85,-radius*0.5+i*2);m.rotation.z=-0.15;m.renderOrder=4;
  }
  const motesGeo=new THREE.BufferGeometry(),positions=new Float32Array(75*3);
  for(let i=0;i<75;i++){positions[i*3]=(random(i+1500)-0.5)*radius*1.5;positions[i*3+1]=random(i+1600)*height;positions[i*3+2]=(random(i+1700)-0.5)*radius*1.7;}
  motesGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));geometries.add(motesGeo);
  const motesMat=new THREE.PointsMaterial({color:'#7cfaff',size:0.075,transparent:true,opacity:0.65,depthWrite:false});materials.add(motesMat);const motes=new THREE.Points(motesGeo,motesMat);group.add(motes);
  return {group,update(time:number){rings.forEach((r,i)=>r.scale.setScalar(0.8+((time*0.2+i*0.17)%1)*0.65));motes.position.y=Math.sin(time*0.25)*0.25;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}};
}
