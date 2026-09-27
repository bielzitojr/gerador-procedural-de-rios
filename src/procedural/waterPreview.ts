import * as THREE from 'three';
import { RiverPhysicsManager } from '../physics/riverObjectPhysics';
import { OceanData } from './oceanMesh';
/** Isolated material preview: no terrain, rocks, characters or physical objects. */
export function generateWaterPreview(material: THREE.ShaderMaterial): OceanData {
 const terrainMesh = new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());terrainMesh.visible=false;
 const geometry=new THREE.PlaneGeometry(260,260,160,160);geometry.rotateX(-Math.PI/2);
 const waterMesh=new THREE.Mesh(geometry,material);waterMesh.name='IsolatedWaterPreview';
 const physicsManager=new RiverPhysicsManager();
 return {terrainMesh,waterMesh,rocksGroup:new THREE.Group(),objectsGroup:physicsManager.container,physicsManager,ducks:[],getTerrainHeight:()=>-20,update:()=>{},dispose(){geometry.dispose();terrainMesh.geometry.dispose();(terrainMesh.material as THREE.Material).dispose();physicsManager.dispose();}};
}
