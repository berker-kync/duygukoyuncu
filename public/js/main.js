import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { TEETH, PLANETS, RADIUS, CENTER_DISTANCE, RATIO, externalGear, internalGear, pose } from './gears.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const canvas = $('scene');
const stage = $('stage');
const still = matchMedia('(prefers-reduced-motion: reduce)');

const IDLE_SPEED = 0.22; // sun gear, rad/s
const FULL_SPEED = 2 * Math.PI; // 60 rpm; faster than this the teeth strobe at 60 Hz
const BUILD_TIME = 1.7; // s
const STRIP_TIME = 1.1;
const ASSEMBLED = { yaw: -0.5, pitch: 0.34, radius: 43 };
const APART = { yaw: -0.92, pitch: 0.36, radius: 55 };

/* ---------- geometry ---------- */

const WIDTH = 8; // gear face width
const toShape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const circle = (r, x = 0, y = 0) => new THREE.Path().absarc(x, y, r, 0, Math.PI * 2, true);
const extrude = (shape, depth, z, curveSegments = 48) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments }).translate(0, 0, z);
const tube = (outer, inner, depth, z) => {
  const s = new THREE.Shape().absarc(0, 0, outer, 0, Math.PI * 2, false);
  if (inner) s.holes.push(circle(inner));
  return extrude(s, depth, z);
};
const metal = (color, roughness, metalness = 1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const MATERIAL = {
  ring: () => metal(0x6d7b78, 0.42, 0.85),
  planets: () => metal(0xd5dbda, 0.26),
  sun: () => metal(0xe3a93c, 0.27),
  carrier: () => metal(0x3d5199, 0.36, 0.75),
};
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x14231d, transparent: true, opacity: 0.62 });

function solid(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), lineMaterial));
  return mesh;
}

function makeRing() {
  const g = new THREE.Group();
  const m = MATERIAL.ring();
  const outer = () => {
    // Round body with six bolt lugs.
    const s = new THREE.Shape();
    const lugs = 6, R = 34, L = 37.5, w = 0.13, f = 0.07;
    for (let i = 0; i < lugs; i++) {
      const a = (i * Math.PI * 2) / lugs + Math.PI / 6;
      const next = a + (Math.PI * 2) / lugs;
      if (!i) s.moveTo(L * Math.cos(a - w), L * Math.sin(a - w));
      s.absarc(0, 0, L, a - w, a + w, false);
      s.lineTo(R * Math.cos(a + w + f), R * Math.sin(a + w + f));
      s.absarc(0, 0, R, a + w + f, next - w - f, false);
      s.lineTo(L * Math.cos(next - w), L * Math.sin(next - w));
    }
    for (let i = 0; i < lugs; i++) {
      const a = (i * Math.PI * 2) / lugs + Math.PI / 6;
      s.holes.push(circle(1.3, 35 * Math.cos(a), 35 * Math.sin(a)));
    }
    return s;
  };
  const toothed = outer();
  toothed.holes.push(new THREE.Path(internalGear(TEETH.ring).map(([x, y]) => new THREE.Vector2(x, y))));
  g.add(solid(extrude(toothed, WIDTH + 1, -WIDTH / 2 - 0.5, 14), m));
  const back = outer();
  back.holes.push(circle(6.2));
  g.add(solid(extrude(back, 3, -WIDTH / 2 - 3.5, 14), m));
  g.add(solid(tube(10, 6.2, 5, -WIDTH / 2 - 8.5), m));
  return g;
}

function makeSun() {
  const g = new THREE.Group();
  const m = MATERIAL.sun();
  const s = toShape(externalGear(TEETH.sun));
  s.holes.push(circle(3));
  g.add(solid(extrude(s, WIDTH, -WIDTH / 2), m));
  g.add(solid(tube(5.6, 3, 19, -WIDTH / 2 - 19), m)); // input shaft, through the back of the ring
  g.add(solid(tube(7.5, 3, 0.7, WIDTH / 2), m));
  return g;
}

