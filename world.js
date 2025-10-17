import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/PointerLockControls.js";

// Make sure to include Socket.IO in HTML:
// <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

let scene, camera, renderer, controls;
let humans = [];
let keys = {};
let velocity = new THREE.Vector3();
let clock = new THREE.Clock();

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas") });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 20); // moved back to see cubes
  camera.lookAt(0, 0, 0);

  // Pointer lock controls for mouse look
  controls = new PointerLockControls(camera, document.body);
  document.body.addEventListener("click", () => controls.lock());

  // Ground
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: 0x003300, wireframe: true })
  );
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // Humans
  const geo = new THREE.BoxGeometry(1, 2, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });

  for (let i = 0; i < 20; i++) {
    const h = new THREE.Mesh(geo, mat);
    h.position.set((Math.random() - 0.5) * 40, 1, (Math.random() - 0.5) * 40);
    h.userData = {
      id: i,
      name: `Human_${i}`,
      dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      belief: "I am a human being.",
      thoughts: [],
      timer: 0
    };
    humans.push(h);
    scene.add(h);
  }

  // Keyboard input
  document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
  document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Python backend integration
  const socket = io("http://localhost:5000"); // adjust if needed
  socket.on("ai_update", agents => {
    agents.forEach(a => {
      const h = humans[a.id];
      if (h) h.userData.belief = a.belief;
    });
  });
}

function movePlayer(delta) {
  if (!controls.isLocked) return;
  const speed = 10 * delta;
  const dir = new THREE.Vector3();
  if (keys["w"]) dir.z -= 1;
  if (keys["s"]) dir.z += 1;
  if (keys["a"]) dir.x -= 1;
  if (keys["d"]) dir.x += 1;
  dir.normalize();
  controls.moveRight(dir.x * speed);
  controls.moveForward(dir.z * speed);
}

function wanderHuman(h, delta) {
  h.userData.timer += delta;
  if (h.userData.timer > 2) {
    h.userData.timer = 0;
    h.userData.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);
  }
  h.position.addScaledVector(h.userData.dir, delta * 5);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  movePlayer(delta);
  humans.forEach(h => wanderHuman(h, delta));

  renderer.render(scene, camera);
}
