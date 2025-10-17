import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/PointerLockControls.js";

let scene, camera, renderer, controls;
let humans = [];
let keys = {};
let clock = new THREE.Clock();

init();
animate();

function init() {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas") });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  // Pointer‑lock mouse‑look
  controls = new PointerLockControls(camera, document.body);
  document.body.addEventListener("click", () => controls.lock());
  controls.addEventListener("lock", () => console.log("Pointer locked"));
  controls.addEventListener("unlock", () => console.log("Pointer unlocked"));

  // Ground
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: 0x003300, wireframe: true })
  );
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // Humans (cubes that “believe” they’re people)
  const geo = new THREE.BoxGeometry(1, 2, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });

  for (let i = 0; i < 20; i++) {
    const h = new THREE.Mesh(geo, mat);
    h.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
    h.userData = {
      name: `Human_${i}`,
      dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      belief: "I am a human being.",
      timer: 0
    };
    humans.push(h);
    scene.add(h);
  }

  // Keyboard input
  document.addEventListener("keydown", e => (keys[e.key.toLowerCase()] = true));
  document.addEventListener("keyup", e => (keys[e.key.toLowerCase()] = false));

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function movePlayer(delta) {
  const speed = 10 * delta;
  const dir = new THREE.Vector3();

  if (keys["w"]) dir.z -= 1;
  if (keys["s"]) dir.z += 1;
  if (keys["a"]) dir.x -= 1;
  if (keys["d"]) dir.x += 1;

  dir.normalize();
  if (controls.isLocked) controls.moveRight(dir.x * speed), controls.moveForward(dir.z * speed);
}

function think(h) {
  const thoughts = [
    "I move, therefore I exist.",
    "I think I am human.",
    "Why do I always walk?",
    "Is someone watching me?",
    "Maybe I’m in a simulation.",
    "I must keep moving to stay alive."
  ];
  h.userData.belief = thoughts[Math.floor(Math.random() * thoughts.length)];
  if (Math.random() < 0.3) console.log(`${h.userData.name}: "${h.userData.belief}"`);
  h.userData.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  movePlayer(delta);

  // Update humans
  humans.forEach(h => {
    h.userData.timer += delta;
    if (h.userData.timer > 2) {
      h.userData.timer = 0;
      think(h);
    }
    h.position.addScaledVector(h.userData.dir, delta * 5);
  });

  renderer.render(scene, camera);
}
