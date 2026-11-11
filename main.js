import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { createHologram } from './hologram.js';

const host = document.getElementById('scene');
const status = document.getElementById('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050a);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 3.2, 9.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// Small procedural texture maps keep this test self-contained.
// Replace these with your own Earth/Sun texture files for a closer Mode 4 comparison.
function makeCanvasTexture(draw, width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const earthMap = makeCanvasTexture((ctx, w, h) => {
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#164b78'); ocean.addColorStop(.5, '#0879a9'); ocean.addColorStop(1, '#123c69');
  ctx.fillStyle = ocean; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#648b55';
  const shapes = [
    [[.08,.20],[.16,.13],[.22,.18],[.20,.30],[.16,.36],[.14,.50],[.10,.43],[.07,.31]],
    [[.22,.50],[.27,.55],[.29,.69],[.26,.87],[.22,.78],[.20,.62]],
    [[.43,.17],[.51,.12],[.56,.20],[.54,.31],[.48,.34],[.45,.27]],
    [[.48,.38],[.55,.42],[.58,.57],[.54,.77],[.50,.68],[.47,.52]],
    [[.62,.19],[.73,.13],[.84,.20],[.90,.31],[.82,.40],[.74,.35],[.67,.44],[.62,.33]],
    [[.76,.52],[.83,.49],[.88,.59],[.84,.72],[.78,.69]]
  ];
  for (const poly of shapes) {
    ctx.beginPath();
    poly.forEach(([x,y], i) => i ? ctx.lineTo(x*w,y*h) : ctx.moveTo(x*w,y*h));
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillRect(0, 0, w, 5); ctx.fillRect(0, h-5, w, 5);
});
const sunMap = makeCanvasTexture((ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffbd55'); g.addColorStop(.5, '#e87819'); g.addColorStop(1, '#a83d0b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 16;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,130,${Math.random() * .12})`; ctx.fill();
  }
});

scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const keyLight = new THREE.PointLight(0xffffff, 75, 30);
keyLight.position.set(-3, 4, 6);
scene.add(keyLight);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 48, 32),
  new THREE.MeshStandardMaterial({ map: sunMap, emissive: 0x8b3508, emissiveIntensity: .35, roughness: 1 })
);
sun.position.set(-2.25, 0, 0);
scene.add(sun);

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(.72, 48, 32),
  new THREE.MeshStandardMaterial({ map: earthMap, roughness: .9, metalness: 0 })
);
earth.position.set(2.0, 0, 0);
earth.rotation.y = Math.PI;
scene.add(earth);

const hologram = createHologram(THREE);
hologram.attachEarth(earth);
hologram.attachSun(sun);
hologram.setEnabled(true);

let view = 'orbit';
let hologramOn = true;

function setView(next) {
  view = next;
  if (view === 'orbit') {
    controls.target.set(0, 0, 0);
    camera.position.set(0, 3.2, 9.5);
    controls.enabled = true;
    hologram.setEnabled(hologramOn);
  } else if (view === 'earth') {
    controls.target.copy(earth.position);
    camera.position.set(earth.position.x, 1.0, 4.1);
    controls.enabled = true;
    hologram.setEnabled(false);
  } else {
    controls.target.copy(sun.position);
    camera.position.set(sun.position.x, 1.2, 4.8);
    controls.enabled = true;
    hologram.setEnabled(false);
  }
  status.textContent = `${view === 'orbit' ? 'Orbit View' : view === 'earth' ? 'Earth Focus' : 'Sun Focus'} · hologram ${view === 'orbit' && hologramOn ? 'enabled' : 'hidden'}`;
  document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
  document.getElementById(view === 'orbit' ? 'orbit' : view === 'earth' ? 'earthFocus' : 'sunFocus').classList.add('active');
}

document.getElementById('orbit').addEventListener('click', () => setView('orbit'));
document.getElementById('earthFocus').addEventListener('click', () => setView('earth'));
document.getElementById('sunFocus').addEventListener('click', () => setView('sun'));
document.getElementById('toggle').addEventListener('click', () => {
  hologramOn = !hologramOn;
  hologram.setEnabled(view === 'orbit' && hologramOn);
  document.getElementById('toggle').textContent = `Hologram: ${hologramOn ? 'On' : 'Off'}`;
  status.textContent = `${view === 'orbit' ? 'Orbit View' : view === 'earth' ? 'Earth Focus' : 'Sun Focus'} · hologram ${view === 'orbit' && hologramOn ? 'enabled' : 'hidden'}`;
});

function animate() {
  requestAnimationFrame(animate);
  earth.rotation.y += 0.0008;
  sun.rotation.y += 0.00025;
  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener('pagehide', () => hologram.dispose(), { once: true });
