import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

let scene, camera, renderer;
let humans = [];
let keys = {};
let velocity = new THREE.Vector3();
let clock = new THREE.Clock();

init();
animate();

function init() {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas") });
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  // Ground
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: 0x003300, wireframe: true })
  );
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // Humans (simple cubes)
  const geo = new THREE.BoxGeometry(1, 2, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
  for (let i = 0; i < 20; i++) {
    const h = new THREE.Mesh(geo, mat);
    h.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
    h.userData.dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    humans.push(h);
    scene.add(h);
  }

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
  if (keys["w"]) velocity.z = -speed;
  else if (keys["s"]) velocity.z = speed;
  else velocity.z = 0;

  if (keys["a"]) velocity.x = -speed;
  else if (keys["d"]) velocity.x = speed;
  else velocity.x = 0;

  camera.translateX(velocity.x);
  camera.translateZ(velocity.z);

  // AI humans wander
  humans.forEach(h => {
    h.position.addScaledVector(h.userData.dir, delta * 5);
    if (Math.random() < 0.01) {
      h.userData.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);
    }
  });

  renderer.render(scene, camera);
}
