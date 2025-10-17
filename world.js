import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

let scene, camera, renderer;
let humans = [];
let keys = {};
let velocity = new THREE.Vector3();
let clock = new THREE.Clock();

let yaw = 0; // camera rotation
let pitch = 0;
let isPointerLocked = false;

init();
animate();

function init() {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas") });
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // === Matrix Skybox ===
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 512, 512);
  ctx.font = "20px monospace";
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#00ff00" : "#009900";
    ctx.fillText(Math.random() > 0.5 ? "1" : "0", Math.random() * 512, Math.random() * 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const skyGeo = new THREE.BoxGeometry(500, 500, 500);
  const skyMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  // Ground
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: 0x003300, wireframe: true })
  );
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // Humans (cubes)
  const geo = new THREE.BoxGeometry(1, 2, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });

  for (let i = 0; i < 20; i++) {
    const h = new THREE.Mesh(geo, mat);
    h.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
    h.userData = {
      name: `Human_${i}`,
      dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      belief: "I am a human being.",
      thoughts: [],
      timer: 0
    };
    humans.push(h);
    scene.add(h);
  }

  // === Mouse look ===
  const canvasElement = document.getElementById("matrixCanvas");
  canvasElement.addEventListener("click", () => {
    canvasElement.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    isPointerLocked = document.pointerLockElement === canvasElement;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isPointerLocked) return;
    const sensitivity = 0.002;
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  });

  // Controls
  document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
  document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Player movement
  const speed = 20 * delta;
  const direction = new THREE.Vector3();
  if (keys["w"]) direction.z -= 1;
  if (keys["s"]) direction.z += 1;
  if (keys["a"]) direction.x -= 1;
  if (keys["d"]) direction.x += 1;

  direction.normalize();
  const move = new THREE.Vector3(direction.x, 0, direction.z);
  move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.addScaledVector(move, speed);

  // AI: update "thoughts" and movement
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

function think(human) {
  const thoughts = [
    "I move, therefore I exist.",
    "I think I am human.",
    "Why do I always walk?",
    "Is someone watching me?",
    "Maybe I’m in a simulation.",
    "I must keep moving to stay alive."
  ];
  const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
  human.userData.thoughts.push(thought);
  human.userData.belief = thought;
  human.userData.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);

  if (Math.random() < 0.3) console.log(`${human.userData.name}: "${human.userData.belief}"`);
}
