import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// FBX files often reference textures by external path. Those files are not in the
// library, so every non-inline URL resolves to this pixel instead of a network request,
// and maps that ended up with it (or failed to decode) are removed once loading settles.
const WHITE_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 6, 4);
    this.scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.clock = new THREE.Clock();
    this.mixer = null;
    this.action = null;
    this.model = null;
    this.grid = null;
    this.onTick = null;

    const manager = new THREE.LoadingManager();
    this.texturesBusy = false;
    manager.onStart = () => { this.texturesBusy = true; };
    manager.onLoad = () => { this.texturesBusy = false; };
    manager.setURLModifier(url => (url.startsWith('data:') || url.startsWith('blob:')) ? url : WHITE_PIXEL);
    this.gltf = new GLTFLoader(manager);
    this.fbx = new FBXLoader(manager);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const dt = this.clock.getDelta();
    if (this.mixer) this.mixer.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onTick?.();
  }

  /** Parses bytes into the scene and returns stats plus animation clips. */
  async show(format, bytes) {
    this.clear();
    let root, clips;
    if (format === 'glb' || format === 'gltf') {
      const gltf = await this.gltf.parseAsync(bytes, '');
      root = gltf.scene; clips = gltf.animations;
    } else if (format === 'fbx') {
      root = this.fbx.parse(bytes, '');
      clips = root.animations;
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    await this.texturesSettled();
    stripUnusableMaps(root);

    this.model = root;
    this.scene.add(root);
    // Animation-only files (a rig and clips, no mesh) would render as nothing; show the skeleton instead.
    if (!stats(root).meshes) {
      this.skeleton = new THREE.SkeletonHelper(root);
      this.scene.add(this.skeleton);
    }
    this.frameModel();

    if (clips.length) this.mixer = new THREE.AnimationMixer(root);
    return { clips, ...stats(root) };
  }

  play(clip, speed = 1) {
    if (!this.mixer) return;
    this.mixer.stopAllAction();
    this.action = this.mixer.clipAction(clip);
    this.action.reset().play();
    this.mixer.timeScale = speed;
  }

  setPaused(paused) { if (this.action) this.action.paused = paused; }
  setSpeed(speed) { if (this.mixer) this.mixer.timeScale = speed; }
  seek(fraction) {
    if (!this.action) return;
    this.action.time = fraction * this.action.getClip().duration;
    this.mixer.update(0);
  }
  get time() { return this.action ? this.action.time : 0; }
  get duration() { return this.action ? this.action.getClip().duration : 0; }

  frameModel() {
    if (!this.model) return;
    this.model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 1e-3);
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.1;

    this.camera.near = dist / 100;
    this.camera.far = dist * 100;
    this.camera.position.copy(center).add(new THREE.Vector3(0.6, 0.45, 1).normalize().multiplyScalar(dist));
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.maxDistance = dist * 10;
    this.controls.update();

    if (this.grid) { this.scene.remove(this.grid); this.grid.geometry.dispose(); this.grid.material.dispose(); }
    const extent = Math.max(size.x, size.z) * 2 || 2;
    this.grid = new THREE.GridHelper(extent, 20, 0x888888, 0x888888);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.25;
    this.grid.position.set(center.x, box.min.y, center.z);
    this.scene.add(this.grid);
  }

  texturesSettled(timeoutMs = 5000) {
    const until = performance.now() + timeoutMs;
    return new Promise(resolve => {
      const check = () => (!this.texturesBusy || performance.now() > until) ? resolve() : setTimeout(check, 30);
      check();
    });
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }

  clear() {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; this.action = null; }
    if (this.skeleton) { this.scene.remove(this.skeleton); this.skeleton.dispose(); this.skeleton = null; }
    if (!this.model) return;
    this.scene.remove(this.model);
    this.model.traverse(o => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    this.model = null;
  }
}

function stripUnusableMaps(root) {
  root.traverse(o => {
    for (const m of [].concat(o.material || [])) {
      for (const [key, tex] of Object.entries(m)) {
        if (!tex?.isTexture) continue;
        const img = tex.image;
        if (img && img.width > 0 && img.src !== WHITE_PIXEL) continue;
        tex.dispose();
        m[key] = null;
        m.needsUpdate = true;
      }
    }
  });
}

function stats(root) {
  let meshes = 0, tris = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { meshes, triangles: Math.round(tris) };
}
