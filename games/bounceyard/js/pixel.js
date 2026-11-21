// BOUNCEYARD – Pixel-Renderer (Three.js). Interne Auflösung 180×320, 1 Bildpixel = 1 Spielpixel.
import * as THREE from 'three';

export const LW = 180, LH = 320, SCALE = 4;

export const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(LW * SCALE, LH * SCALE, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor('#2b1d3a');

export const scene = new THREE.Scene();
export const camera = new THREE.OrthographicCamera(0, LW, 0, -LH, -100, 100);
camera.position.z = 50;

export const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const texCache = new Map();
function nearest(t) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t; }
export function tex(url) {
  if (!texCache.has(url)) texCache.set(url, nearest(loader.load(url)));
  return texCache.get(url);
}
export function canvasTex(c) { return nearest(new THREE.CanvasTexture(c)); }

// Bilder zusätzlich als <img> laden (für Canvas-Hintergründe)
const imgCache = new Map();
export function img(url) {
  if (!imgCache.has(url)) {
    const im = new Image(); manager.itemStart(url);
    im.onload = () => manager.itemEnd(url); im.onerror = () => manager.itemError(url);
    im.src = url; imgCache.set(url, im);
  }
  return imgCache.get(url);
}

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `uniform sampler2D map; uniform vec2 rep; uniform vec2 off; uniform float flash; uniform vec3 flashCol; uniform vec3 tint; uniform float opacity; varying vec2 vUv;
void main(){ vec4 c = texture2D(map, vUv * rep + off); if (c.a < 0.04) discard;
  c.rgb = mix(c.rgb * tint, flashCol, flash); gl_FragColor = vec4(c.rgb, c.a * opacity); }`;
const geoCache = new Map();
function plane(w, h) { const k = w + 'x' + h; if (!geoCache.has(k)) geoCache.set(k, new THREE.PlaneGeometry(w, h)); return geoCache.get(k); }

export class Sprite {
  constructor(src, fw, fh, frames = 1, opts = {}) {
    this.frames = frames; this.fw = fw; this.fh = fh;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: typeof src === 'string' ? tex(src) : src },
        rep: { value: new THREE.Vector2(1 / frames, 1) }, off: { value: new THREE.Vector2(0, 0) },
        flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 1, 1) }, tint: { value: new THREE.Color(1, 1, 1) }, opacity: { value: 1 },
      },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(plane(fw, fh), this.mat);
    this.mesh.renderOrder = opts.z ?? 5;
    this.x = 0; this.y = 0; this.sx = 1; this.sy = 1; this.frame = 0; this.flip = false;
    (opts.parent || scene).add(this.mesh);
  }
  setFrame(i) { i = Math.max(0, Math.min(this.frames - 1, i | 0)); if (i !== this.frame) { this.frame = i; this.mat.uniforms.off.value.x = i / this.frames; } return this; }
  at(x, y) { this.x = x; this.y = y; return this.sync(); }
  sync() {
    // linke obere Ecke auf ganze Pixel legen → pixelgenau
    const w = this.fw * this.sx, h = this.fh * this.sy;
    const lx = Math.round(this.x - w / 2), ty = Math.round(this.y - h / 2);
    this.mesh.position.set(lx + w / 2, -(ty + h / 2), 0);
    this.mesh.scale.set(this.flip ? -this.sx : this.sx, this.sy, 1);
    return this;
  }
  set flash(v) { this.mat.uniforms.flash.value = v; }
  flashColor(c) { this.mat.uniforms.flashCol.value.set(c); return this; }
  set opacity(v) { this.mat.uniforms.opacity.value = v; }
  tint(c) { this.mat.uniforms.tint.value.set(c); return this; }
  set visible(v) { this.mesh.visible = v; }
  get visible() { return this.mesh.visible; }
  set z(v) { this.mesh.renderOrder = v; }
  remove() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mat.dispose(); }
}

export function rect(x, y, w, h, color, z = 1, opacity = 1, parent = scene) {
  const m = new THREE.Mesh(plane(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }));
  m.renderOrder = z; parent.add(m); placeRect(m, x, y, w, h);
  return m;
}
export function placeRect(m, x, y, w, h) {
  x = Math.round(x); y = Math.round(y); w = Math.max(0, Math.round(w)); h = Math.round(h);
  m.scale.set(Math.max(w, 0.0001), h, 1); m.position.set(x + w / 2, -(y + h / 2), 0);
}
export function quad(texture, x, y, w, h, z = 0, parent = scene) {
  const m = new THREE.Mesh(plane(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  m.position.set(x + w / 2, -(y + h / 2), 0); m.renderOrder = z; parent.add(m); return m;
}

// ---------------------------------------------------------------- Pixel-Partikel (1×1 bzw. 2×2)
const MAX_P = 700;
const pMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, depthWrite: false }), MAX_P);
pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
pMesh.frustumCulled = false; pMesh.renderOrder = 30;
scene.add(pMesh);
const P = Array.from({ length: MAX_P }, () => ({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, s: 1, drag: 0 }));
let pc = 0;
const _c = new THREE.Color(), _m = new THREE.Matrix4();
export const FXQ = { low: false };
export function emit(x, y, color, n = 6, speed = 40, size = 1, life = 0.45, opts = {}) {
  if (FXQ.low && n > 1) n = Math.ceil(n / 2);
  _c.set(color);
  for (let i = 0; i < n; i++) {
    const idx = pc; const p = P[idx]; pc = (pc + 1) % MAX_P;
    const a = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? 0.6) : Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random() * 0.8);
    p.x = x + (Math.random() - 0.5) * (opts.jx || 0); p.y = y + (Math.random() - 0.5) * (opts.jy || 0);
    p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - (opts.up ?? 15);
    p.g = opts.g ?? 120; p.drag = opts.drag ?? 1.5;
    p.life = p.max = life * (0.6 + Math.random() * 0.7);
    p.s = size > 1 && Math.random() < 0.5 ? size : Math.max(1, size - (Math.random() < 0.4 ? 1 : 0));
    pMesh.setColorAt(idx, _c);
  }
  pMesh.instanceColor.needsUpdate = true;
}
export function updateParticles(dt) {
  for (let i = 0; i < MAX_P; i++) {
    const p = P[i];
    if (p.life > 0) {
      p.life -= dt; p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * 0.3;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const s = p.life > p.max * 0.4 ? p.s : 1;
      _m.makeScale(s, s, 1).setPosition(Math.round(p.x) + s / 2, -(Math.round(p.y) + s / 2), 0);
    } else _m.makeScale(0, 0, 0);
    pMesh.setMatrixAt(i, _m);
  }
  pMesh.instanceMatrix.needsUpdate = true;
}
export function clearParticles() { for (const p of P) p.life = 0; }