function makePlanet() {
  const g = new THREE.Group();
  const m = MATERIAL.planets();
  const s = toShape(externalGear(TEETH.planet));
  s.holes.push(circle(3.6));
  g.add(solid(extrude(s, WIDTH, -WIDTH / 2), m));
  const bush = MATERIAL.sun();
  g.add(solid(tube(3.6, 2.55, WIDTH + 0.6, -WIDTH / 2 - 0.3), bush));
  g.userData.materials = [m, bush];
  return g;
}

function makeCarrier() {
  const g = new THREE.Group();
  const m = MATERIAL.carrier();
  // Three-armed spider: pads over the planet centres joined to a hub by straight arms.
  const s = new THREE.Shape();
  const pad = 5, hub = 8.5, arm = 3.4, c = CENTER_DISTANCE;
  for (let i = 0; i < PLANETS; i++) {
    const a = (i * Math.PI * 2) / PLANETS;
    const at = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const t = Math.asin(arm / pad), h = Math.asin(arm / hub);
    if (!i) s.moveTo(...at(hub * Math.cos(h), -arm));
    s.lineTo(...at(c - pad * Math.cos(t), -arm));
    s.absarc(...at(c, 0), pad, a - Math.PI + t, a + Math.PI - t, false);
    s.lineTo(...at(hub * Math.cos(h), arm));
    s.absarc(0, 0, hub, a + h, a + (Math.PI * 2) / PLANETS - h, false);
  }
  s.holes.push(circle(2.8));
  const z = WIDTH / 2 + 1.2;
  g.add(solid(extrude(s, 3, z, 24), m));
  g.add(solid(tube(6.2, 2.8, 8, z + 3), m)); // output hub
  const steel = MATERIAL.planets();
  for (let i = 0; i < PLANETS; i++) {
    const a = (i * Math.PI * 2) / PLANETS;
    const pin = solid(tube(2.5, 0, WIDTH + 5.4, -WIDTH / 2 - 0.4), steel);
    pin.position.set(c * Math.cos(a), c * Math.sin(a), 0);
    g.add(pin);
  }
  g.userData.materials = [m, steel];
  return g;
}

/* ---------- scene ---------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); // throws without WebGL: page stays text
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.75;
pmrem.dispose();

const key = new THREE.DirectionalLight(0xfff4e0, 2.1);
key.position.set(-50, 90, 110);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 320 });
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.12;
scene.add(key);

const camera = new THREE.PerspectiveCamera(24, 1, 10, 2000);
const gearbox = new THREE.Group();
scene.add(gearbox);

const planets = new THREE.Group();
const planetGears = Array.from({ length: PLANETS }, () => planets.add(makePlanet()).children.at(-1));

// z: resting place when apart. from: where the part flies in from. build: its share of the assembly (start, end).
// anchor: local point the balloon points to. out: balloon offset in stage radii.
const parts = {
  ring: { node: makeRing(), z: -40, from: -130, intro: 0.0, build: [0, 0.45], anchor: [0, -35.5, 4], out: [0.1, 0.24] },
  planets: { node: planets, z: -5, from: 115, intro: 0.18, build: [0.15, 0.62], out: [0.2, -0.42] },
  sun: { node: makeSun(), z: 24, from: 130, intro: 0.36, build: [0.32, 0.8], anchor: [0, -5.6, -12], out: [0.06, 0.42] },
  carrier: { node: makeCarrier(), z: 46, from: 140, intro: 0.54, build: [0.5, 1], anchor: [0, 0, 16], out: [-0.22, 0.34] },
};
for (const p of Object.values(parts)) {
  gearbox.add(p.node);
  const found = new Set();
  p.node.traverse((o) => o.isMesh && found.add(o.material));
  p.materials = [...found];
  p.glow = 0;
}

/* ---------- balloons ---------- */

const SVG = 'http://www.w3.org/2000/svg';
Object.values(parts).forEach((p, i) => {
  p.balloon = $('balloons').appendChild(Object.assign(document.createElement('div'), { className: 'balloon', textContent: i + 1 }));
  p.line = $('leaders').appendChild(document.createElementNS(SVG, 'line'));
  p.dot = $('leaders').appendChild(document.createElementNS(SVG, 'circle'));
  p.dot.setAttribute('r', 3);
});

/* ---------- state ---------- */

