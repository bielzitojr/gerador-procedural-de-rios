import * as THREE from 'three';

/** First-person exploration with ground/water clearance and drag-to-look fallback. */
export class FirstPersonCamera {
  private keys = new Set<string>();
  private enabled = false;
  private dragging = false;
  private yaw = 0;
  private pitch = 0;
  private cleanup: (() => void)[] = [];
  constructor(private camera: THREE.PerspectiveCamera, private canvas: HTMLCanvasElement) {
    const listen = (target: EventTarget, name: string, fn: EventListener) => { target.addEventListener(name, fn); this.cleanup.push(() => target.removeEventListener(name, fn)); };
    listen(window, 'keydown', ((e: KeyboardEvent) => {
      if (!this.enabled || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft'].includes(e.code)) { this.keys.add(e.code); e.preventDefault(); }
      if (e.code === 'Escape') { this.keys.clear(); this.dragging = false; }
    }) as EventListener);
    listen(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.code); }) as EventListener);
    listen(window, 'blur', (() => { this.keys.clear(); this.dragging = false; }) as EventListener);
    listen(document, 'visibilitychange', (() => { this.keys.clear(); this.dragging = false; }) as EventListener);
    listen(canvas, 'pointerdown', ((e: PointerEvent) => { if(this.enabled) { this.dragging = true; canvas.setPointerCapture(e.pointerId); } }) as EventListener);
    listen(canvas, 'pointermove', ((e: PointerEvent) => {
      if(!this.enabled || !this.dragging) return;
      this.yaw -= e.movementX * 0.003; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.003, -1.4, 1.4);
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    }) as EventListener);
    const stop = () => { this.dragging = false; };
    listen(canvas, 'pointerup', stop); listen(canvas, 'pointercancel', stop);
    listen(window, 'explorer-move', ((e: CustomEvent<{key: string; down: boolean}>) => { if(this.enabled) e.detail.down ? this.keys.add(e.detail.key) : this.keys.delete(e.detail.key); }) as EventListener);
  }
  update(active: boolean, delta: number, ground?: (x: number,z: number) => number) {
    if(active !== this.enabled) {
      this.enabled = active; this.keys.clear(); this.dragging = false;
      if(active) {
        this.camera.position.set(10, 4, 24); this.camera.lookAt(0, 7, -14);
        const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ'); this.yaw=e.y; this.pitch=e.x;
      }
    }
    if(!active) return;
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
    const move = new THREE.Vector3(x,0,z).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw).multiplyScalar(Math.min(delta,0.05)*(this.keys.has('ShiftLeft')?14:6));
    const next = this.camera.position.clone().add(move);
    next.x=THREE.MathUtils.clamp(next.x,-46,46); next.z=THREE.MathUtils.clamp(next.z,-46,46);
    const targetHeight = Math.max(0,ground?.(next.x,next.z) ?? 0) + 1.7;
    // Block cliffs; entering water keeps the eye above the surface.
    if(targetHeight < this.camera.position.y+1.2 || move.lengthSq()===0) {
      this.camera.position.x=next.x; this.camera.position.z=next.z;
      this.camera.position.y=THREE.MathUtils.lerp(this.camera.position.y,targetHeight,1-Math.exp(-delta*10));
    }
  }
  dispose() { this.cleanup.forEach(fn=>fn()); this.keys.clear(); }
}