let progress = 0; // 0 apart, 1 assembled
let sunAngle = 0.4;
let speed = IDLE_SPEED;
let introTime = still.matches ? 9 : 0;
let lookX = 0, lookY = 0, aimX = 0, aimY = 0;
let holding = false;
let highlighted = null;
let view = null;
let needsFrame = true;

const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 4;
const mix = (a, b, t) => a + (b - a) * t;

function setHolding(on) {
  if (on === holding) return;
  holding = on;
  needsFrame = true;
  root.classList.toggle('holding', on);
}
function setState(text) {
  if ($('state').textContent !== text) $('state').textContent = text;
}

const button = $('hold');
for (const el of [button, stage]) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    setHolding(true);
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
for (const type of ['pointerup', 'pointercancel', 'blur']) addEventListener(type, () => setHolding(false));
document.addEventListener('visibilitychange', () => document.hidden && setHolding(false));
button.addEventListener('keydown', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  setHolding(true);
});
button.addEventListener('keyup', () => setHolding(false));
button.addEventListener('blur', () => setHolding(false));
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  aimX = (e.clientX / innerWidth) * 2 - 1;
  aimY = (e.clientY / innerHeight) * 2 - 1;
});
for (const li of document.querySelectorAll('[data-part]')) {
  li.addEventListener('pointerenter', () => { highlighted = li.dataset.part; needsFrame = true; });
  li.addEventListener('pointerleave', () => { highlighted = null; needsFrame = true; });
}
still.addEventListener('change', () => { introTime = 9; needsFrame = true; });

/* ---------- layout ---------- */

function layout() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const box = canvas.getBoundingClientRect();
  const intro = document.querySelector('.intro').getBoundingClientRect();
  const plate = document.querySelector('.plate').getBoundingClientRect();
  // Wide: right of the name, running the full height above the plate. Narrow: between name and plate.
  const wide = w > 700 && innerWidth > innerHeight;
  const left = wide ? w * 0.38 : 0;
  const top = (wide ? 0 : intro.bottom) - box.top;
  const right = w;
  const bottom = plate.top - box.top;
  const W = right - left, H = bottom - top;
  // Apart, the stack is long and low; assembled it is roughly round.
  view = { w, h, cx: (left + right) / 2, cy: (top + bottom) / 2, apart: Math.min(W / 1.24, H / 0.88), assembled: Math.min(W, H) };
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  needsFrame = true;
}
const observer = new ResizeObserver(layout);
[canvas, document.querySelector('.plate')].forEach((el) => observer.observe(el));
addEventListener('resize', layout);
document.fonts?.ready.then(layout);

/* ---------- frame ---------- */

const v = new THREE.Vector3();
const planetAnchor = new THREE.Vector3();
let shownIn, shownOut;

function update(dt) {
  const calm = still.matches;
  introTime += dt;

  const target = holding ? 1 : 0;
  if (calm) progress = target;
  else progress = clamp(progress + (holding ? dt / BUILD_TIME : -dt / STRIP_TIME));

  // Only a fully closed gearbox runs up to speed; it coasts down as soon as it is let go.
  const goal = calm ? 0 : progress === 1 ? FULL_SPEED : IDLE_SPEED;
  speed += (goal - speed) * (1 - Math.exp(-dt * (goal > speed ? 2.2 : 5)));
  if (calm) speed = 0;
  sunAngle += speed * dt;

  const p = pose(sunAngle);
  parts.sun.node.rotation.z = p.sun;
  parts.carrier.node.rotation.z = p.carrier;
  planetGears.forEach((gear, i) => {
    const { at, spin } = p.planets[i];
    gear.position.set(CENTER_DISTANCE * Math.cos(at), CENTER_DISTANCE * Math.sin(at), 0);
    gear.rotation.z = spin;
  });

  // The planet balloon follows whichever planet is highest, gliding across when that changes.
  v.copy(planetGears.reduce((a, b) => (b.position.y > a.position.y ? b : a)).position).setZ(WIDTH / 2);
  planetAnchor.lerp(v, planetAnchor.lengthSq() ? 1 - Math.exp(-dt * 4) : 1);

  const now = performance.now() / 1000;
  Object.entries(parts).forEach(([name, part], i) => {
    const [a, b] = part.build;
    const t = ease(clamp((progress - a) / (b - a)));
    const arrive = easeOut(clamp((introTime - 0.35 - part.intro) / 1.5));
    part.node.visible = arrive > 0;
    const drift = calm ? 0 : Math.sin(now * 0.8 + i * 1.3) * 0.9;
    part.node.position.z = (part.z + drift) * (1 - t) + (part.from - part.z) * (1 - arrive) * (1 - t);
    part.glow += ((highlighted === name ? 1 : 0) - part.glow) * (calm ? 1 : 1 - Math.exp(-dt * 10));
    for (const m of part.materials) m.emissive.setScalar(part.glow * 0.22);
  });

  const k = 1 - Math.exp(-dt * 3);
  lookX += ((calm ? 0 : aimX) - lookX) * k;
  lookY += ((calm ? 0 : aimY) - lookY) * k;
  const e = ease(progress);
  gearbox.rotation.y = mix(APART.yaw, ASSEMBLED.yaw, e) + lookX * 0.16;
  gearbox.rotation.x = mix(APART.pitch, ASSEMBLED.pitch, e) + lookY * 0.1;
  // A little hum at speed.
  const hum = calm ? 0 : clamp((speed - 3) / 3) * 0.05;
  gearbox.position.set(Math.sin(now * 71) * hum, Math.cos(now * 83) * hum, 0);

  if (view) {
    const radius = mix(APART.radius, ASSEMBLED.radius, e);
    const half = Math.tan((camera.fov / 2) * (Math.PI / 180));
    camera.aspect = view.w / view.h;
    camera.position.z = (radius / half) * (view.h / mix(view.apart, view.assembled, e));
    camera.near = camera.position.z * 0.3;
    camera.far = camera.position.z * 3;
    camera.setViewOffset(view.w, view.h, view.w / 2 - view.cx, view.h / 2 - view.cy, view.w, view.h);
  }
}

function drawBalloons() {
  const alpha = clamp(1 - progress * 4) * clamp((introTime - 1.8) / 0.6);
  $('balloons').style.opacity = $('leaders').style.opacity = alpha;
  if (!alpha) return;
  for (const part of Object.values(parts)) {
    if (part === parts.planets) v.copy(planetAnchor);
    else v.fromArray(part.anchor);
    v.z += part.node.position.z;
    gearbox.localToWorld(v).project(camera);
    const x = (v.x * 0.5 + 0.5) * view.w, y = (-v.y * 0.5 + 0.5) * view.h;
    const bx = THREE.MathUtils.clamp(x + part.out[0] * view.apart * 0.5, 24, view.w - 24);
    const by = y + part.out[1] * view.apart * 0.5;
    const len = Math.hypot(bx - x, by - y) || 1;
    part.balloon.style.transform = `translate(${bx}px, ${by}px)`;
    part.line.setAttribute('x1', x); part.line.setAttribute('y1', y);
    part.line.setAttribute('x2', bx - ((bx - x) / len) * 17); part.line.setAttribute('y2', by - ((by - y) / len) * 17);
    part.dot.setAttribute('cx', x); part.dot.setAttribute('cy', y);
  }
}
function readout() {
  const toRpm = 60 / (2 * Math.PI);
  const inRpm = (speed * toRpm).toFixed(1), outRpm = ((speed / RATIO) * toRpm).toFixed(1);
  if (inRpm !== shownIn) $('rpm-in').textContent = shownIn = inRpm;
  if (outRpm !== shownOut) $('rpm-out').textContent = shownOut = outRpm;
  if (progress === 1) setState('Assembled, for now');
  else if (holding) setState('Assembling');
  else if (progress > 0) setState('Not finished yet');
  else setState('In pieces');
}

let last = performance.now();
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
  last = t;
  if (!view || (still.matches && !needsFrame)) return;
  needsFrame = false;
  update(dt);
  camera.updateMatrixWorld();
  gearbox.updateMatrixWorld();
  renderer.render(scene, camera);
  drawBalloons();
  readout();
});

root.classList.add('ready');
layout();
